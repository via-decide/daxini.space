# ALCHEMIST_INGESTION_ENGINE_V1

## Purpose
`ingestion-engine.js` provides a controlled input pipeline that transforms user input into structured blocks and stores them in the active session lifecycle.

## Flow
`input → parse → block → session`

## Public API

### `parseInput(input)`
Converts raw incoming input into typed block content candidates.

Rules enforced:
- input object required
- supported types only (`text`, `note`, `link`, `3d`)
- empty string payloads rejected
- HTML characters escaped to prevent injection (`<`, `>`, `&`, quotes)

### `createIngestionEngine({ blockSystem, sessionEngine, now })`
Creates a bridge instance with deterministic dependencies.

### `ingest(input)`
Pipeline execution:
1. Parse and sanitize input.
2. Create typed block through `blockSystem.createBlock(...)`.
3. Generate block id.
4. Store block via `sessionEngine.addBlock(...)`.
5. Return `{ blockId, block, session }`.

## Rules
- No direct/raw input storage.
- Must pass through block system.
- Must store through session engine.
- No HTML injection (sanitized content).

## Success Criteria Mapping
- User input becomes structured block ✅
- Block stored in session ✅
