# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""agent_loop_v2 续跑回执钩子单测(commit 4)。

钉住默认严格路径的四个关键点:
1. 每轮工具执行前落写前 checkpoint(phase=tools_inflight),并在耐久后端可用时激活回执。
2. 有副作用工具执行前落 attempting、执行后落 settled;只读工具不制造 attempting。
3. 意图写不进耐久后端时有副作用工具**不执行**(fail-closed),返回真实错误不是成功。
4. 纯内存 manager 回执关闭(不假装跨进程可恢复),不产生任何回执写入。
5. 运行中 pause/cancel 立即落盘的半批次快照带 phase=tools_interrupted 元数据,
   续跑才会走零执行预检而不是跳过整轮重跑(AIS-114)。
"""

from __future__ import annotations

import copy
import json
from typing import Any

import pytest

from app.services.agent_loop_v2 import AgentLoopV2, ToolCall, ToolDefinition, ToolResult
from app.services.agent_resume_semantics import (
    RECEIPT_STATE_ATTEMPTING,
    RECEIPT_STATE_SETTLED_OK,
    RESUME_ROUND_PHASE_ROUND_DONE,
    RESUME_ROUND_PHASE_TOOLS_INFLIGHT,
    RESUME_ROUND_PHASE_TOOLS_INTERRUPTED,
)

USER = "u-1"


class _DurableFakeManager:
    """耐久 manager 的最小替身:保存 checkpoint + CAS 回执。"""

    def __init__(self, *, durable: bool = True, fail_receipts: bool = False):
        self.durable = durable
        self.fail_receipts = fail_receipts
        self.saved: dict[str, dict[str, Any]] = {}
        self.receipt_writes: list[tuple[str, dict[str, Any]]] = []

    async def receipts_durable(self) -> bool:
        return self.durable

    async def save_checkpoint(
        self,
        *,
        session_id: str,
        iteration: int,
        messages: list[dict[str, Any]],
        tool_state: dict[str, Any],
        status: str,
        metadata: dict[str, Any] | None = None,
        file_snapshots: Any = None,
        owner_user_id: str | None = None,
    ) -> str:
        cid = f"cp-{len(self.saved) + 1}"
        self.saved[cid] = {
            "session_id": session_id,
            "iteration": iteration,
            "messages": copy.deepcopy(messages),
            "tool_state": copy.deepcopy(tool_state),
            "status": status,
            "metadata": copy.deepcopy(metadata or {}),
        }
        return cid

    async def record_tool_receipt(
        self,
        checkpoint_id: str,
        tool_call_id: str,
        record: dict[str, Any],
        expected_rev: int,
    ) -> bool:
        if self.fail_receipts:
            return False
        cp = self.saved.get(checkpoint_id)
        if cp is None:
            return False
        receipts = cp["tool_state"].get("resume_receipts")
        if not isinstance(receipts, dict):
            receipts = {"v": 1, "rev": 0, "calls": {}}
            cp["tool_state"]["resume_receipts"] = receipts
        if receipts.get("rev", 0) != expected_rev:
            return False
        receipts["rev"] = expected_rev + 1
        receipts.setdefault("calls", {})[tool_call_id] = copy.deepcopy(record)
        self.receipt_writes.append((tool_call_id, record))
        return True

    def receipts_state(self) -> dict[str, Any]:
        for cp in reversed(list(self.saved.values())):
            receipts = cp["tool_state"].get("resume_receipts")
            if isinstance(receipts, dict):
                return receipts
        return {}


def _make_loop(*, executor: Any = None, tool_name: str = "echo_tool") -> AgentLoopV2:
    async def default_executor(args: dict) -> dict:
        return {"ok": True}

    tool = ToolDefinition(
        name=tool_name,
        description="echo",
        parameters={"type": "object"},
        executor=executor or default_executor,
    )

    async def mock_llm(messages, tools):  # noqa: ANN001, ANN202
        return {"content": "done", "tool_calls": None}

    return AgentLoopV2(mock_llm, [tool], max_iterations=1, approval_enabled=False, user_id=USER)


@pytest.mark.asyncio
async def test_begin_round_writes_write_ahead_checkpoint() -> None:
    loop = _make_loop()
    mgr = _DurableFakeManager()
    loop._checkpoint_manager = mgr  # type: ignore[assignment]
    messages = [{"role": "assistant", "content": None}]
    tc = ToolCall(id="c1", name="echo_tool", args={"q": "hi"})

    await loop._begin_resume_round(0, messages, [tc])

    assert loop._resume_receipts_active is True
    assert loop._resume_round is not None
    cp = mgr.saved[loop._resume_round["checkpoint_id"]]
    meta = cp["metadata"]["resume_round"]
    assert meta["phase"] == RESUME_ROUND_PHASE_TOOLS_INFLIGHT
    assert meta["iteration"] == 0
    assert meta["assistant_index"] == 0
    assert meta["tool_call_ids"] == ["c1"]
    assert meta["rev"] == 0


@pytest.mark.asyncio
async def test_intent_then_settle_is_a_durable_state_machine() -> None:
    loop = _make_loop()
    mgr = _DurableFakeManager()
    loop._checkpoint_manager = mgr  # type: ignore[assignment]
    tc = ToolCall(id="c1", name="echo_tool", args={"q": "hi"})
    await loop._begin_resume_round(0, [{"role": "assistant", "content": None}], [tc])

    loop._note_tool_attempt(tc.id)
    assert await loop._resume_note_intent(tc) is True
    assert mgr.receipt_writes[-1][1]["state"] == RECEIPT_STATE_ATTEMPTING
    assert mgr.receipt_writes[-1][1]["attempt_seq"] == 1

    result = ToolResult(tool_call_id="c1", name="echo_tool", result={"ok": True}, duration_ms=1.0)
    await loop._resume_settle_round([tc], [result])
    assert mgr.receipt_writes[-1][1]["state"] == RECEIPT_STATE_SETTLED_OK
    stored_message = mgr.receipt_writes[-1][1]["result_message"]
    assert stored_message["role"] == "tool"
    assert stored_message["tool_call_id"] == "c1"
    # 回执真的落到了 checkpoint 的 tool_state(跨进程可读)
    assert mgr.receipts_state()["calls"]["c1"]["state"] == RECEIPT_STATE_SETTLED_OK


@pytest.mark.asyncio
async def test_readonly_tool_does_not_write_attempting() -> None:
    loop = _make_loop(tool_name="read_file")
    mgr = _DurableFakeManager()
    loop._checkpoint_manager = mgr  # type: ignore[assignment]
    tc = ToolCall(id="c1", name="read_file", args={"path": "a.txt"})
    await loop._begin_resume_round(0, [{"role": "assistant", "content": None}], [tc])

    before = len(mgr.receipt_writes)
    assert await loop._resume_note_intent(tc) is True
    assert len(mgr.receipt_writes) == before


@pytest.mark.asyncio
async def test_receipt_failure_blocks_mutating_tool_before_execution() -> None:
    called: list[dict] = []

    async def executor(args: dict) -> dict:
        called.append(args)
        return {"ok": True}

    loop = _make_loop(executor=executor)
    mgr = _DurableFakeManager(fail_receipts=True)
    loop._checkpoint_manager = mgr  # type: ignore[assignment]
    tc = ToolCall(id="c1", name="echo_tool", args={"q": "hi"})
    await loop._begin_resume_round(0, [{"role": "assistant", "content": None}], [tc])

    result = await loop._execute_single(tc)

    assert called == []  # 有副作用工具没有执行
    assert result.error_type == "resume_receipt_unavailable"
    assert "AGENT_RESUME_RECEIPT_UNAVAILABLE" in (result.error or "")


@pytest.mark.asyncio
async def test_memory_manager_disables_receipts_without_writes() -> None:
    loop = _make_loop()
    mgr = _DurableFakeManager(durable=False)
    loop._checkpoint_manager = mgr  # type: ignore[assignment]
    tc = ToolCall(id="c1", name="echo_tool", args={"q": "hi"})

    await loop._begin_resume_round(0, [{"role": "assistant", "content": None}], [tc])

    assert loop._resume_receipts_active is False
    assert loop._resume_round is None
    assert mgr.saved == {}
    assert mgr.receipt_writes == []


@pytest.mark.asyncio
async def test_round_done_and_interrupted_metadata_phases() -> None:
    loop = _make_loop()
    mgr = _DurableFakeManager()
    loop._checkpoint_manager = mgr  # type: ignore[assignment]
    tc = ToolCall(id="c1", name="echo_tool", args={"q": "hi"})
    await loop._begin_resume_round(0, [{"role": "assistant", "content": None}], [tc])

    interrupted = loop._resume_interrupted_metadata()
    assert interrupted is not None
    assert interrupted["resume_round"]["phase"] == RESUME_ROUND_PHASE_TOOLS_INTERRUPTED

    done = loop._resume_round_done_metadata(0)
    assert done is not None
    assert done["resume_round"]["phase"] == RESUME_ROUND_PHASE_ROUND_DONE
    assert json.dumps(done)  # 必须可序列化落 checkpoint metadata


@pytest.mark.parametrize(
    ("method", "status"),
    [("pause", "paused"), ("cancel", "cancelled")],
)
@pytest.mark.asyncio
async def test_interrupt_mid_tool_batch_saves_resumable_eager_checkpoint(
    method: str, status: str
) -> None:
    """AIS-114:工具批中途 interrupt 的立即快照必须带本轮续跑元数据。

    不带元数据时续跑只看得到"assistant(tool_calls) 无配对结果"的半批次历史,
    会按旧路径跳到下一轮 —— 已完成的结果丢掉、有副作用的调用被重发。
    """
    loop = _make_loop()
    mgr = _DurableFakeManager()
    loop._checkpoint_manager = mgr  # type: ignore[assignment]
    messages: list[dict[str, Any]] = [
        {"role": "user", "content": "跑一个工具"},
        {"role": "assistant", "content": None, "tool_calls": []},
    ]
    tc = ToolCall(id="c1", name="echo_tool", args={"q": "hi"})
    loop._messages = messages
    loop._current_iteration = 3
    await loop._begin_resume_round(3, messages, [tc])
    assert loop._resume_round is not None

    checkpoint_id = await getattr(loop, method)()

    assert checkpoint_id is not None
    cp = mgr.saved[checkpoint_id]
    assert cp["status"] == status
    assert len(cp["messages"]) == len(messages)
    meta = cp["metadata"]["resume_round"]
    assert meta["phase"] == RESUME_ROUND_PHASE_TOOLS_INTERRUPTED
    assert meta["iteration"] == 3
    assert meta["assistant_index"] == 1
    assert meta["tool_call_ids"] == ["c1"]
    assert json.dumps(cp["metadata"])  # 必须可序列化落 checkpoint metadata


@pytest.mark.asyncio
async def test_interrupt_outside_tool_batch_writes_no_resume_round() -> None:
    """不在工具轮内(没有半批次)时不得伪造续跑元数据。"""
    loop = _make_loop()
    mgr = _DurableFakeManager()
    loop._checkpoint_manager = mgr  # type: ignore[assignment]
    loop._messages = [{"role": "user", "content": "上一轮已完成"}]
    loop._current_iteration = 1

    checkpoint_id = await loop.pause()

    assert checkpoint_id is not None
    assert "resume_round" not in mgr.saved[checkpoint_id]["metadata"]
