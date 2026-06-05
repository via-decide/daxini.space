# ALCHEMIST_UI_INTEGRATION_LAYER_V1

## Purpose

Bridge swipe/selection UI interactions into Alchemist core systems through a non-invasive layer that listens and routes events without touching existing gesture logic.

## Design Philosophy

- zero UI disruption
- event-driven integration
- separation of concerns
- reversible hook lifecycle (`connect*` + `disconnect`)

## System

### Selection Hook

- listens for selection events (default: `alchemist:selection`)
- reads selection payload from `event.detail`
- uses adapter normalization before routing

### Integration Router

Routes normalized payload to:

- `ingestionEngine.ingest(...)`
- `blockSystem` (through ingestion engine)
- `sessionEngine` (session auto-start + block persistence)

Optional path:

- attach 3D block via `threeDBlock.create(...)` + `threeDBlock.addToSession(...)`

### Safe Adapter

- normalizes UI data into a strict shape:
  - `contentType`
  - `payload`
  - `attach3D`
  - `modelPath`
  - `interaction`
  - `sessionName`
- prevents raw UI payload from reaching core systems directly

## Rules

- DO NOT modify swipe logic
- DO NOT inject logic inside UI components
- ONLY listen + route
- ALL data must pass through adapter

## Integration Points

- selection layer event target
- gesture completion event (mapped to selection event in existing UI)
- end-of-session trigger (default: `alchemist:session:end`)

## Features Enabled

- content capture from swipe selection
- block creation through ingestion/block systems
- session storage updates
- compiler/export readiness via finalized session data

## Failure Handling

- on router failure: returns no-op result (`ok: false`) and UI flow can continue unchanged
- on session failures: catches errors and falls back to no-op behavior
- integration layer can be fully detached via `disconnect()`

## Success Criteria

- swipe UI unchanged
- selection triggers block creation
- session updates correctly
- no gesture breakage or UI lag from direct UI mutation

## DoD

- [x] integration layer implemented
- [x] selection hook working
- [x] session updates verified
- [x] swipe UI unaffected (non-invasive, listener-only)
- [x] module + test generated
