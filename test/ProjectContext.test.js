import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { ProjectContext } from "../src/core/ProjectContext.js";

class TestProjectContext extends ProjectContext {
    constructor(options = {}) {
        super(options);
        this.readProjectPackageCalls = 0;
        this.detectPackageManagerCalls = 0;
    }

    async readProjectPackage() {
        this.readProjectPackageCalls += 1;
        return {
            name: "fixture",
            gitQuality: {
                staged: {
                    prettier: false,
                },
            },
        };
    }

    async detectPackageManager() {
        this.detectPackageManagerCalls += 1;
        return "pnpm";
    }
}

test("initialize uses injected project package and package manager when provided", async () => {
    const context = new TestProjectContext({
        root: "C:/repo",
        projectPackage: {
            name: "fixture",
            gitQuality: {
                skip: ["Debug Artifacts"],
            },
        },
        packageManager: "yarn",
    });

    await context.initialize();

    assert.equal(context.root, resolve("C:/repo"));
    assert.equal(context.packageManager, "yarn");
    assert.equal(context.readProjectPackageCalls, 0);
    assert.equal(context.detectPackageManagerCalls, 0);
    assert.deepEqual(context.config, {
        staged: {
            prettier: true,
            eslint: true,
        },
        skip: ["Debug Artifacts"],
        ignore: [],
        autoPush: false,
        risk: {
            failOn: null,
        },
    });
});

test("initialize falls back to project lookups when injected values missing", async () => {
    const context = new TestProjectContext({ root: "C:/repo" });

    await context.initialize();

    assert.equal(context.readProjectPackageCalls, 1);
    assert.equal(context.detectPackageManagerCalls, 1);
    assert.equal(context.packageManager, "pnpm");
    assert.deepEqual(context.config, {
        staged: {
            prettier: false,
            eslint: true,
        },
        skip: [],
        ignore: [],
        autoPush: false,
        risk: {
            failOn: null,
        },
    });
});

test("initialize builds diff analysis from injected staged files", async () => {
    const context = new TestProjectContext({
        root: "C:/repo",
        stagedFiles: [
            "src/auth/login.ts",
            "src/auth/login.test.ts",
            ".github/workflows/ci.yml",
            "packages/web/src/index.ts",
        ],
        stagedDiff: [
            "diff --git a/src/auth/login.test.ts b/src/auth/login.test.ts",
            "index 1111111..2222222 100644",
            "--- a/src/auth/login.test.ts",
            "+++ b/src/auth/login.test.ts",
            "@@ -4,1 +4,0 @@",
            "-expect(login()).toBe(true);",
        ].join("\n"),
    });

    await context.initialize();

    assert.deepEqual(context.stagedFiles, [
        "src/auth/login.ts",
        "src/auth/login.test.ts",
        ".github/workflows/ci.yml",
        "packages/web/src/index.ts",
    ]);
    assert.equal(context.analysis.signals.hasSourceChanges, true);
    assert.equal(context.analysis.signals.hasTests, true);
    assert.equal(context.analysis.signals.touchesCI, true);
    assert.equal(context.analysis.signals.removesTests, true);
    assert.deepEqual(context.analysis.removedTestLines, ["expect(login()).toBe(true);"]);
    assert.deepEqual(context.analysis.workspaceScopes, ["web"]);
    assert.equal(context.scoreSummary.probableType, "feat");
    assert.equal(context.scoreSummary.probableScope, "web");
    assert.equal(context.scoreSummary.testsStatus, "REDUCED");
    assert.equal(context.suggestionSummary.suggestedHeader, "feat(web): update auth flow");
});