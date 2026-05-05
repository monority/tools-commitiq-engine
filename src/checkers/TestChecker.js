import { BaseChecker } from "./BaseChecker.js";

export class TestChecker extends BaseChecker {
  constructor() {
    super("Test Suite");
    this.profile = "fast";
  }

  async run(context) {
    const { projectPackage, packageManager, profile } = context;

    const scripts = profile === "full" 
      ? ["test:e2e", "test:e2e", "playwright", "test:playwright"]
      : ["test", "test:unit", "test:ci", "vitest", "jest"];

    let script = null;
    for (const s of scripts) {
      if (projectPackage.scripts?.[s]) {
        script = s;
        break;
      }
    }

    if (!script) {
      return { success: true, message: "No test script found" };
    }

    const result = await this.exec(context, [script]);

    const errMsg = result.stderr || result.stdout || "Tests failed";
    if (!result.success) {
      return {
        success: false,
        message: `${script}: ${errMsg.substring(0, 100)}`,
        suggestedFix: `Run: npm test`,
      };
    }

    return {
      success: true,
      message: `Tests (${script}) passed`,
    };
  }
}