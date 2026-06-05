#!/usr/bin/env python3
"""Single-command deterministic publishing pipeline entrypoint."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run_step(name: str, cmd: list[str]) -> None:
    print(f"[publish] {name}: {' '.join(cmd)}")
    subprocess.run(cmd, check=True, cwd=ROOT)


def main() -> None:
    (ROOT / "build" / "assets" / "images").mkdir(parents=True, exist_ok=True)

    run_step("diagrams", ["python3", "scripts/diagram_generator.py"])
    run_step("epub", ["python3", "scripts/build_epub.py"])
    run_step("pdf", ["python3", "scripts/build_pdf.py"])

    if shutil.which("epubcheck"):
        run_step("epubcheck", ["epubcheck", "build/epub/book.epub"])
    else:
        print("[publish] epubcheck unavailable; skipped")

    print("[publish] complete -> build/epub/book.epub and build/pdf/book_print.pdf")


if __name__ == "__main__":
    main()
