import { BaseChecker } from "./BaseChecker.js";

export class TestChecker extends BaseChecker {
  constructor() {
    super("Test Suite");
    this.profile = "fast";
  }

  async run(context) {
    const { projectPackage, packageManager, profile } = context;

    // Determine the test script to run based on profile
    // 'fast' profile runs 'test' (usually unit tests), 'full' runs 'test:e2e' or similar
    let script = "test";
    if (profile === "full" && projectPackage.scripts?.["test:e2e"]) {
      script = "test:e2e";
    }

    if (!projectPackage.scripts?.[script]) {
      return {
        success: true,
        message: `No ${script} script found in package.json`,
      };
    }

    const cmd =
      packageManager === "npm"
        ? "npm"
        : packageManager === "pnpm"
          ? "pnpm"
          : packageManager === "yarn"
            ? "yarn"
            : "npm";

    const result = await this.exec(context, [cmd, "run", script]);

    return {
      success: result.success,
      message: result.success
        ? `Tests (${script}) passed`
        : `Tests failed: ${result.stderr}`,
    };
  }
}
