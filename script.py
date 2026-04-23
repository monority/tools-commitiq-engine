from pathlib import Path
import json, textwrap, os
base = Path('output/git-quality-package')
(base / 'scripts').mkdir(parents=True, exist_ok=True)
(base / '.husky').mkdir(parents=True, exist_ok=True)

files = {
'package.json': {
  'name': '@acme/git-quality',
  'version': '1.0.0',
  'type': 'module',
  'bin': {'git-quality': './dist/cli.js'},
  'files': ['dist'],
  'scripts': {
    'build': 'node build.mjs',
    'prepare': 'pnpm build'
  },
  'dependencies': {'execa': '^9.5.2'},
  'engines': {'node': '>=18'}
},
'build.mjs': textwrap.dedent('''
  import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
  import { dirname, join } from 'node:path';
  import { fileURLToPath } from 'node:url';

  const root = dirname(fileURLToPath(import.meta.url));
  const dist = join(root, 'dist');
  const distScripts = join(dist, 'scripts');
  mkdirSync(distScripts, { recursive: true });
  copyFileSync(join(root, 'scripts', 'quality-staged.js'), join(distScripts, 'quality-staged.js'));
  const cli = `#!/usr/bin/env node\nimport { run } from './scripts/quality-staged.js';\nconst cmd = process.argv[2] || 'staged';\nif (cmd === 'staged') await run();\nelse if (cmd === 'init') console.log('init hook generator here');\nelse { console.error('Unknown command:', cmd); process.exit(1); }\n`;
  writeFileSync(join(dist, 'cli.js'), cli);
  writeFileSync(join(dist, 'package.json'), JSON.stringify({ type: 'module' }, null, 2));
'''),
'scripts/quality-staged.js': textwrap.dedent('''
  import { execa } from 'execa';
  import { execSync } from 'node:child_process';

  export async function run() {
    const files = execSync('git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf8' })
      .split('\n').map(s => s.trim()).filter(Boolean);

    const jsFiles = files.filter(f => /\.(js|jsx|ts|tsx)$/.test(f));
    const formatFiles = files.filter(f => /\.(js|jsx|ts|tsx|json|md|yml|yaml|css|scss)$/.test(f));
    const tasks = [];

    if (formatFiles.length) tasks.push(execa('pnpm', ['exec', 'prettier', '--write', ...formatFiles], { stdio: 'inherit' }));
    if (jsFiles.length) tasks.push(execa('pnpm', ['exec', 'eslint', '--fix', ...jsFiles], { stdio: 'inherit' }));
    await Promise.all(tasks);
  }
'''),
'.husky/pre-commit': 'pnpm git-quality staged\n',
'.npmignore': 'node_modules\noutput\n',
'README.md': '# @acme/git-quality\n\nReusable quality hooks package.\n'
}

for rel, content in files.items():
    p = base / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, dict):
        p.write_text(json.dumps(content, indent=2) + '\n', encoding='utf-8')
    else:
        p.write_text(content, encoding='utf-8')

# produce a zip-like manifest for easy sharing
manifest = {
    'path': str(base),
    'files': sorted([str(p.relative_to(base)) for p in base.rglob('*') if p.is_file()])
}
(Path('output') / 'git-quality-package-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps(manifest, indent=2))