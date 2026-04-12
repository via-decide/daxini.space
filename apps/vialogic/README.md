# ViaLogic

## Global UI/UX Engine

The root experience is now powered by a reusable map engine with modular UI systems:

- `ui/map-engine.js` orchestrates data loading, scenery generation, progression, and path rendering.
- `ui/entity-renderer.js` dynamically creates thinker entities from `data/entities.json`.
- `ui/navigation.js` provides pan, wheel zoom, pinch zoom, and entity centering.
- `ui/modal-system.js` handles thinker detail modals and upgrade actions.

### Data-driven contributions

To add a new thinker:

1. Add an entry in `data/entities.json`.
2. Add a thinker folder under `people/`.
3. Optionally add a relation in `data/paths.json`.

No UI code changes are required when adding standard entities.
