"""Phase 13 建议 4 测试: LLM 流式重试 + 背压 + 自适应分块."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

import alert_llm_stream_retry  # 用此模块持有的 alert_llm_summary 引用, 避免 sys.modules 重载干扰
from alert_llm_stream import LruTtlCache
from alert_llm_stream_retry import (
    AdaptiveChunkSizer,
    _chunk_text_adaptive,
    _compute_backoff_delay,
    _is_disconnected_sync,
    call_with_retry,
    stream_summary_v2,
)


def _patched_summarize_attr():
    """返回真正被 stream_summary_v2 使用的 alert_llm_summary 模块对象."""
    return alert_llm_stream_retry.alert_llm_summary


# ---------------------------------------------------------------------------
# _compute_backoff_delay
# ---------------------------------------------------------------------------


class TestBackoff:
    def test_first_attempt(self):
        d = _compute_backoff_delay(0, base_delay=1.0, multiplier=2.0, jitter=False)
        assert d == 1.0

    def test_exponential_growth(self):
        d1 = _compute_backoff_delay(1, base_delay=1.0, multiplier=2.0, jitter=False)
        d2 = _compute_backoff_delay(2, base_delay=1.0, multiplier=2.0, jitter=False)
        assert d1 == 2.0
        assert d2 == 4.0

    def test_max_delay_cap(self):
        d = _compute_backoff_delay(10, base_delay=1.0, max_delay=5.0, multiplier=2.0, jitter=False)
        assert d == 5.0

    def test_jitter_in_range(self):
        for _ in range(20):
            d = _compute_backoff_delay(0, base_delay=2.0, jitter=True)
            assert 1.0 <= d <= 3.0  # 0.5x~1.5x of 2.0


# ---------------------------------------------------------------------------
# call_with_retry
# ---------------------------------------------------------------------------


class TestCallWithRetry:
    def test_success_no_retry(self):
        calls = []

        def fn():
            calls.append(1)
            return "ok"

        result = call_with_retry(fn, max_retries=3, base_delay=0.0)
        assert result == "ok"
        assert len(calls) == 1

    def test_retry_then_success(self):
        calls = []

        def fn():
            calls.append(1)
            if len(calls) < 3:
                raise ConnectionError("transient")
            return "ok"

        retries = []

        def on_retry(attempt, exc, delay):
            retries.append((attempt, type(exc).__name__))

        result = call_with_retry(
            fn,
            max_retries=3,
            base_delay=0.0,
            retryable_exceptions=(ConnectionError,),
            on_retry=on_retry,
        )
        assert result == "ok"
        assert len(calls) == 3
        assert len(retries) == 2
        assert retries[0][0] == 0
        assert retries[0][1] == "ConnectionError"

    def test_retry_exhausted_raises(self):
        def fn():
            raise ConnectionError("never")

        with pytest.raises(ConnectionError):
            call_with_retry(fn, max_retries=2, base_delay=0.0, retryable_exceptions=(ConnectionError,))

    def test_non_retryable_not_retried(self):
        calls = []

        def fn():
            calls.append(1)
            raise ValueError("fatal")

        with pytest.raises(ValueError):
            call_with_retry(
                fn,
                max_retries=3,
                base_delay=0.0,
                retryable_exceptions=(ConnectionError,),
            )
        assert len(calls) == 1

    def test_no_retry_when_max_retries_zero(self):
        calls = []

        def fn():
            calls.append(1)
            raise ConnectionError("x")

        with pytest.raises(ConnectionError):
            call_with_retry(fn, max_retries=0, base_delay=0.0, retryable_exceptions=(ConnectionError,))
        assert len(calls) == 1

    def test_exponential_delays_applied(self, monkeypatch):
        sleeps = []
        monkeypatch.setattr("alert_llm_stream_retry.time.sleep", lambda s: sleeps.append(s))

        def fn():
            raise ConnectionError("x")

        with pytest.raises(ConnectionError):
            call_with_retry(
                fn,
                max_retries=3,
                base_delay=0.1,
                multiplier=2.0,
                max_delay=10.0,
                jitter=False,
                retryable_exceptions=(ConnectionError,),
            )
        # 3 次失败应 sleep 3 次 (因为 max_retries=3 包含首次)
        # 实际: attempt 0 失败 → sleep; attempt 1 失败 → sleep; attempt 2 失败 → sleep; attempt 3 失败 → 不 sleep
        assert len(sleeps) == 3
        assert sleeps[0] == pytest.approx(0.1)
        assert sleeps[1] == pytest.approx(0.2)
        assert sleeps[2] == pytest.approx(0.4)


# ---------------------------------------------------------------------------
# AdaptiveChunkSizer
# ---------------------------------------------------------------------------


class TestAdaptiveChunkSizer:
    def test_initial_size(self):
        s = AdaptiveChunkSizer(initial_size=2, max_size=16)
        assert s.next_size() == 2

    def test_growth_after_n_sends(self):
        s = AdaptiveChunkSizer(initial_size=2, max_size=16, growth_factor=2.0)
        for _ in range(3):
            s.on_send()
        assert s.next_size() == 2  # 第 4 次才触发
        s.on_send()  # 第 4 次
        assert s.next_size() == 4  # 2 * 2 = 4

    def test_growth_capped(self):
        s = AdaptiveChunkSizer(initial_size=1, max_size=4, growth_factor=10.0)
        for _ in range(4):
            s.on_send()
        assert s.next_size() <= 4

    def test_shrink(self):
        s = AdaptiveChunkSizer(initial_size=1, max_size=64, growth_factor=2.0)
        for _ in range(8):
            s.on_send()
        big = s.next_size()
        s.shrink()
        small = s.next_size()
        assert small < big
        assert small >= s.initial_size

    def test_reset(self):
        s = AdaptiveChunkSizer(initial_size=1, max_size=64, growth_factor=2.0)
        for _ in range(8):
            s.on_send()
        s.reset()
        assert s.next_size() == 1
        assert s.consecutive_sends == 0

    def test_invalid_params(self):
        with pytest.raises(ValueError):
            AdaptiveChunkSizer(initial_size=0)
        with pytest.raises(ValueError):
            AdaptiveChunkSizer(initial_size=5, max_size=3)
        with pytest.raises(ValueError):
            AdaptiveChunkSizer(growth_factor=1.0)


class TestChunkTextAdaptive:
    def test_chunks_cover_full_text(self):
        s = AdaptiveChunkSizer(initial_size=2, max_size=8, growth_factor=2.0)
        text = "abcdefghij"  # 10 字符
        chunks = [c for _, c in _chunk_text_adaptive(text, s)]
        assert "".join(chunks) == text

    def test_chunk_count_less_than_char_count(self):
        s = AdaptiveChunkSizer(initial_size=1, max_size=64, growth_factor=2.0)
        text = "x" * 20
        chunks = [c for _, c in _chunk_text_adaptive(text, s)]
        # 初始 1, 第 4 次后变 2, 第 8 次后变 4
        # 1*4 + 2*4 + 4*4 = 28 > 20
        # 所以应该 4 个 1, 4 个 2, 3 个 4 = 11 块
        assert len(chunks) <= 11
        assert "".join(chunks) == text


# ---------------------------------------------------------------------------
# _is_disconnected_sync
# ---------------------------------------------------------------------------


class TestIsDisconnected:
    def test_none_callback(self):
        assert _is_disconnected_sync(None) is False

    def test_sync_callback_true(self):
        assert _is_disconnected_sync(lambda: True) is True

    def test_sync_callback_false(self):
        assert _is_disconnected_sync(lambda: False) is False

    def test_callback_exception(self):
        def bad():
            raise RuntimeError("x")

        # 异常不应冒泡, 应返回 False
        assert _is_disconnected_sync(bad) is False


# ---------------------------------------------------------------------------
# stream_summary_v2 集成
# ---------------------------------------------------------------------------


def _sample_alert():
    return {
        "alertname": "HighErrorRate",
        "severity": "critical",
        "service": "zhs-platform-api",
        "summary": "5xx 错误率 12%",
        "labels": {"region": "cn-east-1"},
    }


@pytest.fixture(autouse=True)
def _clear_default_cache():
    """每个测试前清空默认缓存, 避免测试间干扰."""
    from alert_llm_stream import _DEFAULT_CACHE

    _DEFAULT_CACHE.clear()
    yield
    _DEFAULT_CACHE.clear()


class TestStreamSummaryV2:
    def test_basic_stream(self):
        cache = LruTtlCache()
        events = list(stream_summary_v2(_sample_alert(), force_mock=True, cache=cache, delay_ms=0))
        assert any(e["event"] == "data" for e in events)
        assert any(e["event"] == "done" for e in events)
        done_data = json.loads([e for e in events if e["event"] == "done"][0]["data"])
        assert done_data["cached"] is False

    def test_cache_hit_short_circuit(self):
        cache = LruTtlCache()
        # 首次
        list(stream_summary_v2(_sample_alert(), force_mock=True, cache=cache, delay_ms=0))
        # 再次
        events = list(stream_summary_v2(_sample_alert(), force_mock=True, cache=cache, delay_ms=0))
        assert events[0]["event"] == "cache_hit"
        assert events[1]["event"] == "done"
        done_data = json.loads(events[1]["data"])
        assert done_data["cached"] is True

    def test_retry_on_transient_error(self):
        """LLM 第一次失败, 第二次成功."""
        call_count = [0]
        cache = LruTtlCache()

        def fake_summarize(alert, force_mock=False):
            call_count[0] += 1
            if call_count[0] == 1:
                raise ConnectionError("transient")
            return "retry-success-summary"

        with patch.object(_patched_summarize_attr(), "summarize_alert", side_effect=fake_summarize):
            events = list(
                stream_summary_v2(
                    _sample_alert(),
                    force_mock=True,
                    cache=cache,
                    delay_ms=0,
                    max_retries=2,
                    base_delay=0.0,
                )
            )
        assert call_count[0] == 2
        # 应有 data + done
        done_data = json.loads([e for e in events if e["event"] == "done"][0]["data"])
        assert done_data["summary"] == "retry-success-summary"

    def test_retry_exhausted_yields_error(self):
        cache = LruTtlCache()

        def fake_summarize(alert, force_mock=False):
            raise ConnectionError("always")

        with patch.object(_patched_summarize_attr(), "summarize_alert", side_effect=fake_summarize):
            events = list(
                stream_summary_v2(
                    _sample_alert(),
                    force_mock=True,
                    cache=cache,
                    delay_ms=0,
                    max_retries=2,
                    base_delay=0.0,
                )
            )
        assert any(e["event"] == "error" for e in events)
        assert not any(e["event"] == "done" for e in events)

    def test_non_retryable_error_yields_error_immediately(self):
        cache = LruTtlCache()
        call_count = [0]

        def fake_summarize(alert, force_mock=False):
            call_count[0] += 1
            raise ValueError("fatal")

        with patch.object(_patched_summarize_attr(), "summarize_alert", side_effect=fake_summarize):
            events = list(
                stream_summary_v2(
                    _sample_alert(),
                    force_mock=True,
                    cache=cache,
                    delay_ms=0,
                    max_retries=3,
                    base_delay=0.0,
                    retryable_exceptions=(ConnectionError,),
                )
            )
        assert call_count[0] == 1
        assert any(e["event"] == "error" for e in events)

    def test_client_disconnect_stops_stream(self):
        cache = LruTtlCache()

        # 用一个长文本
        def fake_summarize(alert, force_mock=False):
            return "x" * 100

        disconnected = [False]

        def is_done():
            return disconnected[0]

        with patch.object(_patched_summarize_attr(), "summarize_alert", side_effect=fake_summarize):
            events = []
            for ev in stream_summary_v2(
                _sample_alert(),
                force_mock=True,
                cache=cache,
                delay_ms=0,
                chunk_size=4,
                is_disconnected=is_done,
            ):
                events.append(ev)
                # 收到 2 个 data 后断开
                if len([e for e in events if e["event"] == "data"]) >= 2:
                    disconnected[0] = True

        # 必有 disconnected 事件
        assert any(e["event"] == "disconnected" for e in events)
        # 不应有 done (因为提前断开)
        assert not any(e["event"] == "done" for e in events)

    def test_adaptive_chunks(self):
        cache = LruTtlCache()

        def fake_summarize(alert, force_mock=False):
            return "y" * 50

        with patch.object(_patched_summarize_attr(), "summarize_alert", side_effect=fake_summarize):
            events = list(
                stream_summary_v2(
                    _sample_alert(),
                    force_mock=True,
                    cache=cache,
                    delay_ms=0,
                    adaptive=True,
                    adaptive_initial=1,
                    adaptive_max=8,
                    adaptive_growth=2.0,
                )
            )
        data_events = [e for e in events if e["event"] == "data"]
        assert len(data_events) > 0
        # 自适应分块, 早期块小, 后期块大
        first_chunk = json.loads(data_events[0]["data"])["chunk"]
        # first chunk size should be 1
        assert len(first_chunk) == 1

    def test_on_retry_callback(self):
        cache = LruTtlCache()
        call_count = [0]
        retry_log = []

        def fake_summarize(alert, force_mock=False):
            call_count[0] += 1
            if call_count[0] < 3:
                raise ConnectionError("x")
            return "ok"

        def on_retry(attempt, exc, delay):
            retry_log.append((attempt, type(exc).__name__, delay))

        with patch.object(_patched_summarize_attr(), "summarize_alert", side_effect=fake_summarize):
            list(
                stream_summary_v2(
                    _sample_alert(),
                    force_mock=True,
                    cache=cache,
                    delay_ms=0,
                    max_retries=3,
                    base_delay=0.0,
                    on_retry=on_retry,
                )
            )
        assert len(retry_log) == 2
        assert retry_log[0][0] == 0
        assert retry_log[0][1] == "ConnectionError"

    def test_no_retry_when_max_retries_zero(self):
        cache = LruTtlCache()
        call_count = [0]

        def fake_summarize(alert, force_mock=False):
            call_count[0] += 1
            raise ConnectionError("x")

        with patch.object(_patched_summarize_attr(), "summarize_alert", side_effect=fake_summarize):
            events = list(
                stream_summary_v2(
                    _sample_alert(),
                    force_mock=True,
                    cache=cache,
                    delay_ms=0,
                    max_retries=0,
                    base_delay=0.0,
                )
            )
        assert call_count[0] == 1
        assert any(e["event"] == "error" for e in events)
