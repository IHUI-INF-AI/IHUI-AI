"""AIS-036(hook SSRF 旁路)与 AIS-048(str(e) 错误契约泄露)回归。

改前必红四格:
  1. `_run_webhook` 对内网/回环/链路本地/云元数据与非 http(s) 目标照常出站(AIS-036);
  2. notify(channel=webhook) 在创建闸与执行兜底两侧绕过 HOOK_ALLOWED_ACTIONS(AIS-036);
  3. 路由 `except Exception → return {"code": 500, "message": str(e)}` 把异常细节回给调用方,
     且状态码恒 200,网关/监控按状态码统计看不到故障(AIS-048);
  4. ASGI 面错误必须是 HTTP 500 + 固定文案 detail(AIS-048)。
钉法同型:test_os_ssr_019_egress_paths.py(SSRF 防线)、
test_ais049_057_error_contract.py(str 不出响应)。
既有 9(hooks)+8(orchestration,含 pilot 专项臂)格错误契约由
tests/test_hooks.py、tests/test_orchestration*.py 的改后用例覆盖,此处不重复。
"""

from __future__ import annotations

import types
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.routers import hooks as hooks_mod
from app.routers import orchestration as orch_mod
from app.services import hook_engine as he
from app.services.hook_engine import HookEngine, _effective_high_risk_action


@pytest.fixture
def engine() -> HookEngine:
    """内存模式 HookEngine(不连 Redis),与 test_hook_engine 同型。"""
    return HookEngine(redis_client=None)


def _req(user_id: str = "u1") -> types.SimpleNamespace:
    return types.SimpleNamespace(state=types.SimpleNamespace(user_id=user_id, role_id=0))


def _boom(secret: str = "boom") -> AsyncMock:
    return AsyncMock(side_effect=RuntimeError(secret))


# ════════════════════════════════════════════════════════════════════════
# AIS-036-1:出站 SSRF 尺 —— _run_webhook / notify(webhook 渠道) 同闸
# ════════════════════════════════════════════════════════════════════════


class TestWebhookSSRFGate:
    """_run_webhook 出站前必过 screenshot_service._validate_url_ssrf(复用单源)。"""

    @pytest.mark.parametrize(
        "url",
        [
            "http://127.0.0.1/push",          # 回环
            "http://10.1.2.3/push",           # RFC1918 私网
            "http://169.254.169.254/latest/meta-data/",  # 云元数据(链路本地)
            "http://[::1]/push",              # IPv6 回环
            "file:///etc/passwd",             # 非 http(s)
            "ftp://93.184.216.34/x",          # 非 http(s)
            "http://localhost/",              # 域名解析落到回环
        ],
    )
    async def test_blocked_targets_never_construct_client(
        self, engine: HookEngine, url: str
    ) -> None:
        with patch("httpx.AsyncClient") as client_cls:
            result, err = await engine._run_webhook({"url": url}, "error", {})
        assert result is None
        assert err is not None and "SSRF" in err
        client_cls.assert_not_called()  # 早退:一个请求都不能发

    async def test_public_ip_still_allowed(self, engine: HookEngine) -> None:
        """正向对照:公网目标必须照常出站(门禁不能做成恒红)。"""
        mock_resp = types.SimpleNamespace(status_code=200)
        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        with patch("httpx.AsyncClient", return_value=mock_client):
            result, err = await engine._run_webhook(
                {"url": "http://93.184.216.34/hook"}, "error", {}
            )
        assert err is None
        assert result is not None and "HTTP 200" in result
        mock_client.request.assert_awaited()

    async def test_notify_webhook_channel_hits_same_gate(self, engine: HookEngine) -> None:
        """notify 的 webhook 渠道经 _run_notify 落到 _run_webhook,同受此闸。"""
        with patch("httpx.AsyncClient") as client_cls:
            result, err = await engine._run_notify(
                {"channel": "webhook", "url": "http://169.254.169.254/"},
                "error",
                {"m": 1},
            )
        assert result is None
        assert err is not None and "SSRF" in err
        client_cls.assert_not_called()


# ════════════════════════════════════════════════════════════════════════
# AIS-036-2:channel=webhook 视同 type=webhook 受 HOOK_ALLOWED_ACTIONS 管控
# ════════════════════════════════════════════════════════════════════════


def test_effective_high_risk_action_single_source() -> None:
    """判据表(创建闸与执行兜底共用 _effective_high_risk_action,§0.6 单源):"""
    assert _effective_high_risk_action("notify", "webhook") == "webhook"  # 旁路入档
    assert _effective_high_risk_action("notify", None) is None  # 默认 toast 不误伤
    assert _effective_high_risk_action("notify", "email") is None
    assert _effective_high_risk_action("notify", "toast") is None
    assert _effective_high_risk_action("webhook", None) == "webhook"
    assert _effective_high_risk_action("script", None) == "script"
    assert _effective_high_risk_action("log", None) is None


class TestNotifyWebhookCreationGate:
    """创建闸:routers/hooks.py `_validate_action` 不再放 notify(webhook) 过门。"""

    def test_notify_webhook_denied_when_whitelist_empty(self, monkeypatch) -> None:
        monkeypatch.setattr(he.settings, "hook_allowed_actions", "")
        action = hooks_mod.HookActionModel(
            type="notify",
            config=hooks_mod.HookActionConfigModel(
                channel="webhook", url="https://example.com/hook"
            ),
        )
        with pytest.raises(HTTPException) as ei:
            hooks_mod._validate_action(action)
        assert ei.value.status_code == 403
        assert "webhook" in ei.value.detail

    def test_notify_toast_not_gated_when_whitelist_empty(self, monkeypatch) -> None:
        """正向对照:低风险 notify(toast)不被误伤。"""
        monkeypatch.setattr(he.settings, "hook_allowed_actions", "")
        action = hooks_mod.HookActionModel(
            type="notify",
            config=hooks_mod.HookActionConfigModel(channel="toast", message="hi"),
        )
        hooks_mod._validate_action(action)  # 不抛即通过

    def test_notify_webhook_allowed_but_requires_url(self, monkeypatch) -> None:
        monkeypatch.setattr(he.settings, "hook_allowed_actions", "webhook")
        action = hooks_mod.HookActionModel(
            type="notify",
            config=hooks_mod.HookActionConfigModel(channel="webhook"),
        )
        with pytest.raises(HTTPException) as ei:
            hooks_mod._validate_action(action)
        assert ei.value.status_code == 400


class TestNotifyWebhookExecutionGate:
    """执行兜底:_execute_hook 对 notify(webhook) 复核白名单,拒则零出站。"""

    async def test_denied_without_whitelist_no_egress_then_allowed(
        self, engine: HookEngine, monkeypatch
    ) -> None:
        monkeypatch.setattr(he.settings, "hook_allowed_actions", "")
        spy = AsyncMock(return_value=("resp", None))
        monkeypatch.setattr(engine, "_run_webhook", spy)
        hook = {
            "id": "hk-ais036",
            "event": "error",
            "action": {
                "type": "notify",
                "config": {"channel": "webhook", "url": "https://example.com/h"},
            },
        }

        log = await engine._execute_hook(hook, "error", {})
        assert log["success"] is False
        assert "高危动作 webhook" in (log.get("error") or "")
        spy.assert_not_awaited()  # 判"被拒"必须断言执行器没被调用

        # 正向对照:显式放行后同一钩子必须抵达执行器
        monkeypatch.setattr(he.settings, "hook_allowed_actions", "webhook")
        log2 = await engine._execute_hook(hook, "error", {})
        assert log2["success"] is True
        spy.assert_awaited()


# ════════════════════════════════════════════════════════════════════════
# AIS-048:500 面统一 raise HTTPException(500, 固定文案),str(e) 只进日志
# ════════════════════════════════════════════════════════════════════════


class TestErrorContractFixedDetail:
    async def test_hooks_route_error_is_fixed_500(self, monkeypatch) -> None:
        # list_templates 是同步方法,用 MagicMock 让异常在 except 覆盖面内抛出
        fake_engine = types.SimpleNamespace(
            list_templates=MagicMock(side_effect=RuntimeError("boom /srv/secrets/db.yaml"))
        )
        monkeypatch.setattr(hooks_mod, "hook_engine", fake_engine)
        with pytest.raises(HTTPException) as ei:
            await hooks_mod.list_hook_templates(_req(), user_id="u1")
        assert ei.value.status_code == 500
        assert ei.value.detail == "服务内部错误"
        assert "boom" not in str(ei.value.detail)

    async def test_orchestration_route_error_is_fixed_500(self, monkeypatch) -> None:
        fake_hub = types.SimpleNamespace(get_event_feed=_boom("boom sql://user:pw@host"))
        monkeypatch.setattr(orch_mod, "orchestration_hub", fake_hub)
        with pytest.raises(HTTPException) as ei:
            await orch_mod.get_events()
        assert ei.value.status_code == 500
        assert ei.value.detail == "服务内部错误"
        assert "boom" not in str(ei.value.detail)

    async def test_asgi_surface_returns_http_500(self, monkeypatch) -> None:
        """ASGI 面:状态码必须是 500(监控/网关按状态码统计),body 无异常细节。"""
        fake_hub = types.SimpleNamespace(get_event_feed=_boom("boom internal"))
        monkeypatch.setattr(orch_mod, "orchestration_hub", fake_hub)
        app = FastAPI()
        app.include_router(orch_mod.router)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/orchestration/events")
        assert resp.status_code == 500
        assert resp.json() == {"detail": "服务内部错误"}
        assert "boom" not in resp.text
