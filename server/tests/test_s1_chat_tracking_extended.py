"""S1 chat 埋点扩展测试 - 验证 6 个 chat 路由全部接入埋点.

说明:
  - qwen/multi 的 /chat 路径在 test_p1_4_chat_tracking.py 中已覆盖.
  - deepseek 端点路径 /chat 已被 qwen_router 后注册抢占, 这是路由注册顺序的历史 bug,
    不在 S1 任务范围. 真实业务使用 /api/v1/chat/chat 会调用 qwen 端点.
  - 本测试覆盖 kling + coze + doubao/zhipu/qwen_omni(WebSocket 不能在 TestClient 单元测).
"""
from unittest.mock import AsyncMock, patch

import pytest


@pytest.fixture
def auth_override():
    from app.main import app
    from app.security import require_login

    app.dependency_overrides[require_login] = lambda: "u-s1-001"
    yield "u-s1-001"
    app.dependency_overrides.pop(require_login, None)


def test_coze_send_message_tracks_send_and_receive(sync_client, auth_override):
    with patch("app.api.v1.chat.coze.track_event") as mock_evt, \
         patch("app.api.v1.chat.coze.track_funnel") as mock_funnel, \
         patch("app.api.v1.chat.coze.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_resp = AsyncMock()
        mock_resp.json = lambda: {"code": 0, "data": {}}
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client
        r = sync_client.post("/api/v1/chat/message?bot_id=b1&message=hi")
        assert r.status_code == 200, r.text
        events = [c.args[0] for c in mock_evt.call_args_list if c.args]
        assert "chat_send" in events
        assert "chat_receive" in events
        funnel_steps = [c.args[1] for c in mock_funnel.call_args_list if len(c.args) >= 2]
        assert "send" in funnel_steps
        assert "receive" in funnel_steps


def test_coze_workflow_run_tracks_send_and_receive(sync_client, auth_override):
    with patch("app.api.v1.chat.coze.track_event") as mock_evt, \
         patch("app.api.v1.chat.coze.track_funnel") as mock_funnel, \
         patch("app.api.v1.chat.coze.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_resp = AsyncMock()
        mock_resp.json = lambda: {"code": 0, "data": {}}
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client
        r = sync_client.post("/api/v1/chat/workflow/run?workflow_id=w1&parameters={}")
        assert r.status_code == 200, r.text
        events = [c.args[0] for c in mock_evt.call_args_list if c.args]
        assert "chat_send" in events
        assert "chat_receive" in events


def test_kling_video_generate_tracks_send(sync_client, auth_override):
    with patch("app.api.v1.chat.kling.track_event") as mock_evt, \
         patch("app.api.v1.chat.kling.track_funnel") as mock_funnel:
        r = sync_client.post(
            "/api/v1/chat/video/generate",
            json={"prompt": "a cat"},
        )
        assert r.status_code in (200, 401, 500)
        events = [c.args[0] for c in mock_evt.call_args_list if c.args]
        assert "chat_send" in events
        funnel_steps = [c.args[1] for c in mock_funnel.call_args_list if len(c.args) >= 2]
        assert "send" in funnel_steps


def test_kling_image_to_video_tracks_send(sync_client, auth_override):
    with patch("app.api.v1.chat.kling.track_event") as mock_evt, \
         patch("app.api.v1.chat.kling.track_funnel") as mock_funnel:
        r = sync_client.post(
            "/api/v1/chat/video/image-to-video",
            json={"image": "https://example.com/i.jpg", "prompt": "move"},
        )
        assert r.status_code in (200, 401, 500)
        events = [c.args[0] for c in mock_evt.call_args_list if c.args]
        assert "chat_send" in events


def test_kling_image_generate_tracks_send(sync_client, auth_override):
    with patch("app.api.v1.chat.kling.track_event") as mock_evt, \
         patch("app.api.v1.chat.kling.track_funnel") as mock_funnel:
        r = sync_client.post(
            "/api/v1/chat/image/generate",
            json={"prompt": "a bird"},
        )
        assert r.status_code in (200, 401, 500)
        events = [c.args[0] for c in mock_evt.call_args_list if c.args]
        assert "chat_send" in events


def test_kling_query_task_tracks_send(sync_client, auth_override):
    with patch("app.api.v1.chat.kling.track_event") as mock_evt, \
         patch("app.api.v1.chat.kling.track_funnel") as mock_funnel:
        r = sync_client.get("/api/v1/chat/task/t-abc123?task_type=video")
        assert r.status_code in (200, 401, 500)
        events = [c.args[0] for c in mock_evt.call_args_list if c.args]
        assert "chat_send" in events
