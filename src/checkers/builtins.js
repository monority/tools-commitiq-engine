import { LintChecker } from "./LintChecker.js";
import { FormatChecker } from "./FormatChecker.js";
import { CommitMsgChecker } from "./CommitMsgChecker.js";
import { SecurityChecker } from "./SecurityChecker.js";
import { TestChecker } from "./TestChecker.js";
import { PlaywrightChecker } from "./PlaywrightChecker.js";
import { SecretChecker } from "./SecretChecker.js";
import { TypecheckChecker } from "./TypecheckChecker.js";
import { BuildChecker } from "./BuildChecker.js";
import { DebugArtifactsChecker } from "./DebugArtifactsChecker.js";
import { NpmPackChecker } from "./NpmPackChecker.js";
import { RiskChecker } from "./RiskChecker.js";

export function createBuiltinCheckers() {
    return [
        new LintChecker(),
        new FormatChecker(),
        new CommitMsgChecker(),
        new SecretChecker(),
        new DebugArtifactsChecker(),
        new SecurityChecker(),
        new RiskChecker(),
        new TypecheckChecker(),
        new TestChecker(),
        new BuildChecker(),
        new NpmPackChecker(),
        new PlaywrightChecker(),
    ];
}

export function createBuiltinPlugin() {
    return {
        name: "builtin-checkers",
        checkers: createBuiltinCheckers,
    };
}

export function registerBuiltinCheckers(engine) {
    return engine.use(createBuiltinPlugin());
}