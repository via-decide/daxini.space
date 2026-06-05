# CODEX_INSTRUCTION_BOOTSTRAP_V1

## Purpose
Establish a persistent instruction bootstrap so Codex does not default to generic behavior and always loads repo-specific rules before execution.

## Required Files
- `AGENTS.md` (primary, minimal guardrails)
- `.codex/instructions.md` (full execution protocol)
- `.codex/session.md` (dynamic current-focus layer)

## Execution Flow
Codex starts task
→ reads `AGENTS.md`
→ reads `.codex/instructions.md`
→ reads `.codex/session.md`
→ executes with full context

## Hard Rules
- Root `AGENTS.md` must exist.
- `.codex/instructions.md` must mirror base logic and enforcement behavior.
- `.codex/session.md` must remain editable per task.
- Codex must not proceed if any bootstrap file is missing.
- Missing PR control files are auto-generated internally before execution (`task.md`, `purpose.md`, `rules.md`, `guard.md`, `dod.md`).

## Auto-Loading Behavior
- Files are designed as persistent repository artifacts.
- Any Codex environment that honors `AGENTS.md` will inherit this chain.
- Session layer enables task-specific focus without rewriting base rules.

## Verification Output (expected)
Before modification/execution, Codex should emit a concise summary:
- Rules Loaded: yes/no
- Files Detected: list
- Session Focus: ALCHEMIST
- Protected Area: Swipe UI core
- If auto-generated: print `AUTO-PR GENERATED` list, then `CONTEXT READY`.

## DoD Mapping
- [x] `AGENTS.md` created
- [x] `.codex/instructions.md` created
- [x] `.codex/session.md` created
- [x] rules verified by Codex output
- [x] persistence confirmed across runs (repo-persisted files)
