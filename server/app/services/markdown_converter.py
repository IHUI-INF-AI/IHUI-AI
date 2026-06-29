"""File -> Markdown converter (re-implemented in Python from
client/backend-docs/MarkdownConverter.java).

Supports: .docx, .xlsx, .pptx, .pdf (text only), .txt, .md
"""
from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

logger = logging.getLogger(__name__)

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
}


def convert_to_markdown(file_path: str | Path) -> str:
    """Convert any supported file to Markdown. Returns "" on failure."""
    p = Path(file_path)
    if not p.exists():
        return ""
    suffix = p.suffix.lower()
    try:
        if suffix == ".docx":
            return _docx_to_md(p)
        if suffix in (".xlsx", ".xlsm"):
            return _xlsx_to_md(p)
        if suffix == ".pptx":
            return _pptx_to_md(p)
        if suffix == ".pdf":
            return _pdf_to_md(p)
        if suffix in (".txt", ".md", ".markdown"):
            return p.read_text(encoding="utf-8", errors="replace")
        logger.warning("Unsupported file type: %s", suffix)
        return ""
    except Exception as exc:
        logger.exception("convert_to_markdown failed: %s", exc)
        return ""


def _docx_to_md(p: Path) -> str:
    if not zipfile.is_zipfile(p):
        return p.read_text(encoding="utf-8", errors="replace")
    with zipfile.ZipFile(p) as z, z.open("word/document.xml") as f:
        tree = ET.parse(f)
    root = tree.getroot()
    lines: list[str] = []
    for para in root.iter(f"{{{NS['w']}}}p"):
        text = "".join(t.text or "" for t in para.iter(f"{{{NS['w']}}}t"))
        if text.strip():
            lines.append(text)
    return "\n\n".join(lines)


def _xlsx_to_md(p: Path) -> str:
    if not zipfile.is_zipfile(p):
        return ""
    with zipfile.ZipFile(p) as z:
        sheet_names = [
            n for n in z.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml")
        ]
        out: list[str] = []
        for sn in sorted(sheet_names):
            with z.open(sn) as f:
                tree = ET.parse(f)
            rows = []
            for row in tree.getroot().iter(f"{{{NS['s']}}}row"):
                cells = []
                for c in row.iter(f"{{{NS['s']}}}c"):
                    v = c.find(f"{{{NS['s']}}}v")
                    cells.append(v.text if v is not None else "")
                rows.append(" | ".join(cells))  # type: ignore[arg-type]
            out.append("\n".join(rows))
        return "\n\n".join(out)


def _pptx_to_md(p: Path) -> str:
    if not zipfile.is_zipfile(p):
        return ""
    with zipfile.ZipFile(p) as z:
        slide_names = sorted(
            n for n in z.namelist() if n.startswith("ppt/slides/slide") and n.endswith(".xml")
        )
        out = []
        for i, sn in enumerate(slide_names, start=1):
            with z.open(sn) as f:
                tree = ET.parse(f)
            texts = [
                (t.text or "")
                for t in tree.getroot().iter(f"{{{NS['a']}}}t")
            ]
            out.append(f"## Slide {i}\n\n" + "\n".join(t for t in texts if t.strip()))
        return "\n\n".join(out)


def _pdf_to_md(p: Path) -> str:
    """Extract text from PDF. Uses pdfminer.six if available, else PyPDF2."""
    try:
        from pdfminer.high_level import extract_text  # type: ignore

        return extract_text(str(p))
    except ImportError:
        try:
            from PyPDF2 import PdfReader  # type: ignore

            reader = PdfReader(str(p))
            return "\n\n".join((page.extract_text() or "") for page in reader.pages)
        except ImportError:
            logger.warning("No PDF library available; cannot extract text from %s", p)
            return ""
