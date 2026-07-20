# Backend Integration Plan

## Current frontend/browser runtime helpers

Before adding backend runtime services, treat the existing browser helpers as the current frontend runtime layer:

- `runtime/app-loader.js` loads registry app records and bundles, initializes browser state, and coordinates browser rendering.
- `runtime/state-engine.js` owns lightweight browser state reads, updates, and subscriptions.
- `runtime/component-renderer.js` converts bundle component definitions into DOM output with state bindings.

These helpers are current frontend/browser runtime helpers and should not be described as backend runtime services.

## Future Zayvora backend runtime stack

Backend integration should define the Zayvora runtime stack separately from the current browser helpers:

- Gateway
- Runtime Manager
- Workspace Runtime
- Execution Runtime
- Reasoning Runtime
- Model Gateway/Model Registry

## Migration and preservation requirement

Preserve `runtime/app-loader.js`, `runtime/state-engine.js`, and `runtime/component-renderer.js` unless a future implementation replaces them behind an SDK-compatible interface.
Target boundary: UI pages must depend only on `DaxiniSDK` or `ZayvoraSDK`; SDK methods must depend on one shared API client; the client must issue Gateway HTTP requests; Gateway handlers must delegate to runtime services. Default page guidance is **No UI changes required**; only rows explicitly labeled `EXTEND` may add UI work.

| Page / capability | SDK method | API client / Gateway endpoint | Runtime service | Integration note |
| --- | --- | --- | --- | --- |
| Runtime Status page | `sdk.runtime.getStatus()` | `GET /runtime/status` | Runtime health service | No UI changes required. |
| Workspaces page | `sdk.workspaces.list(params)` | `GET /workspaces` | Workspace catalog service | No UI changes required. |
| Workspace Detail page | `sdk.workspaces.get(id)` | `GET /workspaces/:id` | Workspace catalog service | No UI changes required. |
| Workspace Execution action | `sdk.executions.create(workspaceId, payload)` | `POST /workspaces/:id/executions` | Execution runtime service | `EXTEND` only if the page lacks an execution launch action; otherwise No UI changes required. |
| Execution Detail page | `sdk.executions.get(id)` | `GET /executions/:id` | Execution runtime service | No UI changes required. |
| Reasoning Session creation | `sdk.reasoning.createSession(payload)` | `POST /reasoning/sessions` | Reasoning session service | `EXTEND` only if the page lacks a session creation action; otherwise No UI changes required. |
| Reasoning Session page | `sdk.reasoning.getSession(id)` | `GET /reasoning/sessions/:id` | Reasoning session service | No UI changes required. |
| Models page | `sdk.models.list()` | `GET /models` | Model registry service | No UI changes required. |
| Deployments page | `sdk.deployments.list()` | `GET /deployments` | Deployment registry service | No UI changes required. |
| Billing Entitlements page | `sdk.billing.getEntitlements()` | `GET /billing/entitlements` | Billing entitlement service | No UI changes required. |
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
