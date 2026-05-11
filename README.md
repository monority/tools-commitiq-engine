<h1 align="center">
  CommitIQ Engine
</h1>

<p align="center">
  <img src="./logo-commit.svg" alt="CommitIQ Engine Logo" width="120"/>
</p>

<p align="center">
  <strong>A premium, diff-aware CLI that polishes each commit before it reaches your repository.</strong>
</p>

---

##  Overview

`commitiq-engine` (`cq`) is a diff-aware Git workflow assistant built to prevent rough, risky, or under-tested commits. It automates linting, formatting, quality checks, commit suggestions, and CI-friendly analysis so each staged change lands cleaner.

##  Features

- **Zero Configuration**: Auto-detects your package manager (`npm`, `pnpm`, `yarn`, `bun`) and common quality scripts.
- **Smart Dependency Suggestions**: If `eslint` or `prettier` are missing, the tool generates a report with the exact commands needed to install them.
- **Flexible Commit Validation**: Supports both [Conventional Commits](https://www.conventionalcommits.org/) and [Gitmoji](https://gitmoji.dev/) (emoji-shortcodes like `:art:`) to keep your history clean.
- **Secret Scanner**: Detects API keys, tokens, passwords before they get committed.
- **Debug Artifact Scanner**: Catches `console.log` and `debugger` in staged script files.
- **Dependencies Vulnerabilities**: Runs `npm audit` to check for vulnerabilities.
- **Package Validation**: Runs `npm pack --dry-run` in full mode to catch packaging issues early.
- **Diff-aware Risk Signals**: Detects removed tests from staged diff content, not only file names.
- **Fast Performance**: Optimized for staged files to keep your development loop quick.
- **Quality Reports**: Generates a detailed `quality-report.md` upon failure, explaining exactly what went wrong and how to fix it.
- **Two Profiles**: `fast` (default) for staged checks + unit tests, `full` adds build, package validation, and Playwright e2e.

##  Installation

### Quick Start
Install the tool and enable the hook:

```bash
npm install --save-dev commitiq-engine husky
npx cq enable
```

Or with pnpm:
```bash
pnpm add -D commitiq-engine husky
pnpm exec cq enable
```

## 🛠 Usage & Commands

Run `npx cq` to show interactive menu (arrow keys + enter):

```
━━━ COMMITIQ ENGINE ━━━

  ▶ Toggle hook ON
    Toggle auto-push OFF
    Configure checks
    Run single check
    Status
    Suggest commit
    Commit
    Staged check
    Full check
    Quit

↑↓ Select  ENTER Confirm  Q Quit
```

Or use direct commands:

| Command | Alias | Description |
| :--- | :--- | :--- |
| `npx cq` | - | Interactive menu |
| `npx cq toggle` | `t` | Toggle pre-commit and commit-msg hooks |
| `npx cq auto-push` | `p` | Toggle optional post-commit auto-push |
| `npx cq config` | `g` | Open the checker toggle menu |
| `npx cq single` | `r` | Pick and run one checker |
| `npx cq enable` | `e` | Enable auto-check |
| `npx cq disable` | `d` | Disable auto-check |
| `npx cq status` | `s` | Show status |
| `npx cq suggest` | `u` | Show suggested commit header from staged changes |
| `npx cq json` | `j` | Print staged analysis, score, and suggestion as JSON |
| `npx cq json-check [--full]` | - | Run fast or full checks and print JSON payload with checker results, duration, and optional report path for CI |
| `npx cq commit` | - | Create git commit from suggested header; in TTY you can accept or edit message |
| `npx cq staged` | `f` | Fast check (staged) |
| `npx cq check` | `c` | Full check + e2e |
| `npx cq commit-msg <file>` | - | Validate commit message hook file |

### Using as Git Hook

After enabling, `pre-commit` runs staged checks and `commit-msg` validates commit messages automatically on every `git commit`. To bypass (if needed):
```bash
git commit --no-verify -m "feat: ..."
```

### Why Hook Status Can Be BROKEN

`npx cq status` shows `BROKEN` when CQ finds hook files, but the Git hook setup is incomplete or not managed by CQ.

CQ expects all of these to be true:
- `.husky/pre-commit` contains `npm exec -- cq staged`
- `.husky/commit-msg` contains `npm exec -- cq commit-msg "$1"`
- `git config core.hooksPath` points to `.husky`

Common causes:
- hooks were created by an older CQ/CQC version
- `.husky/pre-commit` or `.husky/commit-msg` was edited manually
- Husky exists, but Git still points to another hooks directory
- only one of the two CQ hooks exists
- another tool owns the same hook file

Check the setup:

```bash
npx cq status
git config --get core.hooksPath
cat .husky/pre-commit
cat .husky/commit-msg
```

Repair the CQ hooks:

```bash
npx cq enable
```

If you intentionally use custom hooks, keep the CQ commands inside them instead of replacing them.

##  How It Works

When running `cq check`, the tool runs these checkers:

1. **Linting (ESLint)**: Runs `eslint --fix` on staged JS/TS files.
2. **Formatting (Prettier)**: Runs `prettier --write` on staged files.
3. **Secret Scanner**: Scans for API keys, tokens, passwords.
4. **Debug Artifacts**: Scans staged JS/TS files for `console.log` and `debugger`.
5. **Type Check**: Runs `typecheck`, `check-types`, or `types` if present.
6. **Dependencies Vulnerabilities**: Runs `npm audit` to check vulnerabilities.
7. **Test Suite**: Runs your test script (jest, vitest, etc.).
8. **Build** (full profile only): Runs `build` or `compile` if present.
9. **NPM Pack** (full profile only): Runs `npm pack --dry-run`.
10. **Playwright Tests** (full profile only): Runs e2e tests.

Commit message validation runs in the `commit-msg` hook via `npx cq commit-msg <file>`.

### Auto-detected Scripts
If no custom configuration is provided, `cq` looks for these scripts in your `package.json` (in order):
- `lint`
- `typecheck` | `check-types` | `types`
- `test:unit` | `unit`
- `test` | `test:ci`
- `build` | `compile`
- `test:e2e` | `e2e` | `playwright` | `test:playwright`

##  Configuration

You can override the auto-detection by adding a `gitQuality` object to your `package.json`:

```json
{
  "gitQuality": {
    "skip": ["Secret Scanner", "Dependencies Vulnerabilities"],
    "ignore": ["dist/", "src/generated/", "fixtures/example.js"],
    "autoPush": false,
    "risk": {
      "failOn": "HIGH"
    },
    "staged": {
      "prettier": true,
      "eslint": true
    }
  }
}
```

- `skip`: An array of checker names to skip (e.g., `"Secret Scanner"`, `"Dependencies Vulnerabilities"`).
- `ignore`: Repo-relative files or folders to ignore during staged-file checks (e.g., `"dist/"`, `"src/generated/"`, `"fixtures/example.js"`, `"*.snap"`).
- `autoPush`: When `true`, creates an optional `post-commit` hook that runs full checks and `git push` after a successful commit. Defaults to `false`.
- `risk.failOn`: Optional risk gate threshold. Use `"LOW"`, `"MEDIUM"`, or `"HIGH"` to fail when computed commit risk reaches that level. Default is advisory-only.
- `staged.prettier`: Enable/disable automatic Prettier fixing on staged files.
- `staged.eslint`: Enable/disable automatic ESLint fixing on staged files.

Risk analysis is now diff-aware for test removals. Deleting test files or removing `describe` / `it` / `test` / `expect` lines from staged hunks raises commit risk even when staged file names alone would not show it.

The interactive menu can also toggle each checker on or off and save the result back into `gitQuality.skip`.

### Ignoring Secrets

To ignore secrets in specific lines, add a comment:
```js
// cq-disable secret
const mySecret = "sk-123456"; // won't trigger warning
```

### Ignoring Debug Artifacts

To ignore a `console.log` or `debugger` line intentionally:
```js
// cq-disable debug
console.log("intentional debug output");
```

##  Quality Reports

When a check fails or a dependency is missing, a `quality-report.md` is generated in the project root. This report includes:
- **Results Table**: A summary of which checks passed, failed, or were skipped.
- **Diff Analysis**: Staged file counts, line stats, changed areas, and removed-test signals.
- **How to Fix**: Step-by-step instructions for fixing failed quality checks.
- **Setup Suggestions**: Direct installation commands if recommended tools (like ESLint) are not found.

---

## Repository

[https://github.com/monority/commitiq-engine](https://github.com/monority/commitiq-engine)
