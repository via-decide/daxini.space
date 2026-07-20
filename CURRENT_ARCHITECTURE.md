# Current Architecture

## index.html shell: KEEP

The current `index.html` shell is a stable UI shell and must be preserved. Its stable responsibilities are:

- onboarding redirect in the initial inline script
- `.eco-bar` navigation
- `.spatial-os`
- `.matrix-viewport`
- `.matrix-grid`
- `.app-overlay`
- `.console-terminal`
- `#os-minimap`
- `#launch-bar`
- keyboard/touch handlers near the bottom inline script

Zayvora backend/runtime integration must not redesign or rebuild these UI elements.
## Scope

This audit describes the current vanilla HTML/CSS/JavaScript application by static inspection only. It does not propose runtime changes in this document and preserves the existing shell, navigation, storage keys, iframe launch flow, app URLs, animations, and app launch behavior.

## Shell composition

The root shell is `index.html`. It owns the document structure, the first-visit onboarding redirect, global CSS design tokens, layout, fixed overlays, room matrix markup, route view root, marketplace surfaces, authentication overlay, and script ordering. The early inline redirect checks `localStorage.daxini_onboarding_complete` and skips redirect when the URL contains `?app=`.

The shell behaves like a spatial operating-system launcher rather than a conventional multipage site. The primary home experience is a matrix room rendered inside the root document. App content is launched into an iframe-backed window manager rather than replacing the whole root page.

## Top-level behavior modules

- `main.js` wires ecosystem-level modules into `window`, records session/login events, and reports tab switches through the security event channel.
- `daxini-registry.js` defines the in-memory core app library, home room slots, namespace gesture map, slug lookup, upsert behavior, and shard fetching.
- `daxini-ui.js` owns room state, community feed ingestion, route synchronization through the `app` query parameter, room rendering, iframe window creation, and active app close behavior.
- `daxini-passport.js` owns passport HUD state, the `sovereign_token` storage key, simulated hardware authorization, challenge generation, recovery helpers, and revocation-list checks.
- `pattern-tracer.js` owns the 3x3 gesture/tap engine and dispatches `os:pattern_locked` events consumed by `daxini-ui.js`.

## Shell helper modules

- `app/router.js` is a lightweight path router for `/`, `/zayvora`, `/pricing`, and `/login`. It renders simple route cards into `#route-view-root`, hides the room/window manager for non-root routes, and updates the document title.
- `app/auth.js` currently marks auth readiness through `document.documentElement.dataset.authReady`.
- `app/ui.js` hides `#ui-fallback` when present and marks UI readiness through `document.documentElement.dataset.uiReady`.
- `app/bootstrap.js` initializes router, auth, and UI on DOM readiness while exposing `window.DaxiniBootstrap`.

## Runtime prototypes

- `runtime/app-loader.js` loads a registry entry, fetches a JSON bundle, creates a runtime state engine, renders components, and subscribes re-renders to state changes.
- `runtime/state-engine.js` provides a shallow-copy state container with `getState`, `setState`, and `subscribe`.
- `runtime/component-renderer.js` converts declarative component records into DOM elements and supports simple attribute bindings.

These runtime files are prototypes and are not the same path as the current iframe launcher used by `daxini-ui.js`.

## Marketplace modules

- `marketplace/marketplace-ui.js` loads a registry index, optionally uses `window.DaxiniCache`, filters/sorts entries, renders a filter bar, and delegates card actions.
- `marketplace/app-card.js` renders DOM marketplace cards with launch, duplicate, and install controls.
- `marketplace/app-launcher.js` launches apps through `window.location.href = /apps/{slug}` and installs workspace records under `daxini.workspace.apps` by default.

## Server and API stubs

- `server/app-router.js` validates `/apps/{name}` routes and serves static files under `apps/{name}` with traversal protections.
- `server/router.js` detects workspace, zayvora, and app routes; redirects workspace/zayvora paths; and streams app files with cache/performance headers.
- `server/cache-layer.js` centralizes cache-control headers and gzip support.
- `server/image-router.js` loads and filters `apps/images_registry.json`.
- `api/apps/publish.js` accepts local publish payloads, writes generated files into `apps/{slug}`, and updates `apps/registry.json`.
- `api/traces.js` accepts trace payloads, hashes IP addresses, appends trace logs to `/tmp/traces.log`, and logs events.

## App pages

Apps are currently independent static HTML entry points under `apps/*/index.html`. They are launched either inside the root iframe window manager via registry URLs such as `/apps/logichub/index.html`, or as full-page navigations from marketplace launcher paths such as `/apps/{slug}`.

## Architecture constraints to preserve

1. Do not change the early onboarding redirect condition.
2. Do not change `?app=` deep-link behavior.
3. Do not rename global objects such as `DaxiniUI`, `DaxiniRegistry`, `DaxiniPassport`, `Tracer`, `AppRouter`, or runtime prototype globals.
4. Do not change localStorage keys including `daxini_onboarding_complete`, `sovereign_token`, `daxini_revocation_list`, and `daxini.workspace.apps`.
5. Do not change iframe launch URLs or route paths unless an explicit migration phase includes compatibility redirects.
