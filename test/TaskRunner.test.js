import test from "node:test";
import assert from "node:assert/strict";
import { TaskRunner } from "../src/core/TaskRunner.js";

test("returns one result for every task", async () => {
  const runner = new TaskRunner(4);
  const tasks = Array.from({ length: 5 }, (_, index) => ({
    name: `Check ${index + 1}`,
    async run() {
      await new Promise((resolve) => setTimeout(resolve, index % 2 === 0 ? 5 : 1));
      return { success: true, message: "passed" };
    },
  }));

  const results = await runner.execute(tasks, {});

  assert.equal(results.length, 5);
  assert.deepEqual(
    results.map((result) => result.name),
    ["Check 1", "Check 2", "Check 3", "Check 4", "Check 5"],
  );
  assert.ok(results.every((result) => result.success));
});
