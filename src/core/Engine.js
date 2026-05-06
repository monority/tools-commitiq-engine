import { join } from "node:path";
import { ProjectContext } from "./ProjectContext.js";
import { CheckRegistry } from "./CheckRegistry.js";
import { TaskRunner } from "./TaskRunner.js";
import { Reporter } from "./Reporter.js";

export class QualityEngine {
  constructor(options = {}) {
    this.options = options;
    this.registry = new CheckRegistry();
    this.runner = new TaskRunner();
    this.reporter = new Reporter();
  }

  registerChecker(checker) {
    this.registry.register(checker);
    return this;
  }

  async run(profile = "fast") {
    console.log(`🚀 Running Quality Check [Profile: ${profile}]`);

    try {
      const context = await ProjectContext.create(this.options);
      context.profile = profile;

      // Auto-discover checkers from the tool's checkers directory
      const checkersDir = join(process.cwd(), "src/checkers");
      await this.registry.discover(checkersDir);

      const checkers = this.registry.getCheckersForProfile(profile, context.config.skip);

      console.log(`🔍 Executing ${checkers.length} checks...`);
      const results = await this.runner.execute(checkers, context);

      results.forEach(r => {
        if (!r.success) {
          console.error(`❌ ${r.name} failed: ${r.message}`);
          if (r.suggestedFix) {
            console.error(`💡 Fix: ${r.suggestedFix}`);
          }
        }
      });

      const allSuccess = results.every((r) => r.success);
      if (allSuccess) {
        console.log("✅ All checks passed!");
      } else {
        console.error("🚨 Some checks failed. Please fix the issues before committing.");
        if (this.options.generateReport) {
          const reportPath = await this.reporter.generateReport(results);
          console.log(`📄 Report generated: ${reportPath}`);
        }
      }

      return { allSuccess, results };
    } catch (error) {
      console.error(`❌ Execution failed: ${error.message}`);
      return { allSuccess: false, results: [] };
    }
  }


}
