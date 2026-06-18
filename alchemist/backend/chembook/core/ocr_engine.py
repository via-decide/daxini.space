from pathlib import Path
import re
from typing import Dict

import pytesseract
from PIL import Image


CHEM_EQUATION_PATTERN = re.compile(r"([A-Za-z0-9()]+\s*\+\s*)+[A-Za-z0-9()]+\s*->\s*[A-Za-z0-9()+\s]+")
FORMULA_PATTERN = re.compile(r"\b([A-Z][a-z]?\d*){2,}\b")


class OCREngine:
    def extract_text(self, image_path: Path) -> Dict[str, object]:
        text = pytesseract.image_to_string(Image.open(image_path))
        formulas = FORMULA_PATTERN.findall(text)
        equations = CHEM_EQUATION_PATTERN.findall(text)
        return {
            "path": str(image_path),
            "text": text,
            "formulas": list(set(formulas)),
            "equations": equations,
        }
