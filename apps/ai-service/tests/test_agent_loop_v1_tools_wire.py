# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AgentLoopV1(agent_loop.AgentExecutor)的 tools 必须真进入模型请求。

立例理由:V1 执行器此前四层断链 —— 请求不带 tools、模型没有 function calling;
每轮用 memory 重建 messages 丢掉 assistant.tool_calls / tool.tool_call_id;
call_tool 不透传 user_role(admin 工具全 PERMISSION_DENIED);零工具也报 completed。

本文件只打 V1,判据刻意只看"转发面"与"协议配对",不依赖真实密钥/上游:
1. tools 非空 ⇒ 请求 kwargs 里有 tools;tools=None ⇒ 无 tools 键;
2. 审批门内的工具(run_command)绝不暴露 ⇒ 请求无 tools,且收尾诚实判 failed;
3. 两轮协议:第二轮请求里 assistant.tool_calls 与 tool.tool_call_id 必须配上;
4. stub 降级不算零工具失败(否则无 key 环境全线误报)。
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.services import agent_loop as agent_loop_mod
from app.services.agent_loop import AgentExecutor
from app.services.memory import memory_store


@pytest.fixture(autouse=True)
def force_memory_mode():
    """强制 memory_store 内存模式(测试环境无 Redis)。"""
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()
    yield
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()


@pytest.fixture(autouse=True)
def silence_background(monkeypatch: Any):
    """屏蔽完成后的自进化后台评估(与本次接线无关,避免噪音与待办任务残留)。"""

    async def _noop(*args: Any, **kwargs: Any) -> None:
        return None

    monkeypatch.setattr(agent_loop_mod.meta_learner, "evaluate_and_record", _noop)


class _Capture:
    """记录每次 complete 的 messages/kwargs,按脚本返回响应。"""

    def __init__(self, responses: list[dict[str, Any]]) -> None:
        self._responses = responses
        self.calls: list[dict[str, Any]] = []

    async def _complete(self, messages: Any, model: Any = None, **kwargs: Any) -> dict[str, Any]:
        # 深一层拷贝:后续轮次会原地改 messages,不拷会把"当时"拍成"最终"
        self.calls.append({
            "messages": [dict(m) for m in messages],
            "kwargs": dict(kwargs),
        })
        idx = min(len(self.calls) - 1, len(self._responses) - 1)
        return self._responses[idx]


def _install_complete(monkeypatch: Any, capture: _Capture) -> None:
    monkeypatch.setattr(agent_loop_mod.llm_gateway, "complete", capture._complete)


def _text(content: str = "完成", *, stub: bool = False) -> dict[str, Any]:
    return {"content": content, "model": "m", "stub": stub}


def _tool_call_response(name: str, call_id: str, args_json: str = '{"query": "x"}') -> dict[str, Any]:
    return {
        "content": "我先查一下",
        "model": "m",
        "tool_calls": [
            {
                "id": call_id,
                "type": "function",
                "function": {"name": name, "arguments": args_json},
            }
        ],
    }


@pytest.mark.asyncio
async def test_tools_forwarded_and_none_omits_key(monkeypatch: Any) -> None:
    """tools 非空 ⇒ kwargs.tools 有 web_search;tools=None ⇒ 完全无 tools 键。"""
    cap = _Capture([_text("ok")])
    _install_complete(monkeypatch, cap)
    executor = AgentExecutor()

    await executor.run("查一下", max_iterations=1, tools=["web_search"])
    kwargs = cap.calls[0]["kwargs"]
    assert kwargs.get("tools"), "tools 非空时必须随请求下发,否则模型没有 function calling"
    assert [t["function"]["name"] for t in kwargs["tools"]] == ["web_search"]

    cap2 = _Capture([_text("ok")])
    _install_complete(monkeypatch, cap2)
    await AgentExecutor().run("不用工具", max_iterations=1, tools=None)
    assert "tools" not in cap2.calls[0]["kwargs"], "无工具路径不得出现 tools 键"


@pytest.mark.asyncio
async def test_approval_gated_tool_not_exposed_and_status_failed(monkeypatch: Any) -> None:
    """run_command 在审批门内:V1 无审批通道 ⇒ 不下发,且零工具必须判 failed。"""
    cap = _Capture([_text("我没法执行命令")])
    _install_complete(monkeypatch, cap)
    executor = AgentExecutor()

    result = await executor.run("跑个命令", max_iterations=2, tools=["run_command"])

    assert "tools" not in cap.calls[0]["kwargs"], "需审批工具绝不能进 V1 请求面"
    assert result["status"] == "failed", "配了工具却零工具执行,不得报 completed"
    assert result["error"] and result["error"].startswith("zero_tool_calls:")
    assert "run_command" in result["error"], "error 必须点名被审批门挡下的工具"


@pytest.mark.asyncio
async def test_second_round_keeps_tool_call_protocol_pairing(monkeypatch: Any) -> None:
    """第二轮 messages 必须含 assistant.tool_calls 与配对的 tool.tool_call_id。"""

    async def fake_call_tool(name: str, args: dict | None = None, **kwargs: Any) -> dict:
        return {"ok": True, "tool": name, "args": args or {}}

    monkeypatch.setattr(agent_loop_mod.mcp_server, "call_tool", fake_call_tool)

    cap = _Capture([
        _tool_call_response("web_search", "call_abc123"),
        _text("查完了"),
    ])
    _install_complete(monkeypatch, cap)
    executor = AgentExecutor()

    result = await executor.run("搜一下", max_iterations=2, tools=["web_search"])
    await asyncio.gather(*list(executor._pending_tasks), return_exceptions=True)

    # 收尾的知识卡蒸馏等后台任务也会调同一个网关,这里只取带 tools 的循环请求
    loop_calls = [c for c in cap.calls if "tools" in c["kwargs"]]
    assert len(loop_calls) == 2, "第一轮有 tool_call,必须再请求一轮"
    second_messages = loop_calls[1]["messages"]

    assistants = [m for m in second_messages if m.get("role") == "assistant"]
    assert assistants and assistants[-1].get("tool_calls"), (
        "第二轮必须带上 assistant.tool_calls,否则上游不知道模型要调工具"
    )
    assistant_call_id = assistants[-1]["tool_calls"][0]["id"]
    assert assistant_call_id == "call_abc123"

    tool_msgs = [m for m in second_messages if m.get("role") == "tool"]
    assert tool_msgs, "工具结果必须以 role=tool 回列"
    assert tool_msgs[-1]["tool_call_id"] == assistant_call_id, (
        "tool_call_id 与 assistant.tool_calls[].id 必须相同,否则协议不配对"
    )
    assert tool_msgs[-1]["name"] == "web_search"
    assert result["status"] == "completed", "真跑过工具就应 completed"


@pytest.mark.asyncio
async def test_stub_with_tools_still_completed(monkeypatch: Any) -> None:
    """stub 是测试/无 key 降级,不得被零工具判据误判为失败。"""
    cap = _Capture([_text("[stub] 模拟响应", stub=True)])
    _install_complete(monkeypatch, cap)
    executor = AgentExecutor()

    result = await executor.run("问候", max_iterations=2, tools=["web_search"])
    await asyncio.gather(*list(executor._pending_tasks), return_exceptions=True)

    assert result["status"] == "completed"
    assert not result["error"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
