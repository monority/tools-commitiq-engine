# commit-quality-check

Small CLI to keep commits clean before `git commit`.

## Quick install

```bash
pnpm add -D commit-quality-check husky prettier eslint
pnpm exec git-quality init
```

One-liner for a `pnpm` project:

```bash
pnpm add -D commit-quality-check husky prettier eslint && pnpm exec git-quality init
```

## What the hook does

`git-quality check`:

1. runs `prettier --write` on compatible staged files
2. runs `eslint --fix` on staged JS and TS files
3. re-stages updated files
4. runs project quality scripts when they exist

## Auto-detected scripts

Without any config, `git-quality check` looks for these scripts in this order:

```text
lint
typecheck | check-types | types
test:unit | unit
test | test:ci
test:e2e | e2e | playwright | test:playwright
```

Example:

```json
{
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "playwright": "playwright test"
  }
}
```

Then a single command runs everything that exists:

```bash
pnpm exec git-quality check
```

## Optional config

Add `gitQuality` in the consumer project's `package.json` if you want to force an exact script list:

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

## Commands

```bash
pnpm exec git-quality init
pnpm exec git-quality staged
pnpm exec git-quality check
```

## Notes

- `prettier` and `eslint` are skipped if they are not installed in the target project.
- The package manager is auto-detected (`pnpm`, `npm`, `yarn`, `bun`).
- If `gitQuality.scripts` is empty, common quality scripts are auto-detected.
- The package name is `commit-quality-check`.
