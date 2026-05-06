import { BaseChecker } from "../core/BaseChecker.js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export class CommitMsgChecker extends BaseChecker {
  constructor() {
    super("Commit Message Quality");
    this.profile = "fast";
  }

  async run(context) {
    const { root, commitMsgPath } = context;

    if (!commitMsgPath) {
      return {
        success: true,
        message: "No commit message target provided",
      };
    }

    let message = "";
    const resolvedCommitMsgPath = commitMsgPath
      ? (commitMsgPath.startsWith(".") ? resolve(root, commitMsgPath) : commitMsgPath)
      : null;

    if (resolvedCommitMsgPath && existsSync(resolvedCommitMsgPath)) {
      message = readFileSync(resolvedCommitMsgPath, "utf8").trim();
    }

    // Validation: If the message is just a version number (e.g., "1.0.16"), 
    // it's a stale file from a previous operation, not a real commit message.
    const isVersionString = /^\d+(\.\d+)*$/.test(message);

    if (!message || isVersionString) {
      return {
        success: true,
        message: "No commit message found",
      };
    }

    const patterns = {
      conventional: /^((feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?: .+)$/,
      gitmoji: /^:[a-z_]+: .+$/,
      emoji: /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}] .+$/u,
    };

    const isValid = Object.values(patterns).some(regex => regex.test(message));

    if (!isValid) {
      return {
        success: false,
        message:
          `Commit message does not follow Conventional Commits or Gitmoji format.\n` +
          `Validated message: "${message}"\n` +
          `Example: "feat(auth): add login" or ":art: update readme"`,
      };
    }

    return { success: true, message: "Commit message is valid" };
  }
}
