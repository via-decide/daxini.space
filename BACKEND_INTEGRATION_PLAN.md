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
