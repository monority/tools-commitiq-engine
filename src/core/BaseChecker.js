import { execa } from "execa";

export class BaseChecker {
    constructor(name, profile = "fast") {
        if (this.constructor === BaseChecker) {
            throw new Error("BaseChecker is an abstract class and cannot be instantiated directly.");
        }
        this.name = name;
        this.profile = profile;
    }

    /**
     * Execute the quality check.
     * @param {ProjectContext} context - The project environment and configuration.
     * @returns {Promise<{success: boolean, message: string, suggestedFix?: string, details?: string}>}
     */
    async run(context) {
        throw new Error(`Method 'run()' must be implemented by subclass ${this.constructor.name}`);
    }

    /**
     * Helper to execute shell commands via the package manager.
     */
    async exec(context, command, args = [], options = {}) {
        const { root } = context;

        try {
            const result = await execa(command, args, {
                cwd: root,
                stdio: "pipe",
                ...options,
            });
            return {
                success: true,
                stdout: result.stdout?.trim() || "",
                stderr: result.stderr?.trim() || "",
            };
        } catch (error) {
            return {
                success: false,
                stdout: error.stdout?.trim() || "",
                stderr: error.stderr?.trim() || error.message,
            };
        }
    }

    async getStagedFiles(context) {
        if (Array.isArray(context?.stagedFiles)) {
            return context.stagedFiles.filter((file) => !this.isIgnoredFile(file, context));
        }

        const { root } = context;
        try {
            const { stdout } = await execa(
                "git",
                ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
                { cwd: root },
            );
            return stdout
                .split("\n")
                .map((f) => f.trim())
                .filter(Boolean)
                .filter((file) => !this.isIgnoredFile(file, context));
        } catch (error) {
            console.error(`❌ Failed to get staged files: ${error.message}`);
            return [];
        }
    }

    isIgnoredFile(file, context) {
        const ignorePatterns = context.config?.ignore || [];
        if (ignorePatterns.length === 0) return false;

        const normalizedFile = normalizePath(file);
        return ignorePatterns.some((pattern) =>
            matchesIgnorePattern(normalizedFile, pattern),
        );
    }

    getPackageManagerScriptCommand(packageManager, script, extraArgs = []) {
        switch (packageManager) {
            case "pnpm":
                return { command: "pnpm", args: ["run", script, "--", ...extraArgs] };
            case "yarn":
                return { command: "yarn", args: ["run", script, ...extraArgs] };
            case "bun":
                return { command: "bun", args: ["run", script, ...extraArgs] };
            default:
                return { command: "npm", args: ["run", script, "--", ...extraArgs] };
        }
    }

    async runScript(context, script, extraArgs = []) {
        const { packageManager } = context;
        const { command, args } = this.getPackageManagerScriptCommand(
            packageManager,
            script,
            extraArgs,
        );
        return this.exec(context, command, args);
    }

    /**
     * Checks if the required dependencies are installed.
     * @param {ProjectContext} context 
     * @param {string[]} dependencies - List of packages to check.
     * @returns {Promise<{installed: boolean, command: string}>}
     */
    async checkDependencies(context, dependencies) {
        const { packageManager, projectPackage } = context;
        const hasDependency = (dep) =>
            Boolean(
                projectPackage?.dependencies?.[dep] ||
                projectPackage?.devDependencies?.[dep] ||
                projectPackage?.peerDependencies?.[dep],
            );

        if (dependencies.every(hasDependency)) {
            return { installed: true, command: "" };
        }

        return {
            installed: false,
            command: this.getInstallCommand(packageManager, dependencies),
        };
    }

    getInstallCommand(packageManager, dependencies) {
        const deps = dependencies.join(" ");
        switch (packageManager) {
            case "pnpm": return `pnpm add -D ${deps}`;
            case "yarn": return `yarn add -D ${deps}`;
            case "bun": return `bun add -d ${deps}`;
            default: return `npm install --save-dev ${deps}`;
        }
    }
}

function normalizePath(value) {
    return String(value || "")
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\.\/+/, "")
        .replace(/\/+/g, "/");
}

function matchesIgnorePattern(file, pattern) {
    const normalizedPattern = normalizePath(pattern);
    if (!normalizedPattern) return false;

    if (hasGlob(normalizedPattern)) {
        const target = normalizedPattern.includes("/")
            ? file
            : file.split("/").pop();
        return globToRegExp(normalizedPattern).test(target);
    }

    const directoryPattern = normalizedPattern.endsWith("/")
        ? normalizedPattern.slice(0, -1)
        : normalizedPattern;

    return file === directoryPattern || file.startsWith(`${directoryPattern}/`);
}

function hasGlob(pattern) {
    return /[*?]/.test(pattern);
}

function globToRegExp(pattern) {
    const escaped = pattern
        .split("")
        .map((char) => {
            if (char === "*") return "[^/]*";
            if (char === "?") return "[^/]";
            return char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
        })
        .join("");

    return new RegExp(`^${escaped}$`);
}
