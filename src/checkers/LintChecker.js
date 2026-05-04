import { BaseChecker } from "./BaseChecker.js";
import { extname } from "node:path";

export class LintChecker extends BaseChecker {
  constructor() {
    super("Linting (ESLint)");
    this.profile = "fast";
  }

  async run(context) {
    const { root, config } = context;
    if (!config.staged.eslint)
      return { success: true, message: "Skipped by config" };

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

  async getStagedFiles(context) {
    const { root, execa } = context;
    const { stdout } = await execa(
      "git",
      ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
      { cwd: root },
    );
    return stdout
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
  }

  isLintable(file) {
    const ext = extname(file);
    return [".js", ".jsx", ".ts", ".tsx"].includes(ext);
  }
}
