#!/usr/bin/env node
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import readline from "node:readline";
import { execa } from "execa";
import { CommitMsgChecker } from "../src/checkers/CommitMsgChecker.js";
import { ProjectContext } from "../src/core/ProjectContext.js";
import { createQualityEngine } from "../src/index.js";
import { detectPackageManager, getProjectRoot } from "../src/utils/ProjectUtils.js";
import { formatSuggestionSummary, runCheck } from "./quality-staged.js";

const projRoot = await getProjectRoot();
const packageJsonPath = join(projRoot, "package.json");
const PRE_COMMIT_HOOK = "#!/usr/bin/env sh\nnpm exec -- cq staged\n";
const COMMIT_MSG_HOOK = "#!/usr/bin/env sh\nnpm exec -- cq commit-msg \"$1\"\n";
const AUTO_PUSH_HOOK = "#!/usr/bin/env sh\nnpm exec -- cq check && git push\n";
const PRE_COMMIT_COMMAND = "npm exec -- cq staged";
const COMMIT_MSG_COMMAND = "npm exec -- cq commit-msg \"$1\"";
const AUTO_PUSH_COMMAND = "git push";
const AUTO_PUSH_HOOKS = ["post-commit", "pre-push"];

let selected = 0;
const options = [
  { label: "Toggle hook", action: "toggle" },
  { label: "Toggle auto-push", action: "auto-push" },
  { label: "Configure checks", action: "config" },
  { label: "Run single check", action: "single" },
  { label: "Status", action: "status" },
  { label: "Suggest commit", action: "suggest" },
  { label: "Commit", action: "commit" },
  { label: "Staged check", action: "staged" },
  { label: "Full check", action: "check" },
  { label: "Quit", action: "quit" },
];

const C = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
};

async function hasHookCommand(filePath, expectedCommand) {
  try {
    const content = await readFile(filePath, "utf8");
    return content.replace(/\r\n/g, "\n").includes(expectedCommand);
  } catch {
    return false;
  }
}

async function getHookState() {
  const preCommitPath = join(projRoot, ".husky", "pre-commit");
  const commitMsgPath = join(projRoot, ".husky", "commit-msg");
  const autoPushPath = join(projRoot, ".husky", "post-commit");
  const preCommitExists = existsSync(preCommitPath);
  const commitMsgExists = existsSync(commitMsgPath);
  const preCommitValid = await hasHookCommand(preCommitPath, PRE_COMMIT_COMMAND);
  const commitMsgValid = await hasHookCommand(commitMsgPath, COMMIT_MSG_COMMAND);
  const autoPushValid = await hasHookCommand(autoPushPath, AUTO_PUSH_COMMAND);
  const hooksPath = await getGitHooksPath();
  const hooksPathValid = isManagedHooksPath(hooksPath);
  const enabled = preCommitValid && commitMsgValid && hooksPathValid;
  const broken = (preCommitExists || commitMsgExists) && !enabled;

  return {
    preCommit: preCommitValid,
    commitMsg: commitMsgValid,
    autoPush: autoPushValid,
    hooksPath: hooksPathValid,
    hooksPathValue: hooksPath,
    enabled,
    broken,
  };
}

function isManagedHooksPath(hooksPath) {
  return hooksPath === ".husky" || hooksPath === ".husky/_";
}

async function getGitHooksPath() {
  try {
    const { stdout } = await execa("git", ["config", "--get", "core.hooksPath"], {
      cwd: projRoot,
    });
    return stdout.trim().replace(/\\/g, "/");
  } catch {
    return "";
  }
}

async function setGitHooksPath() {
  await execa("git", ["config", "core.hooksPath", ".husky"], { cwd: projRoot });
}

async function unsetGitHooksPathIfManaged() {
  const hooksPath = await getGitHooksPath();
  if (isManagedHooksPath(hooksPath)) {
    await execa("git", ["config", "--unset", "core.hooksPath"], { cwd: projRoot });
  }
}

async function removeAutoPushHookIfSafe(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    const commandLines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));

    const hasPush = commandLines.some((line) => /\bgit\s+push\b/.test(line));
    const cqRelated = commandLines.some((line) =>
      /\bcq\b/.test(line) || /\bcqc\b/.test(line) || /\bhusky\b/.test(line) || /\bgit\s+push\b/.test(line),
    );

    if (hasPush && cqRelated) {
      await unlink(filePath);
      return true;
    }
  } catch {
    // ignore missing hooks
  }

  return false;
}

async function removeAutoPushHooks() {
  const huskyDir = join(projRoot, ".husky");
  let removed = false;

  for (const hookName of AUTO_PUSH_HOOKS) {
    const hookPath = join(huskyDir, hookName);
    removed = await removeAutoPushHookIfSafe(hookPath) || removed;
  }

  return removed;
}

async function readProjectPackageFile() {
  const raw = await readFile(packageJsonPath, "utf8");
  return JSON.parse(raw);
}

async function writeProjectPackageFile(projectPackage) {
  await writeFile(packageJsonPath, `${JSON.stringify(projectPackage, null, 2)}\n`, "utf8");
}

async function getAvailableCheckers() {
  const engine = createQualityEngine({ root: projRoot });
  await engine.loadCheckers();

  return engine.registry.allCheckers
    .map((checker) => ({
      name: checker.name,
      profile: checker.profile || "fast",
    }))
    .sort((a, b) => {
      if (a.profile !== b.profile) {
        return a.profile === "fast" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
}

async function getSkippedChecks() {
  const projectPackage = await readProjectPackageFile();
  return new Set(projectPackage.gitQuality?.skip || []);
}

async function isAutoPushConfigured() {
  const projectPackage = await readProjectPackageFile();
  return projectPackage.gitQuality?.autoPush === true;
}

async function getStagedFiles() {
  try {
    const { stdout } = await execa(
      "git",
      ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
      { cwd: projRoot },
    );

    return stdout
      .split("\n")
      .map((file) => file.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function getStatusAnalysis() {
  const stagedFiles = await getStagedFiles();
  if (stagedFiles.length === 0) {
    return {
      analysis: null,
      stagedFiles,
      scoreSummary: null,
      suggestionSummary: null,
    };
  }

  const projectPackage = await readProjectPackageFile();
  const packageManager = await detectPackageManager(projRoot);
  const context = await ProjectContext.create({
    root: projRoot,
    projectPackage,
    packageManager,
    stagedFiles,
  });

  return {
    analysis: context.analysis,
    stagedFiles,
    scoreSummary: context.scoreSummary,
    suggestionSummary: context.suggestionSummary,
  };
}

function buildJsonAnalysisPayload(statusAnalysis) {
  return {
    stagedFiles: statusAnalysis.stagedFiles,
    analysis: statusAnalysis.analysis,
    scoreSummary: statusAnalysis.scoreSummary,
    suggestionSummary: statusAnalysis.suggestionSummary,
  };
}

function formatStatusAnalysis(analysis) {
  if (!analysis) {
    return "";
  }

  const { stagedFiles, scoreSummary, suggestionSummary } = analysis;
  let content = `staged files: ${C.green}${stagedFiles.length}${C.reset}`;

  if (suggestionSummary) {
    content += `\nsuggested commit: ${C.cyan}${suggestionSummary.suggestedHeader}${C.reset}`;
  }

  if (!scoreSummary) {
    return content;
  }

  content +=
    `\nprobable type: ${C.cyan}${scoreSummary.probableType}${C.reset}` +
    `\nprobable scope: ${C.cyan}${scoreSummary.probableScope}${C.reset}` +
    `\nrisk: ${C.yellow}${scoreSummary.riskLevel}${C.reset} (${scoreSummary.riskScore}/100)` +
    `\nglobal score: ${C.green}${scoreSummary.globalScore}/100${C.reset}`;

  return content;
}

async function saveAutoPushConfig(enabled) {
  const projectPackage = await readProjectPackageFile();
  projectPackage.gitQuality = {
    ...(projectPackage.gitQuality || {}),
    autoPush: enabled,
  };

  await writeProjectPackageFile(projectPackage);
}

async function saveSkippedChecks(skipSet) {
  const projectPackage = await readProjectPackageFile();
  const nextSkip = [...skipSet].sort((a, b) => a.localeCompare(b));

  projectPackage.gitQuality = {
    ...(projectPackage.gitQuality || {}),
    skip: nextSkip,
  };

  await writeProjectPackageFile(projectPackage);
}

async function drawMenu() {
  const hookState = await getHookState();
  console.clear();
  console.log(`\n${C.cyan}${C.bright}COMMIT QUALITY CHECK${C.reset}\n`);

  options.forEach((opt, index) => {
    const isSelected = index === selected;
    const label = isSelected
      ? `${C.bright}${C.cyan}${opt.label}${C.reset}`
      : opt.label;
    let status = "";

    if (opt.action === "toggle") {
      if (hookState.enabled) status = ` ${C.green}ON${C.reset}`;
      else if (hookState.broken) status = ` ${C.yellow}BROKEN${C.reset}`;
      else status = ` ${C.red}OFF${C.reset}`;
    }

    if (opt.action === "auto-push") {
      status = hookState.autoPush ? ` ${C.green}ON${C.reset}` : ` ${C.red}OFF${C.reset}`;
    }

    const arrow = isSelected ? `${C.yellow}>${C.reset}` : " ";
    console.log(`  ${arrow} ${label}${status}`);
  });

  console.log(`\n${C.magenta}Use arrows, Enter, Q${C.reset}`);
}

function setRawMode(enable) {
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    process.stdin.setRawMode(enable);
  }
  if (enable) {
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
  } else {
    process.stdin.pause();
  }
}

async function pauseForTTY() {
  if (!process.stdin.isTTY) return;
  console.log(`\n${C.yellow}Press any key to return to menu...${C.reset}`);
  await new Promise((resolve) => {
    const onData = () => {
      process.stdin.removeListener("data", onData);
      setRawMode(false);
      resolve();
    };
    process.stdin.once("data", onData);
    setRawMode(true);
  });
}

async function runMenu() {
  await drawMenu();

  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);

    const onKey = async (_, key) => {
      if (key?.name === "up") {
        selected = Math.max(0, selected - 1);
        await drawMenu();
        return;
      }

      if (key?.name === "down") {
        selected = Math.min(options.length - 1, selected + 1);
        await drawMenu();
        return;
      }

      if (key?.name === "return" || key?.name === "enter") {
        process.stdin.removeListener("keypress", onKey);
        setRawMode(false);
        console.clear();
        resolve(options[selected].action);
        return;
      }

      if (key?.name === "q" || key?.ctrl && key?.name === "c") {
        process.stdin.removeListener("keypress", onKey);
        setRawMode(false);
        console.clear();
        resolve("quit");
      }
    };

    process.stdin.on("keypress", onKey);
    setRawMode(true);
  });
}

function drawChecklist(title, items, cursor, instructions) {
  console.clear();
  console.log(`\n${C.cyan}${C.bright}${title}${C.reset}\n`);

  items.forEach((item, index) => {
    const isSelected = index === cursor;
    const arrow = isSelected ? `${C.yellow}>${C.reset}` : " ";
    const marker = item.enabled ? `${C.green}[x]${C.reset}` : `${C.red}[ ]${C.reset}`;
    const profile = item.profile === "full"
      ? `${C.yellow}(full)${C.reset}`
      : `${C.green}(fast)${C.reset}`;
    const label = isSelected
      ? `${C.bright}${C.cyan}${item.name}${C.reset}`
      : item.name;
    console.log(`  ${arrow} ${marker} ${label} ${profile}`);
  });

  console.log(`\n${C.magenta}${instructions}${C.reset}`);
}

async function configureChecks() {
  if (!process.stdin.isTTY) {
    console.log("Interactive check configuration requires a TTY.");
    return;
  }

  const checkers = await getAvailableCheckers();
  const skipSet = await getSkippedChecks();
  let cursor = 0;
  const items = checkers.map((checker) => ({
    ...checker,
    enabled: !skipSet.has(checker.name),
  }));

  drawChecklist("CONFIGURE CHECKS", items, cursor, "Arrows move  SPACE toggle  ENTER save  Q cancel");

  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);

    const onKey = async (_, key) => {
      if (key?.name === "up") {
        cursor = Math.max(0, cursor - 1);
        drawChecklist("CONFIGURE CHECKS", items, cursor, "Arrows move  SPACE toggle  ENTER save  Q cancel");
        return;
      }

      if (key?.name === "down") {
        cursor = Math.min(items.length - 1, cursor + 1);
        drawChecklist("CONFIGURE CHECKS", items, cursor, "Arrows move  SPACE toggle  ENTER save  Q cancel");
        return;
      }

      if (key?.name === "space") {
        items[cursor].enabled = !items[cursor].enabled;
        drawChecklist("CONFIGURE CHECKS", items, cursor, "Arrows move  SPACE toggle  ENTER save  Q cancel");
        return;
      }

      if (key?.name === "return" || key?.name === "enter") {
        process.stdin.removeListener("keypress", onKey);
        setRawMode(false);
        const nextSkipSet = new Set(
          items.filter((item) => !item.enabled).map((item) => item.name),
        );
        await saveSkippedChecks(nextSkipSet);
        console.clear();
        console.log(`${C.green}Check configuration saved${C.reset}`);
        resolve();
        return;
      }

      if (key?.name === "q" || key?.ctrl && key?.name === "c" || key?.name === "escape") {
        process.stdin.removeListener("keypress", onKey);
        setRawMode(false);
        console.clear();
        console.log(`${C.yellow}Check configuration cancelled${C.reset}`);
        resolve();
      }
    };

    process.stdin.on("keypress", onKey);
    setRawMode(true);
  });
}

async function runSingleCheckMenu(rootOverride = null) {
  if (!process.stdin.isTTY) {
    console.log("Interactive single-check mode requires a TTY.");
    return;
  }

  const checkers = await getAvailableCheckers();
  let cursor = 0;

  drawChecklist(
    "RUN SINGLE CHECK",
    checkers.map((checker) => ({ ...checker, enabled: true })),
    cursor,
    "Arrows move  ENTER run selected check  Q cancel",
  );

  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);

    const onKey = async (_, key) => {
      if (key?.name === "up") {
        cursor = Math.max(0, cursor - 1);
        drawChecklist(
          "RUN SINGLE CHECK",
          checkers.map((checker) => ({ ...checker, enabled: true })),
          cursor,
          "Arrows move  ENTER run selected check  Q cancel",
        );
        return;
      }

      if (key?.name === "down") {
        cursor = Math.min(checkers.length - 1, cursor + 1);
        drawChecklist(
          "RUN SINGLE CHECK",
          checkers.map((checker) => ({ ...checker, enabled: true })),
          cursor,
          "Arrows move  ENTER run selected check  Q cancel",
        );
        return;
      }

      if (key?.name === "return" || key?.name === "enter") {
        process.stdin.removeListener("keypress", onKey);
        setRawMode(false);
        console.clear();
        const selectedChecker = checkers[cursor];
        await runCheck({
          fullProfile: selectedChecker.profile === "full",
          onlyCheckNames: [selectedChecker.name],
          root: rootOverride || projRoot,
        });
        resolve();
        return;
      }

      if (key?.name === "q" || key?.ctrl && key?.name === "c" || key?.name === "escape") {
        process.stdin.removeListener("keypress", onKey);
        setRawMode(false);
        console.clear();
        console.log(`${C.yellow}Single check cancelled${C.reset}`);
        resolve();
      }
    };

    process.stdin.on("keypress", onKey);
    setRawMode(true);
  });
}

async function runCommitMsg(commitMsgPath) {
  const checker = new CommitMsgChecker();
  const result = await checker.run({
    root: projRoot,
    commitMsgPath,
  });

  if (result.success) {
    console.log("Commit Message Quality: " + result.message);
    return;
  }

  console.error("Commit Message Quality: " + result.message);
  if (result.suggestedFix) {
    console.error(`Fix: ${result.suggestedFix}`);
  }
  if (result.details) {
    console.error(result.details);
  }
  process.exit(1);
}

async function promptCommitMessage(statusAnalysis, suggestedHeader) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return suggestedHeader;
  }

  const suggestionBlock = formatSuggestionSummary(statusAnalysis.suggestionSummary).trim();
  if (suggestionBlock) {
    console.log(suggestionBlock);
  }

  console.log(`${C.cyan}Enter to accept, type custom message, or q to cancel${C.reset}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question("Commit message: ", resolve);
  });
  rl.close();

  const trimmed = answer.trim();
  if (!trimmed) {
    return suggestedHeader;
  }

  if (["q", "quit", "cancel"].includes(trimmed.toLowerCase())) {
    return null;
  }

  return trimmed;
}

async function createSuggestedCommit(arg = null) {
  const statusAnalysis = await getStatusAnalysis();

  if (!statusAnalysis.stagedFiles.length) {
    console.error(`${C.yellow}No staged files available for commit${C.reset}`);
    process.exitCode = 1;
    return;
  }

  const suggestedHeader = statusAnalysis.suggestionSummary?.suggestedHeader;
  if (!suggestedHeader) {
    console.error(`${C.yellow}No commit suggestion available${C.reset}`);
    process.exitCode = 1;
    return;
  }

  const commitMessage = arg?.trim()
    ? arg.trim()
    : await promptCommitMessage(statusAnalysis, suggestedHeader);

  if (!commitMessage) {
    console.log(`${C.yellow}Commit cancelled${C.reset}`);
    return;
  }

  const result = await execa("git", ["commit", "-m", commitMessage], {
    cwd: projRoot,
    reject: false,
  });

  if (result.stdout.trim()) {
    console.log(result.stdout.trim());
  }

  if (result.stderr.trim()) {
    console.error(result.stderr.trim());
  }

  if (result.exitCode !== 0) {
    process.exitCode = result.exitCode;
    return;
  }

  console.log(`${C.green}Commit created: ${commitMessage}${C.reset}`);
}

async function runJsonCheck(arg = null) {
  const profile = resolveJsonCheckProfile(arg);
  const startTime = Date.now();
  const stagedFiles = await getStagedFiles();
  const projectPackage = await readProjectPackageFile();
  const packageManager = await detectPackageManager(projRoot);
  const engine = createQualityEngine({
    root: projRoot,
    projectPackage,
    packageManager,
    stagedFiles,
    generateReport: true,
    quiet: true,
  });
  const outcome = await engine.run(profile);
  const durationMs = Date.now() - startTime;

  console.log(JSON.stringify({
    profile,
    durationMs,
    stagedFiles,
    allSuccess: outcome.allSuccess,
    results: outcome.results,
    analysis: outcome.analysis,
    scoreSummary: outcome.scoreSummary,
    suggestionSummary: outcome.suggestionSummary,
    reportPath: outcome.reportPath,
  }, null, 2));

  if (!outcome.allSuccess) {
    process.exitCode = 1;
  }
}

function resolveJsonCheckProfile(arg) {
  if (arg === "--full" || arg === "full") {
    return "full";
  }

  return "fast";
}

function shouldPrintTargetProject(choice, arg) {
  if (!arg || choice === "commit-msg") {
    return false;
  }

  if (choice === "commit") {
    return false;
  }

  if (choice === "json-check" && (arg === "--full" || arg === "full")) {
    return false;
  }

  return true;
}

async function executeAction(choice, arg = null, pauseAfter = true) {
  switch (choice) {
    case "toggle":
      await toggleHook();
      break;
    case "auto-push":
      await toggleAutoPush();
      break;
    case "config":
      await configureChecks();
      break;
    case "single":
      await runSingleCheckMenu(arg);
      break;
    case "enable":
      await enableHook();
      break;
    case "disable":
      await disableHook();
      break;
    case "status":
      await showStatus();
      break;
    case "suggest":
      await showSuggestion();
      break;
    case "json":
      await showJsonAnalysis();
      break;
    case "json-check":
      await runJsonCheck(arg);
      break;
    case "commit":
      await createSuggestedCommit(arg);
      break;
    case "staged":
      await runCheck({ fullProfile: false, root: arg || projRoot });
      break;
    case "check":
      await runCheck({ fullProfile: true, root: arg || projRoot });
      break;
    case "commit-msg":
      await runCommitMsg(arg);
      break;
    case "quit":
      break;
    default:
      if (choice) console.log(`${C.yellow}Unknown command: ${choice}${C.reset}`);
  }

  if (pauseAfter && choice !== "quit") {
    await pauseForTTY();
  }
}

async function enableHook() {
  const huskyDir = join(projRoot, ".husky");
  const preCommitPath = join(huskyDir, "pre-commit");
  const commitMsgPath = join(huskyDir, "commit-msg");

  await mkdir(huskyDir, { recursive: true });
  await writeFile(preCommitPath, PRE_COMMIT_HOOK, "utf8");
  await writeFile(commitMsgPath, COMMIT_MSG_HOOK, "utf8");
  await chmod(preCommitPath, 0o755);
  await chmod(commitMsgPath, 0o755);
  await setGitHooksPath();
  const autoPushEnabled = await isAutoPushConfigured();
  const removedAutoPush = autoPushEnabled
    ? false
    : await removeAutoPushHooks();
  if (autoPushEnabled) {
    await enableAutoPushHook();
  }
  console.log(`${C.green}Hooks enabled${C.reset}`);
  if (removedAutoPush) {
    console.log(`${C.yellow}Removed auto-push hook${C.reset}`);
  }
}

async function enableAutoPushHook() {
  const huskyDir = join(projRoot, ".husky");
  const autoPushPath = join(huskyDir, "post-commit");

  await mkdir(huskyDir, { recursive: true });
  await writeFile(autoPushPath, AUTO_PUSH_HOOK, "utf8");
  await chmod(autoPushPath, 0o755);
}

async function disableAutoPushHook() {
  const postCommitPath = join(projRoot, ".husky", "post-commit");
  const prePushPath = join(projRoot, ".husky", "pre-push");
  const removedPostCommit = await removeAutoPushHookIfSafe(postCommitPath);
  const removedPrePush = await removeAutoPushHookIfSafe(prePushPath);
  return removedPostCommit || removedPrePush;
}

async function toggleAutoPush() {
  const enabled = await isAutoPushConfigured();
  const nextEnabled = !enabled;

  await saveAutoPushConfig(nextEnabled);

  if (nextEnabled) {
    await enableHook();
    await enableAutoPushHook();
    console.log(`${C.green}Auto-push enabled${C.reset}`);
  } else {
    await disableAutoPushHook();
    console.log(`${C.green}Auto-push disabled${C.reset}`);
  }
}

async function toggleHook() {
  const hookState = await getHookState();
  if (hookState.enabled) {
    await disableHook();
  } else {
    await enableHook();
  }
}

async function disableHook() {
  const preCommitPath = join(projRoot, ".husky", "pre-commit");
  const commitMsgPath = join(projRoot, ".husky", "commit-msg");
  let removed = false;

  try {
    await unlink(preCommitPath);
    removed = true;
  } catch {
    // ignore
  }

  try {
    await unlink(commitMsgPath);
    removed = true;
  } catch {
    // ignore
  }

  await unsetGitHooksPathIfManaged();

  console.log(
    removed ? `${C.green}Hooks disabled${C.reset}` : `${C.yellow}Already off${C.reset}`,
  );
}

async function showStatus() {
  const hookState = await getHookState();
  const skippedChecks = await getSkippedChecks();
  const allCheckers = await getAvailableCheckers();
  const statusAnalysis = await getStatusAnalysis();
  const enabledCount = allCheckers.length - skippedChecks.size;
  const stateLabel = hookState.enabled
    ? `${C.green}ON${C.reset}`
    : hookState.broken
      ? `${C.yellow}BROKEN${C.reset}`
      : `${C.red}OFF${C.reset}`;
  const analysisBlock = formatStatusAnalysis(statusAnalysis);

  console.log(
    `\n${C.cyan}STATUS${C.reset}\n` +
    `hook: ${stateLabel}\n` +
    `pre-commit: ${hookState.preCommit ? `${C.green}OK` : `${C.red}MISSING/BAD`}${C.reset}\n` +
    `commit-msg: ${hookState.commitMsg ? `${C.green}OK` : `${C.red}MISSING/BAD`}${C.reset}\n` +
    `auto-push: ${hookState.autoPush ? `${C.green}ON` : `${C.red}OFF`}${C.reset}\n` +
    `core.hooksPath: ${hookState.hooksPath ? `${C.green}${hookState.hooksPathValue}` : `${C.red}MISSING/BAD`}${C.reset}\n` +
    `checks enabled: ${C.green}${enabledCount}${C.reset}/${allCheckers.length}` +
    (analysisBlock ? `\n${analysisBlock}` : ""),
  );
}

async function showSuggestion() {
  const statusAnalysis = await getStatusAnalysis();

  if (!statusAnalysis.stagedFiles.length) {
    console.log(`${C.yellow}No staged files available for commit suggestion${C.reset}`);
    return;
  }

  const suggestionBlock = formatSuggestionSummary(statusAnalysis.suggestionSummary).trim();
  if (!suggestionBlock) {
    console.log(`${C.yellow}No commit suggestion available${C.reset}`);
    return;
  }

  console.log(suggestionBlock);
}

async function showJsonAnalysis() {
  const statusAnalysis = await getStatusAnalysis();
  console.log(JSON.stringify(buildJsonAnalysisPayload(statusAnalysis), null, 2));
}

async function main() {
  const cmd = process.argv[2];
  const arg = process.argv[3];

  const commandMap = {
    t: "toggle",
    e: "enable",
    d: "disable",
    s: "status",
    u: "suggest",
    j: "json",
    f: "staged",
    c: "check",
    g: "config",
    r: "single",
    p: "auto-push",
    m: "menu",
    commit: "commit",
    json: "json",
    "json-check": "json-check",
    suggest: "suggest",
    "auto-push": "auto-push",
    "commit-msg": "commit-msg",
  };

  const initialChoice = commandMap[cmd] || cmd;

  if (shouldPrintTargetProject(initialChoice, arg)) {
    console.log(`${C.cyan}Target project: ${arg}${C.reset}`);
  }

  if (initialChoice && initialChoice !== "menu") {
    await executeAction(initialChoice, arg, false);
    return;
  }

  let choice = "menu";
  while (choice !== "quit") {
    if (choice === "menu") {
      choice = await runMenu();
    } else {
      await executeAction(choice, arg);
      choice = "menu";
    }
  }

  console.log(`${C.magenta}Bye!${C.reset}`);
}

await main();
