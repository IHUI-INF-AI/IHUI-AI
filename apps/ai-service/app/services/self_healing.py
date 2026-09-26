# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Self-healing engine (offline deterministic service layer).

A lightweight agent self-healing loop that:
1. generates candidate test cases -- injectable ``gen_fn`` (LLM-backed) or an
   offline deterministic template when ``gen_fn is None``;
2. runs them and attributes each failure to a heuristic ``failure_category``
   (import error / assertion failure / type error / timeout / undefined
   symbol / ...);
3. iteratively applies patches produced by an injectable ``patch_fn`` (or a
   deterministic fixer) and re-runs the failed cases until all tests go green
   or ``max_attempts`` is exhausted.

Design constraints:
- Pure service layer: NOT wired into agent_loop_v2 and exposes NO router.
- Fully deterministic + offline by default (no model / no external process
  required); callers inject fake gen_fn/runner/patch_fn to control the flow
  in tests.
- Graceful degradation: runner / patch / generator exceptions never propagate;
  they are captured into the attempt history so the upper layer can decide to
  escalate to a human.
"""

from __future__ import annotations

import logging
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# Fallback category when no heuristic matches.
_FALLBACK_CATEGORY = "runtime_error"

# Exception-type-name -> failure category (heuristic attribution).
_CATEGORY_BY_TYPE = {
    "ImportError": "import_error",
    "ModuleNotFoundError": "import_error",
    "AssertionError": "assertion_failure",
    "TypeError": "type_error",
    "NameError": "undefined_symbol",
    "KeyError": "index_error",
    "IndexError": "index_error",
    "TimeoutError": "timeout",
    "SyntaxError": "syntax_error",
    "ValueError": "value_error",
    "ZeroDivisionError": "arithmetic_error",
}

# Message-substring heuristics applied when the exception type is unknown.
_CATEGORY_BY_MSG = (
    ("timed out", "timeout"),
    ("Timed out", "timeout"),
    ("No module named", "import_error"),
    ("invalid syntax", "syntax_error"),
    ("is not defined", "undefined_symbol"),
)


def classify_failure(exception_type: Any = None, message: str = "") -> str:
    """Attribute a failure to a heuristic category by exception name + message.

    Prefers the exception type name (last dotted segment), then falls back to
    message-substring heuristics, then to ``_FALLBACK_CATEGORY``.
    """
    base = str(exception_type or "").rsplit(".", 1)[-1]
    if base in _CATEGORY_BY_TYPE:
        return _CATEGORY_BY_TYPE[base]
    msg = message or ""
    for needle, cat in _CATEGORY_BY_MSG:
        if needle in msg:
            return cat
    return _FALLBACK_CATEGORY


# ---------------------------------------------------------------------------
# V3 #56 工具自愈信号源扩展(2026-09-26 立):run_command 信号分类器。
#
# 为什么在 self_healing.py:分类器是纯离线、确定性的"信号 → 结构化"转换,
# 与本文件既有 classify_failure/heal 同层(纯服务层,不碰 agent_loop_v2 主链路),
# 便于脱离 agent loop 单测。
#
# 为什么默认仍不翻 AGENT_SELF_HEALING_ENABLED(运维放量待办,勿顺手删):
# 1) 默认 off 被 tests/test_agent_self_heal.py::test_maybe_self_heal_disabled_by_default
#    显式钉住(delenv 后断言零差异),翻默认值必破钉子测试;
# 2) 开关与 routers/self_healing.py 同源(app/core/config.py:345 已纳入 .env
#    同步白名单),擅自翻默认会把 HTTP 侧自愈端点一并放量,影响面超出本票;
# 3) 自愈暂无 compaction_canary 式灰度体系,没有按会话/租户渐进放量的基建。
# 放量路径:先补灰度(参照 services/compaction_canary.py),再按会话比例放量,
# 最后才考虑翻默认值。
# ---------------------------------------------------------------------------

# 环境性失败特征(不可自愈):命中即 actionable=False。
# 为什么:网络超时/DNS 失败/权限拒绝不是代码缺陷,LLM 补丁修不了,
# 触发 heal 只会烧 token 并把用户代码改坏。
_ENVIRONMENTAL_MARKERS = (
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ECONNRESET",
    "npm ERR! network",
    "network error",
)

# 四类可自愈信号的命令判据(按先专后泛顺序判定,前三类命中即短路)。
# test_framework:pytest(含 python -m pytest)/vitest/jest/cargo test/go test/
#   npm|pnpm|yarn (run) test;
# type_check:mypy/pyright/pyre/tsc(tsc.js 兼容,词边界防误吃 typescript);
# lint:ruff/eslint;
# build:npm|pnpm|yarn (run) build / next build / vite build / webpack /
#   go build / cargo build。
# 注意 tsc 优先于 build:"tsc -p ." 常作为构建步,但 TS 错误行(error TSxxxx)
# 是更精确的自愈信号,归 type_check。
_SIGNAL_COMMAND_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "test_framework",
        re.compile(
            r"(?:^|[\s;(&(])(?:python\s+-m\s+)?pytest\b"
            r"|\b(?:vitest|jest)\b"
            r"|\bcargo\s+test\b"
            r"|\bgo\s+test\b"
            r"|\b(?:npm|pnpm|yarn)\s+(?:run\s+)?test\b"
        ),
    ),
    (
        "type_check",
        re.compile(
            r"\b(?:mypy|pyright|pyre)\b"
            r"|\btsc\.js\b|\btsc\b"
            r"|\bnpx\s+tsc\b"
        ),
    ),
    ("lint", re.compile(r"\bruff\b|\beslint\b")),
    (
        "build",
        re.compile(
            r"\b(?:npm|pnpm|yarn)\s+(?:run\s+)?build\b"
            r"|\bnext\s+build\b"
            r"|\bvite\s+build\b"
            r"|\bwebpack\b"
            r"|\bgo\s+build\b"
            r"|\bcargo\s+build\b"
        ),
    ),
)

# error_digest 按类别的错误行提取判据(自愈质量关键:digest 直接喂 LLM 补丁)。
_DIGEST_LINE_PATTERNS: dict[str, re.Pattern[str]] = {
    "type_check": re.compile(r"error TS\d+|\berror:", re.IGNORECASE),
    "lint": re.compile(
        r"Found \d+ errors?|✖[^\n]*problem|fixable|\b[EWF]\d{2,3}\b|error\b",
        re.IGNORECASE,
    ),
    "build": re.compile(
        r"error\b|Module not found|Build failed|ELIFECYCLE", re.IGNORECASE
    ),
    "test_framework": re.compile(
        r"^FAILED\b|^ERROR\b|AssertionError|\berror\b", re.IGNORECASE
    ),
}

_DIGEST_MAX_LINES = 8  # digest 行数上限:喂 LLM 的摘要,过长稀释注意力
_DIGEST_LINE_MAX_CHARS = 200  # 单行截断:超长堆栈行只保留头部


@dataclass
class SelfHealSignal:
    """分类后的 run_command 自愈信号。

    - category:四类之一(test_framework/type_check/build/lint);
    - actionable:是否可自愈(环境性失败如网络超时为 False,调用方不得触发 heal);
    - error_digest:错误行摘要(直接注入 LLM 补丁上下文)。
    """

    category: str
    actionable: bool
    error_digest: str
    command: str = ""
    exit_code: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "category": self.category,
            "actionable": self.actionable,
            "error_digest": self.error_digest,
            "command": self.command,
            "exit_code": self.exit_code,
        }


def extract_error_digest(output: str, category: str) -> str:
    """从命令输出提取按类别的错误行摘要(deterministic,离线)。

    无命中时兜底取输出尾部 3 行(非空时):构建工具的错误行格式千差万别,
    尾部通常是错误汇总,比丢弃整个摘要更有用。
    """
    lines = (output or "").splitlines()
    pattern = _DIGEST_LINE_PATTERNS.get(category)
    picked: list[str] = []
    if pattern is not None:
        for line in lines:
            s = line.strip()
            if s and pattern.search(s):
                picked.append(s[:_DIGEST_LINE_MAX_CHARS])
                if len(picked) >= _DIGEST_MAX_LINES:
                    return "\n".join(picked)
    if not picked:
        tail = [ln.strip()[:_DIGEST_LINE_MAX_CHARS] for ln in lines if ln.strip()]
        picked = tail[-3:]
    return "\n".join(picked[:_DIGEST_MAX_LINES])


def classify_run_command_signal(
    command: str, result: dict[str, Any]
) -> SelfHealSignal | None:
    """把 run_command 的(命令行, 结果)分类为 SelfHealSignal,不匹配返回 None。

    判定顺序:退出码 → 类别命令匹配 → 环境性失败降级(actionable=False)。
    exit_code==0(绿)或无退出码证据 → None(无信号,与现状零差异)。
    exit_code 双键名兼容:mcp_server._tool_run_command 实际返回蛇形
    exit_code,但历史契约存在驼峰 exitCode(见 derive_step_evidence 同类处理)。
    """
    if not isinstance(result, dict):
        return None
    exit_code = result.get("exit_code", result.get("exitCode"))
    if not isinstance(exit_code, int) or isinstance(exit_code, bool):
        return None
    if exit_code == 0:
        return None
    command = str(command or "")
    category = None
    for cat, pattern in _SIGNAL_COMMAND_PATTERNS:
        if pattern.search(command):
            category = cat
            break
    if category is None:
        # 不在四类信号命令表内的命令不进自愈:保守优先,
        # 避免 LLM 对任意失败命令(如 git/网络工具)乱补丁。
        return None
    output = "\n".join(
        str(result.get(k) or "")
        for k in ("stdout", "stderr", "partial_output")
    )
    # 环境性失败:mcp_server 用 exit_code=-1 + errorCode=TIMEOUT/partial_output
    # 表达超时/异常路径;网络类特征词兜底识别。这些修不了,actionable=False。
    environmental = (
        exit_code < 0
        or result.get("errorCode") == "TIMEOUT"
        or any(marker in output for marker in _ENVIRONMENTAL_MARKERS)
    )
    return SelfHealSignal(
        category=category,
        actionable=not environmental,
        error_digest=extract_error_digest(output, category),
        command=command,
        exit_code=exit_code,
    )


@dataclass
class TestCase:
    """A single candidate test case."""

    id: str
    description: str
    setup: str = ""
    assertion: str = ""
    target: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "description": self.description,
            "setup": self.setup,
            "assertion": self.assertion,
            "target": self.target,
        }


@dataclass
class Failure:
    """A single test failure with its heuristic attribution."""

    test_id: str
    message: str
    exception_type: str | None = None
    category: str = _FALLBACK_CATEGORY

    def to_dict(self) -> dict[str, Any]:
        return {
            "test_id": self.test_id,
            "message": self.message,
            "exception_type": self.exception_type,
            "category": self.category,
        }


@dataclass
class RunResult:
    """Structured outcome of running a batch of test cases."""

    passed: int
    failed: int
    failures: list[Failure] = field(default_factory=list)
    coverage_hint: str | None = None

    @property
    def ok(self) -> bool:
        return self.failed == 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "passed": self.passed,
            "failed": self.failed,
            "failures": [f.to_dict() for f in self.failures],
            "coverage_hint": self.coverage_hint,
        }


@dataclass
class AttemptRecord:
    """One healing attempt in the run history."""

    attempt: int
    passed: int
    failed: int
    patch_applied: Any = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "attempt": self.attempt,
            "passed": self.passed,
            "failed": self.failed,
            "patch_applied": self.patch_applied,
        }


@dataclass
class HealOutcome:
    """Final result of a self-healing loop."""

    ok: bool
    final_passed: bool
    attempts: int = 0
    run_history: list[AttemptRecord] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "final_passed": self.final_passed,
            "attempts": self.attempts,
            "run_history": [r.to_dict() for r in self.run_history],
            "suggestions": self.suggestions,
        }


class StaticRunner:
    """Deterministic offline runner: compiles setup/assertion and attributes.

    Contract compatible with any injected runner: ``run(cases)`` returns a
    mapping with ``{"passed": [...ids], "failures": [{test_id, message,
    exception_type}]}``.
    """

    def run(self, test_cases: list[TestCase]) -> dict[str, Any]:
        passed: list[str] = []
        failures: list[dict[str, Any]] = []
        for tc in test_cases:
            ns: dict[str, Any] = {"__name__": "selfhealing"}
            try:
                if tc.setup:
                    exec(compile(tc.setup, f"<setup:{tc.id}>", "exec"), ns)
            except Exception as exc:  # noqa: BLE001 - degrade setup errors
                failures.append(
                    {
                        "test_id": tc.id,
                        "message": f"setup error: {exc}",
                        "exception_type": type(exc).__name__,
                    }
                )
                continue
            try:
                ok = bool(eval(compile(tc.assertion, f"<assert:{tc.id}>", "eval"), ns))
            except Exception as exc:  # noqa: BLE001 - degrade assertion errors
                failures.append(
                    {
                        "test_id": tc.id,
                        "message": f"assertion error: {exc}",
                        "exception_type": type(exc).__name__,
                    }
                )
                continue
            if ok:
                passed.append(tc.id)
            else:
                failures.append(
                    {
                        "test_id": tc.id,
                        "message": "assertion returned a falsy value",
                        "exception_type": "AssertionError",
                    }
                )
        return {"passed": passed, "failures": failures, "coverage_hint": "static"}


# ---------------------------------------------------------------------------
# Coercion / normalization helpers
# ---------------------------------------------------------------------------


def _coerce_test_case(item: Any) -> TestCase | None:
    """Turn a raw entry (dict or TestCase) into a TestCase; drop invalid ones."""
    if isinstance(item, TestCase):
        return item
    if isinstance(item, dict):
        test_id = str(item.get("id") or "")
        description = str(item.get("description") or "")
        assertion = str(item.get("assertion") or "")
        if not test_id and not description and not assertion:
            return None  # not enough signal -> treat as invalid
        return TestCase(
            id=test_id,
            description=description,
            setup=str(item.get("setup") or ""),
            assertion=assertion,
            target=str(item.get("target") or ""),
        )
    return None


def _coerce_cases(test_cases: Any) -> list[TestCase]:
    """Normalize arbitrary test_cases input into a list of TestCase objects.

    Empty/non-list/scalar inputs produce an empty list (graceful, no crash).
    """
    if test_cases is None or isinstance(test_cases, (str, bytes, int, float, bool)):
        return []
    if isinstance(test_cases, (TestCase, dict)):
        test_cases = [test_cases]
    out: list[TestCase] = []
    for item in test_cases:
        tc = _coerce_test_case(item)
        if tc is not None:
            out.append(tc)
    return out


def _coerce_failure(item: Any, index: int) -> Failure:
    """Normalize a failure entry and attribute a category when missing."""
    if isinstance(item, Failure):
        return item
    if isinstance(item, dict):
        test_id = str(item.get("test_id") or f"unknown_{index}")
        message = str(item.get("message") or item.get("error") or "")
        exc_type = item.get("exception_type")
        category = str(item.get("category") or "") or classify_failure(
            exc_type, message
        )
        return Failure(
            test_id=test_id,
            message=message,
            exception_type=str(exc_type) if exc_type else None,
            category=category,
        )
    return Failure(test_id=f"unknown_{index}", message=str(item), category=_FALLBACK_CATEGORY)


def _normalize_run_result(raw: Any) -> RunResult:
    """Normalize a runner's output mapping into a RunResult."""
    if isinstance(raw, RunResult):
        return raw
    if not isinstance(raw, dict):
        raise TypeError("runner must return a dict or RunResult")
    failures_raw = raw.get("failures", []) or []
    failures = [
        _coerce_failure(f_item, idx) for idx, f_item in enumerate(failures_raw)
    ]
    passed_val = raw.get("passed", 0)
    passed_cnt = (
        len(passed_val)
        if isinstance(passed_val, (list, tuple))
        else int(passed_val or 0)
    )
    hint = raw.get("coverage_hint")
    if hint is not None:
        hint = str(hint)
    return RunResult(
        passed=passed_cnt, failed=len(failures), failures=failures, coverage_hint=hint
    )


def _degraded_result(cases: list[TestCase], category: str, exc: BaseException) -> RunResult:
    """Build a RunResult where the runner itself failed (graceful degradation)."""
    failures = [
        Failure(
            test_id=tc.id,
            message=f"runner_error: {exc}",
            exception_type=type(exc).__name__,
            category=category,
        )
        for tc in cases
    ]
    return RunResult(passed=0, failed=len(failures), failures=failures)


# ---------------------------------------------------------------------------
# 1. Test-case generation
# ---------------------------------------------------------------------------


def _template_cases(task: str) -> list[TestCase]:
    """Deterministic, model-free scaffold template (offline-testable).

    Produces a small set of well-formed test cases derived from ``task``. They
    are intentionally primitive scaffolds -- production callers should pass a
    real ``gen_fn``; the template guarantees offline determinism.
    """
    slug = re.sub(r"[^A-Za-z0-9]+", "_", task).strip("_").lower()[:32] or "task"
    return [
        TestCase(
            id=f"{slug}_smoke",
            description=f"{task}: basic smoke check",
            setup="probe = 'smoke'",
            assertion="probe == 'smoke'",
            target=task,
        ),
        TestCase(
            id=f"{slug}_setup_noerror",
            description=f"{task}: setup executes without error",
            setup="import builtins",
            assertion="builtins is not None",
            target=task,
        ),
        TestCase(
            id=f"{slug}_contract",
            description=f"{task}: result contract sanity",
            setup="value = 1",
            assertion="value is not None",
            target=task,
        ),
    ]


def generate_test_cases(task: Any, *, gen_fn: Any = None) -> list[TestCase]:
    """Generate candidate test cases for ``task``.

    Args:
        task: Anything describing the code under test.
        gen_fn: Optional generator callable ``gen_fn(task) -> list of test-case
            dicts/TestCase``. When it raises or is None, falls back to the
            deterministic template (graceful, offline).
    """
    if gen_fn is not None:
        try:
            return _coerce_cases(gen_fn(task))
        except Exception as exc:  # noqa: BLE001 - generator failure degrades
            logger.warning(
                "[self_healing] gen_fn failed, falling back to template: %s: %s",
                type(exc).__name__,
                exc,
            )
    if task is None:
        task = ""
    task_str = str(task).strip()
    if not task_str:
        return []
    return _template_cases(task_str)


# ---------------------------------------------------------------------------
# 2. Run + failure attribution
# ---------------------------------------------------------------------------


def run_and_diagnose(test_cases: Any, *, runner: Any = None) -> RunResult:
    """Run ``test_cases`` and produce a RunResult with categorized failures.

    Args:
        test_cases: Batch of TestCase/dict.
        runner: Optional callable ``runner(test_cases) -> {"passed": [...ids],
            "failures": [{test_id, message, exception_type}]}``. Defaults to
            ``StaticRunner`` (deterministic/offline). If the runner raises, the
            result is degraded (all cases marked ``runner_error``), never
            propagated.
    """
    cases = _coerce_cases(test_cases)
    active = runner if runner is not None else StaticRunner()
    try:
        raw = active.run(cases)
    except Exception as exc:  # noqa: BLE001 - runner failure degrades
        logger.warning(
            "[self_healing] runner failed (degraded result): %s: %s",
            type(exc).__name__,
            exc,
        )
        return _degraded_result(cases, "runner_error", exc)
    try:
        return _normalize_run_result(raw)
    except Exception as exc:  # noqa: BLE001 - malformed runner output degrades
        logger.warning(
            "[self_healing] runner returned malformed output (degraded): %s: %s",
            type(exc).__name__,
            exc,
        )
        return _degraded_result(cases, "runner_error", exc)


# ---------------------------------------------------------------------------
# Suggestions (when healing fails to converge)
# ---------------------------------------------------------------------------


def _build_suggestions(result: RunResult | None, patch_fn_absent: bool) -> list[str]:
    """Produce human-actionable suggestions for a still-failing result."""
    if result is None or result.failed == 0:
        return []
    counts: Counter[str] = Counter(f.category for f in result.failures)
    suggestions = [
        f"still_failing={result.failed} categories={dict(counts)}",
    ]
    if patch_fn_absent:
        suggestions.append(
            "no patch_fn provided; supply a patcher to auto-fix or hand off manually"
        )
    example = result.failures[0]
    suggestions.append(
        f"example_failure: {example.test_id} [{example.category}] {example.message[:120]}"
    )
    return suggestions


# ---------------------------------------------------------------------------
# 3. Self-healing loop
# ---------------------------------------------------------------------------


def heal(
    task: Any,
    test_cases: Any = None,
    *,
    gen_fn: Any = None,
    runner: Any = None,
    max_attempts: int = 3,
    patch_fn: Any = None,
) -> HealOutcome:
    """Run the self-healing loop: generate -> run -> patch -> re-run.

    Args:
        task: What to heal.
        test_cases: Optional pre-built cases; defaults to generated ones.
        gen_fn: Generator (see generate_test_cases).
        runner: Test runner (see run_and_diagnose).
        max_attempts: Upper bound on healing attempts.
        patch_fn: Optional callable ``patch_fn(task, result_dict)`` returning a
            patch descriptor (or None). If it raises, the attempt records the
            error and the loop continues (graceful).

    Returns a HealOutcome; ``ok`` is False with packaged ``suggestions`` when
    the loop exhausts ``max_attempts`` while tests are still failing.
    """
    if max_attempts < 1:
        max_attempts = 1
    cases = (
        test_cases if test_cases is not None else generate_test_cases(task, gen_fn=gen_fn)
    )
    cases = _coerce_cases(cases)
    if not cases:
        # Nothing to run -> trivially green, no attempts needed.
        return HealOutcome(ok=True, final_passed=True, attempts=0, run_history=[], suggestions=[])

    patch_fn_absent = patch_fn is None
    run_history: list[AttemptRecord] = []
    attempts = 0
    last: RunResult | None = None

    while attempts < max_attempts:
        attempts += 1
        result = run_and_diagnose(cases, runner=runner)
        patch_applied: Any = None
        if result.failed > 0 and patch_fn is not None:
            try:
                patch_applied = patch_fn(task, result.to_dict())
            except Exception as exc:  # noqa: BLE001 - patch failure degrades
                logger.warning(
                    "[self_healing] patch_fn failed (degraded): %s: %s",
                    type(exc).__name__,
                    exc,
                )
                patch_applied = {"error": f"{type(exc).__name__}: {exc}"}
        run_history.append(
            AttemptRecord(
                attempt=attempts,
                passed=result.passed,
                failed=result.failed,
                patch_applied=patch_applied,
            )
        )
        last = result
        if result.failed == 0:
            break

    ok = bool(last is not None and last.failed == 0)
    suggestions: list[str] = []
    if not ok:
        suggestions = _build_suggestions(last, patch_fn_absent)
    return HealOutcome(
        ok=ok,
        final_passed=ok,
        attempts=attempts,
        run_history=run_history,
        suggestions=suggestions,
    )


# ---------------------------------------------------------------------------
# Facade + singleton
# ---------------------------------------------------------------------------


class SelfHealingEngine:
    """Namespace facade mirroring the module-level helpers as static methods."""

    generate_test_cases = staticmethod(generate_test_cases)
    run_and_diagnose = staticmethod(run_and_diagnose)
    heal = staticmethod(heal)


# Singleton for parity with sibling services (e.g. self_evaluator).
self_healing_engine = SelfHealingEngine()
