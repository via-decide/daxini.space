# Incremental Migration Roadmap

## Guiding rule

Every migration step must be reversible and must preserve current production runtime behavior until a phase explicitly opts into a new path with compatibility fallback.

## Milestone 1: Baseline documentation

- Add architecture, UI, state, routing, API, risk, and debt documents.
- Record current app pages under `apps/*/index.html`.
- Identify global objects, event names, storage keys, and DOM IDs.

## Milestone 2: Non-invasive test harness

- Add static tests for pure modules such as route detection, state engine, component renderer, cache headers, and app route resolver.
- Add browser smoke tests that load the root shell without modifying runtime code.
- Add screenshot baselines for home, app-open, route-card, and auth overlay states.

## Milestone 3: Compatibility adapters

- Add optional adapters for registry fetches, marketplace index fetches, trace submission, and publish calls.
- Keep existing modules as the default runtime entry points.
- Validate adapter output against current app record shapes.

## Milestone 4: CSS and DOM extraction

- Extract CSS only after screenshot parity exists.
- Extract root shell partials into components only when the generated DOM keeps selectors and class names stable.
- Maintain script ordering and DOM readiness expectations.

## Milestone 5: State consolidation

- Create a compatibility state facade that reads/writes existing `DaxiniUI.state`, registry arrays, URL query state, and localStorage keys.
- Avoid changing callers initially.
- Add event replay tests for gesture launch and close behavior.

## Milestone 6: Backend hardening

- Add schema validation to API stubs.
- Add auth/rate-limit controls to publish and trace endpoints.
- Add durable storage behind API boundaries while preserving static/local fallback.

## Milestone 7: Route unification

- Introduce route manifest and compatibility router.
- Preserve all existing URLs.
- Use redirects only after app pages and marketplace launcher paths are verified.

## Milestone 8: Runtime app platform

- Decide whether the JSON runtime prototype should become a supported app format.
- If supported, add a registry field that distinguishes iframe static apps from runtime-rendered bundles.
- Keep iframe launch as the default for existing apps.

## Exit criteria

A migration phase is complete only when current URLs, storage keys, globals, events, and visual states pass parity checks.
