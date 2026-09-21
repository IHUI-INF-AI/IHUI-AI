# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Harness 剩余项(2026-09-18 第九批)单测。

覆盖:
- apply_patch V4A 格式(*** Begin Patch):Add/Update/Delete/Move/多代码块/
  @@ 锚点/End of File/shell 包装宽容解析/失配定位/原子性
- web_search allowedDomains 域名白名单过滤
"""

from typing import Any

import pytest

from app.services.agent_engine import (
    AgentEngine,
    _apply_v4a_to_content,
    _is_v4a_patch,
    _parse_v4a_patch,
)

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


# =============================================================================
# V4A 解析器
# =============================================================================


def test_v4a_detect_and_parse_full_grammar():
    """完整语法:Begin/End、Add/Update/Delete/Move、@@、End of File。"""
    patch = """*** Begin Patch
*** Add File: new.py
+print("hello")
*** Update File: app.py
*** Move to: app_renamed.py
@@ def old_func():
-    return 1
+    return 2
*** Update File: tail.py
@@
 last line
+appended
*** End of File
*** Delete File: gone.py
*** End Patch"""
    assert _is_v4a_patch(patch)
    sections = _parse_v4a_patch(patch)
    assert len(sections) == 4
    add, update1, update2, delete = sections
    assert add["old_path"] == "/dev/null" and add["new_path"] == "new.py"
    assert add["hunks"][0]["lines"] == [("+", 'print("hello")')]
    assert update1["old_path"] == "app.py" and update1["new_path"] == "app_renamed.py"
    assert update1["hunks"][0]["anchor"] == "def old_func():"
    tags = {t for t, _ in update1["hunks"][0]["lines"]}
    assert tags == {"-", "+"}
    assert update2["hunks"][0]["anchor"] is None
    assert update2["hunks"][0]["eof"] is True
    assert delete["old_path"] == "gone.py" and delete["new_path"] == "/dev/null"


def test_v4a_shell_wrapper_lenient_parse():
    """codex shell 调用形态(apply_patch <<'EOF' ... EOF)宽容解析。"""
    patch = (
        "apply_patch <<'EOF'\n"
        "*** Begin Patch\n"
        "*** Add File: a.txt\n"
        "+hi\n"
        "*** End Patch\n"
        "EOF"
    )
    sections = _parse_v4a_patch(patch)
    assert sections[0]["new_path"] == "a.txt"


def test_v4a_parse_rejects_missing_end_marker():
    with pytest.raises(ValueError, match="End Patch"):
        _parse_v4a_patch("*** Begin Patch\n*** Add File: x\n+y\n")


def test_v4a_parse_rejects_add_without_lines():
    with pytest.raises(ValueError, match="至少需要一行"):
        _parse_v4a_patch(
            "*** Begin Patch\n*** Add File: x\n*** End Patch"
        )


# =============================================================================
# V4A 应用语义
# =============================================================================


def test_v4a_apply_update_with_anchor_and_replacement():
    content = "def a():\n    return 1\n\n\ndef b():\n    return 1\n"
    chunks = [
        {
            "anchor": "def b():",
            "lines": [(" ", "    return 1"), ("+", "    return 2")],
            "eof": False,
        }
    ]
    result = _apply_v4a_to_content(content, chunks, "t.py")
    # codex 语义:上下文行原样保留;锚点后第一个 return 1 保留,追加 return 2
    assert result == "def a():\n    return 1\n\n\ndef b():\n    return 1\n    return 2\n"


def test_v4a_apply_sequential_chunks_advance():
    """多代码块顺序推进:两处相同文本各自被改(line_index 只前进)。"""
    content = "x = 1\ny = 2\nx = 1\n"
    chunks = [
        {"anchor": None, "lines": [("-", "x = 1"), ("+", "x = 10")], "eof": False},
        {"anchor": None, "lines": [("-", "x = 1"), ("+", "x = 20")], "eof": False},
    ]
    result = _apply_v4a_to_content(content, chunks, "t.py")
    assert result == "x = 10\ny = 2\nx = 20\n"


def test_v4a_apply_pure_insert_and_eof():
    content = "a\nb\n"
    chunks = [
        {"anchor": "a", "lines": [("+", "a2")], "eof": False},
        {"anchor": None, "lines": [("+", "tail")], "eof": True},
    ]
    result = _apply_v4a_to_content(content, chunks, "t.py")
    assert result == "a\na2\nb\ntail\n"


def test_v4a_apply_failure_localizes_chunk():
    content = "one\ntwo\n"
    chunks = [{"anchor": None, "lines": [("-", "three"), ("+", "3")], "eof": False}]
    with pytest.raises(ValueError, match="第 1 个代码块"):
        _apply_v4a_to_content(content, chunks, "t.py")


def test_v4a_apply_trailing_empty_sentinel_retry():
    """codex 兼容:pattern 尾部空串(终止换行哨兵)失配时剔除重试。"""
    content = "end line\n"
    chunks = [
        {
            "anchor": None,
            "lines": [("-", "end line"), ("-", ""), ("+", "end line"), ("+", "")],
            "eof": True,
        }
    ]
    result = _apply_v4a_to_content(content, chunks, "t.py")
    assert result == "end line\n"


# =============================================================================
# V4A 端到端(apply_patch 工具)
# =============================================================================


def _v4a_patch_text() -> str:
    return """*** Begin Patch
*** Add File: v4a_new.txt
+created-by-v4a
*** Update File: v4a_edit.txt
@@
-old value
+new value
*** Move to: v4a_edit_renamed.txt
*** Update File: v4a_tail.txt
@@
+tail
*** End of File
*** Delete File: v4a_gone.txt
*** End Patch"""


@pytest.mark.asyncio
async def test_apply_patch_v4a_e2e(tmp_path):
    """V4A 全流程:新增/更新+移动/尾部插入/删除,一次原子应用。"""
    (tmp_path / "v4a_edit.txt").write_text("old value\n", encoding="utf-8")
    (tmp_path / "v4a_tail.txt").write_text("keep\n", encoding="utf-8")
    (tmp_path / "v4a_gone.txt").write_text("bye\n", encoding="utf-8")
    engine, _ = _engine()
    started = await _rpc(
        engine, "thread.start", {"workspace": str(tmp_path)}, req_id=1
    )
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "apply_patch")
    result = await tool.executor({"patch": _v4a_patch_text()})
    assert result.get("applied") is True, result
    actions = {r["path"]: r["action"] for r in result["files"]}
    assert actions["v4a_new.txt"] == "created"
    assert actions["v4a_edit_renamed.txt"] == "updated"
    assert actions["v4a_edit.txt"] == "deleted"
    assert actions["v4a_tail.txt"] == "updated"
    assert actions["v4a_gone.txt"] == "deleted"
    # 落盘核验
    assert (tmp_path / "v4a_new.txt").read_text(encoding="utf-8").strip() == "created-by-v4a"
    assert "new value" in (tmp_path / "v4a_edit_renamed.txt").read_text(encoding="utf-8")
    assert not (tmp_path / "v4a_edit.txt").exists()
    assert (tmp_path / "v4a_tail.txt").read_text(encoding="utf-8") == "keep\ntail\n"
    assert not (tmp_path / "v4a_gone.txt").exists()


@pytest.mark.asyncio
async def test_apply_patch_v4a_atomic_reject(tmp_path):
    """任一代码块失配 → 整包拒绝,零落盘。"""
    (tmp_path / "v4a_edit.txt").write_text("old value\n", encoding="utf-8")
    engine, _ = _engine()
    started = await _rpc(
        engine, "thread.start", {"workspace": str(tmp_path)}, req_id=1
    )
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "apply_patch")
    bad_patch = (
        "*** Begin Patch\n"
        "*** Add File: v4a_ok.txt\n"
        "+fine\n"
        "*** Update File: v4a_edit.txt\n"
        "@@ non-existent-anchor\n"
        "-nothing matches here\n"
        "+nope\n"
        "*** End Patch"
    )
    result = await tool.executor({"patch": bad_patch})
    assert "error" in result and "未找到" in result["error"]
    assert not (tmp_path / "v4a_ok.txt").exists()  # 新增也回滚
    assert (tmp_path / "v4a_edit.txt").read_text(encoding="utf-8") == "old value\n"


@pytest.mark.asyncio
async def test_apply_patch_v4a_rejects_workspace_escape(tmp_path):
    """V4A 路径越出工作区必须拒绝。"""
    engine, _ = _engine()
    started = await _rpc(
        engine, "thread.start", {"workspace": str(tmp_path)}, req_id=1
    )
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "apply_patch")
    result = await tool.executor(
        {
            "patch": (
                "*** Begin Patch\n*** Add File: ../escape.txt\n+x\n*** End Patch"
            )
        }
    )
    assert "越出工作区" in result["error"]


# =============================================================================
# web_search allowedDomains
# =============================================================================


@pytest.mark.asyncio
async def test_web_search_allowed_domains_filter(monkeypatch):
    """allowedDomains 白名单:仅保留命中域名(含子域)的结果。"""
    async def _fake(args):
        return {
            "results": [
                {"url": "https://docs.python.org/3/library/asyncio.html", "title": "asyncio"},
                {"url": "https://blog.example.com/post", "title": "blog"},
                {"url": "https://pypi.org/project/x/", "title": "pypi"},
            ],
            "total": 3,
            "message": "",
        }

    monkeypatch.setattr("app.services.mcp_server._tool_web_search", _fake)
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "web_search")
    result = await tool.executor(
        {"query": "q", "allowedDomains": ["python.org", "pypi.org"]}
    )
    urls = [r["url"] for r in result["results"]]
    assert urls == [
        "https://docs.python.org/3/library/asyncio.html",
        "https://pypi.org/project/x/",
    ]
    assert result["total"] == 2


@pytest.mark.asyncio
async def test_web_search_without_domains_keeps_all(monkeypatch):
    async def _fake(args):
        return {
            "results": [{"url": "https://a.com"}, {"url": "https://b.com"}],
            "total": 2,
            "message": "",
        }

    monkeypatch.setattr("app.services.mcp_server._tool_web_search", _fake)
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "web_search")
    result = await tool.executor({"query": "q"})
    assert result["total"] == 2
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
