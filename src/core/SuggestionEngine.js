function buildDescription(analysis, scoreSummary, scope) {
  if (analysis.signals.hasDocumentation && !analysis.signals.hasSourceChanges) {
    return "update documentation";
  }

  if (analysis.signals.touchesCI && !analysis.signals.hasSourceChanges) {
    return "update ci workflow";
  }

  if (analysis.signals.touchesMigrations) {
    return "add database migration";
  }

  if (analysis.signals.touchesAuth && analysis.signals.hasSourceChanges) {
    return "update auth flow";
  }

  if (analysis.signals.touchesEnv) {
    return "update environment configuration";
  }

  if (analysis.signals.touchesDependencies && !analysis.signals.hasSourceChanges) {
    return "update dependencies";
  }

  if (analysis.signals.removesTests && !analysis.signals.hasSourceChanges) {
    return "update test coverage";
  }

  if (analysis.testFiles.length > 0 && !analysis.signals.hasSourceChanges) {
    return "add test coverage";
  }

  if (scope && scope !== "repo") {
    return `update ${scope}`;
  }

  if (scoreSummary?.probableType === "docs") {
    return "update documentation";
  }

  if (!analysis || analysis.files.length === 0) {
    return "update project files";
  }

  return "update project files";
}

function buildRationale(analysis, scoreSummary) {
  if (scoreSummary?.reasons?.length) {
    return scoreSummary.reasons.slice(0, 3);
  }

  const reasons = [];
  if (analysis?.signals?.touchesAuth) reasons.push("Auth-sensitive changes detected");
  if (analysis?.signals?.touchesMigrations) reasons.push("Migration changes detected");
  if (analysis?.signals?.touchesCI) reasons.push("CI configuration changes detected");
  if (analysis?.signals?.touchesDependencies) reasons.push("Dependency changes detected");
  return reasons;
}

export class SuggestionEngine {
  suggest(analysis, scoreSummary) {
    const type = scoreSummary?.probableType || "chore";
    const scope = scoreSummary?.probableScope || "repo";
    const description = buildDescription(analysis, scoreSummary, scope);
    const suggestedHeader = scope && scope !== "repo"
      ? `${type}(${scope}): ${description}`
      : `${type}: ${description}`;

    return {
      type,
      scope,
      description,
      suggestedHeader,
      rationale: buildRationale(analysis, scoreSummary),
    };
  }
}