"""图片保存器 — 让 image_generation 工具落地文件系统。

支持 base64 / data URI / URL 三种输入,save_path 白名单校验,
自动生成路径 apps/ai-service/.data/images/<uuid>.<format>。
"""

from __future__ import annotations

import base64
import binascii
import logging
import re
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

# workspace root = apps/ai-service
_WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
_DEFAULT_IMAGE_DIR = _WORKSPACE_ROOT / ".data" / "images"

# 路径白名单:save_path 必须在以下目录内(绝对路径解析后)
_ALLOWED_ROOTS = [
    _WORKSPACE_ROOT / ".data",
    _WORKSPACE_ROOT / "app" / "skills" / "content_engine" / "output",
]

# 禁止写入的目录名(即使在白名单根下)
_FORBIDDEN_PARTS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build",
}

# 支持的图片格式
_ALLOWED_FORMATS = {"png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"}

# URL 下载大小上限(10MB)
_MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024

# data URI 模式
_DATA_URI_RE = re.compile(r"^data:image/([a-zA-Z+]+);base64,(.+)$", re.DOTALL)


def decode_base64(data: str) -> bytes:
    """解码 base64(支持 data URI 前缀剥离)。

    Raises:
        ValueError: 解码失败
    """
    if not data:
        raise ValueError("空数据")
    m = _DATA_URI_RE.match(data)
    if m:
        data = m.group(2)
    data = re.sub(r"\s+", "", data)
    try:
        return base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError) as e:
        raise ValueError(f"base64 解码失败: {e}") from e


async def download_image(url: str, timeout: int = 30) -> bytes:
    """httpx 下载图片。

    Raises:
        ValueError: URL 非法 / 协议不允许 / 图片过大
        httpx.HTTPError: 下载失败
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"协议不允许: {parsed.scheme}(仅 http/https)")
    if not parsed.hostname:
        raise ValueError("URL 缺少 hostname")

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        content = resp.content
        if len(content) > _MAX_DOWNLOAD_BYTES:
            raise ValueError(f"图片过大({len(content)} > {_MAX_DOWNLOAD_BYTES})")
        return content


def validate_save_path(save_path: str) -> tuple[bool, str]:
    """路径白名单校验。

    Returns:
        (True, resolved_path_str) 或 (False, reason)
    """
    if not save_path:
        return False, "save_path 为空"

    p = Path(save_path)
    if not p.is_absolute():
        p = (_WORKSPACE_ROOT / p).resolve()
    else:
        p = p.resolve()

    for root in _ALLOWED_ROOTS:
        root_resolved = root.resolve()
        try:
            rel = p.relative_to(root_resolved)
        except ValueError:
            continue
        for part in rel.parts:
            if part in _FORBIDDEN_PARTS:
                return False, f"路径包含禁止目录: {part}"
        return True, str(p)

    return False, "路径不在白名单内(允许 .data/ 或 app/skills/content_engine/output/)"


async def save_image(
    image_data: str,
    save_path: str | None = None,
    format: str = "png",
) -> dict[str, Any]:
    """保存图片到文件系统。

    Args:
        image_data: base64 / data URI / URL(http/https)
        save_path: 保存路径(None 自动生成 / 相对路径相对 workspace / 绝对路径需白名单)
        format: 图片格式(png/jpg/...)

    Returns:
        {ok, saved_path, size_bytes, format} 或 {ok: False, errorCode, message}
    """
    fmt = (format or "png").lower().lstrip(".")
    if fmt not in _ALLOWED_FORMATS:
        return {
            "ok": False, "errorCode": "INVALID_FORMAT",
            "message": f"格式 {fmt} 不支持(允许: {sorted(_ALLOWED_FORMATS)})",
        }

    # 1. 获取图片字节
    if isinstance(image_data, str) and image_data.startswith(("http://", "https://")):
        try:
            img_bytes = await download_image(image_data)
        except ValueError as e:
            return {"ok": False, "errorCode": "DOWNLOAD_FAILED", "message": str(e)}
        except httpx.HTTPError as e:
            return {"ok": False, "errorCode": "DOWNLOAD_FAILED", "message": str(e)}
    else:
        try:
            img_bytes = decode_base64(image_data)
        except ValueError as e:
            return {"ok": False, "errorCode": "INVALID_BASE64", "message": str(e)}

    # 2. 解析 save_path
    if save_path is None:
        _DEFAULT_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
        target = _DEFAULT_IMAGE_DIR / f"{uuid.uuid4().hex}.{fmt}"
    else:
        ok, msg = validate_save_path(save_path)
        if not ok:
            return {"ok": False, "errorCode": "PATH_NOT_ALLOWED", "message": msg}
        target = Path(msg)
        # 目标是目录或无扩展名且以分隔符结尾 → 自动加文件名
        if target.is_dir() or (not target.suffix and save_path.endswith(("/", "\\"))):
            target = target / f"{uuid.uuid4().hex}.{fmt}"
        elif not target.suffix:
            target = target.with_suffix(f".{fmt}")

    # 3. 写入
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(img_bytes)
    except OSError as e:
        return {"ok": False, "errorCode": "WRITE_FAILED", "message": str(e)}

    return {
        "ok": True,
        "saved_path": str(target),
        "size_bytes": len(img_bytes),
        "format": fmt,
    }
