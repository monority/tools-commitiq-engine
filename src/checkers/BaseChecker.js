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
}
