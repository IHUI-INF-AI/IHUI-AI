# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""b76-03 票1(G-998087):崩溃预算四件套的构造面验收。

四件套:窗口(CRASH_WINDOW_S=300s)+ 退避档数上限(1/2/4/8/16s 表尾封顶)
+ 耗尽终态(crash-loop-stopped,第 6 次判 exhausted 且不再重启)
+ 预算快照字段(crashCount / exhausted / restartsLeft / lastExitReason)。
防的是"无限重启把故障伪装成在恢复、且没人知道它已经放弃了"。
纯构造面,零 DB / 零 IO / 不真 sleep。
"""

from __future__ import annotations

import pytest

from app.services._load_lifecycle import (
    CRASH_BACKOFF_TABLE_S,
    CRASH_MAX_RESTARTS,
    CRASH_WINDOW_S,
    STATE_CRASH_LOOP_STOPPED,
    CrashBudget,
    CrashLoopStoppedError,
    raise_if_crash_loop_stopped,
)


def test_four_pieces_constants_are_single_sourced() -> None:
    """四件套的常量形状:窗口 5 分钟、5 档退避表、第 6 次耗尽、独立终态词。"""
    assert CRASH_WINDOW_S == 300.0
    assert CRASH_BACKOFF_TABLE_S == (1.0, 2.0, 4.0, 8.0, 16.0)
    assert CRASH_MAX_RESTARTS == 6
    # 独立终态:绝不复用既有词汇(failed / stopped / gave_up / 加载四态)
    assert STATE_CRASH_LOOP_STOPPED == "crash-loop-stopped"
    assert STATE_CRASH_LOOP_STOPPED not in (
        "failed",
        "stopped",
        "crashed",
        "loaded",
        "never_tried",
        "retry_backoff",
        "gave_up",
    )


def test_sixth_consecutive_crash_is_exhausted_and_never_restarts() -> None:
    """验收草案:6 次连续失败 ⇒ 第 6 次"不再重启 + 终态为耗尽态"。"""
    budget = CrashBudget()
    now = 1000.0
    decisions: list[tuple[str, float]] = []
    for i in range(6):
        decision, delay = budget.record_crash(now=now, exit_reason=f"exit-{i + 1}")
        decisions.append((decision, delay))
        now += delay + 0.01  # 跨过本次退避窗口再崩下一次,全部落在 5 分钟窗口内

    # 前 5 次:重启,退避按档表 1/2/4/8/16(到表尾封顶)
    assert [d for d, _ in decisions[:5]] == ["restart"] * 5
    assert [round(delay, 3) for _, delay in decisions[:5]] == [1.0, 2.0, 4.0, 8.0, 16.0]
    # 第 6 次:不再重启
    assert decisions[5] == ("exhausted", 0.0)

    snap = budget.snapshot(now=now)
    # 对外状态对象必须带 crashCount 与 exhausted 两个字段
    assert snap["crashCount"] == 6
    assert snap["exhausted"] is True
    # 终态为耗尽态,不等于 failed / 未开始 / 任何既有词汇
    assert snap["state"] == "crash-loop-stopped"
    assert snap["state"] != "failed"
    assert snap["state"] != "never_tried"
    # 最后一次退避窗口已过 ⇒ 剩余机会为 0
    assert snap["restartsLeft"] == 0

    # 之后无论过多久再崩:仍然 exhausted、不再重启、不再累计
    d, delay = budget.record_crash(now=now + 10_000.0, exit_reason="exit-7")
    assert d == "exhausted"
    assert delay == 0.0
    assert budget.snapshot(now=now + 10_000.0)["crashCount"] == 6


def test_crash_window_accumulates_within_5_minutes_and_resets_after() -> None:
    """窗口内累计;窗口外的崩溃把计数归零重开(隔离久远前的偶发)。"""
    budget = CrashBudget()
    now = 0.0
    for i in range(5):
        budget.record_crash(now=now, exit_reason=f"e{i}")
        now += 1.0  # 每次相隔 1s,全部累计在同一窗口
    assert budget.crash_count == 5
    assert budget.exhausted is False

    # 距窗口起点超过 CRASH_WINDOW_S ⇒ 归零重开,这次仍允许重启
    d, _ = budget.record_crash(now=CRASH_WINDOW_S + 1.0, exit_reason="late")
    assert d == "restart"
    assert budget.crash_count == 1


def test_snapshot_exposes_remaining_restarts_and_last_exit_reason() -> None:
    """可读出口:运维能用快照区分"还在退避"与"已停止自动重试"。"""
    budget = CrashBudget()
    d, _ = budget.record_crash(now=100.0, exit_reason="segfault")
    assert d == "restart"
    snap = budget.snapshot(now=100.0)
    assert snap["crashCount"] == 1
    assert snap["exhausted"] is False
    assert snap["restartsLeft"] == 5
    assert snap["lastExitReason"] == "segfault"
    assert snap["state"] is None  # 未耗尽,不冒充终态
    assert 0.0 < snap["windowRemainingS"] <= CRASH_WINDOW_S


def test_caller_raises_immediately_on_crash_loop_stopped() -> None:
    """调用方读到 crash-loop-stopped 终态立刻抛错上抛,并点名 lastExitReason。"""
    budget = CrashBudget()
    now = 0.0
    for i in range(6):
        budget.record_crash(now=now, exit_reason=f"exit-{i}")
        now += 20.0  # 每次都跨过退避、都在窗口内

    snap = budget.snapshot(now=now)
    with pytest.raises(CrashLoopStoppedError) as exc_info:
        raise_if_crash_loop_stopped(snap)
    assert "exit-5" in str(exc_info.value)
    assert "crash-loop-stopped" in str(exc_info.value)

    # 对照:未耗尽的快照不得抛
    raise_if_crash_loop_stopped(CrashBudget().snapshot(now=0.0))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
