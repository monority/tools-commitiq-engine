import json
from pathlib import Path
import textwrap

base = Path('output/commit-quality-check-package')
(base / 'scripts').mkdir(parents=True, exist_ok=True)

files = {
'package.json': {
  'name': 'commit-quality-check',
  'version': '1.0.4',
  'description': 'Pre-commit quality checks for staged files and project scripts.',
  'type': 'module',
  'bin': {
    'commit-quality-check': 'scripts/cli.js',
    'cqc': 'scripts/cli.js'
  },
  'files': ['scripts'],
  'scripts': {
    'prepare': 'node scripts/prepare.js'
  },
  'publishConfig': {
    'access': 'public'
  },
  'keywords': [
    'git',
    'pre-commit',
    'husky',
    'eslint',
    'prettier',
    'quality'
  ],
  'dependencies': {
    'execa': '^9.5.2',
    'husky': '^9.1.6'
  },
  'engines': {
    'node': '>=18'
  },
  'gitQuality': {
    'scripts': []
  }
},
'scripts/cli.js': textwrap.dedent('''
  import { execa } from 'execa';
  import { mkdir, readFile, writeFile } from 'node:fs/promises';
  import { join } from 'node:path';
  import {
    detectPackageManager,
    ensurePackagesInstalled,
    getPackageManagerExecCommand,
    getProjectRoot,
    readProjectPackage,
    runCheck,
    runStaged,
  } from './quality-staged.js';

  const command = process.argv[2] ?? 'check';

  if (command === 'staged' || command === 's') {
    await runStaged();
  } else if (command === 'check' || command === 'c') {
    await runCheck();
  } else if (command === 'init' || command === 'i') {
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

    console.log('commit-quality-check is ready. The hook will run on every commit.');
  }

  function createHookFile(packageManager) {
    const { command: pmCommand, args } = getPackageManagerExecCommand(packageManager, ['cqc', 'c']);
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

  function printHelp() {
    console.log(`commit-quality-check

  Commands:
    cqc i | init     Install the Husky pre-commit hook
    cqc s | staged   Run fixes only on staged files
    cqc c | check    Run staged fixes, then configured project scripts
  `);
  }
'''),
'scripts/quality-staged.js': textwrap.dedent('''
  import { execa } from 'execa';
  import { access, readFile } from 'node:fs/promises';
  import { extname, join, relative, resolve } from 'node:path';
  import { createInterface } from 'node:readline/promises';
  import { stdin as input, stdout as output } from 'node:process';

  const DEFAULT_PRETTIER_EXTENSIONS = [
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.json',
    '.md',
    '.yml',
    '.yaml',
    '.css',
    '.scss',
    '.html',
  ];

  const DEFAULT_ESLINT_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];
  const AUTO_SCRIPT_GROUPS = [
    ['lint'],
    ['typecheck', 'check-types', 'types'],
    ['test:unit', 'unit'],
    ['test', 'test:ci'],
    ['test:e2e', 'e2e', 'playwright', 'test:playwright'],
  ];
  const SCRIPT_PACKAGE_CANDIDATES = {
    lint: ['eslint'],
    typecheck: ['typescript'],
    'check-types': ['typescript'],
    types: ['typescript'],
    'test:e2e': ['@playwright/test', 'playwright'],
    e2e: ['@playwright/test', 'playwright'],
    playwright: ['@playwright/test', 'playwright'],
    'test:playwright': ['@playwright/test', 'playwright'],
  };
  const promptedPackages = new Set();

  export async function runStaged() {
    const root = await getProjectRoot();
    const packageManager = await detectPackageManager(root);
    let projectPackage = await readProjectPackage(root);
    const config = normalizeConfig(projectPackage.gitQuality);
    const files = await getStagedFiles(root);

    const prettierFiles = files.filter((file) => matchesExtension(file, config.staged.prettierExtensions));
    const eslintFiles = files.filter((file) => matchesExtension(file, config.staged.eslintExtensions));

    if (config.staged.prettier && prettierFiles.length) {
      projectPackage = await ensurePackagesInstalled({
        root,
        packageManager,
        projectPackage,
        packages: ['prettier'],
        reason: 'format staged files with Prettier',
      });
    }

    if (config.staged.prettier && prettierFiles.length && hasAnyDependency(projectPackage, ['prettier'])) {
      console.log(`Running Prettier on ${prettierFiles.length} staged file(s)...`);
      await runPackageManagerExec(packageManager, ['prettier', '--write', ...prettierFiles], root);
    }

    if (config.staged.eslint && eslintFiles.length) {
      projectPackage = await ensurePackagesInstalled({
        root,
        packageManager,
        projectPackage,
        packages: ['eslint'],
        reason: 'lint staged files with ESLint',
      });
    }

    if (
      config.staged.eslint &&
      eslintFiles.length &&
      hasAnyDependency(projectPackage, ['eslint']) &&
      (await hasEslintConfig(root, projectPackage))
    ) {
      console.log(`Running ESLint on ${eslintFiles.length} staged file(s)...`);
      await runPackageManagerExec(packageManager, ['eslint', '--fix', ...eslintFiles], root);
    } else if (config.staged.eslint && eslintFiles.length && hasAnyDependency(projectPackage, ['eslint'])) {
      console.warn('Skipping staged ESLint because no ESLint config was found in the project.');
    }

    if (files.length) {
      await restageFiles(files, root);
    }
  }

  export async function runCheck() {
    const root = await getProjectRoot();
    const packageManager = await detectPackageManager(root);
    let projectPackage = await readProjectPackage(root);
    const config = normalizeConfig(projectPackage.gitQuality);
    const scriptNames = resolveScriptsToRun(projectPackage.scripts, config.scripts);

    await runStaged();

    for (const scriptName of scriptNames) {
      projectPackage = await ensureScriptPackagesInstalled({
        root,
        packageManager,
        projectPackage,
        scriptName,
      });

      console.log(`Running project script: ${scriptName}`);
      await runPackageScript(packageManager, scriptName, root);
    }
  }

  export async function getProjectRoot() {
    const { stdout } = await execa('git', ['rev-parse', '--show-toplevel']);
    const gitRoot = resolve(stdout.trim());
    let current = resolve(process.cwd());

    while (current.startsWith(gitRoot)) {
      try {
        await access(join(current, 'package.json'));
        return current;
      } catch {
        const parent = resolve(join(current, '..'));
        if (parent === current) break;
        current = parent;
      }
    }

    return gitRoot;
  }

  export async function detectPackageManager(root) {
    const projectPackage = await readProjectPackage(root);

    if (typeof projectPackage.packageManager === 'string') {
      if (projectPackage.packageManager.startsWith('pnpm@')) {
        return 'pnpm';
      }

      if (projectPackage.packageManager.startsWith('yarn@')) {
        return 'yarn';
      }

      if (projectPackage.packageManager.startsWith('bun@')) {
        return 'bun';
      }
    }

    const checks = [
      ['pnpm-lock.yaml', 'pnpm'],
      ['yarn.lock', 'yarn'],
      ['bun.lockb', 'bun'],
      ['bun.lock', 'bun'],
      ['package-lock.json', 'npm'],
    ];

    for (const [filename, packageManager] of checks) {
      try {
        await readFile(join(root, filename), 'utf8');
        return packageManager;
      } catch (error) {
        if (!error || error.code !== 'ENOENT') {
          throw error;
        }
      }
    }

    return 'npm';
  }

  export function getPackageManagerExecCommand(packageManager, args) {
    if (packageManager === 'pnpm') {
      return { command: 'pnpm', args: ['exec', ...args] };
    }

    if (packageManager === 'yarn') {
      return { command: 'yarn', args: ['exec', ...args] };
    }

    if (packageManager === 'bun') {
      return { command: 'bunx', args };
    }

    return { command: 'npm', args: ['exec', '--', ...args] };
  }

  export function getPackageManagerInstallCommand(packageManager, packages) {
    if (packageManager === 'pnpm') {
      return { command: 'pnpm', args: ['add', '-D', ...packages] };
    }

    if (packageManager === 'yarn') {
      return { command: 'yarn', args: ['add', '-D', ...packages] };
    }

    if (packageManager === 'bun') {
      return { command: 'bun', args: ['add', '-d', ...packages] };
    }

    return { command: 'npm', args: ['install', '-D', ...packages] };
  }

  async function runPackageManagerExec(packageManager, args, root) {
    const execCommand = getPackageManagerExecCommand(packageManager, args);
    await execa(execCommand.command, execCommand.args, {
      cwd: root,
      stdio: 'inherit',
    });
  }

  async function runPackageScript(packageManager, scriptName, root) {
    if (packageManager === 'pnpm') {
      await execa('pnpm', ['run', scriptName], { cwd: root, stdio: 'inherit' });
      return;
    }

    if (packageManager === 'yarn') {
      await execa('yarn', [scriptName], { cwd: root, stdio: 'inherit' });
      return;
    }

    if (packageManager === 'bun') {
      await execa('bun', ['run', scriptName], { cwd: root, stdio: 'inherit' });
      return;
    }

    await execa('npm', ['run', scriptName], { cwd: root, stdio: 'inherit' });
  }

  async function getStagedFiles(root) {
    const { stdout: gitRootOut } = await execa('git', ['rev-parse', '--show-toplevel']);
    const gitRoot = gitRootOut.trim();
    const projectRelativeToGit = relative(gitRoot, root);

    const { stdout } = await execa('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
      cwd: root,
    });

    return stdout
      .split('\\n')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((file) => {
        if (projectRelativeToGit && file.startsWith(projectRelativeToGit + '/')) {
          return file.substring(projectRelativeToGit.length + 1);
        }
        return file;
      });
  }

  async function restageFiles(files, root) {
    await execa('git', ['add', '--', ...files], {
      cwd: root,
      stdio: 'inherit',
    });
  }

  export async function readProjectPackage(root) {
    const packageJsonPath = join(root, 'package.json');
    const raw = await readFile(packageJsonPath, 'utf8');
    return JSON.parse(raw);
  }

  async function hasEslintConfig(root, projectPackage) {
    if (projectPackage.eslintConfig) {
      return true;
    }

    const configFiles = [
      'eslint.config.js',
      'eslint.config.mjs',
      'eslint.config.cjs',
      'eslint.config.ts',
      '.eslintrc',
      '.eslintrc.js',
      '.eslintrc.cjs',
      '.eslintrc.json',
      '.eslintrc.yaml',
      '.eslintrc.yml',
    ];

    for (const configFile of configFiles) {
      try {
        await access(join(root, configFile));
        return true;
      } catch {
        // Continue looking for a supported config file.
      }
    }

    return false;
  }

  function normalizeConfig(config) {
    return {
      scripts: Array.isArray(config?.scripts) ? config.scripts : [],
      staged: {
        prettier: config?.staged?.prettier ?? true,
        eslint: config?.staged?.eslint ?? true,
        prettierExtensions: Array.isArray(config?.staged?.prettierExtensions)
          ? config.staged.prettierExtensions
          : DEFAULT_PRETTIER_EXTENSIONS,
        eslintExtensions: Array.isArray(config?.staged?.eslintExtensions)
          ? config.staged.eslintExtensions
          : DEFAULT_ESLINT_EXTENSIONS,
      },
    };
  }

  function resolveScriptsToRun(projectScripts = {}, configuredScripts = []) {
    if (configuredScripts.length) {
      return configuredScripts.filter((scriptName) => Boolean(projectScripts[scriptName]));
    }

    const detectedScripts = [];

    for (const group of AUTO_SCRIPT_GROUPS) {
      const match = group.find((scriptName) => Boolean(projectScripts[scriptName]));
      if (match) {
        detectedScripts.push(match);
      }
    }

    return detectedScripts;
  }

  function matchesExtension(file, extensions) {
    return extensions.includes(extname(file));
  }

  function hasDependency(projectPackage, dependencyName) {
    return Boolean(
      projectPackage.dependencies?.[dependencyName] ||
        projectPackage.devDependencies?.[dependencyName] ||
        projectPackage.peerDependencies?.[dependencyName],
    );
  }

  function hasAnyDependency(projectPackage, dependencyNames) {
    return dependencyNames.some((dependencyName) => hasDependency(projectPackage, dependencyName));
  }

  async function ensureScriptPackagesInstalled({ root, packageManager, projectPackage, scriptName }) {
    const packageCandidates = SCRIPT_PACKAGE_CANDIDATES[scriptName];

    if (!packageCandidates || hasAnyDependency(projectPackage, packageCandidates)) {
      return projectPackage;
    }

    return ensurePackagesInstalled({
      root,
      packageManager,
      projectPackage,
      packages: packageCandidates,
      reason: `run the "${scriptName}" script`,
    });
  }

  export async function ensurePackagesInstalled({ root, packageManager, projectPackage, packages, reason }) {
    if (hasAnyDependency(projectPackage, packages)) {
      return projectPackage;
    }

    const missingPackages = packages.filter((packageName) => !hasDependency(projectPackage, packageName));
    const promptKey = missingPackages.join('|');

    if (promptedPackages.has(promptKey)) {
      return projectPackage;
    }

    promptedPackages.add(promptKey);

    const shouldInstall = await confirmInstall(packageManager, missingPackages, reason);
    if (!shouldInstall) {
      return projectPackage;
    }

    const installCommand = getPackageManagerInstallCommand(packageManager, missingPackages);

    console.log(`Installing missing package(s): ${missingPackages.join(', ')}`);
    await execa(installCommand.command, installCommand.args, {
      cwd: root,
      stdio: 'inherit',
    });

    return readProjectPackage(root);
  }

  async function confirmInstall(packageManager, packages, reason) {
    const installPreview = formatCommandLine(getPackageManagerInstallCommand(packageManager, packages));

    if (!input.isTTY || !output.isTTY) {
      console.warn(`Missing package(s) for ${reason}: ${packages.join(', ')}`);
      console.warn(`Install them manually with: ${installPreview}`);
      return false;
    }

    const rl = createInterface({ input, output });

    try {
      const answer = await rl.question(
        `Missing package(s) for ${reason}: ${packages.join(', ')}. Install now? [Y/n] `,
      );

      return answer.trim() === '' || /^y(es)?$/i.test(answer.trim());
    } finally {
      rl.close();
    }
  }

  function formatCommandLine({ command, args }) {
    return [command, ...args].join(' ');
  }
'''),
'.npmignore': 'node_modules\noutput\n',
'README.md': '# commit-quality-check\n\nPre-commit quality checks for staged files and project scripts.\n\n## Install\n```\npnpm add -D commit-quality-check\npnpm cqc init\n```\n\n## Usage\n```\npnpm cqc staged    # Run fixes only on staged files\npnpm cqc check     # Run staged fixes, then configured project scripts\npnpm cqc init      # Install the Husky pre-commit hook\n```',
'.husky/pre-commit': 'pnpm cqc check\n',
'scripts/prepare.js': textwrap.dedent('''\n  import { execa } from 'execa';\n  import { mkdir, writeFile } from 'node:fs/promises';\n  import { join } from 'node:path';\n\n  async function main() {\n    console.log('Setting up commit-quality-check...');\n    \n    try {\n      await execa('husky', ['init'], { stdio: 'inherit' });\n      \n      const hookPath = join(process.cwd(), '.husky', 'pre-commit');\n      const hookBody = `#!/usr/bin/env sh\n\npnpm cqc check\n`;\n      \n      await mkdir(join(process.cwd(), '.husky'), { recursive: true });\n      await writeFile(hookPath, hookBody, 'utf8');\n      \n      console.log('✅ Husky hook installed successfully!');\n    } catch (error) {\n      console.error('Failed to install Husky hook:', error.message);\n      process.exit(1);\n    }\n  }\n\n  main().catch((error) => {\n    console.error('Error:', error);\n    process.exit(1);\n  });\n''')
}

for rel, content in files.items():
    p = base / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, dict):
        p.write_text(json.dumps(content, indent=2) + '\n', encoding='utf-8')
    else:
        # Handle files that need shebang
        if rel.endswith('.js'):
            shebang = '#!/usr/bin/env node\n'
            # Remove shebang from content if it exists
            content_clean = content.lstrip()
            if content_clean.startswith('#!/usr/bin/env node'):
                content_clean = content_clean[len('#!/usr/bin/env node'):].lstrip()
            p.write_text(shebang + content_clean, encoding='utf-8')
            # Make file executable on Unix-like systems
            import os
            os.chmod(p, 0o755)
        else:
            p.write_text(content, encoding='utf-8')

manifest = {
    'path': str(base),
    'files': sorted([str(p.relative_to(base)) for p in base.rglob('*') if p.is_file()]),
    'install_commands': [
        'cd output/commit-quality-check-package',
        'npm install',
        'npm run prepare',
        'npm pack --dry-run'
    ]
}
(Path('output') / 'commit-quality-check-package-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps(manifest, indent=2))