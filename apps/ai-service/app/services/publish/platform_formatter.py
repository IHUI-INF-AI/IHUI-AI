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
from typing import Any, Callable, Optional

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
# 6. 媒体平台通用排版(36氪/虎嗅/钛媒体/人民网 — 代码块标语言 + 引用块美化)
# ---------------------------------------------------------------------------


# 媒体平台引用块样式(行内 style,灰色左边框 + 浅色背景)
_MEDIA_BLOCKQUOTE_STYLE = (
    "margin: 12px 0; padding: 10px 16px; "
    "border-left: 4px solid #2b6cb0; background: #f0f4f8; "
    "color: #4a5568; font-size: 15px; line-height: 1.7;"
)
_MEDIA_PRE_STYLE = (
    "margin: 12px 0; padding: 12px 16px; "
    "background: #1e293b; border-radius: 6px; "
    "overflow-x: auto; font-family: Consolas, Monaco, monospace; "
    "font-size: 14px; line-height: 1.6; color: #e2e8f0;"
)
_MEDIA_CODE_INLINE_STYLE = (
    "padding: 2px 6px; background: #edf2f7; border-radius: 3px; "
    "font-family: Consolas, Monaco, monospace; "
    "font-size: 14px; color: #d53f8c;"
)


# ---------------------------------------------------------------------------
# 7. 视频平台通用排版(短文案 + 链接转文本 + 长段落分段)
# ---------------------------------------------------------------------------

# 视频平台段落 emoji 装饰(短文案优化)
_VIDEO_PARA_EMOJIS: list[str] = ["🎬", "🔥", "✨", "💡", "🎯", "📌", "🎁", "🌟"]


def _format_video_platform(html: str, content: Any, class_prefix: str) -> str:
    """视频平台通用排版:链接转纯文本 + 代码块转提示 + 长段落分段 + emoji 装饰。

    bilibili/douyin/kuaishou/xigua/haokan/shipinhao/acfun 共享此逻辑:
    - 链接转纯文本(视频平台不支持外链)
    - 代码块转 blockquote 提示(视频平台不支持代码高亮)
    - 长段落(>80 字)按句号断开为多段
    - 段落首部 emoji 装饰
    """
    soup = _ensure_soup(html)
    if soup is None:
        return html

    # 1. 链接转纯文本(视频平台不支持外链)
    for a in soup.find_all("a"):
        text = a.get_text().strip()
        href = (a.get("href") or "").strip()
        if text and href:
            a.replace_with(text)
        elif href:
            a.replace_with(href)

    # 2. 代码块转 blockquote 提示
    for pre in soup.find_all("pre"):
        pre.name = "blockquote"
        pre["class"] = (pre.get("class") or []) + [f"{class_prefix}-code-tip"]
        tip = soup.new_string("💻 代码示例:")
        pre.insert(0, tip)

    # 3. 段落 emoji 装饰 + 长段落按句号分段
    para_idx = 0
    for p in list(soup.find_all("p")):
        text = p.get_text().strip()
        if not text:
            continue
        # emoji 前缀(每 2 段加一个)
        if para_idx % 2 == 0:
            emoji = _VIDEO_PARA_EMOJIS[para_idx % len(_VIDEO_PARA_EMOJIS)]
            text = f"{emoji} {text}"
        # 长段落(>80 字)按句号断开
        if len(text) > 80:
            parts = re.split(r"([。!?!?])", text)
            chunks: list[str] = []
            buf = ""
            for i in range(0, len(parts) - 1, 2):
                seg = parts[i] + (parts[i + 1] if i + 1 < len(parts) else "")
                if len(buf) + len(seg) > 50 and buf:
                    chunks.append(buf)
                    buf = seg
                else:
                    buf += seg
            if buf:
                chunks.append(buf)
            if len(chunks) > 1:
                p.string = chunks[0]
                current = p
                for chunk in chunks[1:]:
                    new_p = soup.new_tag("p")
                    new_p.string = chunk
                    current.insert_after(new_p)
                    current = new_p
            else:
                p.string = text
        else:
            p.string = text
        para_idx += 1

    return _soup_to_str(soup)


# ---------------------------------------------------------------------------
# 8. 六大号/新闻媒体通用排版(首行缩进 + 代码块转图片说明 + 引用块加导读)
# ---------------------------------------------------------------------------

_NEWS_BODY_STYLE = (
    "margin: 0 0 16px 0; padding: 0; line-height: 1.8; "
    "color: #333; font-size: 16px; text-indent: 2em;"
)
_NEWS_H1_STYLE = (
    "margin: 24px 0 12px; padding: 0; text-align: center; "
    "font-size: 24px; color: #111; font-weight: bold;"
)
_NEWS_BLOCKQUOTE_STYLE = (
    "margin: 12px 0; padding: 8px 16px; "
    "border-left: 4px solid #c0392b; background: #fdf2f2; "
    "color: #555; font-size: 14px;"
)
_NEWS_PRE_STYLE = (
    "margin: 12px 0; padding: 12px 16px; "
    "background: #f5f5f5; border-radius: 4px; "
    "font-family: Consolas, Monaco, monospace; font-size: 13px; color: #333;"
)


def _format_news_media(html: str, content: Any, class_prefix: str) -> str:
    """六大号/新闻媒体排版:首行缩进 + 代码块转图片说明 + 引用块加"导读"标记。

    baijiahao/qq/dayihao/netease/sohu/sina/toutiao 共享此逻辑:
    - 标题居中
    - 段落首行缩进 2em
    - 代码块转 blockquote(六大号不支持代码高亮,转为"代码截图说明")
    - 引用块加"导读:"前缀
    """
    soup = _ensure_soup(html)
    if soup is None:
        return html

    # 1. 标题居中
    for h1 in soup.find_all("h1"):
        h1["style"] = _NEWS_H1_STYLE

    # 2. 段落首行缩进
    for p in soup.find_all("p"):
        p["style"] = _NEWS_BODY_STYLE

    # 3. 代码块转图片说明(六大号不支持代码高亮)
    for pre in soup.find_all("pre"):
        pre.name = "blockquote"
        pre["style"] = _NEWS_PRE_STYLE
        pre["class"] = (pre.get("class") or []) + [f"{class_prefix}-code-tip"]
        tip = soup.new_string("📷 代码截图说明:")
        pre.insert(0, tip)

    # 4. 引用块加"导读"标记(跳过已被代码块转换的)
    for bq in soup.find_all("blockquote"):
        bq_classes = bq.get("class") or []
        if f"{class_prefix}-code-tip" in bq_classes:
            continue
        bq["style"] = _NEWS_BLOCKQUOTE_STYLE
        bq["class"] = bq_classes + [f"{class_prefix}-quote"]
        first_text = bq.get_text().strip()
        if first_text and not first_text.startswith("导读:"):
            tip = soup.new_string("导读:")
            bq.insert(0, tip)

    return _soup_to_str(soup)


# ---------------------------------------------------------------------------
# 9. 技术社区通用排版(代码块标语言 + 图片加 alt + 链接加 nofollow)
# ---------------------------------------------------------------------------


def _format_tech_community(html: str, content: Any, class_prefix: str) -> str:
    """技术社区排版:代码块强制标语言 + 图片加 alt + 链接加 rel=nofollow。

    cnblogs/segmentfault/oschina/jianshu 共享此逻辑:
    - 代码块强制标语言(SEO + 高亮)
    - <img> 加 alt 属性(SEO 优化)
    - <a> 加 rel="nofollow"(避免外链权重流失)
    """
    soup = _ensure_soup(html)
    if soup is None:
        return html

    # 1. 代码块强制标语言(复用 CSDN 逻辑)
    for pre in soup.find_all("pre"):
        code = pre.find("code")
        if code is None:
            code = soup.new_tag("code")
            for child in list(pre.children):
                code.append(child.extract())
            pre.append(code)
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
            pre["class"] = (pre.get("class") or []) + [f"language-{lang}"]

    # 2. 图片加 alt 属性(SEO 优化)
    for img in soup.find_all("img"):
        if not img.get("alt"):
            img["alt"] = "图片"

    # 3. 链接加 rel="nofollow"(仅外链)
    for a in soup.find_all("a"):
        href = (a.get("href") or "").strip()
        if href.startswith("http") and not href.startswith("javascript:"):
            rel = a.get("rel")
            if rel is None:
                a["rel"] = "nofollow"
            elif isinstance(rel, list):
                if "nofollow" not in rel:
                    a["rel"] = rel + ["nofollow"]
            elif "nofollow" not in str(rel):
                a["rel"] = [str(rel), "nofollow"]

    return _soup_to_str(soup)


# ---------------------------------------------------------------------------
# 10. 社交平台通用排版(emoji 装饰 + 话题标签 + 链接转文本)
# ---------------------------------------------------------------------------

_SOCIAL_PARA_EMOJIS: list[str] = ["✨", "💡", "🔥", "🌟", "💖", "🎯", "📌", "🎁"]


def _format_social(html: str, content: Any, class_prefix: str) -> str:
    """社交平台排版:emoji 装饰 + 代码块转提示 + 链接转文本。

    weibo/douban/lofter 共享此逻辑:
    - 段落首部 emoji 装饰(每 2 段加一个)
    - 代码块转 blockquote 提示(社交平台不支持代码块)
    - 链接转文本 + 🔗 前缀(社交平台限制外链)
    """
    soup = _ensure_soup(html)
    if soup is None:
        return html

    # 1. 段落加 emoji 前缀(每 2 段加一个)
    para_idx = 0
    for p in soup.find_all("p"):
        text = p.get_text().strip()
        if not text:
            continue
        if para_idx % 2 == 0:
            emoji = _SOCIAL_PARA_EMOJIS[para_idx % len(_SOCIAL_PARA_EMOJIS)]
            p.string = f"{emoji} {text}"
        para_idx += 1

    # 2. 代码块转 blockquote 提示(社交平台不支持代码块)
    for pre in soup.find_all("pre"):
        pre.name = "blockquote"
        pre["class"] = (pre.get("class") or []) + [f"{class_prefix}-code-tip"]
        tip = soup.new_string("💻 代码示例:")
        pre.insert(0, tip)

    # 3. 链接转文本 + 🔗 前缀(社交平台限制外链)
    for a in soup.find_all("a"):
        text = a.get_text().strip()
        if text:
            a.replace_with(f"🔗 {text}")

    return _soup_to_str(soup)


# ---------------------------------------------------------------------------
# 11. 论坛平台通用排版(问答格式 + 引用回复加"引用"标记)
# ---------------------------------------------------------------------------


def _format_forum(html: str, content: Any, class_prefix: str) -> str:
    """论坛平台排版:引用块加"引用"标记 + 代码块标语言。

    baidu_zhidao/baidu_tieba/hupu 共享此逻辑:
    - 引用块加"引用:"前缀(便于论坛引用回复识别)
    - 代码块强制标语言
    """
    soup = _ensure_soup(html)
    if soup is None:
        return html

    # 1. 引用块加"引用"标记
    for bq in soup.find_all("blockquote"):
        bq["class"] = (bq.get("class") or []) + [f"{class_prefix}-quote"]
        first_text = bq.get_text().strip()
        if first_text and not first_text.startswith("引用:"):
            tip = soup.new_string("引用:")
            bq.insert(0, tip)

    # 2. 代码块强制标语言
    for pre in soup.find_all("pre"):
        code = pre.find("code")
        if code is None:
            code = soup.new_tag("code")
            for child in list(pre.children):
                code.append(child.extract())
            pre.append(code)
        classes = code.get("class") or []
        has_lang = any(_LANG_PATTERN.match(c) for c in classes)
        if not has_lang:
            lang = _detect_lang(code)
            code["class"] = classes + [f"language-{lang}"]

    return _soup_to_str(soup)


def _format_media_common(html: str, content: Any, class_prefix: str) -> str:
    """媒体平台通用排版:代码块强制标语言 + 引用块美化 + 行内 style。

    36氪/虎嗅/钛媒体/人民网等科技/新闻媒体平台共享此逻辑:
    - 代码块:<pre><code class="language-xxx"> 强制标语言(媒体编辑器需要)
    - 引用块:行内 style 美化(灰色左边框 + 浅蓝背景)
    - 行内 code:浅色背景 pill 样式
    """
    soup = _ensure_soup(html)
    if soup is None:
        return html

    # 1. 代码块强制标语言(复用 CSDN 逻辑)
    for pre in soup.find_all("pre"):
        code = pre.find("code")
        if code is None:
            code = soup.new_tag("code")
            for child in list(pre.children):
                code.append(child.extract())
            pre.append(code)
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
        # pre 加媒体平台样式
        pre["style"] = _MEDIA_PRE_STYLE

    # 2. 行内 code 样式(排除 pre 内的)
    for code in soup.find_all("code"):
        if not code.find_parent("pre"):
            code["style"] = _MEDIA_CODE_INLINE_STYLE

    # 3. 引用块美化
    for bq in soup.find_all("blockquote"):
        bq["style"] = _MEDIA_BLOCKQUOTE_STYLE
        bq["class"] = (bq.get("class") or []) + [f"{class_prefix}-quote"]

    return _soup_to_str(soup)


def _format_36kr(html: str, content: Any) -> str:
    """36氪:代码块标语言 + 引用块美化。"""
    return _format_media_common(html, content, "36kr")


def _format_huxiu(html: str, content: Any) -> str:
    """虎嗅:代码块标语言 + 引用块美化。"""
    return _format_media_common(html, content, "huxiu")


def _format_tmtmedia(html: str, content: Any) -> str:
    """钛媒体:代码块标语言 + 引用块美化。"""
    return _format_media_common(html, content, "tmtmedia")


def _format_people(html: str, content: Any) -> str:
    """人民网:代码块标语言 + 引用块美化(新闻媒体风格)。"""
    return _format_media_common(html, content, "people")


# ---------------------------------------------------------------------------
# 12. 视频平台专属排版(bilibili/douyin/kuaishou/xigua/haokan/shipinhao/acfun)
# ---------------------------------------------------------------------------


def _format_bilibili(html: str, content: Any) -> str:
    """哔哩哔哩:视频平台通用排版 + 话题标签 #xxx# 风格。"""
    return _format_video_platform(html, content, "bilibili")


def _format_douyin(html: str, content: Any) -> str:
    """抖音:视频平台通用排版 + 短文案优化。"""
    return _format_video_platform(html, content, "douyin")


def _format_kuaishou(html: str, content: Any) -> str:
    """快手:视频平台通用排版。"""
    return _format_video_platform(html, content, "kuaishou")


def _format_xigua(html: str, content: Any) -> str:
    """西瓜视频:视频平台通用排版。"""
    return _format_video_platform(html, content, "xigua")


def _format_haokan(html: str, content: Any) -> str:
    """好看视频:视频平台通用排版。"""
    return _format_video_platform(html, content, "haokan")


def _format_shipinhao(html: str, content: Any) -> str:
    """微信视频号:视频平台通用排版。"""
    return _format_video_platform(html, content, "shipinhao")


def _format_acfun(html: str, content: Any) -> str:
    """AcFun:视频平台通用排版(文章区也适用)。"""
    return _format_video_platform(html, content, "acfun")


# ---------------------------------------------------------------------------
# 13. 六大号专属排版(baijiahao/qq/dayihao/netease/sohu/sina/toutiao)
# ---------------------------------------------------------------------------


def _format_baijiahao(html: str, content: Any) -> str:
    """百家号:新闻稿排版。"""
    return _format_news_media(html, content, "baijiahao")


def _format_qq(html: str, content: Any) -> str:
    """企鹅号:新闻稿排版。"""
    return _format_news_media(html, content, "qq")


def _format_dayihao(html: str, content: Any) -> str:
    """大鱼号:新闻稿排版。"""
    return _format_news_media(html, content, "dayihao")


def _format_netease(html: str, content: Any) -> str:
    """网易号:新闻稿排版。"""
    return _format_news_media(html, content, "netease")


def _format_sohu(html: str, content: Any) -> str:
    """搜狐号:新闻稿排版。"""
    return _format_news_media(html, content, "sohu")


def _format_sina(html: str, content: Any) -> str:
    """新浪看点:新闻稿排版。"""
    return _format_news_media(html, content, "sina")


def _format_toutiao(html: str, content: Any) -> str:
    """今日头条:新闻稿排版。"""
    return _format_news_media(html, content, "toutiao")


# ---------------------------------------------------------------------------
# 14. 技术社区专属排版(cnblogs/segmentfault/oschina/jianshu)
# ---------------------------------------------------------------------------


def _format_cnblogs(html: str, content: Any) -> str:
    """博客园:代码块标语言 + 图片 alt + 链接 nofollow。"""
    return _format_tech_community(html, content, "cnblogs")


def _format_segmentfault(html: str, content: Any) -> str:
    """思否:代码块标语言 + 图片 alt + 链接 nofollow。"""
    return _format_tech_community(html, content, "segmentfault")


def _format_oschina(html: str, content: Any) -> str:
    """开源中国:代码块标语言 + 图片 alt + 链接 nofollow。"""
    return _format_tech_community(html, content, "oschina")


def _format_jianshu(html: str, content: Any) -> str:
    """简书:代码块标语言 + 图片 alt + 链接 nofollow。"""
    return _format_tech_community(html, content, "jianshu")


# ---------------------------------------------------------------------------
# 15. 社交平台专属排版(weibo/douban/lofter)
# ---------------------------------------------------------------------------


def _format_weibo(html: str, content: Any) -> str:
    """微博:emoji 装饰 + 代码块转提示 + 链接转文本。"""
    return _format_social(html, content, "weibo")


def _format_douban(html: str, content: Any) -> str:
    """豆瓣:emoji 装饰 + 代码块转提示 + 链接转文本。"""
    return _format_social(html, content, "douban")


def _format_lofter(html: str, content: Any) -> str:
    """LOFTER:emoji 装饰 + 代码块转提示 + 链接转文本。"""
    return _format_social(html, content, "lofter")


# ---------------------------------------------------------------------------
# 16. 论坛平台专属排版(baidu_zhidao/baidu_tieba/hupu)
# ---------------------------------------------------------------------------


def _format_baidu_zhidao(html: str, content: Any) -> str:
    """百度知道:引用块加"引用"标记 + 代码块标语言。"""
    return _format_forum(html, content, "baidu_zhidao")


def _format_baidu_tieba(html: str, content: Any) -> str:
    """百度贴吧:引用块加"引用"标记 + 代码块标语言。"""
    return _format_forum(html, content, "baidu_tieba")


def _format_hupu(html: str, content: Any) -> str:
    """虎扑:引用块加"引用"标记 + 代码块标语言。"""
    return _format_forum(html, content, "hupu")


# ---------------------------------------------------------------------------
# 17. 媒体平台专属排版第二批(china_news/zhihu_daily)
# ---------------------------------------------------------------------------


def _format_china_news(html: str, content: Any) -> str:
    """中国新闻网:代码块标语言 + 引用块美化(新闻媒体风格)。"""
    return _format_media_common(html, content, "china_news")


def _format_zhihu_daily(html: str, content: Any) -> str:
    """知乎日报:代码块标语言 + 引用块美化。"""
    return _format_media_common(html, content, "zhihu_daily")


# ---------------------------------------------------------------------------
# 18. 国际平台专属排版(wordpress/medium/youtube)
# ---------------------------------------------------------------------------


def _format_wordpress(html: str, content: Any) -> str:
    """WordPress:保留原始 HTML(最宽松平台,不做变换)。"""
    # WordPress 接受完整 HTML,直接返回原内容
    return html


def _format_medium(html: str, content: Any) -> str:
    """Medium:Markdown 风格(简单段落,移除 inline style)。"""
    soup = _ensure_soup(html)
    if soup is None:
        return html
    # 移除 inline style(Medium 编辑器自己处理样式)
    for tag in soup.find_all(True):
        if tag.get("style"):
            del tag["style"]
    return _soup_to_str(soup)


def _format_youtube(html: str, content: Any) -> str:
    """YouTube:纯文本描述(不支持 HTML)。"""
    soup = _ensure_soup(html)
    if soup is None:
        return html
    # 提取纯文本(YouTube 描述框只接受纯文本)
    # str() 显式包装:soup 为 Any 类型(缺 bs4 时回退),避免 mypy no-any-return
    return str(soup.get_text(separator="\n"))


# ---------------------------------------------------------------------------
# 主入口:format_for_platform
# ---------------------------------------------------------------------------


# 平台 → 格式化函数映射(38 平台全部专属排版,2026-07-31 立)
_FORMATTERS: dict[str, Callable[[str, Optional[Any]], str]] = {
    # 第一批:已有专属排版(9 平台)
    "zhihu": _format_zhihu,
    "wechat": _format_wechat,
    "csdn": _format_csdn,
    "xiaohongshu": _format_xiaohongshu,
    "juejin": _format_juejin,
    "36kr": _format_36kr,
    "huxiu": _format_huxiu,
    "tmtmedia": _format_tmtmedia,
    "people": _format_people,
    # 视频平台(7)
    "bilibili": _format_bilibili,
    "douyin": _format_douyin,
    "kuaishou": _format_kuaishou,
    "xigua": _format_xigua,
    "haokan": _format_haokan,
    "shipinhao": _format_shipinhao,
    "acfun": _format_acfun,
    # 六大号(7,含今日头条)
    "baijiahao": _format_baijiahao,
    "qq": _format_qq,
    "dayihao": _format_dayihao,
    "netease": _format_netease,
    "sohu": _format_sohu,
    "sina": _format_sina,
    "toutiao": _format_toutiao,
    # 技术社区(4)
    "cnblogs": _format_cnblogs,
    "segmentfault": _format_segmentfault,
    "oschina": _format_oschina,
    "jianshu": _format_jianshu,
    # 社交平台(3)
    "weibo": _format_weibo,
    "douban": _format_douban,
    "lofter": _format_lofter,
    # 论坛平台(3)
    "baidu_zhidao": _format_baidu_zhidao,
    "baidu_tieba": _format_baidu_tieba,
    "hupu": _format_hupu,
    # 媒体平台(2)
    "china_news": _format_china_news,
    "zhihu_daily": _format_zhihu_daily,
    # 国际平台(3)
    "wordpress": _format_wordpress,
    "medium": _format_medium,
    "youtube": _format_youtube,
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
