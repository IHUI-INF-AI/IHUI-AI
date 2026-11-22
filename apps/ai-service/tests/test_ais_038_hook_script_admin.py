# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-038 回归:PATCH /hooks 不得让普通用户把动作改成 script。

票面缺陷:update 分支只做 `_validate_action`(白名单),漏掉 create 分支的
`_is_admin` 校验;任意登录用户可把自有 Hook 的 action.type 改成 script,
触发时以服务账号 `sh -c` / `cmd /c` 执行 → 任意命令执行。

本文件钉四件事:
① 普通用户 PATCH 自有 Hook 为 script ⇒ 403,且引擎 update 一次都不调用;
② 管理员 PATCH script ⇒ 200,且 patch 落到引擎(allow_script=True);
③ 普通用户 PATCH webhook ⇒ 仍 200(闸只拦 script,不误伤);
④ 引擎第二道闸:`update_hook` 默认 allow_script=False(fail-closed),
   非管理员直接改 script 被拒且动作保持原样。

身份模拟:端点用 `Depends(get_current_user_id)` 读 `request.state.user_id`,
这里用 ASGI 中间件按请求头注入 user_id/role_id,与 JWT 中间件同一条通道;
hook_engine 整体替换为假对象,不连 DB/Redis/外网。
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.routers import hooks as hooks_router
from app.services.hook_engine import HookEngine


def _make_app() -> FastAPI:
    """最小 app + 身份注入中间件(等价 JWT 中间件写 request.state)。"""
    app = FastAPI()

    @app.middleware("http")
    async def _inject_identity(request: Request, call_next):
        user_id = request.headers.get("x-test-user")
        role_id = request.headers.get("x-test-role", "0")
        if user_id:
            request.state.user_id = user_id
            request.state.role_id = int(role_id)
        return await call_next(request)

    app.include_router(hooks_router.router, prefix="/api")
    return app


@pytest.fixture()
def fake_engine(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """替换 hook_engine,并放行高危白名单以便命中管理员闸。"""
    engine = MagicMock()
    engine.get_hook.return_value = {
        "id": "h1",
        "owner_id": "alice",
        "action": {"type": "log", "config": {}},
    }
    engine.update_hook.return_value = {"id": "h1", "action": {"type": "script"}}
    monkeypatch.setattr(hooks_router, "hook_engine", engine)
    # script 是 HIGH_RISK_ACTIONS;白名单放行后,403 只可能来自管理员闸。
    monkeypatch.setattr(hooks_router, "_action_allowed", lambda _t: True)
    return engine


def _patch(client: TestClient, user: str, role: int, action: dict[str, Any]):
    return client.patch(
        "/api/hooks/h1",
        headers={"x-test-user": user, "x-test-role": str(role)},
        json={"action": action},
    )


def test_non_admin_cannot_patch_action_to_script(fake_engine: MagicMock) -> None:
    """普通用户改自有 Hook 为 script ⇒ 403,引擎 update 未被调用。"""
    with TestClient(_make_app()) as client:
        resp = _patch(
            client,
            user="alice",
            role=0,
            action={"type": "script", "config": {"command": "whoami"}},
        )

    assert resp.status_code == 403
    assert "仅管理员" in resp.json()["detail"]
    fake_engine.update_hook.assert_not_called()


def test_admin_can_patch_action_to_script(fake_engine: MagicMock) -> None:
    """管理员 PATCH script ⇒ 200,patch 写入且 allow_script=True。"""
    with TestClient(_make_app()) as client:
        resp = _patch(
            client,
            user="admin",
            role=1,
            action={"type": "script", "config": {"command": "whoami"}},
        )

    assert resp.status_code == 200
    assert resp.json()["code"] == 0
    fake_engine.update_hook.assert_called_once()
    kwargs = fake_engine.update_hook.call_args.kwargs
    assert kwargs["allow_script"] is True
    patch = fake_engine.update_hook.call_args.args[1]
    assert patch["action"] == {"type": "script", "config": {"command": "whoami"}}


def test_non_admin_can_still_patch_webhook(fake_engine: MagicMock) -> None:
    """普通用户改 webhook ⇒ 仍允许(闸只拦 script,不误伤)。"""
    with TestClient(_make_app()) as client:
        resp = _patch(
            client,
            user="alice",
            role=0,
            action={"type": "webhook", "config": {"url": "https://example.invalid/h"}},
        )

    assert resp.status_code == 200
    assert resp.json()["code"] == 0
    assert fake_engine.update_hook.call_args.kwargs["allow_script"] is False


def test_engine_second_gate_defaults_to_deny_script() -> None:
    """引擎兜底层:不传 allow_script(默认 False)时拒绝改 script。"""
    eng = HookEngine.__new__(HookEngine)
    eng._hooks = {
        "h1": {
            "id": "h1",
            "name": "n",
            "event": "tool.before",
            "condition": None,
            "action": {"type": "log", "config": {}},
            "enabled": True,
            "owner_id": "alice",
            "createdAt": "x",
            "updatedAt": "x",
        }
    }
    eng._schedule_persist_hooks = lambda: None  # type: ignore[method-assign]

    result = eng.update_hook(
        "h1", {"action": {"type": "script", "config": {"command": "whoami"}}}
    )

    assert result is None
    assert eng._hooks["h1"]["action"]["type"] == "log"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
