from pydantic import BaseModel
from typing import List, Dict


class Chapter(BaseModel):
    title: str
    sections: List[Dict[str, str]]


class PipelineResult(BaseModel):
    title: str
    chapters: List[Chapter]
    citations: List[str]
    assets: Dict[str, str]
