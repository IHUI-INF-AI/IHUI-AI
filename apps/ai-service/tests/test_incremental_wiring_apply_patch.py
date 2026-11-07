# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Z11b 装车证明:apply_patch 的真实变更事件确实流到增量索引入口(goal-b49 第八回合)。

被测消费链 = 生产唯一喂源(`apply_patch` 工具 executor 落盘后的 `dispatch_file_change`)
→ 引擎侧去抖桥(`AgentEngine.pump_incremental_index`)→ 增量入口
`codebase_incremental_index.index_changed_paths`。入口用 **真实内置工具 executor**
驱动(与 tests/test_engine_harness_fifth.py 同款夹具),不自造测试专用调用点。
`index_changed_paths` 被整体替换为记录器 ⇒ 零库零网络(测试隔离铁律,PG 8810/Redis 8811
本机根本不连);去抖用注入钟,零 sleep。
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import agent_engine as ae  # noqa: E402
from app.services import codebase_incremental_index as cii  # noqa: E402
from app.services.agent_engine import AgentEngine  # noqa: E402


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


class _Clock:
    """注入钟:测试自己拨时刻,不靠 sleep。"""

    def __init__(self, now: float = 100.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now

    def advance(self, delta: float) -> float:
        self.now += delta
        return self.now


async def _rpc(engine: AgentEngine, method: str, params: dict[str, Any], req_id: int = 1) -> Any:
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
    )
    assert response is not None and "error" not in response, response
    return response["result"]


def _find_builtin(engine: AgentEngine, thread: Any, name: str) -> Any:
    for definition in engine._builtin_tool_definitions(thread):
        if getattr(definition, "name", "") == name:
            return definition
    raise AssertionError(f"内置工具未注入: {name}")


def _added_patch(rel_path: str, body: str) -> str:
    lines = body.splitlines()
    return (
        f"--- /dev/null\n+++ b/{rel_path}\n@@ -0,0 +1,{len(lines)} @@\n"
        + "".join(f"+{line}\n" for line in lines)
    )


@pytest.fixture
def engine_with_patch_tool(monkeypatch, tmp_path):
    """真实入口夹具:门控 on(与喂源同一把门)+ 注入钟 + 增量入口记录器。"""
    monkeypatch.setenv("ENGINE_FILE_WATCHER_ENABLED", "1")
    monkeypatch.delenv("IHUI_INCREMENTAL_INDEX_WINDOW_S", raising=False)

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop()
        loop.spec = spec
        return loop

    engine = AgentEngine(loop_factory=factory)
    clock = _Clock()
    engine._incremental_index_clock = clock
    engine._incremental_index_window_s = 5.0

    calls: list[tuple[str, tuple[str, ...]]] = []

    async def _recorder(indexer: Any, repo_path: str, changed_paths: Any, **kw: Any) -> str:
        calls.append((repo_path, tuple(changed_paths)))
        return "recorded"

    monkeypatch.setattr(cii, "index_changed_paths", _recorder)
    return engine, clock, calls, tmp_path


@pytest.mark.asyncio
async def test_one_real_change_indexes_exactly_once(engine_with_patch_tool):
    """①真窗(窗口 0 ⇒ 一批一次):一次 apply_patch ⇒ 增量入口被调到且只被调一次。"""
    engine, clock, calls, root = engine_with_patch_tool
    engine._incremental_index_window_s = 0.0
    started = await _rpc(engine, "thread.start", {"workspace": str(root)})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "apply_patch")

    result = await tool.executor({"patch": _added_patch("a.py", "print('a')\n")})
    assert result["applied"] is True, result

    assert len(calls) == 1, f"增量入口应被调一次,实际 {len(calls)} 次"
    repo_path, batch = calls[0]
    assert Path(repo_path).resolve() == Path(root).resolve()
    assert batch == (str((Path(root) / "a.py").resolve()),)

    # 无新变更的一轮(空 changed_files)⇒ 不得再调增量入口(不冒充"又索引了一遍")
    result2 = await tool.executor({"patch": _added_patch("a.py", "print('a')\n")})
    assert result2.get("applied") is not True or len(calls) == 1
    assert len(calls) == 1, f"无新事件时不得二次调用:{calls}"
    assert clock.now == 100.0, "全程注入钟,零 sleep"


@pytest.mark.asyncio
async def test_burst_within_window_is_debounced_into_one_batch(engine_with_patch_tool):
    """①去抖:窗口内两次真实变更 ⇒ 增量入口一次都不调;过窗后一次合并批(只调一次)。"""
    engine, clock, calls, root = engine_with_patch_tool
    started = await _rpc(engine, "thread.start", {"workspace": str(root)})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "apply_patch")

    assert (await tool.executor({"patch": _added_patch("b.py", "x = 1\n")})).get("applied")
    assert (await tool.executor({"patch": _added_patch("c.py", "y = 2\n")})).get("applied")
    assert calls == [], "窗口未过不得下发增量批"

    clock.advance(6.0)
    assert (await tool.executor({"patch": _added_patch("d.py", "z = 3\n")})).get("applied")
    assert len(calls) == 1, f"合并批应只下一次:{calls}"
    batch = calls[0][1]
    assert batch == tuple(
        sorted(str(Path(root) / f"{n}.py") for n in ("b", "c", "d"))
    ), batch


@pytest.mark.asyncio
async def test_wired_batch_equals_full_rescan_row_set(engine_with_patch_tool):
    """②正向对照:增量轮拿到的行集与全量重扫对同一次变更看到的行集逐字等值。"""
    engine, clock, calls, root = engine_with_patch_tool
    engine._incremental_index_window_s = 0.0
    started = await _rpc(engine, "thread.start", {"workspace": str(root)})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "apply_patch")

    result = await tool.executor(
        {"patch": _added_patch("src/deep/e.py", "e = 4\n") + _added_patch("f.py", "f = 5\n")}
    )
    assert result.get("applied") is True, result
    assert len(calls) == 1, calls

    # 全量重扫面(生产同一枚举:落盘的真实文件)对同一次变更看到的行集
    full_rescan_rows = sorted(str(p.resolve()) for p in Path(root).rglob("*") if p.is_file())
    assert list(calls[0][1]) == full_rescan_rows, (calls[0][1], full_rescan_rows)

    clock.advance(6.0)
    # 已判定的一轮把结论写进工具回执(可观测,不哑报)
    again = await tool.executor({"patch": _added_patch("g.py", "g = 6\n")})
    notes = " | ".join(str(n) for n in again.get("notes", []))
    assert "增量索引排空:batch" in notes, notes


@pytest.mark.asyncio
async def test_no_router_is_unjudged_and_named(engine_with_patch_tool, monkeypatch):
    """③取不到事件面 ⇒ 未判定并点名(§0.3),不记绿、不调增量入口、不断补丁主链路。"""
    engine, _clock, calls, root = engine_with_patch_tool
    monkeypatch.setattr(
        AgentEngine, "_file_watcher_router_or_none", lambda self: None, raising=True
    )
    started = await _rpc(engine, "thread.start", {"workspace": str(root)})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "apply_patch")

    result = await tool.executor({"patch": _added_patch("h.py", "h = 7\n")})
    assert result.get("applied") is True, "增量不可判不得打断补丁主链路"
    assert calls == [], "无事件面时不得凭空调增量入口"
    notes = " | ".join(str(n) for n in result.get("notes", []))
    assert "增量索引排空:undetermined" in notes, notes
    assert "未判定" in notes, notes

    outcome = await engine.pump_incremental_index(str(root))
    assert outcome.kind == "undetermined"
    assert outcome.reason and "不得读成" in outcome.reason


@pytest.mark.asyncio
async def test_gate_off_consumer_not_built(engine_with_patch_tool, monkeypatch):
    """喂源门控 off ⇒ 事件与消费都不存在(默认态零副作用),不新建桥。"""
    engine, _clock, calls, root = engine_with_patch_tool
    monkeypatch.delenv("ENGINE_FILE_WATCHER_ENABLED", raising=False)
    assert ae._engine_file_watcher_enabled_from_env() is False

    outcome = await engine.pump_incremental_index(str(root))
    assert outcome.kind == "undetermined"
    assert engine._incremental_bridges == {}
    assert calls == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
