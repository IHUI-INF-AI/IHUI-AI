# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""2-3 验证自愈集成契约测试(2026-09-12 立)。

覆盖:
- _extract_pytest_target:pytest 命令目标提取(直接/-m 两种形态)
- _detect_failed_test_signal:失败 pytest 信号检测(failed>0 / 蛇形 exit_code /
  非 pytest / 绿 / error 结果均不触发)
- _maybe_self_heal:默认 off 零差异;开启后触发 heal、失败回滚护栏、
  成功保留补丁、同命令去重
"""

from __future__ import annotations

from typing import Any

from app.services.agent_loop_v2 import (
    AgentLoopV2,
    ToolCall,
    ToolResult,
    _detect_failed_test_signal,
    _extract_pytest_target,
)


class _StubLLM:
    """不参与 _maybe_self_heal 的最小 LLM 桩。"""


def _loop() -> AgentLoopV2:
    return AgentLoopV2(_StubLLM(), [], max_iterations=5, session_id="test-self-heal")


def _tc_tr(command: str, result: dict[str, Any]) -> tuple[ToolCall, ToolResult]:
    return (
        ToolCall(id="c1", name="run_command", args={"command": command}),
        ToolResult(tool_call_id="c1", name="run_command", result=result),
    )


# ---- _extract_pytest_target ----


def test_extract_pytest_target_basic() -> None:
    assert _extract_pytest_target("pytest tests/x.py") == "tests/x.py"


def test_extract_pytest_target_module_form() -> None:
    assert _extract_pytest_target("python -m pytest tests/x.py::test_a -q") == "tests/x.py::test_a"


def test_extract_pytest_target_no_target() -> None:
    assert _extract_pytest_target("pytest -q") is None


def test_extract_pytest_target_not_pytest() -> None:
    assert _extract_pytest_target("pnpm test") is None


# ---- _detect_failed_test_signal ----


def test_detect_failed_pytest_signal() -> None:
    tc, tr = _tc_tr("pytest tests/x.py", {"exit_code": 1, "passed": 3, "failed": 2})
    signal = _detect_failed_test_signal([tc], [tr])
    assert signal is not None
    assert signal["command"] == "pytest tests/x.py"
    assert signal["target"] == "tests/x.py"
    assert signal["failed"] == 2
    assert signal["exit_code"] == 1


def test_detect_signal_snake_exit_code_only() -> None:
    """蛇形 exit_code 非零(无 passed/failed)也应触发(2-3 键名兼容)。"""
    tc, tr = _tc_tr("pytest tests/x.py", {"exit_code": 2})
    signal = _detect_failed_test_signal([tc], [tr])
    assert signal is not None
    assert signal["exit_code"] == 2


def test_detect_signal_not_pytest_command() -> None:
    tc, tr = _tc_tr("pnpm test", {"exit_code": 1, "failed": 2})
    assert _detect_failed_test_signal([tc], [tr]) is None


def test_detect_signal_green_suite() -> None:
    tc, tr = _tc_tr("pytest tests/x.py", {"exit_code": 0, "passed": 5, "failed": 0})
    assert _detect_failed_test_signal([tc], [tr]) is None


def test_detect_signal_error_result_skipped() -> None:
    tc = ToolCall(id="c1", name="run_command", args={"command": "pytest tests/x.py"})
    tr = ToolResult(tool_call_id="c1", name="run_command", result={}, error="timeout")
    assert _detect_failed_test_signal([tc], [tr]) is None


# ---- _maybe_self_heal ----


async def test_maybe_self_heal_disabled_by_default(monkeypatch) -> None:
    """默认 off:即使信号命中也零差异(不发事件、不改 messages、不计数)。"""
    monkeypatch.delenv("AGENT_SELF_HEALING_ENABLED", raising=False)
    loop = _loop()
    tc, tr = _tc_tr("pytest tests/x.py", {"exit_code": 1, "failed": 2})
    messages: list[dict[str, Any]] = []
    await loop._maybe_self_heal(1, messages, [tc], [tr])
    assert messages == []
    assert loop._self_heal_runs == 0


class _Outcome:
    """HealOutcome 最小桩(to_dict 契约)。"""

    def __init__(self, ok: bool, attempts: int = 1) -> None:
        self.ok = ok
        self.attempts = attempts

    def to_dict(self) -> dict[str, Any]:
        return {"ok": self.ok, "attempts": self.attempts}


async def test_maybe_self_heal_failure_rolls_back_patched_files(
    monkeypatch, tmp_path
) -> None:
    """heal 未修复 → 被补丁文件回滚到 pre-heal 内容 + user 消息注入未成功摘要。"""
    target = tmp_path / "test_x.py"
    original = "def test_a():\n    assert True\n"
    target.write_text(original, encoding="utf-8")

    import app.services.self_healing_llm as sh_llm

    def fake_llm_patch_fn(failure, context, *, llm=None, model=None):
        return {"file_path": str(target), "new_content": "# broken by heal\n"}

    monkeypatch.setenv("AGENT_SELF_HEALING_ENABLED", "true")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(tmp_path))
    monkeypatch.setattr(sh_llm, "llm_patch_fn", fake_llm_patch_fn)

    import app.services.self_healing as sh

    def fake_heal(task, cases, *, gen_fn=None, runner=None, max_attempts=3, patch_fn=None):
        assert patch_fn is not None
        patch_fn(task, {"failures": [{"test_id": "test_a", "message": "boom"}]})
        return _Outcome(ok=False, attempts=1)

    monkeypatch.setattr(sh, "heal", fake_heal)

    loop = _loop()
    tc, tr = _tc_tr(f"pytest {target}", {"exit_code": 1, "failed": 1})
    messages: list[dict[str, Any]] = []
    await loop._maybe_self_heal(1, messages, [tc], [tr])

    # 回滚护栏:补丁被撤销,文件恢复 pre-heal 内容
    assert target.read_text(encoding="utf-8") == original
    # 结果以 user 消息注入(LLM 感知)
    assert len(messages) == 1
    assert messages[0]["role"] == "user"
    assert "未成功" in messages[0]["content"]
    assert loop._self_heal_runs == 1


async def test_maybe_self_heal_success_keeps_patch(monkeypatch, tmp_path) -> None:
    """heal 修复成功 → 补丁保留(不回滚)+ user 消息注入成功摘要。"""
    target = tmp_path / "test_x.py"
    target.write_text("def test_a():\n    assert False\n", encoding="utf-8")

    import app.services.self_healing as sh
    import app.services.self_healing_llm as sh_llm

    monkeypatch.setenv("AGENT_SELF_HEALING_ENABLED", "true")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(tmp_path))

    def fake_llm_patch_fn(failure, context, *, llm=None, model=None):
        return {"file_path": str(target), "new_content": "def test_a():\n    assert True\n"}

    monkeypatch.setattr(sh_llm, "llm_patch_fn", fake_llm_patch_fn)

    def fake_heal(task, cases, *, gen_fn=None, runner=None, max_attempts=3, patch_fn=None):
        patch_fn(task, {"failures": [{"test_id": "test_a", "message": "boom"}]})
        return _Outcome(ok=True, attempts=1)

    monkeypatch.setattr(sh, "heal", fake_heal)

    loop = _loop()
    tc, tr = _tc_tr(f"pytest {target}", {"exit_code": 1, "failed": 1})
    messages: list[dict[str, Any]] = []
    await loop._maybe_self_heal(1, messages, [tc], [tr])

    assert target.read_text(encoding="utf-8") == "def test_a():\n    assert True\n"
    assert len(messages) == 1
    assert "成功" in messages[0]["content"]


async def test_maybe_self_heal_dedupes_same_command(monkeypatch, tmp_path) -> None:
    """同一失败命令二次触发被去重(单 run 上限默认 1)。"""
    target = tmp_path / "test_x.py"
    target.write_text("def test_a():\n    assert True\n", encoding="utf-8")

    import app.services.self_healing as sh
    import app.services.self_healing_llm as sh_llm

    monkeypatch.setenv("AGENT_SELF_HEALING_ENABLED", "true")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(tmp_path))
    monkeypatch.setattr(
        sh_llm,
        "llm_patch_fn",
        lambda failure, context, *, llm=None, model=None: None,
    )

    heal_calls: list[Any] = []

    def fake_heal(task, cases, *, gen_fn=None, runner=None, max_attempts=3, patch_fn=None):
        heal_calls.append(task)
        return _Outcome(ok=True, attempts=1)

    monkeypatch.setattr(sh, "heal", fake_heal)

    loop = _loop()
    tc, tr = _tc_tr(f"pytest {target}", {"exit_code": 1, "failed": 1})
    messages: list[dict[str, Any]] = []
    await loop._maybe_self_heal(1, messages, [tc], [tr])
    await loop._maybe_self_heal(2, messages, [tc], [tr])

    assert len(heal_calls) == 1
    assert len(messages) == 1
