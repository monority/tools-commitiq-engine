import { QualityEngine } from "./core/Engine.js";
import { LintChecker } from "./checkers/LintChecker.js";
import { FormatChecker } from "./checkers/FormatChecker.js";
import { CommitMsgChecker } from "./checkers/CommitMsgChecker.js";
import { SecurityChecker } from "./checkers/SecurityChecker.js";
import { TestChecker } from "./checkers/TestChecker.js";
import { PlaywrightChecker } from "./checkers/PlaywrightChecker.js";
import { SecretChecker } from "./checkers/SecretChecker.js";
import { TypecheckChecker } from "./checkers/TypecheckChecker.js";
import { BuildChecker } from "./checkers/BuildChecker.js";
import { DebugArtifactsChecker } from "./checkers/DebugArtifactsChecker.js";
import { NpmPackChecker } from "./checkers/NpmPackChecker.js";

export function createQualityEngine(options = {}) {
  const engine = new QualityEngine(options);

  engine.registerChecker(new LintChecker());
  engine.registerChecker(new FormatChecker());
  engine.registerChecker(new CommitMsgChecker());
  engine.registerChecker(new SecretChecker());
  engine.registerChecker(new DebugArtifactsChecker());
  engine.registerChecker(new SecurityChecker());
  engine.registerChecker(new TypecheckChecker());
  engine.registerChecker(new TestChecker());
  engine.registerChecker(new BuildChecker());
  engine.registerChecker(new NpmPackChecker());
  engine.registerChecker(new PlaywrightChecker());

  return engine;
}

export { QualityEngine };
