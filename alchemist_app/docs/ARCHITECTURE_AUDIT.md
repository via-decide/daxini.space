# Alchemist Architecture Audit

Date: 2026-06-04

## Status labels

- **ACTIVE** — shipped or directly used by the browser-first app.
- **PARTIAL** — useful code exists, but integration or production requirements are incomplete.
- **DISCONNECTED** — code exists but is not currently reachable from the shipped app.
- **SCAFFOLDING** — placeholder or adapter code that needs deployment-specific backing services.
- **DEPRECATED** — retained for reference only; do not extend without a decision.

## Repository reality map

| Area | Status | Notes |
| --- | --- | --- |
| `index.html` | ACTIVE | The real shipped mobile-first swipe quiz/export app. Keep GitHub Pages compatible. |
| `MASTER_VAULT.json` | ACTIVE | Primary chemistry question database loaded by `index.html`. |
| `kernel/alchemist/` | ACTIVE | Browser-first IIFE modules for blocks, sessions, review, ingestion, credits, and exports. |
| `kernel/alchemist/session-normalizer.js` | ACTIVE | Shared normalization layer for sessions/questions and Knowledge Book data. |
| `core/` | DISCONNECTED | Standalone EPUB reader/parser engine using ES modules; not loaded by `index.html`. |
| `backend/chembook/` | PARTIAL | Python publishing pipeline. Useful but separate from the browser app; OCR remains stubbed. |
| `api/` | SCAFFOLDING | Serverless Stripe adapters. Requires real hosting and persistence; not secure on GitHub Pages alone. |
| `frontend/src/` | DISCONNECTED | React dashboard prototype. Not used by the production GitHub Pages app. |
| `manifest.json` / `sw.js` | ACTIVE | Minimal installable/offline app shell support. |

## Recommended integration order

1. Session EPUB export.
2. Knowledge Book export.
3. Vault data cleanup and validation.
4. EPUB engine bundling or explicit isolation.
5. Payment backend decision.
6. PWA/service worker hardening.
7. React dashboard delete-or-integrate decision.

## Guardrails for future work

- Do not replace the vanilla `index.html` UI unless explicitly requested.
- Keep all browser features runnable without a bundler.
- Do not claim localStorage credits are secure.
- Do not wire `core/` directly with classic script tags; it uses ES module syntax.
