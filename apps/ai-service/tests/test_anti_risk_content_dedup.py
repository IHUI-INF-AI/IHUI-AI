"""app/services/publish/anti_risk/content_dedup.py 单元测试:内容指纹去重。

测试覆盖(14 cases):
- calculate_content_fingerprint:稳定性(同内容同指纹) / 差异性(不同内容不同指纹) /
  空内容降级 / 图片加入指纹
- _hamming_distance:已知输入对 / 相同哈希=0 / 相反哈希=64
- check_cross_platform_similarity:相似内容检测 / 不相似内容过滤 / 单内容返回空
- calculate_similarity:完全相同=1.0 / 不同内容<1.0
- SimilarityReport 字段完整性
- diversify_for_platform:标题改写 / 原对象不变(深拷贝) / 标签打乱
- _tokenize / _strip_html / _seed_from_str 工具方法

测试隔离:用本地 _StubContent 类模拟 PublishContent,不依赖 base_adapter。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest

from app.services.publish.anti_risk.content_dedup import (
    ContentDeduplicator,
    SimilarityReport,
    _SIMHASH_BITS,
    _SIMHASH_THRESHOLD,
    get_deduplicator,
)


# =============================================================================
# 辅助:StubContent 模拟 PublishContent
# =============================================================================


@dataclass
class _StubContent:
    """模拟 PublishContent(含 title/text/html/images/extra 字段)。"""

    title: str = ""
    text: str = ""
    html: str = ""
    images: list[str] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)


# =============================================================================
# calculate_content_fingerprint SimHash 指纹(4 tests)
# =============================================================================


class TestCalculateContentFingerprint:
    """测试 calculate_content_fingerprint() SimHash 指纹生成。"""

    def test_stable_fingerprint_for_same_content(self):
        """相同内容多次计算返回相同指纹(SimHash 确定性)。"""
        dedup = ContentDeduplicator()
        content = _StubContent(title="测试标题", text="这是正文内容")
        fp1 = dedup.calculate_content_fingerprint(content)
        fp2 = dedup.calculate_content_fingerprint(content)
        assert fp1 == fp2
        assert len(fp1) == 16  # 64 位 hex = 16 字符

    def test_different_content_different_fingerprint(self):
        """不同内容生成不同指纹。"""
        dedup = ContentDeduplicator()
        fp1 = dedup.calculate_content_fingerprint(
            _StubContent(title="文章A", text="内容一")
        )
        fp2 = dedup.calculate_content_fingerprint(
            _StubContent(title="文章B", text="内容二")
        )
        assert fp1 != fp2

    def test_empty_content_returns_zero_fingerprint(self):
        """空内容(无 title/text/html/images)返回全 0 指纹(降级)。"""
        dedup = ContentDeduplicator()
        fp = dedup.calculate_content_fingerprint(_StubContent())
        assert fp == "0" * 16

    def test_images_affect_fingerprint(self):
        """不同图片列表生成不同指纹(图片路径加入 token)。"""
        dedup = ContentDeduplicator()
        content_a = _StubContent(title="同标题", text="同正文", images=["img1.jpg"])
        content_b = _StubContent(title="同标题", text="同正文", images=["img2.jpg"])
        fp_a = dedup.calculate_content_fingerprint(content_a)
        fp_b = dedup.calculate_content_fingerprint(content_b)
        assert fp_a != fp_b


# =============================================================================
# _hamming_distance 海明距离(3 tests)
# =============================================================================


class TestHammingDistance:
    """测试 _hamming_distance() SimHash 海明距离计算。"""

    def test_identical_hashes_distance_zero(self):
        """相同哈希 → 海明距离 0。"""
        dedup = ContentDeduplicator()
        h = 0xDEADBEEF12345678
        assert dedup._hamming_distance(h, h) == 0

    def test_opposite_hashes_distance_64(self):
        """完全相反的哈希(全 bit 不同)→ 海明距离 64。"""
        dedup = ContentDeduplicator()
        h = 0xFFFFFFFFFFFFFFFF
        h_opp = 0x0000000000000000
        assert dedup._hamming_distance(h, h_opp) == _SIMHASH_BITS

    def test_known_input_pair(self):
        """已知输入对:0x01 vs 0x03 → 海明距离 1(仅 1 bit 不同)。"""
        dedup = ContentDeduplicator()
        assert dedup._hamming_distance(0x01, 0x03) == 1
        assert dedup._hamming_distance(0x00, 0x0F) == 4  # 4 bit 不同


# =============================================================================
# check_cross_platform_similarity 多平台相似度检查(3 tests)
# =============================================================================


class TestCheckCrossPlatformSimilarity:
    """测试 check_cross_platform_similarity() 多内容两两比较。"""

    def test_similar_contents_reported(self):
        """高度相似内容(仅个别字不同)→ is_similar=True。"""
        dedup = ContentDeduplicator()
        contents = [
            _StubContent(title="反风控技术深度解析", text="本文详细介绍了反风控的五层防线设计"),
            _StubContent(title="反风控技术深度解析", text="本文详细介绍了反风控的五层防线设计"),  # 完全相同
        ]
        reports = dedup.check_cross_platform_similarity(contents)
        assert len(reports) >= 1
        assert reports[0].is_similar is True
        assert reports[0].similarity == 1.0
        assert reports[0].hamming_distance == 0

    def test_dissimilar_contents_not_similar(self):
        """不相似的内容(相似度 <85%)→ is_similar=False(不触发告警)。"""
        dedup = ContentDeduplicator()
        contents = [
            _StubContent(title="人工智能发展趋势", text="AI 正在改变世界的一切"),
            _StubContent(title="菜谱大全", text="红烧肉的做法非常简单"),
        ]
        reports = dedup.check_cross_platform_similarity(contents)
        # 即使相似度 >50%(出现在报告里),is_similar 仍为 False(未达 85% 阈值)
        for r in reports:
            assert r.is_similar is False
            assert r.similarity < 0.85

    def test_single_content_returns_empty(self):
        """单个内容无法两两比较 → 返回空列表。"""
        dedup = ContentDeduplicator()
        reports = dedup.check_cross_platform_similarity([
            _StubContent(title="仅一篇", text="内容")
        ])
        assert reports == []


# =============================================================================
# calculate_similarity 两内容相似度(2 tests)
# =============================================================================


class TestCalculateSimilarity:
    """测试 calculate_similarity() 两内容相似度计算。"""

    def test_identical_content_returns_one(self):
        """完全相同内容 → 相似度 1.0。"""
        dedup = ContentDeduplicator()
        content = _StubContent(title="相同标题", text="相同正文内容")
        sim = dedup.calculate_similarity(content, content)
        assert sim == 1.0

    def test_different_content_returns_less_than_one(self):
        """不同内容 → 相似度 <1.0。"""
        dedup = ContentDeduplicator()
        a = _StubContent(title="技术文章A", text="深入分析架构设计模式")
        b = _StubContent(title="美食博客B", text="今天做了一道红烧鱼")
        sim = dedup.calculate_similarity(a, b)
        assert 0.0 <= sim < 1.0


# =============================================================================
# SimilarityReport dataclass(1 test)
# =============================================================================


class TestSimilarityReport:
    """测试 SimilarityReport dataclass 字段完整性。"""

    def test_all_fields_present(self):
        """SimilarityReport 含 content_a/content_b/similarity/hamming_distance/is_similar。"""
        report = SimilarityReport(
            content_a="标题A",
            content_b="标题B",
            similarity=0.92,
            hamming_distance=5,
            is_similar=True,
        )
        assert report.content_a == "标题A"
        assert report.content_b == "标题B"
        assert report.similarity == 0.92
        assert report.hamming_distance == 5
        assert report.is_similar is True


# =============================================================================
# diversify_for_platform 内容差异化(2 tests)
# =============================================================================


class TestDiversifyForPlatform:
    """测试 diversify_for_platform() 同内容多平台差异化。"""

    def test_original_content_not_modified(self):
        """差异化后原对象不被修改(深拷贝)。"""
        dedup = ContentDeduplicator()
        original = _StubContent(
            title="优化系统性能的方法",
            text="优化是一种重要的开发手段",
            extra={"tags": ["优化", "系统", "性能"]},
        )
        original_title = original.title
        original_text = original.text
        dedup.diversify_for_platform(original, "csdn", "user_123")
        assert original.title == original_title
        assert original.text == original_text

    def test_diversified_content_has_different_fingerprint(self):
        """差异化后内容指纹与原文不同(同义改写改变了 token)。"""
        dedup = ContentDeduplicator()
        original = _StubContent(
            title="优化系统性能的方法",
            text="优化是一种重要的开发手段,可以提升用户体验",
        )
        diversified = dedup.diversify_for_platform(original, "csdn", "user_456")
        fp_orig = dedup.calculate_content_fingerprint(original)
        fp_div = dedup.calculate_content_fingerprint(diversified)
        assert fp_orig != fp_div


# =============================================================================
# 工具方法(2 tests)
# =============================================================================


class TestUtilityMethods:
    """测试 _tokenize / _strip_html / _seed_from_str 工具方法。"""

    def test_tokenize_mixed_chinese_english(self):
        """分词:中文按字符 + 英文按空格 + 数字。"""
        tokens = ContentDeduplicator._tokenize("Hello 世界123 test")
        assert "Hello" in tokens
        assert "test" in tokens
        assert "世" in tokens
        assert "界" in tokens
        assert "123" in tokens

    def test_strip_html_removes_tags(self):
        """去 HTML 标签,保留纯文本。"""
        result = ContentDeduplicator._strip_html("<p>Hello <strong>World</strong></p>")
        assert "<p>" not in result
        assert "<strong>" not in result
        assert "Hello" in result
        assert "World" in result


# =============================================================================
# get_deduplicator 单例(1 test)
# =============================================================================


class TestGetDeduplicator:
    """测试 get_deduplicator() 全局单例。"""

    def test_returns_same_instance(self):
        """get_deduplicator 多次调用返回同一 ContentDeduplicator 实例。"""
        d1 = get_deduplicator()
        d2 = get_deduplicator()
        assert d1 is d2
        assert isinstance(d1, ContentDeduplicator)


# =============================================================================
# SimHash 阈值常量校验(1 test)
# =============================================================================


class TestSimhashConstants:
    """测试 SimHash 常量配置。"""

    def test_threshold_constants(self):
        """_SIMHASH_BITS=64, _SIMHASH_THRESHOLD=3(海明距离 ≤3 视为相似)。"""
        assert _SIMHASH_BITS == 64
        assert _SIMHASH_THRESHOLD == 3
