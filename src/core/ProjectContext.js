import { execa } from "execa";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

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
    }

    async initialize() {
        try {
            this.root = await this.getProjectRoot();
            this.projectPackage = await this.readProjectPackage();
            this.packageManager = await this.detectPackageManager();
            this.config = this.normalizeConfig(this.projectPackage.gitQuality || {});
        } catch (error) {
            throw new Error(`Project initialization failed: ${error.message}`);
        }
        return this;
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

    normalizeConfig(config) {
        return {
            staged: {
                prettier: config.staged?.prettier ?? true,
                eslint: config.staged?.eslint ?? true,
            },
            skip: config.skip || [],
        };
    }
}
