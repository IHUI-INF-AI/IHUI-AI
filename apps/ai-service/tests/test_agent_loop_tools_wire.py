# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AgentLoopV2 的 tools 必须真进入模型请求(2026-11-09 根因回归锁)。

立例理由:派工(`POST /agents/execute[/stream]`)在登录态下一轮即止、`status=completed`、
零工具执行、拿不到 exitCode,且不报任何错。逐层取证后定位到 `routers/agents.py` 的
`_make_loop_v2_llm`:内层 `_llm(messages, tools, ...)` **收了 tools 却不转发**,两条分支
(非流式 `complete` / 流式 `astream`)都只带 messages/model ⇒ 模型侧没有 function
calling 可用,于是把调用写成纯文本,而循环只认 `tool_calls` 字段。

本文件的判据都刻意**只看"转发面上有没有 tools"**,不依赖真实密钥/上游:

1. tools 非空 ⇒ `complete` / `astream` 收到逐字相同的条目;
2. tools 为空(**含 None / 空表 / 全非 function 形**)⇒ kwargs **不得出现 tools 键**
   —— 无工具路径必须与历史逐字节等价,本修复不许顺带改网关的压缩/选路行为;
3. 混合形态只透传 `{"type":"function","function":{...}}` 那几条目(脏输入不得进请求);
4. 上游返回的 `tool_calls` 照旧被转换回循环契约(接线不吞结果);
5. 端到端一跳:用 `AgentLoopV2._build_tools_schema()` 的真实产物喂 `_llm`,证明
   **循环造的那份 schema 就是模型收到的那份**(单点断链即红)。
"""

from typing import Any

import pytest

from app.core.llm_gateway import llm_gateway
from app.routers import agents as agents_router
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition

# 循环侧交给 _llm 的第二形参:两份最小 OpenAI function 形状条目。
_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Run a shell command.",
            "parameters": {
                "type": "object",
                "properties": {"command": {"type": "string"}},
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_context_remaining",
            "description": "Remaining tokens.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]

_MSGS = [{"role": "user", "content": "用 run_command 执行 pwd"}]


class _Capture:
    """记录网关被调用时的实参,返回可控结果(不打真实上游)。"""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def _result(self) -> dict[str, Any]:
        return {
            "content": "ok",
            "tool_calls": [
                {
                    "id": "call_1",
                    "type": "function",
                    "function": {
                        "name": "run_command",
                        "arguments": '{"command": "pwd"}',
                    },
                }
            ],
            "usage": {"total_tokens": 7},
            "model": "stub-model",
            "finish_reason": "tool_calls",
        }

    def make_complete(self) -> Any:
        async def _complete(messages: Any, **kwargs: Any) -> dict[str, Any]:
            self.calls.append(dict(kwargs))
            return self._result()

        return _complete

    def make_astream(self) -> Any:
        async def _astream(messages: Any, **kwargs: Any) -> Any:
            self.calls.append(dict(kwargs))
            yield {"type": "tool_calls", "tool_calls": self._result()["tool_calls"]}
            yield {
                "type": "done",
                "usage": {"total_tokens": 7},
                "model": "stub-model",
                "finishReason": "tool_calls",
                "content": "ok",
            }

        return _astream


@pytest.fixture()
def capture(monkeypatch: Any) -> _Capture:
    cap = _Capture()
    monkeypatch.setattr(llm_gateway, "complete", cap.make_complete())
    monkeypatch.setattr(llm_gateway, "astream", cap.make_astream())
    return cap


@pytest.mark.asyncio
async def test_nonstream_forwards_tools_as_is(capture: _Capture) -> None:
    """非流式:tools 非空 ⇒ kwargs["tools"] 与传入条目逐字相同。"""
    llm = agents_router._make_loop_v2_llm(None)
    out = await llm(_MSGS, _TOOLS)
    assert len(capture.calls) == 1
    assert capture.calls[0].get("tools") == _TOOLS
    # 结果面不被接线动作吞掉
    assert out["tool_calls"], "上游 tool_calls 应回填给循环"
    assert out["content"] == "ok"


@pytest.mark.asyncio
async def test_stream_forwards_tools_as_is(capture: _Capture) -> None:
    """流式(首试那一轮):astream 同样必须收到 tools,否则流式派工仍旧断线。"""

    async def _sink(text: str) -> None:  # pragma: no cover - 本例无 chunk 文本
        pass

    llm = agents_router._make_loop_v2_llm(None)
    out = await llm(_MSGS, _TOOLS, on_chunk=_sink)
    assert len(capture.calls) == 1
    assert capture.calls[0].get("tools") == _TOOLS
    assert out["tool_calls"]


@pytest.mark.asyncio
@pytest.mark.parametrize("empty", [None, [], ""])
async def test_empty_tools_do_not_inject_key(capture: _Capture, empty: Any) -> None:
    """无工具 ⇒ **不得**出现 tools 键:与历史逐字节等价,不借本修复改选路/压缩行为。"""
    llm = agents_router._make_loop_v2_llm(None)
    await llm(_MSGS, empty)
    assert len(capture.calls) == 1
    assert "tools" not in capture.calls[0]


@pytest.mark.asyncio
async def test_dirty_entries_filtered_before_request(capture: _Capture) -> None:
    """混进来的非 function 形条目不得进请求(脏输入不冒充工具面)。"""
    llm = agents_router._make_loop_v2_llm(None)
    await llm(_MSGS, [_TOOLS[0], "垃圾项", {"name": "缺 function 键"}, 42])
    got = capture.calls[0]["tools"]
    assert got == [_TOOLS[0]]


@pytest.mark.asyncio
async def test_whole_then_matches_loop_build_tools_schema(capture: _Capture) -> None:
    """端到端一跳:循环 `_build_tools_schema()` 的产物 = 模型收到的 tools。

    这条是真正的"接线锁":任何一侧改了形状/来源而另一侧没跟,本例即红。
    """

    async def _noop(args: dict[str, Any]) -> dict[str, Any]:  # pragma: no cover
        return {"ok": True}

    loop = AgentLoopV2(
        llm_complete_fn=agents_router._make_loop_v2_llm(None),
        tools=[
            ToolDefinition(
                name="run_command",
                description="Run a shell command.",
                parameters={
                    "type": "object",
                    "properties": {"command": {"type": "string"}},
                    "required": ["command"],
                },
                executor=_noop,
            )
        ],
    )
    schema = loop._build_tools_schema()  # noqa: SLF001 - 本例就是量这个出口
    llm = agents_router._make_loop_v2_llm(None)
    await llm(_MSGS, schema)

    sent = capture.calls[0]["tools"]
    assert sent == schema
    names = [t["function"]["name"] for t in sent]
    assert "run_command" in names, "内置工具必须出现在请求面"
    assert "get_context_remaining" in names, "批 42 暴露项也必须随线送达"
    rc = next(t for t in sent if t["function"]["name"] == "run_command")
    assert rc["function"]["parameters"]["required"] == ["command"], (
        "参数面被抹平 ⇒ 模型看不见 command ⇒ 判『没有这个工具』"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
