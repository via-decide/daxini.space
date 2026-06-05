# Publishing Pipeline

## Overview

This repository now contains a deterministic publishing pipeline that outputs:

- `build/epub/book.epub` (KDP-oriented EPUB)
- `build/pdf/book_print.pdf` (6x9 print interior)
- `build/assets/diagrams/*` (SVG + PDF diagrams)

Run everything with:

```bash
make publish
# or
python3 build_book.py
```

## Content model

- Add chapter markdown files to `book/chapters/` using numeric prefixes (`01-`, `02-`, ...).
- Book metadata is stored in `book/metadata/book.yaml`.
- Styling is defined in:
  - `book/styles/epub.css`
  - `book/styles/print.css`

## Build stages

1. `scripts/diagram_generator.py`
   - Generates six deterministic architecture/flow diagrams.
   - Exports both `.svg` (EPUB) and `.pdf` (print).

2. `scripts/build_epub.py`
   - Uses Pandoc with metadata, TOC, chapter splits, and embedded fonts.
   - Produces `build/epub/book.epub`.
   - Runs `epubcheck` if installed.

3. `scripts/build_pdf.py`
   - Converts chapters to HTML5 via Pandoc.
   - Uses WeasyPrint with 6x9 sizing, mirrored margins, running headers, and page numbers.
   - Uses a first pass to estimate page count and compute gutter.
   - Produces `build/pdf/book_print.pdf`.

## Quality checks

- EPUB validation: automatic when `epubcheck` is available.
- PDF checks can be extended with `pypdf` to verify page properties and embedded fonts.
- Automated tests are in `tests/test_publishing.py`.

## Regenerating diagrams only

```bash
make diagrams
```
