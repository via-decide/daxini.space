# Technical Debt Report

## Overview

The current codebase is a functional vanilla static app with several prototype layers. Its main debt is not lack of capability, but implicit contracts spread across global objects, fixed DOM IDs, direct localStorage reads, and multiple route layers.

## Debt items

### Inline monolithic shell

`index.html` owns extensive CSS, layout, overlays, markup, and boot-critical redirect logic. This makes visual changes risky because structure, styling, and behavior contracts are colocated.

Recommended action: document selectors first, then extract CSS/partials only with screenshot parity tests.

### Global namespace coupling

Modules expose and consume globals such as `DaxiniUI`, `DaxiniRegistry`, `DaxiniPassport`, `DaxiniRuntimeState`, `DaxiniComponentRenderer`, `DaxiniMarketplaceUI`, and `AppRouter`.

Recommended action: add compatibility facades before introducing imports or framework components.

### Multiple routing layers

Path routing, query routing, marketplace navigation, and server static app routing are separate. This creates ambiguity around route precedence and history behavior.

Recommended action: create a route manifest and contract tests before unifying routing.

### Mutable registry records

The app library is a mutable in-memory array initialized from core apps and updated by remote/community/shard sources.

Recommended action: define app-record schemas and validation while preserving current accepted shapes.

### String-based HTML injection

Some UI surfaces are built with template strings and assigned to `innerHTML`, including room nodes, iframe windows, route cards, and passport HUD content.

Recommended action: move toward DOM construction or sanitized templates in future phases, but keep markup-compatible output.

### Direct localStorage access

Storage keys are read in the root shell, passport module, marketplace launcher, and revocation logic.

Recommended action: add a storage adapter with the same keys and shapes, then migrate callers gradually.

### Prototype runtime split

The JSON runtime loader/state/renderer path is separate from the current static iframe app model.

Recommended action: decide whether runtime bundles are experimental or first-class. If first-class, add explicit app type metadata.

### API robustness gaps

Publish and trace endpoints are useful stubs but need stronger validation, production-safe persistence, authentication, rate limiting, and audit logging before broad use.

Recommended action: harden behind the existing request/response contracts.

### CSS token drift

Design tokens and component styles are embedded in the shell, while marketplace cards also use inline styles.

Recommended action: inventory tokens and extract shared CSS after visual baselines exist.

## Prioritized remediation

1. Add tests and screenshots for current behavior.
2. Freeze API, route, storage, event, and selector contracts.
3. Add schema validation for app records and API payloads.
4. Introduce optional adapters while preserving globals.
5. Extract UI/CSS in small parity-checked slices.
6. Harden backend stubs and routing helpers.
