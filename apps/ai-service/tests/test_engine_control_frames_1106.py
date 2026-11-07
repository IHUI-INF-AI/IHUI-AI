# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""控制帧引擎侧(2026-11-06 补):thread.contextUsage / thread.seedReadState / thread.interrupt

判据:
- contextUsage 的数字来自 build_context_ledger 七类账本,不是本地估算;system 消息从
  历史里拆出来单独计,不重复计入 messages;
- seedReadState 逐路径给结果(越界 / 不存在各有 reason),且登记真的进了 file_read_state;
- stopTask(thread.interrupt)真的能停住正在执行的任务:中断后副作用计数不再增长。
"""

from __future__ import annotations

import asyncio
import os
import sys
from typing import Any

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core import file_read_state
from app.services.agent_engine import AgentEngine
from app.services.session_store import SessionStore


class _IdleLoop:
    """只用于 thread.start 的占位;本册的 prompt 用例走 _BlockingLoop。"""

    async def run(self, messages: list[dict[str, Any]]) -> Any:
        raise AssertionError("本用例不该跑到 run")

    async def resume_from_checkpoint(self, checkpoint_id: str) -> Any:
        raise AssertionError("本用例不该走续跑")

    async def cancel(self) -> Any:
        return "ckp_cancel"

    async def pause(self) -> Any:
        return "ckp_pause"


class _InterruptedResult:
    success = False
    stop_reason = "cancelled"
    final_response = ""
    iterations: list[Any] = []
    total_duration_ms = 1.0
    total_tokens_used = 1
    checkpoint_id = None
    error = "用户取消(测试桩)"
    budget = None
    compaction_events: list[Any] = []


class _BlockingLoop(_IdleLoop):
    """跑到被取消为止;每次循环都给 side_effects 加一,用来量"中断后还有没有副作用"。"""

    def __init__(self) -> None:
        self.side_effects = 0
        self.cancelled = False
        self.started = asyncio.Event()

    async def run(self, messages: list[dict[str, Any]]) -> Any:
        self.started.set()
        while not self.cancelled:
            self.side_effects += 1
            await asyncio.sleep(0.02)
        return _InterruptedResult()

    async def cancel(self) -> Any:
        self.cancelled = True
        return "ckp_cancel"

    async def pause(self) -> Any:
        self.cancelled = True
        return "ckp_pause"


def _engine(tmp_path, loop: Any | None = None):
    holder = {"loop": loop or _IdleLoop()}

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> Any:
        return holder["loop"]

    store = SessionStore(str(tmp_path / "control-frames.db"))
    return AgentEngine(loop_factory=factory, store=store), store, holder


async def _rpc(engine: AgentEngine, method: str, params: dict[str, Any], req_id: int = 1):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
    )
    assert response is not None, response
    return response


async def _start(engine: AgentEngine, **params: Any) -> str:
    resp = await _rpc(engine, "thread.start", params, req_id=1)
    assert "error" not in resp, resp
    return resp["result"]["threadId"]


# ---------------------------------------------------------------------------
# get_context_usage → thread.contextUsage
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_context_usage_returns_real_ledger(tmp_path):
    engine, _store, _holder = _engine(tmp_path)
    tid = await _start(engine, systemPrompt="SYS-PROMPT-用于占位", model="fixture-model")

    resp = await _rpc(engine, "thread.contextUsage", {"threadId": tid}, req_id=2)
    assert "error" not in resp, resp
    result = resp["result"]

    assert result["threadId"] == tid
    assert result["source"] == "thread_history"
    assert result["status"] == "idle"
    usage = result["usage"]
    cats = [c["category"] for c in usage["categories"]]
    # 七类固定顺序,与 TS 契约逐字一致
    assert cats == [
        "system_prompt",
        "system_tools",
        "skills",
        "messages",
        "other",
        "free_space",
        "auto_compact",
    ]
    # 窗口不是猜的:resolver 给出正整数
    assert usage["contextLimit"] > 0
    # system 消息被拆出来单独计,不重复塞进 messages
    system_cat = next(c for c in usage["categories"] if c["category"] == "system_prompt")
    assert system_cat["tokens"] > 0
    messages_cat = next(c for c in usage["categories"] if c["category"] == "messages")
    assert messages_cat["tokens"] == 0
    assert usage["usedTokens"] == sum(c["tokens"] for c in usage["categories"][:5])


@pytest.mark.asyncio
async def test_context_usage_unknown_thread_is_explicit_error(tmp_path):
    engine, _store, _holder = _engine(tmp_path)

    resp = await _rpc(engine, "thread.contextUsage", {"threadId": "thr_nope"}, req_id=2)
    assert "error" in resp, resp
    assert "线程不存在" in resp["error"]["message"]


# ---------------------------------------------------------------------------
# seed_read_state → thread.seedReadState
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_seed_read_state_registers_and_reports_per_path(tmp_path):
    engine, _store, _holder = _engine(tmp_path)
    ws = tmp_path / "ws"
    ws.mkdir()
    target = ws / "a.txt"
    target.write_text("hello", encoding="utf-8")
    tid = await _start(
        engine, workspace=str(ws), sessionId="sess-seed", model="fixture-model"
    )

    resp = await _rpc(
        engine,
        "thread.seedReadState",
        {"threadId": tid, "paths": ["a.txt", "missing.txt", "../outside.txt"]},
        req_id=2,
    )
    assert "error" not in resp, resp
    result = resp["result"]

    assert result["threadId"] == tid
    assert result["seededCount"] == 1
    paths = [r["path"] for r in result["results"]]
    assert paths == ["a.txt", "missing.txt", "../outside.txt"]
    by_path = {r["path"]: r for r in result["results"]}
    assert by_path["a.txt"]["ok"] is True
    assert by_path["missing.txt"] == {
        "path": "missing.txt",
        "ok": False,
        "reason": "not_found",
    }
    assert by_path["../outside.txt"] == {
        "path": "../outside.txt",
        "ok": False,
        "reason": "outside_workspace",
    }

    # 登记真的落地(不是只回了 ok 字段)
    state = file_read_state.load_read_state("sess-seed", os.path.realpath(target))
    assert state is not None
    assert state.get("source") == file_read_state.SOURCE_READ


@pytest.mark.asyncio
async def test_seed_read_state_rejects_bad_params(tmp_path):
    engine, _store, _holder = _engine(tmp_path)
    tid = await _start(engine, workspace=str(tmp_path), model="fixture-model")

    for bad in ({"threadId": tid, "paths": "a.txt"}, {"threadId": tid, "paths": []}):
        resp = await _rpc(engine, "thread.seedReadState", bad, req_id=2)
        assert "error" in resp, resp
        assert resp["error"]["code"] == -32602  # INVALID_PARAMS


# ---------------------------------------------------------------------------
# stop_task → thread.interrupt(真中断)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_stop_task_actually_stops_side_effects(tmp_path):
    blocking = _BlockingLoop()
    engine, store, holder = _engine(tmp_path, blocking)
    tid = await _start(engine, workspace=str(tmp_path), model="fixture-model")

    prompt_task = asyncio.create_task(
        _rpc(engine, "thread.prompt", {"threadId": tid, "input": "跑起来"}, req_id=2)
    )
    await asyncio.wait_for(blocking.started.wait(), timeout=2.0)
    # 先让它真的跑出几圈副作用
    for _ in range(10):
        if blocking.side_effects >= 3:
            break
        await asyncio.sleep(0.03)

    stop = await _rpc(engine, "thread.interrupt", {"threadId": tid}, req_id=3)
    assert "error" not in stop, stop
    assert stop["result"]["interrupted"] is True
    assert stop["result"]["mode"] == "cancel"

    await asyncio.wait_for(prompt_task, timeout=2.0)

    # 中断落定后再观察一段:副作用计数不许再涨(这才是"真的停住")
    settled = blocking.side_effects
    await asyncio.sleep(0.15)
    assert blocking.side_effects == settled

    turns = store.list_turns(tid)
    assert len(turns) == 1
    assert turns[0].status == "failed"
    assert holder["loop"] is blocking


@pytest.mark.asyncio
async def test_stop_task_on_idle_thread_reports_not_interrupted(tmp_path):
    engine, _store, _holder = _engine(tmp_path)
    tid = await _start(engine, model="fixture-model")

    resp = await _rpc(engine, "thread.interrupt", {"threadId": tid}, req_id=2)
    assert "error" not in resp, resp
    assert resp["result"]["interrupted"] is False
    assert resp["result"]["status"] == "idle"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
