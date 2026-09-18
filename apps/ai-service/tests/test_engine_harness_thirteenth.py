# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Harness git 基线与变更状态(2026-09-18 第十三批)单测。

覆盖(对标 Codex git-utils crate:GitBaselineChangeStatus/GitBaselineDiff/
merge_base_with_head):
- _workspace_file_status:porcelain 解析为 A/M/D git 风格状态标签
- _git_baseline:无上游退化为 HEAD;返回 sha 与来源
- turn.diff 事件:changes[{path,status}] + baselineSha/baselineSource +
  unifiedDiff(含未跟踪新增文件的 difflib 合成 diff)
"""

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


class _Collector:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict[str, Any]]] = []

    async def __call__(self, message: dict[str, Any]) -> None:
        params = message.get("params") or {}
        self.events.append((params.get("event", ""), params.get("payload") or {}))

    def payloads(self, name: str) -> list[dict[str, Any]]:
        return [p for e, p in self.events if e == name]


@pytest.fixture(autouse=True)
def _mock_env(monkeypatch):
    monkeypatch.setenv("AGENT_ENGINE_PERSIST", "off")
    yield {}


def _git(tmp_path: Path, *args: str) -> str:
    res = subprocess.run(
        ["git", "-C", str(tmp_path), *args],
        check=True,
        capture_output=True,
    )
    return res.stdout.decode("utf-8", errors="replace").strip()


def _git_init(tmp_path: Path) -> str:
    _git(tmp_path, "init")
    _git(tmp_path, "config", "user.email", "t@t")
    _git(tmp_path, "config", "user.name", "t")
    (tmp_path / "tracked.txt").write_text("line1\n", encoding="utf-8")
    _git(tmp_path, "add", ".")
    _git(tmp_path, "commit", "-m", "init")
    return _git(tmp_path, "rev-parse", "HEAD")


# =============================================================================
# _workspace_file_status
# =============================================================================


@pytest.mark.asyncio
async def test_workspace_file_status_labels(tmp_path):
    head = _git_init(tmp_path)
    assert head
    (tmp_path / "tracked.txt").write_text("line1\nmodified\n", encoding="utf-8")
    (tmp_path / "brand_new.txt").write_text("new\n", encoding="utf-8")
    (tmp_path / "gone.txt").write_text("x\n", encoding="utf-8")
    _git(tmp_path, "add", "gone.txt")
    _git(tmp_path, "commit", "-m", "add gone")
    (tmp_path / "gone.txt").unlink()

    engine = _engine()
    started = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "thread.start",
            "params": {"workspace": str(tmp_path)},
        }
    )
    thread = engine._threads[started["result"]["threadId"]]
    status = await engine._workspace_file_status(thread)
    assert status.get("tracked.txt") == "M"
    assert status.get("brand_new.txt") == "A"
    assert status.get("gone.txt") == "D"


@pytest.mark.asyncio
async def test_workspace_file_status_empty_outside_git(tmp_path):
    """非 git 目录静默降级为空字典。"""
    engine = _engine()
    started = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "thread.start",
            "params": {"workspace": str(tmp_path)},
        }
    )
    thread = engine._threads[started["result"]["threadId"]]
    assert await engine._workspace_file_status(thread) == {}


# =============================================================================
# _git_baseline
# =============================================================================


@pytest.mark.asyncio
async def test_git_baseline_falls_back_to_head(tmp_path):
    head = _git_init(tmp_path)
    sha, source = await AgentEngine._git_baseline(str(tmp_path))
    assert sha == head[:40]
    assert source == "head"  # 无上游分支


@pytest.mark.asyncio
async def test_git_baseline_none_outside_repo(tmp_path):
    sha, source = await AgentEngine._git_baseline(str(tmp_path))
    assert sha is None and source == "none"


# =============================================================================
# turn.diff 结构化变更
# =============================================================================


@pytest.mark.asyncio
async def test_turn_diff_carries_status_and_baseline(tmp_path):
    """轮内改动:changes 带 A/M/D 状态 + baselineSha/Source。"""
    _git_init(tmp_path)

    async def mutate() -> None:
        (tmp_path / "tracked.txt").write_text("line1\nmodified\n", encoding="utf-8")
        (tmp_path / "new_file.py").write_text("print('hi')\n", encoding="utf-8")

    engine = _engine(on_run=mutate)
    collector = _Collector()
    started = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "thread.start",
            "params": {"workspace": str(tmp_path)},
        },
        emit=collector,
    )
    tid = started["result"]["threadId"]
    resp = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "thread.prompt",
            "params": {"threadId": tid, "input": "go"},
        },
        emit=collector,
    )
    assert "error" not in resp, resp
    payload = collector.payloads("turn.diff")[-1]
    changes = {c["path"]: c["status"] for c in payload["changes"]}
    assert changes.get("tracked.txt") == "M"
    assert changes.get("new_file.py") == "A"
    assert payload["baselineSource"] == "head"
    assert payload["baselineSha"]
    diff = payload["unifiedDiff"]
    assert "modified" in diff  # git diff 部分
    assert "a/new_file.py" in diff  # difflib 合成的新增文件部分
    assert payload["files"] == sorted(changes) or set(payload["files"]) == set(changes)


@pytest.mark.asyncio
async def test_turn_diff_absent_without_changes(tmp_path):
    """轮内无改动 → 不发 turn.diff。"""
    _git_init(tmp_path)
    engine = _engine()
    collector = _Collector()
    started = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "thread.start",
            "params": {"workspace": str(tmp_path)},
        },
        emit=collector,
    )
    tid = started["result"]["threadId"]
    await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "thread.prompt",
            "params": {"threadId": tid, "input": "go"},
        },
        emit=collector,
    )
    assert collector.payloads("turn.diff") == []
