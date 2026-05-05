import { BaseChecker } from "./BaseChecker.js";

export class TestChecker extends BaseChecker {
  constructor() {
    super("Test Suite");
    this.profile = "fast";
  }

  async run(context) {
    const { projectPackage, packageManager, profile } = context;

    const fullScripts = ["test:e2e", "playwright", "test:playwright"];
    const fastScripts = ["test", "test:unit", "test:ci", "vitest", "jest"];
    const scripts = profile === "full" ? [...fullScripts, ...fastScripts] : [...fastScripts, ...fullScripts];

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