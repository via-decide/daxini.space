# .ZAY Format V2

Date: 2026-06-04

## Schema

`.ZAY` v2 keeps legacy `meta`, `content`, `vault`, and `state` fields while adding canonical top-level Alchemist Universe fields.

```json
{
  "format": "zay",
  "version": "2.0",
  "source": "alchemist",
  "session": {},
  "questions": [],
  "logic": {
    "engine": "ViaLogic",
    "version": "0.1.0-browser",
    "rulesApplied": [],
    "weakDomains": [],
    "weakConcepts": [],
    "nextActions": [],
    "conceptGraph": { "nodes": [], "edges": [] }
  },
  "visuals": {
    "engine": "ZayvoraVisualEngine",
    "version": "0.1.0-browser",
    "diagrams": [],
    "graphLayout": {},
    "renderedAt": "2026-06-04T00:00:00.000Z"
  },
  "exports": {
    "knowledgeBookReady": true
  },
  "meta": {},
  "content": {},
  "vault": {},
  "state": {}
}
```

## Sample Export

```json
{
  "format": "zay",
  "version": "2.0",
  "source": "alchemist",
  "session": {
    "sessionId": "SES_SAMPLE",
    "createdAt": "2026-06-04T00:00:00.000Z",
    "questionCount": 1
  },
  "questions": [
    {
      "id": "Q1",
      "domain": "Physical Chemistry",
      "concept": "Entropy",
      "question": "What is entropy?",
      "answer": "Disorder measure",
      "logic": "Entropy measures dispersal of energy."
    }
  ],
  "logic": {
    "engine": "ViaLogic",
    "version": "0.1.0-browser",
    "rulesApplied": ["domain-classification"],
    "weakDomains": [],
    "weakConcepts": [],
    "nextActions": [{ "type": "export", "label": "Export Knowledge Book", "reason": "Session complete.", "priority": 80 }],
    "conceptGraph": { "nodes": [], "edges": [] }
  },
  "visuals": {
    "engine": "ZayvoraVisualEngine",
    "version": "0.1.0-browser",
    "diagrams": [],
    "graphLayout": {},
    "renderedAt": "2026-06-04T00:00:00.000Z"
  },
  "exports": { "knowledgeBookReady": true }
}
```

## Backward Compatibility

Existing `.ZAY` consumers that read `meta.version`, `content.blocks`, `vault.entities`, or `state.sessionId` continue to work because those fields are still emitted. New consumers should prefer the top-level `format`, `version`, `session`, `questions`, `logic`, `visuals`, and `exports` fields.
