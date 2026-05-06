import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { BaseChecker } from "./BaseChecker.js";

export class CheckRegistry {
    constructor() {
        this.checkers = new Map();
    }

    /**
     * Register a checker instance.
     * @param {BaseChecker} checker 
     */
    register(checker) {
        this.checkers.set(checker.name, checker);
        return this;
    }

    /**
     * Auto-discover and load checkers from a directory.
     * @param {string} checkersDir Path to the checkers directory.
     */
    async discover(checkersDir) {
        const files = await readdir(checkersDir);

        for (const file of files) {
            if (file.endsWith(".js") && file !== "index.js") {
                const filePath = join(checkersDir, file);
                const fileUrl = pathToFileURL(filePath).href;

                try {
                    const module = await import(fileUrl);
                    for (const exportKey in module) {
                        const ExportedClass = module[exportKey];
                        if (
                            typeof ExportedClass === "function" &&
                            ExportedClass !== BaseChecker &&
                            ExportedClass.prototype instanceof BaseChecker
                        ) {
                            const instance = new ExportedClass();
                            this.register(instance);
                        }
                    }
                } catch (error) {
                    console.error(`❌ Failed to load checker from ${file}: ${error.message}`);
                }
            }
        }
        return this;
    }

    /**
     * Get checkers filtered by profile and configuration.
     * @param {string} profile - 'fast' or 'full'
     * @param {string[]} skipList - List of checker names to skip
     */
    getCheckersForProfile(profile = "fast", skipList = []) {
        const activeCheckers = [];

        for (const checker of this.checkers.values()) {
            if (skipList.includes(checker.name)) continue;

            if (profile === "full") {
                activeCheckers.push(checker);
            } else if (checker.profile === "fast" || !checker.profile) {
                activeCheckers.push(checker);
            }
        }

        return activeCheckers;
    }

    get allCheckers() {
        return Array.from(this.checkers.values());
    }
}
