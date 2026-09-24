# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""队列:容量上限、按项目轮转公平性、僵尸态回收。每条关键断言注明它防的失效模式。"""
from __future__ import annotations

import itertools

import pytest

from app.services.sandbox.models import (
    ALLOWED_TRANSITIONS,
    IllegalTransitionError,
    SandboxSession,
    SandboxSpec,
    SandboxStatus,
)
from app.services.sandbox.queue import (
    DuplicateSessionError,
    SandboxQueue,
    SessionNotTrackedError,
)


class FakeClock:
    def __init__(self, now: float = 0.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now

    def advance(self, delta: float) -> None:
        self.now += delta


def make_spec(project_id: str = "p1", timeout: float = 10.0) -> SandboxSpec:
    return SandboxSpec(
        image="python:3.12-slim",
        project_id=project_id,
        command=("python", "-c", "print(1)"),
        timeout_seconds=timeout,
    )


def make_session(session_id: str, *, queued_at: float = 0.0, project_id: str = "p1") -> SandboxSession:
    return SandboxSession(session_id=session_id, spec=make_spec(project_id), queued_at=queued_at)


ALL_STATUSES: tuple[SandboxStatus, ...] = tuple(SandboxStatus)


def test_transition_table_is_exhaustive_over_enum() -> None:
    # 防"新增枚举状态忘了登记迁移表" —— 缺键会在运行时 KeyError,而不是在这里被点名
    assert set(ALLOWED_TRANSITIONS) == set(ALL_STATUSES)


@pytest.mark.parametrize("source", ALL_STATUSES)
def test_illegal_transitions_are_all_rejected(source: SandboxStatus) -> None:
    # 防"任何状态可跳任何状态":7×7 全对照,合法集之外的每一格都必须抛
    for target in ALL_STATUSES:
        if target in ALLOWED_TRANSITIONS[source]:
            continue
        session = make_session("s")
        session.status = source  # 直填前置态:本例测的正是"从该态出发的迁移必须被拒"
        with pytest.raises(IllegalTransitionError):
            session.transition(target, now=1.0)


def test_capacity_full_queues_instead_of_dropping() -> None:
    # 反向对照:防"队列满即静默丢任务" —— 提交 3 个、容量 1,必须 1 起跑 2 等待,且 3 个全部被跟踪
    queue = SandboxQueue(max_parallel=1)
    sessions = [make_session(f"t{i}") for i in range(3)]
    for session in sessions:
        queue.submit(session)

    admitted_ids: list[str] = []
    moment = 0.0
    for _ in range(3):
        batch = queue.schedule(now=moment)
        assert len(batch) == 1, "容量 1 时每轮只能准入 1 个"
        admitted_ids.append(batch[0].session_id)
        queue.mark_running(batch[0], now=moment)
        queue.complete(batch[0], status=SandboxStatus.FINISHED, exit_code=0, now=moment)
        moment += 1.0

    assert admitted_ids == ["t0", "t1", "t2"]
    assert queue.pending_count() == 0
    assert len(queue.tracked_sessions()) == 3, "防任务在排队期蒸发"


def test_round_robin_prevents_project_starvation() -> None:
    # 反向对照:防 FIFO 头阻塞 —— p_big 先提交 5 条也不能把 p_small 饿死
    queue = SandboxQueue(max_parallel=1)
    big = [make_session(f"big{i}", project_id="p_big") for i in range(5)]
    small = [make_session("small0", project_id="p_small")]
    for session in itertools.chain(big, small):
        queue.submit(session)

    admitted: list[str] = []
    moment = 0.0
    for _ in range(6):
        batch = queue.schedule(now=moment)
        assert len(batch) == 1, "容量 1 时每轮只能准入 1 个"
        admitted.append(batch[0].session_id)
        queue.mark_running(batch[0], now=moment)
        queue.complete(batch[0], status=SandboxStatus.FINISHED, exit_code=0, now=moment)
        moment += 1.0

    assert admitted[0] == "big0"
    assert admitted[1] == "small0", "公平性:p_small 必须在 big 的第 2 条之前被服务"
    assert admitted.count("small0") == 1


def test_zombie_reap_frees_slot_and_reschedules() -> None:
    # 反向对照:防"卡死会话永久占位" —— 回收前一次 schedule 必须拿不到槽位
    clock = FakeClock(0.0)
    queue = SandboxQueue(max_parallel=1, clock=clock, max_attempts=2, auto_retry_on_reap=True)
    session = make_session("z")
    queue.submit(session)
    assert queue.schedule(now=clock.now) == [session]
    queue.mark_running(session, now=clock.now)

    clock.advance(9.0)
    assert queue.reap(now=clock.now) == [], "未到截止时间不得误杀在跑的会话"
    assert queue.schedule(now=clock.now) == [], "槽位未释放前不得放新任务进来"

    clock.advance(2.0)  # 累计 11s > timeout 10s
    reaped = queue.reap(now=clock.now)
    assert [s.session_id for s in reaped] == ["z"]
    assert session.status is SandboxStatus.REAPED
    assert session.error is not None and "僵尸" in session.error

    successors = queue.schedule(now=clock.now)
    assert [s.session_id for s in successors] == ["z:a2"], "回收后必须可被重新调度"
    assert successors[0].attempt == 2


def test_completed_session_is_never_reaped() -> None:
    # 反向对照:防回收器把已完成会话改写成 REAPED(状态机会抛,但更要紧的是别误伤统计)
    queue = SandboxQueue(max_parallel=1)
    session = make_session("ok")
    queue.submit(session)
    queue.schedule(now=0.0)
    queue.mark_running(session, now=0.0)
    queue.complete(session, status=SandboxStatus.FINISHED, exit_code=0, now=1.0)
    assert queue.reap(now=9999.0) == []
    assert session.status is SandboxStatus.FINISHED


def test_timeout_holds_slot_until_reaped() -> None:
    # 防"超时即放槽位" —— 容器可能还在跑,并发上限会被击穿
    queue = SandboxQueue(max_parallel=1)
    session = make_session("slow")
    queue.submit(session)
    queue.schedule(now=0.0)
    queue.mark_running(session, now=0.0)
    queue.complete(session, status=SandboxStatus.TIMEOUT, now=1.0)
    assert session.status is SandboxStatus.TIMEOUT
    assert queue.schedule(now=1.0) == []
    assert [s.session_id for s in queue.reap(now=1.0)] == ["slow"]
    assert queue.pending_count() == 0 and queue.capacity == 1


def test_duplicate_submit_is_rejected() -> None:
    queue = SandboxQueue(max_parallel=2)
    queue.submit(make_session("dup"))
    with pytest.raises(DuplicateSessionError):
        queue.submit(make_session("dup"))


def test_submit_rejects_non_queued_session() -> None:
    session = make_session("started")
    session.transition(SandboxStatus.STARTING, now=0.0)
    with pytest.raises(IllegalTransitionError):
        SandboxQueue().submit(session)


def test_complete_rejects_foreign_session_and_bad_status() -> None:
    queue = SandboxQueue(max_parallel=1)
    stranger = make_session("stranger")
    with pytest.raises(SessionNotTrackedError):
        queue.complete(stranger, status=SandboxStatus.FINISHED, now=0.0)
    queue.submit(make_session("a"))
    admitted = queue.schedule(now=0.0)
    with pytest.raises(ValueError):
        queue.complete(admitted[0], status=SandboxStatus.QUEUED, now=0.0)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
