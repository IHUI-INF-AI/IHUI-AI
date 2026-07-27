"""A/B 测试追踪器(L5-2,2026-07-25 立,对标 Hermes Agent A/B evaluation)。

设计要点:
1. 内存为主累计调用指标,周期性 flush 到 agent_ab_tests 表
2. 单 skill 同时只允许 1 条 status='running' 的测试(由 create_test 保证)
3. 指标维度:成功率 / 耗时(ms)/ token 用量
4. JSONB stats 结构:
   {
     "success_count": int,
     "failure_count": int,
     "duration_ms_sum": float,
     "duration_ms_sum_sq": float,  # 用于方差计算 var = E[X^2] - E[X]^2
     "tokens_sum": int,
     "tokens_sum_sq": float
   }
5. 决策(promote/rollback)只写入 DB,不删除内存(留作历史)
6. 启动时 lifespan 调 load_active_tests() 只加载 status='running' 的测试

闭环链路:
  SkillEvolutionScheduler.iterate_on_feedback
    ↓ 生成新版本 skill
  ABTestTracker.create_test(control=旧版, treatment=新版, shadow_ratio=0.1)
    ↓ SkillScheduler.run_skill 内部
  ShadowRunner:按 shadow_ratio 概率走 treatment_version
    ↓ 调用完成
  ABTestTracker.record_call(skill, version, success, duration_ms, tokens)
    ↓ 周期触发(ABTestScheduler)
  SignificanceTester.test(control_stats, treatment_stats, alpha=0.05)
    ↓ p-value < α 且 effect size 显著
  ABTestTracker.mark_decided(decision="promote"/"rollback", reason=...)
    ↓ 持久化 + 内存更新
  promote → SkillRegistry.replace_skill(新版)
  rollback → SkillRegistry.discard_skill(新版)
"""

from __future__ import annotations

import json
import logging
import uuid as _uuid
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg

from ..core.config import settings

logger = logging.getLogger(__name__)

# 默认配置(可由 create_test 覆盖)
_DEFAULT_SHADOW_RATIO = 0.1
_DEFAULT_MIN_SAMPLE_SIZE = 30
_DEFAULT_SIGNIFICANCE_LEVEL = 0.05


def _empty_stats() -> dict[str, Any]:
    """返回空 stats 结构(用于初始化)。"""
    return {
        "success_count": 0,
        "failure_count": 0,
        "duration_ms_sum": 0.0,
        "duration_ms_sum_sq": 0.0,
        "tokens_sum": 0,
        "tokens_sum_sq": 0.0,
    }


def _merge_stats_add(
    stats: dict[str, Any],
    success: bool,
    duration_ms: float,
    tokens: int,
) -> dict[str, Any]:
    """累加一次调用到 stats(返回新 dict,不修改原 stats)。

    累加策略:
      - success_count / failure_count 二选一 +1
      - duration_ms_sum += duration_ms;duration_ms_sum_sq += duration_ms^2
      - tokens_sum += tokens;tokens_sum_sq += tokens^2
    """
    new_stats = dict(stats)
    if success:
        new_stats["success_count"] = int(new_stats.get("success_count", 0)) + 1
    else:
        new_stats["failure_count"] = int(new_stats.get("failure_count", 0)) + 1
    new_stats["duration_ms_sum"] = float(new_stats.get("duration_ms_sum", 0.0)) + float(
        duration_ms
    )
    new_stats["duration_ms_sum_sq"] = float(
        new_stats.get("duration_ms_sum_sq", 0.0)
    ) + (float(duration_ms) ** 2)
    new_stats["tokens_sum"] = int(new_stats.get("tokens_sum", 0)) + int(tokens)
    new_stats["tokens_sum_sq"] = float(new_stats.get("tokens_sum_sq", 0.0)) + (
        float(tokens) ** 2
    )
    return new_stats


# 全局连接池(独立,避免与 meta_learner / user_profile 互相影响)
_pool: Optional[asyncpg.Pool] = None


async def _get_pool() -> asyncpg.Pool:
    """获取 asyncpg 连接池(懒初始化)。"""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=1,
            max_size=5,
            command_timeout=10,
        )
    return _pool


class ABTestTracker:
    """A/B 测试追踪器(单例 ab_test_tracker)。

    内存模型:
      _tests: dict[test_id, ABTest dict]
      _skill_active_index: dict[skill_name, test_id](仅含 running 的测试,
                     create_test 会先把同 skill 的旧 running 标记 stopped)

    ABTest dict 结构:
      {
        "testId": str,
        "skillName": str,
        "controlVersion": str,
        "treatmentVersion": str,
        "status": "running" | "promoted" | "rolled_back" | "stopped",
        "shadowRatio": float,
        "minSampleSize": int,
        "significanceLevel": float,
        "controlStats": {...},
        "treatmentStats": {...},
        "decision": str | None,
        "decisionReason": str | None,
        "startedAt": str (ISO),
        "decidedAt": str | None,
        "endedAt": str | None,
      }
    """

    def __init__(self) -> None:
        self._tests: dict[str, dict[str, Any]] = {}
        self._skill_active_index: dict[str, str] = {}

    # ==================================================================
    # 创建 / 查询
    # ==================================================================

    async def create_test(
        self,
        skill_name: str,
        control_version: str,
        treatment_version: str,
        *,
        shadow_ratio: float = _DEFAULT_SHADOW_RATIO,
        min_sample_size: int = _DEFAULT_MIN_SAMPLE_SIZE,
        significance_level: float = _DEFAULT_SIGNIFICANCE_LEVEL,
    ) -> str:
        """创建 A/B 测试(同 skill 已有 running 测试会先标记 stopped)。

        Args:
            skill_name: 被测试的 skill 名
            control_version: 控制组版本(线上稳定版本)
            treatment_version: 实验组版本(候选新版本)
            shadow_ratio: 0-1,treatment 占比,默认 0.1
            min_sample_size: 触发检验的最小样本量,默认 30
            significance_level: α,默认 0.05

        Returns:
            test_id(UUID 字符串)
        """
        if not skill_name or not control_version or not treatment_version:
            raise ValueError("skill_name / control_version / treatment_version 必填")
        if control_version == treatment_version:
            raise ValueError("control_version 不能等于 treatment_version")
        if not (0.0 < shadow_ratio <= 1.0):
            raise ValueError("shadow_ratio 必须在 (0, 1] 区间")

        # 同 skill 已有 running 测试 → 先标记 stopped(不删除,留历史)
        existing_id = self._skill_active_index.get(skill_name)
        if existing_id:
            await self._stop_test_internal(existing_id, reason="superseded")

        test_id = str(_uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()
        test = {
            "testId": test_id,
            "skillName": skill_name,
            "controlVersion": control_version,
            "treatmentVersion": treatment_version,
            "status": "running",
            "shadowRatio": float(shadow_ratio),
            "minSampleSize": int(min_sample_size),
            "significanceLevel": float(significance_level),
            "controlStats": _empty_stats(),
            "treatmentStats": _empty_stats(),
            "decision": None,
            "decisionReason": None,
            "startedAt": now_iso,
            "decidedAt": None,
            "endedAt": None,
        }
        self._tests[test_id] = test
        self._skill_active_index[skill_name] = test_id

        # 持久化到 DB(失败不抛,内存已就绪,后续 flush 兜底)
        await self._persist_test_to_db(test, is_insert=True)
        logger.info(
            "[ab_test_tracker] create_test skill=%s control=%s treatment=%s ratio=%.2f",
            skill_name,
            control_version,
            treatment_version,
            shadow_ratio,
        )
        return test_id

    def get_active_test(self, skill_name: str) -> Optional[dict[str, Any]]:
        """查询某 skill 当前 running 的测试(仅查内存,不查 DB)。

        Returns:
            ABTest dict 的浅拷贝(防止外部误改内存)或 None
        """
        test_id = self._skill_active_index.get(skill_name)
        if not test_id:
            return None
        test = self._tests.get(test_id)
        if not test or test.get("status") != "running":
            return None
        return dict(test)

    def get_test(self, test_id: str) -> Optional[dict[str, Any]]:
        """按 test_id 查询(含历史)。返回浅拷贝或 None。"""
        test = self._tests.get(test_id)
        return dict(test) if test else None

    def list_tests(
        self,
        *,
        status: Optional[str] = None,
        skill_name: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """列出测试(可按 status / skill 过滤,默认按 startedAt 倒序)。

        Returns:
            ABTest dict 浅拷贝列表
        """
        results: list[dict[str, Any]] = []
        for test in self._tests.values():
            if status and test.get("status") != status:
                continue
            if skill_name and test.get("skillName") != skill_name:
                continue
            results.append(dict(test))
        # 按 startedAt 倒序
        results.sort(key=lambda t: t.get("startedAt", ""), reverse=True)
        return results[:limit]

    # ==================================================================
    # 指标累加
    # ==================================================================

    def record_call(
        self,
        test_id: str,
        version: str,
        *,
        success: bool,
        duration_ms: float,
        tokens: int,
    ) -> None:
        """记录一次调用结果到对应版本的 stats。

        Args:
            test_id: 测试 ID
            version: 调用的版本(必须等于 controlVersion 或 treatmentVersion)
            success: 是否成功
            duration_ms: 调用耗时(毫秒)
            tokens: token 用量
        """
        test = self._tests.get(test_id)
        if not test:
            return
        if test.get("status") != "running":
            return  # 测试已结束,不再累加

        if version == test.get("controlVersion"):
            test["controlStats"] = _merge_stats_add(
                test.get("controlStats") or _empty_stats(),
                success,
                float(duration_ms),
                int(tokens),
            )
        elif version == test.get("treatmentVersion"):
            test["treatmentStats"] = _merge_stats_add(
                test.get("treatmentStats") or _empty_stats(),
                success,
                float(duration_ms),
                int(tokens),
            )
        else:
            logger.warning(
                "[ab_test_tracker] record_call 版本不匹配 test=%s version=%s (跳过)",
                test_id,
                version,
            )

    def get_stats(self, test_id: str) -> Optional[dict[str, Any]]:
        """查询某测试的 control/treatment stats 快照。"""
        test = self._tests.get(test_id)
        if not test:
            return None
        return {
            "controlStats": dict(test.get("controlStats") or _empty_stats()),
            "treatmentStats": dict(test.get("treatmentStats") or _empty_stats()),
            "minSampleSize": test.get("minSampleSize"),
            "significanceLevel": test.get("significanceLevel"),
        }

    # ==================================================================
    # 决策 / 终止
    # ==================================================================

    async def mark_decided(
        self,
        test_id: str,
        decision: str,
        reason: str | dict[str, Any],
    ) -> bool:
        """标记测试决策结果(promote / rollback / inconclusive)。

        Args:
            test_id: 测试 ID
            decision: "promote" | "rollback" | "inconclusive"
            reason: 决策原因(字符串或 dict,存为 JSON 字符串到 DB)

        Returns:
            True 表示成功(内存更新成功即视为成功,DB 失败仅 warning)
        """
        if decision not in ("promote", "rollback", "inconclusive"):
            raise ValueError(f"非法 decision: {decision}")
        test = self._tests.get(test_id)
        if not test:
            return False
        if test.get("status") != "running":
            return False  # 已决策 / 已停止的测试不能再决策

        now_iso = datetime.now(timezone.utc).isoformat()
        test["status"] = "promoted" if decision == "promote" else (
            "rolled_back" if decision == "rollback" else "stopped"
        )
        test["decision"] = decision
        test["decisionReason"] = (
            reason if isinstance(reason, str) else json.dumps(reason, ensure_ascii=False)
        )
        test["decidedAt"] = now_iso
        test["endedAt"] = now_iso
        # 从 active index 移除(skill 现在可以创建新测试)
        if self._skill_active_index.get(test.get("skillName", "")) == test_id:
            del self._skill_active_index[test.get("skillName", "")]

        # 持久化到 DB(失败不抛,内存已更新)
        await self._persist_test_to_db(test, is_insert=False)
        logger.info(
            "[ab_test_tracker] mark_decided test=%s decision=%s reason=%s",
            test_id,
            decision,
            test["decisionReason"][:200] if test["decisionReason"] else "",
        )
        return True

    async def stop_test(self, test_id: str, reason: str = "manual") -> bool:
        """手动停止测试(无决策)。"""
        return await self._stop_test_internal(test_id, reason)

    async def _stop_test_internal(self, test_id: str, reason: str) -> bool:
        """内部停止实现(用于 create_test 时停止旧测试 + stop_test)。"""
        test = self._tests.get(test_id)
        if not test:
            return False
        if test.get("status") != "running":
            return False  # 已停止
        now_iso = datetime.now(timezone.utc).isoformat()
        test["status"] = "stopped"
        test["decision"] = "stopped"
        test["decisionReason"] = reason
        test["endedAt"] = now_iso
        if self._skill_active_index.get(test.get("skillName", "")) == test_id:
            del self._skill_active_index[test.get("skillName", "")]
        await self._persist_test_to_db(test, is_insert=False)
        logger.info(
            "[ab_test_tracker] stop_test test=%s reason=%s", test_id, reason
        )
        return True

    # ==================================================================
    # 持久化 / 启动加载
    # ==================================================================

    async def flush_to_db(self, test_id: str) -> bool:
        """显式 flush 单个测试的内存 stats 到 DB。

        由 ABTestScheduler 周期性调用(避免每次 record_call 都写 DB)。
        """
        test = self._tests.get(test_id)
        if not test:
            return False
        return await self._persist_test_to_db(test, is_insert=False)

    async def flush_all_running(self) -> int:
        """flush 所有 running 测试到 DB(ABTestScheduler 周期调用)。

        Returns:
            成功 flush 的测试数
        """
        count = 0
        for test_id, test in list(self._tests.items()):
            if test.get("status") != "running":
                continue
            ok = await self._persist_test_to_db(test, is_insert=False)
            if ok:
                count += 1
        return count

    async def load_active_tests(self, limit: int = 100) -> int:
        """启动时从 DB 全量 hydrate running 测试到内存。

        由 main.py lifespan 调用,失败不阻塞启动(返回 0 + warning)。

        Returns:
            加载到内存的测试数
        """
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT
                           id::text AS test_id,
                           skill_name,
                           control_version,
                           treatment_version,
                           status,
                           shadow_ratio::float AS shadow_ratio,
                           min_sample_size::int AS min_sample_size,
                           significance_level::float AS significance_level,
                           control_stats,
                           treatment_stats,
                           decision,
                           decision_reason,
                           started_at,
                           decided_at,
                           ended_at
                       FROM agent_ab_tests
                       WHERE status = 'running'
                       ORDER BY started_at DESC
                       LIMIT $1""",
                    limit,
                )
        except Exception as e:
            logger.warning(
                "[ab_test_tracker] load_active_tests 失败(降级空内存): %s", e
            )
            return 0

        count = 0
        for row in rows:
            test_id = str(row["test_id"])
            if not test_id or test_id in self._tests:
                continue
            skill_name = str(row["skill_name"])
            # 兜底:同 skill 已有 running → 跳过(避免重复)
            if skill_name in self._skill_active_index:
                continue
            control_stats = row["control_stats"]
            if not isinstance(control_stats, dict):
                control_stats = _empty_stats()
            treatment_stats = row["treatment_stats"]
            if not isinstance(treatment_stats, dict):
                treatment_stats = _empty_stats()
            test = {
                "testId": test_id,
                "skillName": skill_name,
                "controlVersion": str(row["control_version"]),
                "treatmentVersion": str(row["treatment_version"]),
                "status": str(row["status"]),
                "shadowRatio": float(row["shadow_ratio"]),
                "minSampleSize": int(row["min_sample_size"]),
                "significanceLevel": float(row["significance_level"]),
                "controlStats": control_stats,
                "treatmentStats": treatment_stats,
                "decision": row["decision"],
                "decisionReason": row["decision_reason"],
                "startedAt": row["started_at"].isoformat()
                if row["started_at"]
                else None,
                "decidedAt": row["decided_at"].isoformat()
                if row["decided_at"]
                else None,
                "endedAt": row["ended_at"].isoformat()
                if row["ended_at"]
                else None,
            }
            self._tests[test_id] = test
            self._skill_active_index[skill_name] = test_id
            count += 1
        if count:
            logger.info(
                "[ab_test_tracker] load_active_tests 从 DB hydrate %d 条 running 测试",
                count,
            )
        return count

    async def _persist_test_to_db(
        self,
        test: dict[str, Any],
        *,
        is_insert: bool,
    ) -> bool:
        """持久化单条测试到 DB(INSERT 或 UPDATE,失败仅 warning)。

        Args:
            test: ABTest dict
            is_insert: True=INSERT(新建),False=UPDATE(已存在)

        Returns:
            True 表示成功;False 表示 DB 异常(内存已更新,降级成功)
        """
        test_id = test.get("testId")
        if not test_id:
            return False
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                if is_insert:
                    await conn.execute(
                        """INSERT INTO agent_ab_tests
                               (id, skill_name, control_version, treatment_version,
                                status, shadow_ratio, min_sample_size,
                                significance_level, control_stats, treatment_stats,
                                decision, decision_reason, started_at,
                                decided_at, ended_at)
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                                   $11, $12, $13, $14, $15)""",
                        _uuid.UUID(test_id),
                        test.get("skillName", ""),
                        test.get("controlVersion", ""),
                        test.get("treatmentVersion", ""),
                        test.get("status", "running"),
                        float(test.get("shadowRatio", _DEFAULT_SHADOW_RATIO)),
                        int(test.get("minSampleSize", _DEFAULT_MIN_SAMPLE_SIZE)),
                        float(
                            test.get("significanceLevel", _DEFAULT_SIGNIFICANCE_LEVEL)
                        ),
                        json.dumps(
                            test.get("controlStats") or _empty_stats(),
                            ensure_ascii=False,
                        ),
                        json.dumps(
                            test.get("treatmentStats") or _empty_stats(),
                            ensure_ascii=False,
                        ),
                        test.get("decision"),
                        test.get("decisionReason"),
                        # started_at 必须是 datetime,从 ISO 字符串解析
                        _parse_iso(test.get("startedAt")),
                        _parse_iso(test.get("decidedAt")),
                        _parse_iso(test.get("endedAt")),
                    )
                else:
                    await conn.execute(
                        """UPDATE agent_ab_tests SET
                               status = $1,
                               shadow_ratio = $2,
                               min_sample_size = $3,
                               significance_level = $4,
                               control_stats = $5,
                               treatment_stats = $6,
                               decision = $7,
                               decision_reason = $8,
                               decided_at = $9,
                               ended_at = $10
                           WHERE id = $11""",
                        test.get("status", "running"),
                        float(test.get("shadowRatio", _DEFAULT_SHADOW_RATIO)),
                        int(test.get("minSampleSize", _DEFAULT_MIN_SAMPLE_SIZE)),
                        float(
                            test.get("significanceLevel", _DEFAULT_SIGNIFICANCE_LEVEL)
                        ),
                        json.dumps(
                            test.get("controlStats") or _empty_stats(),
                            ensure_ascii=False,
                        ),
                        json.dumps(
                            test.get("treatmentStats") or _empty_stats(),
                            ensure_ascii=False,
                        ),
                        test.get("decision"),
                        test.get("decisionReason"),
                        _parse_iso(test.get("decidedAt")),
                        _parse_iso(test.get("endedAt")),
                        _uuid.UUID(test_id),
                    )
        except Exception as e:
            logger.warning(
                "[ab_test_tracker] _persist_test_to_db 失败(降级仅内存 test=%s): %s",
                test_id,
                e,
            )
            return False
        return True

    # ==================================================================
    # 内部工具
    # ==================================================================

    def get_status(self) -> dict[str, Any]:
        """返回当前 tracker 状态摘要(供 API / 前端查看)。"""
        running_count = sum(
            1 for t in self._tests.values() if t.get("status") == "running"
        )
        total_count = len(self._tests)
        return {
            "totalTests": total_count,
            "runningTests": running_count,
            "activeSkills": list(self._skill_active_index.keys()),
        }


def _parse_iso(iso_str: str | None) -> datetime | None:
    """从 ISO 字符串解析 datetime(用于 DB 写入)。

    asyncpg 接受 aware datetime。失败返回 None。
    """
    if not iso_str:
        return None
    try:
        # Python 3.11+ fromisoformat 支持 'Z' 后缀,但 3.10 不行 → 兜底替换
        s = iso_str.replace("Z", "+00:00") if isinstance(iso_str, str) else iso_str
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception as e:
        logger.warning("ab_test_tracker._parse_iso ISO 解析失败: %s", e, exc_info=True)
        return None


# 全局单例
ab_test_tracker = ABTestTracker()
