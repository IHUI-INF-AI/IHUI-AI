# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""跨项目并行看板:状态分桶穷举 + 分组聚合的确定性。"""
from __future__ import annotations

from app.services.sandbox.board import STATUS_BUCKET, BoardCounts, build_board
from app.services.sandbox.models import SandboxSession, SandboxSpec, SandboxStatus
from app.services.sandbox.queue import SandboxQueue


def make_session(
    session_id: str,
    status: SandboxStatus,
    *,
    project_id: str = "p1",
    queued_at: float = 0.0,
) -> SandboxSession:
    return SandboxSession(
        session_id=session_id,
        spec=SandboxSpec(
            image="python:3.12-slim",
            project_id=project_id,
            command=("true",),
        ),
        status=status,
        queued_at=queued_at,
    )


def test_bucket_table_covers_every_status() -> None:
    # 防"新增状态静默落进错误桶" —— KeyError 只在该状态真出现时才炸,这里提前炸
    assert set(STATUS_BUCKET) == set(SandboxStatus)


def test_starting_counts_as_active_not_queued() -> None:
    # 反向对照:STARTING 算进 queued 是看板最常见的 off-by-one(容器已起跑却显示"排队中")
    counts = BoardCounts.of([make_session("s", SandboxStatus.STARTING)])
    assert counts.active == 1
    assert counts.queued == 0
    assert counts.is_consistent


def test_all_buckets_partition_the_input() -> None:
    sessions = [make_session(f"s{i}", status) for i, status in enumerate(SandboxStatus)]
    counts = BoardCounts.of(sessions)
    assert (counts.active, counts.queued, counts.failed, counts.done) == (2, 1, 2, 2)
    assert counts.total == len(sessions)
    assert counts.is_consistent


def test_empty_input_does_not_crash() -> None:
    # 防看板首屏崩
    snapshot = build_board([])
    assert snapshot.projects == ()
    assert snapshot.totals == BoardCounts(active=0, queued=0, failed=0, done=0, total=0)


def test_grouping_is_deterministic_and_grouped_by_project() -> None:
    sessions = [
        make_session("b2", SandboxStatus.RUNNING, project_id="p_b", queued_at=5.0),
        make_session("a1", SandboxStatus.QUEUED, project_id="p_a", queued_at=1.0),
        make_session("b1", SandboxStatus.FINISHED, project_id="p_b", queued_at=1.0),
    ]
    snapshot = build_board(sessions)
    assert [p.project_id for p in snapshot.projects] == ["p_a", "p_b"]
    assert [s.session_id for s in snapshot.projects[1].sessions] == ["b1", "b2"]
    assert snapshot.project("p_b") is not None
    assert snapshot.project("nope") is None
    assert snapshot.totals.active == 1 and snapshot.totals.done == 1
    # 同一输入再算一次必须逐字相等(看板快照要能进对账)
    assert build_board(sessions) == snapshot


def test_board_reads_live_sessions_from_the_queue() -> None:
    # 防"看板读的是副本 ⇒ 状态永远不动"
    queue = SandboxQueue(max_parallel=1)
    for index in range(3):
        queue.submit(make_session(f"t{index}", SandboxStatus.QUEUED, project_id="p_x"))
    admitted = queue.schedule(now=0.0)
    board = build_board(queue.tracked_sessions())
    assert board.project("p_x") is not None
    assert (board.totals.active, board.totals.queued) == (1, 2)

    queue.mark_running(admitted[0], now=0.5)
    queue.complete(admitted[0], status=SandboxStatus.FAILED, exit_code=1, now=1.0)
    after = build_board(queue.tracked_sessions())
    assert (after.totals.failed, after.totals.queued, after.totals.active) == (1, 2, 0)
    assert after.totals.total == 3, "防已完成会话从看板上消失"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
