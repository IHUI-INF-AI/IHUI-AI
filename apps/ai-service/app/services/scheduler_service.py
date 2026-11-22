# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""后台任务调度服务(自研任务调度)。

APScheduler AsyncIOScheduler 实现 cron/date/interval 三种触发器,
任务持久化到 Redis hash(TTL 30d),Redis 不可用降级内存,未配置 redis_url 时 stub。
未带时区的触发时刻按 Asia/Shanghai 解释;同一触发点用 Redis SET NX 只执行一次。
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
from datetime import UTC, datetime, timedelta, tzinfo
from typing import Any, cast
from zoneinfo import ZoneInfo

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

# 与 checkin_scheduler._CN_TZ 同写法(ZoneInfo;APScheduler 3.x 接受 stdlib tzinfo)。
# 用户没写时区的「本地 9 点」按 Asia/Shanghai 解释;调度器停在 UTC 时会在北京 17 点响。
_CN_TZ = ZoneInfo("Asia/Shanghai")

# 同一任务、同一触发点的抢占键。SET NX EX,与 workspace_lock / 内部回放票据同一原语。
# 抢到不释放:慢一拍的进程不能在锁过期前把这一拍再跑一遍。
_REDIS_FIRE_PREFIX = "mcp:scheduled_task_fire:"
_FIRE_LOCK_TTL_SECONDS = 6 * 3600
# 进程时钟相差几秒、或卡在整点两侧时,仍要把这一拍算成同一个触发点。
_FIRE_SKEW = timedelta(seconds=5)
_SLOT_LOOKBACK = timedelta(hours=2)
_SLOT_WALK_CAP = 20000
_SLOT_ANCHOR = datetime(2000, 1, 1)

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


def _now(tz: tzinfo | None = None) -> datetime:
    if tz is None:
        return datetime.now(UTC)
    return datetime.now(tz)


def _now_iso() -> str:
    return _now().isoformat()


def _trigger_timezone(trigger_config: dict[str, Any]) -> ZoneInfo:
    """未带时区 → Asia/Shanghai;显式 IANA 名则照用。非法名抛 ValueError。"""
    raw = trigger_config.get("timezone")
    if raw is None or (isinstance(raw, str) and raw.strip() == ""):
        return _CN_TZ
    if not isinstance(raw, str):
        raise ValueError(f"无效 timezone: {raw!r}")
    name = raw.strip()
    try:
        return ZoneInfo(name)
    except Exception as e:
        raise ValueError(f"无效 timezone: {name!r}") from e


def _build_trigger(trigger_type: str, trigger_config: dict[str, Any]) -> Any:
    """根据 trigger_type 构造 APScheduler Trigger,失败抛 ValueError。

    没写 timezone 的本地时刻按 Asia/Shanghai 解释,不跟随调度器默认 UTC,
    也不跟随主机本地时区(主机曾被静默改成过 UTC)。
    """
    tz = _trigger_timezone(trigger_config)
    if trigger_type == "cron":
        kwargs = {k: v for k, v in trigger_config.items() if k in _CRON_FIELDS}
        if not kwargs:
            raise ValueError(
                "cron trigger_config 需至少一个字段: " + ",".join(sorted(_CRON_FIELDS))
            )
        return CronTrigger(timezone=tz, **kwargs)
    if trigger_type == "date":
        run_date = trigger_config.get("run_date")
        if not run_date:
            raise ValueError("date trigger_config 必填 run_date(ISO8601)")
        return DateTrigger(run_date=run_date, timezone=tz)
    if trigger_type == "interval":
        kwargs = {k: v for k, v in trigger_config.items() if k in _INTERVAL_FIELDS}
        if not kwargs:
            raise ValueError(
                "interval trigger_config 需至少一个字段: " + ",".join(sorted(_INTERVAL_FIELDS))
            )
        return IntervalTrigger(timezone=tz, **kwargs)
    raise ValueError(f"无效 trigger_type: {trigger_type}")


def _slot_token(moment: datetime) -> str:
    """触发点身份:同一瞬间在各进程上必须得到同一个字符串。"""
    return str(int(round(moment.timestamp() * 1000)))


def _minute_bucket(moment: datetime) -> str:
    return str(int(moment.timestamp()) // 60 * 60)


def _latest_fire_at_or_before(trigger: Any, horizon: datetime) -> datetime | None:
    """规范触发器在 horizon 之前(含)的最后一拍。窗口外的年频任务靠首跳,不从锚点逐秒爬。"""
    window_start = horizon - _SLOT_LOOKBACK
    try:
        candidate = trigger.get_next_fire_time(None, window_start)
    except Exception:
        return None
    last: datetime | None = None
    steps = 0
    while isinstance(candidate, datetime) and candidate <= horizon and steps < _SLOT_WALK_CAP:
        last = candidate
        try:
            nxt = trigger.get_next_fire_time(last, last)
        except Exception:
            break
        steps += 1
        if not isinstance(nxt, datetime) or nxt <= last:
            break
        candidate = nxt
    return last


def _cron_probe(trigger_config: dict[str, Any]) -> Any:
    """算触发点用的 cron:start_date 钉在公共锚点,不取各进程自己的启动时刻。"""
    tz = _trigger_timezone(trigger_config)
    kwargs = {k: v for k, v in trigger_config.items() if k in _CRON_FIELDS}
    if not kwargs:
        raise ValueError(
            "cron trigger_config 需至少一个字段: " + ",".join(sorted(_CRON_FIELDS))
        )
    return CronTrigger(timezone=tz, start_date=_SLOT_ANCHOR.replace(tzinfo=tz), **kwargs)


def _interval_probe(trigger_config: dict[str, Any]) -> Any:
    tz = _trigger_timezone(trigger_config)
    kwargs = {k: v for k, v in trigger_config.items() if k in _INTERVAL_FIELDS}
    if not kwargs:
        raise ValueError(
            "interval trigger_config 需至少一个字段: " + ",".join(sorted(_INTERVAL_FIELDS))
        )
    start = trigger_config.get("start_date") or _SLOT_ANCHOR.replace(tzinfo=tz)
    return IntervalTrigger(timezone=tz, start_date=start, **kwargs)


def _interval_fire_moment(trigger_config: dict[str, Any], now: datetime) -> datetime:
    """按公共相位取「这一拍」。整点两侧差几秒的两个进程落到同一拍。"""
    trig = _interval_probe(trigger_config)
    length = float(trig.interval_length)
    if length <= 0:
        raise ValueError("interval 长度必须为正")
    start_ts = float(trig.start_date.timestamp())
    elapsed = now.timestamp() - start_ts
    if elapsed < 0:
        base_ts = start_ts
    else:
        base_ts = start_ts + int(elapsed // length) * length
    base = datetime.fromtimestamp(base_ts, UTC)
    nxt = datetime.fromtimestamp(base_ts + length, UTC)
    if timedelta(0) <= (nxt - now) <= _FIRE_SKEW:
        return nxt
    return base


def _fire_slot(
    trigger_type: str | None,
    trigger_config: dict[str, Any] | None,
    now: datetime | None = None,
) -> str:
    """同一任务在同一触发点上的锁身份。算不出时退回分钟桶,避免用各自的微秒对不上。"""
    moment = now if isinstance(now, datetime) else _now(_CN_TZ)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=_CN_TZ)
    if trigger_type not in _VALID_TRIGGER_TYPES or not isinstance(trigger_config, dict):
        return _minute_bucket(moment)
    try:
        if trigger_type == "date":
            run_date = _build_trigger("date", trigger_config).run_date
            if isinstance(run_date, datetime):
                return _slot_token(run_date)
        elif trigger_type == "interval":
            return _slot_token(_interval_fire_moment(trigger_config, moment))
        elif trigger_type == "cron":
            picked = _latest_fire_at_or_before(
                _cron_probe(trigger_config), moment + _FIRE_SKEW
            )
            if isinstance(picked, datetime):
                return _slot_token(picked)
    except Exception:
        logger.debug("[scheduler_service] 计算触发点失败,退回分钟桶", exc_info=True)
    return _minute_bucket(moment)


def _unavailable_result() -> dict[str, Any]:
    return {
        "ok": False,
        "errorCode": "SCHEDULER_UNAVAILABLE",
        "message": "调度器未启动,任务不会被触发",
    }


class TaskScheduler:
    """后台任务调度器(单例)。"""

    def __init__(self) -> None:
        self._scheduler: AsyncIOScheduler | None = None
        self._redis: aioredis.Redis | None = None
        self._memory_fallback: dict[str, dict[str, Any]] = {}
        self._memory_logs: dict[str, list[dict[str, Any]]] = {}
        self._use_memory: bool = False
        self._started: bool = False
        self._runner_id = f"{os.getpid()}-{uuid.uuid4().hex}"

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
        try:
            self._scheduler = AsyncIOScheduler(timezone=_CN_TZ)
            self._scheduler.start()
        except Exception as e:
            # 建调度器或 start() 失败:不能进入已启动态,也不能吞掉异常让调用方以为已经排上。
            # main.py 会接住这个异常并继续起服务;add_task 看到调度器不在就返回
            # SCHEDULER_UNAVAILABLE,任务不写 Redis。_is_stub() 仍只表示「没配 redis_url」,
            # 失败不是 stub 成功。
            logger.error("[scheduler_service] scheduler 启动失败,调度器不可用: %s", e)
            sched = self._scheduler
            self._scheduler = None
            self._started = False
            if sched is not None:
                with contextlib.suppress(Exception):
                    sched.shutdown(wait=False)
            raise
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
        # 调度器没真正起来时绝不返 ok,也绝不落库(否则任务写进 Redis 却永不触发)。
        if self._scheduler is None or not self._started:
            return _unavailable_result()
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
                    args=[tid, callback, trigger_type, trigger_config],
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
        # 重新启用却排不进去时,不能改完存储再回 ok(调用方会当成已经排上)。
        if new_enabled and (self._scheduler is None or not self._started):
            return _unavailable_result()
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
                        args=[task_id, new_callback, trigger_type, new_trigger_config],
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

    async def _claim_fire(self, task_id: str, slot: str) -> bool:
        """同一任务同一触发点只放行一个进程。

        无 Redis(内存降级,单进程)直接放行。有 Redis 时 SET key value NX EX,
        与 workspace_lock、内部回放票据同一原语;成功后不删除,慢进程不能重入这一拍。
        Redis 故障时放行,避免锁层抖动把全部任务静默丢掉。
        """
        if self._redis is None:
            return True
        key = f"{_REDIS_FIRE_PREFIX}{task_id}:{slot}"
        try:
            ok = await self._redis.set(
                key,
                self._runner_id,
                nx=True,
                ex=_FIRE_LOCK_TTL_SECONDS,
            )
        except Exception as e:
            logger.warning("[scheduler_service] 触发点抢锁失败,本进程继续执行: %s", e)
            return True
        return bool(ok)

    async def _job_wrapper(
        self,
        task_id: str,
        callback: dict[str, Any],
        trigger_type: str | None = None,
        trigger_config: dict[str, Any] | None = None,
    ) -> None:
        slot = _fire_slot(trigger_type, trigger_config, _now(_CN_TZ))
        if not await self._claim_fire(task_id, slot):
            logger.info(
                "[scheduler_service] 任务 %s 触发点 %s 已由其他进程执行,跳过",
                task_id,
                slot,
            )
            return
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
                # CREATE_NEW_PROCESS_GROUP 只存在于 Windows 版 subprocess；用 getattr
                # 取值让 mypy 在 Linux runner 上也不报 attr-defined（此分支仅在 nt 命中）。
                popen_kwargs["creationflags"] = getattr(
                    subprocess, "CREATE_NEW_PROCESS_GROUP", 0
                )
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
                    args=[
                        task["task_id"],
                        task["callback"],
                        task["trigger_type"],
                        task["trigger_config"],
                    ],
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
