# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 真实 LLM gateway 适配层 + service.py 接线回归测试（零真实网络）。

覆盖：messages/schema 组装、合法/畸形/异常返回的严格归一、ModelJudge 降级自证、
零环境变量默认行为零变化、开启但 gateway 不可用的诚实降级、开启且可用时挂适配器、
status() 原有键 + P3 键 + P4 键共存、环境变量开关契约。
"""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace
from typing import Any

import pytest

from app.services.sag2_lexical import gateway_adapter as ga
from app.services.sag2_lexical.index import LexicalIndex
from app.services.sag2_lexical.judge import LexicalOnlyJudge, ModelJudge
from app.services.sag2_lexical.metrics import judge_metrics, reset_judge_metrics
from app.services.sag2_lexical.service import Sag2LexicalService, _build_default_service

_DEFAULT_RESPONSE = object()


class _FakeRealGateway:
    """模拟 app.core.llm_gateway.llm_gateway 的真实签名（第二参是 JSON Schema）。"""

    def __init__(
        self, response: Any = _DEFAULT_RESPONSE, exc: Exception | None = None
    ) -> None:
        self.response: Any = (
            {"scores": [{"key": "k1", "score": 0.8}]}
            if response is _DEFAULT_RESPONSE
            else response
        )
        self.exc = exc
        self.calls: list[dict[str, Any]] = []

    async def structured_completion(
        self,
        messages: list[dict[str, str]],
        schema: dict[str, Any],
        model: str | None = None,
        **kwargs: Any,
    ) -> Any:
        self.calls.append({"messages": messages, "schema": schema, "model": model})
        if self.exc is not None:
            raise self.exc
        return self.response


def _payload() -> dict[str, Any]:
    return {
        "criterion": "Is this candidate itself necessary evidence?",
        "question": "收购B公司的是谁",
        "evidence": ["A公司全资收购了B公司。"],
        "candidates": [
            {"key": "k1", "content": "A公司收购了B公司"},
            {"key": "k2", "content": "公司食堂菜单"},
        ],
    }


def _cand(key: str, content: str) -> SimpleNamespace:
    return SimpleNamespace(key=key, content=content, bm25=0.0)


@pytest.fixture(autouse=True)
def _isolate(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SAG2_JUDGE_ENABLED", raising=False)
    monkeypatch.delenv("SAG2_JUDGE_MODEL", raising=False)
    monkeypatch.delenv("SAG2_STORE_BACKEND", raising=False)
    reset_judge_metrics()
    ga.last_resolve_reason = ga.DISABLED_REASON


# ---------------------------------------------------------------------------
# 适配层：合法归一 / messages+schema 组装
# ---------------------------------------------------------------------------


def test_adapter_normalizes_valid_response() -> None:
    gw = _FakeRealGateway(
        response={"scores": [{"key": "k1", "score": 0.8}, {"key": "k2", "score": 0}]}
    )
    result = asyncio.run(
        ga.LlmGatewayJudgeAdapter(gw).structured_completion(_payload(), model="judge-m")
    )
    assert result == {
        "scores": [{"key": "k1", "score": 0.8}, {"key": "k2", "score": 0.0}]
    }
    assert gw.calls[0]["model"] == "judge-m"


def test_adapter_assembles_messages_and_schema() -> None:
    gw = _FakeRealGateway()
    asyncio.run(
        ga.LlmGatewayJudgeAdapter(gw).structured_completion(_payload(), model="m")
    )
    call = gw.calls[0]
    blob = json.dumps(call["messages"], ensure_ascii=False)
    for word in (
        "criterion",
        "question",
        "evidence",
        "candidates",
        "收购B公司的是谁",
        "necessary evidence",
        "k1",
        "k2",
    ):
        assert word in blob, f"messages 缺字段/值: {word}"
    schema: dict[str, Any] = call["schema"]
    assert "scores" in schema["required"]
    scores_prop = schema["properties"]["scores"]
    assert scores_prop["type"] == "array"
    items = scores_prop["items"]
    assert items["properties"]["key"]["type"] == "string"
    assert items["properties"]["score"]["type"] == "number"
    assert set(items["required"]) == {"key", "score"}
    assert schema.get("additionalProperties") is False


# ---------------------------------------------------------------------------
# 适配层：畸形 / 异常一律空打分且不抛异常
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw",
    [
        "not-json-at-all",
        None,
        123,
        {"scores": [{"score": 0.5}]},
        {"scores": [{"key": "k1", "score": 1.5}]},
        {"scores": [{"key": "k1", "score": -0.1}]},
        {"scores": [{"key": "k1", "score": "abc"}]},
        {"scores": [{"key": "k1", "score": None}]},
        {"scores": [{"key": "k1", "score": float("nan")}]},
        {"scores": []},
        {"scores": "not-a-list"},
        {"error": True, "error_message": "boom"},
        [{"key": "k1", "score": 0.9}],
        '{"scores": [{"key": "k1", "score": 2.0}]}',
    ],
)
def test_adapter_malformed_responses_degrade_to_empty(raw: Any) -> None:
    gw = _FakeRealGateway(response=raw)
    result = asyncio.run(
        ga.LlmGatewayJudgeAdapter(gw).structured_completion(_payload())
    )
    assert result == {"scores": []}


def test_adapter_accepts_json_string_and_pydantic_like_object() -> None:
    class _Model:
        def model_dump(self) -> dict[str, Any]:
            return {"scores": [{"key": "k1", "score": 0.6}]}

    for raw in ('{"scores": [{"key": "k1", "score": 0.7}]}', _Model()):
        gw = _FakeRealGateway(response=raw)
        result = asyncio.run(
            ga.LlmGatewayJudgeAdapter(gw).structured_completion(_payload())
        )
        assert len(result["scores"]) == 1
        assert result["scores"][0]["key"] == "k1"
        assert 0.0 <= float(result["scores"][0]["score"]) <= 1.0


def test_adapter_gateway_exception_degrades_via_model_judge() -> None:
    gw = _FakeRealGateway(exc=RuntimeError("boom"))
    adapter = ga.LlmGatewayJudgeAdapter(gw)
    assert asyncio.run(adapter.structured_completion(_payload())) == {"scores": []}

    judge = ModelJudge(adapter, "m")
    verdict = asyncio.run(
        judge.score("收购B公司的是谁", [_cand("k1", "A公司收购B公司")], [])
    )
    assert verdict.executed is False
    assert verdict.mode == "unavailable"
    assert verdict.reason
    snap = judge_metrics.snapshot()
    assert snap["judge_calls"] == 1
    assert snap["judge_execution_rate"] == 0.0
    assert snap["judge_degraded"] == 1


# ---------------------------------------------------------------------------
# 环境变量契约 / 惰性 / 诚实降级
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("flag", "enabled"),
    [("1", True), ("true", True), ("YES", True), ("on", True), ("0", False), ("", False)],
)
def test_sag2_judge_enabled_flag_contract(
    monkeypatch: pytest.MonkeyPatch, flag: str, enabled: bool
) -> None:
    monkeypatch.setenv("SAG2_JUDGE_ENABLED", flag)
    fake = _FakeRealGateway()
    monkeypatch.setattr(ga, "_import_gateway", lambda: fake)
    result = ga.resolve_sag2_gateway()
    assert (result is fake) is enabled


def test_zero_env_disabled_and_no_gateway_construction(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("SAG2_JUDGE_ENABLED", raising=False)
    calls = {"n": 0}

    def _must_not_import() -> Any:
        calls["n"] += 1
        raise RuntimeError("未开启时不得构造真实 gateway")

    monkeypatch.setattr(ga, "_import_gateway", _must_not_import)
    assert ga.resolve_sag2_gateway() is None
    assert calls["n"] == 0, "零环境变量时绝不 import/构造真实 gateway、绝不联网"
    assert ga.get_last_resolve_reason()

    service = Sag2LexicalService()
    assert isinstance(service.judge, LexicalOnlyJudge)
    payload = service.status()
    assert payload["judge_execution_rate"] == 0.0
    assert payload["judge_calls"] == 0
    assert payload["judge_executed"] == 0
    assert payload["judge_degraded"] == 0
    # P3 的 4 个 store 字段仍在且值不变
    assert payload["effective_backend"] == "memory"
    assert payload["requested_backend"] == "memory"
    assert payload["degraded"] is False
    assert payload["degrade_reason"] == ""


def test_enabled_gateway_unavailable_degrades_honestly(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SAG2_JUDGE_ENABLED", "true")

    def _boom() -> Any:
        raise RuntimeError("no llm_gateway")

    monkeypatch.setattr(ga, "_import_gateway", _boom)
    assert ga.resolve_sag2_gateway() is None
    reason = ga.get_last_resolve_reason()
    assert reason and ("失败" in reason or "降级" in reason)

    service = _build_default_service()
    assert isinstance(service.judge, LexicalOnlyJudge)
    payload = service.status()
    assert payload["judge_gateway_reason"] == reason
    assert payload["judge_provider"] == "LexicalOnlyJudge"
    assert payload["judge_execution_rate"] == 0.0
    assert payload["judge_calls"] == 0
    for key in ("effective_backend", "requested_backend", "degraded", "degrade_reason"):
        assert key in payload


def test_enabled_gateway_available_attaches_adapter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SAG2_JUDGE_ENABLED", "true")
    monkeypatch.setenv("SAG2_JUDGE_MODEL", "judge-model-x")
    fake = _FakeRealGateway()
    monkeypatch.setattr(ga, "_import_gateway", lambda: fake)
    assert ga.resolve_sag2_gateway() is fake

    service = _build_default_service()
    assert isinstance(service.judge, ModelJudge)
    assert isinstance(service.judge._gateway, ga.LlmGatewayJudgeAdapter)
    assert service.status()["judge_gateway_reason"] == ""

    verdict = asyncio.run(
        service.judge.score(
            "收购B公司的是谁",
            [_cand("k1", "A公司收购B公司")],
            [],
        )
    )
    assert verdict.executed is True
    assert verdict.scores == {"k1": 0.8}
    assert fake.calls[0]["model"] == "judge-model-x"
    assert judge_metrics.snapshot()["judge_execution_rate"] == 1.0


# ---------------------------------------------------------------------------
# status() 键共存（原有键 + P3 键 + P4 键）
# ---------------------------------------------------------------------------


def test_status_all_key_families_coexist() -> None:
    payload = Sag2LexicalService().status()
    original_keys = set(LexicalIndex().status()) | {"judge_provider"}
    p3_keys = {"effective_backend", "requested_backend", "degraded", "degrade_reason"}
    p4_keys = {
        "judge_metrics",
        "judge_execution_rate",
        "judge_calls",
        "judge_executed",
        "judge_degraded",
        "judge_last_mode",
        "judge_last_reason",
        "judge_gateway_reason",
    }
    assert original_keys <= set(payload), "原有键 + judge_provider 一个不丢"
    assert p3_keys <= set(payload), "P3 四字段一个不丢"
    assert p4_keys <= set(payload), "P4 新增字段全部在位"
    assert isinstance(payload["judge_metrics"], dict)
    for key in (
        "judge_calls",
        "judge_executed",
        "judge_execution_rate",
        "judge_degraded",
        "by_mode",
        "avg_latency_ms",
        "max_latency_ms",
        "last_mode",
        "last_reason",
        "last_updated",
    ):
        assert key in payload["judge_metrics"]
    for key, value in LexicalIndex().status().items():
        assert payload[key] == value, "原有键连值都不变"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
