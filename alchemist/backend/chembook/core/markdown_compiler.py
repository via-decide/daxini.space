from pathlib import Path
from typing import List, Dict


def compile_markdown_chapters(markdown_files: List[Path]) -> List[Dict[str, object]]:
    chapters = []
    for md in sorted(markdown_files):
        raw = md.read_text(encoding="utf-8")
        lines = raw.splitlines()
        title = next((ln.replace("#", "").strip() for ln in lines if ln.startswith("#")), md.stem)
        sections = []
        current = {"heading": "Introduction", "content": ""}
        for line in lines:
            if line.startswith("##"):
                if current["content"].strip():
                    sections.append(current)
                current = {"heading": line.replace("#", "").strip(), "content": ""}
            else:
                current["content"] += line + "\n"
        if current["content"].strip():
            sections.append(current)
        chapters.append({"title": title, "sections": sections})
    return chapters
