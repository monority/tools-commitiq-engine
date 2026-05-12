# Changelog

## 3.0.3 - 2026-05-12

### Changed

- Improved npm discoverability metadata with stronger search-oriented description and keywords such as `git-hooks`, `commit-msg`, `staged-files`, and `conventional-commits`.
- README overview and features now describe CommitIQ Engine as a pre-commit, commit-msg, and Husky-oriented git-hook CLI.

### Validation

- `npm install --package-lock-only`
- `npm pack --dry-run`
- `npm test`

## 3.0.1 - 2026-05-12

### Fixed

- Restored backward-compatible `cqc` npm alias so stale local shims and older hook setups do not break after rename to `cq`.
- Status logic now accepts Husky-managed `core.hooksPath` values `.husky` and `.husky/_`.
- Package metadata and README repository links now point to canonical GitHub repository `monority/tools-commitiq-engine`.

### Validation

- `npm exec -- cq status`
- `npm exec -- cqc status`
- `npm pack --dry-run`
- `npm test`

## 3.0.0 - 2026-05-11

### Breaking

- npm package renamed from `commit-polish` to `commitiq-engine`.
- Primary CLI command changed from `cqc` to `cq`.
- GitHub repository target renamed from `monority/commit-polish` to `monority/commitiq-engine`.

### Changed

- Public branding now uses CommitIQ Engine across package metadata, docs, reports, and scaffold output.
- Generated Husky hooks now call `cq` commands.
- Ignore annotations are now documented as `cq-disable`, while runtime remains backward-compatible with existing `cqc-disable` comments.

### Validation

- `node --test ./test/BuildOutput.test.js ./test/CliHooks.test.js`
- `npm install --package-lock-only`
- `npm test`

## 2.0.0 - 2026-05-11

### Breaking

- npm package renamed from `commit-quality-check` to `commit-polish`.
- GitHub repository target renamed from `monority/tools-commit-quality-check` to `monority/commit-polish`.

### Added

- Interactive `cqc commit` flow for TTY sessions: accept suggestion, edit message, or cancel.
- `cqc json`, `cqc json-check`, and `cqc json-check --full` for CI and machine-readable consumers.
- Diff-aware staged analysis for deleted test files and removed test lines.
- Richer `quality-report.md` with suggested commit, score summary, diff analysis, and fix guidance.

### Changed

- Release metadata now reflects premium Commit Polish branding while keeping `cqc` CLI stable.
- Risk scoring now penalizes test removals and exposes them in report, JSON, and suggestion flows.
- README and implementation summary aligned with final runtime behavior and release identity.

### Validation

- `node --test ./test/CliHooks.test.js`
- `node --test ./test/Reporter.test.js ./test/Engine.test.js`
- `npm test`