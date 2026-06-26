"""ZHS Platform - FastAPI application factory."""

import os
import sys
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger

from app.config import settings
from app.core.admin_auth import admin_required
from app.monitoring import PrometheusMiddleware, render_metrics
from app.utils.cached_static import CachedStaticFiles

# Ensure scripts can be imported (for AUTO_CREATE_SCHEMA + seed_admin)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

# Project-level logs/ directory: avoid logs being written to external locations
_LOG_DIR = _PROJECT_ROOT / "logs"
_LOG_DIR.mkdir(parents=True, exist_ok=True)
logger.add(
    str(_LOG_DIR / "uvicorn.log"),
    rotation="20 MB",
    retention="14 days",
    encoding="utf-8",
    enqueue=True,
    backtrace=True,
    diagnose=False,
    level="INFO",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("Starting ZHS Platform...")

    # Clock source audit: write TZ/tzname into structured log at startup
    # Used to diagnose ZHSMonitorClockDrift alerts when TZ is K8s pod / docker / host mismatch
    import os as _os
    import time as _t

    try:
        _tz_env = _os.environ.get("TZ", "")
        _tz_name = _t.tzname
        _tz_local = _t.localtime()
        _time_str = _t.strftime("%Y-%m-%d %H:%M:%S %Z", _tz_local)

        # UTC+8 (Asia/Shanghai) = +28800, UTC-5 (EST) = -18000
        _utc_offset_sec = getattr(_tz_local, "tm_gmtoff", 0) or 0

        # Push TZ offset to Prometheus (for ZHSMonitorTimezoneMismatch)
        try:
            from app.metrics_business import APP_CLOCK_TZ_EXPECTED, APP_CLOCK_TZ_OFFSET

            APP_CLOCK_TZ_OFFSET.set(_utc_offset_sec)
            _expected = int(_os.environ.get("ZHS_EXPECTED_TZ_OFFSET_SEC", "28800"))
            APP_CLOCK_TZ_EXPECTED.set(_expected)
        except Exception as e:
            logger.debug("推送时区指标到 Prometheus 失败: %s", e)

        logger.bind(
            clock_tz_env=_tz_env,
            clock_tz_name=_tz_name[0] if _tz_name else "",
            clock_utc_offset_sec=_utc_offset_sec,
            clock_localtime=_time_str,
            clock_time_function=str(_t.time),
        ).info("clock_source_audit: app startup clock check")
    except Exception as _e:
        logger.warning(f"clock_source_audit skipped: {_e}")

    # OpenTelemetry APM (Proposal 3) - only configure span exporter / instrument
    # TraceIdMiddleware must be registered in create_app(), not in lifespan
    try:
        from app.database import ENGINES
        from app.telemetry import is_telemetry_enabled, setup_telemetry

        setup_telemetry(app=app, engines=ENGINES)
        if is_telemetry_enabled():
            logger.info("OpenTelemetry APM enabled (see /metrics for pool, X-Trace-Id for trace)")
    except Exception as e:
        logger.warning(f"OpenTelemetry init skipped: {e}")

    # Install SQL monitoring hooks
    try:
        from app.database import ENGINES
        from app.monitoring import (
            collect_pool_metrics,
            install_pool_events,
            install_sql_events,
        )

        install_sql_events(ENGINES)
        install_pool_events(ENGINES)
        collect_pool_metrics(ENGINES)
        logger.info(f"SQL + pool monitoring installed for engines: {list(ENGINES.keys())}")
    except Exception as e:
        logger.warning(f"SQL monitoring install skipped: {e}")

    # Start scheduler
    try:
        from app.tasks.scheduler import start_scheduler

        start_scheduler()
    except Exception as e:
        logger.warning(f"Scheduler start skipped: {e}")

    # 健康历史表 (SQLite/PostgreSQL) - 启动时建表 + 清理 7 天前数据 + 加载到内存
    try:
        from app.api.health import _ensure_history_table

        _ensure_history_table()
    except Exception as e:
        logger.warning(f"Health history table init skipped: {e}")

    # Bug-47: Hot config reload on startup
    try:
        from app.utils.hot_config import start_hot_reload

        start_hot_reload(interval_sec=float(os.environ.get("HOT_RELOAD_INTERVAL", "60")))
        logger.info("Hot config reloader started")
    except Exception as e:
        logger.warning(f"Hot config reloader skipped: {e}")

    # 生产环境 Redis 健康检查 -- Redis 不可用时 fail-fast
    if settings.ENV.lower() in ("production", "prod"):
        try:
            from app.utils.redis_util import check_health

            if not check_health():
                logger.error("REDIS_HEALTHCHECK_FAIL: Redis is not reachable in production!")
                # 不 raise, 让服务启动但记录到监控; Prometheus alert 会触发
        except Exception as e:
            logger.error(f"REDIS_HEALTHCHECK_ERROR: {e}")

    # Bug-50: ELK JSON log sink
    try:
        from app.utils.elk_formatter import install_elk_sink

        if install_elk_sink():
            logger.info("ELK JSON sink installed")
        else:
            logger.debug("ELK sink not configured")
    except Exception as e:
        logger.warning(f"ELK sink skipped: {e}")

    # Legacy customer-service DB initialization (migrated from client/backend/run_customer_service.py)
    try:
        from app.core.customer_service_db import init_db as _cs_init_db
        _cs_init_db()
        logger.info("Customer service DB initialized")
    except Exception as e:
        logger.warning(f"Customer service DB init skipped: {e}")

    # WebSocket 自动恢复系统 (出箱消息队列监控 + 僵尸连接清理 + 内存监控)
    # 2026-06-26 P1 完善: 集成 ConnectionManager 消息队列/任务跟踪/API 调用
    try:
        from app.ws.auto_recovery import initialize_auto_recovery
        from app.ws.manager import connection_manager as _ws_cm
        await initialize_auto_recovery(_ws_cm)
        logger.info("WebSocket 自动恢复系统已启动")
    except Exception as e:
        logger.warning(f"WebSocket auto_recovery 启动跳过: {e}")

    yield  # Application runs here

    # Shutdown
    logger.info("Shutting down ZHS Platform...")

    # Stop scheduler
    try:
        from app.tasks.scheduler import stop_scheduler

        stop_scheduler()
    except Exception as e:
        logger.warning(f"Scheduler stop skipped: {e}")

    # Stop hot config reloader
    try:
        from app.utils.hot_config import stop_hot_reload

        stop_hot_reload()
    except Exception as e:
        logger.debug("停止 hot config reloader 失败: %s", e)

    # 关闭 WebSocket 自动恢复系统 (停止监控任务 + 停止出箱消费者)
    try:
        from app.ws.auto_recovery import shutdown_auto_recovery

        await shutdown_auto_recovery()
    except Exception as e:
        logger.debug("关闭 WebSocket auto_recovery 失败: %s", e)

    logger.info("ZHS Platform shutdown complete")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.API_TITLE,
        version="1.0.0",
        description="ZHS Platform API - AI Agent Marketplace & Educational Platform",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS
    # 2026-06-24 联调: 修复开发环境 allow_origins=["*"] + allow_credentials=True 不安全组合
    # - 生产环境: 必须显式配置 CORS_ORIGINS, 禁止通配符 (已有校验)
    # - 开发环境: CORS_ORIGINS 为空时回退到本地开发端口列表, 而非通配符 "*"
    raw_origins = settings.CORS_ORIGINS.strip() if settings.CORS_ORIGINS else ""
    origins = [o.strip() for o in raw_origins.split(",") if o.strip()] if raw_origins else []
    if settings.ENV.lower() in ("production", "prod"):
        if not raw_origins:
            raise RuntimeError("CORS_ORIGINS is required in production")
        if "*" in origins:
            raise RuntimeError("CORS wildcard '*' is not allowed in production")
    elif not origins:
        # 开发环境回退: 本地前端端口 (8888 dev / 4173 preview) + 常用调试端口
        _dev_origins = [
            "http://localhost:8888",
            "http://127.0.0.1:8888",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
        origins = _dev_origins
        logger.info(f"CORS: dev origins fallback enabled ({len(origins)} origins)")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Prometheus metrics middleware
    with suppress(Exception):
        app.add_middleware(PrometheusMiddleware)

    # Trace ID middleware (X-Trace-Id response header, 与日志/trace 串联)
    # 必须在 create_app() 中注册, 不能在 lifespan 中注册 (中间件栈在启动前构建)
    try:
        from app.telemetry import TraceIdMiddleware

        app.add_middleware(TraceIdMiddleware)
    except Exception as e:
        logger.warning(f"TraceIdMiddleware registration failed: {e}")

    # API 版本协商中间件 (Accept header)
    try:
        from app.middleware.api_version import ApiVersionMiddleware

        app.add_middleware(ApiVersionMiddleware)
    except Exception as e:
        logger.debug(f"API version middleware skipped: {e}")

    # 限流中间件 (登录/上传/支付/流式 等敏感路径限速, 防止暴力破解)
    try:
        from app.core.rate_limit import install_rate_limit

        install_rate_limit(app, enabled=True)
    except Exception as e:
        logger.error(f"Failed to register rate limit middleware: {e}")

    # 审计日志中间件 (追踪关键写操作 + 敏感读)
    try:
        from app.core.audit_log import install_audit_log

        install_audit_log(app, enabled=True)
    except Exception as e:
        logger.error(f"Failed to register audit log middleware: {e}")

    # Gzip 响应压缩中间件 (减少带宽 60-80%)
    try:
        from app.core.gzip_middleware import install_gzip

        install_gzip(app, minimum_size=1024, level=6)
    except Exception as e:
        logger.error(f"Failed to register gzip middleware: {e}")

    # 响应规范化中间件 (补全 msg/message 字段, 统一 5 套响应格式)
    # 2026-06-25 修复#B: 后端 5 套响应格式并存 ({code:0,msg} / {code:0,message} /
    #   {code:200,msg} / {code:"0",msg} / {success,fileId}), 前端 normalizeApiResponse
    #   已兼容, 但后端补全字段可避免新代码踩坑. 只补不删不改 code, 零破坏.
    # 注册在 gzip 之后 (后注册先执行, 规范化先于压缩).
    try:
        from app.middleware.response_normalizer import install_response_normalizer

        install_response_normalizer(app)
    except Exception as e:
        logger.error(f"Failed to register response normalizer middleware: {e}")

    # XSS 防护中间件 (HTML-escape 请求参数/JSON body, 防止跨站脚本攻击)
    # 2026-06-24 联调: 文件已存在 app/middleware/xss.py 但未注册, 现补齐注册
    # 注册在最外层 (后注册 = 先执行), 确保所有下游中间件/路由看到的是清理后的输入
    try:
        from app.middleware.xss import XSSMiddleware

        app.add_middleware(XSSMiddleware)
        logger.info("XSS middleware registered")
    except Exception as e:
        logger.error(f"Failed to register XSS middleware: {e}")

    # 优雅停机 (SIGTERM/SIGINT)
    try:
        from app.core.graceful_shutdown import install_graceful_shutdown

        install_graceful_shutdown(timeout_sec=30)
    except Exception as e:
        logger.debug(f"graceful_shutdown 注册失败 (Windows dev 可忽略): {e}")

    # Import and mount routers
    # 主 API router 注册失败必须 raise (核心路由不可缺失, 静默吞掉会导致服务无路由可用)
    from app.api.v1.router import api_router

    app.include_router(api_router, prefix="/api/v1")
    logger.info("API v1 router registered")
    # 2026-06-21 联调: 注册前端兼容路由 (i18n-v2/wallet/dashboard/refunds/security)
    # 2026-06-24 修复: compat_routes.py 中路径已含 /api/v1 前缀, 此处不能再加 prefix,
    #   否则路径变为 /api/v1/api/v1/wallet/* 导致 404
    try:
        from app.api.v1.compat_routes import router as compat_router
        app.include_router(compat_router)
        logger.info("Compatibility routes registered")
    except Exception as e:
        logger.error(f"Failed to register compat routes: {e}")

    # Legacy /api/<domain>/ paths (migrated from client/backend).
    # These routers are mounted at the original prefixes with real
    # implementations. The LegacyPathRewriteASGI middleware was removed
    # because all legacy routes are now registered directly at their
    # original paths.
    try:
        from app.api.v1.agent.routes import router as _agent_router
        from app.api.v1.audit.routes import router as _audit_router
        from app.api.v1.auth.legacy_local import router as _auth_legacy_router
        from app.api.v1.customer_service.customer_service_routes import (
            router as _cs_router,
        )
        from app.api.v1.customer_service.ticket_routes import (
            router as _ticket_router,
        )
        from app.api.v1.docs.routes import router as _docs_router
        from app.api.v1.rbac.routes import router as _rbac_router
        from app.api.v1.upload.routes import router as _upload_router
        from app.api.v1.version.routes import router as _version_router

        app.include_router(_upload_router, prefix="/api/upload", tags=["Legacy Upload"])
        app.include_router(_version_router, prefix="/api/version", tags=["Legacy Version"])
        app.include_router(_rbac_router, prefix="/api/rbac", tags=["Legacy RBAC"])
        app.include_router(_audit_router, prefix="/api/audit", tags=["Legacy Audit"])
        app.include_router(_cs_router, prefix="/api/v1/customer_service", tags=["Legacy CS"])
        app.include_router(
            _ticket_router,
            prefix="/api/v1/customer_service/ticket",
            tags=["Legacy Tickets"],
        )
        app.include_router(_agent_router, tags=["Legacy Agent"])
        app.include_router(
            _auth_legacy_router,
            prefix="/api/auth",
            tags=["Legacy Local Auth"],
        )
        app.include_router(_docs_router, prefix="/api/docs", tags=["Legacy Docs"])
        logger.info("Legacy /api/<domain> routers mounted")
    except Exception as _e:
        logger.error(f"Failed to mount legacy routers: {_e}")

    # Mock 路由覆盖率报告 (运维用, 仅在 mock 启用时有意义)
    try:
        from app.api.mock_coverage import router as mock_coverage_router

        app.include_router(mock_coverage_router)
        logger.info("Mock coverage router registered (/api/mock/coverage)")
    except Exception as e:
        logger.error(f"Failed to register mock coverage router: {e}")

    # WebSocket routers (P0 fix: these were defined but never registered)
    try:
        from app.ws.router import ws_router

        app.include_router(ws_router)
        logger.info("WebSocket router registered")
    except Exception as e:
        logger.error(f"Failed to register WebSocket router: {e}")

    try:
        from app.api.ws.public_socket import router as public_socket_router

        app.include_router(public_socket_router)
        logger.info("Public socket router registered")
    except Exception as e:
        logger.error(f"Failed to register public socket router: {e}")

    # 健康检查端点 (K8s liveness/readiness probes, 兼容旧 /healthz)
    try:
        from app.api.health import router as health_router

        app.include_router(health_router)
        logger.info("Health router registered (/health, /health/live, /health/ready)")
    except Exception as e:
        logger.error(f"Failed to register health router: {e}")

    # Socket.IO 服务挂载 (2026-06-24 修复: 文件已存在但未挂载, 前端 useTaskWebSocket/AgentSwarmMonitor 无法连接)
    # socketio_app 是 ASGIApp, 需用 app.mount 挂载到 /socket.io 路径
    try:
        from app.api.socketio_chat import socketio_app as _sio_app, router as _sio_router
        app.include_router(_sio_router)
        app.mount("/socket.io", _sio_app)
        logger.info("Socket.IO service mounted at /socket.io")
    except Exception as e:
        logger.error(f"Failed to mount Socket.IO service: {e}")

    # API v2 实验性端点 (仅保留元数据, 其余 v2 空壳已清理)
    try:
        from app.api.v2 import router as v2_router

        app.include_router(v2_router)
        logger.info("API v2 router registered (experimental: /api/v2/info, /ping)")
    except Exception as e:
        logger.error(f"Failed to register v2 router: {e}")

    # admin 迁移管理 (P0 配套: Web 触发 ETL)
    try:
        from app.api.admin_migration import router as admin_migration_router
        app.include_router(admin_migration_router)
        logger.info("Admin migration router registered (/api/admin/migration/*)")
    except Exception as e:
        logger.error(f"Failed to register admin migration router: {e}")

    # alerting webhook (Grafana 告警接收/静默规则) - 路由自带 /api/v1/alerting 前缀
    try:
        from app.api.v1.alerting.webhook import router as alerting_router
        app.include_router(alerting_router)
        logger.info("Alerting webhook router registered (/api/v1/alerting/*)")
    except Exception as e:
        logger.error(f"Failed to register alerting router: {e}")

    # langchain_api (LLM-Full 兼容层) - 路由自带 /ihui-ai-api/llm-full 前缀
    try:
        from app.api.langchain_api import router as langchain_api_router
        app.include_router(langchain_api_router)
        logger.info("Langchain API router registered (/ihui-ai-api/llm-full/*)")
    except Exception as e:
        logger.error(f"Failed to register langchain_api router: {e}")

    # visittracking (访问埋点 API) - 迁移自 edu behavior-service, 路由自带 /visit-tracking 前缀
    # 2026-06-26 修复: 文件已存在但从未注册, 端点无法访问
    try:
        from app.api.visittracking import router as visittracking_router
        app.include_router(visittracking_router)
        logger.info("VisitTracking router registered (/visit-tracking/*)")
    except Exception as e:
        logger.error(f"Failed to register visittracking router: {e}")

    # outbound (外呼回调 API) - 迁移自 coze_zhs_py, 路由自带 /ihui-ai-api/outbound 前缀
    # 2026-06-26 修复: 文件已存在但从未注册, 端点无法访问
    try:
        from app.api.outbound import router as outbound_router
        app.include_router(outbound_router)
        logger.info("Outbound router registered (/ihui-ai-api/outbound/*)")
    except Exception as e:
        logger.error(f"Failed to register outbound router: {e}")

    # favicon (站点图标) - 迁移自 coze_zhs_py, 提供 /favicon.ico 路由
    # 2026-06-26 修复: 文件已存在但从未注册, /favicon.ico 无响应
    try:
        from app.api.favicon import router as favicon_router
        app.include_router(favicon_router)
        logger.info("Favicon router registered (/favicon.ico)")
    except Exception as e:
        logger.error(f"Failed to register favicon router: {e}")

    # agents/upload (AgentUploadController) - 路由自带 /api/agent 前缀, 不能挂到 /api/v1 下
    # 否则路径会变成 /api/v1/api/agent/upload 导致 404
    try:
        from app.api.v1.agents.upload import router as agent_upload_router
        app.include_router(agent_upload_router, tags=["Agent Upload Process"])
        logger.info("Agent upload router registered (/api/agent/*)")
    except Exception as e:
        logger.error(f"Failed to register agent upload router: {e}")

    # 2026-06-26 补齐: edu 微服务 3 个未迁移 Controller (Java→Python 迁移完整性核查)
    # - point-service ChannelController (/channel 6 端点, 表 t_channel)
    # - schedule-service WatchController (GET /watch, Redis 中转调度)
    # - search-service RecordController (GET /record/list, 表 t_record 热词)
    try:
        from app.api.v1.edu_legacy_supplement_v2 import router as edu_legacy_v2_router
        app.include_router(edu_legacy_v2_router)
        logger.info(f"Edu legacy v2 router registered ({len(edu_legacy_v2_router.routes)} routes)")
    except Exception as e:
        logger.error(f"Failed to register edu legacy v2 router: {e}")

    # 2026-06-26 补齐: ZHS_Server_java AliAIController (4 端点, /ali 前缀)
    # - GET /ali/audio/sys (系统音色, 免登)
    # - GET /ali/get/digital/{type} (我的定制形象)
    # - POST /ali/generate/timbre (生成音色 + TTS 合成)
    # - POST /ali/video/to/digital (视频拆分)
    try:
        from app.api.ali_ai_legacy import router as ali_ai_router
        app.include_router(ali_ai_router)
        logger.info(f"AliAI legacy router registered ({len(ali_ai_router.routes)} routes, /ali/*)")
    except Exception as e:
        logger.error(f"Failed to register ali ai legacy router: {e}")

    # 2026-06-26 补齐: ai-smart-society-java RuoYi 7 个未迁移 Controller (35 端点)
    # - /taskDeveloper (agent_task_developer)
    # - /zhsAgent (zhs_agent)
    # - /agentCategory (zhs_agent_category)
    # - /identity_proportion (zhs_identity_proportion)
    # - /token_flow (zhs_operate_token_flow, Python 已有 token_service 业务级替代, 此为 1:1 兼容)
    # - /userAgentAudio (zhs_user_agent_audio)
    # - /Withdrawaldetail (zhs_withdrawal_detail, 含 0.98 手续费 + 微信转账审核)
    try:
        from app.api.v1.ruoyi_legacy_supplement import router as ruoyi_legacy_router
        app.include_router(ruoyi_legacy_router)
        logger.info(f"RuoYi legacy router registered ({len(ruoyi_legacy_router.routes)} routes)")
    except Exception as e:
        logger.error(f"Failed to register ruoyi legacy router: {e}")

    # 2026-06-26 补齐: ZHS_Server_java 33 个部分迁移 Controller (152 端点)
    # - 核心业务: LoginController/WXPayNowController/ResourceController/ResourceNowController
    # - Agent 业务: ZhsAgentController/ZhsAgentBuyController/ZhsAgentExamineController
    # - 课程业务: ZhsCourseController/ZhsCourseVideoController/ZhsCoursePlatformLogController 等
    # - 其他 CRUD: AiUserFeedback/AppVersion/Distribution/Withdrawal 等
    try:
        from app.api.v1.zhs_server_java_legacy import router as zhs_java_legacy_router
        app.include_router(zhs_java_legacy_router)
        logger.info(f"ZHS Server Java legacy router registered ({len(zhs_java_legacy_router.routes)} routes)")
    except Exception as e:
        logger.error(f"Failed to register zhs server java legacy router: {e}")

    # 2026-06-26 补齐 (阶段2b): RuoYi 后台 CRUD 六件套批量迁移 (66 Controllers / 396 端点)
    # - 涵盖 ai-smart-society-java RuoYi 模块缺失 Controller (排除 ruoyi-system 已被 Python RBAC 替代)
    # - 每个 Controller 生成 list/export/{id}/POST/PUT/DELETE/{ids} 六件套
    # - 路径深度排序注册 (深路径优先, 避免子路径被父路径 {item_id} 拦截)
    try:
        from app.api.v1.ruoyi_legacy_crud_batch import router as ruoyi_crud_batch_router
        app.include_router(ruoyi_crud_batch_router)
        logger.info(f"RuoYi CRUD batch router registered ({len(ruoyi_crud_batch_router.routes)} routes)")
    except Exception as e:
        logger.error(f"Failed to register ruoyi crud batch router: {e}")

    # 2026-06-26 补迁移: edu 微服务 P0 批次1 核心端点 (40 端点)
    # - 支付回调 (2): 支付宝/微信回调验签
    # - 认证授权补全 (9): 登出/刷新Token/短信/权限/角色管理
    # - 会员账户体系 (15): 密码/手机/邮箱绑定 + 账户管理
    # - 课程相关基础 (14): 报名/收藏/推荐/评分/评论
    # 桩+日志模式: 端点可注册/鉴权/校验, service 待接入
    try:
        from app.api.v1.edu.edu_supplement_p0_batch1 import router as edu_supplement_p0_router
        app.include_router(edu_supplement_p0_router)
        logger.info(f"Edu P0 batch1 supplement router registered ({len(edu_supplement_p0_router.routes)} routes)")
    except Exception as e:
        logger.error(f"Failed to register edu P0 batch1 supplement router: {e}")

    # v2 auth 路由 (转发到 v1 真实逻辑, 必须在 mock catch-all 之前注册)
    try:
        from app.api.v2_authentication import router as v2_auth_router
        app.include_router(v2_auth_router)
        logger.info("V2 auth router registered (/api/v2/auth/*)")
    except Exception as e:
        logger.error(f"Failed to register v2 auth router: {e}")

    # Java backend mock routes (fallback when bsm.aizhs.top is unreachable)
    # ENV 控制:
    #   - development (default): 启用 mock, 用于本地联调
    #   - testing/staging: 由 MOCK_ROUTES=force|off 显式控制
    #   - production: 默认关闭 (除非 MOCK_ROUTES=force 显式开启, 用于灰度演练)
    import os as _os

    _env = _os.environ.get("ENV", "development").lower()
    _mock_force = _os.environ.get("MOCK_ROUTES", "").lower() == "force"
    _mock_off = _os.environ.get("MOCK_ROUTES", "").lower() == "off"
    if _mock_off:
        mock_on = False
    elif _mock_force:
        mock_on = True
    else:
        mock_on = _env not in ("production", "prod")
    # Phase D integration verification: skip mock to let real edu routers respond
    if _os.environ.get("EDU_INTEGRATION_TEST", "").lower() in ("1", "true", "yes"):
        mock_on = False
        logger.info("EDU_INTEGRATION_TEST=1, mock routes forcibly disabled")
    try:
        from app.api.mock import api_router, coze_router, from_fastapi_router, prod_router

        if mock_on:
            app.include_router(api_router)
            app.include_router(prod_router)
            app.include_router(coze_router)
            app.include_router(from_fastapi_router)
            logger.info(
                f"mock_routes=ON (ENV={_env}) Java mock routers registered (/api, /prod-api, /coze, catch-all)"
            )
        else:
            logger.info(
                f"mock_routes=OFF (ENV={_env}) Java mock routers skipped"
            )
        # 记录到 app.state 供 /api/mock/status 端点查询
        app.state.mock_enabled = mock_on
        app.state.mock_env = _env
    except Exception as e:
        logger.error(f"Failed to register Java mock routers: {e}")
        app.state.mock_enabled = False

    # Mock 状态端点 (运维查询, 上线前必查)
    @app.get("/api/mock/status", tags=["Mock"], include_in_schema=False)
    def mock_status():
        from app.api.mock import api_router as _a
        from app.api.mock import coze_router as _c
        from app.api.mock import prod_router as _p

        return {
            "enabled": getattr(app.state, "mock_enabled", False),
            "env": getattr(app.state, "mock_env", "unknown"),
            "routes": {
                "/api": len(_a.routes),
                "/prod-api": len(_p.routes),
                "/coze": len(_c.routes),
            },
        }

    # 全局异常处理器 (统一 {code, msg, data} 格式)
    from app.core.exceptions import register_exception_handlers

    register_exception_handlers(app)

    # Logstash 推送 sink (由 LOGSTASH_ENABLED=1 启用)
    if os.environ.get("LOGSTASH_ENABLED", "").lower() in ("1", "true", "yes"):
        try:
            from app.utils.logstash_sink import install_logstash_sink

            sink = install_logstash_sink()
            if sink:
                logger.info(f"Logstash sink installed: {sink.host}:{sink.port}")
        except Exception as e:
            logger.warning(f"Logstash sink install failed: {e}")

    # OpenAPI 按 tag 拆分端点 - 减小单文档大小, 方便前端按需加载
    @app.get("/openapi/tags", tags=["OpenAPI"], include_in_schema=False)
    def openapi_tags():
        """列出所有 OpenAPI tag 及其端点数."""
        from fastapi.openapi.utils import get_openapi

        schema = get_openapi(
            title=app.title,
            version=app.version,
            openapi_version=app.openapi_version,
            description=app.description,
            routes=app.routes,
        )
        # 统计每个 tag 的端点数
        tag_counts: dict[str, int] = {}
        for path_data in schema.get("paths", {}).values():
            for method_data in path_data.values():
                for tag in method_data.get("tags", []):
                    tag_counts[tag] = tag_counts.get(tag, 0) + 1
        return {
            "total_paths": len(schema.get("paths", {})),
            "total_tags": len(tag_counts),
            "tags": dict(sorted(tag_counts.items(), key=lambda x: -x[1])),
        }

    @app.get("/openapi/tag/{tag_name}", tags=["OpenAPI"], include_in_schema=False)
    def openapi_by_tag(tag_name: str):
        """获取指定 tag 的 OpenAPI 子文档."""
        from fastapi.openapi.utils import get_openapi
        from fastapi.responses import JSONResponse

        schema = get_openapi(
            title=app.title,
            version=app.version,
            openapi_version=app.openapi_version,
            description=app.description,
            routes=app.routes,
        )
        # 过滤 paths: 只保留包含指定 tag 的端点
        filtered_paths = {}
        for path, path_data in schema.get("paths", {}).items():
            for method, method_data in path_data.items():
                if tag_name in method_data.get("tags", []):
                    if path not in filtered_paths:
                        filtered_paths[path] = {}
                    filtered_paths[path][method] = method_data
        if not filtered_paths:
            return JSONResponse(
                status_code=404,
                content={"code": "404000", "msg": f"tag '{tag_name}' not found"},
            )
        # 输出过滤后的 schema
        new_schema = dict(schema)
        new_schema["paths"] = filtered_paths
        return new_schema

    # P1-1: 启动时自动迁移 Top 20 缺失索引 (CREATE INDEX IF NOT EXISTS 幂等)
    try:
        from scripts.add_missing_indexes import run_db_index_migration
        result = run_db_index_migration()
        logger.info(
            f"[db_index_migration] total={result['total']} "
            f"created={result['created']} exists={result['exists']} "
            f"skipped={result.get('skipped', 0)} errors={len(result['errors'])}"
        )
    except Exception as e:
        logger.debug(f"db_index_migration 启动钩子跳过 (非阻塞): {e}")

    # Prometheus /metrics endpoint
    @app.get("/metrics", tags=["Monitor"], include_in_schema=False)
    def metrics():
        return render_metrics()

    # Admin /admin  static page (avoid SPA catch-all)
    @app.get("/admin", include_in_schema=False)
    def admin_page():
        from fastapi.responses import FileResponse

        static_dir = os.path.join(os.path.dirname(__file__), "static")
        index = os.path.join(static_dir, "admin", "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
        return {"message": "Admin UI not found"}

    # Circuit breaker status
    @app.get("/resilience", include_in_schema=False)
    def resilience_status(_=Depends(admin_required)):
        from app.resilience import all_snapshots

        return all_snapshots()

    # Manual circuit breaker reset (fault tolerance)
    @app.post("/resilience/reset/{circuit_name}", include_in_schema=False)
    def reset_circuit(circuit_name: str, _=Depends(admin_required)):
        from app.resilience import _CIRCUITS

        cb = _CIRCUITS.get(circuit_name)
        if not cb:
            return JSONResponse(
                status_code=404,
                content={"error": "circuit not found", "name": circuit_name},
            )
        cb.reset()
        return {"reset": circuit_name, "state": cb.state}

    # Static files
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    if os.path.isdir(static_dir):
        # Bug-41: Static file with 1-hour cache + common HTML shortcuts
        app.mount(
            "/static",
            CachedStaticFiles(directory=static_dir, cache_max_age=3600),
            name="static",
        )

    # Local upload file service (MinIO fallback)
    local_uploads_dir = str(_PROJECT_ROOT / "local_uploads")
    os.makedirs(local_uploads_dir, exist_ok=True)
    app.mount(
        "/local_uploads",
        StaticFiles(directory=local_uploads_dir),
        name="local_uploads",
    )

    # Bug-41: Common HTML page shortcuts (avoid /static/oauth_app_management.html)
    if os.path.isdir(static_dir):
        from fastapi.responses import FileResponse

        _HTML_ALIASES = {
            "/oauth_app_management": "oauth_app_management.html",
            "/agent_management": "agent_management.html",
            "/config_page": "config.html",
            "/sms_login": "sms_login.html",
            "/crew": "crew.html",
        }
        for _alias, _filename in _HTML_ALIASES.items():
            _path = os.path.join(static_dir, _filename)
            if os.path.isfile(_path):
                _fpath = _path

                def _serve_html(request: Request, __fp: str = _fpath):
                    return FileResponse(__fp, headers={"Cache-Control": "no-store"})

                app.add_api_route(
                    _alias,
                    _serve_html,
                    methods=["GET"],
                    include_in_schema=False,
                )

    # 多租户路由中间件 (仅多租户模式启用, 裸 ASGI 不走 add_middleware)
    try:
        from app.middleware.tenant_routing import TenantRoutingMiddleware

        if settings.MULTI_TENANT_ENABLED:
            # 裸 ASGI middleware: 直接包装 app, 不用 add_middleware
            app.add_middleware(TenantRoutingMiddleware)
            logger.info("TenantRoutingMiddleware registered (multi-tenant mode)")
    except Exception as e:
        logger.debug(f"TenantRoutingMiddleware skipped: {e}")

    # Single-tenant mode: strip all table schemas (TenantBase + hard-coded schema)
    if not settings.MULTI_TENANT_ENABLED:
        try:
            import app.models as _models
            from app.database import Base

            stripped = 0
            for table in Base.metadata.tables.values():
                if table.schema:
                    table.schema = None
                    stripped += 1
            if stripped:
                logger.info(f"Single-tenant mode: stripped schema from {stripped} tables")
        except Exception as e:
            logger.warning(f"Schema strip failed: {e}")

    # Dev mode (SQLite) auto-create tables, avoid frontend testing without DB
    # 注意: 建表必须在路由注册之后执行 -- 部分 model 通过 router 模块导入时才注册到
    # Base.metadata, 提前建表会遗漏这些表。此处位于路由注册之后, 确保所有 model 已加载。
    if os.environ.get("AUTO_CREATE_SCHEMA", "0") == "1":
        try:
            import app.models as _models  # noqa: F401  trigger model imports for app variable
            from app.database import create_all_per_db

            # Bug-30-v2: Create tables per database, avoid cross-schema errors
            create_all_per_db()
            logger.info("AUTO_CREATE_SCHEMA: tables ensured (per-db routing)")

            # Seed default admin account (idempotent, failure doesn't affect startup)
            try:
                from app.database import engine1 as _engine1
                from scripts.ci.seed_admin import seed_admin

                rc = seed_admin(engine=_engine1)
                if rc >= 0:
                    logger.info(f"AUTO_CREATE_SCHEMA: admin seeded (rc={rc})")
            except Exception as e:
                logger.warning(f"AUTO_CREATE_SCHEMA seed_admin failed: {e}")

            # 2026-06-26: 为 7 个历史迁移模块补配 admin_menu 菜单项 (幂等)
            try:
                from app.database import engine1 as _engine1
                from scripts.ci.seed_admin_menus_v2 import seed_admin_menus_v2

                rc = seed_admin_menus_v2(engine=_engine1)
                if rc >= 0:
                    logger.info(f"AUTO_CREATE_SCHEMA: admin menus v2 seeded (+{rc} menus)")
            except Exception as e:
                logger.warning(f"AUTO_CREATE_SCHEMA seed_admin_menus_v2 failed: {e}")
        except Exception as e:
            logger.warning(f"AUTO_CREATE_SCHEMA failed: {e}")

    # Health check (K8s livenessProbe)
    @app.get("/healthz", tags=["Health"], summary="Health check (K8s livenessProbe)", include_in_schema=False)
    def healthz():
        """For Docker HEALTHCHECK / K8s livenessProbe / load balancer health checks."""
        try:
            from app.telemetry import is_telemetry_enabled

            telemetry_on = is_telemetry_enabled()
        except Exception:
            telemetry_on = False
        return {
            "status": "ok",
            "service": "zhs-platform",
            "version": "1.0.0",
            "telemetry": "enabled" if telemetry_on else "disabled",
        }

    # 深度健康检查 (K8s readinessProbe) - 检查 DB + Redis + 关键依赖
    @app.get("/ready", tags=["Health"], summary="Readiness check (K8s readinessProbe)", include_in_schema=False)
    def ready():
        """深度检查: DB / Redis / 关键模型.

        任意核心依赖失败 → 返回 503, K8s 不会把流量打过来.
        """
        checks: dict = {}
        overall_ok = True

        # 1) DB 连通性
        try:
            from sqlalchemy import text

            from app.database import engine1

            with engine1.connect() as conn:
                conn.execute(text("SELECT 1"))
            checks["database"] = {"status": "ok"}
        except Exception as e:
            checks["database"] = {"status": "fail", "error": str(e)[:200]}
            overall_ok = False

        # 2) Redis 连通性
        try:
            from app.utils.redis_util import check_health

            redis_ok = check_health()
            checks["redis"] = {"status": "ok" if redis_ok else "fail"}
            if not redis_ok:
                overall_ok = False
        except Exception as e:
            checks["redis"] = {"status": "fail", "error": str(e)[:200]}
            overall_ok = False

        # 3) Liveness 信号
        checks["service"] = {"status": "ok", "version": "1.0.0"}

        status_code = 200 if overall_ok else 503
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=status_code,
            content={"status": "ok" if overall_ok else "degraded", "checks": checks},
        )

    return app


app = create_app()
