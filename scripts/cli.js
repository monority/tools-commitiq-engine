#!/usr/bin/env node
import { execa } from 'execa';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  detectPackageManager,
  ensurePackagesInstalled,
  getPackageManagerExecCommand,
  getProjectRoot,
  runCheck,
  runStaged,
} from './quality-staged.js';

const command = process.argv[2] ?? 'check';

if (command === 'staged') {
  await runStaged();
} else if (command === 'check') {
  await runCheck();
} else if (command === 'init') {
  await initHook();
} else if (command === '--help' || command === '-h' || command === 'help') {
  printHelp();
} else {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

async function initHook() {
  const root = await getProjectRoot();
  const packageManager = await detectPackageManager(root);
  let projectPackage = await readProjectPackage(root);

  projectPackage = await ensurePackagesInstalled({
    root,
    packageManager,
    projectPackage,
    packages: ['husky'],
    reason: 'install the pre-commit hook',
  });

  if (!projectPackage.dependencies?.husky && !projectPackage.devDependencies?.husky) {
    console.error('Husky is required to install the pre-commit hook.');
    process.exit(1);
  }

  const { command: pmCommand, args: pmArgs } = getPackageManagerExecCommand(packageManager, ['husky', 'init']);

  console.log('Installing Husky pre-commit hook...');
  await execa(pmCommand, pmArgs, {
    cwd: root,
    stdio: 'inherit',
  });

  const hookPath = join(root, '.husky', 'pre-commit');
  const hookBody = createHookFile(packageManager);
  const currentHook = await readHookIfExists(hookPath);

  if (currentHook !== hookBody) {
    await mkdir(join(root, '.husky'), { recursive: true });
    await writeFile(hookPath, hookBody, 'utf8');
  }

  console.log('git-quality is ready. The hook will run on every commit.');
}

function createHookFile(packageManager) {
  const { command: pmCommand, args } = getPackageManagerExecCommand(packageManager, ['git-quality', 'check']);
  const commandLine = [pmCommand, ...args].join(' ');

  return `#!/usr/bin/env sh

${commandLine}
`;
}

async function readHookIfExists(hookPath) {
  try {
    return await readFile(hookPath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function readProjectPackage(root) {
  const packageJsonPath = join(root, 'package.json');
  const raw = await readFile(packageJsonPath, 'utf8');
  return JSON.parse(raw);
}

function printHelp() {
  console.log(`git-quality

Commands:
  git-quality init    Install the Husky pre-commit hook
  git-quality staged  Run fixes only on staged files
  git-quality check   Run staged fixes, then configured project scripts
`);
}
