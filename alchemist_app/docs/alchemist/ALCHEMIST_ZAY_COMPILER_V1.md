# ALCHEMIST_ZAY_COMPILER_V1

## Purpose
Convert a finalized Alchemist session into a portable `.zay` package blueprint with deterministic output.

## Input
Session data object:
- `id`, `name`, `state`, timestamps
- `blocks[]` with all compiled session blocks

## Output
A `.zay` package object:
- `fileName`: `<session-id>.zay`
- `manifest`: compiler and session metadata
- `entries`: sorted file entries
- `bytes`: deterministic serialized payload

## Includes
The package always includes:
- `manifest.json`
- `content/session.json`
- `assets/index.json`
- `state/session-state.json`

## Rules
- Only `state: "finalized"` sessions can compile.
- Partial sessions are rejected with `ZAY_SESSION_NOT_FINALIZED`.
- Missing blocks array is rejected with `ZAY_SESSION_BLOCKS_REQUIRED`.

## Success Criteria Mapping
- Valid `.zay` generated via `createZayPackage()`.
- Package includes all required directories and manifest.
- Deterministic output ensured via stable key sorting and entry path sorting.

## Module Output
1. **Package builder**: `createZayPackage(session, options)`
2. **Manifest generator**: `createManifest(session, options)`
