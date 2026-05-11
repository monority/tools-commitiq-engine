import { createQualityEngine } from "../src/index.js";
import {
  getProjectRoot,
  detectPackageManager,
  readProjectPackage,
  restageFiles,
} from "../src/utils/ProjectUtils.js";
import { execa } from "execa";

export function formatScoreSummary(scoreSummary) {
  if (!scoreSummary) {
    return "";
  }

  const lines = [
    "",
    "Commit Quality Score",
    `Type: ${scoreSummary.probableType}`,
    `Scope: ${scoreSummary.probableScope}`,
    `Atomicity: ${scoreSummary.atomicity}`,
    `Scope Precision: ${scoreSummary.scopePrecision}`,
    `Tests: ${scoreSummary.testsStatus} (${scoreSummary.testCoverage})`,
    `Risk: ${scoreSummary.riskLevel} (${scoreSummary.riskScore}/100)`,
    `Global Score: ${scoreSummary.globalScore}/100`,
  ];

  if (scoreSummary.reasons.length > 0) {
    lines.push("Reasons:");
    scoreSummary.reasons.forEach((reason) => {
      lines.push(`- ${reason}`);
    });
  }

  return `${lines.join("\n")}\n`;
}

export function formatSuggestionSummary(suggestionSummary) {
  if (!suggestionSummary) {
    return "";
  }

  const lines = [
    "",
    "Suggested Commit",
    suggestionSummary.suggestedHeader,
  ];

  if (suggestionSummary.rationale.length > 0) {
    lines.push("Why:");
    suggestionSummary.rationale.forEach((reason) => {
      lines.push(`- ${reason}`);
    });
  }

  return `${lines.join("\n")}\n`;
}

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
    const { allSuccess, results, scoreSummary, suggestionSummary } = await engine.run(options.fullProfile ? "full" : "fast");

    const suggestionBlock = formatSuggestionSummary(suggestionSummary);
    if (suggestionBlock) {
      console.log(suggestionBlock);
    }

    const scoreBlock = formatScoreSummary(scoreSummary);
    if (scoreBlock) {
      console.log(scoreBlock);
    }

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
