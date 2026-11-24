# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core SSE 投递档位与 ack 背压 — Round 10（遵循统一工程规范）
import os
import re
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


from app.core.sse_delivery import (
    TIER_POLICIES,
    DeliveryFrame,
    DeliveryQueue,
    DeliveryTier,
    EnqueueOutcome,
    tier_for_event,
)

# ---------- 一、档位策略是数据不是命名 ----------


def test_three_tiers_have_distinct_policies():
    """三档的「能否丢 / 是否要 ack / 缓冲上限」必须两两不同构。"""
    n = TIER_POLICIES[DeliveryTier.NORMAL]
    i = TIER_POLICIES[DeliveryTier.INLINE]
    c = TIER_POLICIES[DeliveryTier.CRITICAL]
    assert n.droppable is True and n.requires_ack is False
    assert i.max_buffered == 0 and i.droppable is False
    assert c.droppable is False and c.requires_ack is True


def test_critical_never_droppable():
    """CRITICAL 在任何缓冲状态下都不得被丢（安全属性）。"""
    assert TIER_POLICIES[DeliveryTier.CRITICAL].droppable is False


# ---------- 二、入队结论三态 ----------


def test_normal_accepted_when_buffer_has_room():
    sent = []
    q = DeliveryQueue(flush=lambda f: sent.append(f) or True)
    out = q.enqueue(
        DeliveryFrame("f1", 1, "chunk", DeliveryTier.NORMAL, {"t": "x"})
    )
    assert out is EnqueueOutcome.ACCEPTED
    assert len(sent) == 1


def test_normal_dropped_when_buffer_full():
    """NORMAL 缓冲满 ⇒ DROPPED（不是失败，调用方不该重试）。"""
    q = DeliveryQueue(flush=lambda f: True)
    cap = TIER_POLICIES[DeliveryTier.NORMAL].max_buffered
    for i in range(cap):
        assert (
            q.enqueue(DeliveryFrame(f"n{i}", i, "chunk", DeliveryTier.NORMAL))
            is EnqueueOutcome.ACCEPTED
        )
    out = q.enqueue(DeliveryFrame("overflow", 9999, "chunk", DeliveryTier.NORMAL))
    assert out is EnqueueOutcome.DROPPED
    assert q.stats().get("dropped.buffer_full") == 1


def test_critical_rejected_when_buffer_full():
    """CRITICAL 缓冲满 ⇒ REJECTED（不得静默丢终态帧）。"""
    q = DeliveryQueue(flush=lambda f: True)
    cap = TIER_POLICIES[DeliveryTier.CRITICAL].max_buffered
    for i in range(cap):
        q.enqueue(DeliveryFrame(f"c{i}", i, "done", DeliveryTier.CRITICAL))
    out = q.enqueue(DeliveryFrame("overflow", 9999, "done", DeliveryTier.CRITICAL))
    assert out is EnqueueOutcome.REJECTED
    assert q.stats().get("rejected.buffer_full") == 1


def test_inline_not_buffered_and_flushed_immediately():
    """INLINE 不排队：max_buffered=0，每次都直接写。"""
    sent = []
    q = DeliveryQueue(flush=lambda f: sent.append(f) or True)
    for i in range(5):
        assert (
            q.enqueue(DeliveryFrame(f"i{i}", i, "tool-call-start", DeliveryTier.INLINE))
            is EnqueueOutcome.ACCEPTED
        )
    assert len(sent) == 5
    assert q.buffered_count() == 0


def test_flush_failure_is_rejected_not_accepted():
    """写出失败 ⇒ REJECTED，绝不报 ACCEPTED。"""
    q = DeliveryQueue(flush=lambda f: False)
    assert (
        q.enqueue(DeliveryFrame("f", 1, "chunk", DeliveryTier.NORMAL))
        is EnqueueOutcome.REJECTED
    )
    assert q.stats().get("flush_failed") == 1


# ---------- 三、ack 语义（本仓超越轴三）----------


def test_critical_requires_ack_tracked_as_pending():
    """CRITICAL 写出后仍待确认：写出 ≠ 送达。"""
    q = DeliveryQueue(flush=lambda f: True)
    q.enqueue(DeliveryFrame("c1", 1, "done", DeliveryTier.CRITICAL))
    assert q.pending_acks() == ("c1",)
    assert q.has_unacked_critical() is True


def test_acknowledge_clears_pending():
    q = DeliveryQueue(flush=lambda f: True)
    q.enqueue(DeliveryFrame("c1", 1, "done", DeliveryTier.CRITICAL))
    assert q.acknowledge("c1") is True
    assert q.pending_acks() == ()
    assert q.has_unacked_critical() is False


def test_acknowledge_unknown_id_returns_false():
    q = DeliveryQueue(flush=lambda f: True)
    assert q.acknowledge("never-sent") is False


def test_negative_ack_counted_separately():
    """确认失败与确认成功必须是不同计数（排障时信号完全不同）。"""
    q = DeliveryQueue(flush=lambda f: True)
    q.enqueue(DeliveryFrame("c1", 1, "done", DeliveryTier.CRITICAL))
    q.enqueue(DeliveryFrame("c2", 2, "done", DeliveryTier.CRITICAL))
    q.acknowledge("c1", ok=True)
    q.acknowledge("c2", ok=False)
    st = q.stats()
    assert st.get("ack.ok") == 1
    assert st.get("ack.failed") == 1
    assert st.get("ack.negative") == 1


def test_normal_frames_do_not_require_ack():
    q = DeliveryQueue(flush=lambda f: True)
    q.enqueue(DeliveryFrame("n1", 1, "chunk", DeliveryTier.NORMAL))
    assert q.pending_acks() == ()


# ---------- 四、事件分档（与 sse_contract 逐字对账）----------


def _contract_events():
    """从真实 sse_contract.py 读事件名（禁止在本测试里复制一份）。"""
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "core"))
    with open(os.path.join(base, "sse_contract.py"), encoding="utf-8") as fh:
        src = fh.read()
    return set(re.findall(r'SSEEventContract\(\s*"([^"]+)"', src))


def test_every_contract_event_has_a_tier():
    """契约内全部已登记事件必须能判档，且无一落到 fail-closed 兜底。

    这是「新增事件必须登记分档」的机器闸：漏登记会让该事件静默走
    CRITICAL 兜底（虽然没有安全风险，但会产生多余的 ack 负担）。
    """
    events = _contract_events()
    assert len(events) >= 38, f"契约事件数异常偏少: {len(events)}"
    unmapped = sorted(e for e in events if tier_for_event(e) is DeliveryTier.CRITICAL and e not in {
        "done", "partial_done", "error", "plan_updated", "goal_updated", "admission",
        "question", "form_request", "review-finding", "tool-approval", "budget", "hook-failed",
    })
    assert unmapped == [], f"以下契约事件未登记分档（会落到 CRITICAL 兜底）: {unmapped}"


def test_unknown_event_fails_closed_to_critical():
    """未登记事件 ⇒ CRITICAL（宁可多要 ack，不丢终态）。"""
    assert tier_for_event("some-brand-new-event") is DeliveryTier.CRITICAL


def test_terminal_events_are_critical():
    for e in ("done", "partial_done", "error", "admission", "question", "tool-approval"):
        assert tier_for_event(e) is DeliveryTier.CRITICAL, e


def test_high_frequency_events_are_normal():
    for e in ("chunk", "reasoning", "thinking", "tool-delta", "usage"):
        assert tier_for_event(e) is DeliveryTier.NORMAL, e


def test_tool_boundary_events_are_inline():
    for e in ("tool-call-start", "tool-result", "terminal_start", "terminal_end"):
        assert tier_for_event(e) is DeliveryTier.INLINE, e


# ---------- 五、统计快照隔离 ----------


def test_stats_returns_copy():
    """stats() 必须返回副本，外部改写不得污染内部计数。"""
    q = DeliveryQueue(flush=lambda f: True)
    q.enqueue(DeliveryFrame("f", 1, "chunk", DeliveryTier.NORMAL))
    st = q.stats()
    st["enqueue.normal"] = 999
    assert q.stats()["enqueue.normal"] == 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
