# Component Preservation

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
