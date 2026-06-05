from typing import List, Dict


def generate_examples(chapters: List[Dict]) -> List[Dict]:
    items = []
    for idx, ch in enumerate(chapters, start=1):
        items.append({
            "chapter": ch["title"],
            "example": f"Example {idx}: Determine unknown concentration using calibration curve and linear regression."
        })
    return items


def generate_exercises(chapters: List[Dict]) -> List[Dict]:
    exercises = []
    for ch in chapters:
        exercises.append({
            "chapter": ch["title"],
            "questions": [
                "Balance the redox reaction provided and compute electrons transferred.",
                "Given absorbance data, estimate concentration using Beer-Lambert law.",
                "Interpret chromatographic resolution from retention-time table.",
            ],
        })
    return exercises
