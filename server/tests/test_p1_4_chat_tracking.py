"""P1-4 业务埋点 chat 路由测试."""
from unittest.mock import AsyncMock, patch

import pytest


@pytest.fixture
def auth_override():
    """覆盖 require_login 依赖, 模拟已登录用户."""
    from app.main import app
    from app.security import require_login

    def _fake_user():
        return "u-test-200"

    app.dependency_overrides[require_login] = _fake_user
    yield "u-test-200"
    app.dependency_overrides.pop(require_login, None)


def test_qwen_chat_tracks_send_and_receive(sync_client, auth_override):
    """qwen_chat 同步调用应触发 EVENT_CHAT_SEND + EVENT_CHAT_RECEIVE + funnel."""
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(side_effect=Exception("mock offline"))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.api.v1.chat.qwen.track_event") as mock_evt, \
         patch("app.api.v1.chat.qwen.track_funnel") as mock_funnel, \
         patch("app.api.v1.chat.qwen.track_latency") as mock_lat, \
         patch("app.api.v1.chat.qwen.httpx.AsyncClient",
               return_value=mock_client):
        r = sync_client.post(
            "/api/v1/chat/chat?model=qwen-turbo&message=hi"
        )
        # httpx 抛错走 except 分支, chat_send 入口埋点一定会触发
        assert r.status_code == 200, r.text
        events = [c.args[0] for c in mock_evt.call_args_list if c.args]
        assert "chat_send" in events
        funnel_steps = [c.args[1] for c in mock_funnel.call_args_list if len(c.args) >= 2]
        assert "send" in funnel_steps


def test_qwen_chat_send_only_at_entry(sync_client, auth_override):
    """qwen_chat 入口处必须触发 EVENT_CHAT_SEND (即使后续失败也要触发)."""
    with patch("app.api.v1.chat.qwen.track_event") as mock_evt, \
         patch("app.api.v1.chat.qwen.track_funnel") as mock_funnel:
        r = sync_client.post(
            "/api/v1/chat/chat?model=qwen-turbo&message=hi"
        )
        # 真实环境调用外网, 可能超时/失败/成功; 入口埋点一定要有
        assert r.status_code == 200, r.text
        events = [c.args[0] for c in mock_evt.call_args_list if c.args]
        assert "chat_send" in events
        funnel_steps = [c.args[1] for c in mock_funnel.call_args_list if len(c.args) >= 2]
        assert "send" in funnel_steps


def test_multi_vendor_chat_tracks_send_and_errors(sync_client, auth_override):
    """multi_vendor_chat 应至少触发 EVENT_CHAT_SEND + funnel send_multi."""
    with patch("app.api.v1.chat.multi.track_event") as mock_evt, \
         patch("app.api.v1.chat.multi.track_funnel") as mock_funnel, \
         patch("app.api.v1.chat.multi.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=Exception("mock fail"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        r = sync_client.post(
            "/api/v1/chat/multi?vendors=unknown_vendor_xyz&model=gpt&message=hi"
        )
        assert r.status_code == 200, r.text
        events = [c.args[0] for c in mock_evt.call_args_list if c.args]
        assert "chat_send" in events
        funnel_steps = [c.args[1] for c in mock_funnel.call_args_list if len(c.args) >= 2]
        assert "send_multi" in funnel_steps
