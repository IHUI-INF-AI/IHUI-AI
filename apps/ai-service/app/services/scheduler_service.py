# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""后台任务调度服务(自研任务调度)。

APScheduler AsyncIOScheduler 实现 cron/date/interval 三种触发器,
任务持久化到 Redis hash(TTL 30d),Redis 不可用降级内存,未配置 redis_url 时 stub。
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import signal
import subprocess
import uuid
from collections.abc import Awaitable
from datetime import UTC, datetime
from typing import Any, cast

import httpx
import redis.asyncio as aioredis
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings

logger = logging.getLogger(__name__)

_REDIS_KEY_PREFIX = "mcp:scheduled_task:"
_REDIS_LOG_PREFIX = "mcp:scheduled_task_log:"
_REDIS_TTL_SECONDS = 30 * 24 * 3600  # 30d
_LOG_KEEP = 50

_VALID_TRIGGER_TYPES = ("cron", "date", "interval")

# 回调类型白名单(BUG-1 根治 RCE):非特权回调任意登录用户可创建;
# 特权回调(shell ⇒ 进程内任意命令执行)仅限管理员通道(is_admin=True)。
# 外部导入(apply_bundle)等不可信入口不传 is_admin ⇒ shell 回调被拒,
# 杜绝"任意登录用户 → 服务进程 RCE"。
_CALLBACK_TYPE_PRIVILEGED = frozenset({"shell"})
_CALLBACK_TYPE_ALLOWED = frozenset({"http_webhook", "mcp_tool", "shell"})


def _validate_callback(callback: dict[str, Any], is_admin: bool) -> str | None:
    """校验 callback 类型合法性。返回非空错误码字符串表示拒绝;None 表示通过。"""
    if not isinstance(callback, dict):
        return "callback 必须是 dict"
    cb_type = callback.get("type")
    if cb_type not in _CALLBACK_TYPE_ALLOWED:
        allowed = sorted(_CALLBACK_TYPE_ALLOWED - _CALLBACK_TYPE_PRIVILEGED)
        return f"不支持的 callback 类型: {cb_type!r}(允许: {allowed})"
    if cb_type in _CALLBACK_TYPE_PRIVILEGED and not is_admin:
        return "shell 回调仅限管理员创建(INVALID_CALLBACK)"
    return None
# CronTrigger 原生参数(apscheduler 3.x)
_CRON_FIELDS = {
    "year", "month", "day", "week", "day_of_week", "hour", "minute", "second",
}
_INTERVAL_FIELDS = {"seconds", "minutes", "hours", "days"}


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _build_trigger(trigger_type: str, trigger_config: dict[str, Any]) -> Any:
    """根据 trigger_type 构造 APScheduler Trigger,失败抛 ValueError。"""
    if trigger_type == "cron":
        kwargs = {k: v for k, v in trigger_config.items() if k in _CRON_FIELDS}
        if not kwargs:
            raise ValueError(
                "cron trigger_config 需至少一个字段: " + ",".join(sorted(_CRON_FIELDS))
            )
        return CronTrigger(**kwargs)
    if trigger_type == "date":
        run_date = trigger_config.get("run_date")
        if not run_date:
            raise ValueError("date trigger_config 必填 run_date(ISO8601)")
        return DateTrigger(run_date=run_date)
    if trigger_type == "interval":
        kwargs = {k: v for k, v in trigger_config.items() if k in _INTERVAL_FIELDS}
        if not kwargs:
            raise ValueError(
                "interval trigger_config 需至少一个字段: " + ",".join(sorted(_INTERVAL_FIELDS))
            )
        return IntervalTrigger(**kwargs)
    raise ValueError(f"无效 trigger_type: {trigger_type}")


class TaskScheduler:
    """后台任务调度器(单例)。"""

    def __init__(self) -> None:
        self._scheduler: AsyncIOScheduler | None = None
        self._redis: aioredis.Redis | None = None
        self._memory_fallback: dict[str, dict[str, Any]] = {}
        self._memory_logs: dict[str, list[dict[str, Any]]] = {}
        self._use_memory: bool = False
        self._started: bool = False

    # ===== 生命周期 =====

    async def start(self) -> None:
        if self._started:
            return
        redis_url = getattr(settings, "redis_url", "") or ""
        if redis_url:
            try:
                self._redis = aioredis.from_url(redis_url, decode_responses=True, socket_connect_timeout=2)
                await self._redis.ping()
                logger.info("[scheduler_service] Redis connected")
            except Exception as e:
                logger.warning("[scheduler_service] Redis 不可用,降级内存: %s", e)
                self._redis = None
                self._use_memory = True
        else:
            logger.info("[scheduler_service] redis_url 未配置,stub 模式")
        self._scheduler = AsyncIOScheduler(timezone="UTC")
        try:
            self._scheduler.start()
        except Exception as e:
            # BUG-34②:启动失败绝不能静默进入"已启动"态 —— 旧代码只 warning 后仍置
            # _started=True,此后 add_task 跳过 add_job 却照写 Redis 并返 ok=True,
            # 任务"创建成功"但永不触发。这里置空 scheduler + 不置 _started,
            # 由 add_task 的 SCHEDULER_UNAVAILABLE 显式拒绝,并把日志升到 error。
            logger.error("[scheduler_service] scheduler.start 失败,拒绝进入已启动态: %s", e)
            self._scheduler = None
            self._started = False
            return
        if self._redis is not None:
            try:
                await self._load_pending_tasks()
            except Exception as e:
                logger.warning("[scheduler_service] 加载历史任务失败: %s", e)
        self._started = True

    async def shutdown(self) -> None:
        if not self._started:
            return
        if self._scheduler is not None:
            try:
                self._scheduler.shutdown(wait=True)
            except Exception as e:
                logger.warning("[scheduler_service] scheduler.shutdown 失败: %s", e)
        if self._redis is not None:
            try:
                await self._redis.aclose()
            except Exception as e:
                logger.warning("scheduler_service.close redis aclose 失败: %s", e, exc_info=True)
        self._redis = None
        self._scheduler = None
        self._started = False

    def _is_stub(self) -> bool:
        return not bool(getattr(settings, "redis_url", "") or "")

    # ===== 公开 API =====

    async def add_task(
        self,
        task_id: str | None,
        trigger_type: str,
        trigger_config: dict[str, Any],
        callback: dict[str, Any],
        conversation_id: str | None = None,
        is_admin: bool = False,
    ) -> dict[str, Any]:
        if self._is_stub():
            return {"ok": True, "task_id": "stub-" + uuid.uuid4().hex, "stub": True}
        # BUG-34②:调度器没真正起来时绝不返 ok(否则任务落库却永不触发)。
        if self._scheduler is None or not self._started:
            return {
                "ok": False,
                "errorCode": "SCHEDULER_UNAVAILABLE",
                "message": "调度器未启动,任务不会被触发",
            }
        if trigger_type not in _VALID_TRIGGER_TYPES:
            return {
                "ok": False,
                "errorCode": "INVALID_TRIGGER",
                "message": f"无效 trigger_type: {trigger_type},可选 {list(_VALID_TRIGGER_TYPES)}",
            }
        if not isinstance(callback, dict) or "type" not in callback:
            return {
                "ok": False,
                "errorCode": "INVALID_TRIGGER",
                "message": "callback 必须是含 type 的 dict",
            }
        cb_err = _validate_callback(callback, is_admin)
        if cb_err is not None:
            return {"ok": False, "errorCode": "INVALID_CALLBACK", "message": cb_err}
        try:
            trigger = _build_trigger(trigger_type, trigger_config)
        except ValueError as e:
            return {"ok": False, "errorCode": "INVALID_TRIGGER", "message": str(e)}

        tid = task_id or uuid.uuid4().hex
        task: dict[str, Any] = {
            "task_id": tid,
            "trigger_type": trigger_type,
            "trigger_config": trigger_config,
            "callback": callback,
            "conversation_id": conversation_id,
            "enabled": True,
            "created_at": _now_iso(),
            "next_run_at": "",
        }
        if self._scheduler is not None and task["enabled"]:
            try:
                self._scheduler.add_job(
                    self._job_wrapper,
                    trigger=trigger,
                    args=[tid, callback],
                    id=tid,
                    replace_existing=True,
                )
                job = self._scheduler.get_job(tid)
                nrt = getattr(job, "next_run_time", None) if job is not None else None
                if isinstance(nrt, datetime):
                    task["next_run_at"] = nrt.isoformat()
            except Exception as e:
                # BUG-34②:add_job 失败必须错误传播,不能落库后照返 ok。
                logger.error("[scheduler_service] add_job 失败(%s): %s", tid, e)
                return {
                    "ok": False,
                    "errorCode": "ADD_JOB_FAILED",
                    "message": f"调度任务注册失败: {e}",
                }
        await self._persist_task(task)
        return {"ok": True, "task_id": tid, "next_run_at": task["next_run_at"]}

    async def remove_task(self, task_id: str) -> dict[str, Any]:
        if self._is_stub():
            return {"ok": True, "stub": True}
        if self._scheduler is not None:
            try:
                self._scheduler.remove_job(task_id)
            except Exception as e:
                logger.debug("scheduler_service.remove_task 移除 job 失败(task_id=%s,可能不存在): %s", task_id, e, exc_info=True)
        if self._redis is not None:
            await self._redis.delete(_REDIS_KEY_PREFIX + task_id)
            await self._redis.delete(_REDIS_LOG_PREFIX + task_id)
        else:
            self._memory_fallback.pop(task_id, None)
            self._memory_logs.pop(task_id, None)
        return {"ok": True, "task_id": task_id}

    async def list_tasks(self, conversation_id: str | None = None) -> dict[str, Any]:
        if self._is_stub():
            return {"ok": True, "tasks": [], "stub": True}
        tasks: list[dict[str, Any]] = []
        if self._redis is not None:
            async for key in self._redis.scan_iter(match=_REDIS_KEY_PREFIX + "*"):
                raw = await cast(Awaitable[dict[str, str]], self._redis.hgetall(key))
                if raw:
                    tasks.append(self._decode_task(raw))
        else:
            tasks = list(self._memory_fallback.values())
        if conversation_id is not None:
            tasks = [t for t in tasks if t.get("conversation_id") == conversation_id]
        return {"ok": True, "tasks": tasks, "count": len(tasks)}

    async def get_task(self, task_id: str) -> dict[str, Any]:
        if self._is_stub():
            return {"ok": True, "task": None, "stub": True}
        task: dict[str, Any] | None = None
        if self._redis is not None:
            raw = await cast(Awaitable[dict[str, str]], self._redis.hgetall(_REDIS_KEY_PREFIX + task_id))
            if raw:
                task = self._decode_task(raw)
        else:
            task = self._memory_fallback.get(task_id)
        if task is None:
            return {
                "ok": False,
                "errorCode": "NOT_FOUND",
                "message": f"任务不存在: {task_id}",
            }
        return {"ok": True, "task": task}

    async def update_task(
        self,
        task_id: str,
        trigger_config: dict[str, Any] | None = None,
        callback: dict[str, Any] | None = None,
        enabled: bool | None = None,
        is_admin: bool = False,
    ) -> dict[str, Any]:
        if self._is_stub():
            return {"ok": True, "stub": True}
        current: dict[str, Any] | None = None
        if self._redis is not None:
            raw = await cast(Awaitable[dict[str, str]], self._redis.hgetall(_REDIS_KEY_PREFIX + task_id))
            if raw:
                current = self._decode_task(raw)
        else:
            current = self._memory_fallback.get(task_id)
        if current is None:
            return {
                "ok": False,
                "errorCode": "NOT_FOUND",
                "message": f"任务不存在: {task_id}",
            }
        trigger_type = current["trigger_type"]
        new_trigger_config = (
            trigger_config if trigger_config is not None else current["trigger_config"]
        )
        if callback is not None:
            cb_err = _validate_callback(callback, is_admin)
            if cb_err is not None:
                return {"ok": False, "errorCode": "INVALID_CALLBACK", "message": cb_err}
        new_callback = callback if callback is not None else current["callback"]
        new_enabled = enabled if enabled is not None else current["enabled"]
        try:
            trigger = _build_trigger(trigger_type, new_trigger_config)
        except ValueError as e:
            return {"ok": False, "errorCode": "INVALID_TRIGGER", "message": str(e)}
        current["trigger_config"] = new_trigger_config
        current["callback"] = new_callback
        current["enabled"] = new_enabled
        if self._scheduler is not None:
            try:
                self._scheduler.remove_job(task_id)
            except Exception as e:
                logger.debug("scheduler_service.update_task 移除旧 job 失败(task_id=%s): %s", task_id, e, exc_info=True)
            current["next_run_at"] = ""
            if new_enabled:
                try:
                    self._scheduler.add_job(
                        self._job_wrapper,
                        trigger=trigger,
                        args=[task_id, new_callback],
                        id=task_id,
                        replace_existing=True,
                    )
                    job = self._scheduler.get_job(task_id)
                    nrt = (
                        getattr(job, "next_run_time", None) if job is not None else None
                    )
                    if isinstance(nrt, datetime):
                        current["next_run_at"] = nrt.isoformat()
                except Exception as e:
                    logger.warning("[scheduler_service] update add_job 失败(%s): %s", task_id, e)
        await self._persist_task(current)
        return {"ok": True, "task_id": task_id, "next_run_at": current.get("next_run_at", "")}

    # ===== 回调执行 =====

    @staticmethod
    async def _kill_shell_tree(proc: Any) -> None:
        """杀掉 shell 外壳及其整棵子进程树(BUG-34③)。

        旧实现只 proc.kill() 杀 sh -c / cmd /c 外壳,子孙进程继续持有管道 ⇒
        Windows 下后续 await proc.communicate() 挂死,后台命令也继续跑。
        POSIX 用 killpg(start_new_session 后 pgid==pid),Windows 用 taskkill /F /T。
        """
        pid = proc.pid

        def _kill() -> None:
            if os.name == "nt":
                with contextlib.suppress(Exception):
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(pid)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=5,
                        check=False,
                    )
            else:
                with contextlib.suppress(ProcessLookupError, PermissionError, OSError):
                    # POSIX-only 属性在 Windows 类型桩中不存在,用 getattr 动态取(运行时行为不变)。
                    killpg = getattr(os, "killpg", None)
                    getpgid = getattr(os, "getpgid", None)
                    sigkill = getattr(signal, "SIGKILL", None)
                    if killpg is not None and getpgid is not None and sigkill is not None:
                        killpg(getpgid(pid), sigkill)

        await asyncio.to_thread(_kill)
        with contextlib.suppress(Exception):
            proc.kill()

    async def _job_wrapper(self, task_id: str, callback: dict[str, Any]) -> None:
        try:
            await self._execute_callback(callback)
        except Exception as e:
            logger.warning("[scheduler_service] 任务 %s 执行失败: %s", task_id, e)
            await self._log_failure(task_id, f"{type(e).__name__}: {e}")

    async def _execute_callback(self, callback: dict[str, Any]) -> None:
        cb_type = callback.get("type")
        if cb_type == "http_webhook":
            url = callback.get("url")
            payload = callback.get("payload", {})
            if not url:
                raise ValueError("http_webhook callback 缺少 url")
            # 2026-10-31 R12:webhook_url 由模型/用户写入,外部可控;本服务能访问内网,
            # 出站前必须过同一把 SSRF 尺并钉定公网 IP(POST 不跟随重定向,只需首跳)。
            from app.services.screenshot_service import (
                _validate_url_ssrf,
                resolve_pinned_target,
            )

            ok, reason = _validate_url_ssrf(url)
            pinned = resolve_pinned_target(url) if ok else None
            if not ok or pinned is None:
                raise ValueError(f"http_webhook 目标不允许访问: {reason or '无法钉定公网 IP'}")
            pinned_url, orig_host = pinned
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    pinned_url,
                    json=payload,
                    headers={"Host": orig_host},
                    extensions={"sni_hostname": orig_host},
                )
                resp.raise_for_status()
        elif cb_type == "mcp_tool":
            tool_name = callback.get("tool_name")
            args = callback.get("args", {})
            if not tool_name:
                raise ValueError("mcp_tool callback 缺少 tool_name")
            from app.services.mcp_server import _TOOL_HANDLERS

            handler = _TOOL_HANDLERS.get(tool_name)
            if handler is None:
                raise ValueError(f"mcp_tool 未注册: {tool_name}")
            result = handler(args)
            if asyncio.iscoroutine(result):
                await result
        elif cb_type == "shell":
            command = callback.get("command")
            if not command:
                raise ValueError("shell callback 缺少 command")
            timeout = float(callback.get("timeout", 30))
            # BUG-34③:让外壳进程独立成进程组,超时才能连子孙一起杀。
            popen_kwargs: dict[str, Any] = {}
            if os.name == "nt":
                popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
            else:
                popen_kwargs["start_new_session"] = True
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                **popen_kwargs,
            )
            try:
                _stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            except TimeoutError:
                await self._kill_shell_tree(proc)
                # 子孙进程可能仍持有 stdout/stderr 管道:旧实现无条件
                # await proc.communicate() 在 Windows 会挂到管道关闭 ⇒ 短超时兜底。
                with contextlib.suppress(Exception):
                    await asyncio.wait_for(proc.communicate(), timeout=1.0)
                raise TimeoutError(f"shell 执行超时({timeout}s)")
            if proc.returncode != 0:
                raise RuntimeError(
                    f"shell 退出码 {proc.returncode}: "
                    f"{stderr.decode(errors='replace').strip()}"
                )
        else:
            raise ValueError(f"未知 callback type: {cb_type}")

    # ===== 持久化 / 日志 =====

    async def _persist_task(self, task: dict[str, Any]) -> None:
        if self._redis is not None:
            key = _REDIS_KEY_PREFIX + task["task_id"]
            # 显式标注为 redis-py stubs 期望的 field 类型 union,避免 dict[str, Any]
            # 与 Mapping[bytes | bytearray | memoryview[int] | str | int | float, ...]
            # 之间的 invariance 不兼容。
            mapping: dict[
                bytes | bytearray | memoryview[int] | str | int | float,
                bytes | bytearray | memoryview[int] | str | int | float,
            ] = {
                "task_id": task["task_id"],
                "trigger_type": task["trigger_type"],
                "trigger_config": json.dumps(task["trigger_config"], ensure_ascii=False),
                "callback": json.dumps(task["callback"], ensure_ascii=False),
                "conversation_id": task.get("conversation_id") or "",
                "enabled": "true" if task.get("enabled") else "false",
                "created_at": task.get("created_at", ""),
                "next_run_at": task.get("next_run_at", ""),
            }
            await self._redis.hset(key, mapping=mapping)
            await self._redis.expire(key, _REDIS_TTL_SECONDS)
        else:
            self._memory_fallback[task["task_id"]] = task

    @staticmethod
    def _decode_task(raw: dict[str, str]) -> dict[str, Any]:
        return {
            "task_id": raw.get("task_id", ""),
            "trigger_type": raw.get("trigger_type", ""),
            "trigger_config": json.loads(raw.get("trigger_config") or "{}"),
            "callback": json.loads(raw.get("callback") or "{}"),
            "conversation_id": raw.get("conversation_id") or None,
            "enabled": raw.get("enabled") == "true",
            "created_at": raw.get("created_at", ""),
            "next_run_at": raw.get("next_run_at", ""),
        }

    async def _log_failure(self, task_id: str, message: str) -> None:
        entry = {"at": _now_iso(), "error": message}
        if self._redis is not None:
            key = _REDIS_LOG_PREFIX + task_id
            await self._redis.lpush(key, json.dumps(entry, ensure_ascii=False))
            await cast(Awaitable[str], self._redis.ltrim(key, 0, _LOG_KEEP - 1))
            await self._redis.expire(key, _REDIS_TTL_SECONDS)
        else:
            self._memory_logs.setdefault(task_id, []).insert(0, entry)
            del self._memory_logs[task_id][_LOG_KEEP:]

    async def _load_pending_tasks(self) -> None:
        if self._redis is None or self._scheduler is None:
            return
        loaded = 0
        async for key in self._redis.scan_iter(match=_REDIS_KEY_PREFIX + "*"):
            raw = await cast(Awaitable[dict[str, str]], self._redis.hgetall(key))
            if not raw:
                continue
            task = self._decode_task(raw)
            if not task.get("enabled"):
                continue
            try:
                trigger = _build_trigger(task["trigger_type"], task["trigger_config"])
                self._scheduler.add_job(
                    self._job_wrapper,
                    trigger=trigger,
                    args=[task["task_id"], task["callback"]],
                    id=task["task_id"],
                    replace_existing=True,
                )
                loaded += 1
            except Exception as e:
                logger.warning(
                    "[scheduler_service] 重建任务 %s 失败: %s", task.get("task_id"), e
                )
        if loaded:
            logger.info("[scheduler_service] 从 Redis 恢复 %d 个任务", loaded)


task_scheduler = TaskScheduler()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
