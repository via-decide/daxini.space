# Current Architecture

## Frontend/browser runtime helpers

The current runtime implementation includes three browser-side helpers in `runtime/`:

- `runtime/app-loader.js` loads an app bundle from the registry, resolves the runtime target, creates the state engine, and re-renders the bundle on state changes.
- `runtime/state-engine.js` provides the browser state helper used by runtime apps for state reads, merges, and subscriptions.
- `runtime/component-renderer.js` renders bundle components into DOM elements and applies state-based bindings.

These files are current frontend/browser runtime helpers. They are not the future backend runtime stack.

## Future Zayvora backend runtime stack

The future Zayvora backend runtime stack is defined separately from the browser helpers and is expected to include:

- Gateway
- Runtime Manager
- Workspace Runtime
- Execution Runtime
- Reasoning Runtime
- Model Gateway/Model Registry

## Compatibility rule

Preserve the existing browser runtime helpers unless they are replaced behind an SDK-compatible interface.
