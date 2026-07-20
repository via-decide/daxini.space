# API Boundary Spec

## Browser runtime boundary

The current browser runtime boundary is implemented by these frontend helpers:

- `runtime/app-loader.js` is the browser app loading boundary for registry lookup, bundle loading, state engine creation, and renderer coordination.
- `runtime/state-engine.js` is the browser state boundary for state snapshots, state updates, and subscriber notifications.
- `runtime/component-renderer.js` is the browser rendering boundary for DOM component creation and state-bound attributes.

These files are current frontend/browser runtime helpers, not backend runtime services.

## Future Zayvora backend runtime boundary

The future Zayvora backend runtime stack is separate and should expose backend-facing boundaries for:

- Gateway
- Runtime Manager
- Workspace Runtime
- Execution Runtime
- Reasoning Runtime
- Model Gateway/Model Registry

## SDK compatibility boundary

Existing browser runtime helpers should be preserved unless they are replaced behind an SDK-compatible interface.
