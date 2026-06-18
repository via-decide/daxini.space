from pathlib import Path
from typing import List
import pdfplumber


def extract_pdf_citations(pdf_files: List[Path]) -> List[str]:
    citations = []
    for pdf in pdf_files:
        try:
            with pdfplumber.open(pdf) as f:
                first = f.pages[0].extract_text() or ""
            title = first.split("\n")[0][:120] if first else pdf.stem
        except Exception:
            title = pdf.stem
        citations.append(f"{title} ({pdf.name})")
    return citations
