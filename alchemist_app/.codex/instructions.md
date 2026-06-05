# CODEX Bootstrap Instructions — ENFORCER_V1

## Bootstrap Contract
At task start, verify in this exact order:
1. `AGENTS.md`
2. `.codex/instructions.md`
3. `.codex/session.md`

If any file is missing:
- abort execution
- return exactly: `BOOTSTRAP_MISSING`

## Anti-Refresh Strategy
- Critical rules must live in repository files
- No reliance on chat memory
- No reliance on previous task state

## Instruction Priority
1. `AGENTS.md` (global)
2. `.codex/instructions.md` (detailed)
3. `.codex/session.md` (active focus)

## Execution Guard
Before any code modification, output exactly:
"BOOTSTRAP LOADED:
- AGENTS.md ✓
- instructions.md ✓
- session.md ✓"

If guard cannot be emitted, fail task.

## Repository Safety Rule
- Do not assume previous state
- Do not assume file existence unless present in repo
- Always re-derive context from repository contents
