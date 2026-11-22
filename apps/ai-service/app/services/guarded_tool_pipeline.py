# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# (C) 2026 IHUI AI / 李春川 (Li Chunchuan) - https://aizhs.top
# Guarded tool pipeline: unified composition guard for a single tool call.

"""
Guarded tool pipeline (unified composition guard).

Composes the scattered guard services into one deterministic entry point for a
single tool call, so a future executor can adopt it in one line instead of
assembling pieces everywhere:

    scan(input threat) -> budget.acquire(run_id) -> call fn
    -> record(success/failure) -> cost.account -> release

Reuses existing services, does not reimplement them:
- prompt injection   <- prompt_guard.act(text, source, policy)
- dangerous args     <- tool_input_scanner.scan_tool_args(args, tool_name, flags)
- budget gating      <- tool_budget_governor.acquire/release/record_usage
- step recording     <- agent_step_recorder.append_step
- cost ledger        <- tool_cost_accounting.aggregate_run (read-only, for check())

All switches default to OFF (scan_enabled/guard_enabled/record_enabled False) ->
run() passes through `fn` untouched, zero behavior change. Only enabling a
switch gates the corresponding stage.

Degradation policy (safety-first, one stage must not crash the whole chain):
- every stage has its own try/except
- rejecting guards (injection/scan/budget) return a deterministic error code and
  do NOT execute fn
- safety stages (injection/scan) fail-closed on internal error (treat as blocked)
- budget/record/cost/release errors are logged into errors, never change fn result

Forms:
- run(...)              async, full flow (handles async and sync fn)
- run_sync(...)         sync, for non-async callers
- guard(fn, ...)        async context manager wrapping the full flow; raises
                        GuardedToolError when a rejecting guard blocks
- check(run_id)         read-only snapshot (budget used/remaining + cost ledger +
                        recorder metrics); no persistence, no routing
"""

from __future__ import annotations

import inspect
import json
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from app.core.guardian_risk import GuardianRiskLevel

from .agent_step_recorder import agent_step_recorder as _default_recorder
from .injection_event_recorder import record_injection_event as _default_injection_recorder
from .prompt_guard import act as _default_prompt_guard
from .tool_budget_governor import (
    BUDGET_EXCEEDED,
)
from .tool_budget_governor import (
    tool_budget_governor as _default_budget_gov,
)
from .tool_cost_accounting import aggregate_run as _default_cost_accounting
from .tool_input_scanner import scan_tool_args as _default_input_scanner

logger = logging.getLogger(__name__)

# ---------------- Deterministic error codes (do not change strings) ----------------

ERROR_INJECTION_BLOCKED = "injection_blocked"
ERROR_SCAN_BLOCKED = "scan_blocked"
ERROR_BUDGET_EXCEEDED = BUDGET_EXCEEDED  # reuses budget_governor's "budget_exceeded"
ERROR_TOOL_ERROR = "tool_error"
ERROR_RECORD_FAILED = "record_failed"
ERROR_COST_FAILED = "cost_failed"
ERROR_RELEASE_FAILED = "release_failed"
# 逆向判据聚合(round8/9 那族判据的**生产接线**):阻断码刻意独立,不与 scan/injection 并桶,
# 便于调用方分辨「是静态准入判据拦的,还是注入扫描拦的」。
ERROR_GATE_BLOCKED = "gate_suite_blocked"

# Stage names (used in errors[].stage and stage_timings_ms)
STAGE_PROMPT = "prompt_guard"
STAGE_INPUT = "input_scan"
STAGE_GATE = "gate_suite"
STAGE_BUDGET = "budget"
STAGE_FN = "fn"
STAGE_RECORD = "record"
STAGE_COST = "cost"
STAGE_RELEASE = "release"

_DEFAULT_SCAN: dict[str, Any] = {"risk": None, "action": "skip", "hits": []}
_DEFAULT_BUDGET = {"allowed": True, "used": {}, "limits": {}, "reason": "guard_disabled"}

# 判据聚合唯一入口的惰性单例:import 只发生一次,且**只在 gate_request 真的到场时**
# 才解析 —— 未启用判据的运行连 import 都不付(缺省零开销,§0.9 装车不拖慢主链路)。
_GATE_SUITE_FN: Callable[..., dict[str, Any]] | None = None


def _resolve_gate_suite() -> Callable[..., dict[str, Any]]:
    global _GATE_SUITE_FN
    if _GATE_SUITE_FN is None:
        from .reverse_engineered_gates import evaluate_gate_suite as _fn

        _GATE_SUITE_FN = _fn
    return _GATE_SUITE_FN


# 工具入参里的判据控制键(唯一契约名,别处不得自造第二个)。
GATE_KEY = "__gate_suite__"
# 控制键**不存在**的哨兵:与「键存在但值为 None」区分开 —— 后者必须 fail-closed 判
# unjudged,绝不能退化成「没启用」而静默放行(§0.10)。
GATE_KEY_ABSENT = object()


def extract_gate_request(args: Any) -> tuple[Any, Any]:
    """从工具入参里剥离判据控制键 ``__gate_suite__``(纯函数,可单测)。

    返回 ``(clean_args, gate_spec)``:
      * args 非映射 / 无该键 ⇒ ``(原样, GATE_KEY_ABSENT)``:调用方据此**不启用**
        判据(缺省零行为,既有工具调用逐字不变);
      * 有该键 ⇒ clean_args 去掉该键(控制键绝不进真实工具入参),gate_spec 为原值
        (可能是任意类型 —— 形状由调用方按 fail-closed 归一,本函数不猜、不修)。
    """
    if not isinstance(args, dict) or GATE_KEY not in args:
        return args, GATE_KEY_ABSENT
    clean = {k: v for k, v in args.items() if k != GATE_KEY}
    return clean, args[GATE_KEY]


def _ms(t0: float) -> float:
    """perf_counter delta in milliseconds."""
    return round((time.perf_counter() - t0) * 1000.0, 3)


# ---------------- Result structures and exception ----------------


@dataclass
class PipelineError:
    """Single-stage error. error_type uses stable strings for structured matching."""

    stage: str
    error_type: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return {"stage": self.stage, "error_type": self.error_type, "message": self.message}


@dataclass
class PipelineResult:
    """Structured result of a single run()."""

    ok: bool
    result: Any = None
    errors: list[PipelineError] = field(default_factory=list)
    budget: dict[str, Any] = field(default_factory=dict)
    scan: dict[str, Any] = field(default_factory=dict)
    # 判据聚合的逐项可审计结果(verdict/allowed/reason/checks);opt-in 未启用的运行
    # 恒为 {} —— 与 scan 同形,缺省态不伪造「判过」。
    gate: dict[str, Any] = field(default_factory=dict)
    recorded_step_id: int | None = None
    stage_timings_ms: dict[str, float] = field(default_factory=dict)

    @property
    def error_types(self) -> list[str]:
        return [e.error_type for e in self.errors]

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "errors": [e.to_dict() for e in self.errors],
            "budget": self.budget,
            "scan": self.scan,
            "gate": self.gate,
            "recorded_step_id": self.recorded_step_id,
            "stage_timings_ms": self.stage_timings_ms,
        }


class GuardedToolError(Exception):
    """Raised by guard() when a rejecting guard blocks the flow."""

    def __init__(self, error_type: str, stage: str, message: str = "") -> None:
        super().__init__(message or f"[{stage}] {error_type}")
        self.error_type = error_type
        self.stage = stage
        self.message = message


@dataclass
class _PreGate:
    """Intermediate result of the pre-guards (prompt/scan/budget)."""

    ok: bool
    errors: list[PipelineError] = field(default_factory=list)
    budget: dict[str, Any] = field(default_factory=dict)
    scan: dict[str, Any] = field(default_factory=dict)
    timings: dict[str, float] = field(default_factory=dict)
    budget_acquired: bool = False
    # 必须排在既有字段之后:早期 stage 的调用点用的是**位置参数**
    # (_PreGate(False, errors, budget, scan, timings, False));把 gate 插在 timings
    # 之前会让 timings 落进 gate、False 落进 timings(mypy 抓到的真实错位)。
    gate: dict[str, Any] = field(default_factory=dict)


# ---------------- Unified composition guard ----------------


class GuardedToolPipeline:
    """Unified composition guard (single-instanceable, injected services).

    Usage (run, async)::

        pl = GuardedToolPipeline(scan_enabled=True, guard_enabled=True,
                                 record_enabled=True, budget_governor=gov,
                                 step_recorder=rec)
        pr = await pl.run("read_file", {"path": "/etc/passwd"}, fn=executor, run_id="run-1")
        if not pr.ok:  # pr.errors[0].error_type in (...blocked, budget_exceeded)
            ...  # fn was not executed

    Usage (guard, async context)::

        async with pl.guard(fn=read_tool, tool_name="read_file", args=..., run_id="r") as g:
            ...  # pre-guards already passed; a block raises GuardedToolError
        result = g.result
    """

    def __init__(
        self,
        *,
        prompt_guard: Callable[..., dict[str, Any]] | None = None,
        input_scanner: Callable[..., Any] | None = None,
        budget_governor: Any | None = None,
        step_recorder: Any | None = None,
        cost_accounting: Callable[..., dict[str, Any]] | None = None,
        injection_recorder: Callable[..., dict[str, Any]] | None = None,
        scan_enabled: bool = False,
        guard_enabled: bool = False,
        record_enabled: bool = False,
        gate_suite: Callable[..., dict[str, Any]] | None = None,
    ) -> None:
        # Injectable dependencies (fall back to each service's default singleton/function)
        self.prompt_guard: Callable[..., dict[str, Any]] = (
            prompt_guard if prompt_guard is not None else _default_prompt_guard
        )
        self.input_scanner: Callable[..., Any] = (
            input_scanner if input_scanner is not None else _default_input_scanner
        )
        self.budget_governor: Any = (
            budget_governor if budget_governor is not None else _default_budget_gov
        )
        self.step_recorder: Any = step_recorder if step_recorder is not None else _default_recorder
        self.cost_accounting: Callable[..., dict[str, Any]] = (
            cost_accounting if cost_accounting is not None else _default_cost_accounting
        )
        # 注入拦截事件记录器(全活动时间线回放 P1-4):默认接入进程内记录器,
        # 也可注入自定义实现;stage 2 危险工具入参被拦截时调用。
        self.injection_recorder: Callable[..., dict[str, Any]] = (
            injection_recorder if injection_recorder is not None else _default_injection_recorder
        )
        # Per-stage toggles, all default OFF -> run() passes through verbatim
        self.scan_enabled = bool(scan_enabled)
        self.guard_enabled = bool(guard_enabled)
        self.record_enabled = bool(record_enabled)
        # 判据聚合入口:显式注入优先,None 则首次用到时惰性解析(见 _resolve_gate_suite)。
        self.gate_suite = gate_suite

    # ---------------- Pre-guards: prompt -> input scan -> budget ----------------

    def _pre_guards(
        self,
        tool_name: str,
        args: dict[str, Any],
        run_id: str,
        budget_gov: Any,
        *,
        cost_estimate: float,
        scan_source: str,
        scan_policy: str,
        block_on_scan: bool,
        prompt_source: str,
        prompt_policy: str,
        scan_flags: list[str] | None,
        session_id: str | None = None,
        injection_recorder: Any = None,
        gate_request: Any = None,
        gate_policy: Any = None,
    ) -> _PreGate:
        errors: list[PipelineError] = []
        timings: dict[str, float] = {}
        scan: dict[str, Any] = dict(_DEFAULT_SCAN)
        budget: dict[str, Any] = dict(_DEFAULT_BUDGET)
        gate_result: dict[str, Any] = {}

        # ---- stage 1: prompt injection probe (scan_enabled) ----
        if self.scan_enabled and self.prompt_guard is not None:
            t0 = time.perf_counter()
            try:
                text = json.dumps(args, ensure_ascii=False, default=str)
                # 仅在提供 session_id 时透传(自定义/既有 prompt_guard 可能不接受
                # session_id 参数;缺省 None 时零行为变化,兼容旧签名)。
                guard_kwargs: dict[str, Any] = {
                    "source": prompt_source,
                    "policy": prompt_policy,
                }
                if session_id is not None:
                    guard_kwargs["session_id"] = session_id
                r = self.prompt_guard(text, **guard_kwargs)
                if r.get("blocked"):
                    errors.append(
                        PipelineError(
                            STAGE_PROMPT,
                            ERROR_INJECTION_BLOCKED,
                            r.get("output") or "prompt injection blocked",
                        )
                    )
                    timings[STAGE_PROMPT] = _ms(t0)
                    return _PreGate(False, errors, budget, scan, timings, False)
            except Exception as e:  # fail-closed: treat injection probe error as blocked
                errors.append(
                    PipelineError(
                        STAGE_PROMPT,
                        ERROR_INJECTION_BLOCKED,
                        f"injection probe error, blocked: {e}",
                    )
                )
                timings[STAGE_PROMPT] = _ms(t0)
                return _PreGate(False, errors, budget, scan, timings, False)
            timings[STAGE_PROMPT] = _ms(t0)

        # ---- stage 2: dangerous tool-arg scan (scan_enabled) ----
        if self.scan_enabled and self.input_scanner is not None:
            t0 = time.perf_counter()
            try:
                res = self.input_scanner(args, tool_name=tool_name, flags=scan_flags)
                dangerous = bool(getattr(res, "dangerous", False))
                hits = [f.kind for f in getattr(res, "findings", []) if getattr(f, "kind", None)]
                scan = {
                    "risk": "high" if dangerous else "low",
                    "action": "block" if (dangerous and block_on_scan) else "pass",
                    "hits": hits,
                }
                if dangerous and block_on_scan:
                    errors.append(
                        PipelineError(
                            STAGE_INPUT, ERROR_SCAN_BLOCKED, "dangerous tool args blocked"
                        )
                    )
                    # 全活动时间线回放(P1-4):危险工具入参被拦截 → 登记注入拦截事件
                    if session_id is not None and injection_recorder is not None:
                        try:
                            injection_recorder(
                                session_id,
                                source="tool_args",
                                # 归一化到唯一枚举:拦截事件恒为 high
                                # (Codex 语义:危险入参命中 = 阻断级,触发 Guardian 复核)。
                                risk_level=GuardianRiskLevel.HIGH.value,
                                hit_types=hits,
                                action="block",
                                blocked=True,
                                snippet=str(args)[:120],
                            )
                        except Exception as rec_err:  # 记录失败绝不阻断主链路
                            logger.warning("工具入参拦截事件登记失败(忽略): %s", rec_err)
                    timings[STAGE_INPUT] = _ms(t0)
                    return _PreGate(False, errors, budget, scan, timings, False)
            except Exception as e:  # fail-closed: scan error treated as blocked
                errors.append(
                    PipelineError(
                        STAGE_INPUT, ERROR_SCAN_BLOCKED, f"input scan error, blocked: {e}"
                    )
                )
                timings[STAGE_INPUT] = _ms(t0)
                return _PreGate(False, errors, budget, scan, timings, False)
            timings[STAGE_INPUT] = _ms(t0)

        # ---- stage 2.5: reverse-engineered gate suite (显式到场才介入) ----
        # round8/9 落的那族静态准入判据此前零生产 importer(造好没装车)。这里是它的
        # **真实生产接线点**:调用方在工具入参里显式给 `__gate_suite__`(由
        # extract_gate_request 剥离,控制键绝不进真实工具)才启用;未给 ⇒
        # gate_request is None ⇒ 本 stage 连判据函数都不调用(缺省零行为、零开销)。
        if gate_request is not None:
            t0 = time.perf_counter()
            try:
                gate_fn = self.gate_suite or _resolve_gate_suite()
                suite = gate_fn(gate_request, gate_policy)
                gate_result = (
                    dict(suite) if isinstance(suite, dict) else {"verdict": "unjudged"}
                )
                if gate_result.get("verdict") != "allowed":
                    errors.append(
                        PipelineError(
                            STAGE_GATE,
                            ERROR_GATE_BLOCKED,
                            str(gate_result.get("reason") or "gate suite blocked"),
                        )
                    )
                    timings[STAGE_GATE] = _ms(t0)
                    return _PreGate(False, errors, budget, scan, timings, False, gate_result)
            except Exception as e:  # fail-closed:判据自身异常按阻断,绝不静默放行
                errors.append(
                    PipelineError(STAGE_GATE, ERROR_GATE_BLOCKED, f"gate suite error, blocked: {e}")
                )
                timings[STAGE_GATE] = _ms(t0)
                return _PreGate(False, errors, budget, scan, timings, False, gate_result)
            timings[STAGE_GATE] = _ms(t0)

        # ---- stage 3: budget gate (guard_enabled) ----
        budget_acquired = False
        if self.guard_enabled and budget_gov is not None:
            t0 = time.perf_counter()
            try:
                gate = budget_gov.acquire(run_id, tool_name=tool_name, cost_estimate=cost_estimate)
                budget = {
                    "allowed": gate.allowed,
                    "used": gate.used,
                    "limits": gate.limits,
                    "reason": gate.reason,
                }
                if not gate.allowed:
                    errors.append(
                        PipelineError(
                            STAGE_BUDGET, gate.error_type or ERROR_BUDGET_EXCEEDED, gate.reason
                        )
                    )
                    timings[STAGE_BUDGET] = _ms(t0)
                    return _PreGate(False, errors, budget, scan, timings, False, gate_result)
                budget_acquired = True
            except Exception as e:  # degrade-open: budget failure does not block a legit tool
                errors.append(
                    PipelineError(
                        STAGE_BUDGET,
                        ERROR_BUDGET_EXCEEDED,
                        f"budget gate error (degrade-open): {e}",
                    )
                )
            timings[STAGE_BUDGET] = _ms(t0)

        return _PreGate(True, errors, budget, scan, timings, budget_acquired, gate_result)

    # ---------------- Post stages: record -> cost -> release ----------------

    def _post(
        self,
        tool_name: str,
        args: dict[str, Any],
        run_id: str,
        recorder: Any,
        budget_gov: Any,
        pre: _PreGate,
        *,
        fn_ok: bool,
        fn_result: Any,
        fn_error: BaseException | None,
        actual_cost: float,
        tokens: int,
        tokens_in: int,
        tokens_out: int,
        http_summary: str,
    ) -> PipelineResult:
        errors = list(pre.errors)
        timings: dict[str, float] = dict(pre.timings)
        recorded_step_id: int | None = None
        tokens_model: str = ""

        # 工具内嵌 LLM 用量兜底(2026-09-09 立):调用方未计 token 而结果自带 llm_usage
        # (如 extract_web 的 LLM 抽取通道)时补记,保证 step 录制与账本聚合不漏计。
        if isinstance(fn_result, dict) and tokens_in <= 0 and tokens_out <= 0:
            u = fn_result.get("llm_usage")
            if isinstance(u, dict):
                ti = int(u.get("prompt_tokens") or u.get("input_tokens") or 0)
                to = int(u.get("completion_tokens") or u.get("output_tokens") or 0)
                if ti > 0 or to > 0:
                    tokens_in, tokens_out = ti, to
                    tokens = tokens or (ti + to)
                    m = fn_result.get("llm_model")
                    if isinstance(m, str) and m:
                        tokens_model = m

        if not fn_ok:
            errors.append(
                PipelineError(STAGE_FN, ERROR_TOOL_ERROR, str(fn_error) or "tool execution failed")
            )

        # ---- stage 4: step recording (record_enabled) ----
        if self.record_enabled and recorder is not None:
            t0 = time.perf_counter()
            try:
                step = recorder.append_step(
                    run_id,
                    {
                        "type": "tool",
                        "tool_name": tool_name,
                        "input_summary": args,
                        "result_summary": {"error": repr(fn_error)} if not fn_ok else fn_result,
                        "status": "error" if not fn_ok else "ok",
                        "tokens": tokens,
                        "tokens_in": tokens_in,
                        "tokens_out": tokens_out,
                        "model": tokens_model,
                        "duration_ms": timings.get(STAGE_FN, 0.0),
                        "cost": actual_cost,
                        "http_summary": http_summary,
                    },
                )
                recorded_step_id = step.get("step_index")
            except Exception as e:
                errors.append(PipelineError(STAGE_RECORD, ERROR_RECORD_FAILED, str(e)))
            timings[STAGE_RECORD] = _ms(t0)

        # ---- stage 5: cost recalibration (only when budget was actually acquired) ----
        if pre.budget_acquired and budget_gov is not None:
            t0 = time.perf_counter()
            try:
                budget_gov.record_usage(run_id, float(actual_cost or 0.0))
            except Exception as e:
                errors.append(PipelineError(STAGE_COST, ERROR_COST_FAILED, str(e)))
            timings[STAGE_COST] = _ms(t0)

        # ---- stage 6: release concurrency slot (only when acquired) ----
        if pre.budget_acquired and budget_gov is not None:
            t0 = time.perf_counter()
            try:
                budget_gov.release(run_id)
            except Exception as e:
                errors.append(PipelineError(STAGE_RELEASE, ERROR_RELEASE_FAILED, str(e)))
            timings[STAGE_RELEASE] = _ms(t0)

        return PipelineResult(
            ok=fn_ok,
            result=fn_result if fn_ok else None,
            errors=errors,
            budget=pre.budget,
            scan=pre.scan,
            gate=pre.gate,
            recorded_step_id=recorded_step_id,
            stage_timings_ms=timings,
        )

    # ---------------- Public entry points ----------------

    async def run(
        self,
        tool_name: str,
        args: dict[str, Any] | None = None,
        *,
        fn: Callable[..., Any],
        run_id: str,
        recorder: Any | None = None,
        budget: Any | None = None,
        cost_estimate: float = 0.0,
        actual_cost: float = 0.0,
        tokens: int = 0,
        tokens_in: int = 0,
        tokens_out: int = 0,
        scan_source: str = "mcp",
        scan_policy: str = "flag",
        block_on_scan: bool = True,
        prompt_source: str = "mcp",
        prompt_policy: str = "refuse",
        scan_flags: list[str] | None = None,
        http_summary: str = "",
        session_id: str | None = None,
        gate_request: Any = None,
        gate_policy: Any = None,
    ) -> PipelineResult:
        """Async full flow. fn may be async or sync (awaited when awaitable)."""
        args, rec, bgov, pre = self._setup(
            tool_name, args, run_id, recorder, budget,
            cost_estimate=cost_estimate, scan_source=scan_source, scan_policy=scan_policy,
            block_on_scan=block_on_scan, prompt_source=prompt_source,
            prompt_policy=prompt_policy, scan_flags=scan_flags,
            session_id=session_id, gate_request=gate_request, gate_policy=gate_policy,
        )
        if not pre.ok:
            return self._from_pre(pre)

        t0 = time.perf_counter()
        fn_ok, fn_result, fn_error = True, None, None
        try:
            out = fn(args)
            if inspect.isawaitable(out):
                out = await out
            fn_result = out
        except Exception as e:
            fn_ok, fn_error = False, e
        pre.timings[STAGE_FN] = _ms(t0)

        return self._post(
            tool_name, args, run_id, rec, bgov, pre,
            fn_ok=fn_ok, fn_result=fn_result, fn_error=fn_error,
            actual_cost=actual_cost, tokens=tokens, tokens_in=tokens_in,
            tokens_out=tokens_out, http_summary=http_summary,
        )

    def run_sync(
        self,
        tool_name: str,
        args: dict[str, Any] | None = None,
        *,
        fn: Callable[..., Any],
        run_id: str,
        recorder: Any | None = None,
        budget: Any | None = None,
        cost_estimate: float = 0.0,
        actual_cost: float = 0.0,
        tokens: int = 0,
        tokens_in: int = 0,
        tokens_out: int = 0,
        scan_source: str = "mcp",
        scan_policy: str = "flag",
        block_on_scan: bool = True,
        prompt_source: str = "mcp",
        prompt_policy: str = "refuse",
        scan_flags: list[str] | None = None,
        http_summary: str = "",
        session_id: str | None = None,
        gate_request: Any = None,
        gate_policy: Any = None,
    ) -> PipelineResult:
        """Sync full flow (sync-only fn), for non-async callers."""
        args, rec, bgov, pre = self._setup(
            tool_name, args, run_id, recorder, budget,
            cost_estimate=cost_estimate, scan_source=scan_source, scan_policy=scan_policy,
            block_on_scan=block_on_scan, prompt_source=prompt_source,
            prompt_policy=prompt_policy, scan_flags=scan_flags,
            session_id=session_id, gate_request=gate_request, gate_policy=gate_policy,
        )
        if not pre.ok:
            return self._from_pre(pre)

        t0 = time.perf_counter()
        fn_ok, fn_result, fn_error = True, None, None
        try:
            fn_result = fn(args)
        except Exception as e:
            fn_ok, fn_error = False, e
        pre.timings[STAGE_FN] = _ms(t0)

        return self._post(
            tool_name, args, run_id, rec, bgov, pre,
            fn_ok=fn_ok, fn_result=fn_result, fn_error=fn_error,
            actual_cost=actual_cost, tokens=tokens, tokens_in=tokens_in,
            tokens_out=tokens_out, http_summary=http_summary,
        )

    def guard(
        self,
        *,
        fn: Callable[..., Any],
        tool_name: str,
        args: dict[str, Any] | None = None,
        run_id: str,
        session_id: str | None = None,
        **kw: Any,
    ) -> GuardedRun:
        """Async context manager wrapping the full flow; a block raises GuardedToolError."""
        return GuardedRun(
            self, fn=fn, tool_name=tool_name, args=args, run_id=run_id,
            session_id=session_id, **kw,
        )

    def check(self, run_id: str) -> dict[str, Any]:
        """Read-only snapshot: budget used/remaining + cost ledger + recorder metrics."""
        snap: dict[str, Any] = {"run_id": run_id, "tool": "guarded_tool_pipeline"}

        if self.budget_governor is not None:
            try:
                snap["budget"] = self.budget_governor.get_state(run_id)
            except Exception:
                snap["budget"] = {}

        if self.step_recorder is not None:
            try:
                m = self.step_recorder.get_run_metrics(run_id)
                snap["records"] = {
                    "step_count": m["step_count"],
                    "ok_count": m["ok_count"],
                    "error_count": m["error_count"],
                    "total_cost": m["total_cost"],
                    "total_tokens": m["total_tokens"],
                }
            except Exception:
                snap["records"] = {}
            if self.cost_accounting is not None:
                try:
                    snap["cost_ledger"] = self.cost_accounting(self.step_recorder, run_id)
                except Exception:
                    snap["cost_ledger"] = {}

        return snap

    # ---------------- Internals ----------------

    def _setup(
        self, tool_name: str, args: dict[str, Any] | None, run_id: str, recorder: Any,
        budget: Any, session_id: str | None = None, **kw: Any,
    ) -> tuple[dict[str, Any], Any, Any, _PreGate]:
        """Resolve recorder/governor and run pre-guards; callers branch on pre.ok."""
        if args is None:
            args = {}
        rec = (
            recorder
            if recorder is not None
            else (self.step_recorder if self.record_enabled else None)
        )
        bgov = budget if budget is not None else self.budget_governor
        pre = self._pre_guards(
            tool_name, args, run_id, bgov,
            session_id=session_id, injection_recorder=self.injection_recorder, **kw,
        )
        return args, rec, bgov, pre

    def _from_pre(self, pre: _PreGate) -> PipelineResult:
        return PipelineResult(
            ok=False,
            result=None,
            errors=pre.errors,
            budget=pre.budget,
            scan=pre.scan,
            gate=pre.gate,
            recorded_step_id=None,
            stage_timings_ms=pre.timings,
        )


class GuardedRun:
    """Async context manager returned by guard().

    __aenter__: runs the whole pipeline; raises GuardedToolError when blocked.
    __aexit__:  returns normally (does not swallow exceptions). Result in .result.
    """

    def __init__(self, pipeline: GuardedToolPipeline, **run_kwargs: Any) -> None:
        self._pipeline = pipeline
        self._run_kwargs = run_kwargs
        self.result: PipelineResult | None = None

    async def __aenter__(self) -> GuardedRun:
        result: PipelineResult = await self._pipeline.run(**self._run_kwargs)
        self.result = result
        if not result.ok and result.errors:
            e = result.errors[0]
            raise GuardedToolError(e.error_type, e.stage, e.message)
        return self

    async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> bool:
        return False  # do not swallow exceptions


__all__ = [
    "ERROR_INJECTION_BLOCKED",
    "ERROR_SCAN_BLOCKED",
    "ERROR_BUDGET_EXCEEDED",
    "ERROR_TOOL_ERROR",
    "ERROR_RECORD_FAILED",
    "ERROR_COST_FAILED",
    "ERROR_RELEASE_FAILED",
    "ERROR_GATE_BLOCKED",
    "STAGE_PROMPT",
    "STAGE_INPUT",
    "STAGE_GATE",
    "STAGE_BUDGET",
    "STAGE_FN",
    "STAGE_RECORD",
    "STAGE_COST",
    "STAGE_RELEASE",
    "PipelineError",
    "PipelineResult",
    "GuardedToolError",
    "GuardedToolPipeline",
    "GuardedRun",
    "extract_gate_request",
    "GATE_KEY",
    "GATE_KEY_ABSENT",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
