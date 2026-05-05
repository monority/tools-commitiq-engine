import { BaseChecker } from "./BaseChecker.js";

export class PlaywrightChecker extends BaseChecker {
  constructor() {
    super("Playwright Tests");
    this.profile = "full";
  }

  async run(context) {
    const { projectPackage, packageManager } = context;

    const scripts = ["test:e2e", "test:e2e", "playwright", "test:playwright", "e2e"];
    let script = null;
    for (const s of scripts) {
      if (projectPackage.scripts?.[s]) {
        script = s;
        break;
      }
    }

    const playwrightDeps = ["@playwright/test", "playwright"];
    const depsCheck = await this.checkDependencies(context, playwrightDeps);
    if (!depsCheck.installed) {
      return {
        success: false,
        message: "Playwright not installed",
        suggestedFix: `Run: ${depsCheck.command}`,
      };
    }

    if (!script) {
      return { success: true, message: "No e2e script found" };
    }

    const result = await this.exec(context, [script]);

    return {
      success: result.success,
      message: result.success
        ? `E2E tests passed`
        : `E2E tests failed`,
    };
  }
}