"""P1-2 业务埋点 auth/login/register 测试."""
import time
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def mock_auth_service():
    """为 auth_service 模块注入测试方法 (模块本身只定义了 assert_user_has_role)."""
    from app.services import auth_service

    auth_service.login_by_password = MagicMock()
    auth_service.login_by_sms = MagicMock()
    auth_service.register_user = MagicMock()
    return auth_service


def test_login_tracks_event_on_success(sync_client, mock_auth_service):
    """登录成功应触发 EVENT_USER_LOGIN + funnel login_success."""
    mock_auth_service.login_by_password.return_value = {
        "success": True, "data": {"user_id": "u-100", "token": "x"}
    }
    with patch("app.api.v1.auth.login.track_event") as mock_evt, \
         patch("app.api.v1.auth.login.track_funnel") as mock_funnel:
        r = sync_client.post("/api/v1/auth/auth/login?phone=13800000000&password=pwd123")
        assert r.status_code == 200, r.text
        events = [c.args[0] for c in mock_evt.call_args_list if c.args]
        assert "user_login" in events
        funnel_steps = [c.args[1] for c in mock_funnel.call_args_list if len(c.args) >= 2]
        assert "login_submit" in funnel_steps
        assert "login_success" in funnel_steps


def test_login_tracks_failed_event(sync_client, mock_auth_service):
    """登录失败应触发 user_login_failed."""
    mock_auth_service.login_by_password.return_value = {"success": False, "msg": "密码错误"}
    with patch("app.api.v1.auth.login.track_event") as mock_evt:
        r = sync_client.post("/api/v1/auth/auth/login?phone=13800000000&password=wrong")
        assert r.status_code in (200, 401)
        events = [c.args[0] for c in mock_evt.call_args_list if c.args]
        assert "user_login_failed" in events


def test_register_tracks_event_on_success(sync_client, mock_auth_service):
    """注册成功应触发 EVENT_USER_REGISTER + funnel register_success."""
    mock_auth_service.register_user.return_value = {
        "success": True, "data": {"user_id": "u-200"}
    }
    with patch("app.api.v1.auth.login.track_event") as mock_evt, \
         patch("app.api.v1.auth.login.track_funnel") as mock_funnel:
        r = sync_client.post(
            "/api/v1/auth/auth/register?phone=13800000000&password=pwd&nickname=test"
        )
        assert r.status_code == 200, r.text
        events = [c.args[0] for c in mock_evt.call_args_list if c.args]
        assert "user_register_attempt" in events
        assert "user_register" in events
        funnel_steps = [c.args[1] for c in mock_funnel.call_args_list if len(c.args) >= 2]
        assert "register_success" in funnel_steps


def test_register_tracks_failed_event(sync_client, mock_auth_service):
    """注册失败应触发 user_register_failed."""
    mock_auth_service.register_user.return_value = {"success": False, "msg": "手机号已存在"}
    with patch("app.api.v1.auth.login.track_event") as mock_evt:
        r = sync_client.post("/api/v1/auth/auth/register?phone=13800000000&password=pwd")
        events = [c.args[0] for c in mock_evt.call_args_list if c.args]
        assert "user_register_failed" in events

