import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(repoRoot, "scripts", "cli.js");

test("enable writes husky hooks and configures git hooksPath", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-hooks-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "tmp", version: "1.0.0" }),
    );

    await execa("node", [cliPath, "enable"], { cwd: root });

    const preCommit = await readFile(join(root, ".husky", "pre-commit"), "utf8");
    const commitMsg = await readFile(join(root, ".husky", "commit-msg"), "utf8");
    const postCommitExists = await access(join(root, ".husky", "post-commit"))
      .then(() => true)
      .catch(() => false);
    const { stdout: hooksPath } = await execa(
      "git",
      ["config", "--get", "core.hooksPath"],
      { cwd: root },
    );

    assert.match(preCommit, /npm exec -- cq staged/);
    assert.match(commitMsg, /npm exec -- cq commit-msg "\$1"/);
    assert.equal(postCommitExists, false);
    assert.equal(hooksPath.trim(), ".husky");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("disable removes managed hooksPath", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-hooks-disable-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "tmp", version: "1.0.0" }),
    );

    await execa("node", [cliPath, "enable"], { cwd: root });
    await execa("node", [cliPath, "disable"], { cwd: root });

    const result = await execa("git", ["config", "--get", "core.hooksPath"], {
      cwd: root,
      reject: false,
    });

    assert.equal(result.exitCode, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("enable removes legacy auto-push hook", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-auto-push-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "tmp", version: "1.0.0" }),
    );
    await mkdir(join(root, ".husky"));
    await writeFile(
      join(root, ".husky", "post-commit"),
      "#!/usr/bin/env sh\nnpm exec -- cq check && git push\n",
    );

    await execa("node", [cliPath, "enable"], { cwd: root });

    const result = await access(join(root, ".husky", "post-commit"))
      .then(() => true)
      .catch(() => false);

    assert.equal(result, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("enable removes husky-style auto-push hook", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-husky-auto-push-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "tmp", version: "1.0.0" }),
    );
    await mkdir(join(root, ".husky"));
    await writeFile(
      join(root, ".husky", "post-commit"),
      [
        "#!/usr/bin/env sh",
        '. "$(dirname "$0")/_/husky.sh"',
        "npm exec -- cq check && git push",
        "",
      ].join("\n"),
    );

    await execa("node", [cliPath, "enable"], { cwd: root });

    const result = await access(join(root, ".husky", "post-commit"))
      .then(() => true)
      .catch(() => false);

    assert.equal(result, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("auto-push command toggles post-commit hook and config", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-auto-push-toggle-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "tmp", version: "1.0.0" }),
    );

    await execa("node", [cliPath, "auto-push"], { cwd: root });

    const postCommit = await readFile(join(root, ".husky", "post-commit"), "utf8");
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

    assert.match(postCommit, /npm exec -- cq check && git push/);
    assert.equal(packageJson.gitQuality.autoPush, true);

    await execa("node", [cliPath, "auto-push"], { cwd: root });

    const postCommitExists = await access(join(root, ".husky", "post-commit"))
      .then(() => true)
      .catch(() => false);
    const updatedPackageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

    assert.equal(postCommitExists, false);
    assert.equal(updatedPackageJson.gitQuality.autoPush, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("direct status command exits without pause prompt", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-status-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "tmp", version: "1.0.0" }),
    );

    const result = await execa("node", [cliPath, "status"], {
      cwd: root,
      reject: false,
    });

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /STATUS/);
    assert.doesNotMatch(result.stdout, /Press any key to return to menu/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("status shows staged analysis summary when files are staged", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-status-analysis-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await execa("git", ["config", "user.email", "cqc@example.com"], { cwd: root });
    await execa("git", ["config", "user.name", "CQC"], { cwd: root });
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "tmp", version: "1.0.0" }),
    );
    await writeFile(join(root, "src", "auth.test.js"), "console.log('ok');\n");
    await execa("git", ["add", "."], { cwd: root });

    const result = await execa("node", [cliPath, "status"], {
      cwd: root,
      reject: false,
    });

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /staged files:/);
    assert.match(result.stdout, /suggested commit:/);
    assert.match(result.stdout, /probable type:/);
    assert.match(result.stdout, /probable scope:/);
    assert.match(result.stdout, /global score:/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("status accepts husky underscore hooksPath as managed", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-status-husky-underscore-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "tmp", version: "1.0.0" }),
    );
    await mkdir(join(root, ".husky"));
    await writeFile(join(root, ".husky", "pre-commit"), "#!/usr/bin/env sh\nnpm exec -- cq staged\n");
    await writeFile(join(root, ".husky", "commit-msg"), "#!/usr/bin/env sh\nnpm exec -- cq commit-msg \"$1\"\n");
    await execa("git", ["config", "core.hooksPath", ".husky/_"], { cwd: root });

    const result = await execa("node", [cliPath, "status"], {
      cwd: root,
      reject: false,
    });

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /hook: .*ON/);
    assert.match(result.stdout, /core\.hooksPath: .*\.husky\/_/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("suggest prints suggested commit for staged files", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-suggest-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await execa("git", ["config", "user.email", "cqc@example.com"], { cwd: root });
    await execa("git", ["config", "user.name", "CQC"], { cwd: root });
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "tmp", version: "1.0.0" }),
    );
    await execa("git", ["add", "package.json"], { cwd: root });
    await execa("git", ["commit", "-m", "chore: init"], { cwd: root });
    await writeFile(join(root, "src", "auth.js"), "export const login = true;\n");
    await execa("git", ["add", "src/auth.js"], { cwd: root });

    const result = await execa("node", [cliPath, "suggest"], {
      cwd: root,
      reject: false,
    });

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Suggested Commit/);
    assert.match(result.stdout, /feat\(src\): update auth flow/);
    assert.doesNotMatch(result.stdout, /Press any key to return to menu/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("commit creates git commit from suggested header", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-commit-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await execa("git", ["config", "user.email", "cqc@example.com"], { cwd: root });
    await execa("git", ["config", "user.name", "CQC"], { cwd: root });
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "tmp", version: "1.0.0" }),
    );
    await execa("git", ["add", "package.json"], { cwd: root });
    await execa("git", ["commit", "-m", "chore: init"], { cwd: root });
    await writeFile(join(root, "src", "auth.js"), "export const login = true;\n");
    await execa("git", ["add", "src/auth.js"], { cwd: root });

    const result = await execa("node", [cliPath, "commit"], {
      cwd: root,
      reject: false,
    });
    const logResult = await execa("git", ["log", "-1", "--pretty=%s"], { cwd: root });

    assert.equal(result.exitCode, 0);
    assert.equal(logResult.stdout.trim(), "feat(src): update auth flow");
    assert.match(result.stdout, /Commit created:/);
    assert.doesNotMatch(result.stdout, /Press any key to return to menu/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("commit accepts explicit message override", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-commit-override-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await execa("git", ["config", "user.email", "cqc@example.com"], { cwd: root });
    await execa("git", ["config", "user.name", "CQC"], { cwd: root });
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "tmp", version: "1.0.0" }),
    );
    await execa("git", ["add", "package.json"], { cwd: root });
    await execa("git", ["commit", "-m", "chore: init"], { cwd: root });
    await writeFile(join(root, "src", "auth.js"), "export const login = true;\n");
    await execa("git", ["add", "src/auth.js"], { cwd: root });

    const result = await execa("node", [cliPath, "commit", "fix(src): custom message"], {
      cwd: root,
      reject: false,
    });
    const logResult = await execa("git", ["log", "-1", "--pretty=%s"], { cwd: root });

    assert.equal(result.exitCode, 0);
    assert.equal(logResult.stdout.trim(), "fix(src): custom message");
    assert.match(result.stdout, /Commit created: .*fix\(src\): custom message/);
    assert.doesNotMatch(result.stdout, /Target project:/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("commit fails when no staged files exist", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-commit-empty-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await execa("git", ["config", "user.email", "cqc@example.com"], { cwd: root });
    await execa("git", ["config", "user.name", "CQC"], { cwd: root });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "tmp", version: "1.0.0" }),
    );

    const result = await execa("node", [cliPath, "commit"], {
      cwd: root,
      reject: false,
    });

    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /No staged files available for commit/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("json prints staged analysis payload", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-json-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await execa("git", ["config", "user.email", "cqc@example.com"], { cwd: root });
    await execa("git", ["config", "user.name", "CQC"], { cwd: root });
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "tmp", version: "1.0.0" }),
    );
    await execa("git", ["add", "package.json"], { cwd: root });
    await execa("git", ["commit", "-m", "chore: init"], { cwd: root });
    await writeFile(join(root, "src", "auth.js"), "export const login = true;\n");
    await execa("git", ["add", "src/auth.js"], { cwd: root });

    const result = await execa("node", [cliPath, "json"], {
      cwd: root,
      reject: false,
    });
    const payload = JSON.parse(result.stdout);

    assert.equal(result.exitCode, 0);
    assert.deepEqual(payload.stagedFiles, ["src/auth.js"]);
    assert.equal(payload.analysis.signals.hasSourceChanges, true);
    assert.equal(payload.scoreSummary.probableScope, "src");
    assert.equal(payload.suggestionSummary.suggestedHeader, "feat(src): update auth flow");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("json prints empty payload when nothing is staged", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-json-empty-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "tmp", version: "1.0.0" }),
    );

    const result = await execa("node", [cliPath, "json"], {
      cwd: root,
      reject: false,
    });
    const payload = JSON.parse(result.stdout);

    assert.equal(result.exitCode, 0);
    assert.deepEqual(payload, {
      stagedFiles: [],
      analysis: null,
      scoreSummary: null,
      suggestionSummary: null,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("json-check prints checker results payload and succeeds when checks pass", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-json-check-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await execa("git", ["config", "user.email", "cqc@example.com"], { cwd: root });
    await execa("git", ["config", "user.name", "CQC"], { cwd: root });
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "tmp",
        version: "1.0.0",
        gitQuality: {
          skip: ["Playwright Tests"],
        },
        scripts: {
          test: "node --eval \"process.exit(0)\"",
        },
      }),
    );
    await execa("git", ["add", "package.json"], { cwd: root });
    await execa("git", ["commit", "-m", "chore: init"], { cwd: root });
    await writeFile(join(root, "src", "auth.test.js"), "export const ok = true;\n");
    await execa("git", ["add", "src/auth.test.js"], { cwd: root });

    const result = await execa("node", [cliPath, "json-check"], {
      cwd: root,
      reject: false,
    });
    const payload = JSON.parse(result.stdout);

    assert.equal(result.exitCode, 0);
    assert.equal(payload.profile, "fast");
    assert.equal(payload.allSuccess, true);
    assert.equal(typeof payload.durationMs, "number");
    assert.equal(payload.reportPath, null);
    assert.ok(Array.isArray(payload.results));
    assert.ok(payload.results.length > 0);
    assert.equal(payload.analysis.signals.hasTests, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("json-check returns non-zero and JSON payload when checks fail", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-json-check-fail-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await execa("git", ["config", "user.email", "cqc@example.com"], { cwd: root });
    await execa("git", ["config", "user.name", "CQC"], { cwd: root });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "tmp", version: "1.0.0" }),
    );
    await execa("git", ["add", "package.json"], { cwd: root });
    await execa("git", ["commit", "-m", "chore: init"], { cwd: root });
    await writeFile(join(root, "script.js"), "console.log('debug');\n");
    await execa("git", ["add", "script.js"], { cwd: root });

    const result = await execa("node", [cliPath, "json-check"], {
      cwd: root,
      reject: false,
    });
    const payload = JSON.parse(result.stdout);

    assert.equal(result.exitCode, 1);
    assert.equal(payload.allSuccess, false);
    assert.equal(typeof payload.durationMs, "number");
    assert.match(payload.reportPath, /quality-report\.md$/);
    assert.ok(payload.results.some((entry) => entry.success === false));
    assert.equal(payload.scoreSummary.riskLevel, "LOW");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("json-check supports full profile flag", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-cli-json-check-full-"));

  try {
    await execa("git", ["init"], { cwd: root });
    await execa("git", ["config", "user.email", "cqc@example.com"], { cwd: root });
    await execa("git", ["config", "user.name", "CQC"], { cwd: root });
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "tmp",
        version: "1.0.0",
        gitQuality: {
          skip: ["Playwright Tests"],
        },
        scripts: {
          test: "node --eval \"process.exit(0)\"",
        },
      }),
    );
    await execa("git", ["add", "package.json"], { cwd: root });
    await execa("git", ["commit", "-m", "chore: init"], { cwd: root });
    await writeFile(join(root, "src", "auth.test.js"), "export const ok = true;\n");
    await execa("git", ["add", "src/auth.test.js"], { cwd: root });

    const result = await execa("node", [cliPath, "json-check", "--full"], {
      cwd: root,
      reject: false,
    });
    const payload = JSON.parse(result.stdout);

    assert.equal(result.exitCode, 0);
    assert.equal(payload.profile, "full");
    assert.equal(payload.allSuccess, true);
    assert.equal(typeof payload.durationMs, "number");
    assert.equal(payload.reportPath, null);
    assert.ok(payload.results.length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
