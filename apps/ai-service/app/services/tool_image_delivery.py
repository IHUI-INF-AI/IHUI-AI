# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具结果图片交付(2026-11-14 立,对标 DSH dsh-tool-fs/src/read-image.ts)。

`read_image` 的返回值只带小体积元数据(content_id/尺寸/字节数),图片本体经进程内
有界暂存交给 agent 循环:循环在本轮全部 tool 消息之后追加一条 role=user 的
多模态消息(OpenAI vision content 数组),并**读取即弹出**。这样做的两个硬原因:

1. `call_tool` 出口有 token 截断护栏,把 base64 放进工具正文会被截断成无效数据;
2. SSE `tool-result` 事件把结果原样下发前端,10MB 的 data URL 会撑爆单帧。

暂存有界(8 条)+ TTL(10 分钟)+ 弹出式消费,不构成跨会话通道;条目只含本次
read_image 已验证过的字节,循环取不到时就不注入(降级为纯文字元数据)。

与 DSH 的差异如实记录:DSH 把图片写入持久附件库并让 content block 引用 attachmentId;
IHUI 没有同一套附件库,这里用进程内有界暂存,续跑重放只回放文字元数据。
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

from app.core.bounded_ttl_store import BoundedTtlDict

#: 单张图片字节上限(与 vision_analyze 的本地文件上限同档)
MAX_IMAGE_BYTES = 10 * 1024 * 1024
#: 单边像素上限与解码像素总量上限(对标 DSH imageLimits.maxImageDimension / maxImagePixels)
MAX_IMAGE_DIMENSION = 12_000
MAX_IMAGE_PIXELS = 50_000_000
#: 暂存条数上限:一次工具轮最多交付几张图,超出按最旧逐出
IMAGE_STASH_KEYS = 8
#: 暂存寿命:循环在同一轮内取走;跨轮残留 10 分钟后自动过期
IMAGE_STASH_TTL_S = 600.0

IMAGE_EXTENSIONS: dict[str, str] = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}

_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_JPEG_SIGNATURE = b"\xff\xd8\xff"

_PENDING: BoundedTtlDict = BoundedTtlDict(
    max_keys=IMAGE_STASH_KEYS,
    ttl_seconds=IMAGE_STASH_TTL_S,
    slide_on_read=False,
)


def sniff_image_media_type(data: bytes) -> str | None:
    """按文件头识别支持的图片格式(无扩展名文件同样可判)。"""
    if data.startswith(_PNG_SIGNATURE):
        return "image/png"
    if data.startswith(_JPEG_SIGNATURE):
        return "image/jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def media_type_for_path(path: Path) -> str | None:
    """路径扩展名声明的图片格式;非图片扩展名返回 None。"""
    return IMAGE_EXTENSIONS.get(path.suffix.lower())


def prepare_image_file(path: Path) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """读取并校验图片文件,返回 (交付载荷, 错误)。

    校验与 DSH 同序:扩展名声明 → 文件头签名 → 解码/降采样。扩展名与签名不一致
    直接拒绝(改错扩展名的文件交出去会让模型按错误格式理解内容)。无扩展名的
    文件按文件头识别(与 DSH 一致)。
    """
    if path.suffix and media_type_for_path(path) is None:
        return None, {
            "errorCode": "IMAGE_UNSUPPORTED_FORMAT",
            "error": (
                f"{path.suffix.lower()} 扩展名不声明支持的图片格式;"
                "read_image 只接受 png/jpg/jpeg/webp/gif"
            ),
        }
    try:
        raw = path.read_bytes()
    except OSError as e:
        return None, {
            "errorCode": "FILE_NOT_FOUND",
            "error": f"读取图片失败: {e}",
        }
    if len(raw) > MAX_IMAGE_BYTES:
        return None, {
            "errorCode": "IMAGE_TOO_LARGE",
            "error": (
                f"图片过大({len(raw)} bytes > {MAX_IMAGE_BYTES});"
                "请先降采样再读取"
            ),
        }
    media_type = sniff_image_media_type(raw)
    if media_type is None:
        return None, {
            "errorCode": "IMAGE_UNSUPPORTED_FORMAT",
            "error": "文件内容不是 PNG/JPEG/WebP/GIF;read_image 只接受这四种格式",
        }
    declared = media_type_for_path(path)
    if declared is not None and declared != media_type:
        return None, {
            "errorCode": "IMAGE_TYPE_MISMATCH",
            "error": (
                f"扩展名声明 {declared},但文件头实际是 {media_type};"
                "文件可能损坏或改错了扩展名"
            ),
        }

    return _encode_image(raw, media_type, path_label=str(path), name=path.name)


def prepare_image_bytes(
    raw: bytes,
    *,
    path_label: str = "",
    name: str = "",
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """校验内存中的图片字节(screenshot 等内联 base64 用),返回 (交付载荷, 错误)。"""
    media_type = sniff_image_media_type(raw)
    if media_type is None:
        return None, {
            "errorCode": "IMAGE_UNSUPPORTED_FORMAT",
            "error": "图片字节不是 PNG/JPEG/WebP/GIF",
        }
    return _encode_image(raw, media_type, path_label=path_label, name=name)


def _encode_image(
    raw: bytes, media_type: str, *, path_label: str, name: str
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """尺寸/像素闸 → image_preparation 降采样 → 交付载荷(file 与 inline 共用)。"""
    if len(raw) > MAX_IMAGE_BYTES:
        return None, {
            "errorCode": "IMAGE_TOO_LARGE",
            "error": (
                f"图片过大({len(raw)} bytes > {MAX_IMAGE_BYTES});"
                "请先降采样再读取"
            ),
        }
    # 只读文件头拿尺寸(Pillow 惰性打开,不解码像素),先挡住解压炸弹与超大图;
    # 真正的降采样仍交给 image_preparation 单一实现,不在这里复算。
    try:
        import io

        from PIL import Image

        with Image.open(io.BytesIO(raw)) as probe:
            source_width, source_height = probe.size
    except Exception as e:  # noqa: BLE001 - 打不开就是坏图
        return None, {
            "errorCode": "IMAGE_INVALID",
            "error": f"图片解码失败: {e}",
        }
    if source_width <= 0 or source_height <= 0:
        return None, {
            "errorCode": "IMAGE_INVALID",
            "error": f"图片尺寸非法: {source_width}x{source_height}",
        }
    if (
        max(source_width, source_height) > MAX_IMAGE_DIMENSION
        or source_width * source_height > MAX_IMAGE_PIXELS
    ):
        return None, {
            "errorCode": "IMAGE_TOO_LARGE",
            "error": (
                f"图片尺寸过大({source_width}x{source_height});"
                f"上限单边 {MAX_IMAGE_DIMENSION}px / 总量 {MAX_IMAGE_PIXELS}px,"
                "请先降采样再读取"
            ),
        }

    from app.core.image_preparation import (
        data_url_from_bytes,
        detail_limits,
        load_data_url_for_prompt,
    )

    try:
        _, limits = detail_limits("high")
        encoded = load_data_url_for_prompt(data_url_from_bytes(media_type, raw), limits)
    except Exception as e:  # noqa: BLE001 - 解码失败必须显式拒绝,不能交坏图
        return None, {
            "errorCode": "IMAGE_INVALID",
            "error": f"图片解码失败: {e}",
        }
    return {
        "data_url": encoded.into_data_url(),
        "media_type": encoded.mime,
        "bytes": len(encoded.bytes),
        "width": encoded.width,
        "height": encoded.height,
        "source_width": encoded.source_width,
        "source_height": encoded.source_height,
        "path": path_label,
        "name": name,
    }, None


def stash_image(prepared: dict[str, Any]) -> str:
    """把已校验的图片放进有界暂存,返回交付凭据 content_id。"""
    content_id = f"img_{uuid.uuid4().hex[:12]}"
    _PENDING.set(content_id, dict(prepared))
    return content_id


def take_images(content_ids: list[str]) -> list[dict[str, Any]]:
    """按 content_id 取出并弹出图片条目;取不到的条目跳过(降级文字元数据)。"""
    images: list[dict[str, Any]] = []
    for content_id in content_ids:
        item = _PENDING.pop(content_id, None)
        if isinstance(item, dict):
            images.append(item)
    return images


def collect_image_ids(results: list[Any]) -> list[str]:
    """从一组工具结果里收集 read_image 的交付凭据(其它工具结果不命中)。"""
    ids: list[str] = []
    for result in results:
        if not isinstance(result, dict):
            continue
        image = result.get("image")
        if not isinstance(image, dict):
            continue
        content_id = image.get("content_id")
        if isinstance(content_id, str) and content_id:
            ids.append(content_id)
    return ids


def format_image_envelope(item: dict[str, Any]) -> str:
    """模型可读的图片信封(与 DSH formatImageReadOutput 同形)。"""
    scaled = ""
    width = int(item.get("width") or 0)
    height = int(item.get("height") or 0)
    source_width = int(item.get("source_width") or 0)
    source_height = int(item.get("source_height") or 0)
    if width and height and (source_width, source_height) != (width, height):
        x = source_width / width
        y = source_height / height
        advice = (
            f"multiply coordinates by {x:.2f}"
            if abs(x - y) < 0.005
            else f"multiply x coordinates by {x:.2f} and y coordinates by {y:.2f}"
        )
        scaled = (
            f" (downscaled from {source_width}x{source_height} px;"
            f" {advice} to locate features in the original file)"
        )
    return (
        f"<path>{item.get('path', '')}</path>\n"
        "<type>image</type>\n"
        "<content>\n"
        f"{item.get('media_type', '')} image, {width}x{height} px,"
        f" {int(item.get('bytes') or 0)} bytes{scaled}\n"
        "</content>"
    )


def build_image_followup_message(images: list[dict[str, Any]]) -> dict[str, Any] | None:
    """把图片组装成一条 role=user 的多模态消息;无图返回 None。

    位置必须在**本轮全部 tool 消息之后**(OpenAI 协议:tool 结果紧跟 assistant
    的 tool_calls;user 消息可以出现在 tool 结果之后)。
    """
    if not images:
        return None
    parts: list[dict[str, Any]] = []
    for item in images:
        parts.append({"type": "text", "text": format_image_envelope(item)})
        parts.append(
            {"type": "image_url", "image_url": {"url": str(item.get("data_url", ""))}}
        )
    return {"role": "user", "content": parts}


def reset_image_stash() -> None:
    """测试用:清空暂存。"""
    _PENDING.clear()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
