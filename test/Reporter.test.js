import test from "node:test";
import assert from "node:assert/strict";
import { Reporter } from "../src/core/Reporter.js";

test("builds a detailed report with actionable sections", () => {
  const reporter = new Reporter();
  const content = reporter.buildReportContent([
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
  ]);

  assert.match(content, /## Summary/);
  assert.match(content, /## What To Do Next/);
  assert.match(content, /## Fix Details/);
  assert.match(content, /Recommended command\(s\):/);
  assert.match(content, /How to fix:/);
  assert.match(content, /Optional Setup Suggestions/);
});
