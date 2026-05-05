import { BaseChecker } from "./BaseChecker.js";
import { extname } from "node:path";

export class LintChecker extends BaseChecker {
  constructor() {
    super("Linting (ESLint)");
    this.profile = "fast";
  }

  async run(context) {
    const { config } = context;
    if (!config.staged.eslint)
      return { success: true, message: "Skipped by config" };

    const depCheck = await this.checkDependencies(context, ["eslint"]);
    if (!depCheck.installed) {
      return {
        success: true,
        message: "Skipped: ESLint not installed",
        suggestedFix: depCheck.command,
      };
    }

    const files = await this.getStagedFiles(context);
    const lintFiles = files.filter((f) => this.isLintable(f));

    if (lintFiles.length === 0)
      return { success: true, message: "No lintable files staged" };

    const result = await this.exec(context, ["eslint", "--fix", ...lintFiles]);

    return {
      success: result.success,
      message: result.success ? "Linting passed" : result.stderr,
      fixed: true,
    };
  }

  isLintable(file) {
    const ext = extname(file);
    return [".js", ".jsx", ".ts", ".tsx"].includes(ext);
  }
}
