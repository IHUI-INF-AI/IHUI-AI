# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""document_asset_tools.py 测试 — 文档内嵌资产与结构化表格提取。

覆盖维度:
1. extract_document_assets — docx 含图提取/落盘/媒体类型/相对路径
2. extract_document_assets — 无图文档返回 0、pdf 明确不支持、路径安全、anydoc 缺失
3. document_tables — 含合并 span 的表格展开、无表文档、pdf 不支持、路径安全
"""

from __future__ import annotations

import base64
import zipfile
from pathlib import Path
from unittest.mock import patch

import pytest

from app.tools import document_asset_tools as dat
from app.tools import document_tools as dt

_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)

_W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def _content_types(with_png: bool = False) -> str:
    png = (
        '<Default Extension="png" ContentType="image/png"/>'
        if with_png
        else ""
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        + png
        + '<Override PartName="/word/document.xml"'
        ' ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )


def _rels(with_png: bool = False) -> str:
    del with_png  # package rels 只含 officeDocument(图片关系见 word/_rels/document.xml.rels)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"'
        ' Target="word/document.xml"/>'
        "</Relationships>"
    )


def _doc_rels(with_png: bool = False) -> str:
    img_rel = (
        '<Relationship Id="rId2"'
        ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"'
        ' Target="media/image1.png"/>'
        if with_png
        else ""
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"'
        ' Target="document.xml"/>'
        + img_rel
        + "</Relationships>"
    )


def _docx_with_image(path: Path, title: str = "Img Doc") -> None:
    """docx: 标题 + 一段内嵌 PNG(图片关系放 word/_rels/document.xml.rels)。"""
    doc = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
        ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
        ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
        ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
        ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'
        f"<w:p><w:r><w:t>{title}</w:t></w:r></w:p>"
        "<w:p><w:r><w:drawing><wp:inline distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\">"
        '<wp:extent cx="600000" cy="600000"/>'
        '<wp:docPr id="1" name="Picture 1" descr="hero"/>'
        '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        "<pic:pic><pic:nvPicPr><pic:cNvPr id=\"0\" name=\"x\"/><pic:cNvPicPr/></pic:nvPicPr>"
        '<pic:blipFill><a:blip r:embed="rId2"/></pic:blipFill><pic:spPr/></pic:pic>'
        "</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>"
        "</w:body></w:document>"
    )
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", _content_types(with_png=True))
        zf.writestr("_rels/.rels", _rels(with_png=False))
        zf.writestr("word/_rels/document.xml.rels", _doc_rels(with_png=True))
        zf.writestr("word/document.xml", doc)
        zf.writestr("word/media/image1.png", _PNG)


def _docx_with_table(path: Path) -> None:
    """docx: 含 1 个 2 行 3 列、首行网格合并(gridSpan=2)的表格。"""
    doc = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
        "<w:tbl>"
        "<w:tr><w:tc><w:tcPr><w:gridSpan w:val=\"2\"/></w:tcPr><w:p><w:r><w:t>Merged A+B</w:t></w:r></w:p></w:tc>"
        "<w:tc><w:p><w:r><w:t>C1</w:t></w:r></w:p></w:tc></w:tr>"
        "<w:tr><w:tc><w:p><w:r><w:t>X</w:t></w:r></w:p></w:tc>"
        "<w:tc><w:p><w:r><w:t>Y</w:t></w:r></w:p></w:tc>"
        "<w:tc><w:p><w:r><w:t>Z</w:t></w:r></w:p></w:tc></w:tr>"
        "</w:tbl>"
        "</w:body></w:document>"
    )
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", _content_types(with_png=False))
        zf.writestr("_rels/.rels", _rels(with_png=False))
        zf.writestr("word/document.xml", doc)


def _in_tmp(name: str) -> Path:
    f = Path(dt.PROJECT_ROOT) / "tmp"
    f.mkdir(exist_ok=True)
    return f / name


# ============================================================
# 1-2. extract_document_assets
# ============================================================


@pytest.mark.skipif(not dt._ANYDOC_OK, reason="anydoc 未安装")
@pytest.mark.asyncio
async def test_extract_assets_docx_with_image(tmp_path):
    target = _in_tmp("daa_img.docx")
    _docx_with_image(target, title="Asset Doc")
    try:
        r = await dat.extract_document_assets({"path": str(target)})
        assert r["tool"] == "extract_document_assets"
        assert r["ok"] is True
        assert r["asset_count"] >= 1
        asset = r["assets"][0]
        assert asset["ok"] is True
        assert asset["media_type"] == "image/png"
        assert asset["extension"] == "png"
        assert asset["bytes"] == len(_PNG)
        assert asset["filename"].endswith(".png")
        assert asset["relative_path"].startswith("tmp/anydoc-assets/")
        saved = Path(dt.PROJECT_ROOT) / asset["relative_path"]
        assert saved.exists()
        assert saved.read_bytes() == _PNG
        saved.unlink()
    finally:
        target.unlink(missing_ok=True)


@pytest.mark.skipif(not dt._ANYDOC_OK, reason="anydoc 未安装")
@pytest.mark.asyncio
async def test_extract_assets_no_image():
    target = _in_tmp("daa_plain.docx")
    _docx_with_table(target)
    try:
        r = await dat.extract_document_assets({"path": str(target)})
        assert r["ok"] is True
        assert r["asset_count"] == 0
        assert r["assets"] == []
    finally:
        target.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_extract_assets_pdf_unsupported():
    target = _in_tmp("daa_x.pdf")
    target.write_bytes(b"%PDF-1.4\nfake")
    try:
        r = await dat.extract_document_assets({"path": str(target)})
        assert r["ok"] is False
        assert "PDF" in r["message"]
    finally:
        target.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_extract_assets_unsupported_ext():
    r = await dat.extract_document_assets({"path": "apps/ai-service/pyproject.toml"})
    assert r["ok"] is False


@pytest.mark.asyncio
async def test_extract_assets_outside_root():
    r = await dat.extract_document_assets({"path": r"C:\Windows\win.ini"})
    assert r["ok"] is False
    assert "路径越界" in r["message"]


@pytest.mark.skipif(not dt._ANYDOC_OK, reason="anydoc 未安装")
@pytest.mark.asyncio
async def test_extract_assets_without_anydoc():
    target = _in_tmp("daa_noany.docx")
    _docx_with_image(target)
    try:
        with patch.object(dt, "_ANYDOC_OK", False):
            r = await dat.extract_document_assets({"path": str(target)})
        assert r["ok"] is False
        assert "不可用" in r["message"]
    finally:
        target.unlink(missing_ok=True)


# ============================================================
# 3. document_tables
# ============================================================


@pytest.mark.skipif(not dt._ANYDOC_OK, reason="anydoc 未安装")
@pytest.mark.asyncio
async def test_tables_with_merged_span():
    target = _in_tmp("daa_table.docx")
    _docx_with_table(target)
    try:
        r = await dat.document_tables({"path": str(target)})
        assert r["tool"] == "document_tables"
        assert r["ok"] is True
        assert r["table_count"] == 1
        t = r["tables"][0]
        # gridSpan=2 的合并格应按 origin 值展开为两列
        assert t["rows"][0] == ["Merged A+B", "Merged A+B", "C1"]
        assert t["rows"][1] == ["X", "Y", "Z"]
        assert "| Merged A+B | Merged A+B | C1 |" in t["markdown"]
        assert "Merged A+B,Merged A+B,C1" in t["csv"]
    finally:
        target.unlink(missing_ok=True)


@pytest.mark.skipif(not dt._ANYDOC_OK, reason="anydoc 未安装")
@pytest.mark.asyncio
async def test_tables_empty_doc():
    target = _in_tmp("daa_notable.docx")
    _docx_with_image(target, title="No Table")
    try:
        r = await dat.document_tables({"path": str(target)})
        assert r["ok"] is False
        assert r["table_count"] == 0
    finally:
        target.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_tables_pdf_unsupported():
    target = _in_tmp("daa_t.pdf")
    target.write_bytes(b"%PDF-1.4\nfake")
    try:
        r = await dat.document_tables({"path": str(target)})
        assert r["ok"] is False
        assert "PDF" in r["message"]
    finally:
        target.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_tables_outside_root():
    r = await dat.document_tables({"path": r"C:\Windows\win.ini"})
    assert r["ok"] is False
    assert "路径越界" in r["message"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
