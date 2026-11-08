# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 判定 provider 接线 + 执行率遥测回归测试。

FakeGateway 内置于本文件，不复制仓库既有夹具；每个用例用 autouse fixture
重置模块级单例并清掉开关环境变量，保证同一 worker 内互不污染。
"""

from __future__ import annotations

import asyncio
import threading
from types import SimpleNamespace
from typing import Any

import pytest

from app.services.sag2_lexical.judge import (
    GATEWAY_MISSING_REASON,
    MODE_LEXICAL_ONLY,
    MODE_MODEL,
    MODE_UNAVAILABLE,
    NO_MODEL_REASON,
    EvidenceJudge,
    JudgeVerdict,
    LexicalOnlyJudge,
    ModelJudge,
    attach_gateway,
    resolve_judge,
    resolve_judge_from_settings,
)
from app.services.sag2_lexical.metrics import (
    Sag2JudgeMetrics,
    judge_metrics,
    reset_judge_metrics,
)


class _Cand:
    """最小候选桩：score() 只 getattr content / key / bm25。"""

    def __init__(self, key: str, content: str, bm25: float = 0.0) -> None:
        self.key = key
        self.content = content
        self.bm25 = bm25


class FakeGateway:
    """内置夹具：实现 judge.py 约定的 structured_completion(payload, model=...)。"""

    def __init__(
        self,
        payload: dict | None = None,
        exc: Exception | None = None,
    ) -> None:
        self.payload = payload if payload is not None else {"scores": [{"key": "k1", "score": 0.9}]}
        self.exc = exc
        self.calls: list[dict] = []

    async def structured_completion(self, payload: dict, model: str | None = None) -> dict:
        self.calls.append({"payload": payload, "model": model})
        await asyncio.sleep(0.001)  # 保证 latency 被记录为 > 0
        if self.exc is not None:
            raise self.exc
        return self.payload


@pytest.fixture(autouse=True)
def _isolate(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SAG2_JUDGE_ENABLED", raising=False)
    monkeypatch.delenv("SAG2_JUDGE_MODEL", raising=False)
    reset_judge_metrics()


def _score(judge: EvidenceJudge, candidates: list[_Cand] | None = None) -> JudgeVerdict:
    cands: list[Any] = candidates or [_Cand("k1", "A公司收购B公司")]
    return asyncio.run(judge.score("收购B公司", cands, []))


def test_default_disabled_returns_lexical_only_and_zero_execution_rate():
    judge = resolve_judge_from_settings()
    assert isinstance(judge, LexicalOnlyJudge)
    verdict = _score(judge)
    assert verdict.mode == MODE_LEXICAL_ONLY
    assert verdict.executed is False
    assert verdict.reason
    snap = judge_metrics.snapshot()
    assert snap["judge_calls"] == 1
    assert snap["judge_executed"] == 0
    assert snap["judge_execution_rate"] == 0.0
    assert snap["judge_degraded"] == 1
    assert snap["by_mode"] == {MODE_LEXICAL_ONLY: 1}
    assert snap["last_mode"] == MODE_LEXICAL_ONLY
    assert snap["last_reason"]


def test_enabled_without_gateway_degrades_honestly_with_gateway_reason():
    judge = resolve_judge_from_settings(None, None, enabled=True)
    assert isinstance(judge, LexicalOnlyJudge)
    verdict = _score(judge)
    assert verdict.mode == MODE_LEXICAL_ONLY
    assert verdict.executed is False
    assert verdict.reason == GATEWAY_MISSING_REASON
    assert "gateway" in verdict.reason.lower()
    snap = judge_metrics.snapshot()
    assert snap["judge_execution_rate"] == 0.0
    assert snap["judge_executed"] == 0
    assert snap["judge_degraded"] == 1


def test_env_flag_and_env_model_are_honored(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SAG2_JUDGE_ENABLED", "true")
    monkeypatch.setenv("SAG2_JUDGE_MODEL", "env-model")
    gw = FakeGateway()
    judge = resolve_judge_from_settings(gw)
    assert isinstance(judge, ModelJudge)
    verdict = _score(judge)
    assert verdict.mode == MODE_MODEL
    assert verdict.executed is True
    assert gw.calls[0]["model"] == "env-model"


def test_disabled_flag_value_does_not_enable(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SAG2_JUDGE_ENABLED", "0")
    judge = resolve_judge_from_settings(FakeGateway())
    assert isinstance(judge, LexicalOnlyJudge)


def test_fake_gateway_valid_scores_records_model_execution_and_latency():
    gw = FakeGateway(payload={"scores": [{"key": "k1", "score": 0.8}]})
    judge = resolve_judge_from_settings(gw, "test-model", enabled=True)
    assert isinstance(judge, ModelJudge)
    verdict = _score(judge)
    assert verdict.mode == MODE_MODEL
    assert verdict.executed is True
    assert verdict.scores == {"k1": 0.8}
    assert verdict.reason == ""
    snap = judge_metrics.snapshot()
    assert snap["judge_calls"] == 1
    assert snap["judge_executed"] == 1
    assert snap["judge_execution_rate"] > 0.0
    assert snap["judge_execution_rate"] == 1.0
    assert snap["judge_degraded"] == 0
    assert snap["by_mode"] == {MODE_MODEL: 1}
    assert snap["last_mode"] == MODE_MODEL
    assert snap["avg_latency_ms"] > 0.0
    assert snap["max_latency_ms"] > 0.0
    assert snap["last_updated"] == 1


def test_gateway_exception_does_not_inflate_execution_rate():
    gw = FakeGateway(exc=RuntimeError("boom"))
    judge = resolve_judge_from_settings(gw, enabled=True)
    verdict = _score(judge)
    assert verdict.mode == MODE_UNAVAILABLE
    assert verdict.executed is False
    assert verdict.reason
    snap = judge_metrics.snapshot()
    assert snap["judge_calls"] == 1
    assert snap["judge_executed"] == 0
    assert snap["judge_execution_rate"] == 0.0
    assert snap["judge_degraded"] == 1
    assert snap["by_mode"] == {MODE_UNAVAILABLE: 1}


def test_empty_scores_is_degraded_not_executed():
    gw = FakeGateway(payload={"scores": []})
    judge = resolve_judge_from_settings(gw, enabled=True)
    verdict = _score(judge)
    assert verdict.mode == MODE_UNAVAILABLE
    assert verdict.executed is False
    assert verdict.reason
    snap = judge_metrics.snapshot()
    assert snap["judge_execution_rate"] == 0.0
    assert snap["judge_executed"] == 0
    assert snap["by_mode"] == {MODE_UNAVAILABLE: 1}


def test_snapshot_zero_state_and_reset_isolation():
    zero = judge_metrics.snapshot()
    assert isinstance(zero, dict)
    assert zero["judge_calls"] == 0
    assert zero["judge_executed"] == 0
    assert zero["judge_execution_rate"] == 0.0
    assert zero["judge_degraded"] == 0
    assert zero["by_mode"] == {}
    assert zero["avg_latency_ms"] == 0.0
    assert zero["max_latency_ms"] == 0.0
    assert zero["last_mode"] == ""
    assert zero["last_reason"] == ""
    assert zero["last_updated"] == 0

    _score(resolve_judge_from_settings(FakeGateway(), enabled=True))
    _score(LexicalOnlyJudge())
    mixed = judge_metrics.snapshot()
    assert mixed["judge_calls"] == 2
    assert mixed["judge_executed"] == 1
    assert mixed["judge_execution_rate"] == 0.5

    reset_judge_metrics()
    after = judge_metrics.snapshot()
    assert after["judge_calls"] == 0
    assert after["judge_execution_rate"] == 0.0
    assert after["by_mode"] == {}
    assert after["last_mode"] == ""


def test_metrics_are_thread_safe_under_concurrent_records():
    local = Sag2JudgeMetrics()
    verdict = JudgeVerdict(scores={}, mode=MODE_MODEL, executed=True, reason="")

    def worker() -> None:
        for _ in range(50):
            local.record(verdict, duration_ms=1.0)

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    snap = local.snapshot()
    assert snap["judge_calls"] == 200
    assert snap["judge_executed"] == 200
    assert snap["judge_execution_rate"] == 1.0


def test_legacy_resolve_judge_signature_is_unchanged():
    assert isinstance(resolve_judge(), LexicalOnlyJudge)
    assert isinstance(resolve_judge(None, None), LexicalOnlyJudge)
    assert isinstance(resolve_judge(None, "ignored"), LexicalOnlyJudge)
    assert _score(resolve_judge()).reason == NO_MODEL_REASON
    gw = FakeGateway()
    judge = resolve_judge(gw, "m")
    assert isinstance(judge, ModelJudge)
    assert judge._gateway is gw
    assert judge._model == "m"
    ok = _score(judge)
    assert ok.mode == MODE_MODEL
    assert ok.executed is True


def test_attach_gateway_mutates_existing_model_judge_in_place():
    existing = ModelJudge(None, "old-model")
    gw = FakeGateway()
    result = attach_gateway(existing, gw, "new-model")
    assert result is existing
    assert existing._gateway is gw
    assert existing._model == "new-model"
    assert _score(existing).executed is True


def test_attach_gateway_rewrites_service_facade_judge():
    svc = SimpleNamespace(judge=LexicalOnlyJudge())
    result = attach_gateway(svc, FakeGateway(), "facade-model")
    assert isinstance(result, ModelJudge)
    assert svc.judge is result
    assert _score(svc.judge).executed is True


def test_attach_gateway_refuses_none_gateway():
    with pytest.raises(ValueError):
        attach_gateway(LexicalOnlyJudge(), None)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
