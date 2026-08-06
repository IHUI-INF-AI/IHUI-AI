"""IHUI AI 服务 - FastAPI 入口。

提供 LLM 网关、MCP 工具、LangGraph 工作流等 AI 能力。

ASGI 拓扑:
- FastAPI 处理所有 HTTP 路由(/api/* /health /metrics 等)
- Socket.IO 处理 /socket.io/* 路径(兼容历史 coze_zhs_py 客户端)
- 根 ASGI app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)
  /socket.io/* → sio,其余 → fastapi_app(含中间件栈)
"""
import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from typing import Any

# Windows + asyncio 强制使用 ProactorEventLoop(支持 subprocess_exec)
# 否则 Playwright 启动 Chromium 会报 NotImplementedError(2026-07-22 立)
# Python 3.8+ 在 Windows 默认就是 ProactorEventLoop,但某些 ASGI 框架
# (如 python-socketio)可能改 EventLoop policy,这里强制确保
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import socketio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

from app import __version__
from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.jwt_auth import JWTAuthMiddleware
from app.core.schema_check import check_schema, log_report
from app.routers import a2a, agent_runtime, agents, health, llm, mcp, personas, tools, voice_stt
from app.routers import self_media
from app.routers import publish
from app.routers import opencompass
from app.routers import screenshot
# 2026-07-23 新增:AI Skills TOP 19 个 skill 路由(用户可选调用)
from app.routers import ai_skills
# P3 深度层 Wave 11:6 大对标能力(2026-07-22 立,对标 Codex/Trae/Qoder)
from app.routers import rules, hooks, spec
# 跨支柱编排中枢(2026-07-23 立,事件总线 + 联合决策 + 预算治理 + 统一遥测)
from app.routers import orchestration
# Context Engineering 路由(对标 Qoder,多维 @ 提及 + 跨会话 RAG + 多源融合)
from app.services.context_engine import router as context_engine_router
# IM 桥接服务(2026-07-31 立,消费 Redis im:inbound 队列 → LLM 回复 → 调 apps/api im-gateway/send)
from app.services.im_bridge import im_bridge_service
from app.routers.legacy import router as legacy_router
# P3 深度层:AI 教育引擎(AI 助教)+ LangGraph 升级(PostgresSaver + interrupt HITL + streaming)
from app.routers.ai_tutor import router as ai_tutor_router
from app.routers.langgraph import router as langgraph_router
# L4 自进化 admin 端点(status/lessons/history/trigger,2026-07-25 立)
from app.routers.meta_learning import router as meta_learning_router
from app.sio import sio
from app.sio.handlers import register_handlers
from app.telemetry import setup_telemetry, shutdown_telemetry
from app.middleware.audit import setup_audit_middleware
from app.middleware.input_sanitizer import (
    setup_input_sanitizer_middleware,
    setup_rate_limit_middleware,
)
from app.middleware.response_sanitizer import setup_response_sanitizer_middleware
from app.middleware.trace_context import setup_trace_context_middleware

logger = logging.getLogger(__name__)

# 2026-08-06 立:配置 root logger,让 stdlib logger.info 可见
# 根因:uvicorn 只配置 uvicorn.* logger,root logger 保持默认(WARNING + lastResort),
# 导致 llm_gateway 等 stdlib logger 的 [auto-route] / [fallback_router] 等 info 日志被过滤。
# structlog 走自己的配置(PrintLoggerFactory → stderr,见 app/core/logging.py),不受影响。
# basicConfig 在 root logger 无 handler 时生效(uvicorn 不配 root handler),加 stdout StreamHandler。
logging.basicConfig(
    level=logging.INFO,
    stream=sys.stdout,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)

# 同步 settings 关键变量到 os.environ,确保用 os.getenv() 读取的模块(如 agent_runtime)
# 能拿到 .env 配置(pydantic-settings 只加载到 Settings 对象,不同步到 os.environ)。
# 仅在变量未设置时 setdefault,不覆盖运行时注入的值(如测试 monkeypatch)。
for _key in ("REDIS_URL", "DATABASE_URL", "JWT_SECRET", "AI_CALLBACK_SECRET",
             "STEPFUN_API_KEY", "STEPFUN_API_BASE",
             "AGNES_API_KEY", "AGNES_API_BASE",
             "AGENT_CONTROL_INTERNAL_SECRET",
             # 2026-07-27:MCP 工作区白名单(防 read_file 路径前缀重复拼接 bug)
             "MCP_WORKSPACE_ROOTS",
             # 2026-07-30:Combo 多级 fallback 链(JSON),同步到 os.environ 让 combo_router 读到
             "COMBO_CHAINS"):
    _val = getattr(settings, _key.lower(), None)
    if _val:
        os.environ.setdefault(_key, _val)

# LLM provider keys(2026-07-27 立):同步到 os.environ 让 LiteLLM 库内部调用
# (不走 _resolve_provider 的路径)也能从环境变量读到配置。
# 仅在变量非空 + 未设置时 setdefault,不覆盖用户系统环境变量。
if settings.ollama_api_key:
    os.environ.setdefault("OLLAMA_API_KEY", settings.ollama_api_key)
if settings.lmstudio_api_key:
    os.environ.setdefault("LMSTUDIO_API_KEY", settings.lmstudio_api_key)
if settings.azure_api_key:
    os.environ.setdefault("AZURE_API_KEY", settings.azure_api_key)
if settings.aws_access_key_id:
    os.environ.setdefault("AWS_ACCESS_KEY_ID", settings.aws_access_key_id)


@asynccontextmanager
async def lifespan(app: FastAPI) -> Any:
    """应用生命周期。

    启动时执行 ai_model_config 字段对照校验(防止 ai-service 与 TS schema 漂移),
    字段缺失仅记录 warning,不阻塞启动(生产可用性优先)。
    """
    try:
        result = await check_schema()
        log_report(result)
    except Exception as e:
        logger.warning("[schema_check] 启动校验异常(忽略): %s", e)

    # 启动自媒体定时任务调度器(由 SELF_MEDIA_CRON_ENABLED 环境变量控制开关,
    # 默认 false,显式开启后才挂载 asyncio task)
    from app.services.self_media_scheduler import self_media_scheduler
    self_media_scheduler.start()

    # 模型可用性服务(2026-07-31 立,用户规则:只显示可完美接通调用的模型)
    # 启动时后台跑首次 ping(不阻塞 FastAPI 启动)+ 每 5 分钟定时刷新 provider 健康状态。
    # /llm/models 端点调用 model_availability.get_available_models() 过滤不可用模型。
    from app.services.model_availability import model_availability
    await model_availability.initialize()

    # 启动模型自动同步服务(每 6 小时全量同步,2026-07-31 立)
    # 从已配置 key 的 provider /v1/models 拉取模型清单,注册到 DB(自动上架/下架)
    from app.services.model_sync import model_sync_service
    await model_sync_service.initialize()

    # 启动 IM 桥接服务(2026-07-31 立)
    # 消费 Redis im:inbound 队列 → 调 LLM 生成回复 → 调 apps/api im-gateway/send 回复到 IM 平台
    # Redis 不可用时降级为 no-op(不阻塞 lifespan)
    await im_bridge_service.initialize()

    # 配置 FallbackRouter 故障转移(2026-07-24 立)
    # StepFun 故障(timeout/overloaded/rate_limited)时自动切 agnes/gpt-4o 兜底
    from app.core.llm_gateway import fallback_router
    fallback_router.configure(
        "stepfun/step-3.7-flash",
        {
            "fallbacks": ["agnes/gpt-4o"],
            "triggerOnError": ["timeout", "overloaded", "rate_limited"],
        },
    )
    fallback_router.configure(
        "stepfun/step-router-v1",
        {
            "fallbacks": ["agnes/gpt-4o"],
            "triggerOnError": ["timeout", "overloaded", "rate_limited"],
        },
    )
    logger.info("[fallback_router] configured: stepfun -> agnes/gpt-4o")

    # 启动时从 Redis 加载历史向量记忆(进程重启不丢)
    # 失败/无 Redis 时静默降级为内存模式,不阻塞启动
    from app.services.vector_memory import vector_memory
    hydrated = await vector_memory.hydrate()
    if hydrated:
        logger.info("[vector_memory] 启动从 Redis hydrate %d 条历史记忆", hydrated)

    # P1 修复:memory_decay 改为按需懒加载(首次 apply_decay/prune_decayed 时触发
    # _ensure_loaded(user_id)),不再启动时全量 hydrate 所有用户衰减状态
    # (原 load_all_states() 导致启动慢 + 内存峰值高)

    # L2-5 启动梦境固化调度器(周期触发 DreamService.consolidate + forget)
    # 由 DREAM_ENABLED 环境变量控制开关(默认 false,避免消耗 LLM tokens)
    # 失败不阻塞主服务(单次循环异常只 warning,下次循环自动恢复)
    from app.services.dream_scheduler import dream_scheduler
    await dream_scheduler.start()

    # P1 修复:user_profile 改为按需懒加载(首次 update_profile 时触发
    # _ensure_loaded(user_id)),不再启动时全量 hydrate 所有用户画像
    # (原 load_all_profiles() 导致启动慢 + 内存峰值高)

    # L3 启动 Skill 自进化调度器(周期扫描有失败反馈的 skill 触发 iterate_on_feedback)
    # 由 SKILL_EVOLUTION_ENABLED 环境变量控制开关(默认 false,避免消耗 LLM tokens)
    # 失败不阻塞主服务(单次循环异常只 warning,下次循环自动恢复)
    from app.services.skill_evolution_scheduler import skill_evolution_scheduler
    await skill_evolution_scheduler.start()

    # P1 修复:meta_learner 改为按需懒加载(首次 learn_from_failures/record_self_eval
    # 时触发 _ensure_loaded()),不再启动时全量 hydrate 所有 meta_lessons
    # (原 load_all_lessons() 导致启动慢 + 内存峰值高)

    # L4 启动元学习调度器(周期扫描跨 skill 失败案例,触发 FailureClusterer 聚类
    # + 抽取 meta_lessons,对标 Hermes Agent meta-learning cycle)
    # 由 META_LEARNER_ENABLED 环境变量控制开关(默认 false,避免消耗 LLM tokens)
    # 失败不阻塞主服务(单次循环异常只 warning,下次循环自动恢复)
    from app.services.meta_learner_scheduler import meta_learner_scheduler
    await meta_learner_scheduler.start()

    # P1 修复:ab_test_tracker 改为按需懒加载(首次 create_test/flush_all_running 等
    # 异步方法时触发 _ensure_loaded()),不再启动时全量 hydrate 所有 running 测试
    # (原 load_active_tests() 导致启动慢 + 内存峰值高)

    # L5 启动 A/B 测试调度器(周期 flush stats + 触发显著性检验 + auto promote/rollback)
    # 由 AB_TEST_ENABLED 环境变量控制开关(默认 false,避免消耗 LLM tokens 做 shadow call)
    # 失败不阻塞主服务(单次循环异常只 warning,下次循环自动恢复)
    from app.services.ab_test_scheduler import ab_test_scheduler
    await ab_test_scheduler.start()

    # P1 修复:federated_learner 改为按需懒加载(首次 list_federated_lessons/
    # build_system_prompt_snippet 时触发 _ensure_loaded()),不再启动时全量 hydrate
    # 所有 federated_lessons(原 load_all_lessons() 导致启动慢 + 内存峰值高)

    # L6 多模态记忆 / L8 长程记忆 按用户加载,首次访问时按需 hydrate(避免启动时全表扫描)
    # L9 元认知按需触发反思(reflect_on_memories),无全局 load_all
    # 四层均无 background task,启动时无需 start 调度器,关闭时无需 stop

    # 启动多平台一键发布调度器(轮询 publish_tasks 表 scheduled_at 到期任务,
    # 同用户最多 3 个并发,失败平台支持 retry)
    from app.services.publish.scheduler import publish_scheduler
    publish_scheduler.start()

    # 启动后台任务调度器(APScheduler AsyncIOScheduler + Redis 持久化,对标 Codex Automations)
    # schedule_enabled=False 时跳过;失败不阻塞主服务(stub/内存降级由 scheduler_service 内部处理)
    if getattr(settings, "schedule_enabled", True):
        try:
            from app.services.scheduler_service import task_scheduler
            await task_scheduler.start()
        except Exception as e:
            logger.warning("[scheduler_service] 启动失败(忽略): %s", e)

    # 截图服务(Playwright)按需启动,不在 lifespan 启动时初始化(避免 Chromium 占用)
    # 首次截图请求时懒加载,退出时 shutdown() 清理

    yield
    # P0 修复(2026-08-02):移除 yield 后的 shutdown_telemetry() 重复调用,
    # 保留末尾(所有 cleanup 之后)的 shutdown_telemetry() 作为最后清理,避免重复 shutdown。

    # 关闭模型可用性服务(取消定时刷新任务,2026-07-31 立)
    from app.services.model_availability import model_availability
    await model_availability.shutdown()

    # 关闭模型自动同步服务(取消定时同步任务,2026-07-31 立)
    from app.services.model_sync import model_sync_service
    await model_sync_service.shutdown()

    # 关闭 IM 桥接服务(取消消费任务 + 关闭 Redis 连接,2026-07-31 立)
    await im_bridge_service.shutdown()

    # 关闭梦境固化调度器(等待进行中的用户固化任务完成)
    from app.services.dream_scheduler import dream_scheduler
    await dream_scheduler.stop()

    # 关闭 Skill 自进化调度器(等待进行中的 skill 迭代任务完成)
    from app.services.skill_evolution_scheduler import skill_evolution_scheduler
    await skill_evolution_scheduler.stop()

    # 关闭元学习调度器(等待进行中的失败聚类任务完成)
    from app.services.meta_learner_scheduler import meta_learner_scheduler
    await meta_learner_scheduler.stop()

    # L5 关闭 A/B 测试调度器(等待进行中的显著性检验任务完成)
    from app.services.ab_test_scheduler import ab_test_scheduler
    await ab_test_scheduler.stop()

    await publish_scheduler.stop()
    await self_media_scheduler.stop()
    # 关闭后台任务调度器(等待运行中任务完成)
    try:
        from app.services.scheduler_service import task_scheduler
        await task_scheduler.shutdown()
    except Exception as e:
        logger.warning("[scheduler_service] 关闭失败(忽略): %s", e)
    # 关闭 Playwright 单例(避免 Chromium 进程泄漏)
    from app.services.screenshot_service import shutdown as screenshot_shutdown
    await screenshot_shutdown()

    # 关闭 Browser Hub(2026-07-31 立:CDP 完整 Chrome 内置浏览器)
    # 懒加载,若未启动则 no-op;若已启动则关闭所有 session + Chromium 实例
    try:
        from app.services.browser_hub import hub
        await hub.stop()
    except Exception as e:
        logger.warning("[browser_hub] 关闭失败(忽略): %s", e)

    # P1 修复:关闭所有 LSP 子进程(_instances 全局 dict 持有 LspClient 单例,
    # 不主动 shutdown 会导致 typescript-language-server 子进程 + reader_task 泄漏)
    try:
        from app.api.v1.lsp import LspClient
        await LspClient.shutdown_all()
        logger.info("[lsp] all LSP clients shut down")
    except Exception as e:
        logger.warning("[shutdown] LspClient.shutdown_all 失败(忽略): %s", e)

    # 关闭全局共享 httpx.AsyncClient(连接池复用,provider 共享)
    from app.core.llm_gateway import close_http_client
    await close_http_client()

    # 关闭 api-service → api 调用的共享 httpx.AsyncClient(mTLS 客户端)
    from app.services.api_client import close_api_client
    await close_api_client()

    # 修复(2026-07-28):统一关闭共享 asyncpg 连接池(app.core.db_pool)。
    # 原 14 个独立 pool 已全部复用 get_shared_pool(),此处一次 close 即可释放所有连接,
    # 避免 shutdown 阶段逐个 service 调 close_pool(no-op)的冗余逻辑。
    from app.core.db_pool import close_shared_pool
    await close_shared_pool()

    # P1 修复(2026-07-31 资源泄露):关闭各 service 持有的独立连接池 / Redis 客户端。
    # 这些单例有自己的 close() 方法但此前未被 lifespan 调用,导致 uvicorn 重启时
    # asyncpg / psycopg / Redis 连接累积,PostgreSQL pg_stat_activity 与 Redis CLIENT LIST 持续增长。
    try:
        from app.services.knowledge_graph import graph_store
        if hasattr(graph_store, "close"):
            await graph_store.close()
            logger.info("[shutdown] knowledge_graph closed")
    except Exception as e:
        logger.warning("[shutdown] knowledge_graph.close 失败(忽略): %s", e)

    try:
        from app.services.langgraph_checkpoint import get_langgraph_checkpoint_manager
        await get_langgraph_checkpoint_manager().close()
        logger.info("[shutdown] langgraph_checkpoint closed")
    except Exception as e:
        logger.warning("[shutdown] langgraph_checkpoint.close 失败(忽略): %s", e)

    try:
        from app.services.agent_checkpoint import get_agent_checkpoint_manager
        await get_agent_checkpoint_manager().close()
        logger.info("[shutdown] agent_checkpoint closed")
    except Exception as e:
        logger.warning("[shutdown] agent_checkpoint.close 失败(忽略): %s", e)

    # 关闭旧版 app.core.db 独立 pool(若已被 db_pool.py 取代则为 no-op)
    try:
        from app.core.db import close_db_pool
        await close_db_pool()
    except Exception as e:
        logger.warning("[shutdown] close_db_pool 失败(忽略): %s", e)

    # 关闭 Socket.IO AsyncServer(显式 disconnect,确保所有客户端收到 disconnect 事件 +
    # 释放 EngineIO 资源;uvicorn ASGI lifespan 也会清理,但显式调用更安全)
    try:
        await sio.disconnect()
        logger.info("[shutdown] socket.io disconnected")
    except Exception as e:
        logger.warning("[shutdown] sio.disconnect 失败(忽略): %s", e)

    shutdown_telemetry()


def create_app() -> FastAPI:
    """创建 FastAPI 应用实例。"""
    app = FastAPI(
        title="IHUI AI Service",
        description="AI 服务 - LLM 网关 + MCP + LangGraph",
        version=__version__,
        lifespan=lifespan,
    )

    # CORS — 启动时校验(生产环境必填,任何环境禁止 "*" 通配符)
    settings.validate_cors_origin()
    # mTLS — 启动时 fail-fast 校验(MTLS_ENABLED=true 但证书缺失/不存在 → 抛异常阻止启动)
    settings.validate_mtls_config()
    _cors_origins = [o.strip() for o in settings.cors_origin.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Internal-Secret"],
    )

    # JWT 认证中间件（与 apps/api 共享 JWT_SECRET，SSO 跨服务认证）
    app.add_middleware(JWTAuthMiddleware)

    # OpenTelemetry 追踪中间件（未配置 OTEL_EXPORTER_OTLP_ENDPOINT 时降级为 no-op）
    setup_telemetry(app)

    # traceparent 上下文中间件(解析 api 端透传的 W3C traceparent 入 request.state.trace_id,
    # 供 telemetry_middleware 关联 parent context + 业务 logger 使用,2026-07-22 立)
    setup_trace_context_middleware(app)

    # 审计日志中间件(记录所有 POST/PATCH/PUT/DELETE,与 api 端 audit.ts 对等,2026-07-22 立)
    setup_audit_middleware(app)
    # 输入净化中间件(XSS + Prompt Injection 检测,2026-07-22 立)
    setup_input_sanitizer_middleware(app)
    # 响应脱敏中间件(敏感字段替换 ***,2026-07-22 立)
    setup_response_sanitizer_middleware(app)
    # 限流中间件(令牌桶,/api/llm/* 60/min, /api/v1/chat/* 30/min,2026-07-22 立)
    setup_rate_limit_middleware(app)

    # 全局异常兜底:未捕获的 Exception 返回 500 JSON(避免 ASGI 默认 HTML 错误页)
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Any, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"code": 500, "message": "服务内部错误", "data": None},
        )

    # 注册路由(路由器自带 /llm /mcp /agents /a2a /tools 前缀,统一加 /api)
    app.include_router(health.router, tags=["health"])
    app.include_router(llm.router, prefix="/api", tags=["llm"])
    app.include_router(tools.router, prefix="/api", tags=["tools"])
    app.include_router(mcp.router, prefix="/api", tags=["mcp"])
    app.include_router(agents.router, prefix="/api", tags=["agents"])
    app.include_router(a2a.router, prefix="/api", tags=["a2a"])
    app.include_router(personas.router, prefix="/api", tags=["personas"])
    app.include_router(agent_runtime.router, prefix="/api", tags=["agent-runtime"])
    app.include_router(voice_stt.router, prefix="/api", tags=["voice"])
    # 自媒体 skill(公众号文章 + 口播稿,2026-07-20 新增)
    app.include_router(self_media.router, prefix="/api", tags=["self-media"])
    # AI Skills TOP 19 个 skill 路由(2026-07-23 新增,用户可选调用)
    app.include_router(ai_skills.router, prefix="/api", tags=["ai-skills"])
    # 多平台一键发布(14 平台 + AES-256-GCM 凭证加密 + 调度器,2026-07-20 新增)
    app.include_router(publish.router, prefix="/api", tags=["publish"])
    # 多平台扫码登录(2026-07-30 新增,WorkPanel 内置浏览器扫码 → 自动保存 cookies 到账号)
    from app.routers import scan_login as scan_login_router
    app.include_router(scan_login_router.router, prefix="/api", tags=["publish-scan-login"])
    # 2026-08-01 新增:账号分组管理 + 批量账号导入/导出/验证 + Cookie 健康度查询
    from app.services.publish.account_groups import router as account_groups_router
    app.include_router(account_groups_router, prefix="/api", tags=["publish-account-groups"])
    # 2026-08-01 新增:Cookie 自动保活守护进程(Playwright headless 每 6 小时刷新)
    from app.services.publish.cookie_refresh_daemon import router as cookie_refresh_router
    app.include_router(cookie_refresh_router, prefix="/api", tags=["publish-cookie-refresh"])
    # 2026-07-31 新增:Browser Hub(CDP 完整 Chrome 内置浏览器,对标 Trae/Cursor)
    # WebSocket 画面流 + REST API + 鼠标键盘事件回传
    from app.routers import browser_hub as browser_hub_router
    app.include_router(browser_hub_router.router, prefix="/api", tags=["browser-hub"])
    # OpenCompass 排行榜抓取(Playwright 渲染,2026-07-22 新增,供 api ai-world-sync 调用)
    app.include_router(opencompass.router, prefix="/api", tags=["opencompass"])
    # 截图服务(Playwright headless,2026-07-22 新增,WorkPanel iframe 降级)
    app.include_router(screenshot.router, prefix="/api", tags=["screenshot"])
    # v1 业务流路由(对话/智能体/RAG,2026-07-20 新增)
    app.include_router(api_v1_router, prefix="/api/v1", tags=["v1"])
    # LSP 转发路由(封装 cli LSP 能力为 HTTP 端点,供 web 端 IDE 调试面板调用,2026-07-22 新增)
    from app.api.v1 import lsp as lsp_router_module
    app.include_router(lsp_router_module.router, prefix="/api/v1", tags=["lsp"])
    # DAP 调试路由(封装 DebugSessionManager 为 HTTP 端点,2026-07-22 新增)
    from app.api.v1 import debug as debug_router_module
    app.include_router(debug_router_module.router, prefix="/api/v1", tags=["debug"])
    # 四层记忆 + Dream 梦境系统(2026-07-22 新增,对标 OpenClaw Mem)
    from app.api.memory import router as memory_router
    app.include_router(memory_router, prefix="/api", tags=["memory"])
    # 多通道消息总线(5 通道 + 优先级 + 降级 + 模板 + 批量 + 限流,2026-07-22 新增,反超 OpenClaw 单 WS)
    from app.api.message_bus import router as message_bus_router
    app.include_router(message_bus_router, prefix="/api", tags=["message-bus"])
    # DAG Worker Pool(2026-07-22 立,多 agent 并行执行 — 限并发 N worker + 优先级队列 + 持久化)
    from app.api.dag import router as dag_router
    app.include_router(dag_router, prefix="/api/dag", tags=["dag"])
    # P3 Wave 11:Rules 引擎(对标 Trae Rules,文件存储 .trae-cn/rules/*.md + 热加载 + 4 种匹配)
    app.include_router(rules.router, prefix="/api", tags=["rules"])
    # P3 Wave 11:Hook 服务(对标 Trae Hooks,事件总线 + JSONLogic 条件 + 4 执行器)
    app.include_router(hooks.router, prefix="/api", tags=["hooks"])
    # P3 Wave 11:Plan/Spec 模式(对标 Trae Plan/Spec,tree-sitter AST 反向生成 spec markdown)
    app.include_router(spec.router, prefix="/api", tags=["spec"])
    # P3 Wave 11:Spec 扩展端点(apply preview/confirm + watch + review + split-tasks + enhance)
    # 路由定义在 services/spec_generator.py 末尾,打通 api 端 spec-service.ts 转发层(2026-07-24 立)
    from app.services.spec_generator import extra_router as spec_extra_router
    app.include_router(spec_extra_router, prefix="/api", tags=["spec-extended"])
    # P3 Wave 11:Context Engineering(对标 Qoder,多维 @ 提及 + 跨会话 RAG + 多源融合 + token 预算分配)
    app.include_router(context_engine_router, prefix="/api/context", tags=["context-engine"])
    # 跨支柱编排中枢(2026-07-23 立,6 大超越支柱协同决策 + LLM 预算治理 + 统一遥测)
    app.include_router(orchestration.router, prefix="/api", tags=["orchestration"])
    app.include_router(legacy_router)
    # P3 深度层:AI 助教(学科讲解/提示/出题)+ LangGraph(interrupt/resume/state/history/stream)
    app.include_router(ai_tutor_router)
    app.include_router(langgraph_router)
    # L4 自进化 admin 端点(meta_learner 状态/lessons/history + 手动触发聚类,2026-07-25 立)
    app.include_router(meta_learning_router)

    # 审计日志查询端点(调试用,返回最近审计记录,2026-07-22 立)
    # P2-8 修复(2026-08-06):审计记录含 agent 行为明细,限系统管理员(role_id >= 1)访问,
    # 普通登录用户无权读取。
    @app.get("/api/audit/recent", tags=["audit"])
    async def audit_recent(request: Request, limit: int = 100) -> dict[str, Any]:
        role_id = getattr(request.state, "role_id", 0) or 0
        if int(role_id) < 1:
            from fastapi.responses import JSONResponse

            return JSONResponse(status_code=403, content={"code": 403, "message": "仅管理员可读审计日志"})
        from app.services.audit_service import audit_service
        return {
            "code": 200,
            "message": "ok",
            "data": audit_service.get_recent(limit=limit),
        }

    # Prometheus 指标(/metrics 端点,由 prometheus-fastapi-instrumentator 自动暴露)
    Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        should_respect_env_var=False,
        excluded_handlers=["/health", "/metrics", "/socket.io"],
    ).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

    return app


# FastAPI 实例(承载所有 HTTP 路由 + 中间件 + OpenTelemetry + Prometheus)
fastapi_app = create_app()

# 注册 Socket.IO 事件处理器(connect/disconnect/join_room/leave_room/chat_message)
register_handlers(sio)

# 根 ASGI app: /socket.io/* → sio,其余 → fastapi_app(中间件栈保留)
# 兼容历史 coze_zhs_py 客户端通过 Socket.IO 协议连接新 ai-service。
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.node_env == "development",
        log_level=settings.log_level,
    )
