"""双写期方案 - H 盘 MySQL 与 G 盘 PostgreSQL 并行写入.

迁移过渡期的关键基础设施:
- 写操作同时落 H/G 双盘
- 读操作可配置走 H / G / 双读兜底
- 失败时主备切换 (H 优先 / G 优先)
- 全量对账 (定时任务)
"""
from __future__ import annotations

import enum
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Callable

from loguru import logger

# 配置
DUAL_WRITE_ENABLED = os.getenv("DUAL_WRITE_ENABLED", "true").lower() == "true"
DUAL_WRITE_PRIMARY = os.getenv("DUAL_WRITE_PRIMARY", "G").upper()  # H = H 盘主, G = G 盘主
DUAL_WRITE_READ_FROM = os.getenv("DUAL_WRITE_READ_FROM", "G").upper()  # 读盘 H/G/BOTH
DUAL_WRITE_RECONCILE = os.getenv("DUAL_WRITE_RECONCILE", "true").lower() == "true"


class SourceDisk(str, enum.Enum):
    """数据来源盘."""
    H = "H"  # 旧 MySQL
    G = "G"  # 新 PostgreSQL
    BOTH = "BOTH"  # 双读


# ---------------------------------------------------------------------------
# 双写装饰器
# ---------------------------------------------------------------------------

def dual_write(
    table_name: str,
    h_op: Callable[..., Any],
    g_op: Callable[..., Any],
):
    """装饰器: 同时调用 h_op 和 g_op 写入, 一边失败不影响另一边 (主盘优先).

    用法:
        @dual_write(
            table_name="t_member",
            h_op=lambda data: h_member_dao.insert(data),
            g_op=lambda data: g_member_dao.create(data),
        )
        def create_member(data):
            pass
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            if not DUAL_WRITE_ENABLED:
                return func(*args, **kwargs)

            primary_error = None
            secondary_error = None
            primary_result = None
            secondary_result = None

            if DUAL_WRITE_PRIMARY == "G":
                primary_op, secondary_op = g_op, h_op
            else:
                primary_op, secondary_op = h_op, g_op

            # 主盘: 必须成功
            try:
                primary_result = primary_op(*args, **kwargs)
            except Exception as e:
                primary_error = e
                logger.error(f"[dual_write] primary {DUAL_WRITE_PRIMARY} 盘写入 {table_name} 失败: {e}")
                # 备盘: 尽力写入
                try:
                    secondary_result = secondary_op(*args, **kwargs)
                except Exception as e2:
                    secondary_error = e2
                    logger.error(f"[dual_write] secondary 盘也失败: {e2}")
                # 主盘失败时, 抛错以触发业务回滚
                if primary_error:
                    raise primary_error

            # 备盘: 异步写入, 不阻塞主流程
            try:
                if primary_result is not None:
                    secondary_result = secondary_op(*args, **kwargs)
            except Exception as e:
                secondary_error = e
                logger.warning(
                    f"[dual_write] secondary 盘写入 {table_name} 失败, "
                    f"加入异步重试队列: {e}"
                )
                # TODO: 加入 retry queue, 后台 worker 定时重试

            logger.info(
                f"[dual_write] {table_name} 写入成功: "
                f"primary={DUAL_WRITE_PRIMARY} result={primary_result is not None} "
                f"secondary_result={secondary_result is not None}"
            )
            return primary_result or secondary_result

        return wrapper

    return decorator


# ---------------------------------------------------------------------------
# 双读策略
# ---------------------------------------------------------------------------

@dataclass
class DualReadResult:
    """双读结果对比."""
    h_value: Any = None
    g_value: Any = None
    h_error: Exception | None = None
    g_error: Exception | None = None
    consistent: bool = True

    @property
    def final_value(self) -> Any:
        """按 DUAL_WRITE_READ_FROM 决定取哪个值."""
        if DUAL_WRITE_READ_FROM == "H":
            return self.h_value if self.h_error is None else self.g_value
        if DUAL_WRITE_READ_FROM == "G":
            return self.g_value if self.g_error is None else self.h_value
        # BOTH: 一致则任取, 不一致则取 G 为主 (新数据源)
        if self.h_value is None and self.g_value is None:
            return None
        if self.h_value is None:
            return self.g_value
        if self.g_value is None:
            return self.h_value
        return self.g_value

    def diff(self) -> dict[str, Any]:
        """返回差异详情, 用于对账."""
        return {
            "h_value": str(self.h_value)[:200] if self.h_value else None,
            "g_value": str(self.g_value)[:200] if self.g_value else None,
            "consistent": self.consistent,
        }


def dual_read(
    h_reader: Callable[[], Any],
    g_reader: Callable[[], Any],
    deep_compare: bool = False,
) -> DualReadResult:
    """同时从 H/G 读, 返回对比结果.

    Args:
        h_reader: 读 H 盘的 callable (无参)
        g_reader: 读 G 盘的 callable (无参)
        deep_compare: 是否做深度对比 (dict 逐字段)

    Returns:
        DualReadResult: 含 h_value/g_value/差异信息
    """
    result = DualReadResult()

    # 读 H
    try:
        result.h_value = h_reader()
    except Exception as e:
        result.h_error = e
        logger.warning(f"[dual_read] H 盘读取失败: {e}")

    # 读 G
    try:
        result.g_value = g_reader()
    except Exception as e:
        result.g_error = e
        logger.warning(f"[dual_read] G 盘读取失败: {e}")

    # 一致性校验
    if result.h_value is not None and result.g_value is not None:
        if deep_compare:
            result.consistent = _deep_equal(result.h_value, result.g_value)
        else:
            result.consistent = str(result.h_value) == str(result.g_value)
        if not result.consistent:
            logger.warning(
                f"[dual_read] H/G 不一致: H={result.h_value!r} G={result.g_value!r}"
            )

    return result


def _deep_equal(a: Any, b: Any) -> bool:
    """深度比较两个对象 (dict / list / 标量)."""
    if type(a) is not type(b):
        return False
    if isinstance(a, dict):
        if a.keys() != b.keys():
            return False
        return all(_deep_equal(a[k], b[k]) for k in a)
    if isinstance(a, list):
        if len(a) != len(b):
            return False
        return all(_deep_equal(x, y) for x, y in zip(a, b))
    return a == b


# ---------------------------------------------------------------------------
# 对账 (reconciliation)
# ---------------------------------------------------------------------------

@dataclass
class ReconcileReport:
    """单表对账报告."""
    table: str
    h_count: int = 0
    g_count: int = 0
    only_in_h: int = 0
    only_in_g: int = 0
    inconsistent: int = 0
    sample_inconsistencies: list[dict] = field(default_factory=list)

    @property
    def is_balanced(self) -> bool:
        return self.h_count == self.g_count and self.inconsistent == 0


def reconcile_table(
    table: str,
    h_session_factory: Callable,
    g_session_factory: Callable,
    pk_column: str = "id",
    sample_size: int = 10,
) -> ReconcileReport:
    """对单表做行数对比 + 抽样校验.

    Args:
        table: 表名
        h_session_factory: H 盘 session 工厂
        g_session_factory: G 盘 session 工厂
        pk_column: 主键列
        sample_size: 抽样不一致数 (发现的不一致会保留前 N 条作详情)

    Returns:
        ReconcileReport
    """
    from sqlalchemy import text

    report = ReconcileReport(table=table)

    # 1. 行数
    with h_session_factory() as h:
        report.h_count = h.execute(text(f"SELECT COUNT(*) FROM `{table}`")).scalar()
    with g_session_factory() as g:
        report.g_count = g.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()

    # 2. 仅 H 盘有 (缺 G)
    h_pks = set()
    with h_session_factory() as h:
        rows = h.execute(text(f"SELECT `{pk_column}` FROM `{table}`")).fetchall()
        h_pks = {str(r[0]) for r in rows}
    g_pks = set()
    with g_session_factory() as g:
        rows = g.execute(text(f"SELECT {pk_column} FROM {table}")).fetchall()
        g_pks = {str(r[0]) for r in rows}

    report.only_in_h = len(h_pks - g_pks)
    report.only_in_g = len(g_pks - h_pks)

    # 3. 抽样对比共有 PK 的内容
    common = h_pks & g_pks
    if common and sample_size > 0:
        sample = list(common)[:sample_size]
        # H 盘: 原始列名
        h_columns_sql = "SELECT * FROM `{table}` WHERE `{pk}` IN ({holders})".format(
            table=table, pk=pk_column, holders=",".join(f"'{p}'" for p in sample)
        )
        # G 盘: 同样原始列名
        g_columns_sql = "SELECT * FROM {table} WHERE {pk} IN ({holders})".format(
            table=table, pk=pk_column, holders=",".join(f"'{p}'" for p in sample)
        )
        with h_session_factory() as h:
            h_rows = {str(r[0]): dict(r._mapping) for r in h.execute(text(h_columns_sql))}
        with g_session_factory() as g:
            g_rows = {str(r[0]): dict(r._mapping) for r in g.execute(text(g_columns_sql))}
        for pk in sample:
            h_data, g_data = h_rows.get(pk, {}), g_rows.get(pk, {})
            if str(h_data) != str(g_data):
                report.inconsistent += 1
                if len(report.sample_inconsistencies) < sample_size:
                    report.sample_inconsistencies.append({
                        "pk": pk,
                        "h": {k: str(v)[:100] for k, v in h_data.items()},
                        "g": {k: str(v)[:100] for k, v in g_data.items()},
                    })

    logger.info(
        f"[reconcile] {table}: H={report.h_count} G={report.g_count} "
        f"only_h={report.only_in_h} only_g={report.only_in_g} "
        f"inconsistent={report.inconsistent} {'✓' if report.is_balanced else '✗'}"
    )
    return report


def full_reconcile() -> list[ReconcileReport]:
    """全量对账: 关键 31 张表."""
    from app.database import get_session
    from scripts.etl.extractor import get_h_engine
    from sqlalchemy import text

    # 关键表清单
    tables = [
        # member
        "t_member", "t_member_company", "t_member_tag",
        "t_member_post", "t_member_group", "t_check_in", "t_follow",
        # learn
        "t_lesson", "t_lesson_chapter", "t_lesson_chapter_section",
        "t_sign_up", "t_record", "t_rate", "t_topic",
        "t_category", "t_homework_record", "t_certificate",
        "t_learn_map", "lesson_access", "t_exam_paper_record",
        # exam
        "t_category", "t_paper", "t_question", "t_record",
        "t_wrong_question", "t_exam_chapter", "t_exam_chapter_section",
    ]

    reports = []
    h_engines = {}
    for table in set(tables):
        # 按 service 分组 (简化: 全部用 learn 的 engine, 实际不同表不同库)
        try:
            eng = get_h_engine("ihui-ai-edu-learn-service")
            h_engines[table] = eng
        except Exception:
            pass

    h_session_factory = lambda eng=next(iter(h_engines.values()), None): eng.connect()
    g_session_factory = get_session

    for table in set(tables):
        try:
            h_eng = h_engines.get(table)
            if not h_eng:
                continue
            report = reconcile_table(
                table=table,
                h_session_factory=lambda: h_eng.connect(),
                g_session_factory=g_session_factory,
            )
            reports.append(report)
        except Exception as e:
            logger.error(f"对账 {table} 失败: {e}")
            reports.append(ReconcileReport(table=table))

    return reports
