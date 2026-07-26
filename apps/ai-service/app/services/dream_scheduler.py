"""梦境固化调度器(L2-5,2026-07-25 立,对标 Hermes Agent offline consolidation)。

设计要点(对齐 self_media_scheduler 风格):
1. 单例 `dream_scheduler`,由 main.py lifespan 启动 / 关闭。
2. 环境变量配置(默认关闭,因为消耗 LLM tokens):
   - DREAM_ENABLED:           开关,false 默认
   - DREAM_INTERVAL_SECONDS:  循环间隔,默认 3600(1 小时)
   - DREAM_EPISODIC_THRESHOLD:未固化 episodic 数量阈值,默认 50
   - DREAM_FORGET_THRESHOLD:  遗忘阈值(importance < threshold 删除),默认 0.1
   - DREAM_MAX_USERS_PER_RUN: 单次循环最多处理用户数,默认 10(防止突发洪流)
   - DREAM_START_DELAY_SECONDS:启动延迟,默认 120(避免与 schema_check / DB 初始化争抢)
3. 触发条件:某用户未固化 episodic 条数 >= DREAM_EPISODIC_THRESHOLD → 执行
   consolidate(提取模式 → semantic + procedural)+ forget(遗忘曲线衰减)。
4. 失败降级:任何异常(DB / LLM)只 warning 跳过本次循环,不阻塞下次。
5. 历史记录 LRU 30 条,供前端查看(每次循环追加一条)。
6. 单用户串行执行(避免同一用户并发梦境导致状态污染),不同用户也串行(简单可靠)。

对齐 packages/types 的 DreamResult 契约(DreamService.consolidate 返回值)。
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any, Literal, TypedDict

from .dream_service import dream_service
from .memory_service import _get_pool

logger = logging.getLogger(__name__)

# 历史记录上限(内存 LRU,超过自动 pop 最旧的一条)
_HISTORY_LIMIT = 30


class DreamHistoryEntry(TypedDict):
    """单次梦境循环的历史记录。"""

    triggered_at: str  # ISO8601 UTC
    status: Literal["running", "success", "failed", "skipped"]
    duration_ms: int
    users_processed: int
    total_consolidated: int
    total_forgotten: int
    error: str | None
    extra: dict[str, Any]


def _safe_int(value: str | None, default: int) -> int:
    """安全解析 int 环境变量,失败用 default。"""
    if not value:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value: str | None, default: float) -> float:
    """安全解析 float 环境变量,失败用 default。"""
    if not value:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


class DreamScheduler:
    """梦境固化调度器(单例,asyncio background task)。

    L2-5:周期性扫描有未固化 episodic 的用户,触发 DreamService.consolidate +
    forget,实现 Hermes Agent 风格的"睡眠时记忆整理"。
    """

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._history: list[DreamHistoryEntry] = []
        # 运行时锁:防止 start() 重复创建 task / stop() 与 start() 并发
        self._lock = asyncio.Lock()
        # 持有 create_task 引用,防止 CPython GC 回收未完成的子任务
        self._pending_tasks: set[asyncio.Task] = set()
        self._init_config()

    def _init_config(self) -> None:
        """从环境变量初始化配置(每次 start 时重新读取,便于运行时调试)。"""
        self.enabled = os.environ.get("DREAM_ENABLED", "false").lower() == "true"
        self.interval_seconds = _safe_int(os.environ.get("DREAM_INTERVAL_SECONDS"), 3600)
        self.episodic_threshold = _safe_int(os.environ.get("DREAM_EPISODIC_THRESHOLD"), 50)
        self.forget_threshold = _safe_float(os.environ.get("DREAM_FORGET_THRESHOLD"), 0.1)
        self.max_users_per_run = _safe_int(os.environ.get("DREAM_MAX_USERS_PER_RUN"), 10)
        self.start_delay_seconds = _safe_int(os.environ.get("DREAM_START_DELAY_SECONDS"), 120)

    # ===== 启停 =====

    async def start(self) -> None:
        """启动调度循环(无论 enabled 与否,loop 都跑,内部按 enabled 判断)。

        这样可在运行时通过 set_enabled(True) 激活,无需重启进程。
        """
        async with self._lock:
            if self._task is not None:
                return
            self._init_config()  # 重读环境变量
            self._task = asyncio.create_task(self._loop())
            logger.info(
                "[dream_scheduler] loop started, enabled=%s, interval=%ds, "
                "episodic_threshold=%d, max_users_per_run=%d",
                self.enabled,
                self.interval_seconds,
                self.episodic_threshold,
                self.max_users_per_run,
            )

    async def stop(self) -> None:
        """停止调度循环。"""
        async with self._lock:
            if self._task is None:
                return
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
            # 等待所有进行中的子任务完成(最多等 5s)
            if self._pending_tasks:
                try:
                    await asyncio.wait_for(
                        asyncio.gather(*self._pending_tasks, return_exceptions=True),
                        timeout=5.0,
                    )
                except asyncio.TimeoutError:
                    pass

    # ===== 运行时控制 =====

    def set_enabled(self, enabled: bool) -> None:
        """运行时开关(无需重启进程)。"""
        self.enabled = enabled
        logger.info("[dream_scheduler] enabled=%s", enabled)

    def get_status(self) -> dict[str, Any]:
        """返回当前调度器状态(供 API / 前端查看)。"""
        return {
            "enabled": self.enabled,
            "intervalSeconds": self.interval_seconds,
            "episodicThreshold": self.episodic_threshold,
            "forgetThreshold": self.forget_threshold,
            "maxUsersPerRun": self.max_users_per_run,
            "running": self._task is not None and not self._task.done(),
            "historyCount": len(self._history),
            "lastRun": self._history[-1] if self._history else None,
        }

    def get_history(self, limit: int = 10) -> list[DreamHistoryEntry]:
        """返回最近 N 条历史(默认 10)。"""
        if limit <= 0:
            return []
        return list(reversed(self._history[-limit:]))

    # ===== 主循环 =====

    async def _loop(self) -> None:
        """主循环:启动延迟 → 周期执行。"""
        await asyncio.sleep(self.start_delay_seconds)
        while True:
            try:
                if self.enabled:
                    await self._run_once_safe()
            except asyncio.CancelledError:
                raise
            except Exception as e:
                # _run_once_safe 内部已经 try/except,这是兜底
                logger.warning(
                    "[dream_scheduler] loop unexpected error: %s: %s",
                    type(e).__name__,
                    e,
                )
            await asyncio.sleep(self.interval_seconds)

    async def _run_once_safe(self) -> None:
        """安全执行一次循环(异常只记录,不向上抛)。"""
        started_at = datetime.now(timezone.utc)
        entry: DreamHistoryEntry = {
            "triggered_at": started_at.isoformat(),
            "status": "running",
            "duration_ms": 0,
            "users_processed": 0,
            "total_consolidated": 0,
            "total_forgotten": 0,
            "error": None,
            "extra": {},
        }
        try:
            result = await self._run_once()
            entry["users_processed"] = result["users_processed"]
            entry["total_consolidated"] = result["total_consolidated"]
            entry["total_forgotten"] = result["total_forgotten"]
            entry["status"] = "success"
            entry["extra"] = {
                "userBreakdown": result["user_breakdown"][:5],  # 仅前 5 个用户详情
            }
        except Exception as e:
            entry["status"] = "failed"
            entry["error"] = f"{type(e).__name__}: {e}"
            logger.warning("[dream_scheduler] run_once failed: %s: %s", type(e).__name__, e)
        entry["duration_ms"] = int(
            (datetime.now(timezone.utc) - started_at).total_seconds() * 1000
        )
        self._append_history(entry)
        logger.info(
            "[dream_scheduler] run_once done: status=%s, users=%d, "
            "consolidated=%d, forgotten=%d, duration=%dms",
            entry["status"],
            entry["users_processed"],
            entry["total_consolidated"],
            entry["total_forgotten"],
            entry["duration_ms"],
        )

    async def _run_once(self) -> dict[str, Any]:
        """执行一次完整循环:发现用户 → 逐个梦境固化。"""
        users = await self._discover_users_to_dream()
        if not users:
            return {
                "users_processed": 0,
                "total_consolidated": 0,
                "total_forgotten": 0,
                "user_breakdown": [],
            }

        # 限制单次循环处理的用户数(防止突发洪流)
        users = users[: self.max_users_per_run]

        total_consolidated = 0
        total_forgotten = 0
        user_breakdown: list[dict[str, Any]] = []

        for user_id in users:
            try:
                breakdown = await self._dream_for_user(user_id)
                user_breakdown.append(breakdown)
                total_consolidated += breakdown["consolidatedCount"]
                total_forgotten += breakdown["forgottenCount"]
            except Exception as e:
                logger.warning(
                    "[dream_scheduler] user %s dream failed: %s: %s",
                    user_id,
                    type(e).__name__,
                    e,
                )
                user_breakdown.append({
                    "userId": user_id,
                    "error": f"{type(e).__name__}: {e}",
                    "consolidatedCount": 0,
                    "forgottenCount": 0,
                })

        return {
            "users_processed": len(users),
            "total_consolidated": total_consolidated,
            "total_forgotten": total_forgotten,
            "user_breakdown": user_breakdown,
        }

    async def _discover_users_to_dream(self) -> list[str]:
        """查询未固化 episodic 数 >= threshold 的用户 ID 列表。

        SQL 逻辑:
          SELECT user_id, COUNT(*) AS pending_count
          FROM agent_memory_episodic
          WHERE metadata->>'consolidated' IS DISTINCT FROM 'true'
            AND user_id IS NOT NULL
          GROUP BY user_id
          HAVING COUNT(*) >= $threshold
          ORDER BY pending_count DESC
        """
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT user_id
                       FROM agent_memory_episodic
                       WHERE (metadata->>'consolidated') IS DISTINCT FROM 'true'
                         AND user_id IS NOT NULL
                       GROUP BY user_id
                       HAVING COUNT(*) >= $1
                       ORDER BY COUNT(*) DESC""",
                    self.episodic_threshold,
                )
        except Exception as e:
            logger.warning(
                "[dream_scheduler] discover users failed: %s: %s",
                type(e).__name__,
                e,
            )
            return []
        return [str(row["user_id"]) for row in rows if row["user_id"]]

    async def _dream_for_user(self, user_id: str) -> dict[str, Any]:
        """对单个用户执行梦境固化 + 遗忘。

        Returns:
            {userId, consolidatedCount, forgottenCount, topic, durationMs}
        """
        consolidate_result = await dream_service.consolidate(user_id)
        forget_result = await dream_service.forget(
            user_id, threshold=self.forget_threshold
        )
        return {
            "userId": user_id,
            "consolidatedCount": int(consolidate_result.get("consolidatedCount", 0)),
            "forgottenCount": int(forget_result.get("forgottenCount", 0)),
            "topic": consolidate_result.get("topic", ""),
            "durationMs": int(consolidate_result.get("durationMs", 0))
            + int(forget_result.get("durationMs", 0) if "durationMs" in forget_result else 0),
        }

    # ===== 手动触发 =====

    async def trigger_now(self, user_id: str | None = None) -> dict[str, Any]:
        """手动触发一次梦境固化(不影响下次定时触发)。

        Args:
            user_id: 指定用户 ID。None 时按阈值发现用户。

        Returns:
            执行结果摘要
        """
        if user_id:
            return await self._dream_for_user(user_id)
        return await self._run_once()

    # ===== 内部工具 =====

    def _append_history(self, entry: DreamHistoryEntry) -> None:
        """追加历史记录(LRU 保留最近 N 条)。"""
        self._history.append(entry)
        if len(self._history) > _HISTORY_LIMIT:
            self._history = self._history[-_HISTORY_LIMIT:]


# 单例(与 self_media_scheduler / memory_decay_manager 风格一致)
dream_scheduler = DreamScheduler()
