import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGitQualityConfig } from "../src/core/Config.js";

test("normalizes gitQuality config with defaults", () => {
    const config = normalizeGitQualityConfig();

    assert.deepEqual(config, {
        staged: {
            prettier: true,
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

test("normalizes gitQuality config with explicit values", () => {
    const config = normalizeGitQualityConfig({
        staged: {
            prettier: false,
            eslint: true,
        },
        skip: ["Debug Artifacts"],
        ignore: ["generated/"],
        autoPush: true,
        risk: {
            failOn: "medium",
        },
    });

    assert.deepEqual(config, {
        staged: {
            prettier: false,
            eslint: true,
        },
        skip: ["Debug Artifacts"],
        ignore: ["generated/"],
        autoPush: true,
        risk: {
            failOn: "MEDIUM",
        },
    });
});