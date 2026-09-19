# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Harness 细粒度能力(2026-09-18 第五批):apply_patch 结构化补丁单测。

覆盖(对标 Codex apply-patch / V4A):
- 新增文件 / 更新文件(多 hunk,含偏移匹配)/ 删除文件
- 上下文失配整包拒绝(原子性)+ 失败定位
- 越出工作区拒绝 / 新增文件已存在拒绝 / 空 patch 拒绝
- git diff 头(diff --git / index / mode)容错 + patch.applied 事件
"""

from typing import Any

import pytest

from app.services.agent_engine import (
    AgentEngine,
    _apply_hunks_to_content,
    _parse_unified_patch,
)

# =============================================================================
# 夹具(与 test_engine_harness_fourth 同款模式,自包含)
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


@pytest.fixture(autouse=True)
def _mock_hook_engine(monkeypatch):
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


# =============================================================================
# 解析器
# =============================================================================


def test_parse_unified_patch_multi_file_and_git_headers():
    """git diff 头容错;多文件段 + 多 hunk 正确切分。"""
    patch = (
        "diff --git a/one.py b/one.py\n"
        "index 111..222 100644\n"
        "--- a/one.py\n"
        "+++ b/one.py\n"
        "@@ -1,3 +1,4 @@\n"
        " keep\n"
        "-old\n"
        "+new\n"
        "+added\n"
        " tail\n"
        "diff --git a/two.py b/two.py\n"
        "new file mode 100644\n"
        "--- /dev/null\n"
        "+++ b/two.py\n"
        "@@ -0,0 +1,2 @@\n"
        "+hello\n"
        "+world\n"
    )
    sections = _parse_unified_patch(patch)
    assert len(sections) == 2
    assert sections[0]["old_path"] == "a/one.py"
    assert sections[1]["old_path"] == "/dev/null"
    assert sections[1]["new_path"] == "b/two.py"
    assert len(sections[0]["hunks"]) == 1
    assert sections[0]["hunks"][0]["lines"] == [
        (" ", "keep"), ("-", "old"), ("+", "new"), ("+", "added"), (" ", "tail"),
    ]


def test_parse_unified_patch_rejects_garbage():
    with pytest.raises(ValueError, match="unified diff"):
        _parse_unified_patch("这不是补丁")


# =============================================================================
# hunk 应用
# =============================================================================


def test_apply_hunks_offset_matching_and_failure_localization():
    content = "a\nb\nc\nd\ne\n"
    hunks = [{"old_start": 99, "old_count": 2, "lines": [(" ", "c"), ("-", "d"), ("+", "D")]}]
    # 声明行 99 严重偏移 → 窗口搜索兜底命中
    assert _apply_hunks_to_content(content, hunks, "f.txt") == "a\nb\nc\nD\ne\n"
    # 上下文失配 → ValueError 带文件与 hunk 定位
    bad = [{"old_start": 1, "old_count": 2, "lines": [(" ", "x-missing"), ("+", "y")]}]
    with pytest.raises(ValueError, match="f.txt: hunk #1"):
        _apply_hunks_to_content(content, bad, "f.txt")


# =============================================================================
# 工具端到端
# =============================================================================


@pytest.mark.asyncio
async def test_apply_patch_create_update_delete_flow(tmp_path):
    """新增/更新/删除三类文件段原子应用 + patch.applied 事件。"""
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "mod.py").write_text("def f():\n    return 1\n", encoding="utf-8")
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {"workspace": str(tmp_path)})
    thread = engine._threads[started["threadId"]]
    notifications: list[dict[str, Any]] = []

    async def _emit(message: dict[str, Any]) -> None:
        if message.get("method") == "thread/event":
            notifications.append(message["params"])

    thread.emit = _emit
    tool = _find_builtin(engine, thread, "apply_patch")
    patch = (
        "--- /dev/null\n"
        "+++ b/new_file.py\n"
        "@@ -0,0 +1,2 @@\n"
        "+print('brand new')\n"
        "+# end\n"
        "--- a/src/mod.py\n"
        "+++ b/src/mod.py\n"
        "@@ -1,2 +1,2 @@\n"
        " def f():\n"
        "-    return 1\n"
        "+    return 42\n"
        "--- a/src/old.py\n"
        "+++ /dev/null\n"
        "@@ -1,1 +0,0 @@\n"
        "-legacy\n"
    )
    (tmp_path / "src" / "old.py").write_text("legacy\n", encoding="utf-8")
    result = await tool.executor({"patch": patch})
    assert result["applied"] is True
    assert result["count"] == 3
    actions = {r["path"]: r["action"] for r in result["files"]}
    assert actions == {
        "new_file.py": "created",
        "src/mod.py": "updated",
        "src/old.py": "deleted",
    }
    assert "return 42" in (tmp_path / "src" / "mod.py").read_text(encoding="utf-8")
    assert (tmp_path / "new_file.py").read_text(encoding="utf-8") == "print('brand new')\n# end"
    assert not (tmp_path / "src" / "old.py").exists()
    events = [n for n in notifications if n["event"] == "patch.applied"]
    assert len(events) == 1 and events[0]["payload"]["count"] == 3


@pytest.mark.asyncio
async def test_apply_patch_atomic_reject_and_workspace_containment(tmp_path):
    """任一 hunk 失配整包拒绝(无半应用);越界路径拒绝;重复新增拒绝;空 patch 拒绝。"""
    (tmp_path / "a.txt").write_text("alpha\n", encoding="utf-8")
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {"workspace": str(tmp_path)})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "apply_patch")
    # 原子性:第一段合法,第二段上下文失配 → 整包拒绝且第一段不落盘
    mixed = (
        "--- /dev/null\n"
        "+++ b/should_not_exist.txt\n"
        "@@ -0,0 +1,1 @@\n"
        "+x\n"
        "--- a/a.txt\n"
        "+++ b/a.txt\n"
        "@@ -1,1 +1,1 @@\n"
        "-wrong-context\n"
        "+beta\n"
    )
    result = await tool.executor({"patch": mixed})
    assert "上下文失配" in result["error"]
    assert not (tmp_path / "should_not_exist.txt").exists()
    assert (tmp_path / "a.txt").read_text(encoding="utf-8") == "alpha\n"
    # 越界路径
    outside = (
        "--- /dev/null\n"
        "+++ b/../evil.txt\n"
        "@@ -0,0 +1,1 @@\n"
        "+x\n"
    )
    result = await tool.executor({"patch": outside})
    assert "越出工作区" in result["error"]
    # 新增文件已存在
    dup = (
        "--- /dev/null\n"
        "+++ b/a.txt\n"
        "@@ -0,0 +1,1 @@\n"
        "+dup\n"
    )
    assert "已存在" in (await tool.executor({"patch": dup}))["error"]
    # 空 patch
    assert "非空" in (await tool.executor({"patch": "   "}))["error"]
    assert "error" in (await tool.executor({}))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
