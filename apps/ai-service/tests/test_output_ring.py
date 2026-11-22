# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""OutputRing 判据测试(2026-11-23 P0-5)。

钉住的四件事:
  1. 绝对偏移:写入只增,读取一律按绝对区间,窗口外读**标 lossy 不静默变空**;
  2. head 保留:开头永不被丢,尾部按容量滚动,丢弃数与标记逐条可断言;
  3. 双游标:read 是纯函数,模型侧推进自己的游标、观察者另读互不影响;
  4. 结算 first-wins:四态封闭集,第二次结算只回第一次结论。
"""

from __future__ import annotations

import re

import pytest

from app.services.output_ring import OutputRing

# ---------------------------------------------------------------------------
# 1. 绝对偏移与增量读取
# ---------------------------------------------------------------------------


def test_append_then_read_returns_window_from_absolute_offset() -> None:
    ring = OutputRing(max_chars=100)
    ring.append("abc")
    first = ring.read(0)
    assert first.text == "abc"
    assert first.next_offset == 3
    assert first.lossy is False


def test_incremental_read_only_returns_new_tail() -> None:
    ring = OutputRing(max_chars=100)
    ring.append("line-1\n")
    ring.read(0)
    ring.append("line-2\n")
    second = ring.read(7)
    assert second.text == "line-2\n"
    assert second.next_offset == 14


def test_read_is_pure_and_does_not_move_internal_cursor() -> None:
    ring = OutputRing(max_chars=100)
    ring.append("alpha")
    assert ring.read(0).text == ring.read(0).text == "alpha"
    assert ring.total_written == 5


def test_total_written_is_monotonic_even_when_ring_drops() -> None:
    ring = OutputRing(max_chars=5)
    ring.append("1234567890")
    assert ring.total_written == 10
    ring.append("!")
    assert ring.total_written == 11


# ---------------------------------------------------------------------------
# 2. 有界窗口 / head 保留 / lossy
# ---------------------------------------------------------------------------


def test_overflow_drops_oldest_and_flags_lossy() -> None:
    ring = OutputRing(max_chars=5)
    ring.append("abcdefghij")
    assert ring.dropped_chars == 5
    assert ring.earliest_offset == 5
    read = ring.read(0)
    assert read.lossy is True
    assert read.dropped_chars == 5
    assert read.text == "fghij"


def test_head_is_never_dropped() -> None:
    ring = OutputRing(max_chars=10, head_chars=4)
    ring.append("ABCDEFGHIJKLMNOP")  # 16 字符,尾部容量 6
    assert ring.dropped_chars == 6
    read = ring.read(0)
    # 开头拿得到(中段有洞 ⇒ 仍标 lossy,不冒充"完整")
    assert read.text.startswith("ABCD")
    assert read.lossy is True
    assert read.dropped_chars == 6


def test_reading_below_earliest_falls_back_to_window_start() -> None:
    ring = OutputRing(max_chars=6)
    ring.append("0123456789")
    read = ring.read(2)
    assert read.lossy is True
    assert read.dropped_chars == 2  # earliest=4,从 2 起丢了 2 个
    assert read.text == "456789"


def test_snapshot_carries_dropped_marker() -> None:
    ring = OutputRing(max_chars=10, head_chars=4)
    ring.append("HEAD" + "x" * 20)
    snap = ring.snapshot()
    assert snap.startswith("HEAD")
    assert re.search(r"中间丢弃 \d+ 字符", snap)


# ---------------------------------------------------------------------------
# 3. 边界与参数
# ---------------------------------------------------------------------------


def test_limit_caps_text_and_advances_next_offset() -> None:
    ring = OutputRing(max_chars=100)
    ring.append("abcdef")
    read = ring.read(0, limit=3)
    assert read.text == "abc"
    assert read.next_offset == 3


def test_from_offset_beyond_total_clamps_to_empty() -> None:
    ring = OutputRing(max_chars=100)
    ring.append("abc")
    read = ring.read(99)
    assert read.text == ""
    assert read.next_offset == 3


def test_negative_offset_rejected() -> None:
    ring = OutputRing(max_chars=100)
    with pytest.raises(ValueError):
        ring.read(-1)


@pytest.mark.parametrize(
    ("max_chars", "head_chars"),
    [(0, 0), (-5, 0), (10, -1), (10, 11)],
)
def test_invalid_constructor_args_rejected(max_chars: int, head_chars: int) -> None:
    with pytest.raises(ValueError):
        OutputRing(max_chars=max_chars, head_chars=head_chars)


def test_unicode_counts_by_character_not_bytes() -> None:
    ring = OutputRing(max_chars=4)
    ring.append("中文🙂测试")  # 5 个字符
    assert ring.dropped_chars == 1
    assert ring.read(1).text == "文🙂测试"


# ---------------------------------------------------------------------------
# 4. 结算(四态 + first-wins)
# ---------------------------------------------------------------------------


def test_settle_ok_when_nothing_dropped() -> None:
    ring = OutputRing(max_chars=10)
    ring.append("abc")
    settlement = ring.settle()
    assert settlement.status == "ok"
    assert settlement.dropped_chars == 0
    assert settlement.already_settled is False
    assert ring.settled is True


def test_settle_truncated_when_dropped() -> None:
    ring = OutputRing(max_chars=4)
    ring.append("abcdefgh")
    settlement = ring.settle()
    assert settlement.status == "truncated"
    assert settlement.dropped_chars == 4


def test_settle_pipe_unavailable_beats_truncated() -> None:
    ring = OutputRing(max_chars=4)
    ring.append("abcdefgh")
    settlement = ring.settle(pipe_unavailable=True)
    assert settlement.status == "pipe_unavailable"


def test_settle_timeout_when_not_pipe_unavailable() -> None:
    ring = OutputRing(max_chars=10)
    settlement = ring.settle(timed_out=True)
    assert settlement.status == "timeout"


def test_settle_is_first_wins_and_second_call_reports_already() -> None:
    ring = OutputRing(max_chars=10)
    ring.append("abc")
    first = ring.settle()
    second = ring.settle(pipe_unavailable=True)
    assert first.status == "ok"
    assert second.status == "ok"
    assert second.already_settled is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
