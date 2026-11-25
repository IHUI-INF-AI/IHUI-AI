# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器任务端点路由级测试(2026-11-25 补)。

此前任务协议只有会话层测试,没有真正过 FastAPI 的请求体校验/状态码/响应形状。
这里用独立 app 挂载同一份 router,只替换 ``hub.require_tab`` 与当前用户依赖,
走真实 ``TestClient`` 同款的 ASGI 请求链路。
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from starlette.testclient import TestClient

from app.core.jwt_auth import get_current_user_id
from app.routers import browser_hub as browser_hub_router
from app.services.browser_hub import (
    TAB_SCOPE_OWNER_MISMATCH,
    BrowserTabScopeError,
)
from app.services.browser_task import (
    TaskValidationError,
    active_checkpoint,
    find_checkpoint,
    mark_checkpoint_active,
    mark_checkpoint_done,
    normalize_task,
    task_progress,
    task_snapshot,
)


class FakeSession:
    """只保留端点用到的方法;任务状态用真实纯逻辑模块算。"""

    def __init__(self) -> None:
        self.task: dict[str, Any] | None = None

    async def start_task(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.task = normalize_task(payload)
        return task_snapshot(self.task)

    async def clear_task(self) -> None:
        self.task = None

    async def task_state(self) -> dict[str, Any]:
        return {"task": task_snapshot(self.task), "progress": task_progress(self.task)}

    def _checkpoint_snapshot(self, checkpoint_id: str | None) -> dict[str, Any] | None:
        if self.task is None:
            return None
        snap = task_snapshot(self.task) or {}
        for cp in snap.get("checkpoints") or []:
            if checkpoint_id is None or cp.get("id") == checkpoint_id:
                return cp
        return None

    async def enter_checkpoint(self, checkpoint_id: str, _reason: str | None = None) -> dict[str, Any]:
        if self.task is None:
            raise TaskValidationError("task_not_started", "当前会话还没有绑定任务")
        if find_checkpoint(self.task, checkpoint_id) is None:
            raise TaskValidationError("checkpoint_not_found", "检查点不存在")
        mark_checkpoint_active(self.task, checkpoint_id)
        return {
            "checkpoint": self._checkpoint_snapshot(checkpoint_id),
            **await self.task_state(),
        }

    async def resume_checkpoint(self, checkpoint_id: str | None = None) -> dict[str, Any]:
        if self.task is None:
            raise TaskValidationError("task_not_started", "当前会话还没有绑定任务")
        if checkpoint_id and find_checkpoint(self.task, checkpoint_id) is None:
            raise TaskValidationError("checkpoint_not_found", "检查点不存在")
        target = checkpoint_id
        if target is None:
            active = active_checkpoint(self.task)
            target = active.get("id") if active else None
        if target:
            mark_checkpoint_done(self.task, target)
        return {
            "checkpoint": self._checkpoint_snapshot(target),
            **await self.task_state(),
        }

    # --- WS 端点登记/摘除回调的最小接口(本测试只关心任务消息分支) ---
    async def set_navigation_handler(self, _handler) -> None:
        return None

    async def remove_navigation_handler(self, _handler) -> None:
        return None

    async def set_phase_handler(self, _handler) -> None:
        return None

    async def remove_phase_handler(self, _handler) -> None:
        return None

    async def set_task_handler(self, _handler) -> None:
        return None

    async def remove_task_handler(self, _handler) -> None:
        return None

    async def set_checkpoint_handler(self, _handler) -> None:
        return None

    async def remove_checkpoint_handler(self, _handler) -> None:
        return None

    async def start_screencast(self, _on_frame) -> None:
        return None

    async def remove_frame_handler(self, _handler) -> None:
        return None

    async def get_title(self) -> str:
        return "fake"

    session_id = "tab-1"

    async def get_current_url(self) -> str:
        return "https://example.com/"

    async def get_cookies(self, _urls=None):
        return []

    async def go_back(self) -> bool:
        return True

    async def go_forward(self) -> bool:
        return True

    async def reload_with_recovery(self) -> bool:
        return False


@pytest.fixture
def route_app(monkeypatch):
    session = FakeSession()
    monkeypatch.setattr(browser_hub_router.hub, "require_tab", lambda scope: session)
    app = FastAPI()
    app.include_router(browser_hub_router.router, prefix="/api")
    app.dependency_overrides[get_current_user_id] = lambda: "u-route"
    return app, session


@pytest.fixture
async def api(route_app):
    app, _session = route_app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


async def test_templates_route_returns_all_builtins(api):
    res = await api.get("/api/browser/task-templates")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["count"] == 4
    assert {item["id"] for item in data["templates"]} == {
        "login-handoff",
        "form-commit",
        "payment-confirm",
        "download-export",
    }
    for template in data["templates"]:
        keys = [cp.get("label_key") for cp in template["checkpoints"]]
        assert all(key and key.startswith("ck_") for key in keys)
        assert 60 <= template["checkpoint_timeout_seconds"] <= 3600
    by_id = {item["id"]: item for item in data["templates"]}
    assert by_id["payment-confirm"]["checkpoint_timeout_seconds"] == 300
    assert by_id["download-export"]["checkpoint_timeout_seconds"] == 1800


async def test_list_sessions_route_returns_string_message_envelope(api, monkeypatch):
    """GET /sessions 的包络必须带 string message。

    2026-11-25 真机取证:此前缺 message,前端严格包络校验判「message 必须是 string」,
    自动监看轮询静默失败,新会话不会自动弹窗。
    """
    monkeypatch.setattr(browser_hub_router.hub, "list_sessions", lambda user_id: ["tab-a"])
    monkeypatch.setattr(browser_hub_router.hub, "session_count_for", lambda user_id: 1)
    res = await api.get("/api/browser/sessions")
    assert res.status_code == 200
    payload = res.json()
    assert isinstance(payload["message"], str) and payload["message"]
    assert payload["data"] == {"session_ids": ["tab-a"], "count": 1}


async def test_browser_routes_keep_string_message_envelope(api):
    """其余 browser_hub 包络也必须带 string message,避免同类严格校验失败。"""
    get_paths = [
        "/api/browser/task-templates",
        "/api/browser/sessions/tab-1",
        "/api/browser/sessions/tab-1/cookies",
        "/api/browser/sessions/tab-1/task",
    ]
    for path in get_paths:
        res = await api.get(path)
        assert res.status_code == 200, path
        payload = res.json()
        assert isinstance(payload["message"], str) and payload["message"], path

    for path in ("back", "forward"):
        res = await api.post(f"/api/browser/sessions/tab-1/{path}")
        assert res.status_code == 200, path
        payload = res.json()
        assert isinstance(payload["message"], str) and payload["message"], path


async def test_bind_template_route_expands_goal_and_checkpoints(api):
    res = await api.post(
        "/api/browser/sessions/tab-1/task",
        json={"template_id": "payment-confirm"},
    )
    assert res.status_code == 200
    task = res.json()["data"]["task"]
    assert task["template_id"] == "payment-confirm"
    assert task["goal"].startswith("走到结算页")
    assert [cp["id"] for cp in task["checkpoints"]] == ["checkout", "pay", "done"]
    assert task["checkpoints"][1]["label_key"] == "ck_payment_confirm_pay"
    assert task["checkpoint_timeout_seconds"] == 300


async def test_bind_template_can_override_checkpoint_timeout(api):
    res = await api.post(
        "/api/browser/sessions/tab-1/task",
        json={"template_id": "payment-confirm", "checkpoint_timeout_seconds": 120},
    )
    assert res.status_code == 200
    assert res.json()["data"]["task"]["checkpoint_timeout_seconds"] == 120


async def test_bind_custom_task_keeps_explicit_checkpoint_timeout(api):
    res = await api.post(
        "/api/browser/sessions/tab-1/task",
        json={
            "goal": "自定义导出",
            "checkpoints": [{"id": "export", "label": "导出"}],
            "checkpoint_timeout_seconds": 60,
        },
    )
    assert res.status_code == 200
    assert res.json()["data"]["task"]["checkpoint_timeout_seconds"] == 60


async def test_bind_out_of_range_checkpoint_timeout_returns_400(api):
    res = await api.post(
        "/api/browser/sessions/tab-1/task",
        json={
            "goal": "自定义导出",
            "checkpoints": [{"id": "export", "label": "导出"}],
            "checkpoint_timeout_seconds": 30,
        },
    )
    assert res.status_code == 400
    assert res.json()["detail"].startswith("task_invalid_checkpoint_timeout:")


async def test_bind_invalid_goal_returns_400_named_code(api):
    res = await api.post(
        "/api/browser/sessions/tab-1/task",
        json={"goal": "", "checkpoints": [{"id": "a", "label": "A"}]},
    )
    assert res.status_code == 400
    assert res.json()["detail"].startswith("task_invalid_goal:")


async def test_read_task_route_returns_null_before_binding(api):
    res = await api.get("/api/browser/sessions/tab-1/task")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["task"] is None
    assert data["progress"]["done"] == 0


async def test_checkpoint_route_rejects_unknown_id(api):
    await api.post(
        "/api/browser/sessions/tab-1/task",
        json={"goal": "导出", "checkpoints": [{"id": "export", "label": "导出"}]},
    )
    res = await api.post(
        "/api/browser/sessions/tab-1/checkpoint",
        json={"action": "enter", "checkpoint_id": "nope"},
    )
    assert res.status_code == 400
    assert res.json()["detail"].startswith("checkpoint_not_found:")


async def test_cross_owner_route_is_404_not_403(api, monkeypatch):
    def deny(_scope):
        raise BrowserTabScopeError(TAB_SCOPE_OWNER_MISMATCH, "tab-1")

    monkeypatch.setattr(browser_hub_router.hub, "require_tab", deny)
    res = await api.get("/api/browser/sessions/tab-1/task")
    assert res.status_code == 404
    assert res.json()["detail"] == "会话不存在: tab-1"


def test_ws_task_messages_roundtrip(route_app, monkeypatch):
    """WS 任务分支过真实 WebSocket 握手/收发,不只测会话方法。"""
    app, _session = route_app
    monkeypatch.setattr(
        browser_hub_router,
        "verify_access_token",
        lambda token: {"sub": "u-ws"} if token == "good" else None,
    )
    monkeypatch.setattr(
        browser_hub_router, "principal_from_payload", lambda payload: payload.get("sub")
    )

    with TestClient(app) as client:
        with client.websocket_connect("/api/browser/ws/tab-1?token=good") as ws:
            ws.send_json(
                {
                    "type": "task_start",
                    "task": {
                        "goal": "登录后继续",
                        "checkpoints": [{"id": "verify", "label": "验证登录"}],
                    },
                }
            )
            started = ws.receive_json()
            if started["type"] == "navigation":
                # 晚连补发当前地址快照(2026-11-25);任务结果紧随其后。
                started = ws.receive_json()
            assert started["type"] == "task_result"
            assert started["data"]["task"]["goal"] == "登录后继续"

            ws.send_json({"type": "checkpoint_enter", "checkpoint_id": "verify"})
            entered = ws.receive_json()
            assert entered["type"] == "checkpoint_result"
            assert entered["data"]["checkpoint"]["id"] == "verify"
            assert entered["data"]["checkpoint"]["status"] == "active"

            ws.send_json({"type": "checkpoint_resume", "checkpoint_id": "verify"})
            resumed = ws.receive_json()
            assert resumed["type"] == "checkpoint_result"
            assert resumed["data"]["checkpoint"]["status"] == "done"
            assert resumed["data"]["progress"]["done"] == 1

            ws.send_json({"type": "task_clear"})
            cleared = ws.receive_json()
            assert cleared == {"type": "task_result", "data": {"task": None}}

            ws.send_json({"type": "checkpoint_enter"})
            rejected = ws.receive_json()
            assert rejected["type"] == "error"
            assert rejected["code"] == "checkpoint_id_missing"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
