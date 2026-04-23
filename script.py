import json
from pathlib import Path
import textwrap

base = Path('output/git-quality-package-fixed')
(base / 'scripts').mkdir(parents=True, exist_ok=True)

files = {
'package.json': {
  'name': '@acme/git-quality',
  'version': '1.0.0',
  'type': 'module',
  'bin': {'git-quality': 'scripts/cli.js'},
  'files': ['scripts'],
  'scripts': {
    'prepare': 'husky'
  },
  'devDependencies': {
    'husky': '^9.1.6'
  },
  'peerDependencies': {
    'execa': '^9.5.2'
  },
  'engines': {'node': '>=18'}
},
'scripts/cli.js': textwrap.dedent('''
  #!/usr/bin/env node
  import { run } from './quality-staged.js';
  const cmd = process.argv[2];
  if (cmd === 'staged') {
    await run();
  } else if (cmd === 'init') {
    console.log('🚀 Initializing git-quality hooks...');
    await import('child_process').then(cp => cp.execSync('pnpm exec husky init', {stdio: 'inherit'}));
    await import('fs/promises').then(fs => fs.writeFile('.husky/pre-commit', '#!/usr/bin/env sh\\n\\npnpm git-quality staged'));
    console.log('✅ Hooks installed!');
  } else {
    console.error('Commands: staged | init');
    process.exit(1);
  }
'''),
'scripts/quality-staged.js': textwrap.dedent('''
  import { execa } from 'execa';
  import { execSync } from 'node:child_process';

  export async function run() {
    const files = execSync('git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf8' })
      .split('\\n').map(s => s.trim()).filter(Boolean);

    const jsFiles = files.filter(f => /\\.(js|jsx|ts|tsx)$/.test(f));
    const formatFiles = files.filter(f => /\\.(js|jsx|ts|tsx|json|md|yml|yaml|css|scss)$/.test(f));
    const tasks = [];

    if (formatFiles.length) {
      tasks.push(execa('pnpm', ['exec', 'prettier', '--write', ...formatFiles], { stdio: 'inherit' }));
    }
    if (jsFiles.length) {
      tasks.push(execa('pnpm', ['exec', 'eslint', '--fix', ...jsFiles], { stdio: 'inherit' }));
    }
    await Promise.all(tasks);
  }
'''),
'.npmignore': 'node_modules\noutput\n',
'README.md': '# @acme/git-quality\n\n## Install\n```\npnpm add -D @acme/git-quality\npnpm git-quality init\n```\n\n## Usage\n```\npnpm git-quality staged\n```',
'.husky/pre-commit': 'pnpm git-quality staged\n'
}

for rel, content in files.items():
    p = base / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, dict):
        p.write_text(json.dumps(content, indent=2) + '\n', encoding='utf-8')
    else:
        p.write_text(content, encoding='utf-8')

manifest = {
    'path': str(base),
    'files': sorted([str(p.relative_to(base)) for p in base.rglob('*') if p.is_file()]),
    'install_commands': [
        'cd output/git-quality-package-fixed',
        'npm install',
        'npm run prepare',
        'npm pack --dry-run'
    ]
}
(Path('output') / 'git-quality-package-fixed-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps(manifest, indent=2))