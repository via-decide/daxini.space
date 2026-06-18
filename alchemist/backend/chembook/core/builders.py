from pathlib import Path
import json
import subprocess
from jinja2 import Template


def build_epub(markdown_path: Path, output_epub: Path, template_html: Path):
    output_epub.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "pandoc",
        str(markdown_path),
        "-o",
        str(output_epub),
        "--template",
        str(template_html),
    ]
    return subprocess.run(cmd, capture_output=True, text=True)


def build_paperback_pdf(tex_path: Path, output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        "xelatex",
        "-interaction=nonstopmode",
        f"-output-directory={output_dir}",
        str(tex_path),
    ]
    return subprocess.run(cmd, capture_output=True, text=True)


def build_kdp_metadata(title: str, subtitle: str, keywords: list[str], out_json: Path):
    data = {
        "title": title,
        "subtitle": subtitle,
        "description": (
            "Master analytical chemistry with practical methods, worked examples, "
            "and modern instrumentation workflows for lab and exam success."
        ),
        "keywords": keywords,
        "marketing_copy": [
            "From notebook to published textbook in one reproducible workflow.",
            "Includes titration, spectroscopy, chromatography, and statistical analysis.",
        ],
    }
    out_json.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return data


def render_compiled_markdown(chapters: list[dict], citations: list[str], out_md: Path):
    template = Template(
        """# {{ title }}

{% for ch in chapters %}## {{ ch.title }}
{% for s in ch.sections %}### {{ s.heading }}
{{ s.content }}
{% endfor %}{% endfor %}
## References
{% for c in citations %}- {{ c }}
{% endfor %}"""
    )
    out = template.render(title="Analytical Chemistry", chapters=chapters, citations=citations)
    out_md.write_text(out, encoding="utf-8")
