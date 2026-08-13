"""hooks 路由单元测试(2026-08-13 立,补齐 0 覆盖)。

策略:直接调用端点 async 函数(绕过 FastAPI 依赖注入),
monkeypatch app.routers.hooks.hook_engine 为假对象,不触 Redis/HTTP。
重点覆盖:
- 鉴权 helper(_is_admin / _owner_filter):admin/非 admin 归属隔离
- 请求校验(_validate_event / _validate_action_type / _validate_action):非法事件/动作、高危白名单
- 各端点:404 / 400 / 403 错误分支 + 成功分支(校验 engine 调用参数)
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.routers import hooks as hooks_router
from app.routers.hooks import (
    CreateAbTestBody,
    CreateHookRequest,
    EmitRequest,
    HookActionConfigModel,
    HookActionModel,
    InstantiateTemplateBody,
    TestHookRequest,
    ToggleHookRequest,
    UpdateHookRequest,
    _is_admin,
    _owner_filter,
    _to_hook_dict,
    _validate_action,
    _validate_action_type,
    _validate_event,
)
from app.services.hook_engine import HIGH_RISK_ACTIONS, HOOK_ACTION_TYPES, HOOK_EVENTS

# 便捷别名
from app.routers.hooks import AutoOrchestrateBody

# pydantic 模型名以 Test 开头,会被 pytest 误收集,显式关闭
TestHookRequest.__test__ = False  # type: ignore[attr-defined]


# ---------------------------------------------------------------------------
# helper:伪造 Request / hook_engine 假对象
# ---------------------------------------------------------------------------


def _req(user_id: str = "u1", role_id: Any = 0) -> SimpleNamespace:
    return SimpleNamespace(state=SimpleNamespace(user_id=user_id, role_id=role_id))


def _make_engine(**returns: Any) -> MagicMock:
    """构造 hook_engine 假对象,返回值可覆盖。"""
    engine = MagicMock()
    # 默认值(AsyncMock 方法覆盖见下)
    engine.list_hooks.return_value = []
    engine.get_hook.return_value = None
    engine.create_hook.return_value = {"id": "hk-test"}
    engine.update_hook.return_value = {"id": "hk-test"}
    engine.delete_hook.return_value = True
    engine.toggle_hook.return_value = {"id": "hk-test", "enabled": True}
    engine.test_hook = AsyncMock(return_value={"triggered": True, "logs": []})
    engine.emit = AsyncMock(return_value=[{"id": "hl-1"}])
    engine.list_logs.return_value = []
    for name, val in returns.items():
        if name in (
            "auto_orchestrate",
            "create_ab_test",
            "list_ab_tests",
            "list_templates",
            "get_ab_test",
            "stop_ab_test",
            "instantiate_template",
            "execution_timeline",
            "health_forecast",
        ):
            setattr(engine, name, AsyncMock(return_value=val))
        else:
            setattr(engine, name, val)
    return engine


@pytest.fixture
def fake_engine(monkeypatch):
    """把 hooks 模块全局 hook_engine 换成假对象。"""
    engine = _make_engine()
    monkeypatch.setattr(hooks_router, "hook_engine", engine)
    return engine


# ---------------------------------------------------------------------------
# 1. 鉴权 helper
# ---------------------------------------------------------------------------


class TestIsAdmin:
    def test_admin_role(self):
        assert _is_admin(_req(role_id=1)) is True
        assert _is_admin(_req(role_id=2)) is True

    def test_string_role(self):
        assert _is_admin(_req(role_id="1")) is True

    def test_non_admin(self):
        assert _is_admin(_req(role_id=0)) is False
        assert _is_admin(_req(role_id=-1)) is False

    def test_missing_role_defaults_non_admin(self):
        """缺 role_id → getattr 兜底 0 → 非管理员。"""
        req = SimpleNamespace(state=SimpleNamespace(user_id="u1"))
        assert _is_admin(req) is False


class TestOwnerFilter:
    def test_admin_returns_none(self):
        assert _owner_filter(_req(role_id=1)) is None

    def test_non_admin_returns_user_id(self):
        assert _owner_filter(_req(user_id="u1", role_id=0)) == "u1"

    def test_non_admin_missing_user_id(self):
        req = SimpleNamespace(state=SimpleNamespace(role_id=0))
        assert _owner_filter(req) is None


# ---------------------------------------------------------------------------
# 2. 请求校验
# ---------------------------------------------------------------------------


class TestValidateEvent:
    def test_valid_event_passes(self):
        for ev in HOOK_EVENTS:
            _validate_event(ev)  # 不应抛错

    def test_invalid_event(self):
        with pytest.raises(HTTPException) as ei:
            _validate_event("not.an.event")
        assert ei.value.status_code == 400
        assert "无效事件" in ei.value.detail


class TestValidateActionType:
    def test_valid_type_passes(self):
        for t in HOOK_ACTION_TYPES:
            _validate_action_type(t)

    def test_invalid_type(self):
        with pytest.raises(HTTPException) as ei:
            _validate_action_type("hack")
        assert ei.value.status_code == 400
        assert "无效动作类型" in ei.value.detail


class TestValidateAction:
    """P0-5 高危动作默认禁用(白名单为空)→ 403;放行后按类型校验必填字段。"""

    def test_invalid_type_raises_400(self):
        with pytest.raises(HTTPException) as ei:
            _validate_action(HookActionModel(type="hack"))
        assert ei.value.status_code == 400

    @pytest.mark.parametrize("risk_type", sorted(HIGH_RISK_ACTIONS))
    def test_high_risk_default_forbidden(self, risk_type, monkeypatch):
        """白名单为空 → script/webhook 403。"""
        monkeypatch.setattr(settings, "hook_allowed_actions", "")
        with pytest.raises(HTTPException) as ei:
            _validate_action(HookActionModel(type=risk_type))
        assert ei.value.status_code == 403
        assert "高危动作" in ei.value.detail

    def test_low_risk_passes(self, monkeypatch):
        monkeypatch.setattr(settings, "hook_allowed_actions", "")
        _validate_action(
            HookActionModel(type="log", config=HookActionConfigModel(message="hi"))
        )

    def test_webhook_allowed_but_no_url(self, monkeypatch):
        monkeypatch.setattr(settings, "hook_allowed_actions", "webhook")
        with pytest.raises(HTTPException) as ei:
            _validate_action(HookActionModel(type="webhook"))
        assert ei.value.status_code == 400
        assert "url" in ei.value.detail

    def test_webhook_allowed_with_url(self, monkeypatch):
        monkeypatch.setattr(settings, "hook_allowed_actions", "webhook")
        _validate_action(
            HookActionModel(
                type="webhook", config=HookActionConfigModel(url="http://x.com")
            )
        )

    def test_script_allowed_but_no_command(self, monkeypatch):
        monkeypatch.setattr(settings, "hook_allowed_actions", "script")
        with pytest.raises(HTTPException) as ei:
            _validate_action(HookActionModel(type="script"))
        assert ei.value.status_code == 400
        assert "command" in ei.value.detail

    def test_script_allowed_with_command(self, monkeypatch):
        monkeypatch.setattr(settings, "hook_allowed_actions", "script")
        _validate_action(
            HookActionModel(
                type="script", config=HookActionConfigModel(command="echo hi")
            )
        )


class TestToHookDict:
    def test_converts_config(self):
        action = HookActionModel(
            type="log", config=HookActionConfigModel(message="hi", url=None)
        )
        result = _to_hook_dict(action)
        assert result == {"type": "log", "config": {"message": "hi"}}

    def test_none_config_excluded(self):
        action = HookActionModel(type="log", config=HookActionConfigModel())
        result = _to_hook_dict(action)
        assert result == {"type": "log", "config": {}}


# ---------------------------------------------------------------------------
# 3. 端点
# ---------------------------------------------------------------------------


class TestListHooks:
    async def test_success_non_admin(self, fake_engine):
        fake_engine.list_hooks.return_value = [{"id": "hk-1"}]
        resp = await hooks_router.list_hooks(_req(user_id="u1", role_id=0), None, user_id="u1")
        assert resp["code"] == 0
        assert resp["data"]["count"] == 1
        fake_engine.list_hooks.assert_called_once_with(event=None, owner_id="u1")

    async def test_success_admin(self, fake_engine):
        fake_engine.list_hooks.return_value = []
        resp = await hooks_router.list_hooks(_req(user_id="u1", role_id=1), None, user_id="u1")
        assert resp["data"]["count"] == 0
        fake_engine.list_hooks.assert_called_once_with(event=None, owner_id=None)

    async def test_event_filter(self, fake_engine):
        fake_engine.list_hooks.return_value = []
        resp = await hooks_router.list_hooks(
            _req(), event="tool.before", user_id="u1"
        )
        assert resp["code"] == 0
        fake_engine.list_hooks.assert_called_once_with(event="tool.before", owner_id="u1")

    async def test_invalid_event_400(self, fake_engine):
        with pytest.raises(HTTPException) as ei:
            await hooks_router.list_hooks(_req(), event="bad.event", user_id="u1")
        assert ei.value.status_code == 400
        fake_engine.list_hooks.assert_not_called()


class TestCreateHook:
    async def test_invalid_event_400(self, fake_engine):
        req = CreateHookRequest(
            name="h", event="bad.event", action=HookActionModel(type="log")
        )
        with pytest.raises(HTTPException) as ei:
            await hooks_router.create_hook(_req(), req, user_id="u1")
        assert ei.value.status_code == 400

    async def test_high_risk_403(self, fake_engine, monkeypatch):
        monkeypatch.setattr(settings, "hook_allowed_actions", "")
        req = CreateHookRequest(
            name="h", event="tool.before", action=HookActionModel(type="script")
        )
        with pytest.raises(HTTPException) as ei:
            await hooks_router.create_hook(_req(), req, user_id="u1")
        assert ei.value.status_code == 403

    async def test_success_payload(self, fake_engine):
        fake_engine.create_hook.return_value = {"id": "hk-1"}
        action = HookActionModel(
            type="log", config=HookActionConfigModel(message="hi")
        )
        req = CreateHookRequest(
            name="my hook",
            description="desc",
            event="tool.after",
            condition=None,
            action=action,
        )
        resp = await hooks_router.create_hook(_req(), req, user_id="u1")
        assert resp["code"] == 0
        payload = fake_engine.create_hook.call_args.args[0]
        assert payload["name"] == "my hook"
        assert payload["event"] == "tool.after"
        assert payload["action"] == {"type": "log", "config": {"message": "hi"}}
        # enabled 未传 → 默认 True
        assert payload["enabled"] is True
        # owner_id 传当前登录用户
        assert fake_engine.create_hook.call_args.kwargs["owner_id"] == "u1"


class TestGetHook:
    async def test_not_found_404(self, fake_engine):
        fake_engine.get_hook.return_value = None
        with pytest.raises(HTTPException) as ei:
            await hooks_router.get_hook(_req(), "hk-nope", user_id="u1")
        assert ei.value.status_code == 404

    async def test_success(self, fake_engine):
        fake_engine.get_hook.return_value = {"id": "hk-1"}
        resp = await hooks_router.get_hook(_req(), "hk-1", user_id="u1")
        assert resp["code"] == 0
        fake_engine.get_hook.assert_called_once_with("hk-1", owner_id="u1")


class TestUpdateHook:
    async def test_not_found_404(self, fake_engine):
        fake_engine.get_hook.return_value = None
        req = UpdateHookRequest(name="new")
        with pytest.raises(HTTPException) as ei:
            await hooks_router.update_hook(_req(), "hk-x", req, user_id="u1")
        assert ei.value.status_code == 404

    async def test_invalid_event_400(self, fake_engine):
        fake_engine.get_hook.return_value = {"id": "hk-1"}
        req = UpdateHookRequest(event="bad.event")
        with pytest.raises(HTTPException) as ei:
            await hooks_router.update_hook(_req(), "hk-1", req, user_id="u1")
        assert ei.value.status_code == 400

    async def test_success_patch_built(self, fake_engine):
        fake_engine.get_hook.return_value = {"id": "hk-1"}
        fake_engine.update_hook.return_value = {"id": "hk-1", "name": "renamed"}
        req = UpdateHookRequest(
            name="renamed",
            description="d",
            event="error",
            enabled=False,
            action=HookActionModel(
                type="log", config=HookActionConfigModel(message="m")
            ),
        )
        resp = await hooks_router.update_hook(_req(), "hk-1", req, user_id="u1")
        assert resp["code"] == 0
        patch = fake_engine.update_hook.call_args.args[1]
        assert patch["name"] == "renamed"
        assert patch["event"] == "error"
        assert patch["enabled"] is False
        assert patch["action"]["type"] == "log"


class TestDeleteHook:
    async def test_not_found_404(self, fake_engine):
        fake_engine.delete_hook.return_value = False
        with pytest.raises(HTTPException) as ei:
            await hooks_router.delete_hook(_req(), "hk-x", user_id="u1")
        assert ei.value.status_code == 404

    async def test_success(self, fake_engine):
        fake_engine.delete_hook.return_value = True
        resp = await hooks_router.delete_hook(_req(), "hk-1", user_id="u1")
        assert resp["code"] == 0
        assert resp["data"]["deleted"] is True


class TestToggleHook:
    async def test_not_found_404(self, fake_engine):
        fake_engine.toggle_hook.return_value = None
        req = ToggleHookRequest(enabled=True)
        with pytest.raises(HTTPException) as ei:
            await hooks_router.toggle_hook(_req(), "hk-x", req, user_id="u1")
        assert ei.value.status_code == 404

    async def test_success(self, fake_engine):
        fake_engine.toggle_hook.return_value = {"id": "hk-1", "enabled": False}
        req = ToggleHookRequest(enabled=False)
        resp = await hooks_router.toggle_hook(_req(), "hk-1", req, user_id="u1")
        assert resp["code"] == 0
        assert resp["data"]["enabled"] is False


class TestTestHook:
    async def test_invalid_event_400(self, fake_engine):
        req = TestHookRequest(event="bad.event")
        with pytest.raises(HTTPException) as ei:
            await hooks_router.test_hook(_req(), "hk-1", req, user_id="u1")
        assert ei.value.status_code == 400

    async def test_hook_not_found_404(self, fake_engine):
        fake_engine.get_hook.return_value = None
        req = TestHookRequest(event="error")
        with pytest.raises(HTTPException) as ei:
            await hooks_router.test_hook(_req(), "hk-x", req, user_id="u1")
        assert ei.value.status_code == 404

    async def test_success(self, fake_engine):
        fake_engine.get_hook.return_value = {"id": "hk-1"}
        req = TestHookRequest(event="error", context={"a": 1})
        resp = await hooks_router.test_hook(_req(), "hk-1", req, user_id="u1")
        assert resp["code"] == 0
        fake_engine.test_hook.assert_called_once_with("hk-1", "error", {"a": 1})


class TestListHookLogs:
    async def test_hook_not_found_404(self, fake_engine):
        fake_engine.get_hook.return_value = None
        with pytest.raises(HTTPException) as ei:
            await hooks_router.list_hook_logs(_req(), "hk-x", limit=100, user_id="u1")
        assert ei.value.status_code == 404

    async def test_success(self, fake_engine):
        fake_engine.get_hook.return_value = {"id": "hk-1"}
        fake_engine.list_logs.return_value = [{"id": "hl-1"}, {"id": "hl-2"}]
        resp = await hooks_router.list_hook_logs(_req(), "hk-1", limit=100, user_id="u1")
        assert resp["code"] == 0
        assert resp["data"]["count"] == 2
        fake_engine.list_logs.assert_called_once_with(hook_id="hk-1", limit=100)


class TestListAllLogs:
    async def test_success(self, fake_engine):
        fake_engine.list_logs.return_value = [{"id": "hl-1"}]
        resp = await hooks_router.list_all_logs(_req(), limit=50, user_id="u1")
        assert resp["code"] == 0
        assert resp["data"]["count"] == 1
        fake_engine.list_logs.assert_called_once_with(hook_id=None, limit=50)


class TestEmitEvent:
    async def test_invalid_event_400(self, fake_engine):
        req = EmitRequest(event="bad.event")
        with pytest.raises(HTTPException) as ei:
            await hooks_router.emit_event(_req(), req, user_id="u1")
        assert ei.value.status_code == 400

    async def test_success(self, fake_engine):
        fake_engine.emit.return_value = [{"id": "hl-1"}, {"id": "hl-2"}]
        req = EmitRequest(event="tool.before", context={"tool": "search"})
        resp = await hooks_router.emit_event(_req(), req, user_id="u1")
        assert resp["code"] == 0
        assert resp["data"]["triggered_count"] == 2
        fake_engine.emit.assert_called_once_with("tool.before", {"tool": "search"})


# ---------------------------------------------------------------------------
# 4. try/except 端点:成功 → code 0;异常 → code 500(不抛)
# ---------------------------------------------------------------------------

_EXCEPTION_ENGINES = {
    "auto_orchestrate": (AsyncMock(side_effect=RuntimeError("boom")), AutoOrchestrateBody(requirement="通知我")),
    "create_ab_test": (AsyncMock(side_effect=RuntimeError("boom")), CreateAbTestBody(hook_a_id="a", hook_b_id="b")),
    "list_ab_tests": (AsyncMock(side_effect=RuntimeError("boom")), None),
    "list_templates": (MagicMock(side_effect=RuntimeError("boom")), None),
    "get_ab_test": (AsyncMock(side_effect=RuntimeError("boom")), None),
    "stop_ab_test": (AsyncMock(side_effect=RuntimeError("boom")), None),
    "instantiate_template": (AsyncMock(side_effect=RuntimeError("boom")), InstantiateTemplateBody()),
    "execution_timeline": (AsyncMock(side_effect=RuntimeError("boom")), None),
    "health_forecast": (AsyncMock(side_effect=RuntimeError("boom")), None),
}


class TestExceptionalEndpoints:
    async def test_success_path(self, fake_engine):
        fake_engine.auto_orchestrate = AsyncMock(return_value={"hooks": []})
        resp = await hooks_router.auto_orchestrate(
            _req(), AutoOrchestrateBody(requirement="hi"), user_id="u1"
        )
        assert resp["code"] == 0
        assert resp["data"] == {"hooks": []}

        fake_engine.list_templates.return_value = [{"id": "tpl-1"}]
        resp = await hooks_router.list_hook_templates(_req(), user_id="u1")
        assert resp["code"] == 0
        assert len(resp["data"]) == 1

        fake_engine.health_forecast = AsyncMock(return_value={"trend": "stable"})
        resp = await hooks_router.health_forecast(_req(), "hk-1", days=7, user_id="u1")
        assert resp["code"] == 0

    @pytest.mark.parametrize("name", sorted(_EXCEPTION_ENGINES))
    async def test_exception_returns_500(self, fake_engine, name):
        """engine 抛异常 → 返回 code=500,不向外抛。"""
        mock_fn, body = _EXCEPTION_ENGINES[name]
        setattr(fake_engine, name, mock_fn)
        if name == "auto_orchestrate":
            resp = await hooks_router.auto_orchestrate(_req(), body, user_id="u1")
        elif name == "create_ab_test":
            resp = await hooks_router.create_ab_test(_req(), body, user_id="u1")
        elif name == "list_ab_tests":
            resp = await hooks_router.list_ab_tests(_req(), user_id="u1")
        elif name == "list_templates":
            resp = await hooks_router.list_hook_templates(_req(), user_id="u1")
        elif name == "get_ab_test":
            resp = await hooks_router.get_ab_test(_req(), "ab-1", user_id="u1")
        elif name == "stop_ab_test":
            resp = await hooks_router.stop_ab_test(_req(), "ab-1", user_id="u1")
        elif name == "instantiate_template":
            resp = await hooks_router.instantiate_template(_req(), "tpl-1", body, user_id="u1")
        elif name == "execution_timeline":
            resp = await hooks_router.execution_timeline(_req(), "hk-1", since=None, user_id="u1")
        else:  # health_forecast
            resp = await hooks_router.health_forecast(_req(), "hk-1", days=7, user_id="u1")
        assert resp["code"] == 500
        assert "boom" in resp["message"]
        assert resp["data"] is None
