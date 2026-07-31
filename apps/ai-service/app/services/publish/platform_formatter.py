"""平台专属排版转换器。

不同平台对 HTML 内容的接受方式差异巨大,本模块统一处理平台专属排版:
1. 知乎:图片卡片 + 引用卡片 + 链接卡片
2. 公众号:行内 style 富文本(无外部 CSS 依赖)
3. CSDN:代码块强制标语言 + 行号
4. 小红书:emoji 装饰 + 短段落 + 话题标签
5. 掘金:代码块主题高亮 + 行号

设计:
- format_for_platform(html, platform, content) -> str:主入口
- 各平台独立函数 _format_xxx(html, content) -> str
- 使用 BeautifulSoup 操作 HTML(已为依赖)
- 不修改内容语义,只调整排版/样式

依赖:beautifulsoup4(已在 content_parser 用)
"""
from __future__ import annotations

import re
from typing import Any, Optional

from app.core.logging import get_logger

logger = get_logger(__name__)

try:
    from bs4 import BeautifulSoup

    _HAS_BS4 = True
except ImportError:
    _HAS_BS4 = False
    BeautifulSoup = None  # type: ignore


# ---------------------------------------------------------------------------
# 公共工具
# ---------------------------------------------------------------------------


def _ensure_soup(html: str) -> Any:
    """构造 BeautifulSoup,缺依赖时回退原 HTML。"""
    if not _HAS_BS4:
        return None
    return BeautifulSoup(html, "html.parser")


def _soup_to_str(soup: Any) -> str:
    if soup is None:
        return ""
    return str(soup)


# 代码语言识别(从 fenced code class 推断)
_LANG_PATTERN = re.compile(r"language-(\w+)", re.IGNORECASE)


def _detect_lang(code_tag: Any) -> str:
    """从 code 标签的 class 推断语言,默认 text。"""
    if code_tag is None or not hasattr(code_tag, "get"):
        return "text"
    classes = code_tag.get("class") or []
    for cls in classes:
        m = _LANG_PATTERN.match(cls)
        if m:
            return m.group(1).lower()
    return "text"


# ---------------------------------------------------------------------------
# 1. 知乎卡片式排版
# ---------------------------------------------------------------------------


def _format_zhihu(html: str, content: Any) -> str:
    """知乎卡片式排版:图片 figure 卡片 + 引用块美化 + 链接卡片。

    知乎编辑器接受 HTML,但渲染规则:
    - <img> 必须包在 <figure> 内才会显示 caption
    - <blockquote> 渲染为灰色引用块
    - <a> 链接会被自动转为卡片(若 href 是外部链接)
    """
    soup = _ensure_soup(html)
    if soup is None:
        return html

    # 1. 图片 → figure 卡片(带 figcaption 占位)
    for img in soup.find_all("img"):
        # 跳过已在 figure 内的
        if img.find_parent("figure"):
            continue
        fig = soup.new_tag("figure")
        fig["class"] = "zhihu-figure"
        # 复制 img 属性
        for k, v in list(img.attrs.items()):
            fig[k] = v if k in ("src", "alt") else None
        img_copy = soup.new_tag("img")
        img_copy["src"] = img.get("src", "")
        if img.get("alt"):
            img_copy["alt"] = img["alt"]
        fig.append(img_copy)
        # caption(用 alt 文本)
        alt_text = (img.get("alt") or "").strip()
        if alt_text:
            cap = soup.new_tag("figcaption")
            cap.string = alt_text
            fig.append(cap)
        img.replace_with(fig)

    # 2. 链接 → 卡片式(知乎自动转换外链为卡片,我们只标记 data-zhihu-card)
    for a in soup.find_all("a"):
        href = (a.get("href") or "").strip()
        if href.startswith("http") and not href.startswith("javascript:"):
            a["data-zhihu-card"] = "1"
            # 文本保留(知乎卡片会显示 title)

    # 3. blockquote 美化(知乎支持)
    for bq in soup.find_all("blockquote"):
        bq["class"] = (bq.get("class") or []) + ["zhihu-quote"]

    return _soup_to_str(soup)


# ---------------------------------------------------------------------------
# 2. 公众号富文本(行内 style)
# ---------------------------------------------------------------------------


# 公众号样式常量(行内 style,无外部 CSS 依赖)
_WX_SECTION_STYLE = (
    "margin: 0 0 16px 0; padding: 0; "
    "line-height: 1.75; color: #333; font-size: 16px;"
)
_WX_H1_STYLE = (
    "margin: 24px 0 12px; padding: 0 0 8px; "
    "border-bottom: 2px solid #07c160; "
    "font-size: 22px; color: #07c160; font-weight: bold;"
)
_WX_H2_STYLE = (
    "margin: 20px 0 10px; padding: 4px 12px; "
    "border-left: 4px solid #07c160; background: #f6f8fa; "
    "font-size: 18px; color: #333; font-weight: bold;"
)
_WX_H3_STYLE = (
    "margin: 16px 0 8px; padding: 0; "
    "font-size: 16px; color: #07c160; font-weight: bold;"
)
_WX_PRE_STYLE = (
    "margin: 12px 0; padding: 12px 16px; "
    "background: #f6f8fa; border-radius: 6px; "
    "overflow-x: auto; font-family: Consolas, Monaco, monospace; "
    "font-size: 14px; line-height: 1.6; color: #24292e;"
)
_WX_CODE_INLINE_STYLE = (
    "padding: 2px 6px; background: #f6f8fa; border-radius: 3px; "
    "font-family: Consolas, Monaco, monospace; "
    "font-size: 14px; color: #d6336c;"
)
_WX_BLOCKQUOTE_STYLE = (
    "margin: 12px 0; padding: 8px 16px; "
    "border-left: 4px solid #07c160; background: #f0f9eb; "
    "color: #666; font-size: 15px;"
)
_WX_IMG_STYLE = (
    "max-width: 100%; height: auto; "
    "border-radius: 6px; margin: 12px 0; display: block;"
)


def _format_wechat(html: str, content: Any) -> str:
    """公众号富文本:行内 style(不能依赖外部 CSS)。"""
    soup = _ensure_soup(html)
    if soup is None:
        return html

    # h1/h2/h3
    for h1 in soup.find_all("h1"):
        h1["style"] = _WX_H1_STYLE
    for h2 in soup.find_all("h2"):
        h2["style"] = _WX_H2_STYLE
    for h3 in soup.find_all("h3"):
        h3["style"] = _WX_H3_STYLE

    # 段落 → section(公众号编辑器推荐 section)
    for p in soup.find_all("p"):
        p.name = "section"
        p["style"] = _WX_SECTION_STYLE

    # 代码块(行内 style)
    for pre in soup.find_all("pre"):
        pre["style"] = _WX_PRE_STYLE
        # 内部 code 不再加样式(避免冲突)

    # 行内 code
    for code in soup.find_all("code"):
        # 排除 pre 内的 code
        if not code.find_parent("pre"):
            code["style"] = _WX_CODE_INLINE_STYLE

    # 引用
    for bq in soup.find_all("blockquote"):
        bq["style"] = _WX_BLOCKQUOTE_STYLE

    # 图片
    for img in soup.find_all("img"):
        img["style"] = _WX_IMG_STYLE

    return _soup_to_str(soup)


# ---------------------------------------------------------------------------
# 3. CSDN 代码块(强制标语言 + 行号)
# ---------------------------------------------------------------------------


def _format_csdn(html: str, content: Any) -> str:
    """CSDN:代码块必须标语言,否则不高亮。"""
    soup = _ensure_soup(html)
    if soup is None:
        return html

    # 代码块强制标语言
    for pre in soup.find_all("pre"):
        code = pre.find("code")
        if code is None:
            # 没有 <code> 子标签,创建一个
            code = soup.new_tag("code")
            # 把 pre 的内容移到 code
            for child in list(pre.children):
                code.append(child.extract())
            pre.append(code)
        # 检查 class 是否已有 language-xxx
        classes = code.get("class") or []
        has_lang = any(_LANG_PATTERN.match(c) for c in classes)
        if not has_lang:
            lang = _detect_lang(code)  # 从 hljs class 推断
            if lang == "text":
                # 检查 pre 上是否有 class
                pre_classes = pre.get("class") or []
                for pc in pre_classes:
                    m = _LANG_PATTERN.match(pc)
                    if m:
                        lang = m.group(1).lower()
                        break
            code["class"] = classes + [f"language-{lang}"]
            pre["class"] = (pre.get("class") or []) + [f"language-{lang}"]

    return _soup_to_str(soup)


# ---------------------------------------------------------------------------
# 4. 小红书 emoji 装饰 + 短段落
# ---------------------------------------------------------------------------

# 小红书 emoji 装饰(标题/段落首尾)
_XHS_TITLE_EMOJIS = ["✨", "🔥", "💡", "🌟", "💰", "🎯", "📌", "🎁"]
_XHS_PARA_EMOJIS = ["👉", "💡", "✨", "🌸", "💖", "🍃", "🎈", "💫"]
_XHS_TAG_PREFIX = "#"  # reserved for future hashtag wrapping


def _add_emoji_prefix(text: str, emojis: list[str], idx: int) -> str:
    """按 idx 轮换 emoji 加到文本开头。"""
    if not text:
        return text
    emoji = emojis[idx % len(emojis)]
    return f"{emoji} {text}"


def _format_xiaohongshu(html: str, content: Any) -> str:
    """小红书:emoji 装饰 + 短段落 + 话题标签风格。

    小红书特点:
    - 标题 ≤20 字,常带 emoji
    - 正文短(≤1000 字),段落 1-2 句
    - 大量 emoji 装饰
    - 话题用 # 标签
    """
    soup = _ensure_soup(html)
    if soup is None:
        return html

    para_idx = 0

    # 标题(h1/h2)加 emoji
    for i, h in enumerate(soup.find_all(["h1", "h2"])):
        text = h.get_text().strip()
        if text:
            h.string = _add_emoji_prefix(text, _XHS_TITLE_EMOJIS, i)

    # 段落加 emoji 前缀(每 3 段加一个)
    for p in soup.find_all("p"):
        text = p.get_text().strip()
        if not text:
            continue
        if para_idx % 3 == 0:
            # 在第一个文本节点前加 emoji
            new_text = _add_emoji_prefix(text, _XHS_PARA_EMOJIS, para_idx)
            p.string = new_text
        para_idx += 1

    # 代码块转换为图片说明(小红书不支持代码块,转为 blockquote 提示)
    for pre in soup.find_all("pre"):
        pre.name = "blockquote"
        pre["class"] = (pre.get("class") or []) + ["xhs-code-tip"]
        # 加提示前缀
        tip = soup.new_string("💡 代码示例:")
        pre.insert(0, tip)

    # 链接转为文本提示(小红书不允许外链)
    for a in soup.find_all("a"):
        text = a.get_text().strip()
        href = (a.get("href") or "").strip()
        if href and text:
            a.replace_with(f"🔗 {text}")

    return _soup_to_str(soup)


# ---------------------------------------------------------------------------
# 5. 掘金代码主题高亮
# ---------------------------------------------------------------------------


def _format_juejin(html: str, content: Any) -> str:
    """掘金:代码块主题高亮 + 标语言。

    掘金编辑器接受 HTML,代码块需要:
    - <pre><code class="language-xxx">
    - 支持 darcula / github / vs / atom 等主题(class on pre)
    """
    soup = _ensure_soup(html)
    if soup is None:
        return html

    for pre in soup.find_all("pre"):
        code = pre.find("code")
        if code is None:
            code = soup.new_tag("code")
            for child in list(pre.children):
                code.append(child.extract())
            pre.append(code)

        # 标语言
        classes = code.get("class") or []
        has_lang = any(_LANG_PATTERN.match(c) for c in classes)
        if not has_lang:
            lang = _detect_lang(code)
            if lang == "text":
                pre_classes = pre.get("class") or []
                for pc in pre_classes:
                    m = _LANG_PATTERN.match(pc)
                    if m:
                        lang = m.group(1).lower()
                        break
            code["class"] = classes + [f"language-{lang}"]

        # pre 加主题类(掘金默认 darcula)
        pre_classes = pre.get("class") or []
        if "theme-darcula" not in pre_classes:
            pre["class"] = pre_classes + ["theme-darcula"]

    return _soup_to_str(soup)


# ---------------------------------------------------------------------------
# 主入口:format_for_platform
# ---------------------------------------------------------------------------


# 平台 → 格式化函数映射
_FORMATTERS: dict[str, Any] = {
    "zhihu": _format_zhihu,
    "wechat": _format_wechat,
    "csdn": _format_csdn,
    "xiaohongshu": _format_xiaohongshu,
    "juejin": _format_juejin,
}


def format_for_platform(html: str, platform: str, content: Optional[Any] = None) -> str:
    """按平台专属规则格式化 HTML。

    Args:
        html: 已解析的统一 HTML(来自 content_parser.parse_to_html)
        platform: 平台 ID(如 'zhihu' / 'wechat' / 'csdn')
        content: 可选,PublishContent 对象(供某些平台读取额外字段)

    Returns:
        格式化后的 HTML(若平台无专属规则,原样返回)

    诚实边界:
    - 仅做排版/样式调整,不修改内容语义
    - 不调用平台 API,纯本地 HTML 变换
    - 若 beautifulsoup4 未安装,记录警告并回退原 HTML
    """
    if not html:
        return html

    formatter = _FORMATTERS.get(platform)
    if formatter is None:
        # 平台无专属规则,原样返回
        return html

    if not _HAS_BS4:
        logger.warning(
            "[platform_formatter] beautifulsoup4 not installed, "
            "platform-specific formatting skipped for %s",
            platform,
        )
        return html

    try:
        return formatter(html, content)
    except Exception as e:
        logger.warning(
            "[platform_formatter] %s formatting failed: %s: %s",
            platform,
            type(e).__name__,
            e,
        )
        return html


def supported_platforms() -> list[str]:
    """列出有专属排版规则的平台。"""
    return list(_FORMATTERS.keys())
