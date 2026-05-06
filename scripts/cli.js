#!/usr/bin/env node
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { getProjectRoot } from "../src/utils/ProjectUtils.js";
import { runCheck } from "./quality-staged.js";
import { existsSync } from "node:fs";
import readline from "node:readline";

const projRoot = await getProjectRoot();
const hookOn = existsSync(join(projRoot, ".husky", "pre-commit"));

let selected = 0;
const options = [
  { label: "Enable hook", action: "enable", key: "e" },
  { label: "Disable hook", action: "disable", key: "d" },
  { label: "Status", action: "status", key: "s" },
  { label: "Staged check", action: "staged", key: "f" },
  { label: "Full check", action: "check", key: "c" },
  { label: "Quit", action: "quit", key: "q" },
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

function drawMenu() {
  console.clear();
  console.log(`\n${C.cyan}${C.bright}━━━ COMMIT QUALITY CHECK ━━━${C.reset}\n`);

  options.forEach((opt, i) => {
    const isSelected = i === selected;
    const status = i === 0 && hookOn ? ` ${C.green}ON${C.reset}` : i === 1 && !hookOn ? ` ${C.red}OFF${C.reset}` : "";
    const arrow = isSelected ? `${C.yellow}▶${C.reset}` : " ";
    const label = isSelected ? `${C.bright}${C.cyan}${opt.label}${C.reset}` : opt.label;
    console.log(`  ${arrow} ${label}${status}`);
  });

  console.log(`\n${C.magenta}↑↓ Select  ENTER Confirm  Q Quit${C.reset}`);
}

const stdin = process.stdin;
const isRaw = stdin.isRaw;

function setRawMode(enable) {
  if (stdin.setRawMode) {
    stdin.setRawMode(enable);
  }
  if (enable) {
    stdin.resume();
    stdin.setEncoding("utf8");
  } else {
    stdin.pause();
  }
}

async function runMenu() {
  drawMenu();

  return new Promise((resolve) => {
    readline.emitKeypressEvents(stdin);
    const onKey = (char, key) => {
      if (key.name === "up") {
        selected = Math.max(0, selected - 1);
        drawMenu();
      } else if (key.name === "down") {
        selected = Math.min(options.length - 1, selected + 1);
        drawMenu();
      } else if (key.name === "return" || key.name === "enter") {
        stdin.removeListener("keypress", onKey);
        setRawMode(false);
        console.clear();
        resolve(options[selected].action);
      } else if (char === "q" || (key.ctrl && key.name === "c")) {
        stdin.removeListener("keypress", onKey);
        setRawMode(false);
        console.clear();
        resolve("quit");
      }
    };

    stdin.on("keypress", onKey);
    setRawMode(true);
  });
}

async function main() {
  const cmd = process.argv[2];
  const targetRoot = process.argv[3];

  // Map short commands to internal actions
  const commandMap = {
    'e': 'enable',
    'd': 'disable',
    's': 'status',
    'f': 'staged',
    'c': 'check',
    'm': 'menu'
  };

  let initialChoice = cmd;
  if (commandMap[cmd]) initialChoice = commandMap[cmd];

  if (targetRoot) {
    console.log(`${C.cyan}Target project: ${targetRoot}${C.reset}`);
  }

  // If a direct command was provided (and it's not 'menu'), execute it once and exit
  if (initialChoice && initialChoice !== 'menu') {
    await executeAction(initialChoice, targetRoot);
    return;
  }

  // Otherwise, enter the interactive loop
  let choice = 'menu';
  while (choice !== 'quit') {
    if (choice === 'menu') {
      choice = await runMenu();
    } else {
      await executeAction(choice, targetRoot);
      // After action, return to menu
      choice = 'menu';
    }
  }
  console.log(`${C.magenta}Bye!${C.reset}`);
}

async function executeAction(choice, root = null) {
  switch (choice) {
    case "enable": await enableHook(); break;
    case "disable": await disableHook(); break;
    case "status": await showStatus(); break;
    case "staged": await runCheck({ fullProfile: false, root }); break;
    case "check": await runCheck({ fullProfile: true, root }); break;
    case "quit": break; // Handled by loop
    default:
      if (choice) console.log(`${C.yellow}Unknown command: ${choice}${C.reset}`);
  }
  if (choice !== 'quit') {
    if (stdin.isTTY) {
      console.log(`\n${C.yellow}Press any key to return to menu...${C.reset}`);
      await new Promise(resolve => {
        try {
          stdin.setRawMode(true);
          stdin.resume();
          stdin.on('data', () => {
            stdin.removeListener('data', resolve);
            resolve();
          });
        } catch (e) {
          resolve();
        }
      });
    } else {
      // In non-TTY environments, we just resolve immediately
      await Promise.resolve();
    }
  }
}

async function enableHook() {
  const p = join(projRoot, ".husky", "pre-commit");
  const body = `#!/usr/bin/env sh\nnpm exec -- cqc check\n`;
  try { await mkdir(join(projRoot, ".husky"), { recursive: true }); } catch { }
  await writeFile(p, body, "utf8");
  console.log(`${C.green}✅ Hook enabled${C.reset}`);
}

async function disableHook() {
  const p = join(projRoot, ".husky", "pre-commit");
  try { await unlink(p); console.log(`${C.green}✅ Hook disabled${C.reset}`); }
  catch (e) { console.log(`${C.yellow}ℹ️ Already off${C.reset}`); }
}

async function showStatus() {
  console.log(`\n${C.cyan}━━━ STATUS ━━━\n${C.reset}Auto-check: ${hookOn ? `${C.green}ON` : `${C.red}OFF`}${C.reset}`);
}

main();