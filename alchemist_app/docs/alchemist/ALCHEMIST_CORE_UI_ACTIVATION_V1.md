# ALCHEMIST_CORE_UI_ACTIVATION_V1
## Purpose
Activate Alchemist session/block/ingestion/review/publish behavior from swipe UI via listeners only.
## Design Philosophy
UI is read-only; orchestration is external; communication uses events and hooks.
## System
`createUIActivation(...).init()` binds `onSwipeComplete`,`onSelection`,`onSessionEnd`,`onReviewDecision`; `routeEvent()` fans out to `ingestionEngine.ingest`,`blockSystem.validateBlock`,`sessionEngine.getSession`,`reviewMode.enterReviewMode|trackDecision`,`publishFlow.publishSession`.
## Rules
No swipe core mutation, no DOM injection, no blocking paths, no global leaks beyond `AlchemistUIActivation` export.
## Reversibility
`disable()` removes every listener so swipe UI keeps working with activation off (fallback no-op on module failure).
## Success Criteria
Swipe behavior unchanged; selections ingest to blocks; sessions/review/publish flow activate in background without lag.
