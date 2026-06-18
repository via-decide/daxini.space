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

    sub.add_parser("generate").add_argument("target", choices=["exercises", "ads-keywords", "crossrefs"])
    sub.add_parser("export").add_argument("target", choices=["kdp", "series", "institutional-sales"])

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
        result = pipeline.build_all(chapters, citations)
        if args.target == "exercises":
            print("Exercises generated in backend/output/exercises.json")
        elif args.target == "ads-keywords":
            print(f"Amazon Ads keywords generated: {result['ads_keywords']}")
        elif args.target == "crossrefs":
            print(f"Cross references generated: {result['crossrefs']}")
    elif args.command == "export":
        _, chapters, citations = pipeline.ingest(Path("data/sample"))
        result = pipeline.build_all(chapters, citations)
        if args.target == "kdp":
            print(result["kdp"])
        elif args.target == "series":
            print("Series dependency graph exported to backend/output/series_graph.json")
        elif args.target == "institutional-sales":
            print("Institutional sales offers exported to backend/output/institutional_sales.json")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
