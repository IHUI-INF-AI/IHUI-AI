# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #56 工具自愈信号源扩展测试(2026-09-26 立)。

覆盖:
- classify_run_command_signal:四类信号分类判据(pytest/pnpm test/mypy/tsc/
  npm run build/ruff)+ 绿命令无信号 + 未知命令无信号 + 环境性失败
  (超时/网络)actionable=False + extract_error_digest 提取;
- CommandReplayRunner:重放命令按退出码判绿的 runner 契约;
- _maybe_self_heal 扩展链路:默认 off 零差异(mocker 上层门控)、
  扩展信号触发 heal(mock LLM/runner)、非 actionable 不触发。

默认值取证结论(2026-09-26):AGENT_SELF_HEALING_ENABLED 默认 off 被
tests/test_agent_self_heal.py::test_maybe_self_heal_disabled_by_default 钉住,
且开关与 routers/self_healing.py 同源——本票不翻默认值,放量待办见
self_healing.classify_run_command_signal 注释。
"""

from __future__ import annotations

import sys
from typing import Any

from app.services.agent_loop_v2 import (
    AgentLoopV2,
    ToolCall,
    ToolResult,
    _detect_extended_signal,
)
from app.services.self_healing import (
    classify_run_command_signal,
    extract_error_digest,
)
from app.services.self_healing_llm import CommandReplayRunner


class _StubLLM:
    """不参与自愈链路的最小 LLM 桩。"""


def _loop() -> AgentLoopV2:
    return AgentLoopV2(_StubLLM(), [], max_iterations=5, session_id="test-signal-v56")


def _tc_tr(command: str, result: dict[str, Any]) -> tuple[ToolCall, ToolResult]:
    return (
        ToolCall(id="c1", name="run_command", args={"command": command}),
        ToolResult(tool_call_id="c1", name="run_command", result=result),
    )


# ---- classify_run_command_signal:四类判据 ----


def test_classify_pytest_failure_is_test_framework() -> None:
    sig = classify_run_command_signal(
        "pytest tests/x.py", {"exit_code": 1, "stdout": "FAILED tests/x.py::test_a"}
    )
    assert sig is not None
    assert sig.category == "test_framework"
    assert sig.actionable is True
    assert "FAILED" in sig.error_digest


def test_classify_pnpm_test_failure_is_test_framework() -> None:
    """此前 pytest-only 的卡点:非 pytest 测试命令现在也命中(主产出)。"""
    sig = classify_run_command_signal(
        "pnpm test", {"exit_code": 1, "stderr": "FAIL src/a.test.ts\n"}
    )
    assert sig is not None
    assert sig.category == "test_framework"
    assert sig.actionable is True


def test_classify_mypy_failure_is_type_check() -> None:
    sig = classify_run_command_signal(
        "mypy src", {"exit_code": 2, "stdout": "src/a.py:3: error: Incompatible types\n"}
    )
    assert sig is not None
    assert sig.category == "type_check"
    assert "error:" in sig.error_digest


def test_classify_tsc_failure_is_type_check_with_ts_code() -> None:
    sig = classify_run_command_signal(
        "tsc --noEmit",
        {"exit_code": 2, "stdout": "src/a.ts(3,5): error TS2322: Type 'x' is not assignable\n"},
    )
    assert sig is not None
    assert sig.category == "type_check"
    assert "error TS2322" in sig.error_digest


def test_classify_npm_build_failure_is_build() -> None:
    sig = classify_run_command_signal(
        "npm run build",
        {"exit_code": 1, "stderr": "Module not found: Error: Can't resolve './x'\n"},
    )
    assert sig is not None
    assert sig.category == "build"
    assert "Module not found" in sig.error_digest


def test_classify_ruff_failure_is_lint_with_stats() -> None:
    sig = classify_run_command_signal(
        "ruff check .",
        {"exit_code": 1, "stdout": "Found 3 errors.\n[*] 1 fixable with the --fix option.\n"},
    )
    assert sig is not None
    assert sig.category == "lint"
    assert "Found 3 errors." in sig.error_digest
    assert "fixable" in sig.error_digest


def test_classify_green_command_no_signal() -> None:
    """exit_code=0(绿)不产生信号:自愈只修失败,不动成功路径。"""
    assert classify_run_command_signal("ruff check .", {"exit_code": 0}) is None


def test_classify_unknown_command_no_signal() -> None:
    """不在四类命令表内的失败命令不进自愈(保守:防 LLM 乱补丁)。"""
    assert classify_run_command_signal("git status", {"exit_code": 128}) is None


def test_classify_timeout_not_actionable() -> None:
    """超时(errorCode=TIMEOUT,exit=-1)是环境性失败,不可自愈。"""
    sig = classify_run_command_signal(
        "npm run build",
        {"exit_code": -1, "errorCode": "TIMEOUT", "partial_output": "building..."},
    )
    assert sig is not None
    assert sig.category == "build"
    assert sig.actionable is False


def test_classify_network_error_not_actionable() -> None:
    """网络类错误特征(ECONNREFUSED)不可自愈:LLM 补丁修不了网络。"""
    sig = classify_run_command_signal(
        "npm run build", {"exit_code": 1, "stderr": "Error: connect ECONNREFUSED 127.0.0.1:5432"}
    )
    assert sig is not None
    assert sig.actionable is False


def test_extract_error_digest_falls_back_to_tail() -> None:
    """无错误行命中时兜底取尾部 3 行,不返回空摘要。"""
    digest = extract_error_digest("step1 ok\nstep2 ok\nboom happened", "build")
    assert "boom happened" in digest


# ---- CommandReplayRunner:重放判绿契约 ----


def test_replay_runner_green_on_zero_exit(tmp_path) -> None:
    runner = CommandReplayRunner(
        f'"{sys.executable}" -c "import sys"', cwd=str(tmp_path)
    )
    out = runner.run()
    assert out["exit_code"] == 0
    assert out["failures"] == []


def test_replay_runner_failure_on_nonzero_exit(tmp_path) -> None:
    runner = CommandReplayRunner(
        f'"{sys.executable}" -c "import sys; sys.exit(3)"', cwd=str(tmp_path)
    )
    out = runner.run()
    assert out["exit_code"] == 3
    assert len(out["failures"]) == 1
    assert out["coverage_hint"] == "command"


# ---- _maybe_self_heal 扩展链路 ----


def test_detect_extended_signal_skips_non_actionable() -> None:
    """分类器判 not actionable(超时)→ 适配器不产出信号,heal 不触发。"""
    tc, tr = _tc_tr(
        "npm run build", {"exit_code": -1, "errorCode": "TIMEOUT", "partial_output": "x"}
    )
    assert _detect_extended_signal([tc], [tr]) is None


async def test_maybe_self_heal_untouched_when_disabled(monkeypatch) -> None:
    """默认 off:扩展信号命中也零差异(零事件、零计数)——钉住默认值策略。"""
    monkeypatch.delenv("AGENT_SELF_HEALING_ENABLED", raising=False)
    loop = _loop()
    tc, tr = _tc_tr("mypy src", {"exit_code": 2, "stdout": "a.py:1: error: bad"})
    messages: list[dict[str, Any]] = []
    await loop._maybe_self_heal(1, messages, [tc], [tr])
    assert messages == []
    assert loop._self_heal_runs == 0


class _FlipFlopRunner:
    """第 1 次运行失败、之后成功的验证 runner 桩(模拟补丁生效)。"""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.calls = 0

    def run(self, test_cases: Any = None) -> dict[str, Any]:
        self.calls += 1
        if self.calls == 1:
            return {
                "passed": [],
                "failures": [
                    {
                        "test_id": "mypy src",
                        "message": "a.py:1: error: bad",
                        "exception_type": "CommandFailed",
                    }
                ],
                "coverage_hint": "command",
            }
        return {
            "passed": ["replay_ok"],
            "failures": [],
            "coverage_hint": "command",
        }


class _Outcome:
    """HealOutcome 最小桩(to_dict 契约)。"""

    def __init__(self, ok: bool, attempts: int = 1) -> None:
        self.ok = ok
        self.attempts = attempts

    def to_dict(self) -> dict[str, Any]:
        return {"ok": self.ok, "attempts": self.attempts}


async def test_maybe_self_heal_triggers_on_type_check_signal(
    monkeypatch, tmp_path
) -> None:
    """类型检查失败信号触发 heal:mock LLM 补丁 + 验证 runner 第二轮转绿。"""
    target = tmp_path / "a.py"
    target.write_text("x: int = 'bad'\n", encoding="utf-8")

    import app.services.self_healing_llm as sh_llm

    seen: dict[str, Any] = {}

    def fake_llm_patch_fn(failure, context, *, llm=None, model=None):
        seen["failure"] = failure
        return {"file_path": str(target), "new_content": "x: int = 1\n"}

    monkeypatch.setenv("AGENT_SELF_HEALING_ENABLED", "true")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(tmp_path))
    monkeypatch.setattr(sh_llm, "llm_patch_fn", fake_llm_patch_fn)
    monkeypatch.setattr(
        sh_llm, "llm_gen_fn", lambda task: [{"id": "c1", "description": "x"}]
    )
    monkeypatch.setattr(sh_llm, "CommandReplayRunner", _FlipFlopRunner)

    loop = _loop()
    tc, tr = _tc_tr("mypy src", {"exit_code": 2, "stdout": "a.py:1: error: bad"})
    messages: list[dict[str, Any]] = []
    await loop._maybe_self_heal(1, messages, [tc], [tr])

    # heal 被触发:补丁落盘且验证转绿 → 修复成功、补丁保留
    assert target.read_text(encoding="utf-8") == "x: int = 1\n"
    assert loop._self_heal_runs == 1
    assert len(messages) == 1
    assert "成功" in messages[0]["content"]
    # LLM 补丁拿到的失败上下文带错误摘要(digest 进 failure.message)
    assert "error:" in str(seen["failure"].get("message", ""))


async def test_maybe_self_heal_skips_non_actionable_build_signal(monkeypatch) -> None:
    """环境性构建失败(超时)不触发 heal:不烧 token、不计数。"""
    monkeypatch.setenv("AGENT_SELF_HEALING_ENABLED", "true")
    loop = _loop()
    tc, tr = _tc_tr(
        "npm run build", {"exit_code": -1, "errorCode": "TIMEOUT", "partial_output": "x"}
    )
    messages: list[dict[str, Any]] = []
    await loop._maybe_self_heal(1, messages, [tc], [tr])
    assert messages == []
    assert loop._self_heal_runs == 0


async def test_maybe_self_heal_failure_rolls_back_extended_patch(
    monkeypatch, tmp_path
) -> None:
    """扩展信号 heal 未修复 → 补丁回滚到 pre-heal 内容(与 pytest 路径同护栏)。"""
    target = tmp_path / "a.py"
    original = "x: int = 'bad'\n"
    target.write_text(original, encoding="utf-8")

    import app.services.self_healing_llm as sh_llm

    def fake_llm_patch_fn(failure, context, *, llm=None, model=None):
        return {"file_path": str(target), "new_content": "# broken by heal\n"}

    monkeypatch.setenv("AGENT_SELF_HEALING_ENABLED", "true")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(tmp_path))
    monkeypatch.setattr(sh_llm, "llm_patch_fn", fake_llm_patch_fn)
    monkeypatch.setattr(
        sh_llm, "llm_gen_fn", lambda task: [{"id": "c1", "description": "x"}]
    )

    class _AlwaysFailRunner:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

        def run(self, test_cases: Any = None) -> dict[str, Any]:
            return {
                "passed": [],
                "failures": [
                    {"test_id": "mypy src", "message": "error: bad", "exception_type": "CommandFailed"}
                ],
                "coverage_hint": "command",
            }

    monkeypatch.setattr(sh_llm, "CommandReplayRunner", _AlwaysFailRunner)

    loop = _loop()
    tc, tr = _tc_tr("mypy src", {"exit_code": 2, "stdout": "a.py:1: error: bad"})
    messages: list[dict[str, Any]] = []
    await loop._maybe_self_heal(1, messages, [tc], [tr])

    # 回滚护栏:heal 未修复,文件恢复 pre-heal 内容
    assert target.read_text(encoding="utf-8") == original
    assert len(messages) == 1
    assert "未成功" in messages[0]["content"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
