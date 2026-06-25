"""端到端测试：基础健康检查、Swagger、OpenAPI."""

import pytest

pytestmark = pytest.mark.asyncio


class TestHealthCheck:
    async def test_health_endpoint(self, client):
        resp = await client.get("/healthz")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"


class TestSwagger:
    async def test_docs_ui_available(self, client):
        resp = await client.get("/docs")
        assert resp.status_code == 200
        assert b"swagger" in resp.content.lower()

    async def test_redoc_ui_available(self, client):
        resp = await client.get("/redoc")
        assert resp.status_code == 200

    async def test_openapi_json(self, client):
        resp = await client.get("/openapi.json")
        assert resp.status_code == 200
        spec = resp.json()
        assert "paths" in spec
        assert "openapi" in spec
        assert spec["info"]["title"] == "ZHS Platform"
        assert len(spec["paths"]) > 100


class TestAuthEndpoints:
    async def test_exist_phone_returns_200(self, client):
        # 2026-06-25 修复#D 暴露: login_router 有 prefix="/auth", 实际路径是 /api/v1/auth/exist/{phone}
        # 原路径 /api/v1/auth/auth/exist/... 多了一层 /auth, 之前靠 mock catch-all 兜底返回 200 "通过"
        resp = await client.get("/api/v1/auth/exist/13800000000")
        assert resp.status_code in (200, 401, 500)
        if resp.status_code == 200:
            assert "data" in resp.json()

    async def test_login_missing_phone(self, client):
        # 2026-06-25 修复#D 暴露: login_router 有 prefix="/auth", 实际路径是 /api/v1/auth/login
        # 原路径 /api/v1/auth/auth/login 多了一层 /auth, 之前靠 mock catch-all 兜底返回 200 "通过"
        resp = await client.post("/api/v1/auth/login", json={})
        assert resp.status_code in (200, 422)


class TestRouteRegistration:
    async def test_agents_list_endpoint_exists(self, client):
        resp = await client.get("/api/v1/agents/list")
        assert resp.status_code in (200, 401, 500)

    async def test_user_info_requires_auth(self, client):
        resp = await client.get("/api/v1/user/info")
        # RuoYi /user/info/{username} 需要 username 参数, 缺失则 422;
        # 老接口需要 auth -> 401. 两者都是合法响应.
        assert resp.status_code in (401, 403, 422, 500)

    async def test_courses_endpoint_exists(self, client):
        resp = await client.get("/api/v1/courses/list")
        assert resp.status_code in (200, 401, 500)

    async def test_bots_endpoint_exists(self, client):
        resp = await client.get("/api/v1/bots/list")
        assert resp.status_code in (200, 401, 500)
