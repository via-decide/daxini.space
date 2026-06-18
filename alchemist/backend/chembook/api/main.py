from pathlib import Path
from fastapi import FastAPI
from chembook.core.pipeline import ChemBookPipeline
from chembook.core.book_series import series_manifest, series_graph, topo_order

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


@app.get("/series")
def get_series():
    return {"books": series_manifest(), "graph": series_graph(), "order": topo_order()}
