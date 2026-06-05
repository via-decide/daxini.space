You are working in repository via-decide/alchemist_app on branch main.

MISSION
Refactor Reading Progress Engine to be fully stateless, remove internal book binding, and optimize tracker usage.

CONSTRAINTS
- Max 1 new file - No external dependencies - Must not degrade performance - No global/shared mutable state

PROCESS (MANDATORY)
1. Read README.md and AGENTS.md before editing.
2. Audit architecture before coding. Summarize current behavior.
3. Preserve unrelated working code. Prefer additive modular changes.
4. Implement the smallest safe change set for the stated goal.
5. Run validation commands and fix discovered issues.
6. Self-review for regressions, missing env wiring, and docs drift.
7. Return complete final file contents for every modified or created file.

REPO AUDIT CONTEXT
- Description: 
- Primary language: JavaScript
- README snippet:
# ChemBook Auto Publisher Deterministic book production engine for KDP-ready EPUB and paperback PDF output. ## Quick start ```bash python3 -m venv .venv source .venv/bin/activate pip install -r requirements.txt make publish ``` Outputs: - `build/epub/book.epub` - `build/pdf/book_print.pdf` - `b

- AGENTS snippet:
not found


SOP: PRE-MODIFICATION PROTOCOL (MANDATORY)
1. Adherence to Instructions: No deviations without explicit user approval.
2. Mandatory Clarification: Immediately ask if instructions are ambiguous or incomplete.
3. Proposal First: Always propose optimizations or fixes before implementing them.
4. Scope Discipline: Do not add unrequested features or modify unrelated code.
5. Vulnerability Check: Immediately flag and explain security risks.

OUTPUT REQUIREMENTS
- Include: implementation summary, checks run, risks, rollback notes.
- Generate branch + PR package.
- Keep prompts deterministic and preservation-first.