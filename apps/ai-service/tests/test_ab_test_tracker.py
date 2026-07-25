"""ABTestTracker 测试(L5-2,2026-07-25 立)。

覆盖 ab_test_tracker.py:
- _empty_stats / _merge_stats_add 工具函数
- _parse_iso 时间解析
- ABTestTracker 内存操作(create_test/get_active_test/record_call/get_stats/mark_decided/stop_test)
- 同 skill 互斥(新测试停止旧测试)
- list_tests 过滤 + 排序
- DB 持久化 mock(_persist_test_to_db / load_active_tests)
- flush_all_running
- get_status
- 全局单例
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.ab_test_tracker import (
    ABTestTracker,
    _empty_stats,
    _merge_stats_add,
    _parse_iso,
    ab_test_tracker,
)


# =============================================================================
# 工具函数
# =============================================================================


class TestEmptyStats:
    """_empty_stats 返回空 stats 结构。"""

    def test_returns_default_structure(self):
        stats = _empty_stats()
        assert stats == {
            "success_count": 0,
            "failure_count": 0,
            "duration_ms_sum": 0.0,
            "duration_ms_sum_sq": 0.0,
            "tokens_sum": 0,
            "tokens_sum_sq": 0.0,
        }

    def test_returns_fresh_dict_each_call(self):
        a = _empty_stats()
        a["success_count"] = 1
        b = _empty_stats()
        assert b["success_count"] == 0  # 不受 a 影响


class TestMergeStatsAdd:
    """_merge_stats_add 累加一次调用。"""

    def test_success_first_call(self):
        stats = _empty_stats()
        new = _merge_stats_add(stats, True, 100.0, 50)
        assert new["success_count"] == 1
        assert new["duration_ms_sum"] == 100.0
        assert new["duration_ms_sum_sq"] == 10000.0
        assert new["tokens_sum"] == 50
        assert new["tokens_sum_sq"] == 2500.0

    def test_failure_does_not_change_success_count(self):
        stats = _empty_stats()
        new = _merge_stats_add(stats, False, 200.0, 30)
        assert new["success_count"] == 0
        assert new["failure_count"] == 1

    def test_does_not_mutate_original(self):
        stats = _empty_stats()
        _merge_stats_add(stats, True, 100.0, 50)
        assert stats["success_count"] == 0


class TestParseIso:
    """_parse_iso ISO 字符串解析。"""

    def test_none(self):
        assert _parse_iso(None) is None

    def test_empty_string(self):
        assert _parse_iso("") is None

    def test_invalid_string(self):
        assert _parse_iso("not a date") is None

    def test_valid_iso(self):
        dt = _parse_iso("2026-07-25T12:00:00+00:00")
        assert dt is not None
        assert dt.year == 2026
        assert dt.tzinfo is not None

    def test_valid_iso_with_z(self):
        dt = _parse_iso("2026-07-25T12:00:00Z")
        assert dt is not None
        assert dt.year == 2026

    def test_naive_datetime_assumed_utc(self):
        dt = _parse_iso("2026-07-25T12:00:00")
        assert dt is not None
        assert dt.tzinfo is not None
        assert dt.tzinfo == timezone.utc


# =============================================================================
# ABTestTracker 内存操作(无 DB)
# =============================================================================


@pytest.fixture
def fresh_tracker(monkeypatch):
    """返回一个全新 ABTestTracker(无 DB 调用,monkeypatch _persist_test_to_db)"""
    t = ABTestTracker()
    # Mock DB 持久化,只测内存
    monkeypatch.setattr(
        t, "_persist_test_to_db", AsyncMock(return_value=True)
    )
    return t


class TestCreateTest:
    """create_test 创建 A/B 测试。"""

    @pytest.mark.asyncio
    async def test_basic_creation(self, fresh_tracker):
        test_id = await fresh_tracker.create_test(
            "skill-a", "1.0.0", "1.1.0",
            shadow_ratio=0.1, min_sample_size=30, significance_level=0.05,
        )
        assert test_id  # UUID 字符串
        test = fresh_tracker.get_test(test_id)
        assert test["skillName"] == "skill-a"
        assert test["controlVersion"] == "1.0.0"
        assert test["treatmentVersion"] == "1.1.0"
        assert test["status"] == "running"
        assert test["shadowRatio"] == 0.1
        assert test["minSampleSize"] == 30
        assert test["significanceLevel"] == 0.05
        assert test["controlStats"] == _empty_stats()
        assert test["treatmentStats"] == _empty_stats()

    @pytest.mark.asyncio
    async def test_invalid_skill_name(self, fresh_tracker):
        with pytest.raises(ValueError, match="必填"):
            await fresh_tracker.create_test("", "1.0.0", "1.1.0")

    @pytest.mark.asyncio
    async def test_same_versions_rejected(self, fresh_tracker):
        with pytest.raises(ValueError, match="不能等于"):
            await fresh_tracker.create_test("skill-a", "1.0.0", "1.0.0")

    @pytest.mark.asyncio
    async def test_invalid_shadow_ratio_zero(self, fresh_tracker):
        with pytest.raises(ValueError, match="shadow_ratio"):
            await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0", shadow_ratio=0.0)

    @pytest.mark.asyncio
    async def test_invalid_shadow_ratio_above_one(self, fresh_tracker):
        with pytest.raises(ValueError, match="shadow_ratio"):
            await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0", shadow_ratio=1.5)

    @pytest.mark.asyncio
    async def test_default_params(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        test = fresh_tracker.get_test(test_id)
        assert test["shadowRatio"] == 0.1  # 默认
        assert test["minSampleSize"] == 30
        assert test["significanceLevel"] == 0.05


class TestCreateTestStopsExisting:
    """同 skill 已有 running 测试时,create_test 先停止旧测试。"""

    @pytest.mark.asyncio
    async def test_creates_new_stops_old(self, fresh_tracker):
        old_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        new_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.2.0")
        assert old_id != new_id
        old_test = fresh_tracker.get_test(old_id)
        assert old_test["status"] == "stopped"
        assert old_test["decision"] == "stopped"
        assert "superseded" in (old_test["decisionReason"] or "")
        # active 索引指向新测试
        active = fresh_tracker.get_active_test("skill-a")
        assert active["testId"] == new_id


class TestGetActiveTest:
    """get_active_test 查询 skill 当前 running 的测试。"""

    @pytest.mark.asyncio
    async def test_returns_none_when_no_test(self, fresh_tracker):
        assert fresh_tracker.get_active_test("skill-a") is None

    @pytest.mark.asyncio
    async def test_returns_running_test(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        active = fresh_tracker.get_active_test("skill-a")
        assert active["testId"] == test_id

    @pytest.mark.asyncio
    async def test_returns_none_after_stopped(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        await fresh_tracker.stop_test(test_id, reason="manual")
        assert fresh_tracker.get_active_test("skill-a") is None

    @pytest.mark.asyncio
    async def test_returns_shallow_copy(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        active = fresh_tracker.get_active_test("skill-a")
        active["status"] = "promoted"  # 修改不影响内存
        original = fresh_tracker.get_test(test_id)
        assert original["status"] == "running"


class TestRecordCall:
    """record_call 累加指标。"""

    @pytest.mark.asyncio
    async def test_record_control(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        fresh_tracker.record_call(
            test_id, "1.0.0", success=True, duration_ms=100.0, tokens=50
        )
        test = fresh_tracker.get_test(test_id)
        assert test["controlStats"]["success_count"] == 1
        assert test["controlStats"]["duration_ms_sum"] == 100.0
        assert test["treatmentStats"]["success_count"] == 0

    @pytest.mark.asyncio
    async def test_record_treatment(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        fresh_tracker.record_call(
            test_id, "1.1.0", success=True, duration_ms=80.0, tokens=40
        )
        test = fresh_tracker.get_test(test_id)
        assert test["treatmentStats"]["success_count"] == 1
        assert test["treatmentStats"]["duration_ms_sum"] == 80.0
        assert test["controlStats"]["success_count"] == 0

    @pytest.mark.asyncio
    async def test_record_unknown_version_ignored(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        fresh_tracker.record_call(
            test_id, "2.0.0", success=True, duration_ms=100.0, tokens=50
        )
        test = fresh_tracker.get_test(test_id)
        assert test["controlStats"]["success_count"] == 0
        assert test["treatmentStats"]["success_count"] == 0

    @pytest.mark.asyncio
    async def test_record_unknown_test_ignored(self, fresh_tracker):
        # 不存在的 test_id → 不抛异常
        fresh_tracker.record_call(
            "nonexistent", "1.0.0", success=True, duration_ms=100.0, tokens=50
        )

    @pytest.mark.asyncio
    async def test_record_after_stopped_ignored(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        await fresh_tracker.stop_test(test_id)
        fresh_tracker.record_call(
            test_id, "1.0.0", success=True, duration_ms=100.0, tokens=50
        )
        test = fresh_tracker.get_test(test_id)
        assert test["controlStats"]["success_count"] == 0

    @pytest.mark.asyncio
    async def test_record_multiple_calls_accumulate(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        for _ in range(5):
            fresh_tracker.record_call(
                test_id, "1.0.0", success=True, duration_ms=100.0, tokens=50
            )
        for _ in range(3):
            fresh_tracker.record_call(
                test_id, "1.1.0", success=False, duration_ms=80.0, tokens=40
            )
        test = fresh_tracker.get_test(test_id)
        assert test["controlStats"]["success_count"] == 5
        assert test["controlStats"]["duration_ms_sum"] == 500.0
        assert test["controlStats"]["duration_ms_sum_sq"] == 50000.0  # 5 * 100^2
        assert test["treatmentStats"]["failure_count"] == 3
        assert test["treatmentStats"]["tokens_sum"] == 120  # 3 * 40


class TestGetStats:
    """get_stats 查询 control/treatment stats 快照。"""

    @pytest.mark.asyncio
    async def test_returns_none_for_unknown(self, fresh_tracker):
        assert fresh_tracker.get_stats("nonexistent") is None

    @pytest.mark.asyncio
    async def test_returns_stats_snapshot(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        fresh_tracker.record_call(
            test_id, "1.0.0", success=True, duration_ms=100.0, tokens=50
        )
        stats = fresh_tracker.get_stats(test_id)
        assert stats is not None
        assert stats["controlStats"]["success_count"] == 1
        assert stats["treatmentStats"]["success_count"] == 0
        assert stats["minSampleSize"] == 30
        assert stats["significanceLevel"] == 0.05


class TestMarkDecided:
    """mark_decided 标记决策。"""

    @pytest.mark.asyncio
    async def test_promote(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        ok = await fresh_tracker.mark_decided(
            test_id, "promote", reason="treatment 显著优于 control"
        )
        assert ok is True
        test = fresh_tracker.get_test(test_id)
        assert test["status"] == "promoted"
        assert test["decision"] == "promote"
        assert "显著优于" in test["decisionReason"]
        assert test["decidedAt"] is not None
        assert test["endedAt"] is not None
        # active 索引清理
        assert fresh_tracker.get_active_test("skill-a") is None

    @pytest.mark.asyncio
    async def test_rollback(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        ok = await fresh_tracker.mark_decided(
            test_id, "rollback", reason="treatment 显著劣于 control"
        )
        assert ok is True
        test = fresh_tracker.get_test(test_id)
        assert test["status"] == "rolled_back"

    @pytest.mark.asyncio
    async def test_inconclusive(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        ok = await fresh_tracker.mark_decided(
            test_id, "inconclusive", reason="差异不显著"
        )
        assert ok is True
        test = fresh_tracker.get_test(test_id)
        assert test["status"] == "stopped"

    @pytest.mark.asyncio
    async def test_invalid_decision_rejected(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        with pytest.raises(ValueError, match="非法 decision"):
            await fresh_tracker.mark_decided(test_id, "invalid", reason="x")

    @pytest.mark.asyncio
    async def test_unknown_test_returns_false(self, fresh_tracker):
        ok = await fresh_tracker.mark_decided(
            "nonexistent", "promote", reason="x"
        )
        assert ok is False

    @pytest.mark.asyncio
    async def test_already_decided_returns_false(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        await fresh_tracker.mark_decided(test_id, "promote", reason="first")
        # 二次决策 → False
        ok = await fresh_tracker.mark_decided(test_id, "rollback", reason="second")
        assert ok is False

    @pytest.mark.asyncio
    async def test_decision_reason_as_dict_serialized(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        await fresh_tracker.mark_decided(
            test_id,
            "promote",
            reason={"p_value": 0.01, "diff": 0.3, "method": "z-test"},
        )
        test = fresh_tracker.get_test(test_id)
        # dict 序列化为 JSON 字符串
        assert isinstance(test["decisionReason"], str)
        assert "p_value" in test["decisionReason"]


class TestStopTest:
    """stop_test 手动停止。"""

    @pytest.mark.asyncio
    async def test_stop(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        ok = await fresh_tracker.stop_test(test_id, reason="manual")
        assert ok is True
        test = fresh_tracker.get_test(test_id)
        assert test["status"] == "stopped"
        assert test["decision"] == "stopped"
        assert test["decisionReason"] == "manual"

    @pytest.mark.asyncio
    async def test_unknown_test_returns_false(self, fresh_tracker):
        ok = await fresh_tracker.stop_test("nonexistent", reason="x")
        assert ok is False

    @pytest.mark.asyncio
    async def test_stop_already_stopped_returns_false(self, fresh_tracker):
        test_id = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        await fresh_tracker.stop_test(test_id)
        ok = await fresh_tracker.stop_test(test_id)  # 再次停止
        assert ok is False


class TestListTests:
    """list_tests 列表查询。"""

    @pytest.mark.asyncio
    async def test_empty(self, fresh_tracker):
        assert fresh_tracker.list_tests() == []

    @pytest.mark.asyncio
    async def test_filter_by_status(self, fresh_tracker):
        tid1 = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        tid2 = await fresh_tracker.create_test("skill-b", "1.0.0", "1.1.0")
        await fresh_tracker.stop_test(tid2)
        running = fresh_tracker.list_tests(status="running")
        stopped = fresh_tracker.list_tests(status="stopped")
        assert len(running) == 1
        assert running[0]["testId"] == tid1
        assert len(stopped) == 1
        assert stopped[0]["testId"] == tid2

    @pytest.mark.asyncio
    async def test_filter_by_skill(self, fresh_tracker):
        tid1 = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        tid2 = await fresh_tracker.create_test("skill-b", "1.0.0", "1.1.0")
        result = fresh_tracker.list_tests(skill_name="skill-a")
        assert len(result) == 1
        assert result[0]["testId"] == tid1

    @pytest.mark.asyncio
    async def test_limit(self, fresh_tracker):
        for i in range(5):
            await fresh_tracker.create_test(
                f"skill-{i}", "1.0.0", "1.1.0"
            )
        result = fresh_tracker.list_tests(limit=3)
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_sorted_by_started_at_desc(self, fresh_tracker):
        # 创建顺序:tid1 → tid2 → tid3
        tid1 = await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        # 推进时间避免 startedAt 完全相同
        import asyncio
        await asyncio.sleep(0.01)
        tid2 = await fresh_tracker.create_test("skill-b", "1.0.0", "1.1.0")
        await asyncio.sleep(0.01)
        tid3 = await fresh_tracker.create_test("skill-c", "1.0.0", "1.1.0")
        result = fresh_tracker.list_tests()
        assert result[0]["testId"] == tid3
        assert result[1]["testId"] == tid2
        assert result[2]["testId"] == tid1


class TestGetStatus:
    """get_status 返回 tracker 状态摘要。"""

    @pytest.mark.asyncio
    async def test_empty(self, fresh_tracker):
        status = fresh_tracker.get_status()
        assert status["totalTests"] == 0
        assert status["runningTests"] == 0
        assert status["activeSkills"] == []

    @pytest.mark.asyncio
    async def test_with_tests(self, fresh_tracker):
        await fresh_tracker.create_test("skill-a", "1.0.0", "1.1.0")
        await fresh_tracker.create_test("skill-b", "1.0.0", "1.1.0")
        status = fresh_tracker.get_status()
        assert status["totalTests"] == 2
        assert status["runningTests"] == 2
        assert "skill-a" in status["activeSkills"]
        assert "skill-b" in status["activeSkills"]


# =============================================================================
# DB 持久化 mock 测试
# =============================================================================


class TestPersistTestToDb:
    """_persist_test_to_db INSERT / UPDATE 测试。"""

    @pytest.mark.asyncio
    async def test_insert_calls_execute(self, monkeypatch):
        t = ABTestTracker()
        mock_pool = MagicMock()
        mock_conn = MagicMock()
        mock_conn.execute = AsyncMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
        async def _mock_get_pool():
            return mock_pool
        monkeypatch.setattr(
            "app.services.ab_test_tracker._get_pool", _mock_get_pool
        )
        test_id = await t.create_test("skill-a", "1.0.0", "1.1.0")
        # create_test 内部调 _persist_test_to_db(is_insert=True)
        assert mock_conn.execute.called

    @pytest.mark.asyncio
    async def test_db_failure_returns_false_but_memory_ok(self, monkeypatch):
        t = ABTestTracker()
        async def _mock_get_pool_failed():
            raise RuntimeError("db down")
        monkeypatch.setattr(
            "app.services.ab_test_tracker._get_pool", _mock_get_pool_failed
        )
        # create_test 应该不抛异常(降级仅内存)
        test_id = await t.create_test("skill-a", "1.0.0", "1.1.0")
        assert test_id  # 内存中创建成功
        assert t.get_test(test_id) is not None


class TestLoadActiveTests:
    """load_active_tests 启动时从 DB hydrate。"""

    @pytest.mark.asyncio
    async def test_loads_running_tests(self, monkeypatch):
        t = ABTestTracker()
        # mock DB 返回 1 条 running 测试
        mock_row = {
            "test_id": "test-from-db",
            "skill_name": "skill-loaded",
            "control_version": "1.0.0",
            "treatment_version": "1.1.0",
            "status": "running",
            "shadow_ratio": 0.2,
            "min_sample_size": 50,
            "significance_level": 0.01,
            "control_stats": {
                "success_count": 10,
                "failure_count": 5,
                "duration_ms_sum": 1000.0,
                "duration_ms_sum_sq": 100000.0,
                "tokens_sum": 500,
                "tokens_sum_sq": 25000.0,
            },
            "treatment_stats": {
                "success_count": 8,
                "failure_count": 7,
                "duration_ms_sum": 800.0,
                "duration_ms_sum_sq": 64000.0,
                "tokens_sum": 400,
                "tokens_sum_sq": 16000.0,
            },
            "decision": None,
            "decision_reason": None,
            "started_at": datetime.now(timezone.utc),
            "decided_at": None,
            "ended_at": None,
        }
        mock_pool = MagicMock()
        mock_conn = MagicMock()
        mock_conn.fetch = AsyncMock(return_value=[mock_row])
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
        async def _mock_get_pool():
            return mock_pool
        monkeypatch.setattr(
            "app.services.ab_test_tracker._get_pool", _mock_get_pool
        )
        count = await t.load_active_tests()
        assert count == 1
        test = t.get_test("test-from-db")
        assert test is not None
        assert test["skillName"] == "skill-loaded"
        assert test["status"] == "running"
        assert test["shadowRatio"] == 0.2
        assert test["controlStats"]["success_count"] == 10
        # active index 也建立
        assert t.get_active_test("skill-loaded") is not None

    @pytest.mark.asyncio
    async def test_db_failure_returns_zero(self, monkeypatch):
        t = ABTestTracker()
        async def _mock_get_pool_failed():
            raise RuntimeError("db down")
        monkeypatch.setattr(
            "app.services.ab_test_tracker._get_pool", _mock_get_pool_failed
        )
        count = await t.load_active_tests()
        assert count == 0

    @pytest.mark.asyncio
    async def test_duplicate_skill_skipped(self, monkeypatch):
        """同 skill 已在内存 → 跳过。"""
        t = ABTestTracker()
        # 内存中已有 skill-a 的 active test
        await t.create_test("skill-a", "1.0.0", "1.1.0")
        # mock DB 返回 1 条同 skill 测试
        mock_row = {
            "test_id": "test-from-db",
            "skill_name": "skill-a",  # 同 skill
            "control_version": "2.0.0",
            "treatment_version": "2.1.0",
            "status": "running",
            "shadow_ratio": 0.1,
            "min_sample_size": 30,
            "significance_level": 0.05,
            "control_stats": {},
            "treatment_stats": {},
            "decision": None,
            "decision_reason": None,
            "started_at": datetime.now(timezone.utc),
            "decided_at": None,
            "ended_at": None,
        }
        mock_pool = MagicMock()
        mock_conn = MagicMock()
        mock_conn.fetch = AsyncMock(return_value=[mock_row])
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
        async def _mock_get_pool():
            return mock_pool
        monkeypatch.setattr(
            "app.services.ab_test_tracker._get_pool", _mock_get_pool
        )
        count = await t.load_active_tests()
        assert count == 0  # 跳过


class TestFlushAllRunning:
    """flush_all_running 批量持久化。"""

    @pytest.mark.asyncio
    async def test_flushes_only_running(self, monkeypatch):
        t = ABTestTracker()
        # mock 持久化为成功
        persist_mock = AsyncMock(return_value=True)
        monkeypatch.setattr(t, "_persist_test_to_db", persist_mock)

        tid1 = await t.create_test("skill-a", "1.0.0", "1.1.0")
        tid2 = await t.create_test("skill-b", "1.0.0", "1.1.0")
        tid3 = await t.create_test("skill-c", "1.0.0", "1.1.0")
        await t.stop_test(tid3)  # stopped 不 flush

        count = await t.flush_all_running()
        assert count == 2  # 只 flush 2 个 running
        # 至少调用了 2 次 persist
        assert persist_mock.call_count >= 2


# =============================================================================
# 全局单例
# =============================================================================


class TestSingleton:
    """全局单例 ab_test_tracker。"""

    def test_singleton_exists(self):
        assert ab_test_tracker is not None
        assert isinstance(ab_test_tracker, ABTestTracker)
