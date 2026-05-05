/**
 * Base class for all quality checkers.
 * Ensures a consistent interface for the QualityEngine.
 */
export class BaseChecker {
  constructor(name) {
    this.name = name;
  }

  /**
   * Executes the check.
   * @param {Object} context - Context containing project root, package manager, staged files, etc.
   * @returns {Promise<{success: boolean, message: string, fixed: boolean}>}
   */
  async run(context) {
    throw new Error(
      `Method 'run()' must be implemented by ${this.constructor.name}`,
    );
  }

  /**
   * Helper to execute shell commands via the package manager.
   */
  async exec(context, args) {
    const { packageManager, root } = context;
    const { command, args: execArgs } = this.getPackageManagerCommand(
      packageManager,
      args,
    );

    try {
      const { stdout } = await context.execa(command, execArgs, {
        cwd: root,
        stdio: "pipe",
      });
      return { success: true, stdout: stdout.trim() };
    } catch (error) {
      return { success: false, stderr: error.stderr || error.message };
    }
  }

  async getStagedFiles(context) {
    const { root, execa } = context;
    try {
      const { stdout } = await execa(
        "git",
        ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
        { cwd: root },
      );
      return stdout
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);
    } catch (error) {
      console.error(`❌ Failed to get staged files: ${error.message}`);
      return [];
    }
  }

  getPackageManagerCommand(packageManager, args) {
    switch (packageManager) {
      case "pnpm":
        return { command: "pnpm", args: ["exec", ...args] };
      case "yarn":
        return { command: "yarn", args: ["exec", ...args] };
      case "bun":
        return { command: "bunx", args };
      default:
        return { command: "npm", args: ["exec", "--", ...args] };
    }
  }

  /**
   * Checks if the required dependencies are installed.
   * @param {Object} context 
   * @param {string[]} dependencies - List of packages to check.
   * @returns {Promise<{installed: boolean, command: string}>}
   */
  async checkDependencies(context, dependencies) {
    const { packageManager, root, execa } = context;

    for (const dep of dependencies) {
      try {
        // Check if the package is available in node_modules or globally
        await execa("npm", ["list", dep], { cwd: root }, { stdio: 'ignore' });
      } catch (e) {
        const installCmd = this.getInstallCommand(packageManager, dependencies);
        return { installed: false, command: installCmd };
      }
    }
    return { installed: true, command: "" };
  }

  getInstallCommand(packageManager, dependencies) {
    const deps = dependencies.join(" ");
    switch (packageManager) {
      case "pnpm": return `pnpm add -D ${deps}`;
      case "yarn": return `yarn add -D ${deps}`;
      case "bun": return `bun add -d ${deps}`;
      default: return `npm install --save-dev ${deps}`;
    }
  }
}
