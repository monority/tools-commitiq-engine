import { BaseChecker } from "../core/BaseChecker.js";

export class NpmPackChecker extends BaseChecker {
  constructor() {
    super("NPM Pack");
    this.profile = "full";
  }

  async run(context) {
    const result = await this.exec(context, "npm", ["pack", "--dry-run"]);

    if (!result.success) {
      const err = result.stderr || result.stdout || "";
      const lines = err.split("\n").filter(Boolean).slice(0, 12).join("\n");
      return {
        success: false,
        message: "npm pack dry-run failed",
        suggestedFix: "Run: npm pack --dry-run",
        details: lines,
      };
    }

    return { success: true, message: "npm pack dry-run passed" };
  }
}
