# ALCHEMIST_SESSION_REVIEW_MODE_V1

## Purpose

Convert final cards into an intuitive decision flow where each card becomes a decision unit for keep/discard/publish.

## Design Philosophy

- Gesture-first decisions (not button-first)
- Progressive card-by-card review (not a bulk screen)
- Low cognitive load through immediate visual state cues
- Non-invasive adaptation of existing swipe cards

## Interaction Model

### Card States

- `undecided`
- `kept`
- `discarded`
- `publish-ready`

### Gestures

- Swipe right → `keep`
- Swipe left → `discard`
- Swipe up → `publish candidate`

### Visual Feedback (UI Adapter)

- Subtle color accents per state
- Overlay icons (`✓`, `✕`, `↑`)
- Smooth continuation transitions from normal swipe flow

## System

### Review Controller

Implemented in `kernel/alchemist/session-review.js` as `AlchemistSessionReview.create()`.

Core methods:
- `enterReviewMode()`
- `trackDecision(blockId, action)`
- `trackGesture(blockId, gesture)`
- `getFinalCard()`
- `finalizeReview()`

### Decision Store

Internal in-memory state manager:
- stores one decision record per block
- tracks publish-ready subset
- derives final summary counts (`kept`, `discarded`, `publishReady`, `undecided`)

## Rules

- No modal interruptions
- No button-heavy decision UX
- Must feel like swipe continuation
- Reuses existing card IDs and session blocks
- No global state leaks

## Final Card

Generated via `getFinalCard()`:

- kept count
- discarded count
- publish-ready count
- publish availability flag

## Success Criteria Mapping

- Seamless continuation: review mode enters from active/final cards via `enterReviewMode()`.
- Fast decisions: single gesture maps directly to state transition.
- No UI break: module is adapter/controller-only and does not replace card rendering.
- Correct storage: decisions tracked deterministically and returned in `finalizeReview()` result.

## DoD

- [x] review mode implemented
- [x] gesture mapping working
- [x] decision tracking working
- [x] final summary card added
- [x] UI remains smooth (non-invasive adapter model)
