#!/usr/bin/env python3
import argparse
from pathlib import Path
import sys

sys.path.insert(0, "backend")
from chembook.core.pipeline import ChemBookPipeline


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="data/sample")
    parser.add_argument("--title", default="Analytical Chemistry Vol. 1")
    args = parser.parse_args()

    pipeline = ChemBookPipeline()
    _, chapters, citations = pipeline.ingest(Path(args.input))
    pipeline.generate_assets()
    result = pipeline.build_all(chapters, citations)
    print(f"Built {args.title}: {result}")


if __name__ == "__main__":
    main()
