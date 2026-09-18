# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Harness 输出净化与模糊搜索(2026-09-18 第十一批)单测。

覆盖(对标 Codex ansi-escape / file-search(nucleo)/ process-hardening):
- strip_ansi:CSI/OSC/单字符转义剥离;干净文本零改动
- fuzzy_score:子序列评分/非匹配 None/连续链与词首加分
- file_search fuzzy 模式:模糊排序返回;glob 模式行为不变
- unified_exec 输出经 ANSI 清洗;子进程 env 消毒
"""

import os
from typing import Any

import pytest

from app.core.output_cleaning import fuzzy_score, strip_ansi
from app.services.agent_engine import AgentEngine, _sanitized_child_env


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
    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        return _FakeLoop()

    return AgentEngine(loop_factory=factory, **kwargs)


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
# strip_ansi
# =============================================================================


def test_strip_ansi_removes_csi_osc_and_single_char():
    raw = (
        "\x1b[31mred\x1b[0m plain \x1b]0;title\x07 tail \x1bM more \x1b[2K\x1b[1G"
    )
    cleaned = strip_ansi(raw)
    assert cleaned == "red plain  tail  more "


def test_strip_ansi_passthrough_clean_text():
    text = "普通文本 with ASCII and 中文\nnewline\ttab"
    assert strip_ansi(text) is text  # 零拷贝快速路径


# =============================================================================
# fuzzy_score
# =============================================================================


def test_fuzzy_score_subsequence_and_reject():
    assert fuzzy_score("apl", "apple.py") is not None
    assert fuzzy_score("elppa", "apple.py") is None  # 顺序不对
    assert fuzzy_score("", "anything") == 0


def test_fuzzy_score_consecutive_beats_scattered():
    consecutive = fuzzy_score("abc", "abcdef.py")
    scattered = fuzzy_score("abc", "axbxcy.py")
    assert consecutive is not None and scattered is not None
    assert consecutive > scattered


def test_fuzzy_score_word_start_bonus():
    at_word_start = fuzzy_score("u", "my_utils.py")
    mid_word = fuzzy_score("u", "busy.py")
    assert at_word_start is not None and mid_word is not None
    assert at_word_start > mid_word


# =============================================================================
# file_search fuzzy 模式
# =============================================================================


@pytest.mark.asyncio
async def test_file_search_fuzzy_mode(tmp_path, monkeypatch):
    """fuzzy=true:模糊子序列命中按相关度排序返回。"""
    from app.services.mcp_server import _tool_file_search

    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "apple_parser.py").write_text("x = 1\n", encoding="utf-8")
    (tmp_path / "src" / "banana.py").write_text("y = 2\n", encoding="utf-8")
    (tmp_path / "apply_helper.py").write_text("z = 3\n", encoding="utf-8")

    result = await _tool_file_search(
        {"query": "aply", "path": str(tmp_path), "fuzzy": True, "max_results": 10}
    )
    assert result["ok"] is True and result["fuzzy"] is True
    paths = [m["path"] for m in result["matches"]]
    assert "src/apple_parser.py" in [p.replace("\\", "/") for p in paths]
    assert "apply_helper.py" in [p.replace("\\", "/") for p in paths]
    assert "banana.py" not in [p.replace("\\", "/") for p in paths]
    # 排序:apple_parser(连续 ap+词首)应优于 apply_helper 或至少都有分
    assert all("score" in m for m in result["matches"])


@pytest.mark.asyncio
async def test_file_search_glob_mode_unchanged(tmp_path):
    """不传 fuzzy 时保持既有 glob 语义。"""
    from app.services.mcp_server import _tool_file_search

    (tmp_path / "a_test.py").write_text("hello\n", encoding="utf-8")
    result = await _tool_file_search(
        {"pattern": "a_*.py", "path": str(tmp_path), "max_results": 10}
    )
    assert result["ok"] is True
    assert any(m["file"] == "a_test.py" for m in result["matches"])
    assert "fuzzy" not in result


# =============================================================================
# unified_exec ANSI 清洗 + env 消毒
# =============================================================================


def test_sanitized_child_env_strips_dangerous_vars(monkeypatch):
    monkeypatch.setenv("LD_PRELOAD", "/evil.so")
    monkeypatch.setenv("LD_AUDIT", "/evil2.so")
    monkeypatch.setenv("DYLD_INSERT_LIBRARIES", "/evil.dylib")
    monkeypatch.setenv("PATH", os.environ.get("PATH", ""))
    env = _sanitized_child_env()
    assert "LD_PRELOAD" not in env
    assert "LD_AUDIT" not in env
    assert "DYLD_INSERT_LIBRARIES" not in env
    assert "PATH" in env


@pytest.mark.asyncio
async def test_unified_exec_output_stripped_of_ansi(tmp_path):
    """shell 输出中的 ANSI 转义在进入缓冲前被剥离。"""
    engine = _engine()
    started = await _rpc(engine, "thread.start", {"workspace": str(tmp_path)})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "unified_exec")
    py = sys_exec = os.path.normpath(os.sys.executable) if hasattr(os, "sys") else None  # noqa: F841
    import sys as _sys

    cmd = f'"{_sys.executable}" -c "import sys; sys.stdout.write(chr(27)+\'[31mRED\'+chr(27)+\'[0m plain\')"'
    result = await tool.executor({"command": cmd, "timeoutMs": 15000})
    text = result.get("output") or result.get("newOutput") or ""
    assert "plain" in text
    assert "\x1b" not in text
    assert "RED" in text
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
