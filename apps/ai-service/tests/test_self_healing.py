# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​​‌​​‌‍ ‌‌​​​​​​‌‌‌‌​‌‌‌​‌‌‌‍‌‌​​​‌​‌​​‌‌‌‌​‌‌‌​‌‍

"""Self-healing engine tests (L4-2, offline deterministic).

Covers app/services/self_healing.py:
- generate_test_cases: deterministic template + injectable gen_fn (incl.
  generator failure fallback and empty input).
- run_and_diagnose: StaticRunner execution + heuristic failure attribution
  categories.
- heal: one-shot green, fail->patch->green, exceeds-max-attempts still red
  with suggestions, patch-error and runner-error degradation, prebuilt cases,
  empty-cases trivially green, attempt-history structure.
- determinism and the SelfHealingEngine facade.

All tests are deterministic: they use injected fake gen_fn/runner/patch_fn, so
no model and no external process is required.
"""

from __future__ import annotations

import pytest

from app.services.self_healing import (
    AttemptRecord,
    HealOutcome,
    RunResult,
    SelfHealingEngine,
    StaticRunner,
    classify_failure,
    generate_test_cases,
    heal,
    run_and_diagnose,
)
from app.services.self_healing import (
    TestCase as SelfHealTestCase,
)

# =============================================================================
# Fakes / helpers
# =============================================================================


def make_case(cid: str, setup: str = "", assertion: str = "1 == 1",
              target: str = "t") -> dict:
    """Build a well-formed test-case dict."""
    return {"id": cid, "description": f"desc {cid}", "setup": setup,
            "assertion": assertion, "target": target}


PASS_OUTCOME = {"passed": ["c1"], "failures": [], "coverage_hint": "fake"}


def fail_outcome(category: str, exc_type: str = "RuntimeError",
                 test_id: str = "c1") -> dict:
    """Build a failing run outcome with a single categorized failure."""
    return {
        "passed": [],
        "failures": [
            {"test_id": test_id, "message": "boom",
             "exception_type": exc_type, "category": category}
        ],
    }


class FlakyRunner:
    """Runner that replays canned outcomes, one per call (last repeats).

    An ``Exception`` entry in ``outcomes`` is raised to simulate a broken
    runner.
    """

    def __init__(self, outcomes) -> None:
        self._outcomes = list(outcomes)
        self.calls = 0

    def run(self, cases):
        idx = min(self.calls, len(self._outcomes) - 1)
        self.calls += 1
        entry = self._outcomes[idx]
        if isinstance(entry, Exception):
            raise entry
        return dict(entry)


def ok_patch(task, result) -> dict:
    """Patch fn that simply reports a fix."""
    return {"fixed": True, "task": str(task)[:20], "failed": result["failed"]}


# =============================================================================
# Test-case generation
# =============================================================================


def test_generate_template_deterministic_and_well_formed() -> None:
    cases = generate_test_cases("do the thing")
    assert cases, "template should produce cases for a normal task"
    assert all(isinstance(c, SelfHealTestCase) for c in cases)
    for c in cases:
        assert c.id and c.description
        assert hasattr(c, "setup") and hasattr(c, "assertion") and c.target
    ids = [c.id for c in cases]
    assert len(ids) == len(set(ids)), "ids must be unique"
    again = generate_test_cases("do the thing")
    assert [c.to_dict() for c in again] == [c.to_dict() for c in cases]


def test_generate_uses_gen_fn_when_provided() -> None:
    custom = [make_case("g1", setup="", assertion="2 == 2")]
    cases = generate_test_cases("any", gen_fn=lambda task: custom)
    assert isinstance(cases[0], SelfHealTestCase)
    assert cases[0].id == "g1"
    assert cases[0].assertion == "2 == 2"


def test_generate_falls_back_to_template_when_gen_fn_raises() -> None:
    def boom(task):
        raise RuntimeError("gen exploded")

    cases = generate_test_cases("xyz", gen_fn=boom)
    assert cases
    assert all(isinstance(c, SelfHealTestCase) for c in cases)


def test_generate_empty_task_returns_empty() -> None:
    assert generate_test_cases("") == []
    assert generate_test_cases(None) == []
    assert generate_test_cases("   ") == []


# =============================================================================
# run + failure attribution
# =============================================================================


def test_static_runner_passes_trivial_case() -> None:
    result = run_and_diagnose(
        [make_case("a", setup="x = 4", assertion="x * 2 == 8")]
    )
    assert result.ok
    assert result.passed == 1
    assert result.failed == 0
    assert result.failures == []


def test_attribution_import_error() -> None:
    result = run_and_diagnose(
        [make_case("a", setup="import definitely_not_a_module_zzz", assertion="True")]
    )
    assert result.failed == 1
    assert result.failures[0].category == "import_error"


def test_attribution_type_error_static() -> None:
    result = run_and_diagnose(
        [make_case("a", setup="f = lambda v: v + 1", assertion="f(None)")]
    )
    assert result.failed == 1
    assert result.failures[0].category == "type_error"


def test_attribution_by_exception_type() -> None:
    result = run_and_diagnose(
        [make_case("a")], runner=FlakyRunner([fail_outcome("type_error", "TypeError")])
    )
    assert result.failed == 1
    assert result.failures[0].category == "type_error"


def test_attribution_import_by_type_name() -> None:
    out = {"passed": [], "failures": [
        {"test_id": "a", "message": "boom", "exception_type": "ModuleNotFoundError"}]}
    result = run_and_diagnose([make_case("a")], runner=FlakyRunner([out]))
    assert result.failures[0].category == "import_error"


def test_attribution_message_heuristic_when_type_unknown() -> None:
    # Unknown exception type but message says "No module named" -> import_error.
    out = {"passed": [], "failures": [{
        "test_id": "a", "message": "No module named 'pkg'",
        "exception_type": "WeirdError"}]}
    result = run_and_diagnose([make_case("a")], runner=FlakyRunner([out]))
    assert result.failures[0].category == "import_error"


def test_attribution_runtime_fallback() -> None:
    out = {"passed": [], "failures": [{
        "test_id": "a", "message": "something bizarre", "exception_type": "WeirdError"}]}
    result = run_and_diagnose([make_case("a")], runner=FlakyRunner([out]))
    assert result.failures[0].category == "runtime_error"


def test_attribution_timeout_by_message() -> None:
    out = {"passed": [], "failures": [{
        "test_id": "a", "message": "task timed out after 30s"}]}
    result = run_and_diagnose([make_case("a")], runner=FlakyRunner([out]))
    assert result.failures[0].category == "timeout"

    assert classify_failure(None, "something timed out") == "timeout"


def test_run_and_diagnose_accepts_a_run_result() -> None:
    rr = RunResult(passed=1, failed=0, failures=[], coverage_hint="fake")
    assert run_and_diagnose([make_case("a")], runner=FlakyRunner([rr])) is not None


# =============================================================================
# heal loop
# =============================================================================


def test_heal_once_green_no_patch() -> None:
    out = heal(
        "add feature",
        gen_fn=lambda task: [make_case("c1")],
        runner=FlakyRunner([PASS_OUTCOME]),
    )
    assert out.ok and out.final_passed
    assert out.attempts == 1
    assert len(out.run_history) == 1
    assert out.run_history[0].failed == 0
    assert out.run_history[0].patch_applied is None


def test_heal_fail_then_patch_to_green() -> None:
    out = heal(
        "add feature",
        gen_fn=lambda task: [make_case("c1")],
        runner=FlakyRunner([fail_outcome("runtime_error"), PASS_OUTCOME]),
        patch_fn=ok_patch,
        max_attempts=3,
    )
    assert out.ok and out.final_passed
    assert out.attempts == 2
    assert len(out.run_history) == 2
    assert out.run_history[0].patch_applied == {"fixed": True, "task": "add feature", "failed": 1}
    assert out.run_history[1].failed == 0


def test_heal_exhausts_attempts_still_red() -> None:
    out = heal(
        "x",
        gen_fn=lambda task: [make_case("c1")],
        runner=FlakyRunner([fail_outcome("type_error", "TypeError")]),
        patch_fn=ok_patch,
        max_attempts=3,
    )
    assert not out.ok and not out.final_passed
    assert out.attempts == 3
    assert len(out.run_history) == 3
    assert out.suggestions, "must provide suggestions when still red"
    assert any("type_error" in s for s in out.suggestions)


def test_heal_no_patch_fn_suggests_human() -> None:
    out = heal(
        "x",
        gen_fn=lambda task: [make_case("c1")],
        runner=FlakyRunner([fail_outcome("assertion_failure", "AssertionError")]),
        max_attempts=2,
    )
    assert not out.ok
    assert out.attempts == 2
    assert any("patch_fn" in s for s in out.suggestions)


def test_heal_patch_fn_raises_degrades() -> None:
    def bad_patch(task, result):
        raise ValueError("patch engine down")

    out = heal(
        "x",
        gen_fn=lambda task: [make_case("c1")],
        runner=FlakyRunner([fail_outcome("runtime_error")]),
        patch_fn=bad_patch,
        max_attempts=2,
    )
    assert not out.ok
    assert len(out.run_history) == 2
    for rec in out.run_history:
        assert "error" in rec.patch_applied


def test_run_and_diagnose_degrades_when_runner_raises() -> None:
    result = run_and_diagnose(
        [make_case("a")], runner=FlakyRunner([RuntimeError("runner died")])
    )
    assert result.failed == 1
    assert result.failures[0].category == "runner_error"


def test_heal_runner_raises_degrades() -> None:
    out = heal(
        "x",
        gen_fn=lambda task: [make_case("c1")],
        runner=FlakyRunner([RuntimeError("runner died")]),
        patch_fn=ok_patch,
        max_attempts=2,
    )
    assert not out.ok
    assert out.attempts == 2
    # run_and_diagnose turns runner errors into per-case runner_error failures.
    assert all(rec.failed >= 1 for rec in out.run_history)


def test_heal_prebuilt_test_cases_used() -> None:
    out = heal(
        "x",
        test_cases=[make_case("p1")],
        gen_fn=lambda task: pytest.fail("gen_fn must not be called"),
        runner=FlakyRunner([PASS_OUTCOME]),
    )
    assert out.ok
    assert out.attempts == 1


def test_heal_empty_cases_trivially_green() -> None:
    out = heal("ignored", test_cases=[], gen_fn=lambda task: [])
    assert out.ok and out.final_passed
    assert out.attempts == 0
    assert out.run_history == []


def test_heal_invalid_cases_coerced_away() -> None:
    out = heal(
        "x",
        test_cases=[None, "junk", {"id": "ok1", "assertion": "1==1"}],
        runner=FlakyRunner([{"passed": ["ok1"], "failures": [], "coverage_hint": "fake"}]),
    )
    assert out.ok
    assert out.attempts == 1


# =============================================================================
# Structure / determinism
# =============================================================================


def test_attempt_history_structured() -> None:
    out = heal(
        "x",
        gen_fn=lambda task: [make_case("c1")],
        runner=FlakyRunner([fail_outcome("runtime_error"), PASS_OUTCOME]),
        patch_fn=ok_patch,
        max_attempts=3,
    )
    assert len(out.run_history) == 2
    attempts = [r.attempt for r in out.run_history]
    assert attempts == [1, 2]
    for rec in out.run_history:
        assert isinstance(rec, AttemptRecord)
        assert isinstance(rec.passed, int) and isinstance(rec.failed, int)
        d = rec.to_dict()
        assert {"attempt", "passed", "failed", "patch_applied"} <= d.keys()


def test_heal_outcome_structure() -> None:
    out = heal("x", gen_fn=lambda task: [make_case("c1")],
               runner=FlakyRunner([PASS_OUTCOME]))
    assert isinstance(out, HealOutcome)
    d = out.to_dict()
    assert d["ok"] is True
    assert d["final_passed"] is True
    assert d["attempts"] == 1
    assert isinstance(d["suggestions"], list)


def test_run_and_diagnose_deterministic_wrapper() -> None:
    cases = [make_case("a", setup="x = 2", assertion="x == 2")]
    r1 = run_and_diagnose(cases)
    r2 = run_and_diagnose(cases)
    assert (r1.passed, r1.failed) == (r2.passed, r2.failed)


def test_static_runner_class_usable_directly() -> None:
    sr = StaticRunner()
    out = sr.run([SelfHealTestCase(id="t1", description="d", setup="y = 3", assertion="y > 0")])
    assert out["passed"] == ["t1"]
    assert out["failures"] == []


def test_facade_exposes_static_methods() -> None:
    assert callable(SelfHealingEngine.generate_test_cases)
    assert callable(SelfHealingEngine.run_and_diagnose)
    engine_out = SelfHealingEngine.heal(
        "x", gen_fn=lambda task: [make_case("c")], runner=FlakyRunner([PASS_OUTCOME])
    )
    assert engine_out.ok
    assert isinstance(engine_out, HealOutcome)


def test_case_to_dict_roundtrip() -> None:
    tc = SelfHealTestCase(id="i", description="d", setup="s", assertion="a", target="t")
    d = tc.to_dict()
    assert d == {"id": "i", "description": "d", "setup": "s", "assertion": "a", "target": "t"}
