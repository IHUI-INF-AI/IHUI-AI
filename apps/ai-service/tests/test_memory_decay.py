"""记忆衰减管理测试(P3 深度层 — 记忆系统三件套之一)。

覆盖 memory_decay.py:
- MemoryDecayManager.compute_decay_state:3 种策略(time / access_frequency / combined)
- MemoryDecayManager._time_score:半衰期公式 0.5^(days/halfLife)
- MemoryDecayManager.apply_decay:批量衰减
- MemoryDecayManager.prune_decayed:清理已衰减
- MemoryDecayManager.is_decayed / record_access:查询 + 访问记录
- MemoryDecayManager._resolve_entries:兼容 UnifiedMemoryClient / list
- _parse_iso:ISO 时间解析(模块函数)
"""

from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.memory_decay import (
    MemoryDecayManager,
    _DEFAULT_CONFIG,
    _parse_iso,
)


# =============================================================================
# compute_decay_state:单条记忆衰减计算
# =============================================================================


class TestComputeDecayState:
    """compute_decay_state:3 种策略 + isDecayed 标记 + 状态写回。"""

    def test_time_strategy_new_memory_full_score(self):
        """time 策略:刚创建的记忆 retentionScore ≈ 1.0。"""
        mgr = MemoryDecayManager()
        now = datetime.now(timezone.utc).isoformat()
        entry = {"id": "e1", "createdAt": now, "updatedAt": now}
        state = mgr.compute_decay_state(entry, {"strategy": "time", "halfLifeDays": 30})
        assert state["entryId"] == "e1"
        assert state["retentionScore"] >= 0.99
        assert state["isDecayed"] is False

    def test_time_strategy_60_days_ago(self):
        """time 策略:60 天前(半衰期 30 天)retentionScore = 0.5^2 = 0.25。"""
        mgr = MemoryDecayManager()
        old = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
        entry = {"id": "e2", "createdAt": old, "updatedAt": old}
        state = mgr.compute_decay_state(entry, {"strategy": "time", "halfLifeDays": 30, "minRetentionScore": 0.2})
        assert 0.2 <= state["retentionScore"] <= 0.26
        assert state["isDecayed"] is False  # 0.25 > 0.2

    def test_time_strategy_very_old_decayed(self):
        """time 策略:200 天前 retentionScore < 0.2 → isDecayed=True。"""
        mgr = MemoryDecayManager()
        old = (datetime.now(timezone.utc) - timedelta(days=200)).isoformat()
        entry = {"id": "e3", "createdAt": old, "updatedAt": old}
        state = mgr.compute_decay_state(entry, {"strategy": "time", "halfLifeDays": 30, "minRetentionScore": 0.2})
        assert state["retentionScore"] < 0.2
        assert state["isDecayed"] is True

    def test_access_frequency_zero_access(self):
        """access_frequency 策略:0 次访问 → retentionScore = 0.5。"""
        mgr = MemoryDecayManager()
        entry = {"id": "e4", "createdAt": "2026-01-01T00:00:00+00:00"}
        state = mgr.compute_decay_state(entry, {"strategy": "access_frequency", "accessBoost": 0.1})
        assert state["retentionScore"] == 0.5

    def test_access_frequency_many_accesses_caps_at_1(self):
        """access_frequency 策略:多次访问 → retentionScore 上限 1.0。"""
        mgr = MemoryDecayManager()
        for _ in range(10):
            mgr.record_access("e5")
        entry = {"id": "e5", "createdAt": "2026-01-01T00:00:00+00:00"}
        state = mgr.compute_decay_state(entry, {"strategy": "access_frequency", "accessBoost": 0.1})
        assert state["retentionScore"] == 1.0
        assert state["accessCount"] == 10

    def test_combined_strategy_fresh_with_access(self):
        """combined 策略:新记忆 + 1 次访问 → capped 1.0。"""
        mgr = MemoryDecayManager()
        now = datetime.now(timezone.utc).isoformat()
        mgr.record_access("e6")
        entry = {"id": "e6", "createdAt": now, "updatedAt": now}
        state = mgr.compute_decay_state(entry, {"strategy": "combined", "halfLifeDays": 30, "accessBoost": 0.1})
        # time_score ≈ 1.0, combined = 1.0 * (1 + 1 * 0.1) = 1.1 → capped 1.0
        assert state["retentionScore"] == 1.0

    def test_combined_strategy_old_no_access(self):
        """combined 策略:旧记忆 + 0 次访问 → time_score 主导。"""
        mgr = MemoryDecayManager()
        old = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
        entry = {"id": "e7", "createdAt": old, "updatedAt": old}
        state = mgr.compute_decay_state(entry, {"strategy": "combined", "halfLifeDays": 30, "accessBoost": 0.1})
        # time_score ≈ 0.25, combined = 0.25 * (1 + 0) = 0.25
        assert 0.2 <= state["retentionScore"] <= 0.26

    def test_config_overrides_default(self):
        """config 覆盖 _DEFAULT_CONFIG(halfLifeDays=1 + minRetentionScore=0.9)。"""
        mgr = MemoryDecayManager()
        old = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        entry = {"id": "e8", "createdAt": old, "updatedAt": old}
        state = mgr.compute_decay_state(entry, {"strategy": "time", "halfLifeDays": 1, "minRetentionScore": 0.9})
        assert state["isDecayed"] is True

    def test_state_written_back(self):
        """compute_decay_state 结果写回 _states。"""
        mgr = MemoryDecayManager()
        entry = {"id": "e9", "createdAt": "2026-01-01T00:00:00+00:00"}
        state = mgr.compute_decay_state(entry, {"strategy": "time"})
        assert "e9" in mgr._states
        assert mgr._states["e9"] == state

    def test_empty_entry_id_no_state_written(self):
        """entry id 为空时不写回 _states。"""
        mgr = MemoryDecayManager()
        entry = {"id": "", "createdAt": "2026-01-01T00:00:00+00:00"}
        state = mgr.compute_decay_state(entry, {"strategy": "time"})
        assert state["entryId"] == ""
        assert "" not in mgr._states

    def test_no_timestamp_defaults_to_full_score(self):
        """无 createdAt/updatedAt 时 lastAccessedAt 用 now → retentionScore ≈ 1.0。"""
        mgr = MemoryDecayManager()
        entry = {"id": "e10"}
        state = mgr.compute_decay_state(entry, {"strategy": "time", "halfLifeDays": 30})
        assert state["retentionScore"] >= 0.99

    def test_prev_state_access_count_used(self):
        """compute_decay_state 读取已存 _states 的 accessCount。"""
        mgr = MemoryDecayManager()
        mgr._states["e11"] = {
            "entryId": "e11",
            "retentionScore": 1.0,
            "lastAccessedAt": datetime.now(timezone.utc).isoformat(),
            "accessCount": 5,
            "isDecayed": False,
        }
        entry = {"id": "e11", "createdAt": "2026-01-01T00:00:00+00:00"}
        state = mgr.compute_decay_state(entry, {"strategy": "access_frequency", "accessBoost": 0.1})
        assert state["accessCount"] == 5
        # 0.5 + 5 * 0.1 = 1.0
        assert state["retentionScore"] == 1.0


# =============================================================================
# _time_score:半衰期公式
# =============================================================================


class TestTimeScore:
    """_time_score:retentionScore = 0.5^(days/halfLifeDays)。"""

    def test_empty_string_returns_1(self):
        """空字符串 → 1.0(新记忆)。"""
        score = MemoryDecayManager._time_score("", 30, datetime.now(timezone.utc))
        assert score == 1.0

    def test_half_life_zero_returns_0(self):
        """halfLifeDays ≤ 0 → 0.0(立即衰减)。"""
        now = datetime.now(timezone.utc)
        score = MemoryDecayManager._time_score("2026-01-01T00:00:00+00:00", 0, now)
        assert score == 0.0

    def test_invalid_format_returns_1(self):
        """非法时间格式 → 1.0(容错)。"""
        score = MemoryDecayManager._time_score("not-a-date", 30, datetime.now(timezone.utc))
        assert score == 1.0

    def test_future_time_returns_1(self):
        """未来时间 → 1.0(days ≤ 0)。"""
        future = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
        score = MemoryDecayManager._time_score(future, 30, datetime.now(timezone.utc))
        assert score == 1.0

    def test_normal_decay(self):
        """30 天前 + 半衰期 30 天 → 0.5。"""
        old = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        score = MemoryDecayManager._time_score(old, 30, datetime.now(timezone.utc))
        assert 0.48 <= score <= 0.52

    def test_naive_datetime_treated_as_utc(self):
        """无时区时间视为 UTC。"""
        old = (datetime.now(timezone.utc) - timedelta(days=30)).replace(tzinfo=None).isoformat()
        score = MemoryDecayManager._time_score(old, 30, datetime.now(timezone.utc))
        assert 0.48 <= score <= 0.52


# =============================================================================
# apply_decay:批量衰减
# =============================================================================


class TestApplyDecay:
    """apply_decay:对用户所有记忆批量计算衰减。"""

    async def test_empty_entries(self):
        """空列表 → {updated: 0, decayed: 0}。"""
        mgr = MemoryDecayManager()
        result = await mgr.apply_decay("user1", {}, memory_client=[])
        assert result == {"updated": 0, "decayed": 0}

    async def test_none_client(self):
        """memory_client=None → 空列表。"""
        mgr = MemoryDecayManager()
        result = await mgr.apply_decay("user1", {}, memory_client=None)
        assert result == {"updated": 0, "decayed": 0}

    async def test_list_client(self):
        """memory_client 为 list → 直接遍历。"""
        mgr = MemoryDecayManager()
        now = datetime.now(timezone.utc).isoformat()
        entries = [
            {"id": "a", "createdAt": now, "updatedAt": now},
            {"id": "b", "createdAt": "2026-01-01T00:00:00+00:00", "updatedAt": "2026-01-01T00:00:00+00:00"},
        ]
        result = await mgr.apply_decay("user1", {"strategy": "time", "halfLifeDays": 30, "minRetentionScore": 0.2}, memory_client=entries)
        assert result["updated"] == 2
        assert result["decayed"] >= 0

    async def test_unified_memory_client(self):
        """memory_client 为 UnifiedMemoryClient → 调 get_entries。"""
        mgr = MemoryDecayManager()
        now = datetime.now(timezone.utc).isoformat()
        client = MagicMock()
        client.get_entries = AsyncMock(return_value=[
            {"id": "x", "createdAt": now, "updatedAt": now},
        ])
        result = await mgr.apply_decay("user1", {"strategy": "time"}, memory_client=client)
        assert result["updated"] == 1
        client.get_entries.assert_awaited_once_with("user1", scope="user")

    async def test_unified_memory_client_exception_returns_empty(self):
        """get_entries 抛异常 → 返回空列表。"""
        mgr = MemoryDecayManager()
        client = MagicMock()
        client.get_entries = AsyncMock(side_effect=RuntimeError("db down"))
        result = await mgr.apply_decay("user1", {"strategy": "time"}, memory_client=client)
        assert result == {"updated": 0, "decayed": 0}

    async def test_non_dict_entries_skipped(self):
        """非字典条目被跳过。"""
        mgr = MemoryDecayManager()
        entries = ["not-dict", 42, None, {"id": "ok", "createdAt": "2026-01-01T00:00:00+00:00"}]
        result = await mgr.apply_decay("user1", {"strategy": "time"}, memory_client=entries)
        assert result["updated"] == 1


# =============================================================================
# prune_decayed:清理已衰减
# =============================================================================


class TestPruneDecayed:
    """prune_decayed:标记/删除已衰减记忆。"""

    async def test_prune_below_threshold(self):
        """retentionScore < threshold → 标记 isDecayed。"""
        mgr = MemoryDecayManager()
        old = (datetime.now(timezone.utc) - timedelta(days=200)).isoformat()
        entries = [{"id": "p1", "createdAt": old, "updatedAt": old}]
        # 先计算衰减
        await mgr.apply_decay("u", {"strategy": "time", "halfLifeDays": 30}, memory_client=entries)
        result = await mgr.prune_decayed("u", threshold=0.5, memory_client=entries)
        assert result["pruned"] == 1
        assert mgr.is_decayed("p1") is True

    async def test_prune_no_state_uses_default(self):
        """未计算过衰减的条目用默认配置算一次。"""
        mgr = MemoryDecayManager()
        now = datetime.now(timezone.utc).isoformat()
        entries = [{"id": "p2", "createdAt": now, "updatedAt": now}]
        result = await mgr.prune_decayed("u", threshold=0.01, memory_client=entries)
        # 新记忆 retentionScore ≈ 1.0 > 0.01 → 不 prune
        assert result["pruned"] == 0

    async def test_prune_empty(self):
        """空列表 → pruned=0。"""
        mgr = MemoryDecayManager()
        result = await mgr.prune_decayed("u", threshold=0.5, memory_client=[])
        assert result["pruned"] == 0

    async def test_prune_non_dict_skipped(self):
        """非字典条目跳过。"""
        mgr = MemoryDecayManager()
        entries = ["x", None, 42]
        result = await mgr.prune_decayed("u", threshold=0.5, memory_client=entries)
        assert result["pruned"] == 0


# =============================================================================
# is_decayed / record_access
# =============================================================================


class TestIsDecayedRecordAccess:
    """is_decayed + record_access:查询 + 访问记录。"""

    def test_is_decayed_unknown_returns_false(self):
        """未记录的 entry → False。"""
        mgr = MemoryDecayManager()
        assert mgr.is_decayed("unknown") is False

    def test_is_decayed_empty_id_returns_false(self):
        """空 id → False。"""
        mgr = MemoryDecayManager()
        assert mgr.is_decayed("") is False

    def test_is_decayed_after_compute(self):
        """compute_decay_state 后查询一致。"""
        mgr = MemoryDecayManager()
        old = (datetime.now(timezone.utc) - timedelta(days=200)).isoformat()
        entry = {"id": "d1", "createdAt": old, "updatedAt": old}
        mgr.compute_decay_state(entry, {"strategy": "time", "halfLifeDays": 30, "minRetentionScore": 0.2})
        assert mgr.is_decayed("d1") is True

    def test_record_access_increments_count(self):
        """record_access 增加 accessCount。"""
        mgr = MemoryDecayManager()
        mgr.record_access("r1")
        mgr.record_access("r1")
        assert mgr._states["r1"]["accessCount"] == 2

    def test_record_access_clears_decayed(self):
        """record_access 清除 isDecayed 标记。"""
        mgr = MemoryDecayManager()
        mgr._states["r2"] = {
            "entryId": "r2", "retentionScore": 0.1,
            "lastAccessedAt": "2026-01-01T00:00:00+00:00",
            "accessCount": 0, "isDecayed": True,
        }
        mgr.record_access("r2")
        assert mgr._states["r2"]["isDecayed"] is False
        assert mgr._states["r2"]["accessCount"] == 1

    def test_record_access_empty_id_noop(self):
        """空 id → 不操作。"""
        mgr = MemoryDecayManager()
        mgr.record_access("")
        assert "" not in mgr._states

    def test_record_access_creates_new_state(self):
        """record_access 对未记录的 entry 创建新状态。"""
        mgr = MemoryDecayManager()
        mgr.record_access("r3")
        assert "r3" in mgr._states
        assert mgr._states["r3"]["accessCount"] == 1
        assert mgr._states["r3"]["isDecayed"] is False


# =============================================================================
# _parse_iso:ISO 时间解析(模块函数)
# =============================================================================


class TestParseIso:
    """_parse_iso:ISO 时间字符串解析。"""

    def test_valid_with_timezone(self):
        """带时区的 ISO 字符串。"""
        result = _parse_iso("2026-07-22T10:00:00+00:00")
        assert result is not None
        assert result.year == 2026
        assert result.tzinfo is not None

    def test_valid_with_z_suffix(self):
        """带 Z 后缀。"""
        result = _parse_iso("2026-07-22T10:00:00Z")
        assert result is not None
        assert result.tzinfo is not None

    def test_naive_datetime_gets_utc(self):
        """无时区时间添加 UTC。"""
        result = _parse_iso("2026-07-22T10:00:00")
        assert result is not None
        assert result.tzinfo == timezone.utc

    def test_empty_string_returns_none(self):
        """空字符串 → None。"""
        assert _parse_iso("") is None

    def test_invalid_format_returns_none(self):
        """非法格式 → None。"""
        assert _parse_iso("not-a-date") is None
        assert _parse_iso("2026/07/22") is None

    def test_none_returns_none(self):
        """None → None。"""
        assert _parse_iso(None) is None  # type: ignore[arg-type]


# =============================================================================
# _DEFAULT_CONFIG 默认值
# =============================================================================


class TestDefaultConfig:
    """_DEFAULT_CONFIG 默认衰减配置。"""

    def test_default_strategy_is_combined(self):
        assert _DEFAULT_CONFIG["strategy"] == "combined"

    def test_default_half_life_30_days(self):
        assert _DEFAULT_CONFIG["halfLifeDays"] == 30

    def test_default_min_retention_02(self):
        assert _DEFAULT_CONFIG["minRetentionScore"] == 0.2

    def test_default_access_boost_01(self):
        assert _DEFAULT_CONFIG["accessBoost"] == 0.1
