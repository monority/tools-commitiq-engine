import { createQualityEngine } from "../src/index.js";
import {
  getProjectRoot,
  detectPackageManager,
  readProjectPackage,
  restageFiles,
} from "../src/utils/ProjectUtils.js";
import { execa } from "execa";

export async function runCheck(options = {}) {
  try {
    const root = options.root || await getProjectRoot();
    const packageManager = await detectPackageManager(root);
    const projectPackage = await readProjectPackage(root);

    const { stdout: stagedFilesOut } = await execa(
      "git",
      ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
      { cwd: root },
    );
    const stagedFiles = stagedFilesOut
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    const engine = createQualityEngine({
      generateReport: true,
      ...options,
      root,
      packageManager,
      projectPackage,
      stagedFiles,
      profile: options.fullProfile ? "full" : "fast",
    });

    console.log("Running commit quality checks...");
    const { allSuccess, results } = await engine.run(options.fullProfile ? "full" : "fast");

    const totalResults = results.length;
    for (const [index, result] of results.entries()) {
      const prefix = `[${index + 1}/${totalResults}]`;
      if (result.success) {
        console.log(`PASS ${prefix} ${result.name}: ${result.message}`);
      } else {
        console.error(`FAIL ${prefix} ${result.name}: ${result.message}`);
      }
    }

    const failed = !allSuccess;

    if (stagedFiles.length > 0) {
      await restageFiles(stagedFiles, root);
    }

    if (failed) {
      console.error("\nQuality checks failed. Please fix issues before committing.");
      process.exit(1);
    }

    console.log("\nAll quality checks passed!");
  } catch (error) {
    console.error(`\nFatal error during quality check: ${error.message}`);
    process.exit(1);
  }
}

export { runCheck as run };

const isDirectRun = process.argv[1] &&
  process.argv[1].endsWith("quality-staged.js");

if (isDirectRun) {
  await runCheck();
}
