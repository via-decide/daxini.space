Repair mode for repository via-decide/alchemist_app.

TARGET
Validate and repair only the files touched by the previous implementation.

TASK
Refactor Reading Progress Engine to be fully stateless, remove internal book binding, and optimize tracker usage.

RULES
1. Audit touched files first and identify regressions.
2. Preserve architecture and naming conventions.
3. Make minimal repairs only; do not expand scope.
4. Re-run checks and provide concise root-cause notes.
5. Return complete contents for changed files only.

SOP: REPAIR PROTOCOL (MANDATORY)
1. Strict Fix Only: Do not use repair mode to expand scope or add features.
2. Regression Check: Audit why previous attempt failed before proposing a fix.
3. Minimal Footprint: Only return contents for the actual repaired files.

REPO CONTEXT
- README snippet:
# ChemBook Auto Publisher Deterministic book production engine for KDP-ready EPUB and paperback PDF output. ## Quick start ```bash python3 -m venv .venv source .venv/bin/activate pip install -r requirements.txt make publish ``` Outputs: - `build/epub/book.epub` - `build/pdf/book_print.pdf` - `b
- AGENTS snippet:
not found
- package.json snippet:
not found