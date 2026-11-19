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
    PRUNE_MARKER,
    ContentBlock,
    PruneConfig,
    code_point_length,
    measure_content,
    prune_blocks_over_budget,
    prune_content,
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
        assert len(result) == 1
        out = result[0].text
        assert out.startswith("A" * 10)
        assert out.endswith("A" * 5)
        assert PRUNE_MARKER in out

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
        # 富块 image 仍在中间
        assert types.count("image") == 1
        assert "image" in types

    def test_non_text_block_untouched(self) -> None:
        blocks = [ContentBlock("image", None), ContentBlock("text", "F" * 100)]
        cfg = _cfg(threshold_chars=80, head_chars=10, tail_chars=5)
        result = prune_content(blocks, config=cfg)
        assert result is not None
        img = [b for b in result if b.type == "image"]
        assert len(img) == 1
        assert img[0].text is None

    def test_post_condition_smaller(self) -> None:
        text = "G" * 500
        cfg = _cfg(threshold_chars=200, head_chars=20, tail_chars=20)
        result = prune_content([ContentBlock("text", text)], config=cfg)
        assert result is not None
        assert measure_content(result) < 500
        assert measure_content(result) <= cfg.threshold_chars


class TestPruneBlocksOverBudget:
    def test_only_over_budget_pruned(self) -> None:
        small = [ContentBlock("text", "tiny")]
        big = [ContentBlock("text", "H" * 500)]
        cfg = _cfg(threshold_chars=80, head_chars=10, tail_chars=5)
        res = prune_blocks_over_budget([small, big], config=cfg)
        assert len(res.pruned) == 1
        assert res.pruned[0].index == 1
        assert res.chars_removed > 0

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
