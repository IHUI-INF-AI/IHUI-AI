# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Harness 事件面对齐(2026-09-18 第十批)单测。

覆盖(对标 Codex EventMsg:PatchApplyBegin/End、TurnDiff、WebSearchBegin/End、
ViewImageToolCall、TurnStarted/TurnComplete):
- apply_patch 发 patch.apply.begin / patch.apply.end,后者带聚合 unifiedDiff
- turn.diff 事件带 unifiedDiff 正文(git 工作区真实 diff)
- web_search 前后发 web_search.begin / web_search.end
- view_image 发 view_image.tool_call
- 每轮发 turn.started / turn.complete
"""

import base64
import subprocess
from pathlib import Path
from typing import Any

import pytest

from app.services.agent_engine import AgentEngine


# =============================================================================
# 夹具
# =============================================================================


class _FakeLoop:
    def __init__(self, on_run=None) -> None:
        self.spec: dict[str, Any] = {}
        self._on_run = on_run

    async def run(self, messages: list[dict[str, Any]]) -> Any:
        if self._on_run is not None:
            await self._on_run()
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


def _engine(on_run=None, **kwargs: Any):
    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        return _FakeLoop(on_run=on_run)

    return AgentEngine(loop_factory=factory, **kwargs)


async def _rpc(engine: AgentEngine, method: str, params: dict[str, Any], req_id: int = 1):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
    )
    assert response is not None and "error" not in response, response
    return response["result"]


class _Collector:
    """事件收集器(替代 emit;thread.start 会把它固化为 thread.emit)。"""

    def __init__(self) -> None:
        self.events: list[tuple[str, dict[str, Any]]] = []

    async def __call__(self, message: dict[str, Any]) -> None:
        params = message.get("params") or {}
        self.events.append((params.get("event", ""), params.get("payload") or {}))

    def names(self) -> list[str]:
        return [e for e, _ in self.events]

    def payloads(self, name: str) -> list[dict[str, Any]]:
        return [p for e, p in self.events if e == name]


@pytest.fixture(autouse=True)
def _mock_hook_engine(monkeypatch):
    monkeypatch.setenv("AGENT_ENGINE_PERSIST", "off")

    class FakeHookEngine:
        async def emit(self, event, context):
            return []

    monkeypatch.setattr("app.services.agent_loop_v2.hook_engine", FakeHookEngine())
    monkeypatch.setattr("app.services.agent_loop_v2._approval_registry", {})
    yield {}


def _find_builtin(engine: AgentEngine, thread: Any, name: str) -> Any:
    for definition in engine._builtin_tool_definitions(thread):
        if getattr(definition, "name", "") == name:
            return definition
    raise AssertionError(f"内置工具未注入: {name}")


def _git_init(tmp_path: Path) -> None:
    def run(*args: str) -> None:
        subprocess.run(
            ["git", "-C", str(tmp_path), *args],
            check=True,
            capture_output=True,
        )

    run("init")
    run("config", "user.email", "t@t")
    run("config", "user.name", "t")
    (tmp_path / "tracked.txt").write_text("line1\n", encoding="utf-8")
    run("add", ".")
    run("commit", "-m", "init")


# =============================================================================
# patch.apply.begin / end
# =============================================================================


@pytest.mark.asyncio
async def test_apply_patch_emits_begin_end_with_unified_diff(tmp_path):
    """apply_patch 成功:begin(格式+文件)→ end(success+聚合 unifiedDiff)。"""
    (tmp_path / "f.txt").write_text("alpha\n", encoding="utf-8")
    engine = _engine()
    collector = _Collector()
    await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "thread.start",
            "params": {"workspace": str(tmp_path)},
        },
        emit=collector,
    )
    thread = engine._threads[list(engine._threads)[0]]
    tool = _find_builtin(engine, thread, "apply_patch")
    result = await tool.executor(
        {
            "patch": (
                "*** Begin Patch\n"
                "*** Add File: g.txt\n"
                "+hello\n"
                "*** Update File: f.txt\n"
                "@@\n"
                "-alpha\n"
                "+beta\n"
                "*** End Patch"
            )
        }
    )
    assert result["applied"] is True
    begins = collector.payloads("patch.apply.begin")
    ends = collector.payloads("patch.apply.end")
    assert len(begins) == 1 and begins[0]["format"] == "v4a"
    assert sorted(begins[0]["files"]) == ["f.txt", "g.txt"]
    assert ends and ends[0]["success"] is True
    diff = ends[0]["unifiedDiff"]
    assert "a/f.txt" in diff and "+beta" in diff and "-alpha" in diff
    assert "a/g.txt" in diff and "+hello" in diff
    assert result["unifiedDiff"] == diff


@pytest.mark.asyncio
async def test_apply_patch_begin_only_on_success_path(tmp_path):
    """第一遍失配整包拒绝时不发 begin(未进入落盘阶段)。"""
    engine = _engine()
    collector = _Collector()
    await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "thread.start",
            "params": {"workspace": str(tmp_path)},
        },
        emit=collector,
    )
    thread = engine._threads[list(engine._threads)[0]]
    tool = _find_builtin(engine, thread, "apply_patch")
    result = await tool.executor(
        {
            "patch": (
                "*** Begin Patch\n"
                "*** Update File: missing.txt\n"
                "@@\n"
                "-x\n"
                "+y\n"
                "*** End Patch"
            )
        }
    )
    assert "error" in result
    assert collector.payloads("patch.apply.begin") == []


# =============================================================================
# turn.diff unifiedDiff 正文
# =============================================================================


@pytest.mark.asyncio
async def test_turn_diff_includes_unified_diff_body(tmp_path):
    """git 工作区:轮内修改文件 → turn.diff 带 unifiedDiff 正文。"""
    _git_init(tmp_path)
    target = tmp_path / "tracked.txt"

    async def mutate() -> None:
        target.write_text("line1\nline2-changed\n", encoding="utf-8")

    engine = _engine(on_run=mutate)
    collector = _Collector()
    await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "thread.start",
            "params": {"workspace": str(tmp_path)},
        },
        emit=collector,
    )
    tid = list(engine._threads)[0]
    response = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "thread.prompt",
            "params": {"threadId": tid, "input": "make a change"},
        },
        emit=collector,
    )
    assert "error" not in response, response
    diffs = collector.payloads("turn.diff")
    assert diffs, collector.names()
    payload = diffs[-1]
    assert "tracked.txt" in payload["files"]
    assert "-line1" in payload["unifiedDiff"].replace("\r", "") or "line1" in payload["unifiedDiff"]
    assert "line2-changed" in payload["unifiedDiff"]


# =============================================================================
# web_search / view_image / turn 生命周期事件
# =============================================================================


@pytest.mark.asyncio
async def test_web_search_emits_begin_end(monkeypatch, tmp_path):
    async def _fake(args):
        return {"results": [{"url": "https://x.com"}], "total": 1, "message": ""}

    monkeypatch.setattr("app.services.mcp_server._tool_web_search", _fake)
    engine = _engine()
    collector = _Collector()
    await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "thread.start",
            "params": {"workspace": str(tmp_path)},
        },
        emit=collector,
    )
    thread = engine._threads[list(engine._threads)[0]]
    tool = _find_builtin(engine, thread, "web_search")
    await tool.executor({"query": "probe"})
    begins = collector.payloads("web_search.begin")
    ends = collector.payloads("web_search.end")
    assert begins and begins[0]["query"] == "probe"
    assert ends and ends[0]["success"] is True and ends[0]["resultCount"] == 1


@pytest.mark.asyncio
async def test_view_image_emits_tool_call_event(tmp_path):
    """view_image 读取成功后发 view_image.tool_call。"""
    # 1x1 像素 PNG
    png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    (tmp_path / "p.png").write_bytes(png)
    engine = _engine()
    collector = _Collector()
    await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "thread.start",
            "params": {"workspace": str(tmp_path)},
        },
        emit=collector,
    )
    thread = engine._threads[list(engine._threads)[0]]
    tool = _find_builtin(engine, thread, "view_image")
    result = await tool.executor({"path": "p.png"})
    assert "dataUrl" in result
    events = collector.payloads("view_image.tool_call")
    assert events and events[0]["mimeType"] == "image/png"


@pytest.mark.asyncio
async def test_turn_started_and_complete_events(tmp_path):
    """每轮发 turn.started 与 turn.complete(含成功标志与计时)。"""
    engine = _engine()
    collector = _Collector()
    await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "thread.start",
            "params": {"workspace": str(tmp_path)},
        },
        emit=collector,
    )
    tid = list(engine._threads)[0]
    response = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "thread.prompt",
            "params": {"threadId": tid, "input": "go"},
        },
        emit=collector,
    )
    assert "error" not in response, response
    started = collector.payloads("turn.started")
    complete = collector.payloads("turn.complete")
    assert len(started) == 1 and started[0]["inputChars"] == 2
    assert complete and complete[0]["success"] is True
    assert isinstance(complete[0]["durationMs"], (int, float))
