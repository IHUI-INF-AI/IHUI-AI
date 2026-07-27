"""记忆衰减遗忘管理(对标 Hermes Agent 衰减遗忘)。

三种衰减策略:
- time:             retentionScore = 0.5^(days_since_last_access / halfLifeDays)
- access_frequency: retentionScore = min(1.0, 0.5 + accessCount * accessBoost)
- combined:         retentionScore = time_score * (1 + accessCount * accessBoost),上限 1.0

L2-3(2026-07-25 立):衰减状态持久化到 PostgreSQL(agent_memory_decay_state 表),
进程重启不丢失内存中的衰减数据。启动时由 lifespan 调 load_all_states() 全量 hydrate,
运行时 apply_decay / prune_decayed / record_access_async 增量 UPSERT 同步。
DB 异常降级:仅写内存,不阻塞主流程。

对齐 packages/types 的 MemoryDecayState / MemoryDecayConfig 契约。
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg

from ..core.config import settings

logger = logging.getLogger(__name__)

# 默认衰减配置(对齐 agent-runtime.ts MemoryDecayConfig)
_DEFAULT_CONFIG: dict[str, Any] = {
    "strategy": "combined",        # time | access_frequency | combined
    "halfLifeDays": 30,            # time 策略半衰期
    "minRetentionScore": 0.2,      # 低于此值标记 isDecayed
    "accessBoost": 0.1,            # 每次访问加分
}

# 全局连接池(与 memory_service._pool / llm_gateway._pool 独立,避免互相影响)
_pool: Optional[asyncpg.Pool] = None


async def _get_pool() -> asyncpg.Pool:
    """获取 asyncpg 连接池(懒初始化,与 memory_service 独立避免循环导入)。"""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=1,
            max_size=5,
            command_timeout=10,
        )
    return _pool


class MemoryDecayManager:
    """管理记忆衰减:计算衰减分数 + 标记/清理已衰减记忆。

    L2-3:状态持久化到 agent_memory_decay_state 表,重启不丢失。
    """

    def __init__(self) -> None:
        # entry_id -> MemoryDecayState(内存存储,DB hydrate + 写穿)
        self._states: dict[str, dict[str, Any]] = {}

    # ==================================================================
    # 单条记忆衰减计算
    # ==================================================================

    def compute_decay_state(
        self,
        entry: dict[str, Any],
        config: dict[str, Any],
    ) -> dict[str, Any]:
        """计算单条记忆的衰减状态。

        Args:
            entry:  记忆条目(含 id / createdAt / updatedAt / accessCount 等)
            config: 衰减配置(strategy / halfLifeDays / minRetentionScore / accessBoost)

        Returns:
            MemoryDecayState 字典:
            {entryId, retentionScore, lastAccessedAt, accessCount, isDecayed}
        """
        cfg = {**_DEFAULT_CONFIG, **(config or {})}
        strategy = str(cfg.get("strategy", "combined"))
        half_life = float(cfg.get("halfLifeDays", 30))
        min_score = float(cfg.get("minRetentionScore", 0.2))
        boost = float(cfg.get("accessBoost", 0.1))

        entry_id = str(entry.get("id", ""))
        # 读取已有状态(若有),否则从 entry 初始化
        prev_state = self._states.get(entry_id, {})
        access_count = int(prev_state.get("accessCount", 0))
        last_accessed = (
            prev_state.get("lastAccessedAt")
            or str(entry.get("updatedAt") or entry.get("createdAt") or "")
        )

        now = datetime.now(timezone.utc)
        retention = 1.0

        if strategy == "time":
            retention = self._time_score(last_accessed, half_life, now)
        elif strategy == "access_frequency":
            retention = min(1.0, 0.5 + access_count * boost)
        else:  # combined
            t_score = self._time_score(last_accessed, half_life, now)
            retention = min(1.0, t_score * (1.0 + access_count * boost))

        is_decayed = retention < min_score

        state = {
            "entryId": entry_id,
            "retentionScore": round(retention, 4),
            "lastAccessedAt": last_accessed or now.isoformat(),
            "accessCount": access_count,
            "isDecayed": is_decayed,
        }
        # 写回内存状态
        if entry_id:
            self._states[entry_id] = state
        return state

    @staticmethod
    def _time_score(
        last_accessed_at: str,
        half_life_days: float,
        now: datetime,
    ) -> float:
        """time 策略:retentionScore = 0.5^(days_since_last_access / halfLifeDays)。"""
        if not last_accessed_at:
            return 1.0  # 无访问记录,视为满分(新记忆)
        if half_life_days <= 0:
            return 0.0
        try:
            last = _parse_iso(last_accessed_at)
            if last is None:
                return 1.0
            days = (now - last).total_seconds() / 86400.0
            if days <= 0:
                return 1.0
            return float(0.5 ** (days / half_life_days))
        except Exception as e:
            logger.warning("memory_decay._time_score 衰减分数计算失败: %s", e, exc_info=True)
            return 1.0

    # ==================================================================
    # 批量衰减
    # ==================================================================

    async def apply_decay(
        self,
        user_id: str,
        config: dict[str, Any],
        memory_client: Any = None,
    ) -> dict[str, Any]:
        """对用户所有记忆批量计算衰减状态。

        L2-3:计算完成后写穿 DB(agent_memory_decay_state),重启不丢失。

        Args:
            user_id:       用户 ID
            config:        衰减配置
            memory_client: UnifiedMemoryClient 或 entries 列表(兼容现有调用)

        Returns:
            {"updated": N, "decayed": M}
        """
        entries = await self._resolve_entries(memory_client, user_id)
        updated = 0
        decayed = 0
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            state = self.compute_decay_state(entry, config)
            updated += 1
            if state.get("isDecayed"):
                decayed += 1
            # L2-3:写穿 DB(失败不阻塞主流程)
            await self._persist_state(state, user_id=user_id)
        return {"updated": updated, "decayed": decayed}

    async def prune_decayed(
        self,
        user_id: str,
        threshold: float,
        memory_client: Any = None,
    ) -> dict[str, Any]:
        """标记/删除已衰减记忆(默认只标记 isDecayed=true,不删除)。

        L2-3:标记后写穿 DB(is_decayed=true),重启后仍生效。

        Args:
            user_id:       用户 ID
            threshold:     衰减阈值(< 此值视为已衰减)
            memory_client: UnifiedMemoryClient 或 entries 列表

        Returns:
            {"pruned": N}
        """
        entries = await self._resolve_entries(memory_client, user_id)
        pruned = 0
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            entry_id = str(entry.get("id", ""))
            state = self._states.get(entry_id)
            if state is None:
                # 未计算过衰减,用默认配置算一次
                state = self.compute_decay_state(entry, _DEFAULT_CONFIG)
            score = float(state.get("retentionScore", 1.0))
            if score < threshold:
                state["isDecayed"] = True
                if entry_id:
                    self._states[entry_id] = state
                pruned += 1
                # L2-3:写穿 DB(失败不阻塞主流程)
                await self._persist_state(state, user_id=user_id)
        return {"pruned": pruned}

    # ==================================================================
    # 兼容 MemorySystem 现有调用
    # ==================================================================

    def is_decayed(self, entry_id: str) -> bool:
        """查询某条记忆是否已衰减(同步,供检索时过滤用)。

        L2-3:仅读内存(启动时由 lifespan 全量 hydrate,运行时由 apply_decay 增量同步)。
        若内存未命中,返回 False(避免阻塞主流程的同步 DB 查询);真正的衰减状态
        会在下一次 apply_decay / prune_decayed 调用时重建并写穿 DB。
        """
        if not entry_id:
            return False
        state = self._states.get(entry_id)
        if state is None:
            return False
        return bool(state.get("isDecayed", False))

    def record_access(self, entry_id: str) -> None:
        """记录一次访问(同步,供检索命中后调用,更新 accessCount + lastAccessedAt)。

        L2-3:仅写内存(同步方法不能 await DB);DB 持久化由 record_access_async
        异步版本完成,或在下一次 apply_decay 调用时整体写穿。
        """
        if not entry_id:
            return
        state = self._states.get(entry_id, {
            "entryId": entry_id,
            "retentionScore": 1.0,
            "lastAccessedAt": datetime.now(timezone.utc).isoformat(),
            "accessCount": 0,
            "isDecayed": False,
        })
        state["accessCount"] = int(state.get("accessCount", 0)) + 1
        state["lastAccessedAt"] = datetime.now(timezone.utc).isoformat()
        # 重新访问后清除衰减标记
        state["isDecayed"] = False
        self._states[entry_id] = state

    async def record_access_async(
        self,
        entry_id: str,
        user_id: str | None = None,
    ) -> None:
        """L2-3:异步版本 record_access,写穿 DB。

        供 MemorySystem.retrieve 异步上下文调用,确保访问计数 + lastAccessedAt
        持久化,重启后访问统计不丢失。

        Args:
            entry_id: 记忆条目 ID
            user_id:  用户 ID(可选,用于按用户清理)
        """
        if not entry_id:
            return
        self.record_access(entry_id)
        state = self._states.get(entry_id)
        if state is not None:
            await self._persist_state(state, user_id=user_id)

    # ==================================================================
    # L2-3:持久化层(DB hydrate / UPSERT / delete)
    # ==================================================================

    async def load_all_states(self) -> int:
        """启动时从 DB 全量 hydrate 衰减状态到内存。

        由 main.py lifespan 调用,失败不阻塞启动(返回 0 + warning)。

        Returns:
            加载到内存的状态条数
        """
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT entry_id, retention_score::text, last_accessed_at,
                              access_count, is_decayed
                       FROM agent_memory_decay_state"""
                )
        except Exception as e:
            logger.warning("[memory_decay] load_all_states 失败(降级空内存): %s", e)
            return 0
        count = 0
        for row in rows:
            entry_id = str(row["entry_id"])
            if not entry_id:
                continue
            self._states[entry_id] = {
                "entryId": entry_id,
                "retentionScore": float(row["retention_score"]),
                "lastAccessedAt": (
                    row["last_accessed_at"].isoformat()
                    if row["last_accessed_at"]
                    else datetime.now(timezone.utc).isoformat()
                ),
                "accessCount": int(row["access_count"]),
                "isDecayed": bool(row["is_decayed"]),
            }
            count += 1
        return count

    async def load_states_for_user(self, user_id: str) -> int:
        """按用户从 DB 加载衰减状态到内存(按需 hydrate,避免全表扫描)。

        Args:
            user_id: 用户 ID

        Returns:
            加载到内存的状态条数
        """
        if not user_id:
            return 0
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT entry_id, retention_score::text, last_accessed_at,
                              access_count, is_decayed
                       FROM agent_memory_decay_state
                       WHERE user_id = $1""",
                    _parse_uuid(user_id),
                )
        except Exception as e:
            logger.warning(
                "[memory_decay] load_states_for_user 失败(user=%s 降级空): %s",
                user_id, e,
            )
            return 0
        count = 0
        for row in rows:
            entry_id = str(row["entry_id"])
            if not entry_id:
                continue
            self._states[entry_id] = {
                "entryId": entry_id,
                "retentionScore": float(row["retention_score"]),
                "lastAccessedAt": (
                    row["last_accessed_at"].isoformat()
                    if row["last_accessed_at"]
                    else datetime.now(timezone.utc).isoformat()
                ),
                "accessCount": int(row["access_count"]),
                "isDecayed": bool(row["is_decayed"]),
            }
            count += 1
        return count

    async def _persist_state(
        self,
        state: dict[str, Any],
        user_id: str | None = None,
    ) -> None:
        """UPSERT 单条衰减状态到 DB(失败不抛错,仅 warning)。

        Args:
            state:  MemoryDecayState 字典
                    (entryId / retentionScore / lastAccessedAt / accessCount / isDecayed)
            user_id: 用户 ID(可选,用于按用户清理;None 时写 NULL)
        """
        entry_id = str(state.get("entryId", ""))
        if not entry_id:
            return
        try:
            retention = float(state.get("retentionScore", 1.0))
            last_accessed_raw = state.get("lastAccessedAt")
            last_dt = _parse_iso(last_accessed_raw) if last_accessed_raw else None
            access_count = int(state.get("accessCount", 0))
            is_decayed = bool(state.get("isDecayed", False))
            user_uuid = _parse_uuid(user_id) if user_id else None

            pool = await _get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO agent_memory_decay_state
                           (entry_id, user_id, retention_score, last_accessed_at,
                            access_count, is_decayed)
                       VALUES ($1, $2, $3, $4, $5, $6)
                       ON CONFLICT (entry_id) DO UPDATE SET
                           user_id = EXCLUDED.user_id,
                           retention_score = EXCLUDED.retention_score,
                           last_accessed_at = EXCLUDED.last_accessed_at,
                           access_count = EXCLUDED.access_count,
                           is_decayed = EXCLUDED.is_decayed,
                           updated_at = NOW()""",
                    entry_id,
                    user_uuid,
                    retention,
                    last_dt,
                    access_count,
                    is_decayed,
                )
        except Exception as e:
            logger.warning(
                "[memory_decay] _persist_state 失败(entry=%s 降级仅写内存): %s",
                entry_id, e,
            )

    async def _load_state(self, entry_id: str) -> dict[str, Any] | None:
        """从 DB 单条查询衰减状态(供 lazy load,未命中返回 None)。

        Args:
            entry_id: 记忆条目 ID

        Returns:
            MemoryDecayState 字典 或 None(未持久化或 DB 异常)
        """
        if not entry_id:
            return None
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """SELECT entry_id, retention_score::text, last_accessed_at,
                              access_count, is_decayed
                       FROM agent_memory_decay_state
                       WHERE entry_id = $1""",
                    entry_id,
                )
        except Exception as e:
            logger.warning(
                "[memory_decay] _load_state 失败(entry=%s): %s", entry_id, e
            )
            return None
        if row is None:
            return None
        return {
            "entryId": str(row["entry_id"]),
            "retentionScore": float(row["retention_score"]),
            "lastAccessedAt": (
                row["last_accessed_at"].isoformat()
                if row["last_accessed_at"]
                else datetime.now(timezone.utc).isoformat()
            ),
            "accessCount": int(row["access_count"]),
            "isDecayed": bool(row["is_decayed"]),
        }

    async def delete_state(self, entry_id: str) -> None:
        """删除单条衰减状态(供 delete_episodic / delete_semantic 联动清理孤儿状态)。

        Args:
            entry_id: 记忆条目 ID
        """
        if not entry_id:
            return
        # 同步清理内存
        self._states.pop(entry_id, None)
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    "DELETE FROM agent_memory_decay_state WHERE entry_id = $1",
                    entry_id,
                )
        except Exception as e:
            logger.warning(
                "[memory_decay] delete_state 失败(entry=%s): %s", entry_id, e
            )

    # ==================================================================
    # 内部工具
    # ==================================================================

    @staticmethod
    async def _resolve_entries(memory_client: Any, user_id: str) -> list[dict[str, Any]]:
        """解析 memory_client:若为 UnifiedMemoryClient 则调 get_entries,否则视为 entries 列表。"""
        if memory_client is None:
            return []
        # UnifiedMemoryClient 实例:调 get_entries
        if hasattr(memory_client, "get_entries"):
            try:
                result = await memory_client.get_entries(user_id, scope="user")
                return result if isinstance(result, list) else []
            except Exception as e:
                logger.warning("memory_decay._resolve_entries 获取记忆条目失败: %s", e, exc_info=True)
                return []
        # 兼容:直接传入 entries 列表
        if isinstance(memory_client, list):
            return memory_client
        return []


def _parse_iso(ts: str) -> datetime | None:
    """解析 ISO 时间字符串(容错,支持带/不带时区)。"""
    if not ts:
        return None
    try:
        # 兼容形如 2026-07-22T10:00:00 与 2026-07-22T10:00:00+00:00
        s = ts.strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def _parse_uuid(value: Any) -> Any:
    """把字符串/uuid 转为 asyncpg 接受的 uuid 类型(失败返回 None)。

    asyncpg 对 uuid 字段要求严格,字符串必须能 cast 为 uuid;非 uuid 格式返回 None
    让 DB 写 NULL(避免抛 invalid input syntax for type uuid)。
    """
    if value is None:
        return None
    try:
        import uuid as _uuid

        if isinstance(value, _uuid.UUID):
            return value
        s = str(value).strip()
        if not s:
            return None
        return _uuid.UUID(s)
    except (ValueError, TypeError):
        return None


# 全局单例(供 main.py lifespan 引用 + 测试 patch)
memory_decay_manager = MemoryDecayManager()
