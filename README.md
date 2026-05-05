<h1 align="center">
  Commit Quality Check
</h1>

<p align="center">
  <img src="./logo-commit.webp" alt="Commit Quality Check Logo" width="120"/>
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
- **Dependencies Vulnerabilities**: Runs `npm audit` to check for vulnerabilities.
- **Fast Performance**: Optimized for staged files to keep your development loop quick.
- **Quality Reports**: Generates a detailed `quality-report.md` upon failure, explaining exactly what went wrong and how to fix it.
- **Two Profiles**: `fast` (default) for quick checks, `full` for tests + playwright e2e.

##  Installation

### Quick Start (pnpm)
Install the tool along with the recommended base dependencies:

```bash
pnpm add -D commit-quality-check husky prettier eslint
pnpm exec cqc i
```

### One-liner for pnpm projects
```bash
pnpm add -D commit-quality-check husky prettier eslint && pnpm exec cqc i
```

## 🛠 Usage & Commands

Run `node cqc` (or just `cqc` if installed) to show interactive menu:

```
╔════════════════════════════════════════╗
║     Commit Quality Check       ║
╠════════════════════════════════╣
║  1) enable  Enable hook        ║
║  2) disable Disable hook       ║
║  3) status  Show status        ║
║  4) staged  Check staged       ║
║  5) check   Full check (+e2e)  ║
║  6) quit    Exit               ║
╚════════════════════════════════╝
```

Or use direct commands:

| Command | Alias | Description |
| :--- | :--- | :--- |
| `node cqc` | - | Interactive menu |
| `node cqc enable` | `e` or `2` | Enable auto-check |
| `node cqc disable` | `d` or `3` | Disable auto-check |
| `node cqc status` | `st` or `4` | Show hook status |
| `node cqc staged` | `s` or `5` | Fast check (staged files) |
| `node cqc check` | `c` or `6` | Full check + playwright |
| `node cqc check --full` | - | Same as check |

### Using as Git Hook

After enabling, the hook runs automatically on every `git commit`. To bypass (if needed):
```bash
git commit --no-verify -m "feat: ..."
```

##  How It Works

When running `cqc check`, the tool runs these checkers:

1. **Linting (ESLint)**: Runs `eslint --fix` on staged JS/TS files.
2. **Formatting (Prettier)**: Runs `prettier --write` on staged files.
3. **Commit Message**: Validates format (Conventional or Gitmoji).
4. **Secret Scanner**: Scans for API keys, tokens, passwords.
5. **Dependencies Vulnerabilities**: Runs `npm audit` to check vulnerabilities.
6. **Test Suite**: Runs your test script (jest, vitest, etc.).
7. **Playwright Tests** (full profile only): Runs e2e tests.

### Auto-detected Scripts
If no custom configuration is provided, `cqc` looks for these scripts in your `package.json` (in order):
- `lint`
- `typecheck` | `check-types` | `types`
- `test:unit` | `unit`
- `test` | `test:ci`
- `test:e2e` | `e2e` | `playwright` | `test:playwright`

##  Configuration

You can override the auto-detection by adding a `gitQuality` object to your `package.json`:

```json
{
  "gitQuality": {
    "scripts": ["lint", "typecheck", "playwright"],
    "skip": ["Secret Scanner", "Dependencies Vulnerabilities"],
    "staged": {
      "prettier": true,
      "eslint": true
    }
  }
}
```

- `scripts`: An array of script names to execute during the check.
- `skip`: An array of checker names to skip (e.g., `"Secret Scanner"`, `"Dependencies Vulnerabilities"`).
- `staged.prettier`: Enable/disable automatic Prettier fixing on staged files.
- `staged.eslint`: Enable/disable automatic ESLint fixing on staged files.

### Ignoring Secrets

To ignore secrets in specific lines, add a comment:
```js
// cqc-disable secret
const mySecret = "sk-123456"; // won't trigger warning
```

##  Quality Reports

When a check fails or a dependency is missing, a `quality-report.md` is generated in the project root. This report includes:
- **Results Table**: A summary of which checks passed, failed, or were skipped.
- **How to Fix**: Step-by-step instructions for fixing failed quality checks.
- **Setup Suggestions**: Direct installation commands if recommended tools (like ESLint) are not found.

---

## Repository

[https://github.com/monority/tools-commit-quality-check](https://github.com/monority/tools-commit-quality-check)