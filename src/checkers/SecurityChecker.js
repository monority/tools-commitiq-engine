import { BaseChecker } from "./BaseChecker.js";

export class SecurityChecker extends BaseChecker {
  constructor() {
    super("Security Audit");
    this.profile = "fast";
  }

  async run(context) {
    const { root, packageManager } = context;

    const command =
      packageManager === "npm"
        ? "npm audit"
        : packageManager === "pnpm"
          ? "pnpm audit"
          : packageManager === "yarn"
            ? "yarn audit"
            : "npm audit";

    const result = await this.exec(context, command.split(" "));

    return {
      success: result.success,
      message: result.success
        ? "No critical security vulnerabilities found"
        : `Security vulnerabilities detected: ${result.stderr}`,
    };
  }
}
