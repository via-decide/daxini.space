# Routing Migration Plan

## Current routing model

The app uses three route layers:

1. Root shell path routing through `app/router.js` for `/`, `/zayvora`, `/pricing`, and `/login`.
2. Query-based app deep links through `daxini-ui.js` using `?app={slug}`.
3. Static app page routing under `/apps/{slug}` and `/apps/{slug}/index.html` through server helpers and direct file paths.

## Preservation requirements

- Preserve `/` as the spatial room home.
- Preserve `/?app={slug}` as an iframe app deep link.
- Preserve `/apps/{slug}/index.html` static app URLs from registry entries.
- Preserve marketplace full-page launch behavior to `/apps/{slug}` unless explicitly migrated with redirects.
- Preserve `/workspace` and `/zayvora` redirect/helper behavior.
- Preserve back/forward behavior for app open/close and path route cards.

## Migration phases

### Phase 0: Tests and snapshots

- Add route contract tests for `AppRouter.getRoute`, server route detection, and app route resolution.
- Snapshot home, active app, and path route visibility states.
- Document all public URLs currently linked from markup and registries.

### Phase 1: Route manifest

- Create a route manifest that lists path routes, app routes, redirect routes, and query deep-link rules.
- Do not use the manifest in production until tests prove parity.

### Phase 2: Compatibility router wrapper

- Introduce a wrapper that delegates to existing `AppRouter` and `DaxiniUI.route`.
- Keep current globals and event listeners.
- Define precedence: path routes other than `/` hide the room; root path may honor `?app=`.

### Phase 3: App route normalization

- Normalize `/apps/{slug}` and `/apps/{slug}/index.html` at server edge only.
- Avoid changing registry URLs until all static apps are confirmed to work under both forms.

### Phase 4: Optional framework/router adoption

- If a framework router is introduced, mount it around current shell behavior rather than replacing launch behavior.
- Keep compatibility redirects and query deep links indefinitely or through a documented deprecation window.

## Route contract table

| Route | Current behavior | Migration action |
| --- | --- | --- |
| `/` | Shows spatial room and window manager | Preserve. |
| `/?app=slug` | Opens registry app in iframe | Preserve. |
| `/zayvora` | Shows route card or redirects in server helper contexts | Preserve until unified. |
| `/pricing` | Shows pricing route card | Preserve. |
| `/login` | Shows login route card | Preserve. |
| `/workspace` | Server helper redirect to `/apps/workspace` | Preserve. |
| `/apps/{slug}` | Static app route/full-page launch | Preserve. |
| `/apps/{slug}/index.html` | Static app entry used by registry iframe URLs | Preserve. |
