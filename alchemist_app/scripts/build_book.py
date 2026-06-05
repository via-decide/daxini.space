#!/usr/bin/env python3
"""Compatibility wrapper for the root publishing entrypoint."""

from pathlib import Path
import runpy

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).resolve().parents[1] / "build_book.py"), run_name="__main__")
