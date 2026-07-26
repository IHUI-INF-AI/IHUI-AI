"""Skill 自进化调度器(L3,2026-07-25 立,对标 Hermes Agent autonomous skill refinement)。

设计要点(对齐 dream_scheduler / self_media_scheduler 风格):
1. 单例 `skill_evolution_scheduler`,由 main.py lifespan 启动 / 关闭。
2. 环境变量配置(默认关闭,因为 LLM 迭代消耗 tokens 巨大):
   - SKILL_EVOLUTION_ENABLED:           开关,false 默认
   - SKILL_EVOLUTION_INTERVAL_SECONDS:  循环间隔,默认 21600(6 小时,比 Dream 长)
   - SKILL_EVOLUTION_MIN_FAILURES:      触发阈值,默认 3(失败案例 ≥ 3 才迭代)
   - SKILL_EVOLUTION_MAX_SKILLS_PER_RUN: 单次循环最多迭代 skill 数,默认 5
   - SKILL_EVOLUTION_START_DELAY_SECONDS: 启动延迟,默认 300(5 分钟,等 LLM warm up)
3. 触发条件:某 skill 的 failureCases >= MIN_FAILURES → 调
   skill_evolution_loop.iterate_on_feedback(基于反馈迭代优化 skill 内容)。
4. 失败降级:任何异常(DB / LLM / 文件系统)只 warning 跳过该 skill,不阻塞下一个。
5. 历史记录 LRU 30 条,供前端 / API 查看。
6. 单 skill 串行执行(避免同一 skill 并发迭代导致版本冲突),不同 skill 也串行(简单可靠)。

闭环链路:
  SkillFeedbackTracker(失败案例积累)
    ↓ MIN_FAILURES 阈值触发
  SkillEvolutionScheduler._loop
    ↓ 调用
  SkillEvolutionLoop.iterate_on_feedback
    ↓ 内部
  SkillIterator.iterate(LLM 生成新版本 → 写回 → SkillTester 测试 → 通过率提升则保留,否则回滚)

对齐 packages/types 的 SkillIterationResult 契约。
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


class SkillEvolutionHistoryEntry(TypedDict):
    """单次自进化循环的历史记录。"""

    triggered_at: str  # ISO8601 UTC
    status: Literal["running", "success", "failed", "skipped"]
    duration_ms: int
    skills_processed: int
    total_iterated: int  # shouldIterate=True 的数量
    total_rolled_back: int  # 测试通过率未提升被回滚的数量
    error: str | None
    extra: dict[str, Any]  # 各 skill 的迭代结果摘要(仅前 5 个)


def _safe_int(value: str | None, default: int) -> int:
    """安全解析 int 环境变量,失败用 default。"""
    if not value:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


class SkillEvolutionScheduler:
    """Skill 自进化调度器(单例,asyncio background task)。

    L3:周期性扫描有失败反馈的 skill,触发 SkillEvolutionLoop.iterate_on_feedback,
    实现 Hermes Agent 风格的"自动持续优化技能"。
    """

    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None
        self._history: list[SkillEvolutionHistoryEntry] = []
        # 运行时锁:防止 start() 重复创建 task / stop() 与 start() 并发
        self._lock = asyncio.Lock()
        # 持有 create_task 引用,防止 CPython GC 回收未完成的子任务
        self._pending_tasks: set[asyncio.Task[None]] = set()
        self._init_config()

    def _init_config(self) -> None:
        """从环境变量初始化配置(每次 start 时重新读取,便于运行时调试)。"""
        self.enabled = os.environ.get("SKILL_EVOLUTION_ENABLED", "false").lower() == "true"
        self.interval_seconds = _safe_int(
            os.environ.get("SKILL_EVOLUTION_INTERVAL_SECONDS"), 21600
        )
        self.min_failures = _safe_int(
            os.environ.get("SKILL_EVOLUTION_MIN_FAILURES"), 3
        )
        self.max_skills_per_run = _safe_int(
            os.environ.get("SKILL_EVOLUTION_MAX_SKILLS_PER_RUN"), 5
        )
        self.start_delay_seconds = _safe_int(
            os.environ.get("SKILL_EVOLUTION_START_DELAY_SECONDS"), 300
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
                "[skill_evolution_scheduler] loop started, enabled=%s, interval=%ds, "
                "min_failures=%d, max_skills_per_run=%d",
                self.enabled,
                self.interval_seconds,
                self.min_failures,
                self.max_skills_per_run,
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
            # 等待所有进行中的子任务完成(最多等 10s,因为单 skill 迭代可能耗时较长)
            if self._pending_tasks:
                try:
                    await asyncio.wait_for(
                        asyncio.gather(*self._pending_tasks, return_exceptions=True),
                        timeout=10.0,
                    )
                except asyncio.TimeoutError:
                    pass

    # ===== 运行时控制 =====

    def set_enabled(self, enabled: bool) -> None:
        """运行时开关(无需重启进程)。"""
        self.enabled = enabled
        logger.info("[skill_evolution_scheduler] enabled=%s", enabled)

    def get_status(self) -> dict[str, Any]:
        """返回当前调度器状态(供 API / 前端查看)。"""
        return {
            "enabled": self.enabled,
            "intervalSeconds": self.interval_seconds,
            "minFailures": self.min_failures,
            "maxSkillsPerRun": self.max_skills_per_run,
            "running": self._task is not None and not self._task.done(),
            "historyCount": len(self._history),
            "lastRun": self._history[-1] if self._history else None,
        }

    def get_history(self, limit: int = 10) -> list[SkillEvolutionHistoryEntry]:
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
                    "[skill_evolution_scheduler] loop unexpected error: %s: %s",
                    type(e).__name__,
                    e,
                )
            await asyncio.sleep(self.interval_seconds)

    async def _run_once_safe(self) -> None:
        """安全执行一次循环(异常只记录,不向上抛)。"""
        started_at = datetime.now(timezone.utc)
        entry: SkillEvolutionHistoryEntry = {
            "triggered_at": started_at.isoformat(),
            "status": "running",
            "duration_ms": 0,
            "skills_processed": 0,
            "total_iterated": 0,
            "total_rolled_back": 0,
            "error": None,
            "extra": {},
        }
        try:
            result = await self._run_once()
            entry["skills_processed"] = result["skills_processed"]
            entry["total_iterated"] = result["total_iterated"]
            entry["total_rolled_back"] = result["total_rolled_back"]
            entry["status"] = "success"
            entry["extra"] = {
                "skillBreakdown": result["skill_breakdown"][:5],  # 仅前 5 个 skill 详情
            }
        except Exception as e:
            entry["status"] = "failed"
            entry["error"] = f"{type(e).__name__}: {e}"
            logger.warning(
                "[skill_evolution_scheduler] run_once failed: %s: %s",
                type(e).__name__,
                e,
            )
        entry["duration_ms"] = int(
            (datetime.now(timezone.utc) - started_at).total_seconds() * 1000
        )
        self._append_history(entry)
        logger.info(
            "[skill_evolution_scheduler] run_once done: status=%s, skills=%d, "
            "iterated=%d, rolled_back=%d, duration=%dms",
            entry["status"],
            entry["skills_processed"],
            entry["total_iterated"],
            entry["total_rolled_back"],
            entry["duration_ms"],
        )

    async def _run_once(self) -> dict[str, Any]:
        """执行一次完整循环:发现 skill → 逐个迭代优化。"""
        skills = await self._discover_skills_to_evolve()
        if not skills:
            return {
                "skills_processed": 0,
                "total_iterated": 0,
                "total_rolled_back": 0,
                "skill_breakdown": [],
            }

        # 限制单次循环处理的 skill 数(防止突发洪流消耗过多 LLM tokens)
        skills = skills[: self.max_skills_per_run]

        total_iterated = 0
        total_rolled_back = 0
        skill_breakdown: list[dict[str, Any]] = []

        for skill_name in skills:
            try:
                breakdown = await self._evolve_skill(skill_name)
                skill_breakdown.append(breakdown)
                if breakdown["shouldIterate"]:
                    total_iterated += 1
                    if not breakdown.get("newVersion"):
                        total_rolled_back += 1
            except Exception as e:
                logger.warning(
                    "[skill_evolution_scheduler] skill %s evolve failed: %s: %s",
                    skill_name,
                    type(e).__name__,
                    e,
                )
                skill_breakdown.append({
                    "skillName": skill_name,
                    "error": f"{type(e).__name__}: {e}",
                    "shouldIterate": False,
                })

        return {
            "skills_processed": len(skills),
            "total_iterated": total_iterated,
            "total_rolled_back": total_rolled_back,
            "skill_breakdown": skill_breakdown,
        }

    async def _discover_skills_to_evolve(self) -> list[str]:
        """扫描所有 skill,返回 failureCases >= min_failures 的 skill 名列表。

        实现:遍历 skill_registry 的所有 skill,对每个调
        skill_feedback_tracker.get_failure_cases 获取失败案例数,
        达到阈值的加入候选列表。

        Returns:
            需要迭代的 skill 名列表(按失败案例数倒序)
        """
        # 局部导入避免循环依赖
        from .skills import skill_registry
        from .skill_feedback import skill_feedback_tracker

        try:
            all_skills = skill_registry.list_skills()
        except Exception as e:
            logger.warning(
                "[skill_evolution_scheduler] list skills failed: %s: %s",
                type(e).__name__,
                e,
            )
            return []

        candidates: list[tuple[str, int]] = []
        for skill in all_skills:
            skill_name = getattr(skill, "name", "")
            if not skill_name:
                continue
            try:
                failure_cases = await skill_feedback_tracker.get_failure_cases(
                    skill_name
                )
                failure_count = len(failure_cases) if failure_cases else 0
                if failure_count >= self.min_failures:
                    candidates.append((skill_name, failure_count))
            except Exception as e:
                logger.warning(
                    "[skill_evolution_scheduler] get_failure_cases(%s) failed: %s: %s",
                    skill_name,
                    type(e).__name__,
                    e,
                )
                continue

        # 按失败案例数倒序(失败最多的优先迭代)
        candidates.sort(key=lambda x: x[1], reverse=True)
        return [name for name, _ in candidates]

    async def _evolve_skill(self, skill_name: str) -> dict[str, Any]:
        """对单个 skill 执行基于反馈的迭代优化。

        调用 skill_evolution_loop.iterate_on_feedback,内部:
          1. 读取 skill 内容 + 使用统计 + 失败案例
          2. 跑当前测试获取基线 passRate
          3. 调 SkillIterator.iterate(LLM 生成新版本 → 写回 → 测试验证 → 通过率提升则保留,否则回滚)

        Args:
            skill_name: skill 名

        Returns:
            {skillName, shouldIterate, newVersion?, newContent?, reason, expectedImprovements}
        """
        # 局部导入避免循环依赖
        from .skills import skill_evolution_loop

        result = await skill_evolution_loop.iterate_on_feedback(skill_name)
        return {
            "skillName": skill_name,
            "shouldIterate": bool(result.get("shouldIterate", False)),
            "newVersion": result.get("newVersion"),
            "reason": str(result.get("reason", "")),
            "expectedImprovements": result.get("expectedImprovements", []),
        }

    # ===== 手动触发 =====

    async def trigger_now(self, skill_name: str | None = None) -> dict[str, Any]:
        """手动触发一次 skill 自进化(不影响下次定时触发)。

        Args:
            skill_name: 指定 skill 名。None 时按阈值发现所有 skill。

        Returns:
            执行结果摘要
        """
        if skill_name:
            return await self._evolve_skill(skill_name)
        return await self._run_once()

    # ===== 内部工具 =====

    def _append_history(self, entry: SkillEvolutionHistoryEntry) -> None:
        """追加历史记录(LRU 保留最近 N 条)。"""
        self._history.append(entry)
        if len(self._history) > _HISTORY_LIMIT:
            self._history = self._history[-_HISTORY_LIMIT:]


# 单例(与 dream_scheduler / self_media_scheduler 风格一致)
skill_evolution_scheduler = SkillEvolutionScheduler()
