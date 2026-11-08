# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIGC 隐式标识 —— 在产物字节层写入可机读的 AI 生成元数据。

与 ``aigc_labeling.py`` 的分工:
- ``aigc_labeling`` 负责**落库记录**(media_tasks.result.aigc)与显式文案;
- 本模块负责**产物字节层隐式标识**,两者由 media_tasks 落库时合成同一份审计证据。

为什么选 PNG 文本段 / JPEG COM 段(取舍理由):
1. **不改像素、不重编码**。直接在 PNG chunk / JPEG marker 层插入,IDAT 与 DCT 系数
   逐字节不动,避免二次压缩掉画质,也不依赖 Pillow 重写整图。
2. **平台兼容**。PNG ``iTXt``(UTF-8)与 ``tEXt``(Latin-1)是 PNG 规范内的辅助块,
   浏览器、系统相册、Pillow / ImageMagick / exiftool 均会忽略或原样保留;JPEG ``COM``
   (0xFFFE)是自 1992 年起的标准注释段,所有解码器都会跳过,不会导致图片打不开。
3. **可读取、可审计**。读取方式:
   - PNG:``PIL.Image.open(path).info["AIGC"]`` / ``exiftool -PNG:AIGC``;
   - JPEG:``PIL.Image.open(path).info["comment"]``(UTF-8 JSON)/ ``exiftool -Comment``。
4. 不选 EXIF ``UserComment``:EXIF 需要重排 IFD 偏移,自己拼装易破坏厂商私有段;
   COM/iTXt 的侵入面更小。若后续需要相机参数级兼容,再补 EXIF 写入即可。

范围与如实声明:
- 只处理 PNG / JPEG;其它格式(GIF/WebP/视频/音频)原样返回 ``embedded=False``,
  原因写进返回的 info,绝不谎报"已写入"。
- 远端 URL 且未落盘的产物无法在字节层改写,同样如实记 ``embedded=False``;
  b64 内联产物与带 ``save_path`` 的落盘产物会真实写入。
"""

from __future__ import annotations

import base64
import json
import re
import struct
import uuid
import zlib
from typing import Any, Final

#: PNG 文本段关键字(tEXt / iTXt 唯一键,读取端按此键取回)
AIGC_METADATA_KEYWORD: Final[str] = "AIGC"
#: 中文显式文案单独放 iTXt,避免 tEXt 的 Latin-1 限制
AIGC_NOTICE_KEYWORD: Final[str] = "AIGC-Notice"

_PNG_SIGNATURE: Final[bytes] = b"\x89PNG\r\n\x1a\n"
_JPEG_SOI: Final[bytes] = b"\xff\xd8"
_DATA_URL_RE: Final[re.Pattern[str]] = re.compile(
    r"^data:(?P<mime>[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+)?;base64,(?P<data>.*)$",
    re.S,
)


def detect_image_format(data: bytes) -> str | None:
    """按魔数识别图片格式;识别不出返回 None(绝不猜)。"""
    if data.startswith(_PNG_SIGNATURE):
        return "png"
    if data.startswith(_JPEG_SOI):
        return "jpeg"
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return "gif"
    if data.startswith(b"RIFF") and len(data) >= 12 and data[8:12] == b"WEBP":
        return "webp"
    return None


def _png_chunk(chunk_type: bytes, payload: bytes) -> bytes:
    crc = zlib.crc32(chunk_type + payload) & 0xFFFFFFFF
    return struct.pack(">I", len(payload)) + chunk_type + payload + struct.pack(">I", crc)


def _build_png_itxt(keyword: str, text: str) -> bytes:
    """iTXt:关键字\\0 压缩标志\\0 压缩方法\\0 语言标签\\0 译名\\0 UTF-8 正文。"""
    payload = (
        keyword.encode("latin-1")
        + b"\x00"
        + b"\x00"  # 未压缩
        + b"\x00"  # 压缩方法固定 0
        + b"\x00"  # 语言标签空
        + b"\x00"  # 译名空
        + text.encode("utf-8")
    )
    return _png_chunk(b"iTXt", payload)


def _build_png_text(keyword: str, text: str) -> bytes:
    payload = keyword.encode("latin-1") + b"\x00" + text.encode("latin-1")
    return _png_chunk(b"tEXt", payload)


def _insert_png_text_chunks(data: bytes, chunks: bytes) -> bytes:
    """在 IEND 之前插入文本块;IHDR/IDAT 等既有数据逐字节不动。"""
    pos = len(_PNG_SIGNATURE)
    while pos + 8 <= len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        chunk_type = data[pos + 4 : pos + 8]
        if chunk_type == b"IEND":
            return data[:pos] + chunks + data[pos:]
        pos += 12 + length
    raise ValueError("PNG 缺少 IEND 块")


def _metadata_text(*, content_id: str, kind: str, source: str, notice: str) -> dict[str, Any]:
    return {
        "label": "AI_GENERATED",
        "label_type": "implicit",
        "content_id": content_id,
        "content_kind": kind,
        "source": source,
        "notice": notice,
        "standard": "GB 45438-2025 / 《人工智能生成合成内容标识办法》",
    }


def embed_png_aigc(data: bytes, meta: dict[str, Any]) -> bytes:
    """向 PNG 写入 tEXt(ASCII 机读) + iTXt(中文显式文案),不改像素。"""
    ascii_meta = dict(meta)
    ascii_meta.pop("notice", None)
    text_chunks = (
        _build_png_text(AIGC_METADATA_KEYWORD, json.dumps(ascii_meta, ensure_ascii=True, separators=(",", ":")))
        + _build_png_itxt(AIGC_NOTICE_KEYWORD, json.dumps(meta, ensure_ascii=False, separators=(",", ":")))
    )
    return _insert_png_text_chunks(data, text_chunks)


def _build_jpeg_com(comment: bytes) -> bytes:
    # 段长含 2 字节长度本身,单段上限 65533;超限截断到合法长度
    body = comment[:65533]
    return b"\xff\xfe" + struct.pack(">H", len(body) + 2) + body


def embed_jpeg_aigc(data: bytes, meta: dict[str, Any]) -> bytes:
    """紧接 SOI 插入 COM 注释段(UTF-8 JSON),DCT 数据逐字节不动。"""
    comment = json.dumps(meta, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return data[:2] + _build_jpeg_com(comment) + data[2:]


def embed_aigc_metadata(
    data: bytes,
    *,
    kind: str = "image",
    content_id: str | None = None,
    source: str = "",
    notice: str | None = None,
) -> tuple[bytes, dict[str, Any]]:
    """在图片字节层写入隐式标识,返回 ``(新字节, 审计 info)``。

    info 是落库 evidence 的唯一形状;``embedded=False`` 时 ``reason`` 必填,
    调用方不得把 False 当成已标识。
    """
    cid = content_id or f"aigc-{uuid.uuid4().hex}"
    from .aigc_labeling import explicit_notice

    meta = _metadata_text(
        content_id=cid,
        kind=kind,
        source=source,
        notice=notice or explicit_notice(kind),
    )
    fmt = detect_image_format(data)
    base_info: dict[str, Any] = {
        "content_id": cid,
        "keyword": AIGC_METADATA_KEYWORD,
        "content_kind": kind,
        "notice": meta["notice"],
        "standard": meta["standard"],
    }
    try:
        if fmt == "png":
            return embed_png_aigc(data, meta), {**base_info, "embedded": True, "method": "png_tEXt+iTXt"}
        if fmt == "jpeg":
            return embed_jpeg_aigc(data, meta), {**base_info, "embedded": True, "method": "jpeg_COM"}
    except Exception as exc:  # noqa: BLE001 - 标识失败绝不能反噬出图主流程
        return data, {
            **base_info,
            "embedded": False,
            "method": "none",
            "reason": f"embed_error:{type(exc).__name__}",
        }
    return data, {**base_info, "embedded": False, "method": "none", "reason": f"unsupported_format:{fmt or 'unknown'}"}


def embed_data_url_aigc(
    data_url: str,
    *,
    kind: str = "image",
    content_id: str | None = None,
    source: str = "",
    notice: str | None = None,
) -> tuple[str, dict[str, Any]]:
    """对 ``data:<mime>;base64,<payload>`` 内联产物写隐式标识并重建 data URL。"""
    match = _DATA_URL_RE.match(data_url)
    if not match:
        return data_url, {
            "content_id": content_id or "",
            "keyword": AIGC_METADATA_KEYWORD,
            "content_kind": kind,
            "notice": notice or "",
            "standard": "GB 45438-2025 / 《人工智能生成合成内容标识办法》",
            "embedded": False,
            "method": "none",
            "reason": "not_data_url",
        }
    try:
        raw = base64.b64decode(match.group("data"))
    except Exception:  # noqa: BLE001 - 坏 b64 交给上游原有的失败语义判定
        return data_url, {
            "content_id": content_id or "",
            "keyword": AIGC_METADATA_KEYWORD,
            "content_kind": kind,
            "notice": notice or "",
            "standard": "GB 45438-2025 / 《人工智能生成合成内容标识办法》",
            "embedded": False,
            "method": "none",
            "reason": "invalid_base64",
        }
    labeled, info = embed_aigc_metadata(
        raw, kind=kind, content_id=content_id, source=source, notice=notice
    )
    if not info.get("embedded"):
        return data_url, info
    mime = match.group("mime") or {
        "png": "image/png",
        "jpeg": "image/jpeg",
    }.get(detect_image_format(raw) or "", "image/png")
    encoded = base64.b64encode(labeled).decode("ascii")
    return f"data:{mime};base64,{encoded}", info


def _extract_png_metadata(data: bytes) -> dict[str, Any] | None:
    meta: dict[str, Any] | None = None
    notice: str | None = None
    pos = len(_PNG_SIGNATURE)
    while pos + 8 <= len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        chunk_type = data[pos + 4 : pos + 8]
        payload = data[pos + 8 : pos + 8 + length]
        if chunk_type == b"tEXt" and payload.startswith(AIGC_METADATA_KEYWORD.encode() + b"\x00"):
            try:
                meta = json.loads(payload.split(b"\x00", 1)[1].decode("latin-1"))
            except (ValueError, UnicodeDecodeError):
                return None
        elif chunk_type == b"iTXt" and payload.startswith(AIGC_NOTICE_KEYWORD.encode() + b"\x00"):
            try:
                # iTXt 结构:keyword\0 压缩标志\0 压缩方法\0 语言\0 译名\0 正文
                rest = payload.split(b"\x00", 1)[1]
                text = rest.split(b"\x00", 4)[4]
                notice = str(json.loads(text.decode("utf-8")).get("notice") or "") or None
            except (ValueError, UnicodeDecodeError, IndexError, AttributeError):
                notice = None
        if chunk_type == b"IEND":
            if meta is not None and notice:
                meta["notice"] = notice
            return meta
        pos += 12 + length
    return meta


def read_aigc_metadata(data: bytes) -> dict[str, Any] | None:
    """从产物字节读回隐式标识(测试 / 审计入口);无标识返回 None。"""
    fmt = detect_image_format(data)
    if fmt == "png":
        return _extract_png_metadata(data)
    if fmt == "jpeg" and len(data) >= 6:
        if data[2:4] != b"\xff\xfe":
            return None
        length = struct.unpack(">H", data[4:6])[0]
        try:
            return json.loads(data[6 : 4 + length].decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return None
    return None


__all__ = [
    "AIGC_METADATA_KEYWORD",
    "AIGC_NOTICE_KEYWORD",
    "detect_image_format",
    "embed_aigc_metadata",
    "embed_data_url_aigc",
    "read_aigc_metadata",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
