"""后台任务调度服务(对标 Trae Work Builder + Codex Automations)。

APScheduler AsyncIOScheduler 实现 cron/date/interval 三种触发器,
任务持久化到 Redis hash(TTL 30d),Redis 不可用降级内存,未配置 redis_url 时 stub。
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

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
# CronTrigger 原生参数(apscheduler 3.x)
_CRON_FIELDS = {
    "year", "month", "day", "week", "day_of_week", "hour", "minute", "second",
}
_INTERVAL_FIELDS = {"seconds", "minutes", "hours", "days"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_trigger(trigger_type: str, trigger_config: dict[str, Any]):
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
                self._redis = aioredis.from_url(redis_url, decode_responses=True)
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
            logger.warning("[scheduler_service] scheduler.start 失败: %s", e)
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
            except Exception:
                pass
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
    ) -> dict[str, Any]:
        if self._is_stub():
            return {"ok": True, "task_id": "stub-" + uuid.uuid4().hex, "stub": True}
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
                logger.warning("[scheduler_service] add_job 失败(%s): %s", tid, e)
        await self._persist_task(task)
        return {"ok": True, "task_id": tid, "next_run_at": task["next_run_at"]}

    async def remove_task(self, task_id: str) -> dict[str, Any]:
        if self._is_stub():
            return {"ok": True, "stub": True}
        if self._scheduler is not None:
            try:
                self._scheduler.remove_job(task_id)
            except Exception:
                pass  # job 可能不存在或已执行完
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
                raw = await self._redis.hgetall(key)
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
            raw = await self._redis.hgetall(_REDIS_KEY_PREFIX + task_id)
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
    ) -> dict[str, Any]:
        if self._is_stub():
            return {"ok": True, "stub": True}
        current: dict[str, Any] | None = None
        if self._redis is not None:
            raw = await self._redis.hgetall(_REDIS_KEY_PREFIX + task_id)
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
            except Exception:
                pass
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
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=payload)
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
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                _stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
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
            mapping = {
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
            await self._redis.ltrim(key, 0, _LOG_KEEP - 1)
            await self._redis.expire(key, _REDIS_TTL_SECONDS)
        else:
            self._memory_logs.setdefault(task_id, []).insert(0, entry)
            del self._memory_logs[task_id][_LOG_KEEP:]

    async def _load_pending_tasks(self) -> None:
        if self._redis is None or self._scheduler is None:
            return
        loaded = 0
        async for key in self._redis.scan_iter(match=_REDIS_KEY_PREFIX + "*"):
            raw = await self._redis.hgetall(key)
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
