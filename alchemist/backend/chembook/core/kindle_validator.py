from __future__ import annotations

from pathlib import Path
from typing import Dict, List


MAX_PARAGRAPH_LEN = 1800


def validate_kindle_markdown(markdown_file: Path) -> Dict[str, List[str]]:
    issues: List[str] = []
    text = markdown_file.read_text(encoding="utf-8") if markdown_file.exists() else ""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    if not text.startswith("# "):
        issues.append("Document should begin with a top-level heading for Kindle navigation.")

    too_long = [idx + 1 for idx, p in enumerate(paragraphs) if len(p) > MAX_PARAGRAPH_LEN]
    if too_long:
        issues.append(f"Paragraphs too long for Kindle reflow detected at positions: {too_long[:10]}")

    if "\t" in text:
        issues.append("Tab characters found; prefer spaces for stable Kindle rendering.")

    if "<table" in text.lower():
        issues.append("HTML tables detected; complex tables may render poorly on e-ink devices.")

    return {"status": "pass" if not issues else "warn", "issues": issues}
