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
    const { stdout: hooksPath } = await execa(
      "git",
      ["config", "--get", "core.hooksPath"],
      { cwd: root },
    );

    assert.match(preCommit, /npm exec -- cqc staged/);
    assert.match(commitMsg, /npm exec -- cqc commit-msg "\$1"/);
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
      "#!/usr/bin/env sh\nnpm exec -- cqc check && git push\n",
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
