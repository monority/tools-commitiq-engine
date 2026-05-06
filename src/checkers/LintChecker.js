import { BaseChecker } from "../core/BaseChecker.js";
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
        message: "Skipped: ESLint not found",
        suggestedFix: `npm install --save-dev eslint eslint-config-prettier`,
      };
    }

    const files = await this.getStagedFiles(context);
    const lintFiles = files.filter((f) => this.isLintable(f));

    if (lintFiles.length === 0)
      return { success: true, message: "No JS/TS files staged" };

    const result = await this.exec(context, "eslint", ["--fix", ...lintFiles]);

    if (!result.success) {
      const err = result.stderr || "";
      const lines = err.split("\n").slice(0, 15).join("\n");
      return {
        success: false,
        message: "ESLint errors found",
        suggestedFix: "npm run lint:fix",
        details: `Run \`npm run lint:fix\` to auto-fix.\n\nErrors:\n${lines}`,
      };
    }

    return { success: true, message: "Linting passed" };
  }

  isLintable(file) {
    const ext = extname(file);
    return [".js", ".jsx", ".ts", ".tsx"].includes(ext);
  }
}
