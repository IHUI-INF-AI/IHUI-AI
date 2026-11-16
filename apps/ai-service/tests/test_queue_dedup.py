"""排队项幂等去重测试(app.core.queue_dedup)。

对照 Codex `queuedSubmissionIds`:同一 submission 重试幂等返回既有项,
不重复排队;drain 消费后 forget 淘汰防 seen 无限增长。
"""

from __future__ import annotations

import pytest

from app.core.queue_dedup import (
    QueueDedup,
    dedup_enqueue,
    normalize_submission_text,
    submission_fingerprint,
)


def test_normalize_folds_whitespace():
    """strip + 折叠连续空白,防同文多空格绕过判重。"""
    assert normalize_submission_text("  hello   world \n\t again  ") == "hello world again"
    assert normalize_submission_text("   ") == ""


def test_fingerprint_same_text_same_thread_collides():
    """同线程同文 = 同指纹(跨线程不同文不撞)。"""
    assert submission_fingerprint("t1", "hi") == submission_fingerprint("t1", " hi  ")
    assert submission_fingerprint("t1", "hi") != submission_fingerprint("t2", "hi")


def test_same_text_retry_deduped():
    """同文重试 → 幂等返回既有 item_id,is_new=False。"""
    dd = QueueDedup()
    id1, new1 = dd.admit(thread_id="t1", text="查询天气", item_id="q_1")
    id2, new2 = dd.admit(thread_id="t1", text="查询天气", item_id="q_2")  # 重试
    assert new1 is True
    assert new2 is False
    assert id1 == id2 == "q_1"  # 复用首个 id,q_2 永不注册


def test_client_request_id_takes_priority():
    """显式 clientRequestId 优先:同键不同文仍判重(精确幂等)。"""
    dd = QueueDedup()
    id1, new1 = dd.admit(
        thread_id="t1", text="A", item_id="q_1", client_request_id="req-9"
    )
    id2, new2 = dd.admit(
        thread_id="t1", text="B", item_id="q_2", client_request_id="req-9"
    )
    assert new1 is True
    assert new2 is False
    assert id1 == id2 == "q_1"


def test_different_request_id_same_text_still_fingerprint_deduped():
    """不同 clientRequestId 但同线程同文 → 指纹仍判重(防双击重复排队)。"""
    dd = QueueDedup()
    id1, new1 = dd.admit(thread_id="t1", text="hi", item_id="q_1", client_request_id="r1")
    id2, new2 = dd.admit(thread_id="t1", text="hi", item_id="q_2", client_request_id="r2")
    assert new1 is True
    assert new2 is False
    assert id1 == id2


def test_forget_bounds_seen():
    """drain ACK 后 forget:淘汰后同文可重新入队(排队窗口有界)。"""
    dd = QueueDedup()
    dd.admit(thread_id="t1", text="hi", item_id="q_1")
    assert dd.pending_count() == 1
    dd.forget("q_1")
    assert dd.pending_count() == 0
    _id, is_new = dd.admit(thread_id="t1", text="hi", item_id="q_2")
    assert is_new is True  # 淘汰后视为新 submission


def test_forget_unknown_id_is_noop():
    """forget 未知 id 不抛、不污染。"""
    dd = QueueDedup()
    dd.forget("nonexistent")  # 不抛
    assert dd.pending_count() == 0


def test_forget_does_not_evict_newer_reuse():
    """同 item_id 被 forget 后,若该键已复用给新项,不误删新项索引。"""
    dd = QueueDedup()
    dd.admit(thread_id="t1", text="hi", item_id="q_1")
    dd.forget("q_1")
    # forget 后用同一键文本重新登记到新 item_id,再 forget 旧 id 不影响新项
    id2, is_new = dd.admit(thread_id="t1", text="hi", item_id="q_2")
    assert is_new is True and id2 == "q_2"
    dd.forget("q_1")  # 旧 id 已不在 keys_of,no-op
    assert dd.pending_count() == 1


async def test_dedup_enqueue_new_item_appended():
    """未命中 → make_item 入队 + record_admit 落账 + emit 广播。"""
    dd = QueueDedup()
    queue: list[dict] = []
    admitted: list[str] = []
    emitted: list[dict] = []

    def make_item(item_id: str) -> dict:
        return {"id": item_id, "input": "hi", "enqueuedAt": 1.0}

    async def collect(payload: dict) -> None:
        emitted.append(payload)

    result = await dedup_enqueue(
        queue,
        dd,
        thread_id="t1",
        text="hi",
        new_item_id="q_1",
        make_item=make_item,
        record_admit=admitted.append,
        emit=collect,
    )
    assert result == {"id": "q_1", "queued": 1, "deduped": False}
    assert len(queue) == 1 and queue[0]["id"] == "q_1"
    assert admitted == ["q_1"]
    assert emitted == [{"queued": 1, "action": "enqueued"}]


async def test_dedup_enqueue_retry_returns_existing():
    """重试(同文)→ 返回既有 id,队列不变、不重复落账。"""
    dd = QueueDedup()
    queue: list[dict] = []
    admitted: list[str] = []
    make_item = lambda item_id: {"id": item_id, "input": "hi"}  # noqa: E731

    first = await dedup_enqueue(
        queue, dd, thread_id="t1", text="hi", new_item_id="q_1", make_item=make_item,
        record_admit=admitted.append,
    )
    second = await dedup_enqueue(
        queue, dd, thread_id="t1", text="hi", new_item_id="q_2", make_item=make_item,
        record_admit=admitted.append,
    )
    assert first["deduped"] is False
    assert second == {"id": "q_1", "queued": 1, "deduped": True}
    assert len(queue) == 1  # 不重复入队
    assert admitted == ["q_1"]  # 不重复落账


async def test_dedup_enqueue_drain_then_reenqueue():
    """drain 消费后 forget,同文重新入队为新项(排队窗口有界)。"""
    dd = QueueDedup()
    queue: list[dict] = []
    make_item = lambda item_id: {"id": item_id, "input": "hi"}  # noqa: E731

    await dedup_enqueue(queue, dd, thread_id="t1", text="hi", new_item_id="q_1", make_item=make_item)
    dd.forget("q_1")  # 模拟 drain ACK
    queue.clear()  # 模拟出队
    result = await dedup_enqueue(queue, dd, thread_id="t1", text="hi", new_item_id="q_2", make_item=make_item)
    assert result["deduped"] is False and result["id"] == "q_2"
