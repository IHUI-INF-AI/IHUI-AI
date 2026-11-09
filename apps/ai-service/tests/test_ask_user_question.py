# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AskUserQuestion 最小闭环契约(2026-11-08 立)。

判据围绕"一个 questionId 只认一次答复"写:
① 首次答复 answered;重复答复 duplicate 且原答案原样保留(不覆盖、不二次唤醒);
② 单选多值被拒;allowCustom=false 时自由文本被忽略;
③ 超时落 timeout,之后再来答复一律 timeout(不被接受);
④ 撤回 / 会话中断把等待方分别以 withdrawn / interrupted 叫醒;
⑤ 跨会话、跨用户、不存在分别 forbidden / forbidden / not_found;
⑥ 工具注册表双射(ask_user_question 同时在 _TOOLS 与 _TOOL_HANDLERS);
⑦ 上行端点幂等:重复 answer 回 duplicate:true,撤回与越权(404)成对。
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.routers import llm as llm_mod
from app.services import ask_user_question as aq
from app.services.mcp_server import _TOOL_HANDLERS, _TOOLS

_SESSION = "sess-ask-1"
_USER = "user-ask-1"


@pytest.fixture(autouse=True)
def _clean_registry() -> Any:
    """注册表逐用例清零(进程内全局表,残留条目会顶偏后续断言)。"""
    yield
    with aq._registry_lock:
        aq._registry.clear()


@pytest.fixture()
def client() -> Any:
    app = FastAPI()
    app.include_router(llm_mod.router)

    @app.middleware("http")
    async def _inject_identity(request: Request, call_next):  # type: ignore[no-untyped-def]
        uid = request.headers.get("x-test-uid")
        if uid:
            request.state.user_id = uid
        return await call_next(request)

    with TestClient(app) as c:
        yield c


def _make(**overrides: Any):
    kwargs: dict[str, Any] = {
        "session_id": _SESSION,
        "user_id": _USER,
        "prompt": "请选择一项",
        "options": [
            {"id": "a", "label": "选项 A"},
            {"id": "b", "label": "选项 B", "description": "补充说明"},
        ],
        "allow_custom": True,
        "allow_multiple": False,
    }
    kwargs.update(overrides)
    item = aq.create_question(**kwargs)
    assert not isinstance(item, dict), item
    return item


def test_downstream_shape_matches_question_parser() -> None:
    """下行帧与 question_parser.Question.to_dict() 同形(+ sessionId/expiresAt)。"""
    item = _make()
    payload = item.to_dict()
    assert set(payload) == {
        "questionId",
        "prompt",
        "options",
        "allowCustom",
        "allowMultiple",
        "sessionId",
        "expiresAt",
    }
    assert payload["questionId"].startswith("q_")
    assert payload["options"][0] == {"id": "a", "label": "选项 A"}
    assert payload["options"][1]["description"] == "补充说明"


@pytest.mark.asyncio
async def test_answer_once_then_duplicate_keeps_original() -> None:
    item = _make()
    status, resolved = aq.resolve_question(
        item.question_id, session_id=_SESSION, user_id=_USER, selected_ids=["a"]
    )
    assert status == "answered"
    assert resolved is item

    status2, again = aq.resolve_question(
        item.question_id, session_id=_SESSION, user_id=_USER, selected_ids=["b"]
    )
    assert status2 == "duplicate"
    assert again is item
    assert item.selected_ids == ["a"]  # 原答案不因重复提交被覆盖
    assert item.status == "answered"


def test_single_select_rejects_multi_values() -> None:
    item = _make()
    status, _ = aq.resolve_question(
        item.question_id, session_id=_SESSION, user_id=_USER, selected_ids=["a", "b"]
    )
    assert status == "invalid"
    assert item.status == "pending"
    assert item.selected_ids == []


def test_custom_text_ignored_when_not_allowed() -> None:
    item = _make(allow_custom=False)
    status, _ = aq.resolve_question(
        item.question_id,
        session_id=_SESSION,
        user_id=_USER,
        selected_ids=["a"],
        custom_text="我自己写的",
    )
    assert status == "answered"
    assert item.custom_text == ""


@pytest.mark.asyncio
async def test_timeout_then_late_answer_not_accepted() -> None:
    item = _make()
    status = await aq.wait_for_answer(item, timeout_s=0.01)
    assert status == "timeout"
    assert item.status == "timeout"

    late_status, _ = aq.resolve_question(
        item.question_id, session_id=_SESSION, user_id=_USER, selected_ids=["a"]
    )
    assert late_status == "timeout"
    assert item.selected_ids == []


@pytest.mark.asyncio
async def test_withdraw_wakes_waiter() -> None:
    item = _make()
    waiter = asyncio.create_task(aq.wait_for_answer(item, timeout_s=5.0))
    await asyncio.sleep(0)

    status, _ = aq.withdraw_question(item.question_id, session_id=_SESSION, user_id=_USER)
    assert status == "withdrawn"
    assert await waiter == "withdrawn"
    assert item.status == "withdrawn"


@pytest.mark.asyncio
async def test_session_interrupt_wakes_waiter() -> None:
    item = _make()
    waiter = asyncio.create_task(aq.wait_for_answer(item, timeout_s=5.0))
    await asyncio.sleep(0)

    affected = aq.cancel_session_questions(_SESSION)
    assert [x.question_id for x in affected] == [item.question_id]
    assert await waiter == "interrupted"
    assert item.status == "interrupted"


def test_cross_session_and_cross_user_are_forbidden() -> None:
    item = _make()
    assert aq.resolve_question(
        item.question_id, session_id="other-session", user_id=_USER, selected_ids=["a"]
    )[0] == "forbidden"
    assert aq.resolve_question(
        item.question_id, session_id=_SESSION, user_id="other-user", selected_ids=["a"]
    )[0] == "forbidden"
    assert aq.resolve_question(
        "q_does_not_exist", session_id=_SESSION, user_id=_USER, selected_ids=["a"]
    )[0] == "not_found"


def test_create_question_validation_returns_structured_error() -> None:
    base: dict[str, Any] = {"session_id": _SESSION, "user_id": _USER, "prompt": "问"}
    no_options = aq.create_question(**base, options=[])
    assert isinstance(no_options, dict)
    assert no_options["errorCode"] == "question_invalid_options"

    duplicated = aq.create_question(
        **base,
        options=[{"id": "a", "label": "A"}, {"id": "a", "label": "A2"}],
    )
    assert isinstance(duplicated, dict)
    assert duplicated["errorCode"] == "question_invalid_option"

    empty_prompt = aq.create_question(
        session_id=_SESSION, user_id=_USER, prompt="  ", options=[{"id": "a", "label": "A"}]
    )
    assert isinstance(empty_prompt, dict)
    assert empty_prompt["errorCode"] == "question_invalid_prompt"


def test_tool_registry_bijection_includes_ask_user_question() -> None:
    names = {tool.name for tool in _TOOLS}
    assert "ask_user_question" in names
    assert "ask_user_question" in _TOOL_HANDLERS
    assert len(_TOOLS) == len(_TOOL_HANDLERS)


@pytest.mark.asyncio
async def test_plain_call_tool_does_not_wait() -> None:
    """无交互宿主的执行面立刻返回结构化拒绝,不挂等待。"""
    result = await _TOOL_HANDLERS["ask_user_question"]({"question": "问"})
    assert result["ok"] is False
    assert result["errorCode"] == "question_host_unsupported"


def test_question_response_endpoint_idempotent(client: Any) -> None:
    item = _make()
    url = f"/llm/complete/stream/{_SESSION}/question-response"
    headers = {"x-test-uid": _USER}

    first = client.post(
        url,
        json={"questionId": item.question_id, "action": "answer", "selectedOptionIds": ["a"]},
        headers=headers,
    )
    assert first.status_code == 200
    assert first.json() == {"accepted": True, "status": "answered", "duplicate": False}

    again = client.post(
        url,
        json={"questionId": item.question_id, "action": "answer", "selectedOptionIds": ["b"]},
        headers=headers,
    )
    assert again.status_code == 200
    assert again.json() == {"accepted": False, "status": "answered", "duplicate": True}
    assert item.selected_ids == ["a"]


def test_question_response_endpoint_rejects_unknown_and_withdraws(client: Any) -> None:
    url = f"/llm/complete/stream/{_SESSION}/question-response"
    headers = {"x-test-uid": _USER}

    unknown = client.post(
        url,
        json={"questionId": "q_missing", "action": "answer", "selectedOptionIds": ["a"]},
        headers=headers,
    )
    assert unknown.status_code == 404

    item = _make()
    withdrawn = client.post(
        url, json={"questionId": item.question_id, "action": "withdraw"}, headers=headers
    )
    assert withdrawn.status_code == 200
    assert withdrawn.json() == {"accepted": True, "status": "withdrawn"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
