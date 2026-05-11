import test from "node:test";
import assert from "node:assert/strict";
import { formatScoreSummary, formatSuggestionSummary } from "../scripts/quality-staged.js";

test("formats suggestion summary for staged output", () => {
    const output = formatSuggestionSummary({
        suggestedHeader: "feat(auth): update auth flow",
        rationale: ["Auth-sensitive changes detected"],
    });

    assert.match(output, /^\nSuggested Commit/m);
    assert.match(output, /feat\(auth\): update auth flow/);
    assert.match(output, /Why:\n- Auth-sensitive changes detected/);
});

test("formats score summary for staged output", () => {
    const output = formatScoreSummary({
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
    });

    assert.match(output, /^\nCommit Quality Score/m);
    assert.match(output, /Type: feat/);
    assert.match(output, /Scope: auth/);
    assert.match(output, /Global Score: 62\/100/);
    assert.match(output, /Reasons:\n- Source changes detected without staged tests/);
});

test("returns empty string when score summary missing", () => {
    assert.equal(formatScoreSummary(null), "");
});

test("returns empty string when suggestion summary missing", () => {
    assert.equal(formatSuggestionSummary(null), "");
});