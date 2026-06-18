from __future__ import annotations

from typing import List, Dict
import re


KEY_TOPICS = ["titration", "spectroscopy", "chromatography", "calibration", "equilibrium", "electrode"]


def generate_cross_references(chapters: List[Dict]) -> List[Dict]:
    refs: List[Dict] = []
    chapter_text = {
        ch["title"]: "\n".join(sec.get("content", "") for sec in ch.get("sections", []))
        for ch in chapters
    }

    for topic in KEY_TOPICS:
        found = []
        for title, text in chapter_text.items():
            if re.search(rf"\b{re.escape(topic)}\b", text, flags=re.IGNORECASE):
                found.append(title)
        if len(found) > 1:
            refs.append({"topic": topic, "see_also": found})
    return refs
