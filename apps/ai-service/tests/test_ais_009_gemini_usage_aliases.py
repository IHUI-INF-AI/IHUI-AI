"""AIS-009 回归:Gemini 原生 usageMetadata(camelCase)必须归一成 snake_case。

票面:`app/providers/gemini_provider.py` 把 `usageMetadata` 原样当 usage,
网关原生流分支直接取 snake_case ⇒ token/成本/下发 usage 恒 0。

覆盖:
1. normalize_usage 认 Gemini camelCase 四个计数键;
2. snake_case 优先不回归(同名并存时取 snake);
3. 旧形态(只给 prompt/input + completion/output)归一结果不变;
4. 假原生流 final usage 为 camelCase ⇒ 记账入参非 0,下发 done 帧 usage 为 snake;
5. 假原生流 usage 为 snake ⇒ 下发 usage 原样透传(不追加归一键)。
"""

from __future__ import annotations

import json
import sys
from types import ModuleType
from unittest.mock import AsyncMock

import pytest

from app.core.llm_gateway import LLMGateway, fallback_router
from app.core.usage_cache import normalize_usage

_MODEL = "stepfun/step-3.7-flash"


# =============================================================================
# normalize_usage:纯单测
# =============================================================================


def test_normalize_gemini_camel_case_all_fields():
    """Gemini usageMetadata 四键(camelCase)全部归一成统一 snake 契约。"""
    raw = {
        "promptTokenCount": 1200,
        "candidatesTokenCount": 300,
        "cachedContentTokenCount": 400,
        "totalTokenCount": 1500,
    }
    out = normalize_usage(raw)
    assert out["prompt_tokens"] == 1200
    assert out["completion_tokens"] == 300
    assert out["total_tokens"] == 1500
    assert out["cached_tokens"] == 400
    assert out["cache_creation_tokens"] == 0
    # 原生字段透传(审计可回看)
    assert out["promptTokenCount"] == 1200
    assert out["totalTokenCount"] == 1500


def test_normalize_snake_case_still_wins_over_camel_aliases():
    """snake_case 与 camelCase 并存时,snake 优先(既有行为不回归)。"""
    raw = {
        "prompt_tokens": 100,
        "completion_tokens": 20,
        "total_tokens": 120,
        "cached_tokens": 30,
        "promptTokenCount": 999,
        "candidatesTokenCount": 999,
        "totalTokenCount": 999,
        "cachedContentTokenCount": 999,
    }
    out = normalize_usage(raw)
    assert out["prompt_tokens"] == 100
    assert out["completion_tokens"] == 20
    assert out["total_tokens"] == 120
    assert out["cached_tokens"] == 30
    assert out["cache_creation_tokens"] == 0


@pytest.mark.parametrize(
    "raw",
    [
        {"prompt_tokens": 10, "completion_tokens": 5},
        {"input_tokens": 10, "output_tokens": 5},
    ],
)
def test_normalize_legacy_input_output_shape_unchanged(raw):
    """旧形态(只给输入/输出两个键)归一回填口径不变。"""
    out = normalize_usage(raw)
    assert out["prompt_tokens"] == 10
    assert out["completion_tokens"] == 5
    assert out["total_tokens"] == 15
    assert out["cached_tokens"] == 0
    assert out["cache_creation_tokens"] == 0


# =============================================================================
# 网关原生流:记账 + 下发 usage
# =============================================================================


@pytest.fixture(autouse=True)
def _isolate_auto_model_routing(monkeypatch):
    """固定 auto 路由到 stepfun,避免单测环境按可用性表解析到无 key 模型。"""
    from app.core.config import settings

    monkeypatch.setattr(settings, "litellm_model", _MODEL)

    async def _fake_auto_model(has_tools: bool = False, messages=None) -> str:
        return _MODEL

    monkeypatch.setattr("app.core.llm_gateway._resolve_auto_model", _fake_auto_model)


@pytest.fixture
def clean_fallback_router():
    """清理全局 fallback_router,避免用例间污染。"""
    saved = dict(fallback_router._configs)
    fallback_router._configs.clear()
    yield fallback_router
    fallback_router._configs.clear()
    fallback_router._configs.update(saved)


@pytest.fixture
def records(monkeypatch):
    """截获指标/流水,返回 (outcomes, logs) 两个列表。"""
    outcomes: list[dict] = []
    logs: list[dict] = []

    def _record_outcome(provider, model, **kw):
        outcomes.append({"provider": provider, "model": model, **kw})

    monkeypatch.setattr("app.core.llm_gateway.record_llm_outcome", _record_outcome)
    monkeypatch.setattr("app.core.llm_gateway._emit_llm_call_log", lambda **kw: logs.append(kw))
    return outcomes, logs


def _install_fake_provider(monkeypatch, events):
    class FakeNativeProvider:
        def astream(self, messages, model, *, tools=None, **kwargs):
            async def _gen():
                for item in events:
                    yield item

            return _gen()

    monkeypatch.setattr(
        LLMGateway, "_get_provider", AsyncMock(return_value=FakeNativeProvider())
    )


def _install_no_network_litellm(monkeypatch):
    """原生路径不应触网;fallback 若被误触发立即断言失败。"""
    fake_litellm = ModuleType("litellm")

    async def _acompletion(**kwargs):
        raise AssertionError("原生流式用例不应触达 litellm/fallback")

    fake_litellm.acompletion = _acompletion
    fake_litellm.token_counter = lambda **kw: 10
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)


def _configure_provider(monkeypatch, clean_fallback_router):
    from app.core.config import settings

    monkeypatch.setattr(
        settings,
        "llm_providers",
        json.dumps(
            {
                "stepfun": {
                    "api_key": "sk-test",
                    "api_base": "https://api.stepfun.com/step_plan/v1",
                }
            }
        ),
    )
    clean_fallback_router.configure(_MODEL, {"fallbacks": ["agnes/gpt-4o"]})
    _install_no_network_litellm(monkeypatch)


async def test_native_stream_camel_usage_is_accounted_and_emitted_as_snake(
    clean_fallback_router, records, monkeypatch
):
    """假原生流 final usage 为 camelCase ⇒ 记账非 0,下发 done 帧 usage 为 snake。"""
    outcomes, logs = records
    _configure_provider(monkeypatch, clean_fallback_router)
    _install_fake_provider(
        monkeypatch,
        [
            {"type": "chunk", "content": "hello"},
            {
                "type": "done",
                "model": _MODEL,
                "usage": {
                    "promptTokenCount": 1200,
                    "candidatesTokenCount": 300,
                    "cachedContentTokenCount": 400,
                    "totalTokenCount": 1500,
                },
                "stub": False,
                "finishReason": "STOP",
            },
        ],
    )

    events = [
        evt
        async for evt in LLMGateway().astream(
            [{"role": "user", "content": "hi"}], model=_MODEL
        )
    ]

    # 记账:token 不得再是 0
    assert [o["status"] for o in outcomes] == ["ok"]
    assert outcomes[0]["usage"]["prompt_tokens"] == 1200
    assert outcomes[0]["usage"]["completion_tokens"] == 300
    assert outcomes[0]["usage"]["total_tokens"] == 1500
    assert outcomes[0]["usage"]["cached_tokens"] == 400
    assert logs[0]["usage"]["prompt_tokens"] == 1200
    assert logs[0]["usage"]["total_tokens"] == 1500

    # 下发:done 帧 usage 已是 snake(下游 usage 帧/试用额度据此取值)
    done = events[-1]
    assert done["type"] == "done"
    assert done["usage"]["prompt_tokens"] == 1200
    assert done["usage"]["completion_tokens"] == 300
    assert done["usage"]["total_tokens"] == 1500
    # 原生 camelCase 键保留(只增不删)
    assert done["usage"]["promptTokenCount"] == 1200


async def test_native_stream_snake_usage_payload_unchanged(
    clean_fallback_router, records, monkeypatch
):
    """假原生流 usage 为 snake ⇒ 下发 usage 原样透传,不追加归一键。"""
    outcomes, logs = records
    _configure_provider(monkeypatch, clean_fallback_router)
    usage = {"prompt_tokens": 5, "completion_tokens": 2, "total_tokens": 7}
    _install_fake_provider(
        monkeypatch,
        [
            {"type": "chunk", "content": "hello"},
            {
                "type": "done",
                "model": _MODEL,
                "usage": usage,
                "stub": False,
                "finishReason": "stop",
            },
        ],
    )

    events = [
        evt
        async for evt in LLMGateway().astream(
            [{"role": "user", "content": "hi"}], model=_MODEL
        )
    ]

    assert events[-1]["usage"] == usage
    assert [o["status"] for o in outcomes] == ["ok"]
    assert logs[0]["usage"]["total_tokens"] == 7
    assert logs[0]["usage_estimated"] is False
