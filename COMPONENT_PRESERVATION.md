# Component Preservation Matrix

This document is the implementation-facing companion to `UI_PRESERVATION_MAP.md`. It classifies major components for migration. **KEEP** is the default classification. **EXTEND** is used only where the component should remain intact but needs missing backend integrations: runtime status, workspace sync, execution jobs, model listings, deployment status, entitlements, analytics, or identity session validation.

| Component | Purpose | Current responsibility | Future responsibility | Classification | Migration difficulty | Risk level |
| --- | --- | --- | --- | --- | --- | --- |
| Spatial OS shell | Primary visual frame for Daxini.space. | Maintains the landing layout, visual system, onboarding redirect, top navigation area, matrix viewport, and window host. | Preserve the shell and add status surfaces for runtime/deployment health without redesigning the visual language. | EXTEND | Medium | Medium |
| Daxini UI engine | Client controller for spatial navigation and app launch. | Initializes listeners, loads community apps, routes `?app=` URLs, renders nodes, handles pattern locks, and opens iframe windows. | Preserve navigation patterns while adding backend-aware runtime status, workspace sync, execution job state, model listing context, and deployment feedback. | EXTEND | Medium | High |
| Daxini app registry | Source of app metadata and related-app discovery. | Stores core apps, namespace maps, default room slugs, shard fetching, lookup, and upsert logic. | Preserve registry API and hydrate it from backend sources for model listings, deployment status, entitlements, and app availability. | EXTEND | Medium | Medium |
| Window manager | Glass panel lifecycle manager. | Limits active windows, spawns tool/app panels, closes panels, dispatches render events, and traces orchestration. | Preserve lifecycle behavior while adding execution job status, runtime health, and entitlement checks before mounting protected tools. | EXTEND | Medium | Medium |
| Marketplace listing UI | Marketplace browsing surface. | Reads registry index, caches listings, filters by search/category/creator, sorts by popularity/recent, and renders cards. | Preserve browsing and filtering while extending cards/lists with analytics, entitlement state, deployment badges, and model availability. | EXTEND | Medium | Medium |
| Marketplace app card | App summary and action card. | Presents metadata, provenance, monetization/compliance state, description, and launch/duplicate/install actions. | Preserve card structure and add entitlement-aware actions, deployment badges, and analytics instrumentation. | EXTEND | Low | Medium |
| Marketplace launcher | App route launcher and installer helper. | Resolves app slug, redirects to app URL, and stores installs in `localStorage`. | Preserve simple launch API and add workspace sync, entitlement validation, and deployment-aware launch destinations. | EXTEND | Low | Medium |
| Workspace composer/gallery | User workspace for prompt-to-image artifact creation. | Captures image descriptions, posts to LogicHub publishing API, reloads registry data, and renders generated app tiles. | Preserve composer and gallery while adding execution job progress, workspace sync, identity session validation, and deployment status. | EXTEND | Medium | High |
| Daxini HQ content page | Static ecosystem and holding-company explainer. | Displays organization narrative, local-first philosophy, and ecosystem modules. | Keep as content-only unless brand/product copy changes. | KEEP | Low | Low |
| Global ecosystem navigation | Shared cross-product navigation and funnel UI. | Injects ecosystem header, personalization banner, progress bar, footer map, modal, and local visit state. | Preserve navigation while adding identity session validation and entitlement-aware marketplace access. | EXTEND | Low | Medium |
| Passport identity module | Identity HUD and hardware-auth prototype. | Reads/stores local passport token, renders guest/verified states, simulates hardware auth, and exposes recovery/revocation helpers. | Preserve HUD flow but validate sessions and entitlement claims through backend identity services. | EXTEND | Medium | High |
| Analytics event service | Client analytics writer. | Emits canonical discovery, creator, and retention events to Firestore event logs and daily counters. | Preserve non-blocking tracking contract while adding authenticated analytics, consent/privacy controls, and richer attribution. | EXTEND | Medium | Medium |
| Analytics dashboard | Admin/creator analytics visualization. | Fetches Firestore metrics, aggregates top searches/apps, and renders discovery and creator funnel views. | Preserve dashboard UX and extend with backend analytics dimensions for identity, entitlements, deployments, and workspace activity. | EXTEND | Medium | Medium |
| Individual app pages | Product modules hosted under `/apps`. | Serve standalone static app experiences for core and experimental products. | Keep app boundaries and only extend apps that require runtime status, workspace sync, execution jobs, deployment status, or identity validation. | KEEP | Medium | Medium |
| Runtime component renderer | Runtime UI rendering layer. | Renders runtime-managed component nodes into host surfaces. | Preserve rendering boundary while adding runtime status and execution job lifecycle integration. | EXTEND | Medium | High |
| Runtime state engine | Client-side runtime state coordinator. | Manages local state transitions for runtime-loaded experiences. | Preserve local state semantics and extend with workspace sync, backend reconciliation, and durable execution job state. | EXTEND | High | High |
| Runtime app loader | Runtime app resolver and mount helper. | Loads app definitions/payloads for runtime execution. | Preserve loader API while adding model listings, deployment status, entitlement checks, and execution validation. | EXTEND | High | High |
| Static legal/content pages | Legal, policy, marketing, and informational pages. | Provide terms, privacy, refunds, contact, books, onboarding, and similar static routes. | Keep content surfaces; update only for copy, compliance, or routing changes. | KEEP | Low | Low |
# Component Preservation

## KEEP: current `index.html` shell

The current `index.html` shell is a preserved component boundary. Stable responsibilities include:

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
## Componentization strategy

The current UI should be treated as a set of implicit components already defined by DOM IDs, classes, global objects, and event names. Future component extraction must preserve these contracts before introducing new abstractions.

## Components to preserve

### Root shell

- Owner: `index.html`
- Responsibilities: metadata, onboarding redirect, fonts, design tokens, layout, overlays, script loading.
- Preserve: launch timing, viewport lock, global CSS class names, and ID availability before DOMContentLoaded listeners run.

### Spatial room

- Owner: `index.html` markup and `daxini-ui.js`
- Responsibilities: home room population, focused app title, related app slots, node launch click handlers.
- Preserve: `ROOM_POSITIONS` mapping, node IDs, `data-slug`, icon/name inner structure, and entry animation timing.

### Iframe window

- Owner: `daxini-ui.js`
- Responsibilities: clearing `#window-manager`, creating `.glass-window`, setting title, close control, iframe `src`, dispatching window events.
- Preserve: iframe launch path and close behavior.

### Gesture minimap

- Owner: `pattern-tracer.js`
- Responsibilities: pointer/touch tracking, dot activation, SVG line updates, direct tap support, gesture-to-event dispatch.
- Preserve: center-origin swipe semantics, smart-tap fallback, namespace seed format, and haptic best-effort behavior.

### Registry

- Owner: `daxini-registry.js`
- Responsibilities: core apps, app lookup, community/shard upsert, namespace mapping.
- Preserve: public `window.DaxiniRegistry` shape and array/object names.

### Passport HUD

- Owner: `daxini-passport.js`
- Responsibilities: guest/authenticated HUD markup, overlay state, token storage, recovery/revocation helpers.
- Preserve: storage keys, visible guest behavior, and simulated auth timing unless explicitly changed in a future security phase.

### Path route cards

- Owner: `app/router.js`
- Responsibilities: simple routes, title update, link interception, room visibility toggling.
- Preserve: route paths and `data-route` link behavior.

### Marketplace

- Owner: `marketplace/*.js`
- Responsibilities: index load, filter/sort state, card rendering, app launch/install actions.
- Preserve: default index URL, default sort fallback, card action labels, and workspace install storage shape.

## Compatibility wrapper recommendation

Before replacing any module with a framework component, expose the same `window.*` global and event behavior from the new implementation. Tests should assert both DOM output and global API compatibility.
