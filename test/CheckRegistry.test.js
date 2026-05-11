import test from "node:test";
import assert from "node:assert/strict";
import { CheckRegistry } from "../src/core/CheckRegistry.js";
import { BaseChecker } from "../src/core/BaseChecker.js";

class FastChecker extends BaseChecker {
  constructor() {
    super("Fast Check");
    this.profile = "fast";
  }

  async run() {
    return { success: true, message: "ok" };
  }
}

class FullChecker extends BaseChecker {
  constructor() {
    super("Full Check");
    this.profile = "full";
  }

  async run() {
    return { success: true, message: "ok" };
  }
}

test("filters by profile and explicit checker selection", () => {
  const registry = new CheckRegistry();
  registry.register(new FastChecker());
  registry.register(new FullChecker());

  const fastChecks = registry.getCheckersForProfile("fast");
  assert.deepEqual(fastChecks.map((checker) => checker.name), ["Fast Check"]);

  const singleFullCheck = registry.getCheckersForProfile(
    "fast",
    ["Full Check"],
    ["Full Check"],
  );
  assert.deepEqual(singleFullCheck.map((checker) => checker.name), []);

  const fullChecks = registry.getCheckersForProfile("full", [], ["Full Check"]);
  assert.deepEqual(fullChecks.map((checker) => checker.name), ["Full Check"]);
});

test("registers checkers from plugin", () => {
  const registry = new CheckRegistry();

  registry.registerPlugin({
    name: "demo-plugin",
    checkers: () => [new FastChecker(), new FullChecker()],
  });

  assert.deepEqual(
    registry.allCheckers.map((checker) => checker.name),
    ["Fast Check", "Full Check"],
  );
  assert.deepEqual(
    registry.allPlugins.map((plugin) => plugin.name),
    ["demo-plugin"],
  );
});
