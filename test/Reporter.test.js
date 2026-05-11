import test from "node:test";
import assert from "node:assert/strict";
import { Reporter } from "../src/core/Reporter.js";

test("builds a detailed report with actionable sections", () => {
  const reporter = new Reporter();
  const content = reporter.buildReportContent(
    [
      {
        name: "Debug Artifacts",
        success: false,
        message: "Debug statements found",
        suggestedFix: "Remove debug statements from staged files",
        details: "src/app.js:10 console.log",
      },
      {
        name: "Linting (ESLint)",
        success: true,
        message: "Skipped: ESLint not found",
        suggestedFix: "npm install --save-dev eslint eslint-config-prettier",
      },
    ],
    {
      analysis: {
        files: ["src/auth/login.ts", "tests/auth/login.spec.ts"],
        deletedTestFiles: ["tests/auth/login.spec.ts"],
        removedTestLines: ["expect(login()).toBe(true);"],
        lineStats: {
          added: 3,
          removed: 5,
        },
        workspaceScopes: ["auth"],
        topLevelAreas: ["src", "tests"],
        signals: {
          touchesAuth: true,
          touchesCI: false,
          touchesDependencies: false,
          touchesEnv: false,
          touchesMigrations: false,
          removesTests: true,
        },
      },
      suggestionSummary: {
        suggestedHeader: "feat(auth): update auth flow",
        rationale: ["Source changes detected without staged tests"],
      },
      scoreSummary: {
        probableType: "feat",
        probableScope: "auth",
        atomicity: 82,
        scopePrecision: 90,
        testCoverage: 35,
        testsStatus: "MISSING",
        riskScore: 60,
        riskLevel: "MEDIUM",
        globalScore: 62,
        reasons: ["Source changes detected without staged tests"],
      },
    },
  );

  assert.match(content, /## Summary/);
  assert.match(content, /## Suggested Commit/);
  assert.match(content, /feat\(auth\): update auth flow/);
  assert.match(content, /## Diff Analysis/);
  assert.match(content, /Staged files: 2/);
  assert.match(content, /Removed test lines: 1/);
  assert.match(content, /Signals: auth, removes-tests/);
  assert.match(content, /## Commit Quality Score/);
  assert.match(content, /Global score: 62\/100/);
  assert.match(content, /## What To Do Next/);
  assert.match(content, /## Fix Details/);
  assert.match(content, /Recommended command\(s\):/);
  assert.match(content, /How to fix:/);
  assert.match(content, /Optional Setup Suggestions/);
});
