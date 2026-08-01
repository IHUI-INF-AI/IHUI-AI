"""platform_rules.py 单元测试 — 38 平台规则适配 + 深度校验 + 自动修复(2026-08-01 立)。

覆盖维度(120+ cases):
1. PlatformRule dataclass:构造/默认值/字段完整性/default_factory 独立性/cover_formats(5 tests)
2. PLATFORM_RULES dict:38 平台完整/key 匹配 platform_id/platform_name 非空(3 tests)
3. 38 平台 parametrize:规则加载 + title_max/body_max 正数(76 cases)
4. validate_content:合法/标题超长/正文超长/标签过多/标签过长/敏感词(6 tests)
5. validate_content_deep:标题禁用词/必含词/emoji/特殊字符/正文外链/分类必填/视频必填(7 tests)
6. auto_fix_content:标题截断/emoji 移除/禁用词替换/正文截断/标签截断/标签超长截断(6 tests)
7. truncate_to_platform:标题截断/正文截断(2 tests)
8. detect_sensitive_words:政治/广告/违法/多敏感词同时(4 tests)
9. 边界值:恰好 max_length 不报警/max_length+1 报警/空输入(3 tests)
10. 未知平台:validate 返回 valid+warning/auto_fix 原样返回(2 tests)
11. 平台特定限制:wechat 64/toutiao 30/zhihu 100/xiaohongshu 20/bilibili 80(5 tests)
"""
from __future__ import annotations

import pytest

from app.services.publish.base_adapter import PublishContent
from app.services.publish.platform_rules import (
    PLATFORM_RULES,
    DeepValidationResult,
    PlatformRule,
    SensitiveWordHit,
    ValidationResult,
    auto_fix_content,
    detect_sensitive_words,
    get_platform_rule,
    list_platforms_with_rules,
    truncate_to_platform,
    validate_content,
    validate_content_deep,
)

# 38 平台列表(从源模块动态读取,确保与 PLATFORM_RULES 同步)
_ALL_PLATFORMS: list[str] = list_platforms_with_rules()


# =============================================================================
# 工厂函数
# =============================================================================


def make_content(
    title: str = "测试标题",
    text: str | None = None,
    html: str | None = None,
    fmt: str = "md",
    cover_path: str | None = None,
    images: list[str] | None = None,
) -> PublishContent:
    """构造 PublishContent 对象(用于测试)。"""
    return PublishContent(
        format=fmt,
        title=title,
        text=text,
        html=html,
        cover_path=cover_path,
        images=images if images is not None else [],
    )


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def valid_content() -> PublishContent:
    """合法内容(标题和正文都在多数平台限制内)。"""
    return make_content(
        title="这是一篇测试文章标题",
        text="这是正文内容,长度适中。",
        html="<p>这是正文内容,长度适中。</p>",
    )


@pytest.fixture
def sample_tags() -> list[str]:
    """示例标签列表。"""
    return ["技术", "Python", "测试"]


# =============================================================================
# 1. PlatformRule dataclass(5 tests)
# =============================================================================


class TestPlatformRuleDataclass:
    """PlatformRule dataclass 字段构造与默认值。"""

    def test_full_construction(self):
        """所有字段显式构造。"""
        rule = PlatformRule(
            platform_id="test",
            platform_name="测试平台",
            title_max=100,
            body_max=50000,
        )
        assert rule.platform_id == "test"
        assert rule.platform_name == "测试平台"
        assert rule.title_max == 100
        assert rule.body_max == 50000

    def test_default_values(self):
        """必填字段外的字段有合理默认值。"""
        rule = PlatformRule(platform_id="test", platform_name="测试")
        assert rule.title_min == 1
        assert rule.title_max == 100
        assert rule.body_min == 1
        assert rule.body_max == 100000
        assert rule.tag_max_count == 5
        assert rule.tag_max_length == 20
        assert rule.cover_required is False
        assert rule.video_required is False
        assert rule.support_markdown is True

    def test_list_fields_default_factory_independence(self):
        """list 字段使用 default_factory(不共享引用)。"""
        r1 = PlatformRule(platform_id="a", platform_name="A")
        r2 = PlatformRule(platform_id="b", platform_name="B")
        r1.title_forbidden_words.append("禁词")
        assert r1.title_forbidden_words == ["禁词"]
        assert r2.title_forbidden_words == []

    def test_rule_version_default_format(self):
        """rule_version 默认值格式为 YYYY.MM.DD。"""
        rule = PlatformRule(platform_id="test", platform_name="测试")
        assert "." in rule.rule_version
        assert len(rule.rule_version) >= 8

    def test_cover_formats_default(self):
        """cover_formats 默认含 jpg/jpeg/png/webp。"""
        rule = PlatformRule(platform_id="test", platform_name="测试")
        assert "jpg" in rule.cover_formats
        assert "png" in rule.cover_formats


# =============================================================================
# 2. PLATFORM_RULES dict(3 tests)
# =============================================================================


class TestPlatformRulesDict:
    """PLATFORM_RULES 字典完整性。"""

    def test_contains_at_least_38_platforms(self):
        """PLATFORM_RULES 包含至少 38 个平台。"""
        assert len(PLATFORM_RULES) >= 38

    def test_all_keys_match_platform_id(self):
        """每个 key 与对应 PlatformRule.platform_id 一致。"""
        for key, rule in PLATFORM_RULES.items():
            assert rule.platform_id == key, (
                f"{key} 的 platform_id 不匹配: {rule.platform_id}"
            )

    def test_all_platform_names_nonempty(self):
        """每个平台的 platform_name 非空。"""
        for key, rule in PLATFORM_RULES.items():
            assert rule.platform_name, f"{key} 的 platform_name 为空"


# =============================================================================
# 3. 38 平台 parametrize(76 cases)
# =============================================================================


@pytest.mark.parametrize("platform", _ALL_PLATFORMS)
class TestAllPlatformsParametrized:
    """所有平台 parametrize 批量测试。"""

    def test_rule_loaded(self, platform: str):
        """每平台规则正确加载(非 None)。"""
        rule = get_platform_rule(platform)
        assert rule is not None

    def test_limits_positive(self, platform: str):
        """每平台 title_max / body_max / tag_max_count 均为正数。"""
        rule = PLATFORM_RULES[platform]
        assert rule.title_max > 0
        assert rule.body_max > 0
        assert rule.tag_max_count > 0


# =============================================================================
# 4. validate_content(6 tests)
# =============================================================================


class TestValidateContent:
    """validate_content 基础校验。"""

    def test_valid_content_passes(self, valid_content: PublishContent):
        """合法内容 → valid=True。"""
        result = validate_content("zhihu", valid_content)
        assert isinstance(result, ValidationResult)
        assert result.valid is True

    def test_title_too_long_fails(self):
        """标题超长 → valid=False + errors 含"标题超长"。"""
        rule = get_platform_rule("wechat")
        assert rule is not None
        long_title = "字" * (rule.title_max + 1)
        content = make_content(title=long_title, text="正文", html="<p>正文</p>")
        result = validate_content("wechat", content)
        assert result.valid is False
        assert any("标题" in e for e in result.errors)

    def test_body_too_long_warns(self):
        """正文超长 → warnings 含"正文超长"(不阻塞 valid)。"""
        rule = get_platform_rule("wechat")
        assert rule is not None
        long_body = "字" * (rule.body_max + 1)
        content = make_content(title="标题", html=long_body)
        result = validate_content("wechat", content)
        assert any("正文超长" in w for w in result.warnings)

    def test_too_many_tags_fails(self, valid_content: PublishContent):
        """标签数量超限 → valid=False。"""
        rule = get_platform_rule("wechat")
        assert rule is not None
        tags = [f"标签{i}" for i in range(rule.tag_max_count + 1)]
        result = validate_content("wechat", valid_content, {"tags": tags})
        assert result.valid is False
        assert any("标签过多" in e for e in result.errors)

    def test_tag_too_long_fails(self, valid_content: PublishContent):
        """单个标签超长 → valid=False。"""
        rule = get_platform_rule("wechat")
        assert rule is not None
        long_tag = "字" * (rule.tag_max_length + 1)
        result = validate_content("wechat", valid_content, {"tags": [long_tag]})
        assert result.valid is False
        assert any("标签过长" in e for e in result.errors)

    def test_sensitive_words_detected(self):
        """敏感词检测 → sensitive_hits 非空 + warnings 含"敏感词"。"""
        content = make_content(
            title="标题含赌博内容",
            text="正文提到色情和暴力",
            html="<p>正文提到色情和暴力</p>",
        )
        result = validate_content("zhihu", content)
        assert result.sensitive_hits
        assert any("敏感词" in w for w in result.warnings)


# =============================================================================
# 5. validate_content_deep(7 tests)
# =============================================================================


class TestValidateContentDeep:
    """validate_content_deep 深度校验(20+ 维度)。"""

    def test_title_forbidden_words_detected(self):
        """标题禁用词检测(wechat 标题党词"震惊")。"""
        content = make_content(title="震惊!这个标题太夸张", text="正文", html="<p>正文</p>")
        result = validate_content_deep("wechat", content)
        assert result.valid is False
        assert any("禁用词" in e for e in result.errors)

    def test_title_must_include_detected(self, monkeypatch):
        """标题必含词检测(设置 rule.title_must_include)。

        注意:标题不得包含必含词本身作为子串,否则 `w in title` 会误判为已包含。
        用 "这是一个普通标题" 确保不含 "必含词"。
        """
        rule = get_platform_rule("zhihu")
        assert rule is not None
        monkeypatch.setattr(rule, "title_must_include", ["必含词"])
        content = make_content(title="这是一个普通标题", text="正文", html="<p>正文</p>")
        result = validate_content_deep("zhihu", content)
        assert result.valid is False
        assert any("必含词" in e for e in result.errors)

    def test_title_emoji_detected(self, monkeypatch):
        """标题 emoji 检测(title_no_emoji=True)。"""
        rule = get_platform_rule("zhihu")
        assert rule is not None
        monkeypatch.setattr(rule, "title_no_emoji", True)
        content = make_content(title="标题🔥含emoji", text="正文", html="<p>正文</p>")
        result = validate_content_deep("zhihu", content)
        assert result.valid is False
        assert any("emoji" in e for e in result.errors)

    def test_title_special_chars_detected(self, monkeypatch):
        """标题特殊字符检测(title_no_special_chars=True)。"""
        rule = get_platform_rule("zhihu")
        assert rule is not None
        monkeypatch.setattr(rule, "title_no_special_chars", True)
        content = make_content(title="标题【含特殊字符】", text="正文", html="<p>正文</p>")
        result = validate_content_deep("zhihu", content)
        assert result.valid is False
        assert any("特殊字符" in e for e in result.errors)

    def test_content_external_links_detected(self):
        """正文外链检测(douyin content_no_external_links=True)。"""
        content = make_content(
            title="标题",
            text="正文含外链 https://example.com 链接",
            html='<p>正文含外链 <a href="https://example.com">链接</a></p>',
        )
        result = validate_content_deep("douyin", content)
        assert result.valid is False
        assert any("外链" in e for e in result.errors)

    def test_category_required_detected(self):
        """分类必填检测(bilibili category_required=True 且未提供 category)。"""
        content = make_content(title="标题", text="正文", html="<p>正文</p>")
        result = validate_content_deep("bilibili", content)
        assert result.valid is False
        assert any("分类" in e for e in result.errors)

    def test_video_required_detected(self):
        """视频必填检测(bilibili video_required=True 但 format != video)。"""
        content = make_content(title="标题", text="正文", html="<p>正文</p>", fmt="md")
        result = validate_content_deep("bilibili", content)
        assert result.valid is False
        assert any("视频" in e for e in result.errors)


# =============================================================================
# 6. auto_fix_content(6 tests)
# =============================================================================


class TestAutoFixContent:
    """auto_fix_content 自动修复超限内容。"""

    def test_title_truncated_with_ellipsis(self):
        """标题超长 → 截断 + 省略号(…)。"""
        rule = get_platform_rule("wechat")
        assert rule is not None
        long_title = "字" * (rule.title_max + 10)
        content = make_content(title=long_title, text="正文", html="<p>正文</p>")
        fixed = auto_fix_content("wechat", content)
        assert len(fixed.title) <= rule.title_max
        assert fixed.title.endswith("…")

    def test_title_emoji_removed(self, monkeypatch):
        """标题 emoji 移除(title_no_emoji=True)。"""
        rule = get_platform_rule("zhihu")
        assert rule is not None
        monkeypatch.setattr(rule, "title_no_emoji", True)
        content = make_content(title="标题🔥内容", text="正文", html="<p>正文</p>")
        fixed = auto_fix_content("zhihu", content)
        assert "🔥" not in fixed.title

    def test_title_forbidden_word_replaced(self):
        """标题禁用词替换为 ***(wechat 标题党词"震惊")。"""
        content = make_content(title="震惊!这个标题", text="正文", html="<p>正文</p>")
        fixed = auto_fix_content("wechat", content)
        assert "震惊" not in fixed.title
        assert "***" in fixed.title

    def test_body_truncated_with_ellipsis(self):
        """正文超长 → 截断 + 省略号(...)。"""
        rule = get_platform_rule("wechat")
        assert rule is not None
        long_body = "字" * (rule.body_max + 10)
        content = make_content(title="标题", html=long_body)
        fixed = auto_fix_content("wechat", content)
        body = fixed.html or ""
        assert len(body) <= rule.body_max
        assert body.endswith("...")

    def test_tags_truncated_to_max_count(self):
        """标签过多 → 截断到 tag_max_count 个。"""
        rule = get_platform_rule("wechat")
        assert rule is not None
        tags = [f"标签{i}" for i in range(rule.tag_max_count + 3)]
        content = make_content(title="标题", text="正文", html="<p>正文</p>")
        fixed = auto_fix_content("wechat", content, {"tags": tags})
        fixed_tags = fixed.extra.get("tags", [])
        assert len(fixed_tags) <= rule.tag_max_count

    def test_tag_too_long_truncated(self):
        """单标签超长 → 截断到 tag_max_length。"""
        rule = get_platform_rule("wechat")
        assert rule is not None
        long_tag = "字" * (rule.tag_max_length + 5)
        content = make_content(title="标题", text="正文", html="<p>正文</p>")
        fixed = auto_fix_content("wechat", content, {"tags": [long_tag]})
        fixed_tags = fixed.extra.get("tags", [])
        assert all(len(t) <= rule.tag_max_length for t in fixed_tags)


# =============================================================================
# 7. truncate_to_platform(2 tests)
# =============================================================================


class TestTruncateToPlatform:
    """truncate_to_platform 按平台规则截断内容(返回新对象,不改原对象)。"""

    def test_title_truncated_with_ellipsis(self):
        """标题超长 → 截断 + 省略号(…)。"""
        rule = get_platform_rule("wechat")
        assert rule is not None
        long_title = "字" * (rule.title_max + 5)
        content = make_content(title=long_title, text="正文", html="<p>正文</p>")
        result = truncate_to_platform("wechat", content)
        assert len(result.title) <= rule.title_max
        assert result.title.endswith("…")

    def test_body_truncated_with_ellipsis(self):
        """正文超长 → 截断 + 省略号(...)。"""
        rule = get_platform_rule("wechat")
        assert rule is not None
        long_body = "字" * (rule.body_max + 5)
        content = make_content(title="标题", html=long_body)
        result = truncate_to_platform("wechat", content)
        body = result.html or ""
        assert len(body) <= rule.body_max
        assert body.endswith("...")


# =============================================================================
# 8. detect_sensitive_words(4 tests)
# =============================================================================


class TestDetectSensitiveWords:
    """detect_sensitive_words 敏感词检测。"""

    def test_political_word_detected(self):
        """政治类敏感词检测(台独)。"""
        hits = detect_sensitive_words("这里提到台独的话题")
        assert any(h.word == "台独" and h.category == "political" for h in hits)

    def test_ad_word_detected(self):
        """广告类敏感词检测(加微信)。"""
        hits = detect_sensitive_words("加微信领取优惠")
        assert any(h.word == "加微信" and h.category == "ad" for h in hits)

    def test_illegal_word_detected(self):
        """违法类敏感词检测(赌博)。"""
        hits = detect_sensitive_words("参与赌博活动")
        assert any(h.word == "赌博" and h.category == "illegal" for h in hits)

    def test_multiple_sensitive_words_simultaneous(self):
        """多敏感词同时检测(赌博 + 色情 + 杀人)。"""
        text = "赌博和色情以及杀人都被检测"
        hits = detect_sensitive_words(text)
        words = {h.word for h in hits}
        assert "赌博" in words
        assert "色情" in words
        assert "杀人" in words
        assert len(hits) >= 3


# =============================================================================
# 9. 边界值(3 tests)
# =============================================================================


class TestBoundaryValues:
    """边界值测试:恰好 max_length 不报警 / max_length+1 报警 / 空输入降级。"""

    def test_exact_max_length_no_error(self):
        """标题恰好等于 title_max → 不报"标题超长"错误。"""
        rule = get_platform_rule("wechat")
        assert rule is not None
        title = "字" * rule.title_max
        content = make_content(title=title, text="正文", html="<p>正文</p>")
        result = validate_content("wechat", content)
        assert not any("标题超长" in e for e in result.errors)

    def test_exceed_max_length_by_one_errors(self):
        """标题比 title_max 多 1 字 → 报"标题超长"错误。"""
        rule = get_platform_rule("wechat")
        assert rule is not None
        title = "字" * (rule.title_max + 1)
        content = make_content(title=title, text="正文", html="<p>正文</p>")
        result = validate_content("wechat", content)
        assert any("标题超长" in e for e in result.errors)
        assert result.valid is False

    def test_empty_text_sensitive_words_returns_empty(self):
        """空字符串 → detect_sensitive_words 返回空列表。"""
        assert detect_sensitive_words("") == []


# =============================================================================
# 10. 未知平台(2 tests)
# =============================================================================


class TestUnknownPlatform:
    """未知 platform_id 走默认/降级路径。"""

    def test_validate_unknown_platform_returns_valid_with_warning(
        self, valid_content: PublishContent
    ):
        """validate_content 未知平台 → valid=True + warnings 含"无规则配置"。"""
        result = validate_content("totally-unknown-platform-xyz", valid_content)
        assert result.valid is True
        assert any("无规则" in w for w in result.warnings)

    def test_auto_fix_unknown_platform_returns_original(
        self, valid_content: PublishContent
    ):
        """auto_fix_content 未知平台 → 原样返回 content(不修改)。"""
        result = auto_fix_content("totally-unknown-platform-xyz", valid_content)
        assert result is valid_content


# =============================================================================
# 11. 平台特定限制(5 tests)
# =============================================================================


class TestSpecificPlatformLimits:
    """验证各平台特定的字数限制(基于 PLATFORM_RULES 配置)。"""

    def test_wechat_title_max_64(self):
        """公众号标题上限 64 字。"""
        rule = get_platform_rule("wechat")
        assert rule is not None
        assert rule.title_max == 64

    def test_toutiao_title_max_30(self):
        """今日头条标题上限 30 字。"""
        rule = get_platform_rule("toutiao")
        assert rule is not None
        assert rule.title_max == 30

    def test_zhihu_title_max_100(self):
        """知乎标题上限 100 字。"""
        rule = get_platform_rule("zhihu")
        assert rule is not None
        assert rule.title_max == 100

    def test_xiaohongshu_title_max_20(self):
        """小红书标题上限 20 字。"""
        rule = get_platform_rule("xiaohongshu")
        assert rule is not None
        assert rule.title_max == 20

    def test_bilibili_title_max_80(self):
        """哔哩哔哩标题上限 80 字。"""
        rule = get_platform_rule("bilibili")
        assert rule is not None
        assert rule.title_max == 80
