from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict, List


@dataclass
class SeriesBook:
    id: str
    title: str
    depends_on: List[str]


DEFAULT_SERIES: List[SeriesBook] = [
    SeriesBook("book1", "Analytical Chemistry Foundations", []),
    SeriesBook("book2", "Quantitative Analysis and Error", ["book1"]),
    SeriesBook("book3", "Equilibria and Titrimetric Methods", ["book1", "book2"]),
    SeriesBook("book4", "UV-Vis and Molecular Spectroscopy", ["book2"]),
    SeriesBook("book5", "Electroanalytical Methods", ["book2", "book3"]),
    SeriesBook("book6", "Chromatographic Separations", ["book2", "book3"]),
    SeriesBook("book7", "Mass Spectrometry and Hyphenated Systems", ["book4", "book6"]),
    SeriesBook("book8", "Method Validation and QA", ["book3", "book6"]),
    SeriesBook("book9", "Environmental and Bioanalytical Case Studies", ["book5", "book7", "book8"]),
    SeriesBook("book10", "Capstone Problem Solving for Analytical Chemistry", ["book1", "book2", "book3", "book4", "book5", "book6", "book7", "book8", "book9"]),
]


def series_graph() -> Dict[str, List[str]]:
    return {b.id: b.depends_on for b in DEFAULT_SERIES}


def topo_order() -> List[str]:
    graph = series_graph()
    indegree = {k: 0 for k in graph}
    for _, deps in graph.items():
        for dep in deps:
            indegree[_] += 1
    ready = [k for k, v in indegree.items() if v == 0]
    order: List[str] = []
    while ready:
        node = ready.pop(0)
        order.append(node)
        for nxt, deps in graph.items():
            if node in deps:
                indegree[nxt] -= 1
                if indegree[nxt] == 0:
                    ready.append(nxt)
    return order


def series_manifest() -> List[dict]:
    return [asdict(b) for b in DEFAULT_SERIES]
