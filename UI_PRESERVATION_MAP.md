# UI Preservation Map

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
