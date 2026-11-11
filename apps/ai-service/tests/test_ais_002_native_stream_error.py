"""AIS-002 回归:原生流式分支"已产出内容后上游报错"必须按失败收口。

票面:`app/core/llm_gateway.py` 原生流式分支在"已产出内容后上游报错"时
仍返回 status=ok 且不补 done,调用方无法区分成功/截断。

本文件用假 provider(异步生成器)覆盖两条异常来路:
1. provider 先 yield 内容,再 yield {"type": "error"} 后正常耗尽;
2. provider 先 yield 内容,再直接 raise(异常冒泡)。
两者都必须:结果状态非 ok、有 error 终态帧、不落 success 流水。
另验证正常流(chunk → reasoning → done)帧序与 usage 一字不变。
"""

from __future__ import annotations

import json
import sys
from types import ModuleType
from unittest.mock import AsyncMock

import pytest

from app.core.llm_gateway import LLMGateway, fallback_router

_MODEL = "stepfun/step-3.7-flash"


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
    """events 中的 Exception 元素表示"生成到此处 raise",其余按事件 yield。"""

    class FakeNativeProvider:
        def astream(self, messages, model, *, tools=None, **kwargs):
            async def _gen():
                for item in events:
                    if isinstance(item, Exception):
                        raise item
                    yield item

            return _gen()

    monkeypatch.setattr(
        LLMGateway, "_get_provider", AsyncMock(return_value=FakeNativeProvider())
    )


def _install_no_network_litellm(monkeypatch):
    """原生路径不应触网;/fallback 若被误触发立即断言失败。"""
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


async def test_native_stream_error_event_after_content_is_failed(
    clean_fallback_router, records, monkeypatch
):
    """已发内容后 provider 报 error 事件 → status=error + error 终态帧,不补 done。"""
    outcomes, logs = records
    _configure_provider(monkeypatch, clean_fallback_router)
    _install_fake_provider(
        monkeypatch,
        [
            {"type": "chunk", "content": "partial native"},
            {"type": "error", "message": "mid-stream native disconnect"},
        ],
    )

    events = [
        evt
        async for evt in LLMGateway().astream(
            [{"role": "user", "content": "hi"}], model=_MODEL
        )
    ]

    assert [e.get("content") for e in events if e["type"] == "chunk"] == ["partial native"]
    error_frames = [e for e in events if e["type"] == "error"]
    assert len(error_frames) == 1
    assert "mid-stream native disconnect" in error_frames[0]["message"]
    assert events[-1]["type"] in ("error", "done")
    assert not [e for e in events if e["type"] == "done"]
    assert [o["status"] for o in outcomes] == ["error"]
    assert [lg["status"] for lg in logs] == ["error"]


async def test_native_stream_raise_after_content_is_failed_with_terminal_frame(
    clean_fallback_router, records, monkeypatch
):
    """已发内容后 provider 直接 raise → 不得冒出 astream,按失败收口并补 error 终态帧。"""
    outcomes, logs = records
    _configure_provider(monkeypatch, clean_fallback_router)
    _install_fake_provider(
        monkeypatch,
        [
            {"type": "chunk", "content": "partial native"},
            RuntimeError("provider exploded mid-stream"),
        ],
    )

    events = [
        evt
        async for evt in LLMGateway().astream(
            [{"role": "user", "content": "hi"}], model=_MODEL
        )
    ]

    assert [e.get("content") for e in events if e["type"] == "chunk"] == ["partial native"]
    error_frames = [e for e in events if e["type"] == "error"]
    assert len(error_frames) == 1
    assert "provider exploded mid-stream" in error_frames[0]["message"]
    assert events[-1]["type"] == "error"
    assert not [e for e in events if e["type"] == "done"]
    assert [o["status"] for o in outcomes] == ["error"]
    assert [lg["status"] for lg in logs] == ["error"]
    assert "provider exploded mid-stream" in str(logs[0].get("error_message", ""))


async def test_native_stream_error_finish_reason_is_failed(
    clean_fallback_router, records, monkeypatch
):
    """done 帧 finishReason=content_filter → 内容被拦截,同样不能记成功。"""
    outcomes, logs = records
    _configure_provider(monkeypatch, clean_fallback_router)
    _install_fake_provider(
        monkeypatch,
        [
            {"type": "chunk", "content": "blocked partial"},
            {
                "type": "done",
                "model": _MODEL,
                "usage": {"prompt_tokens": 3, "completion_tokens": 1, "total_tokens": 4},
                "stub": False,
                "finishReason": "content_filter",
            },
        ],
    )

    events = [
        evt
        async for evt in LLMGateway().astream(
            [{"role": "user", "content": "hi"}], model=_MODEL
        )
    ]

    assert [e["type"] for e in events] == ["chunk", "done"]
    assert events[-1]["finishReason"] == "content_filter"
    assert [o["status"] for o in outcomes] == ["error"]
    assert [lg["status"] for lg in logs] == ["error"]
    assert "content_filter" in str(logs[0].get("error_message", ""))


async def test_native_stream_normal_flow_keeps_frames_and_usage(
    clean_fallback_router, records, monkeypatch
):
    """正常流帧序/usage 不变:chunk → reasoning → done,且记 success。"""
    outcomes, logs = records
    _configure_provider(monkeypatch, clean_fallback_router)
    usage = {"prompt_tokens": 5, "completion_tokens": 2, "total_tokens": 7}
    _install_fake_provider(
        monkeypatch,
        [
            {"type": "chunk", "content": "hello"},
            {"type": "reasoning", "content": "thinking"},
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

    assert [e["type"] for e in events] == ["chunk", "reasoning", "done"]
    assert events[2]["usage"] == usage
    assert [o["status"] for o in outcomes] == ["ok"]
    assert [lg["status"] for lg in logs] == ["success"]
    assert logs[0]["usage"]["total_tokens"] == 7
    assert logs[0]["usage_estimated"] is False
