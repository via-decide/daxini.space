.PHONY: diagrams epub pdf publish test

diagrams:
	python3 scripts/diagram_generator.py

epub:
	python3 scripts/build_epub.py

pdf:
	python3 scripts/build_pdf.py

publish:
	python3 build_book.py

test:
	pytest -q
