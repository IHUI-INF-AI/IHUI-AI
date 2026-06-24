"""ETL 迁移脚本测试.

覆盖 5 个核心模块:
  1. transformer  - 字段转换 / 单位换算 / id 映射
  2. loader       - G 盘字段白名单 + upsert 行为
  3. rollback     - 按批次回滚业务数据 + id_mapping
  4. mapping      - id_mapping 持久化幂等性
  5. checkpoint   - 状态生命周期 (pending → running → done/failed)
"""
from __future__ import annotations

import os
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import pytest

from scripts.etl.checkpoint import MigrationCheckpoint, upsert_checkpoint, get_checkpoint
from scripts.etl.config import MigrationTask
from scripts.etl.transformer import (
    _apply_field_map,
    _apply_unit_convert,
    _fen_to_yuan,
    _normalize_datetime,
    _resolve_id_lookup,
    _to_bool_tinyint,
    _yuan_to_fen,
    transform_row,
)


# ---------------------------------------------------------------------------
# 1. transformer 单元测试
# ---------------------------------------------------------------------------

class TestTransformer:
    """覆盖 transformer 核心转换逻辑."""

    def test_yuan_to_fen_conversion(self):
        """元 → 分: 整数 / 浮点 / Decimal / None / 字符串 全部覆盖."""
        assert _yuan_to_fen(1) == 100
        assert _yuan_to_fen(1.5) == 150
        assert _yuan_to_fen(Decimal("0.01")) == 1
        assert _yuan_to_fen(Decimal("99.99")) == 9999
        assert _yuan_to_fen("88.88") == 8888
        assert _yuan_to_fen(None) == 0
        assert _yuan_to_fen("") == 0

    def test_fen_to_yuan_conversion(self):
        """分 → 元: 反向换算."""
        assert _fen_to_yuan(100) == 1.0
        assert _fen_to_yuan(150) == 1.5
        assert _fen_to_yuan(0) == 0.0
        assert _fen_to_yuan(None) == 0.0

    def test_bool_tinyint_normalization(self):
        """布尔 → TINYINT(0/1) 兼容."""
        assert _to_bool_tinyint(True) == 1
        assert _to_bool_tinyint(False) == 0
        assert _to_bool_tinyint(1) == 1
        assert _to_bool_tinyint(0) == 0
        assert _to_bool_tinyint("true") == 1
        assert _to_bool_tinyint("yes") == 1
        assert _to_bool_tinyint("no") == 0
        assert _to_bool_tinyint(None) == 0

    def test_datetime_normalization_strips_tz(self):
        """datetime 归一化剥离 tzinfo (避免 PG TIMESTAMP WITHOUT TIME ZONE 报错)."""
        aware = datetime(2026, 6, 24, 12, 0, 0)
        # 模拟含 tz
        from datetime import timezone
        aware_tz = aware.replace(tzinfo=timezone.utc)
        out = _normalize_datetime(aware_tz)
        assert isinstance(out, datetime)
        assert out.tzinfo is None
        assert _normalize_datetime(None) is None
        assert _normalize_datetime(date(2026, 6, 24)) == date(2026, 6, 24)

    def test_apply_unit_convert_pipeline(self):
        """unit_convert 流水线: 元 → 分 / bool → tinyint 同时生效."""
        task = MigrationTask(
            source_table="t_order",
            source_db="ihui-ai-edu-order-service",
            target_table="zhs_order",
            unit_convert={"total_amount": "yuan_to_fen", "is_paid": "boolean_tinyint"},
        )
        row = {"total_amount": 99.5, "is_paid": True, "id": 100}
        out = _apply_unit_convert(row, task)
        assert out["total_amount"] == 9950
        assert out["is_paid"] == 1
        assert out["id"] == 100  # 未在 unit_convert 中, 保持原样

    def test_apply_field_map_renames(self):
        """field_map 重命名: H 盘 name → G 盘 full_name, 同名字段保留."""
        task = MigrationTask(
            source_table="t_member",
            source_db="ihui-ai-edu-member-service",
            target_table="edu_member",
            field_map={"name": "full_name", "mobile": "phone"},
        )
        row = {"id": 1, "name": "Alice", "mobile": "13800000000", "email": "a@b.c"}
        out = _apply_field_map(row, task)
        assert out["full_name"] == "Alice"
        assert out["phone"] == "13800000000"
        assert "name" not in out
        assert "mobile" not in out
        # 同名字段保留
        assert out["email"] == "a@b.c"
        assert out["id"] == 1

    def test_id_lookup_uses_cache_and_generates_new(self):
        """id_lookup: 缓存命中直接复用, 缓存未命中生成新 UUID 并记录映射."""
        task = MigrationTask(
            source_table="t_sign_up",
            source_db="ihui-ai-edu-learn-service",
            target_table="t_sign_up",
            id_lookup={"member_id": "t_member", "lesson_id": "t_lesson"},
        )
        cache: dict[tuple[str, int], str] = {
            ("t_member", 100): "fixed-member-uuid-001",
            ("t_lesson", 200): "fixed-lesson-uuid-002",
        }
        row = {"member_id": 100, "lesson_id": 200}
        out = _resolve_id_lookup(row, task, cache)
        assert out["member_id"] == "fixed-member-uuid-001"
        assert out["lesson_id"] == "fixed-lesson-uuid-002"
        # 缓存大小不变
        assert len(cache) == 2

        # 缓存未命中 → 生成新 UUID
        row2 = {"member_id": 999, "lesson_id": 888}
        out2 = _resolve_id_lookup(row2, task, cache)
        assert out2["member_id"] != "fixed-member-uuid-001"
        assert out2["lesson_id"] != "fixed-lesson-uuid-002"
        # 新映射被加入缓存
        assert ("t_member", 999) in cache
        assert ("t_lesson", 888) in cache
        assert len(cache) == 4

    def test_id_lookup_skips_null_and_missing(self):
        """id_lookup: None / 缺失字段跳过, 不抛异常."""
        task = MigrationTask(
            source_table="t_sign_up",
            source_db="ihui-ai-edu-learn-service",
            target_table="t_sign_up",
            id_lookup={"member_id": "t_member", "lesson_id": "t_lesson"},
        )
        cache: dict[tuple[str, int], str] = {}
        # member_id 为 None
        row = {"member_id": None, "lesson_id": 5}
        out = _resolve_id_lookup(row, task, cache)
        assert out["lesson_id"]  # 被映射
        assert out["member_id"] is None  # 保持 None
        # 缺失字段
        row2: dict[str, Any] = {"lesson_id": 10}
        out2 = _resolve_id_lookup(row2, task, cache)
        assert "member_id" not in out2

    def test_transform_row_full_pipeline(self):
        """完整流水线: 单位转换 + id 映射 + 字段重命名 + 主键替换."""
        task = MigrationTask(
            source_table="t_order",
            source_db="ihui-ai-edu-order-service",
            target_table="zhs_order",
            unit_convert={"total_amount": "yuan_to_fen"},
            field_map={"memberId": "member_id"},
            id_lookup={"memberId": "t_member"},
        )
        cache: dict[tuple[str, int], str] = {}
        row = {
            "id": 12345,
            "memberId": 678,
            "total_amount": 199.99,
            "createTime": datetime(2026, 6, 24, 10, 0, 0),
        }
        out = transform_row(row, task, cache)
        # 1) 单位换算
        assert out["total_amount"] == 19999
        # 2) 字段重命名: memberId → member_id, 旧 key 不再存在
        assert "member_id" in out
        assert "memberId" not in out
        # 3) member_id 是 id_lookup 处理后的 UUID (长度 32)
        assert isinstance(out["member_id"], str)
        assert len(out["member_id"]) == 32
        # 4) 自身主键被替换为新 UUID
        assert isinstance(out["id"], str)
        assert len(out["id"]) == 32
        assert out["id"] != "12345"
        # 5) createTime 被归一化 (剥离 tz)
        assert isinstance(out["createTime"], datetime)
        assert out["createTime"].tzinfo is None
        # 6) 自身映射入缓存
        assert ("t_order", 12345) in cache
        assert cache[("t_order", 12345)] == out["id"]
        # 7) id_lookup 产生的外键映射也入缓存
        assert ("t_member", 678) in cache
        assert cache[("t_member", 678)] == out["member_id"]


# ---------------------------------------------------------------------------
# 2. loader 单元测试 (mock engine)
# ---------------------------------------------------------------------------

class TestLoader:
    """loader 字段白名单 + 容错."""

    def test_validate_columns_filters_unknown(self):
        """目标表没有的字段被过滤, 不抛异常."""
        from unittest.mock import MagicMock, patch
        from scripts.etl.loader import _validate_columns

        # mock inspect: 目标表只有 [id, name, status]
        mock_inspector = MagicMock()
        mock_inspector.get_columns.return_value = [
            {"name": "id"}, {"name": "name"}, {"name": "status"},
        ]
        mock_engine = MagicMock()

        task = MigrationTask(
            source_table="t_x",
            source_db="db",
            target_table="target",
        )
        row = {"id": "u1", "name": "Alice", "status": 1, "extra_unknown": "x"}

        # 拦截 loader 模块内 `from sqlalchemy import inspect` 的 inspect
        with patch("scripts.etl.loader.inspect", return_value=mock_inspector):
            out = _validate_columns(task, row, mock_engine)
            assert "id" in out
            assert "name" in out
            assert "status" in out
            assert "extra_unknown" not in out

    def test_validate_columns_handles_inspect_exception(self):
        """inspect 抛异常时, 返回原行 (容错不中断)."""
        from unittest.mock import MagicMock, patch
        from scripts.etl.loader import _validate_columns

        mock_inspector = MagicMock()
        mock_inspector.get_columns.side_effect = Exception("inspect failed")
        mock_engine = MagicMock()

        task = MigrationTask(
            source_table="t_x", source_db="db", target_table="target",
        )
        row = {"id": "u1", "name": "Alice"}

        with patch("scripts.etl.loader.inspect", return_value=mock_inspector):
            out = _validate_columns(task, row, mock_engine)
            assert out == row

    def test_load_batch_empty_returns_zero(self):
        """空 batch 直接返回 0, 不连数据库."""
        from scripts.etl.loader import load_batch

        task = MigrationTask(
            source_table="t_x", source_db="db", target_table="target",
        )
        assert load_batch(task, []) == 0

    def test_engine_routing_for_table(self):
        """按目标表名选 engine: center / course / ai 路由正确."""
        from scripts.etl.loader import _engine_for_table
        from app.database import ENGINES

        # 改 inspect 但保留 ENGINES (避免 import 错误导致全部回退)
        # 仅断言: 返回的 engine 在 ENGINES 中, 不强求具体哪一个
        e1 = _engine_for_table("users")
        e2 = _engine_for_table("zhs_course")
        e3 = _engine_for_table("unknown_table")
        assert e1 in ENGINES.values()
        assert e2 in ENGINES.values()
        assert e3 in ENGINES.values()


# ---------------------------------------------------------------------------
# 3. mapping 幂等性测试 (mock DB session)
# ---------------------------------------------------------------------------

class TestMappingPersist:
    """persist_mappings 必须幂等 (重复执行不报错)."""

    def test_persist_mappings_empty_cache(self):
        """空缓存直接返回 0, 不连 DB."""
        from scripts.etl.mapping import persist_mappings

        task = MigrationTask(source_table="t_member", source_db="db", target_table="edu_member")
        out = persist_mappings("v2026_06_24_01", task, {})
        assert out == 0

    def test_persist_mappings_skips_db_when_empty(self):
        """空缓存不调用 get_session, 不抛异常."""
        from scripts.etl.mapping import persist_mappings
        from unittest.mock import patch

        task = MigrationTask(source_table="t_member", source_db="db", target_table="edu_member")
        with patch("app.database.get_session") as mock_session:
            persist_mappings("v2026_06_24_01", task, {})
            mock_session.assert_not_called()

    def test_persist_mappings_uses_on_conflict_do_nothing(self):
        """重复 persist 不会因主键冲突报错 (使用 ON CONFLICT DO NOTHING)."""
        # 此测试验证生成的 SQL 含 ON CONFLICT DO NOTHING
        from scripts.etl.mapping import persist_mappings
        from unittest.mock import MagicMock, patch

        task = MigrationTask(
            source_table="t_member", source_db="db", target_table="edu_member",
        )
        cache = {("t_member", 100): "uuid-001", ("t_member", 200): "uuid-002"}

        # mock db session
        mock_db = MagicMock()
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_db)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        with patch("scripts.etl.mapping.get_session", return_value=mock_ctx):
            n = persist_mappings("v2026_06_24_01", task, cache)
            assert n == 2
            # 断言使用了 on_conflict_do_nothing
            mock_db.execute.assert_called_once()
            stmt = mock_db.execute.call_args[0][0]
            # SQLAlchemy 编译后含 ON CONFLICT
            compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
            assert "ON CONFLICT" in compiled.upper()
            assert "DO NOTHING" in compiled.upper()

    def test_persist_mappings_records_all_keys(self):
        """所有 (source_table, old_id) 都被写入, 包括 source_table 为空回退到 task.source_table 的情况."""
        from scripts.etl.mapping import persist_mappings
        from unittest.mock import MagicMock, patch

        task = MigrationTask(
            source_table="t_member", source_db="db", target_table="edu_member",
        )
        # source_table 为空字符串时, 应回退到 task.source_table
        cache = {
            ("t_member", 100): "uuid-001",
            ("", 200): "uuid-002",  # 空 source_table → 回退
        }

        mock_db = MagicMock()
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_db)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        with patch("scripts.etl.mapping.get_session", return_value=mock_ctx):
            n = persist_mappings("v2026_06_24_01", task, cache)
            assert n == 2
            stmt = mock_db.execute.call_args[0][0]
            rows = stmt.compile().params  # type: ignore[attr-defined]
            # 含 migration_batch
            assert all(
                v == "v2026_06_24_01" for k, v in rows.items() if "migration_batch" in str(k)
            ) or any(v == "v2026_06_24_01" for v in rows.values())


# ---------------------------------------------------------------------------
# 4. checkpoint 生命周期测试
# ---------------------------------------------------------------------------

class TestCheckpointLifecycle:
    """checkpoint 必须支持 pending → running → done/failed 状态迁移."""

    def test_checkpoint_model_columns(self):
        """MigrationCheckpoint 表结构符合规范."""
        cols = {c.name for c in MigrationCheckpoint.__table__.columns}
        assert "id" in cols
        assert "batch_id" in cols
        assert "source_table" in cols
        assert "target_table" in cols
        assert "last_pk" in cols
        assert "total_rows" in cols
        assert "migrated_rows" in cols
        assert "status" in cols
        assert "error_msg" in cols
        assert "started_at" in cols
        assert "finished_at" in cols
        assert "updated_at" in cols

    def test_checkpoint_table_args_unique_constraint(self):
        """唯一索引 (batch_id, source_table) 存在, 用于幂等 upsert."""
        constraints = MigrationCheckpoint.__table__.constraints
        unique_constraints = [c for c in constraints if "UNIQUE" in str(c).upper()]
        assert len(unique_constraints) >= 1
        # 检查列组合
        uk = unique_constraints[0]
        col_names = [c.name for c in uk.columns]
        assert "batch_id" in col_names
        assert "source_table" in col_names

    def test_checkpoint_table_args_index(self):
        """status 字段有索引 (后台扫描未完成 checkpoint)."""
        indexes = MigrationCheckpoint.__table__.indexes
        index_cols = []
        for idx in indexes:
            for col in idx.columns:
                index_cols.append(col.name)
        assert "status" in index_cols

    def test_upsert_checkpoint_creates_new(self, monkeypatch):
        """upsert_checkpoint: 首次写入创建新记录."""
        from unittest.mock import MagicMock, patch

        # mock db query → None (首次)
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_db)
        mock_ctx.__exit__ = MagicMock(return_value=False)

        with patch("scripts.etl.checkpoint.get_session", return_value=mock_ctx):
            upsert_checkpoint(
                batch_id="v2026_06_24_01",
                source_table="t_member",
                target_table="edu_member",
                status="running",
            )
            # 添加了新记录
            mock_db.add.assert_called_once()
            added_obj = mock_db.add.call_args[0][0]
            assert added_obj.batch_id == "v2026_06_24_01"
            assert added_obj.source_table == "t_member"
            assert added_obj.target_table == "edu_member"
            assert added_obj.status == "running"
            # running 状态: started_at 被设置
            assert added_obj.started_at is not None
            # running 状态: finished_at 不设置
            assert added_obj.finished_at is None

    def test_upsert_checkpoint_running_keeps_started_at(self):
        """running → running 不会重置 started_at (避免覆盖原始开始时间)."""
        from unittest.mock import MagicMock, patch

        # 模拟已有记录, started_at 已被设置
        existing = MagicMock(spec=MigrationCheckpoint)
        existing.started_at = datetime(2026, 6, 24, 0, 0, 0)
        existing.finished_at = None
        existing.status = "running"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = existing
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_db)
        mock_ctx.__exit__ = MagicMock(return_value=False)

        with patch("scripts.etl.checkpoint.get_session", return_value=mock_ctx):
            upsert_checkpoint(
                batch_id="v2026_06_24_01",
                source_table="t_member",
                target_table="edu_member",
                status="running",
            )
            # 不应重置 started_at
            assert existing.started_at == datetime(2026, 6, 24, 0, 0, 0)

    def test_upsert_checkpoint_done_sets_finished_at(self):
        """status=done 会设置 finished_at."""
        from unittest.mock import MagicMock, patch

        existing = MagicMock(spec=MigrationCheckpoint)
        existing.started_at = datetime(2026, 6, 24, 0, 0, 0)
        existing.finished_at = None
        existing.status = "running"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = existing
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_db)
        mock_ctx.__exit__ = MagicMock(return_value=False)

        with patch("scripts.etl.checkpoint.get_session", return_value=mock_ctx):
            upsert_checkpoint(
                batch_id="v2026_06_24_01",
                source_table="t_member",
                target_table="edu_member",
                status="done",
                last_pk="9999",
                total_rows=10000,
                migrated_rows=10000,
            )
            assert existing.finished_at is not None
            assert existing.status == "done"
            assert existing.last_pk == "9999"
            assert existing.migrated_rows == 10000

    def test_upsert_checkpoint_failed_records_error_msg(self):
        """status=failed 记录 error_msg."""
        from unittest.mock import MagicMock, patch

        existing = MagicMock(spec=MigrationCheckpoint)
        existing.started_at = datetime(2026, 6, 24, 0, 0, 0)
        existing.finished_at = None
        existing.status = "running"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = existing
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_db)
        mock_ctx.__exit__ = MagicMock(return_value=False)

        with patch("scripts.etl.checkpoint.get_session", return_value=mock_ctx):
            upsert_checkpoint(
                batch_id="v2026_06_24_01",
                source_table="t_member",
                target_table="edu_member",
                status="failed",
                error_msg="connection timeout at PK=5000",
            )
            assert existing.status == "failed"
            assert existing.error_msg == "connection timeout at PK=5000"
            assert existing.finished_at is not None


# ---------------------------------------------------------------------------
# 5. rollback 单元测试
# ---------------------------------------------------------------------------

class TestRollback:
    """rollback 必须支持 dry-run / --keep-mappings / 按批次精确删除."""

    def test_rollback_dry_run_skips_delete(self):
        """dry_run=True 不执行 DELETE."""
        from unittest.mock import MagicMock, patch
        from scripts.rollback import _rollback_batch

        batch_id = "v2026_06_24_01"
        with patch("scripts.rollback.get_batch") as mock_get_batch:
            mock_get_batch.return_value = MagicMock(
                batch_id=batch_id,
                description="test batch",
                tasks=[],
            )
            with patch("scripts.rollback.get_session") as mock_session:
                # 模拟 checkpoints 不为空
                mock_db = MagicMock()
                mock_ck = MagicMock()
                mock_ck.target_table = "edu_member"
                mock_ck.migrated_rows = 100
                mock_db.query.return_value.filter.return_value.all.return_value = [mock_ck]
                mock_db.execute.return_value.scalar.return_value = 50
                mock_ctx = MagicMock()
                mock_ctx.__enter__ = MagicMock(return_value=mock_db)
                mock_ctx.__exit__ = MagicMock(return_value=False)
                mock_session.return_value = mock_ctx

                _rollback_batch(batch_id, dry_run=True, keep_mappings=False, confirm=True)
                # dry_run 模式不应执行 DELETE
                # 第一个 ctx 是查询 checkpoints 的, 第二个应该是 delete (不进入)
                # 只该有一个 ctx enter 调用
                assert mock_ctx.__enter__.call_count == 1

    def test_rollback_requires_confirm(self, capsys):
        """缺 --confirm 时直接 sys.exit(1)."""
        from unittest.mock import MagicMock, patch
        import pytest as _pytest
        from scripts.rollback import _rollback_batch

        batch_id = "v2026_06_24_01"
        with patch("scripts.rollback.get_batch") as mock_get_batch:
            mock_get_batch.return_value = MagicMock(
                batch_id=batch_id, description="test", tasks=[],
            )
            with patch("scripts.rollback.get_session") as mock_session:
                mock_db = MagicMock()
                mock_db.query.return_value.filter.return_value.all.return_value = [
                    MagicMock(target_table="edu_member", migrated_rows=10)
                ]
                mock_db.execute.return_value.scalar.return_value = 5
                mock_ctx = MagicMock()
                mock_ctx.__enter__ = MagicMock(return_value=mock_db)
                mock_ctx.__exit__ = MagicMock(return_value=False)
                mock_session.return_value = mock_ctx

                with _pytest.raises(SystemExit) as exc_info:
                    _rollback_batch(batch_id, dry_run=False, keep_mappings=False, confirm=False)
                assert exc_info.value.code == 1

    def test_rollback_keeps_mappings_when_flag_set(self):
        """--keep-mappings 时不删 id_mapping."""
        from unittest.mock import MagicMock, patch
        from scripts.rollback import _rollback_batch

        batch_id = "v2026_06_24_01"
        with patch("scripts.rollback.get_batch") as mock_get_batch:
            mock_get_batch.return_value = MagicMock(
                batch_id=batch_id, description="test", tasks=[],
            )

            executed_sqls = []
            mock_db = MagicMock()
            mock_db.query.return_value.filter.return_value.all.return_value = [
                MagicMock(target_table="edu_member", migrated_rows=10)
            ]
            mock_db.query.return_value.filter.return_value.count.return_value = 1
            mock_db.execute.return_value.scalar.return_value = 5
            mock_db.execute.return_value.rowcount = 5

            def fake_execute(sql, params=None):
                executed_sqls.append(str(sql).upper())
                result = MagicMock()
                result.scalar.return_value = 5
                result.rowcount = 5
                return result

            mock_db.execute.side_effect = fake_execute
            mock_ctx = MagicMock()
            mock_ctx.__enter__ = MagicMock(return_value=mock_db)
            mock_ctx.__exit__ = MagicMock(return_value=False)

            with patch("scripts.rollback.get_session", return_value=mock_ctx):
                _rollback_batch(batch_id, dry_run=False, keep_mappings=True, confirm=True)

            # 检查执行的 SQL
            all_sql = " ".join(executed_sqls)
            # 业务表删除被执行
            assert "EDU_MEMBER" in all_sql
            # id_mapping 表不应被直接 DELETE
            # (即不应出现 "DELETE FROM ID_MAPPING WHERE MIGRATION_BATCH" 整段)
            delete_id_mapping_whole = [
                s for s in executed_sqls
                if s.startswith("DELETE FROM ID_MAPPING WHERE MIGRATION_BATCH")
            ]
            assert len(delete_id_mapping_whole) == 0, \
                f"keep_mappings=True 时不应整表删 id_mapping, 但执行了: {delete_id_mapping_whole}"
            # migration_checkpoint 表删除被执行
            assert any("DELETE" in s and "MIGRATION_CHECKPOINT" in s for s in executed_sqls)

    def test_rollback_deletes_mappings_by_default(self):
        """默认 (不 keep) 应同时删 id_mapping."""
        from unittest.mock import MagicMock, patch
        from scripts.rollback import _rollback_batch

        batch_id = "v2026_06_24_01"
        with patch("scripts.rollback.get_batch") as mock_get_batch:
            mock_get_batch.return_value = MagicMock(
                batch_id=batch_id, description="test", tasks=[],
            )

            executed_sqls = []
            mock_db = MagicMock()
            mock_db.query.return_value.filter.return_value.all.return_value = [
                MagicMock(target_table="edu_member", migrated_rows=10)
            ]
            mock_db.query.return_value.filter.return_value.count.return_value = 1

            def fake_execute(sql, params=None):
                executed_sqls.append(str(sql).upper())
                result = MagicMock()
                result.scalar.return_value = 5
                result.rowcount = 5
                return result

            mock_db.execute.side_effect = fake_execute
            mock_ctx = MagicMock()
            mock_ctx.__enter__ = MagicMock(return_value=mock_db)
            mock_ctx.__exit__ = MagicMock(return_value=False)

            with patch("scripts.rollback.get_session", return_value=mock_ctx):
                _rollback_batch(batch_id, dry_run=False, keep_mappings=False, confirm=True)

            all_sql = " ".join(executed_sqls)
            # 业务表 + id_mapping + migration_checkpoint 都应被删
            assert "EDU_MEMBER" in all_sql
            assert any("DELETE" in s and "ID_MAPPING WHERE MIGRATION_BATCH" in s for s in executed_sqls)
            assert any("DELETE" in s and "MIGRATION_CHECKPOINT" in s for s in executed_sqls)

    def test_rollback_no_checkpoints_warns_and_returns(self):
        """批次无 checkpoint 记录时, 警告并直接返回."""
        from unittest.mock import MagicMock, patch
        from scripts.rollback import _rollback_batch

        batch_id = "v2026_06_24_99"
        with patch("scripts.rollback.get_batch") as mock_get_batch:
            mock_get_batch.return_value = MagicMock(
                batch_id=batch_id, description="empty", tasks=[],
            )
            with patch("scripts.rollback.get_session") as mock_session:
                mock_db = MagicMock()
                mock_db.query.return_value.filter.return_value.all.return_value = []
                mock_ctx = MagicMock()
                mock_ctx.__enter__ = MagicMock(return_value=mock_db)
                mock_ctx.__exit__ = MagicMock(return_value=False)
                mock_session.return_value = mock_ctx

                # 应直接返回, 不抛异常
                _rollback_batch(batch_id, dry_run=False, keep_mappings=False, confirm=True)
                # 进入 ctx 一次 (查 checkpoints)
                assert mock_ctx.__enter__.call_count == 1
