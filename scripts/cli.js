#!/usr/bin/env node
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { getProjectRoot } from "../src/utils/ProjectUtils.js";
import { runCheck } from "./quality-staged.js";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";

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

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
};

const C = colors;

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

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function navigate() {
  drawMenu();
  
  return new Promise((resolve) => {
    const onKey = (char, key) => {
      if (key.name === "up") {
        selected = Math.max(0, selected - 1);
        drawMenu();
      } else if (key.name === "down") {
        selected = Math.min(options.length - 1, selected + 1);
        drawMenu();
      } else if (key.name === "return" || key.name === "enter") {
        rl.input.removeListener("keypress", onKey);
        console.clear();
        resolve(options[selected].action);
      } else if (char === "q" || (key.ctrl && key.name === "c")) {
        rl.input.removeListener("keypress", onKey);
        console.clear();
        console.log(`${C.magenta}Bye!${C.reset}`);
        resolve("quit");
      }
    };
    
    rl.input.on("keypress", onKey);
  });
}

async function main() {
  const cmd = process.argv[2];
  
  if (cmd && cmd !== "menu" && cmd !== "m") {
    const opt = options.find(o => o.action === cmd || o.key === cmd);
    if (opt) {
      if (opt.action === "enable") await enableHook();
      else if (opt.action === "disable") await disableHook();
      else if (opt.action === "status") await showStatus();
      else if (opt.action === "staged") await runCheck({ fullProfile: false });
      else if (opt.action === "check") await runCheck({ fullProfile: true });
      process.exit(0);
      return;
    }
  }
  
  const choice = await navigate();
  
  if (choice === "enable") await enableHook();
  else if (choice === "disable") await disableHook();
  else if (choice === "status") await showStatus();
  else if (choice === "staged") await runCheck({ fullProfile: false });
  else if (choice === "check") await runCheck({ fullProfile: true });
  else console.log(`${C.magenta}Bye!${C.reset}`);
  
  rl.close();
  process.exit(0);
}

async function enableHook() {
  const p = join(projRoot, ".husky", "pre-commit");
  const body = `#!/usr/bin/env sh\nnpm exec -- cqc check\n`;
  try { await mkdir(join(projRoot, ".husky"), { recursive: true }); } catch {}
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