# Frontend Dashboard Status

Status: DISCONNECTED

The production Alchemist app is the browser-first `index.html` file at the repository root. That app is what GitHub Pages serves and what users interact with.

`frontend/src/` is a React dashboard prototype. It is not used by the GitHub Pages app and should not be treated as the main product UI.

Current notes:

- `frontend/src/app.js` no longer hardcodes `http://localhost:8000/health`; it uses `window.ALCHEMIST_API_BASE` or `/api/health`.
- The dashboard payment helper calls `/api/create-checkout-session`, which requires serverless hosting and Stripe environment variables.

Future decision: either integrate this dashboard intentionally or delete it to reduce repository confusion.
