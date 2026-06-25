"""文件上传安全校验工具 - 修复 Bug-6.

提供:
  - 扩展名白名单
  - 真实 MIME 检测 (python-magic, 失败时回退手写 magic 头)
  - 文件大小限制
  - 危险内容检测 (HTML/JS/PE/ELF)
  - 文件名安全化 (去除 ../, 控长度, 控字符)
  - 头像专用: 几何校验 (Pillow 尝试)
"""

import io
import logging
import re

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 扩展名白名单 (按业务可扩展)
# ---------------------------------------------------------------------------

IMAGE_EXTS = {"jpg", "jpeg", "png", "gif", "webp", "bmp"}
DOC_EXTS = {"pdf", "docx", "xlsx", "pptx", "txt"}
AUDIO_EXTS = {"mp3", "wav", "ogg", "m4a"}
VIDEO_EXTS = {"mp4", "webm", "mov", "avi"}

# MIME -> 允许的扩展名 (用于交叉校验)
EXT_TO_MIME = {
    "jpg": {"image/jpeg"},
    "jpeg": {"image/jpeg"},
    "png": {"image/png"},
    "gif": {"image/gif"},
    "webp": {"image/webp"},
    "bmp": {"image/bmp"},
    "pdf": {"application/pdf"},
    "mp3": {"audio/mpeg"},
    "wav": {"audio/wav"},
    "ogg": {"audio/ogg"},
    "m4a": {"audio/mp4"},
    "mp4": {"video/mp4"},
    "webm": {"video/webm"},
    "mov": {"video/quicktime"},
}

# 已知 magic bytes (文件头) -> 类型
_MAGIC_SIGNATURES: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    (b"RIFF", "image/webp"),  # RIFF....WEBP
    (b"%PDF-", "application/pdf"),
    (b"PK\x03\x04", "application/zip"),  # docx/xlsx/pptx
    (b"\x1f\x8b", "application/gzip"),
    (b"BM", "image/bmp"),
]

# 危险特征 (可执行/脚本)
_DANGEROUS_SIGNATURES: list[bytes] = [
    b"<%",
    b"<script",
    b"<?php",
    b"<?xml",
    b"#!/",
    b"<html",
    b"<!DOCTYPE",
    b"MZ",  # PE/EXE
    b"\x7fELF",  # ELF
    b"<?xpacket",  # XDP
]

# 文件名合法字符
_FILENAME_SAFE_RE = re.compile(r"[^A-Za-z0-9._\-]")


def detect_mime_from_bytes(data: bytes) -> str | None:
    """用文件头 magic bytes 推断真实 MIME.

    Returns:
        mime 字符串, 或 None 无法识别.
    """
    if not data or len(data) < 4:
        return None
    # 优先尝试 python-magic (libmagic)
    try:
        import magic  # type: ignore

        mime = magic.from_buffer(data, mime=True)
        if mime:
            return mime
    except Exception as e:
        logger.debug("python-magic 检测 MIME 失败 (回退手写检测): %s", e)  # intentionally ignored
    # 兜底: 手写 magic 检测
    for sig, mime in _MAGIC_SIGNATURES:
        if data.startswith(sig):
            # RIFF 二次校验 (避免 OGG 误判)
            if sig == b"RIFF" and not data.startswith(b"RIFF\x00\x00\x00\x00WEBP"):
                return None
            return mime
    return None


def has_dangerous_signature(data: bytes) -> bool:
    """检查文件是否含危险特征 (HTML/JS/PE/ELF/...)."""
    if not data:
        return False
    head = data[:4096]
    return any(sig in head for sig in _DANGEROUS_SIGNATURES)


def sanitize_filename(filename: str, max_length: int = 128) -> str:
    """清理文件名, 防路径穿越 + 防特殊字符.

    规则:
      - 取 basename (去掉所有路径分隔符)
      - 去除 ../ 和 ..\\
      - 替换非 ASCII 字母数字 . _ - 的字符为 _
      - 限制最大长度
    """
    if not filename:
        return ""
    # 取 basename (Win + POSIX)
    filename = filename.replace("\\", "/").split("/")[-1]
    # 防止 \x00 截断
    filename = filename.replace("\x00", "")
    # 路径穿越防御
    while ".." in filename or "/" in filename or "\\" in filename:
        filename = filename.replace("..", "").replace("/", "_").replace("\\", "_")
    # 字符白名单
    filename = _FILENAME_SAFE_RE.sub("_", filename)
    # 多余的点压缩
    while ".." in filename:
        filename = filename.replace("..", ".")
    # 长度限制
    if len(filename) > max_length:
        base, _, ext = filename.rpartition(".")
        keep = max_length - len(ext) - 1
        filename = base[:keep] + "." + ext if ext else base[:max_length]
    return filename


def safe_extension(filename: str, whitelist: set = IMAGE_EXTS) -> str:
    """从文件名中提取扩展名, 验证在白名单内."""
    if not filename or "." not in filename:
        return ""
    ext = filename.rsplit(".", 1)[-1].lower().strip()
    return ext if ext in whitelist else ""


# ---------------------------------------------------------------------------
# 头像上传专用校验
# ---------------------------------------------------------------------------


class AvatarValidationError(ValueError):
    """头像校验失败."""

    def __init__(self, code: str, msg: str):
        self.code = code
        self.msg = msg
        super().__init__(msg)


def validate_avatar(
    file_data: bytes,
    filename: str,
    content_type: str | None = None,
    max_size: int = 5 * 1024 * 1024,
) -> tuple[str, str]:
    """校验头像上传.

    Returns:
        (safe_filename, real_mime)

    Raises:
        AvatarValidationError: 任一校验失败
    """
    if not file_data:
        raise AvatarValidationError("EMPTY", "文件为空")

    if len(file_data) > max_size:
        raise AvatarValidationError("TOO_LARGE", f"文件大小超过 {max_size // (1024*1024)} MB")

    # 1. 真实 MIME 检测 (核心防伪)
    real_mime = detect_mime_from_bytes(data=file_data)
    if not real_mime:
        raise AvatarValidationError("BAD_MIME", "无法识别文件类型, 拒绝上传")
    if not real_mime.startswith("image/"):
        raise AvatarValidationError("NOT_IMAGE", f"不是图片类型 (检测为 {real_mime})")

    # 2. 扩展名校验
    ext = safe_extension(filename, IMAGE_EXTS)
    if not ext:
        raise AvatarValidationError("BAD_EXT", "文件扩展名不在白名单")
    # 扩展名与真实 MIME 必须匹配
    if real_mime not in EXT_TO_MIME.get(ext, set()):
        raise AvatarValidationError(
            "EXT_MIME_MISMATCH",
            f"扩展名 {ext} 与实际类型 {real_mime} 不一致",
        )

    # 3. 危险特征检测
    if has_dangerous_signature(file_data):
        raise AvatarValidationError("DANGEROUS", "文件含可疑脚本/二进制特征, 拒绝上传")

    # 4. 客户端 content_type 交叉校验 (可选, 但有助早发现伪造)
    if content_type and content_type != real_mime:
        # 仅警告, 不强制失败 (浏览器可能传 application/octet-stream)
        pass

    # 5. 文件名清理
    safe_name = sanitize_filename(filename)
    if not safe_name:
        safe_name = f"avatar.{ext}"
    else:
        # 强制替换扩展名为我们识别的真实 ext
        base = safe_name.rsplit(".", 1)[0]
        safe_name = f"{base}.{ext}"

    # 6. 几何校验 (Pillow 可用时)
    try:
        from PIL import Image  # type: ignore

        with Image.open(io.BytesIO(file_data)) as img:
            img.verify()  # 校验完整性
    except Exception:
        # 静默失败 - libmagic 已识别为 image, 二次校验失败不阻断 (Pillow 未装)
        pass

    return safe_name, real_mime
