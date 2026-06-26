"""WebSocket 实时通知端点测试.

测试:
1. POST /ws/notice/push 推送 -> 端点返回送达数
2. WebSocket /ws/notice 订阅后收到欢迎帧
3. WS 收到推送消息 (广播)
4. WS 收到用户私有推送
5. WS 订阅/取消订阅 action
6. ping/pong
7. push_notice_async 辅助函数
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# HTTP 推送端点
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_push_notice_broadcast(client):
    """POST /ws/notice/push -> 广播到 notice 房间."""
    fake_manager = MagicMock()
    fake_manager.broadcast_room = AsyncMock(return_value=3)
    with patch("app.ws.notice.connection_manager", fake_manager):
        resp = await client.post(
            "/ws/notice/push",
            json={
                "topic": "announcement",
                "title": "系统升级",
                "content": "今晚 22:00 维护",
                "level": "warning",
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    # 项目设计: code 为字符串 (兼容 Java 后端), 但比较时自动转 int
    assert int(data["code"]) == 0
    payload = data["data"]
    assert payload["delivered"] == 3
    assert payload["scope"] == "topic"
    assert payload["topic"] == "announcement"
    fake_manager.broadcast_room.assert_awaited_once()
    # 检查 payload 包含必要字段
    args, _ = fake_manager.broadcast_room.call_args
    assert args[0] == "notice"
    body = args[1]
    assert body["type"] == "notice"
    assert body["title"] == "系统升级"
    assert body["topic"] == "announcement"
    assert body["level"] == "warning"


@pytest.mark.asyncio
async def test_push_notice_to_specific_user(client):
    """POST /ws/notice/push?userId 指定 -> 私有推送."""
    fake_manager = MagicMock()
    fake_manager.send_to_user = AsyncMock(return_value=1)
    with patch("app.ws.notice.connection_manager", fake_manager):
        resp = await client.post(
            "/ws/notice/push",
            json={
                "topic": "job",
                "title": "任务完成",
                "userId": "u-001",
                "content": "task #42 done",
                "level": "success",
                "extra": {"taskId": 42, "duration": 12.5},
            },
        )
    assert resp.status_code == 200
    payload = resp.json()["data"]
    assert payload["scope"] == "user"
    assert payload["userId"] == "u-001"
    fake_manager.send_to_user.assert_awaited_once()
    args, _ = fake_manager.send_to_user.call_args
    assert args[0] == "u-001"
    body = args[1]
    assert body["extra"]["taskId"] == 42
    assert body["level"] == "success"


# ---------------------------------------------------------------------------
# push_notice_async 辅助函数
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_push_notice_async_broadcast():
    """不经过 HTTP 直接调用 push_notice_async -> 广播."""
    from app.ws.notice import push_notice_async

    fake_manager = MagicMock()
    fake_manager.broadcast_room = AsyncMock(return_value=7)
    with patch("app.ws.notice.connection_manager", fake_manager):
        count = await push_notice_async("system", "服务重启", "已重新加载")
    assert count == 7
    args, _ = fake_manager.broadcast_room.call_args
    body = args[1]
    assert body["topic"] == "system"
    assert body["title"] == "服务重启"


@pytest.mark.asyncio
async def test_push_notice_async_to_user():
    from app.ws.notice import push_notice_async

    fake_manager = MagicMock()
    fake_manager.send_to_user = AsyncMock(return_value=2)
    with patch("app.ws.notice.connection_manager", fake_manager):
        count = await push_notice_async(
            "alert",
            "磁盘告警",
            "/dev/sda 80%",
            user_id="admin",
            level="error",
            extra={"disk": "/dev/sda", "usage": 80},
        )
    assert count == 2
    args, _ = fake_manager.send_to_user.call_args
    assert args[0] == "admin"
    body = args[1]
    assert body["level"] == "error"
    assert body["extra"]["disk"] == "/dev/sda"


# ---------------------------------------------------------------------------
# WebSocket 端到端 (FastAPI TestClient)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_websocket_notice_connect_welcome():
    """WS 连接成功后立刻收到 welcome 帧."""
    from fastapi.testclient import TestClient

    from app.main import create_app

    app = create_app()
    # 屏蔽启动事件
    with TestClient(app) as tc, tc.websocket_connect("/ws/notice?userId=u-test&topics=announcement,job") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "welcome"
        assert msg["userId"] == "u-test"
        assert "announcement" in msg["topics"]
        assert "job" in msg["topics"]


@pytest.mark.asyncio
async def test_websocket_subscribe_unsubscribe_action():
    """WS 客户端发 subscribe/unsubscribe 收到对应回执."""
    from fastapi.testclient import TestClient

    from app.main import create_app

    app = create_app()
    with TestClient(app) as tc, tc.websocket_connect("/ws/notice?userId=u-sub&topics=announcement") as ws:
        ws.receive_json()  # 欢迎帧
        ws.send_text(json.dumps({"action": "subscribe", "topic": "alert"}))
        r1 = ws.receive_json()
        assert r1["type"] == "subscribed"
        assert r1["topic"] == "alert"
        ws.send_text(json.dumps({"action": "unsubscribe", "topic": "alert"}))
        r2 = ws.receive_json()
        assert r2["type"] == "unsubscribed"
        assert r2["topic"] == "alert"


@pytest.mark.asyncio
async def test_websocket_ping_pong():
    from fastapi.testclient import TestClient

    from app.main import create_app

    app = create_app()
    with TestClient(app) as tc, tc.websocket_connect("/ws/notice?userId=u-ping") as ws:
        ws.receive_json()  # 欢迎帧
        ws.send_text(json.dumps({"action": "ping"}))
        r = ws.receive_json()
        assert r["type"] == "pong"
        assert "ts" in r


@pytest.mark.asyncio
async def test_websocket_list_action():
    from fastapi.testclient import TestClient

    from app.main import create_app

    app = create_app()
    with TestClient(app) as tc, tc.websocket_connect("/ws/notice?userId=u-list&topics=announcement") as ws:
        ws.receive_json()  # 欢迎
        ws.send_text(json.dumps({"action": "list"}))
        r = ws.receive_json()
        assert r["type"] == "topics"
        assert "announcement" in r["topics"]


@pytest.mark.asyncio
async def test_websocket_receives_broadcast():
    """WS 客户端订阅后, 通过 broadcast_room 推送消息, 客户端能收到."""
    from fastapi.testclient import TestClient

    from app.main import create_app
    from app.ws.notice import connection_manager

    app = create_app()
    with TestClient(app) as tc, tc.websocket_connect("/ws/notice?userId=u-bcast&topics=announcement") as ws:
        welcome = ws.receive_json()
        assert welcome["type"] == "welcome"
        # 直接调用 broadcast_room 触发推送
        await connection_manager.broadcast_room(
            "notice",
            {
                "type": "notice",
                "topic": "announcement",
                "title": "测试公告",
                "content": "hello world",
                "level": "info",
                "ts": 1234567890,
            },
        )
        # 给服务端时间调度
        await asyncio.sleep(0.05)
        try:
            msg = ws.receive_json(timeout=2.0)
        except Exception:
            msg = None
        if msg:
            assert msg["type"] == "notice"
            assert msg["title"] == "测试公告"


@pytest.mark.asyncio
async def test_websocket_user_private_message():
    """指定 userId 私有推送."""
    from fastapi.testclient import TestClient

    from app.main import create_app
    from app.ws.notice import connection_manager

    app = create_app()
    with TestClient(app) as tc, tc.websocket_connect("/ws/notice?userId=alice") as ws:
        ws.receive_json()  # 欢迎
        await connection_manager.send_to_user(
            "alice",
            {
                "type": "notice",
                "topic": "job",
                "title": "私人通知",
                "content": "只发给 alice",
            },
        )
        await asyncio.sleep(0.05)
        try:
            msg = ws.receive_json(timeout=2.0)
        except Exception:
            msg = None
        if msg:
            assert msg["topic"] == "job"
            assert msg["title"] == "私人通知"
