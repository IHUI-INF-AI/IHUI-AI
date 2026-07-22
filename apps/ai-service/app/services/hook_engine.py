"""Hook 引擎 — 事件总线 + 触发器匹配 + 执行器 + 日志记录(2026-07-22 立)。

对标 Trae IDE Hooks:agent 行为事件触发 → 执行自定义脚本/动作。

核心组件:
  - HookEngine:内存/Redis 存储 Hook 配置(单例,LRU 日志最近 1000 条)
  - emit(event, context):事件总线入口,agent_loop 在 tool.before/after 等位置调用
  - 条件匹配:JSONLogic 简化实现(== / != / contains / and / or / not 六种操作符)
  - 执行器:
    - webhook: httpx 异步发请求,超时 5s,支持 HMAC-SHA256 签名 + 失败重试
    - script: asyncio.create_subprocess_exec,超时 10s,stdout/stderr 截断 1KB,支持重试
    - log: 写到 logs/hooks.log(不重试)
    - notify: toast/email/webhook 三渠道,默认重试 1 次
  - 持久化:Redis 优先(hooks:configs + hooks:logs:{id}),降级内存

设计:
  - 配置与日志均存内存,Redis 可用时持久化(进程重启不丢)
  - 所有动作异步执行,emit 不阻塞调用方(失败仅记录日志)
  - script 在 .trae-cn/tmp/hooks/ 沙箱内执行,禁止访问敏感路径
  - HMAC 签名向后兼容:secret 为空时不签名
  - 重试指数退避:retry_delay * (2 ** attempt),log 不重试 / notify 重试 1 次 / webhook/script 按 config
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import random
import re
import shlex
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, AsyncIterator, Callable

logger = logging.getLogger(__name__)

# ====================== 常量 ======================

HOOK_EVENTS: tuple[str, ...] = (
    "tool.before",
    "tool.after",
    "message.send",
    "message.receive",
    "session.start",
    "session.end",
    "error",
)

HOOK_ACTION_TYPES: tuple[str, ...] = ("webhook", "script", "log", "notify")

MAX_LOGS = 1000
WEBHOOK_TIMEOUT = 5.0
SCRIPT_TIMEOUT = 10.0
SCRIPT_MAX_OUTPUT = 1024  # 1KB

# 重试默认配置(2026-07-22 立,对标 Trae Hooks 产品级体验)
DEFAULT_RETRY_COUNT = 0
MAX_RETRY_COUNT = 3
DEFAULT_RETRY_DELAY = 1.0  # 秒,指数退避 base(1s, 2s, 4s)

# Redis key 前缀(2026-07-22 立)
REDIS_HOOKS_KEY = "hooks:configs"
REDIS_LOGS_KEY_PREFIX = "hooks:logs:"  # + hook_id
REDIS_LOGS_MAX = 1000  # 每个 hook 保留最近 1000 条日志

# 通知渠道(2026-07-22 扩展,toast/email/webhook + notification 兼容)
NOTIFY_CHANNELS: tuple[str, ...] = ("toast", "email", "webhook", "notification")

# DLQ 死信队列(2026-07-22 立,补全被引用但未定义的常量)
REDIS_DLQ_KEY_PREFIX = "hooks:dlq:"  # + hook_id
DLQ_MAX_ENTRIES = 100  # 每个 hook 保留最近 100 条死信

# 健康检查窗口(2026-07-22 立,补全被引用但未定义的常量)
HEALTH_WINDOW_HOURS = 24  # 健康检查窗口(24 小时内成功率)
HEALTH_STALE_DAYS = 30  # 超过 30 天未触发视为 stale
HEALTHY_THRESHOLD = 0.95  # 成功率 ≥ 95% 视为 healthy
DEGRADED_THRESHOLD = 0.80  # 80% ≤ 成功率 < 95% 视为 degraded

# 健康预测窗口(2026-07-23 立,P3 Hook 超越创新)
HEALTH_FORECAST_WINDOW_DAYS = 30  # 健康预测基于最近 30 天数据
HEALTH_FORECAST_MIN_SAMPLES = 5  # 最少 5 条样本才进行趋势分析

# A/B 测试(2026-07-23 立,P3 Hook 超越创新)
AB_TEST_DEFAULT_METRICS: tuple[str, ...] = ("duration", "success_rate", "token_cost")
AB_TEST_MAX_VARIANTS = 5  # 单次 A/B 测试最多 5 个变体

# 执行时间线 / 实时执行流(2026-07-23 立)
EXECUTION_TIMELINE_MAX_EVENTS = 200  # 单 hook 保留最近 200 条执行事件
EXECUTION_STREAM_POLL_INTERVAL = 1.0  # WebSocket 轮询间隔(秒)

# LLM 智能编排可用事件(2026-07-23 立)
ORCHESTRATABLE_EVENTS: tuple[str, ...] = HOOK_EVENTS + ("schedule.trigger",)

# 模板 ID 前缀(2026-07-23 立)
TEMPLATE_ID_PREFIX = "tpl-"
AB_TEST_ID_PREFIX = "abt-"

# 沙箱目录(AGENTS.md §15 工作区卫生规则的临时目录 .trae-cn/tmp/hooks/)
_PROJECT_ROOT = Path(__file__).resolve().parents[4]
SANDBOX_DIR = _PROJECT_ROOT / ".trae-cn" / "tmp" / "hooks"
LOG_FILE = _PROJECT_ROOT / "logs" / "hooks.log"

# 敏感路径正则(script 命令禁止包含以下模式)
SENSITIVE_PATTERNS = [
    r"\b/etc/passwd\b",
    r"\b/etc/shadow\b",
    r"\b\.ssh\b",
    r"\b\.env\b",
    r"\bcredentials\b",
    r"\bAPI_KEY\b",
    r"\bSECRET\b",
    r"\brm\s+-rf\s+/\b",
    r"\bmkfs\b",
    r"\bdd\s+if=",
]
_SENSITIVE_RE = re.compile("|".join(SENSITIVE_PATTERNS), re.IGNORECASE)

# 模板变量替换正则
_TEMPLATE_RE = re.compile(r"\{\{\s*(\w+)\s*\}\}")

# redis 包未安装时降级为纯内存模式(与 memory.py / agent_comm.py 一致)
try:
    import redis.asyncio as aioredis  # type: ignore[import-not-found]
except ImportError:
    aioredis = None  # type: ignore[assignment]


# ====================== 条件匹配(JSONLogic 简化版) ======================


def _resolve_path(data: dict[str, Any], path: str) -> Any:
    """按点分路径解析 data 中的值。如 'args.path' → data['args']['path']。"""
    cur: Any = data
    for seg in path.split("."):
        if isinstance(cur, dict) and seg in cur:
            cur = cur[seg]
        else:
            return None
    return cur


def _apply_operator(op: str, left: Any, right: Any, data: dict[str, Any]) -> bool:
    """应用单个 JSONLogic 操作符。"""
    if op == "==":
        return left == right
    if op == "!=":
        return left != right
    if op == "contains":
        if left is None:
            return False
        if isinstance(left, (list, tuple, set)):
            return right in left
        if isinstance(left, str):
            return str(right) in left
        if isinstance(left, dict):
            return str(right) in str(left)
        return False
    if op == "and":
        return all(_eval_logic(c, data) for c in left)
    if op == "or":
        return any(_eval_logic(c, data) for c in left)
    if op == "not":
        return not _eval_logic(left, data)
    logger.warning("[hook_engine] 未知操作符: %s", op)
    return False


def _eval_logic(expr: Any, data: dict[str, Any]) -> bool:
    """递归求值 JSONLogic 表达式。"""
    if isinstance(expr, bool):
        return expr
    if expr is None:
        return True  # None 视为无条件
    if not isinstance(expr, dict):
        return bool(expr)
    if len(expr) != 1:
        # 多 key 不是合法 JSONLogic,降级为 truthy
        return bool(expr)
    op, args = next(iter(expr.items()))
    if op in ("and", "or"):
        return _apply_operator(op, args, None, data)
    if op == "not":
        return _apply_operator("not", args, None, data)
    # 二元操作符:args = [field_path, value]
    if not isinstance(args, list) or len(args) != 2:
        return False
    field_path, expected = args
    if isinstance(field_path, str):
        actual = _resolve_path(data, field_path)
    else:
        actual = field_path
    return _apply_operator(op, actual, expected, data)


def evaluate_condition(condition: str | None, context: dict[str, Any]) -> bool:
    """求值条件表达式。空 condition 视为无条件(返回 True)。"""
    if not condition or not condition.strip():
        return True
    try:
        expr = json.loads(condition)
    except json.JSONDecodeError as e:
        logger.warning("[hook_engine] 条件 JSON 解析失败: %s", e)
        return False
    try:
        return _eval_logic(expr, context)
    except Exception as e:
        logger.warning("[hook_engine] 条件求值异常: %s", e)
        return False


# ====================== 模板变量替换 ======================


def render_template(template: str | None, context: dict[str, Any]) -> str:
    """渲染 {{var}} 模板,缺失变量替换为空字符串。"""
    if not template:
        return ""

    def repl(m: re.Match[str]) -> str:
        key = m.group(1)
        val = context.get(key)
        if val is None:
            return ""
        if isinstance(val, (dict, list)):
            try:
                return json.dumps(val, ensure_ascii=False)
            except Exception:
                return str(val)
        return str(val)

    return _TEMPLATE_RE.sub(repl, template)


# ====================== Hook 引擎主体 ======================


# ---------- P3 Hook 超越创新:dataclass(2026-07-23 立)----------


@dataclass
class AbTestConfig:
    """A/B 测试配置(2026-07-23 立,P3 Hook 超越创新)。

    同一事件多个 Hook 变体对比效果,按 traffic_split 随机选择一个变体执行。
    """

    id: str
    event: str
    variants: list[str]  # hook_id 列表(变体)
    traffic_split: list[float]  # 流量分配,如 [0.5, 0.5],需与 variants 等长且和为 1
    metrics: list[str] = field(default_factory=lambda: list(AB_TEST_DEFAULT_METRICS))
    created_at: datetime = field(default_factory=datetime.utcnow)
    status: str = "running"  # running / completed / stopped
    stopped_at: datetime | None = None
    winner: str | None = None  # 停止后选出的最优变体 hook_id
    description: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """序列化为 dict(API 响应用)。"""
        return {
            "id": self.id,
            "event": self.event,
            "variants": self.variants,
            "trafficSplit": self.traffic_split,
            "metrics": self.metrics,
            "createdAt": self.created_at.isoformat() + "Z",
            "status": self.status,
            "stoppedAt": self.stopped_at.isoformat() + "Z" if self.stopped_at else None,
            "winner": self.winner,
            "description": self.description,
        }


@dataclass
class HookTemplate:
    """Hook 模板(2026-07-23 立,P3 Hook 超越创新)。

    预置 Hook 模板库,用户可一键从模板创建 Hook(可覆盖配置)。
    """

    id: str
    name: str
    description: str
    event: str
    action: dict[str, Any]  # {type, config}
    condition: str | None = None
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """序列化为 dict(API 响应用)。"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "event": self.event,
            "action": self.action,
            "condition": self.condition,
            "tags": self.tags,
        }


@dataclass
class ExecutionEvent:
    """Hook 执行事件(2026-07-23 立,P3 Hook 超越创新)。

    用于实时执行流(WebSocket)推送和 Gantt 时间线。
    """

    hook_id: str
    event: str  # 触发的 HookEvent
    phase: str  # start / progress / end / error
    timestamp: float  # 时间戳(ms epoch)
    duration_ms: int | None = None  # end/error 时填
    success: bool | None = None  # end 时填
    error: str | None = None  # error 时填
    log_id: str | None = None  # 关联的日志 ID

    def to_dict(self) -> dict[str, Any]:
        """序列化为 dict(WebSocket 推送用)。"""
        return {
            "hookId": self.hook_id,
            "event": self.event,
            "phase": self.phase,
            "timestamp": self.timestamp,
            "durationMs": self.duration_ms,
            "success": self.success,
            "error": self.error,
            "logId": self.log_id,
        }


class HookEngine:
    """Hook 引擎:配置存储 + 事件总线 + 执行器 + 日志。

    单例模式(hook_engine),Redis 可用时持久化配置与日志,降级内存。
    日志 LRU 保留最近 1000 条(内存)+ Redis list 1000 条/hook。
    CRUD 方法保持同步(兼容现有 router),持久化通过 fire-and-forget 异步任务。
    """

    def __init__(self, redis_client: Any = None) -> None:
        # Hook 配置:hook_id → hook_dict
        self._hooks: dict[str, dict[str, Any]] = {}
        # 日志:list(LRU,超出 MAX_LOGS 删最旧)
        self._logs: list[dict[str, Any]] = []
        # Redis 客户端(可选,降级内存)
        self._redis: Any = redis_client
        self._use_redis = redis_client is not None
        # 是否已从 Redis 加载配置(惰性,首次 emit 时触发)
        self._loaded = False

        # ---------- P3 Hook 超越创新(2026-07-23 立)----------
        # A/B 测试注册表:test_id → AbTestConfig
        self._ab_tests: dict[str, AbTestConfig] = {}
        # A/B 测试执行结果:test_id → variant_id → [log_entry, ...]
        self._ab_test_results: dict[str, dict[str, list[dict[str, Any]]]] = {}
        # 预置模板库(惰性初始化)
        self._templates: list[HookTemplate] | None = None
        # 执行事件时间线:hook_id → deque[ExecutionEvent](LRU,EXECUTION_TIMELINE_MAX_EVENTS)
        self._execution_events: dict[str, deque] = {}
        # 执行事件订阅者(WebSocket 用):list[Callable[[ExecutionEvent], None]]
        self._execution_subscribers: list[Callable[[ExecutionEvent], None]] = []
        # 实时执行状态:hook_id → {"status": "running"|"queued"|"idle", "startedAt": float}
        self._realtime_status: dict[str, dict[str, Any]] = {}

    # ---------- Redis 持久化 ----------

    def set_redis_client(self, client: Any) -> None:
        """注入 Redis 客户端(供 main.py lifespan 或测试调用)。"""
        self._redis = client
        self._use_redis = client is not None
        self._loaded = False  # 重置加载标记,下次 emit 重新加载

    async def _ensure_redis(self) -> Any:
        """确保 Redis 客户端可用,惰性从 settings.redis_url 创建。"""
        if self._redis is not None:
            return self._redis
        if not self._use_redis:
            # 尝试从 settings 创建(首次调用时)
            try:
                from ..core.config import settings
                if not settings.redis_url or aioredis is None:
                    self._use_redis = False
                    return None
                self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)
                await self._redis.ping()
                self._use_redis = True
                logger.info("[hook_engine] Redis 已连接,启用持久化")
            except Exception as e:
                logger.warning("[hook_engine] Redis 不可用,降级内存: %s", e)
                self._use_redis = False
                self._redis = None
                return None
        return self._redis

    async def _load_hooks(self) -> None:
        """从 Redis 加载 Hook 配置(启动后首次 emit 时调用,失败降级内存)。"""
        if self._loaded:
            return
        self._loaded = True
        redis = await self._ensure_redis()
        if redis is None:
            return
        try:
            raw = await redis.get(REDIS_HOOKS_KEY)
            if raw:
                data = json.loads(raw)
                if isinstance(data, dict):
                    self._hooks.update(data)
                    logger.info("[hook_engine] 从 Redis 加载 %d 个 Hook 配置", len(data))
        except Exception as e:
            logger.warning("[hook_engine] 从 Redis 加载 Hook 配置失败: %s", e)

    async def _persist_hooks(self) -> None:
        """配置变更时异步写入 Redis(fire-and-forget 调用)。"""
        redis = await self._ensure_redis()
        if redis is None:
            return
        try:
            await redis.set(REDIS_HOOKS_KEY, json.dumps(self._hooks, ensure_ascii=False))
        except Exception as e:
            logger.warning("[hook_engine] 持久化 Hook 配置到 Redis 失败: %s", e)

    async def _persist_log(self, hook_id: str, log_entry: dict[str, Any]) -> None:
        """日志写入 Redis list(LPUSH + LTRIM 保留 1000 条)。"""
        redis = await self._ensure_redis()
        if redis is None:
            return
        try:
            key = f"{REDIS_LOGS_KEY_PREFIX}{hook_id}"
            await redis.lpush(key, json.dumps(log_entry, ensure_ascii=False))
            await redis.ltrim(key, 0, REDIS_LOGS_MAX - 1)
        except Exception as e:
            logger.warning("[hook_engine] 持久化 Hook 日志到 Redis 失败: %s", e)

    def _schedule_persist_hooks(self) -> None:
        """调度异步持久化(fire-and-forget,无事件循环时跳过)。"""
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._persist_hooks())
        except RuntimeError:
            # 没有运行中的事件循环(如模块加载时),跳过
            pass

    def _schedule_persist_log(self, hook_id: str, log_entry: dict[str, Any]) -> None:
        """调度异步日志持久化(fire-and-forget)。"""
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._persist_log(hook_id, log_entry))
        except RuntimeError:
            pass

    # ---------- CRUD ----------

    def list_hooks(self, event: str | None = None) -> list[dict[str, Any]]:
        """列出全部 Hook(可选按 event 过滤)。"""
        hooks = list(self._hooks.values())
        if event:
            hooks = [h for h in hooks if h["event"] == event]
        # 按创建时间倒序
        hooks.sort(key=lambda h: h["createdAt"], reverse=True)
        return hooks

    def get_hook(self, hook_id: str) -> dict[str, Any] | None:
        return self._hooks.get(hook_id)

    def create_hook(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = datetime.utcnow().isoformat() + "Z"
        hook: dict[str, Any] = {
            "id": f"hk-{uuid.uuid4().hex[:12]}",
            "name": payload["name"],
            "description": payload.get("description"),
            "event": payload["event"],
            "condition": payload.get("condition"),
            "action": payload["action"],
            "enabled": payload.get("enabled", True),
            "createdAt": now,
            "updatedAt": now,
        }
        self._hooks[hook["id"]] = hook
        logger.info("[hook_engine] 创建 Hook: id=%s name=%s event=%s", hook["id"], hook["name"], hook["event"])
        self._schedule_persist_hooks()
        return hook

    def update_hook(self, hook_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        hook = self._hooks.get(hook_id)
        if hook is None:
            return None
        for k in ("name", "description", "event", "condition", "action", "enabled"):
            if k in patch:
                hook[k] = patch[k]
        hook["updatedAt"] = datetime.utcnow().isoformat() + "Z"
        self._schedule_persist_hooks()
        return hook

    def delete_hook(self, hook_id: str) -> bool:
        ok = self._hooks.pop(hook_id, None) is not None
        if ok:
            self._schedule_persist_hooks()
        return ok

    def toggle_hook(self, hook_id: str, enabled: bool) -> dict[str, Any] | None:
        hook = self._hooks.get(hook_id)
        if hook is None:
            return None
        hook["enabled"] = enabled
        hook["updatedAt"] = datetime.utcnow().isoformat() + "Z"
        self._schedule_persist_hooks()
        return hook

    # ---------- 日志 ----------

    def list_logs(
        self,
        hook_id: str | None = None,
        limit: int = 100,
        event: str | None = None,
        success: bool | None = None,
        duration_min: int | None = None,
        duration_max: int | None = None,
        since: str | None = None,
        until: str | None = None,
    ) -> list[dict[str, Any]]:
        """列出日志(支持多维过滤:event/success/duration/时间范围)。

        Args:
            hook_id: 按 Hook ID 过滤
            limit: 返回最大条数(1-1000)
            event: 按触发事件过滤
            success: 按成功/失败过滤
            duration_min: 耗时下限(ms,含)
            duration_max: 耗时上限(ms,含)
            since: 起始时间(ISO 字符串比较,含)
            until: 截止时间(ISO 字符串比较,含)
        """
        logs = self._logs
        if hook_id:
            logs = [l for l in logs if l["hookId"] == hook_id]
        if event:
            logs = [l for l in logs if l.get("event") == event]
        if success is not None:
            logs = [l for l in logs if l.get("success") is success]
        if duration_min is not None:
            logs = [l for l in logs if l.get("duration", 0) >= duration_min]
        if duration_max is not None:
            logs = [l for l in logs if l.get("duration", 0) <= duration_max]
        if since:
            logs = [l for l in logs if l.get("triggeredAt", "") >= since]
        if until:
            logs = [l for l in logs if l.get("triggeredAt", "") <= until]
        # 倒序(最新在前)
        sorted_logs = sorted(logs, key=lambda l: l["triggeredAt"], reverse=True)
        return sorted_logs[: max(1, min(limit, MAX_LOGS))]

    def get_stats(self, hook_id: str | None = None) -> dict[str, Any]:
        """计算 Hook 执行统计(可选按 hook_id 过滤)。

        Returns:
            {total, success, failed, avgDuration}
        """
        logs = self._logs
        if hook_id:
            logs = [l for l in logs if l["hookId"] == hook_id]
        total = len(logs)
        if total == 0:
            return {"total": 0, "success": 0, "failed": 0, "avgDuration": 0}
        success_count = sum(1 for l in logs if l.get("success"))
        failed_count = total - success_count
        total_duration = sum(l.get("duration", 0) for l in logs)
        avg_duration = round(total_duration / total, 2) if total else 0
        return {
            "total": total,
            "success": success_count,
            "failed": failed_count,
            "avgDuration": avg_duration,
        }

    def _append_log(self, log_entry: dict[str, Any]) -> None:
        self._logs.append(log_entry)
        # LRU:超出上限删最旧
        if len(self._logs) > MAX_LOGS:
            self._logs = self._logs[-MAX_LOGS:]
        # 异步持久化到 Redis(fire-and-forget)
        self._schedule_persist_log(log_entry["hookId"], log_entry)

    # ---------- 事件总线 ----------

    async def emit(self, event: str, context: dict[str, Any]) -> list[dict[str, Any]]:
        """事件总线:触发所有匹配该事件的 Hook。

        - event: HookEvent 字符串(如 'tool.before')
        - context: 上下文字典(tool/args/result/sessionId/userId 等)

        返回本次触发产生的日志列表(条件不匹配的 Hook 不触发,不记日志)。
        所有动作异步执行,失败仅记录 error 日志,不抛错。

        A/B 测试集成(2026-07-23 立):如该事件有活跃 A/B 测试命中,
        按 traffic_split 随机选择一个变体执行(而非全跑),结果记录到 A/B 测试统计。
        """
        if event not in HOOK_EVENTS:
            logger.warning("[hook_engine] 未知事件: %s", event)
            return []

        # 惰性加载 Redis 配置(首次 emit 时触发)
        await self._load_hooks()

        triggered_logs: list[dict[str, Any]] = []
        # 取所有 enabled 且 event 匹配的 Hook(快照,避免执行过程中被修改)
        candidates = [
            h for h in self._hooks.values() if h["enabled"] and h["event"] == event
        ]

        # A/B 测试:如有活跃测试命中该事件,按 traffic_split 选择一个变体执行(2026-07-23 立)
        ab_test = self._find_active_ab_test(event)
        selected_variant: str | None = None
        if ab_test is not None:
            selected_variant = self._select_ab_variant(ab_test)
            if selected_variant is None:
                # traffic_split 配置异常,降级为全跑(不阻塞业务)
                logger.warning(
                    "[hook_engine] A/B 测试 traffic_split 异常,降级全跑: test_id=%s",
                    ab_test.id,
                )
                ab_test = None
            else:
                # 只执行选中的变体(其他变体跳过)
                candidates = [h for h in candidates if h["id"] == selected_variant]
                logger.info(
                    "[hook_engine] A/B 测试命中: test_id=%s selected_variant=%s",
                    ab_test.id, selected_variant,
                )

        for hook in candidates:
            try:
                matched = evaluate_condition(hook.get("condition"), context)
                if not matched:
                    continue
                log = await self._execute_hook(hook, event, context)
                triggered_logs.append(log)
                self._append_log(log)
                # A/B 测试结果记录(2026-07-23 立)
                if ab_test is not None and selected_variant is not None:
                    self._record_ab_test_result(ab_test.id, hook["id"], log)
            except Exception as e:
                logger.exception("[hook_engine] Hook 执行异常: hook_id=%s err=%s", hook["id"], e)
                err_log = self._make_log(
                    hook["id"], event, success=False, duration=0, error=str(e)
                )
                triggered_logs.append(err_log)
                self._append_log(err_log)
                # A/B 测试失败结果记录
                if ab_test is not None and selected_variant is not None:
                    self._record_ab_test_result(ab_test.id, hook["id"], err_log)
        return triggered_logs

    async def _execute_hook(
        self, hook: dict[str, Any], event: str, context: dict[str, Any],
        replay: bool = False,
    ) -> dict[str, Any]:
        """执行单个 Hook(已通过条件匹配),返回日志条目。带指数退避重试。

        重试策略:
          - log 动作不重试
          - notify 动作重试 1 次
          - webhook/script 动作按 config.retry_count(默认 0,最大 3)
          - 重试间隔:retry_delay * (2 ** attempt) 指数退避(1s, 2s, 4s)

        执行事件发布(2026-07-23 立):start/end/error 三阶段事件推送给订阅者(WebSocket)。
        """
        action = hook.get("action", {})
        action_type = action.get("type")
        config = action.get("config", {}) or {}
        start = time.time()

        # 发布 start 执行事件(2026-07-23 立)
        self._publish_execution_event(hook["id"], event, "start")
        self._set_realtime_status(hook["id"], "running")

        # 解析重试配置
        retry_count = self._resolve_retry_count(action_type, config)
        retry_delay = self._resolve_retry_delay(config)

        success = False
        last_result: str | None = None
        last_err: str | None = None

        for attempt in range(retry_count + 1):
            result_str: str | None = None
            err_str: str | None = None
            try:
                if action_type == "webhook":
                    result_str, err_str = await self._run_webhook(config, event, context)
                elif action_type == "script":
                    result_str, err_str = await self._run_script(config, event, context)
                elif action_type == "log":
                    result_str, err_str = self._run_log(config, event, context)
                elif action_type == "notify":
                    result_str, err_str = await self._run_notify(config, event, context)
                else:
                    err_str = f"未知动作类型: {action_type}"
                if err_str is None:
                    success = True
                    last_result = result_str
                    last_err = None
                    break
                # 失败:记录错误,准备重试
                last_result = result_str
                last_err = err_str
            except Exception as e:
                last_err = str(e)

            # 重试逻辑(本次失败且还有重试机会)
            if attempt < retry_count:
                delay = retry_delay * (2 ** attempt)
                logger.info(
                    "[hook_engine] Hook 重试: hook_id=%s attempt=%d/%d err=%s next_retry_in=%.1fs",
                    hook["id"], attempt + 1, retry_count, last_err, delay,
                )
                await asyncio.sleep(delay)

        duration_ms = int((time.time() - start) * 1000)
        log = self._make_log(
            hook_id=hook["id"],
            event=event,
            success=success,
            duration=duration_ms,
            result=last_result,
            error=last_err,
            input_payload=context,
            replay=replay,
        )
        # 发布 end/error 执行事件(2026-07-23 立)
        if success:
            self._publish_execution_event(
                hook["id"], event, "end",
                duration_ms=duration_ms, success=True, log_id=log["id"],
            )
        else:
            self._publish_execution_event(
                hook["id"], event, "error",
                duration_ms=duration_ms, error=last_err, log_id=log["id"],
            )
        self._set_realtime_status(hook["id"], "idle")
        # 重试耗尽仍失败 → 入 DLQ(2026-07-22 立)
        if not success:
            await self._push_dlq(hook["id"], context, last_err or "未知错误", retry_count)
        return log

    def _resolve_retry_count(self, action_type: str, config: dict[str, Any]) -> int:
        """解析重试次数:log 不重试,notify 重试 1 次,webhook/script 按 config.retry_count。"""
        if action_type == "log":
            return 0
        if action_type == "notify":
            return 1
        # webhook / script:从 config 读取,默认 0,最大 3
        raw = config.get("retry_count", DEFAULT_RETRY_COUNT)
        try:
            count = int(raw)
        except (TypeError, ValueError):
            count = DEFAULT_RETRY_COUNT
        return max(0, min(count, MAX_RETRY_COUNT))

    def _resolve_retry_delay(self, config: dict[str, Any]) -> float:
        """解析重试延迟(指数退避 base,秒)。"""
        raw = config.get("retry_delay", DEFAULT_RETRY_DELAY)
        try:
            delay = float(raw)
        except (TypeError, ValueError):
            delay = DEFAULT_RETRY_DELAY
        return max(0.0, delay)

    # ---------- 执行器 ----------

    async def _run_webhook(
        self, config: dict[str, Any], event: str, context: dict[str, Any]
    ) -> tuple[str | None, str | None]:
        url = config.get("url")
        if not url:
            return None, "webhook url 未配置"
        method = config.get("method", "POST").upper()
        headers = dict(config.get("headers") or {"Content-Type": "application/json"})
        body_template = config.get("body")
        # 渲染 body 模板
        body_text = render_template(body_template, context) if body_template else json.dumps(
            {"event": event, "context": context}, ensure_ascii=False
        )
        # HMAC-SHA256 签名(secret 为空时不签名,向后兼容)
        secret = config.get("secret")
        if secret:
            signature = hmac.new(
                secret.encode("utf-8"),
                body_text.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            headers["X-Hook-Signature"] = f"sha256={signature}"
        try:
            import httpx
        except ImportError:
            return None, "httpx 未安装,无法执行 webhook"
        try:
            async with httpx.AsyncClient(timeout=WEBHOOK_TIMEOUT) as client:
                response = await client.request(
                    method,
                    url,
                    headers=headers,
                    content=body_text if method != "GET" else None,
                )
                result = f"HTTP {response.status_code}"
                if response.status_code >= 400:
                    return result, f"webhook 返回错误状态: {response.status_code}"
                return result, None
        except httpx.TimeoutException:
            return None, f"webhook 超时({WEBHOOK_TIMEOUT}s)"
        except Exception as e:
            return None, f"webhook 失败: {e}"

    async def _run_script(
        self, config: dict[str, Any], event: str, context: dict[str, Any]
    ) -> tuple[str | None, str | None]:
        command = config.get("command")
        if not command:
            return None, "script command 未配置"
        # 安全检查:禁止访问敏感路径
        if _SENSITIVE_RE.search(command):
            return None, "script 命令包含敏感模式,被安全策略拒绝"
        # 注入环境变量(只读 context)
        env = os.environ.copy()
        env["HOOK_EVENT"] = event
        env["HOOK_CONTEXT"] = json.dumps(context, ensure_ascii=False)
        # 沙箱目录
        try:
            SANDBOX_DIR.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass
        try:
            # Windows 用 cmd /c,Unix 用 sh -c
            if os.name == "nt":
                proc = await asyncio.create_subprocess_exec(
                    "cmd", "/c", command,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=str(SANDBOX_DIR),
                    env=env,
                )
            else:
                # 用 shlex 拆分命令参数
                args = shlex.split(command)
                proc = await asyncio.create_subprocess_exec(
                    *args,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=str(SANDBOX_DIR),
                    env=env,
                )
            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(), timeout=SCRIPT_TIMEOUT
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                return None, f"script 超时({SCRIPT_TIMEOUT}s)"
            stdout_text = (stdout_bytes or b"").decode("utf-8", errors="replace")[:SCRIPT_MAX_OUTPUT]
            stderr_text = (stderr_bytes or b"").decode("utf-8", errors="replace")[:SCRIPT_MAX_OUTPUT]
            if proc.returncode != 0:
                return stdout_text or None, f"script 退出码 {proc.returncode}: {stderr_text}"
            return stdout_text or "OK", None
        except Exception as e:
            return None, f"script 执行失败: {e}"

    def _run_log(
        self, config: dict[str, Any], event: str, context: dict[str, Any]
    ) -> tuple[str | None, str | None]:
        message = render_template(config.get("message"), context) or json.dumps(
            {"event": event, "context": context}, ensure_ascii=False
        )
        try:
            LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
            with LOG_FILE.open("a", encoding="utf-8") as f:
                line = f"[{datetime.utcnow().isoformat()}Z] event={event} msg={message}\n"
                f.write(line)
            return f"written {len(message)} chars", None
        except Exception as e:
            return None, f"log 写入失败: {e}"

    async def _run_notify(
        self, config: dict[str, Any], event: str, context: dict[str, Any]
    ) -> tuple[str | None, str | None]:
        """通知动作:支持 toast / email / webhook 三渠道(默认 toast)。

        toast:写入 app.state["notifications"] 队列(前端轮询 /api/notifications 获取)
        email:调用现有 email_service(不存在则 logger.warning 降级)
        webhook:复用 webhook 执行器发送通知
        notification:视为 toast 的别名(兼容旧配置)
        """
        channel = config.get("channel", "toast")
        message = render_template(config.get("message"), context) or f"Hook 触发: {event}"

        if channel in ("toast", "notification"):
            await self._notify_toast(event, message, context)
            return f"notify({channel})", None

        if channel == "email":
            err = await self._notify_email(config, event, message, context)
            if err:
                return None, f"notify(email) 失败: {err}"
            return "notify(email)", None

        if channel == "webhook":
            # 复用 webhook 执行器
            webhook_config = {
                "url": config.get("url"),
                "method": config.get("method", "POST"),
                "headers": config.get("headers"),
                "body": config.get("body") or message,
                "secret": config.get("secret"),
            }
            result, err = await self._run_webhook(webhook_config, event, context)
            if err:
                return result, f"notify(webhook) 失败: {err}"
            return f"notify(webhook): {result}", None

        return None, f"未知通知渠道: {channel}"

    async def _notify_toast(
        self, event: str, message: str, context: dict[str, Any]
    ) -> None:
        """toast 通知:写入 app.state["notifications"] 队列(前端轮询获取)。

        通过惰性导入 fastapi_app 获取 app.state(避免循环导入)。
        app.state 不存在 notifications 属性时惰性创建。
        """
        try:
            from ..main import fastapi_app
            if not hasattr(fastapi_app.state, "notifications"):
                fastapi_app.state.notifications = []
            fastapi_app.state.notifications.append({
                "id": f"ntf-{uuid.uuid4().hex[:12]}",
                "event": event,
                "message": message,
                "createdAt": datetime.utcnow().isoformat() + "Z",
                "read": False,
            })
        except Exception as e:
            logger.warning("[hook_engine] toast 通知写入失败(降级日志): %s", e)
        logger.info("[hook_engine] notify(toast): event=%s msg=%s", event, message)

    async def _notify_email(
        self, config: dict[str, Any], event: str, message: str, context: dict[str, Any]
    ) -> str | None:
        """email 通知:调用 email_service,不存在则降级 logger.warning。

        Returns:
            None=成功,str=错误信息
        """
        to = config.get("to") or config.get("email")
        subject = config.get("subject") or f"Hook 通知: {event}"
        try:
            from ..services.email_service import send_email  # type: ignore[import-not-found]
            await send_email(to=to, subject=subject, body=message)
            logger.info("[hook_engine] notify(email) 已发送: to=%s subject=%s", to, subject)
            return None
        except ImportError:
            logger.warning(
                "[hook_engine] email_service 不存在,降级日志: to=%s subject=%s msg=%s",
                to, subject, message,
            )
            return None  # 降级视为成功(不阻塞 Hook 执行)
        except Exception as e:
            return f"email 发送失败: {e}"

    # ---------- 测试接口 ----------

    async def test_hook(
        self, hook_id: str, event: str, context: dict[str, Any]
    ) -> dict[str, Any]:
        """测试 Hook:模拟触发,返回日志(不写入持久日志)。

        返回 {triggered: bool, logs: [HookLog]}
        """
        hook = self._hooks.get(hook_id)
        if hook is None:
            return {"triggered": False, "logs": []}
        # 临时强制 event 为参数传入的 event(忽略 hook.event 字段)
        # 条件匹配
        if not evaluate_condition(hook.get("condition"), context):
            return {"triggered": False, "logs": []}
        # 临时启用并执行
        original_enabled = hook["enabled"]
        original_event = hook["event"]
        hook["enabled"] = True
        hook["event"] = event
        try:
            log = await self._execute_hook(hook, event, context)
        finally:
            hook["enabled"] = original_enabled
            hook["event"] = original_event
        return {"triggered": True, "logs": [log]}

    # ---------- 工具 ----------

    def _make_log(
        self,
        hook_id: str,
        event: str,
        success: bool,
        duration: int,
        result: str | None = None,
        error: str | None = None,
        input_payload: dict[str, Any] | None = None,
        replay: bool = False,
        skipped: bool = False,
    ) -> dict[str, Any]:
        return {
            "id": f"hl-{uuid.uuid4().hex[:12]}",
            "hookId": hook_id,
            "event": event,
            "triggeredAt": datetime.utcnow().isoformat() + "Z",
            "success": success,
            "duration": duration,
            "result": result,
            "error": error,
            "inputPayload": input_payload,
            "replay": replay,
            "skipped": skipped,
        }

    # ---------- DLQ 死信队列(2026-07-22 立)----------

    async def _push_dlq(
        self, hook_id: str, payload: dict[str, Any], error: str, retry_count: int
    ) -> None:
        """失败 Hook 入 DLQ(Redis list LPUSH + LTRIM 100,降级内存)。"""
        entry = {
            "id": f"dlq-{uuid.uuid4().hex[:12]}",
            "hookId": hook_id,
            "originalPayload": payload,
            "error": error,
            "failedAt": datetime.utcnow().isoformat() + "Z",
            "retryCount": retry_count,
        }
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                key = f"{REDIS_DLQ_KEY_PREFIX}{hook_id}"
                await redis.lpush(key, json.dumps(entry, ensure_ascii=False))
                await redis.ltrim(key, 0, DLQ_MAX_ENTRIES - 1)
                return
            except Exception as e:
                logger.warning("[hook_engine] DLQ 写入 Redis 失败,降级内存: %s", e)
        # 内存降级
        self._dlq.setdefault(hook_id, []).insert(0, entry)
        if len(self._dlq[hook_id]) > DLQ_MAX_ENTRIES:
            self._dlq[hook_id] = self._dlq[hook_id][:DLQ_MAX_ENTRIES]

    async def list_dlq(self, hook_id: str) -> list[dict[str, Any]]:
        """返回指定 Hook 的 DLQ 列表(最新在前)。"""
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                key = f"{REDIS_DLQ_KEY_PREFIX}{hook_id}"
                raw = await redis.lrange(key, 0, DLQ_MAX_ENTRIES - 1)
                return [json.loads(item) for item in raw]
            except Exception as e:
                logger.warning("[hook_engine] DLQ 读取 Redis 失败,降级内存: %s", e)
        return list(self._dlq.get(hook_id, []))

    async def reprocess_dlq(self, hook_id: str, entry_id: str) -> dict[str, Any] | None:
        """从 DLQ 重新处理指定条目(重新执行 + 移除 DLQ 条目)。"""
        entries = await self.list_dlq(hook_id)
        target = next((e for e in entries if e["id"] == entry_id), None)
        if target is None:
            return None
        hook = self._hooks.get(hook_id)
        if hook is None:
            return None
        # 重新执行(replay 标记)
        log = await self._execute_hook(
            hook, "dlq.reprocess", target["originalPayload"], replay=True
        )
        self._append_log(log)
        # 从 DLQ 移除该条目
        await self._remove_dlq_entry(hook_id, entry_id)
        return log

    async def _remove_dlq_entry(self, hook_id: str, entry_id: str) -> None:
        """从 DLQ 移除指定条目。"""
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                key = f"{REDIS_DLQ_KEY_PREFIX}{hook_id}"
                raw_list = await redis.lrange(key, 0, -1)
                for raw in raw_list:
                    entry = json.loads(raw)
                    if entry.get("id") == entry_id:
                        await redis.lrem(key, 1, raw)
                        return
            except Exception as e:
                logger.warning("[hook_engine] DLQ 移除 Redis 失败: %s", e)
        # 内存降级
        if hook_id in self._dlq:
            self._dlq[hook_id] = [e for e in self._dlq[hook_id] if e["id"] != entry_id]

    async def clear_dlq(self, hook_id: str) -> int:
        """清空指定 Hook 的 DLQ,返回清除条数。"""
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                key = f"{REDIS_DLQ_KEY_PREFIX}{hook_id}"
                count = await redis.llen(key)
                await redis.delete(key)
                return count
            except Exception as e:
                logger.warning("[hook_engine] DLQ 清空 Redis 失败: %s", e)
        count = len(self._dlq.get(hook_id, []))
        self._dlq.pop(hook_id, None)
        return count

    # ---------- Webhook 重放(2026-07-22 立)----------

    async def replay_log(self, hook_id: str, log_id: str) -> dict[str, Any] | None:
        """重放指定日志记录:从日志读取 input_payload,重新执行。"""
        hook = self._hooks.get(hook_id)
        if hook is None:
            return None
        log = next(
            (l for l in self._logs if l["id"] == log_id and l["hookId"] == hook_id),
            None,
        )
        if log is None:
            return None
        payload = log.get("inputPayload") or {}
        event = log.get("event", "replay")
        new_log = await self._execute_hook(hook, event, payload, replay=True)
        self._append_log(new_log)
        return new_log

    async def replay_all(
        self, hook_id: str, since: str | None = None, until: str | None = None
    ) -> list[dict[str, Any]]:
        """批量重放时间范围内的所有触发(since/until 为 ISO 字符串,含)。"""
        hook = self._hooks.get(hook_id)
        if hook is None:
            return []
        logs = [l for l in self._logs if l["hookId"] == hook_id]
        if since:
            logs = [l for l in logs if l.get("triggeredAt", "") >= since]
        if until:
            logs = [l for l in logs if l.get("triggeredAt", "") <= until]
        results: list[dict[str, Any]] = []
        for log in logs:
            payload = log.get("inputPayload") or {}
            event = log.get("event", "replay")
            new_log = await self._execute_hook(hook, event, payload, replay=True)
            self._append_log(new_log)
            results.append(new_log)
        return results

    # ---------- 健康检查(2026-07-22 立)----------

    def health_check(self, hook_id: str | None = None) -> dict[str, Any]:
        """所有 Hook 健康检查(可选按 hook_id 过滤)。

        Returns:
            {summary: {total, healthy, degraded, unhealthy, stale}, hooks: [...]}
        """
        hooks = list(self._hooks.values())
        if hook_id:
            hooks = [h for h in hooks if h["id"] == hook_id]
        results = [self._check_one_health(h) for h in hooks]
        summary = {
            "total": len(results),
            "healthy": sum(1 for r in results if r["status"] == "healthy"),
            "degraded": sum(1 for r in results if r["status"] == "degraded"),
            "unhealthy": sum(1 for r in results if r["status"] == "unhealthy"),
            "stale": sum(1 for r in results if r["status"] == "stale"),
        }
        return {"summary": summary, "hooks": results}

    def _check_one_health(self, hook: dict[str, Any]) -> dict[str, Any]:
        """单个 Hook 健康检查:24h 成功率 + 平均耗时 + 最后触发 + stale 判定。"""
        now = datetime.utcnow()
        window_start = now.timestamp() - HEALTH_WINDOW_HOURS * 3600
        stale_threshold = now.timestamp() - HEALTH_STALE_DAYS * 86400

        all_logs = [l for l in self._logs if l["hookId"] == hook["id"]]
        # 24h 内日志
        recent: list[dict[str, Any]] = []
        for l in all_logs:
            try:
                ts = datetime.fromisoformat(l["triggeredAt"].rstrip("Z")).timestamp()
                if ts >= window_start:
                    recent.append(l)
            except Exception:
                continue

        total = len(recent)
        success_count = sum(1 for l in recent if l.get("success"))
        success_rate = round(success_count / total, 4) if total > 0 else 0.0
        avg_duration = (
            round(sum(l.get("duration", 0) for l in recent) / total, 2) if total > 0 else 0
        )

        # 最后触发时间 + stale 判定
        last_triggered = max((l["triggeredAt"] for l in all_logs), default=None)
        is_stale = False
        if last_triggered:
            try:
                last_ts = datetime.fromisoformat(last_triggered.rstrip("Z")).timestamp()
                if last_ts < stale_threshold:
                    is_stale = True
            except Exception:
                pass
        elif not all_logs:
            is_stale = True  # 从未触发 → stale

        # 健康分级
        if is_stale:
            status = "stale"
        elif total == 0:
            status = "healthy"  # 24h 内无触发但 30d 内有 → 视为 healthy(空闲)
        elif success_rate >= HEALTHY_THRESHOLD:
            status = "healthy"
        elif success_rate >= DEGRADED_THRESHOLD:
            status = "degraded"
        else:
            status = "unhealthy"

        return {
            "hookId": hook["id"],
            "name": hook["name"],
            "status": status,
            "successRate": success_rate,
            "avgDuration": avg_duration,
            "totalRuns": total,
            "lastTriggeredAt": last_triggered,
            "isStale": is_stale,
        }

    # ==================================================================
    # P3 Hook 超越创新:Hook 智能编排(LLM 自动生成 DAG)(2026-07-23 立)
    # ==================================================================

    async def auto_orchestrate(
        self, intent: str, events: list[str] | None = None
    ) -> dict[str, Any]:
        """LLM 根据自然语言意图自动生成 Hook DAG(2026-07-23 立,P3 超越创新)。

        把"配置 Hook"变成"描述意图":用户描述目标,LLM 解析意图生成 DAG 节点 + 依赖关系,
        返回 DAG + 每个节点的 Hook 配置草稿。用户确认后批量创建。

        Args:
            intent: 自然语言意图,如 "当 PR 合并时,跑测试→发飞书→归档文档→更新 README"
            events: 可用事件列表(默认 ORCHESTRATABLE_EVENTS)

        Returns:
            {nodes: [...], edges: [...], hookDrafts: [...], intent, llm_used: bool}
            LLM 不可用时降级返回 {error: "llm_unavailable"}(由调用方映射 503)
        """
        available_events = events or list(ORCHESTRATABLE_EVENTS)
        # 系统 prompt:Hook 编排专家
        system_prompt = (
            "你是 Hook 编排专家,根据用户意图生成 DAG。"
            f"可用 action: {', '.join(HOOK_ACTION_TYPES)}。"
            f"可用事件: {', '.join(available_events)}。"
            "每个节点必须有 id/action/depends_on 字段。"
            "输出严格 JSON,不要 markdown 代码块。"
        )
        user_prompt = (
            f"意图:{intent}\n\n"
            "输出 JSON 格式:\n"
            "{\n"
            '  "nodes": [\n'
            '    {"id": "step1", "action": "script", "event": "tool.after", '
            '"name": "步骤描述", "config": {"command": "..."}, "depends_on": []},\n'
            '    {"id": "step2", "action": "webhook", "event": "tool.after", '
            '"name": "步骤描述", "config": {"url": "..."}, "depends_on": ["step1"]}\n'
            "  ],\n"
            '  "edges": [{"source": "step1", "target": "step2"}]\n'
            "}\n"
            "约束:id 唯一;depends_on 引用已定义 id;action 必须是合法类型。"
        )

        try:
            from ..core.llm_gateway import llm_gateway
        except ImportError as e:
            logger.warning("[hook_engine] llm_gateway 不可用: %s", e)
            return {"error": "llm_unavailable", "intent": intent}

        try:
            result = await llm_gateway.complete(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
        except Exception as e:
            logger.warning("[hook_engine] auto_orchestrate LLM 调用失败: %s", e)
            return {"error": "llm_unavailable", "intent": intent, "detail": str(e)}

        content = str(result.get("content", "") or "")
        if not content or result.get("error"):
            return {"error": "llm_unavailable", "intent": intent, "detail": "LLM 返回空或错误"}

        # 解析 LLM 输出的 JSON
        dag = self._extract_dag_json(content)
        if dag is None:
            return {"error": "llm_parse_failed", "intent": intent, "raw": content[:500]}

        # 为每个节点生成 Hook 配置草稿
        nodes = dag.get("nodes", [])
        edges = dag.get("edges", [])
        hook_drafts = [self._node_to_hook_draft(node) for node in nodes]

        return {
            "intent": intent,
            "nodes": nodes,
            "edges": edges,
            "hookDrafts": hook_drafts,
            "llm_used": True,
            "llm_stub": bool(result.get("stub")),
        }

    def _extract_dag_json(self, text: str) -> dict[str, Any] | None:
        """从 LLM 输出中提取 DAG JSON(兼容 markdown 代码块)。"""
        cleaned = text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines)
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            data = json.loads(cleaned[start : end + 1])
            if not isinstance(data, dict) or "nodes" not in data:
                return None
            return data
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning("[hook_engine] DAG JSON 解析失败: %s", e)
            return None

    def _node_to_hook_draft(self, node: dict[str, Any]) -> dict[str, Any]:
        """把 LLM 生成的 DAG 节点转为 Hook 配置草稿(供 batch-create)。"""
        return {
            "name": str(node.get("name", node.get("id", "未命名"))),
            "description": f"由 auto-orchestrate 生成,意图节点 {node.get('id')}",
            "event": str(node.get("event", "tool.after")),
            "condition": None,
            "action": {
                "type": str(node.get("action", "log")),
                "config": node.get("config", {}) or {},
            },
            "enabled": True,
            "depends_on": list(node.get("depends_on", []) or []),
        }

    # ==================================================================
    # P3 Hook 超越创新:A/B 测试(2026-07-23 立)
    # ==================================================================

    def _find_active_ab_test(self, event: str) -> AbTestConfig | None:
        """查找该事件下活跃的 A/B 测试(优先最早创建的)。"""
        for test in self._ab_tests.values():
            if test.event == event and test.status == "running":
                return test
        return None

    def _select_ab_variant(self, ab_test: AbTestConfig) -> str | None:
        """按 traffic_split 随机选择一个变体(2026-07-23 立)。

        使用 random.random() < threshold 累积分配,确保流量比例准确。
        traffic_split 异常(长度不等 / 和不为 1)时返回 None 触发降级。
        """
        if not ab_test.variants or not ab_test.traffic_split:
            return None
        if len(ab_test.variants) != len(ab_test.traffic_split):
            return None
        total = sum(ab_test.traffic_split)
        if total <= 0:
            return None
        # 累积分布选择
        r = random.random() * total  # 归一化(允许和略偏离 1)
        cumulative = 0.0
        for variant, split in zip(ab_test.variants, ab_test.traffic_split):
            cumulative += split
            if r < cumulative:
                return variant
        return ab_test.variants[-1]  # 兜底返回最后一个

    def _record_ab_test_result(
        self, test_id: str, variant_id: str, log_entry: dict[str, Any]
    ) -> None:
        """记录 A/B 测试变体执行结果(供 stop 时计算指标)。"""
        if test_id not in self._ab_test_results:
            self._ab_test_results[test_id] = {}
        if variant_id not in self._ab_test_results[test_id]:
            self._ab_test_results[test_id][variant_id] = []
        self._ab_test_results[test_id][variant_id].append(log_entry)

    def create_ab_test(self, payload: dict[str, Any]) -> AbTestConfig:
        """创建 A/B 测试(2026-07-23 立)。

        Args:
            payload: {event, variants: [hook_id...], traffic_split: [0.5, 0.5],
                      metrics?, description?}
        """
        test_id = f"{AB_TEST_ID_PREFIX}{uuid.uuid4().hex[:12]}"
        ab_test = AbTestConfig(
            id=test_id,
            event=str(payload["event"]),
            variants=list(payload["variants"]),
            traffic_split=[float(x) for x in payload["traffic_split"]],
            metrics=list(payload.get("metrics") or AB_TEST_DEFAULT_METRICS),
            description=payload.get("description"),
        )
        self._ab_tests[test_id] = ab_test
        self._ab_test_results[test_id] = {}
        logger.info(
            "[hook_engine] 创建 A/B 测试: id=%s event=%s variants=%d",
            test_id, ab_test.event, len(ab_test.variants),
        )
        return ab_test

    def get_ab_test(self, test_id: str) -> AbTestConfig | None:
        """获取 A/B 测试配置 + 各变体指标(2026-07-23 立)。"""
        return self._ab_tests.get(test_id)

    def get_ab_test_results(self, test_id: str) -> dict[str, Any] | None:
        """获取 A/B 测试结果(各变体指标对比 + 最优变体推荐,2026-07-23 立)。"""
        ab_test = self._ab_tests.get(test_id)
        if ab_test is None:
            return None
        results = self._ab_test_results.get(test_id, {})
        variant_metrics: list[dict[str, Any]] = []
        for variant_id in ab_test.variants:
            logs = results.get(variant_id, [])
            metrics = self._compute_variant_metrics(logs)
            metrics["variantId"] = variant_id
            variant_metrics.append(metrics)
        # 计算最优变体(综合得分:success_rate 高 + duration 低 + token_cost 低)
        winner = self._recommend_winner(variant_metrics, ab_test.metrics)
        return {
            **ab_test.to_dict(),
            "variantMetrics": variant_metrics,
            "recommendedWinner": winner,
        }

    def _compute_variant_metrics(self, logs: list[dict[str, Any]]) -> dict[str, Any]:
        """计算单个变体的指标(duration / success_rate / token_cost / total_runs)。"""
        total = len(logs)
        if total == 0:
            return {
                "totalRuns": 0, "avgDuration": 0,
                "successRate": 0.0, "avgTokenCost": 0,
            }
        success_count = sum(1 for l in logs if l.get("success"))
        total_duration = sum(l.get("duration", 0) for l in logs)
        return {
            "totalRuns": total,
            "avgDuration": round(total_duration / total, 2),
            "successRate": round(success_count / total, 4),
            "avgTokenCost": 0,  # token_cost 暂无来源(留接口供未来扩展)
        }

    def _recommend_winner(
        self, variant_metrics: list[dict[str, Any]], metrics: list[str]
    ) -> str | None:
        """基于综合得分推荐最优变体(2026-07-23 立)。

        评分规则:success_rate 越高越好 + duration 越低越好。
        无样本时返回 None。
        """
        scored: list[tuple[float, str]] = []
        for m in variant_metrics:
            if m.get("totalRuns", 0) == 0:
                continue
            # 综合得分:success_rate 占 70%,duration 越低分越高占 30%
            sr = float(m.get("successRate", 0))
            dur = float(m.get("avgDuration", 0))
            duration_score = 1.0 / (1.0 + dur / 1000.0)  # 1s 时 0.5 分
            score = sr * 0.7 + duration_score * 0.3
            scored.append((score, m["variantId"]))
        if not scored:
            return None
        scored.sort(reverse=True)
        return scored[0][1]

    def list_ab_tests(self, status: str | None = None) -> list[dict[str, Any]]:
        """列出所有 A/B 测试(可选按 status 过滤)。"""
        tests = list(self._ab_tests.values())
        if status:
            tests = [t for t in tests if t.status == status]
        tests.sort(key=lambda t: t.created_at, reverse=True)
        return [t.to_dict() for t in tests]

    def stop_ab_test(self, test_id: str) -> dict[str, Any] | None:
        """停止 A/B 测试 + 选出最优变体(2026-07-23 立)。

        Returns:
            {test: AbTestConfig.to_dict(), results: {...}, winner: str | None}
            test_id 不存在时返回 None。
        """
        ab_test = self._ab_tests.get(test_id)
        if ab_test is None:
            return None
        ab_test.status = "stopped"
        ab_test.stopped_at = datetime.utcnow()
        # 计算结果 + 推荐 winner
        results = self.get_ab_test_results(test_id)
        winner = results.get("recommendedWinner") if results else None
        ab_test.winner = winner
        return {
            "test": ab_test.to_dict(),
            "results": results,
            "winner": winner,
        }

    # ==================================================================
    # P3 Hook 超越创新:执行事件发布 + 可视化数据(2026-07-23 立)
    # ==================================================================

    def _publish_execution_event(
        self, hook_id: str, event: str, phase: str,
        duration_ms: int | None = None,
        success: bool | None = None,
        error: str | None = None,
        log_id: str | None = None,
    ) -> None:
        """发布 Hook 执行事件(2026-07-23 立)。

        - 记录到 _execution_events 时间线(供 Gantt / execution-timeline 查询)
        - 推送给所有订阅者(供 WebSocket execution-stream 实时推送)
        """
        evt = ExecutionEvent(
            hook_id=hook_id,
            event=event,
            phase=phase,
            timestamp=time.time() * 1000,  # ms epoch
            duration_ms=duration_ms,
            success=success,
            error=error,
            log_id=log_id,
        )
        # 追加到时间线(LRU)
        if hook_id not in self._execution_events:
            self._execution_events[hook_id] = deque(maxlen=EXECUTION_TIMELINE_MAX_EVENTS)
        self._execution_events[hook_id].append(evt)
        # 推送给订阅者(WebSocket 用)
        for callback in self._execution_subscribers:
            try:
                callback(evt)
            except Exception as e:
                logger.warning("[hook_engine] 执行事件订阅者回调失败: %s", e)

    def _set_realtime_status(self, hook_id: str, status: str) -> None:
        """更新 Hook 实时执行状态(running / queued / idle)。"""
        if status == "idle":
            self._realtime_status.pop(hook_id, None)
        else:
            self._realtime_status[hook_id] = {
                "status": status,
                "startedAt": time.time() * 1000,
            }

    def subscribe_execution_events(
        self, callback: Callable[[ExecutionEvent], None]
    ) -> Callable[[], None]:
        """订阅 Hook 执行事件(WebSocket 用,2026-07-23 立)。

        Returns:
            取消订阅函数(调用后移除该订阅者)。
        """
        self._execution_subscribers.append(callback)

        def unsubscribe() -> None:
            try:
                self._execution_subscribers.remove(callback)
            except ValueError:
                pass

        return unsubscribe

    def get_execution_timeline(self, hook_id: str) -> dict[str, Any]:
        """获取指定 Hook 的执行时间线(2026-07-23 立,P3 超越创新)。

        返回 Gantt 数据 + 依赖图 + 实时执行状态,供前端渲染 Gantt 图 + 实时执行流。
        """
        hook = self._hooks.get(hook_id)
        events = list(self._execution_events.get(hook_id, []))
        # Gantt 数据:每个 start/end 对组成一条 Gantt 条目
        gantt: list[dict[str, Any]] = []
        pending_start: dict[str, float] = {}
        for evt in events:
            key = evt.log_id or f"{evt.timestamp}"
            if evt.phase == "start":
                pending_start[key] = evt.timestamp
            elif evt.phase in ("end", "error") and key in pending_start:
                gantt.append({
                    "hookId": evt.hook_id,
                    "start": pending_start[key],
                    "end": evt.timestamp,
                    "status": "success" if evt.phase == "end" else "error",
                    "duration": evt.duration_ms,
                    "logId": evt.log_id,
                })
                del pending_start[key]
        # 依赖图:基于 hook.depends_on 构建
        dep_nodes: list[dict[str, Any]] = []
        dep_edges: list[dict[str, Any]] = []
        if hook is not None:
            depends_on = hook.get("depends_on") or []
            dep_nodes.append({"id": hook_id, "name": hook.get("name", hook_id)})
            for dep_id in depends_on:
                dep_hook = self._hooks.get(dep_id)
                dep_nodes.append({
                    "id": dep_id,
                    "name": dep_hook.get("name", dep_id) if dep_hook else dep_id,
                })
                dep_edges.append({"source": dep_id, "target": hook_id})
            # 反向:其他 hook 依赖本 hook 的
            for other in self._hooks.values():
                if other["id"] == hook_id:
                    continue
                if hook_id in (other.get("depends_on") or []):
                    dep_nodes.append({
                        "id": other["id"],
                        "name": other.get("name", other["id"]),
                    })
                    dep_edges.append({"source": hook_id, "target": other["id"]})
        # 实时状态
        currently_running = [
            {"hookId": hid, "startedAt": info["startedAt"]}
            for hid, info in self._realtime_status.items()
            if info["status"] == "running"
        ]
        return {
            "hookId": hook_id,
            "gantt": gantt,
            "dependencyGraph": {"nodes": dep_nodes, "edges": dep_edges},
            "realtimeStatus": {
                "currentlyRunning": currently_running,
                "queued": [],  # 当前未实现队列(预留接口)
            },
            "totalEvents": len(events),
        }

    # ==================================================================
    # P3 Hook 超越创新:Hook 模板库(2026-07-23 立)
    # ==================================================================

    def _init_templates(self) -> list[HookTemplate]:
        """初始化预置 Hook 模板库(惰性,首次调用时填充)。"""
        if self._templates is not None:
            return self._templates
        self._templates = [
            HookTemplate(
                id=f"{TEMPLATE_ID_PREFIX}commit-notify",
                name="代码提交通知",
                description="代码提交时通过 webhook 通知团队",
                event="tool.after",
                action={
                    "type": "webhook",
                    "config": {
                        "url": "https://hooks.example.com/commit",
                        "method": "POST",
                        "body": '{"event": "commit", "tool": "{{tool}}", "args": {{args}}}',
                    },
                },
                tags=["code", "notify", "webhook"],
            ),
            HookTemplate(
                id=f"{TEMPLATE_ID_PREFIX}test-fail-alert",
                name="测试失败告警",
                description="测试失败时发送通知 + 执行诊断脚本",
                event="error",
                action={
                    "type": "notify",
                    "config": {
                        "channel": "toast",
                        "message": "测试失败:{{error}}",
                    },
                },
                tags=["test", "alert", "notify"],
            ),
            HookTemplate(
                id=f"{TEMPLATE_ID_PREFIX}doc-sync",
                name="文档自动同步",
                description="规格变更后自动重新生成文档",
                event="tool.after",
                action={
                    "type": "script",
                    "config": {"command": "pnpm run docs:gen"},
                },
                tags=["docs", "sync", "script"],
            ),
            HookTemplate(
                id=f"{TEMPLATE_ID_PREFIX}perf-regression",
                name="性能回归检测",
                description="基准测试完成后对比性能 + 失败告警",
                event="tool.after",
                action={
                    "type": "script",
                    "config": {"command": "pnpm run bench:compare"},
                },
                tags=["perf", "regression", "script"],
            ),
            HookTemplate(
                id=f"{TEMPLATE_ID_PREFIX}security-scan",
                name="安全扫描",
                description="代码提交后执行安全扫描 + 漏洞通知",
                event="tool.after",
                action={
                    "type": "script",
                    "config": {"command": "pnpm run security:scan"},
                },
                tags=["security", "scan", "script"],
            ),
        ]
        return self._templates

    def list_templates(self, tag: str | None = None) -> list[dict[str, Any]]:
        """列出所有 Hook 模板(可选按 tag 过滤,2026-07-23 立)。"""
        templates = self._init_templates()
        if tag:
            templates = [t for t in templates if tag in t.tags]
        return [t.to_dict() for t in templates]

    def get_template(self, template_id: str) -> HookTemplate | None:
        """获取指定模板。"""
        for t in self._init_templates():
            if t.id == template_id:
                return t
        return None

    def instantiate_template(
        self, template_id: str, overrides: dict[str, Any] | None = None
    ) -> dict[str, Any] | None:
        """从模板创建 Hook(可覆盖配置,2026-07-23 立)。

        Args:
            template_id: 模板 ID
            overrides: 覆盖字段 {name?, event?, condition?, action?, enabled?}

        Returns:
            创建的 Hook dict,template_id 不存在时返回 None。
        """
        template = self.get_template(template_id)
        if template is None:
            return None
        overrides = overrides or {}
        # 合并模板 + 覆盖
        action = overrides.get("action") or template.action
        payload = {
            "name": overrides.get("name", template.name),
            "description": overrides.get("description", template.description),
            "event": overrides.get("event", template.event),
            "condition": overrides.get("condition", template.condition),
            "action": action,
            "enabled": overrides.get("enabled", True),
        }
        return self.create_hook(payload)

    # ==================================================================
    # P3 Hook 超越创新:Hook 健康预测(LLM 趋势分析,2026-07-23 立)
    # ==================================================================

    async def health_forecast(self, hook_id: str) -> dict[str, Any] | None:
        """基于历史数据预测 Hook 健康趋势(2026-07-23 立,P3 超越创新)。

        基于最近 30 天的执行数据,LLM 分析趋势:
        - 成功率下降趋势
        - 耗时上升趋势
        - 即将 stale

        Returns:
            {hookId, forecast, trend, recommendation, samples, llm_used}
            hook_id 不存在时返回 None。LLM 不可用时降级为规则预测。
        """
        hook = self._hooks.get(hook_id)
        if hook is None:
            return None

        # 收集最近 30 天日志
        now = datetime.utcnow()
        window_start = now - timedelta(days=HEALTH_FORECAST_WINDOW_DAYS)
        window_start_ts = window_start.timestamp()
        all_logs = [l for l in self._logs if l["hookId"] == hook_id]
        recent: list[dict[str, Any]] = []
        for l in all_logs:
            try:
                ts = datetime.fromisoformat(l["triggeredAt"].rstrip("Z")).timestamp()
                if ts >= window_start_ts:
                    recent.append(l)
            except Exception:
                continue

        # 规则预测(基础,LLM 不可用时降级用)
        rule_forecast = self._rule_based_forecast(hook, recent)

        # LLM 增强预测(可选)
        llm_used = False
        forecast_text = rule_forecast["forecast"]
        recommendation = rule_forecast["recommendation"]
        trend = rule_forecast["trend"]

        if len(recent) >= HEALTH_FORECAST_MIN_SAMPLES:
            try:
                from ..core.llm_gateway import llm_gateway
                llm_result = await self._llm_health_forecast(hook, recent, llm_gateway)
                if llm_result is not None:
                    forecast_text = llm_result["forecast"]
                    recommendation = llm_result["recommendation"]
                    trend = llm_result["trend"]
                    llm_used = True
            except Exception as e:
                logger.warning("[hook_engine] health_forecast LLM 降级: %s", e)

        return {
            "hookId": hook_id,
            "forecast": forecast_text,
            "trend": trend,
            "recommendation": recommendation,
            "samples": len(recent),
            "windowDays": HEALTH_FORECAST_WINDOW_DAYS,
            "llm_used": llm_used,
        }

    def _rule_based_forecast(
        self, hook: dict[str, Any], logs: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """规则驱动的健康预测(LLM 不可用时的降级方案)。

        分析维度:
          - 样本数 < 阈值 → "数据不足"
          - 成功率持续下降 → "成功率下降趋势"
          - 耗时持续上升 → "耗时上升趋势"
          - 长时间未触发 → "即将 stale"
        """
        total = len(logs)
        if total < HEALTH_FORECAST_MIN_SAMPLES:
            return {
                "forecast": f"样本数不足({total}/{HEALTH_FORECAST_MIN_SAMPLES}),无法预测趋势",
                "trend": "insufficient_data",
                "recommendation": "继续观察",
            }

        success_rate = sum(1 for l in logs if l.get("success")) / total
        avg_duration = sum(l.get("duration", 0) for l in logs) / total

        # 比较前后两半
        mid = total // 2
        first_half = logs[:mid] if mid > 0 else logs
        second_half = logs[mid:] or logs
        first_sr = sum(1 for l in first_half if l.get("success")) / max(len(first_half), 1)
        second_sr = sum(1 for l in second_half if l.get("success")) / max(len(second_half), 1)
        first_dur = sum(l.get("duration", 0) for l in first_half) / max(len(first_half), 1)
        second_dur = sum(l.get("duration", 0) for l in second_half) / max(len(second_half), 1)

        trends: list[str] = []
        if second_sr < first_sr - 0.05:
            trends.append("成功率下降趋势")
        if second_dur > first_dur * 1.2:
            trends.append("耗时上升趋势")
        if success_rate < DEGRADED_THRESHOLD:
            trends.append("成功率偏低")
        if not trends:
            trends.append("稳定")

        # recommendation:成功率 < 0.5 建议禁用,< 0.8 或耗时上升 → 需要优化,其余继续观察
        if success_rate < 0.5:
            recommendation = "建议禁用"
        elif success_rate < DEGRADED_THRESHOLD or "耗时上升趋势" in trends:
            recommendation = "需要优化"
        else:
            recommendation = "继续观察"

        forecast = (
            f"最近 {total} 次执行,成功率 {success_rate:.2%},"
            f"平均耗时 {avg_duration:.0f}ms。趋势:{', '.join(trends)}。"
        )
        return {
            "forecast": forecast,
            "trend": trends[0] if len(trends) == 1 else "|".join(trends),
            "recommendation": recommendation,
        }

    async def _llm_health_forecast(
        self, hook: dict[str, Any], logs: list[dict[str, Any]],
        llm_gateway: Any,
    ) -> dict[str, Any] | None:
        """LLM 驱动的健康预测(基于历史数据趋势分析)。"""
        # 压缩日志样本(避免超长 prompt)
        sample_size = min(20, len(logs))
        samples = [
            {
                "success": l.get("success"),
                "duration": l.get("duration", 0),
                "triggeredAt": l.get("triggeredAt"),
                "error": (l.get("error") or "")[:100],
            }
            for l in logs[-sample_size:]
        ]
        success_rate = sum(1 for l in logs if l.get("success")) / len(logs)
        avg_duration = sum(l.get("duration", 0) for l in logs) / len(logs)

        prompt = (
            f"你是 Hook 健康预测专家。分析以下 Hook 的最近 {len(logs)} 次执行数据,预测健康趋势。\n\n"
            f"Hook 名称:{hook.get('name')}\n"
            f"事件:{hook.get('event')}\n"
            f"成功率:{success_rate:.2%}\n"
            f"平均耗时:{avg_duration:.0f}ms\n"
            f"最近 {sample_size} 条样本(时间倒序):{json.dumps(samples, ensure_ascii=False)}\n\n"
            "输出严格 JSON(不要 markdown 代码块):\n"
            '{"forecast": "趋势描述(如:成功率下降趋势 / 耗时上升趋势 / 稳定)",'
            '"trend": "success_declining|duration_rising|stable|stale",'
            '"recommendation": "继续观察|需要优化|建议禁用"}'
        )

        result = await llm_gateway.complete([{"role": "user", "content": prompt}])
        content = str(result.get("content", "") or "")
        if not content or result.get("error"):
            return None
        # 提取 JSON
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            data = json.loads(content[start : end + 1])
            return {
                "forecast": str(data.get("forecast", "")),
                "trend": str(data.get("trend", "stable")),
                "recommendation": str(data.get("recommendation", "继续观察")),
            }
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning("[hook_engine] health_forecast JSON 解析失败: %s", e)
            return None


# 全局单例
hook_engine = HookEngine()
