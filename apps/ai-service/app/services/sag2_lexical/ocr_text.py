# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""图片 / 扫描件 OCR（多引擎可插拔，缺件如实降级）。

对照程序能把扫描件、截图纳入检索；本仓此前对 ``.png/.jpg`` 一律
``unsupported``，对没有文本层的 PDF 只能报 ``no-text-layer``（诚实地"读不到"，
但用户拿不到任何替代路径）。

现在给出**完整链路**，且每一环都能自证：

1. 引擎按可用性择优：``rapidocr``（纯 pip + onnxruntime，模型随包，中英文）
   → ``tesseract``（系统二进制 + 语言包）。两者都没有就**具名报缺件**，
   不返回空串伪装成功；
2. 图片直接 OCR；扫描件 PDF 先由 ``pdf_raster`` 用 pdfium 栅格化再逐页 OCR；
3. 引擎之间、单页之间的失败都被隔离：一页认不出不该让整份文件消失。

诚实边界
--------
* 识别结果字符数低于 ``MIN_OCR_CHARS`` → ``empty``（避免把噪声当正文）；
* 单个 PDF 只 OCR 前 ``MAX_OCR_PAGES`` 页（本地 CPU 活，页数越多越慢）；
* 引擎给的是**置信度**，低于 ``MIN_SCORE`` 的行直接丢弃——OCR 的错字会
  直接污染索引，宁可少收也不要假字。
"""

from __future__ import annotations

import io
import logging
import os
from typing import Any

from .pdf_raster import MAX_DPI, rasterize_pdf

logger = logging.getLogger(__name__)

#: 可 OCR 的图片后缀（不进 ``DEFAULT_INCLUDE``：OCR 是本地 CPU 活，默认不悄悄变慢）。
IMAGE_SUFFIXES: frozenset[str] = frozenset(
    {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif", ".gif"}
)

#: OCR 结果少于这么多字符就认为"没读到东西"（纯图、纯噪声）。
MIN_OCR_CHARS = 12

#: 单张图上限：超大图会让引擎吃满内存且耗时不可控。
MAX_IMAGE_BYTES = 32 * 1024 * 1024

#: 单个 PDF 最多 OCR 多少页。
MAX_OCR_PAGES = 20

#: 栅格化 DPI（200 对正文够用；再高只是烧 CPU）。
PDF_DPI = 200

#: 行级置信度下限：低于它的识别行丢弃（错字比缺字更伤检索）。
MIN_SCORE = 0.5

DEFAULT_LANGS = "chi_sim+eng"


# ---------------------------------------------------------------------------
# 引擎探测
# ---------------------------------------------------------------------------


def _rapidocr() -> tuple[Any | None, str]:
    try:
        from rapidocr_onnxruntime import RapidOCR  # noqa: PLC0415 - 可选依赖

        return RapidOCR, ""
    except ImportError as exc:
        # 包在、依赖缺（典型是 opencv/cv2）时，原因必须指向**真正缺的那个包**：
        # 只说 missing-dep:rapidocr 会让用户把装好的包再装一遍，白忙一场。
        missing = str(getattr(exc, "name", "") or "")
        if missing:
            return None, f"missing-dep:{missing}"
        return None, "missing-dep:rapidocr-onnxruntime"
    except Exception:  # noqa: BLE001
        return None, "missing-dep:rapidocr-onnxruntime"


def _pytesseract() -> tuple[Any | None, str]:
    try:
        import pytesseract  # noqa: PLC0415 - 可选依赖

        return pytesseract, ""
    except ImportError as exc:
        missing = str(getattr(exc, "name", "") or "")
        if missing:
            return None, f"missing-dep:{missing}"
        return None, "missing-dep:pytesseract"
    except Exception:  # noqa: BLE001
        return None, "missing-dep:pytesseract"


_rapid_engine: Any | None = None


def _get_rapid() -> tuple[Any | None, str]:
    """RapidOCR 单例（懒加载：构造一次要读模型，不能每张图都来一遍）。"""
    global _rapid_engine
    cls, reason = _rapidocr()
    if cls is None:
        return None, reason
    if _rapid_engine is None:
        try:
            _rapid_engine = cls()
        except Exception as exc:  # noqa: BLE001 - 模型缺失/onnx 版本冲突都落这里
            return None, f"engine-init-failed:rapidocr({type(exc).__name__})"
    return _rapid_engine, ""


def available_engines() -> tuple[str, ...]:
    """当前真能用的引擎（按优先级）。只探测导入，不加载模型。"""
    names: list[str] = []
    if _rapidocr()[0] is not None:
        names.append("rapidocr")
    if _pytesseract()[0] is not None:
        names.append("tesseract")
    return tuple(names)


# ---------------------------------------------------------------------------
# 单张图 OCR
# ---------------------------------------------------------------------------


def _rapid_ocr_bytes(data: bytes) -> tuple[str | None, str, str]:
    engine, reason = _get_rapid()
    if engine is None:
        return None, "none", reason
    try:
        import numpy as np  # noqa: PLC0415 - 仅在 OCR 路径需要
        from PIL import Image  # noqa: PLC0415

        image = Image.open(io.BytesIO(data)).convert("RGB")
        array = np.asarray(image)
    except Exception as exc:  # noqa: BLE001
        return None, "none", f"decode-failed:{type(exc).__name__}"
    try:
        result, _elapse = engine(array)
    except Exception as exc:  # noqa: BLE001
        return None, "none", f"ocr-failed:rapidocr({type(exc).__name__})"
    if not result:
        return None, "none", "empty"
    lines: list[str] = []
    for row in result:
        # RapidOCR 返回 [box, text, score]；结构不熟就跳过该行，不猜。
        if not isinstance(row, (list, tuple)) or len(row) < 3:
            continue
        text = str(row[1])
        try:
            score = float(row[2])
        except (TypeError, ValueError):
            score = 1.0
        if score < MIN_SCORE:
            continue
        if text.strip():
            lines.append(text.strip())
    merged = "\n".join(lines)
    if len(merged.strip()) < MIN_OCR_CHARS:
        return None, "none", "empty"
    return merged, "rapidocr", ""


def _tesseract_ocr_file(path: str, langs: str) -> tuple[str | None, str, str]:
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


def _ocr_bytes(data: bytes) -> tuple[str | None, str, str]:
    """字节 → 文本：按引擎优先级逐个试，全失败时回报**最后一个**具名原因。"""
    engines = available_engines()
    if not engines:
        _, rapid_reason = _rapidocr()
        _, tess_reason = _pytesseract()
        return None, "none", f"{rapid_reason}|{tess_reason}"
    reasons: list[str] = []
    if "rapidocr" in engines:
        text, parser, reason = _rapid_ocr_bytes(data)
        if text is not None:
            return text, parser, reason
        reasons.append(f"rapidocr:{reason}")
    if "tesseract" in engines:
        # tesseract 只接受文件路径；临时目录承接内存里的 PNG，退出即回收。
        import tempfile  # noqa: PLC0415 - 仅在兜底路径用

        with tempfile.TemporaryDirectory() as tmpdir:
            page_path = os.path.join(tmpdir, "page.png")
            with open(page_path, "wb") as handle:
                handle.write(data)
            text, parser, reason = _tesseract_ocr_file(page_path, DEFAULT_LANGS)
        if text is not None:
            return text, parser, reason
        reasons.append(f"tesseract:{reason}")
    return None, "none", ";".join(reasons)


def ocr_image(path: str, *, langs: str = DEFAULT_LANGS) -> tuple[str | None, str, str]:
    """图片 OCR → ``(text, 引擎名, 原因)``；不可用时带具名原因。"""
    suffix = os.path.splitext(path)[1].lower()
    if suffix not in IMAGE_SUFFIXES:
        return None, "none", f"unsupported:{suffix or '<noext>'}"
    try:
        size = os.path.getsize(path)
    except OSError as exc:
        return None, "none", f"io-error:{type(exc).__name__}"
    if size > MAX_IMAGE_BYTES:
        return None, "none", "too-large-for-ocr"
    try:
        with open(path, "rb") as handle:
            data = handle.read()
    except OSError as exc:
        return None, "none", f"io-error:{type(exc).__name__}"
    return _ocr_bytes(data)


def ocr_pdf(
    path: str,
    *,
    max_pages: int = MAX_OCR_PAGES,
    dpi: int = PDF_DPI,
) -> tuple[str | None, str, str]:
    """扫描件 PDF：pdfium 栅格化 → 逐页 OCR → 拼接。

    返回 ``(text, "pdf+<引擎>", 原因)``。栅格化失败与 OCR 失败分开报：
    前者说明 pdfium 打不开，后者说明引擎缺件——用户要采取的动作完全不同。
    """
    if not available_engines():
        return None, "none", "no-ocr-engine"
    images, reason = rasterize_pdf(path, limit=max_pages, dpi=min(dpi, MAX_DPI))
    if not images:
        return None, "none", reason or "rasterize-failed"
    pages: list[str] = []
    engines: set[str] = set()
    failures: list[str] = []
    for data in images:
        text, parser, why = _ocr_bytes(data)
        if text is None:
            failures.append(why)
            continue
        pages.append(text)
        engines.add(parser)
    if not pages:
        detail = failures[0] if failures else "empty"
        return None, "none", f"ocr-empty:{detail}"
    body = "\n\n".join(pages)
    if len(body.strip()) < MIN_OCR_CHARS:
        return None, "none", "empty"
    used = "+".join(sorted(engines)) or "unknown"
    suffix = ""
    if failures:
        # 部分页失败必须说出来：否则「读到了 3 页」会被误当成「这份就是 3 页」。
        suffix = f"partial:{len(pages)}/{len(images)}pages"
    return body, f"pdf+{used}", suffix


def ocr_available() -> dict[str, Any]:
    """探测状态（给 ``/status`` 用）：不加载模型，只查依赖与二进制。"""
    engines = available_engines()
    rapid_cls, rapid_reason = _rapidocr()
    pytesseract, tess_reason = _pytesseract()
    binary = ""
    languages: list[str] = []
    if pytesseract is not None:
        try:
            binary = str(pytesseract.pytesseract.tesseract_cmd or "")
            languages = sorted(str(x) for x in pytesseract.get_languages(config=""))
        except Exception:  # noqa: BLE001 - 没装二进制就是这里抛
            tess_reason = "missing-binary:tesseract"
    return {
        "engine": engines[0] if engines else "none",
        "engines": list(engines),
        "installed": bool(engines),
        "binary": binary,
        "languages": languages,
        "reason": "" if engines else f"{rapid_reason}|{tess_reason}",
        "default_langs": DEFAULT_LANGS,
        "image_suffixes": sorted(IMAGE_SUFFIXES),
        "max_bytes": MAX_IMAGE_BYTES,
        "max_pages": MAX_OCR_PAGES,
        "min_score": MIN_SCORE,
        "pdf_rasterizer": "pdfium",
        "rapidocr_importable": rapid_cls is not None,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
