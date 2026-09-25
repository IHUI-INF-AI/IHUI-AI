# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""goal 独立校验闸门的离线单测(AGENTS.md §8 第 3/4 步的验收判据)。

全程不连库、不连网(§5 测试隔离铁律):judge 用注入点替身,iterations 用假对象喂。
锁的是"调用点存在且方向唯一"这一件事 —— 闸门只允许把执行模型的 `success=True`
收成 False,任何反向兜底(判不了就当通过)都属交付事故。
"""

from __future__ import annotations

import itertools
import json
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pytest

from app.core.tunables import GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES
from app.services.completion_verification import JudgeResponse
from app.services.goal_completion_gate import (
    STOP_GOAL_BLOCKED,
    STOP_VERIFICATION_NOT_ACHIEVED,
    STOP_VERIFICATION_UNDETERMINED,
    GoalCriterionSpec,
    GoalCriterionSpecError,
    collect_evidence,
    gate_goal_completion,
    note_goal_attempt,
    peek_goal_attempts,
    reset_goal_attempts,
    validate_specs,
)

SESSION = "session-goal-gate-test"
_counter_lock = itertools.count()


@dataclass
class FakeToolResult:
    name: str
    result: Any
    error: str | None = None


@dataclass
class FakeIteration:
    iteration: int
    tool_results: list[FakeToolResult] = field(default_factory=list)


def run_command_iteration(command: str, exit_code: int, *, stdout: str = "done") -> FakeIteration:
    return FakeIteration(
        iteration=1,
        tool_results=[
            FakeToolResult(
                name="run_command",
                result={
                    "tool": "run_command",
                    "command": command,
                    "exit_code": exit_code,
                    "stdout": stdout,
                },
            )
        ],
    )


def edit_iteration() -> FakeIteration:
    return FakeIteration(
        iteration=1,
        tool_results=[FakeToolResult(name="edit_file", result={"path": "a.ts", "ok": True})],
    )


def probe_spec(cid: str = "tsc", command: str = "pnpm typecheck") -> GoalCriterionSpec:
    return GoalCriterionSpec(
        id=cid,
        statement=f"{command} 退出码必须为 0",
        evidence_kind="command",
        probe_command=command,
    )


def semantic_spec(cid: str = "behavior") -> GoalCriterionSpec:
    return GoalCriterionSpec(id=cid, statement="行为保持不变(需语义核对)", evidence_kind="manual")


class FakeJudge:
    def __init__(self, verdicts: dict[str, str], *, model: str = "judge-x") -> None:
        self.verdicts = verdicts
        self.model = model
        self.calls: list[list[dict[str, str]]] = []

    async def __call__(self, messages: list[dict[str, str]]) -> JudgeResponse:
        self.calls.append(messages)
        rows = [
            {
                "criterion_id": cid,
                "verdict": verdict,
                "reason": f"据证据判 {verdict}",
                # 只引用本条语义指标名下真存在的证据 id(digest-<cid>),
                # 否则会被机制自身判成"凭空背书"而掩盖本层要测的那条结论。
                "evidence_ids": [f"digest-{cid}"],
            }
            for cid, verdict in self.verdicts.items()
        ]
        return JudgeResponse(content=json.dumps(rows), model=self.model)


async def _gate(
    specs: Sequence[GoalCriterionSpec],
    iterations: Sequence[FakeIteration],
    *,
    judge: Any = None,
    session: str | None = None,
    final_response: str = "我已经全部完成了",
    loop_success: bool = True,
    loop_stop_reason: str = "completed",
):  # noqa: ANN202 - GoalGateDecision,避免在签名里重复导入
    """跑一次闸门。session 缺省时每次给一个**新会话**,避免用例之间串计数。"""
    return await gate_goal_completion(
        session_id=session if session is not None else f"{SESSION}-{next(_counter_lock)}",
        specs=specs,
        iterations=iterations,
        final_response=final_response,
        executor_model="exec-model-1",
        loop_success=loop_success,
        loop_stop_reason=loop_stop_reason,
        judge=judge,
    )


# ==================== 三条核心语义 ====================


@pytest.mark.asyncio
async def test_executor_claim_of_done_is_overruled_by_independent_judge() -> None:
    """① 执行模型声称完成 + 独立校验判未达成 → 必须不通过(且 stop_reason 被改写)。"""
    decision = await _gate(
        [semantic_spec()],
        [edit_iteration()],
        judge=FakeJudge({"behavior": "unmet"}),
    )
    assert decision.allowed_complete is False
    assert decision.goal_status == "not_achieved"
    assert decision.stop_reason == STOP_VERIFICATION_NOT_ACHIEVED
    payload = decision.payload
    assert payload is not None
    assert payload["treat_as_complete"] is False
    assert payload["criteria"][0]["verdict"] == "unmet"


@pytest.mark.asyncio
async def test_only_an_achieved_verdict_allows_completion() -> None:
    """② 校验判达成 → 才允许达成(stop_reason 不动,goal_status=achieved)。"""
    decision = await _gate(
        [semantic_spec()],
        [edit_iteration()],
        judge=FakeJudge({"behavior": "met"}),
    )
    assert decision.allowed_complete is True
    assert decision.goal_status == "achieved"
    assert decision.stop_reason is None
    assert decision.payload is not None
    assert decision.payload["treat_as_complete"] is True


@pytest.mark.asyncio
async def test_unavailable_judge_is_undetermined_and_blocks_completion() -> None:
    """③ 校验不可得 = 未判定,绝不是"默认通过"(反向对照)。"""

    async def broken_judge(_messages: list[dict[str, str]]) -> JudgeResponse:
        raise RuntimeError("模型不可达")

    decision = await _gate([semantic_spec()], [edit_iteration()], judge=broken_judge)
    assert decision.allowed_complete is False
    assert decision.goal_status == "undetermined"
    assert decision.stop_reason == STOP_VERIFICATION_UNDETERMINED
    assert decision.payload is not None
    assert decision.payload["treat_as_complete"] is False
    assert "模型不可达" in str(decision.payload["unavailable_reason"])


@pytest.mark.asyncio
async def test_unparseable_judge_output_is_undetermined() -> None:
    async def garbage_judge(_messages: list[dict[str, str]]) -> JudgeResponse:
        return JudgeResponse(content="我确认已经完成了 👍", model="judge-x")

    decision = await _gate([semantic_spec()], [edit_iteration()], judge=garbage_judge)
    assert decision.allowed_complete is False
    assert decision.goal_status == "undetermined"


# ==================== 机器证据:声明的验证命令真的跑过吗 ====================


@pytest.mark.asyncio
async def test_declared_probe_never_executed_cannot_be_judged_achieved() -> None:
    """声明了验证命令但本轮根本没跑 → 未判定(既不是达成,也不是"证据说明没做完")。"""
    decision = await _gate([probe_spec()], [edit_iteration()], judge=FakeJudge({}))
    assert decision.allowed_complete is False
    assert decision.goal_status == "undetermined"
    evidence = collect_evidence([probe_spec()], [edit_iteration()])
    assert evidence[0].unavailable_reason is not None
    assert "没有跑过声明的验证命令" in (evidence[0].unavailable_reason or "")


@pytest.mark.asyncio
async def test_machine_evidence_decides_and_the_judge_is_never_called() -> None:
    """退出码 0 是机器结论;非 0 也同样是 —— 两种情形都不该给 judge 改判的机会。"""
    judge = FakeJudge({"tsc": "met"})
    ok = await _gate([probe_spec()], [run_command_iteration("pnpm typecheck", 0)], judge=judge)
    assert ok.allowed_complete is True
    assert ok.verification is not None
    assert ok.verification.independent_request_made is False
    assert judge.calls == []

    bad = await _gate([probe_spec()], [run_command_iteration("pnpm typecheck", 2)], judge=judge)
    assert bad.allowed_complete is False
    assert bad.goal_status == "not_achieved"
    assert judge.calls == []  # 机器判 unmet 后没有任何语义项要问


@pytest.mark.asyncio
async def test_failed_machine_evidence_cannot_be_talked_over_by_a_generous_judge() -> None:
    """混合场景:机器项已判 unmet,同批语义项即使被 judge 判 met 也不能抬成达成。"""
    iterations = [
        run_command_iteration("pnpm typecheck", 1, stdout="TS2345 error"),
        edit_iteration(),
    ]
    decision = await _gate(
        [probe_spec(), semantic_spec()],
        iterations,
        judge=FakeJudge({"behavior": "met"}),
    )
    assert decision.allowed_complete is False
    assert decision.goal_status == "not_achieved"
    verdicts = {c.criterion_id: c.basis for c in decision.verification.criteria}  # type: ignore[union-attr]
    assert verdicts == {"tsc": "machine", "behavior": "judge"}


def test_executor_claim_is_not_part_of_the_evidence_digest() -> None:
    """送给独立校验轮的证据只含工具事实;执行者的"我做完了"不得进证据正文。"""
    evidence = collect_evidence([semantic_spec()], [edit_iteration()])
    assert "我已经全部完成了" not in evidence[0].excerpt
    assert "edit_file" in evidence[0].excerpt


@pytest.mark.asyncio
async def test_claim_text_reaches_the_gate_only_as_executor_claim() -> None:
    """执行者自述仍要透传(供 UI 对照),但 judge 收到的提示词里不含它。"""
    judge = FakeJudge({"behavior": "met"})
    await _gate(
        [semantic_spec()],
        [edit_iteration()],
        judge=judge,
        final_response="本目标已 100% 达成,无需再看",
    )
    assert len(judge.calls) == 1
    prompt = json.dumps(judge.calls[0], ensure_ascii=False)
    assert "本目标已 100% 达成" not in prompt


# ==================== §8 补的最小一致化:收口与预算档 ====================


@pytest.mark.asyncio
async def test_consecutive_failures_close_the_goal_as_blocked() -> None:
    """连续 N 轮不通过 → goal_status 落 blocked(§8 第 4 步"连续 3 轮 no → blocked")。"""
    reset_goal_attempts(SESSION)
    seen: list[str] = []
    for _ in range(GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES):
        decision = await _gate(
            [semantic_spec()],
            [edit_iteration()],
            judge=FakeJudge({"behavior": "unmet"}),
            session=SESSION,
        )
        assert decision.allowed_complete is False
        seen.append(decision.goal_status)
    assert seen[: GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES - 1] == ["not_achieved"] * (
        GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES - 1
    )
    assert seen[-1] == "blocked"
    assert decision.stop_reason == STOP_GOAL_BLOCKED
    assert decision.payload is not None
    assert decision.payload["max_consecutive_failures"] == (
        GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES
    )
    reset_goal_attempts(SESSION)


@pytest.mark.asyncio
async def test_achieved_resets_the_streak_counter() -> None:
    reset_goal_attempts(SESSION)
    assert peek_goal_attempts(SESSION) == 0
    await _gate(
        [semantic_spec()],
        [edit_iteration()],
        judge=FakeJudge({"behavior": "unmet"}),
        session=SESSION,
    )
    assert peek_goal_attempts(SESSION) == 1
    await _gate(
        [semantic_spec()],
        [edit_iteration()],
        judge=FakeJudge({"behavior": "met"}),
        session=SESSION,
    )
    assert peek_goal_attempts(SESSION) == 0
    # 再来一次失败必须从 1 起算,而不是直接落 blocked
    await _gate(
        [semantic_spec()],
        [edit_iteration()],
        judge=FakeJudge({"behavior": "unmet"}),
        session=SESSION,
    )
    assert peek_goal_attempts(SESSION) == 1
    reset_goal_attempts(SESSION)


@pytest.mark.asyncio
async def test_undetermined_and_not_achieved_share_the_same_streak_counter() -> None:
    """"判不了"也计入连续不通过 —— 否则一个恒坏的 judge 可以让 goal 永远续跑。"""
    reset_goal_attempts(SESSION)

    async def broken(_m: list[dict[str, str]]) -> JudgeResponse:
        raise RuntimeError("always down")

    for expected in ("undetermined", "undetermined"):
        decision = await _gate(
            [semantic_spec()], [edit_iteration()], judge=broken, session=SESSION
        )
        assert decision.goal_status == expected
    decision = await _gate(
        [semantic_spec()], [edit_iteration()], judge=broken, session=SESSION
    )
    assert decision.goal_status == "blocked"
    assert decision.stop_reason == STOP_GOAL_BLOCKED
    reset_goal_attempts(SESSION)


def test_note_goal_attempt_is_per_session() -> None:
    reset_goal_attempts("s-a")
    reset_goal_attempts("s-b")
    assert note_goal_attempt("s-a", achieved=False) == 1
    assert peek_goal_attempts("s-b") == 0
    assert note_goal_attempt("s-a", achieved=False) == 2
    assert note_goal_attempt("s-a", achieved=True) == 0
    assert peek_goal_attempts("s-a") == 0


@pytest.mark.asyncio
async def test_budget_limited_loop_is_never_verified_as_achieved() -> None:
    """预算耗尽档:循环自己就没完成,不去跑校验,更不允许把 budget_limited 写成达成。"""
    judge = FakeJudge({"tsc": "met"})
    decision = await _gate(
        [probe_spec()],
        [run_command_iteration("pnpm typecheck", 0)],
        judge=judge,
        loop_success=False,
        loop_stop_reason="budget_exceeded",
    )
    assert decision.allowed_complete is False
    assert decision.goal_status == "budget_limited"
    assert judge.calls == []
    assert decision.payload is not None
    assert decision.payload["status"] == "not_run"
    assert decision.payload["treat_as_complete"] is False


@pytest.mark.asyncio
async def test_iteration_exhaustion_maps_to_blocked_without_calling_the_judge() -> None:
    """轮次耗尽 = §8 红线"单目标最大自动迭代超出" → blocked。"""
    decision = await _gate(
        [probe_spec()],
        [run_command_iteration("pnpm typecheck", 0)],
        judge=FakeJudge({"tsc": "met"}),
        loop_success=False,
        loop_stop_reason="max_iterations",
    )
    assert decision.allowed_complete is False
    assert decision.goal_status == "blocked"


@pytest.mark.asyncio
async def test_loop_that_never_claimed_success_is_passed_through_untouched() -> None:
    """循环自身以 error/cancelled 停止 → 不编造校验结论,也不改它的 stop_reason。"""
    decision = await _gate(
        [probe_spec()],
        [],
        judge=FakeJudge({"tsc": "met"}),
        loop_success=False,
        loop_stop_reason="cancelled",
    )
    assert decision.allowed_complete is False
    assert decision.goal_status == "not_declared"
    assert decision.stop_reason is None
    assert decision.payload is None


# ==================== 声明层面的校验 ====================


def test_empty_specs_are_rejected_instead_of_becoming_undetermined() -> None:
    with pytest.raises(GoalCriterionSpecError):
        validate_specs([])


def test_duplicate_criterion_ids_are_rejected() -> None:
    with pytest.raises(GoalCriterionSpecError):
        validate_specs([probe_spec("a"), probe_spec("a")])


def test_digest_is_truncated_and_flagged_instead_of_dropping_evidence() -> None:
    big = FakeIteration(
        iteration=1,
        tool_results=[FakeToolResult(name="edit_file", result={"blob": "x" * 9000})],
    )
    evidence = collect_evidence([semantic_spec()], [big])
    assert evidence[0].excerpt


# ==================== 装车证明:闸门必须真在 done 帧之前 ====================


_ROUTER_SOURCE = (
    Path(__file__).resolve().parents[1] / "app" / "routers" / "agents.py"
).read_text(encoding="utf-8")


def test_stream_route_wires_the_gate_before_the_done_frame() -> None:
    """判据存在却没接线 = 没有这道判定(§8 第 3 步要求的是"参与判定",不是"有个端点")。"""
    gate_at = _ROUTER_SOURCE.find("await gate_goal_completion(")
    done_at = _ROUTER_SOURCE.find('"type": SSE_DONE,', gate_at)
    assert gate_at > 0, "agents.py 里找不到独立校验闸门的调用点"
    assert done_at > gate_at, "done 帧必须在闸门之后组装"
    assert "frame_success = False" in _ROUTER_SOURCE
    assert '"verification": verification_payload' in _ROUTER_SOURCE


def test_stream_route_rejects_malformed_declared_criteria() -> None:
    assert "GoalCriterionSpecError" in _ROUTER_SOURCE
    assert "hard_criteria" in _ROUTER_SOURCE


def test_single_turn_route_cannot_bypass_the_gate() -> None:
    """另一个执行入口必须**拒绝**声明硬性指标,而不是收下却不校验(fail-open 的入口形态)。"""
    assert "hard_criteria 仅在 POST /agents/execute/stream 生效" in _ROUTER_SOURCE


@pytest.mark.asyncio
async def test_no_criteria_means_zero_behaviour_change() -> None:
    """没声明硬性指标的调用方(现存全部端上调用)不得被本票改变任何语义。"""
    # 路由层:hard_criteria is None → 整段闸门不执行(见上一节的源码顺序断言)。
    # 这里补一条闸门自身的守卫:即便被以空清单调用,也只能拒绝,不能放行。
    with pytest.raises(GoalCriterionSpecError):
        await _gate([], [])
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
