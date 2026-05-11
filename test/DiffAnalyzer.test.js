import test from "node:test";
import assert from "node:assert/strict";
import { DiffAnalyzer } from "../src/core/DiffAnalyzer.js";

test("classifies changed files into deterministic categories", () => {
    const analyzer = new DiffAnalyzer();
    const result = analyzer.analyze([
        "src/auth/login.ts",
        "src/auth/login.test.ts",
        "docs/auth-flow.md",
        ".github/workflows/ci.yml",
        "database/migrations/001_add_users.sql",
        "package.json",
        "pnpm-lock.yaml",
        ".env.local",
        "packages/web-auth/src/index.ts",
        "tsconfig.json",
    ]);

    assert.deepEqual(result.sourceFiles, [
        "src/auth/login.ts",
        "src/auth/login.test.ts",
        "packages/web-auth/src/index.ts",
    ]);
    assert.deepEqual(result.testFiles, ["src/auth/login.test.ts"]);
    assert.deepEqual(result.documentationFiles, ["docs/auth-flow.md"]);
    assert.deepEqual(result.ciFiles, [".github/workflows/ci.yml"]);
    assert.deepEqual(result.dependencyFiles, ["package.json", "pnpm-lock.yaml"]);
    assert.deepEqual(result.lockfileFiles, ["pnpm-lock.yaml"]);
    assert.deepEqual(result.envFiles, [".env.local"]);
    assert.deepEqual(result.authFiles, [
        "src/auth/login.ts",
        "src/auth/login.test.ts",
    ]);
    assert.deepEqual(result.migrationFiles, ["database/migrations/001_add_users.sql"]);
    assert.deepEqual(result.workspaceScopes, ["web-auth"]);
    assert.deepEqual(result.signals, {
        hasSourceChanges: true,
        hasTests: true,
        hasDocumentation: true,
        touchesConfig: true,
        touchesCI: true,
        touchesDependencies: true,
        touchesLockfiles: true,
        touchesEnv: true,
        touchesAuth: true,
        touchesMigrations: true,
        removesTests: false,
    });
});

test("normalizes duplicate and windows-style changed file paths", () => {
    const analyzer = new DiffAnalyzer();
    const result = analyzer.analyze([
        ".\\src\\core\\index.ts",
        "src/core/index.ts",
        "tests\\core.spec.ts",
        "README.md",
    ]);

    assert.deepEqual(result.files, [
        "src/core/index.ts",
        "tests/core.spec.ts",
        "README.md",
    ]);
    assert.deepEqual(result.testFiles, ["tests/core.spec.ts"]);
    assert.deepEqual(result.documentationFiles, ["README.md"]);
    assert.deepEqual(result.topLevelAreas, ["src", "tests", "README.md"]);
});

test("detects removed tests from staged diff content", () => {
    const analyzer = new DiffAnalyzer();
    const result = analyzer.analyze(
        ["src/auth/login.ts"],
        [
            "diff --git a/src/auth/login.test.ts b/src/auth/login.test.ts",
            "index 1111111..2222222 100644",
            "--- a/src/auth/login.test.ts",
            "+++ b/src/auth/login.test.ts",
            "@@ -4,2 +4,0 @@",
            "-describe('login', () => {",
            "-  expect(login()).toBe(true);",
            "diff --git a/tests/legacy.spec.ts b/tests/legacy.spec.ts",
            "deleted file mode 100644",
            "index 3333333..0000000",
            "--- a/tests/legacy.spec.ts",
            "+++ /dev/null",
        ].join("\n"),
    );

    assert.deepEqual(result.deletedFiles, ["tests/legacy.spec.ts"]);
    assert.deepEqual(result.deletedTestFiles, ["tests/legacy.spec.ts"]);
    assert.deepEqual(result.removedTestLines, [
        "describe('login', () => {",
        "expect(login()).toBe(true);",
    ]);
    assert.deepEqual(result.lineStats, {
        added: 0,
        removed: 2,
    });
    assert.equal(result.signals.removesTests, true);
    assert.deepEqual(result.topLevelAreas, ["src", "tests"]);
});