"""元学习调度器(L4-5,2026-07-25 立,对标 Hermes Agent meta-learning cycle)。

设计要点(对齐 dream_scheduler / skill_evolution_scheduler 风格):
1. 单例 `meta_learner_scheduler`,由 main.py lifespan 启动 / 关闭。
2. 环境变量配置(默认关闭,因为 LLM 聚类消耗 tokens 巨大):
   - META_LEARNER_ENABLED:           开关,false 默认
   - META_LEARNER_INTERVAL_SECONDS:  循环间隔,默认 43200(12 小时,比 skill_evolution 更长)
   - META_LEARNER_MIN_FAILURES:      触发阈值,默认 10(失败案例 ≥ 10 才触发聚类)
   - META_LEARNER_START_DELAY_SECONDS: 启动延迟,默认 600(10 分钟,等所有 LLM 服务 warm up)

3. 触发流程:
   a. 扫描所有 skill 的失败案例(skill_feedback_tracker)
   b. 累计总数 >= META_LEARNER_MIN_FAILURES → 触发 MetaLearner.learn_from_failures
   c. 内部:FailureClusterer 聚类 → 抽取 meta_lessons → 持久化到 agent_meta_lessons

4. 失败降级:任何异常(DB / LLM)只 warning 跳过本次循环,不阻塞下次。
5. 历史记录 LRU 30 条,供前端 / API 查看。
6. 单次循环串行执行(简单可靠,LLM 聚类本身不并发安全)。

闭环链路:
  SkillFeedbackTracker(跨 skill 失败案例)
    ↓ MIN_FAILURES 阈值触发
  MetaLearnerScheduler._loop
    ↓ 调用
  MetaLearner.learn_from_failures
    ↓ 内部
  FailureClusterer.cluster(LLM 聚类 → 失败模式)
    ↓ 抽取
  meta_lessons(避坑指南)
    ↓ 持久化
  agent_meta_lessons 表 + _lessons 内存 Map
    ↓ AgentLoop 启动时注入
  system prompt snippet(让 LLM 知道避坑)

对齐 packages/types 的 MetaLearnerStatus 契约(本任务新增类型)。
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any, Literal, TypedDict

logger = logging.getLogger(__name__)

# 历史记录上限(内存 LRU,超过自动 pop 最旧的一条)
_HISTORY_LIMIT = 30


class MetaLearnerHistoryEntry(TypedDict):
    """单次元学习循环的历史记录。"""

    triggered_at: str  # ISO8601 UTC
    status: Literal["running", "success", "failed", "skipped"]
    duration_ms: int
    total_failures_collected: int  # 收集到的失败案例总数
    patterns_count: int  # 聚类出的失败模式数
    lessons_extracted: int  # 抽取的 meta_lessons 数
    lessons_persisted: int  # 持久化的 meta_lessons 数
    error: str | None
    extra: dict[str, Any]  # 摘要(前 5 个 pattern / lesson)


def _safe_int(value: str | None, default: int) -> int:
    """安全解析 int 环境变量,失败用 default。"""
    if not value:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


class MetaLearnerScheduler:
    """元学习调度器(单例,asyncio background task)。

    L4-5:周期性扫描跨 skill 失败案例,触发 MetaLearner.learn_from_failures,
    实现 Hermes Agent 风格的"从失败中学习"。
    """

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._history: list[MetaLearnerHistoryEntry] = []
        # 运行时锁:防止 start() 重复创建 task / stop() 与 start() 并发
        self._lock = asyncio.Lock()
        # 持有 create_task 引用,防止 CPython GC 回收未完成的子任务
        self._pending_tasks: set[asyncio.Task] = set()
        self._init_config()

    def _init_config(self) -> None:
        """从环境变量初始化配置(每次 start 时重新读取,便于运行时调试)。"""
        self.enabled = os.environ.get("META_LEARNER_ENABLED", "false").lower() == "true"
        self.interval_seconds = _safe_int(
            os.environ.get("META_LEARNER_INTERVAL_SECONDS"), 43200
        )
        self.min_failures = _safe_int(
            os.environ.get("META_LEARNER_MIN_FAILURES"), 10
        )
        self.start_delay_seconds = _safe_int(
            os.environ.get("META_LEARNER_START_DELAY_SECONDS"), 600
        )

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
                "[meta_learner_scheduler] loop started, enabled=%s, interval=%ds, "
                "min_failures=%d",
                self.enabled,
                self.interval_seconds,
                self.min_failures,
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
            # 等待所有进行中的子任务完成(最多等 30s,因为元学习可能耗时较长)
            if self._pending_tasks:
                try:
                    await asyncio.wait_for(
                        asyncio.gather(*self._pending_tasks, return_exceptions=True),
                        timeout=30.0,
                    )
                except asyncio.TimeoutError:
                    pass

    # ===== 运行时控制 =====

    def set_enabled(self, enabled: bool) -> None:
        """运行时开关(无需重启进程)。"""
        self.enabled = enabled
        logger.info("[meta_learner_scheduler] enabled=%s", enabled)

    def get_status(self) -> dict[str, Any]:
        """返回当前调度器状态(供 API / 前端查看)。"""
        return {
            "enabled": self.enabled,
            "intervalSeconds": self.interval_seconds,
            "minFailures": self.min_failures,
            "running": self._task is not None and not self._task.done(),
            "historyCount": len(self._history),
            "lastRun": self._history[-1] if self._history else None,
            "metaLearnerStatus": _get_meta_learner_status(),
        }

    def get_history(self, limit: int = 10) -> list[MetaLearnerHistoryEntry]:
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
                logger.warning(
                    "[meta_learner_scheduler] loop unexpected error: %s: %s",
                    type(e).__name__,
                    e,
                )
            await asyncio.sleep(self.interval_seconds)

    async def _run_once_safe(self) -> None:
        """安全执行一次循环(异常只记录,不向上抛)。"""
        started_at = datetime.now(timezone.utc)
        entry: MetaLearnerHistoryEntry = {
            "triggered_at": started_at.isoformat(),
            "status": "running",
            "duration_ms": 0,
            "total_failures_collected": 0,
            "patterns_count": 0,
            "lessons_extracted": 0,
            "lessons_persisted": 0,
            "error": None,
            "extra": {},
        }
        try:
            result = await self._run_once()
            entry["total_failures_collected"] = result["total_failures_collected"]
            entry["patterns_count"] = result["patterns_count"]
            entry["lessons_extracted"] = result["lessons_extracted"]
            entry["lessons_persisted"] = result["lessons_persisted"]
            entry["status"] = "success"
            entry["extra"] = {
                "patterns": result.get("patterns", [])[:5],
                "lessons": result.get("lessons", [])[:5],
            }
        except Exception as e:
            entry["status"] = "failed"
            entry["error"] = f"{type(e).__name__}: {e}"
            logger.warning(
                "[meta_learner_scheduler] run_once failed: %s: %s",
                type(e).__name__,
                e,
            )
        entry["duration_ms"] = int(
            (datetime.now(timezone.utc) - started_at).total_seconds() * 1000
        )
        self._append_history(entry)
        logger.info(
            "[meta_learner_scheduler] run_once done: status=%s, "
            "failures=%d, patterns=%d, lessons_extracted=%d, "
            "lessons_persisted=%d, duration=%dms",
            entry["status"],
            entry["total_failures_collected"],
            entry["patterns_count"],
            entry["lessons_extracted"],
            entry["lessons_persisted"],
            entry["duration_ms"],
        )

    async def _run_once(self) -> dict[str, Any]:
        """执行一次完整循环:收集失败案例 → 触发元学习。"""
        # 1. 收集所有 skill 的失败案例
        failure_cases = await self._collect_all_failure_cases()
        if not failure_cases or len(failure_cases) < self.min_failures:
            return {
                "total_failures_collected": len(failure_cases),
                "patterns_count": 0,
                "lessons_extracted": 0,
                "lessons_persisted": 0,
                "patterns": [],
                "lessons": [],
            }

        # 2. 触发 MetaLearner.learn_from_failures
        # 局部导入避免循环依赖
        from .meta_learner import meta_learner

        result = await meta_learner.learn_from_failures(failure_cases)

        return {
            "total_failures_collected": len(failure_cases),
            "patterns_count": result.get("patternsCount", 0),
            "lessons_extracted": result.get("lessonsExtracted", 0),
            "lessons_persisted": result.get("lessonsPersisted", 0),
            "patterns": result.get("patterns", []),
            "lessons": result.get("lessons", []),
        }

    async def _collect_all_failure_cases(self) -> list[dict[str, Any]]:
        """扫描所有 skill,收集所有失败案例。

        Returns:
            失败案例列表(每条含 skillName/failureReason/usedAt 等)
        """
        # 局部导入避免循环依赖
        from .skills import skill_registry
        from .skill_feedback import skill_feedback_tracker

        try:
            all_skills = skill_registry.list_skills()
        except Exception as e:
            logger.warning(
                "[meta_learner_scheduler] list skills failed: %s: %s",
                type(e).__name__,
                e,
            )
            return []

        all_failures: list[dict[str, Any]] = []
        for skill in all_skills:
            skill_name = getattr(skill, "name", "")
            if not skill_name:
                continue
            try:
                # limit=-1 表示返回所有失败案例(供元学习聚类)
                failures = await skill_feedback_tracker.get_failure_cases(
                    skill_name, limit=-1
                )
                if failures:
                    all_failures.extend(failures)
            except Exception as e:
                logger.warning(
                    "[meta_learner_scheduler] get_failure_cases(%s) failed: %s: %s",
                    skill_name,
                    type(e).__name__,
                    e,
                )
                continue

        return all_failures

    # ===== 手动触发 =====

    async def trigger_now(self) -> dict[str, Any]:
        """手动触发一次元学习(不影响下次定时触发)。

        Returns:
            执行结果摘要
        """
        return await self._run_once()

    # ===== 内部工具 =====

    def _append_history(self, entry: MetaLearnerHistoryEntry) -> None:
        """追加历史记录(LRU 保留最近 N 条)。"""
        self._history.append(entry)
        if len(self._history) > _HISTORY_LIMIT:
            self._history = self._history[-_HISTORY_LIMIT:]


def _get_meta_learner_status() -> dict[str, Any]:
    """获取 MetaLearner 当前状态(惰性导入避免循环依赖)。"""
    try:
        from .meta_learner import meta_learner
        return meta_learner.get_status()
    except Exception as e:
        logger.warning(
            "[meta_learner_scheduler] get meta_learner status failed: %s: %s",
            type(e).__name__,
            e,
        )
        return {"error": f"{type(e).__name__}: {e}"}


# 单例(与 dream_scheduler / skill_evolution_scheduler 风格一致)
meta_learner_scheduler = MetaLearnerScheduler()
