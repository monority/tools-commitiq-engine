import { BaseChecker } from "./BaseChecker.js";

export class PlaywrightChecker extends BaseChecker {
  constructor() {
    super("Playwright Tests");
    this.profile = "full";
  }

  async run(context) {
    const { projectPackage } = context;

    const scripts = ["test:e2e", "test:e2e", "playwright", "test:playwright", "e2e"];
    let script = null;
    for (const s of scripts) {
      if (projectPackage.scripts?.[s]) {
        script = s;
        break;
      }
    }

    const depsCheck = await this.checkDependencies(context, ["@playwright/test", "playwright"]);
    if (!depsCheck.installed) {
      return {
        success: false,
        message: "Playwright not installed",
        suggestedFix: "npm install --save-dev @playwright/test playwright",
        details: `Install Playwright:\n\`npm install --save-dev @playwright/test playwright\`\n\`npx playwright install\``,
      };
    }

    if (!script) {
      return { success: true, message: "No e2e script found" };
    }

    const result = await this.exec(context, [script]);

    if (!result.success) {
      const err = result.stderr || result.stdout || "";
      const lines = err.split("\n").slice(0, 10).join("\n");
      return {
        success: false,
        message: `E2E tests failed`,
        suggestedFix: `npm run ${script}`,
        details: `Run \`npm run ${script}\` to see errors.\n\n${lines}`,
      };
    }

    return { success: true, message: "E2E tests passed" };
  }
}