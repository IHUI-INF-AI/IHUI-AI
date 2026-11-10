# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIGC 隐式标识字节层改写测试(PNG tEXt+iTXt / JPEG COM)。

判据:
- 写入后像素与压缩数据逐字节不变(只增元数据块,不重编码);
- 可直接从产物字节能读回同一 content_id / notice(审计闭环);
- 不支持的格式如实返回 embedded=False,不得谎报。
"""

from __future__ import annotations

import base64
import io
import struct

import pytest
from PIL import Image

from app.services.aigc_watermark import (
    AIGC_METADATA_KEYWORD,
    detect_image_format,
    embed_aigc_metadata,
    embed_data_url_aigc,
    read_aigc_metadata,
)


def _make_png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (4, 3), (12, 34, 56)).save(buf, format="PNG")
    return buf.getvalue()


def _make_jpeg() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (4, 3), (200, 10, 10)).save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def _png_critical_chunks(data: bytes) -> list[tuple[bytes, bytes]]:
    """抽取 IHDR/PLTE/IDAT 等关键块(文本块不在内),用于证明像素数据未变。"""
    out: list[tuple[bytes, bytes]] = []
    pos = 8
    while pos + 8 <= len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        ctype = data[pos + 4 : pos + 8]
        payload = data[pos + 8 : pos + 8 + length]
        if ctype not in (b"tEXt", b"iTXt", b"zTXt", b"IEND"):
            out.append((ctype, payload))
        if ctype == b"IEND":
            break
        pos += 12 + length
    return out


def test_png_embed_preserves_pixels_and_reads_back():
    raw = _make_png()
    labeled, info = embed_aigc_metadata(raw, content_id="aigc-png-1", source="token6688")
    assert info["embedded"] is True
    assert info["method"] == "png_tEXt+iTXt"
    assert info["content_id"] == "aigc-png-1"

    # 关键块逐字节不变:没有二次编码,像素与压缩流都不会被动
    assert _png_critical_chunks(labeled) == _png_critical_chunks(raw)
    with Image.open(io.BytesIO(labeled)) as img:
        assert img.size == (4, 3)
        assert img.convert("RGB").getpixel((0, 0)) == (12, 34, 56)
        assert "AIGC" in img.info

    meta = read_aigc_metadata(labeled)
    assert meta is not None
    assert meta["content_id"] == "aigc-png-1"
    assert meta["label"] == "AI_GENERATED"
    assert meta["notice"] == "AI 生成图像"


def test_jpeg_embed_preserves_pixels_and_reads_back():
    raw = _make_jpeg()
    labeled, info = embed_aigc_metadata(raw, content_id="aigc-jpg-1", source="kling")
    assert info["embedded"] is True
    assert info["method"] == "jpeg_COM"
    # DCT 数据整体未重编码:去掉 COM 段后与原字节逐字节相等
    length = struct.unpack(">H", labeled[4:6])[0]
    assert labeled[:2] + labeled[4 + length :] == raw
    with Image.open(io.BytesIO(labeled)) as img:
        assert img.size == (4, 3)

    meta = read_aigc_metadata(labeled)
    assert meta is not None
    assert meta["content_id"] == "aigc-jpg-1"
    assert meta["notice"] == "AI 生成图像"


def test_unsupported_format_reports_not_embedded():
    """GIF 不在本次射程:必须如实 embedded=False,不能静默假装已写入。"""
    buf = io.BytesIO()
    Image.new("RGB", (2, 2), (1, 2, 3)).save(buf, format="GIF")
    raw = buf.getvalue()
    out, info = embed_aigc_metadata(raw, content_id="aigc-gif-1")
    assert out == raw
    assert info["embedded"] is False
    assert info["reason"].startswith("unsupported_format")


def test_data_url_roundtrip_preserves_mime_and_metadata():
    raw = _make_png()
    data_url = "data:image/png;base64," + base64.b64encode(raw).decode("ascii")
    labeled_url, info = embed_data_url_aigc(data_url, content_id="aigc-url-1")
    assert info["embedded"] is True
    assert labeled_url.startswith("data:image/png;base64,")
    decoded = base64.b64decode(labeled_url.split(",", 1)[1])
    meta = read_aigc_metadata(decoded)
    assert meta is not None
    assert meta["content_id"] == "aigc-url-1"


@pytest.mark.parametrize(
    ("data", "expected"),
    [
        (_make_png(), "png"),
        (_make_jpeg(), "jpeg"),
        (b"not an image", None),
    ],
)
def test_detect_image_format(data, expected):
    assert detect_image_format(data) == expected
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
