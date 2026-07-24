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
    - VectorMemoryStore 重构后用 _entries + _vectors(原 _store / _next_id 已移除)
    """
    from app.services.vector_memory import vector_memory

    def _force_memory_mode():
        vector_memory._use_redis = False
        vector_memory._redis = None
        vector_memory._entries.clear()
        vector_memory._vectors.clear()
        vector_memory._dirty = False
        vector_memory._hydrated = False

    _force_memory_mode()
    yield
    _force_memory_mode()


# =============================================================================
# tool loop 端到端测试 fixtures(2026-07-24 立,提取自 .trae-cn/tmp/mock_extension.py)
# =============================================================================

@pytest.fixture
def mock_extension_capability():
    """模拟 extension 端上报的 capability payload。

    参考 mock_extension.py 第 28-32 行 BROWSER_ACTIONS + 第 51-58 行 report_capability。
    用于测试 agent-control 路由的 capability 上报与 status 查询。
    """
    import uuid

    return {
        "endpoint": "extension",
        "instanceId": f"mock-ext-{uuid.uuid4().hex[:8]}",
        "browserActions": [
            "screenshot", "click_element", "type_text", "scroll", "extract_dom",
            "navigate", "wait_for_element", "get_attribute", "hover", "select_option",
            "switch_tab", "close_tab",
        ],
        "computerActions": [],
        "version": "mock-1.0.0",
        "reportedAt": "2026-07-24T00:00:00Z",
    }


@pytest.fixture
def mock_agent_action_handler():
    """模拟 extension 端执行 agent action 的 async handler。

    参考 mock_extension.py 第 99-131 行 handle_agent_action 逻辑:
    不同 action 返回不同 fake data(screenshot → base64 PNG / extract_dom → DOM 树 / 其他 → 通用)。
    """
    async def handler(
        request_id: str,
        action: str,
        category: str,
        params: dict,
    ) -> dict:
        """模拟执行 agent action,返回 fake data。"""
        if action == "screenshot":
            return {
                "screenshot": "mock-base64-png-data",
                "area": "viewport",
                "mock": True,
            }
        elif action == "extract_dom":
            return {
                "dom": [{"tag": "html", "text": "mock page"}],
                "count": 1,
                "totalMatched": 1,
                "mock": True,
            }
        elif action == "navigate":
            return {
                "url": params.get("url", "about:blank"),
                "title": "Mock Page",
                "mock": True,
            }
        else:
            return {
                "mock": True,
                "action": action,
                "executedBy": "extension",
            }

    return handler


@pytest.fixture
def captured_tool_results():
    """收集 tool-result 事件列表,用于 tool loop 测试中断言。

    测试中解析 SSE 流时,把 tool-result 事件追加到此列表,
    结束后检查 repeated / ok / errorCode 等字段。
    """
    return []
