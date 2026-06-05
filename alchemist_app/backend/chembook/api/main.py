from pathlib import Path
from fastapi import FastAPI
from chembook.core.pipeline import ChemBookPipeline

app = FastAPI(title="ChemBook Pipeline API")
pipeline = ChemBookPipeline()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/pipeline/run")
def run_pipeline(sample_path: str = "data/sample"):
    _, chapters, citations = pipeline.ingest(Path(sample_path))
    pipeline.generate_assets()
    return pipeline.build_all(chapters, citations)


@app.post("/build/viabundle")
def build_viabundle(sample_path: str = "data/sample", bundle_id: str = "chem-os-v1"):
    from chembook.core.bundle_builder import generate_viabundle
    from chembook.core.config import OUTPUT_DIR
    from chembook.core.generators import generate_examples, generate_exercises
    
    _, chapters, citations = pipeline.ingest(Path(sample_path))
    pipeline.generate_assets()
    
    examples = generate_examples(chapters)
    exercises = generate_exercises(chapters)
    
    bundle_path, bundle_hash = generate_viabundle(
        chapters=chapters, 
        exercises=exercises, 
        examples=examples, 
        output_dir=OUTPUT_DIR,
        bundle_id=bundle_id
    )
    
    return {
        "status": "success",
        "bundle": str(bundle_path),
        "hash": bundle_hash
    }
