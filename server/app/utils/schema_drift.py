"""Bug-65: Schema 漂移自动告警.

风险: 业务上线后, 实际 DB 结构和 ORM model 不一致, 导致:
  - 缺列 → 查询报错
  - 多列 → 代码未使用, 占资源
  - 类型不一致 → 隐式转换性能差
  - 缺索引 → 全表扫

设计:
  1) 启动时 diff_schema(): 拉 information_schema + 读 ORM model, 生成 diff
  2) diff 三类: missing_column (DB 缺) / extra_column (DB 多) / type_mismatch
  3) 漂移率 = diff 数 / 总列数; 漂移率 > 0 触发告警
  4) 提供 /api/v1/diag/schema_drift 端点 (admin 查)
  5) 启动期可设置 SCHEMA_DRIFT_BASELINE 来记录"基线"避免误报

使用:
    from app.utils.schema_drift import detect_drift, schema_drift_checker

    # 启动时跑一次
    report = await detect_drift(engines=ENGINES, models=ALL_MODELS)
    if report["has_drift"]:
        logger.warning(f"schema drift: {report['summary']}")
"""

import asyncio
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ColumnDiff:
    table: str
    column: str
    kind: str  # missing / extra / type_mismatch
    expected: Any = None
    actual: Any = None

    def to_dict(self) -> dict:
        return {
            "table": self.table,
            "column": self.column,
            "kind": self.kind,
            "expected": str(self.expected) if self.expected is not None else None,
            "actual": str(self.actual) if self.actual is not None else None,
        }


@dataclass
class TableDiff:
    table: str
    missing_columns: list[ColumnDiff] = field(default_factory=list)
    extra_columns: list[ColumnDiff] = field(default_factory=list)
    type_mismatches: list[ColumnDiff] = field(default_factory=list)

    @property
    def diff_count(self) -> int:
        return len(self.missing_columns) + len(self.extra_columns) + len(self.type_mismatches)

    def to_dict(self) -> dict:
        return {
            "table": self.table,
            "missing": [c.to_dict() for c in self.missing_columns],
            "extra": [c.to_dict() for c in self.extra_columns],
            "type_mismatches": [c.to_dict() for c in self.type_mismatches],
            "diff_count": self.diff_count,
        }


def _model_columns(model: type) -> dict[str, dict[str, Any]]:
    """从 SQLAlchemy ORM model 提取列信息."""
    out: dict[str, dict[str, Any]] = {}
    try:
        if not hasattr(model, "__table__"):
            return out
        tbl = model.__table__
        for col in tbl.columns:
            out[col.name] = {
                "type": str(col.type),
                "nullable": bool(col.nullable),
                "default": str(col.default.arg) if col.default and hasattr(col.default, "arg") else None,
                "primary_key": bool(col.primary_key),
            }
    except Exception as e:
        logger.debug(f"model_columns({model}) fail: {e}")
    return out


def _db_columns_sync(engine, table_name: str) -> dict[str, dict[str, Any]]:
    """从 information_schema 读 DB 实际列."""
    out: dict[str, dict[str, Any]] = {}
    try:
        from sqlalchemy import text

        with engine.connect() as conn:
            rows = conn.execute(
                text(
                    "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY "
                    "FROM information_schema.COLUMNS "
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tbl"
                ),
                {"tbl": table_name},
            ).fetchall()
        for col_name, data_type, is_nullable, col_default, col_key in rows:
            out[col_name] = {
                "type": data_type,
                "nullable": is_nullable == "YES",
                "default": col_default,
                "primary_key": col_key == "PRI",
            }
    except Exception as e:
        logger.debug(f"db_columns({table_name}) fail: {e}")
    return out


async def _db_columns(engine, table_name: str) -> dict[str, dict[str, Any]]:
    return await asyncio.to_thread(_db_columns_sync, engine, table_name)


async def detect_drift(
    engines: dict[str, Any],
    models: list[type],
    *,
    table_to_engine: dict[str, Any] | None = None,
) -> dict:
    """检测 schema drift.

    Args:
        engines: 引擎字典 {"ai": engine1, ...}
        models: ORM model class 列表
        table_to_engine: 表名 → 引擎, 缺省用 app.database.get_engine_for_table

    Returns:
        dict: {has_drift, total_columns, drift_count, tables: [...], summary: str}
    """
    if table_to_engine is None:
        try:
            from app.database import get_engine_for_table
        except Exception:
            get_engine_for_table = None
    else:
        get_engine_for_table = None

    table_diffs: list[TableDiff] = []
    total_columns = 0
    drift_count = 0
    tables_checked = 0

    for model in models:
        try:
            tbl = model.__table__
            tbl_name = tbl.name
            # 选 engine
            if get_engine_for_table is not None:
                engine = get_engine_for_table(tbl_name)
            elif table_to_engine is not None:
                engine = table_to_engine.get(tbl_name) or next(iter(engines.values()))
            else:
                engine = next(iter(engines.values()))

            model_cols = _model_columns(model)
            db_cols = await _db_columns(engine, tbl_name)
            if not db_cols:
                # 表不存在 = 整表 missing (只 missing columns, 算大漂移)
                td = TableDiff(table=tbl_name)
                for cname, cinfo in model_cols.items():
                    td.missing_columns.append(ColumnDiff(table=tbl_name, column=cname, kind="missing", expected=cinfo))
                if td.diff_count > 0:
                    table_diffs.append(td)
                    drift_count += td.diff_count
                total_columns += len(model_cols)
                tables_checked += 1
                continue

            total_columns += max(len(model_cols), len(db_cols))
            tables_checked += 1
            td = TableDiff(table=tbl_name)
            # missing: model 有, DB 无
            for cname, cinfo in model_cols.items():
                if cname not in db_cols:
                    td.missing_columns.append(ColumnDiff(table=tbl_name, column=cname, kind="missing", expected=cinfo))
            # extra: DB 有, model 无
            for cname, cinfo in db_cols.items():
                if cname not in model_cols:
                    td.extra_columns.append(ColumnDiff(table=tbl_name, column=cname, kind="extra", actual=cinfo))
            # type_mismatch: 同名列, 类型不一致
            for cname in model_cols:
                if cname in db_cols:
                    expected_type = model_cols[cname]["type"].lower()
                    actual_type = db_cols[cname]["type"].lower()
                    # 兼容类型 (int / integer / bigint / smallint 视为同族)
                    same = _types_compatible(expected_type, actual_type)
                    if not same:
                        td.type_mismatches.append(
                            ColumnDiff(
                                table=tbl_name,
                                column=cname,
                                kind="type_mismatch",
                                expected=expected_type,
                                actual=actual_type,
                            )
                        )
            if td.diff_count > 0:
                table_diffs.append(td)
                drift_count += td.diff_count
        except Exception as e:
            logger.debug(f"detect_drift model={model} fail: {e}")

    drift_rate = drift_count / total_columns if total_columns > 0 else 0.0
    has_drift = drift_count > 0
    summary = (
        f"{drift_count} drift(s) across {len(table_diffs)} table(s) "
        f"(of {tables_checked} checked, {total_columns} columns total, "
        f"rate {drift_rate:.2%})"
    )
    report = {
        "has_drift": has_drift,
        "drift_count": drift_count,
        "total_columns": total_columns,
        "tables_checked": tables_checked,
        "drift_rate": round(drift_rate, 4),
        "tables": [td.to_dict() for td in table_diffs],
        "summary": summary,
        "ts": time.time(),
    }
    # 触发告警
    if has_drift:
        try:
            from app.utils.alert_router import alert_warning

            alert_warning(
                "schema_drift",
                f"Schema drift detected: {summary}. " f"Run 'alembic check' to investigate.",
            )
        except Exception:
            logger.warning("Caught unexpected exception")
    return report


def _types_compatible(expected: str, actual: str) -> bool:
    """简化: 同族类型视为一致 (variance 容忍)."""
    expected = expected.lower().strip()
    actual = actual.lower().strip()
    # 去掉括号参数 (varchar(255) -> varchar)
    expected_base = re.split(r"[\(\s]", expected, 1)[0]
    actual_base = re.split(r"[\(\s]", actual, 1)[0]
    if expected_base == actual_base:
        return True
    # 数字家族
    int_family = {"int", "integer", "bigint", "smallint", "tinyint", "mediumint"}
    str_family = {"varchar", "char", "text", "longtext", "mediumtext", "tinytext", "string"}
    float_family = {"float", "double", "real", "decimal", "numeric"}
    date_family = {"datetime", "timestamp", "date", "time"}
    for family in (int_family, str_family, float_family, date_family):
        if expected_base in family and actual_base in family:
            return True
    return False


# 全局缓存
_drift_cache: dict[str, Any] = {}


def get_last_drift() -> dict | None:
    return _drift_cache.get("last_report")


def cache_drift_report(report: dict) -> None:
    _drift_cache["last_report"] = report
    _drift_cache["ts"] = time.time()
