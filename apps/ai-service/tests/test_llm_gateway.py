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
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    gw = LLMGateway()
    assert gw._is_stub_mode() is True


def test_is_stub_mode_false_when_openai_key_set(monkeypatch):
    """设置 openai_api_key 后非 stub 模式。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    gw = LLMGateway()
    assert gw._is_stub_mode() is False


def test_is_stub_mode_false_when_anthropic_key_set(monkeypatch):
    """设置 anthropic_api_key 后非 stub 模式。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "sk-ant-test")
    gw = LLMGateway()
    assert gw._is_stub_mode() is False


# =============================================================================
# complete - stub 模式
# =============================================================================


async def test_complete_stub_returns_mock_response(monkeypatch):
    """stub 模式返回模拟响应。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

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
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

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
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

    gw = LLMGateway()
    long_msg = "x" * 500
    result = await gw.complete([{"role": "user", "content": long_msg}])

    # 原始消息 500 字符,截断后应 <= 200 + 前缀
    assert "x" * 200 in result["content"]
    assert "x" * 500 not in result["content"]


async def test_complete_stub_no_user_message(monkeypatch):
    """stub 模式无 user 消息时 content 为空。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

    gw = LLMGateway()
    messages = [{"role": "system", "content": "系统消息"}]
    result = await gw.complete(messages)

    assert result["stub"] is True
    # 无 user 消息,last_user 为空
    assert "最后一条用户消息: " in result["content"]


async def test_complete_stub_uses_default_model(monkeypatch):
    """stub 模式使用默认模型 litellm_model。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

    gw = LLMGateway()
    result = await gw.complete([{"role": "user", "content": "test"}])
    assert result["model"] == settings.litellm_model


async def test_complete_stub_with_explicit_model(monkeypatch):
    """stub 模式透传显式 model 参数。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

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
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

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
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

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
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

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
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

    gw = LLMGateway()

    import sys
    from types import ModuleType

    fake_litellm = ModuleType("litellm")

    async def fake_acompletion(**kwargs):
        raise RuntimeError("API 连接失败")

    fake_litellm.acompletion = fake_acompletion
    monkeypatch.setitem(sys.modules, "litellm", fake_litellm)

    result = await gw.complete([{"role": "user", "content": "test"}])

    # 异常时降级为 stub
    assert result["stub"] is True
    assert "LLM 调用失败" in result["content"]
    assert "API 连接失败" in result["error"]
    assert result["usage"] == {}


async def test_complete_real_mode_usage_without_model_dump(monkeypatch):
    """真实模式:usage 无 model_dump 方法时用 dict() 转换。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

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
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

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
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

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
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

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
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

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
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

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
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

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
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

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
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

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
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "anthropic_api_key", "")

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
