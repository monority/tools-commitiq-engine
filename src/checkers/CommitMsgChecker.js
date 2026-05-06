import { BaseChecker } from "../core/BaseChecker.js";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { execa } from "execa";

export class CommitMsgChecker extends BaseChecker {
  constructor() {
    super("Commit Message Quality");
    this.profile = "fast";
  }

  async run(context) {
    const { root } = context;

    let message = "";
    const commitMsgPath = join(root, ".git", "COMMIT_EDITMSG");
    const gitMsgPath = join(root, ".git", "msg");

    if (existsSync(gitMsgPath)) {
      message = readFileSync(gitMsgPath, "utf8").trim();
    } else if (existsSync(commitMsgPath)) {
      message = readFileSync(commitMsgPath, "utf8").trim();
    }

    // Validation: If the message is just a version number (e.g., "1.0.16"), 
    // it's a stale file from a previous operation, not a real commit message.
    const isVersionString = /^\d+(\.\d+)*$/.test(message);

    if (!message || isVersionString) {
      // In pre-commit, the message isn't in a file yet if using -m.
      // If we found a version string, it's stale data.
      return { success: true, message: "No valid commit message found (skipping in pre-commit)" };
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