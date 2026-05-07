import { BaseChecker } from "../core/BaseChecker.js";

export class TypecheckChecker extends BaseChecker {
  constructor() {
    super("Type Check");
    this.profile = "fast";
  }

  async run(context) {
    const { projectPackage } = context;
    const scripts = ["typecheck", "check-types", "types"];

    let script = null;
    for (const candidate of scripts) {
      if (projectPackage.scripts?.[candidate]) {
        script = candidate;
        break;
      }
    }

    if (!script) {
      return { success: true, message: "No typecheck script found" };
    }

    const result = await this.runScript(context, script);

    if (!result.success) {
      const err = result.stderr || result.stdout || "";
      const lines = err.split("\n").filter(Boolean).slice(0, 10).join("\n");
      return {
        success: false,
        message: `${script} failed`,
        suggestedFix: `Run: npm run ${script}`,
        details: `\`${script}\` failed.\n\nOutput:\n${lines}`,
      };
    }

    return { success: true, message: "Typecheck passed" };
  }
}
