import argparse
from pathlib import Path
from chembook.core.pipeline import ChemBookPipeline
from chembook.core.config import OUTPUT_DIR
from chembook.core.generators import generate_examples, generate_exercises
from chembook.core.bundle_builder import generate_viabundle

def main():
    parser = argparse.ArgumentParser(description="Build a Lore Labs .viabundle from raw chemistry data.")
    parser.add_argument("--input", default="data/sample", help="Input directory containing markdown/images")
    parser.add_argument("--bundle-id", default="chem-os-v1", help="Unique ID for the bundle payload")
    
    args = parser.parse_args()
    
    print(f"🚀 Starting .viabundle build pipeline for {args.bundle_id}...")
    
    pipeline = ChemBookPipeline()
    print("Step 1: Ingesting markdown and parsing... (StudyOS)")
    _, chapters, citations = pipeline.ingest(Path(args.input))
    
    print("Step 2: Generating diagrams...")
    pipeline.generate_assets()
    
    print("Step 3: Generating PrepOS exercises...")
    exercises = generate_exercises(chapters)
    
    print("Step 4: Generating SkillHex/Alchemist examples...")
    examples = generate_examples(chapters)
    
    print("Step 5: Compiling, Signing, and Zipping Cartridge...")
    bundle_path, hash_sig = generate_viabundle(
        chapters=chapters,
        exercises=exercises,
        examples=examples,
        output_dir=OUTPUT_DIR,
        bundle_id=args.bundle_id
    )
    
    print("\n✅ Build Complete!")
    print(f"Cartridge: {bundle_path}")
    print(f"HMAC Signature: {hash_sig}")

if __name__ == "__main__":
    main()
