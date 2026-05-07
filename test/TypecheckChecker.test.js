import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TypecheckChecker } from "../src/checkers/TypecheckChecker.js";

test("reports success when no typecheck script exists", async () => {
  const checker = new TypecheckChecker();

  const result = await checker.run({
    projectPackage: { scripts: {} },
  });

  assert.equal(result.success, true);
  assert.equal(result.message, "No typecheck script found");
});

test("runs available typecheck script", async () => {
  const root = await mkdtemp(join(tmpdir(), "cqc-typecheck-"));
  const checker = new TypecheckChecker();

  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        type: "module",
        scripts: {
          typecheck: "node ./typecheck-pass.js",
        },
      }),
    );
    await writeFile(join(root, "typecheck-pass.js"), "process.exit(0);\n");

    const result = await checker.run({
      root,
      packageManager: "npm",
      projectPackage: {
        scripts: {
          typecheck: "node ./typecheck-pass.js",
        },
      },
    });

    assert.equal(result.success, true);
    assert.equal(result.message, "Typecheck passed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
