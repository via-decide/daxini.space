#!/usr/bin/env python3
"""Build KDP-oriented EPUB with Pandoc and optional epubcheck."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHAPTER_DIR = ROOT / "book" / "chapters"
BUILD_DIR = ROOT / "build" / "epub"
OUTPUT_EPUB = BUILD_DIR / "book.epub"
EPUB_CSS = ROOT / "book" / "styles" / "epub.css"
METADATA = ROOT / "book" / "metadata" / "book.yaml"


def ordered_chapters() -> list[Path]:
    return sorted(CHAPTER_DIR.glob("*.md"))


def build_epub() -> Path:
    chapters = ordered_chapters()
    if not chapters:
        raise RuntimeError("No chapters found in book/chapters")

    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    cmd = [
        "pandoc",
        *[str(c) for c in chapters],
        "--standalone",
        "--toc",
        "--split-level=1",
        "--epub-chapter-level=1",
        "--css",
        str(EPUB_CSS),
        "--metadata-file",
        str(METADATA),
        "--epub-embed-font",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "--epub-embed-font",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "-o",
        str(OUTPUT_EPUB),
    ]
    subprocess.run(cmd, check=True)
    return OUTPUT_EPUB


def validate_epub(epub_path: Path) -> bool:
    epubcheck = shutil.which("epubcheck")
    if not epubcheck:
        print("epubcheck not installed; skipping validation")
        return False
    subprocess.run([epubcheck, str(epub_path)], check=True)
    return True


if __name__ == "__main__":
    output = build_epub()
    validated = validate_epub(output)
    print(f"EPUB created: {output} (validated={validated})")
