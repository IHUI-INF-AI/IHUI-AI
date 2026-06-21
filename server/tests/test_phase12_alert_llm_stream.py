"""Phase 12 建议 4: LLM 摘要 SSE 流式 + LRU 缓存 验证."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))


@pytest.fixture()
def st():
    """import alert_llm_stream 模块."""
    if "alert_llm_stream" in sys.modules:
        del sys.modules["alert_llm_stream"]
    if "alert_llm_summary" in sys.modules:
        del sys.modules["alert_llm_summary"]
    import alert_llm_stream

    # 清空默认缓存
    alert_llm_stream.get_default_cache().clear()
    return alert_llm_stream


@pytest.fixture()
def clean_env(monkeypatch):
    """清掉 LLM 环境."""
    monkeypatch.delenv("ZHS_LLM_API_KEY", raising=False)
    monkeypatch.delenv("ZHS_LLM_API_BASE", raising=False)
    monkeypatch.delenv("ZHS_LLM_MOCK", raising=False)


# ---------------------------------------------------------------------------
# LRU 缓存
# ---------------------------------------------------------------------------


def test_lru_cache_set_get(st):
    """set/get 必正常."""
    c = st.LruTtlCache(max_size=10, ttl_seconds=60)
    c.set("k1", "v1")
    assert c.get("k1") == "v1"
    assert c.get("nonexistent") is None


def test_lru_cache_ttl_expiry(st):
    """TTL 过期必返回 None."""
    c = st.LruTtlCache(max_size=10, ttl_seconds=0.1)
    c.set("k1", "v1")
    assert c.get("k1") == "v1"
    time.sleep(0.2)
    assert c.get("k1") is None


def test_lru_cache_max_size_eviction(st):
    """超 max_size 必弹出最旧 (FIFO)."""
    c = st.LruTtlCache(max_size=3, ttl_seconds=60)
    c.set("k1", "v1")
    c.set("k2", "v2")
    c.set("k3", "v3")
    c.set("k4", "v4")  # 触发淘汰
    assert c.get("k1") is None  # 最旧被淘汰
    assert c.get("k2") == "v2"
    assert c.get("k3") == "v3"
    assert c.get("k4") == "v4"


def test_lru_cache_lru_order(st):
    """get 必把键移到末尾 (LRU)."""
    c = st.LruTtlCache(max_size=3, ttl_seconds=60)
    c.set("k1", "v1")
    c.set("k2", "v2")
    c.set("k3", "v3")
    c.get("k1")  # k1 移到末尾
    c.set("k4", "v4")  # k2 必被淘汰
    assert c.get("k2") is None
    assert c.get("k1") == "v1"
    assert c.get("k3") == "v3"


def test_lru_cache_clear(st):
    """clear 必清空."""
    c = st.LruTtlCache()
    c.set("k1", "v1")
    c.set("k2", "v2")
    assert len(c) == 2
    c.clear()
    assert len(c) == 0


def test_lru_cache_len(st):
    """__len__ 必正确."""
    c = st.LruTtlCache()
    assert len(c) == 0
    c.set("k1", "v1")
    c.set("k2", "v2")
    assert len(c) == 2


# ---------------------------------------------------------------------------
# 缓存键
# ---------------------------------------------------------------------------


def test_cache_key_stable_for_same_alert(st):
    """同 alert 必生成同 key."""
    alert = {"alertname": "X", "severity": "y", "service": "z", "labels": {"region": "r"}}
    k1 = st.cache_key(alert)
    k2 = st.cache_key(alert)
    assert k1 == k2


def test_cache_key_differs_for_diff_alert(st):
    """不同 alert 必生成不同 key."""
    a1 = {"alertname": "X", "severity": "y"}
    a2 = {"alertname": "X", "severity": "z"}  # severity 不同
    assert st.cache_key(a1) != st.cache_key(a2)


def test_cache_key_ignores_ts_and_ip(st):
    """ts/client_ip/ttl 变化不改变 cache key."""
    a1 = {"alertname": "X", "ts": "2026-06-16T00:00:00Z", "client_ip": "1.1.1.1"}
    a2 = {"alertname": "X", "ts": "2026-06-17T00:00:00Z", "client_ip": "2.2.2.2"}
    assert st.cache_key(a1) == st.cache_key(a2)


def test_cache_key_considers_region_and_tenant(st):
    """labels.region/tenant 必影响 cache key."""
    a1 = {"alertname": "X", "labels": {"region": "r1"}}
    a2 = {"alertname": "X", "labels": {"region": "r2"}}
    assert st.cache_key(a1) != st.cache_key(a2)


# ---------------------------------------------------------------------------
# 缓存版摘要
# ---------------------------------------------------------------------------


def test_summarize_cached_uses_cache(st, clean_env):
    """同 alert 第二次必命中缓存."""
    alert = {"alertname": "HighErrorRate", "service": "x", "severity": "y", "labels": {"region": "r"}}
    s1 = st.summarize_alert_cached(alert, force_mock=True)
    s2 = st.summarize_alert_cached(alert, force_mock=True)
    assert s1 == s2
    # 缓存必已写入
    key = st.cache_key(alert)
    assert st.get_default_cache().get(key) == s1


def test_summarize_cached_skips_llm_on_hit(st, clean_env):
    """命中缓存必不调 LLM (用 patch 强制启用真 API 路径, 验证未调用)."""
    import alert_llm_summary

    alert = {"alertname": "X", "service": "y", "severity": "z", "labels": {"region": "r"}}
    # 预热缓存 (force_mock=True, 写默认缓存)
    st.summarize_alert_cached(alert, force_mock=True)
    assert st.get_default_cache().get(st.cache_key(alert)) is not None

    # 第二次调用, 模拟有 API key 但 force_mock=False → 走真 API
    # patch alert_llm_summary._call_openai_compatible, 验证未被调用
    call_count = {"n": 0}
    original = alert_llm_summary._call_openai_compatible

    def counting_call(*a, **kw):
        call_count["n"] += 1
        return original(*a, **kw)

    with patch.object(alert_llm_summary, "_call_openai_compatible", side_effect=counting_call):
        os.environ["ZHS_LLM_API_KEY"] = "fake-key"
        try:
            s = st.summarize_alert_cached(alert)  # force_mock 默认 False
        finally:
            os.environ.pop("ZHS_LLM_API_KEY", None)
        # 命中缓存, 不应调 _call_openai_compatible
        assert call_count["n"] == 0
        # 返回值必等于预热时写入的 mock 摘要
        assert s == st.get_default_cache().get(st.cache_key(alert))


def test_summarize_cached_different_alerts(st, clean_env):
    """不同 alert 必各自缓存."""
    a1 = {"alertname": "A", "service": "s", "severity": "y", "labels": {"region": "r"}}
    a2 = {"alertname": "B", "service": "s", "severity": "y", "labels": {"region": "r"}}
    s1 = st.summarize_alert_cached(a1, force_mock=True)
    s2 = st.summarize_alert_cached(a2, force_mock=True)
    assert s1 != s2
    assert "A" in s1 or "a" in s1.lower()
    assert "B" in s2 or "b" in s2.lower()


# ---------------------------------------------------------------------------
# SSE 流式
# ---------------------------------------------------------------------------


def test_stream_cache_hit_returns_immediately(st, clean_env):
    """缓存命中必走 cache_hit + done 2 个事件."""
    alert = {"alertname": "X", "service": "y", "severity": "z", "labels": {"region": "r"}}
    # 预热
    st.summarize_alert_cached(alert, force_mock=True)

    events = list(st.stream_summary(alert, force_mock=True, delay_ms=0))
    assert len(events) == 2
    assert events[0]["event"] == "cache_hit"
    assert events[1]["event"] == "done"
    assert "summary" in events[0]["data"]


def test_stream_cache_miss_chunks_output(st, clean_env):
    """缓存未命中必流式输出 (data + done)."""
    alert = {
        "alertname": "HighErrorRate",
        "service": "test-svc",
        "severity": "critical",
        "labels": {"region": "test-region"},
    }
    events = list(st.stream_summary(alert, force_mock=True, chunk_size=2, delay_ms=0))
    # 至少 1 个 data + 1 个 done
    data_events = [e for e in events if e["event"] == "data"]
    done_events = [e for e in events if e["event"] == "done"]
    assert len(data_events) >= 1
    assert len(done_events) == 1


def test_stream_chunks_cover_full_text(st, clean_env):
    """流式分块拼接必等于完整摘要."""
    alert = {"alertname": "DiskSpaceLow", "service": "db", "severity": "warning", "labels": {"region": "cn-north-1"}}
    events = list(st.stream_summary(alert, force_mock=True, chunk_size=3, delay_ms=0))
    accumulated = ""
    for e in events:
        if e["event"] == "data":
            data = json.loads(e["data"])
            accumulated = data["accumulated"]
    # 最终 done 事件必含完整 summary
    done = next(e for e in events if e["event"] == "done")
    final = json.loads(done["data"])["summary"]
    assert accumulated == final


def test_stream_writes_to_cache_after_miss(st, clean_env):
    """流式生成后必写缓存."""
    alert = {"alertname": "X", "service": "y", "severity": "z", "labels": {"region": "r"}}
    key = st.cache_key(alert)
    # 预清空
    st.get_default_cache().clear()
    assert st.get_default_cache().get(key) is None

    list(st.stream_summary(alert, force_mock=True, chunk_size=2, delay_ms=0))
    # 缓存必已写入
    assert st.get_default_cache().get(key) is not None


def test_stream_handles_error(st, clean_env):
    """底层抛错必 yield error 事件."""
    import alert_llm_summary

    alert = {"alertname": "X", "service": "y", "severity": "z", "labels": {"region": "r"}}
    with patch.object(alert_llm_summary, "summarize_alert", side_effect=RuntimeError("boom")):
        events = list(st.stream_summary(alert, force_mock=True, delay_ms=0))
    error_events = [e for e in events if e["event"] == "error"]
    assert len(error_events) == 1
    assert "boom" in error_events[0]["data"]


def test_stream_chunk_size_respected(st, clean_env):
    """chunk_size 必生效."""
    alert = {
        "alertname": "HighErrorRate",
        "service": "test-svc",
        "severity": "critical",
        "labels": {"region": "test-region"},
    }
    events = list(st.stream_summary(alert, force_mock=True, chunk_size=2, delay_ms=0))
    for e in events:
        if e["event"] == "data":
            data = json.loads(e["data"])
            assert len(data["chunk"]) <= 2


def test_stream_with_custom_cache(st, clean_env):
    """可传自定义 cache (验证 set/get 隔离)."""
    custom = st.LruTtlCache(max_size=5, ttl_seconds=60)
    alert = {
        "alertname": "ZZZUniqueX",
        "service": "ZZZUniqueY",
        "severity": "ZZZUniqueZ",
        "labels": {"region": "ZZZUniqueR"},
    }
    key = st.cache_key(alert)
    events = list(st.stream_summary(alert, force_mock=True, cache=custom, delay_ms=0))
    # 必产生 data + done 事件 (流式生成)
    event_types = {e["event"] for e in events}
    assert "done" in event_types
    assert "data" in event_types or "cache_hit" in event_types
    # custom cache 必已写入
    cached = custom.get(key)
    assert cached is not None, "custom cache 未写入"
    # 默认缓存必未写入
    assert st.get_default_cache().get(key) is None


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def test_cli_stdin_stream(clean_env):
    """CLI 从 stdin 读 JSON, 输出 SSE 事件."""
    script = ROOT / "scripts" / "ops" / "alert_llm_stream.py"
    inp = json.dumps(
        [
            {
                "alertname": "HighErrorRate",
                "service": "test-svc",
                "severity": "critical",
                "labels": {"region": "test-region"},
            }
        ]
    )
    env = {
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUTF8": "1",
        "PATH": os.environ.get("PATH", ""),
    }
    result = subprocess.run(
        [sys.executable, str(script)],
        input=inp,
        capture_output=True,
        text=True,
        env=env,
        cwd=str(ROOT),
    )
    assert result.returncode == 0, f"stderr={result.stderr}"
    out = result.stdout
    assert "--- alert: HighErrorRate ---" in out
    assert "event: data" in out
    assert "event: done" in out


# ---------------------------------------------------------------------------
# 默认单例
# ---------------------------------------------------------------------------


def test_default_cache_singleton(st):
    """get_default_cache 必返回单例."""
    c1 = st.get_default_cache()
    c2 = st.get_default_cache()
    assert c1 is c2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
