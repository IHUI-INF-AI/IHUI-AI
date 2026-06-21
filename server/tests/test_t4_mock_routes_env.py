"""T4 测试: 生产环境 mock 路由下线行为.

覆盖:
1. ENV=production: mock 默认关闭
2. ENV=development: mock 默认开启
3. MOCK_ROUTES=force 强制开启
4. MOCK_ROUTES=off 强制关闭 (优先级最高)
5. /api/mock/status 端点正确报告状态
6. ENV 取值不区分大小写
"""
from __future__ import annotations

import importlib
import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


def _create_app_with_env(env_value, mock_routes_value=None):
    """构造一个 FastAPI app, 模拟生产环境 mock 注册逻辑."""
    # 清理环境变量
    for k in ("ENV", "MOCK_ROUTES"):
        if k in os.environ:
            del os.environ[k]
    if env_value is not None:
        os.environ["ENV"] = env_value
    if mock_routes_value is not None:
        os.environ["MOCK_ROUTES"] = mock_routes_value

    app = FastAPI()
    # 模拟主项目 main.py 中的 mock 注册逻辑
    _env = os.environ.get("ENV", "development").lower()
    _mock_force = os.environ.get("MOCK_ROUTES", "").lower() == "force"
    _mock_off = os.environ.get("MOCK_ROUTES", "").lower() == "off"

    if _mock_off:
        mock_on = False
    elif _mock_force:
        mock_on = True
    else:
        mock_on = _env not in ("production", "prod")

    app.state.mock_enabled = mock_on
    app.state.mock_env = _env

    # 注册 mock 路由 (如果是开启状态)
    if mock_on:
        from app.api.mock import api_router, prod_router  # type: ignore
        app.include_router(api_router)
        app.include_router(prod_router)

    # 注册状态端点
    @app.get("/api/mock/status")
    def status():
        return {
            "enabled": app.state.mock_enabled,
            "env": app.state.mock_env,
        }

    return app


def test_dev_env_mock_enabled():
    """ENV=development: mock 默认开启."""
    app = _create_app_with_env("development")
    client = TestClient(app)
    resp = client.get("/api/mock/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["enabled"] is True
    assert data["env"] == "development"


def test_production_env_mock_disabled():
    """ENV=production: mock 默认关闭 (生产安全)."""
    app = _create_app_with_env("production")
    client = TestClient(app)
    resp = client.get("/api/mock/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["enabled"] is False, "生产环境 mock 应关闭"
    assert data["env"] == "production"


def test_prod_env_mock_disabled():
    """ENV=prod (短缩写): mock 同样关闭."""
    app = _create_app_with_env("prod")
    client = TestClient(app)
    resp = client.get("/api/mock/status")
    data = resp.json()
    assert data["enabled"] is False
    assert data["env"] == "prod"


def test_staging_env_mock_enabled():
    """ENV=staging: mock 默认开启 (预发联调)."""
    app = _create_app_with_env("staging")
    client = TestClient(app)
    resp = client.get("/api/mock/status")
    data = resp.json()
    assert data["enabled"] is True
    assert data["env"] == "staging"


def test_testing_env_mock_enabled():
    """ENV=testing: mock 默认开启."""
    app = _create_app_with_env("testing")
    client = TestClient(app)
    resp = client.get("/api/mock/status")
    data = resp.json()
    assert data["enabled"] is True
    assert data["env"] == "testing"


def test_mock_routes_force_overrides_env():
    """MOCK_ROUTES=force 强制开启 (覆盖 ENV=production)."""
    app = _create_app_with_env("production", mock_routes_value="force")
    client = TestClient(app)
    resp = client.get("/api/mock/status")
    data = resp.json()
    assert data["enabled"] is True, "force 应覆盖 production"


def test_mock_routes_off_overrides_dev():
    """MOCK_ROUTES=off 强制关闭 (覆盖 ENV=development)."""
    app = _create_app_with_env("development", mock_routes_value="off")
    client = TestClient(app)
    resp = client.get("/api/mock/status")
    data = resp.json()
    assert data["enabled"] is False, "off 应覆盖 development"


def test_env_value_is_case_insensitive():
    """ENV 取值不区分大小写."""
    for val in ("PRODUCTION", "Production", "pRoDuCtIoN"):
        app = _create_app_with_env(val)
        client = TestClient(app)
        resp = client.get("/api/mock/status")
        data = resp.json()
        assert data["enabled"] is False, f"ENV={val} 应关闭 mock"
        assert data["env"] == val.lower()


def test_mock_routes_off_in_production():
    """生产环境显式 MOCK_ROUTES=off: 关闭 (幂等)."""
    app = _create_app_with_env("production", mock_routes_value="off")
    client = TestClient(app)
    resp = client.get("/api/mock/status")
    data = resp.json()
    assert data["enabled"] is False


def test_mock_routes_off_with_empty_value():
    """MOCK_ROUTES=空字符串: 视为未设置, 按 ENV 决定."""
    app = _create_app_with_env("development", mock_routes_value="")
    client = TestClient(app)
    resp = client.get("/api/mock/status")
    data = resp.json()
    assert data["enabled"] is True, "空 MOCK_ROUTES 应按 ENV 决定"


def test_no_env_set_defaults_to_development():
    """未设置 ENV: 默认为 development (向后兼容)."""
    # 清理所有相关环境变量
    for k in ("ENV", "MOCK_ROUTES"):
        if k in os.environ:
            del os.environ[k]
    app = _create_app_with_env(None)
    client = TestClient(app)
    resp = client.get("/api/mock/status")
    data = resp.json()
    assert data["enabled"] is True, "未设置 ENV 应默认 mock 开启"
    assert data["env"] == "development"


def test_mock_routes_status_endpoint_always_available():
    """即使 mock 关闭, /api/mock/status 端点仍可用 (运维查询)."""
    app = _create_app_with_env("production", mock_routes_value="off")
    client = TestClient(app)
    resp = client.get("/api/mock/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["enabled"] is False
    # env 应正确返回
    assert data["env"] == "production"


def test_force_priority_is_highest():
    """MOCK_ROUTES=force 在任何 ENV 下都开启."""
    for env in ("production", "prod", "staging", "development", "testing"):
        app = _create_app_with_env(env, mock_routes_value="force")
        client = TestClient(app)
        resp = client.get("/api/mock/status")
        data = resp.json()
        assert data["enabled"] is True, f"ENV={env} + force 应开启"


def test_off_priority_is_highest():
    """MOCK_ROUTES=off 在任何 ENV 下都关闭."""
    for env in ("production", "prod", "staging", "development", "testing"):
        app = _create_app_with_env(env, mock_routes_value="off")
        client = TestClient(app)
        resp = client.get("/api/mock/status")
        data = resp.json()
        assert data["enabled"] is False, f"ENV={env} + off 应关闭"
