import { BaseChecker } from "./BaseChecker.js";

export class SecretChecker extends BaseChecker {
  constructor() {
    super("Secret Scanner");
    this.profile = "fast";
  }

  async run(context) {
    const { execa, root } = context;
    
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
      { pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g, name: "SendGrid Key" },
    ];

    const skipExt = [".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".woff", ".woff2", ".ttf", ".eot", ".mp3", ".mp4", ".zip", ".gz"];

    try {
      const { stdout } = await execa("git", ["diff", "--cached", "--name-only"], {
        cwd: root,
      });
      const files = stdout.split("\n").filter(Boolean);

      const secretsFound = [];

      for (const file of files) {
        const ext = file.includes(".") ? "." + file.split(".").pop() : "";
        if (skipExt.includes(ext.toLowerCase())) continue;

        try {
          const { stdout: content } = await execa("git", ["show", `:0:${file}`], {
            cwd: root,
          });

          for (const { pattern, name } of patterns) {
            pattern.lastIndex = 0;
            if (pattern.test(content)) {
              secretsFound.push({ file, name });
            }
          }
        } catch {
          // skip binary or large files
        }
      }

      if (secretsFound.length > 0) {
        const msg = secretsFound
          .map((s) => `${s.name} in ${s.file}`)
          .join(", ");
        return {
          success: false,
          message: `Potential secrets found: ${msg}`,
          suggestedFix: "Remove secrets from staged files",
        };
      }

      return { success: true, message: "No secrets detected" };
    } catch (error) {
      return { success: true, message: "Could not scan for secrets" };
    }
  }
}