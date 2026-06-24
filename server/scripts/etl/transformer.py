"""ETL 转换器 - 主键映射 / 字段重命名 / 单位转换."""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from app.models.id_mapping import IdMapping
from scripts.etl.config import MigrationTask

logger = logging.getLogger(__name__)


def _to_uuid() -> str:
    """生成 G 盘 String(64) UUID."""
    return uuid.uuid4().hex


def _yuan_to_fen(value: Any) -> int:
    """元 → 分 (BigDecimal/DECIMAL(10,2) → Integer)."""
    if value is None or value == "":
        return 0
    if isinstance(value, (int, float, Decimal)):
        return int(Decimal(str(value)) * 100)
    return int(Decimal(str(value)) * 100)


def _fen_to_yuan(value: Any) -> float:
    """分 → 元."""
    if value is None or value == "":
        return 0.0
    return float(Decimal(str(value)) / 100)


def _to_bool_tinyint(value: Any) -> int:
    """H 盘 TINYINT(0/1) 兼容 (实际 Python 端已用 Boolean)."""
    if value is None:
        return 0
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, (int, float)):
        return 1 if value else 0
    s = str(value).strip().lower()
    if s in ("1", "true", "yes", "y", "t"):
        return 1
    return 0


def _normalize_datetime(value: Any) -> Any:
    """统一日期时间格式为 datetime (剥离 tz)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    return value


def _normalize_date(value: Any) -> Any:
    """date 类型兼容."""
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value
    return value


def _apply_unit_convert(row: dict[str, Any], task: MigrationTask) -> dict[str, Any]:
    """应用单位转换规则 (yuan_to_fen / boolean_tinyint)."""
    convert_funcs = {
        "yuan_to_fen": _yuan_to_fen,
        "fen_to_yuan": _fen_to_yuan,
        "boolean_tinyint": _to_bool_tinyint,
    }
    for h_field, rule in task.unit_convert.items():
        if h_field in row:
            row[h_field] = convert_funcs[rule](row[h_field])
    return row


def _apply_field_map(row: dict[str, Any], task: MigrationTask) -> dict[str, Any]:
    """应用字段重命名 (H 盘字段名 → G 盘字段名)."""
    if not task.field_map:
        return row
    out = {}
    for h_field, g_field in task.field_map.items():
        if h_field in row:
            out[g_field] = row[h_field]
    # 保留未在 field_map 中的字段 (H/G 同名时)
    for k, v in row.items():
        if k not in task.field_map:
            out[k] = v
    return out


def _resolve_id_lookup(
    row: dict[str, Any],
    task: MigrationTask,
    mapping_cache: dict[tuple[str, int], str],
) -> dict[str, Any]:
    """把 H 盘 Long 外键替换为 G 盘 String(64) UUID.

    通过 id_mapping 缓存查, 查不到则生成新 UUID 并记录映射.
    """
    if not task.id_lookup:
        return row
    for g_field, source_table in task.id_lookup.items():
        if g_field not in row or row[g_field] is None:
            continue
        old_id = int(row[g_field])
        cache_key = (source_table, old_id) if source_table else (task.source_table, old_id)
        # 优先查缓存
        new_uuid = mapping_cache.get(cache_key)
        if new_uuid is None:
            # 缓存未命中, 生成新 UUID 并 record (事务外, 容错)
            new_uuid = _to_uuid()
            mapping_cache[cache_key] = new_uuid
            # 持久化: 延迟到 batch 提交时批量写, 避免单行失败导致映射缺失
        row[g_field] = new_uuid
    return row


def transform_row(
    row: dict[str, Any],
    task: MigrationTask,
    mapping_cache: dict[tuple[str, int], str],
) -> dict[str, Any]:
    """单行转换流水线."""
    # 1. 单位转换
    _apply_unit_convert(row, task)
    # 2. id 映射
    _resolve_id_lookup(row, task, mapping_cache)
    # 3. 字段重命名
    row = _apply_field_map(row, task)
    # 4. 日期归一化
    for k, v in list(row.items()):
        if isinstance(v, datetime):
            row[k] = _normalize_datetime(v)
        elif isinstance(v, date):
            row[k] = _normalize_date(v)
    # 5. 自动生成新主键 UUID
    if "id" in row and not str(row["id"]).startswith(tuple("0123456789abcdef")):
        # 已是 UUID, 跳过
        pass
    elif "id" in row:
        # Long 旧主键 → 新 UUID
        old_id = row["id"]
        new_uuid = _to_uuid()
        # 记录自身映射
        cache_key = (task.source_table, int(old_id))
        if cache_key not in mapping_cache:
            mapping_cache[cache_key] = new_uuid
        row["id"] = new_uuid
    return row
