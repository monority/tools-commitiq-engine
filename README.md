<h1 align="center">
Commit quality check
</h1>


<p align="center">
  <img src="./logo-convert.webp" />
</p>

Small CLI to keep commits clean before `git commit`.

## Quick install

```bash
pnpm add -D commit-quality-check husky prettier eslint
pnpm exec cqc i
```

One-liner for a `pnpm` project:

```bash
pnpm add -D commit-quality-check husky prettier eslint && pnpm exec cqc i
```

## Short commands

```text
cqc i  -> init
cqc s  -> staged
cqc c  -> check
```

The long commands still work too:

```bash
pnpm exec cqc init
pnpm exec cqc staged
pnpm exec cqc check
```

## What the hook does

`cqc c`:

1. runs `prettier --write` on compatible staged files
2. runs `eslint --fix` on staged JS and TS files
3. re-stages updated files
4. runs project quality scripts when they exist

## Auto-detected scripts

Without any config, `cqc c` looks for these scripts in this order:

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
pnpm exec cqc c
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
pnpm exec cqc i
pnpm exec cqc s
pnpm exec cqc c
```

## Notes

- `prettier` and `eslint` are skipped if they are not installed in the target project. If a quality report is generated, it will provide the exact command to install them.
- The package manager is auto-detected (`pnpm`, `npm`, `yarn`, `bun`).
- If `gitQuality.scripts` is empty, common quality scripts are auto-detected.
- Older `git-quality` references have been replaced by `commit-quality-check` and `cqc`.


## Repo

[https://github.com/monority/commit-quality-check/]