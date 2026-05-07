import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { DebugArtifactsChecker } from "../src/checkers/DebugArtifactsChecker.js";

test("passes when no script files are staged", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-debug-clean-"));
  const checker = new DebugArtifactsChecker();
  try {
    await execa("git", ["init"], { cwd: root });
    await execa("git", ["config", "user.email", "cqc@example.com"], { cwd: root });
    await execa("git", ["config", "user.name", "CQC"], { cwd: root });
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "tmp", version: "1.0.0" }));
    await execa("git", ["add", "package.json"], { cwd: root });

    const result = await checker.run({
      root,
      packageManager: "npm",
    });

    assert.equal(result.success, true);
    assert.equal(result.message, "No script files staged");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fails when staged file contains console.log", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-debug-check-"));
  const checker = new DebugArtifactsChecker();

  try {
    await execa("git", ["init"], { cwd: root });
    await execa("git", ["config", "user.email", "cqc@example.com"], { cwd: root });
    await execa("git", ["config", "user.name", "CQC"], { cwd: root });
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "tmp", version: "1.0.0" }));
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "index.js"), "console.log('debug');\n");
    await execa("git", ["add", "."], { cwd: root });

    const result = await checker.run({
      root,
      packageManager: "npm",
    });

    assert.equal(result.success, false);
    assert.equal(result.message, "Debug statements found");
    assert.match(result.details, /console\.log/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ignores configured staged file", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-debug-ignore-file-"));
  const checker = new DebugArtifactsChecker();

  try {
    await execa("git", ["init"], { cwd: root });
    await execa("git", ["config", "user.email", "cqc@example.com"], { cwd: root });
    await execa("git", ["config", "user.name", "CQC"], { cwd: root });
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "tmp", version: "1.0.0" }));
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "ignored.js"), "console.log('debug');\n");
    await execa("git", ["add", "."], { cwd: root });

    const result = await checker.run({
      root,
      packageManager: "npm",
      config: {
        ignore: ["src/ignored.js"],
      },
    });

    assert.equal(result.success, true);
    assert.equal(result.message, "No script files staged");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ignores configured staged directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-debug-ignore-dir-"));
  const checker = new DebugArtifactsChecker();

  try {
    await execa("git", ["init"], { cwd: root });
    await execa("git", ["config", "user.email", "cqc@example.com"], { cwd: root });
    await execa("git", ["config", "user.name", "CQC"], { cwd: root });
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "tmp", version: "1.0.0" }));
    await mkdir(join(root, "generated"));
    await writeFile(join(root, "generated", "index.js"), "console.log('debug');\n");
    await execa("git", ["add", "."], { cwd: root });

    const result = await checker.run({
      root,
      packageManager: "npm",
      config: {
        ignore: ["generated/"],
      },
    });

    assert.equal(result.success, true);
    assert.equal(result.message, "No script files staged");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
