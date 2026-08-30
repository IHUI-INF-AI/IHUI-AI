"""pytest 配置与 fixtures。"""

import os
import sys
from pathlib import Path

# 确保 app 包可导入
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.llm_gateway import VENDOR_ENV_KEYS
from app.main import app


@pytest.fixture
async def client():
    """异步 HTTP 测试客户端(httpx + ASGI)。"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# vendor env key 列表单一来源:app/core/llm_gateway.py 模块级 VENDOR_ENV_KEYS
# (LLMGateway._is_stub_mode 第二层直接用它判定,2026-08-31 提取为模块级常量)。
# _is_stub_mode 检查 os.environ 里这些 key 是否有任一非空 → 否就 stub 模式
# app.main 启动时通过 os.environ.setdefault 把 .env 真实 key 同步到 os.environ,
# 必须也清空这些 key,否则 _is_stub_mode 仍 False,会调真实 OpenAI API(测试无 key 必失败)
# 2026-08-31 修复:此前 conftest 维护副本漏 CLOUDFLARE_API_TOKEN / NVIDIA_API_KEY /
# OPENCODE_ZEN_KEY / GITHUB_TOKEN 等 → .env 含这些 key 时 stub 测试被误判非 stub
# (stream pre-flight 422 拦截)批量失败。现 import 权威列表,永不再漂移。


@pytest.fixture(autouse=True)
def _isolate_llm_env(monkeypatch, request):
    """隔离 .env 真实 API key:每个测试前清空 50+ os.environ vendor key,
    确保从干净状态开始。避免测试因 .env 中的真实 key 意外调用真实 API。
    需要真实模式的测试自行 monkeypatch 设置对应 key。
    同时 mock _resolve_from_db 避免 asyncpg 连接数据库(测试环境无 DB)。

    阶段 3 主体(2026-07-26):扁平字段已从 Settings 删除,无需再清空 settings.*_api_key。

    2026-08-25:select_key 的全局 mock 加 real_key_pool marker 闸门 ——
    test_key_pool_selector 直接测 KeyPoolSelector.select_key 真实选择逻辑,
    全局 mock 会把它打回 None 导致 5 个测试失败(assert None is not None)。
    标记 real_key_pool 的测试保留真实 select_key(内部自备 mock pool)。
    """
    # 清空 os.environ 里的 vendor key(app.main 启动时同步过)
    for k in VENDOR_ENV_KEYS:
        monkeypatch.delenv(k, raising=False)

    # 2026-08-12 修复:COMBO_CHAINS 也会由 app.main 同步进 os.environ,
    # combo_router 构造时自动加载 → 不清理会污染 test_combo_router::test_list_combos
    # (环境泄漏导致断言 3==2)。与 vendor key 同规则清理。
    monkeypatch.delenv("COMBO_CHAINS", raising=False)

    # 2026-08-22 修复:settings.llm_providers(启动时从 .env 加载的 provider JSON)
    # 含真实 api_key 时,_is_stub_mode() 第一层即判非 stub → 测试打真实 LLM API
    # (慢/花 token/结果不稳定)。清空它,让 stub 判定只看被清空的 os.environ。
    from app.core.config import settings as _settings

    monkeypatch.setattr(_settings, "llm_providers", "")

    # 2026-08-22 修复:本地 .env 的 AGENT_EXECUTOR=loop_v2 会改变
    # /api/agents/execute/stream 的执行路径与 SSE 事件集(loop_v2 无 status/plan
    # 事件),而测试针对默认 langgraph 路径编写。删除保证确定性。
    monkeypatch.delenv("AGENT_EXECUTOR", raising=False)

    # 2026-08-22 修复:清空 REDIS_URL。app.main 启动时把 .env 的真实
    # REDIS_URL 同步进 os.environ → WorkerPool._init_redis 等组件拿到真实
    # 客户端,submit/_persist 打真实 Redis IO —— 测试协程在真实网络 IO 上
    # 让出控制权,产生调度竞态(test_queue_full_rejected 曾因此 flaky +
    # teardown 死锁)。需要 Redis 的测试自行 monkeypatch.setenv。
    monkeypatch.delenv("REDIS_URL", raising=False)

    # 2026-08-22 补强:delenv 只挡住 os.environ.get("REDIS_URL") 的组件
    # (dag_scheduler/llm_budget_governor/agent_runtime);用 settings.redis_url
    # 的组件(skill_feedback/memory/hook_engine/telemetry/vector_memory 等)
    # 仍持有 .env 固化的真实地址。此前被"redis-py 8.x 默认 RESP3 → 老 Redis
    # HELLO 3 协商必败 → 降级内存"意外掩盖;protocol=2 修复(2026-08-22)后
    # Redis 真实可达 → 测试翻转失败(DLQ 计数/事件循环跨用/sio 房间断言)。
    # 单元测试不依赖外部 Redis 状态:指向端口 1(连接立即拒绝,确定性降级内存)。
    # 显式测试 Redis 行为的测试自行 monkeypatch settings.redis_url 覆盖本值。
    monkeypatch.setattr(_settings, "redis_url", "redis://127.0.0.1:1/0")
    monkeypatch.setattr(_settings, "schedule_redis_url", "redis://127.0.0.1:1/0")

    async def _noop_resolve_from_db(model, owner_uuid=None):
        return None

    monkeypatch.setattr("app.core.llm_gateway._resolve_from_db", _noop_resolve_from_db)

    # 2026-08-22 修复:_resolve() 三层优先级的第 2 层 KeyPoolSelector.select_key
    # 查真实 DB(ai_relay_key_pool)。测试环境共享 app.main 启动的 asyncpg pool,
    # 并发查询会 "another operation is in progress" 抛错,或拿到 DB 里真实号池
    # key → current_key_pool_id 非 None → complete/astream 走"号池换 key 重试"
    # 而非 FallbackRouter → fallback_used 标记丢失/测试结果随 DB 状态翻转。
    # 单元测试统一 mock 号池不可用(返回 None → 走 .env/llm_providers JSON 层),
    # 需要测号池故障转移的测试自行 monkeypatch 覆盖。
    # 2026-08-25:标 real_key_pool 的测试(test_key_pool_selector)保留真实
    # select_key,不被全局 mock 打回 None。
    if request.node.get_closest_marker("real_key_pool") is None:
        async def _noop_select_key(provider_code):
            return None

        monkeypatch.setattr(
            "app.services.key_pool_selector.KeyPoolSelector.select_key", _noop_select_key
        )


@pytest.fixture(autouse=True)
def _isolate_jwt_auth(monkeypatch, request):
    """隔离 JWT 中间件:清空 jwt_secret → middleware 走跳过路径(node_env=development)。

    .env 中配置了真实 jwt_secret 时,JWTAuthMiddleware 会验证 token,
    不带 token 的 HTTP 测试全部 401(test_routers/test_a2a 等)。
    清空 jwt_secret + node_env=development 后,middleware 直接放行。

    此前 test_dag_api/test_debug_api/test_message_bus/test_personas_router
    各自本地做过同样隔离(2026-08 修复),现提升为全局,消除逐文件遗漏。

    2026-08-25:加 real_jwt marker 闸门 —— test_jwt_auth 的 enable_jwt fixture
    显式设置真实 secret,但 autouse fixture 的 monkeypatch 在显式 fixture 之后
    生效会把它清回空,导致 _verify_token 解码失败(3 个测试 assert None)。
    标 real_jwt 的测试跳过本隔离,自行管理 jwt_secret。
    """
    if request.node.get_closest_marker("real_jwt") is not None:
        return

    from app.core.config import settings

    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")


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
