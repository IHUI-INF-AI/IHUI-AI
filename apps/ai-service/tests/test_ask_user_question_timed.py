# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌​‌‍‍​‌​​​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​‌​‍⁠

"""ask_user_question 定时继续契约(2026-11-14 立,对标 DSH dsh-tool-ask-user/timed.ts)。

① timeout_s 归一:None 保留阻塞语义、-1 映射等到底、1..86400 为 timed、其余结构化拒绝;
② create_question(timeout_s=...) 落到 expiresAt(不传仍走 env 默认);
③ timed 到期 mark_continued:条目仍是 pending、有效期延长、迟到答复被接受;
④ 迟到答复由 drain_continued_answers 一次性交付(answer_to_pending_question 消息体);
⑤ 已经答复/撤回的条目不因 mark_continued 被覆盖。
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from app.services import ask_user_question as aq

_SESSION = "sess-timed-1"
_USER = "user-timed-1"


@pytest.fixture(autouse=True)
def _clean_registry() -> Any:
    yield
    with aq._registry_lock:
        aq._registry.clear()


def _make(**overrides: object):
    kwargs: dict[str, object] = {
        "session_id": _SESSION,
        "user_id": _USER,
        "prompt": "请选择一项",
        "options": [{"id": "a", "label": "选项 A"}, {"id": "b", "label": "选项 B"}],
        "allow_custom": True,
        "allow_multiple": False,
    }
    kwargs.update(overrides)
    item = aq.create_question(**kwargs)  # type: ignore[arg-type]
    assert not isinstance(item, dict), item
    return item


def test_normalize_timeout_variants() -> None:
    assert aq.normalize_timeout_s(None) == (None, False, None)
    assert aq.normalize_timeout_s(-1) == (aq.INDEFINITE_WAIT_S, False, None)
    assert aq.normalize_timeout_s(30) == (30.0, True, None)

    for bad in (0, -2, 86_401, "30", True):
        budget, timed, error = aq.normalize_timeout_s(bad)
        assert budget is None and timed is False
        assert error is not None and error["errorCode"] == "question_invalid_timeout"


def test_create_question_honors_timeout_s() -> None:
    timed = _make(timeout_s=30)
    span = (timed.expires_at - timed.created_at).total_seconds()
    assert 29 <= span <= 31

    indefinite = _make(timeout_s=-1)
    span = (indefinite.expires_at - indefinite.created_at).total_seconds()
    assert 86_000 <= span <= 86_401

    default = _make()
    span = (default.expires_at - default.created_at).total_seconds()
    assert abs(span - aq.question_timeout_s()) < 1


def test_create_question_rejects_invalid_timeout() -> None:
    result = aq.create_question(
        session_id=_SESSION,
        user_id=_USER,
        prompt="问",
        options=[{"id": "a", "label": "A"}],
        timeout_s="soon",
    )
    assert isinstance(result, dict)
    assert result["errorCode"] == "question_invalid_timeout"


def test_mark_continued_keeps_answerable_and_extends_deadline() -> None:
    item = _make(timeout_s=1)
    original_expiry = item.expires_at

    status = aq.mark_continued(item, call_id="call-1", grace_s=120)
    assert status == aq.STATUS_CONTINUED
    assert item.status == aq.STATUS_PENDING
    assert item.continued is True
    assert item.continued_call_id == "call-1"
    assert item.expires_at > original_expiry
    assert item.expires_at > datetime.now(UTC) + timedelta(seconds=100)

    # 迟到答复仍被接受
    late_status, resolved = aq.resolve_question(
        item.question_id, session_id=_SESSION, user_id=_USER, selected_ids=["b"]
    )
    assert late_status == "answered"
    assert resolved is item
    assert item.selected_ids == ["b"]


def test_mark_continued_does_not_override_earlier_settlement() -> None:
    item = _make(timeout_s=1)
    aq.resolve_question(
        item.question_id, session_id=_SESSION, user_id=_USER, selected_ids=["a"]
    )
    assert aq.mark_continued(item, call_id="call-2") == "answered"
    assert item.continued is False
    assert item.selected_ids == ["a"]


@pytest.mark.asyncio
async def test_drain_continued_answers_delivers_once() -> None:
    item = _make(timeout_s=1)
    aq.mark_continued(item, call_id="call-9", grace_s=60)
    aq.resolve_question(
        item.question_id, session_id=_SESSION, user_id=_USER, selected_ids=["a"]
    )

    drained = aq.drain_continued_answers(_SESSION)
    assert [x.question_id for x in drained] == [item.question_id]
    assert aq.drain_continued_answers(_SESSION) == []

    message = aq.continued_answer_message(drained[0])
    assert '"kind": "answer_to_pending_question"' in message
    assert '"callId": "call-9"' in message
    assert '"selectedOptionIds": ["a"]' in message


@pytest.mark.asyncio
async def test_plain_timeout_still_terminal_for_non_timed() -> None:
    """未进入 timed 的等不到答复仍是 timeout(迟到答复被拒),回归既有语义。"""
    item = _make(timeout_s=1)
    status = await aq.wait_for_answer(item, timeout_s=0.01)
    assert status == "timeout"
    late_status, _ = aq.resolve_question(
        item.question_id, session_id=_SESSION, user_id=_USER, selected_ids=["a"]
    )
    assert late_status == "timeout"


@pytest.mark.asyncio
async def test_agent_loop_timed_question_returns_pending() -> None:
    """宿主分支:timeout_s 到期 → 工具结果 pending=true,条目仍可答复(continued)。"""
    from app.routers.agents import _make_loop_v2_llm
    from app.services.agent_loop_v2 import AgentLoopV2, ToolCall, ToolDefinition

    async def _executor(args: object) -> dict[str, object]:
        raise AssertionError("ask_user_question 不应走 executor")

    loop = AgentLoopV2(
        _make_loop_v2_llm(model="test-model"),
        tools=[
            ToolDefinition(
                name="ask_user_question",
                description="向用户提问",
                parameters={"type": "object", "properties": {}},
                executor=_executor,
            )
        ],
        max_iterations=2,
        enable_checkpoint=False,
        llm_retry_max=0,
        session_id=_SESSION,
        user_id=_USER,
    )
    result = await loop._handle_ask_user_question(
        ToolCall(
            id="call-timed-1",
            name="ask_user_question",
            args={
                "question": "请选择一项",
                "options": [{"id": "a", "label": "选项 A"}],
                "timeout_s": 1,
            },
        )
    )
    assert result.error is None
    assert result.error_type is None
    assert result.result["ok"] is True
    assert result.result["pending"] is True
    assert result.result["status"] == aq.STATUS_CONTINUED
    assert result.result["callId"] == "call-timed-1"

    item = aq._registry[result.result["questionId"]]
    assert item.status == aq.STATUS_PENDING
    assert item.continued is True
    assert item.continued_call_id == "call-timed-1"
