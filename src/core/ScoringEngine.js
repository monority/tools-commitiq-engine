function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function round(value) {
    return Math.round(value);
}

function inferProbableType(analysis) {
    const {
        signals,
        sourceFiles,
        documentationFiles,
        testFiles,
        deletedTestFiles = [],
        ciFiles,
        dependencyFiles,
    } = analysis;

    if (documentationFiles.length > 0 && sourceFiles.length === 0 && testFiles.length === 0) {
        return "docs";
    }

    if (ciFiles.length > 0 && sourceFiles.length === 0) {
        return "ci";
    }

    if (dependencyFiles.length > 0 && sourceFiles.length === 0) {
        return "chore";
    }

    if ((testFiles.length > 0 || deletedTestFiles.length > 0) && sourceFiles.every((file) => analysis.testFiles.includes(file))) {
        return "test";
    }

    if (signals.hasSourceChanges) {
        return "feat";
    }

    return "chore";
}

function inferProbableScope(analysis) {
    if (analysis.workspaceScopes.length === 1) {
        return analysis.workspaceScopes[0];
    }

    const sourceFile = analysis.sourceFiles.find((file) => file.startsWith("src/"));
    if (sourceFile) {
        const segments = sourceFile.split("/");
        if (segments.length > 2) {
            return segments[1];
        }
    }

    const topLevel = analysis.topLevelAreas.find((area) => area && !area.startsWith("."));
    return topLevel || "repo";
}

export class ScoringEngine {
    score(analysis) {
        const reasons = [];
        const scopeCount = Math.max(analysis.workspaceScopes.length, analysis.topLevelAreas.length);

        let atomicity = 100 - Math.max(0, scopeCount - 1) * 12;
        if (analysis.signals.touchesCI && analysis.signals.hasSourceChanges) {
            atomicity -= 15;
            reasons.push("CI and source changes mixed in one commit");
        }
        if (analysis.signals.touchesDependencies && analysis.signals.hasSourceChanges) {
            atomicity -= 10;
            reasons.push("Dependency updates mixed with source changes");
        }
        if (analysis.signals.touchesMigrations && analysis.signals.hasSourceChanges) {
            atomicity -= 10;
            reasons.push("Migration changes mixed with source changes");
        }
        if (analysis.signals.removesTests && analysis.signals.hasSourceChanges) {
            atomicity -= 10;
            reasons.push("Test removals mixed with source changes");
        }
        atomicity = clamp(round(atomicity), 25, 100);

        let scopePrecision = analysis.workspaceScopes.length === 1
            ? 95
            : 90 - Math.max(0, analysis.topLevelAreas.length - 1) * 10;
        scopePrecision = clamp(round(scopePrecision), 30, 95);

        let testCoverage = 100;
        let testsStatus = "NOT_NEEDED";
        if (analysis.signals.hasSourceChanges) {
            if (analysis.signals.hasTests) {
                testCoverage = 95;
                testsStatus = "PRESENT";
            } else {
                testCoverage = 35;
                testsStatus = "MISSING";
                reasons.push("Source changes detected without staged tests");
            }
        }
        if (analysis.signals.removesTests) {
            testCoverage = Math.min(testCoverage, analysis.signals.hasSourceChanges ? 40 : 60);
            testsStatus = "REDUCED";
            reasons.push("Removed tests detected in staged diff");
        }

        let riskScore = 0;
        if (analysis.signals.touchesEnv) {
            riskScore += 40;
            reasons.push("Environment file changes detected");
        }
        if (analysis.signals.touchesCI) {
            riskScore += 25;
            reasons.push("CI configuration changes detected");
        }
        if (analysis.signals.touchesAuth) {
            riskScore += 25;
            reasons.push("Auth-sensitive changes detected");
        }
        if (analysis.signals.touchesMigrations) {
            riskScore += 25;
            reasons.push("Migration changes detected");
        }
        if (analysis.signals.touchesDependencies) {
            riskScore += 20;
        }
        if (analysis.signals.touchesLockfiles) {
            riskScore += 10;
            reasons.push("Lockfile changes detected");
        }
        if (analysis.signals.touchesConfig) {
            riskScore += 15;
        }
        if (analysis.signals.removesTests) {
            riskScore += 30;
        }
        if (analysis.signals.hasSourceChanges && !analysis.signals.hasTests) {
            riskScore += 20;
        }
        riskScore = clamp(round(riskScore), 0, 100);

        const riskLevel = riskScore >= 75 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW";
        const globalScore = clamp(round((atomicity + scopePrecision + testCoverage + (100 - riskScore)) / 4), 0, 100);

        return {
            probableType: inferProbableType(analysis),
            probableScope: inferProbableScope(analysis),
            atomicity,
            scopePrecision,
            testCoverage,
            testsStatus,
            riskScore,
            riskLevel,
            globalScore,
            reasons: [...new Set(reasons)],
        };
    }
}