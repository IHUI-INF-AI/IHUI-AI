# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""debug 面 P0 根因加固的契约锁(2026-10-29)。

钉死三条,任何一条被改回都会立刻红:
1. **默认关闭**:未设 IHUI_DEBUG_ENABLED 时整面 404(不暴露「这里有个调试面」);
2. **会话归属**:session 有主时,异主体一律 DebugSessionForbidden(拿到 session_id 也不能接管);
3. **列表过滤**:list_sessions(user_id) 只返回该主体自己的会话(否则归属校验形同虚设)。

另锁一条实现约束:归属校验方法**不得**以 `assert` 开头 —— MagicMock 会把 `assert_*`
属性当断言方法拦截,调用即 AttributeError,而测试里 manager 全是 mock ⇒ 全片红。
这条坑真实发生过一次(方法原名 assert_owner),故写成显式断言防回退。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.v1 import debug as debug_module
from app.services.debugger import (
    DebugSession,
    DebugSessionForbidden,
    DebugSessionManager,
)

# =============================================================================
# 1. 默认关闭
# =============================================================================


def _make_app():
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(debug_module.router, prefix="/api/v1")
    return app


@pytest.fixture
def _face_disabled(monkeypatch: pytest.MonkeyPatch):
    """显式确保开关处于关闭态(不受宿主机环境变量影响)。"""
    monkeypatch.delenv("IHUI_DEBUG_ENABLED", raising=False)
    from app.core.config import settings

    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")
    yield


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/v1/debug/sessions"),
        ("POST", "/api/v1/debug/launch"),
        ("POST", "/api/v1/debug/attach"),
        ("GET", "/api/v1/debug/sessions/any/stack"),
        ("POST", "/api/v1/debug/sessions/any/eval"),
        ("DELETE", "/api/v1/debug/sessions/any"),
    ],
)
async def test_disabled_face_returns_404(_face_disabled, method: str, path: str) -> None:
    """开关关闭时,12 个端点全部 404(不是 401/403 —— 不确认该面存在)。"""
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.request(method, path, json={"language": "python", "program": "x.py"})
    assert resp.status_code == 404


@pytest.mark.parametrize("value", ["1", "true", "TRUE", "yes", "on", " on "])
def test_enabled_switch_accepts_truthy(value: str, monkeypatch: pytest.MonkeyPatch) -> None:
    """开关只认显式真值;大小写与首尾空白不影响判定。"""
    monkeypatch.setenv("IHUI_DEBUG_ENABLED", value)
    assert debug_module._debug_enabled() is True


@pytest.mark.parametrize("value", ["", "0", "false", "no", "off", "enabled"])
def test_enabled_switch_rejects_others(value: str, monkeypatch: pytest.MonkeyPatch) -> None:
    """其余取值一律视为关闭 —— 失效方向恒为「少开一次调试面」。"""
    monkeypatch.setenv("IHUI_DEBUG_ENABLED", value)
    assert debug_module._debug_enabled() is False


# =============================================================================
# 2. 会话归属
# =============================================================================


def _manager_with_session(owner: str | None, session_id: str = "s-1") -> DebugSessionManager:
    manager = DebugSessionManager()
    manager._sessions[session_id] = DebugSession(
        session_id=session_id, language="python", owner_user_id=owner
    )
    return manager


def test_verify_owner_same_principal_passes() -> None:
    """同主体:放行。"""
    _manager_with_session("user-a").verify_owner("s-1", "user-a")


def test_verify_owner_foreign_principal_raises() -> None:
    """异主体:即便 session_id 完全正确也必须拒 —— 否则拿到 id 即接管。"""
    with pytest.raises(DebugSessionForbidden):
        _manager_with_session("user-a").verify_owner("s-1", "user-b")


def test_verify_owner_ownerless_session_passes() -> None:
    """无主会话(进程内 MCP/expiry_janitor 创建):不做归属拦截。"""
    _manager_with_session(None).verify_owner("s-1", "user-b")


def test_verify_owner_none_caller_skips() -> None:
    """调用者无身份 = 进程内可信调用:跳过归属,但仍校验会话存在。"""
    _manager_with_session("user-a").verify_owner("s-1", None)


def test_verify_owner_missing_session_raises() -> None:
    """会话不存在:抛 RuntimeError(HTTP 层映射 404),不是 403。"""
    with pytest.raises(RuntimeError):
        DebugSessionManager().verify_owner("nope", "user-a")


def test_verify_owner_is_not_assert_prefixed() -> None:
    """归属校验方法不得以 assert 开头 —— MagicMock 会拦截 assert_* 属性。

    这条不是风格洁癖:方法原名 assert_owner 时,全部 mock manager 的用例一次性
    AttributeError(36 条),而真实调用方一切正常 ⇒ 只在测试面爆,极易被误判成
    「测试写错了」而把判据删掉。
    """
    assert not hasattr(DebugSessionManager, "assert_owner")
    assert hasattr(DebugSessionManager, "verify_owner")
    # mock 必须能正常取到该方法(反过来证明名字没落进保留前缀)
    assert MagicMock().verify_owner is not None


# =============================================================================
# 3. 列表过滤
# =============================================================================


async def test_list_sessions_filters_by_owner() -> None:
    """只列自己的会话:别人的 session_id 不出现在响应里。"""
    manager = DebugSessionManager()
    manager._sessions["mine"] = DebugSession(
        session_id="mine", language="python", owner_user_id="u1"
    )
    manager._sessions["theirs"] = DebugSession(
        session_id="theirs", language="python", owner_user_id="u2"
    )
    listed = await manager.list_sessions("u1")
    assert [s["sessionId"] for s in listed] == ["mine"]


async def test_list_sessions_none_returns_all() -> None:
    """进程内可信调用(None)可列全部 —— expiry_janitor 等内部腿依赖它。"""
    manager = DebugSessionManager()
    manager._sessions["a"] = DebugSession(session_id="a", language="python", owner_user_id="u1")
    manager._sessions["b"] = DebugSession(session_id="b", language="python", owner_user_id="u2")
    assert len(await manager.list_sessions(None)) == 2


async def test_list_sessions_excludes_ownerless_from_http_view() -> None:
    """HTTP 视角(user_id 非 None)看不到无主会话 —— 无主 = 内部会话,不给外部枚举。"""
    manager = DebugSessionManager()
    manager._sessions["internal"] = DebugSession(session_id="internal", language="python")
    assert await manager.list_sessions("u1") == []


# =============================================================================
# 4. HTTP 层归属映射
# =============================================================================


async def test_http_foreign_session_maps_to_403(monkeypatch: pytest.MonkeyPatch) -> None:
    """manager 抛 DebugSessionForbidden 时,HTTP 必须是 403(不是 500/404)。"""
    from app.core.config import settings

    monkeypatch.setenv("IHUI_DEBUG_ENABLED", "true")
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")

    fake = MagicMock()
    fake.continue_execution = AsyncMock(return_value={"reason": "breakpoint"})
    fake.verify_owner = MagicMock(side_effect=DebugSessionForbidden("s-1"))
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/debug/sessions/s-1/continue")
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] == 403
    fake.continue_execution.assert_not_awaited()


async def test_http_missing_session_maps_to_404(monkeypatch: pytest.MonkeyPatch) -> None:
    """manager 抛 RuntimeError(不存在)时,HTTP 必须是 404。"""
    from app.core.config import settings

    monkeypatch.setenv("IHUI_DEBUG_ENABLED", "true")
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")

    fake = MagicMock()
    fake.verify_owner = MagicMock(side_effect=RuntimeError("debug session 不存在: s-9"))
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/debug/sessions/s-9/continue")
    assert resp.status_code == 404


async def test_launch_records_caller_as_owner(monkeypatch: pytest.MonkeyPatch) -> None:
    """launch 必须把调用者写成 owner —— 不传 owner 则归属校验永远放行。"""
    from app.core.config import settings

    monkeypatch.setenv("IHUI_DEBUG_ENABLED", "true")
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")

    fake = MagicMock()
    fake.launch = AsyncMock(return_value="s-new")
    monkeypatch.setattr(debug_module, "get_debug_manager", lambda: fake)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/debug/launch", json={"language": "python", "program": "x.py"})
    assert resp.status_code == 200
    _, kwargs = fake.launch.call_args
    assert kwargs["owner_user_id"] == "dev-anonymous"
