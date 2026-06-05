# ALCHEMIST_CREDIT_VAULT_SYSTEM_V1

## Purpose
Define a deterministic session credit economy with vault decisions and publish rewards.

## Credit Rules
- Starting a session costs credits via `creditSystem.chargeForSessionStart(session)`.
- Cost strategy is deterministic:
  - `time` mode: flat `sessionCost`.
  - `blocks` mode: `ceil(blockCount / blockUnitSize) * sessionCost`.
- Balances can never go negative; deductions fail with `CREDIT_INSUFFICIENT`.

## Publish Reward
- Publish refund percentage defaults to `50%` (`publishRefundRate: 0.5`) and is configurable.
- Refund applies only to charged + valid sessions.
- Duplicate refunds are blocked with `CREDIT_REFUND_ALREADY_APPLIED`.

## Recovery Logic
- Recovery restores the session snapshot in vault memory.
- Recovery has no additional credit cost.
- Recovery is blocked after discard/publish.

## Vault System
### States
- `active`
- `vault` (pending decision)
- `published`
- `discarded`

### Flow
1. User starts session.
2. Credits are deducted.
3. Session is active.
4. Session finalizes and moves into vault.
5. Decision branch:
   - Swipe UP (publish): publish + refund % credits.
   - Swipe DOWN (recover): restore session, no credit change.
   - Discard: permanent removal from usable flow, full credit loss.

## API
### creditSystem
- `getBalance()`
- `deduct(amount)`
- `refund(amount)`
- `chargeForSessionStart(session)`
- `settlePublishReward(sessionId, isValidSession)`

### vaultManager
- `moveToVault(sessionId)`
- `recoverSession(sessionId)`
- `discardSession(sessionId)`
- `publishSession(sessionId)`

## Rules Enforced
- no negative credits
- no double refund
- no publish without finalize
- no recovery after discard
- lock session after publish
- prevent duplicate publish
- validate credit before deduction

## Integration Notes
- Integrates with session engine by consuming session snapshots and requiring finalized state before vaulting.
- Integrates with publish flow through `publishAdapter.publish(session)` and reward settlement.
- Non-invasive: no swipe UI mutation required; compatible with existing gesture layer and session-review mapping.

## Determinism and Tamper Resistance
- Credit and vault state are held in closure state, not mutable globals.
- All transitions are explicit and guarded by session IDs + state checks.
- Reward logic is idempotent via per-session refund tracking.
