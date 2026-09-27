# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #84(26h 级耐久任务底座)回归测试。

覆盖任务书四件,逐件一对正反例:

  ① **跨实例重启续跑轮次递增**(`TestResumePointSelection` / `TestWiring`):
     冷读到的候选集必须按"轮次优先、同轮取更晚心跳"选,且后一次续跑点比前一次严格靠后。
     **刻意不断 checkpoint_id 相等** —— id 是身份不是顺序,拿它当判据就是拿结论当判据。
  ② **不重跑已完成工具**(`TestToolLedger`):把"已完成 / 待执行"两集量出来,并给出
     eager 与边界两份检查点的**差额即重跑**这一条阳性对照。
  ③ **僵尸判定阈值正反例**(`TestTakeover`):底层对账说要归位,不等于可以接管 ——
     阈值不大于单轮执行上界时必须拒;以及"本仓无跨实例租约"这条未判定要现形。
  ④ **属主(认证 ≠ 授权)**(`TestOwnership`):越权路径断言的是**未发出查询**,
     不是只断 403;并锁住"请求体里没有可自报的身份字段"这一结构前提。

另有一件是票面第 3 条的自证:`TestNoNewTable` 锁住本票**只用既有 checkpoint 出口**、
不含任何 DDL —— "不新增表"不能只写在报告里。

测试隔离(AGENTS.md §5 铁律):零生产存储。见 `_forbid_production_storage`。
"""

from __future__ import annotations

import inspect
import json
from typing import Any

import pytest

from app.services import agent_checkpoint as ckpt_mod
from app.services import agent_run_control as run_control
from app.services import durable_resume as dr
from app.services.agent_checkpoint import AgentLoopCheckpoint
from app.services.run_ownership import clear_all as clear_ownership

USER_A = "user-a-durable84"
USER_B = "user-b-durable84"
SESSION = "sess-durable-84"
T0 = 1_800_000_000.0  # 固定基准时刻:所有用例都显式喂 now,不让断言跟着真实时钟漂


# ---------------------------------------------------------------------------
# 夹具:零生产存储 + 独占进程内登记表
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _forbid_production_storage(monkeypatch: pytest.MonkeyPatch) -> None:
    """AGENTS.md §5:不得连生产 PG(8810)/ Redis(8811)。

    与 `test_pause_resume_65.py` 同一套:PG 一侧真拦(建池即抛),psycopg 可用性打桩
    关掉 checkpoint 的持久层 ⇒ 本文件所有 manager 都是显式注入的内存替身。
    """

    def _no_asyncpg_pool(*args: object, **kwargs: object) -> None:
        raise AssertionError("durable_resume 用例不得创建 asyncpg 连接池(生产库禁连)")

    monkeypatch.setattr("asyncpg.create_pool", _no_asyncpg_pool)
    monkeypatch.setattr(ckpt_mod, "_PSYCOPG_AVAILABLE", False)


@pytest.fixture(autouse=True)
def _isolate_registries() -> None:
    """控制面/属主表都是进程内单例,前后各清一次(残留会让"零查询"断言失去意义)。"""
    run_control.clear_all()
    clear_ownership()
    yield
    run_control.clear_all()
    clear_ownership()


# ---------------------------------------------------------------------------
# 构造件
# ---------------------------------------------------------------------------


def assistant_round(*call_ids: str) -> list[dict[str, Any]]:
    """一条 assistant 消息 + 若干工具结果(缺尾的结果表示"发起了但没回来")。"""
    return [
        {
            "role": "assistant",
            "content": "查一下",
            "tool_calls": [
                {"id": cid, "name": "get_weather", "args": {"city": cid}} for cid in call_ids
            ],
        }
    ]


def tool_results(*call_ids: str) -> list[dict[str, Any]]:
    return [
        {"role": "tool", "tool_call_id": cid, "name": "get_weather", "content": "{}"}
        for cid in call_ids
    ]


def cp(
    cid: str,
    *,
    iteration: int,
    created_at: float,
    status: str = "paused",
    messages: list[dict[str, Any]] | None = None,
    metadata: dict[str, Any] | None = None,
    ttl: float = ckpt_mod.DEFAULT_CHECKPOINT_TTL,
    session_id: str = SESSION,
) -> AgentLoopCheckpoint:
    return AgentLoopCheckpoint(
        checkpoint_id=cid,
        session_id=session_id,
        iteration=iteration,
        messages=messages if messages is not None else assistant_round() + tool_results(),
        tool_state={},
        status=status,
        created_at=created_at,
        expires_at=created_at + ttl,
        metadata=dict(metadata or {}),
    )


def cold_copy(rows: list[AgentLoopCheckpoint]) -> list[AgentLoopCheckpoint]:
    """模拟"换进程后冷读持久层":走持久层实际使用的那一条反序列化路径。

    `_row_to_agent_checkpoint` 做的事就是 `from_dict(dict(payload))`,而 payload 是
    `save_checkpoint` 写出去的 `to_dict()` JSON —— 这里逐字复现那次往返。
    注:PG 层的 `ORDER BY created_at DESC` 未被覆盖(禁连生产库,AGENTS §5),
    所以本文件把选取规则本身钉成纯函数判据,SQL 侧只负责取集。
    """
    return [AgentLoopCheckpoint.from_dict(json.loads(json.dumps(r.to_dict()))) for r in rows]


def durable(
    cid: str,
    *,
    iteration: int,
    created_at: float,
    launched_at: float = T0,
    horizon: float | str = dr.DURABLE_TASK_HORIZON_SECONDS,
    ttl: float = ckpt_mod.DEFAULT_CHECKPOINT_TTL,
    **kw: Any,
) -> AgentLoopCheckpoint:
    meta: dict[str, Any] = {
        dr.DURABLE_HORIZON_METADATA_KEY: horizon,
        dr.DURABLE_LAUNCHED_AT_METADATA_KEY: launched_at,
        "owner_user_id": kw.pop("owner", USER_A),
    }
    return cp(cid, iteration=iteration, created_at=created_at, metadata=meta, ttl=ttl, **kw)


class FakeSaver:
    """只实现 `save_checkpoint` 的替身:本票的续期不许碰到第二个存储出口。

    刻意**只**实现这一个方法 —— 代码里若多调一个 manager 出口,AttributeError 会让
    续期判成 `failed`,用例当场红,而不是悄悄通过。
    """

    def __init__(self, log: list[str] | None = None) -> None:
        self.saved: list[dict[str, Any]] = []
        self._log = log

    async def save_checkpoint(
        self,
        session_id: str,
        iteration: int,
        messages: list[dict[str, Any]],
        tool_state: dict[str, Any],
        status: str = "running",
        metadata: dict[str, Any] | None = None,
        file_snapshots: list[dict[str, Any]] | None = None,
        owner_user_id: str | None = None,
    ) -> str:
        self.saved.append(
            {
                "session_id": session_id,
                "iteration": iteration,
                "messages": messages,
                "tool_state": tool_state,
                "status": status,
                "metadata": metadata,
                "owner_user_id": owner_user_id,
            }
        )
        if self._log is not None:
            self._log.append("renewal")
        return f"renewed-{len(self.saved)}"


@pytest.fixture(autouse=True)
def _stub_singleton_manager(monkeypatch: pytest.MonkeyPatch) -> FakeSaver:
    """把 `get_agent_checkpoint_manager` 单例换成纯内存替身。

    不是为了省事 —— 是为了**可断言**:未声明耐久的行不该去解析单例,而真实单例一旦
    被解析就会去 ping 配置的 redis(conftest 钉的是不可达端口,2s 连接超时)。
    个别用例自己再 monkeypatch 成别的替身来验"有没有被叫到"。
    """
    saver = FakeSaver()
    monkeypatch.setattr(ckpt_mod, "get_agent_checkpoint_manager", lambda: saver)
    return saver


class _FakeLoop:
    """占位的可暂停 loop:只为把一条 in-flight 记录塞进控制面。"""

    async def pause(self) -> str | None:  # pragma: no cover - 本文件不触发真正暂停
        return None


# ---------------------------------------------------------------------------
# ① 续跑点选取:轮次优先,同轮取更晚心跳
# ---------------------------------------------------------------------------


class TestResumePointSelection:
    def test_cold_read_after_restart_picks_latest_round(self) -> None:
        """换进程后从最新检查点续跑,且轮次严格递增(不是从头再跑)。"""
        rounds = [
            cp(f"c{i}", iteration=i, created_at=T0 + i * 10, status="running")
            for i in (1, 2, 3)
        ]
        # 逐轮"续跑"时看到的候选集(冷读),轮次必须一格一格往前推进
        picks: list[AgentLoopCheckpoint] = []
        for n in range(1, len(rounds) + 1):
            point = dr.select_resume_point(cold_copy(rounds[:n]), now=T0 + 100)
            assert point.checkpoint is not None
            assert point.ok is True
            picks.append(point.checkpoint)
            assert point.start_iteration == point.checkpoint.iteration + 1
        assert [p.iteration for p in picks] == [1, 2, 3]
        for prev, nxt in zip(picks, picks[1:], strict=False):
            assert dr.rounds_advance_ok(prev, nxt)

    def test_same_round_boundary_wins_over_eager(self) -> None:
        """一次暂停落两份:同 iteration 时必须取更晚心跳那一份(边界)。

        eager 是 `pause()` 用"此刻的 messages"立刻存的,边界是 loop 在轮次边界停下时
        存的(带这一轮完整的工具结果)。取错那份 = 重跑这一轮的工具调用。
        """
        eager = cp(
            "eager",
            iteration=3,
            created_at=T0,
            messages=assistant_round("call_a") + tool_results("call_a"),
        )
        boundary = cp(
            "boundary",
            iteration=3,
            created_at=T0 + 0.4,
            messages=assistant_round("call_a", "call_b") + tool_results("call_a", "call_b"),
        )
        point = dr.select_resume_point(cold_copy([eager, boundary]), now=T0 + 10)
        # 冷读会得到新实例,所以按**行身份**(checkpoint_id)对,而不是对象同一性 ——
        # 但"取对了哪一轮"这件事永远按 iteration 判,不按 id 判(见下面那条反例锁)。
        assert point.checkpoint is not None
        assert point.checkpoint.checkpoint_id == "boundary"
        assert point.ambiguous is False
        assert point.start_iteration == 4
        assert point.checkpoint.messages == boundary.messages

        # 反着喂候选(存储返回顺序不该影响结论)
        again = dr.select_resume_point(cold_copy([boundary, eager]), now=T0 + 10)
        assert again.checkpoint is not None
        assert again.checkpoint.checkpoint_id == "boundary"

    def test_selection_is_not_locked_to_checkpoint_id(self) -> None:
        """判据必须认"更靠后的那一轮",而不是"我以为的那个 id"。"""
        older_id_larger_iteration = cp("a-older-id", iteration=5, created_at=T0)
        newer_id_stale_round = cp("z-fresh-id", iteration=2, created_at=T0 + 5)
        point = dr.select_resume_point(
            [newer_id_stale_round, older_id_larger_iteration], now=T0 + 100
        )
        assert point.checkpoint is older_id_larger_iteration
        assert point.start_iteration == 6

    def test_ambiguous_tie_is_flagged_not_silently_resolved(self) -> None:
        """同轮同心跳两份 ⇒ 取哪一份不再由规则决定,必须喊"歧义"。"""
        first = cp("a", iteration=4, created_at=T0)
        second = cp("b", iteration=4, created_at=T0)
        point = dr.select_resume_point([first, second], now=T0 + 1)
        assert point.ambiguous is True
        assert point.ok is False
        assert point.checkpoint is first  # 按 id 字典序:可复现,但不是"判过了"
        assert "tie_broken_by_heartbeat" in point.reason

    def test_expired_and_completed_are_excluded_with_reasons(self) -> None:
        expired = cp("e", iteration=9, created_at=T0, ttl=1)
        completed = cp("d", iteration=8, created_at=T0 + 5, status="completed")
        alive = cp("f", iteration=7, created_at=T0 + 6, status="paused")
        point = dr.select_resume_point([expired, completed, alive], now=T0 + 100)
        assert point.checkpoint is alive
        reasons = dict(point.excluded)
        assert reasons == {"e": dr.EXCLUDE_REASON_EXPIRED, "d": dr.EXCLUDE_REASON_COMPLETED}

    def test_empty_candidate_set_reports_no_resumable_instead_of_guessing(self) -> None:
        point = dr.select_resume_point([], now=T0)
        assert point.checkpoint is None
        assert point.start_iteration is None
        assert point.reason == "no_resumable_candidate"


# ---------------------------------------------------------------------------
# ② 工具账:已完成 vs 待执行
# ---------------------------------------------------------------------------


class TestToolLedger:
    def test_completed_and_pending_are_disjoint(self) -> None:
        messages = assistant_round("call_a", "call_b") + tool_results("call_a")
        ledger = dr.tool_ledger(messages)
        assert ledger.completed == frozenset({"call_a"})
        assert ledger.pending == frozenset({"call_b"})
        assert not (ledger.completed & ledger.pending)

    def test_picking_eager_loses_a_completed_call_that_would_rerun(self) -> None:
        """阳性对照:选错那一份的**后果**量得出来 —— 差的那个 id 就是会被重跑的。"""
        eager = assistant_round("call_a") + tool_results("call_a")
        boundary = assistant_round("call_a", "call_b") + tool_results("call_a", "call_b")
        e_lean = dr.tool_ledger(eager)
        b_lean = dr.tool_ledger(boundary)
        assert e_lean.completed < b_lean.completed
        assert b_lean.completed - e_lean.completed == frozenset({"call_b"})

    def test_non_message_history_is_tolerated_not_crashed(self) -> None:
        ledger = dr.tool_ledger(
            [None, "string", {"role": "assistant"}, {"role": "assistant", "tool_calls": None},
             {"role": "tool"}, {"role": "tool", "tool_call_id": 42}]
        )
        assert ledger.total == 0

    @pytest.mark.asyncio
    async def test_renewal_keeps_the_ledger_and_the_round_identical(self) -> None:
        """续期重落一行:轮次不变、消息不变 ⇒ 工具账不变(续期不得变成重跑的入口)。"""
        row = durable("r1", iteration=6, created_at=T0 + 3600)
        saver = FakeSaver()
        out = await dr.renew_resume_point(row, manager=saver, now=T0 + 24 * 3600)
        assert out.outcome == dr.OUTCOME_RENEWED
        assert out.changed is True
        assert saver.saved[0]["iteration"] == 6
        assert saver.saved[0]["messages"] == row.messages
        assert saver.saved[0]["status"] == row.status
        assert saver.saved[0]["owner_user_id"] == USER_A
        meta = saver.saved[0]["metadata"]
        assert meta[dr.RENEWED_FROM_METADATA_KEY] == "r1"
        assert meta[dr.RENEWAL_COUNT_METADATA_KEY] == 1
        assert dr.tool_ledger(saver.saved[0]["messages"]) == dr.tool_ledger(row.messages)


# ---------------------------------------------------------------------------
# ③ 心跳与死判定:什么算僵尸、多久可被安全接管
# ---------------------------------------------------------------------------


class TestTakeover:
    def test_fresh_running_is_not_a_zombie_even_without_alive_evidence(self) -> None:
        row = cp("r", iteration=1, created_at=T0, status="running")
        v = dr.evaluate_takeover(row, now=T0 + 60, alive=None, stale_after_seconds=900)
        assert v.safe_to_take_over is False
        assert v.decision.reason == "running_within_stale_window"

    def test_stalled_running_beyond_threshold_is_takeoverable(self) -> None:
        row = cp("r", iteration=1, created_at=T0, status="running")
        v = dr.evaluate_takeover(row, now=T0 + 901, alive=None, stale_after_seconds=900)
        assert v.safe_to_take_over is True
        assert v.decision.reason == "running_without_alive_evidence"
        assert v.decision.to_status == ckpt_mod.CHECKPOINT_STATUS_PAUSED

    def test_owner_alive_blocks_takeover(self) -> None:
        row = cp("r", iteration=1, created_at=T0, status="running")
        v = dr.evaluate_takeover(row, now=T0 + 10_000, alive=True, stale_after_seconds=900)
        assert v.safe_to_take_over is False
        assert v.decision.reason == "owner_alive"

    def test_terminal_rows_are_never_rewritten(self) -> None:
        for status in ("completed", "failed", "cancelled"):
            row = cp(f"t-{status}", iteration=2, created_at=T0, status=status)
            v = dr.evaluate_takeover(row, now=T0 + 10_000, alive=False, stale_after_seconds=900)
            assert v.safe_to_take_over is False, status
            assert v.decision.to_status is None, status

    def test_paused_is_a_resume_point_not_a_zombie(self) -> None:
        row = cp("p", iteration=3, created_at=T0, status="paused")
        v = dr.evaluate_takeover(row, now=T0 + 10_000, alive=None, stale_after_seconds=900)
        assert v.safe_to_take_over is False
        assert v.decision.reason == "status_not_reconcilable"

    def test_expired_row_is_not_a_takeover_subject(self) -> None:
        row = cp("x", iteration=3, created_at=T0, status="running", ttl=10)
        v = dr.evaluate_takeover(row, now=T0 + 10_000, alive=None, stale_after_seconds=900)
        assert v.safe_to_take_over is False
        assert v.decision.reason == "ttl_expired"

    def test_threshold_not_above_round_bound_blocks_takeover(self) -> None:
        """阈值不大于单轮上界 ⇒ 底层说要归位,本票仍不许接管(长工具轮被误判成僵尸)。"""
        row = cp("r", iteration=1, created_at=T0, status="running")
        v = dr.evaluate_takeover(
            row, now=T0 + 120, alive=None, stale_after_seconds=60, max_round_seconds=300
        )
        assert v.decision.action == ckpt_mod.RECONCILE_ACTION_MARK_STALE
        assert v.blocked_by_round_bound is True
        assert v.safe_to_take_over is False
        # 同一份行,把阈值抬到单轮上界之上(且心跳确实超过抬后的阈值)才放行
        ok = dr.evaluate_takeover(
            row,
            now=T0 + ckpt_mod.CHECKPOINT_STALE_AFTER_SECONDS + 1,
            alive=None,
            stale_after_seconds=ckpt_mod.CHECKPOINT_STALE_AFTER_SECONDS,
            max_round_seconds=300,
        )
        assert ok.decision.action == ckpt_mod.RECONCILE_ACTION_MARK_STALE
        assert ok.blocked_by_round_bound is False
        assert ok.safe_to_take_over is True

    def test_missing_cross_instance_lease_is_reported_not_hidden(self) -> None:
        row = cp("r", iteration=1, created_at=T0, status="running")
        blind = dr.evaluate_takeover(row, now=T0 + 10_000, alive=None, stale_after_seconds=900)
        assert blind.undetermined is not None
        assert "跨实例租约" in blind.undetermined
        known = dr.evaluate_takeover(row, now=T0 + 10_000, alive=False, stale_after_seconds=900)
        assert known.undetermined is None
        assert known.decision.reason == "running_owner_dead"

    def test_threshold_default_reuses_the_single_source_reading(self) -> None:
        """不在此另读一遍环境变量:默认阈值必须等于 agent_checkpoint 那一份实现。"""
        row = cp("r", iteration=1, created_at=T0, status="running")
        v = dr.evaluate_takeover(row, now=T0 + 10)
        assert v.threshold_seconds == ckpt_mod._stale_threshold_seconds()


# ---------------------------------------------------------------------------
# ④ 属主:认证 ≠ 授权,越权路径零查询
# ---------------------------------------------------------------------------


class _Loader:
    def __init__(self, row: AgentLoopCheckpoint | None) -> None:
        self.row = row
        self.calls = 0

    async def __call__(self, session_id: str) -> AgentLoopCheckpoint:
        self.calls += 1
        if self.row is None:
            raise run_control.SessionNotFoundError(session_id)
        return self.row


class _Runner:
    def __init__(self, log: list[str] | None = None) -> None:
        self.calls = 0
        self._log = log

    async def __call__(
        self, checkpoint: AgentLoopCheckpoint, requester: str
    ) -> dict[str, object]:
        self.calls += 1
        if self._log is not None:
            self._log.append("runner")
        return {"stop_reason": "completed", "checkpoint_id": checkpoint.checkpoint_id}


class TestOwnership:
    @pytest.mark.asyncio
    async def test_in_process_record_forbidden_issues_no_query(self) -> None:
        await run_control.register_run(
            SESSION, owner_user_id=USER_A, loop=_FakeLoop()
        )
        loader, runner = _Loader(None), _Runner()
        out = await run_control.resume_session(
            SESSION, USER_B, load_latest=loader, runner=runner
        )
        assert out.outcome is run_control.ResumeOutcome.FORBIDDEN
        assert loader.calls == 0, "越权路径不得发出任何查询"
        assert runner.calls == 0

    @pytest.mark.asyncio
    async def test_cross_process_falls_back_to_persistent_owner(self) -> None:
        """进程重启后记录消失:唯一可追溯依据是检查点自带的持久属主。"""
        row = durable("r", iteration=2, created_at=T0, owner=USER_A)
        loader, runner = _Loader(row), _Runner()
        out = await run_control.resume_session(
            SESSION, USER_B, load_latest=loader, runner=runner
        )
        assert out.outcome is run_control.ResumeOutcome.FORBIDDEN
        assert loader.calls == 1  # 判属主必须读一次行,这一下是正当的
        assert runner.calls == 0, "判不成属主之前不得把循环起起来"

    @pytest.mark.asyncio
    async def test_owner_itself_resumes(self) -> None:
        row = durable("r", iteration=2, created_at=T0, owner=USER_A)
        loader, runner = _Loader(row), _Runner()
        out = await run_control.resume_session(
            SESSION, USER_A, load_latest=loader, runner=runner
        )
        assert out.outcome is run_control.ResumeOutcome.RESUMED
        assert runner.calls == 1

    @pytest.mark.asyncio
    async def test_row_without_owner_is_not_silently_trusted(self) -> None:
        """无持久属主 = 判不出,沿用既有"只剩必须登录这一层地板"的口径,不代裁成他人。"""
        row = cp("r", iteration=2, created_at=T0)
        loader, runner = _Loader(row), _Runner()
        out = await run_control.resume_session(
            SESSION, USER_B, load_latest=loader, runner=runner
        )
        assert out.outcome is run_control.ResumeOutcome.RESUMED
        assert runner.calls == 1  # 现口径:无属主时不判越权(登记为已知敞口,见报告)

    def test_service_signature_cannot_receive_self_reported_identity(self) -> None:
        """控制面的 requester 只能是位置参:结构上没有"从请求体带个 user_id 进来"的口。"""
        params = set(inspect.signature(run_control.resume_session).parameters)
        assert params == {"session_id", "requester", "load_latest", "runner"}
        for leaky in ("user_id", "uid", "owner_user_id"):
            assert leaky not in params

    def test_http_resume_body_has_no_identity_field(self) -> None:
        from app.routers.agents import AgentSessionResumeRequest

        assert set(AgentSessionResumeRequest.model_fields) == {
            "model",
            "max_iterations",
            "tools",
        }

    def test_route_passes_token_principal_not_body(self) -> None:
        source = inspect.getsource(run_control.resume_session)
        assert "requester" in source
        from app.routers import agents as agents_router

        route_src = agents_router.resume_agent_session.__code__.co_varnames
        assert "current_user" in route_src
        text = inspect.getsource(agents_router.resume_agent_session)
        assert "resume_session(session_id, current_user" in text


# ---------------------------------------------------------------------------
# 装车:两条 loader/续跑路径真的收口到了新规则
# ---------------------------------------------------------------------------


class _FakeMemoryManager:
    def __init__(self, rows: list[AgentLoopCheckpoint]) -> None:
        self._rows = rows
        self.list_calls = 0

    _use_redis = False
    _use_pg = False

    async def list_checkpoints(
        self, session_id: str | None = None
    ) -> list[AgentLoopCheckpoint]:
        self.list_calls += 1
        return [r for r in self._rows if session_id is None or r.session_id == session_id]

    async def load_latest_by_session(
        self, session_id: str
    ) -> AgentLoopCheckpoint | None:  # pragma: no cover - 内存命中即不到这里
        return None


class TestWiring:
    @pytest.mark.asyncio
    async def test_default_latest_loader_uses_the_single_selection_rule(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """`_default_load_latest` 不再自带一条 max(created_at),而是走同一份选取规则。

        这里造的是"更晚心跳但轮次更小"的形态:纯按 created_at 取会选错,
        按 (iteration, created_at) 取才对 —— 这条正是两处规则分叉时的裁判。
        """
        stale_round = cp("late-but-old-round", iteration=2, created_at=T0 + 50)
        best = cp("earlier-but-furthest", iteration=5, created_at=T0 + 10)
        fake = _FakeMemoryManager([stale_round, best])
        monkeypatch.setattr(
            ckpt_mod, "get_agent_checkpoint_manager", lambda: fake  # type: ignore[arg-type]
        )
        got = await run_control._default_load_latest(SESSION)
        assert got is best

    @pytest.mark.asyncio
    async def test_resume_renews_a_durable_resume_point(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """resume 前真的续了一次期(不是模块在、判据对、没人叫)。"""
        # 暂停在 hour 1 而该行 TTL 只有 1h ⇒ 恢复点撑不到 26h 预算终点(且此刻还没过期)
        row = durable("r", iteration=4, created_at=T0 + 3600, ttl=60 * 60)
        saver = FakeSaver()
        monkeypatch.setattr(
            ckpt_mod, "get_agent_checkpoint_manager", lambda: saver  # type: ignore[arg-type]
        )
        out = await dr.renew_resume_point_before_resume(row, now=T0 + 7199)
        assert out.outcome == dr.OUTCOME_RENEWED
        assert len(saver.saved) == 1

    @pytest.mark.asyncio
    async def test_resume_session_renews_before_starting_the_loop(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """装车证明:续跑路径上真的叫了续期,而且叫在起循环**之前**。

        顺序不是洁癖:续期若跑在 runner 之后,一次崩在续跑中间的 run 就又拿不到恢复点。
        """
        log: list[str] = []
        saver = FakeSaver(log)
        monkeypatch.setattr(ckpt_mod, "get_agent_checkpoint_manager", lambda: saver)
        # 暂停在 hour 1、该行 TTL 只有 1h ⇒ 恢复点撑不到 26h 预算终点
        row = durable("r", iteration=4, created_at=T0 + 3600, ttl=3600)
        out = await run_control.resume_session(
            SESSION,
            USER_A,
            load_latest=_Loader(row),
            runner=_Runner(log),
        )
        assert out.outcome is run_control.ResumeOutcome.RESUMED
        assert log == ["renewal", "runner"], log
        assert len(saver.saved) == 1
        assert saver.saved[0]["iteration"] == 4

    @pytest.mark.asyncio
    async def test_non_durable_resume_does_not_touch_the_manager(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """未声明耐久的普通续跑**连单例都不解析** —— 新行为不给全链路加副作用。"""

        def _boom() -> Any:
            raise AssertionError("非耐久检查点不得触发 checkpoint manager 单例解析")

        monkeypatch.setattr(ckpt_mod, "get_agent_checkpoint_manager", _boom)
        row = cp("r", iteration=1, created_at=T0)
        out = await dr.renew_resume_point_before_resume(row)
        assert out.outcome == dr.OUTCOME_NOT_DURABLE
        assert out.changed is False


# ---------------------------------------------------------------------------
# 26h ↔ 24h 的算术与开关
# ---------------------------------------------------------------------------


class TestRenewalArithmetic:
    def test_shortfall_is_measured_not_assumed(self) -> None:
        # 暂停在 hour 1、TTL 24h ⇒ 恢复点活到 hour 25,而预算终点是 hour 26 ⇒ 差 1h
        row = durable("r", iteration=2, created_at=T0 + 3600)
        v = dr.evaluate_renewal(row, now=T0 + 3600)
        assert v.needed is True
        assert v.shortfall_seconds == pytest.approx(3600)
        assert v.reason == "declared_horizon_outlives_checkpoint_ttl"

    def test_row_created_later_needs_no_renewal(self) -> None:
        # 暂停在 hour 2 ⇒ expires = hour 26 = 预算终点,差额 0 ⇒ 不续
        row = durable("r", iteration=2, created_at=T0 + 2 * 3600)
        v = dr.evaluate_renewal(row, now=T0 + 2 * 3600)
        assert v.needed is False
        assert v.reason == "resume_point_outlives_declared_horizon"

    @pytest.mark.asyncio
    async def test_expired_row_is_not_resurrected_by_renewal(self) -> None:
        """过期是策略判过的死刑:续期路径不许把它复活(正反两格只差一秒)。"""
        dead = durable("r", iteration=2, created_at=T0 + 3600, ttl=3600)
        v_dead = dr.evaluate_renewal(dead, now=T0 + 7200)
        assert v_dead.needed is False
        assert v_dead.reason == "resume_point_already_expired"
        saver = FakeSaver()
        out = await dr.renew_resume_point(dead, manager=saver, now=T0 + 7200)
        assert out.outcome == dr.OUTCOME_NOT_NEEDED
        assert saver.saved == []
        # 正例:同一行在过期前一秒 ⇒ 差额照算、照续
        v_alive = dr.evaluate_renewal(dead, now=T0 + 7199)
        assert v_alive.needed is True
        assert v_alive.shortfall_seconds == pytest.approx(93600 - 7200)

    def test_horizon_is_derived_from_the_declared_budget_not_a_constant(self) -> None:
        row = durable("r", iteration=1, created_at=T0 + 10, horizon=3600)
        v = dr.evaluate_renewal(row, now=T0 + 10)
        assert v.horizon_seconds == 3600
        # 1h 视野 + 24h TTL ⇒ 恢复点远比预算长寿,不需要动它
        assert v.needed is False

    def test_non_durable_row_is_left_alone(self) -> None:
        assert dr.durable_horizon_of(cp("r", iteration=1, created_at=T0)) is None

    @pytest.mark.parametrize("bad", ["abc", 0, -5, dr.DURABLE_HORIZON_MAX_SECONDS + 1])
    def test_unusable_declaration_is_named_not_defaulted(self, bad: object) -> None:
        row = durable("r", iteration=1, created_at=T0, horizon=bad)  # type: ignore[arg-type]
        v = dr.durable_horizon_of(row)
        assert v is not None
        assert v.needed is False
        assert v.reason != "resume_point_outlives_declared_horizon"

    @pytest.mark.asyncio
    async def test_switch_off_reports_the_shortfall_instead_of_hiding_it(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("IHUI_DURABLE_RESUME_RENEWAL", "0")
        row = durable("r", iteration=2, created_at=T0 + 3600)
        saver = FakeSaver()
        out = await dr.renew_resume_point(row, manager=saver, now=T0 + 24 * 3600)
        assert out.outcome == dr.OUTCOME_DISABLED
        assert out.changed is False
        assert saver.saved == []
        assert "3600" in out.detail

    @pytest.mark.asyncio
    async def test_renewal_uses_only_the_existing_save_export(self) -> None:
        """本票零 schema 变更:续期只调 `save_checkpoint`,不新增表/列/裸 SQL。"""
        src = inspect.getsource(dr)
        for banned in ("CREATE TABLE", "ALTER TABLE", ".execute(", "INSERT INTO", "import asyncpg"):
            assert banned not in src, banned

    @pytest.mark.asyncio
    async def test_failed_save_is_reported_as_failed_not_renewed(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        class Broken(FakeSaver):
            async def save_checkpoint(  # type: ignore[override]
                self, *args: object, **kwargs: object
            ) -> str:
                raise RuntimeError("存储没接住")

        row = durable("r", iteration=2, created_at=T0 + 3600)
        out = await dr.renew_resume_point(row, manager=Broken(), now=T0 + 24 * 3600)
        assert out.outcome == dr.OUTCOME_FAILED
        assert out.changed is False

    @pytest.mark.asyncio
    async def test_empty_id_from_save_is_not_counted_as_renewed(self) -> None:
        class Silent(FakeSaver):
            async def save_checkpoint(  # type: ignore[override]
                self, *args: object, **kwargs: object
            ) -> str:
                return ""

        row = durable("r", iteration=2, created_at=T0 + 3600)
        out = await dr.renew_resume_point(row, manager=Silent(), now=T0 + 24 * 3600)
        assert out.outcome == dr.OUTCOME_FAILED

    def test_horizon_constants_are_the_ticket_numbers(self) -> None:
        assert dr.DURABLE_TASK_HORIZON_SECONDS == 26 * 3600
        assert dr.MAX_ROUND_SECONDS == 300.0
        # 阈值(900s)确实大于单轮上界(300s):否则判据 3 那条闸在默认值上就白装
        assert ckpt_mod.CHECKPOINT_STALE_AFTER_SECONDS > dr.MAX_ROUND_SECONDS
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
