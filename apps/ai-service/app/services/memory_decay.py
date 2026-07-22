"""记忆衰减遗忘管理(对标 Hermes Agent 衰减遗忘)。

三种衰减策略:
- time:             retentionScore = 0.5^(days_since_last_access / halfLifeDays)
- access_frequency: retentionScore = min(1.0, 0.5 + accessCount * accessBoost)
- combined:         retentionScore = time_score * (1 + accessCount * accessBoost),上限 1.0

衰减状态内存存储:dict[entry_id -> MemoryDecayState]。
对齐 packages/types 的 MemoryDecayState / MemoryDecayConfig 契约。
"""

from datetime import datetime, timezone
from typing import Any

# 默认衰减配置(对齐 agent-runtime.ts MemoryDecayConfig)
_DEFAULT_CONFIG: dict[str, Any] = {
    "strategy": "combined",        # time | access_frequency | combined
    "halfLifeDays": 30,            # time 策略半衰期
    "minRetentionScore": 0.2,      # 低于此值标记 isDecayed
    "accessBoost": 0.1,            # 每次访问加分
}


class MemoryDecayManager:
    """管理记忆衰减:计算衰减分数 + 标记/清理已衰减记忆。"""

    def __init__(self) -> None:
        # entry_id -> MemoryDecayState(内存存储)
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
            return 0.5 ** (days / half_life_days)
        except Exception:
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
        return {"updated": updated, "decayed": decayed}

    async def prune_decayed(
        self,
        user_id: str,
        threshold: float,
        memory_client: Any = None,
    ) -> dict[str, Any]:
        """标记/删除已衰减记忆(默认只标记 isDecayed=true,不删除)。

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
        return {"pruned": pruned}

    # ==================================================================
    # 兼容 MemorySystem 现有调用
    # ==================================================================

    def is_decayed(self, entry_id: str) -> bool:
        """查询某条记忆是否已衰减(同步,供检索时过滤用)。"""
        if not entry_id:
            return False
        state = self._states.get(entry_id)
        if state is None:
            return False
        return bool(state.get("isDecayed", False))

    def record_access(self, entry_id: str) -> None:
        """记录一次访问(同步,供检索命中后调用,更新 accessCount + lastAccessedAt)。"""
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
            except Exception:
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
