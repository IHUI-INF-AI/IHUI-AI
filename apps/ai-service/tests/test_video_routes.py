# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""app/routers/video.py 越权收敛 + 回调 fail-closed 单元测试(2026-09-09 P0/P1)。

背景:video.py 与 media_tasks 修复前同款 IDOR——列表 user_uuid 缺省查全部、
详情/取消无归属校验、创建端 user_uuid 客户端可控;两个 token6688 回调端点
(JWT 公开白名单)密钥为空时跳过验签继续处理 = 匿名可伪造任务终态。

测试覆盖:
- GET  /video/tasks:非 admin 强制按当前用户过滤;admin 可显式传 user_uuid
- GET  /video/tasks/{id}:归属放行 / 不归属 404 不泄露存在性
- POST /video/task:非 admin 强制当前用户(客户端传啥都不认);admin 可指定
- POST /video/token6688-cancel/{id}:归属放行 / 不归属 404
- POST /video/token6688-callback:密钥未配置 503 fail-closed / 验签失败 401 /
  合法签名 200

测试隔离:monkeypatch get_db_conn(假 conn)/ dependency_overrides 注入身份 /
handle_token6688_callback 假实现,不触网不触库。
"""
from __future__ import annotations

import hashlib
import hmac
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.routers import video as video_router


@pytest.fixture(autouse=True)
def _bypass_jwt(monkeypatch):
    """隔离 JWT 中间件:清空 jwt_secret → middleware 走跳过路径。"""
    from app.core.config import settings

    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")


def _override_scope(monkeypatch, user_id: str, is_admin: bool) -> None:
    """dependency_overrides 注入身份(app.main.app 是 socketio 包装,真实例是 fastapi_app)。"""
    from app.main import fastapi_app

    monkeypatch.setitem(
        fastapi_app.dependency_overrides,
        video_router._user_scope,
        lambda: (user_id, is_admin),
    )


class _FakeConn:
    """假 pg 连接:fetch/fetchval/close 全 AsyncMock。"""

    def __init__(self, fetch=None, fetchval=None):
        self.fetch = fetch or AsyncMock(return_value=[])
        self.fetchval = fetchval or AsyncMock(return_value=None)
        self.close = AsyncMock()


def _patch_db(monkeypatch, conn: _FakeConn) -> None:
    monkeypatch.setattr(
        video_router, "get_db_conn", AsyncMock(return_value=conn)
    )


class TestVideoTaskListScope:
    """GET /video/tasks 列表按身份收敛。"""

    async def test_non_admin_forced_to_own(self, client, monkeypatch):
        conn = _FakeConn()
        _patch_db(monkeypatch, conn)
        _override_scope(monkeypatch, "u1", False)
        resp = await client.get("/api/video/tasks?user_uuid=someone-else")
        assert resp.status_code == 200
        args = conn.fetch.call_args.args
        # WHERE 里强制 user_uuid=u1(忽略客户端传参),不是 someone-else
        assert "u1" in args
        assert "someone-else" not in args

    async def test_admin_can_query_explicit_user(self, client, monkeypatch):
        conn = _FakeConn()
        _patch_db(monkeypatch, conn)
        _override_scope(monkeypatch, "admin1", True)
        resp = await client.get("/api/video/tasks?user_uuid=target-user")
        assert resp.status_code == 200
        args = conn.fetch.call_args.args
        assert "target-user" in args


class TestVideoTaskDetailScope:
    """GET /video/tasks/{task_id} 归属校验。"""

    async def test_owner_can_read(self, client, monkeypatch):
        row = {"id": 1, "task_id": "t1", "user_uuid": "u1", "status": "accepted",
               "message": "", "result": None, "updated_at": None}
        conn = _FakeConn(fetch=AsyncMock(return_value=[row]))
        _patch_db(monkeypatch, conn)
        _override_scope(monkeypatch, "u1", False)
        resp = await client.get("/api/video/tasks/t1")
        assert resp.status_code == 200
        assert resp.json()["data"]["task_id"] == "t1"

    async def test_non_owner_gets_404(self, client, monkeypatch):
        row = {"id": 1, "task_id": "t1", "user_uuid": "owner-x", "status": "accepted",
               "message": "", "result": None, "updated_at": None}
        conn = _FakeConn(fetch=AsyncMock(return_value=[row]))
        _patch_db(monkeypatch, conn)
        _override_scope(monkeypatch, "u1", False)
        resp = await client.get("/api/video/tasks/t1")
        assert resp.status_code == 404

    async def test_admin_can_read_any(self, client, monkeypatch):
        row = {"id": 1, "task_id": "t1", "user_uuid": "owner-x", "status": "accepted",
               "message": "", "result": None, "updated_at": None}
        conn = _FakeConn(fetch=AsyncMock(return_value=[row]))
        _patch_db(monkeypatch, conn)
        _override_scope(monkeypatch, "admin1", True)
        resp = await client.get("/api/video/tasks/t1")
        assert resp.status_code == 200


class TestVideoTaskCreateScope:
    """POST /video/task 创建端 user_uuid 收敛。"""

    async def test_non_admin_forced_to_current_user(self, client, monkeypatch):
        conn = _FakeConn(fetch=AsyncMock(return_value=[{"id": 1, "status": "accepted"}]))
        _patch_db(monkeypatch, conn)
        _override_scope(monkeypatch, "u1", False)
        resp = await client.post(
            "/api/video/task",
            json={"prompt": "p", "user_uuid": "impersonated"},
        )
        assert resp.status_code == 200
        args = conn.fetch.call_args.args
        # INSERT 参数序:($1 sql, $2 task_id, $3 user_uuid, $4 chat_id, $5 prompt)
        assert args[2] == "u1"  # user_uuid 强制当前用户
        assert args[2] != "impersonated"

    async def test_admin_can_specify_user(self, client, monkeypatch):
        conn = _FakeConn(fetch=AsyncMock(return_value=[{"id": 1, "status": "accepted"}]))
        _patch_db(monkeypatch, conn)
        _override_scope(monkeypatch, "admin1", True)
        resp = await client.post(
            "/api/video/task",
            json={"prompt": "p", "user_uuid": "delegated-user"},
        )
        assert resp.status_code == 200
        assert conn.fetch.call_args.args[2] == "delegated-user"


class TestVideoToken6688CancelScope:
    """POST /video/token6688-cancel/{task_id} 归属校验。"""

    async def test_non_owner_gets_404(self, client, monkeypatch):
        conn = _FakeConn(fetchval=AsyncMock(return_value="owner-x"))
        _patch_db(monkeypatch, conn)
        _override_scope(monkeypatch, "u1", False)
        resp = await client.post("/api/video/token6688-cancel/t1")
        assert resp.status_code == 404

    async def test_owner_passes_guard(self, client, monkeypatch):
        from app.core.config import settings

        conn = _FakeConn(fetchval=AsyncMock(return_value="u1"))
        _patch_db(monkeypatch, conn)
        _override_scope(monkeypatch, "u1", False)
        # pydantic Settings 实例不能 setattr 非字段 → patch 类级别方法
        monkeypatch.setattr(
            type(settings),
            "get_provider_config",
            lambda self, name: SimpleNamespace(api_key="sk-test", api_base="https://x"),
        )

        fake_provider = SimpleNamespace(
            cancel_task=AsyncMock(return_value={"ok": True, "status": "cancelled"}),
        )
        monkeypatch.setattr(
            "app.providers.token6688_provider.Token6688Provider",
            lambda **kw: fake_provider,
        )
        resp = await client.post("/api/video/token6688-cancel/t1")
        assert resp.status_code == 200
        fake_provider.cancel_task.assert_awaited_once_with("t1")

    async def test_unknown_task_non_admin_404(self, client, monkeypatch):
        conn = _FakeConn(fetchval=AsyncMock(return_value=None))
        _patch_db(monkeypatch, conn)
        _override_scope(monkeypatch, "u1", False)
        resp = await client.post("/api/video/token6688-cancel/no-such")
        assert resp.status_code == 404


class TestToken6688CallbackFailClosed:
    """POST /video/token6688-callback 验签 fail-closed(JWT 公开端点)。"""

    async def test_missing_secret_rejected_503(self, client, monkeypatch):
        monkeypatch.delenv("TOKEN6688_CALLBACK_SECRET", raising=False)
        resp = await client.post(
            "/api/video/token6688-callback",
            json={"task_id": "t1", "state": "success"},
        )
        assert resp.status_code == 503

    async def test_bad_signature_401(self, client, monkeypatch):
        monkeypatch.setenv("TOKEN6688_CALLBACK_SECRET", "sec")
        resp = await client.post(
            "/api/video/token6688-callback",
            json={"task_id": "t1", "state": "success"},
            headers={"X-TokenGo-Signature": "sha256=deadbeef"},
        )
        assert resp.status_code == 401

    async def test_valid_signature_processed(self, client, monkeypatch):
        secret = "sec"
        monkeypatch.setenv("TOKEN6688_CALLBACK_SECRET", secret)
        body = json.dumps({"task_id": "t1", "state": "success"}).encode()
        sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        monkeypatch.setattr(
            video_router,
            "handle_token6688_callback",
            AsyncMock(return_value={"ok": True, "matched": 1, "ignored": 0}),
        )
        resp = await client.post(
            "/api/video/token6688-callback",
            content=body,
            headers={
                "X-TokenGo-Signature": sig,
                "X-TokenGo-Event": "task.completed",
                "Content-Type": "application/json",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
