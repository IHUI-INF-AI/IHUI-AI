# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-815969「已到达本进程的半截回答必须显式落库」单测(2026-10-31 立)。

覆盖两处落点:
- conversation.py 第 6 步写入前的 finally-flush 支路
- agent_loop_v2 的 _LoopInterrupted 返回处

正反成对判据:
- ① 流已产出 N 字符后取消 ⇒ 会话尾部新增一条 assistant 记录,长度 ≤N 且带中断标注
- ② 零字符时取消 ⇒ **不得**落空 assistant 气泡
- ③ 工具在飞时取消 ⇒ **不得**为工具写半截 result(断言"未发起写入",不是断言返回值)
- 对照:成功路径仍只写一条 assistant(补写支路不会重复)
- ④ v2:_LoopInterrupted 返回处把已到达本进程的文本递出去(此前恒为空串)

测试隔离(AGENTS.md §5 铁律):全程不碰生产 PostgreSQL(8810)/Redis(8811)。
autouse 的 _isolate_io 夹具先于任何被测代码把 app.core.db_pool.get_shared_pool
换成"不可用"实现、把 memory_store 钉死为进程内模式、并把 hook_engine /
orchestration_hub 的两条 Redis 链路置空(它们此前在用例里发起过真实连接尝试);
recorder 夹具再把 memory_store.add/get 换成只记录调用序列的替身 —— 用例体内不
存在"补丁之前已发生的真实写入"。"落库"断言只看替身收到的调用序列,绝不说真实库。
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest

from app.core import db_pool
from app.core.config import settings
from app.core.llm_gateway import llm_gateway
from app.services import orchestration_hub
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition
from app.services.conversation import ConversationService
from app.services.mcp_server import mcp_server
from app.services.memory import memory_store

# 工具结果哨兵:若它出现在任何一次 memory_store.add 里,就是"为工具写了半截
# result"的实证(③ 的反向判据)。
TOOL_RESULT_SENTINEL = "TOOL-RESULT-MUST-NOT-BE-PERSISTED-ON-CANCEL"
TOOL_NAME = "search_codebase"


class _AddRecorder:
    """memory_store.add 的替身:只记录调用序列,零真实写入、零 I/O。"""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def add(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: dict[str, Any] | None = None,
        *,
        user_id: str | None = None,
    ) -> None:
        self.calls.append(
            {
                "session_id": session_id,
                "role": role,
                "content": content,
                "metadata": dict(metadata or {}),
                "user_id": user_id,
            }
        )

    def roles(self) -> list[str]:
        return [str(c["role"]) for c in self.calls]

    def assistant_calls(self) -> list[dict[str, Any]]:
        return [c for c in self.calls if c["role"] == "assistant"]


@pytest.fixture(autouse=True)
def _isolate_io(monkeypatch: pytest.MonkeyPatch) -> None:
    """先焊死真实写入通道,再交给用例(§5:用例体内不存在"补丁之前已发生的真实写")。

    autouse ⇒ 连不取 recorder 的 v2 用例也走同一道隔离。
    """
    # 1) 共享 PostgreSQL(8810):get_shared_pool 换成"不可用"实现
    async def _unavailable_get_shared_pool() -> Any:
        raise AssertionError("G-815969 用例禁止连接共享 PostgreSQL(8810)")

    monkeypatch.setattr(db_pool, "get_shared_pool", _unavailable_get_shared_pool)

    # 2) Redis(8811):memory_store 钉死为进程内模式(_get_redis 直接返回 None)
    monkeypatch.setattr(memory_store, "_use_redis", False, raising=False)
    monkeypatch.setattr(memory_store, "_redis", None, raising=False)

    # 3) 事件面的两条 Redis 链路:hook_engine 惰性读 settings.redis_url,
    #    orchestration_hub 在 import 期把 .env 真实地址固化进模块级 _REDIS_URL。
    #    两处都置空 ⇒ 首次 emit 走"无 Redis → 内存降级"分支,连一次连接都不发起
    #    (此前实测:用例里出现过 "Timeout connecting to server" 的真实连接尝试)。
    monkeypatch.setattr(settings, "redis_url", "")
    monkeypatch.setattr(orchestration_hub, "_REDIS_URL", "")


@pytest.fixture
def recorder(monkeypatch: pytest.MonkeyPatch) -> _AddRecorder:
    """把 memory_store.add/get 整体换成只记录调用序列的替身(零 I/O)。"""
    rec = _AddRecorder()
    monkeypatch.setattr(memory_store, "add", rec.add)
    monkeypatch.setattr(memory_store, "get", _empty_history)
    return rec


async def _empty_history(
    session_id: str, limit: int = 100, *, user_id: str | None = None
) -> list[dict[str, Any]]:
    """memory_store.get 替身:历史恒为空,避免读取真实 key。"""
    return []


async def _run_and_cancel(
    svc: ConversationService,
    sid: str,
    ready: asyncio.Event,
    *,
    user_input: str = "帮我查一下代码",
    max_iterations: int = 2,
) -> None:
    """在 ready 置位(被测代码已到达指定 await 点)后取消 chat() 所在任务。

    task.cancel() 打在跑 chat() 的外层任务上 —— 这是"用户按停止"的真实形态
    (uvicorn 取消请求任务)。打在内部子任务上会被 gather(return_exceptions=True)
    收成"工具失败",走不到取消路径。
    """
    task = asyncio.create_task(
        svc.chat(
            user_input=user_input,
            session_id=sid,
            allowed_tools=[TOOL_NAME],
            max_iterations=max_iterations,
        )
    )
    await asyncio.wait_for(ready.wait(), timeout=5.0)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task


async def test_cancel_after_partial_text_writes_interrupted_assistant(
    recorder: _AddRecorder, monkeypatch: pytest.MonkeyPatch
) -> None:
    """①:流已产出 N 字符后取消 ⇒ 会话尾部新增一条带中断标注的 assistant,长度 ≤N。"""
    sid = "g815969-partial-cancel"
    partial_text = "前半段回答:这段文本已经到达本进程,用户已经亲眼看到它。"
    produced_chars = len(partial_text)
    tool_in_flight = asyncio.Event()

    async def fake_complete(
        messages: list[dict[str, Any]], model: str | None = None, **kwargs: Any
    ) -> dict[str, Any]:
        if not kwargs.get("tools"):
            # 意图分类轮:返回非 JSON ⇒ 走关键词 fallback(与本判据无关)
            return {"content": "", "model": "stub", "stub": True}
        # answer 轮:半截文本已到手 + 还要跑工具(取消就落在工具在飞期间)
        return {
            "content": partial_text,
            "model": "stub",
            "stub": True,
            "tool_calls": [
                {
                    "id": "call_1",
                    "type": "function",
                    "function": {
                        "name": TOOL_NAME,
                        "arguments": json.dumps({"query": "cancel"}),
                    },
                }
            ],
        }

    async def hanging_call_tool(
        name: str,
        arguments: Any = None,
        *,
        user_role: int = 0,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        tool_in_flight.set()
        await asyncio.sleep(30)
        return {"ok": True, "matches": [TOOL_RESULT_SENTINEL]}

    monkeypatch.setattr(llm_gateway, "complete", fake_complete)
    monkeypatch.setattr(mcp_server, "call_tool", hanging_call_tool)

    await _run_and_cancel(ConversationService(), sid, tool_in_flight)

    # 会话尾部新增一条 assistant,且只有这一条(user 那条是第 1 步的正常写入)
    assistants = recorder.assistant_calls()
    assert len(assistants) == 1, f"应补写恰好一条 assistant,实际 {len(assistants)} 条"
    flushed = recorder.calls[-1]
    assert flushed["role"] == "assistant"
    assert flushed["session_id"] == sid
    # 长度 ≤N(标注走 metadata,不往正文里塞字符 ⇒ 正文长度不超过已产出字符数)
    assert len(str(flushed["content"])) <= produced_chars
    assert flushed["content"] == partial_text
    # 带中断标注(落在 memory_store.add 已有的 metadata 参数 ⇒ 零新增列、零迁移)
    assert flushed["metadata"].get("interrupted") is True
    assert flushed["metadata"].get("interrupt_reason") == "user_cancelled"


async def test_cancel_with_zero_chars_writes_no_empty_assistant(
    recorder: _AddRecorder, monkeypatch: pytest.MonkeyPatch
) -> None:
    """②:一个字都没到达本进程时取消 ⇒ 不得落空 assistant 气泡。"""
    sid = "g815969-zero-char-cancel"
    first_llm_started = asyncio.Event()

    async def fake_complete(
        messages: list[dict[str, Any]], model: str | None = None, **kwargs: Any
    ) -> dict[str, Any]:
        # 意图分类轮就挂住 ⇒ content/final_response 从未被赋过值(arrived_text 恒空)
        first_llm_started.set()
        await asyncio.sleep(30)
        return {"content": "", "model": "stub", "stub": True}

    async def unused_call_tool(*args: Any, **kwargs: Any) -> dict[str, Any]:
        raise AssertionError("零字符用例不应执行到工具")

    monkeypatch.setattr(llm_gateway, "complete", fake_complete)
    monkeypatch.setattr(mcp_server, "call_tool", unused_call_tool)

    await _run_and_cancel(ConversationService(), sid, first_llm_started)

    assert recorder.assistant_calls() == [], "零字符取消不得写空 assistant 气泡"
    # 取消前确实只有第 1 步的 user 写入 ⇒ 补写支路被零字符闸门挡住
    assert recorder.roles() == ["user"]


async def test_cancel_while_tool_in_flight_writes_no_partial_tool_result(
    recorder: _AddRecorder, monkeypatch: pytest.MonkeyPatch
) -> None:
    """③:工具在飞时取消 ⇒ 不得为工具写半截 result(断言"未发起写入")。"""
    sid = "g815969-tool-in-flight"
    preamble = "我先查一下代码库。"
    tool_in_flight = asyncio.Event()
    tool_invocations: list[str] = []

    async def fake_complete(
        messages: list[dict[str, Any]], model: str | None = None, **kwargs: Any
    ) -> dict[str, Any]:
        if not kwargs.get("tools"):
            return {"content": "", "model": "stub", "stub": True}
        return {
            "content": preamble,
            "model": "stub",
            "stub": True,
            "tool_calls": [
                {
                    "id": "call_1",
                    "type": "function",
                    "function": {
                        "name": TOOL_NAME,
                        "arguments": json.dumps({"query": TOOL_RESULT_SENTINEL}),
                    },
                }
            ],
        }

    async def hanging_call_tool(
        name: str,
        arguments: Any = None,
        *,
        user_role: int = 0,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        # 正向实证:工具确实"在飞"(收到了调用),但它的 result 永远没有终态
        tool_invocations.append(name)
        tool_in_flight.set()
        await asyncio.sleep(30)
        return {"ok": True, "matches": [TOOL_RESULT_SENTINEL]}

    monkeypatch.setattr(llm_gateway, "complete", fake_complete)
    monkeypatch.setattr(mcp_server, "call_tool", hanging_call_tool)

    await _run_and_cancel(ConversationService(), sid, tool_in_flight)

    assert tool_invocations == [TOOL_NAME], "工具须确实在飞,否则本判据退化为空断言"
    # 未发起任何一次"工具写入":既没有 role=tool 的记录,也没有携带工具载荷的记录
    assert "tool" not in recorder.roles()
    for call in recorder.calls:
        assert TOOL_RESULT_SENTINEL not in str(call["content"]), (
            f"取消路径不得把半截工具结果写进记忆(role={call['role']})"
        )
        assert TOOL_NAME not in str(call["metadata"]), (
            f"取消路径的中断标注里不得混入工具字段: {call['metadata']}"
        )
    # 文本 flush 仍在范围内(与 ① 同一条支路),且它不含任何工具载荷
    assistants = recorder.assistant_calls()
    assert len(assistants) == 1
    assert assistants[0]["content"] == preamble
    assert assistants[0]["metadata"].get("interrupted") is True


async def test_success_path_still_writes_exactly_one_assistant_record(
    recorder: _AddRecorder, monkeypatch: pytest.MonkeyPatch
) -> None:
    """对照:成功路径只写一条 assistant,补写支路不会重复。"""
    sid = "g815969-success-control"
    preamble = "正在检索。"
    answer = "检索完成,这是完整回答。"
    calls = {"n": 0}

    async def fake_complete(
        messages: list[dict[str, Any]], model: str | None = None, **kwargs: Any
    ) -> dict[str, Any]:
        if not kwargs.get("tools"):
            return {"content": "", "model": "stub", "stub": True}
        calls["n"] += 1
        if calls["n"] == 1:
            return {
                "content": preamble,
                "model": "stub",
                "stub": True,
                "tool_calls": [
                    {
                        "id": "call_1",
                        "type": "function",
                        "function": {
                            "name": TOOL_NAME,
                            "arguments": json.dumps({"query": "ok"}),
                        },
                    }
                ],
            }
        return {"content": answer, "model": "stub", "stub": True}

    async def ok_call_tool(
        name: str,
        arguments: Any = None,
        *,
        user_role: int = 0,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        return {"ok": True, "matches": ["hit"]}

    monkeypatch.setattr(llm_gateway, "complete", fake_complete)
    monkeypatch.setattr(mcp_server, "call_tool", ok_call_tool)

    result = await ConversationService().chat(
        user_input="帮我查一下代码",
        session_id=sid,
        allowed_tools=[TOOL_NAME],
        max_iterations=2,
    )

    assert result.final_response == answer
    assistants = recorder.assistant_calls()
    assert len(assistants) == 1, "成功路径不得被 finally 支路补写第二条"
    assert assistants[0]["content"] == answer
    # 成功路径不带中断标注
    assert assistants[0]["metadata"].get("interrupted") is None


async def test_v2_loop_interrupted_hands_arrived_text_out() -> None:
    """④:v2 的 _LoopInterrupted 返回处把已到达本进程的文本递出去(此前恒为空串)。"""
    streamed_text = "用户已经看到的半截回答"
    loop_box: dict[str, AgentLoopV2] = {}

    async def mock_llm(
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        on_chunk: Any = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        if on_chunk is not None:
            await on_chunk(streamed_text)
            # 真实形态:用户按停止 ⇒ cancel 标志置位,由 _wait_interruptible 轮询命中
            loop_box["loop"]._cancel_requested = True
            await asyncio.sleep(1.0)
        return {"content": "", "tool_calls": None}

    async def never_used_executor(args: dict[str, Any]) -> dict[str, Any]:
        return {"ok": True}

    loop = AgentLoopV2(
        mock_llm,
        [
            ToolDefinition(
                name="get_weather",
                description="查询天气",
                parameters={"type": "object", "properties": {}},
                executor=never_used_executor,
            )
        ],
        max_iterations=3,
        enable_checkpoint=False,
        session_id="g815969-v2-cancel",
    )
    loop_box["loop"] = loop

    result = await loop.run(
        [{"role": "system", "content": "你是助手"}, {"role": "user", "content": "天气"}]
    )

    assert result.stop_reason == "cancelled"
    assert result.success is False
    assert result.final_response == streamed_text, "半截回答必须随返回递出,不得丢成空串"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
