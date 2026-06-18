#!/usr/bin/env python3
"""Generate deterministic black-and-white publication diagrams without external deps."""
from __future__ import annotations

from pathlib import Path


DIAGRAMS = [
    ("iot_architecture", ["Sensors", "Edge Gateway", "Cloud API", "Data Lake"]),
    ("system_flow", ["Ingest", "Normalize", "Validate", "Publish"]),
    ("protocol_stack", ["Application", "Transport", "Network", "Physical"]),
    ("cloud_edge", ["Device", "Edge", "Regional", "Core Cloud"]),
    ("component", ["Parser", "Diagrammer", "EPUB Builder", "PDF Builder"]),
    ("sequence_flow", ["Author", "Pipeline", "Validator", "KDP"]),
]


def _svg_diagram(labels: list[str]) -> str:
    width, height = 900, 180
    box_w, box_h, y = 180, 80, 50
    x_positions = [20, 245, 470, 695]

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="white"/>',
    ]
    for idx, label in enumerate(labels):
        x = x_positions[idx]
        parts.append(f'<rect x="{x}" y="{y}" width="{box_w}" height="{box_h}" fill="none" stroke="black" stroke-width="2"/>')
        parts.append(
            f'<text x="{x + box_w/2}" y="{y + box_h/2 + 4}" font-size="16" text-anchor="middle" '
            'font-family="serif" fill="black">'
            f"{label}</text>"
        )
        if idx < len(labels) - 1:
            x2 = x + box_w
            nx = x_positions[idx + 1]
            parts.append(f'<line x1="{x2 + 6}" y1="{y + box_h/2}" x2="{nx - 6}" y2="{y + box_h/2}" stroke="black" stroke-width="2"/>')
            parts.append(f'<polygon points="{nx - 6},{y + box_h/2} {nx - 18},{y + box_h/2 - 6} {nx - 18},{y + box_h/2 + 6}" fill="black"/>')

    parts.append("</svg>")
    return "\n".join(parts)


def _write_simple_pdf(labels: list[str], out_file: Path) -> None:
    lines = [
        "BT /F1 12 Tf 72 760 Td (System Diagram) Tj ET",
    ]
    y = 700
    for label in labels:
        safe = label.replace("(", "[").replace(")", "]")
        lines.append(f"72 {y} 180 36 re S")
        lines.append(f"BT /F1 10 Tf 84 {y + 14} Td ({safe}) Tj ET")
        y -= 80

    content = "\n".join(lines).encode("ascii")
    obj1 = b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
    obj2 = b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
    obj3 = b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n"
    obj4 = b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >> endobj\n"
    obj5 = f"5 0 obj << /Length {len(content)} >> stream\n".encode("ascii") + content + b"\nendstream endobj\n"

    pdf = b"%PDF-1.4\n"
    offsets = [0]
    for obj in (obj1, obj2, obj3, obj4, obj5):
        offsets.append(len(pdf))
        pdf += obj

    xref_pos = len(pdf)
    pdf += f"xref\n0 {len(offsets)}\n".encode("ascii")
    pdf += b"0000000000 65535 f \n"
    for off in offsets[1:]:
        pdf += f"{off:010d} 00000 n \n".encode("ascii")

    pdf += f"trailer << /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode("ascii")
    out_file.write_bytes(pdf)


def generate_all(out_dir: Path = Path("build/assets/diagrams")) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    outputs: list[Path] = []
    for name, labels in DIAGRAMS:
        svg = out_dir / f"{name}.svg"
        pdf = out_dir / f"{name}.pdf"
        svg.write_text(_svg_diagram(labels), encoding="utf-8")
        _write_simple_pdf(labels, pdf)
        outputs.extend([svg, pdf])
    return outputs


if __name__ == "__main__":
    created = generate_all()
    print(f"Generated {len(created)} files in {created[0].parent if created else 'N/A'}")
