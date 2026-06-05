# ALCHEMIST_SESSION_ENGINE_V1

## Purpose
`session-engine.js` provides a deterministic session lifecycle manager for content assembly. It enforces a single non-finalized session, protects block data from outside mutation, and persists state through `localStorage` for reload continuity.

## Public API

### `startSession(name?)`
Creates a new session in `active` state.

### `addBlock(block)`
Adds a block object into the active session.
- Requires `block.id` (string)
- Rejects duplicate IDs
- Copies block data to prevent direct external mutation

### `removeBlock(id)`
Removes one block from the active session by ID.

### `setReviewing()`
Moves state from `active` → `reviewing`.

### `finalizeSession()`
Moves state from `active|reviewing` → `finalized`.

### `getSession()`
Returns a deep copy of the current session (or `null`).

### `reset()`
Clears persisted session state for the configured storage key.

## Session States
- `active`
- `reviewing`
- `finalized`

## Rules Enforced
- Only one active lifecycle session is allowed at a time.
- Blocks cannot be mutated directly from outside engine internals.
- All lifecycle transitions are deterministic and explicit.
- State persists in local storage (or injected storage adapter).

## Persistence
Default key: `alchemist_session_engine_v1`

`createSessionEngine({ storage, storageKey, now })` supports dependency injection for:
- browser `localStorage`
- future Zayvora file-system adapters (same `getItem/setItem/removeItem` shape)
- deterministic testing via `now()`
