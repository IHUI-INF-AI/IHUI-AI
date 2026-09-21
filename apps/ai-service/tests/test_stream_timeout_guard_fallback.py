# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""极速API 流式 timeout-guard 占位块自动非流式回退单测(2026-09-18)。

背景:极速API(x5m5x)上游「流式+工具调用」模式整体降级时,约 45s 后仅回
id="chatcmpl-timeout-guard" 的占位 chunk(内容 "[req_xxx] [model]\\n**Request
exceeded ...**"),随后直接 [DONE];同参数非流式请求完全正常。
llm_gateway.astream 检测到 guard chunk 后应:放弃该流 → 改非流式重试 →
把非流式结果包装成等价事件流(chunk/reasoning/tool_calls/usage/done)。
"""

import json
import sys
from types import ModuleType, SimpleNamespace

import pytest

from app.core.config import settings
from app.core.llm_gateway import LLMGateway, _is_stream_timeout_guard

_GUARD_CHUNK_ID = "chatcmpl-timeout-guard"
_GUARD_CONTENT = "[req_ab12cd34] [glm-5.3-flash]\n**Request exceeded time limit**"


def _fake_litellm_module(monkeypatch, stream_responses, non_stream_response, call_log):
    """注入假 litellm:stream=True 依次弹出 stream_responses,否则返回 non_stream_response。"""
    fake = ModuleType("litellm")

    class FakeGuardStream:
        """模拟降级流:首个 chunk 为 guard 占位,随后 [DONE](流自然结束)。"""

        def __init__(self, chunks):
            self._chunks = list(chunks)
            self.closed = False

        def __aiter__(self):
            self._iter = iter(self._chunks)
            return self

        async def __anext__(self):
            try:
                return next(self._iter)
            except StopIteration as e:
                raise StopAsyncIteration from e

        async def aclose(self):
            self.closed = True

    async def fake_acompletion(**kwargs):
        call_log.append({"stream": kwargs.get("stream"), "model": kwargs.get("model")})
        if kwargs.get("stream"):
            return FakeGuardStream(stream_responses.pop(0))
        return non_stream_response

    fake.acompletion = fake_acompletion
    monkeypatch.setitem(sys.modules, "litellm", fake)
    return fake


def _delta_chunk(chunk_id: str, content: str | None):
    return SimpleNamespace(
        id=chunk_id,
        choices=[SimpleNamespace(delta=SimpleNamespace(content=content, reasoning_content=None, tool_calls=None))],
        usage=None,
        model="glm-5.3-flash",
    )


def _fake_non_stream_response(content: str, tool_calls=None):
    usage = SimpleNamespace(
        model_dump=lambda: {"prompt_tokens": 12, "completion_tokens": 34, "total_tokens": 46}
    )
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content, reasoning_content=None, tool_calls=tool_calls))],
        usage=usage,
        model="glm-5.3-flash",
    )


def _fake_tool_call(name: str = "get_weather", arguments: str = '{"location": "上海"}'):
    return SimpleNamespace(
        index=None,  # 非流式完整对象无 index,累积器应自动分配序号
        id="call_fb_001",
        type="function",
        function=SimpleNamespace(name=name, arguments=arguments),
    )


@pytest.mark.asyncio
async def test_guard_stream_falls_back_to_non_stream(monkeypatch):
    """guard 占位流 → 放弃并回退非流式:内容不泄漏、tool_calls/usage/done 齐全。"""
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"ihui_relay": {"api_key": "sk-test"}}))
    # 避免 TCP 竞速探测真实端点,固定 base
    monkeypatch.setattr("app.core.llm_gateway._detect_ihui_relay_base", lambda: "https://api.x5m5x.com/v1")
    call_log: list[dict] = []
    guard_stream_chunks = [
        _delta_chunk(_GUARD_CHUNK_ID, _GUARD_CONTENT),
        SimpleNamespace(id=_GUARD_CHUNK_ID, choices=[], usage=None, model="glm-5.3-flash"),
    ]
    non_stream = _fake_non_stream_response("上海今天晴,25 度。", tool_calls=[_fake_tool_call()])
    _fake_litellm_module(monkeypatch, [guard_stream_chunks], non_stream, call_log)

    gw = LLMGateway()
    events = [e async for e in gw.astream([{"role": "user", "content": "上海天气"}], model="ihui/glm-5.3-flash")]

    # 两次调用:先流式后非流式
    assert [c["stream"] for c in call_log] == [True, False]
    # guard 占位内容绝不泄漏到任何 chunk 事件
    chunk_texts = [e["content"] for e in events if e["type"] == "chunk"]
    assert "".join(chunk_texts) == "上海今天晴,25 度。"
    assert not any("Request exceeded" in t or "req_" in t for t in chunk_texts)
    # 非流式 tool_calls 经累积器产出为完整 tool_calls 事件
    tool_events = [e for e in events if e["type"] == "tool_calls"]
    assert len(tool_events) == 1
    tc = tool_events[0]["tool_calls"][0]
    assert tc["id"] == "call_fb_001"
    assert tc["function"]["name"] == "get_weather"
    assert tc["function"]["arguments"] == '{"location": "上海"}'
    # usage 来自非流式响应;done 正常收尾
    done = events[-1]
    assert done["type"] == "done"
    assert done["usage"]["total_tokens"] == 46
    assert done["model"] == "glm-5.3-flash"
    assert done["stub"] is False


@pytest.mark.asyncio
async def test_normal_stream_does_not_fallback(monkeypatch):
    """负向:正常流(id 非守卫)不触发回退,acompletion 仅调用一次。"""
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"ihui_relay": {"api_key": "sk-test"}}))
    monkeypatch.setattr("app.core.llm_gateway._detect_ihui_relay_base", lambda: "https://api.x5m5x.com/v1")
    call_log: list[dict] = []
    normal_chunks = [
        _delta_chunk("chatcmpl-abc123", "你好"),
        _delta_chunk("chatcmpl-abc123", "呀"),
    ]
    _fake_litellm_module(monkeypatch, [normal_chunks], _fake_non_stream_response("不应出现"), call_log)

    gw = LLMGateway()
    events = [e async for e in gw.astream([{"role": "user", "content": "hi"}], model="ihui/glm-5.3-flash")]

    assert len(call_log) == 1 and call_log[0]["stream"] is True
    chunk_texts = [e["content"] for e in events if e["type"] == "chunk"]
    assert "".join(chunk_texts) == "你好呀"
    done = events[-1]
    assert done["type"] == "done" and done["stub"] is False
    # 无 usage 来源 → 走 token_counter 估算兜底,不报错即可
    assert "usage" in done


def test_is_stream_timeout_guard_detection():
    """检测函数:仅精确匹配 guard chunk id,正常 chunk 不误判。"""
    assert _is_stream_timeout_guard(SimpleNamespace(id=_GUARD_CHUNK_ID)) is True
    assert _is_stream_timeout_guard(SimpleNamespace(id="chatcmpl-9f8e7d6c")) is False
    assert _is_stream_timeout_guard(SimpleNamespace(id=None)) is False
    assert _is_stream_timeout_guard(SimpleNamespace()) is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
