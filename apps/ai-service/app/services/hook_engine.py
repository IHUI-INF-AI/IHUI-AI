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
import re
import shlex
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

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
REDIS_DLQ_KEY_PREFIX = "hooks:dlq:"  # + hook_id
DLQ_MAX_ENTRIES = 100  # 每个 hook 的 DLQ 保留最近 100 条

# 通知渠道(2026-07-22 扩展,toast/email/webhook + notification 兼容)
NOTIFY_CHANNELS: tuple[str, ...] = ("toast", "email", "webhook", "notification")

# 健康检查阈值(2026-07-22 立)
HEALTH_WINDOW_HOURS = 24  # 健康检查时间窗口(24h)
HEALTH_STALE_DAYS = 30  # 超过 30 天未触发 → stale
HEALTHY_THRESHOLD = 0.95  # 24h 成功率 ≥ 95% → healthy
DEGRADED_THRESHOLD = 0.80  # 24h 成功率 ≥ 80% → degraded,否则 unhealthy

# 沙箱目录(AGENTS.md §15 工作区卫生规则的临时目录 .trae-cn/tmp/hooks/)
_PROJECT_ROOT = Path(__file__).resolve().parents[4]
SANDBOX_DIR = _PROJECT_ROOT / ".trae-cn" / "tmp" / "hooks"
LOG_FILE = _PROJECT_ROOT / "logs" / "hooks.log"

# 敏感路径正则(script 命令禁止包含以下模式)
# 注意:/ 和 . 不是 word 字符,\b 在它们前后不生效,改用 (?<!\w) 负向后顾
SENSITIVE_PATTERNS = [
    r"/etc/passwd",
    r"/etc/shadow",
    r"\.ssh",
    r"\.env\b",
    r"\bcredentials\b",
    r"\bAPI_KEY\b",
    r"\bSECRET\b",
    r"rm\s+-rf\s+/",
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
        # DLQ 死信队列(内存降级):{hook_id: [entry, ...]}
        self._dlq: dict[str, list[dict[str, Any]]] = {}
        # Redis 客户端(可选,降级内存)
        self._redis: Any = redis_client
        self._use_redis = redis_client is not None
        # 是否已从 Redis 加载配置(惰性,首次 emit 时触发)
        self._loaded = False

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
        for hook in candidates:
            try:
                matched = evaluate_condition(hook.get("condition"), context)
                if not matched:
                    continue
                log = await self._execute_hook(hook, event, context)
                triggered_logs.append(log)
                self._append_log(log)
            except Exception as e:
                logger.exception("[hook_engine] Hook 执行异常: hook_id=%s err=%s", hook["id"], e)
                err_log = self._make_log(
                    hook["id"], event, success=False, duration=0, error=str(e)
                )
                triggered_logs.append(err_log)
                self._append_log(err_log)
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
        """
        action = hook.get("action", {})
        action_type = action.get("type")
        config = action.get("config", {}) or {}
        start = time.time()

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


# 全局单例
hook_engine = HookEngine()
