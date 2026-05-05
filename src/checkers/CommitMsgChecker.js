import { BaseChecker } from "./BaseChecker.js";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

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

    console.error("[DEBUG] CommitMsgChecker - root:", root);
    console.error("[DEBUG] COMMIT_EDITMSG exists:", existsSync(commitMsgPath));
    console.error("[DEBUG] .git/msg exists:", existsSync(gitMsgPath));
    console.error("[DEBUG] message read:", JSON.stringify(message));
      return { success: true, message: "No commit message found" };

    const conventionalRegex =
      /^((feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?: .+|:[a-z_]+: .+|[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}] .+)$/u;

    if (!conventionalRegex.test(message)) {
      return {
        success: false,
        message:
          'Commit message does not follow Conventional Commits or Gitmoji format. Example: "feat(auth): add login" or ":art: update readme"',
      };
    }

    return { success: true, message: "Commit message is valid" };
  }
}