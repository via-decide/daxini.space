#!/usr/bin/env python3
"""Build KDP 6x9 mirrored-margin print PDF."""
from __future__ import annotations

import math
import subprocess
from pathlib import Path

from weasyprint import HTML, CSS

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover
    PdfReader = None

ROOT = Path(__file__).resolve().parents[1]
CHAPTER_DIR = ROOT / "book" / "chapters"
BUILD_DIR = ROOT / "build" / "pdf"
OUTPUT_PDF = BUILD_DIR / "book_print.pdf"
PRINT_CSS = ROOT / "book" / "styles" / "print.css"


def _estimate_gutter(page_count: int) -> float:
    if page_count <= 150:
        return 0.375
    if page_count <= 300:
        return 0.5
    if page_count <= 500:
        return 0.625
    return 0.75


def _render_html(temp_html: Path) -> None:
    chapters = sorted(CHAPTER_DIR.glob("*.md"))
    cmd = ["pandoc", *[str(c) for c in chapters], "--standalone", "-t", "html5", "-o", str(temp_html)]
    subprocess.run(cmd, check=True)


def build_pdf() -> Path:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    temp_html = BUILD_DIR / "print.html"
    _render_html(temp_html)

    base_css = PRINT_CSS.read_text(encoding="utf-8")
    first_pass = BUILD_DIR / "_first_pass.pdf"
    HTML(filename=str(temp_html)).write_pdf(str(first_pass), stylesheets=[CSS(string=base_css)])

    page_count = 1
    if PdfReader:
        page_count = len(PdfReader(str(first_pass)).pages)
    gutter = _estimate_gutter(page_count)
    css = base_css.replace("var(--inside-margin, 0.75in)", f"{gutter}in")
    HTML(filename=str(temp_html)).write_pdf(str(OUTPUT_PDF), stylesheets=[CSS(string=css)])

    return OUTPUT_PDF


if __name__ == "__main__":
    output = build_pdf()
    print(f"PDF created: {output}")
