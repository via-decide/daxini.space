# State Management Audit

This audit records observed state categories, current ownership, and the migration boundary for introducing backend-backed state while preserving browser behavior.

## Frontend-owned state
- Theme and visual preferences remain client-owned because they are device/browser presentation choices.
- Onboarding completion remains client-owned until product requirements need account-level onboarding sync.
- Current navigation position remains client-owned as ephemeral route, tab, panel, or scroll context.
- Transient overlays remain client-owned because modals, toasts, drawers, and popovers are short-lived UI state.
- Minimap and UI interaction state remains client-owned, including hover, focus, pan/zoom, selection, and expanded/collapsed controls.
- Local app launch state remains client-owned for first-run flags, launch affordances, and browser-local startup hints.

## Future backend-owned state
- Authenticated identity sessions should be SDK/backend-owned to support secure login, refresh, revocation, and cross-device continuity.
- Workspace records, project metadata, runtime status, execution jobs, reasoning traces, deployments, billing/entitlements, and audit logs should become backend-owned because they require durability, authorization, collaboration, server processing, or compliance history.

## Migration strategy
- Preserve current `localStorage` keys during the transition; do not rename or delete keys while existing UI reads depend on them.
- Introduce an SDK-backed compatibility layer that reads existing browser keys first, mirrors compatible values to backend-aware APIs, and exposes the same shapes expected by current UI code.
- Migrate data server-side only after existing UI reads remain backward-compatible, with fallbacks that tolerate unmigrated local records and partially synced backend records.
