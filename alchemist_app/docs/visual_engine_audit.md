# Zayvora Visual Engine Repository Architecture Audit

Date: 2026-06-04
Repository: `https://github.com/via-decide/zayvora.visual-engine.git`
Source inspected: GitHub web/raw views because outbound `git clone` was blocked by the execution environment proxy.

## Source Acquisition

- Required clone command attempted: `git clone https://github.com/via-decide/zayvora.visual-engine.git`.
- Result: blocked by environment network/proxy with `CONNECT tunnel failed, response 403`.
- Fallback: repository root, README, `package.json`, `app.js`, `app/`, `core/`, `engine/`, `render/`, and selected source files were inspected through GitHub web/raw pages.
- Audit confidence: medium for full repository details because many subfolders are broad; high for runtime/dependency classification and major architectural intent.

## Purpose

Zayvora Visual Engine is a visual generation and rendering system. It takes prompts or structured creative intent, plans/generates variations, routes them through visual generation/execution pipelines, records traces, and produces renderable outputs such as HTML previews, video/render manifests, PDF artifacts, captions, briefs, evidence, and potentially Remotion/FFmpeg-based video outputs.

The repository solves the problem of transforming vague or structured inputs into deterministic visual artifacts and rendering workflows. It is closer to a generation/rendering platform than a static visualization widget.

## Architecture Classification

| Dimension | Finding |
| --- | --- |
| Primary classification | **Framework / Engine** |
| Secondary classifications | Application, pipeline utility, prototype |
| Runtime | **Hybrid Node/Next.js** with CommonJS pipeline modules and ES module app metadata |
| UI style | Next.js React app plus an older/static `app.js` browser client visible at root |
| State model | Request/response pipeline, generated artifacts, traces, manifests, output folders |
| Deployment model | Node server / Next.js; likely Vercel-compatible for app routes, but render workloads may require local/server workers and external binaries |

## Entry Points

| Entry point | Runtime | Status | Role |
| --- | --- | --- | --- |
| `package.json` | Node/npm | Active | Declares Next.js scripts and dependencies |
| `app/page.tsx` | Next.js/React | Active | Main web page in App Router structure |
| `app/layout.tsx` | Next.js/React | Active | App shell/layout |
| `app/api/generate/route.ts` | Next.js route | Active | API generation endpoint for UI requests |
| `app/editor/` | Next.js/React | Active/prototype | Editor UI area |
| `app.js` | Browser JS | Legacy/prototype | Reads input/mode, POSTs to `/api/generate`, renders trace and HTML iframe preview |
| `core/pipeline.js` | Node CommonJS | Active/core | Normalizes prompt spec, generates variations, plans/runs batches, aggregates results, builds PDF |
| `core/execution/*.js` | Node CommonJS | Active/core | Execution-level helpers visible under `core/execution/` |
| `engine/orchestrator.js` | Node/ES module re-export | Wrapper | Re-exports root `orchestrator.js` |
| `engine/visual_generation_engine.js` | Node/JS | Active/core | Visual generation engine module |
| `engine/render_target_router.js` | Node/JS | Active/core | Routes outputs to rendering targets |
| `engine/visual_trace_logger.js` | Node/JS | Active/core | Trace logging for visual generation |
| `render/video_renderer.js` | Node/JS | Active/render | Video render stage |
| `render/ffmpeg_pipeline.js` | Node/JS | Active/render | FFmpeg pipeline adapter |
| `render/remotion_adapter.js` | Node/JS | Active/render | Remotion integration adapter |
| `render/render_manifest.js` | Node/JS | Active/render | Render manifest generation |
| `render/audio_video_muxer.js` | Node/JS | Active/render | Audio/video muxing stage |
| `tests/` | Node/test files | Active check area | Pipeline and module validation |

## Module Structure

```text
zayvora.visual-engine/
├── app/                         # Next.js App Router UI/API
│   ├── api/                     # server route handlers, including generate endpoint
│   ├── editor/                  # editor UI
│   ├── layout.tsx               # application shell
│   └── page.tsx                 # main page
├── core/                        # generation pipeline primitives
│   ├── pipeline.js              # orchestrated generation pipeline
│   ├── prompt-spec.js           # prompt/spec normalization
│   ├── variation-engine.js      # prompt variation generation + stable hash
│   ├── execution-planner.js     # execution planning
│   ├── batch-runner.js          # batch execution
│   ├── result-aggregator.js     # result aggregation
│   ├── artifact-writer.js       # artifact persistence
│   ├── output-contract.js       # output shape/contracts
│   ├── pdf-builder.js           # PDF artifact build
│   ├── pipeline-validator.js    # pipeline validation
│   └── execution/               # execution helpers
├── engine/                      # visual orchestration wrappers and runtime engines
│   ├── local-generator.js
│   ├── orchestrator.js
│   ├── render_target_router.js
│   ├── visual_generation_engine.js
│   └── visual_trace_logger.js
├── render/                      # render target adapters and media pipeline
│   ├── audio_video_muxer.js
│   ├── ffmpeg_pipeline.js
│   ├── remotion_adapter.js
│   ├── render_manifest.js
│   └── video_renderer.js
├── visual/                      # visual domain helpers/assets
├── visual_eval/                 # visual evaluation helpers
├── research/                    # research modules
├── research_quality/            # quality/verification support
├── video_research/              # video research modules
├── narration/                   # narration generation/support
├── captions/                    # caption generation/support
├── audio/                       # audio support
├── briefs/                      # brief generation/support
├── evidence/                    # evidence artifacts/support
├── outputs/                     # generated outputs/artifacts
├── pipeline/                    # pipeline-level grouping
├── components/                  # UI components
├── hooks/                       # React hooks
├── integrations/                # external integrations
├── memory/                      # memory/context support
├── billing/                     # billing scaffold/support
├── auth/                        # auth scaffold/support
├── contracts/                   # interface/output contracts
├── remotion/                    # Remotion-related composition/support
├── youtube/                     # YouTube output/integration support
├── tests/                       # test suite
├── package.json                 # Next.js app metadata/dependencies
├── app.js                       # legacy/static client script
└── README.md                    # high-level older local-system description
```

## Data Flow

### Next.js/API generation flow

```text
User opens Next.js app page/editor
↓
React UI collects prompt, mode, or visual generation request
↓
Client sends request to app/api/generate/route.ts
↓
Core/engine modules normalize prompt spec and plan generation
↓
Variation, execution, batch, aggregation, tracing, and artifact writers run
↓
Render target router chooses HTML/PDF/video/remotion/ffmpeg outputs
↓
API returns trace, preview HTML/artifact metadata, or output references
↓
UI displays trace steps and preview/output
```

### Root `app.js` legacy/static client flow

```text
User enters input and mode
↓
app.js POSTs { input, mode, slideCount } to /api/generate
↓
API responds with trace steps and HTML
↓
app.js renders trace list and injects HTML into preview iframe via srcdoc
```

### Core pipeline flow observed in `core/pipeline.js`

```text
promptSpec
↓
normalizePromptSpec
↓
generateVariations
↓
planExecution
↓
runBatch
↓
aggregateResults
↓
buildPDF / artifact output
↓
trace object and generated output paths
```

## Dependency Analysis

### npm packages

`package.json` declares:

| Package | Version | Purpose |
| --- | --- | --- |
| `next` | `14.2.5` | Next.js application and API routes |
| `react` | `18.3.1` | UI runtime |
| `react-dom` | `18.3.1` | Browser DOM renderer |
| `@types/node` | `25.6.0` | TypeScript Node typings |
| `@types/react` | `19.2.14` | TypeScript React typings |
| `typescript` | `6.0.3` | TypeScript support |

### Browser/CDN dependencies

No CDN dependency was identified from inspected `package.json` and root `app.js`. The runtime relies on npm packages and bundled Next.js output.

### Python packages

No Python package manifest was identified in inspected repository listings.

### External binary/platform dependencies

The `render/ffmpeg_pipeline.js` and `render/remotion_adapter.js` names imply likely runtime dependence on FFmpeg and Remotion-compatible rendering capabilities. Even if npm dependencies are not fully declared in the inspected `package.json`, future integration should treat video rendering as a non-static server/worker concern.

## Deployment Model

| Component | Deployment fit | Notes |
| --- | --- | --- |
| Next.js app/API | Node server or Vercel-style deployment | `npm start` maps to `next start`; requires built Next app |
| Core pipeline | Node runtime | Uses CommonJS `require` in inspected `core/pipeline.js` |
| Video/render pipeline | Node worker/server with media tooling | FFmpeg/Remotion adapters are not GitHub Pages compatible |
| Static root `app.js` | Browser client only | Depends on `/api/generate`; not standalone without backend |

## Capability Inventory

| Capability | Present | Evidence/Notes |
| --- | --- | --- |
| Prompt-to-artifact generation | Yes | README and core pipeline modules |
| Visual generation engine | Yes | `engine/visual_generation_engine.js` |
| Trace logging | Yes | `engine/visual_trace_logger.js`, root `app.js` trace UI, core trace spans |
| Render target routing | Yes | `engine/render_target_router.js` |
| HTML preview/render | Yes | `app.js` injects returned HTML into iframe; README references deterministic HTML carousel |
| PDF output | Yes | `core/pdf-builder.js` and `buildPDF` call in pipeline |
| Video rendering | Yes/partial | `render/video_renderer.js`, `ffmpeg_pipeline.js`, `remotion_adapter.js` |
| Captions/narration/audio | Yes/partial | top-level `captions/`, `narration/`, `audio/` folders |
| Research/evidence | Yes/partial | `research/`, `research_quality/`, `evidence/`, `verification/` folders |
| Concept graph visualization | Possible/indirect | Visual modules can render diagrams, but no static concept-map ownership observed |
| Session state | Not central | Request/pipeline traces rather than learning sessions |
| Knowledge vault | Not central | Outputs/memory exist, but not Alchemist-style vault ownership |
| Billing/auth | Scaffolding | `billing/` and `auth/` folders visible |

## Architecture Diagram

```text
                 ┌──────────────────────────┐
                 │ Next.js app/ UI + editor │
                 └────────────┬─────────────┘
                              │ POST /api/generate
                              ▼
                 ┌──────────────────────────┐
                 │ app/api/generate route   │
                 └────────────┬─────────────┘
                              │ invokes
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         core/                               │
│ prompt spec → variations → planning → batch → aggregation   │
│ output contracts → artifacts/PDF                            │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────┐       ┌──────────────────────────┐
│ engine/                  │       │ render/                  │
│ orchestration + routing  │       │ video/remotion/ffmpeg    │
│ trace logging            │       │ manifests + muxing       │
└──────────────┬───────────┘       └────────────┬─────────────┘
               │                                │
               ▼                                ▼
       ┌───────────────┐               ┌────────────────┐
       │ preview HTML  │               │ outputs/ media │
       │ traces        │               │ PDFs/artifacts │
       └───────────────┘               └────────────────┘
```

## Risks and Constraints

1. **Not static-compatible**: This repository cannot be directly merged into Alchemist's GitHub Pages runtime without introducing Node/Next/server assumptions.
2. **Mixed module systems**: `package.json` declares `type: module`, while inspected `core/pipeline.js` uses CommonJS `require`. Integration should validate module boundaries before packaging.
3. **Broad scope**: Auth, billing, research, evidence, rendering, media, and UI folders indicate platform breadth; a surgical integration must select a narrow renderer contract.
4. **Media tooling risk**: FFmpeg/Remotion-style outputs are operationally heavier than Alchemist browser exports.
5. **README drift**: README references older folders such as `promptalchemy/`, `renderer/`, and `workspace/`, while the visible tree uses `app/`, `core/`, `engine/`, and `render/`. Treat repository tree/source as the current authority.

## Audit Conclusion

Zayvora Visual Engine should not be embedded wholesale into Alchemist. It is best treated as a renderer/generation service or plugin interface. If merged later, the first integration should be a narrow `visual-core` or renderer-plugin boundary that accepts `.ZAY`, session, or knowledge-book JSON and returns deterministic render manifests/HTML previews, while heavy video/media rendering remains outside the static browser runtime.
