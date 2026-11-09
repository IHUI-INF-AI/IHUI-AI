# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""零依赖 PDF 文本抽取：真构造 PDF 字节，逐格式验证「抽得对」与「抽不出时说得清」。

不用 mock：每个用例都把一份可被任何阅读器打开的 PDF 写到临时文件，
再走 ``extract_text`` 的完整分支 —— 这样「PDF 能不能进索引」是可复现的事实，
不是对桩函数调用的断言。
"""

from __future__ import annotations

import zlib
from pathlib import Path

import pytest

from app.services.sag2_lexical.folder_ingest import extract_text
from app.services.sag2_lexical.pdf_text import extract_pdf_text, parse_tounicode


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


def _write(tmp_path: Path, data: bytes, name: str = "doc.pdf") -> str:
    path = tmp_path / name
    path.write_bytes(data)
    return str(path)


# ---------------------------------------------------------------------------
# 能抽出来的三种情况
# ---------------------------------------------------------------------------


def test_plain_uncompressed_pdf(tmp_path):
    content = b"BT /F1 12 Tf 72 720 Td (Hello world this is a plain PDF file.) Tj ET"
    data = _build_pdf([_CATALOG, _PAGES, _PAGE, _stream(content), _FONT])
    text, reason = extract_pdf_text(_write(tmp_path, data))
    assert reason == ""
    assert "Hello world this is a plain PDF file." in text


def test_flate_compressed_pdf(tmp_path):
    content = b"BT (Compressed streams are the common case in real PDFs.) Tj ET"
    data = _build_pdf(
        [_CATALOG, _PAGES, _PAGE, _stream(content, compress=True), _FONT]
    )
    text, reason = extract_pdf_text(_write(tmp_path, data))
    assert reason == ""
    assert "Compressed streams are the common case in real PDFs." in text


def test_tj_array_with_kerning_is_joined(tmp_path):
    # 真实 PDF 常用 TJ 数组，数字是字距调整，不该出现在文本里。
    content = b"BT [(Word)-250( spacing)-300( joined)] TJ ET"
    data = _build_pdf([_CATALOG, _PAGES, _PAGE, _stream(content), _FONT])
    text, reason = extract_pdf_text(_write(tmp_path, data))
    assert reason == ""
    assert "Word spacing joined" in text
    assert "-250" not in text


def test_escaped_literal_parentheses(tmp_path):
    content = rb"BT (He said \(hello\) to \[x\].) Tj ET"
    data = _build_pdf([_CATALOG, _PAGES, _PAGE, _stream(content), _FONT])
    text, reason = extract_pdf_text(_write(tmp_path, data))
    assert reason == ""
    assert "He said (hello) to [x]." in text


_CMAP = b"""/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
8 beginbfchar
<0001> <5411>
<0002> <91CF>
<0003> <68C0>
<0004> <7D22>
<0005> <7CFB>
<0006> <7EDF>
<0007> <5B9E>
<0008> <73B0>
endbfchar
endcmap
end end"""


def test_cjk_pdf_via_tounicode_cmap(tmp_path):
    """中文 PDF 的关键路径：Identity-H + ToUnicode 才能抽出汉字。"""
    content = b"BT <00010002000300040005000600070008> Tj ET"
    data = _build_pdf(
        [_CATALOG, _PAGES, _PAGE, _stream(content), _FONT, _stream(_CMAP)]
    )
    text, reason = extract_pdf_text(_write(tmp_path, data))
    assert reason == ""
    assert "向量检索系统实现" in text


def test_bfrange_mapping(tmp_path):
    cmap = (
        b"begincmap\n1 beginbfrange\n"
        b"<0001> <0003> <5411>\n"
        b"endbfrange\nendcmap"
    )
    mapping = parse_tounicode(cmap)
    assert mapping[0x0001] == "\u5411"
    assert mapping[0x0002] == "\u5412"
    assert mapping[0x0003] == "\u5413"


def test_bfrange_array_mapping(tmp_path):
    cmap = (
        b"begincmap\n1 beginbfrange\n"
        b"<0010> <0012> [<0041> <0042> <0043>]\n"
        b"endbfrange\nendcmap"
    )
    mapping = parse_tounicode(cmap)
    assert mapping[0x10] == "A"
    assert mapping[0x12] == "C"


# ---------------------------------------------------------------------------
# 抽不出来时：必须说清原因，绝不返回垃圾
# ---------------------------------------------------------------------------


def test_encrypted_pdf_is_named(tmp_path):
    data = _build_pdf(
        [_CATALOG, _PAGES, _PAGE, _stream(b"BT (secret) Tj ET"), _FONT],
        trailer_extra="/Encrypt 9 0 R",
    )
    text, reason = extract_pdf_text(_write(tmp_path, data))
    assert text is None
    assert reason.startswith("encrypted:")


def test_vector_only_page_has_no_text_layer(tmp_path):
    content = b"0 0 m 200 200 l S\nq 1 0 0 1 10 10 cm Q"
    data = _build_pdf([_CATALOG, _PAGES, _PAGE, _stream(content), _FONT])
    text, reason = extract_pdf_text(_write(tmp_path, data))
    assert text is None
    assert reason.startswith("no-text-layer")


def test_cid_without_tounicode_is_rejected_not_garbled(tmp_path):
    """没有 ToUnicode 的 CID 字体抽出来必然是乱码 —— 宁可失败也不写进索引。"""
    content = b"BT <00010002000300040005000600070008> Tj ET"
    data = _build_pdf([_CATALOG, _PAGES, _PAGE, _stream(content), _FONT])
    text, reason = extract_pdf_text(_write(tmp_path, data))
    assert text is None, f"不该把乱码当成功: {text!r}"
    assert reason


def test_private_use_area_mapping_is_rejected(tmp_path):
    cmap = b"begincmap\n8 beginbfchar\n" + b"".join(
        f"<000{i}> <E00{i}>\n".encode() for i in range(1, 9)
    ) + b"endbfchar\nendcmap"
    content = b"BT <00010002000300040005000600070008> Tj ET"
    data = _build_pdf(
        [_CATALOG, _PAGES, _PAGE, _stream(content), _FONT, _stream(cmap)]
    )
    text, reason = extract_pdf_text(_write(tmp_path, data))
    assert text is None
    assert "cid-unsupported" in reason


def test_missing_file_is_reported():
    text, reason = extract_pdf_text("G:/definitely/not/here.pdf")
    assert text is None
    assert "io-error" in reason


# ---------------------------------------------------------------------------
# 与文件夹建库的接线
# ---------------------------------------------------------------------------


def test_extract_text_routes_pdf_through_builtin_parser(tmp_path):
    content = b"BT (Folder ingest should pick this PDF up automatically.) Tj ET"
    data = _build_pdf([_CATALOG, _PAGES, _PAGE, _stream(content), _FONT])
    text, parser, reason = extract_text(_write(tmp_path, data))
    assert reason == ""
    assert parser == "pdf-builtin"
    assert "Folder ingest should pick this PDF up automatically." in text


def test_extract_text_keeps_reason_when_both_parsers_fail(tmp_path):
    """两种解析器都失败时，reason 必须带上第一层原因，而不是笼统的 missing-dep。"""
    content = b"BT <00010002000300040005000600070008> Tj ET"
    data = _build_pdf([_CATALOG, _PAGES, _PAGE, _stream(content), _FONT])
    text, parser, reason = extract_text(_write(tmp_path, data))
    assert text is None
    assert parser == "none"
    # 零依赖解析器给出的具体原因（cid 乱码 / 无可打印字符）必须保留。
    assert "pdfplumber" in reason or "cid" in reason or "garbled" in reason or "no-text-layer" in reason


@pytest.mark.parametrize("suffix", [".md", ".txt"])
def test_non_pdf_parsers_unaffected(tmp_path, suffix):
    path = tmp_path / f"a{suffix}"
    path.write_text("普通文本内容，应该走 text 解析器。", encoding="utf-8")
    text, parser, reason = extract_text(str(path))
    assert (parser, reason) == ("text", "")
    assert "普通文本内容" in text
