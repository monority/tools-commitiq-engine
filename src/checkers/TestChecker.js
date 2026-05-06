import { BaseChecker } from "../core/BaseChecker.js";

export class TestChecker extends BaseChecker {
  constructor() {
    super("Test Suite");
    this.profile = "fast";
  }

  async run(context) {
    const { projectPackage } = context;
    const scripts = ["test", "test:unit", "test:ci", "vitest", "jest"];

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

    const result = await this.runScript(context, script);

    if (!result.success) {
      const err = result.stderr || result.stdout || "";
      const lines = err.split("\n").filter(l => l.trim()).slice(0, 10).join("\n");
      return {
        success: false,
        message: `${script} failed`,
        suggestedFix: `Run: npm test`,
        details: `\`${script}\` failed.\n\nOutput:\n${lines}`,
      };
    }

    return { success: true, message: `Tests passed` };
  }
}
