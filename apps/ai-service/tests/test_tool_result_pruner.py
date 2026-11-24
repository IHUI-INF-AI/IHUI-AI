# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""tool_result_pruner 单测 — 钉住确定性头/中/尾裁剪 + marker 单次 + 富块保序。"""

from __future__ import annotations

import pytest

from app.services.tool_result_pruner import (
    DEFAULT_HEAD_CHARS,
    DEFAULT_TAIL_CHARS,
    DEFAULT_THRESHOLD_CHARS,
    IMAGE_PRICE_DEFAULT,
    PRUNE_MARKER,
    ContentBlock,
    PruneConfig,
    code_point_length,
    default_price,
    measure_content,
    prune_blocks_over_budget,
    prune_content,
    prune_content_with_stats,
)


def _cfg(**kw) -> PruneConfig:
    return PruneConfig(**kw)


class TestMeasure:
    def test_text_counts_code_points(self) -> None:
        assert measure_content([ContentBlock("text", "hello")]) == 5

    def test_non_text_zero(self) -> None:
        assert measure_content([ContentBlock("image", None)]) == 0

    def test_mixed(self) -> None:
        blocks = [ContentBlock("image"), ContentBlock("text", "abc"), ContentBlock("tool_call")]
        assert measure_content(blocks) == 3

    def test_code_point_length_cjk(self) -> None:
        assert code_point_length("中文") == 2


class TestPruneContent:
    def test_under_threshold_returns_none(self) -> None:
        blocks = [ContentBlock("text", "short")]
        assert (
            prune_content(blocks, config=_cfg(threshold_chars=100, head_chars=10, tail_chars=5))
            is None
        )

    def test_over_threshold_keeps_head_tail_marker(self) -> None:
        text = "A" * 100
        cfg = _cfg(threshold_chars=80, head_chars=10, tail_chars=5)
        result = prune_content([ContentBlock("text", text)], config=cfg)
        assert result is not None
        joined = "".join(b.text or "" for b in result)
        assert joined.startswith("A" * 10)
        assert joined.endswith("A" * 5)
        assert PRUNE_MARKER in joined

    def test_marker_inserted_once(self) -> None:
        # 两个 text block 都与被移除区相交, marker 只出现一次
        blocks = [ContentBlock("text", "B" * 60), ContentBlock("text", "C" * 60)]
        cfg = _cfg(threshold_chars=80, head_chars=10, tail_chars=5)
        result = prune_content(blocks, config=cfg)
        assert result is not None
        joined = "".join(b.text or "" for b in result)
        assert joined.count(PRUNE_MARKER) == 1

    def test_rich_blocks_order_preserved(self) -> None:
        blocks = [
            ContentBlock("text", "D" * 100),
            ContentBlock("image", None),
            ContentBlock("text", "E" * 100),
        ]
        cfg = _cfg(threshold_chars=80, head_chars=10, tail_chars=5)
        result = prune_content(blocks, config=cfg)
        assert result is not None
        types = [b.type for b in result]
        # 头/尾文本端按原顺序保留;中段图片随省略区整张移除(不可二分)
        assert types == ["text", "text", "text"]
        joined = "".join(b.text or "" for b in result)
        assert joined.startswith("D" * 10)
        assert joined.endswith("E" * 5)

    def test_image_omitted_whole_when_over_budget(self) -> None:
        # 默认桩图片固定 1024,超头/尾预算 → 整张省略,绝不二分留半张
        blocks = [ContentBlock("image", None), ContentBlock("text", "F" * 100)]
        cfg = _cfg(threshold_chars=80, head_chars=10, tail_chars=5)
        outcome = prune_content_with_stats(blocks, config=cfg)
        assert outcome is not None
        assert all(b.type != "image" for b in outcome.blocks)
        assert outcome.stats.omitted_images == 1

    def test_image_retained_whole_never_split(self) -> None:
        def cheap_price(block: ContentBlock) -> int:
            return 1 if block.type == "image" else code_point_length(block.text or "")

        blocks = [
            ContentBlock("image", None, image_url="img-1"),
            ContentBlock("text", "F" * 100),
        ]
        cfg = _cfg(threshold_chars=80, head_chars=10, tail_chars=5)
        outcome = prune_content_with_stats(blocks, config=cfg, price=cheap_price)
        assert outcome is not None
        image = [b for b in outcome.blocks if b.type == "image"]
        assert len(image) == 1
        # 整张保留:定位字段原样带出,不产生半截图片块
        assert image[0].image_url == "img-1"
        assert outcome.stats.omitted_images == 0

    def test_post_condition_smaller(self) -> None:
        text = "G" * 500
        cfg = _cfg(threshold_chars=200, head_chars=20, tail_chars=20)
        result = prune_content([ContentBlock("text", text)], config=cfg)
        assert result is not None
        assert measure_content(result) < 500
        assert measure_content(result) <= cfg.threshold_chars


class TestPriceInjection:
    def test_default_price_text_code_points_image_fixed(self) -> None:
        assert default_price(ContentBlock("text", "abc")) == 3
        assert default_price(ContentBlock("image", None)) == IMAGE_PRICE_DEFAULT
        assert default_price(ContentBlock("tool_call")) == 0

    def test_price_stub_decides_budget(self) -> None:
        blocks = [ContentBlock("text", "x" * 100)]
        cfg = _cfg(threshold_chars=150, head_chars=20, tail_chars=10)
        # 默认桩:100 码点 ≤ 150 → 不裁
        assert prune_content(blocks, config=cfg) is None

        def double_price(block: ContentBlock) -> int:
            return code_point_length(block.text or "") * 2

        # 注入桩:200 > 150 → 裁;证明预算判定走注入的 price,不是内置码点口径
        outcome = prune_content_with_stats(blocks, config=cfg, price=double_price)
        assert outcome is not None


class TestExactOmission:
    def test_omitted_chars_bytes_images_exact(self) -> None:
        text = "中文A" * 30  # 90 码点;每段 2 个 CJK(3 字节)+ A(1 字节)= 7 字节
        blocks = [ContentBlock("text", text), ContentBlock("image", None)]
        cfg = _cfg(threshold_chars=80, head_chars=10, tail_chars=5)
        outcome = prune_content_with_stats(blocks, config=cfg)
        assert outcome is not None
        pieces = [
            b.text or ""
            for b in outcome.blocks
            if b.type == "text" and b.text != PRUNE_MARKER
        ]
        retained_text = "".join(pieces)
        # 按「原始 − 实际保留」反推,不按预算推导
        assert outcome.stats.omitted_chars == len(text) - len(retained_text)
        assert (
            outcome.stats.omitted_bytes
            == len(text.encode("utf-8")) - len(retained_text.encode("utf-8"))
        )
        assert outcome.stats.omitted_images == 1

    def test_binary_search_head_tail_fit_budget(self) -> None:
        text = "a" * 1000
        cfg = _cfg(threshold_chars=200, head_chars=30, tail_chars=10)
        outcome = prune_content_with_stats([ContentBlock("text", text)], config=cfg)
        assert outcome is not None
        pieces = [
            b.text or ""
            for b in outcome.blocks
            if b.type == "text" and b.text != PRUNE_MARKER
        ]
        # 二分拟合单调价格:头/尾各取到预算上限
        assert len(pieces[0]) == 30
        assert len(pieces[1]) == 10


class TestPruneBlocksOverBudget:
    def test_only_over_budget_pruned(self) -> None:
        small = [ContentBlock("text", "tiny")]
        big = [ContentBlock("text", "H" * 500)]
        cfg = _cfg(threshold_chars=80, head_chars=10, tail_chars=5)
        res = prune_blocks_over_budget([small, big], config=cfg)
        assert len(res.pruned) == 1
        assert res.pruned[0].index == 1
        assert res.chars_removed > 0
        entry = res.pruned[0]
        assert entry.omitted_bytes > 0
        assert entry.omitted_images == 0
        assert res.omitted_images == 0

    def test_none_over_budget(self) -> None:
        blocks = [ContentBlock("text", "x")]
        cfg = _cfg(threshold_chars=100, head_chars=10, tail_chars=5)
        res = prune_blocks_over_budget([blocks, blocks], config=cfg)
        assert res.pruned == ()
        assert res.chars_removed == 0


class TestConfigInvariant:
    """2026-11-19:默认值改为对照件 README 的生效值,并把 head+marker+tail<=threshold 立成构造期校验。"""

    def test_defaults_match_evidence(self) -> None:
        assert (DEFAULT_THRESHOLD_CHARS, DEFAULT_HEAD_CHARS, DEFAULT_TAIL_CHARS) == (
            8192,
            4096,
            1024,
        )

    def test_default_config_is_legal(self) -> None:
        cfg = PruneConfig()
        assert cfg.head_chars + cfg.tail_chars + len(PRUNE_MARKER) <= cfg.threshold_chars

    def test_head_plus_tail_over_threshold_rejected(self) -> None:
        with pytest.raises(ValueError):
            PruneConfig(threshold_chars=100, head_chars=3_000, tail_chars=1_000)

    def test_non_positive_threshold_rejected(self) -> None:
        with pytest.raises(ValueError):
            PruneConfig(threshold_chars=0, head_chars=10, tail_chars=5)


if __name__ == "__main__":
    pytest.main([__file__, "-q"])
