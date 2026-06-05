# CODEX_BOOTSTRAP_ENFORCER_V1

## Purpose
Ensure Codex reloads critical instructions and session context on every fresh environment initialization.

## Bootstrap Rule (mandatory)
At task start, verify existence in this order:
1. `AGENTS.md`
2. `.codex/instructions.md`
3. `.codex/session.md`

If any file is missing:
- STOP
- Return exactly: `BOOTSTRAP_MISSING`

## Instruction Priority
1. `AGENTS.md` — global rules
2. `.codex/instructions.md` — detailed protocol
3. `.codex/session.md` — active mission context

## Session Persistence
- `.codex/session.md` is active context and must be loaded first for session intent
- Do not overwrite session context unless a task explicitly requires an update

## Anti-Refresh Strategy
- Keep all critical execution logic in repository files
- Never rely on chat memory
- Never rely on prior task state

## Execution Guard
Before any code change, Codex must output:

`BOOTSTRAP LOADED:`  
`- AGENTS.md ✓`  
`- instructions.md ✓`  
`- session.md ✓`

If this output is not emitted, task fails.

## Self-Bootstrap PR Control (mandatory)
If PR control files are missing (`task.md`, `purpose.md`, `rules.md`, `guard.md`, `dod.md`):
- Generate them internally (in memory), using the active task prompt as source of truth.
- Keep each file minimal and non-duplicative (structured fragments only).
- Do not create physical repo files unless explicitly requested.
- Then continue normal execution with generated control context loaded.

## Repository Safety Rule
- Re-derive context from repo every task
- Do not assume pre-existing files or state beyond committed content

## Definition of Done
- [x] bootstrap enforcement added
- [x] instruction verification working
- [x] session loading confirmed
- [x] stateless execution risks mitigated
