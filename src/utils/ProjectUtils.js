import { execa } from "execa";
import { access, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const promptedPackages = new Set();

export async function getProjectRoot() {
  const { stdout } = await execa("git", ["rev-parse", "--show-toplevel"]);
  const gitRoot = resolve(stdout.trim());
  let current = resolve(process.cwd());

  while (current.startsWith(gitRoot)) {
    try {
      await access(join(current, "package.json"));
      return current;
    } catch {
      const parent = resolve(join(current, ".."));
      if (parent === current) break;
      current = parent;
    }
  }

  return gitRoot;
}

export async function detectPackageManager(root) {
  const projectPackage = await readProjectPackage(root);

  if (typeof projectPackage.packageManager === "string") {
    if (projectPackage.packageManager.startsWith("pnpm@")) return "pnpm";
    if (projectPackage.packageManager.startsWith("yarn@")) return "yarn";
    if (projectPackage.packageManager.startsWith("bun@")) return "bun";
  }

  const checks = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"],
    ["package-lock.json", "npm"],
  ];

  for (const [filename, packageManager] of checks) {
    try {
      await readFile(join(root, filename), "utf8");
      return packageManager;
    } catch (error) {
      if (!error || error.code !== "ENOENT") throw error;
    }
  }

  return "npm";
}

export async function readProjectPackage(root) {
  const packageJsonPath = join(root, "package.json");
  const raw = await readFile(packageJsonPath, "utf8");
  return JSON.parse(raw);
}

export function getPackageManagerInstallCommand(packageManager, packages) {
  if (packageManager === "pnpm")
    return { command: "pnpm", args: ["add", "-D", ...packages] };
  if (packageManager === "yarn")
    return { command: "yarn", args: ["add", "-D", ...packages] };
  if (packageManager === "bun")
    return { command: "bun", args: ["add", "-d", ...packages] };
  return { command: "npm", args: ["install", "-D", ...packages] };
}

export function getPackageManagerExecCommand(packageManager, args) {
  return { command: packageManager, args };
}

export async function ensurePackagesInstalled({
  root,
  packageManager,
  projectPackage,
  packages,
  reason,
}) {
  const hasDependency = (pkg) =>
    Boolean(
      projectPackage.dependencies?.[pkg] ||
      projectPackage.devDependencies?.[pkg] ||
      projectPackage.peerDependencies?.[pkg],
    );

  if (packages.every(hasDependency)) return projectPackage;

  const missingPackages = packages.filter((pkg) => !hasDependency(pkg));
  const promptKey = missingPackages.join("|");

  if (promptedPackages.has(promptKey)) return projectPackage;
  promptedPackages.add(promptKey);

  const shouldInstall = await confirmInstall(
    packageManager,
    missingPackages,
    reason,
  );
  if (!shouldInstall) return projectPackage;

  const { command, args } = getPackageManagerInstallCommand(
    packageManager,
    missingPackages,
  );

  console.log(`Installing missing package(s): ${missingPackages.join(", ")}`);
  await execa(command, args, { cwd: root, stdio: "inherit" });

  return readProjectPackage(root);
}

async function confirmInstall(packageManager, packages, reason) {
  const { command, args } = getPackageManagerInstallCommand(
    packageManager,
    packages,
  );
  const installPreview = [command, ...args].join(" ");

  if (!input.isTTY || !output.isTTY) {
    console.warn(`Missing package(s) for ${reason}: ${packages.join(", ")}`);
    console.warn(`Install them manually with: ${installPreview}`);
    return false;
  }

  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(
      `Missing package(s) for ${reason}: ${packages.join(", ")}. Install now? [Y/n] `,
    );
    return answer.trim() === "" || /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

export async function restageFiles(files, root) {
  await execa("git", ["add", "-f", "--", ...files], { cwd: root, stdio: "inherit" });
}
