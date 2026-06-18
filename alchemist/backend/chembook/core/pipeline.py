from pathlib import Path
import sqlite3
import json
from .config import OUTPUT_DIR, STATE_DB
from .ocr_engine import OCREngine
from .markdown_compiler import compile_markdown_chapters
from .diagram_generator import titration_curve, spectroscopy_diagram, chromatogram, stats_graph
from .generators import generate_examples, generate_exercises
from .citation_engine import extract_pdf_citations
from .builders import render_compiled_markdown, build_epub, build_paperback_pdf, build_kdp_metadata
from .crossref import generate_cross_references
from .bibliography import write_bibliography
from .kindle_validator import validate_kindle_markdown
from .ads import generate_amazon_ads_keywords
from .institutional_sales import build_bulk_sales_offers, forecast_bulk_revenue
from .book_series import series_graph, topo_order, series_manifest


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
        crossrefs = generate_cross_references(chapters)
        write_bibliography(citations, OUTPUT_DIR / "bibliography.md", OUTPUT_DIR / "references.bib")
        kindle_report = validate_kindle_markdown(compiled_md)
        ads_keywords = generate_amazon_ads_keywords("Analytical Chemistry Vol. 1", chapters)
        bulk_sales = {
            "offers": build_bulk_sales_offers(series_size=10),
            "forecast": forecast_bulk_revenue(),
        }
        series = {
            "graph": series_graph(),
            "order": topo_order(),
            "books": series_manifest(),
        }

        epub_res = build_epub(compiled_md, OUTPUT_DIR / "book.epub", Path(__file__).resolve().parents[1] / "templates" / "book_template.html")
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
        (OUTPUT_DIR / "crossrefs.json").write_text(json.dumps(crossrefs, indent=2), encoding="utf-8")
        (OUTPUT_DIR / "kindle_validation.json").write_text(json.dumps(kindle_report, indent=2), encoding="utf-8")
        (OUTPUT_DIR / "amazon_ads_keywords.json").write_text(json.dumps(ads_keywords, indent=2), encoding="utf-8")
        (OUTPUT_DIR / "institutional_sales.json").write_text(json.dumps(bulk_sales, indent=2), encoding="utf-8")
        (OUTPUT_DIR / "series_graph.json").write_text(json.dumps(series, indent=2), encoding="utf-8")

        self._record("build", {"epub_rc": epub_res.returncode, "pdf_rc": pdf_res.returncode})
        return {
            "epub": epub_res.returncode,
            "pdf": pdf_res.returncode,
            "kdp": kdp,
            "crossrefs": len(crossrefs),
            "kindle_validation": kindle_report["status"],
            "ads_keywords": len(ads_keywords),
            "series_books": len(series["books"]),
        }
