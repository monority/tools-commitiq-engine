import { BaseChecker } from "../core/BaseChecker.js";

export class SecretChecker extends BaseChecker {
  constructor() {
    super("Secret Scanner");
    this.profile = "fast";
  }

  async run(context) {
    const { root } = context;

    const patterns = [
      { pattern: /api[_-]?key["']?\s*[:=]\s*["'][^"']+/gi, name: "API Key" },
      { pattern: /secret["']?\s*[:=]\s*["'][^"']+/gi, name: "Secret" },
      { pattern: /password["']?\s*[:=]\s*["'][^"']+/gi, name: "Password" },
      { pattern: /token["']?\s*[:=]\s*["'][^"']+/gi, name: "Token" },
      { pattern: /private[_-]?key["']?\s*[:=]/gi, name: "Private Key" },
      { pattern: /aws[_-]?access[_-]?key/gi, name: "AWS Key" },
      { pattern: /github[_-]?token/gi, name: "GitHub Token" },
      { pattern: /sk-[a-zA-Z0-9]{20,}/g, name: "OpenAI Key" },
      { pattern: /sk-live-[a-zA-Z0-9]{20,}/g, name: "OpenAI Key" },
      { pattern: /xox[baprs]-[a-zA-Z0-9]{10,}/g, name: "Slack Token" },
      { pattern: /gh[pousr]_[a-zA-Z0-9]{36}/g, name: "GitHub Token" },
    ];

    const skipExt = [".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".woff", ".woff2", ".ttf", ".eot", ".mp3", ".mp4", ".zip", ".gz"];
    const ignoreFiles = ["README.md", "CHANGELOG.md"];
    const ignoreComments = ["cq-disable", "cqc-disable", "no-scan"];

    try {
      const files = await this.getStagedFiles(context);
      const secretsFound = [];

      for (const file of files) {
        if (ignoreFiles.includes(file)) continue;

        const ext = file.includes(".") ? "." + file.split(".").pop() : "";
        if (skipExt.includes(ext.toLowerCase())) continue;

        try {
          const result = await this.exec(context, ["git", "show", `:0:${file}`]);
          const content = result.stdout || "";

          const lines = content.split("\n");
          for (const line of lines) {
            const ignoreLine = ignoreComments.some(c => line.includes(c));
            if (ignoreLine) continue;

            for (const { pattern, name } of patterns) {
              pattern.lastIndex = 0;
              if (pattern.test(line)) {
                secretsFound.push({ file, name });
              }
            }
          }
        } catch {
          // skip binary or large files
        }
      }

      if (secretsFound.length > 0) {
        const msg = secretsFound.map((s) => `${s.name}`).join(", ");
        const uniqueFiles = [...new Set(secretsFound.map(s => s.file))].join(", ");
        return {
          success: false,
          message: `Secrets detected: ${msg}`,
          suggestedFix: "Remove secrets from staged files",
          details: `Remove secrets or add \`// cq-disable secret\` to ignore.\n\nFiles:\n- ${uniqueFiles}`,
        };
      }

      return { success: true, message: "No secrets detected" };
    } catch (error) {
      return { success: true, message: "Could not scan for secrets" };
    }
  }
}
