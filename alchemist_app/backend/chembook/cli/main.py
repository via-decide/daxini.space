import argparse
from pathlib import Path
from chembook.core.pipeline import ChemBookPipeline


def main():
    parser = argparse.ArgumentParser(prog="chembook")
    sub = parser.add_subparsers(dest="command")

    ingest = sub.add_parser("ingest")
    ingest.add_argument("path", type=str)

    build = sub.add_parser("build")
    build.add_argument("target", choices=["epub", "pdf", "all"])

    sub.add_parser("generate").add_argument("target", choices=["exercises"])
    sub.add_parser("export").add_argument("target", choices=["kdp"])

    args = parser.parse_args()
    pipeline = ChemBookPipeline()

    if args.command == "ingest":
        ocr, chapters, citations = pipeline.ingest(Path(args.path))
        print(f"OCR pages: {len(ocr)} | chapters: {len(chapters)} | citations: {len(citations)}")
    elif args.command == "build":
        _, chapters, citations = pipeline.ingest(Path("data/sample"))
        pipeline.generate_assets()
        result = pipeline.build_all(chapters, citations)
        print(f"Build result: {result}")
    elif args.command == "generate":
        _, chapters, citations = pipeline.ingest(Path("data/sample"))
        pipeline.build_all(chapters, citations)
        print("Exercises generated in backend/output/exercises.json")
    elif args.command == "export":
        _, chapters, citations = pipeline.ingest(Path("data/sample"))
        result = pipeline.build_all(chapters, citations)
        print(result["kdp"])
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
