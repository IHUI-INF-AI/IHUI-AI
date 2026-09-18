# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Harness 线程生命周期(2026-09-18 第七批)单测。

覆盖(对标 Codex app-server thread 面 + file-watcher + compact hooks):
- thread.list:内存模式与 store 模式 + 分页 + includeArchived
- thread.archive:无 store 拒绝 / store 标记 + 内存摘除 + watcher 停止
- thread.fork:深拷贝独立演进 / running 拒绝 / 配置全量继承
- workspace watcher:文件变更发 workspace.changed 事件
- compact 生命周期 hook:context.pre_compact / context.post_compact
"""

import asyncio
from typing import Any

import pytest

from app.services.agent_engine import AgentEngine


# =============================================================================
# 夹具
# =============================================================================


class _FakeLoop:
    def __init__(self) -> None:
        self.spec: dict[str, Any] = {}

    async def run(self, messages: list[dict[str, Any]]) -> Any:
        return _SimpleResult()

    async def resume_from_checkpoint(self, checkpoint_id: str) -> Any:
        return _SimpleResult()

    async def interrupt(self, mode: str = "cancel") -> Any:
        return None


class _SimpleResult:
    success = True
    stop_reason = "end_turn"
    final_response = "done"
    iterations: list[Any] = []
    total_duration_ms = 1.0
    total_tokens_used = 123
    checkpoint_id = None
    error = None
    budget = None
    compaction_events: list[Any] = []


def _engine(**kwargs: Any):
    loops: list[_FakeLoop] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop()
        loop.spec = spec
        loops.append(loop)
        return loop

    return AgentEngine(loop_factory=factory, **kwargs), loops


async def _rpc(engine: AgentEngine, method: str, params: dict[str, Any], req_id: int = 1):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
    )
    assert response is not None and "error" not in response, response
    return response["result"]


async def _rpc_err(engine: AgentEngine, method: str, params: dict[str, Any]) -> dict[str, Any]:
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 9, "method": method, "params": params}
    )
    assert response is not None and "error" in response, response
    return response["error"]


@pytest.fixture(autouse=True)
def _mock_hook_engine(monkeypatch):
    # 默认关闭进程级 SessionStore 回退,保证 thread.list/archive 的纯内存语义
    # 可测(注入显式 store 的用例不受影响:_store is not None 时优先用注入)。
    monkeypatch.setenv("AGENT_ENGINE_PERSIST", "off")

    class FakeHookEngine:
        async def emit(self, event, context):
            return []

    monkeypatch.setattr("app.services.agent_loop_v2.hook_engine", FakeHookEngine())
    monkeypatch.setattr("app.services.agent_loop_v2._approval_registry", {})
    yield {}


# =============================================================================
# thread.list
# =============================================================================


@pytest.mark.asyncio
async def test_thread_list_in_memory_mode():
    """无 store 时返回内存运行态清单,含 runtimeStatus/itemCount。"""
    engine, _ = _engine()
    t1 = await _rpc(engine, "thread.start", {})
    await _rpc(engine, "thread.start", {}, req_id=2)
    result = await _rpc(engine, "thread.list", {}, req_id=3)
    assert result["total"] == 2
    assert len(result["threads"]) == 2
    ids = {t["threadId"] for t in result["threads"]}
    assert t1["threadId"] in ids
    row = next(t for t in result["threads"] if t["threadId"] == t1["threadId"])
    assert row["runtimeStatus"] == "idle"
    assert row["archived"] is False
    assert row["itemCount"] == len(engine._threads[t1["threadId"]].messages)
    assert result["hasMore"] is False


@pytest.mark.asyncio
async def test_thread_list_pagination():
    """limit/offset 分页 + hasMore 语义。"""
    engine, _ = _engine()
    for i in range(3):
        await _rpc(engine, "thread.start", {}, req_id=i + 1)
    page = await _rpc(engine, "thread.list", {"limit": 2, "offset": 0}, req_id=9)
    assert page["total"] == 3
    assert len(page["threads"]) == 2
    assert page["hasMore"] is True
    page2 = await _rpc(engine, "thread.list", {"limit": 2, "offset": 2}, req_id=10)
    assert len(page2["threads"]) == 1
    assert page2["hasMore"] is False
    err = await _rpc_err(engine, "thread.list", {"limit": "abc"})
    assert err["code"] == -32602


# =============================================================================
# thread.archive
# =============================================================================


@pytest.mark.asyncio
async def test_thread_archive_requires_store():
    """无持久化 store 时归档必须拒绝(INVALID_PARAMS)。"""
    engine, _ = _engine()
    await _rpc(engine, "thread.start", {})
    err = await _rpc_err(engine, "thread.archive", {"threadId": "thr_x"})
    assert err["code"] == -32602


@pytest.mark.asyncio
async def test_thread_archive_with_store(tmp_path):
    """store 模式:归档落库 + 内存摘除 + list 默认排除归档。"""
    from app.services.session_store import SessionStore

    engine, _ = _engine(store=SessionStore(tmp_path / "sess.db"))
    started = await _rpc(engine, "thread.start", {})
    tid = started["threadId"]
    result = await _rpc(engine, "thread.archive", {"threadId": tid}, req_id=2)
    assert result == {"threadId": tid, "archived": True, "updated": True}
    assert tid not in engine._threads
    listing = await _rpc(engine, "thread.list", {}, req_id=3)
    assert listing["total"] == 0
    listing2 = await _rpc(
        engine, "thread.list", {"includeArchived": True}, req_id=4
    )
    assert listing2["total"] == 1
    assert listing2["threads"][0]["archived"] is True
    # 恢复
    await _rpc(engine, "thread.archive", {"threadId": tid, "archived": False}, req_id=5)
    listing3 = await _rpc(engine, "thread.list", {}, req_id=6)
    assert listing3["total"] == 1
    # 未知线程:store 未命中且内存无 → NOT_FOUND
    err = await _rpc_err(engine, "thread.archive", {"threadId": "thr_missing"})
    assert err["code"] == -32001


# =============================================================================
# thread.fork
# =============================================================================


@pytest.mark.asyncio
async def test_thread_fork_deep_copy_independence():
    """分叉:消息深拷贝独立演进,配置全量继承,源线程不受影响。"""
    engine, _ = _engine()
    started = await _rpc(
        engine,
        "thread.start",
        {"goal": "demo-goal", "maxIterations": 7, "role": "planner"},
    )
    tid = started["threadId"]
    thread = engine._threads[tid]
    base_count = len(thread.messages)  # role=planner 会注入 system 种子消息
    thread.messages.append({"role": "user", "content": "hello-fork"})
    result = await _rpc(
        engine, "thread.fork", {"threadId": tid, "title": "  my fork  "}, req_id=2
    )
    assert result["forkedFrom"] == tid
    assert result["title"] == "my fork"
    assert result["messages"] == base_count + 1
    clone = engine._threads[result["threadId"]]
    assert clone.thread_id != tid
    assert clone.goal == "demo-goal"
    assert clone.max_iterations == 7
    assert clone.role == "planner"
    # 独立演进:改 clone 不影响源
    clone.messages.append({"role": "user", "content": "clone-only"})
    assert len(thread.messages) == base_count + 1
    # 源线程保持 idle 可继续使用
    assert engine._threads[tid].status == "idle"


@pytest.mark.asyncio
async def test_thread_fork_rejects_running_thread():
    """running 线程禁止分叉(THREAD_BUSY)。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    tid = started["threadId"]
    engine._threads[tid].status = "running"
    err = await _rpc_err(engine, "thread.fork", {"threadId": tid})
    assert err["code"] == -32002


# =============================================================================
# workspace watcher
# =============================================================================


@pytest.mark.asyncio
async def test_workspace_watcher_emits_changed_event(tmp_path):
    """watchWorkspace=true 时文件新增/修改在轮询间隔后推送 workspace.changed。"""
    engine, _ = _engine()
    events: list[dict[str, Any]] = []

    async def collector(message: dict[str, Any]) -> None:
        params = message.get("params") or {}
        if params.get("event") == "workspace.changed":
            events.append(params["payload"])

    (tmp_path / "a.txt").write_text("v1", encoding="utf-8")
    started = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "thread.start",
            "params": {"workspace": str(tmp_path), "watchWorkspace": True},
        },
        emit=collector,
    )
    tid = started["result"]["threadId"]
    caps = await _rpc(engine, "engine.initialize", {}, req_id=2)
    assert caps["capabilities"]["fileWatcher"] is True
    await asyncio.sleep(2.6)  # 首个快照窗口
    (tmp_path / "b.txt").write_text("new", encoding="utf-8")
    (tmp_path / "a.txt").write_text("v2", encoding="utf-8")
    await asyncio.sleep(2.8)
    assert events, "未收到 workspace.changed"
    last = events[-1]
    assert "b.txt" in last["added"]
    assert "a.txt" in last["changed"]
    # thread.close 后 watcher 摘除
    await _rpc(engine, "thread.close", {"threadId": tid}, req_id=3)
    assert tid not in engine._workspace_watchers


@pytest.mark.asyncio
async def test_watcher_not_started_without_opt_in(tmp_path):
    """未开 watchWorkspace 不启动监视器。"""
    engine, _ = _engine()
    started = await _rpc(
        engine, "thread.start", {"workspace": str(tmp_path)}, req_id=1
    )
    assert started["threadId"] not in engine._workspace_watchers


# =============================================================================
# compact 生命周期 hook
# =============================================================================


class _RecordingBus:
    """记录 emit 调用的假总线(hook 生命周期验证)。"""

    def __init__(self) -> None:
        self.emitted: list[tuple[str, dict[str, Any]]] = []

    async def emit(self, event: str, context: dict[str, Any]) -> list[Any]:
        self.emitted.append((event, context))
        return []

    def subscribe(self, *args: Any, **kwargs: Any) -> Any:
        raise TypeError("no queue support")

    def unsubscribe(self, *args: Any, **kwargs: Any) -> None:
        return None


@pytest.mark.asyncio
async def test_compact_lifecycle_hooks_emitted():
    """thread.compact 前后各发一次 context.pre_compact / context.post_compact。"""
    bus = _RecordingBus()
    engine, _ = _engine(hook_bus=bus)
    started = await _rpc(engine, "thread.start", {}, req_id=1)
    tid = started["threadId"]
    thread = engine._threads[tid]
    thread.messages = [
        {"role": "user", "content": f"填充消息 {i} " + "x" * 400} for i in range(60)
    ] + [{"role": "assistant", "content": "回" + "y" * 400}]
    result = await _rpc(
        engine, "thread.compact", {"threadId": tid, "keepRecent": 2}, req_id=2
    )
    assert result["compressed"] is True
    names = [e for e, _ in bus.emitted]
    assert "context.pre_compact" in names
    assert "context.post_compact" in names
    pre = next(ctx for e, ctx in bus.emitted if e == "context.pre_compact")
    post = next(ctx for e, ctx in bus.emitted if e == "context.post_compact")
    assert pre["threadId"] == tid
    assert pre["trigger"] == "manual"
    assert post["threadId"] == tid
    assert post["afterMessages"] < post["beforeMessages"]


@pytest.mark.asyncio
async def test_compact_hook_bus_failure_does_not_break_compaction():
    """hook 总线异常被吞,压缩主流程照常完成。"""
    class _BoomBus:
        async def emit(self, event: str, context: dict[str, Any]) -> list[Any]:
            raise RuntimeError("bus down")

        def subscribe(self, *args: Any, **kwargs: Any) -> Any:
            raise TypeError("no queue support")

        def unsubscribe(self, *args: Any, **kwargs: Any) -> None:
            return None

    engine, _ = _engine(hook_bus=_BoomBus())
    started = await _rpc(engine, "thread.start", {}, req_id=1)
    thread = engine._threads[started["threadId"]]
    thread.messages = [
        {"role": "user", "content": f"m{i} " + "z" * 500} for i in range(50)
    ]
    result = await _rpc(
        engine, "thread.compact", {"threadId": started["threadId"], "keepRecent": 1}, req_id=2
    )
    assert result["compressed"] is True


# =============================================================================
# remote compact(LLM 摘要压缩)
# =============================================================================


@pytest.mark.asyncio
async def test_remote_compact_llm_summary_strategy():
    """strategy=llm_summary + summary 注入:语义摘要替代规则分层摘要。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {}, req_id=1)
    tid = started["threadId"]
    thread = engine._threads[tid]
    thread.messages = [
        {"role": "user", "content": f"历史消息 {i} " + "p" * 500} for i in range(40)
    ]
    result = await _rpc(
        engine,
        "thread.compact",
        {
            "threadId": tid,
            "keepRecent": 3,
            "strategy": "llm_summary",
            "summary": "用户在讨论第七批引擎能力,已完成线程生命周期与压缩扩展。",
        },
        req_id=2,
    )
    assert result["compressed"] is True
    assert result["strategy"] == "llm_summary"
    # 语义摘要出现在压缩后的历史里
    joined = "\n".join(
        str(m.get("content", "")) for m in thread.messages
    )
    assert "第七批引擎能力" in joined


@pytest.mark.asyncio
async def test_remote_compact_validates_params():
    """非法 strategy / 缺 summary 必须拒绝(INVALID_PARAMS)。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {}, req_id=1)
    tid = started["threadId"]
    err = await _rpc_err(
        engine, "thread.compact", {"threadId": tid, "strategy": "bogus"}
    )
    assert err["code"] == -32602
    err2 = await _rpc_err(
        engine,
        "thread.compact",
        {"threadId": tid, "strategy": "llm_summary", "summary": "   "},
    )
    assert err2["code"] == -32602


# =============================================================================
# capabilities / 方法面宣告
# =============================================================================


@pytest.mark.asyncio
async def test_capabilities_declare_lifecycle_surface():
    """initialize 握手宣告 threadLifecycle/fileWatcher;方法面含三个新方法。"""
    engine, _ = _engine()
    caps = await _rpc(engine, "engine.initialize", {}, req_id=1)
    features = caps["capabilities"]
    assert features["threadLifecycle"] is True
    assert features["fileWatcher"] is True
    methods = caps["methods"]
    for m in ("thread.list", "thread.archive", "thread.fork"):
        assert m in methods
