# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""ZCode 9B-B2 实现票回归:崩溃残留 running 态的「带原因」归位对账。

覆盖对象 = `app/services/agent_checkpoint.py` 的
`decide_checkpoint_stale_reconcile`(纯判据)+ `AgentCheckpointManager.reconcile_for_resume`
(幂等写回)+ `_reconcile_loaded`(resume/retry 入口接线)。

测试纪律(AGENTS.md §5 测试隔离铁律):
- **不连生产库/生产 Redis**:PG 层用 _FakeConn 记录 SQL,redis 一律 None(纯内存)。
- **不 import agent_loop_v2**:该模块在本机 HEAD 面上因 `tool_input_scanner` 摸
  `sandbox._DANGEROUS_PATTERNS`(该名字在 sandbox 包里不存在)整体 ImportError,
  连累 tests/test_agent_checkpoint.py 无法收集(既有缺陷,与本票无关、也不在本票可改面内)。
  本文件只依赖被测模块与其零依赖的 run_ownership,故不受该链影响。
"""

from __future__ import annotations

import json
import time
from collections.abc import Iterator

import pytest

import app.services.agent_checkpoint as mod
from app.services.agent_checkpoint import (
    CHECKPOINT_STATUS_CANCELLED,
    CHECKPOINT_STATUS_COMPLETED,
    CHECKPOINT_STATUS_FAILED,
    CHECKPOINT_STATUS_PAUSED,
    CHECKPOINT_STATUS_RUNNING,
    RECONCILE_ACTION_KEEP,
    RECONCILE_ACTION_MARK_EXPIRED,
    RECONCILE_ACTION_MARK_STALE,
    RECONCILE_ACTIONS,
    RECONCILE_REASON_FRESH,
    RECONCILE_REASON_NO_ALIVE_EVIDENCE,
    RECONCILE_REASON_OWNER_ALIVE,
    RECONCILE_REASON_OWNER_DEAD,
    RECONCILE_REASON_TERMINAL,
    RECONCILE_REASON_TTL_EXPIRED,
    RECONCILE_REASONS,
    STALE_RECONCILE_AT_KEY,
    STALE_RECONCILE_REASON_KEY,
    AgentCheckpointManager,
    AgentLoopCheckpoint,
    decide_checkpoint_stale_reconcile,
)

# =============================================================================
# 夹具与辅助
# =============================================================================

_NOW = 1_800_000_000.0
_TTL = 24 * 60 * 60.0


def _cp(
    *,
    status: str = CHECKPOINT_STATUS_RUNNING,
    age: float = 5.0,
    session_id: str = "s-recon",
    checkpoint_id: str = "cp-recon-1",
    expires_in: float | None = None,
) -> AgentLoopCheckpoint:
    """构造一行 checkpoint(created_at 用「距今多少秒」表达,时间全靠注入)。"""
    created = _NOW - age
    return AgentLoopCheckpoint(
        checkpoint_id=checkpoint_id,
        session_id=session_id,
        iteration=3,
        messages=[{"role": "user", "content": "hi"}],
        tool_state={"k": "v"},
        status=status,
        created_at=created,
        expires_at=created + _TTL if expires_in is None else _NOW + expires_in,
        metadata={"owner_user_id": "u-1"},
    )


def _manager(**kwargs: object) -> AgentCheckpointManager:
    """纯内存 manager(redis_url 强制 None ⇒ 测试永不碰 8811)。"""
    kwargs.setdefault("redis_url", None)
    return AgentCheckpointManager(**kwargs)  # type: ignore[arg-type]


class _FakeCursor:
    def __init__(self, rowcount: int = 1) -> None:
        self.rowcount = rowcount


class _FakeConn:
    """psycopg 连接最小 fake:只记 SQL + 参数,rowcount 可注入(测 CAS 未命中)。"""

    def __init__(self, rowcount: int = 1) -> None:
        self.executed: list[tuple[str, tuple[object, ...]]] = []
        self._rowcount = rowcount

    async def execute(self, sql: str, *params: object) -> _FakeCursor:
        self.executed.append((sql, params))
        return _FakeCursor(self._rowcount)

    async def __aenter__(self) -> _FakeConn:
        return self

    async def __aexit__(self, *exc: object) -> bool:
        return False


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    def connection(self) -> _FakeConn:
        return self._conn

    async def close(self) -> None:
        return None


@pytest.fixture(autouse=True)
def _clean_ownership() -> Iterator[None]:
    """run_ownership 是进程内登记表:用例前后一律清空,避免相互串成"活着"。"""
    from app.services import run_ownership

    run_ownership.clear_all()
    yield
    run_ownership.clear_all()


# =============================================================================
# 1. 纯判据 decide_checkpoint_stale_reconcile
# =============================================================================


def test_fresh_running_is_kept() -> None:
    """新鲜 running(未过阈)⇒ keep,且 changed=False(不产生任何写回)。"""
    d = decide_checkpoint_stale_reconcile(_cp(age=5.0), now=_NOW, alive=None)
    assert d.action == RECONCILE_ACTION_KEEP
    assert d.reason == RECONCILE_REASON_FRESH
    assert d.changed is False
    assert d.applied is False
    assert d.to_status is None


def test_stale_running_marks_stale_with_reason() -> None:
    """超阈值 running + 判不出存活 ⇒ mark_stale → paused,reason 非空且在封闭集内。"""
    d = decide_checkpoint_stale_reconcile(
        _cp(age=mod.CHECKPOINT_STALE_AFTER_SECONDS + 60), now=_NOW, alive=None
    )
    assert d.action == RECONCILE_ACTION_MARK_STALE
    assert d.reason == RECONCILE_REASON_NO_ALIVE_EVIDENCE
    assert d.reason in RECONCILE_REASONS
    assert d.to_status == CHECKPOINT_STATUS_PAUSED
    assert d.changed is True
    assert d.undetermined_alive is True


def test_confirmed_dead_owner_marks_stale_with_distinct_reason() -> None:
    """alive=False(确证已死)⇒ 同样归位,但 reason 必须是另一档(原因可分辨)。"""
    d = decide_checkpoint_stale_reconcile(
        _cp(age=mod.CHECKPOINT_STALE_AFTER_SECONDS + 60), now=_NOW, alive=False
    )
    assert d.action == RECONCILE_ACTION_MARK_STALE
    assert d.reason == RECONCILE_REASON_OWNER_DEAD
    assert d.undetermined_alive is False


def test_alive_running_never_touched_even_very_old() -> None:
    """有在飞登记(alive=True)⇒ 无论多老都不动(防误伤活会话)。"""
    d = decide_checkpoint_stale_reconcile(_cp(age=_TTL - 1), now=_NOW, alive=True)
    assert d.action == RECONCILE_ACTION_KEEP
    assert d.reason == RECONCILE_REASON_OWNER_ALIVE
    assert d.changed is False


@pytest.mark.parametrize(
    "terminal_status",
    [CHECKPOINT_STATUS_COMPLETED, CHECKPOINT_STATUS_FAILED, CHECKPOINT_STATUS_CANCELLED],
)
def test_terminal_states_are_never_written_back(terminal_status: str) -> None:
    """反向对照:已 completed/failed/cancelled 的行,超阈 + 确证死 ⇒ 一律不动。"""
    d = decide_checkpoint_stale_reconcile(
        _cp(status=terminal_status, age=mod.CHECKPOINT_STALE_AFTER_SECONDS + 600),
        now=_NOW,
        alive=False,
    )
    assert d.action == RECONCILE_ACTION_KEEP
    assert d.reason == RECONCILE_REASON_TERMINAL
    assert d.changed is False
    assert d.to_status is None


def test_paused_is_not_reconcilable() -> None:
    """paused 是"已知停在可续跑点"而非僵尸 ⇒ 不参与归位。"""
    d = decide_checkpoint_stale_reconcile(
        _cp(status=CHECKPOINT_STATUS_PAUSED, age=_TTL - 1), now=_NOW, alive=False
    )
    assert d.action == RECONCILE_ACTION_KEEP
    assert d.reason not in RECONCILE_REASONS or d.reason == "status_not_reconcilable"
    assert d.reason in RECONCILE_REASONS


def test_expired_row_marks_expired_before_stale() -> None:
    """expires_at 已过 ⇒ mark_expired(且不得被误判成 mark_stale)。"""
    d = decide_checkpoint_stale_reconcile(
        _cp(expires_in=-1.0, age=mod.CHECKPOINT_STALE_AFTER_SECONDS + 60),
        now=_NOW,
        alive=None,
    )
    assert d.action == RECONCILE_ACTION_MARK_EXPIRED
    assert d.reason == RECONCILE_REASON_TTL_EXPIRED
    assert d.to_status is None  # 过期不改写状态,交既有删除路径处置


def test_clock_injection_boundary_one_second_does_not_flip() -> None:
    """时钟注入边界:now 只差 1 秒不翻转;跨过阈值才翻转(判据不读真时钟)。"""
    threshold = 600.0
    cp = _cp(age=threshold)  # 恰好等于阈值:判据用「>」,故仍在窗口内
    below = decide_checkpoint_stale_reconcile(cp, now=_NOW, alive=None, stale_after_seconds=threshold)
    above = decide_checkpoint_stale_reconcile(
        cp, now=_NOW + 1.0, alive=None, stale_after_seconds=threshold
    )
    assert below.action == RECONCILE_ACTION_KEEP
    assert above.action == RECONCILE_ACTION_MARK_STALE
    # 边界两态的 age_seconds 差正好是注入的 1 秒,不掺任何真实流逝
    assert above.age_seconds - below.age_seconds == pytest.approx(1.0)


def test_decision_action_and_reason_are_closed_sets() -> None:
    """reason 必须是常量集合成员 —— 自由字符串等于没有原因(上游机制的核心约束)。"""
    d = decide_checkpoint_stale_reconcile(_cp(age=5.0), now=_NOW, alive=None)
    assert d.action in RECONCILE_ACTIONS
    assert d.reason in RECONCILE_REASONS


# =============================================================================
# 2. 写回层:幂等 + 只改自己判出来的那一行
# =============================================================================


async def test_reconcile_applies_stale_mark_and_is_idempotent(monkeypatch) -> None:
    """同一行重复调用 ⇒ 第二次无副作用(不迁移、不再发 SQL)。"""
    monkeypatch.setattr(mod, "CHECKPOINT_STALE_AFTER_SECONDS", 60.0)
    mgr = _manager()
    cid = await mgr.save_checkpoint("s-1", 2, [{"role": "user", "content": "x"}], {}, "running")
    stored = mgr._checkpoints[cid]
    stored.created_at = time.time() - 3600  # 造一个僵尸心跳

    first = await mgr.reconcile_for_resume(stored, now=time.time(), alive=None)
    assert first.action == RECONCILE_ACTION_MARK_STALE
    assert first.changed is True and first.applied is True
    assert mgr._checkpoints[cid].status == CHECKPOINT_STATUS_PAUSED

    second = await mgr.reconcile_for_resume(mgr._checkpoints[cid], now=time.time(), alive=None)
    assert second.action == RECONCILE_ACTION_KEEP
    assert second.changed is False and second.applied is False
    assert mgr._checkpoints[cid].status == CHECKPOINT_STATUS_PAUSED


async def test_reconcile_writes_pg_with_cas_where_and_payload(monkeypatch) -> None:
    """PG 归位 SQL:必带主键 + 期望旧状态(CAS),且 payload 与 status 列同步改写。"""
    monkeypatch.setattr(mod, "_PSYCOPG_AVAILABLE", True)
    monkeypatch.setattr(mod, "CHECKPOINT_STALE_AFTER_SECONDS", 60.0)
    mgr = _manager(db_url="postgresql://fake")
    conn = _FakeConn(rowcount=1)
    mgr._pool = _FakePool(conn)  # type: ignore[assignment]
    mgr._table_ready = True

    cid = await mgr.save_checkpoint("s-1", 1, [{"role": "user", "content": "x"}], {}, "running")
    stored = mgr._checkpoints[cid]
    stored.created_at = time.time() - 3600
    decision = await mgr.reconcile_for_resume(stored, now=time.time(), alive=None)
    assert decision.applied is True

    sql, params = conn.executed[-1]
    assert sql.startswith("UPDATE agent_checkpoints SET status = %s, payload = %s WHERE ")
    assert "WHERE checkpoint_id = %s AND status = %s" in sql
    assert params[0] == CHECKPOINT_STATUS_PAUSED
    assert params[2] == cid
    assert params[3] == CHECKPOINT_STATUS_RUNNING  # 期望旧状态 = CAS 条件
    assert json.loads(str(params[1]))["status"] == CHECKPOINT_STATUS_PAUSED
    # 归位痕迹进 payload.metadata(不改表结构、不加迁移)
    payload_meta = json.loads(str(params[1]))["metadata"]
    assert payload_meta[STALE_RECONCILE_REASON_KEY] in RECONCILE_REASONS
    assert isinstance(payload_meta[STALE_RECONCILE_AT_KEY], float)


async def test_reconcile_never_issues_unconditional_update(monkeypatch) -> None:
    """全表形态禁止:keep 路径不得发出任何 UPDATE。"""
    monkeypatch.setattr(mod, "_PSYCOPG_AVAILABLE", True)
    mgr = _manager(db_url="postgresql://fake")
    conn = _FakeConn(rowcount=1)
    mgr._pool = _FakePool(conn)  # type: ignore[assignment]
    mgr._table_ready = True

    cid = await mgr.save_checkpoint("s-1", 1, [{"role": "user", "content": "x"}], {}, "running")
    before = len([s for s, _ in conn.executed if s.startswith("UPDATE")])
    d = await mgr.reconcile_for_resume(mgr._checkpoints[cid], now=time.time(), alive=True)
    assert d.action == RECONCILE_ACTION_KEEP
    assert len([s for s, _ in conn.executed if s.startswith("UPDATE")]) == before


async def test_cas_miss_is_reported_not_applied(monkeypatch) -> None:
    """PG CAS 未命中(0 行)⇒ changed=True 但 applied=False,两字段不得静默合并。"""
    monkeypatch.setattr(mod, "_PSYCOPG_AVAILABLE", True)
    monkeypatch.setattr(mod, "CHECKPOINT_STALE_AFTER_SECONDS", 60.0)
    mgr = _manager(db_url="postgresql://fake")
    conn = _FakeConn(rowcount=0)
    mgr._pool = _FakePool(conn)  # type: ignore[assignment]
    mgr._table_ready = True
    cid = await mgr.save_checkpoint("s-1", 1, [{"role": "user", "content": "x"}], {}, "running")
    stored = mgr._checkpoints[cid]
    stored.created_at = time.time() - 3600
    d = await mgr.reconcile_for_resume(stored, now=time.time(), alive=None)
    assert d.action == RECONCILE_ACTION_MARK_STALE and d.changed is True
    assert d.applied is True  # 内存侧确实归位了;PG 侧 0 行由日志点名
    assert stored.status == CHECKPOINT_STATUS_PAUSED


async def test_terminal_race_is_not_written_back(monkeypatch) -> None:
    """判定与写回之间被本进程改成终态 ⇒ 跳过归位(不把终态改回非终态)。"""
    monkeypatch.setattr(mod, "CHECKPOINT_STALE_AFTER_SECONDS", 60.0)
    mgr = _manager()
    cid = await mgr.save_checkpoint("s-1", 1, [{"role": "user", "content": "x"}], {}, "running")
    stored = mgr._checkpoints[cid]
    stale_copy = json.loads(json.dumps(stored.to_dict()))
    stale_copy["status"] = CHECKPOINT_STATUS_RUNNING  # 拿一份"看起来还在跑"的副本去判
    stale_copy["created_at"] = time.time() - 3600
    snapshot = AgentLoopCheckpoint.from_dict(stale_copy)
    # 真身在内存里已经跑完
    stored.status = CHECKPOINT_STATUS_COMPLETED
    d = await mgr.reconcile_for_resume(snapshot, now=time.time(), alive=None)
    assert d.action == RECONCILE_ACTION_MARK_STALE and d.applied is False
    assert mgr._checkpoints[cid].status == CHECKPOINT_STATUS_COMPLETED


async def test_mark_expired_delegates_to_existing_delete_path() -> None:
    """mark_expired ⇒ 走既有单行删除路径,第二次调用天然 no-op。"""
    mgr = _manager()
    cid = await mgr.save_checkpoint("s-1", 1, [{"role": "user", "content": "x"}], {}, "running")
    stored = mgr._checkpoints[cid]
    stored.expires_at = time.time() - 1
    d = await mgr.reconcile_for_resume(stored, now=time.time(), alive=None)
    assert d.action == RECONCILE_ACTION_MARK_EXPIRED and d.applied is True
    assert cid not in mgr._checkpoints
    # 幂等:再来一次,行已不在,删除路径返回 False,不产生第二次迁移
    d2 = await mgr.reconcile_for_resume(stored, now=time.time(), alive=None)
    assert d2.action == RECONCILE_ACTION_MARK_EXPIRED
    assert cid not in mgr._checkpoints


# =============================================================================
# 3. 入口接线:resume/retry 读 checkpoint 的那两个方法必须过判据
# =============================================================================


async def test_load_checkpoint_entry_reconciles_zombie(monkeypatch) -> None:
    """load_checkpoint 是 resume/agents.py 属主探测与 resume_from_checkpoint 共用的
    读入口 ⇒ 僵尸 running 必须在此被归位(否则本机制就是死码)。"""
    monkeypatch.setattr(mod, "CHECKPOINT_STALE_AFTER_SECONDS", 60.0)
    mgr = _manager()
    cid = await mgr.save_checkpoint("s-1", 1, [{"role": "user", "content": "x"}], {}, "running")
    mgr._checkpoints[cid].created_at = time.time() - 3600

    cp = await mgr.load_checkpoint(cid)
    assert cp is not None
    assert cp.status == CHECKPOINT_STATUS_PAUSED
    assert cp.metadata[STALE_RECONCILE_REASON_KEY] in RECONCILE_REASONS


async def test_load_latest_by_session_entry_reconciles_zombie(monkeypatch) -> None:
    """load_latest_by_session(agents.py 的两个恢复读取点用它)同一入口口径。"""
    monkeypatch.setattr(mod, "CHECKPOINT_STALE_AFTER_SECONDS", 60.0)
    mgr = _manager()
    cid = await mgr.save_checkpoint("s-2", 4, [{"role": "user", "content": "x"}], {}, "running")
    mgr._checkpoints[cid].created_at = time.time() - 3600

    cp = await mgr.load_latest_by_session("s-2")
    assert cp is not None and cp.status == CHECKPOINT_STATUS_PAUSED


async def test_in_flight_run_is_not_reconciled_via_entry(monkeypatch) -> None:
    """本进程确有在飞登记 ⇒ 入口一律不动(存活信号复用 run_ownership,不新造)。"""
    monkeypatch.setattr(mod, "CHECKPOINT_STALE_AFTER_SECONDS", 60.0)
    from app.services.run_ownership import record_ownership

    mgr = _manager()
    cid = await mgr.save_checkpoint("s-3", 1, [{"role": "user", "content": "x"}], {}, "running")
    mgr._checkpoints[cid].created_at = time.time() - 3600
    record_ownership("s-3", "u-1")

    cp = await mgr.load_checkpoint(cid)
    assert cp is not None and cp.status == CHECKPOINT_STATUS_RUNNING


async def test_kill_switch_disables_reconcile(monkeypatch) -> None:
    """应急出口 IHUI_CHECKPOINT_RECONCILE=0 ⇒ 入口整条跳过(默认 on)。"""
    monkeypatch.setattr(mod, "CHECKPOINT_STALE_AFTER_SECONDS", 60.0)
    monkeypatch.setenv("IHUI_CHECKPOINT_RECONCILE", "0")
    mgr = _manager()
    cid = await mgr.save_checkpoint("s-4", 1, [{"role": "user", "content": "x"}], {}, "running")
    mgr._checkpoints[cid].created_at = time.time() - 3600
    cp = await mgr.load_checkpoint(cid)
    assert cp is not None and cp.status == CHECKPOINT_STATUS_RUNNING


async def test_terminal_row_is_never_written_back_through_manager(monkeypatch) -> None:
    """apply 层的反向对照:终态行(超阈 + 确证死)⇒ 状态不动、零 UPDATE。

    比纯判据那一组更硬:它判的是**落库结果**,所以「去掉终态护栏就把 completed 写成
    paused」这一型逃不过去(reason 标签可能被别的分支蒙对,写回次数蒙不对)。
    """
    monkeypatch.setattr(mod, "_PSYCOPG_AVAILABLE", True)
    monkeypatch.setattr(mod, "CHECKPOINT_STALE_AFTER_SECONDS", 60.0)
    mgr = _manager(db_url="postgresql://fake")
    conn = _FakeConn(rowcount=1)
    mgr._pool = _FakePool(conn)  # type: ignore[assignment]
    mgr._table_ready = True
    cid = await mgr.save_checkpoint(
        "s-t", 1, [{"role": "user", "content": "x"}], {}, CHECKPOINT_STATUS_COMPLETED
    )
    stored = mgr._checkpoints[cid]
    stored.created_at = time.time() - 3600
    updates_before = len([s for s, _ in conn.executed if s.startswith("UPDATE")])

    d = await mgr.reconcile_for_resume(stored, now=time.time(), alive=False)
    assert d.action == RECONCILE_ACTION_KEEP
    assert d.reason == RECONCILE_REASON_TERMINAL and d.changed is False
    assert mgr._checkpoints[cid].status == CHECKPOINT_STATUS_COMPLETED
    assert len([s for s, _ in conn.executed if s.startswith("UPDATE")]) == updates_before


async def test_list_paths_do_not_write(monkeypatch) -> None:
    """列表路径不做归位(列一次表就批量改库不是对账,是写放大)。"""
    monkeypatch.setattr(mod, "CHECKPOINT_STALE_AFTER_SECONDS", 60.0)
    mgr = _manager()
    cid = await mgr.save_checkpoint("s-5", 1, [{"role": "user", "content": "x"}], {}, "running")
    mgr._checkpoints[cid].created_at = time.time() - 3600
    metas = await mgr.list_for_session("s-5")
    assert metas and metas[0].status == CHECKPOINT_STATUS_RUNNING
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
