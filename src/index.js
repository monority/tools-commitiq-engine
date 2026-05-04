import { QualityEngine } from "./core/Engine.js";
import { LintChecker } from "./checkers/LintChecker.js";
import { FormatChecker } from "./checkers/FormatChecker.js";
import { CommitMsgChecker } from "./checkers/CommitMsgChecker.js";
import { SecurityChecker } from "./checkers/SecurityChecker.js";
import { TestChecker } from "./checkers/TestChecker.js";

export function createQualityEngine(options = {}) {
  const engine = new QualityEngine(options);

  engine.registerChecker(new LintChecker());
  engine.registerChecker(new FormatChecker());
  engine.registerChecker(new CommitMsgChecker());
  engine.registerChecker(new SecurityChecker());
  engine.registerChecker(new TestChecker());

  return engine;
}

export { QualityEngine };
