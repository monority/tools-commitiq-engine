import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TestChecker } from "../src/checkers/TestChecker.js";

test("reports success when no test script exists", async () => {
  const checker = new TestChecker();

  const result = await checker.run({
    projectPackage: { scripts: {} },
  });

  assert.equal(result.success, true);
  assert.equal(result.message, "No test script found");
});

test("runs the first available test script", async () => {
  const root = await mkdtemp(join(tmpdir(), "cq-test-checker-"));
  const checker = new TestChecker();

  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        type: "module",
        scripts: {
          test: "node ./pass.js",
        },
      }),
    );
    await writeFile(join(root, "pass.js"), "process.exit(0);\n");

    const result = await checker.run({
      root,
      packageManager: "npm",
      projectPackage: {
        scripts: {
          test: "node ./pass.js",
        },
      },
    });

    assert.equal(result.success, true);
    assert.equal(result.message, "Tests passed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
