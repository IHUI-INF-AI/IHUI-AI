"""多格式内容解析器。

把 md/docx/html/pdf/image/video 解析为统一 HTML(供平台发布用)。
依赖库按需 import,缺失时优雅降级(返回明确错误信息)。

设计:
- md → html: 用 `markdown` 库(支持 tables/fenced_code/footnotes 扩展)
- docx → html: 优先 `mammoth`,降级 `python-docx`
- html → 清洗: 用 `beautifulsoup4` 移除 script/style/危险标签
- pdf → text → html: 用 `pdfplumber`
- image → 不解析,直接返回 None(html 字段保持空)
- video → 不解析,直接返回 None

平台专属排版(R7):
- format_for_platform(html, platform, content) -> str:主入口
- 5 平台专属规则:知乎卡片 / 公众号富文本 / CSDN 代码块 / 小红书 emoji / 掘金主题
- 实现在 platform_formatter.py,本模块只 re-export + 提供 enrich_content_for_platform
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import Any, Optional, cast

from app.core.logging import get_logger

# R7:平台专属排版(从 platform_formatter re-export,保持单一入口)
from .platform_formatter import format_for_platform, supported_platforms

logger = get_logger(__name__)


def _safe_read(path: str, max_bytes: int = 50 * 1024 * 1024) -> bytes:
    """安全读取文件(限制 50MB,防止大文件 OOM)。"""
    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(f"file not found: {path}")
    size = p.stat().st_size
    if size > max_bytes:
        raise ValueError(f"file too large: {size} bytes (max {max_bytes})")
    return p.read_bytes()


def parse_md(text: str) -> str:
    """markdown → html。"""
    try:
        import markdown as md_lib
    except ImportError as e:
        raise RuntimeError(f"markdown library not installed: {e}. pip install markdown")

    extensions = ["tables", "fenced_code", "footnotes", "toc", "attr_list"]
    return cast(str, md_lib.markdown(text, extensions=extensions, output_format="html5"))


def parse_docx(file_path: str) -> str:
    """docx → html。优先 mammoth(语义化 HTML),降级 python-docx(简单段落拼接)。"""
    try:
        import mammoth
        with open(file_path, "rb") as f:
            result = mammoth.convert_to_html(f)
            return cast(str, result.value)
    except ImportError:
        pass

    try:
        from docx import Document
        doc = Document(file_path)
        parts: list[str] = []
        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                parts.append("<p></p>")
                continue
            para_style = para.style
            style = (para_style.name if para_style is not None else "").lower()
            if "heading 1" in style:
                parts.append(f"<h1>{text}</h1>")
            elif "heading 2" in style:
                parts.append(f"<h2>{text}</h2>")
            elif "heading 3" in style:
                parts.append(f"<h3>{text}</h3>")
            else:
                parts.append(f"<p>{text}</p>")
        return "\n".join(parts)
    except ImportError as e:
        raise RuntimeError(
            f"neither mammoth nor python-docx installed: {e}. pip install mammoth"
        )


def parse_html(text: str) -> str:
    """html → 清洗后的 html(移除 script/style/iframe/on* 属性)。"""
    try:
        from bs4 import BeautifulSoup
    except ImportError as e:
        raise RuntimeError(f"beautifulsoup4 not installed: {e}. pip install beautifulsoup4")

    soup = BeautifulSoup(text, "html.parser")
    # 移除危险标签
    for tag in soup.find_all(["script", "style", "iframe", "object", "embed", "form"]):
        tag.decompose()
    # 移除 on* 事件属性
    for tag in soup.find_all(True):
        for attr in list(tag.attrs.keys()):
            if attr.lower().startswith("on"):
                del tag[attr]
    return str(soup)


def parse_pdf(file_path: str) -> str:
    """pdf → text → html(每页一个 <h2> + 段落)。"""
    try:
        import pdfplumber
    except ImportError as e:
        raise RuntimeError(f"pdfplumber not installed: {e}. pip install pdfplumber")

    parts: list[str] = []
    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            if not text.strip():
                continue
            parts.append(f"<h2>第 {i} 页</h2>")
            for line in text.split("\n"):
                line = line.strip()
                if line:
                    parts.append(f"<p>{line}</p>")
    return "\n".join(parts) if parts else "<p>(PDF 无可提取文本)</p>"


def parse_to_html(
    format: str,
    text: Optional[str] = None,
    file_path: Optional[str] = None,
) -> tuple[str, list[str]]:
    """根据 format 解析内容为 HTML。

    Returns:
        (html, images) - images 为内容中引用的图片路径列表(目前仅本地路径)
    """
    fmt = format.lower()
    if fmt == "md":
        if not text:
            raise ValueError("md format requires text field")
        return parse_md(text), []
    if fmt == "html":
        if not text:
            raise ValueError("html format requires text field")
        return parse_html(text), []
    if fmt == "docx":
        if not file_path:
            raise ValueError("docx format requires file_path")
        return parse_docx(file_path), []
    if fmt == "pdf":
        if not file_path:
            raise ValueError("pdf format requires file_path")
        return parse_pdf(file_path), []
    if fmt in ("image", "video"):
        # image/video 不需要 HTML 内容,直接传文件路径
        return "", []
    raise ValueError(f"unsupported format: {format}")


def enrich_content(content: Any) -> Any:
    """填充 content.html 字段(若未填充)。

    在 router/scheduler 调用适配器 publish 之前调用,
    确保适配器拿到的是已解析的统一内容。
    """
    if content.html:
        return content
    try:
        html, images = parse_to_html(content.format, content.text, content.file_path)
        content.html = html
        if images:
            content.images = list(content.images or []) + images
    except Exception as e:
        logger.warning("[content_parser] parse failed format=%s: %s", content.format, e)
        # 解析失败不阻塞,适配器可自行处理(如 image/video 不需要 html)
        content.html = content.html or ""
    return content


def enrich_content_for_platform(content: Any, platform: str) -> Any:
    """解析内容并按平台专属规则排版(R7 一体化入口)。

    流程:
    1. enrich_content:md/docx/html/pdf → 统一 HTML
    2. format_for_platform:按平台规则做排版变换
       - zhihu:图片卡片 + 引用美化 + 链接卡片
       - wechat:行内 style 富文本
       - csdn:代码块强制标语言
       - xiaohongshu:emoji 装饰 + 短段落
       - juejin:代码块主题高亮
       - 其他平台:原样返回(无专属规则)

    Args:
        content: PublishContent 对象(format/text/file_path/html 等字段)
        platform: 目标平台 ID(如 'zhihu' / 'wechat' / 'csdn')

    Returns:
        content(原地修改 html 字段)

    诚实边界:
    - 仅做排版/样式调整,不修改内容语义
    - 平台无专属规则时,返回原始解析 HTML
    - beautifulsoup4 缺失时,记录警告并回退原 HTML
    """
    # Step 1: 先解析为统一 HTML
    enrich_content(content)
    # Step 2: 按平台专属规则排版
    if content.html and platform:
        try:
            content.html = format_for_platform(content.html, platform, content)
        except Exception as e:
            logger.warning(
                "[content_parser] format_for_platform failed platform=%s: %s",
                platform,
                e,
            )
    return content


# R7:平台专属排版 re-export(供 router/scheduler 直接调用)
__all__ = [
    "parse_md",
    "parse_docx",
    "parse_html",
    "parse_pdf",
    "parse_to_html",
    "enrich_content",
    "enrich_content_for_platform",
    "format_for_platform",
    "supported_platforms",
]
