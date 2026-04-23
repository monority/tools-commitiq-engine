import { execa } from 'execa';
import { execSync } from 'node:child_process';

export async function run() {
    const files = execSync('git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf8' })
        .split('\n').map(s => s.trim()).filter(Boolean);

    const jsFiles = files.filter(f => /\.(js|jsx|ts|tsx)$/.test(f));
    const formatFiles = files.filter(f => /\.(js|jsx|ts|tsx|json|md|yml|yaml|css|scss)$/.test(f));
    const tasks = [];

    if (formatFiles.length) {
        tasks.push(execa('pnpm', ['exec', 'prettier', '--write', ...formatFiles], { stdio: 'inherit' }));
    }
    if (jsFiles.length) {
        tasks.push(execa('pnpm', ['exec', 'eslint', '--fix', ...jsFiles], { stdio: 'inherit' }));
    }
    await Promise.all(tasks);
}