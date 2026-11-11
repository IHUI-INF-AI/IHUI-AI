"""AIS-032 回归:chat 身份只取已认证主体,session_id 不得反推身份。

票面缺陷:端点不取 JWT 主体,`_resolve_user_id(sid)` 把客户端可控 session_id 的
首段当 user_id,导致读他人历史/记忆并以他人身份执行工具。

本文件钉四件事:
① 主体 A 传 `B:x` ⇒ 403,且记忆/历史/工具一次都不碰;
② 主体 A 传空 sid ⇒ 记忆写入落在 A 的命名空间(不再从 sid 猜);
③ 合法 `A:s1` ⇒ 放行;
④ 会话层显式主体存在时绝不调用 `_resolve_user_id`(身份不从 sid 推导)。

身份模拟:HEAD 的端点用 `await require_request_user_id(request)` 直接读
`request.state.user_id`(不是 `Depends`),故 `dependency_overrides` 不生效;
这里用 ASGI 中间件按请求头注入主体,走的是与 JWT 中间件同一条 `request.state`
通道,不连 DB/外网。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.api.v1 import chat
from app.services import conversation as conversation_mod
from app.services.conversation import (
    ConversationResult,
    IntentResult,
    SessionOwnershipError,
    conversation_service,
)
from app.services.memory import memory_store


def _make_app() -> FastAPI:
    """最小 app + 主体注入中间件(等价 JWT 中间件写 request.state.user_id)。"""
    app = FastAPI()

    @app.middleware("http")
    async def _inject_principal(request: Request, call_next):
        user_id = request.headers.get("x-test-user")
        if user_id:
            request.state.user_id = user_id
        return await call_next(request)

    app.include_router(chat.router, prefix="/api/v1/ai")
    return app


def _make_result(session_id: str = "s1") -> ConversationResult:
    return ConversationResult(
        session_id=session_id,
        user_input="hello",
        intent=IntentResult(intent="chat", confidence=0.9),
        tool_calls=[],
        final_response="hi there",
        model="gpt-4",
        iterations=1,
        duration_ms=1.0,
        stub=False,
        trace=[],
    )


@pytest.fixture()
def fake_service(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """替换 conversation_service,只观察路由传下去的主体。"""
    service = MagicMock()
    service.chat = AsyncMock(return_value=_make_result())
    service.result_to_dict = MagicMock(
        return_value={"session_id": "s1", "final_response": "hi there"}
    )
    monkeypatch.setattr(chat, "conversation_service", service)
    return service


def test_cross_user_session_id_is_403_and_touches_nothing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A 传 `B:x` ⇒ 403,记忆/历史/工具均未被调用。"""
    memory_add = AsyncMock()
    memory_get = AsyncMock(return_value=[])
    tool_exec = AsyncMock(return_value=({"ok": True}, 0.0))
    monkeypatch.setattr(memory_store, "add", memory_add)
    monkeypatch.setattr(memory_store, "get", memory_get)
    monkeypatch.setattr(conversation_mod, "_execute_tool_call", tool_exec)

    with TestClient(_make_app()) as client:
        resp = client.post(
            "/api/v1/ai/chat",
            headers={"x-test-user": "user-a"},
            json={"message": "hi", "session_id": "user-b:x"},
        )

    assert resp.status_code == 403
    memory_add.assert_not_awaited()
    memory_get.assert_not_awaited()
    tool_exec.assert_not_called()


def test_empty_session_id_uses_authenticated_principal(fake_service: MagicMock) -> None:
    """空 sid ⇒ 远端仍以 A 为主体调用会话服务。"""
    with TestClient(_make_app()) as client:
        resp = client.post(
            "/api/v1/ai/chat",
            headers={"x-test-user": "user-a"},
            json={"message": "hello"},
        )

    assert resp.status_code == 200
    assert resp.json()["code"] == 0
    fake_service.chat.assert_awaited_once()
    assert fake_service.chat.call_args.kwargs["user_id"] == "user-a"
    assert fake_service.chat.call_args.kwargs["session_id"] is None


def test_matching_compound_session_id_passes(fake_service: MagicMock) -> None:
    """合法 `A:s1` ⇒ 放行,主体原样透传。"""
    with TestClient(_make_app()) as client:
        resp = client.post(
            "/api/v1/ai/chat",
            headers={"x-test-user": "user-a"},
            json={"message": "hello", "session_id": "user-a:s1"},
        )

    assert resp.status_code == 200
    assert resp.json()["code"] == 0
    fake_service.chat.assert_awaited_once()
    assert fake_service.chat.call_args.kwargs["user_id"] == "user-a"
    assert fake_service.chat.call_args.kwargs["session_id"] == "user-a:s1"


@pytest.mark.parametrize("sid", [None, "user-a:s1"])
async def test_conversation_memory_is_scoped_by_principal_not_by_sid(
    monkeypatch: pytest.MonkeyPatch, sid: str | None
) -> None:
    """会话层记忆写入按主体定域;显式主体存在时绝不调用 `_resolve_user_id`。"""
    memory_add = AsyncMock()
    memory_get = AsyncMock(return_value=[])
    monkeypatch.setattr(memory_store, "add", memory_add)
    monkeypatch.setattr(memory_store, "get", memory_get)

    async def _explode(*args, **kwargs):
        # 记忆写入之后立刻中止,避免进入 LLM/工具链路(测试不连外网)
        raise RuntimeError("stop-after-memory-add")

    monkeypatch.setattr(conversation_service, "_classify_intent", _explode)

    def _must_not_derive(session_id: str) -> str:
        raise AssertionError("显式主体存在时不得再从 session_id 推导身份")

    monkeypatch.setattr(conversation_mod, "_resolve_user_id", _must_not_derive)

    result = await conversation_service.chat(
        user_input="hello", session_id=sid, user_id="user-a", max_iterations=1
    )

    memory_add.assert_awaited()
    add_kwargs = memory_add.await_args.kwargs
    actual_sid = memory_add.await_args.args[0]
    if sid is not None:
        assert actual_sid == sid
    key = memory_store._key(actual_sid, add_kwargs["user_id"])
    assert key.startswith("memory:user-a:")
    assert "[对话编排失败]" in result.final_response


async def test_conversation_rejects_cross_user_sid_before_memory(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """会话层自身也拒绝跨主体 sid,且异常先于任何记忆访问。"""
    memory_add = AsyncMock()
    memory_get = AsyncMock(return_value=[])
    monkeypatch.setattr(memory_store, "add", memory_add)
    monkeypatch.setattr(memory_store, "get", memory_get)

    with pytest.raises(SessionOwnershipError):
        await conversation_service.chat(
            user_input="hello", session_id="user-b:x", user_id="user-a"
        )

    memory_add.assert_not_awaited()
    memory_get.assert_not_awaited()
