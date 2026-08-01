"""platform_formatter.py 单元测试 — 38 平台专属排版转换器(2026-08-01 立)。

覆盖维度(130+ cases):
1. format_for_platform 主入口:返回类型/空输入/未知平台/content 可选/supported_platforms(5 tests)
2. 38 平台 parametrize:返回 str + 保留文本内容(76 cases)
3. zhihu 卡片排版:figure 包裹/blockquote class/链接卡片/LaTeX 保留(4 tests)
4. wechat 富文本:h1/h2/h3 style/p→section/pre style/img style(5 tests)
5. csdn 代码块:language-xxx 标注/已有语言保留/pre 无 code(3 tests)
6. juejin 代码块:language-xxx + theme-darcula(2 tests)
7. xiaohongshu:emoji 装饰/代码块转 blockquote/链接转文本(3 tests)
8. 视频平台:链接转文本/代码块转 blockquote/长段落分段/emoji(4 tests)
9. 新闻媒体:标题居中/段落缩进/代码块转图片说明/引用块导读(4 tests)
10. 技术社区:代码块标语言/图片 alt/链接 nofollow(3 tests)
11. 社交平台:emoji/代码块转 blockquote/链接转文本(3 tests)
12. 论坛平台:引用块"引用"标记/代码块标语言(2 tests)
13. 媒体平台通用:代码块标语言/pre style/blockquote style+class(3 tests)
14. wordpress:原样返回/<!--more--> 保留(2 tests)
15. medium:移除 inline style/保留文本(2 tests)
16. youtube:纯文本提取/换行分隔(2 tests)
17. HTML 结构保留:p/h1/img src 跨平台保留(3 tests)
18. 降级路径:空字符串/未知平台/bs4 缺失/formatter 异常(4 tests)
"""
from __future__ import annotations

import pytest

from app.services.publish.platform_formatter import (
    format_for_platform,
    supported_platforms,
)

# 38 平台列表(从源模块动态读取,确保与 _FORMATTERS 同步)
_ALL_PLATFORMS: list[str] = supported_platforms()


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def sample_html() -> str:
    """基础 HTML 样本:含 h1/h2/h3/p/pre/code/blockquote/img/a。"""
    return (
        "<h1>标题一</h1>"
        "<h2>标题二</h2>"
        "<h3>标题三</h3>"
        "<p>第一段落内容。</p>"
        "<p>第二段落内容。</p>"
        "<pre><code>print('hello')</code></pre>"
        "<blockquote>引用内容</blockquote>"
        '<img src="https://example.com/img.jpg" alt="图片">'
        '<a href="https://example.com">链接文本</a>'
    )


@pytest.fixture
def sample_html_with_code() -> str:
    """含代码块的 HTML(无 language class)。"""
    return "<pre><code>print('hello')</code></pre>"


@pytest.fixture
def sample_html_with_code_lang() -> str:
    """含代码块的 HTML(已有 language-python class)。"""
    return '<pre><code class="language-python">print("hello")</code></pre>'


@pytest.fixture
def sample_html_with_img() -> str:
    """含图片的 HTML(带 alt)。"""
    return '<img src="https://example.com/img.jpg" alt="描述文字">'


@pytest.fixture
def sample_html_with_link() -> str:
    """含外链的 HTML。"""
    return '<a href="https://example.com">外部链接</a>'


@pytest.fixture
def sample_html_with_style() -> str:
    """含 inline style 的 HTML。"""
    return '<p style="color: red; font-size: 14px;">带样式文本</p>'


# =============================================================================
# 1. format_for_platform 主入口(5 tests)
# =============================================================================


class TestFormatForPlatformEntry:
    """format_for_platform 主入口函数行为。"""

    def test_returns_string_type(self, sample_html: str):
        """format_for_platform 返回 str 类型。"""
        result = format_for_platform(sample_html, "zhihu")
        assert isinstance(result, str)

    def test_empty_html_returns_empty(self):
        """空字符串 HTML → 返回空字符串(不报错)。"""
        result = format_for_platform("", "zhihu")
        assert result == ""

    def test_unknown_platform_returns_original(self, sample_html: str):
        """未知 platform_id → 原样返回 HTML。"""
        result = format_for_platform(sample_html, "nonexistent-platform-xyz")
        assert result == sample_html

    def test_content_param_optional(self, sample_html: str):
        """content 参数可选,不传时不报错。"""
        result = format_for_platform(sample_html, "wechat")
        assert isinstance(result, str)

    def test_supported_platforms_returns_list(self):
        """supported_platforms() 返回非空 list[str],至少 38 个平台。"""
        platforms = supported_platforms()
        assert isinstance(platforms, list)
        assert len(platforms) >= 38
        assert all(isinstance(p, str) for p in platforms)


# =============================================================================
# 2. 38 平台 parametrize(76 cases)
# =============================================================================


@pytest.mark.parametrize("platform", _ALL_PLATFORMS)
class TestAllPlatformsParametrized:
    """所有平台 parametrize 批量测试。"""

    def test_returns_string(self, platform: str, sample_html: str):
        """每平台格式化后返回 str。"""
        result = format_for_platform(sample_html, platform)
        assert isinstance(result, str)

    def test_preserves_text_content(self, platform: str, sample_html: str):
        """每平台格式化后保留原文文本内容(不丢语义)。"""
        result = format_for_platform(sample_html, platform)
        assert "标题一" in result
        assert "段落内容" in result


# =============================================================================
# 3. zhihu 卡片式排版(4 tests)
# =============================================================================


class TestZhihuFormatter:
    """知乎平台专属排版:figure 卡片 + blockquote class + 链接卡片。"""

    def test_img_wrapped_in_figure(self, sample_html_with_img: str):
        """img 标签被包裹在 figure 内(带 zhihu-figure class)。"""
        result = format_for_platform(sample_html_with_img, "zhihu")
        assert "<figure" in result
        assert "zhihu-figure" in result
        assert "<img" in result

    def test_blockquote_gets_class(self):
        """blockquote 添加 zhihu-quote class。"""
        html = "<blockquote>引用文本</blockquote>"
        result = format_for_platform(html, "zhihu")
        assert "zhihu-quote" in result

    def test_external_link_marked_as_card(self, sample_html_with_link: str):
        """外链 a 标签添加 data-zhihu-card 属性。"""
        result = format_for_platform(sample_html_with_link, "zhihu")
        assert "data-zhihu-card" in result

    def test_latex_formula_preserved(self):
        """LaTeX 公式($$...$$)不被破坏。"""
        html = "<p>公式 $$E=mc^2$$ 内联</p>"
        result = format_for_platform(html, "zhihu")
        assert "E=mc^2" in result


# =============================================================================
# 4. wechat 富文本(5 tests)
# =============================================================================


class TestWechatFormatter:
    """公众号富文本:行内 style(h1/h2/h3/p→section/pre/code/blockquote/img)。"""

    def test_h1_gets_inline_style(self):
        """h1 标签添加行内 style(含 #07c160)。"""
        result = format_for_platform("<h1>标题</h1>", "wechat")
        assert "<h1" in result
        assert "07c160" in result
        assert "style" in result

    def test_h2_gets_inline_style(self):
        """h2 标签添加行内 style。"""
        result = format_for_platform("<h2>副标题</h2>", "wechat")
        assert "<h2" in result
        assert "style" in result

    def test_p_converted_to_section(self):
        """p 标签转换为 section(公众号编辑器推荐)。"""
        result = format_for_platform("<p>段落</p>", "wechat")
        assert "<section" in result
        assert "段落" in result

    def test_pre_gets_inline_style(self):
        """pre 标签添加行内 style。"""
        result = format_for_platform("<pre><code>code</code></pre>", "wechat")
        assert "<pre" in result
        assert "style" in result

    def test_img_gets_inline_style(self, sample_html_with_img: str):
        """img 标签添加行内 style(max-width: 100%)。"""
        result = format_for_platform(sample_html_with_img, "wechat")
        assert "<img" in result
        assert "max-width" in result


# =============================================================================
# 5. csdn 代码块(3 tests)
# =============================================================================


class TestCsdnFormatter:
    """CSDN:代码块强制标语言(language-xxx)。"""

    def test_code_gets_language_class(self, sample_html_with_code: str):
        """无 language class 的 code 添加 language-text。"""
        result = format_for_platform(sample_html_with_code, "csdn")
        assert "language-" in result

    def test_existing_language_preserved(self, sample_html_with_code_lang: str):
        """已有 language-python class 的 code 保留不变。"""
        result = format_for_platform(sample_html_with_code_lang, "csdn")
        assert "language-python" in result

    def test_pre_without_code_creates_code(self):
        """pre 内无 code 子标签时创建 code 并标语言。"""
        html = "<pre>raw code</pre>"
        result = format_for_platform(html, "csdn")
        assert "<code" in result
        assert "language-" in result


# =============================================================================
# 6. juejin 代码块(2 tests)
# =============================================================================


class TestJuejinFormatter:
    """掘金:代码块标语言 + theme-darcula 主题类。"""

    def test_code_gets_language_class(self, sample_html_with_code: str):
        """code 标签添加 language-xxx class。"""
        result = format_for_platform(sample_html_with_code, "juejin")
        assert "language-" in result

    def test_pre_gets_theme_class(self, sample_html_with_code: str):
        """pre 标签添加 theme-darcula class。"""
        result = format_for_platform(sample_html_with_code, "juejin")
        assert "theme-darcula" in result


# =============================================================================
# 7. xiaohongshu emoji 装饰(3 tests)
# =============================================================================


class TestXiaohongshuFormatter:
    """小红书:emoji 装饰 + 代码块转 blockquote + 链接转文本。"""

    def test_heading_gets_emoji(self):
        """h1/h2 标题添加 emoji 前缀。"""
        result = format_for_platform("<h1>标题</h1>", "xiaohongshu")
        assert "标题" in result
        assert any(
            emoji in result
            for emoji in ["✨", "🔥", "💡", "🌟", "💰", "🎯", "📌", "🎁"]
        )

    def test_code_converted_to_blockquote(self, sample_html_with_code: str):
        """pre 代码块转换为 blockquote(带 xhs-code-tip class)。"""
        result = format_for_platform(sample_html_with_code, "xiaohongshu")
        assert "<blockquote" in result
        assert "xhs-code-tip" in result
        assert "代码示例" in result

    def test_link_converted_to_text(self, sample_html_with_link: str):
        """a 链接转为纯文本(带 🔗 前缀)。"""
        result = format_for_platform(sample_html_with_link, "xiaohongshu")
        assert "🔗" in result
        assert "外部链接" in result
        assert "<a " not in result


# =============================================================================
# 8. 视频平台通用排版(4 tests)
# =============================================================================


class TestVideoPlatformFormatter:
    """视频平台(bilibili/douyin/kuaishou 等):链接转文本 + 代码块转 blockquote。"""

    def test_link_converted_to_text(self):
        """bilibili: a 链接转为纯文本(无 a 标签)。"""
        html = '<a href="https://example.com">链接文本</a>'
        result = format_for_platform(html, "bilibili")
        assert "链接文本" in result
        assert "<a " not in result

    def test_code_converted_to_blockquote(self, sample_html_with_code: str):
        """douyin: pre 代码块转换为 blockquote(带"代码示例"前缀)。"""
        result = format_for_platform(sample_html_with_code, "douyin")
        assert "<blockquote" in result
        assert "代码示例" in result

    def test_long_paragraph_split(self):
        """bilibili: 长段落(>80 字)按句号断开为多段。"""
        long_text = "这是第一句话。" * 20  # 140 字 > 80
        html = f"<p>{long_text}</p>"
        result = format_for_platform(html, "bilibili")
        assert result.count("<p") > 1

    def test_paragraph_emoji_prefix(self):
        """kuaishou: 段落首部添加 emoji 装饰。"""
        html = "<p>段落内容</p>"
        result = format_for_platform(html, "kuaishou")
        assert "段落内容" in result
        assert any(
            emoji in result
            for emoji in ["🎬", "🔥", "✨", "💡", "🎯", "📌", "🎁", "🌟"]
        )


# =============================================================================
# 9. 新闻媒体通用排版(4 tests)
# =============================================================================


class TestNewsMediaFormatter:
    """六大号(baijiahao/qq/dayihao 等):标题居中 + 段落缩进 + 代码块转图片说明。"""

    def test_h1_centered_style(self):
        """baijiahao: h1 添加居中 style(text-align: center)。"""
        result = format_for_platform("<h1>标题</h1>", "baijiahao")
        assert "<h1" in result
        assert "text-align" in result

    def test_paragraph_indent_style(self):
        """toutiao: p 添加首行缩进 style(text-indent: 2em)。"""
        result = format_for_platform("<p>段落</p>", "toutiao")
        assert "<p" in result
        assert "text-indent" in result

    def test_code_converted_to_blockquote(self, sample_html_with_code: str):
        """netease: pre 代码块转换为 blockquote(带"代码截图说明"前缀)。"""
        result = format_for_platform(sample_html_with_code, "netease")
        assert "<blockquote" in result
        assert "代码截图说明" in result

    def test_blockquote_gets导读_prefix(self):
        """sohu: 引用块添加"导读:"前缀。"""
        html = "<blockquote>引用内容</blockquote>"
        result = format_for_platform(html, "sohu")
        assert "导读" in result


# =============================================================================
# 10. 技术社区通用排版(3 tests)
# =============================================================================


class TestTechCommunityFormatter:
    """技术社区(cnblogs/segmentfault/oschina/jianshu):代码标语言 + 图片 alt + 链接 nofollow。"""

    def test_code_gets_language_class(self, sample_html_with_code: str):
        """cnblogs: code 添加 language-xxx class。"""
        result = format_for_platform(sample_html_with_code, "cnblogs")
        assert "language-" in result

    def test_img_gets_alt(self):
        """segmentfault: 无 alt 的 img 添加 alt="图片"。"""
        html = '<img src="https://example.com/img.jpg">'
        result = format_for_platform(html, "segmentfault")
        assert "alt" in result
        assert "图片" in result

    def test_external_link_gets_nofollow(self, sample_html_with_link: str):
        """oschina: 外链 a 添加 rel="nofollow"。"""
        result = format_for_platform(sample_html_with_link, "oschina")
        assert "nofollow" in result


# =============================================================================
# 11. 社交平台通用排版(3 tests)
# =============================================================================


class TestSocialFormatter:
    """社交平台(weibo/douban/lofter):emoji + 代码块转 blockquote + 链接转文本。"""

    def test_paragraph_emoji_prefix(self):
        """weibo: 段落首部添加 emoji 装饰。"""
        result = format_for_platform("<p>段落内容</p>", "weibo")
        assert "段落内容" in result
        assert any(
            emoji in result
            for emoji in ["✨", "💡", "🔥", "🌟", "💖", "🎯", "📌", "🎁"]
        )

    def test_code_converted_to_blockquote(self, sample_html_with_code: str):
        """douban: pre 代码块转换为 blockquote(带"代码示例"前缀)。"""
        result = format_for_platform(sample_html_with_code, "douban")
        assert "<blockquote" in result
        assert "代码示例" in result

    def test_link_converted_to_text(self, sample_html_with_link: str):
        """lofter: a 链接转为纯文本(带 🔗 前缀)。"""
        result = format_for_platform(sample_html_with_link, "lofter")
        assert "🔗" in result
        assert "<a " not in result


# =============================================================================
# 12. 论坛平台通用排版(2 tests)
# =============================================================================


class TestForumFormatter:
    """论坛平台(baidu_zhidao/baidu_tieba/hupu):引用块"引用"标记 + 代码块标语言。"""

    def test_blockquote_gets引用_prefix(self):
        """baidu_zhidao: 引用块添加"引用:"前缀。"""
        html = "<blockquote>引用内容</blockquote>"
        result = format_for_platform(html, "baidu_zhidao")
        assert "引用" in result

    def test_code_gets_language_class(self, sample_html_with_code: str):
        """hupu: code 添加 language-xxx class。"""
        result = format_for_platform(sample_html_with_code, "hupu")
        assert "language-" in result


# =============================================================================
# 13. 媒体平台通用排版(3 tests)
# =============================================================================


class TestMediaCommonFormatter:
    """媒体平台(36kr/huxiu/tmtmedia/people/china_news/zhihu_daily):代码标语言+引用美化。"""

    def test_code_gets_language_class(self, sample_html_with_code: str):
        """36kr: code 添加 language-xxx class。"""
        result = format_for_platform(sample_html_with_code, "36kr")
        assert "language-" in result

    def test_pre_gets_inline_style(self, sample_html_with_code: str):
        """huxiu: pre 添加行内 style(媒体平台深色背景)。"""
        result = format_for_platform(sample_html_with_code, "huxiu")
        assert "<pre" in result
        assert "style" in result

    def test_blockquote_gets_style_and_class(self):
        """tmtmedia: blockquote 添加行内 style + tmtmedia-quote class。"""
        html = "<blockquote>引用</blockquote>"
        result = format_for_platform(html, "tmtmedia")
        assert "<blockquote" in result
        assert "style" in result
        assert "tmtmedia-quote" in result


# =============================================================================
# 14. wordpress 原样返回(2 tests)
# =============================================================================


class TestWordpressFormatter:
    """WordPress:最宽松平台,保留原始 HTML 不做变换。"""

    def test_returns_html_unchanged(self, sample_html: str):
        """wordpress 原样返回 HTML(不做任何变换)。"""
        result = format_for_platform(sample_html, "wordpress")
        assert result == sample_html

    def test_more_comment_preserved(self):
        """wordpress 保留 <!--more--> 摘要分隔符(原样返回)。"""
        html = "<p>摘要部分</p><!--more--><p>正文部分</p>"
        result = format_for_platform(html, "wordpress")
        assert "<!--more-->" in result
        assert result == html


# =============================================================================
# 15. medium 移除 inline style(2 tests)
# =============================================================================


class TestMediumFormatter:
    """Medium:Markdown 风格,移除 inline style。"""

    def test_removes_inline_style(self, sample_html_with_style: str):
        """medium 移除所有标签的 inline style 属性。"""
        result = format_for_platform(sample_html_with_style, "medium")
        assert "style" not in result
        assert "带样式文本" in result

    def test_preserves_content_text(self):
        """medium 移除 style 后保留文本内容。"""
        html = '<h1 style="color:blue">标题</h1><p style="color:red">段落</p>'
        result = format_for_platform(html, "medium")
        assert "标题" in result
        assert "段落" in result


# =============================================================================
# 16. youtube 纯文本提取(2 tests)
# =============================================================================


class TestYoutubeFormatter:
    """YouTube:纯文本描述(不支持 HTML)。"""

    def test_returns_plain_text(self):
        """youtube 返回纯文本(无 HTML 标签)。"""
        html = "<p>第一段</p><p>第二段</p>"
        result = format_for_platform(html, "youtube")
        assert "第一段" in result
        assert "第二段" in result
        assert "<p>" not in result

    def test_text_separator_newline(self):
        """youtube 用换行符分隔不同标签的文本。"""
        html = "<p>段落A</p><p>段落B</p>"
        result = format_for_platform(html, "youtube")
        assert "\n" in result


# =============================================================================
# 17. HTML 结构保留(3 tests)
# =============================================================================


class TestHtmlStructurePreserved:
    """验证基本 HTML 标签在格式化后不被破坏(语义保留)。"""

    def test_p_tag_preserved(self):
        """p 标签在多数平台保留(标签名可能变,但文本保留)。"""
        html = "<p>段落内容</p>"
        for platform in ["zhihu", "wechat", "csdn", "juejin", "36kr"]:
            result = format_for_platform(html, platform)
            assert "段落内容" in result, f"{platform} 丢失段落文本"

    def test_h1_tag_preserved(self):
        """h1 标签在多数平台保留(标签名可能变,但文本保留)。"""
        html = "<h1>大标题</h1>"
        for platform in ["zhihu", "csdn", "juejin", "36kr", "bilibili"]:
            result = format_for_platform(html, platform)
            assert "大标题" in result, f"{platform} 丢失标题文本"

    def test_img_src_preserved(self, sample_html_with_img: str):
        """img 的 src 属性在多数平台保留。"""
        for platform in ["zhihu", "wechat", "csdn", "cnblogs", "segmentfault"]:
            result = format_for_platform(sample_html_with_img, platform)
            assert "example.com/img.jpg" in result, f"{platform} 丢失 img src"


# =============================================================================
# 18. 降级路径(4 tests)
# =============================================================================


class TestFallbackAndDegradation:
    """空输入/未知平台/bs4 缺失/formatter 异常的降级路径。"""

    def test_empty_string_returns_empty_for_all_platforms(self):
        """空字符串输入 → 所有平台返回空字符串(不报错)。"""
        for platform in _ALL_PLATFORMS:
            result = format_for_platform("", platform)
            assert result == "", f"{platform} 空输入未返回空字符串"

    def test_unknown_platform_returns_original(self, sample_html: str):
        """未知平台 ID → 原样返回 HTML。"""
        result = format_for_platform(sample_html, "totally-unknown-platform-12345")
        assert result == sample_html

    def test_bs4_missing_returns_original(self, monkeypatch, sample_html: str):
        """bs4 缺失时,所有平台原样返回 HTML(降级不报错)。"""
        import app.services.publish.platform_formatter as mod

        monkeypatch.setattr(mod, "_HAS_BS4", False)
        for platform in _ALL_PLATFORMS:
            result = format_for_platform(sample_html, platform)
            assert result == sample_html, f"{platform} 在 bs4 缺失时未原样返回"

    def test_formatter_exception_returns_original(self, monkeypatch, sample_html: str):
        """formatter 抛异常时,format_for_platform 捕获并原样返回 HTML。"""
        import app.services.publish.platform_formatter as mod

        def _raising_formatter(html: str, content: object) -> str:
            raise RuntimeError("intentional test error")

        monkeypatch.setitem(mod._FORMATTERS, "zhihu", _raising_formatter)
        result = format_for_platform(sample_html, "zhihu")
        assert result == sample_html
