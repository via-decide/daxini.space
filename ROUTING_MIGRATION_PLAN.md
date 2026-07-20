# Routing Migration Plan

## Current route families

| Route family | Paths / modules | Classification | Notes |
| --- | --- | --- | --- |
| Public static pages | `index.html`, `privacy.html`, `terms.html`, `contact.html`, `books.html`, `kindle.html`, `onboarding.html` | KEEP | Existing static entry points remain unchanged. |
| App routes | `apps/*/index.html` | KEEP | Existing app landing pages remain unchanged. |
| Workspace route | `apps/workspace/index.html` | KEEP | Current workspace entry point remains unchanged. |
| Marketplace route | `apps/marketplace/index.html` | KEEP | Current marketplace entry point remains unchanged. |
| Passport route | `passport/index.html` | KEEP | Current passport entry point remains unchanged. |
| Lightweight router module | `app/router.js` | KEEP | Existing browser-side routing module remains unchanged. |
| Server routing helpers | `server/router.js`, `server/app-router.js` | KEEP | Existing server helper modules remain unchanged. |

## Future route categories (planning only)

- Runtime routes: reserved for future runtime surfaces; no routes are added, removed, or renamed in this plan.
- Admin routes: reserved for future administrative surfaces; no routes are added, removed, or renamed in this plan.
- Enterprise routes: reserved for future enterprise surfaces; no routes are added, removed, or renamed in this plan.
