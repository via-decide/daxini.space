# Alchemist App

Alchemist is a browser-first chemistry study and knowledge asset app. The shipped product is the vanilla `index.html` swipe quiz app backed by `MASTER_VAULT.json` and browser-safe IIFE modules in `kernel/alchemist/`.

The repository also contains a Python publishing pipeline and an EPUB reader engine, but those are separate from the shipped GitHub Pages app unless explicitly integrated.

## What ships today

- Mobile-first swipe quiz UI in `index.html`.
- Chemistry question vault in `MASTER_VAULT.json`.
- Session export menu for:
  - Session PDF
  - Session EPUB
  - Session `.ZAY`
  - Knowledge Book EPUB
- Single-question export buttons for PDF, EPUB, and `.ZAY`.
- Minimal PWA assets via `manifest.json` and `sw.js`.
- Lightweight tests and vault validation with Node.

## Run locally

No framework or bundler is required for the shipped app.

```bash
python3 -m http.server 8080
```

Open:

```text
http://localhost:8080/index.html
```

## Deploy on GitHub Pages

Deploy the repository root. `index.html`, `MASTER_VAULT.json`, `manifest.json`, `sw.js`, and `kernel/alchemist/*.js` must be served as static files.

GitHub Pages can run the quiz and client-side exports. It cannot securely verify Stripe payments.

## Export capabilities

### Session EPUB export

Completed or archived sessions can export an EPUB named:

```text
ALCHEMIST_SESSION_<sessionId>.epub
```

The EPUB includes a title page, session metadata, and each question with answer, logic, domain/category, hint, and trap where available.

### Knowledge Book export

Completed or archived sessions can export a mini textbook EPUB named:

```text
ALCHEMIST_KNOWLEDGE_BOOK_<sessionId>.epub
```

The Knowledge Book normalizes session questions, groups them by domain, groups repeated concepts, adds chapter overviews, and appends a learning reflection page.

### `.ZAY` export

Session and single-question `.ZAY` exports remain browser-side JSON packages for future portable learning asset workflows.

## Architecture map

See `docs/ARCHITECTURE_AUDIT.md` for the status of each repository layer.

Important status notes:

- `index.html` — ACTIVE shipped product.
- `MASTER_VAULT.json` — ACTIVE data source.
- `kernel/alchemist/` — ACTIVE browser modules.
- `core/` — DISCONNECTED EPUB reader engine using ES modules.
- `backend/chembook/` — PARTIAL Python publishing pipeline.
- `api/` — SCAFFOLDING serverless payment adapters.
- `frontend/src/` — DISCONNECTED React dashboard prototype.

## Payment limitations

Client-side credits are not secure. GitHub Pages cannot verify Stripe checkout or process webhooks. Production payment requires a backend and database such as Vercel + database, Supabase, Firebase, or Cloudflare Workers + KV/D1.

See `docs/PAYMENTS_AND_CREDITS.md`.

## Tests

Run all lightweight checks:

```bash
npm test
```

Validate the vault only:

```bash
npm run validate:vault
```

Existing kernel tests can also be run directly with Node, for example:

```bash
node kernel/alchemist/session-engine.test.js
```

## Python publishing pipeline

The legacy ChemBook publishing pipeline remains available separately:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
make publish
```

Outputs include `build/epub/book.epub`, `build/pdf/book_print.pdf`, and generated diagram assets.
