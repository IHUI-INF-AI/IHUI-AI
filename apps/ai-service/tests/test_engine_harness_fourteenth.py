# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Harness 工程体验与容错(2026-09-18 第十四批)单测。

聚焦「模型真实输出」与「零反馈死角」:
- 补丁宽松解析:markdown 围栏(```/~~~)、围栏前后说明文字、CRLF、shell 包装
- 未闭合补丁:给出可操作提示(不静默、不半应用)
- 失配失败回执带 hint + file;结果带 notes(宽松处理记录)与 changed 标记
- 非 git 工作区:turn.diff 由 mtime 快照兜底(新增/删除/修改)
- file_search 零结果给可操作建议
"""

from typing import Any

import pytest

from app.services.agent_engine import (
    METHOD_NOT_FOUND,
    AgentEngine,
    _parse_unified_patch,
    _parse_v4a_patch,
    _preclean_patch_text,
    _suggest_close,
)


async def _engine_rpc(
    engine: AgentEngine, method: str, params: dict[str, Any] | None = None
) -> dict[str, Any]:
    """向引擎发一条 JSON-RPC 请求(handle_message 支持 dict 报文)。"""
    message: dict[str, Any] = {"jsonrpc": "2.0", "id": 1, "method": method}
    if params is not None:
        message["params"] = params
    response = await engine.handle_message(message)
    assert response is not None
    return response


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


def _find_builtin(engine: AgentEngine, thread: Any, name: str) -> Any:
    for definition in engine._builtin_tool_definitions(thread):
        if getattr(definition, "name", "") == name:
            return definition
    raise AssertionError(f"内置工具未注入: {name}")


async def _start(engine: AgentEngine, workspace: str, collector: Any = None) -> Any:
    msg: dict[str, Any] = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "thread.start",
        "params": {"workspace": workspace},
    }
    if collector is not None:
        resp = await engine.handle_message(msg, emit=collector)
    else:
        resp = await engine.handle_message(msg)
    assert "error" not in resp, resp
    return engine._threads[resp["result"]["threadId"]]


# =============================================================================
# 宽松预处理
# =============================================================================


def test_preclean_strips_fences_and_prose():
    raw = "好的,补丁如下:\n```diff\n--- a/a.py\n+++ b/a.py\n@@ -1 +1 @@\n-x\n+y\n```\n"
    text, notes = _preclean_patch_text(raw)
    assert "```" not in text and "补丁如下" not in text
    assert text.startswith("--- a/a.py")
    assert any("围栏" in n for n in notes)
    assert any("说明文字" in n for n in notes)


def test_preclean_handles_crlf_and_tilde_fence():
    raw = "~~~patch\r\n*** Begin Patch\r\n*** Add File: x\r\n+y\r\n*** End Patch\r\n~~~\r\n"
    text, _ = _preclean_patch_text(raw)
    assert "\r" not in text
    assert text.startswith("*** Begin Patch")
    assert text.endswith("*** End Patch")


@pytest.mark.parametrize(
    "fence", ["```", "```diff", "```patch", "~~~", "~~~diff"]
)
def test_both_parsers_accept_fenced_patch(fence: str):
    """模型最常输出形态:围栏包裹的 unified diff / V4A,必须都能解析。"""
    unified = (
        f"我来改一下:\n{fence}\n--- a/a.py\n+++ b/a.py\n@@ -1 +1 @@\n-x\n+y\n{fence}\n"
    )
    notes: list[str] = []
    sections = _parse_unified_patch(unified, notes)
    assert sections and sections[0]["old_path"] == "a/a.py"
    assert notes

    v4a = (
        f"{fence}\n*** Begin Patch\n*** Update File: a.py\n@@\n-x\n+y\n"
        f"*** End Patch\n{fence}\n"
    )
    notes2: list[str] = []
    sections2 = _parse_v4a_patch(v4a, notes2)
    assert sections2 and sections2[0]["old_path"] == "a.py"


def test_unclosed_patch_rejected_with_actionable_hint():
    """未闭合补丁:拒绝并给出如何修复的提示(绝不半应用)。"""
    with pytest.raises(ValueError) as ei:
        _parse_v4a_patch("*** Begin Patch\n*** Update File: a.py\n@@\n-x\n+y\n")
    assert "End Patch" in str(ei.value)
    assert "重新生成完整补丁" in str(ei.value)


# =============================================================================
# apply_patch 回执体验
# =============================================================================


@pytest.mark.asyncio
async def test_apply_patch_reports_notes_and_changed(tmp_path):
    """围栏+前言的 V4A 补丁可应用;回执带 notes 与每文件 changed 标记。"""
    (tmp_path / "a.py").write_text("x\n", encoding="utf-8")
    engine = _engine()
    thread = await _start(engine, str(tmp_path))
    tool = _find_builtin(engine, thread, "apply_patch")
    patch = (
        "我先修一下这个文件:\n"
        "```patch\n"
        "*** Begin Patch\n"
        "*** Update File: a.py\n"
        "@@\n"
        "-x\n"
        "+y\n"
        "*** End Patch\n"
        "```\n"
    )
    result = await tool.executor({"patch": patch})
    assert result["applied"] is True, result
    assert any("围栏" in n for n in result["notes"])
    assert result["files"][0]["changed"] is True
    assert (tmp_path / "a.py").read_text(encoding="utf-8") == "y\n"


@pytest.mark.asyncio
async def test_apply_patch_noop_marks_changed_false(tmp_path):
    """补丁合法但结果同原文 → changed=false(不冒充改动)。"""
    (tmp_path / "a.py").write_text("x\n", encoding="utf-8")
    engine = _engine()
    thread = await _start(engine, str(tmp_path))
    tool = _find_builtin(engine, thread, "apply_patch")
    patch = (
        "*** Begin Patch\n"
        "*** Update File: a.py\n"
        "@@\n"
        " x\n"
        "*** End Patch"
    )
    result = await tool.executor({"patch": patch})
    assert result["applied"] is True
    assert result["files"][0]["changed"] is False


@pytest.mark.asyncio
async def test_apply_patch_failure_carries_hint_and_file(tmp_path):
    """上下文失配:回执带 file 与可执行 hint。"""
    (tmp_path / "a.py").write_text("real content\n", encoding="utf-8")
    engine = _engine()
    thread = await _start(engine, str(tmp_path))
    tool = _find_builtin(engine, thread, "apply_patch")
    result = await tool.executor(
        {
            "patch": (
                "*** Begin Patch\n*** Update File: a.py\n@@\n-not-here\n+nope\n"
                "*** End Patch"
            )
        }
    )
    assert "error" in result
    assert result["file"] == "a.py"
    assert "read_file" in result["hint"]


# =============================================================================
# 非 git 工作区 turn.diff 兜底
# =============================================================================


@pytest.mark.asyncio
async def test_turn_diff_fallback_without_git(tmp_path):
    """非 git 目录:mtime 快照比对出新增/修改,turn.diff 照样下发。"""
    (tmp_path / "keep.txt").write_text("v1\n", encoding="utf-8")

    async def mutate() -> None:
        (tmp_path / "brand.py").write_text("print(1)\n", encoding="utf-8")
        (tmp_path / "sub").mkdir(exist_ok=True)
        (tmp_path / "sub" / "extra.txt").write_text("e\n", encoding="utf-8")

    engine = _engine(on_run=mutate)
    collector = _Collector()
    thread = await _start(engine, str(tmp_path), collector)
    resp = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "thread.prompt",
            "params": {"threadId": thread.thread_id, "input": "go"},
        },
        emit=collector,
    )
    assert "error" not in resp, resp
    payloads = collector.payloads("turn.diff")
    assert payloads, "非 git 工作区也应下发 turn.diff"
    payload = payloads[-1]
    assert payload["baselineSource"] == "mtime-snapshot"
    statuses = {c["path"]: c["status"] for c in payload["changes"]}
    assert statuses.get("brand.py") == "A"
    assert "a/brand.py" in payload["unifiedDiff"]


@pytest.mark.asyncio
async def test_turn_diff_silent_when_nothing_changed(tmp_path):
    """非 git 目录且无变化 → 不发事件(不制造噪音)。"""
    engine = _engine()
    collector = _Collector()
    thread = await _start(engine, str(tmp_path), collector)
    await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "thread.prompt",
            "params": {"threadId": thread.thread_id, "input": "go"},
        },
        emit=collector,
    )
    assert collector.payloads("turn.diff") == []


# =============================================================================
# file_search 零结果提示
# =============================================================================


@pytest.mark.asyncio
async def test_file_search_zero_result_gives_advice(tmp_path):
    from app.services.mcp_server import _tool_file_search

    (tmp_path / "only.py").write_text("x = 1\n", encoding="utf-8")
    result = await _tool_file_search({"pattern": "*.zzz", "path": str(tmp_path)})
    assert result["total"] == 0
    assert "fuzzy=true" in result["message"]

# =============================================================================
# 幂等重复应用 + 失配自纠诊断 + 换行风格/BOM 保留
# =============================================================================


@pytest.mark.asyncio
async def test_apply_patch_idempotent_second_run(tmp_path):
    """同一补丁重复应用:不报错、不重复插入,标记为 unchanged。"""
    (tmp_path / "a.py").write_text("alpha\nbeta\ngamma\n", encoding="utf-8")
    engine = _engine()
    thread = await _start(engine, str(tmp_path))
    tool = _find_builtin(engine, thread, "apply_patch")
    patch = (
        "*** Begin Patch\n"
        "*** Update File: a.py\n"
        "@@\n"
        "-beta\n"
        "+BETA\n"
        "*** End Patch"
    )
    first = await tool.executor({"patch": patch})
    assert first["applied"] is True
    assert first["files"][0]["changed"] is True
    assert (tmp_path / "a.py").read_text(encoding="utf-8") == (
        "alpha\nBETA\ngamma\n"
    )

    second = await tool.executor({"patch": patch})
    assert second["applied"] is True, second
    assert second["files"][0]["action"] == "unchanged"
    assert second["files"][0]["changed"] is False
    assert second["changedCount"] == 0
    assert second["noChange"] is True
    assert any("已存在" in n for n in second["notes"])
    # 幂等不得二次插入或破坏文件
    assert (tmp_path / "a.py").read_text(encoding="utf-8") == (
        "alpha\nBETA\ngamma\n"
    )


@pytest.mark.asyncio
async def test_apply_patch_mismatch_diagnosis_is_actionable(tmp_path):
    """上下文失配要给出最接近行号与期望/实际对照(模型可据此自纠)。"""
    (tmp_path / "a.py").write_text("alpha\n    beta\ngamma\n", encoding="utf-8")
    engine = _engine()
    thread = await _start(engine, str(tmp_path))
    tool = _find_builtin(engine, thread, "apply_patch")
    result = await tool.executor(
        {
            "patch": (
                "*** Begin Patch\n*** Update File: a.py\n@@\n-beta\n+B\n"
                "*** End Patch"
            )
        }
    )
    err = result["error"]
    assert "最接近位置" in err
    assert "第 2 行" in err
    assert "期望:" in err and "实际:" in err
    assert "'    beta'" in err  # 实际行的缩进被如实呈现


@pytest.mark.asyncio
async def test_apply_patch_preserves_crlf_and_bom(tmp_path):
    """CRLF/BOM 文件打补丁后不被悄悄改成 LF 或丢掉 BOM。"""
    target = tmp_path / "a.py"
    target.write_bytes(b"\xef\xbb\xbfalpha\r\nbeta\r\ngamma\r\n")
    engine = _engine()
    thread = await _start(engine, str(tmp_path))
    tool = _find_builtin(engine, thread, "apply_patch")
    result = await tool.executor(
        {
            "patch": (
                "*** Begin Patch\n"
                "*** Update File: a.py\n"
                "@@\n"
                "-beta\n"
                "+BETA\n"
                "*** End Patch"
            )
        }
    )
    assert result["applied"] is True, result
    raw = target.read_bytes()
    assert raw.startswith(b"\xef\xbb\xbf"), "BOM 丢失"
    assert raw.count(b"\r\n") == 3, "换行风格被改成 LF"
    assert b"\n" not in raw.replace(b"\r\n", b""), "出现裸 LF"
    assert raw.decode("utf-8-sig") == "alpha\r\nBETA\r\ngamma\r\n"


@pytest.mark.asyncio
async def test_apply_patch_unified_idempotent(tmp_path):
    """unified diff 同样幂等:hunk 已应用 → unchanged,不重复追加。"""
    (tmp_path / "a.py").write_text("a\nb\nc\n", encoding="utf-8")
    engine = _engine()
    thread = await _start(engine, str(tmp_path))
    tool = _find_builtin(engine, thread, "apply_patch")
    patch = (
        "--- a/a.py\n"
        "+++ b/a.py\n"
        "@@ -1,3 +1,3 @@\n"
        " a\n"
        "-b\n"
        "+B\n"
        " c\n"
    )
    first = await tool.executor({"patch": patch})
    assert first["applied"] is True
    assert (tmp_path / "a.py").read_text(encoding="utf-8") == "a\nB\nc\n"
    second = await tool.executor({"patch": patch})
    assert second["applied"] is True, second
    assert second["files"][0]["action"] == "unchanged"
    assert (tmp_path / "a.py").read_text(encoding="utf-8") == "a\nB\nc\n"

# =============================================================================
# 未知方法 / 未知工具的可纠错回执(did-you-mean)
# =============================================================================


def test_suggest_close_normalizes_separators_and_case():
    """大小写、_ 与 . 互转、前导斜杠等常见笔误都能标准化后精确命中。"""
    known = ["thread.start", "thread.prompt", "turn.interrupt", "plan.update"]
    assert _suggest_close("thread_start", known) == ["thread.start"]
    assert _suggest_close("Thread.Start", known) == ["thread.start"]
    assert _suggest_close("/thread.start", known) == ["thread.start"]
    assert _suggest_close("plan_update", known) == ["plan.update"]


def test_suggest_close_fuzzy_and_empty():
    """拼错时给近似候选;完全无关时返回空(由调用方回退全量清单)。"""
    known = ["thread.start", "turn.interrupt", "plan.update"]
    hits = _suggest_close("thred.start", known)
    assert hits and hits[0] == "thread.start"
    assert _suggest_close("zzzzzzzz", known) == []


@pytest.mark.asyncio
async def test_unknown_method_error_suggests_nearest():
    """未知方法回执直接给出最可能想调的方法名,而不是只铺一长串清单。"""
    engine = _engine()
    response = await _engine_rpc(engine, "thread_start")
    assert response["error"]["code"] == METHOD_NOT_FOUND
    message = response["error"]["message"]
    assert "是否想调用" in message
    assert "thread.start" in message
    assert response["error"]["data"]["suggestions"] == ["thread.start"]
    # 全量清单仍在,保证兜底可用
    assert "thread.prompt" in response["error"]["data"]["supported"]


@pytest.mark.asyncio
async def test_unknown_method_without_match_falls_back_to_list():
    """完全无关的方法名:不给误导性推荐,直接列可用清单。"""
    engine = _engine()
    response = await _engine_rpc(engine, "qqqq.wwww")
    assert response["error"]["code"] == METHOD_NOT_FOUND
    assert response["error"]["data"]["suggestions"] == []
    assert "可用方法" in response["error"]["message"]
    assert "thread.prompt" in response["error"]["data"]["supported"]


@pytest.mark.asyncio
async def test_unknown_tool_error_suggests_nearest():
    """未知工具回执给出近似工具名(工具清单上百个,铺全会淹没有效信息)。"""
    from app.services.mcp_server import mcp_server

    result = await mcp_server.call_tool("ReadFile", {}, user_role=1)
    assert result["ok"] is False
    assert "read_file" in result["error"]
    assert "read_file" in result["suggestions"]
    assert isinstance(result["available"], list) and result["available"]
