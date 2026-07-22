"""Skill 使用反馈追踪(P3-2,对标 Hermes Agent 使用反馈追踪)。

记录每次 skill 使用情况(成功/失败/满意度/耗时),聚合统计,返回最近失败案例供迭代。
存储优先 Redis(key: skill:feedback:<name> / skill:iter:<name>),降级为内存 dict。
类型契约对齐 packages/types/src/agent-runtime.ts 的
SkillUsageFeedback / SkillUsageStats。
"""

import json
import logging
import os
import re
from typing import Any

from ..core.config import settings

# redis 包未安装时降级为纯内存模式(与 services/memory.py 同源)
try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)


class SkillFeedbackTracker:
    """Skill 使用反馈追踪器。Redis 优先,降级为内存。"""

    def __init__(self) -> None:
        # 内存降级:{skill_name: [feedback, ...]}
        self._store: dict[str, list[dict[str, Any]]] = {}
        # 迭代历史内存降级:{skill_name: [iter_record, ...]}
        self._iter_store: dict[str, list[dict[str, Any]]] = {}
        self._redis: Any = None
        self._use_redis = bool(settings.redis_url) and aioredis is not None

    async def _get_redis(self) -> Any:
        """获取 Redis 客户端,连接失败时降级为内存模式。"""
        if self._redis is None and self._use_redis:
            try:
                self._redis = aioredis.from_url(
                    settings.redis_url, decode_responses=True
                )
                await self._redis.ping()
            except Exception as e:
                logger.warning("Redis 连接失败,降级内存模式: %s", e)
                self._use_redis = False
                self._redis = None
        return self._redis

    @staticmethod
    def _fb_key(skill_name: str) -> str:
        """反馈列表 Redis key。"""
        return f"skill:feedback:{skill_name}"

    @staticmethod
    def _iter_key(skill_name: str) -> str:
        """迭代历史 Redis key。"""
        return f"skill:iter:{skill_name}"

    async def record_usage(self, feedback: dict[str, Any]) -> None:
        """记录单次 skill 使用反馈。

        Args:
            feedback: SkillUsageFeedback 字典
                (skillName/taskId/usedAt/success/userSatisfaction?/durationMs/failureReason?)。
        """
        skill_name = str(feedback.get("skillName", ""))
        if not skill_name:
            return
        record = {
            "skillName": skill_name,
            "taskId": str(feedback.get("taskId", "")),
            "usedAt": str(feedback.get("usedAt", "")),
            "success": bool(feedback.get("success", False)),
            "durationMs": int(feedback.get("durationMs", 0) or 0),
        }
        if "userSatisfaction" in feedback:
            record["userSatisfaction"] = float(feedback["userSatisfaction"])
        if "failureReason" in feedback:
            record["failureReason"] = str(feedback["failureReason"])

        redis = await self._get_redis()
        if redis:
            await redis.rpush(self._fb_key(skill_name), json.dumps(record, ensure_ascii=False))
        else:
            self._store.setdefault(skill_name, []).append(record)

    async def _get_all_feedback(self, skill_name: str) -> list[dict[str, Any]]:
        """读取全部使用反馈记录。"""
        redis = await self._get_redis()
        if redis:
            raw = await redis.lrange(self._fb_key(skill_name), 0, -1)
            records: list[dict[str, Any]] = []
            for r in raw:
                try:
                    records.append(json.loads(r))
                except (json.JSONDecodeError, TypeError):
                    continue
            return records
        return list(self._store.get(skill_name, []))

    async def get_stats(self, skill_name: str) -> dict[str, Any]:
        """聚合使用统计(SkillUsageStats)。

        currentVersion 从 skill 文件 frontmatter 读取;
        iterationHistory 从 Redis/内存迭代记录读取。
        """
        records = await self._get_all_feedback(skill_name)
        total = len(records)
        success = sum(1 for r in records if r.get("success"))
        sat_values = [
            float(r["userSatisfaction"])
            for r in records
            if r.get("userSatisfaction") is not None
        ]
        durations = [int(r.get("durationMs", 0) or 0) for r in records]
        last_used = max(
            (str(r.get("usedAt", "")) for r in records if r.get("usedAt")),
            default="",
        )
        current_version = self._read_skill_version(skill_name)
        iter_history = await self._get_iteration_history(skill_name)
        return {
            "skillName": skill_name,
            "totalUses": total,
            "successCount": success,
            "successRate": (success / total) if total > 0 else 0.0,
            "avgSatisfaction": (sum(sat_values) / len(sat_values)) if sat_values else 0.0,
            "avgDurationMs": (sum(durations) / len(durations)) if durations else 0,
            "lastUsedAt": last_used,
            "currentVersion": current_version,
            "iterationHistory": iter_history,
        }

    async def get_failure_cases(
        self, skill_name: str, limit: int = 5
    ) -> list[dict[str, Any]]:
        """返回最近 N 个失败案例(供迭代改进)。"""
        records = await self._get_all_feedback(skill_name)
        failures = [r for r in records if not r.get("success")]
        # 取最近 limit 个(列表尾部为最新)
        recent = failures[-limit:] if limit > 0 else failures
        # 反转为时间倒序(最新在前),便于 LLM 优先看最近失败
        return list(reversed(recent))

    @staticmethod
    def _read_skill_version(skill_name: str) -> str:
        """从 skill 文件 frontmatter 读取 version(找不到返回 '1.0.0')。"""
        try:
            from .skills import SkillRegistry

            auto_dir = SkillRegistry._auto_dir()
            skill_path = os.path.join(auto_dir, f"{skill_name}.md")
            if not os.path.isfile(skill_path):
                return "1.0.0"
            with open(skill_path, "r", encoding="utf-8") as f:
                content = f.read()
            # frontmatter 已被 _parse_skill_md 拆分,这里直接正则提取 version
            match = re.search(r"^version:\s*(.+?)\s*$", content, re.MULTILINE)
            return match.group(1) if match else "1.0.0"
        except Exception:
            return "1.0.0"

    async def record_iteration(
        self,
        skill_name: str,
        iteration: dict[str, Any],
    ) -> None:
        """记录一次迭代历史(供 get_stats 读取 iterationHistory)。

        Args:
            iteration: {version/iteratedAt/reason/previousPassRate/newPassRate}
        """
        if not skill_name:
            return
        record = {
            "version": str(iteration.get("version", "")),
            "iteratedAt": str(iteration.get("iteratedAt", "")),
            "reason": str(iteration.get("reason", "")),
            "previousPassRate": float(iteration.get("previousPassRate", 0.0) or 0.0),
            "newPassRate": float(iteration.get("newPassRate", 0.0) or 0.0),
        }
        redis = await self._get_redis()
        if redis:
            await redis.rpush(
                self._iter_key(skill_name), json.dumps(record, ensure_ascii=False)
            )
        else:
            self._iter_store.setdefault(skill_name, []).append(record)

    async def _get_iteration_history(
        self, skill_name: str
    ) -> list[dict[str, Any]]:
        """读取迭代历史(时间正序)。"""
        redis = await self._get_redis()
        if redis:
            raw = await redis.lrange(self._iter_key(skill_name), 0, -1)
            history: list[dict[str, Any]] = []
            for r in raw:
                try:
                    history.append(json.loads(r))
                except (json.JSONDecodeError, TypeError):
                    continue
            return history
        return list(self._iter_store.get(skill_name, []))


skill_feedback_tracker = SkillFeedbackTracker()
