# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import time
from collections.abc import Awaitable, Callable, Iterable
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
from app.middleware.audit import setup_audit_middleware
from app.middleware.input_sanitizer import (
    setup_input_sanitizer_middleware,
    setup_rate_limit_middleware,
)
from app.middleware.response_sanitizer import setup_response_sanitizer_middleware
from app.middleware.trace_context import setup_trace_context_middleware

# 2026-07-23 新增:AI Skills TOP 19 个 skill 路由(用户可选调用)
# P3 深度层 Wave 11:6 大对标能力(2026-07-22 立)
# 跨支柱编排中枢(2026-07-23 立,事件总线 + 联合决策 + 预算治理 + 统一遥测)
from app.routers import (
    a2a,
    agent_runtime,
    agent_wellknown,
    agents,
    ai_skills,
    artifacts,
    code_index_consent_api,
    connectors,
    cost_estimate,
    fim,
    health,
    hooks,
    llm,
    mcp,
    mcp_official,
    memory_graph,
    opencompass,
    orchestration,
    personas,
    pr_review,
    publish,
    rules,
    screenshot,
    self_media,
    spec,
    team_orchestration,
    tools,
    voice_stt,
    voice_tts,
    web_tools,
)

# D193 任务决策收件箱(2026-09-30 用户拍板,小切口):「我的待决策」聚合查询
from app.routers import decisions as decisions_router

# Harness 能力补齐:评估/评测框架(2026-08-11 立)
from app.routers import eval as eval_router

# D179 会话/新对话 Issue 绑定流(2026-09-30 用户拍板立项):MCP Issue 搜索端点
from app.routers import issue_search as issue_search_router

# Harness 能力补齐:Prompt 版本管理(2026-08-11 立)
from app.routers import prompts as prompts_router

# D176 任务回顾→移交新任务(2026-09-30 用户拍板立项):交接文档生成出口
from app.routers import recap as recap_router

# Harness 能力补齐:Token 用量统计(2026-08-11 立)
from app.routers import usage as usage_router

# Phase 2:可视化工作流编辑器(2026-08-09 立)
from app.routers import workflow as workflow_router

# AI 批改(AI 自动评分练习答案,2026-08-07 立)
from app.routers.ai_marking import router as ai_marking_router

# P3 深度层:AI 教育引擎(AI 助教)+ LangGraph 升级(PostgresSaver + interrupt HITL + streaming)
from app.routers.ai_tutor import router as ai_tutor_router

# 企业级补齐(2026-09-06 立):操作审计日志查询 + SSO/OIDC 集成路由
from app.routers.audit import router as audit_log_router
from app.routers.checkpoint_rewind import router as checkpoint_rewind_router
from app.routers.cloud_runs import router as cloud_runs_router
from app.routers.computer_use import router as computer_use_router
from app.routers.context_compaction import router as context_compaction_router

# 教育食堂采购小票 AI 三轮核对(抽取/交叉核对/仲裁,2026-09-19 立)
from app.routers.edu_canteen_receipt import router as edu_canteen_receipt_router
from app.routers.langgraph import router as langgraph_router
from app.routers.legacy import router as legacy_router

# L4 自进化 admin 端点(status/lessons/history/trigger,2026-07-25 立)
from app.routers.meta_learning import router as meta_learning_router

# 对标杀手锏四件套(2026-09-03 立,深度补齐 Claude Code / Codex / Qoder / WorkBuddy):
# Deep Research 多轮深度研究 / Checkpoint+Rewind / 云托管会话 / Computer Use 驾驶舱 / 上下文压缩感知
from app.routers.research import router as research_router
from app.routers.self_healing import router as self_healing_router
from app.routers.sso import router as sso_router
from app.routers.step_recorder import router as step_recorder_router

# Context Engineering 路由(对标 Qoder,多维 @ 提及 + 跨会话 RAG + 多源融合)
from app.services.context_engine import router as context_engine_router

# IM 桥接服务(2026-07-31 立,消费 Redis im:inbound 队列 → LLM 回复 → 调 apps/api im-gateway/send)
from app.services.im_bridge import im_bridge_service
from app.sio import sio
from app.sio.handlers import register_handlers
from app.telemetry import setup_telemetry, shutdown_telemetry

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


# G-896416(2026-09-29):收尾链的共享 deadline 预算与幂等闩。
# 范式来源:ZCode `bootstrap/src/zcode-protocol/runtime-cleanup.ts:10-48` ——
# 「共用绝对 deadline;某项失败/挂起不阻止其余资源被尝试,也不逐项续时」。
# 刻意不照抄它的 1200ms 总预算:我方多个调度器的 stop() 要等在跑任务收尾,
# 预算经 IHUI_SHUTDOWN_BUDGET_S 可调,缺省放宽到 30s。
_SHUTDOWN_LOCK_RELEASED = False
_SHUTDOWN_TOTAL_BUDGET_S = float(os.environ.get("IHUI_SHUTDOWN_BUDGET_S", "30"))
_SHUTDOWN_STEP_CAP_S = 10.0


def _acquire_shutdown_lock() -> bool:
    """幂等闩:重复进入 lifespan 收尾(测试 / 双 close)只允许执行一次。"""
    global _SHUTDOWN_LOCK_RELEASED
    if _SHUTDOWN_LOCK_RELEASED:
        return False
    _SHUTDOWN_LOCK_RELEASED = True
    return True


async def _run_shutdown_steps(
    steps: Iterable[tuple[str, Callable[[], Awaitable[Any]]]], deadline: float
) -> None:
    """按序执行收尾步骤,每步只拿「min(步级上限, 剩余预算)」。

    三条语义(缺一不成立):
    ① 单项挂起只消耗自己的时间片,不拖死整链;
    ② 预算耗尽后其余步骤**仍被逐个尝试**(wait_for(0))并逐名报名 ——
       「没跑」与「跑完」在日志里必须长得不一样,不得静默;
    ③ 单步异常与超时同档:报名后继续,不让一个坏步骤吞掉后面的资源释放。
    """
    bad: list[str] = []
    for name, factory in steps:
        remaining = deadline - time.monotonic()
        timeout = min(_SHUTDOWN_STEP_CAP_S, remaining) if remaining > 0 else 0.0
        try:
            await asyncio.wait_for(factory(), timeout=timeout)
        except TimeoutError:  # 2026-09-29:Python ≥3.11 asyncio.TimeoutError 即内置 TimeoutError(ruff UP041)
            tag = "timeout" if remaining > 0 else "skipped_expired_budget"
            bad.append(f"{name}={tag}")
            logger.warning("[shutdown] %s(%s): 未在预算内完成,继续后续步骤", name, tag)
        except Exception as exc:  # noqa: BLE001
            bad.append(f"{name}=error")
            logger.warning("[shutdown] %s 失败(忽略): %s", name, exc)
    if bad:
        logger.warning("[shutdown] 非正常完成 %d 项: %s", len(bad), ", ".join(bad))


def seed_provider_capability_snapshot() -> dict[str, Any]:
    """G-649 开机播种:注册账号上游源 + 首发布一轮 + 把 fail-closed 投影喊出来。

    为什么必须在启动时装载(而不是等第一次调用):board 造好时 ``snapshot is None``,
    生产面既零生产者也零消费者 ⇒ 消费口
    ``provider_caps.get_published_capability_snapshot()`` 永远拿到 None,而
    "未初始化"在下游被读成"照旧当有权限";账号上游源此前更是只有测试注册过。

    三条约束:① 全程只读 env(不查 DB,§5 测试隔离铁律);② 栅栏一字不绕,
    播种轮被弃即如实报"仍未初始化";③ 任何异常只 warning 不阻塞启动(与其
    余开机步骤同档),但**必须报名**,静默失败的播种比不播种更坏。
    """
    from app.core import provider_capability_snapshot, provider_caps

    try:
        source_name = provider_capability_snapshot.register_account_source()
        outcome = provider_capability_snapshot.seed_uninitialized()
        snapshot = provider_caps.get_published_capability_snapshot()
        if snapshot is None:
            logger.warning(
                "[provider_caps_snapshot] 首发布未落地(status=%s)⇒ 快照仍是未初始化,"
                "entitlement 投影本轮不可消费",
                outcome.get("status"),
            )
            return {"seeded": False, "outcome": outcome, "account_source": source_name}
        not_entitled = provider_caps.not_entitled_provider_codes()
        board = provider_capability_snapshot.get_snapshot_board()
        logger.info(
            "[provider_caps_snapshot] 快照已播种:account_source=%s generation=%d"
            " provider=%d entitled:false 投影=%s degraded_stats=%s",
            source_name,
            board.generation,
            len(snapshot.get("provider_caps") or {}),
            ",".join(not_entitled) if not_entitled else "无",
            provider_capability_snapshot.degraded_stats(),
        )
        return {
            "seeded": True,
            "outcome": outcome,
            "account_source": source_name,
            "not_entitled": not_entitled,
        }
    except Exception as e:  # noqa: BLE001 - 播种失败不得阻塞启动,但必须点名
        logger.warning("[provider_caps_snapshot] 开机播种异常(忽略,快照未初始化): %s", e)
        return {"seeded": False, "error": str(e)}


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

    # V3 #57 能力矩阵开机自检:实读 env 输出全量能力台账(默认关能力一目了然)
    from app.core.capability_matrix import log_capability_matrix

    log_capability_matrix()

    # G-649(2026-10-01 立):供应商能力/entitlement 快照开机播种 —— 账号上游源的
    # 生产面唯一注册点 + 首发布一轮,让"snapshot 恒为 None"不再是合法稳态。
    # 刻意排在 DB 相关步骤之前:整条链只读 env,库没起来也必须能播种。
    seed_provider_capability_snapshot()

    # 媒体任务统一落库建表(2026-09-09 立;此前 ensure_table 从未被调用,
    # media_tasks 表不存在导致对话内媒体工具落库静默失败。失败仅告警不阻塞启动)
    try:
        from app.services.media_tasks import ensure_table as _ensure_media_tasks_table

        await _ensure_media_tasks_table()
        logger.info("[media_tasks] media_tasks 表确认/创建完成")
    except Exception as e:
        logger.warning("[media_tasks] 建表异常(忽略,落库降级为不持久化): %s", e)

    # 代码索引出域同意表启动自愈(2026-10-03 数据出域合规整改)。
    # 同意表在 .data/code_index_consent.json(本进程内),容器重建即丢 ⇒ 已 opt-out
    # 的用户被静默重置成"未表态",在 IHUI_CODE_INDEX_EGRESS=1 的部署上会**恢复代码
    # 出域**。这里直读 user_preferences 把它们补回来(不放进下面的 scheduler:
    # 闸门状态不是周期任务,是启动期一次性重建;且读库失败时保留现状 = 偏拒绝)。
    # fail-open 于"服务能起来",fail-closed 于"闸门状态":失败只记 error。
    try:
        from app.services.code_index_consent import preload_opt_outs_from_db

        await preload_opt_outs_from_db()
    except Exception as e:
        logger.warning("[code_index_consent] 同意表启动自愈异常(忽略,不阻断启动): %s", e)

    # 启动自媒体定时任务调度器(由 SELF_MEDIA_CRON_ENABLED 环境变量控制开关,
    # 默认 false,显式开启后才挂载 asyncio task)
    from app.services.self_media_scheduler import self_media_scheduler
    self_media_scheduler.start()

    # 媒体产物/任务生命周期维护(2026-09-09 第八轮 P0 修复:tmp/charts TTL 清扫
    # + 僵尸任务超时强失败),每小时一轮,全部 fail-open
    from app.services.media_maintenance import media_maintenance
    media_maintenance.start()

    # 启动资讯板块每日自动刷新调度器(由 NEWS_CRON_ENABLED 环境变量控制开关,
    # 默认 false,显式开启后才挂载 asyncio task + 消耗 LLM tokens)
    from app.services.news_scheduler import news_scheduler
    news_scheduler.start()

    # 签到助手服务端化(2026-10-03 立):数据层幂等建表 + 每日 08:05 签到调度。
    # 建表 fail-open(失败只告警);调度器由 CHECKIN_CRON_ENABLED 控制开关(默认 false)。
    try:
        from app.services.checkin_store import ensure_tables as _ensure_checkin_tables

        await _ensure_checkin_tables()
        logger.info("[checkin] checkin_* 表确认/创建完成")
    except Exception as e:
        logger.warning("[checkin] 建表异常(忽略,签到功能不可用): %s", e)
    from app.services.checkin_scheduler import checkin_scheduler
    try:
        await checkin_scheduler.start()
    except Exception as e:
        logger.warning("[checkin_scheduler] 启动失败(忽略): %s", e)

    # 生产 ⇄ 开发 数据库全表自动同步调度器(2026-09-22 立)
    # 用户要求:所有表都要同步,且自动化跑在自己程序里(不再依赖外部调度器)。
    # 由 DB_SYNC_ENABLED 控制开关(默认 false);生产机缺 db-sync.local.json 时静默待机。
    from app.services.db_sync_scheduler import db_sync_scheduler
    db_sync_scheduler.start()

    # Cookie 自动保活守护(2026-08-01 建;2026-09-29 接线:此前只有懒启动 ——
    # 没人调 /publish/cookie-refresh 端点就永远不跑,"自动保活"等于没开)。
    # 随 lifespan 挂载,由 COOKIE_REFRESH_ENABLED 控制(默认 false,显式开启才跑),
    # 间隔 COOKIE_REFRESH_INTERVAL_HOURS 小时(默认 6)。未开启时本调用是 no-op。
    from app.services.publish.cookie_refresh_daemon import cookie_daemon
    cookie_daemon.ensure_started()

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

    # V3 #77(2026-09-27 立):goal 自评估的**跨轮账本**切到 checkpoint 持久档。
    # 缺省档是 services/goal_completion_gate.py 里的一个进程内 dict,于是 §8 第 4 步
    # ("连续 N 轮 no 无进展 → blocked")在两种真实形态下从未成立:① 调用方每轮重启
    # ⇒ 连击永远从 1 起;② 多 worker ⇒ 每个进程各记一份。这里就是那个"装车"动作 ——
    # 账本机制在 goal_round_state.py,判定机制在 completion_verification.py,
    # 没有本行的装载,两者都还是"造好没装车"(本仓最高频失效型)。
    # 持久层复用 agent_checkpoint 的三层存储(不新造第二套状态存储);未配
    # DATABASE_URL/REDIS_URL 时如实传 durable=False —— 响应里的 ledger_durable
    # 因此是量出来的,不是名字推出来的。装载失败只降级不阻塞启动。
    try:
        import os as _os

        from app.core.tunables import DEFAULT_CHECKPOINT_TTL
        from app.services.agent_checkpoint import get_agent_checkpoint_manager
        from app.services.goal_round_state import configure_durable_store

        _ledger_durable = bool(settings.database_url) or bool(_os.environ.get("REDIS_URL"))
        configure_durable_store(
            get_agent_checkpoint_manager(),
            ttl_note=DEFAULT_CHECKPOINT_TTL,
            durable=_ledger_durable,
        )
        if not _ledger_durable:
            logger.warning(
                "goal 评估账本已挂 checkpoint 档但底层未配持久层"
                "(DATABASE_URL/REDIS_URL 均空)⇒ 连击计数仍活不过重启"
            )
    except Exception as e:  # noqa: BLE001 - 装载失败不得阻塞启动,但要喊出来
        logger.warning("goal 评估账本持久档装载失败,退回进程内档: %s", e)

    # 配置 FallbackRouter 故障转移
    from app.core.llm_gateway import fallback_router
    # StepFun 主路由故障转移(2026-07-24 立,2026-09-05 修订):
    # 原 stepfun -> agnes/gpt-4o 兜底已移除——agnes 聚合端点对本部署 key 无 gpt-4o 通道
    # ("No available channel for model gpt-4o under group default",实测 502),属死配置。
    # 改为 stepfun 双模型互备(同 provider,均实测稳定),避免无效升级失败。
    fallback_router.configure(
        "stepfun/step-3.7-flash",
        {
            "fallbacks": ["stepfun/step-router-v1"],
            "triggerOnError": ["timeout", "overloaded", "rate_limited"],
        },
    )
    fallback_router.configure(
        "stepfun/step-router-v1",
        {
            "fallbacks": ["stepfun/step-3.7-flash"],
            "triggerOnError": ["timeout", "overloaded", "rate_limited"],
        },
    )
    # gpt-4o(openai 官方端点)兜底(2026-09-04 立):auto-route 已显式排除 gpt-4o 作为
    # premium 候选(本部署 openai key 无余额 + agnes 无 gpt-4o 通道);但若调用方显式
    # 指定 gpt-4o,失败(LLM_ERROR/timeout 等)时切 stepfun/step-3.7-flash 保证不整体失败。
    fallback_router.configure(
        "gpt-4o",
        {
            "fallbacks": ["stepfun/step-3.7-flash"],
            "triggerOnError": ["timeout", "overloaded", "rate_limited", "llm_error"],
        },
    )
    # 默认链故障转移(D208 2026-10-01):默认链首选 gemini/gemini-3.8-flash 与同族兜底
    # @cf/zai-org/glm-4.7-flash 互备(两档均为 D150 当轮实测健康档)。原默认链
    # step-router-v1 经 auto-route 落 llm7 上游 500,对普通用户断裂,已退役为非首选。
    fallback_router.configure(
        "gemini/gemini-3.8-flash",
        {
            "fallbacks": ["@cf/zai-org/glm-4.7-flash"],
            "triggerOnError": ["timeout", "overloaded", "rate_limited", "llm_error"],
        },
    )
    fallback_router.configure(
        "@cf/zai-org/glm-4.7-flash",
        {
            "fallbacks": ["gemini/gemini-3.8-flash"],
            "triggerOnError": ["timeout", "overloaded", "rate_limited", "llm_error"],
        },
    )
    logger.info(
        "[fallback_router] configured: stepfun 双模型互备 + gpt-4o -> stepfun/step-3.7-flash"
        " + 默认链 gemini-3.8-flash <-> @cf/glm-4.7-flash 互备(D208)"
    )

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

    # 外部 MCP Server 接线(2026-08-30 立,让外部 MCP 生态真正可用)
    # 从环境变量 MCP_SERVERS_JSON(兼容既有 settings.mcp_client_configs / MCP_CLIENT_CONFIGS)
    # 读取外部 MCP Server 配置数组并注册连接。解析/连接失败不阻塞启动(降级为运行时管理端点注册)。
    try:
        from app.services.mcp_client import (
            TRANSPORT_STDIO,
            MCPClientConfig,
            get_mcp_client_manager,
        )

        _mcp_manager = get_mcp_client_manager()
        _mcp_cfg_raw = (
            (os.getenv("MCP_SERVERS_JSON") or getattr(settings, "mcp_client_configs", "") or "")
            .strip()
        )
        if _mcp_cfg_raw:
            import json as _json

            try:
                _mcp_servers = _json.loads(_mcp_cfg_raw)
                if isinstance(_mcp_servers, list):
                    for _s in _mcp_servers:
                        _name = (_s.get("name") or "").strip()
                        if not _name or _mcp_manager.get_client(_name) is not None:
                            continue
                        try:
                            _cfg = MCPClientConfig(
                                name=_name,
                                transport=_s.get("transport", TRANSPORT_STDIO),
                                command=_s.get("command", ""),
                                args=list(_s.get("args", []) or []),
                                env=dict(_s.get("env", {}) or {}),
                                url=_s.get("url", ""),
                                timeout=float(_s.get("timeout", 30.0)),
                                reconnect=bool(_s.get("reconnect", True)),
                                max_reconnect_attempts=int(_s.get("max_reconnect_attempts", 3)),
                            )
                            _mcp_manager.register(_cfg)
                            logger.info(
                                "[mcp_client] 注册外部 MCP Server: %s[%s]", _name, _cfg.transport
                            )
                        except Exception as _e:
                            logger.warning("[mcp_client] 注册 %s 失败(忽略): %s", _name, _e)
                    await _mcp_manager.connect_all()
                    logger.info("[mcp_client] 外部 MCP Server 连接完成: %d 个", len(_mcp_servers))
                else:
                    logger.warning("[mcp_client] MCP_SERVERS_JSON 不是 JSON 数组,忽略")
            except Exception as _e:
                logger.warning("[mcp_client] 解析 MCP_SERVERS_JSON 失败(忽略): %s", _e)
        else:
            logger.info("[mcp_client] 未配置外部 MCP Server(MCP_SERVERS_JSON 为空),跳过")
    except Exception as e:
        logger.warning("[mcp_client] 启动初始化失败(忽略): %s", e)

    # stdio MCP Server 工具接入(2026-09-01 立,P1-4):官方 MCP Python SDK(stdio 子进程
    # 传输)启动本机 MCP server,把 list_tools 暴露的工具注册进内部工具表,即"本机
    # stdio MCP server 作为内部工具"。配置来源 settings.mcp_stdio_servers(JSON 数组,
    # 默认空);解析/连接失败不阻塞启动(降级为后续显式 add_stdio_server_tool 注册)。
    try:
        from app.services.mcp_stdio_bridge import add_stdio_server_tool

        _stdio_cfg_raw = (getattr(settings, "mcp_stdio_servers", "") or "").strip()
        if _stdio_cfg_raw:
            import json as _stdio_json

            _stdio_servers = _stdio_json.loads(_stdio_cfg_raw)
            if isinstance(_stdio_servers, list):
                for _s in _stdio_servers:
                    _s_name = (_s.get("name") or "").strip()
                    if not _s_name:
                        continue
                    try:
                        await add_stdio_server_tool(
                            name=_s_name,
                            command=str(_s.get("command", "")),
                            args=list(_s.get("args", []) or []),
                            env=dict(_s.get("env", {}) or {}),
                            description=str(_s.get("description", "") or ""),
                        )
                        logger.info("[mcp_stdio] 启动注册 stdio server: %s", _s_name)
                    except Exception as _e:
                        logger.warning(
                            "[mcp_stdio] 注册 %s 失败(忽略,不影响启动): %s", _s_name, _e
                        )
            else:
                logger.warning("[mcp_stdio] MCP_STDIO_SERVERS 不是 JSON 数组,忽略")
        else:
            logger.info("[mcp_stdio] 未配置 stdio MCP server(MCP_STDIO_SERVERS 为空),跳过")
    except Exception as e:
        logger.warning("[mcp_stdio] 启动初始化失败(忽略): %s", e)

    # MCP 商店持久化恢复(2026-09-02 立,P2-1):重启后自动重新热挂载
    # data/mcp_store.json 中 enabled=true 的记录,保证"安装状态持久化、重启不丢"。
    # 与 MCP_STDIO_SERVERS 配置双轨:显式配置优先,商店记录兜底(同名 server 幂等跳过)。
    try:
        from app.services import mcp_store
        from app.services.mcp_stdio_bridge import add_stdio_server_tool as _store_add

        for _rec in mcp_store.list_installed():
            if not _rec.get("enabled"):
                continue
            _rname = str(_rec.get("name") or "").strip()
            if not _rname:
                continue
            try:
                await _store_add(
                    name=_rname,
                    command=str(_rec.get("command") or ""),
                    args=list(_rec.get("args") or []),
                    env=dict(_rec.get("env") or {}),
                )
                logger.info("[mcp_store] 启动恢复已安装 server: %s", _rname)
            except Exception as _e:
                logger.warning(
                    "[mcp_store] 启动恢复 %s 失败(降级为停用标记): %s", _rname, _e
                )
                mcp_store.set_enabled(_rname, False)
    except Exception as e:
        logger.warning("[mcp_store] 启动恢复初始化失败(忽略): %s", e)

    # AI 全量操控桥接(2026-09-20 立):拉取 apps/api OpenAPI 转为 MCP 工具 + 注册前端 UI 动作工具
    try:
        from app.services.api_tools_bridge import setup_api_tools_bridge

        _n_api = await setup_api_tools_bridge()
        logger.info("[api_bridge] 启动注册 API 工具: %d 个", _n_api)
    except Exception as e:
        logger.warning("[api_bridge] 启动注册失败(忽略): %s", e)
    try:
        from app.services.ui_action_bridge import (
            register_app_ui_tools,
            register_ui_action_tools,
        )

        _n_ui = register_ui_action_tools()
        logger.info("[ui_bridge] 启动注册 UI 桥接工具: %d 个", _n_ui)
        _n_app = register_app_ui_tools()
        logger.info("[ui_bridge] 启动注册 RN/小程序 UI 桥接工具: %d 个", _n_app)
    except Exception as e:
        logger.warning("[ui_bridge] 启动注册失败(忽略): %s", e)
    # 页面语义快照句柄族(2026-09-25 立):同一个 agent-control 通道,执行体在浏览器扩展里。
    # 单独一个 try:这一族注册失败不能把上面两族已注册的应用内 UI 工具一起带下去。
    try:
        from app.services.page_control_bridge import register_page_control_tools

        _n_page = register_page_control_tools()
        logger.info("[page_control] 启动注册页面句柄族工具: %d 个", _n_page)
    except Exception as e:
        logger.warning("[page_control] 启动注册失败(忽略): %s", e)

    # 截图服务(Playwright)按需启动,不在 lifespan 启动时初始化(避免 Chromium 占用)
    # 首次截图请求时懒加载,退出时 shutdown() 清理

    # 视频生成后台 worker(消费 video_generation_tasks 出片)。无厂商凭据时静默等待不报错。
    try:
        from app.services.video_generation import start_video_worker
        start_video_worker()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[video] worker 启动失败(忽略): %s", exc)

    # 对话内媒体任务后台收尾轮询(2026-09-09 立,MEDIA_TASK_POLLER_ENABLED=1 时启用)
    # 周期扫描 media_tasks 在途任务,终态自动回写;与官方 webhook 回调幂等互补。
    try:
        from app.services.media_tasks import start_media_task_poller
        start_media_task_poller()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[media_tasks] 收尾轮询启动失败(忽略): %s", exc)

    yield
    # P0 修复(2026-08-02):移除 yield 后的 shutdown_telemetry() 重复调用,
    # 保留末尾(所有 cleanup 之后)的 shutdown_telemetry() 作为最后清理,避免重复 shutdown。
    # G-896416(2026-09-29):收尾链改为"共享绝对 deadline + 幂等闩"(范式照 ZCode
    # runtime-cleanup.ts:10-48)。三条语义:① 单项挂起只消耗自己的时间片;② 预算耗尽后
    # 其余步骤仍被逐个尝试并逐名报名;③ 重复进入只执行一次。步级顺序与旧实现逐条等值;
    # 唯一行为差异:旧实现里"裸 import 失败会在此处中断整链、吞掉后面全部资源释放",
    # 现在改为该步报名失败后继续 —— 这是修复,不是行为回退。

    if not _acquire_shutdown_lock():
        logger.warning("[shutdown] 收尾已执行过(幂等闩命中),本次跳过")
        return

    deadline = time.monotonic() + _SHUTDOWN_TOTAL_BUDGET_S

    async def _s_model_availability() -> None:
        from app.services.model_availability import model_availability

        await model_availability.shutdown()

    async def _s_model_sync() -> None:
        from app.services.model_sync import model_sync_service

        await model_sync_service.shutdown()

    async def _s_dream_scheduler() -> None:
        from app.services.dream_scheduler import dream_scheduler

        await dream_scheduler.stop()

    async def _s_skill_evolution() -> None:
        from app.services.skill_evolution_scheduler import skill_evolution_scheduler

        await skill_evolution_scheduler.stop()

    async def _s_meta_learner() -> None:
        from app.services.meta_learner_scheduler import meta_learner_scheduler

        await meta_learner_scheduler.stop()

    async def _s_ab_test() -> None:
        from app.services.ab_test_scheduler import ab_test_scheduler

        await ab_test_scheduler.stop()

    async def _s_media_maintenance() -> None:
        from app.services.media_maintenance import media_maintenance

        await media_maintenance.stop()

    async def _s_news_scheduler() -> None:
        from app.services.news_scheduler import news_scheduler

        await news_scheduler.stop()

    async def _s_db_sync_scheduler() -> None:
        from app.services.db_sync_scheduler import db_sync_scheduler

        await db_sync_scheduler.stop()

    async def _s_checkin_scheduler() -> None:
        from app.services.checkin_scheduler import checkin_scheduler

        await checkin_scheduler.stop()

    async def _s_video_worker() -> None:
        from app.services.video_generation import stop_video_worker

        await stop_video_worker()

    async def _s_task_scheduler() -> None:
        from app.services.scheduler_service import task_scheduler

        await task_scheduler.shutdown()

    async def _s_screenshot() -> None:
        from app.services.screenshot_service import shutdown as screenshot_shutdown

        await screenshot_shutdown()

    async def _s_browser_hub() -> None:
        from app.services.browser_hub import hub

        await hub.stop()

    async def _s_computer_use() -> None:
        from app.routers.computer_use import close_all_sessions

        await close_all_sessions()

    async def _s_lsp() -> None:
        from app.api.v1.lsp import LspClient

        await LspClient.shutdown_all()

    async def _s_llm_http() -> None:
        from app.core.llm_gateway import close_http_client

        await close_http_client()

    async def _s_api_client() -> None:
        from app.services.api_client import close_api_client

        await close_api_client()

    async def _s_mcp_client() -> None:
        from app.services.mcp_client import get_mcp_client_manager

        await get_mcp_client_manager().disconnect_all()

    async def _s_mcp_stdio() -> None:
        from app.services.mcp_stdio_bridge import shutdown_all

        await shutdown_all()

    async def _s_shared_pool() -> None:
        from app.core.db_pool import close_shared_pool

        await close_shared_pool()

    async def _s_knowledge_graph() -> None:
        from app.services.knowledge_graph import graph_store

        if hasattr(graph_store, "close"):
            await graph_store.close()

    async def _s_langgraph_checkpoint() -> None:
        from app.services.langgraph_checkpoint import get_langgraph_checkpoint_manager

        await get_langgraph_checkpoint_manager().close()

    async def _s_agent_checkpoint() -> None:
        from app.services.agent_checkpoint import get_agent_checkpoint_manager

        await get_agent_checkpoint_manager().close()

    async def _s_legacy_db_pool() -> None:
        from app.core.db import close_db_pool

        await close_db_pool()

    async def _s_socketio() -> None:
        await sio.disconnect()

    steps = [
        ("model_availability", _s_model_availability),
        ("model_sync", _s_model_sync),
        # 关闭 IM 桥接服务(取消消费任务 + 关闭 Redis 连接,2026-07-31 立)
        ("im_bridge_service", lambda: im_bridge_service.shutdown()),
        ("dream_scheduler", _s_dream_scheduler),
        ("skill_evolution_scheduler", _s_skill_evolution),
        ("meta_learner_scheduler", _s_meta_learner),
        # L5 关闭 A/B 测试调度器(等待进行中的显著性检验任务完成)
        ("ab_test_scheduler", _s_ab_test),
        ("publish_scheduler", lambda: publish_scheduler.stop()),
        ("self_media_scheduler", lambda: self_media_scheduler.stop()),
        ("media_maintenance", _s_media_maintenance),
        ("news_scheduler", _s_news_scheduler),
        ("db_sync_scheduler", _s_db_sync_scheduler),
        ("checkin_scheduler", _s_checkin_scheduler),
        ("video_worker", _s_video_worker),
        ("task_scheduler", _s_task_scheduler),
        ("screenshot_service", _s_screenshot),
        ("browser_hub", _s_browser_hub),
        ("computer_use_sessions", _s_computer_use),
        # P1 修复:关闭所有 LSP 子进程(否则 typescript-language-server 子进程泄漏)
        ("lsp_clients", _s_lsp),
        ("llm_gateway_http", _s_llm_http),
        ("api_client_http", _s_api_client),
        ("mcp_client", _s_mcp_client),
        ("mcp_stdio_bridge", _s_mcp_stdio),
        # 修复(2026-07-28):统一关闭共享 asyncpg 连接池(原 14 个独立 pool 已复用 get_shared_pool)
        ("shared_db_pool", _s_shared_pool),
        ("knowledge_graph", _s_knowledge_graph),
        ("langgraph_checkpoint", _s_langgraph_checkpoint),
        ("agent_checkpoint", _s_agent_checkpoint),
        ("legacy_db_pool", _s_legacy_db_pool),
        ("socket_io", _s_socketio),
    ]
    await _run_shutdown_steps(steps, deadline)

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
        # D147(2026-09-28):`traceparent` 必须在允许清单里。FastAPI 的 CORSMiddleware
        # 与 @fastify/cors 不同 —— 后者在未设 allowedHeaders 时会回显
        # Access-Control-Request-Headers,而这里给了**显式清单**,预检就会拒掉
        # traceparent(400 Disallowed CORS headers),于是浏览器直连 ai-service 的那条道
        # (packages/api-client/src/client.ts 的 fetchAiServiceJson)在**第一跳**就被剥掉
        # 端生成的 id,四段链断成两截且不报错(静默失效)。
        # X-Trace-Id 同批加入:回带用的响应头(见 expose_headers 与 TraceContextMiddleware)。
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-Internal-Secret",
            "traceparent",
            "X-Trace-Id",
        ],
        # 跨域响应默认只暴露 CORS-safelisted 头;不 expose 的话端上
        # readTraceIdFromResponse() 永远读不到编号 —— 声明了回带却拿不到。
        expose_headers=["X-Trace-Id", "traceparent"],
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
    # P3 #43 成本协商(2026-09-16 立):chat 流前成本预检
    app.include_router(cost_estimate.router, prefix="/api", tags=["llm"])
    # P3 #41 记忆图谱(2026-09-16 立):子图查询
    app.include_router(memory_graph.router, prefix="/api", tags=["memory"])
    # FIM 代码补全(Monaco/CLI ghost-text 后端,2026-09-07 立,对标 Cursor Tab)
    app.include_router(fim.router, prefix="/api", tags=["llm-fim"])
    app.include_router(tools.router, prefix="/api", tags=["tools"])
    app.include_router(web_tools.router, prefix="/api", tags=["web-tools"])
    app.include_router(mcp.router, prefix="/api", tags=["mcp"])
    app.include_router(mcp_official.router, prefix="/api", tags=["mcp-official"])
    app.include_router(connectors.router, prefix="/api", tags=["connectors"])
    app.include_router(agents.router, prefix="/api", tags=["agents"])
    app.include_router(a2a.router, prefix="/api", tags=["a2a"])
    # D176(2026-09-30 用户拍板立项):交接文档生成出口
    app.include_router(recap_router.router, prefix="/api", tags=["recap"])
    # D193(2026-09-30 用户拍板,小切口):「我的待决策」聚合查询(GET /api/agent/decisions/pending)
    app.include_router(decisions_router.router, prefix="/api", tags=["decisions"])
    # D179(2026-09-30 用户拍板立项):MCP Issue 搜索(POST /api/agent/issues/search)
    app.include_router(issue_search_router.router, prefix="/api", tags=["issue-search"])
    # O11 A2A 标准化(2026-09-20 立):A2A 发现文档,规范规定为根路径,不带 /api 前缀
    app.include_router(agent_wellknown.router, tags=["a2a"])
    app.include_router(personas.router, prefix="/api", tags=["personas"])
    app.include_router(agent_runtime.router, prefix="/api", tags=["agent-runtime"])
    app.include_router(voice_stt.router, prefix="/api", tags=["voice"])
    app.include_router(voice_tts.router, prefix="/api", tags=["voice"])
    # 视频生成(可灵/即梦/通义万相/混元,2026-09-08 补建)
    from app.routers import video as video_router
    app.include_router(video_router.router, prefix="/api", tags=["video"])
    # 图片编辑(TokenGo /v1/images/edits multipart,2026-09-08 补建)
    from app.routers import image_edit as image_edit_router
    app.include_router(image_edit_router.router, prefix="/api", tags=["image"])
    # 媒体任务统一管理(对话内媒体工具落库的 media_tasks:列表/详情/取消,2026-09-09 立)
    from app.routers import media_tasks as media_tasks_router
    app.include_router(media_tasks_router.router, prefix="/api", tags=["media-tasks"])
    # Artifact 图表产物静态文件服务(签名 token 鉴权,2026-09-01 立,对标 Claude Artifacts)
    app.include_router(artifacts.router, prefix="/api", tags=["artifacts"])
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
    # 2026-09-30 挂载:外部 Chrome CDP 导入登录 Cookie(2026-08-17 写好但一直没 include,
    # 前端/桌面端也尚未接线 —— 先把能力面补齐,消费端接入时即可用)
    from app.routers import chrome_import as chrome_import_router
    app.include_router(chrome_import_router.router, prefix="/api", tags=["publish-chrome-import"])

    # 数据库同步调度器端点 /api/db-sync/{status,trigger,drift}
    from app.services.db_sync_scheduler import router as db_sync_router
    app.include_router(db_sync_router, prefix="/api", tags=["db-sync"])
    # 2026-07-31 新增:Browser Hub(CDP 完整 Chrome 内置浏览器)
    # WebSocket 画面流 + REST API + 鼠标键盘事件回传
    from app.routers import browser_hub as browser_hub_router
    app.include_router(browser_hub_router.router, prefix="/api", tags=["browser-hub"])
    # OpenCompass 排行榜抓取(Playwright 渲染,2026-07-22 新增,供 api ai-world-sync 调用)
    app.include_router(opencompass.router, prefix="/api", tags=["opencompass"])
    # 通用网页渲染抓取(Playwright 渲染,2026-09-05 新增,Cloudflare 挑战类站点兜底)
    from app.routers import browser_render as browser_render_router
    app.include_router(browser_render_router.router, prefix="/api", tags=["browser-render"])
    # 截图服务(Playwright headless,2026-07-22 新增,WorkPanel iframe 降级)
    app.include_router(screenshot.router, prefix="/api", tags=["screenshot"])
    # v1 业务流路由(对话/智能体/RAG,2026-07-20 新增)
    app.include_router(api_v1_router, prefix="/api/v1", tags=["v1"])
    # PR AI 评审端点(GitHub Actions 触发管道入口,2026-09-06 立)
    app.include_router(pr_review.router, prefix="/api/v1", tags=["pr-review"])
    # 自愈引擎端点(生成用例→pytest→LLM 补丁落盘→重跑,2026-09-06 接线)
    app.include_router(self_healing_router, prefix="/api/v1", tags=["self-healing"])
    # LSP 转发路由(封装 cli LSP 能力为 HTTP 端点,供 web 端 IDE 调试面板调用,2026-07-22 新增)
    from app.api.v1 import lsp as lsp_router_module
    app.include_router(lsp_router_module.router, prefix="/api/v1", tags=["lsp"])
    # DAP 调试路由(封装 DebugSessionManager 为 HTTP 端点,2026-07-22 新增)
    from app.api.v1 import debug as debug_router_module
    app.include_router(debug_router_module.router, prefix="/api/v1", tags=["debug"])
    # 四层记忆 + Dream 梦境系统(2026-07-22 新增,对标 OpenClaw Mem)
    from app.api.memory import router as memory_router
    app.include_router(memory_router, prefix="/api", tags=["memory"])
    # 多通道消息总线(5 通道 + 优先级 + 降级 + 模板 + 批量 + 限流,
    # 2026-07-22 新增,反超 OpenClaw 单 WS)
    from app.api.message_bus import router as message_bus_router
    app.include_router(message_bus_router, prefix="/api", tags=["message-bus"])
    # DAG Worker Pool(2026-07-22 立,多 agent 并行执行 — 限并发 N worker + 优先级队列 + 持久化)
    from app.api.dag import router as dag_router
    app.include_router(dag_router, prefix="/api/dag", tags=["dag"])
    # D31 设计稿转码(2026-09-26 立,Figma 节点树→React/Tailwind 代码,令牌缺失 fail-closed)
    from app.api.figma import router as figma_router
    app.include_router(figma_router, prefix="/api", tags=["figma"])
    # 2026-10-03 数据出域合规整改:代码索引出域同意的**跨进程同步**入口。
    # api 侧改完 `codeIndexEgressOptOut` 后推这里(**透传该用户 JWT + 端点级
    # require_request_user_id**,不是 AI_CALLBACK_SECRET:共享密钥方案实测被
    # JWTAuthMiddleware 挡在路由之前,且挂全局白名单等于允许任何人替任意用户授权,
    # 详见 code_index_consent_api.py 文件头),
    # 本进程的同意表随之更新 —— 两处 MCP 闸门(懒索引 / index_codebase)只读
    # `code_index_consent.has_consent`,不感知设置从哪来。设计取舍见该路由文件头。
    app.include_router(
        code_index_consent_api.router, prefix="/api", tags=["code-index-consent"]
    )
    # P3 Wave 11:Rules 引擎(文件存储 .ihui-agent/rules/*.md + 热加载 + 4 种匹配)
    app.include_router(rules.router, prefix="/api", tags=["rules"])
    # P3 Wave 11:Hook 服务(事件总线 + JSONLogic 条件 + 4 执行器)
    app.include_router(hooks.router, prefix="/api", tags=["hooks"])
    # P3 Wave 11:Plan/Spec 模式(tree-sitter AST 反向生成 spec markdown)
    app.include_router(spec.router, prefix="/api", tags=["spec"])
    # P3 Wave 11:Spec 扩展端点(apply preview/confirm + watch + review + split-tasks + enhance)
    # 路由定义在 services/spec_generator.py 末尾,打通 api 端 spec-service.ts 转发层(2026-07-24 立)
    from app.services.spec_generator import extra_router as spec_extra_router
    app.include_router(spec_extra_router, prefix="/api", tags=["spec-extended"])
    # P3 Wave 11:Context Engineering(对标 Qoder,多维 @ 提及 +
    # 跨会话 RAG + 多源融合 + token 预算分配)
    app.include_router(context_engine_router, prefix="/api/context", tags=["context-engine"])
    # 跨支柱编排中枢(2026-07-23 立,6 大超越支柱协同决策 + LLM 预算治理 + 统一遥测)
    app.include_router(orchestration.router, prefix="/api", tags=["orchestration"])
    app.include_router(
        team_orchestration.router, prefix="/api", tags=["orchestration-teams"]
    )
    app.include_router(legacy_router)
    # P3 深度层:AI 助教(学科讲解/提示/出题)+ LangGraph(interrupt/resume/state/history/stream)
    app.include_router(ai_tutor_router)
    # AI 批改(学科讲解/提示/出题之外新增评分能力)
    app.include_router(ai_marking_router)
    # 教育食堂采购小票 AI 三轮核对(extract/verify/arbitrate)
    app.include_router(edu_canteen_receipt_router)
    app.include_router(langgraph_router)
    # L4 自进化 admin 端点(meta_learner 状态/lessons/history + 手动触发聚类,2026-07-25 立)
    app.include_router(meta_learning_router)
    # Phase 2:可视化工作流编辑器(2026-08-09 立)
    app.include_router(workflow_router.router, prefix="/api", tags=["workflows"])
    # Harness 能力补齐:LLM 用量统计(2026-08-11 立,路由自带 /api/v1/ai/usage 前缀)
    app.include_router(usage_router.router, tags=["ai-usage"])
    # Harness 能力补齐:Prompt 版本管理(2026-08-11 立,路由无前缀,统一加 /api)
    app.include_router(prompts_router.router, prefix="/api", tags=["prompts"])
    # Harness 能力补齐:评估/评测框架(2026-08-11 立,路由自带 /api/v1/ai/eval 前缀)
    app.include_router(eval_router.router, tags=["eval"])
    # 2026-08-12 立:资讯板块每日自动刷新(marketing page-7 magazine 数据源,
    # 用户反馈"div 没内容显示"+"希望显示每天最新新闻")。router 自带 /api/admin/news 前缀。
    # 端点:GET /api/admin/news/status + POST /api/admin/news/refresh-daily
    # + POST /api/admin/news/publish-recent
    from app.routers import news as news_router
    app.include_router(news_router.router, tags=["news-refresh"])

    # 2026-10-03 立:签到助手服务端化(数据层 + 每日调度 + REST API)。
    # router 自带 /api/checkin 前缀,鉴权用 require_request_user_id。
    from app.routers import checkin as checkin_router
    app.include_router(checkin_router.router, tags=["checkin"])

    # W4(Phase 0):Plan Mode 计划模式端点族(对标 Claude Code Plan Mode,全新端点 /api/agent-plan*)
    from app.routers import agent_plan as agent_plan_router
    app.include_router(agent_plan_router.router, prefix="/api", tags=["agent-plan"])

    # AGENTS.md §8 第 3 步"独立评估校验(禁止模型自评 yes)"的落地端点。
    # 路由自带完整路径,这里不加 prefix(端点 = /api/agent/goal-verify)。
    from app.routers import goal_verification as goal_verification_router
    app.include_router(goal_verification_router.router, tags=["goal-verification"])

    # 对标杀手锏四件套路由(2026-09-03 立)——见上方 import
    app.include_router(research_router, prefix="/api", tags=["research"])
    app.include_router(checkpoint_rewind_router, prefix="/api", tags=["checkpoint-rewind"])
    app.include_router(cloud_runs_router, prefix="/api", tags=["cloud-runs"])
    app.include_router(step_recorder_router, prefix="/api", tags=["agent-recorder"])
    app.include_router(computer_use_router, prefix="/api", tags=["computer-use"])
    app.include_router(context_compaction_router, prefix="/api", tags=["context-compaction"])

    # 2026-09-07 立:Best-of-N 同任务多副本自动择优(对标 Cursor 多副本自动评审择优)
    from app.routers import best_of_n as best_of_n_router

    # 2026-09-13 立:Memory Sweeper(长期记忆 SQLite 存储 + 记忆清扫策略,
    # 对标 Codex/Claude Code 记忆衰减机制;纯标准库 sqlite3,WAL + 事务 + 线程锁)
    from app.routers.memory_sweeper import router as memory_sweeper_router
    app.include_router(best_of_n_router.router, prefix="/api", tags=["best-of-n"])

    # Memory Sweeper(2026-09-13 立,长期记忆 SQLite 存储 + 记忆清扫策略)
    app.include_router(memory_sweeper_router, prefix="/api", tags=["memory-sweeper"])

    # 企业级补齐(2026-09-06 立):审计日志查询(RBAC audit:read)+ SSO/OIDC
    app.include_router(audit_log_router, prefix="/api", tags=["audit-log"])
    app.include_router(sso_router, prefix="/api", tags=["sso"])

    # 深度引擎 HTTP 接线(2026-09-06 立):补丁引擎 / OS 沙箱执行 / Codex 级会话持久化
    from app.routers import patch as patch_router
    from app.routers import sandbox_exec as sandbox_exec_router
    from app.routers import sessions as sessions_router

    app.include_router(patch_router.router, prefix="/api", tags=["patch"])
    app.include_router(sandbox_exec_router.router, prefix="/api", tags=["sandbox-exec"])
    app.include_router(sessions_router.router, prefix="/api", tags=["sessions"])

    # 全活动时间线回放(P1-4 闭环 API 出口)
    from app.routers import timeline as timeline_router

    app.include_router(timeline_router.router, prefix="/api", tags=["timeline"])

    # 跨会话接力摘要(P2-7 闭环 API 出口)
    from app.routers import relay as relay_router

    app.include_router(relay_router.router, prefix="/api", tags=["relay"])

    # 本品类杀手锏只读/管理 API 统一挂载(成本看板/长期记忆/PromptGuard 审计/MCP 导出配置)
    from app.routers import killer_extras

    killer_extras.register(app)

    # V3 #57 能力台账只读端点(GET /api/admin/capabilities,role_id>=1)
    from app.core.capability_matrix import router as capability_matrix_router

    app.include_router(capability_matrix_router)

    # P2-③(2026-09-18 立):Agent Engine —— JSON-RPC 2.0 编排引擎传输层。
    # 对标 Codex app-server 的"任意应用嵌入 agent 循环"能力,接口直接暴露我方差异化:
    # MCP 超级工具池(tools.list)/ 多模型路由(models.list)/ 成本账本(cost.report)。
    # 端点:POST /api/engine/rpc(流式方法自动升级 SSE)+ WS /api/engine/ws。
    from app.routers import engine as engine_router

    app.include_router(engine_router.router, prefix="/api", tags=["agent-engine"])

    # P2-③ 第六批(2026-09-18):语音↔引擎回合式会话(对标 Codex realtime-webrtc
    # 的会话语义):音频 → faster-whisper 本地 STT → AgentEngine 线程 → edge-tts → 音频。
    from app.routers import engine_voice as engine_voice_router

    app.include_router(engine_voice_router.router, prefix="/api", tags=["voice", "agent-engine"])

    # 会话文件导入解析(Claude Code/Codex/Cursor/Aider 导出 → 统一 IR,2026-09-20 立)
    from app.routers import session_import

    app.include_router(session_import.router, prefix="/api", tags=["session-import"])

    # D31 设计稿转码:Figma Frame/组件 → IR → LLM 生成前端代码(2026-09-26 立)
    # FIGMA_API_TOKEN 未配置时 fail-closed(503 + FIGMA_NOT_CONFIGURED),零网络零半成品
    from app.routers import figma_import

    app.include_router(figma_import.router, prefix="/api", tags=["figma-import"])

    # IHUI 作为 MCP Server 对外开放(2026-09-03 立,逆向杀手锏只做客户端的对标产品)
    # 由 ENABLE_MCP_EXPORT 环境变量控制开关,默认关闭(避免影响现有服务,不启动额外 listener)。
    # 开启后暴露两种 transport:
    #   SSE            GET /api/mcp/export/sse + POST /api/mcp/export/messages/
    #   Streamable HTTP POST /api/mcp/export/streamable
    from app.services import mcp_export

    if mcp_export.is_enabled():
        mcp_export.mount_to_app(app)

    # 审计日志查询端点(调试用,返回最近审计记录,2026-07-22 立)
    # P2-8 修复(2026-08-06):审计记录含 agent 行为明细,限系统管理员(role_id >= 1)访问,
    # 普通登录用户无权读取。
    @app.get("/api/audit/recent", tags=["audit"], response_model=None)
    async def audit_recent(request: Request, limit: int = 100) -> dict[str, Any] | JSONResponse:
        role_id = getattr(request.state, "role_id", 0) or 0
        if int(role_id) < 1:
            return JSONResponse(
                status_code=403,
                content={"code": 403, "message": "仅管理员可读审计日志"},
            )
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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
