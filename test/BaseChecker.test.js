import test from "node:test";
import assert from "node:assert/strict";
import { BaseChecker } from "../src/core/BaseChecker.js";

class TestChecker extends BaseChecker {
    constructor() {
        super("Test Checker");
    }

    async run() {
        return { success: true, message: "ok" };
    }
}

test("getStagedFiles reuses injected staged files from context", async () => {
    const checker = new TestChecker();
    const files = await checker.getStagedFiles({
        stagedFiles: ["src/app.js", "generated/out.js"],
        config: {
            ignore: ["generated/"],
        },
    });

    assert.deepEqual(files, ["src/app.js"]);
});