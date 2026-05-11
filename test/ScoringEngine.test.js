import test from "node:test";
import assert from "node:assert/strict";
import { ScoringEngine } from "../src/core/ScoringEngine.js";

test("scores risky source change without tests", () => {
    const scoringEngine = new ScoringEngine();
    const summary = scoringEngine.score({
        sourceFiles: ["src/auth/login.ts"],
        testFiles: [],
        documentationFiles: [],
        ciFiles: [".github/workflows/ci.yml"],
        dependencyFiles: ["package.json"],
        lockfileFiles: ["pnpm-lock.yaml"],
        envFiles: [],
        authFiles: ["src/auth/login.ts"],
        migrationFiles: ["database/migrations/001_add_users.sql"],
        workspaceScopes: ["auth"],
        topLevelAreas: ["src", ".github", "package.json"],
        signals: {
            hasSourceChanges: true,
            hasTests: false,
            hasDocumentation: false,
            touchesConfig: true,
            touchesCI: true,
            touchesDependencies: true,
            touchesLockfiles: true,
            touchesEnv: false,
            touchesAuth: true,
            touchesMigrations: true,
        },
    });

    assert.equal(summary.probableType, "feat");
    assert.equal(summary.probableScope, "auth");
    assert.equal(summary.testsStatus, "MISSING");
    assert.equal(summary.riskLevel, "HIGH");
    assert.ok(summary.globalScore < 70);
    assert.ok(summary.reasons.includes("Source changes detected without staged tests"));
    assert.ok(summary.reasons.includes("CI and source changes mixed in one commit"));
    assert.ok(summary.reasons.includes("Auth-sensitive changes detected"));
    assert.ok(summary.reasons.includes("Migration changes detected"));
    assert.ok(summary.reasons.includes("Lockfile changes detected"));
});

test("scores docs-only change as low risk", () => {
    const scoringEngine = new ScoringEngine();
    const summary = scoringEngine.score({
        sourceFiles: [],
        testFiles: [],
        documentationFiles: ["README.md"],
        ciFiles: [],
        dependencyFiles: [],
        lockfileFiles: [],
        envFiles: [],
        authFiles: [],
        migrationFiles: [],
        workspaceScopes: [],
        topLevelAreas: ["README.md"],
        signals: {
            hasSourceChanges: false,
            hasTests: false,
            hasDocumentation: true,
            touchesConfig: false,
            touchesCI: false,
            touchesDependencies: false,
            touchesLockfiles: false,
            touchesEnv: false,
            touchesAuth: false,
            touchesMigrations: false,
        },
    });

    assert.equal(summary.probableType, "docs");
    assert.equal(summary.riskLevel, "LOW");
    assert.equal(summary.testsStatus, "NOT_NEEDED");
    assert.ok(summary.globalScore >= 85);
});

test("scores removed tests as elevated risk", () => {
    const scoringEngine = new ScoringEngine();
    const summary = scoringEngine.score({
        sourceFiles: ["src/auth/login.ts"],
        testFiles: [],
        deletedTestFiles: ["tests/auth/login.spec.ts"],
        documentationFiles: [],
        ciFiles: [],
        dependencyFiles: [],
        lockfileFiles: [],
        envFiles: [],
        authFiles: ["src/auth/login.ts"],
        migrationFiles: [],
        workspaceScopes: [],
        topLevelAreas: ["src", "tests"],
        signals: {
            hasSourceChanges: true,
            hasTests: false,
            hasDocumentation: false,
            touchesConfig: false,
            touchesCI: false,
            touchesDependencies: false,
            touchesLockfiles: false,
            touchesEnv: false,
            touchesAuth: true,
            touchesMigrations: false,
            removesTests: true,
        },
    });

    assert.equal(summary.probableType, "feat");
    assert.equal(summary.testsStatus, "REDUCED");
    assert.equal(summary.riskLevel, "HIGH");
    assert.ok(summary.reasons.includes("Removed tests detected in staged diff"));
    assert.ok(summary.reasons.includes("Test removals mixed with source changes"));
});