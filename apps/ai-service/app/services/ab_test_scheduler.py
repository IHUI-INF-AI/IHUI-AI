"""A/B 测试调度器(L5-5,2026-07-25 立,对标 Hermes Agent auto-promote/rollback)。

设计要点(对齐 dream_scheduler / skill_evolution_scheduler / meta_learner_scheduler 风格):
1. 单例 `ab_test_scheduler`,由 main.py lifespan 启动 / 关闭
2. 环境变量配置(默认关闭):
   - AB_TEST_ENABLED:              开关,false 默认
   - AB_TEST_INTERVAL_SECONDS:     循环间隔,默认 3600(1 小时)
   - AB_TEST_MAX_DURATION_SECONDS:  测试最大运行时长,默认 86400(24 小时),
                                    超过 → 强制 stop,避免无限期占用
   - AB_TEST_START_DELAY_SECONDS:   启动延迟,默认 600(10 分钟,等所有 LLM 服务 warm up)

3. 单次循环流程:
   a. flush 所有 running 测试到 DB(避免进程崩溃丢失统计)
   b. 遍历所有 running 测试:
      - 检查 max_duration 是否超时 → 强制 stop + reason "max_duration_exceeded"
      - 调 SignificanceTester.test() 检验
      - decision=promote → mark_decided + _apply_promote
      - decision=rollback → mark_decided + _apply_rollback
      - decision=inconclusive → 不操作(等下次循环)
   c. 清理 ShadowRunner 中已结束测试的 treatment 内容

4. _apply_promote / _apply_rollback 回调:
   - 默认空实现(由 main.py lifespan 注册回调)
   - 调用方可注入自定义 promote/rollback 回调(如 SkillEvolutionScheduler 的方法)
   - 失败不阻塞主流程(只 warning,测试状态已 mark_decided)

5. 失败降级:任何异常(DB / LLM)只 warning 跳过本次循环,不阻塞下次
6. 历史记录 LRU 30 条,供前端 / API 查看

闭环链路(对照 §PROJECT_PLAN.md L5172):
  ABTestTracker.create_test
    ↓ SkillScheduler.run_skill 内部
  ShadowRunner.maybe_shadow_call
    ↓ 收集 control + treatment 指标
  ABTestTracker.record_call
    ↓ 周期触发(本调度器)
  SignificanceTester.test
    ↓ p_value < α
  ABTestScheduler._apply_promote / _apply_rollback
    ↓ 回调
  SkillRegistry.replace_skill / discard_skill
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Literal, TypedDict

logger = logging.getLogger(__name__)

# 历史记录上限(内存 LRU)
_HISTORY_LIMIT = 30

# 决策回调类型:(test_id, skill_name, control_version, treatment_version, reason) -> bool
PromoteCallback = Callable[
    [str, str, str, str, str], Awaitable[bool]
]
RollbackCallback = Callable[
    [str, str, str, str, str], Awaitable[bool]
]


class ABTestHistoryEntry(TypedDict):
    """单次 A/B 测试循环的历史记录。"""

    triggered_at: str  # ISO8601 UTC
    status: Literal["running", "success", "failed", "skipped"]
    duration_ms: int
    flushed_count: int  # flush 到 DB 的测试数
    checked_count: int  # 检验的 running 测试数
    promoted_count: int  # 决策为 promote 的数量
    rolled_back_count: int  # 决策为 rollback 的数量
    stopped_count: int  # 因超时强制 stop 的数量
    error: str | None
    extra: dict[str, Any]  # 决策详情


def _safe_int(value: str | None, default: int) -> int:
    """安全解析 int 环境变量,失败用 default。"""
    if not value:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


class ABTestScheduler:
    """A/B 测试调度器(单例,asyncio background task)。

    L5-5:周期性 flush stats + 触发显著性检验 + auto promote/rollback。
    """

    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None
        self._history: list[ABTestHistoryEntry] = []
        self._lock = asyncio.Lock()
        self._pending_tasks: set[asyncio.Task[None]] = set()
        # 可注入的决策回调(默认 None,仅 mark_decided 不做 skill 替换)
        self._promote_callback: PromoteCallback | None = None
        self._rollback_callback: RollbackCallback | None = None
        self._init_config()

    def _init_config(self) -> None:
        """从环境变量初始化配置(每次 start 时重新读取)。"""
        self.enabled = os.environ.get("AB_TEST_ENABLED", "false").lower() == "true"
        self.interval_seconds = _safe_int(
            os.environ.get("AB_TEST_INTERVAL_SECONDS"), 3600
        )
        self.max_duration_seconds = _safe_int(
            os.environ.get("AB_TEST_MAX_DURATION_SECONDS"), 86400
        )
        self.start_delay_seconds = _safe_int(
            os.environ.get("AB_TEST_START_DELAY_SECONDS"), 600
        )

    # ==================================================================
    # 决策回调注册
    # ==================================================================

    def register_promote_callback(self, callback: PromoteCallback) -> None:
        """注册 promote 决策回调(由 SkillEvolutionScheduler / main.py 注入)。

        回调签名:(test_id, skill_name, control_version, treatment_version, reason) -> bool
        返回 True 表示升级成功(新版替换旧版),False 表示失败(只 log warning)
        """
        self._promote_callback = callback
        logger.info("[ab_test_scheduler] register_promote_callback 已注册")

    def register_rollback_callback(self, callback: RollbackCallback) -> None:
        """注册 rollback 决策回调。"""
        self._rollback_callback = callback
        logger.info("[ab_test_scheduler] register_rollback_callback 已注册")

    # ==================================================================
    # 启停
    # ==================================================================

    async def start(self) -> None:
        """启动调度循环(无论 enabled 与否,loop 都跑,内部按 enabled 判断)。"""
        async with self._lock:
            if self._task is not None:
                return
            self._init_config()
            self._task = asyncio.create_task(self._loop())
            logger.info(
                "[ab_test_scheduler] loop started, enabled=%s, interval=%ds, "
                "max_duration=%ds",
                self.enabled,
                self.interval_seconds,
                self.max_duration_seconds,
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
            # 等待所有进行中的子任务完成(最多等 30s)
            if self._pending_tasks:
                try:
                    await asyncio.wait_for(
                        asyncio.gather(*self._pending_tasks, return_exceptions=True),
                        timeout=30.0,
                    )
                except asyncio.TimeoutError:
                    pass

    # ==================================================================
    # 运行时控制
    # ==================================================================

    def set_enabled(self, enabled: bool) -> None:
        """运行时开关。"""
        self.enabled = enabled
        logger.info("[ab_test_scheduler] enabled=%s", enabled)

    def get_status(self) -> dict[str, Any]:
        """返回当前调度器状态。"""
        # 惰性导入避免循环依赖
        try:
            from .ab_test_tracker import ab_test_tracker
            from .shadow_runner import shadow_runner

            tracker_status = ab_test_tracker.get_status()
            runner_status = shadow_runner.get_status()
        except Exception as e:
            tracker_status = {"error": f"{type(e).__name__}: {e}"}
            runner_status = {"error": f"{type(e).__name__}: {e}"}

        return {
            "enabled": self.enabled,
            "intervalSeconds": self.interval_seconds,
            "maxDurationSeconds": self.max_duration_seconds,
            "running": self._task is not None and not self._task.done(),
            "historyCount": len(self._history),
            "lastRun": self._history[-1] if self._history else None,
            "tracker": tracker_status,
            "shadowRunner": runner_status,
            "hasPromoteCallback": self._promote_callback is not None,
            "hasRollbackCallback": self._rollback_callback is not None,
        }

    def get_history(self, limit: int = 10) -> list[ABTestHistoryEntry]:
        """返回最近 N 条历史。"""
        if limit <= 0:
            return []
        return list(reversed(self._history[-limit:]))

    # ==================================================================
    # 主循环
    # ==================================================================

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
                    "[ab_test_scheduler] loop unexpected error: %s: %s",
                    type(e).__name__,
                    e,
                )
            await asyncio.sleep(self.interval_seconds)

    async def _run_once_safe(self) -> None:
        """安全执行一次循环(异常只记录,不向上抛)。"""
        started_at = datetime.now(timezone.utc)
        entry: ABTestHistoryEntry = {
            "triggered_at": started_at.isoformat(),
            "status": "running",
            "duration_ms": 0,
            "flushed_count": 0,
            "checked_count": 0,
            "promoted_count": 0,
            "rolled_back_count": 0,
            "stopped_count": 0,
            "error": None,
            "extra": {},
        }
        try:
            result = await self._run_once()
            entry["flushed_count"] = result["flushed_count"]
            entry["checked_count"] = result["checked_count"]
            entry["promoted_count"] = result["promoted_count"]
            entry["rolled_back_count"] = result["rolled_back_count"]
            entry["stopped_count"] = result["stopped_count"]
            entry["status"] = "success"
            entry["extra"] = result.get("decisions", [])
        except Exception as e:
            entry["status"] = "failed"
            entry["error"] = f"{type(e).__name__}: {e}"
            logger.warning(
                "[ab_test_scheduler] run_once failed: %s: %s",
                type(e).__name__,
                e,
            )
        entry["duration_ms"] = int(
            (datetime.now(timezone.utc) - started_at).total_seconds() * 1000
        )
        self._append_history(entry)
        logger.info(
            "[ab_test_scheduler] run_once done: status=%s, flushed=%d, checked=%d, "
            "promoted=%d, rolled_back=%d, stopped=%d, duration=%dms",
            entry["status"],
            entry["flushed_count"],
            entry["checked_count"],
            entry["promoted_count"],
            entry["rolled_back_count"],
            entry["stopped_count"],
            entry["duration_ms"],
        )

    async def _run_once(self) -> dict[str, Any]:
        """执行一次完整循环。"""
        # 局部导入避免循环依赖
        from .ab_test_tracker import ab_test_tracker
        from .shadow_runner import shadow_runner
        from .significance_tester import significance_tester

        # 1. flush 所有 running 测试到 DB(避免进程崩溃丢失统计)
        flushed = await ab_test_tracker.flush_all_running()

        # 2. 遍历 running 测试
        running_tests = ab_test_tracker.list_tests(status="running", limit=100)
        checked = 0
        promoted = 0
        rolled_back = 0
        stopped = 0
        decisions: list[dict[str, Any]] = []

        for test in running_tests:
            test_id = test.get("testId")
            if not test_id:
                continue
            checked += 1

            # 2a. 检查超时
            started_at = test.get("startedAt")
            if started_at and self._is_expired(started_at, self.max_duration_seconds):
                await ab_test_tracker.stop_test(test_id, reason="max_duration_exceeded")
                stopped += 1
                decisions.append({
                    "testId": test_id,
                    "skillName": test.get("skillName"),
                    "decision": "stopped",
                    "reason": "max_duration_exceeded",
                })
                continue

            # 2b. 显著性检验
            stats = ab_test_tracker.get_stats(test_id)
            if not stats:
                continue
            try:
                result = significance_tester.test(
                    stats["controlStats"],
                    stats["treatmentStats"],
                    alpha=float(test.get("significanceLevel", 0.05)),
                    min_sample_size=int(test.get("minSampleSize", 30)),
                )
            except Exception as e:
                logger.warning(
                    "[ab_test_scheduler] significance_tester.test 失败 test=%s: %s: %s",
                    test_id,
                    type(e).__name__,
                    e,
                )
                continue

            decision = result.get("decision")
            reason = result.get("reason", "")

            if decision in ("promote", "rollback"):
                # mark_decided 已经更新 status 内存 + DB
                ok = await ab_test_tracker.mark_decided(
                    test_id, decision, reason=reason
                )
                if not ok:
                    continue
                if decision == "promote":
                    promoted += 1
                    await self._apply_promote(
                        test_id=test_id,
                        skill_name=test.get("skillName", ""),
                        control_version=test.get("controlVersion", ""),
                        treatment_version=test.get("treatmentVersion", ""),
                        reason=reason,
                    )
                else:  # rollback
                    rolled_back += 1
                    await self._apply_rollback(
                        test_id=test_id,
                        skill_name=test.get("skillName", ""),
                        control_version=test.get("controlVersion", ""),
                        treatment_version=test.get("treatmentVersion", ""),
                        reason=reason,
                    )
                decisions.append({
                    "testId": test_id,
                    "skillName": test.get("skillName"),
                    "decision": decision,
                    "reason": reason[:200],
                })
            # inconclusive: 继续等下次循环

        # 3. 清理 ShadowRunner 内存中已结束测试的 treatment 内容
        try:
            await shadow_runner.cleanup_inactive()
        except Exception as e:
            logger.warning(
                "[ab_test_scheduler] shadow_runner.cleanup_inactive 失败(忽略): %s: %s",
                type(e).__name__,
                e,
            )

        return {
            "flushed_count": flushed,
            "checked_count": checked,
            "promoted_count": promoted,
            "rolled_back_count": rolled_back,
            "stopped_count": stopped,
            "decisions": decisions[:5],  # 摘要最多 5 条
        }

    async def _apply_promote(
        self,
        *,
        test_id: str,
        skill_name: str,
        control_version: str,
        treatment_version: str,
        reason: str,
    ) -> None:
        """执行 promote 决策回调(失败不阻塞)。"""
        if not self._promote_callback:
            logger.info(
                "[ab_test_scheduler] promote 决策(无回调,仅 mark_decided) test=%s "
                "skill=%s %s→%s reason=%s",
                test_id,
                skill_name,
                control_version,
                treatment_version,
                reason[:100],
            )
            return
        try:
            ok = await self._promote_callback(
                test_id, skill_name, control_version, treatment_version, reason
            )
            if not ok:
                logger.warning(
                    "[ab_test_scheduler] promote 回调返回 False test=%s skill=%s",
                    test_id,
                    skill_name,
                )
        except Exception as e:
            logger.warning(
                "[ab_test_scheduler] promote 回调失败 test=%s skill=%s: %s: %s",
                test_id,
                skill_name,
                type(e).__name__,
                e,
            )

    async def _apply_rollback(
        self,
        *,
        test_id: str,
        skill_name: str,
        control_version: str,
        treatment_version: str,
        reason: str,
    ) -> None:
        """执行 rollback 决策回调(失败不阻塞)。"""
        if not self._rollback_callback:
            logger.info(
                "[ab_test_scheduler] rollback 决策(无回调,仅 mark_decided) test=%s "
                "skill=%s %s→%s reason=%s",
                test_id,
                skill_name,
                control_version,
                treatment_version,
                reason[:100],
            )
            return
        try:
            ok = await self._rollback_callback(
                test_id, skill_name, control_version, treatment_version, reason
            )
            if not ok:
                logger.warning(
                    "[ab_test_scheduler] rollback 回调返回 False test=%s skill=%s",
                    test_id,
                    skill_name,
                )
        except Exception as e:
            logger.warning(
                "[ab_test_scheduler] rollback 回调失败 test=%s skill=%s: %s: %s",
                test_id,
                skill_name,
                type(e).__name__,
                e,
            )

    # ==================================================================
    # 手动触发
    # ==================================================================

    async def trigger_now(self) -> dict[str, Any]:
        """手动触发一次循环(不影响下次定时触发)。"""
        return await self._run_once()

    # ==================================================================
    # 内部工具
    # ==================================================================

    def _append_history(self, entry: ABTestHistoryEntry) -> None:
        """追加历史记录(LRU 保留最近 N 条)。"""
        self._history.append(entry)
        if len(self._history) > _HISTORY_LIMIT:
            self._history = self._history[-_HISTORY_LIMIT:]

    @staticmethod
    def _is_expired(started_at_iso: str, max_duration_seconds: int) -> bool:
        """检查测试是否超时(started_at + max_duration < now)。"""
        if not started_at_iso:
            return False
        try:
            s = started_at_iso.replace("Z", "+00:00") if isinstance(
                started_at_iso, str
            ) else started_at_iso
            started = datetime.fromisoformat(s)
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            return (now - started).total_seconds() > max_duration_seconds
        except Exception as e:
            logger.warning("ab_test_scheduler._is_expired 超时检查失败: %s", e, exc_info=True)
            return False


# 全局单例(与 dream_scheduler / skill_evolution_scheduler / meta_learner_scheduler 风格一致)
ab_test_scheduler = ABTestScheduler()
