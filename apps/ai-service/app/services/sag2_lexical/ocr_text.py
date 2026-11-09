# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""图片 / 扫描件 OCR（可插拔，缺件如实降级）。

对照程序能把扫描件、截图纳入检索；本仓此前对 ``.png/.jpg`` 一律
``unsupported``，对没有文本层的 PDF 只能报 ``no-text-layer``（诚实地"读不到"，
但用户拿不到任何替代路径）。

本模块提供**本地、零成本**的 OCR 通道，并且**只在自己真的能读时**返回文本：

- 引擎：``pytesseract`` + 系统 ``tesseract`` 可执行文件（Apache-2.0，离线）
- 语言：默认 ``chi_sim+eng``；装了哪些语言包由 tesseract 决定，缺语言包时
  回落 ``eng`` 并在 reason 里写明回落事实
- 只对**图片**做 OCR。扫描版 PDF 需要先把页栅格化（pymupdf/poppler），
  这两个依赖不在本仓依赖面内 ⇒ 如实返回 ``needs-rasterizer:pdf``，
  绝不假装读到了内容

诚实边界：
- 没装 ``pytesseract`` → ``missing-dep:pytesseract``
- 装了但系统没有 tesseract → ``missing-binary:tesseract``
- 识别结果字符数低于 ``MIN_OCR_CHARS`` → ``empty``（避免把噪声当正文）

返回三态与 ``extract_text`` 其它分支一致：``(text|None, parser, reason)``。
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

#: 可 OCR 的图片后缀（不进 ``DEFAULT_INCLUDE``：OCR 是本地 CPU 活，默认不悄悄变慢）。
IMAGE_SUFFIXES: frozenset[str] = frozenset(
    {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif", ".gif"}
)

#: OCR 结果少于这么多字符就认为"没读到东西"（纯图、纯噪声）。
MIN_OCR_CHARS = 12

#: 单张图上限：超大图会让 tesseract 吃满内存且耗时不可控。
MAX_IMAGE_BYTES = 32 * 1024 * 1024

DEFAULT_LANGS = "chi_sim+eng"


def _pytesseract() -> tuple[Any | None, str]:
    try:
        import pytesseract  # noqa: PLC0415 - 可选依赖，按需导入

        return pytesseract, ""
    except Exception:  # noqa: BLE001
        return None, "missing-dep:pytesseract"


def ocr_image(path: str, *, langs: str = DEFAULT_LANGS) -> tuple[str | None, str, str]:
    """图片 OCR → ``(text, "tesseract", "")``；不可用时带具名原因。"""
    suffix = os.path.splitext(path)[1].lower()
    if suffix not in IMAGE_SUFFIXES:
        return None, "none", f"unsupported:{suffix or '<noext>'}"
    try:
        if os.path.getsize(path) > MAX_IMAGE_BYTES:
            return None, "none", "too-large-for-ocr"
    except OSError as exc:
        return None, "none", f"io-error:{type(exc).__name__}"

    pytesseract, reason = _pytesseract()
    if pytesseract is None:
        return None, "none", reason
    try:
        text = str(pytesseract.image_to_string(path, lang=langs))
    except Exception as exc:  # noqa: BLE001 - 缺二进制/缺语言包都落到这里
        name = type(exc).__name__
        message = str(exc).lower()
        if "tesseract is not installed" in message or "no such file" in message:
            return None, "none", "missing-binary:tesseract"
        if "failed loading language" in message or "couldn't load any languages" in message:
            # 有 tesseract 但没中文包：回落英文，并把回落事实写进 reason。
            try:
                text = str(pytesseract.image_to_string(path, lang="eng"))
            except Exception:  # noqa: BLE001
                return None, "none", "missing-langpack:chi_sim"
            if len(text.strip()) < MIN_OCR_CHARS:
                return None, "none", "empty"
            return text, "tesseract-eng-only", "fallback-lang:eng"
        return None, "none", f"ocr-failed:{name}"
    if len(text.strip()) < MIN_OCR_CHARS:
        return None, "none", "empty"
    return text, "tesseract", ""


def ocr_pdf(path: str) -> tuple[str | None, str, str]:
    """扫描版 PDF：需要页栅格化，本仓依赖面内没有 ⇒ 如实报缺件。"""
    return None, "none", "needs-rasterizer:pdf(pymupdf/poppler 未纳入依赖)"


def ocr_available() -> dict[str, Any]:
    """探测状态（给 ``/status`` 用）：不加载任何东西，只查依赖与二进制。"""
    pytesseract, reason = _pytesseract()
    binary = ""
    languages: list[str] = []
    if pytesseract is not None:
        try:
            binary = str(pytesseract.pytesseract.tesseract_cmd or "")
            languages = sorted(str(x) for x in pytesseract.get_languages(config=""))
        except Exception:  # noqa: BLE001 - 没装二进制就是这里抛
            reason = "missing-binary:tesseract"
    return {
        "engine": "tesseract",
        "installed": pytesseract is not None,
        "binary": binary,
        "languages": languages,
        "reason": reason,
        "default_langs": DEFAULT_LANGS,
        "image_suffixes": sorted(IMAGE_SUFFIXES),
        "max_bytes": MAX_IMAGE_BYTES,
        "pdf_rasterizer": "unavailable",
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
