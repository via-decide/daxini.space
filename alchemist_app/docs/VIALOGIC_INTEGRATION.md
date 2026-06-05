# ViaLogic Integration

Date: 2026-06-04

## Imported Files

Reusable reasoning logic is implemented in:

- `packages/logic-core/vialogic.js`
- `packages/kernel/alchemist-universe-session.js`

Demo-only ViaLogic map UI is intentionally not imported into core logic to avoid gesture conflicts with the Alchemist swipe interface.

## Browser API

`packages/logic-core/vialogic.js` exposes:

```js
window.ViaLogic = {
  evaluateQuestion,
  evaluateSession,
  buildConceptGraph,
  suggestNextAction,
  classifyDomain,
  classifyConcept,
  getVersion
};
```

## Session Integration Point

Root `index.html` now loads ViaLogic before export modules. On session review, Alchemist builds a normalized session envelope, calls `ViaLogic.evaluateSession()`, and stores the output at `session.logic`.

The stored metadata includes:

- `version`
- `evaluatedAt`
- `rulesApplied`
- `weakDomains`
- `weakConcepts`
- `nextActions`
- `conceptGraph`

## UI Fallback

If ViaLogic is missing, the app does not crash. The session review card displays:

```text
Reasoning engine unavailable.
```

Exports still run with empty reasoning metadata.
