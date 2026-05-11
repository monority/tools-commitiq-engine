export function normalizeGitQualityConfig(config = {}) {
    return {
        staged: {
            prettier: config.staged?.prettier ?? true,
            eslint: config.staged?.eslint ?? true,
        },
        skip: Array.isArray(config.skip) ? config.skip : [],
        ignore: Array.isArray(config.ignore) ? config.ignore : [],
        autoPush: config.autoPush === true,
        risk: {
            failOn: normalizeRiskFailOn(config.risk?.failOn),
        },
    };
}

function normalizeRiskFailOn(value) {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim().toUpperCase();
    return ["LOW", "MEDIUM", "HIGH"].includes(normalized) ? normalized : null;
}