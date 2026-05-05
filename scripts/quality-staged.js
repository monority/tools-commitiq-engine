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
    const root = await getProjectRoot();
    const packageManager = await detectPackageManager(root);
    const projectPackage = await readProjectPackage(root);

    // Detect staged files for the engine context
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
      profile: "fast", // Default to fast for staged checks
    });

    console.log(`🚀 Running commit quality checks...`);
    const { allSuccess, results } = await engine.run();

    for (const result of results) {
      if (result.success) {
        console.log(`✅ ${result.name}: ${result.message}`);
      } else {
        console.error(`❌ ${result.name}: ${result.message}`);
      }
    }

    const failed = !allSuccess;

    if (stagedFiles.length > 0) {
      await restageFiles(stagedFiles, root);
    }

    if (failed) {
      console.error(
        "\n❌ Quality checks failed. Please fix the issues before committing.",
      );
      process.exit(1);
    }

    console.log("\n✨ All quality checks passed!");
  } catch (error) {
    console.error(`\n💥 Fatal error during quality check: ${error.message}`);
    process.exit(1);
  }
}

import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// If run directly
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCheck();
} else if (process.argv[1] && dirname(fileURLToPath(import.meta.url)) === dirname(process.argv[1])) {
  // This handles cases where the script is called via a different path format
  runCheck();
} else if (process.argv[1]?.endsWith('quality-staged.js')) {
  runCheck();
}
