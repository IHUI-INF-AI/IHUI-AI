# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""PDF 第二抽取器（pdfium）与页栅格化：真构造 PDF 字节，验证每级各自能救什么。

判据不是「函数被调用了」，而是**同一份 PDF 在两条路上给出可复现的不同结果**：
``ASCII85`` 压缩的内容流自研解析器读不到、pdfium 读得到；纯图片页谁都读不到
文本层，但栅格化必须真的吐出 PNG（否则「扫描件能被 OCR」就是空话）。
"""

from __future__ import annotations

import base64
import io
import sys
import types
import zlib

import pytest
from PIL import Image

from app.services.sag2_lexical import ocr_text
from app.services.sag2_lexical.folder_ingest import extract_text
from app.services.sag2_lexical.pdf_raster import (
    extract_text_pdfium,
    rasterize_pdf,
    rasterizer_status,
)
from app.services.sag2_lexical.pdf_text import extract_pdf_text

# ---------------------------------------------------------------------------
# 最小 PDF 构造器
#
# 与 ``test_sag2_pdf_text.py`` 里那份同源：pytest 的 import 模式不保证 ``tests``
# 目录在 ``sys.path`` 上（xdist 下尤其），跨测试文件 import 会 Collection Error。
# 这里保留一份自包含副本，两个文件各自独立可跑。
# ---------------------------------------------------------------------------


def _build_pdf(objects: list[bytes], trailer_extra: str = "") -> bytes:
    """拼一份结构合法（带 xref）的最小 PDF。"""
    out = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for index, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{index} 0 obj\n".encode() + body + b"\nendobj\n"
    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R {trailer_extra} >>\n"
        f"startxref\n{xref_at}\n%%EOF\n"
    ).encode()
    return bytes(out)


_CATALOG = b"<< /Type /Catalog /Pages 2 0 R >>"
_PAGES = b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"
_PAGE = (
    b"<< /Type /Page /Parent 2 0 R /Contents 4 0 R "
    b"/Resources << /Font << /F1 5 0 R >> >> >>"
)
_FONT = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"


def _stream(payload: bytes, *, compress: bool = False, extra: str = "") -> bytes:
    if compress:
        payload = zlib.compress(payload)
        extra = f"/Filter /FlateDecode {extra}"
    return (
        f"<< /Length {len(payload)} {extra}>>\nstream\n".encode()
        + payload
        + b"\nendstream"
    )

SENTENCE = b"BT /F1 12 Tf 72 720 Td (Quarterly budget approval flow v2) Tj ET"


def _ascii85_pdf() -> bytes:
    """内容流用 ASCII85Decode 压缩：自研解析器不认这个过滤器，pdfium 认。"""
    encoded = base64.a85encode(SENTENCE) + b"~>"
    stream = (
        f"<< /Length {len(encoded)} /Filter /ASCII85Decode >>\nstream\n".encode()
        + encoded
        + b"\nendstream"
    )
    return _build_pdf([_CATALOG, _PAGES, _PAGE, stream, _FONT])


def _scanned_pdf(path: str, pages: int = 1) -> str:
    """用 PIL 写多页纯图片 PDF —— 真实扫描件就是这个形态（DCTDecode，无文本层）。"""
    images = []
    for _index in range(pages):
        image = Image.new("RGB", (700, 240), "white")
        images.append(image)
    images[0].save(path, "PDF", save_all=True, append_images=images[1:], resolution=150)
    return path


# ---------------------------------------------------------------------------
# pdfium 文本层
# ---------------------------------------------------------------------------


def test_pdfium_抽普通PDF文本(tmp_path) -> None:
    data = _build_pdf([_CATALOG, _PAGES, _PAGE, _stream(SENTENCE), _FONT])
    target = tmp_path / "plain.pdf"
    target.write_bytes(data)
    text, reason = extract_text_pdfium(str(target))
    assert reason == ""
    assert "Quarterly budget approval flow v2" in str(text)


def test_ASCII85压缩_pdfium救回自研读不到的PDF(tmp_path) -> None:
    """这是第二级存在的**唯一理由**：自研失败的那份文件，pdfium 必须读得出来。"""
    target = tmp_path / "a85.pdf"
    target.write_bytes(_ascii85_pdf())

    builtin_text, builtin_reason = extract_pdf_text(str(target))
    assert builtin_text is None, "自研解析器不该认出 ASCII85 内容流"
    assert builtin_reason.startswith(("no-text-layer", "unsupported"))

    text, reason = extract_text_pdfium(str(target))
    assert reason == ""
    assert "Quarterly budget approval flow v2" in str(text)


def test_多页PDF超上限时带截断标记(tmp_path) -> None:
    # 3 页纯图 PDF，只允许读 2 页：调用方必须知道「没读完」。
    target = _scanned_pdf(str(tmp_path / "three.pdf"), pages=3)
    text, reason = extract_text_pdfium(target, max_pages=2)
    assert text is None  # 纯图页本来就没有文本层
    assert reason.startswith("no-text-layer")


def test_文本页被截断时标记页数(tmp_path) -> None:
    """页数超上限且有文本时，reason 里必须写清读出几页/共几页。"""
    # 自造两页都有文本的 PDF：把同一页对象挂两次会共享内容，这里直接拼两份对象。
    data = _build_pdf(
        [
            b"<< /Type /Catalog /Pages 2 0 R >>",
            b"<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>",
            _PAGE,
            _stream(SENTENCE),
            _FONT,
            b"<< /Type /Page /Parent 2 0 R /Contents 7 0 R "
            b"/Resources << /Font << /F1 5 0 R >> >> >>",
            _stream(b"BT /F1 12 Tf 72 700 Td (Second page body text) Tj ET"),
        ]
    )
    target = tmp_path / "twopage.pdf"
    target.write_bytes(data)
    text, reason = extract_text_pdfium(str(target), max_pages=1)
    assert text is not None
    assert reason.startswith(";truncated:1/2pages"), reason


def test_损坏PDF给具名原因而不是抛异常(tmp_path) -> None:
    target = tmp_path / "broken.pdf"
    target.write_bytes(b"%PDF-1.4\nthis is not a real pdf\n%%EOF\n")
    text, reason = extract_text_pdfium(str(target))
    assert text is None
    assert reason.startswith(("open-failed", "no-text-layer", "empty-document"))


# ---------------------------------------------------------------------------
# 栅格化
# ---------------------------------------------------------------------------


def test_扫描件栅格化真的产出PNG(tmp_path) -> None:
    target = _scanned_pdf(str(tmp_path / "scan.pdf"))
    images, reason = rasterize_pdf(target, limit=2, dpi=120)
    assert reason == ""
    assert len(images) == 1
    image = Image.open(io.BytesIO(images[0]))
    assert image.format == "PNG"
    # PIL 的 resolution=150 把 700px 定成 336pt 宽的页面；120dpi 渲染 ⇒ 约 560px。
    # 这里只钉「真的按 dpi 渲染出了一张合理的位图」，不钉死具体像素。
    assert 400 < image.width < 900
    assert 100 < image.height < 400


def test_栅格化页数上限生效(tmp_path) -> None:
    target = _scanned_pdf(str(tmp_path / "three.pdf"), pages=3)
    images, reason = rasterize_pdf(target, limit=2, dpi=72)
    assert reason == ""
    assert len(images) == 2


def test_栅格化DPI被夹到上限(tmp_path) -> None:
    """dpi 超出上限时按上限渲染，而不是照单全收把 CPU 打满。"""
    target = _scanned_pdf(str(tmp_path / "scan.pdf"))
    tiny, _ = rasterize_pdf(target, limit=1, dpi=50)
    huge, _ = rasterize_pdf(target, limit=1, dpi=100_000)
    wide_tiny = Image.open(io.BytesIO(tiny[0])).width
    wide_huge = Image.open(io.BytesIO(huge[0])).width
    assert wide_huge > wide_tiny
    # 400dpi 上限 → 宽度 = 700 * 400/72 ≈ 3888；若真按 100000dpi 渲会是天文数字
    assert wide_huge < 4500


def test_打不开的文件栅格化具名失败(tmp_path) -> None:
    target = tmp_path / "x.pdf"
    target.write_bytes(b"not a pdf at all")
    images, reason = rasterize_pdf(target)
    assert images == []
    assert reason.startswith(("open-failed", "rasterize-failed", "empty-document"))


def test_栅格化器状态如实(tmp_path) -> None:
    info = rasterizer_status()
    assert info["engine"] == "pdfium"
    assert info["installed"] is True
    assert info["max_dpi"] == 400


# ---------------------------------------------------------------------------
# 四级链端到端
# ---------------------------------------------------------------------------


class _FakeRapidOCR:
    def __init__(self, rows: list) -> None:
        self.rows = rows
        self.calls = 0

    def __call__(self, image):  # noqa: ANN001, ANN204
        self.calls += 1
        return self.rows, [0.01]


def _install_rapidocr(monkeypatch: pytest.MonkeyPatch, engine: object) -> None:
    module = types.ModuleType("rapidocr_onnxruntime")
    module.RapidOCR = lambda: engine  # noqa: ARG005
    monkeypatch.setitem(sys.modules, "rapidocr_onnxruntime", module)
    monkeypatch.setattr(ocr_text, "_rapid_engine", None)


def test_扫描件PDF走完四级链并由OCR读出文本(tmp_path, monkeypatch) -> None:
    """整条链的证据：自研/pdfium/pdfplumber 全判无文本层 ⇒ 栅格化 ⇒ OCR 出字。"""
    monkeypatch.setitem(sys.modules, "pytesseract", None)
    _install_rapidocr(
        monkeypatch,
        _FakeRapidOCR(
            [
                [[[0, 0], [1, 0], [1, 1], [0, 1]], "发票号 12345 金额 2000 元", 0.98],
                [[[0, 0], [1, 0], [1, 1], [0, 1]], "开票日期 2026-11-09", 0.95],
            ]
        ),
    )
    target = _scanned_pdf(str(tmp_path / "发票扫描件.pdf"))
    text, parser, reason = extract_text(target)
    assert parser == "pdf+rapidocr", reason
    assert reason == ""
    assert "12345" in str(text)
    assert "2026-11-09" in str(text)


def test_OCR低置信度行被丢弃(tmp_path, monkeypatch) -> None:
    """OCR 的错字会直接污染索引，低于阈值的行必须丢。"""
    monkeypatch.setitem(sys.modules, "pytesseract", None)
    _install_rapidocr(
        monkeypatch,
        _FakeRapidOCR(
            [
                [[[0, 0], [1, 0], [1, 1], [0, 1]], "这是可信的一行正文内容，共二十来个字", 0.97],
                [[[0, 0], [1, 0], [1, 1], [0, 1]], "糊成一团乱码低分", 0.10],
            ]
        ),
    )
    target = _scanned_pdf(str(tmp_path / "scan.pdf"))
    text, parser, _reason = extract_text(target)
    assert parser == "pdf+rapidocr"
    assert "这是可信的一行正文内容" in str(text)
    assert "糊成一团乱码低分" not in str(text)


def test_有引擎但认不出字时如实报ocr_empty(tmp_path, monkeypatch) -> None:
    monkeypatch.setitem(sys.modules, "pytesseract", None)
    _install_rapidocr(monkeypatch, _FakeRapidOCR([]))
    target = _scanned_pdf(str(tmp_path / "blank.pdf"))
    text, parser, reason = extract_text(target)
    assert (text, parser) == (None, "none")
    assert "ocr" in reason and "empty" in reason
    assert "needs-ocr:pdf" in reason


def test_无任何OCR引擎时原因里说清是缺引擎(tmp_path, monkeypatch) -> None:
    monkeypatch.setitem(sys.modules, "rapidocr_onnxruntime", None)
    monkeypatch.setitem(sys.modules, "pytesseract", None)
    monkeypatch.setattr(ocr_text, "_rapid_engine", None)
    target = _scanned_pdf(str(tmp_path / "scan.pdf"))
    text, parser, reason = extract_text(target)
    assert (text, parser) == (None, "none")
    assert "no-ocr-engine" in reason
    assert "needs-ocr:pdf" in reason


def test_加密PDF不误导成需要OCR() -> None:
    """加密文件要的是密码，不是 OCR —— 别把用户引到错的修法上。

    直接钉 ``_pdf_fail_reason``：造一份**真加密**的 PDF 需要 PDF 加密库
    （不在依赖面内），而这条规则本身是纯函数，用四级链的真实原因串验证更准。
    """
    from app.services.sag2_lexical.folder_ingest import _pdf_fail_reason

    reason = _pdf_fail_reason(
        [
            "builtin:encrypted:文档已加密(本抽取器不处理加密)",
            "pdfium:encrypted:需要打开密码",
            "pdfplumber-failed:PdfminerException",
            "ocr:no-ocr-engine",
        ]
    )
    assert "encrypted" in reason
    assert "needs-ocr" not in reason


def test_扫描件原因串带needs_ocr() -> None:
    from app.services.sag2_lexical.folder_ingest import _pdf_fail_reason

    reason = _pdf_fail_reason(
        [
            "builtin:no-text-layer:内容流里没有文本操作符",
            "pdfium:no-text-layer:pdfium 也读不到文本层(扫描件/矢量图)",
            "pdfplumber:empty",
            "ocr:no-ocr-engine",
        ]
    )
    assert "no-text-layer" in reason
    assert "needs-ocr:pdf" in reason
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
