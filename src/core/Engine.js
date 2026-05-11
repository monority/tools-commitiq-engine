import { ProjectContext } from "./ProjectContext.js";
import { CheckRegistry } from "./CheckRegistry.js";
import { TaskRunner } from "./TaskRunner.js";
import { Reporter } from "./Reporter.js";
import { registerBuiltinCheckers } from "../checkers/builtins.js";

export class QualityEngine {
  constructor(options = {}) {
    this.options = options;
    this.registry = new CheckRegistry();
    this.runner = new TaskRunner();
    this.reporter = new Reporter();
  }

  log(message) {
    if (!this.options.quiet) {
      console.log(message);
    }
  }

  error(message) {
    if (!this.options.quiet) {
      console.error(message);
    }
  }

  registerChecker(checker) {
    this.registry.register(checker);
    return this;
  }

  use(plugin) {
    this.registry.registerPlugin(plugin);
    return this;
  }

  async loadCheckers() {
    if (this.registry.allCheckers.length > 0) {
      return this;
    }

    return registerBuiltinCheckers(this);
  }

  async run(profile = "fast") {
    this.log(`🚀 Running Quality Check [Profile: ${profile}]`);

    try {
      let reportPath = null;
      const context = await ProjectContext.create(this.options);
      context.profile = profile;

      await this.loadCheckers();

      const onlyCheckNames = this.options.onlyCheckNames || [];
      const skipList = onlyCheckNames.length > 0 ? [] : context.config.skip;
      const checkers = this.registry.getCheckersForProfile(profile, skipList, onlyCheckNames);

      this.log(`🔍 Executing ${checkers.length} checks...`);
      const results = await this.runner.execute(checkers, context);

      results.forEach(r => {
        if (!r.success) {
          this.error(`❌ ${r.name} failed: ${r.message}`);
          if (r.suggestedFix) {
            this.error(`💡 Fix: ${r.suggestedFix}`);
          }
        }
      });

      const allSuccess = results.every((r) => r.success);
      if (allSuccess) {
        this.log("✅ All checks passed!");
      } else {
        this.error("🚨 Some checks failed. Please fix the issues before committing.");
        if (this.options.generateReport) {
          reportPath = await this.reporter.generateReport(results, {
            root: context.root,
            analysis: context.analysis,
            scoreSummary: context.scoreSummary,
            suggestionSummary: context.suggestionSummary,
          });
          this.log(`📄 Report generated: ${reportPath}`);
        }
      }

      return {
        allSuccess,
        results,
        analysis: context.analysis,
        scoreSummary: context.scoreSummary,
        suggestionSummary: context.suggestionSummary,
        reportPath,
      };
    } catch (error) {
      this.error(`❌ Execution failed: ${error.message}`);
      return {
        allSuccess: false,
        results: [],
        analysis: null,
        scoreSummary: null,
        suggestionSummary: null,
        reportPath: null,
      };
    }
  }


}
