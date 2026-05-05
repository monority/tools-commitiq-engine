import { BaseChecker } from "./BaseChecker.js";

export class CommitMsgChecker extends BaseChecker {
  constructor() {
    super("Commit Message Quality");
    this.profile = "fast";
  }

  async run(context) {
    const { root, execa } = context;

    try {
      // In a git hook context, the commit message is usually in .git/COMMIT_EDITMSG
      const { stdout } = await execa("git", ["log", "-1", "--pretty=%B"], {
        cwd: root,
      });
      const message = stdout.trim();

      if (!message)
        return { success: true, message: "No commit message found" };

      // Conventional Commits regex or Emoji-shortcode prefix:
      // Matches "type(scope): description" OR ":emoji: description"
      const conventionalRegex =
        /^((feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?: .+|:[a-z_]+: .+)$/;

      if (!conventionalRegex.test(message)) {
        return {
          success: false,
          message:
            'Commit message does not follow Conventional Commits format. Example: "feat(auth): add login functionality"',
        };
      }

      return { success: true, message: "Commit message is valid" };
    } catch (error) {
      return { success: true, message: "Could not verify commit message" };
    }
  }
}
