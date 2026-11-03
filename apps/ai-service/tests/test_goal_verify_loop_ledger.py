# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-

"""goal 自评估账本的持久性与装车用例(V3 #77 验收判据 ⑤ + 装车证明)。

⑤"重启后轮次与预算仍在"是这一票唯一无法靠"响应里有这个字段"来交差的一条:
账本落不住,§8 第 4 步的收口就永远不成立。所以这里刻意**不**用真库(§5 测试隔离
铁律),而是把既有的 checkpoint 出口换成一个同形状的替身 sink,再靠"换一个 store
实例(= 换进程)L1 全空"来造出重启。

判据要点:
- 复用 checkpoint 出口 ⇒ 断言的是**它真的调了那个出口的哪两个方法、用什么键、
  什么 status**。替身如果允许任意形状,sink 断言就退化成自说自话,所以键前缀与
  终态档都被逐字钉住(那是"不污染别人可续跑 checkpoint"的唯一保证)。
- 读不出来时**不得**当成"没有账":把 unreadable 折成 0 轮,等于每次存储故障都
  给目标发一张从头再来的凭据。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.routers import goal_verification
from app.services.goal_round_state import (
    SESSION_KEY_PREFIX,
    STATE_METADATA_KEY,
    CheckpointGoalRoundStore,
    GoalRoundState,
    InProcessGoalRoundStore,
    advance_round_state,
    configure_durable_store,
    decide_pause,
    get_memory_store,
    get_store,
    normalize_outcome,
    parse_state_payload,
    reset_store,
    state_from_checkpoint_metadata,
)

# 复用同族用例的 app/client 助手(仓内既有做法,见 test_engine_harness_wiring_36.py)
from tests.test_goal_verify_loop import _client

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]


class FakeCheckpoint:
    """`AgentLoopCheckpoint` 的最小形状(本层只读 metadata/checkpoint_id)。"""

    def __init__(self, checkpoint_id: str, session_id: str, metadata: dict[str, Any]) -> None:
        self.checkpoint_id = checkpoint_id
        self.session_id = session_id
        self.metadata = metadata


class RecordingSink:
    """替身 checkpoint 出口:只实现被用到的两个方法,并留下完整调用现场。"""

    def __init__(self) -> None:
        self.rows: dict[str, FakeCheckpoint] = {}  # session_key -> row
        self.calls: list[dict[str, Any]] = []
        self.saves = 0
        self.loads = 0

    async def load_latest_by_session(self, session_id: str) -> FakeCheckpoint | None:
        self.loads += 1
        return self.rows.get(session_id)

    async def save_checkpoint(
        self,
        session_id: str,
        iteration: int,
        messages: list[dict[str, Any]],
        tool_state: dict[str, Any],
        status: str = "running",
        metadata: dict[str, Any] | None = None,
        owner_user_id: str | None = None,
    ) -> str:
        self.saves += 1
        self.calls.append(
            {
                "session_id": session_id,
                "iteration": iteration,
                "messages": messages,
                "status": status,
                "metadata": metadata or {},
                "owner_user_id": owner_user_id,
            }
        )
        cid = f"ckpt-{self.saves}"
        self.rows[session_id] = FakeCheckpoint(cid, session_id, dict(metadata or {}))
        return cid

    async def delete_checkpoint(self, checkpoint_id: str) -> bool:
        """真实 manager 有这个出口(清账要用),替身必须一并实现 ——
        否则 `clear()` 走的是"没有删除出口"那条分支,用例就会把"没清成"读成"清好了"。"""
        for key, row in list(self.rows.items()):
            if row.checkpoint_id == checkpoint_id:
                del self.rows[key]
                return True
        return False


def _state(session: str = "s-1", **over: Any) -> GoalRoundState:
    base: dict[str, Any] = {
        "session_id": session,
        "owner_user_id": "user-a",
        "rounds": 2,
        "consecutive_failures": 2,
        "stagnation": 1,
        "last_unmet": ("tsc",),
        "last_status": "not_achieved",
        "blocked": False,
        "blocked_reason": "",
        "tokens_spent": 340,
        "token_budget": 1000,
        "updated_at": 1234.0,
    }
    base.update(over)
    return GoalRoundState(**base)


# ==================== ⑤ 重启后轮次与预算仍在 ====================


@pytest.mark.asyncio
async def test_rounds_and_budget_survive_a_process_restart() -> None:
    """换 store 实例(L1 全空)= 模拟重启;账必须从 sink 里读回来。"""
    sink = RecordingSink()
    first = CheckpointGoalRoundStore(sink)
    state = _state()
    await first.write(state)
    assert first.describe().durable is True

    restarted = CheckpointGoalRoundStore(sink)  # 新进程:内存里什么都没有
    read = await restarted.read("s-1")
    assert read.found is True and read.state is not None
    assert read.state.rounds == 2
    assert read.state.tokens_spent == 340
    assert read.state.token_budget == 1000
    assert read.state.consecutive_failures == 2
    # 读回来之后还要能接着往下记(而不是"读到但不能续")
    continued = advance_round_state(
        session_id="s-1",
        owner_user_id="user-a",
        outcome=normalize_outcome(status="not_achieved", unmet=["tsc"], tokens_this_round=100),
        previous=read.state,
        max_consecutive_failures=3,
    )
    assert (continued.rounds, continued.consecutive_failures) == (3, 3)
    assert continued.tokens_spent == 440
    assert continued.blocked is True


@pytest.mark.asyncio
async def test_ledger_writes_are_namespaced_and_terminal_so_resume_is_untouched() -> None:
    """写出去的必须带 `goal-round:` 前缀且 status 是终态 —— 否则会顶掉别人的续跑点。"""
    sink = RecordingSink()
    store = CheckpointGoalRoundStore(sink)
    await store.write(_state())
    call = sink.calls[-1]
    assert call["session_id"] == f"{SESSION_KEY_PREFIX}s-1"
    assert call["status"] == "completed"
    assert call["messages"] == []
    assert call["owner_user_id"] == "user-a"
    assert STATE_METADATA_KEY in call["metadata"]
    # 真实会话键(不带前缀)在 sink 里必须一条都没有 —— 这是"不污染 resume"的正向证明
    assert (SESSION_KEY_PREFIX + "s-1") in sink.rows
    assert "s-1" not in sink.rows


@pytest.mark.asyncio
async def test_payload_is_json_serialisable_round_trip() -> None:
    """账本要能进 jsonb:过一遍真 JSON 往返再解析,形状漂了必须判"读不出"。"""
    sink = RecordingSink()
    store = CheckpointGoalRoundStore(sink)
    await store.write(_state())
    raw = json.dumps(sink.calls[-1]["metadata"], ensure_ascii=False)
    revived = state_from_checkpoint_metadata(json.loads(raw), session_id="s-1")
    assert revived.found is True and revived.state is not None
    assert revived.state == _state()


@pytest.mark.asyncio
async def test_corrupt_ledger_is_unreadable_not_zero() -> None:
    """载荷不认识 ⇒ unreadable=True 且 found=False。绝不得静默当成"这活儿才第一轮"。"""
    sink = RecordingSink()
    sink.rows[f"{SESSION_KEY_PREFIX}s-1"] = FakeCheckpoint(
        "c1", f"{SESSION_KEY_PREFIX}s-1", {STATE_METADATA_KEY: {"v": 1, "rounds": "many"}}
    )
    store = CheckpointGoalRoundStore(sink)
    read = await store.read("s-1")
    assert read.unreadable is True
    assert read.found is False and read.state is None
    # 暂停判据:不因未知而停(那会把一次 redis 抖动放大成全站罢工),但必须报人
    pause = decide_pause(read.state, ledger_unreadable=read.unreadable)
    assert pause.pausing is False
    assert pause.escalate is True
    assert pause.reason == "ledger_unreadable"


@pytest.mark.asyncio
async def test_ledger_for_a_different_session_is_not_adopted() -> None:
    """载荷里的会话与键不符 ⇒ 判读不出(那是跨会话串账,不是"没账")。"""
    sink = RecordingSink()
    key = f"{SESSION_KEY_PREFIX}s-1"
    sink.rows[key] = FakeCheckpoint("c1", key, {STATE_METADATA_KEY: _state("someone-else").to_payload()})
    read = await CheckpointGoalRoundStore(sink).read("s-1")
    assert read.unreadable is True and read.found is False


@pytest.mark.asyncio
async def test_clear_removes_the_persisted_row() -> None:
    sink = RecordingSink()
    store = CheckpointGoalRoundStore(sink)
    await store.write(_state())
    assert await store.clear("s-1") is True
    assert f"{SESSION_KEY_PREFIX}s-1" not in sink.rows
    assert (await store.read("s-1")).found is False


# ==================== 纯函数口径:无进展 vs 连续未过 ====================


def test_identical_unmet_set_reports_no_progress_while_changing_set_does_not() -> None:
    maxn = 3
    prev = advance_round_state(
        session_id="s",
        owner_user_id=None,
        outcome=normalize_outcome(status="not_achieved", unmet=["a", "b"]),
        previous=None,
        max_consecutive_failures=maxn,
    )
    assert prev.blocked is False and prev.stagnation == 0
    same = advance_round_state(
        session_id="s",
        owner_user_id=None,
        outcome=normalize_outcome(status="not_achieved", unmet=["a", "b"]),
        previous=prev,
        max_consecutive_failures=maxn,
    )
    third = advance_round_state(
        session_id="s",
        owner_user_id=None,
        outcome=normalize_outcome(status="not_achieved", unmet=["a", "b"]),
        previous=same,
        max_consecutive_failures=maxn,
    )
    assert third.blocked is True
    assert third.blocked_reason == "no_progress"

    # 每轮少一条未达标 = 有进展 ⇒ 只能按"连续未过"收口,不得报成无进展
    p1 = advance_round_state(
        session_id="p",
        owner_user_id=None,
        outcome=normalize_outcome(status="not_achieved", unmet=["a", "b", "c"]),
        previous=None,
        max_consecutive_failures=maxn,
    )
    p2 = advance_round_state(
        session_id="p",
        owner_user_id=None,
        outcome=normalize_outcome(status="not_achieved", unmet=["a", "b"]),
        previous=p1,
        max_consecutive_failures=maxn,
    )
    p3 = advance_round_state(
        session_id="p",
        owner_user_id=None,
        outcome=normalize_outcome(status="not_achieved", unmet=["a"]),
        previous=p2,
        max_consecutive_failures=maxn,
    )
    assert p3.blocked is True and p3.stagnation == 0
    assert p3.blocked_reason == "consecutive_failures"


def test_achieved_clears_both_counters_and_stops_blocked_from_lingering() -> None:
    prev = advance_round_state(
        session_id="s",
        owner_user_id=None,
        outcome=normalize_outcome(status="not_achieved", unmet=["a"]),
        previous=None,
        max_consecutive_failures=1,
    )
    assert prev.blocked is True
    after = advance_round_state(
        session_id="s",
        owner_user_id=None,
        outcome=normalize_outcome(status="achieved", unmet=[]),
        previous=prev,
        max_consecutive_failures=1,
    )
    assert (after.consecutive_failures, after.stagnation, after.blocked) == (0, 0, False)
    assert after.last_status == "achieved"


def test_blocked_is_never_an_input_status_a_caller_can_self_declare() -> None:
    """调用方自称 blocked ⇒ 拒收(收口权不在被考核者手里)。"""
    with pytest.raises(ValueError):
        normalize_outcome(status="blocked", unmet=[])
    with pytest.raises(ValueError):
        normalize_outcome(status="not_achieved", unmet=["a"], token_budget=0)


def test_parse_state_payload_rejects_unknown_version() -> None:
    assert parse_state_payload({"v": 99}) is None
    assert parse_state_payload(_state().to_payload()) == _state()


# ==================== 装车证明:机制必须真被装上、真被读 ====================


def test_app_startup_installs_the_durable_ledger() -> None:
    """`app/main.py` 必须真的装载持久档 —— 否则账本机制永远停在内存,等于没做。"""
    src = (AI_SERVICE_ROOT / "app" / "main.py").read_text(encoding="utf-8")
    assert "configure_durable_store(" in src, "跨轮账本没在启动链里装载 = 造好没装车"
    assert "get_agent_checkpoint_manager()" in src, "持久层没复用既有 checkpoint 出口"
    # 装载点必须在 lifespan 内(挂在模块顶层会被 import 时机决定,含单测)
    at = src.find("async def lifespan")
    wired = src.find("configure_durable_store(")
    assert 0 < at < wired, "装载必须在 lifespan 里,不得在模块顶层"


def test_router_uses_the_same_ledger_exit_as_the_gate() -> None:
    """HTTP 入口与执行闸门必须共用同一份账本出口(两处各数一遍必然漂移)。"""
    router_src = (AI_SERVICE_ROOT / "app" / "routers" / "goal_verification.py").read_text(
        encoding="utf-8"
    )
    gate_src = (AI_SERVICE_ROOT / "app" / "services" / "goal_completion_gate.py").read_text(
        encoding="utf-8"
    )
    ledger_src = (AI_SERVICE_ROOT / "app" / "services" / "goal_round_state.py").read_text(
        encoding="utf-8"
    )
    assert "from ..services.goal_round_state import" in router_src
    assert "from .goal_round_state import" in gate_src
    for source in (router_src, gate_src):
        assert "advance_round_state" in source or "_record_round" in source
    # 阈值只有一个真源:账本模块自己不得写死 3(写死即第二份真相,tunables 一改就漂)
    assert "GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES" not in ledger_src
    for source in (router_src, gate_src):
        assert "from app.core.tunables import" in source or "from ..core.tunables import" in source


def test_stream_route_still_consumes_the_gate_decision() -> None:
    """闸门结论的既有消费者(done 帧)不得因为本票改动而断线。"""
    src = (AI_SERVICE_ROOT / "app" / "routers" / "agents.py").read_text(encoding="utf-8")
    assert "await gate_goal_completion(" in src
    assert '"verification": verification_payload' in src
    assert "frame_success = False" in src


@pytest.mark.asyncio
async def test_gate_records_the_round_and_reports_ledger_storage() -> None:
    """执行闸门那一条链也必须落同一本账,并把落在哪一层如实报出来。"""
    from app.services import goal_completion_gate as gate

    sink = RecordingSink()
    configure_durable_store(sink)
    try:
        session = "gate-ledger-session"
        for expected_round in (1, 2):
            # probe_command 非空 ⇒ 这条走机器判定,根本不碰 judge(用例必须离线,
            # 否则默认 judge 会去调 llm_gateway —— 那是带网络与凭据的)。
            decision = await gate.gate_goal_completion(
                session_id=session,
                specs=[
                    gate.GoalCriterionSpec(
                        id="tsc",
                        statement="tsc 退出码必须为 0",
                        evidence_kind="command",
                        probe_command="pnpm typecheck",
                    )
                ],
                iterations=[
                    type(
                        "It",
                        (),
                        {
                            "iteration": 1,
                            "tool_results": [
                                type(
                                    "TR",
                                    (),
                                    {
                                        "name": "run_command",
                                        "result": {
                                            "command": "pnpm typecheck",
                                            "exit_code": 1,
                                            "stdout": "2 errors",
                                        },
                                        "error": None,
                                    },
                                )()
                            ],
                        },
                    )()
                ],
                loop_success=True,
                loop_stop_reason="completed",
            )
            assert decision.allowed_complete is False
            assert decision.payload is not None
            assert decision.payload["rounds"] == expected_round
            assert decision.payload["ledger_storage"] == "checkpoint"
            assert decision.round_state is not None
            assert decision.round_state.consecutive_failures == expected_round
    finally:
        reset_store()
    # 换进程视角:闸门那条链写的账,HTTP 那条链读得到同一份
    read = await get_store().read(session)
    assert read.found is True and read.state is not None
    assert read.state.rounds == 2


@pytest.mark.asyncio
async def test_default_store_is_memory_and_reports_itself_as_such() -> None:
    """缺省档必须如实报"落不住"(durable=False),不得用名字冒充持久。"""
    reset_store()
    store = get_store()
    receipt = store.describe()
    assert receipt.storage == "memory"
    assert receipt.durable is False
    assert store is get_memory_store() or isinstance(store, InProcessGoalRoundStore)


@pytest.mark.asyncio
async def test_http_door_and_gate_door_share_one_ledger() -> None:
    """两条链(HTTP 校验入口 / 执行闸门)必须记在同一本账上。

    这是"两本账"唯一的可见证明:同一 session 先由 HTTP 记一轮、再由闸门记一轮,
    `rounds` 必须走到 2、连击必须累计到 2。各记一本的话两边都会停在 1,
    而两边**各自看起来都完全正常** —— 这正是 §8 收口永不触发的形状。
    """
    from app.services import goal_completion_gate as gate

    reset_store()
    sink = RecordingSink()
    configure_durable_store(sink)
    session = "two-doors-session"
    try:
        async with await _client("user-a") as client:
            res = await client.post(
                "/api/agent/goal-verify",
                json={
                    "criteria": [
                        {"id": "tsc", "statement": "tsc 退出码为 0", "evidence_kind": "command"}
                    ],
                    "evidence": [
                        {
                            "id": "ev1",
                            "criterion_id": "tsc",
                            "source": "run_command:pnpm typecheck",
                            "outcome": "unmet",
                            "excerpt": "exit_code=1",
                        }
                    ],
                    "session_id": session,
                },
            )
            assert res.status_code == 200, res.text
            assert res.json()["rounds"] == 1
        decision = await gate.gate_goal_completion(
            session_id=session,
            specs=[
                gate.GoalCriterionSpec(
                    id="tsc",
                    statement="tsc 退出码必须为 0",
                    evidence_kind="command",
                    probe_command="pnpm typecheck",
                )
            ],
            iterations=[
                type(
                    "It",
                    (),
                    {
                        "iteration": 1,
                        "tool_results": [
                            type(
                                "TR",
                                (),
                                {
                                    "name": "run_command",
                                    "result": {
                                        "command": "pnpm typecheck",
                                        "exit_code": 1,
                                        "stdout": "1 error",
                                    },
                                    "error": None,
                                },
                            )()
                        ],
                    },
                )()
            ],
            loop_success=True,
            loop_stop_reason="completed",
        )
        assert decision.payload is not None
        assert decision.payload["rounds"] == 2
        assert decision.payload["consecutive_failures"] == 2
        read = await get_store().read(session)
        assert read.state is not None and read.state.rounds == 2
    finally:
        reset_store()


def test_both_doors_resolve_the_same_store_accessor() -> None:
    """两条链用的是**同一个** accessor(同一函数对象),不是各自另立一份登记表。"""
    from app.services import goal_completion_gate as gate

    assert goal_verification.get_store is gate.get_store
    assert get_store() is get_store()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
