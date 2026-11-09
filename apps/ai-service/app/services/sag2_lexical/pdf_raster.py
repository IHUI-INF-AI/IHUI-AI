# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""PDF 第二抽取器（pdfium）+ 页栅格化（扫描件进 OCR 的前置）。

为什么还要一层
--------------
``pdf_text.py`` 是零依赖的自研解析器，覆盖不到两类真实文件：

* **对象流 / xref 流**（PDF 1.5+ 常见）：交叉引用表被压进 ``/ObjStm``，
  自研解析器顺序扫 ``stream...endstream`` 拿不到间接对象；
* **加密但空用户密码**（很多「禁止复制」的公文就是这种）：自研解析器
  见到 ``/Encrypt`` 直接判死，而 pdfium 能用空密码正常打开。

这两类不该继续报「读不到」。``pypdfium2`` 已是 ``pdfplumber`` 的传递依赖
（不在依赖面之外），直接用它做第二级：既补全文本层，也顺带提供栅格化
能力，从而让扫描件真正能走 OCR，而不是停在 ``needs-rasterizer`` 上报缺件。

诚实边界
--------
* pdfium 也读不出文本层 ⇒ 该 PDF 只可能是扫描件（或全为矢量图形）；
* 栅格化 ≠ OCR。本模块只负责把页渲成 PNG 字节；认不认得出字由 OCR 引擎
  决定，引擎缺席时调用方必须如实报 ``no-ocr-engine``；
* 页数与像素都有上限（``MAX_PAGES`` / ``MAX_DPI`` / ``MAX_PIXELS``）：
  一份 3000 页的 PDF 不该把建库线程钉死十几分钟。
"""

from __future__ import annotations

import io
import logging
from typing import Any, Final

logger = logging.getLogger(__name__)

#: 单个 PDF 最多处理多少页（文本层与栅格化各自独立计时）。
MAX_PAGES: Final = 200
#: 栅格化 DPI 上限（600 已经远超 OCR 需要，再高只是烧 CPU）。
MAX_DPI: Final = 400
DEFAULT_DPI: Final = 200
#: 单页像素上限（≈ 4000×4000），防超大页面把内存打爆。
MAX_PIXELS: Final = 16_000_000


def _pdfium() -> tuple[Any | None, str]:
    try:
        import pypdfium2  # noqa: PLC0415 - 可选依赖，按需导入

        return pypdfium2, ""
    except Exception:  # noqa: BLE001
        return None, "missing-dep:pypdfium2"


def rasterizer_status() -> dict[str, Any]:
    """栅格化能力（给 ``/status`` 用）：只探测依赖，不打开任何文件。"""
    pdfium, reason = _pdfium()
    version = ""
    if pdfium is not None:
        try:
            version = str(pdfium.PYPDFIUM_INFO.version)
        except Exception:  # noqa: BLE001 - 版本串拿不到不影响能力判定
            version = ""
    return {
        "engine": "pdfium",
        "installed": pdfium is not None,
        "version": version,
        "reason": reason,
        "max_pages": MAX_PAGES,
        "max_dpi": MAX_DPI,
        "default_dpi": DEFAULT_DPI,
    }


def _open(path: str) -> tuple[Any | None, str]:
    """打开 PDF，先用空密码试一次（公文常见「加密但可打开」）。"""
    pdfium, reason = _pdfium()
    if pdfium is None:
        return None, reason
    try:
        return pdfium.PdfDocument(path), ""
    except Exception as exc:  # noqa: BLE001
        name = type(exc).__name__
        message = str(exc).lower()
        if "password" in message:
            return None, "encrypted:需要打开密码"
        return None, f"open-failed:{name}"


def extract_text_pdfium(path: str, *, max_pages: int = MAX_PAGES) -> tuple[str | None, str]:
    """用 pdfium 抽文本层 → ``(text, 原因)``。

    这是第二级抽取：只在自研解析器失败后才调用，因此这里的失败原因要能
    直接回答「那就只能 OCR 了」还是「这个文件真的有问题」。
    """
    doc, reason = _open(path)
    if doc is None:
        return None, reason
    try:
        total = len(doc)
        if total == 0:
            return None, "empty-document:PDF 没有页面"
        pieces: list[str] = []
        read_pages = 0
        for index in range(min(total, max_pages)):
            try:
                page = doc[index]
            except Exception as exc:  # noqa: BLE001 - 单页坏了不该拖垮整份
                logger.debug("pdfium 取页失败 index=%s: %s", index, type(exc).__name__)
                continue
            try:
                textpage = page.get_textpage()
                try:
                    text = textpage.get_text_range()
                finally:
                    textpage.close()
            except Exception as exc:  # noqa: BLE001
                logger.debug("pdfium 取文本失败 index=%s: %s", index, type(exc).__name__)
                continue
            finally:
                page.close()
            if text and text.strip():
                pieces.append(text.strip())
                read_pages += 1
        body = "\n\n".join(pieces)
        if not body.strip():
            return None, "no-text-layer:pdfium 也读不到文本层(扫描件/矢量图)"
        suffix = ""
        if total > max_pages:
            # 截断必须说清楚：宁可少读也要让调用方知道「这份文件没读全」。
            suffix = f";truncated:{read_pages}/{total}pages"
        return body, suffix
    finally:
        doc.close()


def rasterize_pdf(
    path: str,
    *,
    max_pages: int = MAX_PAGES,
    dpi: int = DEFAULT_DPI,
    limit: int = 20,
) -> tuple[list[bytes], str]:
    """把 PDF 每页渲成 PNG 字节 → ``([png...], 原因)``。

    只渲染前 ``limit`` 页（OCR 是本地 CPU 活，页数越多越慢，默认 20 页
    足够覆盖「扫描件大多是几页公文/发票」的绝大多数场景）。
    """
    doc, reason = _open(path)
    if doc is None:
        return [], reason
    scale = max(1.0, min(float(dpi), float(MAX_DPI))) / 72.0
    images: list[bytes] = []
    try:
        total = len(doc)
        if total == 0:
            return [], "empty-document:PDF 没有页面"
        for index in range(min(total, max_pages, limit)):
            try:
                page = doc[index]
            except Exception as exc:  # noqa: BLE001
                logger.debug("栅格化取页失败 index=%s: %s", index, type(exc).__name__)
                continue
            try:
                width, height = page.get_size()
                if width * height * scale * scale > MAX_PIXELS:
                    # 超大页降采样而不是整页放弃：宁可糊一点也要有字可认。
                    scale = (MAX_PIXELS / max(1.0, width * height)) ** 0.5
                bitmap = page.render(scale=scale)
                try:
                    image = bitmap.to_pil()
                finally:
                    bitmap.close()
                buffer = io.BytesIO()
                image.save(buffer, format="PNG")
                images.append(buffer.getvalue())
            except Exception as exc:  # noqa: BLE001
                logger.debug("栅格化渲染失败 index=%s: %s", index, type(exc).__name__)
            finally:
                page.close()
    finally:
        doc.close()
    if not images:
        return [], "rasterize-failed:没有页渲染成功"
    return images, ""
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
