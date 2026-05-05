import { BaseChecker } from "./BaseChecker.js";

export class SecurityChecker extends BaseChecker {
  constructor() {
    super("Security Audit");
    this.profile = "fast";
  }

  async run(context) {
    const { packageManager } = context;
    const pm = packageManager || "npm";
    
    const result = await this.exec(context, [pm, "audit"]);

    if (!result.success) {
      const err = result.stdout || result.stderr || "";
      const lines = err.split("\n").slice(0, 15).join("\n");
      return {
        success: false,
        message: "Vulnerabilities found",
        suggestedFix: `${pm} audit fix`,
        details: `Run \`${pm} audit fix\` to fix.\n\n${lines}`,
      };
    }

    return { success: true, message: "No vulnerabilities found" };
  }
}