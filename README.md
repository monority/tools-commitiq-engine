<h1 align="center">
  Commit Quality Check
</h1>

<p align="center">
  <img src="./logo-commit.svg" alt="Commit Quality Check Logo" width="120"/>
</p>

<p align="center">
  <strong>A powerful, zero-config CLI to ensure your commits meet quality standards before they hit the repository.</strong>
</p>

---

##  Overview

`commit-quality-check` (cqc) is a lightweight tool designed to be integrated into your Git workflow (ideally via Husky) to prevent "dirty" commits. It automates linting, formatting, and custom quality checks, ensuring that only high-quality code is committed.

##  Features

- **Zero Configuration**: Auto-detects your package manager (`npm`, `pnpm`, `yarn`, `bun`) and common quality scripts.
- **Smart Dependency Suggestions**: If `eslint` or `prettier` are missing, the tool generates a report with the exact commands needed to install them.
- **Flexible Commit Validation**: Supports both [Conventional Commits](https://www.conventionalcommits.org/) and [Gitmoji](https://gitmoji.dev/) (emoji-shortcodes like `:art:`) to keep your history clean.
- **Secret Scanner**: Detects API keys, tokens, passwords before they get committed.
- **Debug Artifact Scanner**: Catches `console.log` and `debugger` in staged script files.
- **Dependencies Vulnerabilities**: Runs `npm audit` to check for vulnerabilities.
- **Package Validation**: Runs `npm pack --dry-run` in full mode to catch packaging issues early.
- **Fast Performance**: Optimized for staged files to keep your development loop quick.
- **Quality Reports**: Generates a detailed `quality-report.md` upon failure, explaining exactly what went wrong and how to fix it.
- **Two Profiles**: `fast` (default) for staged checks + unit tests, `full` adds build, package validation, and Playwright e2e.

##  Installation

### Quick Start
Install the tool and enable the hook:

```bash
npm install --save-dev commit-quality-check husky
npx cqc enable
```

Or with pnpm:
```bash
pnpm add -D commit-quality-check husky
pnpm exec cqc enable
```

## 🛠 Usage & Commands

Run `npx cqc` to show interactive menu (arrow keys + enter):

```
━━━ COMMIT QUALITY CHECK ━━━

  ▶ Toggle hook ON
    Configure checks
    Run single check
    Status
    Staged check
    Full check
    Quit

↑↓ Select  ENTER Confirm  Q Quit
```

Or use direct commands:

| Command | Alias | Description |
| :--- | :--- | :--- |
| `npx cqc` | - | Interactive menu |
| `npx cqc toggle` | `t` | Toggle pre-commit and commit-msg hooks |
| `npx cqc config` | `g` | Open the checker toggle menu |
| `npx cqc single` | `r` | Pick and run one checker |
| `npx cqc enable` | `e` | Enable auto-check |
| `npx cqc disable` | `d` | Disable auto-check |
| `npx cqc status` | `s` | Show status |
| `npx cqc staged` | `f` | Fast check (staged) |
| `npx cqc check` | `c` | Full check + e2e |
| `npx cqc commit-msg <file>` | - | Validate commit message hook file |

### Using as Git Hook

After enabling, `pre-commit` runs staged checks and `commit-msg` validates commit messages automatically on every `git commit`. To bypass (if needed):
```bash
git commit --no-verify -m "feat: ..."
```

##  How It Works

When running `cqc check`, the tool runs these checkers:

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

Commit message validation runs in the `commit-msg` hook via `npx cqc commit-msg <file>`.

### Auto-detected Scripts
If no custom configuration is provided, `cqc` looks for these scripts in your `package.json` (in order):
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
    "staged": {
      "prettier": true,
      "eslint": true
    }
  }
}
```

- `skip`: An array of checker names to skip (e.g., `"Secret Scanner"`, `"Dependencies Vulnerabilities"`).
- `ignore`: Repo-relative files or folders to ignore during staged-file checks (e.g., `"dist/"`, `"src/generated/"`, `"fixtures/example.js"`, `"*.snap"`).
- `staged.prettier`: Enable/disable automatic Prettier fixing on staged files.
- `staged.eslint`: Enable/disable automatic ESLint fixing on staged files.

The interactive menu can also toggle each checker on or off and save the result back into `gitQuality.skip`.

### Ignoring Secrets

To ignore secrets in specific lines, add a comment:
```js
// cqc-disable secret
const mySecret = "sk-123456"; // won't trigger warning
```

### Ignoring Debug Artifacts

To ignore a `console.log` or `debugger` line intentionally:
```js
// cqc-disable debug
console.log("intentional debug output");
```

##  Quality Reports

When a check fails or a dependency is missing, a `quality-report.md` is generated in the project root. This report includes:
- **Results Table**: A summary of which checks passed, failed, or were skipped.
- **How to Fix**: Step-by-step instructions for fixing failed quality checks.
- **Setup Suggestions**: Direct installation commands if recommended tools (like ESLint) are not found.

---

## Repository

[https://github.com/monority/tools-commit-quality-check](https://github.com/monority/tools-commit-quality-check)
