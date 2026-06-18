from __future__ import annotations

from pathlib import Path
from typing import List


def write_bibliography(citations: List[str], out_md: Path, out_bib: Path):
    out_md.parent.mkdir(parents=True, exist_ok=True)
    md_lines = ["# Bibliography", ""]
    bib_lines = []

    for i, c in enumerate(citations, start=1):
        key = f"ref{i}"
        md_lines.append(f"{i}. {c}")
        bib_lines.append(
            "\n".join(
                [
                    f"@misc{{{key},",
                    f"  title = {{{c}}},",
                    "  note = {Imported from pipeline citation extraction}",
                    "}",
                ]
            )
        )

    out_md.write_text("\n".join(md_lines) + "\n", encoding="utf-8")
    out_bib.write_text("\n\n".join(bib_lines) + "\n", encoding="utf-8")
