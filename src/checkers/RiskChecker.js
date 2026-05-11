import { BaseChecker } from "../core/BaseChecker.js";

const RISK_LEVEL_ORDER = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
};

export class RiskChecker extends BaseChecker {
    constructor() {
        super("Risk Analysis");
        this.profile = "fast";
    }

    async run(context) {
        const summary = context.scoreSummary;
        if (!summary) {
            return { success: true, message: "Risk summary unavailable" };
        }

        const failOn = normalizeFailOn(context.config?.risk?.failOn);
        const message = `Risk ${summary.riskLevel} (${summary.riskScore}/100)`;

        if (!failOn || !shouldFail(summary.riskLevel, failOn)) {
            return {
                success: true,
                message,
                details: buildDetails(summary),
            };
        }

        return {
            success: false,
            message: `${message} exceeds configured threshold ${failOn}`,
            suggestedFix: "Split risky changes, add tests, or relax gitQuality.risk.failOn",
            details: buildDetails(summary),
        };
    }
}

function normalizeFailOn(value) {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim().toUpperCase();
    return RISK_LEVEL_ORDER[normalized] ? normalized : null;
}

function shouldFail(actualLevel, threshold) {
    return RISK_LEVEL_ORDER[actualLevel] >= RISK_LEVEL_ORDER[threshold];
}

function buildDetails(summary) {
    if (!summary.reasons?.length) {
        return "No additional risk reasons.";
    }

    return summary.reasons.map((reason) => `- ${reason}`).join("\n");
}