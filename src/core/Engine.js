import { execa } from "execa";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export class QualityEngine {
  constructor(options = {}) {
    this.checkers = [];
    this.options = options;
  }

  registerChecker(checker) {
    this.checkers.push(checker);
    return this;
  }

  async initialize() {
    this.root = await this.getProjectRoot();
    this.packageManager = await this.detectPackageManager();
    this.projectPackage = await this.readProjectPackage();
    this.config = this.normalizeConfig(this.projectPackage.gitQuality || {});

    return this;
  }

  async run(profile = "fast") {
    if (!this.config) {
      await this.initialize();
    }
    console.log(`🚀 Running Quality Check [Profile: ${profile}]`);

    const context = {
      root: this.root,
      packageManager: this.packageManager,
      projectPackage: this.projectPackage,
      config: this.config,
      execa,
      profile,
    };

    const results = [];
    for (const checker of this.checkers) {
      if (this.shouldRunChecker(checker, profile)) {
        console.log(`🔍 Running ${checker.name}...`);
        const result = await checker.run(context);
        results.push({ name: checker.name, ...result });
        if (!result.success) {
          console.error(`❌ ${checker.name} failed: ${result.message}`);
        }
      }
    }

    const allSuccess = results.every((r) => r.success);
    if (allSuccess) {
      console.log("✅ All checks passed!");
    } else {
      console.error(
        "🚨 Some checks failed. Please fix the issues before committing.",
      );
    }

    return { allSuccess, results };
  }

  shouldRunChecker(checker, profile) {
    if (profile === "full") return true;
    return checker.profile === "fast" || !checker.profile;
  }

  async getProjectRoot() {
    const { stdout } = await execa("git", ["rev-parse", "--show-toplevel"]);
    return resolve(stdout.trim());
  }

  async detectPackageManager() {
    const packageJson = await this.readProjectPackage();
    if (packageJson.packageManager) {
      if (packageJson.packageManager.includes("pnpm")) return "pnpm";
      if (packageJson.packageManager.includes("yarn")) return "yarn";
      if (packageJson.packageManager.includes("bun")) return "bun";
    }
    return "npm";
  }

  async readProjectPackage() {
    const raw = await readFile(join(this.root, "package.json"), "utf8");
    return JSON.parse(raw);
  }

  normalizeConfig(config) {
    return {
      staged: {
        prettier: config.staged?.prettier ?? true,
        eslint: config.staged?.eslint ?? true,
      },
      scripts: config.scripts || [],
    };
  }
}
