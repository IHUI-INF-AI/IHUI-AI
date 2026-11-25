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
    normalize_task,
    task_progress,
    task_snapshot,
)


class FakeSession:
    """只保留任务端点用到的方法;任务状态用真实纯逻辑模块算。"""

    def __init__(self) -> None:
        self.task: dict[str, Any] | None = None

    async def start_task(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.task = normalize_task(payload)
        return task_snapshot(self.task)

    async def task_state(self) -> dict[str, Any]:
        return {"task": task_snapshot(self.task), "progress": task_progress(self.task)}

    async def enter_checkpoint(self, checkpoint_id: str) -> dict[str, Any]:
        if self.task is None:
            raise TaskValidationError("task_not_started", "当前会话还没有绑定任务")
        target = find_checkpoint(self.task, checkpoint_id)
        if target is None:
            raise TaskValidationError("checkpoint_not_found", "检查点不存在")
        return {"checkpoint": task_snapshot(self.task)["checkpoints"][0], **await self.task_state()}

    async def resume_checkpoint(self, checkpoint_id: str | None = None) -> dict[str, Any]:
        if self.task is None:
            raise TaskValidationError("task_not_started", "当前会话还没有绑定任务")
        active = active_checkpoint(self.task)
        if checkpoint_id and find_checkpoint(self.task, checkpoint_id) is None:
            raise TaskValidationError("checkpoint_not_found", "检查点不存在")
        return {"checkpoint": active, **await self.task_state()}


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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
