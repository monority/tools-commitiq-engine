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

const cmd = process.argv[2];
const withReport = process.argv.includes("--report");
const projRoot = await getProjectRoot();
const hookOn = existsSync(join(projRoot, ".husky", "pre-commit"));

const menuOpts = `
╔════════════════════════════════════════╗
║     Commit Quality Check       ║
╠════════════════════════════════╣
║  1) menu     Show this menu     ║
║  2) enable  Enable hook        ║
║  3) disable Disable hook       ║
║  4) status  Show status        ║
║  5) staged  Check staged       ║
║  6) check   Full check         ║
║  7) quit    Exit               ║
╚════════════════════════════════╝
`;

switch (cmd) {
  case "1":
  case "menu":
    console.log(menuOpts);
    console.log("Status:", hookOn ? "On" : "Off");
    process.exit(0);
  case "2":
  case "enable":
  case "e":
    await enableHook();
    process.exit(0);
  case "3":
  case "disable":
  case "d":
    await disableHook();
    process.exit(0);
  case "4":
  case "status":
  case "st":
    await showStatus();
    process.exit(0);
  case "5":
  case "staged":
  case "s":
    await runCheck({ generateReport: withReport });
    process.exit(0);
  case "6":
  case "check":
  case "c":
    await runCheck({ generateReport: withReport });
    process.exit(0);
  case "7":
  case "quit":
  case "q":
    console.log("Bye!");
    process.exit(0);
  case "--help":
  case "-h":
  case "help":
  case "m":
    console.log(menuOpts);
    console.log("Status:", hookOn ? "On" : "Off");
    process.exit(0);
  case undefined:
    console.log(menuOpts);
    console.log("Status:", hookOn ? "On" : "Off");
    process.exit(0);
  default:
    console.error("Unknown:", cmd);
    console.log(menuOpts);
    process.exit(1);
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
  console.log("Hook enabled");
}

async function disableHook() {
  const p = join(projRoot, ".husky", "pre-commit");
  try { await unlink(p); console.log("Hook disabled"); }
  catch (e) { console.log(e.code === "ENOENT" ? "Already off" : "Error"); }
}

async function showStatus() {
  console.log("Auto-check:", hookOn ? "On" : "Off");
  console.log("Root:", projRoot);
}

function makeHook() {
  return `#!/usr/bin/env sh
npm exec -- cqc c
`;
}