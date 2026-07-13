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


@pytest.fixture(autouse=True)
def _isolate_llm_env(monkeypatch):
    """隔离 .env 真实 API key:每个测试前清空所有 7 个 key,确保从干净状态开始。

    避免测试因 .env 中的真实 key 意外调用真实 API。
    需要真实模式的测试自行 monkeypatch 设置对应 key。
    同时 mock _resolve_from_db 避免 asyncpg 连接数据库(测试环境无 DB)。
    """
    from app.core.config import settings

    for key in (
        "openai_api_key",
        "anthropic_api_key",
        "groq_api_key",
        "gemini_api_key",
        "openrouter_api_key",
        "agnes_api_key",
        "stepfun_api_key",
    ):
        monkeypatch.setattr(settings, key, "")

    async def _noop_resolve_from_db(model, owner_uuid=None):
        return None

    monkeypatch.setattr("app.core.llm_gateway._resolve_from_db", _noop_resolve_from_db)
