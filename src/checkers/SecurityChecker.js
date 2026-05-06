import { BaseChecker } from "../core/BaseChecker.js";

export class SecurityChecker extends BaseChecker {
  constructor() {
    super("Dependencies Vulnerabilities");
    this.profile = "fast";
  }

  async run(context) {
    const { packageManager, root } = context;
    const pm = packageManager || "npm";

    try {
      const result = await this.exec(context, [pm, "audit"]);
      const output = result.stdout || result.stderr || "";
      const hasVulns = output.includes("vulnerabilities") && !output.includes("0 vulnerabilities");

      if (hasVulns) {
        const lines = output.split("\n").slice(0, 15).join("\n");
        return {
          success: false,
          message: "Vulnerabilities found",
          suggestedFix: `${pm} audit fix`,
          details: `Run \`${pm} audit fix\` to fix.\n\n${lines}`,
        };
      }

      return { success: true, message: "No vulnerabilities found" };
    } catch (error) {
      const err = error.stderr || error.message || "";
      const lines = err.split("\n").slice(0, 15).join("\n");
      if (lines.includes("vulnerabilities")) {
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
}