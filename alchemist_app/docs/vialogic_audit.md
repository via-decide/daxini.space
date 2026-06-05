# ViaLogic Repository Architecture Audit

Date: 2026-06-04
Repository: `https://github.com/via-decide/ViaLogic.git`
Source inspected: GitHub web/raw views because outbound `git clone` was blocked by the execution environment proxy.

## Source Acquisition

- Required clone command attempted: `git clone https://github.com/via-decide/ViaLogic.git`.
- Result: blocked by environment network/proxy with `CONNECT tunnel failed, response 403`.
- Fallback: repository root, README, `index.html`, `ui/map-engine.js`, and visible tree listings were inspected through GitHub web/raw pages.
- Audit confidence: medium-high for top-level architecture, runtime, dependencies, and major modules; lower for uninspected individual person/entity content files.

## Purpose

ViaLogic is a global UI/UX knowledge network and thinker-map application. It represents people, thinkers, or concepts as data-driven entities, renders them on a large interactive map, displays paths/relationships between them, and offers profile/search/graph views.

The repository solves the problem of browsing and navigating a conceptual lineage graph without changing UI code for standard data contributions. Contributors add records to JSON data and `people/` folders, while the reusable UI systems render the network.

## Architecture Classification

| Dimension | Finding |
| --- | --- |
| Primary classification | **Engine** |
| Secondary classifications | Application, framework-like UI map system |
| Runtime | **Static browser app** |
| UI style | Vanilla HTML/CSS/JavaScript IIFE modules |
| State model | Static JSON plus `localStorage` for sparks/levels/progression |
| Deployment model | GitHub Pages/static hosting compatible |

## Entry Points

| Entry point | Runtime | Status | Role |
| --- | --- | --- | --- |
| `index.html` | Browser static | Active | Main ViaLogic app shell, intro overlay, view containers, script loader |
| `ui/map-engine.js` | Browser JS | Active | Orchestrates data loading, scenery generation, progression, and path rendering |
| `ui/router.js` | Browser JS | Active | View routing between atlas, people, graph, and profile views |
| `ui/nav.js` | Browser JS | Active | Navigation link initialization |
| `ui/search.js` | Browser JS | Active | People/entity search UI |
| `ui/people-profile.js` | Browser JS | Active | Thinker/person profile rendering |
| `ui/graph-view.js` | Browser JS + D3 | Active | Relationship graph visualization |
| `ui/navigation.js` | Browser JS | Active | Pan, wheel zoom, pinch zoom, and entity centering |
| `ui/entity-renderer.js` | Browser JS | Active | Creates thinker entity DOM from JSON records |
| `ui/modal-system.js` | Browser JS | Active | Thinker detail modals and upgrade actions |
| `data/entities.json` | Static JSON | Active | Main entity data source |
| `data/paths.json` | Static JSON | Active | Relationship/path data source |
| `people/` | Static content | Active data | Person/thinker-specific content folders |
| `golden-ratio.html` | Browser static | Side page/prototype | Standalone visual/math page |
| `daxini-renderer.js` | Browser JS | Utility/prototype | Renderer utility at repository root |
| `registry-loader.js`, `people-registry.json` | Browser/static JSON | Utility/data | Registry loading for people data |

## Module Structure

```text
ViaLogic/
├── index.html                 # active static app shell
├── styles/                    # global app styles
├── ui/                        # reusable map and UI systems
│   ├── map-engine.js          # data loading, map orchestration, progression
│   ├── entity-renderer.js     # entity DOM/card rendering
│   ├── navigation.js          # pan/zoom/centering gestures
│   ├── modal-system.js        # entity detail and upgrades
│   ├── router.js              # view routing
│   ├── nav.js                 # nav population
│   ├── search.js              # search interaction
│   ├── graph-view.js          # D3 graph view
│   └── people-profile.js      # profile page rendering
├── data/
│   ├── entities.json          # nodes/entities
│   └── paths.json             # relationships/edges
├── people/                    # individual thinker/person content folders
├── core/                      # support logic/utilities visible in tree
├── .codex/                    # repo instructions/context
├── artifacts/                 # execution artifacts
├── README.md                  # architecture summary
├── people-registry.json       # registry data
├── registry-loader.js         # registry loading utility
├── daxini-renderer.js         # renderer utility/prototype
└── golden-ratio.html          # standalone static visual page
```

## Data Flow

```text
User opens index.html
↓
Static shell loads CSS, Google Fonts, D3 CDN, and ui/*.js scripts
↓
Router/nav initialize views after DOMContentLoaded
↓
map-engine fetches data/entities.json and data/paths.json
↓
entity-renderer creates thinker entities; map-engine renders SVG paths
↓
navigation.js handles pan/zoom/pinch/centering
↓
modal-system/profile/search/graph modules display detail views
↓
localStorage records sparks and entity levels for lightweight progression
```

## Dependency Analysis

### Browser/CDN dependencies

| Dependency | Location | Purpose | Risk |
| --- | --- | --- | --- |
| D3 `https://d3js.org/d3.v7.min.js` | `index.html` | Graph visualization | CDN availability, global `d3` coupling |
| Google Fonts Inter | `index.html` | Typography | External font loading/privacy/CSP concerns |

### npm / Node packages

No `package.json` was visible at the repository root in the GitHub file listing. The inspected architecture appears to be static browser-only with no npm package manager dependency.

### Python packages

No Python package manifest was visible in the inspected repository listing.

## Deployment Model

ViaLogic is compatible with GitHub Pages or any static hosting provider because the app is loaded from `index.html`, static CSS/JS, and static JSON data files. No server runtime is required for the inspected core functionality.

## Capability Inventory

| Capability | Present | Evidence/Notes |
| --- | --- | --- |
| Concept/thinker graph | Yes | `data/entities.json`, `data/paths.json`, `ui/graph-view.js` |
| Map/atlas renderer | Yes | `ui/map-engine.js`, `ui/entity-renderer.js`, SVG paths layer |
| Search | Yes | `ui/search.js` and people view |
| Profile/detail views | Yes | `people/`, `people-profile.js`, modal system |
| Progression/game layer | Yes, lightweight | `via_logic_sparks`, level keys in localStorage, upgrade costs |
| Rule/reasoning layer | Limited | Relationships are data-driven but not a general inference engine |
| Exports | Not observed | No export module visible in inspected entry points |
| Knowledge vault | Partial | Data repository of entities/people, but not a user-owned vault |
| Session state | Minimal | Local progression state; no learning session engine comparable to Alchemist |
| Visualization | Yes | Map paths, graph view, D3, scenery layer |

## Architecture Diagram

```text
                 ┌─────────────────────┐
                 │     index.html      │
                 │ static app shell    │
                 └──────────┬──────────┘
                            │ loads
                            ▼
┌─────────────────────────────────────────────────────┐
│                       ui/                           │
│ router | nav | search | profile | graph | modal     │
│ map-engine | entity-renderer | navigation           │
└──────────────┬───────────────────────────┬──────────┘
               │ fetches                   │ stores
               ▼                           ▼
     ┌─────────────────────┐       ┌─────────────────────┐
     │ data/entities.json  │       │ localStorage        │
     │ data/paths.json     │       │ sparks + levels     │
     └──────────┬──────────┘       └─────────────────────┘
                │
                ▼
     ┌─────────────────────┐
     │ Atlas / graph views │
     │ thinker map + D3    │
     └─────────────────────┘
```

## Risks and Constraints

1. **Gesture/navigation ownership**: ViaLogic has its own pan/zoom/pinch navigation engine. If integrated into Alchemist, it should be isolated to avoid interfering with Alchemist swipe/gesture logic.
2. **Global browser modules**: Script-loaded modules likely attach to `window`; namespace collisions should be reviewed before embedding.
3. **Static data shape dependency**: Entities and paths are the core contract. Any merge should define adapters rather than rewriting data immediately.
4. **External CDNs**: D3 and Google Fonts are external runtime dependencies.
5. **Progression state naming**: `via_logic_*` localStorage keys should remain namespaced if embedded.

## Audit Conclusion

ViaLogic is best understood as a visualization/navigation engine for concept lineage and thinker networks, with a static app shell around it. For an Alchemist Universe merge, it should not replace Alchemist. It should be retained as a separate app or extracted later as a package/engine that can render concept graphs from Alchemist `.ZAY` or session/knowledge-book data through an adapter.
