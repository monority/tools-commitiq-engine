import { BaseChecker } from "../core/BaseChecker.js";
import { extname } from "node:path";

export class DebugArtifactsChecker extends BaseChecker {
  constructor() {
    super("Debug Artifacts");
    this.profile = "fast";
  }

  async run(context) {
    const stagedFiles = await this.getStagedFiles(context);
    const scriptFiles = stagedFiles.filter((file) => this.isScriptFile(file));

    if (scriptFiles.length === 0) {
      return { success: true, message: "No script files staged" };
    }

    const findings = [];
    const debuggerPattern = /^\s*debugger\s*;?\s*$/;
    const consoleLogPattern = /^\s*console\.log\s*\(/;

    for (const file of scriptFiles) {
      const result = await this.exec(context, "git", ["show", `:0:${file}`]);
      if (!result.success) continue;

      const lines = result.stdout.split("\n");
      lines.forEach((line, index) => {
        if (line.includes("cqc-disable debug")) return;
        if (debuggerPattern.test(line)) {
          findings.push(`${file}:${index + 1} debugger`);
        } else if (consoleLogPattern.test(line)) {
          findings.push(`${file}:${index + 1} console.log`);
        }
      });
    }

    if (findings.length > 0) {
      return {
        success: false,
        message: "Debug statements found",
        suggestedFix: "Remove debug statements from staged files",
        details: findings.slice(0, 10).join("\n"),
      };
    }

    return { success: true, message: "No debug artifacts found" };
  }

  isScriptFile(file) {
    return [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(extname(file).toLowerCase());
  }
}
