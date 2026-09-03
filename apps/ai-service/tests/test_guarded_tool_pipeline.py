"""
Unit tests for the unified guarded tool pipeline (guarded_tool_pipeline.py).

All tests are deterministic: they use fake fns and fake guards (real,
in-memory recorders / governors where needed), never a real model.

Covers:
- All-disabled passthrough (zero behavior change)
- scan hit => scan_blocked, fn NOT executed
- prompt injection refuse => injection_blocked, fn NOT executed
- budget exceeded => budget_exceeded, fn NOT executed, rejected call not counted
- normal flow => record written + cost recalibrated + release (active back to 0)
- per-stage try/except silent degradation (one stage must not crash the chain)
- stable error_type constants
- check() read-only snapshot (budget + cost ledger + recorder metrics)
- async guard context manager (success, blocked raising GuardedToolError)
- run_sync passthrough
- stage timings populated
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services.agent_step_recorder import AgentStepRecorder
from app.services.guarded_tool_pipeline import (
    ERROR_BUDGET_EXCEEDED,
    ERROR_INJECTION_BLOCKED,
    ERROR_RECORD_FAILED,
    ERROR_SCAN_BLOCKED,
    GuardedToolError,
    GuardedToolPipeline,
    PipelineResult,
    STAGE_BUDGET,
    STAGE_INPUT,
    STAGE_RECORD,
)
from app.services.tool_budget_governor import (
    BUDGET_EXCEEDED,
    ToolBudgetConfig,
    ToolBudgetGovernor,
)


# =============================================================================
# Fake guards (deterministic, configurable)
# =============================================================================


class FakeScanner:
    """Configurable tool-args scanner."""

    def __init__(self, dangerous: bool = False) -> None:
        self.dangerous = dangerous

    def __call__(self, args, *, tool_name="", flags=None):
        findings = [SimpleNamespace(kind="command_injection")] if self.dangerous else []
        return SimpleNamespace(dangerous=self.dangerous, findings=findings)


def unsafe_args() -> dict:
    return {"command": "ls /tmp"}


def safe_args() -> dict:
    return {"path": "/tmp/x.txt"}


def safe_prompt_guard(text, *, source="mcp", policy="refuse"):
    return {"action": "pass", "risk_level": "low", "hits": [], "blocked": False}


def blocking_prompt_guard(text, *, source="mcp", policy="refuse"):
    return {
        "action": "refuse",
        "risk_level": "high",
        "hits": [{"type": "fake_system_prompt"}],
        "blocked": True,
        "output": "[prompt_guard:refused] suspected injection blocked",
    }


def raising_scanner(args, *, tool_name="", flags=None):
    raise RuntimeError("scanner bug")


class RaisingGovernor:
    """Budget governor whose acquire always raises."""

    def acquire(self, run_id, *, tool_name="", cost_estimate=0.0):
        raise RuntimeError("governor bug")


class RaisingRecorder:
    """Step recorder whose append always raises."""

    def append_step(self, run_id, step):
        raise RuntimeError("record bug")


def _gov(enabled: bool = True, **kw) -> ToolBudgetGovernor:
    defaults = {
        "enabled": enabled,
        "max_tools_per_run": 100,
        "max_cost_per_run_usd": 100.0,
        "max_concurrency": 100,
    }
    defaults.update(kw)
    return ToolBudgetGovernor(ToolBudgetConfig(**defaults))


def _rec(tmp_path) -> AgentStepRecorder:
    return AgentStepRecorder(file_path=tmp_path / "step_records.json")


# =============================================================================
# 1. All-disabled passthrough (zero behavior change)
# =============================================================================


async def test_all_disabled_passthrough():
    """All flags off: fn runs untouched, no guard gating side effects."""
    pl = GuardedToolPipeline()
    calls = []

    def fn(args):
        calls.append(args)
        return {"sum": args["a"] + args["b"]}

    res = await pl.run("add", {"a": 1, "b": 2}, fn=fn, run_id="r")
    assert res.ok is True
    assert res.result == {"sum": 3}
    assert calls == [{"a": 1, "b": 2}]
    assert res.errors == []
    assert res.scan["action"] == "skip"  # scan off
    assert res.budget["reason"] == "guard_disabled"  # budget off
    # only the fn timing is recorded; no pre/post guard stage ran
    assert set(res.stage_timings_ms) == {"fn"}
    assert res.recorded_step_id is None


async def test_all_disabled_no_recording(tmp_path):
    """Even with a recorder injected, no step is produced (record_enabled=False)."""
    rec = _rec(tmp_path)
    pl = GuardedToolPipeline(step_recorder=rec)

    def fn(args):
        return {"ok": True}

    await pl.run("t", {}, fn=fn, run_id="r")
    assert rec.replay("r")["total"] == 0


# =============================================================================
# 2. scan hit => blocked, fn NOT executed
# =============================================================================


async def test_scan_blocked_dangerous_args():
    """Dangerous args => scan_blocked and fn is NOT executed."""
    calls = []
    pl = GuardedToolPipeline(
        scan_enabled=True,
        input_scanner=FakeScanner(dangerous=True),
        prompt_guard=safe_prompt_guard,
    )

    def fn(args):
        calls.append(args)
        return "executed"

    res = await pl.run("exec", unsafe_args(), fn=fn, run_id="r")
    assert res.ok is False
    assert res.errors[0].error_type == ERROR_SCAN_BLOCKED
    assert res.errors[0].stage == STAGE_INPUT
    assert res.result is None
    assert calls == []  # fn NOT executed
    assert res.scan["risk"] == "high"
    assert res.scan["action"] == "block"
    assert res.scan["hits"] == ["command_injection"]


async def test_scan_safe_passes():
    """Safe args => allowed through, fn runs."""
    calls = []
    pl = GuardedToolPipeline(
        scan_enabled=True,
        input_scanner=FakeScanner(dangerous=False),
        prompt_guard=safe_prompt_guard,
    )

    def fn(args):
        calls.append(args)
        return "ok"

    res = await pl.run("read", safe_args(), fn=fn, run_id="r")
    assert res.ok is True
    assert res.result == "ok"
    assert calls == [safe_args()]
    assert res.scan["risk"] == "low"
    assert res.scan["action"] == "pass"


async def test_prompt_injection_blocked():
    """Prompt injection refuse => injection_blocked and fn NOT executed."""
    calls = []
    pl = GuardedToolPipeline(
        scan_enabled=True,
        prompt_guard=blocking_prompt_guard,
        input_scanner=FakeScanner(dangerous=False),
    )

    def fn(args):
        calls.append(args)
        return "executed"

    res = await pl.run("tool", safe_args(), fn=fn, run_id="r")
    assert res.ok is False
    assert res.errors[0].error_type == ERROR_INJECTION_BLOCKED
    assert calls == []


# =============================================================================
# 3. Budget exceeded => budget_exceeded and fn NOT executed
# =============================================================================


async def test_budget_exceeded_blocks_fn():
    """Exceeding the tool-count budget => budget_exceeded, fn NOT executed."""
    gov = _gov(max_tools_per_run=1)
    calls = []

    def fn(args):
        calls.append(args)
        return "ok"

    pl = GuardedToolPipeline(guard_enabled=True, budget_governor=gov)

    res1 = await pl.run("t", {}, fn=fn, run_id="r")
    assert res1.ok is True

    res2 = await pl.run("t", {}, fn=fn, run_id="r")
    assert res2.ok is False
    assert res2.errors[0].error_type == ERROR_BUDGET_EXCEEDED
    assert res2.errors[0].stage == STAGE_BUDGET
    assert calls == [{}]  # second call's fn NOT executed
    st = gov.get_state("r")
    assert st["used"]["tool_count"] == 1  # rejected call not counted
    assert st["used"]["active"] == 0  # released


# =============================================================================
# 4. Normal flow: record + cost recalibrate + release
# =============================================================================


async def test_normal_flow_records_and_releases(tmp_path):
    """All on: fn runs => one recorded step + record_usage recalibrate + release."""
    gov = _gov(max_concurrency=2)
    rec = _rec(tmp_path)
    pl = GuardedToolPipeline(
        scan_enabled=True,
        guard_enabled=True,
        record_enabled=True,
        input_scanner=FakeScanner(dangerous=False),
        prompt_guard=safe_prompt_guard,
        budget_governor=gov,
        step_recorder=rec,
    )

    def fn(args):
        return {"read": args["path"]}

    res = await pl.run("read_file", safe_args(), fn=fn, run_id="r", actual_cost=0.05)
    assert res.ok is True
    assert res.result == {"read": "/tmp/x.txt"}
    assert res.recorded_step_id == 0

    step = rec.replay("r", step_index=0)["step"]
    assert step["tool_name"] == "read_file"
    assert step["status"] == "ok"
    assert step["cost"] == 0.05
    assert step["input_summary"] == '{"path": "/tmp/x.txt"}'

    st = gov.get_state("r")
    assert st["used"]["active"] == 0  # release returned concurrency slot
    assert st["used"]["tool_count"] == 1
    assert st["used"]["cost"] == pytest.approx(0.05)  # recalibrated cost


async def test_fn_error_records_error_step(tmp_path):
    """fn raising => ok=False + tool_error; recorder saves a status=error step."""
    rec = _rec(tmp_path)
    pl = GuardedToolPipeline(record_enabled=True, step_recorder=rec)

    def fn(args):
        raise RuntimeError("boom")

    res = await pl.run("failing", {}, fn=fn, run_id="r")
    assert res.ok is False
    assert res.result is None
    assert res.error_types == ["tool_error"]

    step = rec.replay("r", step_index=0)["step"]
    assert step["status"] == "error"
    assert "boom" in step["result_summary"]


# =============================================================================
# 5. Per-stage silent degradation (one stage must not crash the chain)
# =============================================================================


async def test_stage_error_degrades_not_crash():
    """Budget stage raising => degrade-open, fn still runs, error recorded."""
    calls = []
    pl = GuardedToolPipeline(guard_enabled=True, budget_governor=RaisingGovernor())

    def fn(args):
        calls.append(args)
        return "ran"

    res = await pl.run("t", {}, fn=fn, run_id="r")
    assert res.ok is True  # fn succeeded
    assert res.result == "ran"
    assert calls == [{}]
    assert any(e.stage == "budget" for e in res.errors)


async def test_record_failure_degrades():
    """Record stage raising => recorded into errors, does not change fn result."""
    pl = GuardedToolPipeline(record_enabled=True, step_recorder=RaisingRecorder())

    def fn(args):
        return "done"

    res = await pl.run("t", {}, fn=fn, run_id="r")
    assert res.ok is True
    assert res.result == "done"
    assert any(
        e.error_type == ERROR_RECORD_FAILED and e.stage == STAGE_RECORD for e in res.errors
    )


# =============================================================================
# 6. Stable error_type constants
# =============================================================================


def test_error_type_constants():
    """Deterministic error-code contract."""
    assert ERROR_INJECTION_BLOCKED == "injection_blocked"
    assert ERROR_SCAN_BLOCKED == "scan_blocked"
    assert ERROR_BUDGET_EXCEEDED == "budget_exceeded"
    assert ERROR_BUDGET_EXCEEDED == BUDGET_EXCEEDED  # same source as budget governor
    assert ERROR_RECORD_FAILED == "record_failed"


# =============================================================================
# 7. check() read-only snapshot
# =============================================================================


async def test_check_snapshot(tmp_path):
    """check() aggregates budget used/remaining + cost ledger + recorder metrics."""
    gov = _gov(max_tools_per_run=10, max_cost_per_run_usd=1.0)
    rec = _rec(tmp_path)
    pl = GuardedToolPipeline(
        guard_enabled=True,
        record_enabled=True,
        budget_governor=gov,
        step_recorder=rec,
    )

    def fn(args):
        return "ok"

    await pl.run("read", {}, fn=fn, run_id="r", actual_cost=0.25)
    snap = pl.check("r")
    assert snap["run_id"] == "r"
    assert snap["budget"]["used"]["tool_count"] == 1
    assert snap["budget"]["remaining"]["tools"] == 9
    assert snap["budget"]["remaining"]["cost"] == pytest.approx(0.75)
    assert snap["records"]["step_count"] == 1
    assert snap["cost_ledger"]["total_steps"] == 1
    assert snap["cost_ledger"]["total_cost"] == pytest.approx(0.25)


def test_check_empty_run(tmp_path):
    """Unknown run => all-zero snapshot, no exception."""
    rec = _rec(tmp_path)
    gov = _gov()
    pl = GuardedToolPipeline(budget_governor=gov, step_recorder=rec)
    snap = pl.check("ghost")
    assert snap["budget"]["used"]["tool_count"] == 0
    assert snap["records"]["step_count"] == 0
    assert snap["cost_ledger"]["total_steps"] == 0


# =============================================================================
# 8. async guard context manager + run_sync
# =============================================================================


async def test_guard_async_success(tmp_path):
    """guard() success path: guards passed on entry, result available, recorded."""
    rec = _rec(tmp_path)
    pl = GuardedToolPipeline(
        scan_enabled=True,
        record_enabled=True,
        input_scanner=FakeScanner(dangerous=False),
        prompt_guard=safe_prompt_guard,
        step_recorder=rec,
    )

    def fn(args):
        return {"v": args["x"]}

    async with pl.guard(fn=fn, tool_name="t", args={"x": 1}, run_id="r") as g:
        assert g.result is not None
        assert g.result.ok is True

    assert g.result.result == {"v": 1}
    assert rec.replay("r")["total"] == 1


async def test_guard_async_blocked_raises():
    """guard() blocked by scanner => GuardedToolError carries error_type + stage."""
    pl = GuardedToolPipeline(
        scan_enabled=True,
        input_scanner=FakeScanner(dangerous=True),
        prompt_guard=safe_prompt_guard,
    )

    def fn(args):
        raise AssertionError("should not execute")

    with pytest.raises(GuardedToolError) as exc:
        async with pl.guard(
            fn=fn, tool_name="exec", args=unsafe_args(), run_id="r"
        ):
            pass
    assert exc.value.error_type == ERROR_SCAN_BLOCKED
    assert exc.value.stage == STAGE_INPUT


async def test_guard_budget_raises_budget_exceeded():
    """guard() budget exceeded => GuardedToolError error_type=budget_exceeded."""
    gov = _gov(max_tools_per_run=1)
    pl = GuardedToolPipeline(guard_enabled=True, budget_governor=gov)

    def fn(args):
        return "ok"

    async with pl.guard(fn=fn, tool_name="t", args={}, run_id="r"):
        pass

    with pytest.raises(GuardedToolError) as exc:
        async with pl.guard(fn=fn, tool_name="t", args={}, run_id="r"):
            pass
    assert exc.value.error_type == ERROR_BUDGET_EXCEEDED
    assert exc.value.stage == STAGE_BUDGET


def test_run_sync_passthrough():
    """run_sync executes a plain (non-async) fn and returns a PipelineResult."""
    pl = GuardedToolPipeline()

    def fn(args):
        return args["n"] * 2

    res = pl.run_sync("mul", {"n": 4}, fn=fn, run_id="r")
    assert isinstance(res, PipelineResult)
    assert res.ok is True
    assert res.result == 8


# =============================================================================
# 9. Stage timings
# =============================================================================


async def test_stage_timings_present(tmp_path):
    """Normal full flow populates stage timings for every run stage (non-negative)."""
    rec = _rec(tmp_path)
    gov = _gov(max_concurrency=2)
    pl = GuardedToolPipeline(
        scan_enabled=True,
        guard_enabled=True,
        record_enabled=True,
        input_scanner=FakeScanner(dangerous=False),
        prompt_guard=safe_prompt_guard,
        budget_governor=gov,
        step_recorder=rec,
    )

    def fn(args):
        return "ok"

    res = await pl.run("t", {}, fn=fn, run_id="r")
    tm = res.stage_timings_ms
    for stage in ("input_scan", "budget", "fn", "record", "cost", "release"):
        assert stage in tm
        assert tm[stage] >= 0