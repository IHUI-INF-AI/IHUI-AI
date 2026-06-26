"""T4: 业务级 SLA 监控 (出箱时延 P50/P95/P99) 单元测试.

覆盖:
- ConnectionManager 暴露 SLA 监控属性
- _record_sla_outbox 累积样本, samples_in_window 增长
- _record_sla_outbox 触发 violation (超过阈值)
- _record_sla_outbox 负数拒绝
- record_sla_e2e 累积 + 触发 violation
- _percentile 边界: 空 / 单元素 / 多元素
- sla_metrics 返回正确分位数 (P50/P95/P99)
- 出箱消费者自动记录时延 (created_at → 实际发送)
- stats() 包含 sla 字段
- 滑动窗口: 超过 sla_window_size 自动丢弃旧样本
"""

from __future__ import annotations

import asyncio
import json
import time
from collections import deque
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

ROOT = Path(__file__).resolve().parent.parent
import sys

sys.path.insert(0, str(ROOT))


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


class FakeWebSocket:
    def __init__(self):
        self.accepted = False
        self.closed = False
        self.sent_texts: list[str] = []
        self.client_state = MagicMock()
        self.client_state.name = "CONNECTED"

    async def accept(self):
        self.accepted = True

    async def send_text(self, text: str) -> None:
        self.sent_texts.append(text)

    async def close(self, code: int = 1000, reason: str = ""):
        self.closed = True


def _reset_cm():
    from app.ws.manager import ConnectionManager

    ConnectionManager._instance = None
    return ConnectionManager()


# ---------------------------------------------------------------------------
# 1. ConnectionManager 暴露 SLA 属性
# ---------------------------------------------------------------------------


class TestSlaAttributes:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_has_outbox_samples(self):
        assert hasattr(self.cm, "sla_outbox_samples")
        assert isinstance(self.cm.sla_outbox_samples, deque)

    def test_has_e2e_samples(self):
        assert hasattr(self.cm, "sla_e2e_samples")
        assert isinstance(self.cm.sla_e2e_samples, deque)

    def test_has_thresholds(self):
        assert self.cm.sla_outbox_p99_threshold_sec > 0
        assert self.cm.sla_e2e_p99_threshold_sec > 0

    def test_has_counters(self):
        for k in (
            "_sla_outbox_violations",
            "_sla_e2e_violations",
            "_sla_outbox_total",
            "_sla_e2e_total",
        ):
            assert hasattr(self.cm, k)
            assert getattr(self.cm, k) == 0

    def test_window_size(self):
        assert self.cm.sla_window_size > 0
        assert self.cm.sla_outbox_samples.maxlen == self.cm.sla_window_size


# ---------------------------------------------------------------------------
# 2. _record_sla_outbox
# ---------------------------------------------------------------------------


class TestRecordSlaOutbox:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_record_basic(self):
        self.cm._record_sla_outbox(0.005)  # 5ms
        self.cm._record_sla_outbox(0.010)  # 10ms
        self.cm._record_sla_outbox(0.020)  # 20ms
        assert len(self.cm.sla_outbox_samples) == 3
        assert self.cm._sla_outbox_total == 3
        assert self.cm._sla_outbox_violations == 0

    def test_record_triggers_violation(self):
        self.cm.sla_outbox_p99_threshold_sec = 0.010  # 10ms
        self.cm._record_sla_outbox(0.050)  # 50ms > 10ms
        assert self.cm._sla_outbox_violations == 1
        assert len(self.cm.sla_outbox_samples) == 1

    def test_record_negative_rejected(self):
        self.cm._record_sla_outbox(-0.1)
        assert len(self.cm.sla_outbox_samples) == 0
        assert self.cm._sla_outbox_total == 0

    def test_record_window_overflow(self):
        """超过窗口大小时, 旧样本自动丢弃 (deque maxlen)."""
        self.cm.sla_window_size = 5
        self.cm.sla_outbox_samples = deque(maxlen=5)
        for i in range(10):
            self.cm._record_sla_outbox(0.001 * (i + 1))
        assert len(self.cm.sla_outbox_samples) == 5
        # total 仍为 10 (不受窗口限制)
        assert self.cm._sla_outbox_total == 10


# ---------------------------------------------------------------------------
# 3. record_sla_e2e
# ---------------------------------------------------------------------------


class TestRecordSlaE2e:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_record_basic(self):
        self.cm.record_sla_e2e("test_label", 0.100)
        self.cm.record_sla_e2e("test_label", 0.200)
        assert len(self.cm.sla_e2e_samples) == 2
        assert self.cm._sla_e2e_total == 2
        assert self.cm._sla_e2e_violations == 0

    def test_record_triggers_violation(self):
        self.cm.sla_e2e_p99_threshold_sec = 0.500
        self.cm.record_sla_e2e("slow_op", 1.0)
        assert self.cm._sla_e2e_violations == 1

    def test_record_negative_rejected(self):
        self.cm.record_sla_e2e("neg", -0.5)
        assert len(self.cm.sla_e2e_samples) == 0
        assert self.cm._sla_e2e_total == 0


# ---------------------------------------------------------------------------
# 4. _percentile
# ---------------------------------------------------------------------------


class TestPercentile:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_empty(self):
        assert self.cm._percentile([], 50) == 0.0
        assert self.cm._percentile([], 99) == 0.0

    def test_single(self):
        assert self.cm._percentile([0.123], 50) == 0.123
        assert self.cm._percentile([0.123], 99) == 0.123

    def test_sorted_samples(self):
        """1, 2, 3, 4, 5 → P50=3, P95≈4.8, P99≈4.96."""
        samples = [0.001, 0.002, 0.003, 0.004, 0.005]
        p50 = self.cm._percentile(samples, 50)
        p95 = self.cm._percentile(samples, 95)
        p99 = self.cm._percentile(samples, 99)
        # P50 (k=2.0): samples[2] = 0.003
        assert abs(p50 - 0.003) < 1e-9
        # P95 (k=3.8): samples[3] + (samples[4]-samples[3])*0.8 = 0.0048
        assert abs(p95 - 0.0048) < 1e-9
        # P99 (k=3.96): ≈ 0.00496
        assert abs(p99 - 0.00496) < 1e-9

    def test_100_samples_p99(self):
        """100 个样本, P99 应该是第 99 个 (0-indexed: 98)."""
        samples = [i * 0.001 for i in range(1, 101)]  # 0.001 ~ 0.100
        p99 = self.cm._percentile(samples, 99)
        # k = 99 * 0.99 = 98.01
        # samples[98] + (samples[99]-samples[98]) * 0.01 = 0.099 + 0.001*0.01 = 0.09901
        assert abs(p99 - 0.09901) < 1e-6


# ---------------------------------------------------------------------------
# 5. sla_metrics 整合
# ---------------------------------------------------------------------------


class TestSlaMetrics:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_sla_metrics_empty(self):
        m = self.cm.sla_metrics()
        assert m["outbox"]["samples_in_window"] == 0
        assert m["outbox"]["p50_ms"] == 0
        assert m["e2e"]["samples_in_window"] == 0

    def test_sla_metrics_with_samples(self):
        # 出箱: 1ms, 5ms, 10ms, 50ms, 100ms
        for ms in (1, 5, 10, 50, 100):
            self.cm._record_sla_outbox(ms / 1000.0)
        # e2e: 200ms, 500ms
        self.cm.record_sla_e2e("test", 0.2)
        self.cm.record_sla_e2e("test", 0.5)
        m = self.cm.sla_metrics()
        # outbox 排序后: [0.001, 0.005, 0.010, 0.050, 0.100]
        assert m["outbox"]["samples_in_window"] == 5
        assert abs(m["outbox"]["p50_ms"] - 10.0) < 0.1
        # P95 (k=3.8): 50 + (100-50)*0.8 = 90
        assert abs(m["outbox"]["p95_ms"] - 90.0) < 0.1
        # e2e
        assert m["e2e"]["samples_in_window"] == 2
        assert abs(m["e2e"]["p50_ms"] - 350.0) < 0.1  # 中位数
        assert m["e2e"]["max_ms"] == 500.0

    def test_sla_metrics_includes_violations(self):
        self.cm.sla_outbox_p99_threshold_sec = 0.010
        self.cm._record_sla_outbox(0.050)
        m = self.cm.sla_metrics()
        assert m["outbox"]["violations"] == 1
        assert m["outbox"]["threshold_p99_ms"] == 10.0


# ---------------------------------------------------------------------------
# 6. 出箱消费者自动记录时延
# ---------------------------------------------------------------------------


class TestOutboxConsumerRecordsSla:
    def setup_method(self):
        self.cm = _reset_cm()

    @pytest.mark.asyncio
    async def test_outbox_consumer_records_sla(self):
        ws = FakeWebSocket()
        await self.cm.connect("c1", ws, user_uuid="u1")
        # mock _publish 避免 redis 阻塞
        async def _noop_publish(channel_suffix, body):
            return None
        self.cm._publish = _noop_publish
        await self.cm.start_background_tasks()
        try:
            # 入队消息, created_at = now
            mid = await self.cm.enqueue_message("user", {"hello": 1}, "u1")
            assert mid is not None
            # 等待消费者取出 + 发送
            await asyncio.sleep(0.2)
            # 应至少有 1 个样本
            assert self.cm._sla_outbox_total >= 1
            m = self.cm.sla_metrics()
            assert m["outbox"]["samples_in_window"] >= 1
            # 时延 < 1s (测试环境)
            assert m["outbox"]["max_ms"] < 1000.0
        finally:
            await self.cm.stop_background_tasks()
            await self.cm.disconnect("c1")


# ---------------------------------------------------------------------------
# 7. stats() 包含 sla 字段
# ---------------------------------------------------------------------------


class TestStatsIncludeSla:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_stats_has_sla(self):
        s = self.cm.stats()
        assert "sla" in s
        assert "outbox" in s["sla"]
        assert "e2e" in s["sla"]


# ---------------------------------------------------------------------------
# 8. 大样本 P99 精度
# ---------------------------------------------------------------------------


class TestLargeSamplePercentile:
    def setup_method(self):
        self.cm = _reset_cm()

    def test_1000_samples_uniform(self):
        """1000 个均匀样本, P50/P95/P99 数值应稳定."""
        # 模拟真实场景: 50% < 50ms, 95% < 500ms, 99% < 550ms
        samples = []
        for i in range(1000):
            if i < 500:
                samples.append(0.001 * (i + 1))  # 1-500ms (0.001 - 0.500s)
            elif i < 950:
                samples.append(0.050 + 0.001 * (i - 500))  # 50-500ms (0.050 - 0.499s)
            else:
                samples.append(0.500 + 0.001 * (i - 950))  # 500-550ms (0.500 - 0.549s)
        for s in samples:
            self.cm._record_sla_outbox(s)
        m = self.cm.sla_metrics()
        # P50 (k=499.5): 排序后第 500 个 = 0.500
        assert 250 < m["outbox"]["p50_ms"] < 550
        # P95 (k=949.05): 排序后第 950 个附近 = 500ms
        assert 480 < m["outbox"]["p95_ms"] < 520
        # P99 (k=989.01): 排序后第 990 个附近 = 500+39ms = 539ms
        assert 510 < m["outbox"]["p99_ms"] < 560
        # 平均
        assert 0 < m["outbox"]["avg_ms"] < 1000
