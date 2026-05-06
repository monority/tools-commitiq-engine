#!/usr/bin/env node
import { existsSync } from "node:fs";
import { chmod, mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import readline from "node:readline";
import { CommitMsgChecker } from "../src/checkers/CommitMsgChecker.js";
import { getProjectRoot } from "../src/utils/ProjectUtils.js";
import { runCheck } from "./quality-staged.js";

const projRoot = await getProjectRoot();

let selected = 0;
const options = [
  { label: "Enable hook", action: "enable" },
  { label: "Disable hook", action: "disable" },
  { label: "Status", action: "status" },
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

function getHookState() {
  return {
    preCommit: existsSync(join(projRoot, ".husky", "pre-commit")),
    commitMsg: existsSync(join(projRoot, ".husky", "commit-msg")),
  };
}

function drawMenu() {
  const hookState = getHookState();
  console.clear();
  console.log(`\n${C.cyan}${C.bright}COMMIT QUALITY CHECK${C.reset}\n`);

  options.forEach((opt, i) => {
    const isSelected = i === selected;
    const label = isSelected
      ? `${C.bright}${C.cyan}${opt.label}${C.reset}`
      : opt.label;
    let status = "";
    if (i === 0) status = hookState.preCommit ? ` ${C.green}ON${C.reset}` : ` ${C.red}OFF${C.reset}`;
    if (i === 1) status = hookState.commitMsg ? ` ${C.green}ON${C.reset}` : ` ${C.red}OFF${C.reset}`;
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
  drawMenu();

  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);

    const onKey = (_, key) => {
      if (key?.name === "up") {
        selected = Math.max(0, selected - 1);
        drawMenu();
        return;
      }

      if (key?.name === "down") {
        selected = Math.min(options.length - 1, selected + 1);
        drawMenu();
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

async function runCommitMsg(commitMsgPath) {
  const checker = new CommitMsgChecker();
  const result = await checker.run({
    root: projRoot,
    commitMsgPath,
  });

  if (result.success) {
    console.log(`\u2714 Commit Message Quality: ${result.message}`);
    return;
  }

  console.error(`\u274c Commit Message Quality: ${result.message}`);
  if (result.suggestedFix) {
    console.error(`\u{1F4A1} Fix: ${result.suggestedFix}`);
  }
  if (result.details) {
    console.error(result.details);
  }
  process.exit(1);
}

async function executeAction(choice, arg = null) {
  switch (choice) {
    case "enable":
      await enableHook();
      break;
    case "disable":
      await disableHook();
      break;
    case "status":
      await showStatus();
      break;
    case "staged":
      await runCheck({ fullProfile: false, root: arg });
      break;
    case "check":
      await runCheck({ fullProfile: true, root: arg });
      break;
    case "commit-msg":
      await runCommitMsg(arg);
      break;
    case "quit":
      break;
    default:
      if (choice) console.log(`${C.yellow}Unknown command: ${choice}${C.reset}`);
  }

  if (choice !== "quit") {
    await pauseForTTY();
  }
}

async function enableHook() {
  const huskyDir = join(projRoot, ".husky");
  const preCommitPath = join(huskyDir, "pre-commit");
  const commitMsgPath = join(huskyDir, "commit-msg");

  await mkdir(huskyDir, { recursive: true });
  await writeFile(preCommitPath, "#!/usr/bin/env sh\nnpm exec -- cqc staged\n", "utf8");
  await writeFile(commitMsgPath, "#!/usr/bin/env sh\nnpm exec -- cqc commit-msg \"$1\"\n", "utf8");
  await chmod(preCommitPath, 0o755);
  await chmod(commitMsgPath, 0o755);
  console.log(`${C.green}Hooks enabled${C.reset}`);
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

  console.log(
    removed ? `${C.green}Hooks disabled${C.reset}` : `${C.yellow}Already off${C.reset}`,
  );
}

async function showStatus() {
  const hookState = getHookState();
  console.log(
    `\n${C.cyan}STATUS${C.reset}\n` +
    `pre-commit: ${hookState.preCommit ? `${C.green}ON` : `${C.red}OFF`}${C.reset}\n` +
    `commit-msg: ${hookState.commitMsg ? `${C.green}ON` : `${C.red}OFF`}${C.reset}`,
  );
}

async function main() {
  const cmd = process.argv[2];
  const arg = process.argv[3];

  const commandMap = {
    e: "enable",
    d: "disable",
    s: "status",
    f: "staged",
    c: "check",
    m: "menu",
    "commit-msg": "commit-msg",
  };

  const initialChoice = commandMap[cmd] || cmd;

  if (arg && initialChoice !== "commit-msg") {
    console.log(`${C.cyan}Target project: ${arg}${C.reset}`);
  }

  if (initialChoice && initialChoice !== "menu") {
    await executeAction(initialChoice, arg);
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
