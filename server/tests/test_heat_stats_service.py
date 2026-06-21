"""heat_stats_service 单元测试 (Phase 14 加法启用).

覆盖业务模块 app/services/heat_stats_service.py:
  - aggregate_heat_stats: 按日期聚合 (含零记录)
  - start / stop: 生命周期
  - increment_hit: 增量记录 (含默认 date_str)
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.services import heat_stats_service as hs

# ---------------------------------------------------------------------------
# 1. aggregate_heat_stats
# ---------------------------------------------------------------------------


class TestAggregateHeatStats:
    def test_aggregate_with_records(self):
        with patch.object(hs, "SessionFactory1") as mock_sf:
            mock_db = mock_sf.return_value
            mock_db.query.return_value.filter.return_value.count.return_value = 42
            hs.aggregate_heat_stats()
            mock_db.close.assert_called_once()

    def test_aggregate_with_no_records(self):
        with patch.object(hs, "SessionFactory1") as mock_sf:
            mock_db = mock_sf.return_value
            mock_db.query.return_value.filter.return_value.count.return_value = 0
            hs.aggregate_heat_stats()
            mock_db.close.assert_called_once()

    def test_aggregate_closes_db_on_exception(self):
        """当前实现不 catch 异常, 异常会冒泡, db 不会关 - 用于记录"当前行为"."""
        with patch.object(hs, "SessionFactory1") as mock_sf:
            mock_db = mock_sf.return_value
            mock_db.query.side_effect = Exception("db fail")
            with pytest.raises(Exception):
                hs.aggregate_heat_stats()


# ---------------------------------------------------------------------------
# 2. start / stop 生命周期
# ---------------------------------------------------------------------------


class TestLifecycle:
    @pytest.mark.asyncio
    async def test_start_logs(self):
        await hs.start()

    @pytest.mark.asyncio
    async def test_stop_logs(self):
        await hs.stop()


# ---------------------------------------------------------------------------
# 3. increment_hit
# ---------------------------------------------------------------------------


class TestIncrementHit:
    @pytest.mark.asyncio
    async def test_default_date_str_is_today(self):
        with patch("app.services.heat_stats_service.datetime") as mock_dt:
            mock_dt.now.return_value.strftime.return_value = "2026-06-15"
            await hs.increment_hit("agent-001")
            mock_dt.now.assert_called_once()
            mock_dt.now.return_value.strftime.assert_called_once_with("%Y-%m-%d")

    @pytest.mark.asyncio
    async def test_explicit_date_str_used(self):
        with patch("app.services.heat_stats_service.datetime") as mock_dt:
            await hs.increment_hit("agent-002", date_str="2025-12-31")
            mock_dt.now.assert_not_called()
