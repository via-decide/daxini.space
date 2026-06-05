# AGENTS.md — CODEX_BOOTSTRAP_ENFORCER_V1

## Mandatory Load Order (before any execution)
1. `AGENTS.md`
2. `.codex/instructions.md`
3. `.codex/session.md`

If any file is missing:
- STOP immediately
- Return exactly: `BOOTSTRAP_MISSING`

## Execution Discipline
READ → ANALYZE → PLAN → CONFIRM → MODIFY → VERIFY

## Runtime + Safety Rules
- Browser-only static runtime (vanilla JS/HTML/CSS)
- No npm, frameworks, bundlers, or backend dependencies
- Surgical edits only; no full-file rewrites unless explicitly requested
- Preserve existing UI behavior
- Do not modify swipe/gesture core logic

## Stateless Protection
- Never rely on prior chat/task memory
- Re-derive all context from repository files each task
- Assume previous state is unavailable unless committed in repo

## Pre-change Guard (required)
Before any code change, print:
"BOOTSTRAP LOADED:
- AGENTS.md ✓
- instructions.md ✓
- session.md ✓"

════════════════════════════════════════════
INSTRUCTION PRIORITY STACK
════════════════════════════════════════════

Codex MUST follow instructions in this order:

1. TASK PROMPT (highest priority)
2. PR-SPECIFIC .md FILES
3. .codex/session.md
4. .codex/instructions.md
5. AGENTS.md (base rules)

If conflict occurs:

→ higher priority overrides lower

If ambiguity remains:

→ STOP
→ request clarification
