# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B1-11 OTel 日志通道判据(2026-11-23)。

不启动任何 OTel SDK:全部用 fake exporter 与显式界驱动,判据与常量都 import 自生产模块
(§22c 测试不复制判据字面量)。
"""

from __future__ import annotations

import pytest

from app.services.otel_log_channels import (
    LOG_FLUSH_MAX_BYTES,
    LOG_FLUSH_MAX_RECORDS,
    BatchReason,
    ChannelState,
    LogChannel,
    build_batch,
    disabled_channel,
    encode_size,
    should_flush,
)


def test_empty_batch_is_not_a_flush() -> None:
    plan = build_batch([])
    assert plan.reason is BatchReason.EMPTY
    assert plan.send == ()
    assert plan.dropped_records == 0
    assert plan.ok is False


def test_fits_sends_all_records() -> None:
    plan = build_batch(["a", "b", "c"])
    assert plan.reason is BatchReason.FITS
    assert plan.send == ("a", "b", "c")
    assert plan.dropped_records == 0
    assert plan.ok is True


def test_records_capped_counts_every_remaining_record() -> None:
    plan = build_batch(["r0", "r1", "r2", "r3"], max_records=2)
    assert plan.reason is BatchReason.RECORDS_CAPPED
    assert plan.send == ("r0", "r1")
    assert plan.dropped_records == 2
    assert plan.dropped_bytes == encode_size("r2") + encode_size("r3")


def test_bytes_capped_truncates_at_first_overflow() -> None:
    plan = build_batch(["x" * 100, "y" * 100], max_bytes=150)
    assert plan.reason is BatchReason.BYTES_CAPPED
    assert plan.send == ("x" * 100,)
    assert plan.dropped_records == 1
    assert plan.dropped_bytes == 100


def test_utf8_multibyte_is_measured_in_bytes_not_chars() -> None:
    block = "中" * 10  # 30 bytes / 10 chars
    assert encode_size(block) == 30
    plan = build_batch([block, block], max_bytes=40)
    assert plan.send == (block,)
    assert plan.dropped_records == 1


def test_single_record_over_limit_is_dropped_not_sent_partially() -> None:
    plan = build_batch(["0123456789"], max_bytes=5)
    assert plan.send == ()
    assert plan.dropped_records == 1
    assert plan.dropped_bytes == 10
    assert plan.reason is BatchReason.BYTES_CAPPED


def test_invalid_bounds_raise() -> None:
    with pytest.raises(ValueError):
        build_batch(["a"], max_records=0)
    with pytest.raises(ValueError):
        build_batch(["a"], max_bytes=-1)


def test_should_flush_covers_three_limits() -> None:
    assert should_flush(pending_records=0, pending_bytes=0, age_s=999) is False
    assert should_flush(pending_records=LOG_FLUSH_MAX_RECORDS, pending_bytes=0, age_s=0) is True
    assert should_flush(pending_records=1, pending_bytes=LOG_FLUSH_MAX_BYTES, age_s=0) is True
    assert should_flush(pending_records=1, pending_bytes=1, age_s=10.0) is True
    assert should_flush(pending_records=1, pending_bytes=1, age_s=9.9) is False
    # 非法输入不 flush(宁可等下一拍,也不把半批发出去)
    assert should_flush(pending_records=-1, pending_bytes=0, age_s=999) is False


def test_channel_is_enabled_after_successful_flush() -> None:
    sent: list[list[str]] = []
    channel = LogChannel(exporter=sent.append)
    channel.emit("a")
    channel.emit("b")
    assert channel.state() is ChannelState.ENABLED
    plan = channel.flush()
    assert plan.reason is BatchReason.FITS
    assert sent == [["a", "b"]]
    assert channel.stats.sent_records == 2
    assert channel.stats.sent_batches == 1


def test_channel_turns_saturated_after_a_capped_flush() -> None:
    sent: list[list[str]] = []
    channel = LogChannel(exporter=sent.append)
    for index in range(LOG_FLUSH_MAX_RECORDS + 3):
        channel.emit(f"r{index}")
    channel.flush()
    assert channel.stats.dropped_records == 3
    assert channel.state() is ChannelState.SATURATED


def test_channel_without_exporter_is_unjudged_and_never_throws() -> None:
    channel = LogChannel(exporter=None)
    channel.emit("x")
    plan = channel.flush()
    assert plan.reason is BatchReason.FITS
    assert channel.state() is ChannelState.UNJUDGED
    assert channel.stats.failures == 1
    assert channel.stats.dropped_records == 1


def test_exporter_failure_is_counted_not_raised() -> None:
    def boom(_: list[str]) -> None:
        raise RuntimeError("transport down")

    channel = LogChannel(exporter=boom)
    channel.emit("a")
    plan = channel.flush()
    assert plan.send == ("a",)
    assert channel.state() is ChannelState.UNJUDGED
    assert channel.stats.failures == 1
    assert channel.stats.dropped_records == 1
    assert channel.stats.dropped_bytes == 1


def test_flush_clears_pending_even_on_failure() -> None:
    def boom(_: list[str]) -> None:
        raise RuntimeError("transport down")

    channel = LogChannel(exporter=boom)
    for index in range(5):
        channel.emit(f"r{index}")
    before = channel.pending_records
    assert before == 5
    channel.flush()
    assert channel.pending_records == 0, "失败还留着待发区会无限涨"


def test_disabled_channel_reports_disabled_state() -> None:
    channel = disabled_channel()
    channel.emit("x")
    channel.flush()
    assert channel.state() is ChannelState.DISABLED
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
