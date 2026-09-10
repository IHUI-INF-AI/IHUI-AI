# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""document_tools.py 测试 — parse_document MCP 工具。

覆盖维度:
1. PROJECT_ROOT 动态推导(2026-09-08 修复硬编码 G:\\IHUI-AI 死路径的防回归)
2. 白名单扩展名(anydoc 扩展至 15 种)
3. anydoc 主路径(docx/pdf/rtf)+ parser 字段
4. 旧实现降级(anydoc 不可用时 docx → docx-zipfile)
5. 文本路径(txt/json 校验警告)
6. 路径安全(越界/敏感文件/不存在/不支持格式)
7. max_chars 钳制与截断
"""

from __future__ import annotations

import zipfile
from pathlib import Path
from unittest.mock import patch

import pytest

from app.tools import document_tools as dt


def _make_docx(path: Path, title: str = "Doc Test") -> None:
    ct = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )
    doc = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body><w:p><w:r><w:t>{title}</w:t></w:r></w:p></w:body></w:document>"
    )
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", ct)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", doc)


# ============================================================
# 1. PROJECT_ROOT 动态推导(防回归:不得再硬编码不存在的盘符)
# ============================================================


class TestProjectRoot:
    def test_project_root_points_to_repo_root(self):
        root = Path(dt.PROJECT_ROOT)
        assert root.exists(), f"PROJECT_ROOT 不存在: {dt.PROJECT_ROOT}"
        # monorepo 根应包含 apps/ai-service
        assert (root / "apps" / "ai-service").is_dir()

    def test_project_root_matches_convention(self):
        """与 chart_tools.py / artifacts.py 的 parents[4] 惯例一致。"""
        from app.tools import chart_tools

        assert Path(dt.PROJECT_ROOT).resolve() == Path(chart_tools._PROJECT_ROOT).resolve()


# ============================================================
# 2. 白名单
# ============================================================


class TestSupportedExtensions:
    def test_includes_anydoc_formats(self):
        for ext in [".doc", ".pptx", ".ppt", ".xls", ".odt", ".ods", ".odp", ".rtf", ".epub"]:
            assert ext in dt.SUPPORTED_EXTENSIONS

    def test_keeps_legacy_formats(self):
        for ext in [".txt", ".md", ".csv", ".json", ".pdf", ".docx", ".xlsx"]:
            assert ext in dt.SUPPORTED_EXTENSIONS


# ============================================================
# 3-5. 解析主路径
# ============================================================


@pytest.mark.asyncio
async def test_parse_txt(tmp_path):
    f = Path(dt.PROJECT_ROOT) / "tmp"
    f.mkdir(exist_ok=True)
    target = f / "dt_test_sample.txt"
    target.write_text("line1\nline2", encoding="utf-8")
    try:
        r = await dt.parse_document({"path": str(target)})
        assert r["ok"] is True
        assert r["parser"] == "text"
        assert "line1" in r["content"]
    finally:
        target.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_parse_json_invalid_warns(tmp_path):
    f = Path(dt.PROJECT_ROOT) / "tmp"
    f.mkdir(exist_ok=True)
    target = f / "dt_test_bad.json"
    target.write_text("{not valid", encoding="utf-8")
    try:
        r = await dt.parse_document({"path": str(target)})
        assert r["ok"] is True
        assert "JSON 格式校验失败" in r["message"]
    finally:
        target.unlink(missing_ok=True)


@pytest.mark.skipif(not dt._ANYDOC_OK, reason="anydoc 未安装")
@pytest.mark.asyncio
async def test_parse_docx_anydoc_main_path():
    f = Path(dt.PROJECT_ROOT) / "tmp"
    f.mkdir(exist_ok=True)
    target = f / "dt_test_doc.docx"
    _make_docx(target, title="Anydoc Main Path")
    try:
        r = await dt.parse_document({"path": str(target)})
        assert r["ok"] is True
        assert r["parser"] == "anydoc"
        assert "Anydoc Main Path" in r["content"]
    finally:
        target.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_parse_docx_fallback_without_anydoc():
    """anydoc 不可用时 docx 降级 docx-zipfile 旧实现。"""
    f = Path(dt.PROJECT_ROOT) / "tmp"
    f.mkdir(exist_ok=True)
    target = f / "dt_test_doc2.docx"
    _make_docx(target, title="Legacy Fallback")
    try:
        with patch.object(dt, "_ANYDOC_OK", False):
            r = await dt.parse_document({"path": str(target)})
        assert r["ok"] is True
        assert r["parser"] == "docx-zipfile"
        assert "Legacy Fallback" in r["content"]
    finally:
        target.unlink(missing_ok=True)


# ============================================================
# 6. 路径安全
# ============================================================


@pytest.mark.asyncio
async def test_reject_outside_root(tmp_path):
    # 2026-09-10 跨平台修正:改用真实存在的工作区外文件。原 r"C:\Windows\win.ini"
    # 在 Linux 上不是绝对路径(POSIX 无盘符概念),会被 join 进 PROJECT_ROOT 成为
    # "根内不存在的文件",报"文件不存在"而非"路径越界"。tmp_path 在系统临时目录,
    # 各平台都在项目根外且真实存在,能稳定触发越界校验。
    outside = tmp_path / "outside_root.txt"
    outside.write_text("x", encoding="utf-8")
    r = await dt.parse_document({"path": str(outside)})
    assert r["ok"] is False
    assert "路径越界" in r["message"]


@pytest.mark.asyncio
async def test_reject_sensitive_filename(tmp_path):
    """敏感文件名(含 token/secret 等)拒绝,即使位于项目根内。"""
    sandbox = Path(dt.PROJECT_ROOT) / "tmp"
    sandbox.mkdir(exist_ok=True)
    target = sandbox / "dt_test_api_token.txt"
    target.write_text("secret-content", encoding="utf-8")
    try:
        r = await dt.parse_document({"path": str(target)})
        assert r["ok"] is False
        assert "敏感" in r["message"]
    finally:
        target.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_reject_nonexistent():
    r = await dt.parse_document({"path": "tmp/does-not-exist-anywhere.txt"})
    assert r["ok"] is False
    assert "文件不存在" in r["message"]


@pytest.mark.asyncio
async def test_reject_unsupported_ext():
    r = await dt.parse_document({"path": "apps/ai-service/pyproject.toml"})
    assert r["ok"] is False
    assert "不支持的格式" in r["message"]


@pytest.mark.asyncio
async def test_reject_missing_path_arg():
    r = await dt.parse_document({})
    assert r["ok"] is False


# ============================================================
# 7. max_chars 钳制与截断
# ============================================================


@pytest.mark.asyncio
async def test_max_chars_truncation():
    f = Path(dt.PROJECT_ROOT) / "tmp"
    f.mkdir(exist_ok=True)
    target = f / "dt_test_big.txt"
    target.write_text("x" * 5000, encoding="utf-8")
    try:
        r = await dt.parse_document({"path": str(target), "max_chars": 500})
        assert r["ok"] is True
        assert r["truncated"] is True
        assert r["chars"] == 500
        assert "已截断" in r["message"]

        r2 = await dt.parse_document({"path": str(target), "max_chars": 1})
        assert r2["chars"] == dt.MIN_MAX_CHARS  # 下限钳制 500
    finally:
        target.unlink(missing_ok=True)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
