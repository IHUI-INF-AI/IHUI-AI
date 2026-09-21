# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
from app.core.retained_context import (
    MAX_FAMILY_RECORDS,
    MAX_RECORD_BYTES,
    RetainedContext,
    RetainedUserMessage,
    VerifiedAnswer,
    VerifiedQuestionAnswer,
)


def _msg(turn: str = "t1", mid: str | None = "m1", text: str = "hi") -> RetainedUserMessage:
    return RetainedUserMessage(turn_id=turn, message_id=mid, text=text, complete=True)


def _ans(turn: str = "t1", call: str = "c1") -> VerifiedAnswer:
    return VerifiedAnswer(
        turn_id=turn,
        call_id=call,
        questions=[VerifiedQuestionAnswer("q?", "a!")],
    )


def test_constants() -> None:
    assert MAX_FAMILY_RECORDS == 8
    assert MAX_RECORD_BYTES == 16_384


def test_record_and_idempotent() -> None:
    ctx = RetainedContext()
    assert ctx.record_verified_answer(_ans()) is True
    assert ctx.record_verified_answer(_ans()) is False  # 同事件幂等
    assert len(list(ctx.verified_answers)) == 1


def test_record_changed_content_replaces() -> None:
    ctx = RetainedContext()
    ctx.record_verified_answer(_ans())
    ctx.record_verified_answer(
        VerifiedAnswer("t1", "c1", [VerifiedQuestionAnswer("q2?", "a2!")])
    )
    entries = list(ctx.verified_answers)
    assert len(entries) == 1 and entries[0].value.questions[0].question == "q2?"


def test_record_order_uses_acceptance_and_advances() -> None:
    ctx = RetainedContext()
    ctx.record_verified_answer(_ans(call="c1"), acceptance_order=5)
    assert ctx.next_order == 6
    ctx.record_verified_answer(_ans(call="c2"))  # 无显式序 → 用 next_order
    entries = list(ctx.verified_answers)
    assert entries[1].order == 6


def test_user_message_dedup_by_message_id() -> None:
    ctx = RetainedContext()
    ctx.record_user_message(_msg(), acceptance_order=1)
    ctx.record_user_message(_msg(), acceptance_order=1)
    assert len(list(ctx.user_messages)) == 1
    ctx.record_user_message(_msg(text="changed"), acceptance_order=2)
    assert len(list(ctx.user_messages)) == 1


def test_inherited_prefix_order_precedes_local() -> None:
    ctx = RetainedContext()
    ctx.record_user_message(_msg(mid="local1"), acceptance_order=100)
    ctx.record_user_message(_msg(mid="inh1"), inherited=True)
    entries = list(ctx.ordered_entries())
    # Inherited 序(0)必须排在 Local(100) 之前,且首条即 inherited
    assert entries[0][0] is True and entries[0][1] == 0
    assert entries[1][1] == 100


def test_inherited_marks_answers_incomplete() -> None:
    ctx = RetainedContext()
    ctx.record_user_message(_msg(mid="inh"), inherited=True)
    assert ctx.verified_answers_incomplete is True
    assert ctx.verified_answers_complete() is False


def test_family_bound_evicts_oldest_and_marks_incomplete() -> None:
    ctx = RetainedContext()
    for i in range(MAX_FAMILY_RECORDS + 3):
        ctx.record_verified_answer(_ans(call=f"c{i}"), acceptance_order=i)
    entries = list(ctx.verified_answers)
    assert len(entries) == MAX_FAMILY_RECORDS
    assert entries[0].value.call_id == "c3"  # 最旧被驱逐
    assert ctx.verified_answers_incomplete is True


def test_oversized_message_bounded() -> None:
    ctx = RetainedContext()
    big = _msg(text="x" * (MAX_RECORD_BYTES))
    ctx.record_user_message(big, acceptance_order=1)
    entry = list(ctx.user_messages)[0]
    assert entry.value.text == "" and entry.value.complete is False
    assert len(entry.value.turn_id) <= 1024


def test_completeness_flags() -> None:
    ctx = RetainedContext()
    assert ctx.user_messages_complete() is False  # 默认 incomplete(legacy)
    ctx.record_user_message(_msg(), acceptance_order=1)
    assert ctx.user_messages_complete() is False  # 标记仍在
    ctx2 = RetainedContext()
    ctx2.record_user_message(_msg(), acceptance_order=1)
    ctx2.user_messages_incomplete = False
    assert ctx2.user_messages_complete() is True


def test_mark_user_messages_incomplete() -> None:
    ctx = RetainedContext()
    ctx.record_user_message(_msg(), acceptance_order=1)
    ctx.mark_user_messages_incomplete()
    assert ctx.user_messages_complete() is False


def test_rollback_by_boundary_order() -> None:
    ctx = RetainedContext()
    ctx.record_user_message(_msg(mid="m1", turn="t1"), acceptance_order=1)
    ctx.record_verified_answer(_ans(turn="t1", call="c1"), acceptance_order=2)
    ctx.record_user_message(_msg(mid="m2", turn="t2"), acceptance_order=3)
    ctx.record_verified_answer(_ans(turn="t2", call="c2"), acceptance_order=4)
    ctx.rollback(["t2"], "m2", acceptance_order=3)
    turns = {entry.value.turn_id for entry in ctx.user_messages}
    call_ids = {entry.value.call_id for entry in ctx.verified_answers}
    assert turns == {"t1"} and call_ids == {"c1"}


def test_rollback_by_message_id_boundary() -> None:
    ctx = RetainedContext()
    ctx.record_user_message(_msg(mid="m1", turn="t1"), acceptance_order=1)
    ctx.record_verified_answer(_ans(turn="t1", call="c1"), acceptance_order=2)
    ctx.record_user_message(_msg(mid="m2", turn="t2"), acceptance_order=3)
    ctx.rollback(["t2"], "m2")
    assert len(list(ctx.user_messages)) == 1
    assert len(list(ctx.verified_answers)) == 1


def test_rollback_fallback_turn_removal_marks_incomplete() -> None:
    ctx = RetainedContext()
    ctx.record_user_message(_msg(mid=None, turn="t1"), acceptance_order=1)
    ctx.rollback(["t1"], None)
    assert len(list(ctx.user_messages)) == 0
    assert ctx.user_messages_incomplete is True


def test_ordered_entries_merges_families() -> None:
    ctx = RetainedContext()
    ctx.record_user_message(_msg(mid="m1", turn="t1"), acceptance_order=2)
    ctx.record_verified_answer(_ans(turn="t1", call="c1"), acceptance_order=1)
    seq = [order for _, order, _ in ctx.ordered_entries()]
    assert seq == [1, 2]
