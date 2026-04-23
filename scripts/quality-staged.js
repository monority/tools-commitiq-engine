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
    .split('\n')
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
