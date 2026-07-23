"""chat.py 单元测试 — POST /api/v1/ai/chat 对话端点。

测试覆盖:
- 数据模型:ChatRequest 字段验证(message 必填/max_iterations 1-10/rag_top_k 1-20)
- 端点:chat 成功路径(code=0)/异常路径(code=500)
- 隔离:mock conversation_service.chat + result_to_dict,不调真实 LLM/DB
- 透传参数:user_input/session_id/model/allowed_tools/max_iterations
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.v1 import chat
from app.api.v1.chat import ChatRequest


# =============================================================================
# 辅助
# =============================================================================


def _make_app():
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(chat.router, prefix="/api/v1/ai")
    return app


def _make_result(session_id="sess-1"):
    """构造一个最小 ConversationResult-like 对象(mock,不调真实构造器)。"""
    # 用真实 ConversationResult dataclass 以确保 result_to_dict 不爆
    from app.services.conversation import ConversationResult, IntentResult

    return ConversationResult(
        session_id=session_id,
        user_input="hello",
        intent=IntentResult(intent="chat", confidence=0.9),
        tool_calls=[],
        final_response="hi there",
        model="gpt-4",
        iterations=1,
        duration_ms=10.0,
        stub=False,
        trace=[],
    )


# =============================================================================
# 数据模型 ChatRequest
# =============================================================================


def test_chat_request_defaults():
    """ChatRequest 默认 max_iterations=3, use_rag=False, rag_top_k=3。"""
    req = ChatRequest(message="hi")
    assert req.message == "hi"
    assert req.session_id is None
    assert req.model is None
    assert req.tools is None
    assert req.max_iterations == 3
    assert req.use_rag is False
    assert req.rag_top_k == 3


def test_chat_request_message_required():
    """message 字段必填。"""
    with pytest.raises(ValueError):
        ChatRequest()


def test_chat_request_max_iterations_lower_bound():
    """max_iterations < 1 → ValidationError。"""
    with pytest.raises(ValueError):
        ChatRequest(message="x", max_iterations=0)


def test_chat_request_max_iterations_upper_bound():
    """max_iterations > 10 → ValidationError。"""
    with pytest.raises(ValueError):
        ChatRequest(message="x", max_iterations=11)


def test_chat_request_rag_top_k_lower_bound():
    """rag_top_k < 1 → ValidationError。"""
    with pytest.raises(ValueError):
        ChatRequest(message="x", rag_top_k=0)


def test_chat_request_rag_top_k_upper_bound():
    """rag_top_k > 20 → ValidationError。"""
    with pytest.raises(ValueError):
        ChatRequest(message="x", rag_top_k=21)


def test_chat_request_all_fields():
    """所有字段都能正确赋值。"""
    req = ChatRequest(
        message="hello",
        session_id="s1",
        model="gpt-4",
        tools=["search"],
        max_iterations=5,
        use_rag=True,
        rag_top_k=10,
    )
    assert req.session_id == "s1"
    assert req.model == "gpt-4"
    assert req.tools == ["search"]
    assert req.max_iterations == 5
    assert req.use_rag is True
    assert req.rag_top_k == 10


# =============================================================================
# 端点:chat 成功路径
# =============================================================================


async def test_chat_endpoint_success(monkeypatch):
    """POST /api/v1/ai/chat 成功 → code=0 + data 含 use_rag/rag_top_k。"""
    result = _make_result()
    fake_service = MagicMock()
    fake_service.chat = AsyncMock(return_value=result)
    fake_service.result_to_dict = MagicMock(
        return_value={"session_id": "sess-1", "response": "hi there"}
    )
    monkeypatch.setattr(chat, "conversation_service", fake_service)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/ai/chat",
            json={"message": "hello", "use_rag": True, "rag_top_k": 5},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert data["message"] == "ok"
    assert data["data"]["session_id"] == "sess-1"
    assert data["data"]["use_rag"] is True
    assert data["data"]["rag_top_k"] == 5

    # 验证 conversation_service.chat 被正确调用
    fake_service.chat.assert_awaited_once()
    call_kwargs = fake_service.chat.call_args.kwargs
    assert call_kwargs["user_input"] == "hello"
    assert call_kwargs["max_iterations"] == 3


async def test_chat_endpoint_forwards_all_params(monkeypatch):
    """POST /api/v1/ai/chat 透传 session_id/model/tools/max_iterations。"""
    result = _make_result(session_id="custom-sess")
    fake_service = MagicMock()
    fake_service.chat = AsyncMock(return_value=result)
    fake_service.result_to_dict = MagicMock(
        return_value={"session_id": "custom-sess"}
    )
    monkeypatch.setattr(chat, "conversation_service", fake_service)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/ai/chat",
            json={
                "message": "test",
                "session_id": "custom-sess",
                "model": "claude-3",
                "tools": ["search", "calc"],
                "max_iterations": 7,
            },
        )

    assert resp.status_code == 200
    call_kwargs = fake_service.chat.call_args.kwargs
    assert call_kwargs["session_id"] == "custom-sess"
    assert call_kwargs["model"] == "claude-3"
    assert call_kwargs["allowed_tools"] == ["search", "calc"]
    assert call_kwargs["max_iterations"] == 7


# =============================================================================
# 端点:chat 异常路径
# =============================================================================


async def test_chat_endpoint_exception_returns_500(monkeypatch):
    """conversation_service.chat 抛异常 → code=500 + data.error。"""
    fake_service = MagicMock()
    fake_service.chat = AsyncMock(side_effect=RuntimeError("service down"))
    monkeypatch.setattr(chat, "conversation_service", fake_service)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/ai/chat", json={"message": "x"})

    assert resp.status_code == 200  # 异常被捕获,返回 200 + code=500
    data = resp.json()
    assert data["code"] == 500
    assert "对话失败" in data["message"]
    assert "service down" in data["data"]["error"]


async def test_chat_endpoint_minimal_request(monkeypatch):
    """最小请求体(只有 message) → 走默认参数路径。"""
    result = _make_result()
    fake_service = MagicMock()
    fake_service.chat = AsyncMock(return_value=result)
    fake_service.result_to_dict = MagicMock(return_value={"ok": True})
    monkeypatch.setattr(chat, "conversation_service", fake_service)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/ai/chat", json={"message": "minimal"})

    assert resp.status_code == 200
    assert resp.json()["code"] == 0
    call_kwargs = fake_service.chat.call_args.kwargs
    assert call_kwargs["user_input"] == "minimal"
    assert call_kwargs["session_id"] is None
    assert call_kwargs["model"] is None
    assert call_kwargs["allowed_tools"] is None
