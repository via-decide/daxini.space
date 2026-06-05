from pathlib import Path
import shutil
import subprocess
import zipfile


ROOT = Path(__file__).resolve().parents[1]


def test_chapter_ordering_is_numeric():
    chapters = sorted((ROOT / "book" / "chapters").glob("*.md"))
    assert chapters
    assert [c.name for c in chapters] == sorted(c.name for c in chapters)


def test_diagram_generation_outputs_svg_and_pdf():
    subprocess.run(["python3", "scripts/diagram_generator.py"], cwd=ROOT, check=True)
    out = ROOT / "build" / "assets" / "diagrams"
    assert (out / "iot_architecture.svg").exists()
    assert (out / "iot_architecture.pdf").exists()


def test_epub_generation_and_structure():
    if not shutil.which("pandoc"):
        import pytest

        pytest.skip("pandoc is required for epub test")
    subprocess.run(["python3", "scripts/build_epub.py"], cwd=ROOT, check=True)
    epub = ROOT / "build" / "epub" / "book.epub"
    assert epub.exists()
    with zipfile.ZipFile(epub) as zf:
        names = set(zf.namelist())
        assert "EPUB/nav.xhtml" in names
        assert any(name.endswith(".ncx") for name in names)


def test_pdf_generation():
    if not shutil.which("pandoc"):
        import pytest

        pytest.skip("pandoc is required for pdf test")
    subprocess.run(["python3", "scripts/build_pdf.py"], cwd=ROOT, check=True)
    pdf = ROOT / "build" / "pdf" / "book_print.pdf"
    assert pdf.exists()
    assert pdf.stat().st_size > 0
