# Risk Analysis

## High-risk areas

### Onboarding redirect

The root inline script runs before the main app modules. Any migration that moves or delays it can change first-launch behavior. The `daxini_onboarding_complete` key and `?app=` exemption are critical compatibility requirements.

### Dual routing systems

Path routes and query app routes are handled by separate modules. Both listen to browser navigation events. Changing one system can accidentally alter the other, especially around back/forward behavior and `closeActiveApp()` history writes.

### Global mutable registry

`DaxiniRegistry.APP_LIBRARY` is globally exposed and mutated by community feed and shard loading. A framework store or backend sync layer could break identity/reference assumptions if it replaces rather than mutates compatible records.

### Iframe launch assumptions

The active app window is built by injecting string markup and setting iframe `src` from registry entries. Sanitization, CSP, or component migration can break app launch or close behavior if not staged carefully.

### DOM ID coupling

Modules directly query fixed IDs and classes. Renaming markup during component extraction would break passport, gesture, route, and window manager behavior.

### Storage compatibility

Local storage keys are user-state contracts. Renaming or changing shapes can log users out, repeat onboarding, lose workspace installs, or break revocation checks.

## Medium-risk areas

### Marketplace cache behavior

`marketplace/marketplace-ui.js` optionally uses `window.DaxiniCache`. Introducing a new cache layer could create stale listings unless TTL and invalidation behavior are preserved.

### Server path normalization

The server route helpers protect against traversal and map `/apps/{slug}` to static files. URL normalization changes can break nested static assets for apps.

### API write behavior

`api/apps/publish.js` writes directly into the repository app tree and registry file. This is convenient for local publishing but risky for concurrent writes, slug validation, and production deployment models.

### Trace privacy

`api/traces.js` hashes IP addresses and writes logs to `/tmp`. Retention, consent, and transport guarantees should be defined before expanding trace collection.

## Low-risk areas

### Runtime prototypes

The runtime state engine and component renderer are isolated and simple. They are low risk if they remain opt-in, but higher risk if made the default renderer without app-format migration.

### Shell helper readiness flags

`app/auth.js` and `app/ui.js` currently set readiness markers. They are safe to wrap if dataset side effects remain.

## Mitigations

1. Add route and storage contract tests before behavior changes.
2. Add screenshot baselines before UI extraction.
3. Introduce adapters without changing callers.
4. Preserve globals and events through compatibility layers.
5. Validate and sanitize externally supplied app records.
6. Keep network failures non-blocking.
