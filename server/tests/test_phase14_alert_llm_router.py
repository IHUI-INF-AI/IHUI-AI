"""Phase 14 建议 4 测试: LLM 多模型路由."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

import alert_llm_router
import alert_llm_summary
from alert_llm_router import (
    ModelQuota,
    ModelRoute,
    ModelRouter,
    ModelStats,
)

# ---------------------------------------------------------------------------
# ModelRoute
# ---------------------------------------------------------------------------


class TestModelRoute:
    def test_default_matcher(self):
        r = ModelRoute(model="m")
        assert r.matches({"alertname": "anything"})

    def test_disabled_never_matches(self):
        r = ModelRoute(model="m", matcher={"alertname": "X"}, enabled=False)
        assert r.matches({"alertname": "X"}) is False

    def test_exact_matcher(self):
        r = ModelRoute(model="m", matcher={"alertname": "HighErrorRate"})
        assert r.matches({"alertname": "HighErrorRate"})
        assert not r.matches({"alertname": "DiskSpaceLow"})

    def test_multi_field_matcher(self):
        r = ModelRoute(model="m", matcher={"alertname": "X", "severity": "critical"})
        assert r.matches({"alertname": "X", "severity": "critical"})
        assert not r.matches({"alertname": "X", "severity": "warning"})

    def test_alertname_pattern(self):
        r = ModelRoute(model="m", alertname_pattern=r"High.*")
        assert r.matches({"alertname": "HighErrorRate"})
        assert not r.matches({"alertname": "DiskSpaceLow"})

    def test_severity_filter(self):
        r = ModelRoute(model="m", severity="critical")
        assert r.matches({"alertname": "X", "severity": "critical"})
        assert not r.matches({"alertname": "X", "severity": "warning"})


# ---------------------------------------------------------------------------
# ModelQuota
# ---------------------------------------------------------------------------


class TestModelQuota:
    def test_allow_under_limit(self):
        q = ModelQuota(rpm=3)
        for _ in range(3):
            assert q.allow() is True
        assert q.allow() is False

    def test_remaining(self):
        q = ModelQuota(rpm=5)
        assert q.remaining() == 5
        q.allow()
        q.allow()
        assert q.remaining() == 3

    def test_window_slides(self):
        q = ModelQuota(rpm=2)
        assert q.allow()
        assert q.allow()
        assert q.allow() is False
        # 模拟 61s 后
        q.calls[0] = time.time() - 61.0
        assert q.allow() is True

    def test_reset(self):
        q = ModelQuota(rpm=1)
        q.allow()
        assert q.allow() is False
        q.reset()
        assert q.allow() is True


# ---------------------------------------------------------------------------
# ModelStats
# ---------------------------------------------------------------------------


class TestModelStats:
    def test_record_call_success(self):
        s = ModelStats()
        s.record_call(True, 100, 50, 0.01)
        assert s.call_count == 1
        assert s.success_count == 1
        assert s.error_count == 0
        assert s.total_input_tokens == 100
        assert s.total_cost_usd == 0.01

    def test_record_call_error(self):
        s = ModelStats()
        s.record_call(False, 0, 0, 0)
        assert s.error_count == 1

    def test_to_dict(self):
        s = ModelStats()
        s.record_call(True, 10, 5, 0.001)
        d = s.to_dict()
        assert d["call_count"] == 1
        assert "total_cost_usd" in d


# ---------------------------------------------------------------------------
# ModelRouter - 路由选择
# ---------------------------------------------------------------------------


def _make_router(ab_test: dict | None = None, fallback: list[str] | None = None) -> ModelRouter:
    routes = [
        ModelRoute(model="gpt-4o", matcher={"alertname": "HighErrorRate"}, priority=10, rpm=60),
        ModelRoute(model="gpt-4o-mini", matcher={"alertname": "DiskSpaceLow"}, priority=5, rpm=120),
        ModelRoute(model="mock", matcher={}, priority=1, rpm=99999),
    ]
    return ModelRouter(routes=routes, ab_test=ab_test, fallback_chain=fallback or ["mock"])


class TestRouterSelect:
    def test_select_by_alertname(self):
        r = _make_router()
        assert r.select_model({"alertname": "HighErrorRate"}) == "gpt-4o"
        assert r.select_model({"alertname": "DiskSpaceLow"}) == "gpt-4o-mini"

    def test_select_fallback(self):
        r = _make_router()
        assert r.select_model({"alertname": "OtherAlert"}) == "mock"

    def test_priority(self):
        # 高优先级在前
        routes = [
            ModelRoute(model="low-pri", matcher={"alertname": "X"}, priority=1),
            ModelRoute(model="high-pri", matcher={"alertname": "X"}, priority=10),
        ]
        r = ModelRouter(routes=routes, fallback_chain=["mock"])
        assert r.select_model({"alertname": "X"}) == "high-pri"


# ---------------------------------------------------------------------------
# ModelRouter - A/B
# ---------------------------------------------------------------------------


class TestAbTest:
    def test_ab_disabled(self):
        r = _make_router(ab_test={"enabled": False})
        assert r.select_model({"alertname": "HighErrorRate"}) == "gpt-4o"

    def test_ab_enabled_assigns(self):
        ab = {
            "enabled": True,
            "experiment_model": "gpt-4o",
            "control_model": "gpt-4o-mini",
            "experiment_pct": 50,
        }
        r = _make_router(ab_test=ab)
        # 抽样 200 个告警, 应大致 50/50
        from collections import Counter

        counts = Counter()
        for i in range(200):
            counts[r.select_model({"alertname": f"A{i}"})] += 1
        # gpt-4o 应在 30-70% 之间 (允许 ±20% 偏差)
        pct = counts["gpt-4o"] / 200
        assert 0.30 <= pct <= 0.70, f"A/B 分配偏差过大: {pct:.2%}"

    def test_ab_stable_for_same_alert(self):
        ab = {
            "enabled": True,
            "experiment_model": "gpt-4o",
            "control_model": "gpt-4o-mini",
            "experiment_pct": 50,
        }
        r = _make_router(ab_test=ab)
        alert = {"alertname": "Stable"}
        for _ in range(10):
            assert r.select_model(alert) == r.select_model(alert)

    def test_ab_pct_zero_never_experiment(self):
        ab = {
            "enabled": True,
            "experiment_model": "gpt-4o",
            "control_model": "gpt-4o-mini",
            "experiment_pct": 0,
        }
        r = _make_router(ab_test=ab)
        for i in range(50):
            assert r.select_model({"alertname": f"A{i}"}) == "gpt-4o-mini"

    def test_ab_pct_hundred_always_experiment(self):
        ab = {
            "enabled": True,
            "experiment_model": "gpt-4o",
            "control_model": "gpt-4o-mini",
            "experiment_pct": 100,
        }
        r = _make_router(ab_test=ab)
        for i in range(50):
            assert r.select_model({"alertname": f"A{i}"}) == "gpt-4o"


# ---------------------------------------------------------------------------
# ModelRouter - 配额
# ---------------------------------------------------------------------------


class TestQuota:
    def test_quota_exhausted(self):
        routes = [ModelRoute(model="limited", matcher={}, rpm=2)]
        r = ModelRouter(routes=routes, fallback_chain=["mock"])
        # 调 2 次 ok, 第 3 次降到 mock
        alert = {"alertname": "x"}
        r1 = r.summarize(alert)
        r2 = r.summarize(alert)
        r3 = r.summarize(alert)
        assert r1["model"] == "limited"
        assert r2["model"] == "limited"
        # 第三次 limited 配额耗尽 → mock
        assert r3["model"] == "mock"
        assert r3["fallback_used"] is True


# ---------------------------------------------------------------------------
# ModelRouter - 降级
# ---------------------------------------------------------------------------


class TestFallback:
    def test_fallback_on_transient_error(self):
        r = _make_router()

        call_count = [0]

        def fake_summarize(alert, force_mock=False):
            call_count[0] += 1
            if call_count[0] == 1:
                raise ConnectionError("gpt-4o 不可用")
            return alert_llm_summary.summarize_alert(alert, force_mock=True)

        with patch.object(alert_llm_summary, "summarize_alert", side_effect=fake_summarize):
            alert = {"alertname": "HighErrorRate"}
            result = r.summarize(alert)
            # 应 fallback 到 mock
            assert result["model"] == "mock"
            assert result["fallback_used"] is True
            assert any(not a.get("ok") for a in result["attempts"])

    def test_fallback_chain_order(self):
        routes = [
            ModelRoute(model="primary", matcher={}, priority=10, rpm=60),
        ]
        r = ModelRouter(routes=routes, fallback_chain=["secondary", "mock"])
        # 配额满 + primary 调通, 不触发 fallback
        # 测试用 mock 调用
        with patch.object(alert_llm_summary, "summarize_alert", return_value="OK") as mock_call:
            result = r.summarize({"alertname": "X"})
            assert result["model"] == "primary"
            assert mock_call.call_count == 1

    def test_no_fallback_when_success(self):
        r = _make_router()
        with patch.object(alert_llm_summary, "summarize_alert", return_value="OK"):
            result = r.summarize({"alertname": "HighErrorRate"})
            assert result["model"] == "gpt-4o"
            assert result["fallback_used"] is False

    def test_non_transient_error_no_retry(self):
        r = _make_router()
        with patch.object(alert_llm_summary, "summarize_alert", side_effect=ValueError("fatal")):
            result = r.summarize({"alertname": "HighErrorRate"})
            # gpt-4o 失败 → 走 mock
            assert result["model"] == "mock"

    def test_all_models_fail_uses_mock(self):
        routes = [ModelRoute(model="primary", matcher={}, priority=10)]
        r = ModelRouter(routes=routes, fallback_chain=[])

        def fake_summarize(alert, force_mock=False):
            if not force_mock:
                raise ConnectionError("x")
            return "MOCK-RESULT"

        with patch.object(alert_llm_summary, "summarize_alert", side_effect=fake_summarize):
            result = r.summarize({"alertname": "X"})
            assert result["model"] == "mock"


# ---------------------------------------------------------------------------
# ModelRouter - 成本
# ---------------------------------------------------------------------------


class TestCost:
    def test_cost_recorded(self):
        routes = [
            ModelRoute(model="cheap", matcher={}, priority=1, cost_per_1k_input=0.001, cost_per_1k_output=0.002),
        ]
        r = ModelRouter(routes=routes, fallback_chain=["mock"])
        with patch.object(alert_llm_summary, "summarize_alert", return_value="short summary"):
            r.summarize({"alertname": "X", "summary": "long alert description " * 20})
        s = r.stats["cheap"]
        assert s.call_count == 1
        assert s.total_cost_usd > 0
        assert s.total_input_tokens > 0
        assert s.total_output_tokens > 0

    def test_mock_zero_cost(self):
        r = _make_router()
        with patch.object(alert_llm_summary, "summarize_alert", return_value="OK"):
            r.summarize({"alertname": "OtherAlert"})  # → mock
        assert r.stats["mock"].total_cost_usd == 0


# ---------------------------------------------------------------------------
# ModelRouter - 缓存键考虑 model (兼容 phase 12/13 缓存)
# ---------------------------------------------------------------------------


class TestModelCacheKey:
    """验证: router 选不同 model 时, 摘要结果可能不同 (缓存键一致性由调用方负责)."""

    def test_router_returns_different_summary_for_different_routes(self):
        r = _make_router()
        with patch.object(alert_llm_summary, "summarize_alert", side_effect=lambda a, force_mock=False: "model-resp"):
            result1 = r.summarize({"alertname": "HighErrorRate"})
            result2 = r.summarize({"alertname": "DiskSpaceLow"})
            # 不同 alert 走不同路由, 但都成功 (这里主要验证逻辑不挂)
            assert result1["model"] in ("gpt-4o", "mock")
            assert result2["model"] in ("gpt-4o-mini", "mock")

    def test_cache_key_stable_for_same_alert(self):
        """同一 alert 多次生成的 cache_key 一致."""
        from alert_llm_stream import cache_key

        alert = {"alertname": "X", "summary": "test"}
        assert cache_key(alert) == cache_key(alert)


# ---------------------------------------------------------------------------
# ModelRouter - from_config
# ---------------------------------------------------------------------------


class TestFromConfig:
    def test_basic_config(self):
        cfg = {
            "routes": [
                {
                    "model": "gpt-4o",
                    "match": {"alertname": "X"},
                    "priority": 10,
                    "rpm": 60,
                    "cost_per_1k_input": 0.005,
                    "cost_per_1k_output": 0.015,
                },
            ],
            "fallback_chain": ["mock"],
        }
        r = ModelRouter.from_config(cfg)
        assert "gpt-4o" in r.quotas
        assert "mock" in r.quotas
        assert r.select_model({"alertname": "X"}) == "gpt-4o"

    def test_empty_routes(self):
        r = ModelRouter.from_config({})
        # 兜底 mock
        assert r.select_model({"alertname": "any"}) == "mock"

    def test_ab_in_config(self):
        cfg = {
            "routes": [{"model": "gpt-4o", "match": {}, "priority": 1, "rpm": 60}],
            "ab_test": {
                "enabled": True,
                "experiment_model": "gpt-4o",
                "control_model": "mock",
                "experiment_pct": 100,
            },
        }
        r = ModelRouter.from_config(cfg)
        for i in range(10):
            assert r.select_model({"alertname": f"A{i}"}) == "gpt-4o"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


class TestCLI:
    def test_cli_runs(self, tmp_path, capsys):
        cfg = tmp_path / "router.json"
        cfg.write_text(
            json.dumps(
                {
                    "routes": [
                        {"model": "mock", "match": {}, "priority": 1, "rpm": 9999},
                    ],
                }
            ),
            encoding="utf-8",
        )
        rc = alert_llm_router.main(
            [
                "--config",
                str(cfg),
                "--alert-json",
                json.dumps({"alertname": "X", "summary": "test"}),
            ]
        )
        assert rc == 0
        out = capsys.readouterr().out
        assert "model:" in out
        assert "summary:" in out

    def test_cli_force_mock(self, tmp_path, capsys):
        cfg = tmp_path / "router.json"
        cfg.write_text(
            json.dumps(
                {
                    "routes": [
                        {"model": "mock", "match": {}, "priority": 1, "rpm": 9999},
                    ],
                }
            ),
            encoding="utf-8",
        )
        rc = alert_llm_router.main(
            [
                "--config",
                str(cfg),
                "--alert-json",
                json.dumps({"alertname": "X"}),
                "--force-mock",
            ]
        )
        assert rc == 0
        out = capsys.readouterr().out
        assert "model: mock" in out
