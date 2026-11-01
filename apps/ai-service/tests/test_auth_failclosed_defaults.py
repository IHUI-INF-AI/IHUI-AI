# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""鉴权与文档暴露的缺省必须 fail-closed(2026-11-01 安全强化,高危)。

原缺陷三条同源:``node_env`` 默认 "development";``jwt_secret`` 默认空;中间件用
"secret 为空 + development" 推导跳过鉴权 ⇒ 一次 .env 漏配就把全站鉴权与归属隔离
整条拿掉,而 /docs、/redoc、/openapi.json 也随之对外开放。

反向牙:把 `dev_auth_bypass_enabled` 改回"secret 为空即放行"、或把 node_env 默认改回
development,本文件对应用例即红。
"""

from __future__ import annotations

import httpx
import pytest
from fastapi import FastAPI

from app.core import jwt_auth
from app.core.config import Settings, settings
from app.core.jwt_auth import JWTAuthMiddleware, auth_globally_enforced, dev_auth_bypass_enabled


def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in ("NODE_ENV", "JWT_SECRET", "AI_DEV_NO_AUTH"):
        monkeypatch.delenv(key, raising=False)


def test_defaults_are_production_and_fail_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    """缺省:node_env=production、开发放行开关关、jwt_secret 空 ⇒ 鉴权默认是"开"的。"""
    _clean_env(monkeypatch)
    fresh = Settings(_env_file=None)
    assert fresh.node_env == "production"
    assert fresh.ai_dev_no_auth is False
    assert fresh.jwt_secret == ""


def test_dev_bypass_requires_the_explicit_switch(monkeypatch: pytest.MonkeyPatch) -> None:
    """缺 secret 本身**不再是**放行理由;只有显式开关才算。"""
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "ai_dev_no_auth", False)
    assert dev_auth_bypass_enabled() is False
    assert auth_globally_enforced() is True

    monkeypatch.setattr(settings, "ai_dev_no_auth", True)
    assert dev_auth_bypass_enabled() is True
    assert auth_globally_enforced() is False


def test_switch_does_not_disable_verification_when_secret_is_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """开关开着但配了真实 secret ⇒ 照样验签(不是"跳过鉴权"的后门)。"""
    monkeypatch.setattr(settings, "jwt_secret", "real-secret")
    monkeypatch.setattr(settings, "ai_dev_no_auth", True)
    assert dev_auth_bypass_enabled() is False
    assert auth_globally_enforced() is True


def _mini_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(JWTAuthMiddleware)

    @app.get("/ping")
    async def ping() -> dict[str, str]:  # pragma: no cover - 只在放行分支命中
        return {"ok": "pong"}

    return app


async def _get(app: FastAPI, path: str = "/ping") -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get(path)


async def test_middleware_500_when_secret_missing_and_switch_off(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """漏配 secret 且未显式放行 ⇒ 拒绝服务(旧行为是"development 就悄悄放行")。"""
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "ai_dev_no_auth", False)
    resp = await _get(_mini_app())
    assert resp.status_code == 500
    assert "JWT_SECRET" in resp.json()["message"]


async def test_middleware_passes_only_with_explicit_switch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "ai_dev_no_auth", True)
    resp = await _get(_mini_app())
    assert resp.status_code == 200


async def test_middleware_401_without_token_when_secret_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "jwt_secret", "real-secret")
    monkeypatch.setattr(settings, "ai_dev_no_auth", True)
    resp = await _get(_mini_app())
    assert resp.status_code == 401


def _build_app(monkeypatch: pytest.MonkeyPatch, *, dev_switch: bool):
    """用当前 settings 造一个 app(通过启动校验,避免被 CORS/JWT 校验挡住)。"""
    monkeypatch.setattr(settings, "ai_dev_no_auth", dev_switch)
    monkeypatch.setattr(settings, "jwt_secret", "docs-test-secret")
    monkeypatch.setattr(settings, "cors_origin", "http://localhost:8801")

    from app.main import create_app

    return create_app()


def test_docs_are_closed_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """缺省(开关关)不挂 /docs、/redoc、/openapi.json。"""
    app = _build_app(monkeypatch, dev_switch=False)
    assert app.docs_url is None
    assert app.redoc_url is None
    assert app.openapi_url is None


def test_docs_open_only_with_explicit_dev_switch(monkeypatch: pytest.MonkeyPatch) -> None:
    """显式开发档才挂文档:证明开关真的接到了 create_app,而不是只改了常量。"""
    app = _build_app(monkeypatch, dev_switch=True)
    assert app.docs_url == "/docs"
    assert app.openapi_url == "/openapi.json"


def test_auth_module_has_single_bypass_predicate() -> None:
    """形状锁:中间件与 `auth_globally_enforced` 不得各自复算一份放行条件。"""
    import inspect

    dispatch_src = inspect.getsource(JWTAuthMiddleware.dispatch)
    assert "dev_auth_bypass_enabled()" in dispatch_src
    assert 'node_env == "development"' not in dispatch_src
    assert "dev_auth_bypass_enabled()" in inspect.getsource(jwt_auth.auth_globally_enforced)
