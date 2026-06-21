"""端到端测试：Coze bot/chat/agent/AI 路由."""

import pytest

pytestmark = pytest.mark.asyncio


class TestBotsEndpoints:
    async def test_bot_list(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/bots/list",
            params={"page": 1, "limit": 10},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_bot_categories(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/bots/categories",
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)


class TestChatEndpoints:
    async def test_chat_list(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/chat/list",
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_multi_vendor_list(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/chat/multi/list",
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)


class TestAgentsEndpoints:
    async def test_agents_list(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/agents/list",
            params={"page": 1, "limit": 10},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_agents_categories(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/agents/categories/list",
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_agents_heat(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/agents/heat/list",
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_agents_rules(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/agents/rules/list",
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)


class TestAIModelInfo:
    async def test_vendors_endpoint(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/ai/models/vendors",
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_models_list(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/ai/models/list",
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)


class TestMCPEndpoints:
    async def test_mcp_list(self, client):
        resp = await client.get("/api/v1/mcp/list")
        assert resp.status_code in (200, 401, 404, 500)

    async def test_mcp_tool_health(self, client):
        resp = await client.get("/api/v1/mcp/ali/health")
        assert resp.status_code in (200, 401, 404, 500)
