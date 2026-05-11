const SOURCE_EXTENSIONS = new Set([
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".py",
    ".java",
    ".go",
    ".rb",
    ".rs",
    ".php",
    ".cs",
]);

const DOC_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".rst"]);
const CONFIG_FILENAMES = new Set([
    "package.json",
    "tsconfig.json",
    "jsconfig.json",
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
    "prettier.config.js",
    "prettier.config.mjs",
    "prettier.config.cjs",
    "vite.config.js",
    "vite.config.ts",
    "vitest.config.js",
    "vitest.config.ts",
]);
const DEPENDENCY_FILENAMES = new Set([
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
]);
const LOCKFILE_FILENAMES = new Set([
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
]);
const WORKSPACE_ROOTS = new Set(["packages", "apps", "services"]);

export class DiffAnalyzer {
    analyze(files = [], diffText = "") {
        const normalizedFiles = normalizeFiles(files);
        const diffSummary = summarizeDiff(diffText);
        const allKnownFiles = normalizeFiles([...normalizedFiles, ...diffSummary.deletedFiles]);

        const sourceFiles = normalizedFiles.filter(isSourceFile);
        const testFiles = normalizedFiles.filter(isTestFile);
        const documentationFiles = normalizedFiles.filter(isDocumentationFile);
        const configFiles = normalizedFiles.filter(isConfigFile);
        const ciFiles = normalizedFiles.filter(isCiFile);
        const dependencyFiles = normalizedFiles.filter(isDependencyFile);
        const lockfileFiles = normalizedFiles.filter(isLockfile);
        const envFiles = normalizedFiles.filter(isEnvFile);
        const authFiles = normalizedFiles.filter(isAuthFile);
        const migrationFiles = normalizedFiles.filter(isMigrationFile);

        return {
            files: normalizedFiles,
            sourceFiles,
            testFiles,
            deletedFiles: diffSummary.deletedFiles,
            deletedTestFiles: diffSummary.deletedTestFiles,
            removedTestLines: diffSummary.removedTestLines,
            lineStats: diffSummary.lineStats,
            documentationFiles,
            configFiles,
            ciFiles,
            dependencyFiles,
            lockfileFiles,
            envFiles,
            authFiles,
            migrationFiles,
            topLevelAreas: collectTopLevelAreas(allKnownFiles),
            workspaceScopes: collectWorkspaceScopes(allKnownFiles),
            signals: {
                hasSourceChanges: sourceFiles.length > 0,
                hasTests: testFiles.length > 0,
                hasDocumentation: documentationFiles.length > 0,
                touchesConfig: configFiles.length > 0,
                touchesCI: ciFiles.length > 0,
                touchesDependencies: dependencyFiles.length > 0,
                touchesLockfiles: lockfileFiles.length > 0,
                touchesEnv: envFiles.length > 0,
                touchesAuth: authFiles.length > 0,
                touchesMigrations: migrationFiles.length > 0,
                removesTests: diffSummary.deletedTestFiles.length > 0 || diffSummary.removedTestLines.length > 0,
            },
        };
    }
}

function summarizeDiff(diffText) {
    const deletedFiles = [];
    const removedTestLines = [];
    let addedLines = 0;
    let removedLines = 0;
    let currentOriginalPath = null;
    let currentPath = null;

    for (const rawLine of String(diffText || "").split(/\r?\n/)) {
        const diffMatch = rawLine.match(/^diff --git a\/(.+) b\/(.+)$/);
        if (diffMatch) {
            currentOriginalPath = normalizePath(diffMatch[1]);
            currentPath = normalizePath(diffMatch[2]);
            continue;
        }

        if (rawLine.startsWith("deleted file mode ") && currentOriginalPath) {
            deletedFiles.push(currentOriginalPath);
            continue;
        }

        if (rawLine.startsWith("+++") || rawLine.startsWith("---") || rawLine.startsWith("@@")) {
            continue;
        }

        if (rawLine.startsWith("+") && currentPath) {
            addedLines += 1;
            continue;
        }

        if (rawLine.startsWith("-") && currentPath) {
            removedLines += 1;
            const removedLine = rawLine.slice(1).trim();
            if (isTestFile(currentPath) && isTestLikeCode(removedLine)) {
                removedTestLines.push(removedLine);
            }
        }
    }

    const normalizedDeletedFiles = normalizeFiles(deletedFiles);
    return {
        deletedFiles: normalizedDeletedFiles,
        deletedTestFiles: normalizedDeletedFiles.filter(isTestFile),
        removedTestLines: [...new Set(removedTestLines)],
        lineStats: {
            added: addedLines,
            removed: removedLines,
        },
    };
}

function normalizeFiles(files) {
    return [...new Set(
        files
            .map((file) => String(file || "").trim())
            .filter(Boolean)
            .map(normalizePath),
    )];
}

function normalizePath(file) {
    return String(file || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function getExtension(file) {
    const lastSlash = file.lastIndexOf("/");
    const lastDot = file.lastIndexOf(".");
    return lastDot > lastSlash ? file.slice(lastDot).toLowerCase() : "";
}

function getFilename(file) {
    const segments = file.split("/");
    return segments[segments.length - 1].toLowerCase();
}

function isSourceFile(file) {
    return SOURCE_EXTENSIONS.has(getExtension(file));
}

function isTestFile(file) {
    const normalized = file.toLowerCase();
    const filename = getFilename(normalized);
    return normalized.includes("/__tests__/") ||
        normalized.startsWith("test/") ||
        normalized.startsWith("tests/") ||
        /\.(test|spec)\.[^.]+$/.test(filename);
}

function isDocumentationFile(file) {
    const normalized = file.toLowerCase();
    return DOC_EXTENSIONS.has(getExtension(normalized)) ||
        normalized === "readme" ||
        normalized === "readme.md" ||
        normalized.startsWith("docs/");
}

function isConfigFile(file) {
    const normalized = file.toLowerCase();
    const filename = getFilename(normalized);
    return CONFIG_FILENAMES.has(filename) ||
        filename.startsWith(".") && filename.includes("rc") ||
        normalized.endsWith(".config.js") ||
        normalized.endsWith(".config.ts") ||
        normalized.endsWith(".config.mjs") ||
        normalized.endsWith(".config.cjs");
}

function isCiFile(file) {
    const normalized = file.toLowerCase();
    return normalized.startsWith(".github/workflows/") ||
        normalized.startsWith(".circleci/") ||
        normalized.startsWith("ci/");
}

function isDependencyFile(file) {
    return DEPENDENCY_FILENAMES.has(getFilename(file.toLowerCase()));
}

function isLockfile(file) {
    return LOCKFILE_FILENAMES.has(getFilename(file.toLowerCase()));
}

function isEnvFile(file) {
    return /^\.env(\.|$)/i.test(getFilename(file));
}

function isAuthFile(file) {
    const normalized = file.toLowerCase();
    if (isDocumentationFile(normalized)) {
        return false;
    }

    return normalized.includes("/auth/") ||
        normalized.includes("/authentication/") ||
        normalized.includes("/session/") ||
        /(^|\/)(auth|login|token|session)[^/]*\.[^/]+$/.test(normalized);
}

function isMigrationFile(file) {
    const normalized = file.toLowerCase();
    return normalized.includes("/migration/") ||
        normalized.includes("/migrations/") ||
        normalized.includes("/db/migrate/") ||
        normalized.includes("/database/migrations/");
}

function isTestLikeCode(line) {
    return /\b(describe|it|test|expect|assert)\b/.test(line);
}

function collectTopLevelAreas(files) {
    return [...new Set(files.map((file) => file.split("/")[0]))];
}

function collectWorkspaceScopes(files) {
    return [...new Set(
        files
            .map((file) => file.split("/"))
            .filter((segments) => segments.length > 1 && WORKSPACE_ROOTS.has(segments[0]))
            .map((segments) => segments[1]),
    )];
}