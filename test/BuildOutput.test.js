import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildScriptPath = join(repoRoot, "build.mjs");
const distCliPath = join(repoRoot, "dist", "scripts", "cli.js");
const distPackagePath = join(repoRoot, "dist", "package.json");

async function buildDist() {
    await execa("node", [buildScriptPath], { cwd: repoRoot });
}

test("build writes runnable dist package manifest without self dependency", async () => {
    await buildDist();

    const distPackage = JSON.parse(await readFile(distPackagePath, "utf8"));

    assert.equal(distPackage.name, "commitiq-engine");
    assert.equal(distPackage.main, "scripts/cli.js");
    assert.equal(distPackage.bin["commitiq-engine"], "scripts/cli.js");
    assert.equal(distPackage.bin.cq, "scripts/cli.js");
    assert.equal(distPackage.bin.cqc, "scripts/cli.js");
    assert.ok(distPackage.files.includes("src"));
    assert.equal(distPackage.dependencies[distPackage.name], undefined);
    assert.equal(distPackage.dependencies.execa, "^9.5.2");
});

test("built dist cli runs direct status command without pause prompt", async () => {
    const root = await mkdtemp(join(tmpdir(), "cqc-dist-cli-"));

    try {
        await buildDist();
        await execa("git", ["init"], { cwd: root });
        await writeFile(
            join(root, "package.json"),
            JSON.stringify({ name: "tmp", version: "1.0.0" }),
        );

        const result = await execa("node", [distCliPath, "status"], {
            cwd: root,
            reject: false,
        });

        assert.equal(result.exitCode, 0);
        assert.match(result.stdout, /STATUS/);
        assert.doesNotMatch(result.stdout, /Press any key to return to menu/);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});