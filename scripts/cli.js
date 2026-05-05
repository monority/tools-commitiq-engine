#!/usr/bin/env node
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { getProjectRoot } from "../src/utils/ProjectUtils.js";
import { runCheck } from "./quality-staged.js";
import { existsSync } from "node:fs";

const projRoot = await getProjectRoot();
const hookOn = existsSync(join(projRoot, ".husky", "pre-commit"));

function showMenu() {
  console.log(`
╔══════════════════════════════════════╗
║     Commit Quality Check       ║
╠═══════════════════════════════════╣
║  e  enable   Enable hook        ║
║  d  disable  Disable hook       ║
║  s  status   Show status        ║
║  f  staged   Check staged       ║
║  c  check    Full check         ║
║  q  quit     Exit               ║
╚══════════════════════════════════════╝
`);
}

async function main() {
  const cmd = process.argv[2];
  
  if (cmd === "enable" || cmd === "e") {
    await enableHook();
  } else if (cmd === "disable" || cmd === "d") {
    await disableHook();
  } else if (cmd === "status" || cmd === "s") {
    await showStatus();
  } else if (cmd === "staged" || cmd === "f") {
    await runCheck({ fullProfile: false });
  } else if (cmd === "check" || cmd === "c") {
    await runCheck({ fullProfile: true });
  } else if (cmd === "help" || cmd === "h") {
    showMenu();
    console.log("\nCommands:");
    console.log("  npx cqc enable   - Enable auto-check");
    console.log("  npx cqc disable  - Disable auto-check");
    console.log("  npx cqc status   - Show status");
    console.log("  npx cqc staged   - Check staged files");
    console.log("  npx cqc check    - Full check with e2e");
  } else if (!cmd || cmd === "menu") {
    showMenu();
  } else {
    console.log(`Unknown: ${cmd}`);
    console.log("Run: npx cqc help");
  }
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
  console.log(`\nStatus:\n  Auto-check: ${hookOn ? "✅ On" : "❌ Off"}`);
}

main();

process.exit(0);