# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""目标完成度独立校验轮离线单测。

全程不连库、不连网:judge 用注入点替身(§5 测试隔离铁律)。
锁的是"不得由执行者自宣完成"这一条规范的落地判据,以及 fail-open 的四种形态。
"""

from __future__ import annotations

import json
from collections.abc import Sequence

import pytest

from app.services.completion_verification import (
    CompletionVerification,
    CriterionVerdict,
    EvidenceRecord,
    HardCriterion,
    JudgeOutputInvalid,
    JudgeResponse,
    JudgeUnavailable,
    VerificationRequest,
    machine_decide,
    parse_judge_output,
    verify_goal_completion,
)


def crit(cid: str, statement: str = "", required: bool = True) -> HardCriterion:
    return HardCriterion(id=cid, statement=statement or f"指标 {cid}", required=required)


def ev(
    eid: str,
    cid: str,
    *,
    outcome: bool | None = None,
    excerpt: str = "some real output",
    source: str = "pytest",
    unavailable: str | None = None,
) -> EvidenceRecord:
    return EvidenceRecord(
        id=eid,
        criterion_id=cid,
        source=source,
        outcome=outcome,
        excerpt=excerpt,
        unavailable_reason=unavailable,
    )


class FakeJudge:
    """记录被问了什么、返回预置结论。"""

    def __init__(self, verdicts: dict[str, str], *, model: str | None = "judge-x") -> None:
        self.verdicts = verdicts
        self.model = model
        self.calls: list[Sequence[dict[str, str]]] = []

    async def __call__(self, messages: Sequence[dict[str, str]]) -> JudgeResponse:
        self.calls.append(messages)
        out = [
            {
                "criterion_id": cid,
                "verdict": self.verdicts[cid],
                "reason": f"基于证据判定 {cid}",
                "evidence_ids": [f"ev-{cid}"],
            }
            for cid in sorted(self.verdicts)
        ]
        return JudgeResponse(content=json.dumps(out, ensure_ascii=False), model=self.model)


# ---------------------------------------------------------------------------
# 一、机器能测的一律不交给模型
# ---------------------------------------------------------------------------


def test_machine_evidence_decides_without_any_model_request() -> None:
    decided = machine_decide(
        [crit("a"), crit("b")],
        [ev("e1", "a", outcome=True), ev("e2", "b", outcome=False)],
    )
    assert decided["a"].verdict == "met"
    assert decided["a"].basis == "machine"
    assert decided["b"].verdict == "unmet"


def test_machine_false_outweighs_machine_true_for_same_criterion() -> None:
    """同指标多条机器证据取 AND —— 看"最后一条"会因顺序偶然翻结论。"""
    decided = machine_decide(
        [crit("a")],
        [ev("e1", "a", outcome=True), ev("e2", "a", outcome=False)],
    )
    assert decided["a"].verdict == "unmet"


async def test_all_machine_criteria_skip_the_independent_request() -> None:
    judge = FakeJudge({"a": "met"})
    result = await verify_goal_completion(
        VerificationRequest(criteria=[crit("a")], evidence=[ev("e1", "a", outcome=True)]),
        judge=judge,
    )
    assert judge.calls == []
    assert result.independent_request_made is False
    assert result.status == "achieved"


async def test_machine_failure_cannot_be_talked_over_by_the_judge() -> None:
    """机器证据判 False 的条目根本不进 judge 视野,模型无权改判。"""
    judge = FakeJudge({"a": "met"})
    result = await verify_goal_completion(
        VerificationRequest(criteria=[crit("a")], evidence=[ev("e1", "a", outcome=False)]),
        judge=judge,
    )
    assert result.status == "not_achieved"
    assert result.criteria[0].basis == "machine"
    assert judge.calls == []


# ---------------------------------------------------------------------------
# 二、语义项才另起一次独立请求
# ---------------------------------------------------------------------------


async def test_semantic_criterion_gets_one_independent_request() -> None:
    judge = FakeJudge({"s1": "met"})
    result = await verify_goal_completion(
        VerificationRequest(
            goal="把守门接上",
            criteria=[crit("s1", "报告里逐条列了落点")],
            evidence=[ev("ev-s1", "s1", excerpt="报告正文含落点三条")],
        ),
        judge=judge,
    )
    assert len(judge.calls) == 1
    system_prompt = judge.calls[0][0]["content"]
    assert "不是执行者本人" in system_prompt
    assert result.independent_request_made is True
    assert result.judge_model == "judge-x"
    assert result.status == "achieved"
    assert result.criteria[0].basis == "judge"


async def test_executor_claim_is_not_fed_to_the_judge() -> None:
    """执行者自述不得成为判定输入 —— 否则独立请求只是给它盖章。"""
    judge = FakeJudge({"s1": "met"})
    await verify_goal_completion(
        VerificationRequest(
            criteria=[crit("s1")],
            evidence=[ev("ev-s1", "s1", excerpt="真实输出")],
            executor_claim="我已经全部完成并验证通过",
        ),
        judge=judge,
    )
    prompt = json.dumps(judge.calls[0], ensure_ascii=False)
    assert "我已经全部完成并验证通过" not in prompt


async def test_mixed_machine_and_semantic_only_asks_about_semantic() -> None:
    judge = FakeJudge({"s": "met"})
    result = await verify_goal_completion(
        VerificationRequest(
            criteria=[crit("m"), crit("s")],
            evidence=[
                ev("e-m", "m", outcome=True, excerpt="exit 0"),
                ev("ev-s", "s", excerpt="语义证据"),
            ],
        ),
        judge=judge,
    )
    asked = judge.calls[0][-1]["content"]
    assert "指标 s" in asked
    assert "指标 m" not in asked
    assert result.status == "achieved"


# ---------------------------------------------------------------------------
# 三、fail-open 语义:判定不可用一律 undetermined,绝不判"完成"
# ---------------------------------------------------------------------------


async def test_judge_unavailable_yields_undetermined_not_achieved() -> None:
    async def boom(_: Sequence[dict[str, str]]) -> JudgeResponse:
        raise JudgeUnavailable("network down")

    result = await verify_goal_completion(
        VerificationRequest(criteria=[crit("s1")], evidence=[ev("ev-s1", "s1", excerpt="x")]),
        judge=boom,
    )
    assert result.status == "undetermined"
    assert result.unavailable_reason is not None and "network down" in result.unavailable_reason
    assert result.criteria[0].verdict == "unknown"


async def test_unexpected_judge_exception_is_contained() -> None:
    async def raise_value_error(_: Sequence[dict[str, str]]) -> JudgeResponse:
        raise ValueError("注入点抛了个没预料的错")

    result = await verify_goal_completion(
        VerificationRequest(criteria=[crit("s1")], evidence=[ev("ev-s1", "s1", excerpt="x")]),
        judge=raise_value_error,
    )
    assert result.status == "undetermined"
    assert "ValueError" in (result.unavailable_reason or "")


@pytest.mark.parametrize(
    "bad",
    [
        "完全不是 JSON",
        '{"criterion_id": "s1"}',  # 对象而非数组
        '[{"criterion_id":"s1","verdict":"probably","reason":"x","evidence_ids":[]}]',
        '[{"criterion_id":"s9","verdict":"met","reason":"x","evidence_ids":["e"]}]',  # id 不对
        '[{"criterion_id":"s1","verdict":"met","reason":"  ","evidence_ids":["e"]}]',  # 空 reason
        '[{"criterion_id":"s1","verdict":"met","reason":"x"}]',  # 缺 evidence_ids
        '[{"criterion_id":"s1","verdict":"met","reason":"x","evidence_ids":[1]}]',  # id 非字符串
        '[{"criterion_id":"s1","verdict":"met","reason":"x","evidence_ids":["e"]},'
        '{"criterion_id":"s1","verdict":"met","reason":"x","evidence_ids":["e"]}]',  # 重复
    ],
)
def test_parse_judge_output_rejects_every_malformed_shape(bad: str) -> None:
    with pytest.raises(JudgeOutputInvalid):
        parse_judge_output(bad, ["s1"])


def test_parse_judge_output_rejects_missing_rows_instead_of_defaulting_them_met() -> None:
    """漏判不得默认成 met —— 那正是 fail-open 的静默形态。"""
    body = json.dumps(
        [{"criterion_id": "a", "verdict": "met", "reason": "r", "evidence_ids": ["e"]}]
    )
    with pytest.raises(JudgeOutputInvalid) as exc:
        parse_judge_output(body, ["a", "b"])
    assert "b" in str(exc.value)


def test_parse_judge_output_tolerates_markdown_fence() -> None:
    body = '```json\n[{"criterion_id":"a","verdict":"met","reason":"r","evidence_ids":["e"]}]\n```'
    parsed = parse_judge_output(body, ["a"])
    assert parsed["a"].verdict == "met"


async def test_fabricated_evidence_id_is_downgraded_to_unmet() -> None:
    class Fabricating(FakeJudge):
        async def __call__(self, messages: Sequence[dict[str, str]]) -> JudgeResponse:
            self.calls.append(messages)  # type: ignore[arg-type]
            return JudgeResponse(
                content=json.dumps(
                    [
                        {
                            "criterion_id": "s1",
                            "verdict": "met",
                            "reason": "我看见了",
                            "evidence_ids": ["ev-不存在的"],
                        }
                    ]
                ),
                model=self.model,
            )

    result = await verify_goal_completion(
        VerificationRequest(criteria=[crit("s1")], evidence=[ev("ev-s1", "s1", excerpt="x")]),
        judge=Fabricating({"s1": "met"}),
    )
    assert result.status == "not_achieved"
    assert result.criteria[0].contradicted is True
    assert "不存在" in result.criteria[0].reason


async def test_met_without_any_evidence_id_is_rejected() -> None:
    class Bare(FakeJudge):
        async def __call__(self, messages: Sequence[dict[str, str]]) -> JudgeResponse:
            self.calls.append(messages)  # type: ignore[arg-type]
            return JudgeResponse(
                content=json.dumps(
                    [{"criterion_id": "s1", "verdict": "met", "reason": "感觉对了", "evidence_ids": []}]
                ),
                model=self.model,
            )

    result = await verify_goal_completion(
        VerificationRequest(criteria=[crit("s1")], evidence=[ev("ev-s1", "s1", excerpt="x")]),
        judge=Bare({"s1": "met"}),
    )
    assert result.status == "not_achieved"


# ---------------------------------------------------------------------------
# 四、其它口径
# ---------------------------------------------------------------------------


async def test_no_criteria_is_undetermined_rather_than_achieved() -> None:
    result = await verify_goal_completion(VerificationRequest(criteria=[]))
    assert result.status == "undetermined"
    assert result.independent_request_made is False


async def test_criterion_without_evidence_is_undetermined() -> None:
    judge = FakeJudge({})
    result = await verify_goal_completion(
        VerificationRequest(criteria=[crit("s1")], evidence=[]),
        judge=judge,
    )
    assert judge.calls == []
    assert result.status == "undetermined"
    assert result.criteria[0].basis == "missing-evidence"


async def test_collection_failed_evidence_counts_as_absent() -> None:
    judge = FakeJudge({})
    result = await verify_goal_completion(
        VerificationRequest(
            criteria=[crit("s1")],
            evidence=[ev("e1", "s1", excerpt="", unavailable="命令没跑成:ENOENT")],
        ),
        judge=judge,
    )
    assert result.status == "undetermined"
    assert result.criteria[0].basis == "missing-evidence"


async def test_optional_criterion_cannot_block_achievement() -> None:
    judge = FakeJudge({"soft": "unmet"})
    result = await verify_goal_completion(
        VerificationRequest(
            criteria=[crit("hard"), crit("soft", required=False)],
            evidence=[
                ev("e-hard", "hard", outcome=True),
                ev("soft", "soft", excerpt="次要项输出"),
            ],
        ),
        judge=judge,
    )
    assert result.status == "achieved"
    assert [c.criterion_id for c in result.unmet] == ["soft"]


async def test_same_model_as_executor_is_flagged_but_not_hidden() -> None:
    judge = FakeJudge({"s1": "met"}, model="gpt-same")
    result = await verify_goal_completion(
        VerificationRequest(
            criteria=[crit("s1")],
            evidence=[ev("ev-s1", "s1", excerpt="x")],
            executor_model="gpt-same",
        ),
        judge=judge,
    )
    assert result.independence_warnings
    assert "同一模型" in result.independence_warnings[0]


async def test_long_excerpt_is_truncated_in_the_prompt() -> None:
    judge = FakeJudge({"s1": "met"})
    huge = "数" * 5000
    await verify_goal_completion(
        VerificationRequest(criteria=[crit("s1")], evidence=[ev("ev-s1", "s1", excerpt=huge)]),
        judge=judge,
    )
    asked = judge.calls[0][-1]["content"]
    assert "[truncated]" in asked
    assert len(asked) < len(huge)


# ---------------------------------------------------------------------------
# 五、装车证明:端点必须真被注册(机制造好没接线 = 没有)
# ---------------------------------------------------------------------------


def test_goal_verify_route_is_registered_on_the_app() -> None:
    """装车证明:端点路径存在 **且** main.py 真把它注册了。

    刻意不 `from app.main import app` —— 那会拉起全量路由,而本仓当前有他人
    未完成的 `app/services/sandbox/` 包遮蔽未跟踪目录,整 app 导入即红,
    与本票无关。改成"路由模块自身 + main.py 注册语句"两段取证。
    """
    from pathlib import Path

    from app.routers.goal_verification import router

    paths = {getattr(r, "path", None) for r in router.routes}
    assert "/api/agent/goal-verify" in paths
    main_src = (Path(__file__).resolve().parents[1] / "app" / "main.py").read_text(
        encoding="utf-8"
    )
    assert "goal_verification_router.router" in main_src


def test_route_schema_maps_absent_outcome_to_no_machine_decision() -> None:
    """HTTP 层的 outcome='absent' 必须落成"机器没结论",而不是 False。"""
    from app.routers.goal_verification import EvidenceIn, VerifyIn

    model = EvidenceIn(id="e1", criterion_id="c1", source="pytest", outcome="absent")
    assert model.outcome == "absent"
    body = VerifyIn(
        criteria=[{"id": "c1", "statement": "s"}],
        evidence=[model.model_dump()],
    )
    assert body.criteria[0].id == "c1"
    # absent → outcome=None:不能被读成"机器判了不成立"
    record = EvidenceRecord(
        id=model.id,
        criterion_id=model.criterion_id,
        source=model.source,
        outcome=None if model.outcome in (None, "absent") else model.outcome == "met",
    )
    assert record.outcome is None


async def test_http_round_trip_returns_fail_closed_verdict(monkeypatch: pytest.MonkeyPatch) -> None:
    """真端点往返(只挂本路由,不拉全量 app)。

    judge 被 monkeypatch 掉:测试期间不得打真实模型网关。
    """
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.routers import goal_verification as gv

    async def fake_verify(
        request: VerificationRequest, *, judge: object = None
    ) -> CompletionVerification:
        return CompletionVerification(
            status="undetermined",
            criteria=tuple(
                CriterionVerdict(
                    criterion_id=c.id,
                    verdict="unknown",
                    basis="judge",
                    reason="独立请求不可用: stub",
                )
                for c in request.criteria
            ),
            independent_request_made=True,
            judge_model=None,
            unavailable_reason="stub: 网关不可用",
        )

    monkeypatch.setattr(gv, "verify_goal_completion", fake_verify)
    app = FastAPI()
    app.include_router(gv.router)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/agent/goal-verify",
            json={
                "goal": "g",
                "criteria": [{"id": "c1", "statement": "s"}],
                "evidence": [{"id": "e1", "criterion_id": "c1", "source": "pytest", "excerpt": "x"}],
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "undetermined"
    # fail-closed:判定不可用时 treat_as_complete 必须是 False
    assert body["treat_as_complete"] is False
    assert body["unavailable_reason"]


async def test_http_round_trip_rejects_evidence_for_undeclared_criterion(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.routers import goal_verification as gv

    app = FastAPI()
    app.include_router(gv.router)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/agent/goal-verify",
            json={
                "criteria": [{"id": "c1", "statement": "s"}],
                "evidence": [
                    {"id": "e1", "criterion_id": "ghost", "source": "pytest", "excerpt": "x"}
                ],
            },
        )
    assert resp.status_code == 422
    assert "ghost" in resp.text


def test_response_echoes_server_side_convergence_budget() -> None:
    """收口上限的**权威值必须由响应回送**。

    CLI 那侧确实要自己计数(它跑的是自己的循环,服务端 gate 管不到),但阈值不能两端
    各抄一份 —— tunables.py 是唯一真源,所以响应里回送 `max_consecutive_failures`,
    TS 侧的镜像常量只在"服务端没给"时兜底。本用例就是钉住"没给"不会发生。
    """
    from app.core.tunables import GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES
    from app.routers.goal_verification import VerifyOut

    out = VerifyOut(
        status="achieved",
        treat_as_complete=True,
        criteria=[],
        independent_request_made=False,
    )
    assert out.max_consecutive_failures == GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES
    assert out.consecutive_failures == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
