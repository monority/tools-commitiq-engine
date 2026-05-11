import { QualityEngine } from "./core/Engine.js";
import { registerBuiltinCheckers } from "./checkers/builtins.js";

export function createQualityEngine(options = {}) {
  const engine = new QualityEngine(options);

  return registerBuiltinCheckers(engine);
}

export { QualityEngine };
