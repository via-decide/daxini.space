# Visual Engine Integration

Date: 2026-06-04

## Imported Files

Reusable visualization logic is implemented in:

- `packages/visual-core/zayvora-visual-engine.js`
- `packages/kernel/alchemist-universe-session.js`

The Node/Next/video-generation parts of zayvora.visual-engine are not imported because Alchemist must remain GitHub Pages compatible.

## Renderer API

`packages/visual-core/zayvora-visual-engine.js` exposes:

```js
window.ZayvoraVisualEngine = {
  renderConceptMap,
  renderLearningPath,
  renderSessionGraph,
  renderKnowledgeBookDiagram,
  serializeDiagram,
  getVersion
};
```

## Graph Format

Renderers accept ViaLogic graph objects:

```json
{
  "nodes": [
    { "id": "domain_physical", "label": "Physical Chemistry", "type": "domain", "weight": 2 },
    { "id": "concept_entropy", "label": "Entropy", "type": "concept", "domain": "Physical Chemistry", "weak": true }
  ],
  "edges": [
    { "from": "domain_physical", "to": "concept_entropy", "relation": "contains", "weight": 1 }
  ]
}
```

## Render Targets

- DOM element: `renderSessionGraph(container, graph)` writes inline SVG or fallback HTML.
- Inline SVG string: `serializeDiagram(graph)` returns SVG when nodes exist.
- HTML fallback: when no graph is available, the renderer returns text fallback markup.

## Failure Fallback

If the Visual Engine is missing or throws, session completion continues and the UI shows:

```text
Visual graph unavailable. Reasoning summary is still available.
```
