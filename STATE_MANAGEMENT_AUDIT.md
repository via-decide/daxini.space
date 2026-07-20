# State Management Audit

## State categories

## URL state

- `?app={slug}` is the active app deep-link state for the root shell.
- `window.history.pushState` is used by `daxini-ui.js` for app open/close transitions.
- `app/router.js` uses path state for `/`, `/zayvora`, `/pricing`, and `/login`.

Risk: there are two routing concepts: path-based route cards and query-based app launch. Migration must keep them isolated or define precedence rules.

## In-memory state

### `DaxiniUI.state`

Fields:

- `focusSlug`
- `roomApps`
- `communityLoaded`
- `isLoadingShard`
- `history`

Responsibilities:

- determines active room focus,
- stores currently displayed room apps,
- prevents duplicate community feed loading,
- marks shard load state,
- stores an unused history array reserved for future use.

### Registry module state

- `APP_LIBRARY` starts as a copy of `CORE_APPS` and is mutated through `upsertApp`.
- Namespace shards and community apps mutate the same in-memory library.

### Pattern tracer state

- `path`
- `isTracing`
- DOM-derived dot references and SVG polyline reference.

### Passport state

- `isAuthenticated`
- `identity`
- `sessionNonce`

The persistent identity source of truth remains localStorage rather than this in-memory object.

### Runtime prototype state

`runtime/state-engine.js` creates isolated shallow state containers with subscription callbacks. It is not currently the central shell state store.

## Persistent browser state

| Key | Owner | Purpose | Migration requirement |
| --- | --- | --- | --- |
| `daxini_onboarding_complete` | root shell | first-visit onboarding gate | Must remain readable before app boot. |
| `sovereign_token` | `daxini-passport.js` | passport auth token | Must preserve guest/auth HUD compatibility. |
| `daxini_revocation_list` | `daxini-passport.js` | local revocation entries | Must preserve JSON array shape. |
| `daxini.workspace.apps` | `marketplace/app-launcher.js` | installed app records | Must preserve `{ slug, path, installed_at }` records. |

## Event state

- `os:pattern_locked` carries `{ seed, path }`.
- `os:window_opened` announces active iframe creation.
- `os:window_closed` announces active iframe removal.
- `os:passport_verified` carries passport verification detail.
- Native `visibilitychange` emits security telemetry through `main.js`.
- Native `popstate` is consumed by both `daxini-ui.js` and `app/router.js`.

## State risks

1. Multiple modules mutate browser history.
2. App registry state is mutable and globally exposed.
3. `localStorage` is read directly in modules and inline script.
4. Runtime prototype state is separate from shell state.
5. `DaxiniUI.closeActiveApp()` always pushes history, including during route handling.

## Recommended future state boundary

Add a compatibility state adapter later, but keep existing global objects and localStorage keys. The adapter should read from current sources rather than forcing immediate rewrites.
