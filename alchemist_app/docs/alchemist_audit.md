# Alchemist Repository Architecture Audit

Date: 2026-06-04
Repository: `https://github.com/via-decide/alchemist_app.git`
Local source inspected: `/workspace/alchemist_app`

## Source Acquisition

- The active workspace is already a clone of `via-decide/alchemist_app`.
- A fresh `git clone https://github.com/via-decide/alchemist_app.git` was attempted into `/workspace/audit_repos`, but outbound GitHub access through the environment proxy returned `CONNECT tunnel failed, response 403`.
- Audit confidence is high because the repository contents are present locally and were inspected directly.

## Purpose

Alchemist is a browser-first chemistry learning and knowledge asset application. Its shipped product is a vanilla `index.html` swipe quiz app that loads chemistry question data from `MASTER_VAULT.json`, records lightweight local sessions, and exports learning artifacts as PDF, EPUB, Knowledge Book EPUB, and `.ZAY` packages.

Secondary subsystems in the same repository support EPUB reading, Python book publishing, serverless payment scaffolding, and a disconnected React dashboard prototype. These are not part of the currently shipped GitHub Pages application unless explicitly integrated later.

## Architecture Classification

| Dimension | Finding |
| --- | --- |
| Primary classification | **Application** |
| Secondary classifications | Prototype, utility modules, publishing pipeline |
| Runtime | **Static browser app** for shipped product; **Python** for publishing pipeline; **Node** for tests/validation; **serverless JS scaffolding** for payment adapters |
| UI style | Vanilla HTML/CSS/JavaScript in `index.html` with browser-safe IIFE modules |
| State model | Browser memory plus `localStorage`; no authoritative backend state in the shipped app |
| Deployment model | GitHub Pages / static hosting for shipped app; payment APIs require separate serverless hosting and persistence if activated |

## Entry Points

| Entry point | Runtime | Status | Role |
| --- | --- | --- | --- |
| `index.html` | Browser static | Active | Main mobile-first quiz, vault, swipe/session, and export UI |
| `MASTER_VAULT.json` | Static JSON | Active | Chemistry question/data vault loaded by the browser app |
| `manifest.json` | Browser/PWA | Active | Minimal PWA metadata |
| `sw.js` / `service-worker.js` | Browser service worker | Active/scaffolded | Static cache shell support |
| `kernel/alchemist/*.js` | Browser IIFE + CommonJS test compatibility | Active | Modular browser engines for sessions, blocks, exports, UI integration, normalization, and `.ZAY` support |
| `tests/run-tests.mjs` | Node | Active check harness | Runs lightweight JS tests and vault validation |
| `scripts/validate-vault.mjs` | Node | Active check | Validates `MASTER_VAULT.json` shape |
| `backend/chembook/api/main.py` | Python/FastAPI | Partial | API wrapper for the publishing pipeline |
| `backend/chembook/cli/main.py` | Python CLI | Partial | Command-line publishing entry |
| `Makefile` / `scripts/build_*.py` | Python toolchain | Partial | Book build, EPUB/PDF generation, diagrams |
| `api/create-checkout-session.js` / `api/stripe-webhook.js` | Serverless JS | Scaffolding | Stripe checkout/webhook adapters requiring real deployment and persistence |
| `frontend/index.html`, `frontend/src/app.js` | Static prototype | Disconnected | Payment/dashboard prototype that calls `/api/*` endpoints |

## Module Structure

```text
alchemist_app/
├── index.html                      # active shipped browser app
├── MASTER_VAULT.json               # active question vault
├── kernel/alchemist/               # active browser-safe Alchemist engines
│   ├── session-engine.js           # session lifecycle
│   ├── session-normalizer.js       # shared question/session normalization
│   ├── session-review.js           # review-mode support
│   ├── block-system.js             # block/content validation primitives
│   ├── ingestion-engine.js         # converts selections/inputs into blocks
│   ├── epub-exporter.js            # session/single-question EPUB + .ZAY helpers
│   ├── knowledge-book-exporter.js  # session-to-book exporter
│   ├── zay-compiler.js             # .ZAY package compiler
│   ├── zay-importer.js             # .ZAY roundtrip/import support
│   ├── vault-manager.js            # vault persistence helper
│   ├── credit-system.js            # client-only credit model
│   ├── navigation-state.js         # UI/navigation state helper
│   ├── ui-integration.js           # bridges app UI and engines
│   └── ui-activation.js            # event routing into engines
├── core/                           # disconnected EPUB reader/parser engine
├── backend/chembook/               # partial Python publishing system
├── scripts/                        # validation and book build scripts
├── api/                            # serverless payment scaffolding
├── frontend/                       # disconnected dashboard/payment prototype
├── docs/                           # architecture and system documentation
├── book/                           # static book source assets/templates
└── tests/                          # JS and Python checks
```

## Data Flow

### Shipped quiz and export flow

```text
User opens index.html
↓
Browser loads jsPDF CDN and kernel/alchemist IIFE modules
↓
index.html fetches MASTER_VAULT.json
↓
User searches/selects/swipes chemistry questions
↓
Session state, credits, selected item, generated notes, and user vault data are stored in memory/localStorage
↓
Export menu invokes browser-side PDF, EPUB, Knowledge Book, or .ZAY builders
↓
Downloads are generated client-side; no server persistence is required
```

### Kernel integration flow

```text
UI event or selection
↓
ingestion-engine converts input into block-like records
↓
block-system validates content shape
↓
session-engine/session-review/session-normalizer organize user progress
↓
epub-exporter / knowledge-book-exporter / zay-compiler serialize artifacts
↓
Browser download or local UI notification
```

### Python publishing flow

```text
Markdown/sample/PDF/content inputs
↓
backend/chembook/core pipeline performs OCR/citation/diagram/content generation steps
↓
HTML/EPUB/PDF/KDP metadata builders render publishing outputs
↓
build/ artifacts are produced by Makefile or scripts
```

## Dependency Analysis

### Browser/CDN dependencies

| Dependency | Location | Purpose | Risk |
| --- | --- | --- | --- |
| jsPDF `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js` | `index.html` | Browser-side PDF export | CDN availability and CSP/privacy dependence |

### npm / Node packages

`package.json` declares scripts only and no npm dependencies. Node is used for test orchestration and vault validation through built-in modules and local test files.

### Python packages

`requirements.txt` includes:

- FastAPI / Uvicorn / Pydantic for API scaffolding.
- pytesseract, Pillow, pdfplumber, pypdf for OCR/PDF ingestion and processing.
- markdown, Jinja2, WeasyPrint for publishing output rendering.
- matplotlib, numpy for diagram generation.
- pytest for Python tests.

### Other platform files

- `wrangler.toml` suggests Cloudflare Worker compatibility may have been considered.
- `_headers` and `_redirects` suggest static hosting provider support.
- Serverless payment adapters imply Vercel/Netlify/Cloudflare-style deployment, but they are not secure without server-side secrets and persistent storage.

## Deployment Model

| Component | Current deployment fit | Notes |
| --- | --- | --- |
| Shipped app | **GitHub Pages / static hosting** | Root static files are sufficient for quiz and browser exports |
| Payments | **Serverless/backend required** | GitHub Pages cannot securely verify Stripe checkout/webhooks |
| Python publishing | **Local/CI/backend process** | Not suitable for static-only hosting |
| Frontend prototype | Static prototype with API assumptions | Requires deployed `/api/*` endpoints to function |

## Capability Inventory

| Capability | Present | Evidence/Notes |
| --- | --- | --- |
| Quiz engine | Yes | `index.html` loads vault and drives swipe quiz UI |
| Session state | Yes | `kernel/alchemist/session-engine.js`, session review, normalization, local state |
| Knowledge vault | Yes | `MASTER_VAULT.json`, local user vault storage, vault manager helper |
| Exports | Yes | PDF, EPUB, Knowledge Book EPUB, `.ZAY` browser exports |
| `.ZAY` packages | Yes | `zay-compiler.js`, `zay-importer.js`, exporter paths in `index.html` |
| Knowledge Book | Yes | `knowledge-book-exporter.js` |
| EPUB reader | Partial/disconnected | `core/` engine not wired into active app |
| Publishing pipeline | Partial | Python backend and scripts exist separately |
| Payment/credits | Partial/scaffolded | Client credits active but insecure; Stripe adapters need real backend |
| Visualization | Minimal | 3D block helper exists; no full concept graph renderer in shipped app |
| Rule/reasoning layer | Limited | Chemistry logic fields and quiz explanations exist; no general reasoning engine |

## Architecture Diagram

```text
                 ┌────────────────────────┐
                 │      index.html        │
                 │ active vanilla UI      │
                 └───────────┬────────────┘
                             │ fetch/load
                             ▼
                 ┌────────────────────────┐
                 │   MASTER_VAULT.json    │
                 │ chemistry questions    │
                 └───────────┬────────────┘
                             │ user actions
                             ▼
┌──────────────────────────────────────────────────────┐
│              kernel/alchemist/ browser engines        │
│ session | review | normalize | ingest | blocks | zay  │
│ epub export | knowledge book | navigation | UI bridge  │
└───────────────┬──────────────────────────┬───────────┘
                │                          │
                ▼                          ▼
       ┌─────────────────┐        ┌─────────────────────┐
       │ localStorage    │        │ Browser downloads   │
       │ client state    │        │ PDF/EPUB/.ZAY       │
       └─────────────────┘        └─────────────────────┘

Disconnected / separate layers:
core/ EPUB reader      backend/chembook Python publishing      api/ Stripe scaffolding
```

## Risks and Constraints

1. **Static runtime guardrail**: the shipped app must stay browser-only unless a future task explicitly changes deployment assumptions.
2. **Client credits are insecure**: `localStorage` credits can support demos but cannot enforce paid access.
3. **Multiple non-shipped subsystems**: `core/`, `backend/chembook/`, `frontend/`, and `api/` are useful but have different runtimes and should not be merged into the shipped path without explicit integration design.
4. **CDN dependency**: jsPDF comes from a CDN; offline or strict CSP deployments need a local/vendor decision.
5. **Potential duplicate service workers**: both `sw.js` and `service-worker.js` exist and should be clarified before PWA hardening.

## Audit Conclusion

Alchemist should remain the shell and user-facing learning application for the ecosystem. Its current strength is browser-first quiz/session/export flow. Future integration should preserve the vanilla static app and treat external reasoning/visualization systems as adapters or packages, not as wholesale replacements for the shipped UI.
