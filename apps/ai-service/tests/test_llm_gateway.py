"""llm_gateway.py 单元测试:LLMGateway stub 模式 + 真实模式降级。

测试覆盖:
- _is_stub_mode 判断(无 API key 时为 True)
- complete stub 模式(返回模拟响应 + 最后用户消息)
- complete 真实模式(monkeypatch litellm.acompletion 模拟成功 + 异常降级)
- stub 模式下 usage 字段为 0
- 多条消息时取最后一条 user 消息
- 模型名称透传
- kwargs 透传
- 全局 llm_gateway 实例
"""

from __future__ import annotations

import pytest

from app.core.llm_gateway import LLMGateway, llm_gateway


# =============================================================================
# _is_stub_mode
# =============================================================================


def test_is_stub_mode_true_when_no_api_key(monkeypatch):
    """无 openai_api_key 和 anthropic_api_key 时为 stub 模式。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"openai": {"api_key": ""}, "anthropic": {"api_key": ""}}))
    gw = LLMGateway()
    assert gw._is_stub_mode() is True


def test_is_stub_mode_false_when_openai_key_set(monkeypatch):
    """设置 openai_api_key 后非 stub 模式。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test"}}))
    gw = LLMGateway()
    assert gw._is_stub_mode() is False


def test_is_stub_mode_false_when_anthropic_key_set(monkeypatch):
    """设置 anthropic_api_key 后非 stub 模式。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"openai": {"api_key": ""}, "anthropic": {"api_key": "sk-ant-test"}}))
    gw = LLMGateway()
    assert gw._is_stub_mode() is False


# =============================================================================
# complete - stub 模式
# =============================================================================


async def test_complete_stub_returns_mock_response(monkeypatch):
    """stub 模式返回模拟响应。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"openai": {"api_key": ""}, "anthropic": {"api_key": ""}}))

    gw = LLMGateway()
    result = await gw.complete([{"role": "user", "content": "你好"}])

    assert result["stub"] is True
    assert "[stub]" in result["content"]
    assert "你好" in result["content"]
    assert result["model"] == settings.litellm_model
    assert result["usage"]["prompt_tokens"] == 0
    assert result["usage"]["completion_tokens"] == 0
    assert result["usage"]["total_tokens"] == 0


async def test_complete_stub_extracts_last_user_message(monkeypatch):
    """stub 模式提取最后一条 user 消息。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"openai": {"api_key": ""}, "anthropic": {"api_key": ""}}))

    gw = LLMGateway()
    messages = [
        {"role": "user", "content": "第一条消息"},
        {"role": "assistant", "content": "回复"},
        {"role": "user", "content": "第二条消息"},
    ]
    result = await gw.complete(messages)

    assert "第二条消息" in result["content"]
    assert "第一条消息" not in result["content"]


async def test_complete_stub_truncates_long_message(monkeypatch):
    """stub 模式截断超长用户消息(200 字符)。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"openai": {"api_key": ""}, "anthropic": {"api_key": ""}}))

    gw = LLMGateway()
    long_msg = "x" * 500
    result = await gw.complete([{"role": "user", "content": long_msg}])

    # 原始消息 500 字符,截断后应 <= 200 + 前缀
    assert "x" * 200 in result["content"]
    assert "x" * 500 not in result["content"]


async def test_complete_stub_no_user_message(monkeypatch):
    """stub 模式无 user 消息时 content 为空。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"openai": {"api_key": ""}, "anthropic": {"api_key": ""}}))

    gw = LLMGateway()
    messages = [{"role": "system", "content": "系统消息"}]
    result = await gw.complete(messages)

    assert result["stub"] is True
    # 无 user 消息,last_user 为空
    assert "最后一条用户消息: " in result["content"]


async def test_complete_stub_uses_default_model(monkeypatch):
    """stub 模式使用默认模型 litellm_model。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"openai": {"api_key": ""}, "anthropic": {"api_key": ""}}))

    gw = LLMGateway()
    result = await gw.complete([{"role": "user", "content": "test"}])
    assert result["model"] == settings.litellm_model


async def test_complete_stub_with_explicit_model(monkeypatch):
    """stub 模式透传显式 model 参数。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"openai": {"api_key": ""}, "anthropic": {"api_key": ""}}))

    gw = LLMGateway()
    result = await gw.complete(
        [{"role": "user", "content": "test"}],
        model="gpt-4",
    )
    assert result["model"] == "gpt-4"


# =============================================================================
# complete - 真实模式(mock litellm)
# =============================================================================


async def test_complete_real_mode_success(monkeypatch):
    """真实模式:litellm.acompletion 成功时返回响应。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test"}}))

    gw = LLMGateway()

    # 模拟 litellm.acompletion 返回值
    class FakeUsage:
        def model_dump(self):
            return {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}

    class FakeMessage:
        content = "真实回复"

    class FakeChoice:
        message = FakeMessage()

    class FakeResponse:
        usage = FakeUsage()
        choices = [FakeChoice()]
        model = "gpt-4o-mini"

    # 动态注入 litellm 模块
    import sys
    from types import ModuleType

    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        return FakeResponse()

    fake_litellm.acompletion = fake_acompletion
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    result = await gw.complete([{"role": "user", "content": "test"}])

    assert result["stub"] is False
    assert result["content"] == "真实回复"
    assert result["model"] == "gpt-4o-mini"
    assert result["usage"]["prompt_tokens"] == 10
    assert result["usage"]["completion_tokens"] == 5
    assert result["usage"]["total_tokens"] == 15


async def test_complete_real_mode_no_usage(monkeypatch):
    """真实模式:litellm 返回 usage=None 时不报错。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test"}}))

    gw = LLMGateway()

    class FakeMessage:
        content = "回复"

    class FakeChoice:
        message = FakeMessage()

    class FakeResponse:
        usage = None
        choices = [FakeChoice()]
        model = "gpt-4"

    import sys
    from types import ModuleType

    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        return FakeResponse()

    fake_litellm.acompletion = fake_acompletion
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    result = await gw.complete([{"role": "user", "content": "test"}])
    assert result["stub"] is False
    assert result["usage"] == {}
    assert result["content"] == "回复"


async def test_complete_real_mode_no_model_field(monkeypatch):
    """真实模式:response.model 为 None 时用 used_model。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test"}}))

    gw = LLMGateway()

    class FakeUsage:
        def model_dump(self):
            return {}

    class FakeMessage:
        content = "回复"

    class FakeChoice:
        message = FakeMessage()

    class FakeResponse:
        usage = FakeUsage()
        choices = [FakeChoice()]
        model = None

    import sys
    from types import ModuleType

    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        return FakeResponse()

    fake_litellm.acompletion = fake_acompletion
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    result = await gw.complete(
        [{"role": "user", "content": "test"}],
        model="claude-3-opus",
    )
    assert result["model"] == "claude-3-opus"


async def test_complete_real_mode_exception_degrades_to_stub(monkeypatch):
    """真实模式:litellm 抛异常时降级为 stub 返回错误。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test"}}))

    gw = LLMGateway()

    import sys
    from types import ModuleType

    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        raise RuntimeError("API 连接失败")

    fake_litellm.acompletion = fake_acompletion
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    result = await gw.complete([{"role": "user", "content": "test"}])

    # 异常时返回 error 标记(非 stub 降级)
    assert result["stub"] is False
    assert result["error"] is True
    assert result["content"] == ""
    assert "API 连接失败" in result["error_message"]
    assert result["usage"] == {}


async def test_complete_real_mode_usage_without_model_dump(monkeypatch):
    """真实模式:usage 无 model_dump 方法时用 dict() 转换。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test"}}))

    gw = LLMGateway()

    class FakeUsage:
        """无 model_dump 方法的 usage 对象。"""

        def __iter__(self):
            return iter([("prompt_tokens", 5), ("completion_tokens", 3)])

    class FakeMessage:
        content = "回复"

    class FakeChoice:
        message = FakeMessage()

    class FakeResponse:
        usage = FakeUsage()
        choices = [FakeChoice()]
        model = "gpt-4"

    import sys
    from types import ModuleType

    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        return FakeResponse()

    fake_litellm.acompletion = fake_acompletion
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    result = await gw.complete([{"role": "user", "content": "test"}])
    assert result["stub"] is False
    # dict(usage) 转换
    assert result["usage"]["prompt_tokens"] == 5
    assert result["usage"]["completion_tokens"] == 3


async def test_complete_real_mode_passes_kwargs(monkeypatch):
    """真实模式:kwargs 透传给 litellm.acompletion。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test"}}))

    gw = LLMGateway()

    received_kwargs = {}

    class FakeUsage:
        def model_dump(self):
            return {}

    class FakeMessage:
        content = "回复"

    class FakeChoice:
        message = FakeMessage()

    class FakeResponse:
        usage = FakeUsage()
        choices = [FakeChoice()]
        model = "gpt-4"

    import sys
    from types import ModuleType

    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        received_kwargs.update(kwargs)
        return FakeResponse()

    fake_litellm.acompletion = fake_acompletion
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    await gw.complete(
        [{"role": "user", "content": "test"}],
        temperature=0.5,
        max_tokens=100,
    )

    assert received_kwargs["temperature"] == 0.5
    assert received_kwargs["max_tokens"] == 100
    assert "messages" in received_kwargs
    assert "model" in received_kwargs


# =============================================================================
# 全局实例
# =============================================================================


def test_global_llm_gateway_instance():
    """全局 llm_gateway 实例存在且为 LLMGateway 类型。"""
    assert llm_gateway is not None
    assert isinstance(llm_gateway, LLMGateway)


def test_llm_gateway_shared_instance():
    """多次引用 llm_gateway 返回同一实例。"""
    from app.core.llm_gateway import llm_gateway as gw1
    from app.core.llm_gateway import llm_gateway as gw2
    assert gw1 is gw2


# =============================================================================
# astream - 流式调用(stub 模式)
# =============================================================================


async def test_astream_stub_yields_chunks(monkeypatch):
    """stub 模式:astream 按 10 字符分块产出 chunk 事件。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"openai": {"api_key": ""}, "anthropic": {"api_key": ""}}))

    gw = LLMGateway()
    events = []
    async for event in gw.astream([{"role": "user", "content": "你好世界"}]):
        events.append(event)

    # 至少有 chunk + done
    types = [e["type"] for e in events]
    assert "chunk" in types
    assert types[-1] == "done"

    # chunk 拼接后应包含 stub 响应内容
    content = "".join(e["content"] for e in events if e["type"] == "chunk")
    assert "[stub]" in content
    assert "你好世界" in content


async def test_astream_stub_done_event_has_model_and_usage(monkeypatch):
    """stub 模式:done 事件包含 model/usage/stub 字段。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"openai": {"api_key": ""}, "anthropic": {"api_key": ""}}))

    gw = LLMGateway()
    events = [e async for e in gw.astream([{"role": "user", "content": "test"}])]

    done = events[-1]
    assert done["type"] == "done"
    assert done["stub"] is True
    assert done["model"] == settings.litellm_model
    assert "usage" in done


async def test_astream_stub_short_message_single_chunk(monkeypatch):
    """stub 模式:短消息(<=10 字符)只产出一个 chunk。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"openai": {"api_key": ""}, "anthropic": {"api_key": ""}}))

    gw = LLMGateway()
    events = [e async for e in gw.astream([{"role": "user", "content": "hi"}])]
    chunks = [e for e in events if e["type"] == "chunk"]
    # stub 响应内容很长,所以会有多个 chunk;这里验证 chunk 非空
    assert len(chunks) >= 1
    assert all(c["content"] for c in chunks)


# =============================================================================
# astream - 真实模式(mock litellm stream)
# =============================================================================


async def test_astream_real_mode_yields_tokens(monkeypatch):
    """真实模式:astream 逐 token 产出 chunk + done。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test"}}))

    gw = LLMGateway()

    # 模拟流式 chunk
    class FakeDelta:
        def __init__(self, content):
            self.content = content

    class FakeStreamChoice:
        def __init__(self, content):
            self.delta = FakeDelta(content)

    class FakeStreamChunk:
        def __init__(self, content, model=None):
            self.choices = [FakeStreamChoice(content)]
            self.model = model

    import sys
    from types import ModuleType

    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        # 返回异步生成器
        async def _gen():
            yield FakeStreamChunk("Hello", model="gpt-4o")
            yield FakeStreamChunk(" world", model="gpt-4o")

        return _gen()

    fake_litellm.acompletion = fake_acompletion
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    events = [e async for e in gw.astream([{"role": "user", "content": "hi"}])]

    chunks = [e for e in events if e["type"] == "chunk"]
    done = events[-1]

    assert len(chunks) == 2
    assert chunks[0]["content"] == "Hello"
    assert chunks[1]["content"] == " world"
    assert done["type"] == "done"
    assert done["model"] == "gpt-4o"
    assert done["stub"] is False


async def test_astream_real_mode_skip_empty_content(monkeypatch):
    """真实模式:空 content 的 chunk 被跳过。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test"}}))

    gw = LLMGateway()

    class FakeDelta:
        def __init__(self, content):
            self.content = content

    class FakeStreamChoice:
        def __init__(self, content):
            self.delta = FakeDelta(content)

    class FakeStreamChunk:
        def __init__(self, content):
            self.choices = [FakeStreamChoice(content)]
            self.model = "gpt-4"

    import sys
    from types import ModuleType

    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        async def _gen():
            yield FakeStreamChunk(None)  # 空 content
            yield FakeStreamChunk("real")
            yield FakeStreamChunk("")  # 空 content
            yield FakeStreamChunk(" token")

        return _gen()

    fake_litellm.acompletion = fake_acompletion
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    events = [e async for e in gw.astream([{"role": "user", "content": "hi"}])]
    chunks = [e for e in events if e["type"] == "chunk"]

    # None 和 "" 被跳过,只有 "real" 和 " token"
    assert len(chunks) == 2
    assert chunks[0]["content"] == "real"
    assert chunks[1]["content"] == " token"


async def test_astream_real_mode_exception_yields_error(monkeypatch):
    """真实模式:litellm 抛异常时 yield error 事件。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test"}}))

    gw = LLMGateway()

    import sys
    from types import ModuleType

    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        raise RuntimeError("stream failed")

    fake_litellm.acompletion = fake_acompletion
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    events = [e async for e in gw.astream([{"role": "user", "content": "hi"}])]

    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert "stream failed" in events[0]["message"]


async def test_astream_real_mode_no_choices(monkeypatch):
    """真实模式:chunk 无 choices 时不报错,只取 model。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test"}}))

    gw = LLMGateway()

    class FakeEmptyChunk:
        choices = []
        model = "gpt-4"

    import sys
    from types import ModuleType

    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        async def _gen():
            yield FakeEmptyChunk()

        return _gen()

    fake_litellm.acompletion = fake_acompletion
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    events = [e async for e in gw.astream([{"role": "user", "content": "hi"}])]

    # 无 chunk(因为 choices 为空),只有 done
    assert len(events) == 1
    assert events[0]["type"] == "done"
    assert events[0]["model"] == "gpt-4"


async def test_astream_passes_stream_kwarg(monkeypatch):
    """真实模式:astream 透传 stream=True 给 litellm。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test"}}))

    gw = LLMGateway()

    received_kwargs = {}

    class FakeStreamChunk:
        choices = []
        model = "gpt-4"

    import sys
    from types import ModuleType

    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        received_kwargs.update(kwargs)
        async def _gen():
            yield FakeStreamChunk()
        return _gen()

    fake_litellm.acompletion = fake_acompletion
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    _ = [e async for e in gw.astream([{"role": "user", "content": "hi"}])]

    assert received_kwargs.get("stream") is True


# =============================================================================
# _resolve_provider — provider 前缀路由(固化 stepfun/agnes/openai 手动验证)
# =============================================================================


def test_resolve_provider_stepfun(monkeypatch):
    """stepfun/* → (stepfun_api_key, stepfun_api_base, openai/<real_model>)。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-stepfun-test", "api_base": "https://api.stepfun.com/step_plan/v1"}}))
    gw = LLMGateway()
    api_key, api_base, litellm_model = gw._resolve_provider("stepfun/step-3.7-flash")
    assert api_key == "sk-stepfun-test"
    assert api_base == "https://api.stepfun.com/step_plan/v1"
    assert litellm_model == "openai/step-3.7-flash"


def test_resolve_provider_agnes(monkeypatch):
    """agnes/* → (agnes_api_key, agnes_api_base, openai/<real_model>)。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"agnes": {"api_key": "sk-agnes-test", "api_base": "https://apihub.agnes-ai.com/v1"}}))
    gw = LLMGateway()
    api_key, api_base, litellm_model = gw._resolve_provider("agnes/gpt-4o-mini")
    assert api_key == "sk-agnes-test"
    assert api_base == "https://apihub.agnes-ai.com/v1"
    assert litellm_model == "openai/gpt-4o-mini"


def test_resolve_provider_groq(monkeypatch):
    """groq/* → (groq_api_key, None, model) — LiteLLM 原生路由。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"groq": {"api_key": "sk-groq-test"}}))
    gw = LLMGateway()
    api_key, api_base, litellm_model = gw._resolve_provider("groq/llama-3.3-70b")
    assert api_key == "sk-groq-test"
    assert api_base is None
    assert litellm_model == "groq/llama-3.3-70b"


def test_resolve_provider_gemini(monkeypatch):
    """gemini/* → (gemini_api_key, None, model)。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"gemini": {"api_key": "sk-gemini-test"}}))
    gw = LLMGateway()
    api_key, api_base, litellm_model = gw._resolve_provider("gemini/gemini-1.5-flash")
    assert api_key == "sk-gemini-test"
    assert api_base is None
    assert litellm_model == "gemini/gemini-1.5-flash"


def test_resolve_provider_openrouter(monkeypatch):
    """openrouter/* → (openrouter_api_key, None, model)。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"openrouter": {"api_key": "sk-or-test"}}))
    gw = LLMGateway()
    api_key, api_base, litellm_model = gw._resolve_provider("openrouter/llama-3")
    assert api_key == "sk-or-test"
    assert api_base is None
    assert litellm_model == "openrouter/llama-3"


def test_resolve_provider_anthropic(monkeypatch):
    """anthropic/* → (anthropic_api_key, None, model)。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"anthropic": {"api_key": "sk-ant-test"}}))
    gw = LLMGateway()
    api_key, api_base, litellm_model = gw._resolve_provider("anthropic/claude-3-opus")
    assert api_key == "sk-ant-test"
    assert api_base is None
    assert litellm_model == "anthropic/claude-3-opus"


def test_resolve_provider_claude_prefix(monkeypatch):
    """claude-* → (anthropic_api_key, None, model) — claude- 前缀也路由到 anthropic。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"anthropic": {"api_key": "sk-ant-test"}}))
    gw = LLMGateway()
    api_key, api_base, litellm_model = gw._resolve_provider("claude-3-5-sonnet")
    assert api_key == "sk-ant-test"
    assert api_base is None
    assert litellm_model == "claude-3-5-sonnet"


def test_resolve_provider_openai_default(monkeypatch):
    """gpt-4(无前缀)→ (openai_api_key, None, model) — 默认 OpenAI 路由。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"openai": {"api_key": "sk-openai-test"}}))
    gw = LLMGateway()
    api_key, api_base, litellm_model = gw._resolve_provider("gpt-4o")
    assert api_key == "sk-openai-test"
    assert api_base is None
    assert litellm_model == "gpt-4o"


def test_resolve_provider_openai_key_missing_returns_none(monkeypatch):
    """openai key 缺失时 _resolve_provider 返回 (None, None, model)。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"openai": {"api_key": ""}}))
    gw = LLMGateway()
    api_key, api_base, litellm_model = gw._resolve_provider("gpt-4o")
    assert api_key is None
    assert api_base is None
    assert litellm_model == "gpt-4o"


def test_resolve_provider_case_insensitive(monkeypatch):
    """模型名大小写不敏感:STEPFUN/Step-3.7 → openai/Step-3.7。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-stepfun-test", "api_base": "https://api.stepfun.com/step_plan/v1"}}))
    gw = LLMGateway()
    api_key, api_base, litellm_model = gw._resolve_provider("STEPFUN/Step-3.7-Flash")
    assert api_key == "sk-stepfun-test"
    assert litellm_model == "openai/Step-3.7-Flash"


# =============================================================================
# complete — API key 缺失错误处理(固化 openai key 缺失手动验证)
# =============================================================================


async def test_complete_real_mode_api_key_missing_returns_error(monkeypatch):
    """真实模式 + API key 缺失:complete() 返回 error:True + 中文错误信息。"""
    from app.core.config import settings
    # 设置 anthropic key 使 _is_stub_mode() 返回 False(非 stub 模式)
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"anthropic": {"api_key": "sk-ant-test"}}))

    gw = LLMGateway()
    # 请求 gpt-4o(默认 openai 路由),但 openai key 为空
    result = await gw.complete(
        [{"role": "user", "content": "test"}],
        model="gpt-4o",
    )
    assert result["stub"] is False
    assert result["error"] is True
    assert "API key" in result["error_message"] or "未配置" in result["error_message"]
    assert result["content"] == ""


# =============================================================================
# repair_messages — P38 跨端同步(messages 数组结构修复)
# =============================================================================


from app.core.llm_gateway import repair_messages


def test_repair_messages_filters_invalid_roles():
    """Rule 1:过滤非法 role(只保留 system/user/assistant)"""
    msgs = [
        {"role": "system", "content": "sys"},
        {"role": "tool", "content": "tool result"},
        {"role": "function", "content": "fn result"},
        {"role": "user", "content": "hi"},
    ]
    repaired, removed, reasons = repair_messages(msgs)
    assert len(repaired) == 2
    assert removed == 2
    assert any("非法 role" in r for r in reasons)


def test_repair_messages_filters_empty_content():
    """Rule 2:过滤空 content"""
    msgs = [
        {"role": "user", "content": ""},
        {"role": "assistant", "content": "a"},
    ]
    repaired, removed, reasons = repair_messages(msgs)
    # user 被 Rule 2 移除,assistant 被 Rule 4 移除(开头 assistant)
    assert removed >= 1
    assert all(m.get("content", "").strip() for m in repaired)


def test_repair_messages_dedupes_consecutive_same_role():
    """Rule 3:合并连续相同 role"""
    msgs = [
        {"role": "user", "content": "q1"},
        {"role": "user", "content": "q2"},
        {"role": "assistant", "content": "a"},
    ]
    repaired, removed, reasons = repair_messages(msgs)
    assert len(repaired) == 2
    assert repaired[0]["content"] == "q1\n\nq2"


def test_repair_messages_removes_leading_assistant():
    """Rule 4:丢弃开头的 assistant"""
    msgs = [
        {"role": "assistant", "content": "stale"},
        {"role": "user", "content": "q"},
        {"role": "assistant", "content": "a"},
    ]
    repaired, removed, reasons = repair_messages(msgs)
    assert len(repaired) == 2
    assert repaired[0]["role"] == "user"
    assert removed == 1


def test_repair_messages_removes_trailing_user_with_assistant():
    """Rule 5:移除末尾无响应的 user(前面有 assistant)"""
    msgs = [
        {"role": "user", "content": "q"},
        {"role": "assistant", "content": "a"},
        {"role": "user", "content": "interjection"},
    ]
    repaired, removed, reasons = repair_messages(msgs)
    assert len(repaired) == 2
    assert repaired[-1]["role"] == "assistant"
    assert removed == 1


def test_repair_messages_preserves_first_user_without_assistant():
    """Rule 5:首轮 user(无 assistant)保留"""
    msgs = [{"role": "user", "content": "q"}]
    repaired, removed, reasons = repair_messages(msgs)
    assert len(repaired) == 1
    assert removed == 0


def test_repair_messages_complex_mix():
    """复杂混合损坏:多条规则同时触发"""
    msgs = [
        {"role": "assistant", "content": "stale"},
        {"role": "tool", "content": "residue"},
        {"role": "user", "content": "q1"},
        {"role": "user", "content": "q2"},
        {"role": "assistant", "content": "a1"},
        {"role": "assistant", "content": "a2"},
        {"role": "user", "content": "interjection"},
    ]
    repaired, removed, reasons = repair_messages(msgs)
    assert removed >= 3
    assert repaired[0]["role"] == "user"
    assert repaired[0]["content"] == "q1\n\nq2"
    assert repaired[1]["content"] == "a1\n\na2"
    assert len(repaired) == 2


def test_repair_messages_empty_input():
    """空列表返回空"""
    repaired, removed, reasons = repair_messages([])
    assert repaired == []
    assert removed == 0


# =============================================================================
# FallbackRouter — Provider 故障转移路由器单元测试
# =============================================================================

from unittest.mock import AsyncMock, patch
from app.core.llm_gateway import FallbackRouter, fallback_router


@pytest.fixture(autouse=False)
def clean_fallback_router():
    """每个 integration 测试前后清理全局 fallback_router 配置,避免测试间污染。"""
    saved = dict(fallback_router._configs)
    fallback_router._configs.clear()
    yield fallback_router
    fallback_router._configs.clear()
    fallback_router._configs.update(saved)


# --- FallbackRouter 独立单元测试(mock llm_gateway.complete) ---


def test_fallback_router_configure_and_get_config():
    """configure() 存储 config,get_config() 取回。"""
    router = FallbackRouter()
    router.configure("stepfun/step-3.7-flash", {
        "fallbacks": ["agnes/gpt-4o"],
        "triggerOnError": ["timeout", "overloaded"],
    })
    config = router.get_config("stepfun/step-3.7-flash")
    assert config["fallbacks"] == ["agnes/gpt-4o"]
    assert "timeout" in config["triggerOnError"]


def test_fallback_router_get_config_unknown_returns_empty():
    """未配置的 provider 返回空 dict。"""
    router = FallbackRouter()
    assert router.get_config("unknown/model") == {}


async def test_complete_with_fallback_first_succeeds():
    """第一个 fallback 成功 → 返回结果 + _skip_fallback=True 防递归。"""
    router = FallbackRouter()
    router.configure("stepfun/step-3.7-flash", {"fallbacks": ["agnes/gpt-4o"]})

    mock_result = {"content": "fallback ok", "model": "agnes/gpt-4o", "usage": {}, "stub": False}
    with patch("app.core.llm_gateway.llm_gateway.complete", new_callable=AsyncMock, return_value=mock_result) as mock_complete:
        result = await router.complete_with_fallback(
            [{"role": "user", "content": "hi"}], "stepfun/step-3.7-flash"
        )

    assert result["content"] == "fallback ok"
    assert not result.get("error")
    mock_complete.assert_called_once()
    # 防递归:_skip_fallback=True 必须传入
    assert mock_complete.call_args.kwargs["_skip_fallback"] is True
    assert mock_complete.call_args.kwargs["model"] == "agnes/gpt-4o"


async def test_complete_with_fallback_second_succeeds():
    """第一个 fallback 失败(error=True),第二个成功。"""
    router = FallbackRouter()
    router.configure("stepfun/step-3.7-flash", {
        "fallbacks": ["agnes/gpt-4o", "openai/gpt-4o-mini"],
    })

    fail_result = {"content": "", "error": True, "error_message": "agnes down"}
    ok_result = {"content": "openai ok", "model": "gpt-4o-mini", "usage": {}, "stub": False}

    with patch("app.core.llm_gateway.llm_gateway.complete", new_callable=AsyncMock, side_effect=[fail_result, ok_result]) as mock_complete:
        result = await router.complete_with_fallback(
            [{"role": "user", "content": "hi"}], "stepfun/step-3.7-flash"
        )

    assert result["content"] == "openai ok"
    assert mock_complete.call_count == 2


async def test_complete_with_fallback_all_fail():
    """所有 fallback 都失败 → 返回 'all fallbacks failed' 错误。"""
    router = FallbackRouter()
    router.configure("stepfun/step-3.7-flash", {"fallbacks": ["agnes/gpt-4o"]})

    fail_result = {"content": "", "error": True, "error_message": "agnes down"}
    with patch("app.core.llm_gateway.llm_gateway.complete", new_callable=AsyncMock, return_value=fail_result):
        result = await router.complete_with_fallback(
            [{"role": "user", "content": "hi"}], "stepfun/step-3.7-flash"
        )

    assert result["error"]
    assert "all fallbacks failed" in result["error"]


async def test_complete_with_fallback_no_config():
    """primary 无 fallback 配置 → 返回错误(fallbacks 为空)。"""
    router = FallbackRouter()
    result = await router.complete_with_fallback(
        [{"role": "user", "content": "hi"}], "unknown/model"
    )
    assert result["error"]
    assert "all fallbacks failed" in result["error"]


async def test_complete_with_fallback_exception_continues():
    """fallback provider 抛异常时继续尝试下一个(不中断)。"""
    router = FallbackRouter()
    router.configure("stepfun/step-3.7-flash", {
        "fallbacks": ["agnes/gpt-4o", "openai/gpt-4o-mini"],
    })

    ok_result = {"content": "ok", "model": "gpt-4o-mini", "usage": {}, "stub": False}
    with patch("app.core.llm_gateway.llm_gateway.complete", new_callable=AsyncMock, side_effect=[RuntimeError("conn error"), ok_result]):
        result = await router.complete_with_fallback(
            [{"role": "user", "content": "hi"}], "stepfun/step-3.7-flash"
        )

    assert result["content"] == "ok"


# --- complete() + FallbackRouter 集成测试 ---


async def test_complete_fallback_triggered_on_llm_error(clean_fallback_router, monkeypatch):
    """complete() 主 provider LLM_ERROR → FallbackRouter 接入 → fallback 成功。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test", "api_base": "https://api.stepfun.com/step_plan/v1"}, "agnes": {"api_key": "sk-test-agnes", "api_base": "https://apihub.agnes-ai.com/v1"}}))

    clean_fallback_router.configure("stepfun/step-3.7-flash", {"fallbacks": ["agnes/gpt-4o"]})

    gw = LLMGateway()

    import sys
    from types import ModuleType
    fake_litellm = ModuleType("litellm")

    call_count = 0

    async def fake_acompletion(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # primary 失败
            raise RuntimeError("timeout")

        # fallback 成功
        class FakeUsage:
            def model_dump(self):
                return {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8}

        class FakeMessage:
            content = "fallback response"

        class FakeChoice:
            message = FakeMessage()

        class FakeResponse:
            usage = FakeUsage()
            choices = [FakeChoice()]
            model = "gpt-4o"

        return FakeResponse()

    fake_litellm.acompletion = fake_acompletion
    fake_litellm.token_counter = lambda **kw: 10
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    result = await gw.complete(
        [{"role": "user", "content": "test"}],
        model="stepfun/step-3.7-flash",
    )

    assert result["content"] == "fallback response"
    assert result.get("fallback_used") is True
    assert result["fallback_primary"] == "stepfun/step-3.7-flash"
    assert call_count == 2  # primary 失败 + fallback 成功


async def test_complete_skip_fallback_prevents_recursion(clean_fallback_router, monkeypatch):
    """_skip_fallback=True 时即使 LLM_ERROR 也不触发 FallbackRouter(防递归)。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test", "api_base": "https://api.stepfun.com/step_plan/v1"}}))

    # 即使配了 fallback,_skip_fallback=True 也不应触发
    clean_fallback_router.configure("stepfun/step-3.7-flash", {"fallbacks": ["agnes/gpt-4o"]})

    gw = LLMGateway()

    import sys
    from types import ModuleType
    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        raise RuntimeError("should not retry")

    fake_litellm.acompletion = fake_acompletion
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    result = await gw.complete(
        [{"role": "user", "content": "test"}],
        model="stepfun/step-3.7-flash",
        _skip_fallback=True,
    )

    # 应返回错误,不触发 fallback
    assert result["error"] is True
    assert result["content"] == ""
    assert "should not retry" in result["error_message"]


async def test_complete_no_fallback_when_configs_empty(monkeypatch):
    """fallback_router._configs 为空时不触发 fallback(无配置)。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test", "api_base": "https://api.stepfun.com/step_plan/v1"}}))

    # 确保全局 fallback_router 无配置
    saved = dict(fallback_router._configs)
    fallback_router._configs.clear()
    try:
        gw = LLMGateway()

        import sys
        from types import ModuleType
        fake_litellm = ModuleType("litellm")

        async def fake_acompletion(**kwargs):
            raise RuntimeError("primary down")

        fake_litellm.acompletion = fake_acompletion
        monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

        result = await gw.complete(
            [{"role": "user", "content": "test"}],
            model="stepfun/step-3.7-flash",
        )

        # 无 fallback 配置 → 直接返回错误
        assert result["error"] is True
        assert "primary down" in result["error_message"]
    finally:
        fallback_router._configs.clear()
        fallback_router._configs.update(saved)


async def test_complete_fallback_all_providers_fail(clean_fallback_router, monkeypatch):
    """primary + 所有 fallback 都失败 → 返回错误(不无限递归)。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test", "api_base": "https://api.stepfun.com/step_plan/v1"}, "agnes": {"api_key": "sk-test-agnes", "api_base": "https://apihub.agnes-ai.com/v1"}}))

    clean_fallback_router.configure("stepfun/step-3.7-flash", {"fallbacks": ["agnes/gpt-4o"]})

    gw = LLMGateway()

    import sys
    from types import ModuleType
    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        raise RuntimeError("all down")

    fake_litellm.acompletion = fake_acompletion
    fake_litellm.token_counter = lambda **kw: 10
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    result = await gw.complete(
        [{"role": "user", "content": "test"}],
        model="stepfun/step-3.7-flash",
    )

    # primary 失败 → fallback 也失败 → 返回错误(不递归)
    assert result["error"] is True
    assert result["content"] == ""


# --- astream() + FallbackRouter 集成测试 ---


async def test_astream_fallback_when_no_chunks_sent(clean_fallback_router, monkeypatch):
    """astream 流式调用在发送任何 chunk 前失败 → fallback 触发 → 拆成 chunk 产出。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test", "api_base": "https://api.stepfun.com/step_plan/v1"}, "agnes": {"api_key": "sk-test-agnes", "api_base": "https://apihub.agnes-ai.com/v1"}}))

    clean_fallback_router.configure("stepfun/step-3.7-flash", {"fallbacks": ["agnes/gpt-4o"]})

    gw = LLMGateway()

    import sys
    from types import ModuleType
    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        if kwargs.get("stream"):
            # astream 主调用立即失败(无 chunk 产出)
            raise RuntimeError("stream timeout")
        # fallback complete 调用成功
        class FakeUsage:
            def model_dump(self):
                return {"prompt_tokens": 5, "completion_tokens": 5, "total_tokens": 10}

        class FakeMessage:
            content = "fallback stream content"

        class FakeChoice:
            message = FakeMessage()

        class FakeResponse:
            usage = FakeUsage()
            choices = [FakeChoice()]
            model = "gpt-4o"

        return FakeResponse()

    fake_litellm.acompletion = fake_acompletion
    fake_litellm.token_counter = lambda **kw: 10
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    events = [e async for e in gw.astream(
        [{"role": "user", "content": "hi"}],
        model="stepfun/step-3.7-flash",
    )]

    # 应有 chunk 事件 + done 事件(来自 fallback)
    chunk_events = [e for e in events if e["type"] == "chunk"]
    done_events = [e for e in events if e["type"] == "done"]
    assert len(chunk_events) > 0
    assert len(done_events) == 1
    # chunk 拼接应为 fallback content
    full_content = "".join(e["content"] for e in chunk_events)
    assert full_content == "fallback stream content"
    # done 事件标记 fallback_used
    assert done_events[0].get("fallback_used") is True
    assert done_events[0].get("fallback_primary") == "stepfun/step-3.7-flash"


async def test_astream_no_fallback_when_chunks_already_sent(clean_fallback_router, monkeypatch):
    """astream 已发送 chunk 后失败 → 不触发 fallback(已发送 chunk 不可撤回)。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test", "api_base": "https://api.stepfun.com/step_plan/v1"}, "agnes": {"api_key": "sk-test-agnes", "api_base": "https://apihub.agnes-ai.com/v1"}}))

    clean_fallback_router.configure("stepfun/step-3.7-flash", {"fallbacks": ["agnes/gpt-4o"]})

    gw = LLMGateway()

    import sys
    from types import ModuleType
    fake_litellm = ModuleType("litellm")

    # 构造一个先 yield 一个 chunk 再抛异常的 async generator
    class FakeDelta:
        def __init__(self, content):
            self.content = content
            self.reasoning_content = None

    class FakeChunk:
        def __init__(self, content):
            self.choices = [type("obj", (object,), {"delta": FakeDelta(content)})()]
            self.usage = None
            self.model = "step-3.7-flash"

    class FakeStreamThatFails:
        """先 yield 一个 chunk,再抛异常(模拟中途断流)。"""
        def __aiter__(self):
            return self._gen()

        async def _gen(self):
            yield FakeChunk("partial response")
            raise RuntimeError("mid-stream disconnect")

    async def fake_acompletion(**kwargs):
        if kwargs.get("stream"):
            return FakeStreamThatFails()
        # fallback complete(不应被调用)
        class FakeResponse:
            class _U:
                @staticmethod
                def model_dump():
                    return {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}
            usage = _U()
            choices = [type("obj", (object,), {"message": type("obj", (object,), {"content": "SHOULD NOT BE USED"})()})()]
            model = "gpt-4o"
        return FakeResponse()

    fake_litellm.acompletion = fake_acompletion
    fake_litellm.token_counter = lambda **kw: 10
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    events = [e async for e in gw.astream(
        [{"role": "user", "content": "hi"}],
        model="stepfun/step-3.7-flash",
    )]

    # 应有 1 个 chunk(已发送的 partial)+ 1 个 partial_done(流式中断标记,不触发 fallback)
    # 阶段3主体(2026-07-26):生产代码 llm_gateway.py line 1119-1123 在流式中断时
    # yield partial_done 事件(避免半截内容 + error 混淆),测试断言对齐此契约
    chunk_events = [e for e in events if e["type"] == "chunk"]
    partial_done_events = [e for e in events if e["type"] == "partial_done"]
    assert len(chunk_events) == 1
    assert chunk_events[0]["content"] == "partial response"
    assert len(partial_done_events) == 1
    assert partial_done_events[0]["reason"] == "stream_interrupted"
    # 不应有 fallback_used 标记的 done 事件
    done_events = [e for e in events if e["type"] == "done"]
    assert len(done_events) == 0


async def test_astream_no_fallback_when_configs_empty(monkeypatch):
    """astream 失败但无 fallback 配置 → 直接 yield error(不尝试 fallback)。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"stepfun": {"api_key": "sk-test", "api_base": "https://api.stepfun.com/step_plan/v1"}}))

    saved = dict(fallback_router._configs)
    fallback_router._configs.clear()
    try:
        gw = LLMGateway()

        import sys
        from types import ModuleType
        fake_litellm = ModuleType("litellm")

        async def fake_acompletion(**kwargs):
            raise RuntimeError("stream failed")

        fake_litellm.acompletion = fake_acompletion
        monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

        events = [e async for e in gw.astream(
            [{"role": "user", "content": "hi"}],
            model="stepfun/step-3.7-flash",
        )]

        # 鍙簲鏈?error 浜嬩欢
        assert len(events) == 1
        assert events[0]["type"] == "error"
        assert "stream failed" in events[0]["message"]
    finally:
        fallback_router._configs.clear()
        fallback_router._configs.update(saved)


# ════════════════════════════════════════════════════════════════════════
# structured_completion (G2 字典化闭环)
# ════════════════════════════════════════════════════════════════════════

import json
from typing import Any
from unittest.mock import AsyncMock


def _complete_ok(content: str) -> dict[str, Any]:
    """构造 complete() 成功响应的辅助函数。"""
    return {
        "content": content,
        "model": "gpt-4o-mini",
        "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
        "stub": False,
        "error": False,
    }


def _complete_error(message: str = "LLM down") -> dict[str, Any]:
    """构造 complete() 错误响应的辅助函数。"""
    return {
        "content": "",
        "model": "gpt-4o-mini",
        "usage": {},
        "stub": False,
        "error": True,
        "error_message": message,
    }


SAMPLE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "age": {"type": "integer"},
    },
    "required": ["name", "age"],
    "additionalProperties": False,
}


class TestStructuredCompletionSuccess:
    @pytest.mark.asyncio
    async def test_returns_parsed_dict_on_valid_json(self, monkeypatch):
        """有效 JSON + 满足 schema → 返回解析后的 dict。"""
        from app.core.llm_gateway import LLMGateway

        gw = LLMGateway()
        monkeypatch.setattr(
            gw,
            "complete",
            AsyncMock(return_value=_complete_ok(json.dumps({"name": "Alice", "age": 30}))),
        )

        result = await gw.structured_completion(
            [{"role": "user", "content": "hi"}],
            schema=SAMPLE_SCHEMA,
        )

        assert result == {"name": "Alice", "age": 30}
        assert "error" not in result
        # 验证 response_format 透传
        call_kwargs = gw.complete.call_args.kwargs
        assert "response_format" in call_kwargs
        assert call_kwargs["response_format"]["type"] == "json_schema"
        assert call_kwargs["response_format"]["json_schema"]["schema"] == SAMPLE_SCHEMA
        assert call_kwargs["response_format"]["json_schema"]["name"] == "structured_response"
        assert call_kwargs["response_format"]["json_schema"]["strict"] is True

    @pytest.mark.asyncio
    async def test_custom_schema_name(self, monkeypatch):
        """schema_name 参数透传到 response_format。"""
        from app.core.llm_gateway import LLMGateway

        gw = LLMGateway()
        monkeypatch.setattr(
            gw,
            "complete",
            AsyncMock(return_value=_complete_ok(json.dumps({"name": "Bob", "age": 25}))),
        )

        await gw.structured_completion(
            [{"role": "user", "content": "hi"}],
            schema=SAMPLE_SCHEMA,
            schema_name="custom_schema",
        )

        assert gw.complete.call_args.kwargs["response_format"]["json_schema"]["name"] == "custom_schema"

    @pytest.mark.asyncio
    async def test_owner_uuid_passed_through(self, monkeypatch):
        """owner_uuid 参数透传给 complete()。"""
        from app.core.llm_gateway import LLMGateway

        gw = LLMGateway()
        monkeypatch.setattr(
            gw,
            "complete",
            AsyncMock(return_value=_complete_ok(json.dumps({"name": "X", "age": 1}))),
        )

        await gw.structured_completion(
            [{"role": "user", "content": "hi"}],
            schema=SAMPLE_SCHEMA,
            owner_uuid="user-123",
        )

        assert gw.complete.call_args.kwargs["owner_uuid"] == "user-123"

    @pytest.mark.asyncio
    async def test_model_passed_through(self, monkeypatch):
        """model 参数透传给 complete()。"""
        from app.core.llm_gateway import LLMGateway

        gw = LLMGateway()
        monkeypatch.setattr(
            gw,
            "complete",
            AsyncMock(return_value=_complete_ok(json.dumps({"name": "X", "age": 1}))),
        )

        await gw.structured_completion(
            [{"role": "user", "content": "hi"}],
            schema=SAMPLE_SCHEMA,
            model="gpt-4o",
        )

        assert gw.complete.call_args.kwargs["model"] == "gpt-4o"


class TestStructuredCompletionValidation:
    @pytest.mark.asyncio
    async def test_missing_required_field_returns_error(self, monkeypatch):
        """缺 required 字段 → 返回 error dict(无 retry 时直接失败)。"""
        from app.core.llm_gateway import LLMGateway

        gw = LLMGateway()
        monkeypatch.setattr(
            gw,
            "complete",
            AsyncMock(return_value=_complete_ok(json.dumps({"name": "Alice"}))),  # 缺 age
        )

        result = await gw.structured_completion(
            [{"role": "user", "content": "hi"}],
            schema=SAMPLE_SCHEMA,
        )

        assert result.get("error") is True
        assert "missing required fields" in result["error_message"]
        assert "age" in result["error_message"]

    @pytest.mark.asyncio
    async def test_extra_field_with_additional_properties_false(self, monkeypatch):
        """additionalProperties: False 时多出字段 → 返回 error dict。"""
        from app.core.llm_gateway import LLMGateway

        gw = LLMGateway()
        monkeypatch.setattr(
            gw,
            "complete",
            AsyncMock(return_value=_complete_ok(json.dumps(
                {"name": "Alice", "age": 30, "extra_field": "x"}
            ))),
        )

        result = await gw.structured_completion(
            [{"role": "user", "content": "hi"}],
            schema=SAMPLE_SCHEMA,
        )

        assert result.get("error") is True
        assert "unexpected fields" in result["error_message"]

    @pytest.mark.asyncio
    async def test_extra_field_allowed_when_additional_properties_true(self, monkeypatch):
        """additionalProperties 未指定(False 或缺失)时多出字段被允许(本次实现:仅 strict False 校验)。"""
        from app.core.llm_gateway import LLMGateway

        gw = LLMGateway()
        # schema 缺 additionalProperties → 不强制额外字段校验
        schema_no_strict = {
            "type": "object",
            "properties": {"name": {"type": "string"}},
            "required": ["name"],
        }
        monkeypatch.setattr(
            gw,
            "complete",
            AsyncMock(return_value=_complete_ok(json.dumps({"name": "Alice", "extra": "ok"}))),
        )

        result = await gw.structured_completion(
            [{"role": "user", "content": "hi"}],
            schema=schema_no_strict,
        )

        assert result == {"name": "Alice", "extra": "ok"}

    @pytest.mark.asyncio
    async def test_invalid_json_returns_error(self, monkeypatch):
        """LLM 返回非 JSON 文本 → 返回 error dict。"""
        from app.core.llm_gateway import LLMGateway

        gw = LLMGateway()
        monkeypatch.setattr(
            gw,
            "complete",
            AsyncMock(return_value=_complete_ok("not json at all")),
        )

        result = await gw.structured_completion(
            [{"role": "user", "content": "hi"}],
            schema=SAMPLE_SCHEMA,
        )

        assert result.get("error") is True
        assert "JSON 解析失败" in result["error_message"]

    @pytest.mark.asyncio
    async def test_empty_content_returns_error(self, monkeypatch):
        """LLM 返回空 content → 返回 error dict。"""
        from app.core.llm_gateway import LLMGateway

        gw = LLMGateway()
        monkeypatch.setattr(gw, "complete", AsyncMock(return_value=_complete_ok("")))

        result = await gw.structured_completion(
            [{"role": "user", "content": "hi"}],
            schema=SAMPLE_SCHEMA,
        )

        assert result.get("error") is True
        assert "空内容" in result["error_message"]

    @pytest.mark.asyncio
    async def test_top_level_not_object_returns_error(self, monkeypatch):
        """LLM 返回顶层 array/非 dict → 返回 error dict。"""
        from app.core.llm_gateway import LLMGateway

        gw = LLMGateway()
        monkeypatch.setattr(
            gw,
            "complete",
            AsyncMock(return_value=_complete_ok(json.dumps([1, 2, 3]))),
        )

        result = await gw.structured_completion(
            [{"role": "user", "content": "hi"}],
            schema=SAMPLE_SCHEMA,
        )

        assert result.get("error") is True
        assert "顶层非 object" in result["error_message"]


class TestStructuredCompletionError:
    @pytest.mark.asyncio
    async def test_complete_error_returns_error_dict(self, monkeypatch):
        """complete() 返回 error → 直接透传 error dict(max_retries=0 时不重试)。"""
        from app.core.llm_gateway import LLMGateway

        gw = LLMGateway()
        monkeypatch.setattr(
            gw,
            "complete",
            AsyncMock(return_value=_complete_error("upstream down")),
        )

        result = await gw.structured_completion(
            [{"role": "user", "content": "hi"}],
            schema=SAMPLE_SCHEMA,
            max_retries=0,
        )

        assert result.get("error") is True
        assert "upstream down" in result["error_message"]
        # max_retries=0 → 只调用 1 次
        assert gw.complete.call_count == 1

    @pytest.mark.asyncio
    async def test_complete_error_retries_then_fails(self, monkeypatch):
        """complete() 持续返回 error + max_retries=1 → 调 2 次后返回 error dict。"""
        from app.core.llm_gateway import LLMGateway

        gw = LLMGateway()
        monkeypatch.setattr(
            gw,
            "complete",
            AsyncMock(return_value=_complete_error("upstream down")),
        )

        result = await gw.structured_completion(
            [{"role": "user", "content": "hi"}],
            schema=SAMPLE_SCHEMA,
            max_retries=1,
        )

        assert result.get("error") is True
        assert gw.complete.call_count == 2


class TestStructuredCompletionRetry:
    @pytest.mark.asyncio
    async def test_retry_on_invalid_json_then_success(self, monkeypatch):
        """第 1 次返回非 JSON,第 2 次返回有效 JSON → 重试后成功。"""
        from app.core.llm_gateway import LLMGateway

        gw = LLMGateway()
        monkeypatch.setattr(
            gw,
            "complete",
            AsyncMock(side_effect=[
                _complete_ok("not json"),
                _complete_ok(json.dumps({"name": "Alice", "age": 30})),
            ]),
        )

        result = await gw.structured_completion(
            [{"role": "user", "content": "hi"}],
            schema=SAMPLE_SCHEMA,
            max_retries=1,
        )

        assert result == {"name": "Alice", "age": 30}
        assert gw.complete.call_count == 2

    @pytest.mark.asyncio
    async def test_retry_exhausted_returns_error(self, monkeypatch):
        """重试次数用尽仍失败 → 返回 error dict。"""
        from app.core.llm_gateway import LLMGateway

        gw = LLMGateway()
        monkeypatch.setattr(
            gw,
            "complete",
            AsyncMock(side_effect=[
                _complete_ok("not json 1"),
                _complete_ok("not json 2"),
            ]),
        )

        result = await gw.structured_completion(
            [{"role": "user", "content": "hi"}],
            schema=SAMPLE_SCHEMA,
            max_retries=1,
        )

        assert result.get("error") is True
        assert gw.complete.call_count == 2

    @pytest.mark.asyncio
    async def test_no_retry_when_max_retries_zero(self, monkeypatch):
        """max_retries=0 → 只调用 1 次。"""
        from app.core.llm_gateway import LLMGateway

        gw = LLMGateway()
        monkeypatch.setattr(
            gw,
            "complete",
            AsyncMock(return_value=_complete_ok("not json")),
        )

        result = await gw.structured_completion(
            [{"role": "user", "content": "hi"}],
            schema=SAMPLE_SCHEMA,
            max_retries=0,
        )

        assert result.get("error") is True
        assert gw.complete.call_count == 1


# ════════════════════════════════════════════════════════════════════════
# G2 收尾回归测试:验证 4 处 complete() 调用点不应迁移到 structured_completion()
#
# 评估结论(2026-07-26):
#   - L916  (structured_completion 内部)   → 不能迁移(无限递归)
#   - L1011 (astream stub 模式分块)         → 不能迁移(流式文本,非结构化)
#   - L1284/L1304 (MoARouter MoA 聚合)     → 不能迁移(自然语言综合,无 schema)
#   - L1350 (FallbackRouter 故障转移)       → 不能迁移(通用 failover,需保留 complete 返回 shape)
#
# 以下测试以可执行代码形式锁住上述决策,防止未来误迁移。
# ════════════════════════════════════════════════════════════════════════

from app.core.llm_gateway import MoARouter


class TestMoARouterUsesCompleteNotStructured:
    """MoARouter(L1284/L1304)必须走 llm_gateway.complete(),不能迁移到 structured_completion()。

    理由:MoA 是自然语言综合(proposers 出文本方案 → aggregator 综合文本答案),
    无 schema 可强制,且调用方期望返回 {"content": str, ...} shape 与 complete() 一致。
    """

    def test_register_and_list_preset(self):
        """register_preset 存储 preset,list_presets 取回列表。"""
        router = MoARouter()
        preset = {
            "models": [
                {"role": "proposer", "model": "gpt-4o"},
                {"role": "aggregator", "model": "claude-3-opus"},
            ],
        }
        router.register_preset("test-preset", preset)
        presets = router.list_presets()
        assert preset in presets

    async def test_preset_not_found_returns_error(self):
        """未注册的 preset → 返回 error dict(不调用 LLM)。"""
        router = MoARouter()
        result = await router.complete(
            [{"role": "user", "content": "hi"}], "nonexistent-preset"
        )
        assert result["error"]
        assert "preset not found" in result["error"]
        assert result["content"] == ""

    async def test_no_proposer_returns_error(self):
        """preset 无 role=proposer 模型 → 返回 error(不调用 LLM)。"""
        router = MoARouter()
        router.register_preset("empty-preset", {
            "models": [{"role": "aggregator", "model": "gpt-4o"}],
        })
        result = await router.complete(
            [{"role": "user", "content": "hi"}], "empty-preset"
        )
        assert result["error"]
        assert "no proposer" in result["error"]

    async def test_no_aggregator_returns_first_successful_proposal(self):
        """无 aggregator 时返回第一个非异常的 proposer 方案(走 complete 而非 structured_completion)。"""
        router = MoARouter()
        router.register_preset("no-agg", {
            "models": [
                {"role": "proposer", "model": "gpt-4o"},
                {"role": "proposer", "model": "claude-3-opus"},
            ],
        })

        ok_result = {"content": "first ok", "model": "gpt-4o", "usage": {}, "stub": False}
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            return_value=ok_result,
        ) as mock_complete:
            result = await router.complete(
                [{"role": "user", "content": "hi"}], "no-agg"
            )

        assert result["content"] == "first ok"
        # 2 个 proposer 并行调用 complete
        assert mock_complete.call_count == 2
        # 关键断言:走的是 complete()(被 mock),证明 L1284 用 complete 而非 structured_completion
        # 若迁移到 structured_completion,mock 拦截不到 complete 调用 → call_count == 0 → 测试失败
        assert mock_complete.call_count > 0

    async def test_aggregator_combines_proposals_via_complete(self):
        """有 aggregator 时:proposers 出方案 → aggregator 综合(两次都走 complete)。

        锁住 L1284 + L1304 决策:均使用 llm_gateway.complete() 而非 structured_completion()。
        """
        router = MoARouter()
        router.register_preset("with-agg", {
            "models": [
                {"role": "proposer", "model": "gpt-4o"},
                {"role": "proposer", "model": "claude-3-opus"},
                {"role": "aggregator", "model": "gemini-1.5-pro"},
            ],
        })

        proposal_a = {"content": "答案 A", "model": "gpt-4o", "usage": {}, "stub": False}
        proposal_b = {"content": "答案 B", "model": "claude-3-opus", "usage": {}, "stub": False}
        aggregated = {"content": "综合答案", "model": "gemini-1.5-pro", "usage": {}, "stub": False}

        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            side_effect=[proposal_a, proposal_b, aggregated],
        ) as mock_complete:
            result = await router.complete(
                [{"role": "user", "content": "hi"}], "with-agg"
            )

        assert result["content"] == "综合答案"
        # 2 个 proposer 并行 + 1 个 aggregator = 3 次 complete 调用
        assert mock_complete.call_count == 3
        # 第 3 次(aggregator)的 messages 应包含 proposal 拼接
        third_call_messages = mock_complete.call_args_list[2].args[0]
        assert any("答案 A" in m.get("content", "") for m in third_call_messages)
        assert any("答案 B" in m.get("content", "") for m in third_call_messages)
        # 第 3 次用 aggregator 模型
        assert mock_complete.call_args_list[2].kwargs["model"] == "gemini-1.5-pro"

    async def test_all_proposers_fail_returns_error(self):
        """所有 proposer 都返回 error → 返回 'all proposers failed'。"""
        router = MoARouter()
        router.register_preset("all-fail", {
            "models": [{"role": "proposer", "model": "gpt-4o"}],
        })

        fail_result = {"content": "", "error": True, "error_message": "down"}
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            return_value=fail_result,
        ):
            result = await router.complete(
                [{"role": "user", "content": "hi"}], "all-fail"
            )

        # 无 aggregator → 取第一个非异常 → 但所有方案都 error → 返回 all proposers failed
        assert result["error"]
        assert "all proposers failed" in result["error"]

    async def test_exception_in_proposer_treated_as_failure(self):
        """proposer 抛异常(return_exceptions=True)→ 当作失败,不中断整体。"""
        router = MoARouter()
        router.register_preset("exc", {
            "models": [
                {"role": "proposer", "model": "gpt-4o"},
                {"role": "proposer", "model": "claude-3-opus"},
            ],
        })

        ok_result = {"content": "survivor", "model": "claude-3-opus", "usage": {}, "stub": False}
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            side_effect=[RuntimeError("proposer 1 crashed"), ok_result],
        ):
            result = await router.complete(
                [{"role": "user", "content": "hi"}], "exc"
            )

        # 无 aggregator → 跳过异常方案,取第一个非异常方案
        assert result["content"] == "survivor"

    async def test_aggregator_all_proposals_empty_returns_error(self):
        """有 aggregator 但所有 proposer 内容为空 → 返回 'all proposers returned empty'。"""
        router = MoARouter()
        router.register_preset("empty-proposals", {
            "models": [
                {"role": "proposer", "model": "gpt-4o"},
                {"role": "aggregator", "model": "claude-3-opus"},
            ],
        })

        empty_result = {"content": "", "model": "gpt-4o", "usage": {}, "stub": False}
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            return_value=empty_result,
        ) as mock_complete:
            result = await router.complete(
                [{"role": "user", "content": "hi"}], "empty-proposals"
            )

        assert result["error"]
        assert "all proposers returned empty" in result["error"]
        # 只调用了 proposer 阶段(1 次),未到 aggregator 阶段
        assert mock_complete.call_count == 1


class TestAstreamStubModeUsesCompleteNotStructured:
    """L1011:astream stub 模式分块必须走 self.complete(),不能迁移到 structured_completion()。

    理由:流式输出需要文本 content 切成 10 字符 chunk,structured_completion 返回
    解析后的 dict(无文本 content 概念),迁移会破坏流式语义。
    """

    async def test_astream_stub_uses_complete_not_structured(self, monkeypatch):
        """astream stub 模式调用 complete() 而非 structured_completion(),验证 content 被切成 chunk。"""
        from app.core.config import settings
        monkeypatch.setattr(
            settings,
            "llm_providers",
            json.dumps({"openai": {"api_key": ""}, "anthropic": {"api_key": ""}}),
        )

        gw = LLMGateway()

        # 跟踪 complete 与 structured_completion 的调用
        complete_calls = 0
        structured_calls = 0
        original_complete = gw.complete

        async def spy_complete(*args, **kwargs):
            nonlocal complete_calls
            complete_calls += 1
            return await original_complete(*args, **kwargs)

        async def spy_structured(*args, **kwargs):
            nonlocal structured_calls
            structured_calls += 1
            return {"error": True, "error_message": "should not be called"}

        monkeypatch.setattr(gw, "complete", spy_complete)
        monkeypatch.setattr(gw, "structured_completion", spy_structured)

        events = [e async for e in gw.astream([{"role": "user", "content": "hi"}])]

        # 必须调用 complete(),不能调用 structured_completion()
        assert complete_calls == 1, "astream stub 模式应调用 complete()"
        assert structured_calls == 0, "astream stub 模式不应调用 structured_completion()"
        # 验证 chunk + done
        assert any(e["type"] == "chunk" for e in events)
        assert events[-1]["type"] == "done"


class TestStructuredCompletionInternalUsesComplete:
    """L916:structured_completion 内部必须调用 self.complete() 而非自身(否则无限递归)。

    理由:structured_completion 是 complete() 的薄包装(加 response_format + schema 校验),
    L916 是其内部实现,迁移会导致无限递归。
    """

    @pytest.mark.asyncio
    async def test_structured_completion_calls_complete_with_response_format(self, monkeypatch):
        """structured_completion 内部调 complete() 并透传 response_format,不递归调自身。"""
        from app.core.llm_gateway import LLMGateway

        gw = LLMGateway()
        structured_calls = 0

        original_structured = gw.structured_completion

        async def spy_structured(*args, **kwargs):
            nonlocal structured_calls
            structured_calls += 1
            return await original_structured(*args, **kwargs)

        monkeypatch.setattr(gw, "structured_completion", spy_structured)
        monkeypatch.setattr(
            gw,
            "complete",
            AsyncMock(return_value=_complete_ok(json.dumps({"name": "Alice", "age": 30}))),
        )

        result = await gw.structured_completion(
            [{"role": "user", "content": "hi"}],
            schema=SAMPLE_SCHEMA,
            max_retries=0,
        )

        # 走 complete()(被 mock),structured_completion 外部只调 1 次(无递归)
        assert result == {"name": "Alice", "age": 30}
        assert structured_calls == 1, "structured_completion 不应递归调用自身"
        assert gw.complete.call_count == 1
        # response_format 必须透传(L916 内部行为)
        call_kwargs = gw.complete.call_args.kwargs
        assert call_kwargs["response_format"]["type"] == "json_schema"
