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
    async exec(context, args) {
        const { packageManager, root } = context;
        const { command, args: execArgs } = this.getPackageManagerCommand(
            packageManager,
            args,
        );

        try {
            const result = await execa(command, execArgs, {
                cwd: root,
                stdio: "pipe",
            });
            return { success: true, stdout: result.stdout?.trim() || "", stderr: result.stderr?.trim() || "" };
        } catch (error) {
            return { success: false, stdout: error.stdout?.trim() || "", stderr: error.stderr?.trim() || error.message };
        }
    }

    async getStagedFiles(context) {
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
                .filter(Boolean);
        } catch (error) {
            console.error(`❌ Failed to get staged files: ${error.message}`);
            return [];
        }
    }

    getPackageManagerCommand(packageManager, args) {
        const script = args[0] || "";

        switch (packageManager) {
            case "pnpm":
                return { command: "pnpm", args: ["run", script] };
            case "yarn":
                return { command: "yarn", args: [script] };
            case "bun":
                return { command: "bun", args: ["run", script] };
            default:
                return { command: "npm", args: ["run", script] };
        }
    }

    /**
     * Checks if the required dependencies are installed.
     * @param {ProjectContext} context 
     * @param {string[]} dependencies - List of packages to check.
     * @returns {Promise<{installed: boolean, command: string}>}
     */
    async checkDependencies(context, dependencies) {
        const { packageManager, root } = context;

        for (const dep of dependencies) {
            try {
                // Check if the package is available in node_modules or globally
                await execa("npm", ["list", dep], { cwd: root }, { stdio: 'ignore' });
            } catch (e) {
                const installCmd = this.getInstallCommand(packageManager, dependencies);
                return { installed: false, command: installCmd };
            }
        }
        return { installed: true, command: "" };
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