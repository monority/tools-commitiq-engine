import test from "node:test";
import assert from "node:assert/strict";
import { RiskChecker } from "../src/checkers/RiskChecker.js";

function createContext(overrides = {}) {
    return {
        config: {
            risk: {
                failOn: null,
            },
        },
        scoreSummary: {
            riskLevel: "HIGH",
            riskScore: 85,
            reasons: ["Environment file changes detected"],
        },
        ...overrides,
    };
}

test("reports high risk as advisory by default", async () => {
    const checker = new RiskChecker();
    const result = await checker.run(createContext());

    assert.equal(result.success, true);
    assert.equal(result.message, "Risk HIGH (85/100)");
    assert.match(result.details, /Environment file changes detected/);
});

test("fails when configured threshold is reached", async () => {
    const checker = new RiskChecker();
    const result = await checker.run(createContext({
        config: {
            risk: {
                failOn: "HIGH",
            },
        },
    }));

    assert.equal(result.success, false);
    assert.match(result.message, /exceeds configured threshold HIGH/);
    assert.match(result.suggestedFix, /gitQuality\.risk\.failOn/);
});

test("passes when risk level stays below configured threshold", async () => {
    const checker = new RiskChecker();
    const result = await checker.run(createContext({
        config: {
            risk: {
                failOn: "HIGH",
            },
        },
        scoreSummary: {
            riskLevel: "MEDIUM",
            riskScore: 55,
            reasons: ["CI configuration changes detected"],
        },
    }));

    assert.equal(result.success, true);
    assert.equal(result.message, "Risk MEDIUM (55/100)");
});