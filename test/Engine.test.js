import test from "node:test";
import assert from "node:assert/strict";
import { QualityEngine } from "../src/core/Engine.js";
import { BaseChecker } from "../src/core/BaseChecker.js";

class RegisteredChecker extends BaseChecker {
    constructor() {
        super("Registered Check");
    }

    async run() {
        return { success: true, message: "ok" };
    }
}

test("loadCheckers skips discovery when checkers already registered", async () => {
    const engine = new QualityEngine();
    let discoverCalls = 0;

    engine.registry.discover = async () => {
        discoverCalls += 1;
        return engine.registry;
    };

    engine.registerChecker(new RegisteredChecker());
    await engine.loadCheckers();

    assert.equal(discoverCalls, 0);
    assert.deepEqual(
        engine.registry.allCheckers.map((checker) => checker.name),
        ["Registered Check"],
    );
});

test("loadCheckers registers built-in checkers when registry empty", async () => {
    const engine = new QualityEngine();

    await engine.loadCheckers();

    assert.deepEqual(
        engine.registry.allCheckers.map((checker) => checker.name),
        [
            "Linting (ESLint)",
            "Formatting (Prettier)",
            "Commit Message Quality",
            "Secret Scanner",
            "Debug Artifacts",
            "Dependencies Vulnerabilities",
            "Risk Analysis",
            "Type Check",
            "Test Suite",
            "Build",
            "NPM Pack",
            "Playwright Tests",
        ],
    );
    assert.deepEqual(
        engine.registry.allPlugins.map((plugin) => plugin.name),
        ["builtin-checkers"],
    );
});

test("use registers plugin checkers through engine", () => {
    const engine = new QualityEngine();

    engine.use({
        name: "demo-plugin",
        checkers: [new RegisteredChecker()],
    });

    assert.deepEqual(
        engine.registry.allCheckers.map((checker) => checker.name),
        ["Registered Check"],
    );
    assert.deepEqual(
        engine.registry.allPlugins.map((plugin) => plugin.name),
        ["demo-plugin"],
    );
});