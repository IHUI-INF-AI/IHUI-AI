# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-

"""goal 自评估闭环的端到端用例(V3 #77 验收判据 ①②③④)。

跑法:`pytest tests/test_goal_verify_loop.py`

覆盖的是**闭环**而不是机制本体(机制本体的逐条判据在
`test_completion_verification.py` / `test_goal_completion_gate.py`)。
这里锁的是四件事:

① 每条硬性指标各自有结论(三态 + 原因),并有聚合位看得见"几条没判出来";
② "判不了"不得被折成"成立" —— 含 judge 不可达这一型;
③ 连续无进展到达阈值 ⇒ 触发暂停,且**下一轮不再受理**(不是只产出一段文本);
④ 认证 ≠ 授权:自报属主一律不信,且属主判定发生在任何存储读取之前(断言零查询)。

刻意不带 session_id 的调用必须**根本不碰账本**,所以每条用例都断言
RecordingStore 的读/写次数 —— 那是"记账只发生在该发生的地方"的唯一可见证据。
"""

from __future__ import annotations

import itertools
from collections.abc import Mapping
from typing import Any

import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient

from app.core.tunables import GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES
from app.routers import goal_verification
from app.services.goal_round_state import (
    NOT_FOUND,
    GoalRoundRead,
    GoalRoundState,
    WriteReceipt,
    reset_store,
)

SESSIONS = itertools.count()


class RecordingStore:
    """账本存储替身:记录每一次读/写/清,用例据此断言"未发出查询"。"""

    name = "recording"

    def __init__(self, *, durable: bool = True) -> None:
        self.states: dict[str, GoalRoundState] = {}
        self.reads = 0
        self.writes = 0
        self.clears = 0
        self._durable = durable

    def describe(self) -> WriteReceipt:
        return WriteReceipt(storage=self.name, durable=self._durable, reason=None)

    async def read(self, session_id: str) -> GoalRoundRead:
        self.reads += 1
        state = self.states.get(session_id)
        if state is None:
            return NOT_FOUND
        return GoalRoundRead(found=True, state=state, unreadable=False, reason=None)

    async def write(self, state: GoalRoundState) -> WriteReceipt:
        self.writes += 1
        self.states[state.session_id] = state
        return self.describe()

    async def clear(self, session_id: str) -> bool:
        self.clears += 1
        return self.states.pop(session_id, None) is not None


@pytest.fixture
def store(monkeypatch: pytest.MonkeyPatch) -> RecordingStore:
    """把路由与闸门的账本都换成替身,并在用例后复位(模块级单例不得串)。"""
    fake = RecordingStore()
    monkeypatch.setattr(goal_verification, "get_store", lambda: fake)
    reset_store()
    yield fake
    reset_store()


def _app(principal: str | None) -> FastAPI:
    """最小 app:只挂本路由,身份由一个注入 request.state 的中间件提供。

    不走 tests/conftest.py 的全局 client:那份 app 的 autouse 夹具把 jwt_secret
    清空了,拿不到可控主体 ⇒ ④ 的两条属主分支根本进不去(表现为"测试通过而
    判据从未被走过")。
    """
    app = FastAPI()
    app.include_router(goal_verification.router)

    @app.middleware("http")
    async def _inject_principal(request: Request, call_next: Any) -> Any:
        if principal is not None:
            request.state.user_id = principal
        return await call_next(request)

    return app


async def _client(
    principal: str | None = "user-a", app: FastAPI | None = None
) -> AsyncClient:
    transport = ASGITransport(app=app if app is not None else _app(principal))
    return AsyncClient(transport=transport, base_url="http://t")


def machine_evidence(cid: str, *, met: bool, eid: str | None = None) -> dict[str, Any]:
    """一条机器可判证据(不需要 judge ⇒ 用例天然离线,不碰网络与凭据)。"""
    return {
        "id": eid or f"ev-{cid}",
        "criterion_id": cid,
        "source": f"run_command:{cid}",
        "outcome": "met" if met else "unmet",
        "excerpt": f"$ check {cid}\nexit_code={0 if met else 1}",
    }


def criteria(*ids: str, required: Mapping[str, bool] | None = None) -> list[dict[str, Any]]:
    return [
        {
            "id": cid,
            "statement": f"指标 {cid} 必须成立",
            "evidence_kind": "command",
            "required": (required or {}).get(cid, True),
        }
        for cid in ids
    ]


# ==================== ① 逐条三态 + 聚合位 ====================


@pytest.mark.asyncio
async def test_every_criterion_gets_its_own_verdict_and_the_aggregate_sees_it() -> None:
    """met / unmet / 判不了 三态并存时,响应必须三条各有结论且聚合计数对得上。"""
    payload = {
        "goal": "g",
        "criteria": criteria("a-met", "b-unmet", "c-starved"),
        "evidence": [
            machine_evidence("a-met", met=True),
            machine_evidence("b-unmet", met=False),
        ],
        "executor_claim": "我全都做完了",
    }
    async with await _client() as client:
        res = await client.post("/api/agent/goal-verify", json=payload)
    assert res.status_code == 200, res.text
    body = res.json()
    verdicts = {c["criterion_id"]: c for c in body["criteria"]}
    assert verdicts["a-met"]["verdict"] == "met"
    assert verdicts["b-unmet"]["verdict"] == "unmet"
    # c-starved 什么都没采到 ⇒ unknown(判不了),不是 unmet 也不是 met
    assert verdicts["c-starved"]["verdict"] == "unknown"
    assert verdicts["c-starved"]["reason"]
    assert (
        body["met_count"],
        body["unmet_count"],
        body["undetermined_count"],
        body["required_undetermined"],
    ) == (1, 1, 1, 1)
    assert body["treat_as_complete"] is False


@pytest.mark.asyncio
async def test_required_flag_is_echoed_per_criterion() -> None:
    """回显 required:否则调用方看得见哪条没过,看不见哪条没过会拦住整体。"""
    payload = {
        "criteria": criteria("soft", "hard", required={"soft": False}),
        "evidence": [machine_evidence("soft", met=False), machine_evidence("hard", met=True)],
    }
    async with await _client() as client:
        body = (await client.post("/api/agent/goal-verify", json=payload)).json()
    flags = {c["criterion_id"]: c["required"] for c in body["criteria"]}
    assert flags == {"soft": False, "hard": True}


# ==================== ② 判不了不得被算成通过 ====================


@pytest.mark.asyncio
async def test_judge_unavailable_yields_unknown_and_never_a_pass(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """judge 不可达 ⇒ 逐条 unknown + 整体 undetermined + 章没盖。

    打的是 `completion_verification._default_judge_call`(校验入口在调用时才查这个
    模块全局),不是路由里那个同名函数 —— 把入口本身换成 None 只会测到"函数没了",
    测不到"判不了怎么办"。
    """
    from app.services import completion_verification as cv

    async def broken(messages: list[dict[str, str]]) -> Any:
        raise RuntimeError("judge down")

    monkeypatch.setattr(cv, "_default_judge_call", broken)

    payload = {
        "criteria": criteria("semantic"),
        "evidence": [
            {
                "id": "ev-s1",
                "criterion_id": "semantic",
                "source": "run-digest",
                "excerpt": "改了 x.ts,没跑测试",
            }
        ],
        "executor_claim": "已完成",
    }
    async with await _client() as client:
        body = (await client.post("/api/agent/goal-verify", json=payload)).json()
    assert body["status"] == "undetermined"
    assert body["treat_as_complete"] is False
    assert body["criteria"][0]["verdict"] == "unknown"
    assert body["undetermined_count"] == 1
    assert body["independent_request_made"] is True


@pytest.mark.asyncio
async def test_judge_unavailable_still_counts_as_a_failed_round(
    store: RecordingStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    """"判不了"必须计入连击 —— 否则一个恒坏的 judge 能让 goal 永远续跑。"""
    from app.services import completion_verification as cv

    async def broken(messages: list[dict[str, str]]) -> Any:
        raise RuntimeError("judge down")

    monkeypatch.setattr(cv, "_default_judge_call", broken)
    session = f"s-broken-judge-{next(SESSIONS)}"
    payload = {
        "criteria": criteria("semantic"),
        "evidence": [
            {"id": "e1", "criterion_id": "semantic", "source": "run-digest", "excerpt": "x"}
        ],
        "session_id": session,
    }
    async with await _client() as client:
        last: dict[str, Any] = {}
        for _ in range(GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES):
            last = (await client.post("/api/agent/goal-verify", json=payload)).json()
    assert last["status"] == "blocked"
    assert last["should_pause"] is True
    assert last["consecutive_failures"] == GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES


@pytest.mark.asyncio
async def test_stateless_call_never_touches_the_ledger(store: RecordingStore) -> None:
    """不带 session_id 的既有调用方(含 apps/cli)必须完全不碰账本。"""
    payload = {"criteria": criteria("a"), "evidence": [machine_evidence("a", met=True)]}
    async with await _client() as client:
        body = (await client.post("/api/agent/goal-verify", json=payload)).json()
    assert body["stateful"] is False
    assert body["treat_as_complete"] is True
    assert (store.reads, store.writes, store.clears) == (0, 0, 0)


# ==================== ③ 无进展达阈值 → 暂停,且下一轮不再受理 ====================


@pytest.mark.asyncio
async def test_no_progress_streak_triggers_pause(store: RecordingStore) -> None:
    """同一批指标反复不过,到阈值那一轮 should_pause/escalate 必须为真。"""
    session = f"s-pause-{next(SESSIONS)}"
    payload = {
        "criteria": criteria("tsc", "tests"),
        "evidence": [machine_evidence("tsc", met=True), machine_evidence("tests", met=False)],
        "session_id": session,
    }
    seen: list[dict[str, Any]] = []
    async with await _client() as client:
        for _ in range(GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES):
            seen.append((await client.post("/api/agent/goal-verify", json=payload)).json())
    first, last = seen[0], seen[-1]
    assert first["consecutive_failures"] == 1 and first["should_pause"] is False
    assert last["consecutive_failures"] == GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES
    assert last["should_pause"] is True and last["escalate"] is True
    assert last["pause_reason"] == "no_progress"
    assert last["treat_as_complete"] is False
    assert last["rounds"] == GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES
    # 账必须真的落在 store 里(不是只写在响应里)
    assert store.states[session].blocked is True


@pytest.mark.asyncio
async def test_blocked_ledger_refuses_to_judge_again(store: RecordingStore) -> None:
    """收口之后再来问:不再重算、不再判通过 —— 这是"触发暂停"而不是"再产出一段文本"。"""
    session = f"s-blocked-{next(SESSIONS)}"
    payload = {
        "criteria": criteria("tsc"),
        "evidence": [machine_evidence("tsc", met=False)],
        "session_id": session,
    }
    async with await _client() as client:
        for _ in range(GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES):
            await client.post("/api/agent/goal-verify", json=payload)
        writes_before = store.writes
        # 这一次即便交上"全过"的证据,也不该被受理(收口后不许自己解锁)
        passing = {
            "criteria": criteria("tsc"),
            "evidence": [machine_evidence("tsc", met=True)],
            "session_id": session,
        }
        body = (await client.post("/api/agent/goal-verify", json=passing)).json()
    assert body["status"] == "blocked"
    assert body["treat_as_complete"] is False
    assert body["should_pause"] is True
    assert body["criteria"] == []
    assert store.writes == writes_before, "收口短路不得再写账"


@pytest.mark.asyncio
async def test_reset_is_the_only_way_back_and_it_needs_identity(store: RecordingStore) -> None:
    """清账是 blocked 之后唯一继续路径,且它必须认身份。"""
    session = f"s-reset-{next(SESSIONS)}"
    payload = {
        "criteria": criteria("tsc"),
        "evidence": [machine_evidence("tsc", met=False)],
        "session_id": session,
    }
    async with await _client() as client:
        for _ in range(GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES):
            await client.post("/api/agent/goal-verify", json=payload)
        blocked = (await client.post("/api/agent/goal-verify", json=payload)).json()
        assert blocked["should_pause"] is True
        res = await client.post("/api/agent/goal-verify/reset", json={"session_id": session})
        assert res.status_code == 200, res.text
        assert res.json()["cleared"] is True
        after = (await client.post("/api/agent/goal-verify", json=payload)).json()
    assert after["status"] == "not_achieved"
    assert after["consecutive_failures"] == 1, "清账后从第一轮重新起算,而不是接着 blocked"


@pytest.mark.asyncio
async def test_goal_state_endpoint_reads_the_ledger(store: RecordingStore) -> None:
    """上报面:GET /api/agent/goal-state 返回账本原文与暂停结论。"""
    session = f"s-read-{next(SESSIONS)}"
    payload = {
        "criteria": criteria("tsc"),
        "evidence": [machine_evidence("tsc", met=False)],
        "session_id": session,
        "tokens_this_round": 120,
        "token_budget": 1000,
    }
    async with await _client() as client:
        await client.post("/api/agent/goal-verify", json=payload)
        res = await client.get("/api/agent/goal-state", params={"session_id": session})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["found"] is True
    assert body["state"]["rounds"] == 1
    assert body["state"]["tokens_spent"] == 120
    assert body["state"]["token_budget"] == 1000
    assert body["should_pause"] is False


# ==================== ④ 认证 ≠ 授权 ====================


@pytest.mark.asyncio
async def test_self_reported_owner_mismatch_is_rejected_without_any_query(
    store: RecordingStore,
) -> None:
    """请求体自报别人的 user_id ⇒ 403,且**未发出任何一次存储读取**。"""
    payload = {
        "criteria": criteria("a"),
        "evidence": [machine_evidence("a", met=True)],
        "session_id": f"s-owner-{next(SESSIONS)}",
        "owner_user_id": "victim-uuid",
    }
    async with await _client("attacker-uuid") as client:
        res = await client.post("/api/agent/goal-verify", json=payload)
    assert res.status_code == 403
    assert (store.reads, store.writes) == (0, 0), "属主判定必须先于任何存储查询"


@pytest.mark.asyncio
async def test_second_owner_cannot_read_or_write_another_sessions_ledger(
    store: RecordingStore,
) -> None:
    """账本已有属主 ⇒ 别人的请求 403,不写账、不回存量内容。"""
    session = f"s-taken-{next(SESSIONS)}"
    payload = {
        "criteria": criteria("a"),
        "evidence": [machine_evidence("a", met=False)],
        "session_id": session,
    }
    async with await _client("user-a") as client:
        first = (await client.post("/api/agent/goal-verify", json=payload)).json()
    assert first["rounds"] == 1
    writes_before = store.writes
    async with await _client("user-b") as client:
        res = await client.post("/api/agent/goal-verify", json=payload)
        assert res.status_code == 403
        # 越权者拿不到别人的账本内容:存量结论(轮次/逐条原因)一律不出现在响应里
        assert "rounds" not in res.json()
        assert "指标 a 必须成立" not in res.text
        state_res = await client.get("/api/agent/goal-state", params={"session_id": session})
        assert state_res.status_code == 403
        assert state_res.json().get("state") in (None, {})
        reset_res = await client.post("/api/agent/goal-verify/reset", json={"session_id": session})
        assert reset_res.status_code == 403
    assert store.writes == writes_before, "越权请求不得改动他人账本"
    assert store.states[session].consecutive_failures == 1


@pytest.mark.asyncio
async def test_stateful_call_without_identity_is_401_when_auth_enforced(
    store: RecordingStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    """生产态(真在做 JWT 校验)带会话却不带身份 ⇒ 401,不记账。"""
    from app.core.config import settings

    monkeypatch.setattr(settings, "node_env", "production")
    payload = {
        "criteria": criteria("a"),
        "evidence": [machine_evidence("a", met=True)],
        "session_id": f"s-anon-{next(SESSIONS)}",
    }
    async with await _client(None) as client:
        res = await client.post("/api/agent/goal-verify", json=payload)
    assert res.status_code == 401
    assert (store.reads, store.writes) == (0, 0)


@pytest.mark.asyncio
async def test_reset_needs_identity_when_auth_is_enforced(
    store: RecordingStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    """清账端点走 `require_request_user_id`:生产态没有主体即 401,且不清账。"""
    from app.core.config import settings

    monkeypatch.setattr(settings, "node_env", "production")
    async with await _client(None) as client:
        res = await client.post("/api/agent/goal-verify/reset", json={"session_id": "s-x"})
    assert res.status_code == 401
    assert store.clears == 0


@pytest.mark.asyncio
async def test_reset_in_dev_fallback_clears_and_reports_which_principal(
    store: RecordingStore,
) -> None:
    """开发降级态(本进程根本没启用 JWT 校验)允许清账,但属主是 DEV 单一租户。

    这一条不是"放宽"的豁免,而是把 `require_request_user_id` 的既有降级语义如实钉住:
    测试环境 jwt_secret 被 autouse 夹具清空 ⇒ 主体 = dev-anonymous。写这条是为了
    防止有人把它读成"清账不要身份"—— 上一条(production 档 401)才是安全结论。
    """
    session = f"s-dev-reset-{next(SESSIONS)}"
    store.states[session] = GoalRoundState(
        session_id=session,
        owner_user_id="dev-anonymous",
        rounds=3,
        consecutive_failures=3,
        stagnation=2,
        last_unmet=("tsc",),
        last_status="blocked",
        blocked=True,
        blocked_reason="no_progress",
        tokens_spent=None,
        token_budget=None,
        updated_at=1.0,
    )
    async with await _client(None) as client:
        res = await client.post("/api/agent/goal-verify/reset", json={"session_id": session})
        assert res.status_code == 200
        assert res.json()["cleared"] is True
    assert session not in store.states
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
