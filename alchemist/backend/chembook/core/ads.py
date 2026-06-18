from __future__ import annotations

from typing import List, Dict


def generate_amazon_ads_keywords(title: str, chapters: List[Dict], max_keywords: int = 50) -> List[str]:
    base = {
        "analytical chemistry book",
        "instrumental analysis",
        "chemistry practice problems",
        "lab methods textbook",
        "quantitative analysis chemistry",
        "chromatography explained",
        "spectroscopy for students",
        "titration calculations",
        "chemistry exam prep",
    }

    for ch in chapters:
        words = [w.lower().strip(":,.-") for w in ch.get("title", "").split() if len(w) > 4]
        for w in words:
            base.add(f"{w} chemistry")
    base.add(f"{title.lower()} textbook")

    return sorted(base)[:max_keywords]
