#!/usr/bin/env node
import { execa } from "execa";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  detectPackageManager,
  ensurePackagesInstalled,
  getPackageManagerExecCommand,
  getProjectRoot,
  readProjectPackage,
} from "../src/utils/ProjectUtils.js";
import { runCheck } from "./quality-staged.js";
import { readFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";

const projRoot = await getProjectRoot();
const hookOn = existsSync(join(projRoot, ".husky", "pre-commit"));

const menuOpts = `
╔════════════════════════════════════════╗
║     Commit Quality Check       ║
╠════════════════════════════════╣
║  1) enable  Enable hook        ║
║  2) disable Disable hook       ║
║  3) status  Show status        ║
║  4) staged  Check staged       ║
║  5) check   Full check         ║
║  6) quit    Exit               ║
╚════════════════════════════════╝
`;

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function showMenu() {
  console.clear();
  console.log(`\n${menuOpts}`);
  console.log("Status:", hookOn ? "✅ On" : "❌ Off");
  const answer = await ask("\n👉 Choose option: ");
  return answer.trim();
}

async function handleChoice(choice) {
  try {
    switch (choice) {
      case "1":
      case "enable":
        await enableHook();
        break;
      case "2":
      case "disable":
        await disableHook();
        break;
      case "3":
      case "status":
        await showStatus();
        break;
      case "4":
      case "staged":
        await runCheck({ generateReport: false });
        break;
      case "5":
      case "check":
        await runCheck({ generateReport: false });
        break;
      case "6":
      case "quit":
      case "q":
        console.log("👋 Bye!");
        rl.close();
        process.exit(0);
      default:
        console.log("❌ Invalid option");
    }
    await ask("\nPress Enter to continue...");
  } catch (e) {
    // ignore readline errors in pipe mode
  }
}

async function initHook() {
  const pkgMgr = await detectPackageManager(projRoot);
  let pkg = await readProjectPackage(projRoot);
  pkg = await ensurePackagesInstalled({
    root: projRoot,
    packageManager: pkgMgr,
    projectPackage: pkg,
    packages: ["husky"],
    reason: "install hook",
  });
  if (!pkg.dependencies?.husky && !pkg.devDependencies?.husky) {
    console.error("Need husky");
    process.exit(1);
  }
  const { command: c, args: a } = getPackageManagerExecCommand(pkgMgr, ["husky", "init"]);
  console.log("Installing...");
  await execa(c, a, { cwd: projRoot, stdio: "inherit" });
  await enableHook();
}

async function enableHook() {
  const p = join(projRoot, ".husky", "pre-commit");
  const body = makeHook();
  try { await mkdir(join(projRoot, ".husky"), { recursive: true }); } catch {}
  await writeFile(p, body, "utf8");
  console.log("✅ Hook enabled");
}

async function disableHook() {
  const p = join(projRoot, ".husky", "pre-commit");
  try { await unlink(p); console.log("✅ Hook disabled"); }
  catch (e) { console.log(e.code === "ENOENT" ? "Already off" : "Error"); }
}

async function showStatus() {
  console.clear();
  console.log("╔════════════════════════════════════╗");
  console.log("║     Commit Quality Check          ║");
  console.log("╠════════════════════════════════╣");
  console.log(`║  Auto-check: ${hookOn ? "✅ On" : "❌ Off".padEnd(26)}║`);
  console.log(`║  Root: ${projRoot.substring(0, 28).padEnd(28)}║`);
  console.log("╚════════════════════════════════════╝");
}

function makeHook() {
  return `#!/usr/bin/env sh
# Run from project root
cd "\$(git rev-parse --show-toplevel)" && npm exec -- cqc check
`;
}

async function main() {
  if (!process.argv[2]) {
    while (true) {
      const choice = await showMenu();
      if (!choice) continue;
      await handleChoice(choice);
    }
  } else {
    const cmd = process.argv[2];
    const withReport = process.argv.includes("--report");
    
    switch (cmd) {
      case "enable":
      case "e":
        await enableHook();
        break;
      case "disable":
      case "d":
        await disableHook();
        break;
      case "status":
      case "st":
        await showStatus();
        break;
      case "staged":
      case "s":
        await runCheck({ generateReport: withReport });
        break;
      case "check":
      case "c":
        await runCheck({ generateReport: withReport });
        break;
      case "quit":
      case "q":
        console.log("Bye!");
        process.exit(0);
      default:
        console.error("Unknown:", cmd);
        process.exit(1);
    }
  }
  rl.close();
}

main();