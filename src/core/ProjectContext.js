import { execa } from "execa";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { normalizeGitQualityConfig } from "./Config.js";
import { DiffAnalyzer } from "./DiffAnalyzer.js";
import { ScoringEngine } from "./ScoringEngine.js";
import { SuggestionEngine } from "./SuggestionEngine.js";

export class ProjectContext {
    /**
     * Factory method to create and initialize a ProjectContext.
     * @param {Object} options 
     * @returns {Promise<ProjectContext>}
     */
    static async create(options = {}) {
        const context = new ProjectContext(options);
        return await context.initialize();
    }

    constructor(options = {}) {
        this.options = options;
        this.root = null;
        this.projectPackage = null;
        this.packageManager = "npm";
        this.config = {};
        this.stagedFiles = [];
        this.stagedDiff = "";
        this.analysis = null;
        this.scoreSummary = null;
        this.suggestionSummary = null;
    }

    async initialize() {
        try {
            this.root = await this.getProjectRoot();
            this.projectPackage = this.options.projectPackage || await this.readProjectPackage();
            this.packageManager = this.options.packageManager || await this.detectPackageManager();
            this.config = normalizeGitQualityConfig(this.projectPackage.gitQuality || {});
            this.stagedFiles = this.resolveStagedFiles();
            this.stagedDiff = await this.resolveStagedDiff();
            this.analysis = new DiffAnalyzer().analyze(this.stagedFiles, this.stagedDiff);
            this.scoreSummary = new ScoringEngine().score(this.analysis);
            this.suggestionSummary = new SuggestionEngine().suggest(this.analysis, this.scoreSummary);
        } catch (error) {
            throw new Error(`Project initialization failed: ${error.message}`);
        }
        return this;
    }

    resolveStagedFiles() {
        if (Array.isArray(this.options.stagedFiles)) {
            return [...this.options.stagedFiles];
        }

        return [];
    }

    async resolveStagedDiff() {
        if (typeof this.options.stagedDiff === "string") {
            return this.options.stagedDiff;
        }

        try {
            const { stdout } = await execa(
                "git",
                ["diff", "--cached", "--no-color", "--unified=0"],
                { cwd: this.root },
            );
            return stdout;
        } catch {
            return "";
        }
    }

    async getProjectRoot() {
        if (this.options.root) {
            return resolve(this.options.root);
        }
        try {
            const { stdout } = await execa("git", ["rev-parse", "--show-toplevel"]);
            return resolve(stdout.trim());
        } catch (error) {
            throw new Error(`Could not determine project root via git: ${error.message}`);
        }
    }

    async readProjectPackage() {
        try {
            const raw = await readFile(join(this.root, "package.json"), "utf8");
            return JSON.parse(raw);
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`Malformed package.json: ${error.message}`);
            }
            throw new Error(`Could not read package.json: ${error.message}`);
        }
    }

    async detectPackageManager() {
        if (!this.projectPackage) {
            this.projectPackage = await this.readProjectPackage();
        }

        const pm = this.projectPackage.packageManager;
        if (pm) {
            if (pm.includes("pnpm")) return "pnpm";
            if (pm.includes("yarn")) return "yarn";
            if (pm.includes("bun")) return "bun";
        }
        return "npm";
    }
}
