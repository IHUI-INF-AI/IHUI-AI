"""vision_analyze 图像分析助手(对标 Trae Work vision)。

让 vision_analyze 工具支持本地文件路径(当前 mcp_server._tool_vision_analyze 直传
URL/base64 给 LLM,未抽出可复用助手)。本模块自动识别 3 种图片来源:

- 本地文件路径(POSIX `/` 或 Windows 盘符)→ 读取 + base64 + 推断 MIME
- data URI(`data:image/png;base64,...`)→ 直接透传
- URL(http/https)→ httpx 下载 + base64

统一转 base64 data URI 后调用 llm_gateway.complete(OpenAI vision content block)。
"""

from __future__ import annotations

import base64
import logging
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from ..core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

_MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB

# 后缀 → MIME(支持 png/jpg/jpeg/gif/webp/bmp)
_EXT_TO_MIME: dict[str, str] = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
}


def is_data_uri(s: str) -> bool:
    return bool(s) and s.startswith("data:")


def is_url(s: str) -> bool:
    return bool(s) and s.startswith(("http://", "https://"))


def is_local_path(s: str) -> bool:
    """判断是否为本地文件路径(非 URL / 非 data URI)。"""
    if not s or s.startswith(("http://", "https://", "data:", "ftp://")):
        return False
    if s.startswith("/"):
        return True
    # Windows 盘符路径(C:\ 或 C:/)
    return len(s) >= 3 and s[1] == ":" and s[2] in ("\\", "/")


def validate_image_path(path: str) -> tuple[bool, str]:
    """校验本地图片路径:文件存在 + 大小 ≤ 10MB + 格式白名单。

    Returns:
        (ok, message) — ok=True 时 message 为空;ok=False 时 message 为错误描述。
    """
    p = Path(path)
    if not p.exists():
        return False, f"file not found: {path}"
    try:
        size = p.stat().st_size
    except OSError as e:
        return False, f"read stat failed: {e}"
    if size > _MAX_IMAGE_SIZE:
        return False, f"file too large ({size} bytes > {_MAX_IMAGE_SIZE})"
    if p.suffix.lower() not in _EXT_TO_MIME:
        return False, f"unsupported format: {p.suffix.lower()} (png/jpg/jpeg/gif/webp/bmp only)"
    return True, ""


def read_local_image(path: str) -> tuple[bytes, str]:
    """读取本地图片,返回 (data, mime_type)。文件不存在或不支持格式抛异常。"""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(path)
    ext = p.suffix.lower()
    mime = _EXT_TO_MIME.get(ext)
    if not mime:
        raise ValueError(f"unsupported format: {ext} (png/jpg/jpeg/gif/webp/bmp only)")
    data = p.read_bytes()
    if len(data) > _MAX_IMAGE_SIZE:
        raise ValueError(f"file too large ({len(data)} bytes > {_MAX_IMAGE_SIZE})")
    return data, mime


def encode_base64(data: bytes, mime_type: str) -> str:
    """编码为 data URI:`data:{mime};base64,{b64}`。"""
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime_type};base64,{b64}"


async def download_image(url: str, timeout: int = 30) -> tuple[bytes, str]:
    """下载 URL 图片,返回 (data, mime_type)。失败抛异常。"""
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.content
        ctype = resp.headers.get("content-type", "").split(";")[0].strip().lower()
        if ctype.startswith("image/"):
            return data, ctype
        ext = Path(urlparse(url).path).suffix.lower()
        return data, _EXT_TO_MIME.get(ext, "image/png")


def _map_validation_error(message: str) -> str:
    """把 validate_image_path 的 message 映射为错误码。"""
    if message.startswith("file not found") or message.startswith("read stat"):
        return "FILE_NOT_FOUND"
    if message.startswith("file too large"):
        return "FILE_TOO_LARGE"
    return "UNSUPPORTED_FORMAT"


async def analyze_image(
    image_source: str,
    prompt: str = "Describe this image",
    model: str | None = None,
    max_tokens: int = 1000,
) -> dict[str, Any]:
    """分析图片,自动识别本地路径 / data URI / URL。

    Returns:
        成功:{ok: True, analysis, model, stub, source}
        失败:{ok: False, errorCode, message}
    """
    source = ""
    # 1. 解析图片来源 → base64 data URI
    if is_data_uri(image_source):
        data_uri = image_source
        source = "data_uri"
    elif is_url(image_source):
        source = "url"
        try:
            data, mime = await download_image(image_source)
        except Exception as e:
            return {"ok": False, "errorCode": "DOWNLOAD_FAILED", "message": f"{type(e).__name__}: {str(e)[:200]}"}
        data_uri = encode_base64(data, mime)
    elif is_local_path(image_source):
        source = "local_file"
        ok, msg = validate_image_path(image_source)
        if not ok:
            return {"ok": False, "errorCode": _map_validation_error(msg), "message": msg}
        try:
            data, mime = read_local_image(image_source)
        except FileNotFoundError as e:
            return {"ok": False, "errorCode": "FILE_NOT_FOUND", "message": f"file not found: {e}"}
        except ValueError as e:
            code = "FILE_TOO_LARGE" if str(e).startswith("file too large") else "UNSUPPORTED_FORMAT"
            return {"ok": False, "errorCode": code, "message": str(e)}
        except OSError as e:
            return {"ok": False, "errorCode": "FILE_NOT_FOUND", "message": f"read failed: {e}"}
        data_uri = encode_base64(data, mime)
    else:
        return {"ok": False, "errorCode": "UNSUPPORTED_FORMAT", "message": "unrecognized image source"}

    # 2. 构造 OpenAI vision content block,调用 LLM
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": data_uri}},
            ],
        }
    ]
    try:
        result = await llm_gateway.complete(messages, model=model, max_tokens=max_tokens)
    except Exception as e:
        return {"ok": False, "errorCode": "LLM_FAILED", "message": f"{type(e).__name__}: {str(e)[:200]}"}

    if result.get("error"):
        return {
            "ok": False,
            "errorCode": "LLM_FAILED",
            "message": result.get("error_message") or result.get("errorCode") or "llm error",
            "source": source,
        }
    return {
        "ok": True,
        "analysis": result.get("content", ""),
        "model": result.get("model", model or ""),
        "stub": result.get("stub", False),
        "source": source,
    }
