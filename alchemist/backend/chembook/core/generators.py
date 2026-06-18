from typing import List, Dict
from .statistics_lib import linear_regression


def generate_examples(chapters: List[Dict]) -> List[Dict]:
    items = []
    regression = linear_regression([1, 2, 3, 4, 5], [1.1, 2.0, 3.2, 3.9, 5.1])
    for idx, ch in enumerate(chapters, start=1):
        items.append({
            "chapter": ch["title"],
            "example": (
                f"Example {idx}: Determine unknown concentration using calibration curve and linear regression "
                f"(slope={regression['slope']:.3f}, intercept={regression['intercept']:.3f}, R²={regression['r_squared']:.3f})."
            ),
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
