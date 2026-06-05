# Alchemist / ViaLogic / Zayvora Visual Engine Merge Recommendation

Date: 2026-06-04

## Executive Recommendation

Recommendation: **Option D — Alchemist Universe with static shell plus isolated engines/plugins**.

Do not perform a direct folder merge. Keep Alchemist as the user-facing static learning application. Treat ViaLogic as a concept-map/relationship engine that can become `package/logic-core` only after a stable data adapter is defined. Treat Zayvora Visual Engine as a renderer/generation service or renderer plugin, not as code embedded into the static app.

The target structure should be decided after approval, but the recommended direction is:

```text
Alchemist Universe
├── apps/
│   ├── alchemist/              # static browser quiz/session/export app
│   ├── vialogic/               # static thinker/concept map app, if kept standalone
│   └── visual-engine/          # Next.js/Node visual generation app/service
├── packages/
│   ├── zay-contracts/          # shared .ZAY/session/knowledge-book schemas
│   ├── logic-core/             # optional extracted ViaLogic data/model adapter
│   └── visual-core/            # optional renderer contract/client, not full media runtime
└── docs/
    └── integration maps, contracts, and migration plans
```

This is closest to the user's Option A conceptually, but avoids pretending that all three repositories have the same runtime. It also borrows from Option B only at the contract/package layer.

## Discovery Status

| Repository | Clone status | Inspection source | Confidence |
| --- | --- | --- | --- |
| Alchemist | Present as active workspace; fresh clone blocked by proxy | Local files | High |
| ViaLogic | `git clone` attempted; blocked by proxy 403 | GitHub web/raw fallback | Medium-high |
| Zayvora Visual Engine | `git clone` attempted; blocked by proxy 403 | GitHub web/raw fallback | Medium |

No source files were moved, renamed, deleted, merged, or refactored during this discovery phase. Documentation files only were created.

## Repository Purpose Summary

| Repository | Purpose | Primary role in ecosystem |
| --- | --- | --- |
| Alchemist | Browser-first chemistry quiz, session, vault, and export app | User-facing learning shell and knowledge asset creator |
| ViaLogic | Static thinker/concept map and relationship navigation system | Concept graph / reasoning-map visualization engine |
| Zayvora Visual Engine | Prompt-to-visual artifact generation and rendering pipeline | Rendering/generation engine or external visual service |

## Architecture Classification Matrix

| Repository | Application | Engine | Framework | Library | Prototype | Utility | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Alchemist | ✓ | Partial |  | Partial | ✓ | ✓ | Shipped app plus browser modules and publishing utilities |
| ViaLogic | ✓ | ✓ | Partial |  | ✓ |  | Static app wrapping reusable map/graph engines |
| Visual Engine | ✓ | ✓ | ✓ | Partial | ✓ | ✓ | Next.js app plus broad generation/rendering framework |

## Runtime and Deployment Matrix

| Repository | Browser static | Node | Python | Hybrid | Likely deployment |
| --- | --- | --- | --- | --- | --- |
| Alchemist | ✓ primary | ✓ tests/serverless scaffolding | ✓ publishing pipeline | ✓ repository, static shipped app | GitHub Pages/static hosting for app; backend/serverless only for payments/publishing |
| ViaLogic | ✓ primary | Not observed | Not observed | No | GitHub Pages/static hosting |
| Visual Engine | Client UI only | ✓ primary | Not observed | ✓ Node/Next/render workers | Node server, Vercel-style app, or worker/render infrastructure |

## Dependency Map

| Repository | External browser/CDN | npm packages | Python packages | Operational dependencies |
| --- | --- | --- | --- | --- |
| Alchemist | jsPDF CDN | None declared beyond scripts | FastAPI, Uvicorn, Pydantic, pytesseract, Pillow, pdfplumber, markdown, Jinja2, matplotlib, numpy, WeasyPrint, pypdf, pytest | Static hosting; optional serverless payment backend; optional Python build environment |
| ViaLogic | D3 CDN, Google Fonts | None observed | None observed | Static hosting |
| Visual Engine | None identified in inspected files | Next, React, React DOM, TypeScript, Node/React types | None observed | Node runtime; possible FFmpeg/Remotion/media rendering support |

## Capability Matrix

| Capability | Alchemist | ViaLogic | Visual Engine | Notes |
| --- | --- | --- | --- | --- |
| Quiz Engine | ✓ |  |  | Alchemist owns quiz/swipe learning flow |
| Session State | ✓ | Partial | Partial | Alchemist owns learning sessions; ViaLogic has local progression; Visual Engine has traces/jobs |
| Rule Engine | Partial | Partial | Partial | None is a clean general-purpose rules engine yet; ViaLogic relations may become reasoning-map input |
| Concept Graphs | Partial | ✓ | Partial | ViaLogic is strongest owner |
| Visualization | Partial | ✓ | ✓ | ViaLogic owns interactive graphs/maps; Visual Engine owns generated/rendered visuals |
| Diagram Rendering | Partial | Partial | ✓ | Alchemist Python diagrams exist; Visual Engine is broad renderer |
| Exports | ✓ |  | ✓ | Alchemist browser PDF/EPUB/.ZAY; Visual Engine artifact/PDF/video outputs |
| Knowledge Vault | ✓ | Partial | Partial | Alchemist owns learner vault; ViaLogic owns static entity knowledge; Visual Engine has outputs/memory |
| Reasoning Layer | Partial | Partial | Partial | Needs shared contracts; no direct merge yet |
| `.ZAY` Packaging | ✓ |  | Potential target | Alchemist owns current `.ZAY`; Visual Engine should consume it via adapter |
| Knowledge Book | ✓ |  | Potential renderer | Alchemist owns content generation/export; Visual Engine can render enhanced outputs later |
| Search | ✓ | ✓ | Unknown/partial | ViaLogic has entity search; Alchemist has vault search |
| Profile/detail views | Partial | ✓ |  | ViaLogic owns thinker profile/details |
| Media/video output |  |  | ✓ | Visual Engine owns this domain |
| Payments/credits | Partial |  | Partial | Both Alchemist and Visual Engine have scaffolding; needs one production strategy |

## Overlap Detection and Recommendation

| Overlap area | Alchemist | ViaLogic | Visual Engine | Recommendation | Rationale |
| --- | --- | --- | --- | --- | --- |
| Storage systems | `localStorage` for user/session/vault/credits | `localStorage` for sparks/levels | output folders/memory/artifacts; possible app state | **Merge contract, keep implementations separate initially** | Different semantics; avoid key collisions and runtime coupling |
| Session/progression | Learning sessions and review | Sparks/levels progression | Pipeline traces/jobs | **Keep Alchemist version for learning sessions** | Alchemist has the actual learner-session model |
| Export systems | PDF/EPUB/.ZAY/Knowledge Book | Not observed | PDF/artifacts/video/manifests | **Merge via adapter later** | Alchemist exports knowledge; Visual Engine renders media; both useful but not equivalent |
| Rendering systems | Browser DOM + jsPDF + EPUB builder | DOM/SVG/D3 map renderer | Next/Node render pipeline, HTML/PDF/video | **Keep all; integrate through renderer interfaces** | Runtimes differ sharply |
| Graph systems | Minimal concept/domain grouping | Entity/path graph, D3 graph view | Possible generated diagrams | **Keep ViaLogic version for interactive concept graph** | ViaLogic is already graph-oriented |
| UI components | Mobile swipe quiz UI | Map/profile/search UI | React/Next editor UI | **Do not merge UI components now** | Gesture and framework conflicts are likely |
| Payment/credits | Client credits + Stripe scaffolding | Not observed | billing/auth folders | **Do not merge; design one backend later** | Payment requires a backend and product decision |
| Knowledge data | `MASTER_VAULT.json` and user vault | `entities.json`, `paths.json`, `people/` | memory/evidence/outputs | **Create shared schema/contracts first** | Data shapes represent different domains |
| Reasoning relationships | Question logic/hints/traps | Entity paths/relationships | prompt plans/traces | **Merge conceptually, not structurally** | A shared reasoning schema is needed before code integration |

## Integration Readiness Assessment

### ViaLogic placement

Recommended: **C) Embedded engine later, with an intermediate standalone-app phase**.

Rationale:

1. ViaLogic is static and technically compatible with Alchemist's browser-only constraint.
2. Its pan/zoom/pinch navigation engine must not interfere with Alchemist's swipe/gesture core logic.
3. The safest near-term path is to keep ViaLogic as a separate static app while extracting a data adapter and renderer mount API.
4. Once a stable adapter exists, the map renderer can be embedded into Alchemist as a dedicated concept-map view or knowledge-graph panel.

Potential future boundary:

```text
logic-core input:
{
  nodes: [{ id, label, type, domain, summary, sourceRefs }],
  edges: [{ from, to, relation, weight, evidenceRefs }]
}

logic-core output:
- normalized graph data
- optional DOM/SVG renderer mount function
- search/profile lookup utilities
```

### Visual Engine placement

Recommended: **C) Renderer plugin**, not direct static embedding.

Rationale:

1. Visual Engine depends on Node/Next and render pipeline assumptions that are incompatible with Alchemist's GitHub Pages runtime.
2. Heavy outputs such as video, FFmpeg, Remotion, and media muxing should remain outside the browser-only app.
3. Alchemist can call a renderer plugin/service later with `.ZAY`, session, or Knowledge Book JSON and receive a deterministic render manifest or preview URL.
4. A small `visual-core` contract package could be useful, but the full repository should remain an app/service.

Potential future boundary:

```text
visual plugin input:
{
  zayPackage,
  sessionSummary,
  knowledgeBook,
  renderIntent: "diagram" | "lesson" | "video" | "carousel"
}

visual plugin output:
{
  manifest,
  previewHtml,
  artifacts: [{ type, urlOrBlob, metadata }],
  trace
}
```

## ZAY Ecosystem Mapping

```text
Questions
  │  owner today: Alchemist (MASTER_VAULT.json, quiz UI)
  ▼
Sessions
  │  owner today: Alchemist (session engine, review, local state)
  ▼
Reasoning
  │  owner today: partial/shared gap
  │  - Alchemist owns question logic/hints/traps
  │  - ViaLogic owns relationship/path graph semantics
  │  - Visual Engine owns prompt plans/traces
  ▼
Visualization
  │  owner today: split
  │  - ViaLogic owns interactive concept/person maps
  │  - Visual Engine owns generated/rendered visuals
  │  - Alchemist owns basic UI/export rendering
  ▼
Knowledge Book
  │  owner today: Alchemist (knowledge-book-exporter)
  ▼
.ZAY
  │  owner today: Alchemist (zay-compiler/importer/exporter)
  ▼
Vault
     owner today: Alchemist for learner vault;
                  ViaLogic for static entity/person knowledge;
                  Visual Engine for generated outputs/memory artifacts
```

### Layer Ownership Table

| Layer | Current owner | Secondary contributor | Future integration target |
| --- | --- | --- | --- |
| Questions | Alchemist | ViaLogic entities can enrich concept context | Alchemist remains authoritative for quiz items |
| Sessions | Alchemist | Visual Engine traces can attach to session artifacts | Alchemist session schema becomes shared contract |
| Reasoning | No single owner | ViaLogic relations + Alchemist logic + Visual traces | New shared reasoning schema after approval |
| Visualization | ViaLogic and Visual Engine | Alchemist display/export UI | Renderer adapter interfaces |
| Knowledge Book | Alchemist | Visual Engine can render enhanced versions | Keep Alchemist content model |
| `.ZAY` | Alchemist | Visual Engine should consume; ViaLogic can map graph exports | Promote `.ZAY` as ecosystem interchange package |
| Vault | Alchemist user vault | ViaLogic static knowledge graph | Vault adapter with source namespaces |

## Recommended Merge Strategy

### Do not choose pure Option A

A simple folder hierarchy such as:

```text
Alchemist Universe
├─ Alchemist
├─ ViaLogic
└─ Visual Engine
```

is understandable, but insufficient because it does not solve runtime separation, shared schemas, gesture isolation, or Node/static deployment boundaries.

### Do not choose pure Option B yet

Shared packages are attractive, but extracting packages before schemas are agreed would create premature architecture. ViaLogic and Visual Engine each need adapter contracts first.

### Do not choose pure Option C

Micro applications preserve isolation, but they do not define how `.ZAY`, sessions, knowledge books, reasoning maps, and visual renders interoperate.

### Choose Option D

Use a custom staged architecture:

1. **Documentation and contracts first**.
   - Keep this audit as the baseline.
   - Define shared `.ZAY`, session, concept graph, and render manifest schemas.
2. **Keep apps isolated initially**.
   - Alchemist remains static browser app.
   - ViaLogic remains static app or isolated embedded route.
   - Visual Engine remains Node/Next service/app.
3. **Extract only small contracts/adapters**.
   - `zay-contracts`: schema and validation only.
   - `logic-core`: graph normalization and optional renderer mount after ViaLogic is stable.
   - `visual-core`: render manifest/client contract only, not heavy media stack.
4. **Integrate by data exchange, not file merging**.
   - Alchemist emits `.ZAY` and Knowledge Book JSON.
   - ViaLogic maps `.ZAY` concepts into graph nodes/edges.
   - Visual Engine consumes `.ZAY`/Knowledge Book JSON and returns render manifests/artifacts.
5. **Only after approval, perform a surgical repo move or monorepo plan**.

## Integration Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Breaking Alchemist swipe/gesture UI | High | Do not import ViaLogic navigation globally; mount in isolated container/route only |
| Mixing static browser and Node/Next runtime | High | Keep Visual Engine external or in separate app folder with explicit deployment |
| Namespace collisions on `window` and `localStorage` | Medium | Require namespaced keys and module wrappers before embedding |
| Premature schema merge | High | Create shared contracts before moving source files |
| Payment/security confusion | High | Centralize production payment design; do not rely on client credits |
| CDN/CSP differences | Medium | Inventory and optionally vendor jsPDF/D3 later |
| README/source drift | Medium | Treat source tree and executable entry points as authority |
| Generated outputs in repo | Medium | Define artifact/output ignore and retention policy before monorepo merge |

## Proposed Approval Gate Before Any Integration

Before code integration, require explicit approval for these decisions:

1. Should the final repository be a monorepo, or should repositories remain separate with shared contracts?
2. Is GitHub Pages still mandatory for the Alchemist app?
3. Should `.ZAY` become the canonical interchange format across all systems?
4. Should ViaLogic be embedded into Alchemist UI or linked as a separate app?
5. Should Visual Engine run as a hosted service, local worker, or optional plugin?
6. What source-of-truth should own production payments and user identity?

## Final Recommendation

Proceed with **Option D: Alchemist Universe as a staged ecosystem**.

- **Alchemist** remains the primary learner-facing app and owner of questions, sessions, Knowledge Book export, `.ZAY`, and learner vault.
- **ViaLogic** becomes the concept/reasoning-map layer, initially separate, then optionally extracted as `logic-core` or embedded as an isolated graph view.
- **Zayvora Visual Engine** becomes the renderer/generation layer, accessed through a plugin/service contract rather than merged into the static app.
- **Shared packages** should be limited to schemas/contracts until integration behavior is approved.

No integration work should begin until the shared data contracts and runtime boundaries are approved.
