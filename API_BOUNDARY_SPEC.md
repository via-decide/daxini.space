# API Boundary Spec

Future frontend boundary: UI components call `DaxiniSDK` or `ZayvoraSDK`; each SDK calls the shared API client; the shared API client calls Gateway endpoints; the Gateway delegates to runtime services. UI page policy: Runtime Status, Workspace List, Workspace Detail, Execution Detail, Reasoning Session, Models, Deployments, and Billing Entitlements pages require **No UI changes required** unless their backend integration is explicitly marked `EXTEND`.

| Endpoint | Contract | Gateway delegation | UI impact |
| --- | --- | --- | --- |
| `GET /runtime/status` | Returns `{ status, version, services[], checkedAt }`; `services[]` includes `{ name, status, latencyMs? }`. | Runtime health service. | No UI changes required. |
| `GET /workspaces` | Returns `{ items, nextCursor? }`; supports `cursor`, `limit`, `ownerId?`; each item has `{ id, name, status, updatedAt }`. | Workspace catalog service. | No UI changes required. |
| `GET /workspaces/:id` | Returns `{ id, name, status, config, metadata, createdAt, updatedAt }`; `404` when missing. | Workspace catalog service. | No UI changes required. |
| `POST /workspaces/:id/executions` | Body `{ input, mode?, modelId?, metadata? }`; returns `202 { id, workspaceId, status, submittedAt }`. | Execution runtime service. | No UI changes required unless marked `EXTEND` for new launch controls. |
| `GET /executions/:id` | Returns `{ id, workspaceId, status, input?, output?, error?, startedAt?, completedAt? }`. | Execution runtime service. | No UI changes required. |
| `POST /reasoning/sessions` | Body `{ workspaceId?, modelId?, context?, metadata? }`; returns `201 { id, status, createdAt }`. | Reasoning session service. | No UI changes required unless marked `EXTEND` for session creation UX. |
| `GET /reasoning/sessions/:id` | Returns `{ id, status, workspaceId?, messages[], artifacts[], updatedAt }`. | Reasoning session service. | No UI changes required. |
| `GET /models` | Returns `{ items }`; each model has `{ id, provider, displayName, capabilities[], defaultParameters? }`. | Model registry service. | No UI changes required. |
| `GET /deployments` | Returns `{ items }`; each deployment has `{ id, environment, status, version, updatedAt }`. | Deployment registry service. | No UI changes required. |
| `GET /billing/entitlements` | Returns `{ plan, limits, usage, features[], refreshedAt }`. | Billing entitlement service. | No UI changes required. |
## Boundary principles

1. Current static behavior is canonical.
2. APIs may enhance data availability but must not block shell launch.
3. Failed network calls must degrade to existing local/static behavior.
4. Slugs are the stable app identity at the UI boundary.
5. Storage keys are compatibility boundaries and must not be renamed without migration code.

## Frontend-facing app record

Minimum fields currently consumed across registry and marketplace surfaces:

```json
{
  "slug": "logichub",
  "name": "LogicHub",
  "icon": "⚡",
  "url": "/apps/logichub/index.html",
  "status": "live",
  "desc": "Short description",
  "description": "Marketplace description",
  "ownerType": "mine",
  "tier": "core",
  "tags": ["builder"],
  "category": "productivity",
  "creator": "local-creator",
  "created_at": "2026-01-01T00:00:00.000Z",
  "popularity": 0,
  "provenance": {},
  "monetization": {},
  "compliance": {}
}
```

## Registry/shard boundary

### Namespace shard fetch

- Consumer: `daxini-registry.js`
- Request: `GET ./registry/shards/{category}.json`
- Cache mode: `no-store`
- Expected success shape:

```json
{
  "apps": []
}
```

- Failure behavior: return `null`, log warning/error, keep current room state.

### Community feed

- Consumer: `daxini-ui.js`
- Request: `GET https://logichub.app/api/public-feed`
- Cache mode: `no-store`
- Expected success shape: either an array of app records or an object with `apps` array.
- Failure behavior: warn only and continue with built-in registry.

### Marketplace index

- Consumer: `marketplace/marketplace-ui.js`
- Default request: `GET /registry/app-index.json`
- Expected success shape:

```json
{
  "apps": []
}
```

- Optional cache: `window.DaxiniCache` with time-to-live in minutes.

## Publish boundary

- Consumer: external/local publishing clients.
- Endpoint: `POST api/apps/publish.js` runtime route.
- Required body fields:

```json
{
  "bundle": {
    "build": {
      "index.html": "...",
      "app.js": "...",
      "style.css": "...",
      "manifest.json": "..."
    },
    "architecture_prd": {}
  },
  "metadata": {
    "slug": "example",
    "name": "Example",
    "creator": "local-creator"
  }
}
```

- Success response:

```json
{
  "success": true,
  "slug": "example",
  "message": "App successfully published locally."
}
```

## Trace boundary

- Endpoint: `POST api/traces.js` runtime route.
- Request body:

```json
{
  "traces": [],
  "userSignals": []
}
```

- Behavior: hashes raw IP, appends JSON line to `/tmp/traces.log`, logs trace payload.
- Success response:

```json
{
  "success": true,
  "message": "Trace recorded"
}
```

## Routing boundary

- Root shell route: `/`
- Query app deep link: `/?app={slug}`
- Static app pages: `/apps/{slug}/index.html` and `/apps/{slug}` depending on launcher path
- Helper routes: `/zayvora`, `/pricing`, `/login`
- Workspace redirect: `/workspace` to `/apps/workspace`
