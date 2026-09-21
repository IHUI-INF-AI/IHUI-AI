# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""引擎线程会话持久化(接线 SessionStore)与重启恢复单测(2026-09-18)。

对照 Codex harness Thread/Rollout 能力:此前 AgentEngine 线程纯内存态,
进程重启丢全部活跃会话。现 thread.start 落库 / prompt 每轮落 Turn+Item /
_require_thread 未命中按需恢复;持久化失败降级不打断主链路。
"""

import asyncio
import json
from typing import Any

import pytest

from app.services.agent_engine import AgentEngine
from app.services.session_store import SessionStore


class _FakeLoop:
    """主循环替身:记录 run() 收到的消息,返回固定成功结果。"""

    def __init__(self) -> None:
        self.spec: dict[str, Any] = {}
        self.run_messages: list[dict[str, Any]] = []

    async def run(self, messages: list[dict[str, Any]]) -> Any:
        self.run_messages = [dict(m) for m in messages]
        return SimpleResult()

    async def resume_from_checkpoint(self, checkpoint_id: str) -> Any:
        return SimpleResult()

    async def interrupt(self, mode: str = "cancel") -> Any:
        return None


class SimpleResult:
    """AgentLoopResult 形状的最小替身。"""

    success = True
    stop_reason = "end_turn"
    final_response = "好的,已收到。"
    iterations: list[Any] = []
    total_duration_ms = 12.0
    total_tokens_used = 100
    checkpoint_id = None
    error = None
    budget = None
    compaction_events: list[Any] = []


def _engine(store: SessionStore | None) -> tuple[AgentEngine, list[_FakeLoop]]:
    loops: list[_FakeLoop] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop()
        loop.spec = spec
        loops.append(loop)
        return loop

    kwargs: dict[str, Any] = {"loop_factory": factory}
    if store is not None:
        kwargs["store"] = store
    return AgentEngine(**kwargs), loops


async def _rpc(engine: AgentEngine, method: str, params: dict[str, Any], req_id: int = 1) -> dict[str, Any]:
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
    )
    assert response is not None and "error" not in response, response
    return response["result"]


async def _drain() -> None:
    """让 forwarder/持久化同步调用完成(SQLite 同步 API,await 一次即可)。"""
    await asyncio.sleep(0)


@pytest.mark.asyncio
async def test_thread_persisted_and_restorable_across_restart(tmp_path):
    """start+prompt 落库 → 新引擎实例(模拟进程重启)按 threadId 恢复并续对话。"""
    db = str(tmp_path / "sessions.db")
    store = SessionStore(db)

    # 进程 1:start + prompt
    engine1, loops1 = _engine(store)
    started = await _rpc(
        engine1, "thread.start", {"model": "gpt-test", "systemPrompt": "你是测试助手。"}
    )
    tid = started["threadId"]
    await _rpc(engine1, "thread.prompt", {"threadId": tid, "input": "你好"}, req_id=2)
    await _drain()

    thread = store.get_thread(tid)
    assert thread is not None
    assert thread.item_count >= 2  # user + agent message
    # resume 重建的历史含本轮 user/assistant
    history = [(m.role, m.content) for m in store.resume(tid)]
    assert ("user", "你好") in history
    assert ("assistant", "好的,已收到。") in history

    store.close()

    # 进程 2(模拟重启):全新引擎 + 重新打开的库;thread.prompt 应按需恢复
    store2 = SessionStore(db)
    engine2, loops2 = _engine(store2)
    state = await _rpc(engine2, "thread.state", {"threadId": tid}, req_id=3)
    assert state["threadId"] == tid  # 恢复成功,不抛 THREAD_NOT_FOUND
    assert state["status"] == "idle"
    assert state["model"] == "gpt-test"  # 配置从 metadata 还原

    result = await _rpc(
        engine2, "thread.prompt", {"threadId": tid, "input": "继续"}, req_id=4
    )
    assert result["success"] is True
    # 主循环收到的消息:system(还原)+ 前轮 user/assistant + 本轮 user
    msgs = loops2[0].run_messages
    assert msgs[0]["role"] == "system" and msgs[0]["content"] == "你是测试助手。"
    roles = [m["role"] for m in msgs]
    assert roles.count("assistant") == 1  # 前轮回复已恢复进历史
    assert msgs[-1] == {"role": "user", "content": "继续"}

    # 恢复后的轮次也持久化(累计 user 消息 = 2)
    history2 = [m.content for m in store2.resume(tid) if m.role == "user"]
    assert history2 == ["你好", "继续"]
    store2.close()


@pytest.mark.asyncio
async def test_prompt_persists_error_item_and_failed_turn(tmp_path):
    """prompt 异常:ErrorItem + failed Turn 落库,异常本身不吞。"""
    db = str(tmp_path / "sessions.db")
    store = SessionStore(db)

    failed: list[_FakeLoop] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop()
        failed.append(loop)

        async def boom(messages: list[dict[str, Any]]) -> Any:
            raise RuntimeError("上游炸了")

        loop.run = boom  # type: ignore[method-assign]
        return loop

    engine = AgentEngine(loop_factory=factory, store=store)
    started = await _rpc(engine, "thread.start", {})
    tid = started["threadId"]
    # handle_message 协议层把 handler 异常转为 JSON-RPC error response
    response = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "thread.prompt",
            "params": {"threadId": tid, "input": "触发失败"},
        }
    )
    assert response is not None and "error" in response  # 异常未吞成 success
    await _drain()

    thread = store.get_thread(tid)
    assert thread is not None
    items = [
        json.dumps(i.model_dump(), ensure_ascii=False, default=str)
        for i in _iter_items(store, tid)
    ]
    assert any("上游炸了" in s for s in items)  # ErrorItem 落库
    turns = store.list_turns(tid)
    assert turns[-1].status == "failed"
    store.close()


def _iter_items(store: SessionStore, thread_id: str):
    """list_items 包装(按 seq 升序返回全部 Item)。"""
    return store.list_items(thread_id)


@pytest.mark.asyncio
async def test_persistence_failure_degrades_not_blocks(tmp_path):
    """持久化层抛异常 → prompt 主链路不受影响(降级 log)。"""
    engine, loops = _engine(None)  # 不注入 store → 惰性走 AGENT_ENGINE_PERSIST/单例
    # 强制 _store 为不可用哨兵之外的坏对象:抛异常的鸭子类型
    class _BadStore:
        def get_thread(self, *_a, **_k):
            raise RuntimeError("db down")

        def create_thread(self, **_k):
            raise RuntimeError("db down")

        def start_turn(self, *_a, **_k):
            raise RuntimeError("db down")

        def append_item(self, *_a, **_k):
            raise RuntimeError("db down")

        def end_turn(self, *_a, **_k):
            raise RuntimeError("db down")

        def resume(self, *_a, **_k):
            raise RuntimeError("db down")

    engine._store = _BadStore()  # type: ignore[assignment]
    started = await _rpc(engine, "thread.start", {"model": "m"})
    tid = started["threadId"]
    result = await _rpc(engine, "thread.prompt", {"threadId": tid, "input": "hi"}, req_id=2)
    assert result["success"] is True  # 主链路不受持久化故障影响
    assert result["finalResponse"] == "好的,已收到。"


@pytest.mark.asyncio
async def test_unknown_thread_without_store_record_still_not_found(tmp_path):
    """负向:库中不存在且内存不存在 → 仍报 THREAD_NOT_FOUND(证明恢复真来自库)。"""
    store = SessionStore(str(tmp_path / "sessions.db"))
    engine, _ = _engine(store)
    response = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "thread.state",
            "params": {"threadId": "thr_nonexistent"},
        }
    )
    assert response is not None and response["error"]["code"] == -32001  # THREAD_NOT_FOUND
    store.close()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
