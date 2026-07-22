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

# Windows + asyncio 强制使用 ProactorEventLoop(支持 subprocess_exec)
# 否则 Playwright 启动 Chromium 会报 NotImplementedError(2026-07-22 立)
# Python 3.8+ 在 Windows 默认就是 ProactorEventLoop,但某些 ASGI 框架
# (如 python-socketio)可能改 EventLoop policy,这里强制确保
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import socketio
from fastapi import FastAPI
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
from app.routers.legacy import router as legacy_router
from app.sio import sio
from app.sio.handlers import register_handlers
from app.telemetry import setup_telemetry, shutdown_telemetry

logger = logging.getLogger(__name__)

# 同步 settings 关键变量到 os.environ,确保用 os.getenv() 读取的模块(如 agent_runtime)
# 能拿到 .env 配置(pydantic-settings 只加载到 Settings 对象,不同步到 os.environ)。
# 仅在变量未设置时 setdefault,不覆盖运行时注入的值(如测试 monkeypatch)。
for _key in ("REDIS_URL", "DATABASE_URL", "JWT_SECRET", "AI_CALLBACK_SECRET",
             "STEPFUN_API_KEY", "STEPFUN_API_BASE",
             "AGNES_API_KEY", "AGNES_API_BASE",
             "AGENT_CONTROL_INTERNAL_SECRET"):
    _val = getattr(settings, _key.lower(), None)
    if _val:
        os.environ.setdefault(_key, _val)


@asynccontextmanager
async def lifespan(app: FastAPI):
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

    # 启动时从 Redis 加载历史向量记忆(进程重启不丢)
    # 失败/无 Redis 时静默降级为内存模式,不阻塞启动
    from app.services.vector_memory import vector_memory
    hydrated = await vector_memory.hydrate()
    if hydrated:
        logger.info("[vector_memory] 启动从 Redis hydrate %d 条历史记忆", hydrated)

    # 启动多平台一键发布调度器(轮询 publish_tasks 表 scheduled_at 到期任务,
    # 同用户最多 3 个并发,失败平台支持 retry)
    from app.services.publish.scheduler import publish_scheduler
    publish_scheduler.start()

    # 截图服务(Playwright)按需启动,不在 lifespan 启动时初始化(避免 Chromium 占用)
    # 首次截图请求时懒加载,退出时 shutdown() 清理

    yield
    shutdown_telemetry()

    await publish_scheduler.stop()
    await self_media_scheduler.stop()
    # 关闭 Playwright 单例(避免 Chromium 进程泄漏)
    from app.services.screenshot_service import shutdown as screenshot_shutdown
    await screenshot_shutdown()

    # 关闭全局共享 httpx.AsyncClient(连接池复用,provider 共享)
    from app.core.llm_gateway import close_http_client, _pool
    await close_http_client()

    # 关闭 asyncpg 连接池(llm_gateway DB 配置查询用)
    if _pool:
        await _pool.close()
        logger.info("asyncpg pool closed")

    shutdown_telemetry()


def create_app() -> FastAPI:
    """创建 FastAPI 应用实例。"""
    app = FastAPI(
        title="IHUI AI Service",
        description="AI 服务 - LLM 网关 + MCP + LangGraph",
        version=__version__,
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin.split(","),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # JWT 认证中间件（与 apps/api 共享 JWT_SECRET，SSO 跨服务认证）
    app.add_middleware(JWTAuthMiddleware)

    # OpenTelemetry 追踪中间件（未配置 OTEL_EXPORTER_OTLP_ENDPOINT 时降级为 no-op）
    setup_telemetry(app)

    # 全局异常兜底:未捕获的 Exception 返回 500 JSON(避免 ASGI 默认 HTML 错误页)
    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc):
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
    # 多平台一键发布(14 平台 + AES-256-GCM 凭证加密 + 调度器,2026-07-20 新增)
    app.include_router(publish.router, prefix="/api", tags=["publish"])
    # OpenCompass 排行榜抓取(Playwright 渲染,2026-07-22 新增,供 api ai-world-sync 调用)
    app.include_router(opencompass.router, prefix="/api", tags=["opencompass"])
    # 截图服务(Playwright headless,2026-07-22 新增,WorkPanel iframe 降级)
    app.include_router(screenshot.router, prefix="/api", tags=["screenshot"])
    # v1 业务流路由(对话/智能体/RAG,2026-07-20 新增)
    app.include_router(api_v1_router, prefix="/api/v1", tags=["v1"])
    # LSP 转发路由(封装 cli LSP 能力为 HTTP 端点,供 web 端 IDE 调试面板调用,2026-07-22 新增)
    from app.api.v1 import lsp as lsp_router_module
    app.include_router(lsp_router_module.router, prefix="/api/v1", tags=["lsp"])
    # 四层记忆 + Dream 梦境系统(2026-07-22 新增,对标 OpenClaw Mem)
    from app.api.memory import router as memory_router
    app.include_router(memory_router, prefix="/api", tags=["memory"])
    # 多通道消息总线(5 通道 + 优先级 + 降级 + 模板 + 批量 + 限流,2026-07-22 新增,反超 OpenClaw 单 WS)
    from app.api.message_bus import router as message_bus_router
    app.include_router(message_bus_router, prefix="/api", tags=["message-bus"])
    app.include_router(legacy_router)

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
