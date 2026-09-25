# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""goal 独立校验轮的生产消费方(AGENTS.md §8 第 3 步 + 第 4 步收口)。

`completion_verification.py` 是机制本体,`routers/goal_verification.py` 是它的 HTTP
入口。但**没有调用方的判定器等于没有判定** —— 本模块是那个调用方:它把

  ① 执行前声明的硬性指标(`GoalCriterionSpec`)
  ② 执行循环真实留下的工具调用记录(`AgentLoopResult.iterations`)

对齐成 `EvidenceRecord`,交给独立校验轮,再把结论翻成 goal 生命周期。三条不可让:

1. **不得由执行模型自证**。指标声明先于执行;送给 judge 的"执行轨迹摘要"只含工具
   调用与结果(可观察副作用),**不含** final_response —— 后者作为 executor_claim
   只作对照,按 §8 与 JUDGE_SYSTEM_PROMPT 第 1 条,它不构成证据。
2. **绝不允许 fail-open**。校验不可达 / 输出解析不出 / 某条必需指标根本没采到证据 /
   本层自身抛异常 —— 一律 `undetermined`,且 `allowed_complete=False`。写进 done 帧的
   `success` 因此只可能是"独立校验判 achieved" 时为真。
3. **结论必须到人**。判定原样进 `POST /agents/execute/stream` 的 done 帧
   (`verification` + `goal_status` 字段),由 api-client 透给调用端展示。

§8 没写清、本模块补上的最小一致化(只此一条,不扩需求):
**校验连续 N 轮不通过怎么收口** —— N = `GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES`
(=3,对齐 §8 第 4 步"连续 3 轮 no 无进展 → blocked")。达阈值即 goal_status 落
`blocked` 并停止续跑语义;`budget_limited` / 轮次耗尽属循环自身的终止原因,此时根本不
跑校验(没有"执行者自宣完成"这件事可校验),更不允许把预算耗尽写成达成。

刻意不在模块顶层 import `agent_loop_v2`:它拉起工具管线(含在飞的 sandbox 依赖),
本层要能在无工具栈的环境下被单测。iterations 按结构化协议(Protocol)吃。
"""

from __future__ import annotations

import json
import logging
import re
import threading
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Final, Literal, Protocol

from app.core.tunables import (
    GOAL_RUN_DIGEST_MAX_CHARS,
    GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES,
)

from .completion_verification import (
    CompletionVerification,
    EvidenceRecord,
    HardCriterion,
    JudgeCall,
    VerificationRequest,
    verify_goal_completion,
)

logger = logging.getLogger(__name__)

GoalStatus = Literal[
    "achieved",  # 独立校验判达成 —— 唯一允许宣布完成的一档
    "not_achieved",  # 独立校验判未达成(有证据,证据不支持)
    "undetermined",  # 校验不可得 / 证据没采到(按未完成处理)
    "blocked",  # 连续 N 轮未通过,§8 第 4 步收口
    "budget_limited",  # §8 budget 子命令语义:预算耗尽,未达成
    "not_declared",  # 循环自己就没宣称完成,无需校验
    "skipped",  # 本次请求没声明硬性指标(非 goal 模式),行为与接线前逐零差异
]

#: done 帧里覆盖 stop_reason 的三个新取值(仅在声明了硬性指标时才可能出现)
STOP_VERIFICATION_NOT_ACHIEVED: Final = "verification_not_achieved"
STOP_VERIFICATION_UNDETERMINED: Final = "verification_undetermined"
STOP_GOAL_BLOCKED: Final = "goal_blocked"

#: 循环自身的"预算/轮次耗尽"类终止原因 —— 这些档下不跑校验,也绝不判达成
BUDGET_STOP_REASONS: Final[frozenset[str]] = frozenset(
    {"budget_exceeded", "budget_limited", "max_iterations"}
)
#: 轮次耗尽语义等同 §8 红线的"单目标最大自动迭代超出" → blocked
ITERATION_EXHAUSTION_REASONS: Final[frozenset[str]] = frozenset({"max_iterations"})

#: 工具名:执行循环里唯一能产出"命令退出码 / 测试通过数"这种机器结论的一族
COMMAND_TOOL_NAMES: Final[frozenset[str]] = frozenset({"run_command", "shell", "bash"})
#: 结果文本可引用的键(按优先级取第一个命中),与 agent_loop_v2.derive_step_evidence
#: 的 exitCode/exit_code 双键名兼容保持同一套口径(那两个键现实都存在)。
EXIT_CODE_KEYS: Final[tuple[str, ...]] = ("exitCode", "exit_code")
STDOUT_KEYS: Final[tuple[str, ...]] = ("stdout", "output", "content", "message")
TRUNCATION_MARK: Final = "…(truncated)"

_WHITESPACE = re.compile(r"\s+")


class ToolResultView(Protocol):
    """`agent_loop_v2.ToolResult` 的结构化视图(只声明本层用到的三个字段)。"""

    @property
    def name(self) -> str: ...

    @property
    def result(self) -> Any: ...

    @property
    def error(self) -> str | None: ...


class IterationView(Protocol):
    """`agent_loop_v2.LoopIteration` 的结构化视图。"""

    @property
    def iteration(self) -> int: ...

    @property
    def tool_results(self) -> Sequence[ToolResultView]: ...


class GoalCriterionSpecError(ValueError):
    """硬性指标声明本身不合法(重复 id / 空集)。调用方据此拒 422,不得静默丢条目。"""


@dataclass(frozen=True)
class GoalCriterionSpec:
    """一条**执行前**声明的硬性指标 + 它"如何被证实"的探针。

    `probe_command` 为空 = 这条只能靠语义判定(交独立校验轮);非空 = 本轮必须真的
    跑过这条命令,其退出码/失败数即机器结论,judge 碰不到它。
    """

    id: str
    statement: str
    evidence_kind: str = "manual"
    required: bool = True
    probe_command: str = ""
    expected_exit_code: int = 0

    def to_hard_criterion(self) -> HardCriterion:
        return HardCriterion(
            id=self.id,
            statement=self.statement,
            evidence_kind=self.evidence_kind or ("command" if self.probe_command else "manual"),
            required=self.required,
        )


def validate_specs(specs: Sequence[GoalCriterionSpec]) -> None:
    """声明层面的硬校验:空集与重复 id 一律拒,不"去掉重复的那条"继续跑。

    空集尤其危险:`verify_goal_completion` 对空指标判 undetermined,而 undetermined
    在 goal 语义里是"未完成",于是"声明漏了"会伪装成"活儿没干完"。宁可 422。
    """
    if not specs:
        raise GoalCriterionSpecError("hard_criteria 不能为空:goal 模式必须预先声明硬性指标")
    seen: set[str] = set()
    for spec in specs:
        if not spec.id.strip():
            raise GoalCriterionSpecError("硬性指标缺少 id")
        if spec.id in seen:
            raise GoalCriterionSpecError(f"硬性指标 id 重复: {spec.id}")
        seen.add(spec.id)


@dataclass
class _CommandFact:
    """一条真实执行过的命令及其机器结论(从循环的工具结果里挖出来的)。"""

    command: str
    exit_code: int | None
    passed: int | None
    failed: int | None
    output: str
    tool_error: str | None
    order: int


def _first_key(mapping: Mapping[str, Any], keys: Sequence[str]) -> Any:
    for key in keys:
        if key in mapping:
            return mapping[key]
    return None


def _as_int(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str) and value.strip().lstrip("-").isdigit():
        return int(value.strip())
    return None


def _command_facts(iterations: Sequence[IterationView]) -> list[_CommandFact]:
    """把循环留下的 run_command 类工具结果收成可对照的机器事实清单。"""
    facts: list[_CommandFact] = []
    for iteration in iterations:
        for tr in iteration.tool_results:
            if (tr.name or "") not in COMMAND_TOOL_NAMES:
                continue
            raw: Any = tr.result
            payload: Mapping[str, Any] = raw if isinstance(raw, Mapping) else {}
            # 命令原文由 _tool_run_command 回显在结果里(mcp_server.py:1829 `"command": command`),
            # 不再去 ToolResult 上猜一个不存在的 args 字段 —— 那只会静默产出空命令。
            command = payload.get("command")
            if not isinstance(command, str):
                command = ""
            output_parts: list[str] = []
            stdout = payload.get("stdout") or _first_key(payload, STDOUT_KEYS)
            if isinstance(stdout, str) and stdout:
                output_parts.append(stdout)
            stderr = payload.get("stderr")
            if isinstance(stderr, str) and stderr:
                output_parts.append(f"[stderr]\n{stderr}")
            if not output_parts and raw is not None and not isinstance(raw, Mapping):
                output_parts.append(str(raw))
            facts.append(
                _CommandFact(
                    command=str(command),
                    exit_code=_as_int(_first_key(payload, EXIT_CODE_KEYS)),
                    passed=_as_int(payload.get("passed")),
                    failed=_as_int(payload.get("failed")),
                    output="\n".join(output_parts),
                    tool_error=tr.error,
                    order=len(facts),
                )
            )
    return facts


def _normalize_command(command: str) -> str:
    return _WHITESPACE.sub(" ", command or "").strip()


def _match_command(facts: Sequence[_CommandFact], probe: str) -> _CommandFact | None:
    """找该探针**最近一次**真实执行记录(后跑的更贴近最终状态)。"""
    target = _normalize_command(probe)
    if not target:
        return None
    hits = [
        fact
        for fact in facts
        if _normalize_command(fact.command) == target
        or target in _normalize_command(fact.command)
    ]
    return hits[-1] if hits else None


def _run_digest(iterations: Sequence[IterationView]) -> tuple[str, bool]:
    """执行轨迹摘要:只含工具调用与结果,**不含**执行模型的自述正文。

    超限即截断并把 truncated 交出去 —— JUDGE_SYSTEM_PROMPT 第 3 条要求 judge 在
    "截断部分可能影响结论"时判 unmet,比静默丢证据诚实。
    """
    lines: list[str] = []
    for iteration in iterations:
        for tr in iteration.tool_results:
            body = tr.result
            rendered = body if isinstance(body, str) else json.dumps(body, ensure_ascii=False, default=str)
            status = "error" if tr.error else "ok"
            lines.append(f"- 第 {iteration.iteration} 轮 · {tr.name} → {status}: {rendered[:600]}")
    digest = "\n".join(lines)
    if not digest:
        return "", False
    if len(digest) > GOAL_RUN_DIGEST_MAX_CHARS:
        return digest[: GOAL_RUN_DIGEST_MAX_CHARS] + TRUNCATION_MARK, True
    return digest, False


def collect_evidence(
    specs: Sequence[GoalCriterionSpec],
    iterations: Sequence[IterationView],
) -> list[EvidenceRecord]:
    """按声明的探针把循环事实对齐成证据;**没跑过的探针如实报采集失败**。

    "采集失败"与"采集到但结论为否"是两件事:前者让该条落 undetermined(无从判定),
    后者由机器证据直接定案(unmet,judge 无权改判)。混起来会让"忘了跑验证命令"
    表现为"独立校验也判不了" → 于是没人去补那条命令。
    """
    facts = _command_facts(iterations)
    digest, digest_truncated = _run_digest(iterations)
    records: list[EvidenceRecord] = []
    for spec in specs:
        if spec.probe_command:
            fact = _match_command(facts, spec.probe_command)
            source = f"run_command:{_normalize_command(spec.probe_command)[:120]}"
            if fact is None:
                records.append(
                    EvidenceRecord(
                        id=f"probe-{spec.id}",
                        criterion_id=spec.id,
                        source=source,
                        unavailable_reason=(
                            "本轮执行没有跑过声明的验证命令,无从证实其退出码"
                        ),
                    )
                )
                continue
            outcome: bool | None = None
            if fact.exit_code is not None:
                outcome = fact.exit_code == spec.expected_exit_code
            elif fact.failed is not None:
                outcome = fact.failed == 0
            excerpt = (
                f"$ {fact.command}\n"
                f"exit_code={fact.exit_code} passed={fact.passed} failed={fact.failed}"
                f"{' tool_error=' + fact.tool_error if fact.tool_error else ''}\n"
                f"{fact.output}"
            )
            clipped = excerpt[:GOAL_RUN_DIGEST_MAX_CHARS]
            records.append(
                EvidenceRecord(
                    id=f"probe-{spec.id}",
                    criterion_id=spec.id,
                    source=source,
                    outcome=outcome,
                    excerpt=clipped,
                    truncated=len(excerpt) > GOAL_RUN_DIGEST_MAX_CHARS,
                    captured_at=float(fact.order),
                )
            )
            continue
        # 语义项:唯一可交出去的东西是"真发生过的副作用"。一次工具都没调,
        # 就等于没有证据 —— 此时判 undetermined,而不是让 judge 对着自述打分。
        if not digest:
            records.append(
                EvidenceRecord(
                    id=f"digest-{spec.id}",
                    criterion_id=spec.id,
                    source="run-digest",
                    unavailable_reason="本轮没有任何工具调用记录,可观察证据为空",
                )
            )
            continue
        records.append(
            EvidenceRecord(
                id=f"digest-{spec.id}",
                criterion_id=spec.id,
                source="run-digest",
                excerpt=digest,
                truncated=digest_truncated,
            )
        )
    return records


@dataclass(frozen=True)
class GoalGateDecision:
    """校验闸门的一次结论:能不能宣布达成 + 落到哪一档 goal 状态 + 给用户看什么。"""

    allowed_complete: bool
    goal_status: GoalStatus
    stop_reason: str | None
    payload: Mapping[str, Any] | None = None
    verification: CompletionVerification | None = field(default=None, compare=False)

    @property
    def overrides_stop_reason(self) -> bool:
        return self.stop_reason is not None


# ==================== 连续不通过的计数(§8 第 4 步收口) ====================
# 进程内按 session 计数,与 routers/agents.py 的 _trace_store / run_ownership 同一形态
# (刻意不落库:goal 轮次是运行态,§5 测试隔离铁律要求单测不得打生产 PG)。
_lock = threading.Lock()
_consecutive_failures: dict[str, int] = {}


def _counter_key(session_id: str | None) -> str:
    return session_id or "(anonymous-session)"


def note_goal_attempt(session_id: str | None, achieved: bool) -> int:
    """记一轮校验结论,返回**累计**连续未通过轮数(达成即归零)。"""
    key = _counter_key(session_id)
    with _lock:
        if achieved:
            _consecutive_failures.pop(key, None)
            return 0
        streak = _consecutive_failures.get(key, 0) + 1
        _consecutive_failures[key] = streak
        return streak


def peek_goal_attempts(session_id: str | None) -> int:
    with _lock:
        return _consecutive_failures.get(_counter_key(session_id), 0)


def reset_goal_attempts(session_id: str | None) -> None:
    """清计数(目标被清除 / 换目标时调用,避免旧 session 的失败串到新目标)。"""
    with _lock:
        _consecutive_failures.pop(_counter_key(session_id), None)


def _payload_from(
    status: GoalStatus,
    *,
    specs: Sequence[GoalCriterionSpec],
    verification: CompletionVerification | None,
    consecutive: int,
    reason: str | None,
    treat_as_complete: bool,
    ran_request: bool,
) -> dict[str, Any]:
    """done 帧的 `verification` 字段:结论 + 逐条证据归属,原样给用户看。

    未跑校验的档位(预算耗尽 / 循环未自宣完成)也回一份同形结构,把 `status` 写成
    `not_run` 并给原因 —— 字段形状稳定,调用端才不至于把"缺字段"当成"校验通过"。
    """
    criteria: list[dict[str, Any]] = []
    statement_by_id = {spec.id: spec.statement for spec in specs}
    if verification is not None:
        for verdict in verification.criteria:
            criteria.append(
                {
                    "criterion_id": verdict.criterion_id,
                    "statement": statement_by_id.get(verdict.criterion_id, ""),
                    "verdict": verdict.verdict,
                    "basis": verdict.basis,
                    "reason": verdict.reason,
                    "evidence_ids": list(verdict.evidence_ids),
                    "contradicted": verdict.contradicted,
                }
            )
    return {
        "status": status if verification is not None else "not_run",
        "goal_status": status,
        "treat_as_complete": treat_as_complete,
        "criteria": criteria,
        "independent_request_made": ran_request,
        "judge_model": verification.judge_model if verification else None,
        "unavailable_reason": reason
        if reason is not None
        else (verification.unavailable_reason if verification else None),
        "independence_warnings": list(verification.independence_warnings) if verification else [],
        "consecutive_failures": consecutive,
        "max_consecutive_failures": GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES,
    }


async def gate_goal_completion(
    *,
    session_id: str | None,
    specs: Sequence[GoalCriterionSpec],
    iterations: Sequence[IterationView],
    final_response: str = "",
    executor_model: str | None = None,
    loop_success: bool = True,
    loop_stop_reason: str = "completed",
    judge: JudgeCall | None = None,
) -> GoalGateDecision:
    """在**目标被宣布达成之前**跑一次独立校验,并给出 goal 生命周期结论。

    Args:
        session_id: goal 所属会话(连续不通过计数按它聚合)
        specs: 执行前声明的硬性指标(空集由调用方拦下,见 validate_specs)
        iterations: AgentLoopResult.iterations —— 机器事实的唯一来源
        final_response: 执行者自述,只作对照,**不作为判定输入**
        loop_success / loop_stop_reason: 循环自身的结论(预算耗尽档根本不跑校验)
        judge: 独立请求注入点,单测传替身即可离线跑(默认走 llm_gateway)

    Returns:
        GoalGateDecision.allowed_complete 为 False 时,调用方**必须**把 success 写成
        False —— 这是本层唯一允许的收口方向(不得反向把 False 抬成 True)。
    """
    # 档 1:循环自己就没宣布完成 → 没有可校验的东西,原样透传它的 stop_reason。
    if not loop_success or loop_stop_reason != "completed":
        if loop_stop_reason in BUDGET_STOP_REASONS:
            status: GoalStatus = (
                "blocked"
                if loop_stop_reason in ITERATION_EXHAUSTION_REASONS
                else "budget_limited"
            )
            reason = f"循环以 {loop_stop_reason} 终止,未达成即停止,不做完成声明"
            return GoalGateDecision(
                allowed_complete=False,
                goal_status=status,
                stop_reason=None,
                payload=_payload_from(
                    status,
                    specs=specs,
                    verification=None,
                    consecutive=peek_goal_attempts(session_id),
                    reason=reason,
                    treat_as_complete=False,
                    ran_request=False,
                ),
            )
        return GoalGateDecision(
            allowed_complete=False,
            goal_status="not_declared",
            stop_reason=None,
            payload=None,
        )

    validate_specs(specs)

    evidence = collect_evidence(specs, iterations)
    request = VerificationRequest(
        criteria=[spec.to_hard_criterion() for spec in specs],
        evidence=evidence,
        executor_claim=final_response,
        executor_model=executor_model,
        goal=" / ".join(spec.statement for spec in specs),
    )
    try:
        verification = await verify_goal_completion(request, judge=judge)
    except Exception as exc:  # noqa: BLE001 - 校验层任何异常都不得退化为"通过"
        logger.exception("goal 独立校验闸门异常(按未判定处理)")
        reason = f"独立校验闸门异常: {type(exc).__name__}: {exc}"
        streak = note_goal_attempt(session_id, achieved=False)
        blocked = streak >= GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES
        status_obj: GoalStatus = "blocked" if blocked else "undetermined"
        return GoalGateDecision(
            allowed_complete=False,
            goal_status=status_obj,
            stop_reason=STOP_GOAL_BLOCKED if blocked else STOP_VERIFICATION_UNDETERMINED,
            payload=_payload_from(
                status_obj,
                specs=specs,
                verification=None,
                consecutive=streak,
                reason=reason,
                treat_as_complete=False,
                ran_request=False,
            ),
        )

    achieved = verification.status == "achieved"
    streak = note_goal_attempt(session_id, achieved=achieved)

    if achieved:
        return GoalGateDecision(
            allowed_complete=True,
            goal_status="achieved",
            stop_reason=None,
            verification=verification,
            payload=_payload_from(
                "achieved",
                specs=specs,
                verification=verification,
                consecutive=0,
                reason=None,
                treat_as_complete=True,
                ran_request=verification.independent_request_made,
            ),
        )

    if verification.status == "undetermined":
        # 未判定 ≠ 未达成:两者都拦住完成声明,但只有前者允许下一轮重试,
        # 后者是"证据已经说明没做完"。混为一谈会让人去修根本不存在的缺陷。
        blocked = streak >= GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES
        status_obj = "blocked" if blocked else "undetermined"
        return GoalGateDecision(
            allowed_complete=False,
            goal_status=status_obj,
            stop_reason=STOP_GOAL_BLOCKED if blocked else STOP_VERIFICATION_UNDETERMINED,
            verification=verification,
            payload=_payload_from(
                status_obj,
                specs=specs,
                verification=verification,
                consecutive=streak,
                reason=None,
                treat_as_complete=False,
                ran_request=verification.independent_request_made,
            ),
        )

    blocked = streak >= GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES
    status_obj = "blocked" if blocked else "not_achieved"
    return GoalGateDecision(
        allowed_complete=False,
        goal_status=status_obj,
        stop_reason=STOP_GOAL_BLOCKED if blocked else STOP_VERIFICATION_NOT_ACHIEVED,
        verification=verification,
        payload=_payload_from(
            status_obj,
            specs=specs,
            verification=verification,
            consecutive=streak,
            reason=None,
            treat_as_complete=False,
            ran_request=verification.independent_request_made,
        ),
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
