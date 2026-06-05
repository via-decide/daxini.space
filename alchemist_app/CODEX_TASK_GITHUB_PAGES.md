# GitHub Pages JSON Serving Fix

Added `.nojekyll` at repository root to disable Jekyll processing so static JSON assets (including `MASTER_VAULT.json`) are served directly by GitHub Pages.

## Why
GitHub Pages with Jekyll can block or alter expected static asset behavior. Disabling Jekyll ensures `loadVault()` can fetch `./MASTER_VAULT.json` successfully.

## Scope
- Added empty `.nojekyll` file at repo root.
- No runtime code changes.
- Fully reversible by removing `.nojekyll`.
