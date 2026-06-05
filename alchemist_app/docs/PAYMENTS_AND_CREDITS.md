# Payments and Credits

## Current status: SCAFFOLDING

Alchemist can run on GitHub Pages as a static browser app. GitHub Pages cannot securely verify Stripe checkout sessions, process webhooks, or update credits server-side.

## Important limitations

- Client-side credits stored in `localStorage` are local-only and not production secure.
- Users can modify localStorage from DevTools.
- The credit module is useful for UX prototyping, not authoritative billing.
- The `api/` Stripe files require serverless hosting; they do not run on GitHub Pages.

## Existing adapters

- `api/create-checkout-session.js` creates a Stripe Checkout Session when deployed on a compatible serverless host and configured with `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID`.
- `api/stripe-webhook.js` verifies Stripe webhooks and can forward access updates to `ALCHEMIST_ACCESS_WEBHOOK_URL`.

## Production backend options

A production payment system must use a backend and persistence layer, for example:

- Vercel Serverless Functions + database.
- Supabase Edge Functions + Postgres.
- Firebase Functions + Firestore.
- Cloudflare Workers + KV/D1.

## GitHub Pages demo behavior

The browser app should not imply secure payment verification on GitHub Pages. If payment UI is added to the static app, it must explain that payments are unavailable in demo/static mode unless a backend is configured.
