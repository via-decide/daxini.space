# SOURCES_OF_TRUTH.md

## Canonical Repository Declarations
> **This document is the authoritative boundary declaration for the VIA/Daxini ecosystem.**
> Last updated: 2026-08-16. Any manual edit to an embedded copy must be migrated here first.

---

## Canonical Sources

| Product | Canonical Repository | Deployment Mirror |
|---|---|---|
| ViaLogic Atlas & Biographies | `via-decide/ViaLogic` | `daxini.space/apps/vialogic` |
| Alchemist Session Engine | `via-decide/alchemist_app` | `daxini.space/alchemist` |

### Rules
1. **One-way flow only.** `ViaLogic` → `daxini.space/apps/vialogic`. Never the reverse.
2. **No manual edits to mirrors.** All profile, graph, and registry changes happen in the standalone canonical repo.
3. **Pabitra Krishna Bhattacharya** — canonical source is `via-decide/ViaLogic/people/pabitra-krishna-bhattacharya/`. The PR #46 copy in the embedded folder is now superseded.
4. **New researchers** are added to `via-decide/ViaLogic` first, then synced outward.

---

## Data Inventory (2026-08-16)

### ViaLogic Standalone
- Map entities: 111 (was 98 — added Pabitra + 12 Indian historical figures)
- Registry records: 111
- People folders with UI: 111
- people/registry.json: 111 slugs (fixed — was missing, causing 10-result search bug)

### ViaLogic Alignment Status
| Inventory | Count | Notes |
|---|---|---|
| Map nodes (entities.json) | 111 | All folders now have a map node |
| Registry records | 111 | All registry records match a folder |
| People folders | 111 | All folders appear on map and in registry |
| people/registry.json (flat) | 111 | Restored — this was the broken search root cause |

---

## Known Deferred Items

- `docs/history/` packages (123 sets) are not yet wired to the profile renderer UI.
- ViaLogic → Alchemist knowledge adapter: not yet built.
- Alchemist CI failure: not yet repaired.
- Licensing boundary: `daxini.space/alchemist` lacks the standalone proprietary LICENSE.

---

## Monetisation Boundary

| Layer | Repo | Model |
|---|---|---|
| Discovery, citation, SEO | `via-decide/ViaLogic` | Free / open |
| Sessions, mastery, exports | `via-decide/alchemist_app` | Paid |

One evidence source generates multiple monetisable formats. Do not manually duplicate content across repositories.
