# app/core/image_preparation.py
"""提示图像准备(2026-09-19 第二十九批,对标 Codex image_preparation.rs + utils/image)。

发送给模型前对内联图像(data URL)做预算化降采样,失败降级为文本占位符
(绝不让一张坏图阻塞整个回合):

- **detail 档位预算**(对标 PromptImageMode):
  - HIGH_DETAIL:max_dimension=2048,max_patches=2500(32px patch 网格);
  - ORIGINAL_DETAIL:max_dimension=6000,max_patches=10000;
  - detail="low" 不支持 → 专用占位符(Codex 同款拒绝);
- **patch 预算算法**(对标 prompt_image_output_dimensions_for_limits):
  先按 max_dimension 等比缩,再按面积收缩并以 patch 网格整数下取整,
  保证输出尺寸整数化后仍在预算内;
- **格式保真**:png/jpeg/webp 原格式重编码,其余转 png(对标
  can_preserve_source_bytes);重编码保留 EXIF 方向(ICC 仅 RGB profile
  才保留的语义以 Pillow 能力近似);
- **错误占位符**(原文移植):远端 URL 不支持 / 超尺寸 / low 不支持 /
  通用处理失败——图像位置替换为 InputText,消息结构不失真;
- **消息遍历**(对标 prepare_response_items):OpenAI 格式消息列表中
  user 消息与 tool 输出内的 image_url 逐个处理,产出
  ImagePreparationMetadata(含源/输出尺寸,供上下文核算)与
  ResizedImage 通知(前端可感知"图被缩过")。

纯尺寸数学函数不依赖 Pillow,可独立测试;像素处理按需导入。
"""

from __future__ import annotations

import base64
import binascii
import io
import re
from dataclasses import dataclass
from typing import Any, Optional

PROMPT_IMAGE_PATCH_SIZE = 32
MAX_DIMENSION = 2048
MAX_PROMPT_IMAGE_INPUT_BYTES = 1024 * 1024 * 1024

IMAGE_PROCESSING_ERROR_PLACEHOLDER = "image content omitted because it could not be processed"
IMAGE_TOO_LARGE_PLACEHOLDER = (
    "image content omitted because it exceeded the supported size limit; use a smaller image"
)
UNSUPPORTED_LOW_DETAIL_PLACEHOLDER = (
    "image content omitted because detail 'low' is not supported; use 'high', 'original', or 'auto'"
)
REMOTE_IMAGE_URL_PLACEHOLDER = "image content omitted because remote image URLs are not supported"

# 高细节 / 原始细节两档预算(对标 PromptImageMode::HIGH_DETAIL / ORIGINAL_DETAIL)
HIGH_DETAIL_LIMITS = {"max_dimension": 2048, "max_patches": 2500}
ORIGINAL_DETAIL_LIMITS = {"max_dimension": 6000, "max_patches": 10000}

# 可原格式保真的格式(其余重编码为 png)
_PRESERVE_MIME = {"image/png", "image/jpeg", "image/webp"}

_DATA_URL_RE = re.compile(r"^data:([^;,]+);base64,(.*)$", re.DOTALL)


class ImagePreparationError(Exception):
    """图像准备失败;placeholder() 给出注入消息的文本。"""

    def __init__(self, message: str, placeholder: str) -> None:
        super().__init__(message)
        self._placeholder = placeholder

    def placeholder(self) -> str:
        return self._placeholder


def too_large_error() -> ImagePreparationError:
    return ImagePreparationError("image too large", IMAGE_TOO_LARGE_PLACEHOLDER)


def remote_url_error() -> ImagePreparationError:
    return ImagePreparationError("remote image URLs are not supported", REMOTE_IMAGE_URL_PLACEHOLDER)


def low_detail_error() -> ImagePreparationError:
    return ImagePreparationError("detail 'low' is not supported", UNSUPPORTED_LOW_DETAIL_PLACEHOLDER)


def processing_error(detail: str = "") -> ImagePreparationError:
    return ImagePreparationError(detail or "image processing failed", IMAGE_PROCESSING_ERROR_PLACEHOLDER)


@dataclass
class ResizeLimits:
    max_dimension: int
    max_patches: int


@dataclass
class EncodedImage:
    bytes: bytes
    mime: str
    source_width: int
    source_height: int
    width: int
    height: int

    def into_data_url(self) -> str:
        return data_url_from_bytes(self.mime, self.bytes)


@dataclass
class ImagePreparationMetadata:
    source_width: int
    source_height: int
    prepared_width: int
    prepared_height: int
    effective_detail: str  # "high" | "original"
    message_role: Optional[str] = None
    item_id: Optional[str] = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "sourceWidth": self.source_width,
            "sourceHeight": self.source_height,
            "preparedWidth": self.prepared_width,
            "preparedHeight": self.prepared_height,
            "effectiveDetail": self.effective_detail,
            "messageRole": self.message_role,
            "itemId": self.item_id,
        }


@dataclass
class ResizedImage:
    image_number: int
    image_count: int
    source_width: int
    source_height: int
    prepared_width: int
    prepared_height: int

    def as_dict(self) -> dict[str, Any]:
        return {
            "imageNumber": self.image_number,
            "imageCount": self.image_count,
            "sourceWidth": self.source_width,
            "sourceHeight": self.source_height,
            "preparedWidth": self.prepared_width,
            "preparedHeight": self.prepared_height,
        }


# ----------------------------------------------------------------------
# 纯尺寸数学(与 Codex 逐行对应,不依赖 Pillow)
# ----------------------------------------------------------------------
def prompt_image_dimensions_fit(width: int, height: int, limits: ResizeLimits) -> bool:
    patches_wide = -(-width // PROMPT_IMAGE_PATCH_SIZE)  # div_ceil
    patches_high = -(-height // PROMPT_IMAGE_PATCH_SIZE)
    return (
        width <= limits.max_dimension
        and height <= limits.max_dimension
        and patches_wide * patches_high <= limits.max_patches
    )


def prompt_image_output_dimensions_for_limits(
    width: int, height: int, limits: ResizeLimits
) -> tuple[int, int]:
    """三段收缩:max_dimension 等比 → patch 预算面积收缩 → 整数网格下取整。"""
    width = max(1, width)
    height = max(1, height)
    if prompt_image_dimensions_fit(width, height, limits):
        return width, height

    max_dimension_scale = min(limits.max_dimension / max(width, height), 1.0)
    width = max(1, round(width * max_dimension_scale))
    height = max(1, round(height * max_dimension_scale))
    if prompt_image_dimensions_fit(width, height, limits):
        return width, height

    patch_size = float(PROMPT_IMAGE_PATCH_SIZE)
    scale = (patch_size * patch_size * limits.max_patches / (width * height)) ** 0.5
    # 面积收缩后按 patch 网格向下取整,保证整数输出仍在预算内(Codex 同款)
    scaled_wide = width * scale / patch_size
    scaled_high = height * scale / patch_size
    refinement = min(
        scaled_wide // 1 / scaled_wide if scaled_wide else 1.0,
        scaled_high // 1 / scaled_high if scaled_high else 1.0,
    )
    scale *= refinement
    return max(1, int(width * scale)), max(1, int(height * scale))


def detail_limits(detail: Optional[str]) -> tuple[str, ResizeLimits]:
    """detail 档位 → (有效档名, 预算);low 直接拒绝。"""
    if detail == "low":
        raise low_detail_error()
    if detail == "original":
        return "original", ResizeLimits(**ORIGINAL_DETAIL_LIMITS)
    # None / "auto" / "high" → 高细节
    return "high", ResizeLimits(**HIGH_DETAIL_LIMITS)


def is_remote_image_url(image_url: str) -> bool:
    scheme, sep, _ = image_url.partition(":")
    return bool(sep) and scheme.lower() in ("http", "https")


def is_data_url(image_url: str) -> bool:
    return image_url[:5].lower() == "data:"


def data_url_from_bytes(mime: str, data: bytes) -> str:
    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"


# ----------------------------------------------------------------------
# 像素处理(Pillow 路径)
# ----------------------------------------------------------------------
def load_data_url_for_prompt(image_url: str, limits: ResizeLimits) -> EncodedImage:
    """解码 data URL 并按预算降采样(对标 load_data_url_for_prompt)。"""
    match = _DATA_URL_RE.match(image_url)
    if not match:
        raise processing_error("invalid data URL")
    mime, b64 = match.group(1), match.group(2)
    try:
        raw = base64.b64decode(b64, validate=False)
    except (binascii.Error, ValueError):
        raise processing_error("invalid base64") from None
    if len(raw) > MAX_PROMPT_IMAGE_INPUT_BYTES:
        raise too_large_error()

    try:
        from PIL import Image
    except ImportError:  # pragma: no cover - 环境缺失降级
        raise processing_error("Pillow unavailable") from None

    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except Exception:
        raise processing_error("decode failed") from None
    width, height = img.size

    target_w, target_h = prompt_image_output_dimensions_for_limits(width, height, limits)
    preserve = mime.lower() in _PRESERVE_MIME
    out_format = mime if preserve else "image/png"
    exif = img.info.get("exif") if preserve and mime == "image/jpeg" else None

    if (target_w, target_h) != (width, height):
        resampled = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    else:
        resampled = img

    buf = io.BytesIO()
    save_kwargs: dict[str, Any] = {}
    fmt_for_pillow = out_format.split("/")[1].upper()  # PNG/JPEG/WEBP
    if fmt_for_pillow == "JPEG" and resampled.mode not in ("RGB", "L"):
        resampled = resampled.convert("RGB")
    if exif is not None:
        save_kwargs["exif"] = exif
    try:
        resampled.save(buf, format=fmt_for_pillow, **save_kwargs)
    except Exception:
        raise processing_error("encode failed") from None
    final_mime = "image/png" if fmt_for_pillow == "PNG" else out_format
    return EncodedImage(
        bytes=buf.getvalue(),
        mime=final_mime,
        source_width=width,
        source_height=height,
        width=target_w,
        height=target_h,
    )


def resize_image(
    image_url: str,
    detail: Optional[str] = None,
) -> tuple[Optional[EncodedImage], str]:
    """单图准备入口(对标 resize_image);返回 (编码结果或 None, 有效档名)。

    - 远端 URL → 抛 RemoteUrlUnsupported;
    - 非 data URL(如 file 引用)→ (None, detail) 原样放行;
    - data URL → 解码 + 预算降采样。
    """
    if is_remote_image_url(image_url):
        raise remote_url_error()
    if not is_data_url(image_url):
        return None, (detail or "high")
    effective, limits = detail_limits(detail)
    encoded = load_data_url_for_prompt(image_url, limits)
    return encoded, effective


# ----------------------------------------------------------------------
# 消息遍历(OpenAI 消息格式)
# ----------------------------------------------------------------------
def _iter_image_items(content: Any) -> list[tuple[int, dict[str, Any]]]:
    """找出 content 列表中的 image_url 项(返回 (下标, 项))。"""
    if not isinstance(content, list):
        return []
    return [
        (i, item)
        for i, item in enumerate(content)
        if isinstance(item, dict) and item.get("type") == "image_url"
    ]


def prepare_response_items(
    messages: list[dict[str, Any]],
    *,
    emit_resize_notice: bool = True,
) -> tuple[list[dict[str, Any]], list[ImagePreparationMetadata], list[ResizedImage]]:
    """遍历消息,就地准备图像(失败替换为占位 InputText)。

    Returns:
        (new_messages, metadata, resized_notices)——new_messages 为深改动副本
        语义:仅含图像的项被替换/改写,其余原样。
    """
    metadata: list[ImagePreparationMetadata] = []
    notices: list[ResizedImage] = []
    out: list[dict[str, Any]] = []
    for message in messages:
        role = message.get("role")
        content = message.get("content")
        image_items = _iter_image_items(content)
        if not image_items:
            out.append(message)
            continue

        image_count = len(image_items)
        seen = 0
        new_content: list[Any] = list(content) if isinstance(content, list) else []
        for idx, item in image_items:
            seen += 1
            url_obj = item.get("image_url")
            url = url_obj.get("url") if isinstance(url_obj, dict) else url_obj
            detail = item.get("detail")
            try:
                encoded, effective = resize_image(url if isinstance(url, str) else "", detail)
            except ImagePreparationError as error:
                new_content[idx] = {"type": "text", "text": error.placeholder()}
                continue
            if encoded is None:
                continue
            md = ImagePreparationMetadata(
                source_width=encoded.source_width,
                source_height=encoded.source_height,
                prepared_width=encoded.width,
                prepared_height=encoded.height,
                effective_detail=effective,
                message_role=role if isinstance(role, str) else None,
            )
            metadata.append(md)
            if (encoded.width, encoded.height) != (encoded.source_width, encoded.source_height):
                notices.append(
                    ResizedImage(
                        image_number=seen,
                        image_count=image_count,
                        source_width=encoded.source_width,
                        source_height=encoded.source_height,
                        prepared_width=encoded.width,
                        prepared_height=encoded.height,
                    )
                )
            new_content[idx] = {
                "type": "image_url",
                "image_url": {"url": encoded.into_data_url()},
                **({"detail": detail} if detail is not None else {}),
            }
        new_message = dict(message)
        new_message["content"] = new_content
        out.append(new_message)

    if not emit_resize_notice:
        notices = []
    return out, metadata, notices
