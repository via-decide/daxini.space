# UI Preservation Map

This matrix maps the major Daxini.space UI surfaces to their preservation strategy for the next migration. The default classification is **KEEP**; **EXTEND** is reserved for components that already have usable UI but need backend integrations such as runtime status, workspace sync, execution jobs, model listings, deployment status, entitlements, analytics, or identity session validation.

| Component | Purpose | Current responsibility | Future responsibility | Classification | Migration difficulty | Risk level |
| --- | --- | --- | --- | --- | --- | --- |
| Spatial OS shell (`index.html`) | Provide the primary Daxini.space landing shell and spatial navigation canvas. | Owns first-visit onboarding redirect, core design tokens, top eco bar, matrix viewport, HUD styling, node surfaces, and app window host markup. | Preserve the visual shell while wiring status-aware UI states for runtime health and deployment visibility. | EXTEND | Medium | Medium |
| Daxini UI engine (`daxini-ui.js`) | Coordinate room rendering, pattern navigation, and app iframe launch flows. | Loads community apps, resolves routes, renders related app nodes, handles namespace shard gestures, and opens/closes active app windows. | Keep interaction model and extend with runtime status, workspace sync, execution job handoff, model listing awareness, and deployment-state feedback. | EXTEND | Medium | High |
| App registry (`daxini-registry.js`) | Maintain canonical app metadata and namespace-to-shard lookup. | Defines core app entries, room positions, default room slugs, related app lookup, shard loading, and app upsert behavior. | Preserve registry shape while extending metadata hydration for model listings, deployment status, entitlements, and backend-sourced availability. | EXTEND | Medium | Medium |
| Window manager (`window-manager.js`) | Manage glass-window panels and embedded tool surfaces. | Spawns limited concurrent windows, closes panels, dispatches render events, and traces orchestration through Passport when present. | Keep panel behavior and extend launch context with execution job status, runtime health, and entitlement-gated access. | EXTEND | Medium | Medium |
| Marketplace UI (`marketplace/marketplace-ui.js`) | Render searchable, sortable marketplace listings. | Fetches the app index, applies category/creator/search filters, caches index reads, and delegates launch/install actions to cards and launcher. | Preserve marketplace interaction while extending listing data with entitlements, analytics counters, deployment state, and model availability. | EXTEND | Medium | Medium |
| Marketplace app card (`marketplace/app-card.js`) | Display individual app metadata and actions. | Shows creator, provenance, monetization, compliance, description, and launch/duplicate/install controls. | Keep card presentation and extend badges/actions for entitlement state, install eligibility, deployment status, and analytics instrumentation. | EXTEND | Low | Medium |
| App launcher (`marketplace/app-launcher.js`) | Launch apps and record local workspace installs. | Redirects to app routes and stores installed app records in `localStorage`. | Keep launch semantics and extend install flow with workspace sync, entitlement checks, and deployment-aware route resolution. | EXTEND | Low | Medium |
| Workspace app (`apps/workspace/index.html`) | Let users generate images and save/publish them as gallery artifacts. | Posts prompts to LogicHub publish endpoint, reloads the image registry, renders gallery tiles, and reports local status/errors. | Preserve composer/gallery UI and extend with workspace sync, execution job progress, identity session validation, and deployment status for generated artifacts. | EXTEND | Medium | High |
| Daxini HQ app (`apps/daxini-hq/index.html`) | Explain ecosystem structure and holding-company positioning. | Presents static narrative content for ViaDecide, LogicHub, PrintByDD, and sovereign distribution. | Preserve as static informational app, updating copy only when product positioning changes. | KEEP | Low | Low |
| Global ecosystem navigation (`ecosystem-nav.js`) | Provide cross-product header, funnel progress, modal, and footer map. | Injects shared nav/footer UI, highlights current product, displays onboarding/marketplace gates, and stores visit markers. | Keep global navigation and extend identity session validation and entitlement-aware menu unlocking. | EXTEND | Low | Medium |
| Passport identity HUD (`daxini-passport.js`) | Surface sovereign identity and hardware-auth prototype state. | Reads local token state, renders guest/verified HUD, simulates authorization, challenge verification, recovery, and revocation checks. | Preserve UX but replace local-only trust with backend identity session validation and entitlement claims. | EXTEND | Medium | High |
| Analytics service (`analytics-service.js`) | Track creator, discovery, and retention analytics events. | Writes event logs and daily counters to Firestore REST and fails silently when telemetry is unavailable. | Keep fire-and-forget UX contract while extending authenticated analytics, privacy controls, and richer event attribution. | EXTEND | Medium | Medium |
| Analytics dashboard (`analytics-dashboard.tsx`) | Visualize discovery and creator funnels. | Reads Firestore daily counts, top searches, and top apps, then renders metric cards and funnel bars. | Keep dashboard layout and extend backend analytics coverage, identity segmentation, and entitlement/deployment reporting. | EXTEND | Medium | Medium |
| Core app iframes (`apps/*/index.html`) | Host individual product experiences inside the spatial shell or as direct routes. | Serve app-specific static experiences such as LogicHub, Prompt Alchemy, Orchade, Daxini Lens, ViaLogic, Alchemist, StudyOS, Vault, and Zayvora Chat. | Preserve app boundaries; extend only where each app needs runtime status, workspace sync, execution jobs, or identity validation. | KEEP | Medium | Medium |
| Runtime renderer (`runtime/component-renderer.js`) | Render runtime-managed component nodes. | Provides the local component rendering layer used by runtime surfaces. | Keep renderer contract and extend with runtime status and execution job lifecycle hooks. | EXTEND | Medium | High |
| Runtime state engine (`runtime/state-engine.js`) | Manage local runtime state transitions. | Provides client-side state coordination for runtime-loaded apps. | Keep local state model and extend with backend sync, workspace reconciliation, and job-state persistence. | EXTEND | High | High |
| Runtime app loader (`runtime/app-loader.js`) | Load runtime app definitions into the UI. | Resolves and mounts app payloads for runtime execution. | Keep loader boundary and extend with model listings, deployment status, entitlements, and execution job validation. | EXTEND | High | High |
## KEEP: `index.html` shell

The `index.html` shell is classified as KEEP. Preserve these stable UI responsibilities during integration work:

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
## Purpose

This document maps the existing user-interface surfaces that must be preserved during any future migration. The current app is visually and behaviorally defined by `index.html`, with imperative behavior layered through vanilla JavaScript modules.

## Root shell surfaces

| Surface | Current owner | Preservation requirement |
| --- | --- | --- |
| First-visit onboarding redirect | `index.html` inline script | Preserve the exact storage-key gate and the `?app=` deep-link escape hatch. |
| Global design tokens | `index.html` CSS `:root` | Preserve color, font, spacing, border, and background token semantics before extracting CSS. |
| Scanline overlay | `index.html` | Preserve fixed, pointer-events-none overlay behavior and z-index relationship. |
| Radial glow background | `index.html` | Preserve animation timing, gradient placement, and non-interactive behavior. |
| Eco bar | `index.html` | Preserve brand/link layout, hover treatment, and top navigation affordance. |
| Spatial OS container | `index.html` | Preserve full-viewport locked layout and overflow assumptions. |
| Matrix viewport and room nodes | `index.html` + `daxini-ui.js` | Preserve node IDs, `data-slug` use, room position mapping, icon/name markup, and click-to-launch behavior. |
| Window manager | `index.html` + `daxini-ui.js` | Preserve iframe-backed `glass-window`, header, close action, and `window-content` class. |
| Route view root | `index.html` + `app/router.js` | Preserve hidden-state switching between route cards and home room. |
| Passport overlay/HUD | `index.html` + `daxini-passport.js` | Preserve DOM IDs used by bootstrap and form submission. |
| Minimap gesture grid | `index.html` + `pattern-tracer.js` | Preserve `#os-minimap`, `#trace-line`, `.dot`, `.dot-cell`, and `data-idx` contracts. |

## Animation and interaction contracts

- Room title changes fade by adjusting opacity and changing text after a timeout.
- Room nodes animate by scale/opacity after content changes.
- Gesture tracing updates SVG polyline points continuously.
- Pattern completion dispatches `os:pattern_locked` and clears visuals after a delay.
- Window open/close dispatches `os:window_opened` and `os:window_closed`.
- Passport verification dispatches `os:passport_verified`.

## DOM selector contracts

Future componentization must either keep these selectors stable or provide compatibility wrappers:

- `#room-title`
- `#window-manager`
- `#route-view-root`
- `#room-environment`
- `#identity-hud`
- `#zv-auth-overlay`
- `#zv-auth-form`
- `#zv-nfc-input`
- `#zv-auth-status`
- `#os-minimap`
- `#os-action-hint`
- `#trace-line`
- `#node-0`, `#node-1`, `#node-2`, `#node-3`, `#node-5`, `#node-6`, `#node-7`, `#node-8`
- `#dot-0` through `#dot-8`

## Visual migration rule

Any future migration should first wrap existing DOM/CSS rather than rewriting it. Extracting components is safe only after snapshotting the current root page and validating pixel-level or screenshot-level equivalence for home, active app, route card, auth overlay, and gesture states.
