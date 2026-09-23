# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批 48 测试(自包含,勿手改) — 引擎 settings 热更 + 连接生命周期。

方法:thread.settings / turn.settings / thread.loaded.list / thread.unsubscribe /
model.list(别名)。假件复刻 test_engine_harness_lifecycle_45 模式,并将 _FakeLoop
增强为支持 _run_prompt_turn 一次性消费 turn.settings 的 pending 配置。
"""
from __future__ import annotations

import asyncio
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


from app.services.agent_engine import (
    INVALID_PARAMS,
    THREAD_BUSY,
    AgentEngine,
)
from app.services.session_store import SessionStore


class _FakeResult:
    """最小 AgentLoopResult 替身(_result_payload 仅用 getattr 读取)。"""

    success = True
    final_response = "ok"
    iterations: list = []
    compaction_events: list = []
    stop_reason = "stop"
    total_duration_ms = 1.0
    total_tokens_used = 0
    checkpoint_id = None
    error = None
    budget = None


class _FakeLoop:
    async def run(self, messages):  # 支持 _run_prompt_turn 真跑一轮
        return _FakeResult()

    async def resume_from_checkpoint(self, checkpoint_id):  # pragma: no cover
        return _FakeResult()

    async def interrupt(self, mode="cancel"):  # pragma: no cover
        return None


async def _rpc(engine, method, params, req_id=1, emit=None):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params},
        emit=emit,
    )
    assert response is not None and "error" not in response, response
    return response["result"]


async def _rpc_error(engine, method, params, req_id=1):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
    )
    assert response is not None and "error" in response, response
    return response["error"]


class _Collector:
    def __init__(self):
        self.events: list[tuple[str, dict[str, Any]]] = []

    async def __call__(self, message):
        params = message.get("params") or {}
        self.events.append((params.get("event", ""), params.get("payload") or {}))

    def payloads(self, name):
        return [p for e, p in self.events if e == name]


def _engine_with_store(tmp_path):
    async def factory(spec, host_tools):
        return _FakeLoop()

    store = SessionStore(str(tmp_path / "s48.db"))
    return AgentEngine(loop_factory=factory, store=store), store


# =============================================================================
# thread.settings
# =============================================================================


async def test_thread_settings_applies_idle_with_event(tmp_path):
    """空闲线程改 model/maxIterations/tokenBudget,生效 + 事件。"""
    engine, _store = _engine_with_store(tmp_path)
    collector = _Collector()
    tid = (await _rpc(engine, "thread.start", {"model": "base"}, emit=collector))["threadId"]

    r = await _rpc(
        engine,
        "thread.settings",
        {
            "threadId": tid,
            "settings": {
                "model": "gpt-x",
                "maxIterations": 20,
                "tokenBudget": 5000,
            },
        },
        emit=collector,
    )
    assert r["applied"] == ["model", "maxIterations", "tokenBudget"]
    th = engine._threads[tid]
    assert th.model == "gpt-x" and th.max_iterations == 20 and th.token_budget == 5000
    assert collector.payloads("thread.settings.updated")


async def test_thread_settings_rejects_running(tmp_path):
    """running 线程改配置 → THREAD_BUSY。"""
    engine, _store = _engine_with_store(tmp_path)
    tid = (await _rpc(engine, "thread.start", {"model": "base"}))["threadId"]
    engine._threads[tid].status = "running"
    err = await _rpc_error(
        engine,
        "thread.settings",
        {"threadId": tid, "settings": {"model": "x"}},
    )
    assert err["code"] == THREAD_BUSY


async def test_thread_settings_rejects_invalid_max_iterations(tmp_path):
    """maxIterations=-1 非法 → INVALID_PARAMS。"""
    engine, _store = _engine_with_store(tmp_path)
    tid = (await _rpc(engine, "thread.start", {"model": "base"}))["threadId"]
    err = await _rpc_error(
        engine,
        "thread.settings",
        {"threadId": tid, "settings": {"maxIterations": -1}},
    )
    assert err["code"] == INVALID_PARAMS


async def test_thread_settings_rejects_non_object_settings(tmp_path):
    """settings 缺失/非对象 → INVALID_PARAMS。"""
    engine, _store = _engine_with_store(tmp_path)
    tid = (await _rpc(engine, "thread.start", {"model": "base"}))["threadId"]
    for bad in ({}, {"settings": None}, {"settings": "x"}):
        err = await _rpc_error(
            engine, "thread.settings", {"threadId": tid, **bad}
        )
        assert err["code"] == INVALID_PARAMS, bad


async def test_thread_settings_model_params_merge(tmp_path):
    """modelParams 合并(非覆盖)既有参数。"""
    engine, _store = _engine_with_store(tmp_path)
    tid = (await _rpc(engine, "thread.start", {"model": "base"}))["threadId"]
    engine._threads[tid].model_params = {"temperature": 0.5}

    r = await _rpc(
        engine,
        "thread.settings",
        {"threadId": tid, "settings": {"modelParams": {"top_p": 0.9}}},
    )
    assert r["applied"] == ["modelParams"]
    assert engine._threads[tid].model_params == {"temperature": 0.5, "top_p": 0.9}


async def test_thread_settings_auto_compact_and_permission(tmp_path):
    """autoCompact/permissionMode 校验并生效。"""
    engine, _store = _engine_with_store(tmp_path)
    tid = (await _rpc(engine, "thread.start", {"model": "base"}))["threadId"]
    r = await _rpc(
        engine,
        "thread.settings",
        {
            "threadId": tid,
            "settings": {"autoCompact": True, "permissionMode": "always"},
        },
    )
    assert set(r["applied"]) == {"autoCompact", "permissionMode"}
    th = engine._threads[tid]
    assert th.auto_compact is True and th.permission_mode == "always"
    # autoCompact 非法类型
    err = await _rpc_error(
        engine,
        "thread.settings",
        {"threadId": tid, "settings": {"autoCompact": "yes"}},
    )
    assert err["code"] == INVALID_PARAMS


# =============================================================================
# turn.settings(下轮一次性)
# =============================================================================


async def test_turn_settings_writable_while_running(tmp_path):
    """turn.settings 不拒绝 running,写入 pending。"""
    engine, _store = _engine_with_store(tmp_path)
    collector = _Collector()
    tid = (await _rpc(engine, "thread.start", {"model": "base"}, emit=collector))["threadId"]
    engine._threads[tid].status = "running"
    r = await _rpc(
        engine,
        "turn.settings",
        {"threadId": tid, "settings": {"model": "next-gen"}},
        emit=collector,
    )
    assert r["effectiveFrom"] == "next_turn"
    assert engine._threads[tid].pending_turn_settings == {"model": "next-gen"}
    assert collector.payloads("turn.settings.updated")


async def test_turn_settings_consumed_by_run_prompt_turn(tmp_path):
    """_run_prompt_turn 一次性消费 pending → merge 进 frozen_context 并清空。"""
    engine, _store = _engine_with_store(tmp_path)
    collector = _Collector()
    tid = (await _rpc(engine, "thread.start", {"model": "base"}))["threadId"]
    thread = engine._threads[tid]
    thread.status = "running"  # 模拟在跑
    await _rpc(
        engine,
        "turn.settings",
        {"threadId": tid, "settings": {"model": "next-gen"}},
    )
    assert thread.pending_turn_settings == {"model": "next-gen"}
    # 直接驱动一轮(验证 _run_prompt_turn 消费点)
    await engine._run_prompt_turn(thread, "hi", collector)
    assert thread.frozen_context["model"] == "next-gen"
    assert thread.pending_turn_settings is None


async def test_turn_settings_rejects_empty_settings(tmp_path):
    """turn.settings 空/非对象 settings → INVALID_PARAMS。"""
    engine, _store = _engine_with_store(tmp_path)
    tid = (await _rpc(engine, "thread.start", {"model": "base"}))["threadId"]
    for bad in ({}, {"settings": {}}, {"settings": "x"}):
        err = await _rpc_error(engine, "turn.settings", {"threadId": tid, **bad})
        assert err["code"] == INVALID_PARAMS, bad


# =============================================================================
# thread.loaded.list
# =============================================================================


async def test_loaded_list_includes_started_thread(tmp_path):
    """loaded.list 含刚 start 的线程(status=idle, prompts=0)。"""
    engine, _store = _engine_with_store(tmp_path)
    collector = _Collector()
    tid = (await _rpc(engine, "thread.start", {"model": "base"}, emit=collector))["threadId"]
    r = await _rpc(engine, "thread.loaded.list", {})
    ids = {t["threadId"] for t in r["threads"]}
    assert tid in ids
    entry = next(t for t in r["threads"] if t["threadId"] == tid)
    assert entry["status"] == "idle" and entry["prompts"] == 0


async def test_loaded_list_total_matches_threads(tmp_path):
    """loaded.list total == len(self._threads)。"""
    engine, _store = _engine_with_store(tmp_path)
    await _rpc(engine, "thread.start", {"model": "a"})
    await _rpc(engine, "thread.start", {"model": "b"})
    r = await _rpc(engine, "thread.loaded.list", {})
    assert r["total"] == len(engine._threads) == 2


# =============================================================================
# thread.unsubscribe
# =============================================================================


async def test_unsubscribe_clears_emit_and_emits_event(tmp_path):
    """unsubscribe 置 thread.emit=None + 发 thread.unsubscribed 事件。"""
    engine, _store = _engine_with_store(tmp_path)
    collector = _Collector()
    tid = (await _rpc(engine, "thread.start", {"model": "base"}, emit=collector))["threadId"]
    assert engine._threads[tid].emit is not None
    r = await _rpc(engine, "thread.unsubscribe", {"threadId": tid}, emit=collector)
    assert r["unsubscribed"] is True
    assert engine._threads[tid].emit is None
    assert collector.payloads("thread.unsubscribed")


# =============================================================================
# model.list 别名
# =============================================================================


async def test_model_list_alias_same_as_models_list():
    """model.list 复用 models.list 实现,返回结构一致。"""
    async def factory(spec, host_tools):
        return _FakeLoop()

    engine = AgentEngine(
        loop_factory=factory, model_lister=lambda: [{"id": "m1"}, {"id": "m2"}]
    )
    r_models = await _rpc(engine, "models.list", {})
    r_alias = await _rpc(engine, "model.list", {})
    assert r_models == r_alias
    assert r_models["available"] is True and r_models["total"] == 2


# =============================================================================
# 批 50(主会话补):fs/watch + fs/unwatch 连接级文件监视订阅
# =============================================================================


async def test_fs_watch_requires_valid_path(tmp_path):
    """watchId/path 校验:缺参、相对路径、不存在目录均拒绝。"""
    engine, _store = _engine_with_store(tmp_path)

    for params in (
        {},
        {"watchId": "w1"},
        {"watchId": "w1", "path": "relative/dir"},
        {"watchId": "w1", "path": str(tmp_path / "nope")},
    ):
        response = await engine.handle_message(
            {"jsonrpc": "2.0", "id": 1, "method": "fs.watch", "params": params}
        )
        assert response is not None and "error" in response, params
        assert response["error"]["code"] == INVALID_PARAMS, params



async def test_fs_watch_registers_and_unwatch_stops(tmp_path):
    """fs/watch 注册任务 + fs/unwatch 取消;unwatch 未知 id 幂等 stopped=false。"""
    engine, _store = _engine_with_store(tmp_path)
    watch_dir = tmp_path / "wdir"
    watch_dir.mkdir()

    r = await _rpc(
        engine,
        "fs.watch",
        {"watchId": "w1", "path": str(watch_dir)},
    )
    assert r["watchId"] == "w1" and r["path"] == str(watch_dir)
    assert "w1" in engine._fs_watchers

    # 重复注册幂等覆盖(旧任务被取消,不抛)
    r2 = await _rpc(engine, "fs.watch", {"watchId": "w1", "path": str(watch_dir)})
    assert r2["watchId"] == "w1"
    assert engine._fs_watchers["w1"] is not None

    r3 = await _rpc(engine, "fs.unwatch", {"watchId": "w1"})
    assert r3["stopped"] is True
    assert "w1" not in engine._fs_watchers

    r4 = await _rpc(engine, "fs.unwatch", {"watchId": "w1"})
    assert r4["stopped"] is False  # 幂等



async def test_fs_watch_emits_changed_notification(tmp_path):
    """watch 目录内落新文件 → fs.changed 通知带 watchId 与 added 列表。"""
    engine, _store = _engine_with_store(tmp_path)
    watch_dir = tmp_path / "wdir2"
    watch_dir.mkdir()
    events: list[dict] = []

    async def _emit(message):
        events.append(message.get("params") or {})

    await _rpc(engine, "fs.watch", {"watchId": "w2", "path": str(watch_dir)}, emit=_emit)
    # 等 watcher 建立首帧快照
    await asyncio.sleep(0.3)
    (watch_dir / "new_file.txt").write_text("hello", encoding="utf-8")
    # 等扫描间隔(_WATCH_INTERVAL)
    deadline = 10.0
    waited = 0.0
    while waited < deadline:
        await asyncio.sleep(0.3)
        waited += 0.3
        if any(p.get("watchId") == "w2" for p in events if p.get("added")):
            break
    await _rpc(engine, "fs.unwatch", {"watchId": "w2"})

    changed = [p for p in events if p.get("watchId") == "w2" and p.get("added")]
    assert changed, f"未收到 fs.changed 通知: {events}"
    assert "new_file.txt" in changed[0]["added"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
