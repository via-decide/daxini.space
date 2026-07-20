# Backend Integration Plan

## Goal

Introduce backend capabilities without changing current production runtime behavior. The existing app should continue to load as a static vanilla shell, launch app pages through current URLs, and retain all local-first storage behavior until a specific integration phase opts into remote features.

## Current backend-adjacent pieces

- `api/apps/publish.js` is a serverless publish endpoint that writes app bundles and updates `apps/registry.json`.
- `api/traces.js` is a trace ingestion endpoint that anonymizes IPs and writes logs to `/tmp`.
- `server/app-router.js` and `server/router.js` are static routing helpers for app pages and workspace redirects.
- `server/cache-layer.js` and `server/image-router.js` provide cache and registry-serving utilities.
- `daxini-ui.js` already fetches a community feed from `https://logichub.app/api/public-feed` and falls back silently when unavailable.
- `daxini-registry.js` can fetch namespace shards from `./registry/shards/{category}.json`.

## Integration phases

### Phase 1: Document contracts

- Freeze request/response shapes for app registry, shard registry, marketplace index, publish endpoint, trace endpoint, and passport-related identity status.
- Document storage-key ownership and migration policy.
- Add static JSON fixtures for API contract tests without wiring them into production.

### Phase 2: Read-only backend adapters

- Introduce adapter modules that wrap existing fetch calls but preserve the same default URLs and cache behavior.
- Keep adapters opt-in through dependency injection or test-only imports.
- Do not change `daxini-ui.js` or registry launch behavior until parity is proven.

### Phase 3: Compatibility API gateway

- Provide backend endpoints that mimic existing static file expectations:
  - app index returns arrays accepted by marketplace UI,
  - shard endpoints return `{ apps: [...] }`,
  - publish endpoint keeps local slug semantics,
  - trace endpoint keeps POST-only semantics.
- Add CORS and rate-limit policies without changing frontend assumptions.

### Phase 4: Auth and identity hardening

- Keep `sovereign_token` local behavior as a compatibility mode.
- Add server-side verification only behind an explicit capability check.
- Preserve guest-node behavior when no token is present.

### Phase 5: Observability

- Add endpoint health checks, structured logs, and trace retention policy.
- Keep trace submission optional and non-blocking.

## Non-goals

- No immediate switch to server-rendered pages.
- No replacement of iframe app launch behavior.
- No route renaming.
- No automatic migration of localStorage keys.
- No changes to app pages under `apps/*/index.html`.
