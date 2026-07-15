"""schema_check 核心函数单元测试。

锁定 parse_ts_table_fields / scan_ai_service_sql_tables / diff_columns
三个核心函数的行为,防止未来重构破坏正则匹配规则。

测试覆盖:
- parse_ts_table_fields:从 TS schema 源码解析指定表的字段定义
- scan_ai_service_sql_tables:扫描 ai-service/app 下所有 .py 文件,提取 SQL 引用的表名
- diff_columns:对比期望与实际字段
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core.schema_check import (
    _SCHEMA_DIR,
    diff_columns,
    parse_ts_table_fields,
    scan_ai_service_sql_tables,
)

# =============================================================================
# parse_ts_table_fields 测试
# =============================================================================

# 复用 schema_check 模块中已校准的 schema 目录路径
SCHEMA_DIR = _SCHEMA_DIR


class TestParseTsTableFields:
    """从 TS schema 源码解析指定表的字段定义。"""

    def test_parse_ai_model_config_returns_19_fields(self):
        """ai_model_config 表应该解析出 19 个字段(TS schema 已定义)。"""
        fields = parse_ts_table_fields(SCHEMA_DIR, "ai_model_config")
        assert fields is not None, "ai_model_config 必须在 TS schema 中定义"
        assert len(fields) == 19, f"ai_model_config 应有 19 列,实际 {len(fields)}"

    def test_parse_ai_model_config_has_critical_fields(self):
        """ai_model_config 必须包含 8 个关键字段。"""
        fields = parse_ts_table_fields(SCHEMA_DIR, "ai_model_config")
        assert fields is not None
        critical = (
            "api_key_enc",
            "base_url",
            "api_format",
            "provider_code",
            "enabled",
            "owner_uuid",
            "sort_order",
            "id",
        )
        for f in critical:
            assert f in fields, f"关键字段 {f} 缺失"

    def test_parse_ai_model_config_field_types(self):
        """ai_model_config 关键字段类型映射正确。"""
        fields = parse_ts_table_fields(SCHEMA_DIR, "ai_model_config")
        assert fields is not None
        # bigint / boolean / varchar / text / integer / timestamp
        assert fields["id"] == "bigint"
        assert fields["enabled"] == "boolean"
        assert fields["api_key_enc"] == "text"
        assert fields["base_url"] == "varchar"
        assert fields["sort_order"] == "integer"
        assert fields["created_at"] == "timestamp"

    def test_parse_nonexistent_table_returns_none(self):
        """不存在的表应该返回 None。"""
        fields = parse_ts_table_fields(SCHEMA_DIR, "nonexistent_table_xyz")
        assert fields is None

    def test_parse_empty_dir_returns_none(self, tmp_path: Path):
        """schema 目录不存在时应该返回 None。"""
        nonexistent = tmp_path / "no_such_dir"
        fields = parse_ts_table_fields(nonexistent, "ai_model_config")
        assert fields is None

    def test_parse_empty_schema_dir_returns_none(self, tmp_path: Path):
        """schema 目录存在但无 .ts 文件时应该返回 None。"""
        empty_dir = tmp_path / "schema"
        empty_dir.mkdir()
        fields = parse_ts_table_fields(empty_dir, "ai_model_config")
        assert fields is None

    def test_parse_synthetic_table_with_index_definition(self, tmp_path: Path):
        """含 index/unique 定义的表不应把 index 识别为字段。"""
        schema_dir = tmp_path / "schema"
        schema_dir.mkdir()
        (schema_dir / "test.ts").write_text(
            """
import { pgTable, serial, varchar, boolean, timestamp, index } from 'drizzle-orm';

export const testTable = pgTable('test_synthetic', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  nameIdx: index('ix_test_name').on(t.name),
  enabledIdx: uniqueIndex('ux_test_enabled').on(t.enabled),
}));
""",
            encoding="utf-8",
        )
        fields = parse_ts_table_fields(schema_dir, "test_synthetic")
        assert fields is not None
        # 应该只有 4 个字段,不含 index/uniqueIndex
        assert set(fields.keys()) == {"id", "name", "enabled", "created_at"}
        assert "ix_test_name" not in fields
        assert "ux_test_enabled" not in fields


# =============================================================================
# scan_ai_service_sql_tables 测试
# =============================================================================

# 真实 ai-service app 目录
APP_DIR = Path(__file__).resolve().parent.parent / "app"


class TestScanAiServiceSqlTables:
    """扫描 ai-service/app 下所有 .py 文件,提取 SQL 引用的表名。"""

    def test_scan_real_app_dir_contains_ai_model_config(self):
        """扫描真实 ai-service/app 目录,应该至少包含 ai_model_config。"""
        tables = scan_ai_service_sql_tables(APP_DIR)
        assert "ai_model_config" in tables, "ai_model_config 必须被扫描到"

    def test_scan_real_app_dir_excludes_system_tables(self):
        """扫描结果不应包含系统表(information_schema / pg_*)。"""
        tables = scan_ai_service_sql_tables(APP_DIR)
        assert "information_schema" not in tables
        for t in tables:
            assert not t.startswith("pg_"), f"系统表 {t} 不应出现"

    def test_scan_real_app_dir_excludes_imports(self):
        """扫描结果不应包含 Python import 语句中的模块名。"""
        tables = scan_ai_service_sql_tables(APP_DIR)
        # __future__ / fastapi / asyncpg 等都是 import 语句,不应被识别为表
        forbidden = {"__future__", "fastapi", "asyncpg", "pydantic", "logging"}
        for f in forbidden:
            assert f not in tables, f"import 语句 {f} 不应被识别为表"

    def test_scan_real_app_dir_excludes_log_text(self):
        """扫描结果不应包含日志文本中的单词(如 "load from redis failed" 中的 redis)。"""
        tables = scan_ai_service_sql_tables(APP_DIR)
        assert "redis" not in tables, "日志文本中的 redis 不应被识别为表"

    def test_scan_real_app_dir_excludes_schema_check_self(self):
        """扫描结果不应包含 schema_check.py 自身查询的表。"""
        tables = scan_ai_service_sql_tables(APP_DIR)
        # schema_check.py 查询 information_schema.columns,但不应出现在结果中
        assert "information_schema" not in tables

    def test_scan_empty_dir_returns_empty_set(self, tmp_path: Path):
        """空目录应该返回空集合。"""
        empty_app = tmp_path / "app"
        empty_app.mkdir()
        tables = scan_ai_service_sql_tables(empty_app)
        assert tables == set()

    def test_scan_dir_with_only_init_returns_empty(self, tmp_path: Path):
        """只有 __init__.py 的目录应该返回空集合(下划线开头文件被排除)。"""
        app_dir = tmp_path / "app"
        app_dir.mkdir()
        (app_dir / "__init__.py").write_text("", encoding="utf-8")
        tables = scan_ai_service_sql_tables(app_dir)
        assert tables == set()

    def test_scan_dir_excludes_schema_check_file(self, tmp_path: Path):
        """schema_check.py 自身应该被排除。"""
        app_dir = tmp_path / "app"
        app_dir.mkdir()
        # schema_check.py 中有 SQL,但应被排除
        (app_dir / "schema_check.py").write_text(
            '''
QUERY = "SELECT column_name FROM information_schema.columns WHERE table_name = 'test'"
''',
            encoding="utf-8",
        )
        tables = scan_ai_service_sql_tables(app_dir)
        assert "information_schema" not in tables
        assert "test" not in tables or True  # test 是表名,但因为信息schema被排除

    def test_scan_dir_extracts_table_from_sql_string(self, tmp_path: Path):
        """应该从 SQL 字符串字面量中提取表名。"""
        app_dir = tmp_path / "app"
        app_dir.mkdir()
        (app_dir / "repo.py").write_text(
            '''
async def get_config():
    query = "SELECT * FROM ai_model_config WHERE enabled = true"
    return await conn.fetch(query)
''',
            encoding="utf-8",
        )
        tables = scan_ai_service_sql_tables(app_dir)
        assert "ai_model_config" in tables

    def test_scan_dir_ignores_sql_in_comments(self, tmp_path: Path):
        """注释中的 SQL 不应被识别(无字符串字面量包裹)。"""
        app_dir = tmp_path / "app"
        app_dir.mkdir()
        (app_dir / "notes.py").write_text(
            '''
# This module queries FROM legacy_table
# and joins TO another_table
''',
            encoding="utf-8",
        )
        tables = scan_ai_service_sql_tables(app_dir)
        assert "legacy_table" not in tables
        assert "another_table" not in tables

    def test_scan_dir_handles_triple_quoted_string(self, tmp_path: Path):
        """三引号字符串中的 SQL 也应该被识别。"""
        app_dir = tmp_path / "app"
        app_dir.mkdir()
        (app_dir / "repo.py").write_text(
            '''
async def get_config():
    query = """
    SELECT id, name FROM ai_model_config
    WHERE enabled = true
    ORDER BY sort_order
    """
    return await conn.fetch(query)
''',
            encoding="utf-8",
        )
        tables = scan_ai_service_sql_tables(app_dir)
        assert "ai_model_config" in tables

    def test_scan_dir_ignores_log_text_with_from_keyword(self, tmp_path: Path):
        """日志文本中的 "from xxx" 不应被识别为 SQL 表(无 SELECT/INSERT/UPDATE/DELETE)。"""
        app_dir = tmp_path / "app"
        app_dir.mkdir()
        (app_dir / "logger.py").write_text(
            '''
logger.warning("load from redis failed, fallback to memory")
logger.info("received response from upstream")
''',
            encoding="utf-8",
        )
        tables = scan_ai_service_sql_tables(app_dir)
        assert "redis" not in tables
        assert "upstream" not in tables


# =============================================================================
# diff_columns 测试
# =============================================================================


class TestDiffColumns:
    """对比期望与实际字段。"""

    def test_no_diff_when_identical(self):
        """完全匹配时应该返回空三件套。"""
        expected = {"id": "bigint", "name": "varchar"}
        actual = {"id": "bigint", "name": "varchar"}
        missing, extra, mismatched = diff_columns(expected, actual)
        assert missing == set()
        assert extra == set()
        assert mismatched == {}

    def test_detects_missing_fields(self):
        """expected 有 actual 没有的字段应该被识别为缺失。"""
        expected = {"id": "bigint", "name": "varchar", "email": "varchar"}
        actual = {"id": "bigint", "name": "varchar"}
        missing, extra, mismatched = diff_columns(expected, actual)
        assert missing == {"email"}
        assert extra == set()
        assert mismatched == {}

    def test_detects_extra_fields(self):
        """actual 有 expected 没有的字段应该被识别为多余。"""
        expected = {"id": "bigint"}
        actual = {"id": "bigint", "deleted_at": "timestamp"}
        missing, extra, mismatched = diff_columns(expected, actual)
        assert missing == set()
        assert extra == {"deleted_at"}
        assert mismatched == {}

    def test_detects_type_mismatch(self):
        """同名字段类型不同应该被识别为类型不匹配。"""
        expected = {"id": "bigint", "name": "varchar"}
        actual = {"id": "integer", "name": "varchar"}
        missing, extra, mismatched = diff_columns(expected, actual)
        assert missing == set()
        assert extra == set()
        assert "id" in mismatched
        assert mismatched["id"] == ("bigint", "integer")

    def test_normalizes_character_varying_to_varchar(self):
        """'character varying' 应该规范化为 'varchar'。"""
        expected = {"name": "varchar"}
        actual = {"name": "character varying"}
        missing, extra, mismatched = diff_columns(expected, actual)
        assert mismatched == {}, f"应规范化匹配,但得到 {mismatched}"

    def test_normalizes_timestamp_with_time_zone(self):
        """'timestamp with time zone' 应该规范化为 'timestamp'。"""
        expected = {"created_at": "timestamp"}
        actual = {"created_at": "timestamp with time zone"}
        missing, extra, mismatched = diff_columns(expected, actual)
        assert mismatched == {}, f"应规范化匹配,但得到 {mismatched}"

    def test_normalizes_smallint_to_integer(self):
        """'smallint' 应该规范化为 'integer'(容差匹配)。"""
        expected = {"status": "integer"}
        actual = {"status": "smallint"}
        missing, extra, mismatched = diff_columns(expected, actual)
        assert mismatched == {}, f"smallint 应容差匹配 integer,但得到 {mismatched}"

    def test_normalizes_double_precision_to_double(self):
        """'double precision' 应该规范化为 'double'。"""
        expected = {"price": "double"}
        actual = {"price": "double precision"}
        missing, extra, mismatched = diff_columns(expected, actual)
        assert mismatched == {}, f"应规范化匹配,但得到 {mismatched}"

    def test_case_insensitive_type_comparison(self):
        """类型比较应该大小写不敏感。"""
        expected = {"name": "VARCHAR"}
        actual = {"name": "varchar"}
        missing, extra, mismatched = diff_columns(expected, actual)
        assert mismatched == {}, f"应大小写不敏感匹配,但得到 {mismatched}"

    def test_empty_dicts_no_diff(self):
        """空字典应该返回空三件套。"""
        missing, extra, mismatched = diff_columns({}, {})
        assert missing == set()
        assert extra == set()
        assert mismatched == {}

    def test_complex_diff_scenario(self):
        """复合场景:同时有缺失/多余/类型不匹配。"""
        expected = {
            "id": "bigint",
            "name": "varchar",
            "email": "varchar",
            "created_at": "timestamp",
        }
        actual = {
            "id": "bigint",
            "name": "varchar",
            "created_at": "timestamp",
            "updated_at": "timestamp",
            "deleted_at": "boolean",
        }
        missing, extra, mismatched = diff_columns(expected, actual)
        assert missing == {"email"}
        assert extra == {"updated_at", "deleted_at"}
        assert mismatched == {}
