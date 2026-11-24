# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""spill_retention 单测 — 钉住头尾保留 + 图片不可分割 + 二分适配 + 溢出统计。"""

from __future__ import annotations

from app.services.spill_retention import (
    RetainableBlock,
    fit_text,
    retain_content,
    text_slice,
)


def _price(block: RetainableBlock) -> int:
    """价格 = 文本字节数（图片整块固定 10）。"""
    if block.type == "image":
        return 10
    return len((block.text or "").encode("utf-8"))


class TestTextSlice:
    def test_head(self) -> None:
        assert text_slice("hello", 3, tail=False) == "hel"

    def test_tail(self) -> None:
        assert text_slice("hello", 2, tail=True) == "lo"

    def test_over_length_clamped(self) -> None:
        assert text_slice("hi", 10, tail=False) == "hi"
        assert text_slice("hi", 10, tail=True) == "hi"

    def test_zero(self) -> None:
        assert text_slice("abc", 0, tail=False) == ""
        assert text_slice("abc", 0, tail=True) == ""


class TestFitText:
    def test_fits_budget(self) -> None:
        t = "a" * 100
        got = fit_text(t, 50, tail=False, price=_price)
        assert len(got) == 50

    def test_zero_budget(self) -> None:
        assert fit_text("abc", 0, tail=False, price=_price) == ""


class TestRetainContent:
    def test_all_fits(self) -> None:
        content = [RetainableBlock("text", "hello")]
        r = retain_content(content, budget=100, price=_price)
        assert r.head == (RetainableBlock("text", "hello"),)
        assert r.tail == ()
        assert r.omitted_bytes == 0
        assert r.omitted_images == 0

    def test_head_tail_split(self) -> None:
        # budget=20 → 头10 尾10; 一个 100 字符文本块
        content = [RetainableBlock("text", "x" * 100)]
        r = retain_content(content, budget=20, price=_price)
        head_text = "".join(b.text or "" for b in r.head)
        tail_text = "".join(b.text or "" for b in r.tail)
        assert len(head_text) == 10
        assert len(tail_text) == 10
        # 溢出 = 总字节 - 保留字节
        assert r.omitted_bytes == 100 - 20

    def test_image_indivisible(self) -> None:
        # 图片固定 10; budget=15 → 头分 8(ceil), 图片10>8 → 头空; 尾分 7 → 空
        content = [RetainableBlock("image", None)]
        r = retain_content(content, budget=15, price=_price)
        assert len(r.head) == 0
        assert len(r.tail) == 0
        assert r.omitted_images == 1

    def test_image_fits_when_budget_allows(self) -> None:
        content = [RetainableBlock("image", None)]
        r = retain_content(content, budget=20, price=_price)
        # 头分 ceil(20/2)=10, 图片10<=10 → 保留在头
        assert len(r.head) == 1
        assert r.omitted_images == 0

    def test_mixed_text_image(self) -> None:
        content = [
            RetainableBlock("text", "a" * 30),
            RetainableBlock("image", None),
            RetainableBlock("text", "b" * 30),
        ]
        # budget 大到全保留
        r = retain_content(content, budget=1000, price=_price)
        assert len(r.head) == 3
        assert r.omitted_images == 0

    def test_middle_dropped_on_tight_budget(self) -> None:
        content = [
            RetainableBlock("text", "a" * 20),
            RetainableBlock("text", "b" * 20),
            RetainableBlock("text", "c" * 20),
        ]
        # budget=30 → 头15 尾15, 中间整块溢出
        r = retain_content(content, budget=30, price=_price)
        assert r.omitted_bytes > 0
        kept = len(r.head) + len(r.tail)
        assert kept < 3


if __name__ == "__main__":
    import pytest as _p

    _p.main([__file__, "-q"])
