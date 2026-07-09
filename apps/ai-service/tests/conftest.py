"""pytest 配置与 fixtures。"""

import sys
from pathlib import Path

# 确保 app 包可导入
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    """异步 HTTP 测试客户端(httpx + ASGI)。"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
