#!/usr/bin/env node
import { execa } from "execa";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { getProjectRoot } from "../src/utils/ProjectUtils.js";
import { runCheck } from "./quality-staged.js";
import { readFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";

const projRoot = await getProjectRoot();
const hookOn = existsSync(join(projRoot, ".husky", "pre-commit"));

const options = [
  { label: "Enable hook", action: "enable", short: "e" },
  { label: "Disable hook", action: "disable", short: "d" },
  { label: "Show status", action: "status", short: "s" },
  { label: "Check staged (fast)", action: "staged", short: "f" },
  { label: "Full check (+e2e)", action: "check", short: "c" },
  { label: "Quit", action: "quit", short: "q" },
];

let selected = 0;

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function drawMenu() {
  console.clear();
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║     Commit Quality Check       ║");
  console.log("╠════════════════════════════════╣");
  
  options.forEach((opt, i) => {
    const isOn = i === 0 && hookOn;
    const isOff = i === 1 && !hookOn;
    const extra = isOn ? " ✅" : isOff ? " ❌" : "";
    const marker = i === selected ? "▶" : " ";
    const label = opt.label + extra;
    console.log(`║  ${marker} ${label}${"".padStart(28 - label.length)}║`);
  });
  
  console.log("╚════════════════════════════════════════╝");
  console.log("\n  ↑↓ Navigate  ENTER Select  q Quit");
}

rl.setPrompt("", 0);

function clearLine() {
  process.stdout.write("\r");
}

async function navigate() {
  drawMenu();
  
  return new Promise((resolve) => {
    const onKeyPress = (char, key) => {
      if (key.name === "up") {
        selected = Math.max(0, selected - 1);
        drawMenu();
      } else if (key.name === "down") {
        selected = Math.min(options.length - 1, selected + 1);
        drawMenu();
      } else if (key.name === "return" || key.name === "enter") {
        rl.input.removeListener("keypress", onKeyPress);
        resolve(options[selected].action);
      } else if (key.name === "q") {
        rl.input.removeListener("keypress", onKeyPress);
        resolve("quit");
      } else if (char === "1") { selected = 0; drawMenu(); }
      else if (char === "2") { selected = 1; drawMenu(); }
      else if (char === "3") { selected = 2; drawMenu(); }
      else if (char === "4") { selected = 3; drawMenu(); }
      else if (char === "5") { selected = 4; drawMenu(); }
      else if (char === "6") { selected = 5; drawMenu(); }
      else if (key.ctrl && key.name === "c") {
        rl.input.removeListener("keypress", onKeyPress);
        resolve("quit");
      }
    };
    
    rl.input.on("keypress", onKeyPress);
  });
}

async function main() {
  const cmd = process.argv[2];
  
  if (cmd === "help" || cmd === "h" || cmd === "menu" || cmd === "m" || cmd === undefined) {
      await navigate();
    } else {
    const opt = options.find(o => o.action === cmd || o.short === cmd);
    if (opt) {
      if (opt.action === "enable") await enableHook();
      else if (opt.action === "disable") await disableHook();
      else if (opt.action === "status") await showStatus();
      else if (opt.action === "staged") await runCheck({ fullProfile: false });
      else if (opt.action === "check") await runCheck({ fullProfile: true });
    } else if (cmd === "help" || cmd === "h") {
      console.log("\nOptions: enable, disable, status, staged, check\nOr use: npx cqc (for menu)");
    } else {
      console.log(`Unknown: ${cmd}`);
      showMenuText();
    }
    return;
  }
  
  const choice = await navigate();
  
  console.clear();
  if (choice === "enable") await enableHook();
  else if (choice === "disable") await disableHook();
  else if (choice === "status") await showStatus();
  else if (choice === "staged") await runCheck({ fullProfile: false });
  else if (choice === "check") await runCheck({ fullProfile: true });
  else console.log("👋 Bye!");
  
  rl.close();
}

function showMenuText() {
  console.log(`
╔════════════════════════════════════════╗
║     Commit Quality Check       ║
╠════════════════════════════════╣
║  e) enable  Enable hook        ║
║  d) disable Disable hook       ║
║  s) status  Show status        ║
║  f) staged  Check staged       ║
║  c) check   Full check (+e2e)  ║
║  q) quit    Exit               ║
╚════════════════════════════════╝
`);
}

async function enableHook() {
  const p = join(projRoot, ".husky", "pre-commit");
  const body = `#!/usr/bin/env sh
npm exec -- cqc check
`;
  try { await mkdir(join(projRoot, ".husky"), { recursive: true }); } catch {}
  await writeFile(p, body, "utf8");
  console.log("✅ Hook enabled");
}

async function disableHook() {
  const p = join(projRoot, ".husky", "pre-commit");
  try { await unlink(p); console.log("✅ Hook disabled"); }
  catch (e) { console.log("ℹ️ Hook already off"); }
}

async function showStatus() {
  console.log(`
╔════════════════════════════════════╗
║     Status                    ║
╠════════════════════════════════╣
║  Auto-check: ${hookOn ? "✅ On" : "❌ Off".padEnd(26)}║
║  Root: ${projRoot.substring(0, 28).padEnd(28)}║
╚════════════════════════════════════╝`);
}

main();