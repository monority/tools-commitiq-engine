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
-  **Fast Performance**: Optimized for staged files to keep your development loop quick.
- **Quality Reports**: Generates a detailed `quality-report.md` upon failure, explaining exactly what went wrong and how to fix it.

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

Run `cqc` or `node cqc` to show interactive menu:

```
╔════════════════════════════════════════╗
║     Commit Quality Check       ║
╠════════════════════════════════╣
║  1) menu     Show this menu     ║
║  2) enable  Enable hook        ║
║  3) disable Disable hook       ║
║  4) status  Show status        ║
║  5) staged  Check staged       ║
║  6) check   Full check         ║
║  7) quit    Exit               ║
╚════════════════════════════════╝
```

Or use direct commands:

| Command | Alias | Description |
| :--- | :--- | :--- |
| `cqc` or `cqc menu` | `1` | Show menu |
| `cqc enable` | `2` | Enable auto-check |
| `cqc disable` | `3` | Disable auto-check |
| `cqc status` | `4` | Show hook status |
| `cqc staged` | `5` | Check staged files |
| `cqc check` | `6` | Full quality check |

##  How It Works

When running `cqc c`, the tool performs the following steps:
1. **Auto-Formatting**: Runs `prettier --write` on compatible staged files.
2. **Auto-Linting**: Runs `eslint --fix` on staged JS/TS files.
3. **Re-staging**: Automatically adds the fixed files back to the Git index.
4. **Quality Suite**: Executes project-specific scripts (tests, type-checks, etc.).
5. **Validation**: Checks the commit message format.

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
    "staged": {
      "prettier": true,
      "eslint": true
    }
  }
}
```

- `scripts`: An array of script names to execute during the check.
- `staged.prettier`: Enable/disable automatic Prettier fixing on staged files.
- `staged.eslint`: Enable/disable automatic ESLint fixing on staged files.

##  Quality Reports

When a check fails or a dependency is missing, a `quality-report.md` is generated in the project root. This report includes:
- **Results Table**: A summary of which checks passed, failed, or were skipped.
- **How to Fix**: Step-by-step instructions for fixing failed quality checks.
- **Setup Suggestions**: Direct installation commands if recommended tools (like ESLint) are not found.

---

## Repository

[https://github.com/monority/commit-quality-check/](https://github.com/monority/commit-quality-check/)