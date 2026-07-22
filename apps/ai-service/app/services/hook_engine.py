"""Hook 引擎 — 事件总线 + 触发器匹配 + 执行器 + 日志记录(2026-07-22 立)。

对标 Trae IDE Hooks:agent 行为事件触发 → 执行自定义脚本/动作。

核心组件:
  - HookEngine:内存存储 Hook 配置(单例,LRU 日志最近 1000 条)
  - emit(event, context):事件总线入口,agent_loop 在 tool.before/after 等位置调用
  - 条件匹配:JSONLogic 简化实现(== / contains / and / or / not 五种操作符)
  - 执行器:
    - webhook: httpx 异步发请求,超时 5s
    - script: asyncio.create_subprocess_exec,超时 10s,stdout/stderr 截断 1KB
    - log: 写到 logs/hooks.log
    - notify: 仅记录日志(若 notification_service 存在可扩展)

设计:
  - 配置与日志均存内存(进程重启丢失),后续可扩展 Redis 持久化
  - 所有动作异步执行,emit 不阻塞调用方(失败仅记录日志)
  - script 在 .trae-cn/tmp/hooks/ 沙箱内执行,禁止访问敏感路径
"""

from __future__ import annotations

import asyncio
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

    单例模式(hook_engine),进程内存存储。日志 LRU 保留最近 1000 条。
    """

    def __init__(self) -> None:
        # Hook 配置:hook_id → hook_dict
        self._hooks: dict[str, dict[str, Any]] = {}
        # 日志:list(LRU,超出 MAX_LOGS 删最旧)
        self._logs: list[dict[str, Any]] = []

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
        return hook

    def update_hook(self, hook_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        hook = self._hooks.get(hook_id)
        if hook is None:
            return None
        for k in ("name", "description", "event", "condition", "action", "enabled"):
            if k in patch:
                hook[k] = patch[k]
        hook["updatedAt"] = datetime.utcnow().isoformat() + "Z"
        return hook

    def delete_hook(self, hook_id: str) -> bool:
        return self._hooks.pop(hook_id, None) is not None

    def toggle_hook(self, hook_id: str, enabled: bool) -> dict[str, Any] | None:
        hook = self._hooks.get(hook_id)
        if hook is None:
            return None
        hook["enabled"] = enabled
        hook["updatedAt"] = datetime.utcnow().isoformat() + "Z"
        return hook

    # ---------- 日志 ----------

    def list_logs(self, hook_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        """列出日志(可选按 hook_id 过滤,默认最近 100 条)。"""
        logs = self._logs
        if hook_id:
            logs = [l for l in logs if l["hookId"] == hook_id]
        # 倒序(最新在前)
        sorted_logs = sorted(logs, key=lambda l: l["triggeredAt"], reverse=True)
        return sorted_logs[: max(1, min(limit, MAX_LOGS))]

    def _append_log(self, log_entry: dict[str, Any]) -> None:
        self._logs.append(log_entry)
        # LRU:超出上限删最旧
        if len(self._logs) > MAX_LOGS:
            self._logs = self._logs[-MAX_LOGS:]

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
        self, hook: dict[str, Any], event: str, context: dict[str, Any]
    ) -> dict[str, Any]:
        """执行单个 Hook(已通过条件匹配),返回日志条目。"""
        action = hook.get("action", {})
        action_type = action.get("type")
        config = action.get("config", {}) or {}
        start = time.time()
        success = False
        result_str: str | None = None
        err_str: str | None = None
        try:
            if action_type == "webhook":
                result_str, err_str = await self._run_webhook(config, event, context)
                success = err_str is None
            elif action_type == "script":
                result_str, err_str = await self._run_script(config, event, context)
                success = err_str is None
            elif action_type == "log":
                result_str, err_str = self._run_log(config, event, context)
                success = err_str is None
            elif action_type == "notify":
                result_str, err_str = self._run_notify(config, event, context)
                success = err_str is None
            else:
                err_str = f"未知动作类型: {action_type}"
        except Exception as e:
            err_str = str(e)
        duration_ms = int((time.time() - start) * 1000)
        return self._make_log(
            hook_id=hook["id"],
            event=event,
            success=success,
            duration=duration_ms,
            result=result_str,
            error=err_str,
        )

    # ---------- 执行器 ----------

    async def _run_webhook(
        self, config: dict[str, Any], event: str, context: dict[str, Any]
    ) -> tuple[str | None, str | None]:
        url = config.get("url")
        if not url:
            return None, "webhook url 未配置"
        method = config.get("method", "POST").upper()
        headers = config.get("headers") or {"Content-Type": "application/json"}
        body_template = config.get("body")
        # 渲染 body 模板
        body_text = render_template(body_template, context) if body_template else json.dumps(
            {"event": event, "context": context}, ensure_ascii=False
        )
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

    def _run_notify(
        self, config: dict[str, Any], event: str, context: dict[str, Any]
    ) -> tuple[str | None, str | None]:
        """通知动作:当前实现仅记录到日志,后续可接入 notification_service。

        channel: toast / notification / email,均通过 logger 输出。
        若 ai-service 后续接入通知服务,可在此扩展分支调用。
        """
        channel = config.get("channel", "toast")
        message = render_template(config.get("message"), context) or f"Hook 触发: {event}"
        logger.info(
            "[hook_engine] notify: channel=%s event=%s msg=%s", channel, event, message
        )
        return f"logged notify({channel})", None

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
        }


# 全局单例
hook_engine = HookEngine()
