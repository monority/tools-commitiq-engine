import { BaseChecker } from "./BaseChecker.js";
import { extname } from "node:path";

export class FormatChecker extends BaseChecker {
  constructor() {
    super("Formatting (Prettier)");
    this.profile = "fast";
  }

  async run(context) {
    const { root, config } = context;
    if (!config.staged.prettier)
      return { success: true, message: "Skipped by config" };

    const files = await this.getStagedFiles(context);
    const formatFiles = files.filter((f) => this.isFormattable(f));

    if (formatFiles.length === 0)
      return { success: true, message: "No formattable files staged" };

    const result = await this.exec(context, [
      "prettier",
      "--write",
      ...formatFiles,
    ]);

    return {
      success: result.success,
      message: result.success ? "Formatting passed" : result.stderr,
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

  isFormattable(file) {
    const ext = extname(file);
    return [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".json",
      ".md",
      ".yml",
      ".yaml",
      ".css",
      ".scss",
      ".html",
    ].includes(ext);
  }
}
