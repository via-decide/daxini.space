# Alchemist Universe Architecture

Date: 2026-06-04

## Purpose

Alchemist Universe keeps **Alchemist** as the user-facing learning environment while adding browser-safe reasoning and visualization layers.

```text
Questions
↓
Alchemist Session Engine
↓
ViaLogic Reasoning Engine
↓
Zayvora Visual Engine
↓
Knowledge Book Export
↓
.ZAY Vault
```

## Runtime Contract

- GitHub Pages compatibility is preserved.
- Root deployment files stay at the repository root: `index.html`, `MASTER_VAULT.json`, and `sw.js`.
- No backend, bundler, framework migration, binary generation, or canvas dependency is introduced.
- New package modules are browser-safe IIFEs with CommonJS test compatibility.

## Folder Layout

```text
apps/
├── alchemist/       # future app mirror; root index.html remains deployed app
├── logic-lab/       # future static ViaLogic workspace
└── visual-engine/   # future static visual workspace

packages/
├── kernel/          # session orchestration adapters
├── logic-core/      # ViaLogic reasoning API
├── visual-core/     # Zayvora lightweight SVG/HTML renderer API
├── zay-format/      # .ZAY v2 package builder
└── shared-ui/       # reserved vanilla shared UI helpers
```

## Layer Ownership

| Layer | Owner | Runtime |
| --- | --- | --- |
| Questions | Alchemist | Static JSON + browser UI |
| Session Engine | Alchemist | Root `index.html` and existing kernel modules |
| Reasoning Engine | ViaLogic | `packages/logic-core/vialogic.js` |
| Visualization Engine | Zayvora Visual Engine | `packages/visual-core/zayvora-visual-engine.js` |
| Knowledge Book Export | Alchemist with reasoning/visual sections | Existing exporter modules |
| `.ZAY` Vault | Alchemist `.ZAY` v2 | `packages/zay-format/zay-v2.js` |

## Failure Behavior

If `window.ViaLogic` is unavailable, Alchemist still completes sessions and shows `Reasoning engine unavailable.` If `window.ZayvoraVisualEngine` is unavailable, Alchemist still completes sessions and shows `Visual engine unavailable.` If both are missing, the app behaves like the previous Alchemist flow with exports intact.
