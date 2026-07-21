"""pytest 配置与 fixtures。"""

import os
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


# vendor_env_keys 列表(与 app/core/llm_gateway.py LLMGateway._is_stub_mode 同步)
# _is_stub_mode 检查 os.environ 里这 50+ 个 key 是否有任一非空 → 否就 stub 模式
# app.main 启动时通过 os.environ.setdefault 把 .env 真实 key 同步到 os.environ,
# 必须也清空这些 key,否则 _is_stub_mode 仍 False,会调真实 OpenAI API(测试无 key 必失败)
_VENDOR_ENV_KEYS = (
    "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY",
    "OPENROUTER_API_KEY", "COHERE_API_KEY", "MISTRAL_API_KEY", "XAI_API_KEY",
    "PERPLEXITY_API_KEY", "DEEPSEEK_API_KEY", "TOGETHERAI_API_KEY",
    "HUGGINGFACE_API_KEY", "REPLICATE_API_KEY", "AI21_API_KEY",
    "FIREWORKS_API_KEY", "WATSONX_API_KEY", "UPSTAGE_API_KEY",
    "DASHSCOPE_API_KEY", "ZHIPUAI_API_KEY", "MOONSHOT_API_KEY",
    "BAIDU_API_KEY", "YI_API_KEY", "MINIMAX_API_KEY", "SPARK_API_KEY",
    "BAICHUAN_API_KEY", "HUNYUAN_API_KEY", "STEPFUN_API_KEY", "AGNES_API_KEY",
    "DOUBAO_API_KEY", "AZURE_OPENAI_API_KEY", "AZURE_API_KEY",
    "AWS_ACCESS_KEY_ID", "AWS_BEDROCK_API_KEY",
    "VERTEX_API_KEY", "VERTEX_AI_API_KEY",
    "OLLAMA_API_BASE", "ANTHROPIC_VERTEX_API_KEY",
    "NOVITA_API_KEY", "LAMBDA_API_KEY", "BASETEN_API_KEY",
    "CEREBRAS_API_KEY", "SAMBANOVA_API_KEY", "DEEPINFRA_API_KEY",
    "FRIENDLI_API_KEY", "ANYSCALE_API_KEY", "LEPTONAI_API_KEY",
    "PPIO_API_KEY", "SILICONCLOUD_API_KEY", "MODELSCOPE_API_KEY",
    "NEBIUS_API_KEY", "FEATHERLESS_API_KEY", "PARASAIL_API_KEY",
    "OPENWEBUI_API_KEY", "LMSTUDIO_API_KEY",
)


@pytest.fixture(autouse=True)
def _isolate_llm_env(monkeypatch):
    """隔离 .env 真实 API key:每个测试前清空所有 7 个 settings key + 50+ os.environ vendor key,
    确保从干净状态开始。避免测试因 .env 中的真实 key 意外调用真实 API。
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

    # 清空 os.environ 里的 vendor key(app.main 启动时同步过)
    for k in _VENDOR_ENV_KEYS:
        monkeypatch.delenv(k, raising=False)

    async def _noop_resolve_from_db(model, owner_uuid=None):
        return None

    monkeypatch.setattr("app.core.llm_gateway._resolve_from_db", _noop_resolve_from_db)


@pytest.fixture(autouse=True)
def _isolate_vector_memory(monkeypatch):
    """隔离 vector_memory 单例:每个测试前清空状态 + 强制内存模式。

    原因:
    - conftest 默认 REDIS_URL 仍是 settings.redis_url(测试环境通常无 Redis)
    - vector_memory 默认 _use_redis=True,_get_redis 会尝试连接,失败后才降级
      (会卡住测试几秒,影响速度)
    - _next_id 需要重置,避免跨测试 id 递增
    """
    from app.services.vector_memory import vector_memory

    def _force_memory_mode():
        vector_memory._use_redis = False
        vector_memory._redis = None
        vector_memory._store.clear()
        vector_memory._next_id = 1

    _force_memory_mode()
    yield
    _force_memory_mode()
