"""JWT 验证中间件测试。

测试覆盖:
- JWTAuthMiddleware.dispatch: 未配置 secret 跳过、白名单跳过、OPTIONS 跳过、
  无 Authorization 401、非 Bearer 401、无效/过期 token 401、refresh token 401、
  有效 access token 注入 user_id/role_id
- _verify_token: 有效解码、过期/错签/refresh type 返回 None、无 type 字段通过
- get_current_user_id: 有 user_id 返回、无 user_id 抛 401
"""

from __future__ import annotations

import time
from types import SimpleNamespace

import jwt
import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from app.core.config import settings
from app.core.jwt_auth import JWTAuthMiddleware, get_current_user_id

JWT_SECRET = "test-jwt-secret-for-testing-only"
JWT_ISSUER = "ihui-ai"


def _make_token(
    *,
    secret: str = JWT_SECRET,
    user_id: str = "user-123",
    role_id: int = 1,
    token_type: str | None = "access",
    expires_in: int = 3600,
    issuer: str = JWT_ISSUER,
) -> str:
    payload: dict = {
        "userId": user_id,
        "roleId": role_id,
        "iat": int(time.time()),
        "exp": int(time.time()) + expires_in,
        "iss": issuer,
    }
    if token_type is not None:
        payload["type"] = token_type
    return jwt.encode(payload, secret, algorithm="HS256")


async def _echo_user(request: Request) -> JSONResponse:
    return JSONResponse({
        "user_id": getattr(request.state, "user_id", None),
        "role_id": getattr(request.state, "role_id", None),
        "has_payload": hasattr(request.state, "jwt_payload"),
    })


def _make_test_app() -> Starlette:
    return Starlette(
        routes=[
            Route("/api/protected", _echo_user, methods=["GET", "OPTIONS"]),
            Route("/api/health", _echo_user, methods=["GET"]),
            Route("/api/legacy/x", _echo_user, methods=["GET"]),
        ],
        middleware=[Middleware(JWTAuthMiddleware)],
    )


@pytest.fixture
async def jwt_client():
    transport = ASGITransport(app=_make_test_app())
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def enable_jwt(monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret", JWT_SECRET)
    monkeypatch.setattr(settings, "jwt_issuer", JWT_ISSUER)


class TestJWTAuthMiddlewareDispatch:
    async def test_no_secret_skips_auth(self, jwt_client, monkeypatch):
        monkeypatch.setattr(settings, "jwt_secret", "")
        resp = await jwt_client.get("/api/protected")
        assert resp.status_code == 200

    async def test_public_path_skips_auth(self, jwt_client, enable_jwt):
        resp = await jwt_client.get("/api/health")
        assert resp.status_code == 200
        resp = await jwt_client.get("/api/legacy/x")
        assert resp.status_code == 200

    async def test_options_method_skips_auth(self, jwt_client, enable_jwt):
        resp = await jwt_client.options("/api/protected")
        assert resp.status_code == 200

    async def test_no_auth_header_returns_401(self, jwt_client, enable_jwt):
        resp = await jwt_client.get("/api/protected")
        assert resp.status_code == 401
        assert resp.json()["message"] == "Authentication required"

    async def test_non_bearer_prefix_returns_401(self, jwt_client, enable_jwt):
        resp = await jwt_client.get(
            "/api/protected", headers={"Authorization": "Basic abc123"}
        )
        assert resp.status_code == 401
        assert resp.json()["message"] == "Authentication required"

    async def test_invalid_token_returns_401(self, jwt_client, enable_jwt):
        resp = await jwt_client.get(
            "/api/protected", headers={"Authorization": "Bearer invalid.token.here"}
        )
        assert resp.status_code == 401
        assert resp.json()["message"] == "Invalid or expired token"

    async def test_expired_token_returns_401(self, jwt_client, enable_jwt):
        token = _make_token(expires_in=-3600)
        resp = await jwt_client.get(
            "/api/protected", headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 401

    async def test_valid_access_token_injects_payload(self, jwt_client, enable_jwt):
        token = _make_token(user_id="u-999", role_id=5)
        resp = await jwt_client.get(
            "/api/protected", headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_id"] == "u-999"
        assert data["role_id"] == 5
        assert data["has_payload"] is True


class TestVerifyToken:
    def test_valid_access_token_decodes(self, enable_jwt):
        token = _make_token(user_id="u-1", role_id=2)
        payload = JWTAuthMiddleware._verify_token(token)
        assert payload is not None
        assert payload["userId"] == "u-1"
        assert payload["roleId"] == 2
        assert payload["type"] == "access"

    def test_expired_token_returns_none(self, enable_jwt):
        token = _make_token(expires_in=-3600)
        assert JWTAuthMiddleware._verify_token(token) is None

    def test_invalid_signature_returns_none(self, enable_jwt):
        token = _make_token(secret="wrong-secret")
        assert JWTAuthMiddleware._verify_token(token) is None

    def test_refresh_type_returns_none(self, enable_jwt):
        token = _make_token(token_type="refresh")
        assert JWTAuthMiddleware._verify_token(token) is None

    def test_token_without_type_field_passes(self, enable_jwt):
        token = _make_token(token_type=None)
        payload = JWTAuthMiddleware._verify_token(token)
        assert payload is not None
        assert "type" not in payload


class TestGetCurrentUserId:
    async def test_returns_user_id_when_set(self):
        request = SimpleNamespace(state=SimpleNamespace(user_id="u-123"))
        assert await get_current_user_id(request) == "u-123"

    async def test_raises_401_when_not_set(self):
        request = SimpleNamespace(state=SimpleNamespace())
        with pytest.raises(HTTPException) as exc:
            await get_current_user_id(request)
        assert exc.value.status_code == 401
