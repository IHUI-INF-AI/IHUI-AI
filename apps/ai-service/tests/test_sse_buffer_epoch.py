# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SSE 续传锚点的 epoch(代次)判定单元测试 —— 台账票 G-998170。

病灶(只读取证,已复核):``SSEEventBuffer.clear()`` 把 ``_counters`` 一起弹掉,
于是同一 ``task_id`` 的缓冲重建后 event_id 的序号从 1 重起。客户端手里那个
``Last-Event-ID=<task>-3`` 在新缓冲里**又能命中**,但它当年看到的那条事件与现在
缓冲里的第 3 条**不是同一条事件** —— 身份换了,序号没换,旧实现只看序号。

本文件钉住的契约:

- 序号**只在同一 epoch 内单调**;``clear()`` 后 epoch 递增、序号从 1 重起。
- 续传锚点必须"身份 + 序号"共同判定:只有能证明该序号**不属于其它代次**的锚点
  才算有效;跨代次无法辨身份 ⇒ ``REPLAY_NOT_RESUMABLE`` + 原因写明代次更换。
- 终态不可逆:代次一旦换过,旧的裸序号锚点不再被承认(不猜、不和稀泥)。

id 形态说明:event_id 恒为 ``{task_id}-{seq}``(既有测试与 ``routers/agents.py``
的 ``rsplit("-", 1)`` 取 task 都钉死了这个形态,epoch **不进 id**),因此代次只能
靠"该序号是否在旧代次里出现过"反推 —— 见 ``SSEEventBuffer.epoch()``。
"""

from __future__ import annotations

from app.core.sse_buffer import (
    REPLAY_HIT,
    REPLAY_NOT_RESUMABLE,
    SSEEventBuffer,
)

_TASK = "task-epoch"


def _chunk(text: str) -> dict[str, str]:
    return {"type": "chunk", "content": text}


def _write_seq_1_to_3(buf: SSEEventBuffer) -> list[str]:
    """第一代:写 seq 1..3。"""
    return [buf.append(_TASK, _chunk(f"gen1-{i}")) for i in range(1, 4)]


def _write_seq_1_to_5_after_rebuild(buf: SSEEventBuffer) -> list[str]:
    """第二代:``clear()`` 之后重写 seq 1..5(序号又从 1 起,这是病灶现场)。"""
    return [buf.append(_TASK, _chunk(f"gen2-{i}")) for i in range(1, 6)]


# =============================================================================
# 核心红测:旧代次的裸序号锚点不得被新代次承认
# =============================================================================


def test_anchor_from_previous_epoch_is_not_resumable() -> None:
    """写 1..3 → ``clear()`` → 重写 1..5 → 持旧锚点 ``<task>-3`` 续传 ⇒ 不可续传。

    改前实得 ``REPLAY_HIT`` 并把新代次的第 4、5 条当作"缺失事件"回灌 —— 客户端
    按 id 追加就会拿到一段它**从未见过、也不属于它那条流**的内容(会话内容错位/翻倍)。
    本用例是本票的判据入口:身份换过就不能只凭序号续传。
    """
    buf = SSEEventBuffer()
    _write_seq_1_to_3(buf)
    buf.clear(_TASK)
    _write_seq_1_to_5_after_rebuild(buf)

    outcome = buf.replay_outcome(_TASK, f"{_TASK}-3")

    assert outcome.status == REPLAY_NOT_RESUMABLE, (
        f"旧代次锚点被新代次承认了(实得 {outcome.status})—— 身份已换,不得只看序号"
    )
    assert outcome.events == [], "不可续传就一帧历史都不回灌"
    assert outcome.resumable is False


def test_not_resumable_reason_names_the_epoch_change() -> None:
    """原因文本必须写明"缓冲代次已更换"并带上 A→B(静默变短等于伪造完整性)。"""
    buf = SSEEventBuffer()
    _write_seq_1_to_3(buf)
    buf.clear(_TASK)
    _write_seq_1_to_5_after_rebuild(buf)

    outcome = buf.replay_outcome(_TASK, f"{_TASK}-3")

    assert outcome.reason, "不可续传必须给出原因"
    assert "代次" in outcome.reason and "epoch" in outcome.reason.lower()
    assert "1→2" in outcome.reason, f"原因未写明代次 A→B: {outcome.reason!r}"


# =============================================================================
# epoch 本身:递增 / 按 task 隔离 / 序号只在同代内单调
# =============================================================================


def test_epoch_increments_on_clear_and_seq_restarts_within_epoch() -> None:
    """``clear()`` ⇒ epoch 递增;序号在**同一 epoch 内**单调,新代次从 1 重起。

    这条把"序号只在同一 epoch 内单调"钉死:序号重起不是 bug,拿裸序号跨代续传才是。
    """
    buf = SSEEventBuffer()
    assert buf.epoch(_TASK) == 1, "未见过的 task 从第 1 代起算"

    assert _write_seq_1_to_3(buf) == [f"{_TASK}-1", f"{_TASK}-2", f"{_TASK}-3"]
    assert buf.epoch(_TASK) == 1

    buf.clear(_TASK)
    assert buf.epoch(_TASK) == 2, "clear() 后代次必须递增"

    assert _write_seq_1_to_5_after_rebuild(buf) == [f"{_TASK}-{i}" for i in range(1, 6)]
    assert buf.epoch(_TASK) == 2


def test_epoch_is_tracked_per_task_identity() -> None:
    """代次按 task_id 独立:A 的 clear 不得抬高 B 的代次(身份判定的一部分)。"""
    buf = SSEEventBuffer()
    buf.append("task-a", _chunk("a"))
    buf.append("task-b", _chunk("b"))
    assert buf.epoch("task-a") == 1 and buf.epoch("task-b") == 1

    buf.clear("task-a")
    assert buf.epoch("task-a") == 2
    assert buf.epoch("task-b") == 1, "A 的代次变化污染了 B"


# =============================================================================
# 反向对照:判据不是"clear 过就一律拒绝"(那会把续传能力整体打死)
# =============================================================================


def test_anchor_from_current_epoch_still_hits() -> None:
    """同代次内、且高过所有旧代次水位的锚点照旧可续传。

    证明判据落在 epoch 身份上,不是"见 clear 就一律拒绝"(那会把续传能力整体打死)。
    注意锚点必须**高过水位线**:第三代里 seq=2 那种序号在第一、二代都用过,身份确实
    不可辨,判 not_resumable 是对的 —— 所以这里取高过水位的 seq=7。
    """
    buf = SSEEventBuffer()
    _write_seq_1_to_3(buf)  # 第一代:水位线将到 3
    buf.clear(_TASK)
    _write_seq_1_to_5_after_rebuild(buf)  # 第二代:水位线升到 5
    buf.clear(_TASK)

    ids = [buf.append(_TASK, _chunk(f"gen3-{i}")) for i in range(1, 9)]  # 第三代写到 8

    outcome = buf.replay_outcome(_TASK, ids[6])  # 锚点 = 第三代第 7 条 > 水位线 5

    assert outcome.status == REPLAY_HIT, f"身份唯一的锚点被误拒: {outcome.reason!r}"
    assert [e["id"] for e in outcome.events] == ids[7:]


def test_seq_never_reached_in_older_epoch_stays_resumable() -> None:
    """锚点序号**高过所有旧代次**⇒ 只可能属于当前代次 ⇒ 仍判 hit。

    这是"只在能证明身份时才续传"的另一半:证明得了就续传,证明不了才拒。
    """
    buf = SSEEventBuffer()
    _write_seq_1_to_3(buf)  # 旧代次最高只到 3
    buf.clear(_TASK)
    for i in range(1, 11):  # 新代次写到 10
        buf.append(_TASK, _chunk(f"gen2-{i}"))

    outcome = buf.replay_outcome(_TASK, f"{_TASK}-7")

    assert outcome.status == REPLAY_HIT, f"唯一可辨身份的锚点被误拒: {outcome.reason!r}"
    assert [e["id"] for e in outcome.events] == [f"{_TASK}-{i}" for i in range(8, 11)]


def test_cleared_task_with_no_rebuild_is_unknown_not_not_resumable() -> None:
    """``clear()`` 后**没有重建** ⇒ 三态仍是 ``UNKNOWN_TASK``,不被新判据劫持。"""
    buf = SSEEventBuffer()
    eid = buf.append(_TASK, _chunk("a"))
    buf.clear(_TASK)

    assert buf.replay_outcome(_TASK, eid).status == "unknown_task"
