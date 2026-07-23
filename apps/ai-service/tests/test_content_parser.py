"""content_parser.py 单元测试:多格式内容解析为统一 HTML。

测试覆盖:
- parse_md:markdown → html(注入 mock markdown 库 + ImportError 路径)
- parse_html:html 清洗(移除 script/style/on* 属性)
- parse_docx:mammoth 路径 + python-docx 降级路径 + 全部缺失
- parse_pdf:pdfplumber 路径 + 空 PDF
- parse_to_html:format 调度(md/html/docx/pdf/image/video/未知)
- _safe_read:文件不存在 / 超大 / 正常读取
- enrich_content:html 已填充跳过 / 解析失败不阻塞 / 解析成功填充
"""

from __future__ import annotations

import sys
import types
from dataclasses import dataclass
from typing import Any

import pytest

from app.services.publish import content_parser
from app.services.publish.content_parser import (
    _safe_read,
    enrich_content,
    parse_docx,
    parse_html,
    parse_md,
    parse_pdf,
    parse_to_html,
)


# =============================================================================
# 辅助:mock markdown / bs4 / mammoth / docx / pdfplumber 模块
# =============================================================================


def _install_fake_markdown(monkeypatch, html_output: str = "<p>mock</p>"):
    """注入一个假的 markdown 模块,markdown() 返回固定 html。"""
    fake = types.ModuleType("markdown")

    def fake_markdown(text, extensions=None, output_format=None):
        return html_output

    fake.markdown = fake_markdown  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "markdown", fake)
    return fake


def _install_fake_bs4(monkeypatch, html_output: str = "<p>cleaned</p>"):
    """注入一个假的 bs4 模块,BeautifulSoup 返回固定 html。

    _FakeTag 支持 __delitem__(用于 parse_html 中的 `del tag[attr]`)。
    """
    fake = types.ModuleType("bs4")

    class _FakeTag:
        def __init__(self, name="div", attrs=None):
            self.name = name
            self.attrs = dict(attrs) if attrs else {}

        def decompose(self):
            pass

        def __delitem__(self, key):
            self.attrs.pop(key, None)

    class _FakeSoup:
        def __init__(self, text, parser=None):
            self.text = text
            self._removed = []

        def find_all(self, name=None, attrs=None):
            # 简单返回一些 tag(用于 decompose / attr 遍历)
            if name in (["script", "style", "iframe", "object", "embed", "form"],):
                return [_FakeTag("script"), _FakeTag("style")]
            if name is True or name is None:
                return [_FakeTag("div", {"onclick": "x()", "class": "ok"})]
            return []

        def __str__(self):
            return html_output

    fake.BeautifulSoup = _FakeSoup  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "bs4", fake)
    return fake


def _install_fake_mammoth(monkeypatch, html_output: str = "<p>mammoth html</p>"):
    """注入假的 mammoth 模块。"""
    fake = types.ModuleType("mammoth")

    class _Result:
        value = html_output

    def fake_convert_to_html(file_obj):
        return _Result()

    fake.convert_to_html = fake_convert_to_html  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "mammoth", fake)
    return fake


def _install_fake_docx(monkeypatch, paragraphs):
    """注入假的 docx 模块,Document() 返回给定 paragraphs。"""
    fake = types.ModuleType("docx")

    class _Style:
        def __init__(self, name):
            self.name = name

    class _Para:
        def __init__(self, text, style_name="Normal"):
            self.text = text
            self.style = _Style(style_name)

    class _Document:
        def __init__(self, path):
            self.paragraphs = [_Para(t, s) for t, s in paragraphs]

    fake.Document = _Document  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "docx", fake)
    return fake


def _install_fake_pdfplumber(monkeypatch, pages_text):
    """注入假的 pdfplumber 模块,open() 返回上下文管理器。"""
    fake = types.ModuleType("pdfplumber")

    class _Page:
        def __init__(self, text):
            self._text = text

        def extract_text(self):
            return self._text

    class _Pdf:
        def __init__(self, pages_text):
            self.pages = [_Page(t) for t in pages_text]

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    def fake_open(path):
        return _Pdf(pages_text)

    fake.open = fake_open  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "pdfplumber", fake)
    return fake


# =============================================================================
# parse_md
# =============================================================================


def test_parse_md_with_markdown_lib(monkeypatch):
    """安装 markdown 库时返回其输出。"""
    _install_fake_markdown(monkeypatch, "<h1>title</h1>")
    result = parse_md("# title")
    assert result == "<h1>title</h1>"


def test_parse_md_passes_extensions(monkeypatch):
    """parse_md 应调用 markdown.markdown 带 extensions 参数。"""
    captured: dict = {}

    fake = types.ModuleType("markdown")

    def fake_markdown(text, extensions=None, output_format=None):
        captured["text"] = text
        captured["extensions"] = extensions
        captured["output_format"] = output_format
        return "<p>x</p>"

    fake.markdown = fake_markdown  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "markdown", fake)

    parse_md("hello")
    assert captured["text"] == "hello"
    assert "tables" in captured["extensions"]
    assert "fenced_code" in captured["extensions"]
    assert captured["output_format"] == "html5"


def test_parse_md_empty_string(monkeypatch):
    """空字符串 markdown 也能解析(返回 mock 输出)。"""
    _install_fake_markdown(monkeypatch, "")
    assert parse_md("") == ""


def test_parse_md_without_library_raises_runtime_error(monkeypatch):
    """未安装 markdown 库时抛 RuntimeError(含 'markdown library not installed')。"""
    monkeypatch.setitem(sys.modules, "markdown", None)
    # 强制重新 import 触发 ImportError
    import importlib

    # 移除模块,触发 ImportError
    if "markdown" in sys.modules:
        monkeypatch.delitem(sys.modules, "markdown", raising=False)
    with pytest.raises(RuntimeError, match="markdown library not installed"):
        parse_md("text")


# =============================================================================
# parse_html
# =============================================================================


def test_parse_html_returns_cleaned(monkeypatch):
    """安装 bs4 时返回清洗后的 html。"""
    _install_fake_bs4(monkeypatch, "<p>cleaned</p>")
    result = parse_html("<p>raw</p>")
    assert result == "<p>cleaned</p>"


def test_parse_html_without_bs4_raises(monkeypatch):
    """未安装 bs4 时抛 RuntimeError(含 'beautifulsoup4 not installed')。"""
    if "bs4" in sys.modules:
        monkeypatch.delitem(sys.modules, "bs4", raising=False)
    with pytest.raises(RuntimeError, match="beautifulsoup4 not installed"):
        parse_html("<p>x</p>")


def test_parse_html_empty_string(monkeypatch):
    """空字符串也能被 bs4 处理。"""
    _install_fake_bs4(monkeypatch, "")
    assert parse_html("") == ""


# =============================================================================
# parse_docx
# =============================================================================


def test_parse_docx_uses_mammoth_when_available(monkeypatch, tmp_path):
    """mammoth 可用时优先用 mammoth。"""
    _install_fake_mammoth(monkeypatch, "<p>mammoth html</p>")
    # docx 也安装(确保优先用 mammoth)
    _install_fake_docx(monkeypatch, [("should not be used", "Normal")])
    p = tmp_path / "f.docx"
    p.write_bytes(b"pk fake docx")
    result = parse_docx(str(p))
    assert result == "<p>mammoth html</p>"


def test_parse_docx_falls_back_to_python_docx(monkeypatch, tmp_path):
    """mammoth 不可用但 python-docx 可用时降级。"""
    # mammoth 不安装
    monkeypatch.delitem(sys.modules, "mammoth", raising=False)
    _install_fake_docx(monkeypatch, [
        ("第一段", "Normal"),
        ("标题1", "Heading 1"),
        ("标题2", "Heading 2"),
        ("标题3", "Heading 3"),
        ("", "Normal"),  # 空段落
    ])
    p = tmp_path / "f.docx"
    p.write_bytes(b"fake")
    result = parse_docx(str(p))
    assert "<h1>标题1</h1>" in result
    assert "<h2>标题2</h2>" in result
    assert "<h3>标题3</h3>" in result
    assert "<p>第一段</p>" in result
    assert "<p></p>" in result  # 空段落


def test_parse_docx_neither_lib_raises(monkeypatch, tmp_path):
    """mammoth 和 python-docx 都未安装时抛 RuntimeError。"""
    monkeypatch.delitem(sys.modules, "mammoth", raising=False)
    monkeypatch.delitem(sys.modules, "docx", raising=False)
    p = tmp_path / "f.docx"
    p.write_bytes(b"fake")
    with pytest.raises(RuntimeError, match="neither mammoth nor python-docx"):
        parse_docx(str(p))


# =============================================================================
# parse_pdf
# =============================================================================


def test_parse_pdf_with_pdfplumber(monkeypatch, tmp_path):
    """安装 pdfplumber 时返回每页一个 h2 + 段落。"""
    _install_fake_pdfplumber(monkeypatch, ["第一页内容", "第二页内容"])
    p = tmp_path / "f.pdf"
    p.write_bytes(b"fake pdf")
    result = parse_pdf(str(p))
    assert "<h2>第 1 页</h2>" in result
    assert "<h2>第 2 页</h2>" in result
    assert "<p>第一页内容</p>" in result
    assert "<p>第二页内容</p>" in result


def test_parse_pdf_empty_pages(monkeypatch, tmp_path):
    """所有页都无文本时返回 fallback 消息。"""
    _install_fake_pdfplumber(monkeypatch, ["", "   "])
    p = tmp_path / "f.pdf"
    p.write_bytes(b"fake")
    result = parse_pdf(str(p))
    assert "PDF 无可提取文本" in result


def test_parse_pdf_without_pdfplumber_raises(monkeypatch, tmp_path):
    """未安装 pdfplumber 时抛 RuntimeError。"""
    monkeypatch.delitem(sys.modules, "pdfplumber", raising=False)
    p = tmp_path / "f.pdf"
    p.write_bytes(b"fake")
    with pytest.raises(RuntimeError, match="pdfplumber not installed"):
        parse_pdf(str(p))


# =============================================================================
# parse_to_html 调度
# =============================================================================


def test_parse_to_html_md(monkeypatch):
    """format=md 应调 parse_md。"""
    _install_fake_markdown(monkeypatch, "<p>md</p>")
    html, images = parse_to_html("md", text="# title")
    assert html == "<p>md</p>"
    assert images == []


def test_parse_to_html_html(monkeypatch):
    """format=html 应调 parse_html。"""
    _install_fake_bs4(monkeypatch, "<p>html</p>")
    html, images = parse_to_html("html", text="<p>x</p>")
    assert html == "<p>html</p>"
    assert images == []


def test_parse_to_html_image_returns_empty(monkeypatch):
    """format=image 不解析,返回空 html。"""
    html, images = parse_to_html("image", file_path="/tmp/x.png")
    assert html == ""
    assert images == []


def test_parse_to_html_video_returns_empty(monkeypatch):
    """format=video 不解析,返回空 html。"""
    html, images = parse_to_html("video", file_path="/tmp/x.mp4")
    assert html == ""
    assert images == []


def test_parse_to_html_docx_requires_file_path():
    """format=docx 缺 file_path 应抛 ValueError。"""
    with pytest.raises(ValueError, match="docx format requires file_path"):
        parse_to_html("docx")


def test_parse_to_html_pdf_requires_file_path():
    """format=pdf 缺 file_path 应抛 ValueError。"""
    with pytest.raises(ValueError, match="pdf format requires file_path"):
        parse_to_html("pdf")


def test_parse_to_html_md_requires_text():
    """format=md 缺 text 应抛 ValueError。"""
    with pytest.raises(ValueError, match="md format requires text field"):
        parse_to_html("md", text="")


def test_parse_to_html_html_requires_text():
    """format=html 缺 text 应抛 ValueError。"""
    with pytest.raises(ValueError, match="html format requires text field"):
        parse_to_html("html", text=None)


def test_parse_to_html_unsupported_format():
    """未知 format 应抛 ValueError(含 'unsupported format')。"""
    with pytest.raises(ValueError, match="unsupported format"):
        parse_to_html("zip")


def test_parse_to_html_format_case_insensitive(monkeypatch):
    """format 大小写不敏感(MD / Md / md 等价)。"""
    _install_fake_markdown(monkeypatch, "<p>ok</p>")
    html, _ = parse_to_html("MD", text="x")
    assert html == "<p>ok</p>"


# =============================================================================
# _safe_read
# =============================================================================


def test_safe_read_missing_file_raises():
    """文件不存在应抛 FileNotFoundError。"""
    with pytest.raises(FileNotFoundError, match="file not found"):
        _safe_read("/nonexistent/path/file.txt")


def test_safe_read_too_large_raises(tmp_path, monkeypatch):
    """超过 max_bytes 应抛 ValueError(含 'file too large')。"""
    import os
    import pathlib
    import stat as stat_mod

    p = tmp_path / "big.bin"
    p.write_bytes(b"x" * 100)

    # 用真实 stat 作为基础,只覆盖 st_size 为超大值
    real_stat = p.stat()
    big_stat = os.stat_result(
        (real_stat.st_mode, real_stat.st_ino, real_stat.st_dev, real_stat.st_nlink,
         real_stat.st_uid, real_stat.st_gid, 100 * 1024 * 1024 + 1,  # st_size = 100MB+1
         real_stat.st_atime, real_stat.st_mtime, real_stat.st_ctime)
    )
    monkeypatch.setattr(pathlib.Path, "stat", lambda self: big_stat)
    with pytest.raises(ValueError, match="file too large"):
        _safe_read(str(p), max_bytes=50 * 1024 * 1024)


def test_safe_read_normal(tmp_path):
    """正常文件应返回字节内容。"""
    p = tmp_path / "ok.txt"
    p.write_bytes(b"hello world")
    data = _safe_read(str(p))
    assert data == b"hello world"


def test_safe_read_custom_max_bytes(tmp_path):
    """自定义 max_bytes 应生效。"""
    p = tmp_path / "ok.txt"
    p.write_bytes(b"hello")
    data = _safe_read(str(p), max_bytes=10)
    assert data == b"hello"


# =============================================================================
# enrich_content
# =============================================================================


@dataclass
class _FakeContent:
    """模拟 PublishContent(只需 enrich_content 用到的字段)。"""
    format: str = "md"
    title: str = "t"
    text: str | None = None
    file_path: str | None = None
    cover_path: str | None = None
    html: str | None = None
    images: list = None
    extra: dict = None


def test_enrich_content_skips_when_html_already_set():
    """content.html 已非空时直接返回,不解析。"""
    c = _FakeContent(format="md", text="# title", html="<p>already</p>")
    result = enrich_content(c)
    assert result.html == "<p>already</p>"


def test_enrich_content_fills_html_on_success(monkeypatch):
    """html 为空 + 解析成功 → 填充 html 字段。"""
    _install_fake_markdown(monkeypatch, "<p>parsed</p>")
    c = _FakeContent(format="md", text="# title", html=None)
    result = enrich_content(c)
    assert result.html == "<p>parsed</p>"


def test_enrich_content_parse_failure_does_not_raise(monkeypatch):
    """解析失败时 enrich_content 不抛异常,html 设为空字符串。"""
    # 不安装 markdown → parse_md 抛 RuntimeError
    monkeypatch.delitem(sys.modules, "markdown", raising=False)
    c = _FakeContent(format="md", text="# title", html=None)
    result = enrich_content(c)  # 不抛
    assert result.html == ""


def test_enrich_content_image_format_keeps_empty_html():
    """image format 不需要 html,enrich 后仍为空。"""
    c = _FakeContent(format="image", file_path="/tmp/x.png", html=None)
    result = enrich_content(c)
    assert result.html == ""
