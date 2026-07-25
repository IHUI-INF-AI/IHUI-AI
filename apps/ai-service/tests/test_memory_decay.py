"""记忆衰减管理测试(P3 深度层 — 记忆系统三件套之一)。

覆盖 memory_decay.py:
- MemoryDecayManager.compute_decay_state:3 种策略(time / access_frequency / combined)
- MemoryDecayManager._time_score:半衰期公式 0.5^(days/halfLife)
- MemoryDecayManager.apply_decay:批量衰减
- MemoryDecayManager.prune_decayed:清理已衰减
- MemoryDecayManager.is_decayed / record_access:查询 + 访问记录
- MemoryDecayManager._resolve_entries:兼容 UnifiedMemoryClient / list
- _parse_iso:ISO 时间解析(模块函数)
- L2-3 持久化层:_persist_state / _load_state / load_all_states / load_states_for_user
  / delete_state / record_access_async / apply_decay 写穿 / prune_decayed 写穿
"""

from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import memory_decay as md_module
from app.services.memory_decay import (
    MemoryDecayManager,
    _DEFAULT_CONFIG,
    _parse_iso,
    _parse_uuid,
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


# =============================================================================
# L2-3 持久化层:DB hydrate / UPSERT / delete / write-through(2026-07-25 立)
# =============================================================================

import uuid as _uuid  # noqa: E402

from app.services.memory_decay import memory_decay_manager  # noqa: E402


class FakeRecord:
    """模拟 asyncpg.Record(支持 __getitem__)。"""

    def __init__(self, data: dict) -> None:
        self._data = data

    def __getitem__(self, key: str):
        return self._data[key]


def _decay_row(
    entry_id: str = "e1",
    retention_score: float = 0.8,
    last_accessed_at: datetime | None = None,
    access_count: int = 5,
    is_decayed: bool = False,
) -> FakeRecord:
    """构造 agent_memory_decay_state 行。"""
    if last_accessed_at is None:
        last_accessed_at = datetime(2026, 7, 25, 10, 0, 0, tzinfo=timezone.utc)
    return FakeRecord({
        "entry_id": entry_id,
        "retention_score": str(retention_score),
        "last_accessed_at": last_accessed_at,
        "access_count": access_count,
        "is_decayed": is_decayed,
    })


@pytest.fixture
def mock_decay_conn():
    """Mock asyncpg Connection。"""
    return AsyncMock()


@pytest.fixture
def mock_decay_pool(mock_decay_conn):
    """Mock asyncpg Pool(async context manager)。"""
    pool = MagicMock()
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_decay_conn)
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
    return pool


@pytest.fixture
def patch_decay_pool(mock_decay_pool):
    """替换 memory_decay 模块级 _get_pool(仅本 fixture 作用域)。"""
    with patch.object(md_module, "_get_pool", return_value=mock_decay_pool):
        yield mock_decay_pool


# -----------------------------------------------------------------------------
# _parse_uuid:UUID 解析(模块函数)
# -----------------------------------------------------------------------------


class TestParseUuid:
    """_parse_uuid:字符串/UUID → asyncpg 接受的 uuid(失败返回 None)。"""

    def test_valid_uuid_string(self):
        u = "550e8400-e29b-41d4-a716-446655440000"
        result = _parse_uuid(u)
        assert isinstance(result, _uuid.UUID)
        assert str(result) == u

    def test_uuid_object_passthrough(self):
        u = _uuid.uuid4()
        result = _parse_uuid(u)
        assert result is u

    def test_none_returns_none(self):
        assert _parse_uuid(None) is None

    def test_empty_string_returns_none(self):
        assert _parse_uuid("") is None
        assert _parse_uuid("   ") is None

    def test_invalid_string_returns_none(self):
        """非 UUID 格式 → None(避免 asyncpg invalid input syntax)。"""
        assert _parse_uuid("not-a-uuid") is None
        assert _parse_uuid("12345") is None

    def test_non_uuid_string_like_entry_id_returns_none(self):
        """形如 'mem-u1-1234' 的非 UUID entry_id → None。"""
        assert _parse_uuid("mem-u1-1234") is None


# -----------------------------------------------------------------------------
# _persist_state:UPSERT 单条衰减状态
# -----------------------------------------------------------------------------


class TestPersistState:
    """_persist_state:UPSERT 单条衰减状态到 DB。"""

    @pytest.mark.asyncio
    async def test_persist_calls_upsert(self, patch_decay_pool, mock_decay_conn):
        """正常 UPSERT 调用:INSERT ... ON CONFLICT DO UPDATE。"""
        mgr = MemoryDecayManager()
        state = {
            "entryId": "e1",
            "retentionScore": 0.7,
            "lastAccessedAt": "2026-07-25T10:00:00+00:00",
            "accessCount": 3,
            "isDecayed": False,
        }
        await mgr._persist_state(state, user_id=None)
        # 验证 execute 被调用 1 次
        assert mock_decay_conn.execute.await_count == 1
        call_args = mock_decay_conn.execute.await_args
        sql = call_args.args[0]
        assert "INSERT INTO agent_memory_decay_state" in sql
        assert "ON CONFLICT (entry_id) DO UPDATE" in sql
        # 参数:[entry_id, user_id(None), retention, last_dt, access_count, is_decayed]
        args = call_args.args[1:]
        assert args[0] == "e1"
        assert args[1] is None  # user_id None
        assert args[2] == 0.7
        assert args[4] == 3
        assert args[5] is False

    @pytest.mark.asyncio
    async def test_persist_with_valid_user_uuid(self, patch_decay_pool, mock_decay_conn):
        """有效 user_id 字符串 → 转为 UUID 对象传给 asyncpg。"""
        mgr = MemoryDecayManager()
        user_uuid_str = "550e8400-e29b-41d4-a716-446655440000"
        state = {
            "entryId": "e2",
            "retentionScore": 1.0,
            "lastAccessedAt": "2026-07-25T10:00:00+00:00",
            "accessCount": 0,
            "isDecayed": False,
        }
        await mgr._persist_state(state, user_id=user_uuid_str)
        args = mock_decay_conn.execute.await_args.args[1:]
        assert isinstance(args[1], _uuid.UUID)
        assert str(args[1]) == user_uuid_str

    @pytest.mark.asyncio
    async def test_persist_with_non_uuid_user_id_passes_none(
        self, patch_decay_pool, mock_decay_conn
    ):
        """非 UUID 格式的 user_id(如 'u1')→ None(避免 asyncpg 报错)。"""
        mgr = MemoryDecayManager()
        state = {
            "entryId": "e3",
            "retentionScore": 0.5,
            "lastAccessedAt": "2026-07-25T10:00:00+00:00",
            "accessCount": 1,
            "isDecayed": False,
        }
        await mgr._persist_state(state, user_id="u1")
        args = mock_decay_conn.execute.await_args.args[1:]
        assert args[1] is None  # 降级为 None

    @pytest.mark.asyncio
    async def test_persist_empty_entry_id_skips(self, patch_decay_pool, mock_decay_conn):
        """entry_id 为空 → 跳过(不调 DB)。"""
        mgr = MemoryDecayManager()
        state = {"entryId": "", "retentionScore": 1.0}
        await mgr._persist_state(state)
        mock_decay_conn.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_persist_db_failure_does_not_raise(
        self, patch_decay_pool, mock_decay_conn
    ):
        """DB 异常 → 仅 warning,不抛错(降级仅写内存)。"""
        mock_decay_conn.execute.side_effect = RuntimeError("db down")
        mgr = MemoryDecayManager()
        state = {
            "entryId": "e4",
            "retentionScore": 0.5,
            "lastAccessedAt": "2026-07-25T10:00:00+00:00",
            "accessCount": 0,
            "isDecayed": False,
        }
        # 不抛异常
        await mgr._persist_state(state)
        # 内存状态保留(降级)
        assert "e4" not in mgr._states  # _persist_state 不写内存,只写 DB

    @pytest.mark.asyncio
    async def test_persist_invalid_last_accessed_falls_back_to_none(
        self, patch_decay_pool, mock_decay_conn
    ):
        """非法 lastAccessedAt → _parse_iso 返回 None,传 NULL 给 DB。"""
        mgr = MemoryDecayManager()
        state = {
            "entryId": "e5",
            "retentionScore": 1.0,
            "lastAccessedAt": "not-a-date",
            "accessCount": 0,
            "isDecayed": False,
        }
        await mgr._persist_state(state)
        args = mock_decay_conn.execute.await_args.args[1:]
        # last_dt 为 None(_parse_iso 解析失败)
        assert args[3] is None


# -----------------------------------------------------------------------------
# _load_state:单条查询
# -----------------------------------------------------------------------------


class TestLoadState:
    """_load_state:从 DB 单条查询衰减状态。"""

    @pytest.mark.asyncio
    async def test_load_state_found(self, patch_decay_pool, mock_decay_conn):
        """DB 命中 → 返回 state dict。"""
        mock_decay_conn.fetchrow = AsyncMock(
            return_value=_decay_row(entry_id="e1", retention_score=0.7, access_count=3)
        )
        mgr = MemoryDecayManager()
        result = await mgr._load_state("e1")
        assert result is not None
        assert result["entryId"] == "e1"
        assert result["retentionScore"] == 0.7
        assert result["accessCount"] == 3
        assert result["isDecayed"] is False

    @pytest.mark.asyncio
    async def test_load_state_not_found(self, patch_decay_pool, mock_decay_conn):
        """DB 未命中 → None。"""
        mock_decay_conn.fetchrow = AsyncMock(return_value=None)
        mgr = MemoryDecayManager()
        result = await mgr._load_state("unknown")
        assert result is None

    @pytest.mark.asyncio
    async def test_load_state_empty_entry_id_returns_none(self, patch_decay_pool, mock_decay_conn):
        """空 entry_id → None(不查 DB)。"""
        mgr = MemoryDecayManager()
        result = await mgr._load_state("")
        assert result is None
        mock_decay_conn.fetchrow.assert_not_called()

    @pytest.mark.asyncio
    async def test_load_state_db_failure_returns_none(
        self, patch_decay_pool, mock_decay_conn
    ):
        """DB 异常 → None(不抛错)。"""
        mock_decay_conn.fetchrow = AsyncMock(side_effect=RuntimeError("db down"))
        mgr = MemoryDecayManager()
        result = await mgr._load_state("e1")
        assert result is None


# -----------------------------------------------------------------------------
# load_all_states:启动时全量 hydrate
# -----------------------------------------------------------------------------


class TestLoadAllStates:
    """load_all_states:启动时从 DB 全量加载到内存。"""

    @pytest.mark.asyncio
    async def test_load_all_populates_memory(self, patch_decay_pool, mock_decay_conn):
        """正常加载 → 内存 _states 被填充。"""
        rows = [
            _decay_row(entry_id="e1", retention_score=0.8, access_count=5),
            _decay_row(entry_id="e2", retention_score=0.2, access_count=0, is_decayed=True),
        ]
        mock_decay_conn.fetch = AsyncMock(return_value=rows)
        mgr = MemoryDecayManager()
        # 初始空
        assert mgr._states == {}
        count = await mgr.load_all_states()
        assert count == 2
        assert "e1" in mgr._states
        assert "e2" in mgr._states
        assert mgr._states["e1"]["retentionScore"] == 0.8
        assert mgr._states["e2"]["isDecayed"] is True

    @pytest.mark.asyncio
    async def test_load_all_empty_table(self, patch_decay_pool, mock_decay_conn):
        """空表 → 加载 0 条,内存保持空。"""
        mock_decay_conn.fetch = AsyncMock(return_value=[])
        mgr = MemoryDecayManager()
        count = await mgr.load_all_states()
        assert count == 0
        assert mgr._states == {}

    @pytest.mark.asyncio
    async def test_load_all_skips_empty_entry_id(self, patch_decay_pool, mock_decay_conn):
        """entry_id 为空的行被跳过。"""
        rows = [
            _decay_row(entry_id="", retention_score=0.5),
            _decay_row(entry_id="e1", retention_score=0.8),
        ]
        mock_decay_conn.fetch = AsyncMock(return_value=rows)
        mgr = MemoryDecayManager()
        count = await mgr.load_all_states()
        assert count == 1
        assert "e1" in mgr._states
        assert "" not in mgr._states

    @pytest.mark.asyncio
    async def test_load_all_db_failure_returns_zero(
        self, patch_decay_pool, mock_decay_conn
    ):
        """DB 异常 → 返回 0 + 内存保持空(不抛错)。"""
        mock_decay_conn.fetch = AsyncMock(side_effect=RuntimeError("db down"))
        mgr = MemoryDecayManager()
        count = await mgr.load_all_states()
        assert count == 0
        assert mgr._states == {}

    @pytest.mark.asyncio
    async def test_load_all_restores_is_decayed_flag(self, patch_decay_pool, mock_decay_conn):
        """is_decayed=true 的行被正确恢复(is_decayed)。"""
        rows = [
            _decay_row(entry_id="e1", retention_score=0.1, is_decayed=True),
        ]
        mock_decay_conn.fetch = AsyncMock(return_value=rows)
        mgr = MemoryDecayManager()
        count = await mgr.load_all_states()
        assert count == 1
        assert mgr._states["e1"]["isDecayed"] is True
        # is_decayed 验证一致性
        assert mgr.is_decayed("e1") is True

    @pytest.mark.asyncio
    async def test_load_all_overwrites_existing_memory(
        self, patch_decay_pool, mock_decay_conn
    ):
        """已有内存状态时 → 被 DB 数据覆盖(DB 是 source of truth)。"""
        mgr = MemoryDecayManager()
        # 预置内存状态
        mgr._states["e1"] = {
            "entryId": "e1",
            "retentionScore": 0.99,
            "lastAccessedAt": "2026-01-01T00:00:00+00:00",
            "accessCount": 999,
            "isDecayed": False,
        }
        # DB 中 e1 的实际值
        rows = [_decay_row(entry_id="e1", retention_score=0.5, access_count=1)]
        mock_decay_conn.fetch = AsyncMock(return_value=rows)
        await mgr.load_all_states()
        # DB 覆盖内存
        assert mgr._states["e1"]["retentionScore"] == 0.5
        assert mgr._states["e1"]["accessCount"] == 1


# -----------------------------------------------------------------------------
# load_states_for_user:按用户过滤加载
# -----------------------------------------------------------------------------


class TestLoadStatesForUser:
    """load_states_for_user:按 user_id 过滤加载到内存。"""

    @pytest.mark.asyncio
    async def test_load_by_user_filters_with_where_clause(
        self, patch_decay_pool, mock_decay_conn
    ):
        """SQL 含 WHERE user_id = $1 子句。"""
        rows = [_decay_row(entry_id="e1", retention_score=0.7)]
        mock_decay_conn.fetch = AsyncMock(return_value=rows)
        mgr = MemoryDecayManager()
        user_uuid = "550e8400-e29b-41d4-a716-446655440000"
        count = await mgr.load_states_for_user(user_uuid)
        assert count == 1
        # 验证 SQL + 参数
        call = mock_decay_conn.fetch.await_args
        sql = call.args[0]
        assert "WHERE user_id = $1" in sql
        assert isinstance(call.args[1], _uuid.UUID)
        assert str(call.args[1]) == user_uuid

    @pytest.mark.asyncio
    async def test_load_by_user_empty_user_id_returns_zero(
        self, patch_decay_pool, mock_decay_conn
    ):
        """空 user_id → 0(不查 DB)。"""
        mgr = MemoryDecayManager()
        count = await mgr.load_states_for_user("")
        assert count == 0
        mock_decay_conn.fetch.assert_not_called()

    @pytest.mark.asyncio
    async def test_load_by_user_db_failure_returns_zero(
        self, patch_decay_pool, mock_decay_conn
    ):
        """DB 异常 → 0(不抛错)。"""
        mock_decay_conn.fetch = AsyncMock(side_effect=RuntimeError("db down"))
        mgr = MemoryDecayManager()
        count = await mgr.load_states_for_user("550e8400-e29b-41d4-a716-446655440000")
        assert count == 0


# -----------------------------------------------------------------------------
# delete_state:删除 + 内存清理
# -----------------------------------------------------------------------------


class TestDeleteState:
    """delete_state:删除 DB 行 + 同步清理内存。"""

    @pytest.mark.asyncio
    async def test_delete_removes_from_memory_and_db(
        self, patch_decay_pool, mock_decay_conn
    ):
        """删除:内存 + DB 同步清理。"""
        mgr = MemoryDecayManager()
        mgr._states["e1"] = {"entryId": "e1", "retentionScore": 0.5}
        await mgr.delete_state("e1")
        assert "e1" not in mgr._states
        mock_decay_conn.execute.assert_awaited_once()
        sql = mock_decay_conn.execute.await_args.args[0]
        assert "DELETE FROM agent_memory_decay_state WHERE entry_id = $1" in sql
        assert mock_decay_conn.execute.await_args.args[1] == "e1"

    @pytest.mark.asyncio
    async def test_delete_empty_entry_id_noop(self, patch_decay_pool, mock_decay_conn):
        """空 entry_id → 不操作。"""
        mgr = MemoryDecayManager()
        await mgr.delete_state("")
        mock_decay_conn.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_db_failure_does_not_raise(
        self, patch_decay_pool, mock_decay_conn
    ):
        """DB 异常 → 仅 warning,但内存已清理(乐观)。"""
        mock_decay_conn.execute.side_effect = RuntimeError("db down")
        mgr = MemoryDecayManager()
        mgr._states["e1"] = {"entryId": "e1"}
        # 不抛异常
        await mgr.delete_state("e1")
        # 内存已清理(乐观策略)
        assert "e1" not in mgr._states

    @pytest.mark.asyncio
    async def test_delete_nonexistent_entry_id_no_error(
        self, patch_decay_pool, mock_decay_conn
    ):
        """删除不存在的 entry → 内存无影响,DB 返回 0 行(无异常)。"""
        mgr = MemoryDecayManager()
        await mgr.delete_state("nonexistent")
        assert "nonexistent" not in mgr._states
        # DB 调用仍执行(幂等)
        mock_decay_conn.execute.assert_awaited_once()


# -----------------------------------------------------------------------------
# record_access_async:异步版本 record_access + 写穿 DB
# -----------------------------------------------------------------------------


class TestRecordAccessAsync:
    """record_access_async:同步 record_access + 异步写穿 DB。"""

    @pytest.mark.asyncio
    async def test_record_access_async_updates_memory_and_db(
        self, patch_decay_pool, mock_decay_conn
    ):
        """调用后内存 accessCount+1,DB UPSERT 一次。"""
        mgr = MemoryDecayManager()
        await mgr.record_access_async("e1")
        assert "e1" in mgr._states
        assert mgr._states["e1"]["accessCount"] == 1
        assert mgr._states["e1"]["isDecayed"] is False
        mock_decay_conn.execute.assert_awaited_once()
        sql = mock_decay_conn.execute.await_args.args[0]
        assert "INSERT INTO agent_memory_decay_state" in sql

    @pytest.mark.asyncio
    async def test_record_access_async_empty_entry_id_noop(
        self, patch_decay_pool, mock_decay_conn
    ):
        """空 entry_id → 不操作。"""
        mgr = MemoryDecayManager()
        await mgr.record_access_async("")
        mock_decay_conn.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_record_access_async_db_failure_does_not_raise(
        self, patch_decay_pool, mock_decay_conn
    ):
        """DB 异常 → 内存仍更新,不抛错(降级)。"""
        mock_decay_conn.execute.side_effect = RuntimeError("db down")
        mgr = MemoryDecayManager()
        await mgr.record_access_async("e1")
        # 内存已更新
        assert mgr._states["e1"]["accessCount"] == 1

    @pytest.mark.asyncio
    async def test_record_access_async_clears_decayed_flag(
        self, patch_decay_pool, mock_decay_conn
    ):
        """已衰减的 entry 被访问后 isDecayed 清除(写穿 DB)。"""
        mgr = MemoryDecayManager()
        mgr._states["e1"] = {
            "entryId": "e1",
            "retentionScore": 0.1,
            "lastAccessedAt": "2026-01-01T00:00:00+00:00",
            "accessCount": 0,
            "isDecayed": True,
        }
        await mgr.record_access_async("e1")
        assert mgr._states["e1"]["isDecayed"] is False
        assert mgr._states["e1"]["accessCount"] == 1


# -----------------------------------------------------------------------------
# apply_decay / prune_decayed 写穿 DB
# -----------------------------------------------------------------------------


class TestApplyDecayWriteThrough:
    """apply_decay 完成后写穿 DB(L2-3 核心闭环)。"""

    @pytest.mark.asyncio
    async def test_apply_decay_persists_each_entry(self, patch_decay_pool, mock_decay_conn):
        """每条 entry 计算完后 UPSERT 一次到 DB。"""
        mgr = MemoryDecayManager()
        now = datetime.now(timezone.utc).isoformat()
        entries = [
            {"id": "e1", "createdAt": now, "updatedAt": now},
            {"id": "e2", "createdAt": now, "updatedAt": now},
            {"id": "e3", "createdAt": now, "updatedAt": now},
        ]
        result = await mgr.apply_decay(
            "u1", {"strategy": "time", "halfLifeDays": 30}, memory_client=entries
        )
        assert result["updated"] == 3
        # DB 写穿 3 次(每条 entry 一次)
        assert mock_decay_conn.execute.await_count == 3

    @pytest.mark.asyncio
    async def test_apply_decay_db_failure_does_not_block(
        self, patch_decay_pool, mock_decay_conn
    ):
        """DB 写穿失败 → 不阻塞 apply_decay,内存仍更新。"""
        mock_decay_conn.execute.side_effect = RuntimeError("db down")
        mgr = MemoryDecayManager()
        now = datetime.now(timezone.utc).isoformat()
        entries = [{"id": "e1", "createdAt": now, "updatedAt": now}]
        result = await mgr.apply_decay("u1", {"strategy": "time"}, memory_client=entries)
        # 仍返回 updated=1(内存计算完成)
        assert result["updated"] == 1
        # 内存状态保留
        assert "e1" in mgr._states

    @pytest.mark.asyncio
    async def test_apply_decay_passes_user_id_to_persist(
        self, patch_decay_pool, mock_decay_conn
    ):
        """apply_decay 把 user_id 传给 _persist_state(便于按用户清理)。"""
        mgr = MemoryDecayManager()
        now = datetime.now(timezone.utc).isoformat()
        entries = [{"id": "e1", "createdAt": now, "updatedAt": now}]
        # 用 UUID 格式的 user_id 才能被 _parse_uuid 转换
        user_uuid = "550e8400-e29b-41d4-a716-446655440000"
        await mgr.apply_decay(
            user_uuid, {"strategy": "time"}, memory_client=entries
        )
        # 验证 UPSERT 第二个参数是 UUID 对象
        args = mock_decay_conn.execute.await_args.args[1:]
        assert isinstance(args[1], _uuid.UUID)
        assert str(args[1]) == user_uuid


class TestPruneDecayedWriteThrough:
    """prune_decayed 标记后写穿 DB。"""

    @pytest.mark.asyncio
    async def test_prune_decayed_persists_marked_entries(
        self, patch_decay_pool, mock_decay_conn
    ):
        """被标记 isDecayed=true 的 entry 写穿 DB。"""
        mgr = MemoryDecayManager()
        old = (datetime.now(timezone.utc) - timedelta(days=200)).isoformat()
        entries = [{"id": "p1", "createdAt": old, "updatedAt": old}]
        # 先 apply_decay 计算状态(此时已写穿 1 次)
        await mgr.apply_decay("u", {"strategy": "time", "halfLifeDays": 30}, memory_client=entries)
        # 清空调用计数,然后 prune
        mock_decay_conn.execute.reset_mock()
        result = await mgr.prune_decayed("u", threshold=0.5, memory_client=entries)
        assert result["pruned"] == 1
        # 标记后写穿 DB 1 次
        assert mock_decay_conn.execute.await_count == 1
        # 验证 is_decayed=true 写入
        args = mock_decay_conn.execute.await_args.args[1:]
        assert args[5] is True  # is_decayed

    @pytest.mark.asyncio
    async def test_prune_decayed_no_decayed_entries_no_persist(
        self, patch_decay_pool, mock_decay_conn
    ):
        """无已衰减条目 → 不写 DB。"""
        mgr = MemoryDecayManager()
        now = datetime.now(timezone.utc).isoformat()
        entries = [{"id": "p2", "createdAt": now, "updatedAt": now}]
        # 先 apply_decay 计算状态(retentionScore ≈ 1.0,不会 prune)
        await mgr.apply_decay("u", {"strategy": "time"}, memory_client=entries)
        mock_decay_conn.execute.reset_mock()
        result = await mgr.prune_decayed("u", threshold=0.01, memory_client=entries)
        assert result["pruned"] == 0
        mock_decay_conn.execute.assert_not_called()


# -----------------------------------------------------------------------------
# 重启模拟:全链路 hydrate 闭环
# -----------------------------------------------------------------------------


class TestRestartSimulation:
    """模拟进程重启:DB 状态 → load_all_states → 内存恢复。"""

    @pytest.mark.asyncio
    async def test_restart_restores_decayed_state(self, patch_decay_pool, mock_decay_conn):
        """模拟:进程 A 标记 e1 为 decayed → 进程 B 启动 hydrate → is_decayed 一致。"""
        # 进程 A:apply_decay + prune_decayed 标记 e1 为 decayed
        mgr_a = MemoryDecayManager()
        old = (datetime.now(timezone.utc) - timedelta(days=200)).isoformat()
        entries = [{"id": "e1", "createdAt": old, "updatedAt": old}]
        await mgr_a.apply_decay(
            "u", {"strategy": "time", "halfLifeDays": 30}, memory_client=entries
        )
        await mgr_a.prune_decayed("u", threshold=0.5, memory_client=entries)
        assert mgr_a.is_decayed("e1") is True

        # 模拟 DB 中已有 e1 的状态(is_decayed=true)
        rows = [_decay_row(entry_id="e1", retention_score=0.05, is_decayed=True)]
        mock_decay_conn.fetch = AsyncMock(return_value=rows)

        # 进程 B:新 MemoryDecayManager 实例(模拟重启)
        mgr_b = MemoryDecayManager()
        assert mgr_b.is_decayed("e1") is False  # 启动前内存为空
        count = await mgr_b.load_all_states()
        assert count == 1
        # 启动后从 DB 恢复
        assert mgr_b.is_decayed("e1") is True

    @pytest.mark.asyncio
    async def test_restart_restores_access_count(self, patch_decay_pool, mock_decay_conn):
        """模拟:进程 A record_access_async 5 次 → 进程 B hydrate → accessCount=5。"""
        # 进程 A:访问 5 次
        mgr_a = MemoryDecayManager()
        for _ in range(5):
            await mgr_a.record_access_async("e1")
        assert mgr_a._states["e1"]["accessCount"] == 5

        # 模拟 DB 中 e1 的状态(access_count=5)
        rows = [_decay_row(entry_id="e1", retention_score=1.0, access_count=5)]
        mock_decay_conn.fetch = AsyncMock(return_value=rows)

        # 进程 B:新实例
        mgr_b = MemoryDecayManager()
        await mgr_b.load_all_states()
        assert mgr_b._states["e1"]["accessCount"] == 5

    @pytest.mark.asyncio
    async def test_restart_with_empty_db_falls_back_to_clean_state(
        self, patch_decay_pool, mock_decay_conn
    ):
        """DB 空表 → 启动后内存为空(降级),后续 apply_decay 会重建。"""
        mock_decay_conn.fetch = AsyncMock(return_value=[])
        mgr = MemoryDecayManager()
        count = await mgr.load_all_states()
        assert count == 0
        assert mgr._states == {}
        # 后续 apply_decay 正常工作
        now = datetime.now(timezone.utc).isoformat()
        entries = [{"id": "e1", "createdAt": now, "updatedAt": now}]
        result = await mgr.apply_decay(
            "u", {"strategy": "time"}, memory_client=entries
        )
        assert result["updated"] == 1


# -----------------------------------------------------------------------------
# 单例导出
# -----------------------------------------------------------------------------


class TestSingleton:
    """memory_decay_manager 单例导出。"""

    def test_singleton_exists(self):
        assert memory_decay_manager is not None

    def test_singleton_is_memory_decay_manager_instance(self):
        assert isinstance(memory_decay_manager, MemoryDecayManager)

    def test_singleton_has_states_dict(self):
        assert hasattr(memory_decay_manager, "_states")
        assert isinstance(memory_decay_manager._states, dict)

