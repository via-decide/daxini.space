from pathlib import Path
import sqlite3
import json
from .config import OUTPUT_DIR, STATE_DB
from .ocr_engine import OCREngine
from .markdown_compiler import compile_markdown_chapters
from .diagram_generator import titration_curve, spectroscopy_diagram, chromatogram, stats_graph
from .generators import generate_examples, generate_exercises
from .citation_engine import extract_pdf_citations
from .builders import render_compiled_markdown, build_paperback_pdf, build_kdp_metadata


class ChemBookPipeline:
    def __init__(self):
        self.ocr = OCREngine()
        self._init_db()

    def _init_db(self):
        con = sqlite3.connect(STATE_DB)
        con.execute(
            "CREATE TABLE IF NOT EXISTS pipeline_runs (id INTEGER PRIMARY KEY, stage TEXT, payload TEXT)"
        )
        con.commit()
        con.close()

    def _record(self, stage: str, payload: dict):
        con = sqlite3.connect(STATE_DB)
        con.execute("INSERT INTO pipeline_runs(stage, payload) VALUES (?,?)", (stage, json.dumps(payload)))
        con.commit()
        con.close()

    def ingest(self, input_dir: Path):
        images = list((input_dir / "images").glob("*"))
        markdowns = list((input_dir / "markdown").glob("*.md"))
        pdfs = list((input_dir / "pdfs").glob("*.pdf"))

        ocr_results = [self.ocr.extract_text(i) for i in images if i.suffix.lower() in {".png", ".jpg", ".jpeg"}]
        chapters = compile_markdown_chapters(markdowns)
        citations = extract_pdf_citations(pdfs)

        self._record("ingest", {"images": len(images), "markdown": len(markdowns), "pdfs": len(pdfs)})
        return ocr_results, chapters, citations

    def generate_assets(self):
        diagrams = OUTPUT_DIR / "diagrams"
        titration_curve(diagrams / "titration.png")
        spectroscopy_diagram(diagrams / "spectroscopy.png")
        chromatogram(diagrams / "chromatogram.png")
        stats_graph(diagrams / "stats.png")
        self._record("diagrams", {"path": str(diagrams)})

    def build_all(self, chapters: list[dict], citations: list[str]):
        compiled_md = OUTPUT_DIR / "book.md"
        render_compiled_markdown(chapters, citations, compiled_md)

        pdf_res = build_paperback_pdf(Path(__file__).resolve().parents[1] / "templates" / "paperback.tex", OUTPUT_DIR)
        kdp = build_kdp_metadata(
            "Analytical Chemistry Vol. 1",
            "From Lab Notebook to Mastery",
            ["analytical chemistry", "spectroscopy", "chromatography", "titration", "lab methods"],
            OUTPUT_DIR / "kdp_metadata.json",
        )
        examples = generate_examples(chapters)
        exercises = generate_exercises(chapters)

        (OUTPUT_DIR / "examples.json").write_text(json.dumps(examples, indent=2), encoding="utf-8")
        (OUTPUT_DIR / "exercises.json").write_text(json.dumps(exercises, indent=2), encoding="utf-8")

        self._record("build", {"pdf_rc": pdf_res.returncode})
        return {"pdf": pdf_res.returncode, "kdp": kdp}
