"""健康检查端点测试。"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def client():
    """创建测试客户端。"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestHealth:
    """健康检查测试。"""

    @pytest.mark.asyncio
    async def test_health(self, client):
        """GET /health 返回 200 和 ok 状态。"""
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["service"] == "ihui-ai-service"

    @pytest.mark.asyncio
    async def test_health_live(self, client):
        """GET /health/live 返回 200 和 alive 状态。"""
        resp = await client.get("/health/live")
        assert resp.status_code == 200
        assert resp.json()["status"] == "alive"

    @pytest.mark.asyncio
    async def test_health_ready(self, client):
        """GET /health/ready 返回 200 和 ready 状态。"""
        resp = await client.get("/health/ready")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ready"
