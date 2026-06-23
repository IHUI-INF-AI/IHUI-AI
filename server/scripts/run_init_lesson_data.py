#!/usr/bin/env python
"""课程测试数据初始化脚本 (PostgreSQL 版).

功能:
  - 读取转换后的 PostgreSQL 兼容 SQL 文件 (init_lesson_data_pg.sql)
  - 通过 SQLAlchemy 执行 SQL 语句
  - 支持 --dry-run (只打印不执行) 和 --force (强制执行, 忽略错误)
  - 输出执行结果摘要

SQL 文件内容:
  - 向 t_lesson 表插入 45 条课程数据 (id: 10001-10045)
  - 向 t_lesson_category_relation 表插入课程-分类关联数据
  - 验证数据完整性

用法:
  python -m scripts.run_init_lesson_data                          # 默认执行
  python -m scripts.run_init_lesson_data --dry-run                # 预览模式 (只打印不执行)
  python -m scripts.run_init_lesson_data --force                  # 强制执行 (忽略错误继续)
  python -m scripts.run_init_lesson_data --db engine3             # 指定数据库引擎
  python -m scripts.run_init_lesson_data --dry-run --force        # 预览+强制
  python -m scripts.run_init_lesson_data --sql-file /path/to.sql  # 指定 SQL 文件路径
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

# 添加项目根目录到 Python 路径
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from loguru import logger
from sqlalchemy import text

from app.database import ENGINES, SessionFactory1, SessionFactory2, SessionFactory3

# ---------------------------------------------------------------------------
# 常量定义
# ---------------------------------------------------------------------------

DEFAULT_SQL_FILE = str(Path(__file__).resolve().parent / "init_lesson_data_pg.sql")

# 数据库引擎映射 (支持 engine1/2/3 和 ai/center/course 两种命名)
DB_FACTORIES = {
    "engine1": SessionFactory1,
    "engine2": SessionFactory2,
    "engine3": SessionFactory3,
    "ai": SessionFactory1,
    "center": SessionFactory2,
    "course": SessionFactory3,
}

# 默认使用 engine3 (课程库, t_lesson 表所在)
DEFAULT_DB = "engine3"


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------


@dataclass
class ExecStats:
    """SQL 执行统计信息."""

    total_statements: int = 0
    executed: int = 0
    succeeded: int = 0
    failed: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)

    def summary(self) -> str:
        """生成统计摘要字符串."""
        lines = [
            "",
            "=" * 60,
            "  SQL 执行统计摘要",
            "=" * 60,
            f"  SQL 语句总数: {self.total_statements}",
            f"  已执行: {self.executed}",
            f"    - 成功: {self.succeeded}",
            f"    - 失败: {self.failed}",
            f"  跳过 (dry-run): {self.skipped}",
        ]
        if self.errors:
            lines.append(f"  错误数: {len(self.errors)}")
            for err in self.errors[:10]:
                lines.append(f"    - {err}")
            if len(self.errors) > 10:
                lines.append(f"    ... 还有 {len(self.errors) - 10} 条错误")
        lines.append("=" * 60)
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# SQL 文件解析
# ---------------------------------------------------------------------------


def split_sql_statements(sql_content: str) -> list[str]:
    """将 SQL 文件内容拆分为单独的语句.

    处理规则:
      - 按分号 (;) 分割语句
      - 跳过纯注释行 (以 -- 开头)
      - 跳过空语句
      - 保留语句内的注释 (如行内 -- 注释)

    Args:
        sql_content: SQL 文件完整内容

    Returns:
        SQL 语句列表 (不含尾部分号)
    """
    # 移除 SET search_path 语句 (由脚本单独处理)
    # 移除单行注释行 (以 -- 开头)
    lines = sql_content.splitlines()
    processed_lines: list[str] = []

    for line in lines:
        stripped = line.strip()
        # 保留所有行 (包括注释行), 因为注释可能附着在语句中
        processed_lines.append(line)

    full_text = "\n".join(processed_lines)

    # 按分号分割语句
    # 简单分割: 不处理字符串内的分号 (本 SQL 文件中没有这种情况)
    raw_statements = full_text.split(";")

    statements: list[str] = []
    for stmt in raw_statements:
        stmt = stmt.strip()
        if not stmt:
            continue

        # 跳过纯注释块 (只包含 -- 注释行和空行)
        lines_in_stmt = stmt.splitlines()
        non_comment_lines = [
            l for l in lines_in_stmt
            if l.strip() and not l.strip().startswith("--")
        ]
        if not non_comment_lines:
            continue

        # 跳过 SET search_path 语句 (由脚本控制)
        if stmt.upper().startswith("SET SEARCH_PATH"):
            continue

        statements.append(stmt)

    return statements


# ---------------------------------------------------------------------------
# SQL 执行
# ---------------------------------------------------------------------------


def execute_sql(
    statements: list[str],
    factory: object,
    dry_run: bool,
    force: bool,
    stats: ExecStats,
) -> None:
    """执行 SQL 语句列表.

    Args:
        statements: SQL 语句列表
        factory: SQLAlchemy sessionmaker
        dry_run: 预览模式 (只打印不执行)
        force: 强制模式 (忽略错误继续执行)
        stats: 统计信息对象
    """
    stats.total_statements = len(statements)

    if dry_run:
        logger.info("[DRY-RUN] 预览模式: 只打印 SQL, 不实际执行")
        for i, stmt in enumerate(statements, 1):
            # 截取前 200 字符用于预览
            preview = stmt.replace("\n", " ")[:200]
            if len(stmt) > 200:
                preview += " ..."
            logger.info(f"  [{i}/{len(statements)}] {preview}")
            stats.skipped += 1
        return

    logger.info(f"开始执行 {len(statements)} 条 SQL 语句...")
    db = factory()
    try:
        for i, stmt in enumerate(statements, 1):
            # 提取语句类型 (INSERT/DELETE/SELECT 等)
            stmt_type = _get_statement_type(stmt)
            # 兼容 SQLite: 将 NOW() 替换为 CURRENT_TIMESTAMP
            stmt = stmt.replace("NOW()", "CURRENT_TIMESTAMP").replace("now()", "CURRENT_TIMESTAMP")
            # 截取预览
            preview = stmt.replace("\n", " ")[:120]
            if len(stmt) > 120:
                preview += " ..."

            try:
                result = db.execute(text(stmt))

                # SELECT 语句输出结果
                if stmt_type == "SELECT":
                    rows = result.fetchall()
                    logger.info(f"  [{i}/{len(statements)}] SELECT 返回 {len(rows)} 行")
                    for row in rows[:20]:
                        logger.info(f"    {dict(row._mapping)}")
                    if len(rows) > 20:
                        logger.info(f"    ... 还有 {len(rows) - 20} 行")
                else:
                    affected = result.rowcount
                    logger.info(
                        f"  [{i}/{len(statements)}] {stmt_type} 影响 {affected} 行"
                    )

                stats.executed += 1
                stats.succeeded += 1

            except Exception as e:
                stats.executed += 1
                stats.failed += 1
                error_msg = f"[{i}/{len(statements)}] {stmt_type} 失败: {e}"
                stats.errors.append(error_msg)
                logger.error(f"  {error_msg}")
                logger.error(f"    SQL: {preview}")

                if not force:
                    logger.error("  遇到错误且未启用 --force, 正在回滚...")
                    db.rollback()
                    return
                else:
                    logger.warning("  --force 模式: 忽略错误, 继续执行")

        db.commit()
        logger.info(f"事务已提交, 成功 {stats.succeeded} 条")

    except Exception as e:
        db.rollback()
        stats.failed += 1
        stats.errors.append(f"事务级错误: {e}")
        logger.error(f"事务执行失败, 已回滚: {e}")
        raise
    finally:
        db.close()


def _get_statement_type(stmt: str) -> str:
    """获取 SQL 语句类型.

    Args:
        stmt: SQL 语句

    Returns:
        语句类型字符串 (INSERT/DELETE/SELECT/UPDATE/SET/其他)
    """
    # 移除前导注释和空行
    for line in stmt.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("--"):
            # 获取第一个单词
            first_word = stripped.split()[0].upper()
            return first_word
    return "UNKNOWN"


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------


def setup_logging(verbose: bool = False) -> None:
    """配置日志."""
    logger.remove()
    level = "DEBUG" if verbose else "INFO"
    logger.add(
        sys.stderr,
        level=level,
        format="<green>{time:HH:mm:ss}</green> | <level>{level:<7}</level> | {message}",
    )


def run_init(
    sql_file: str,
    db_name: str,
    dry_run: bool,
    force: bool,
) -> ExecStats:
    """执行初始化主流程.

    Args:
        sql_file: SQL 文件路径
        db_name: 数据库引擎名称 (engine1/engine2/engine3)
        dry_run: 预览模式
        force: 强制模式

    Returns:
        执行统计信息
    """
    stats = ExecStats()

    # 验证 SQL 文件
    sql_path = Path(sql_file)
    if not sql_path.exists():
        logger.error(f"SQL 文件不存在: {sql_file}")
        stats.errors.append(f"SQL 文件不存在: {sql_file}")
        return stats

    # 获取数据库工厂
    factory = DB_FACTORIES.get(db_name)
    if factory is None:
        logger.error(f"未知的数据库引擎: {db_name}, 可选: {list(DB_FACTORIES.keys())}")
        stats.errors.append(f"未知的数据库引擎: {db_name}")
        return stats

    logger.info("=" * 60)
    logger.info("  课程测试数据初始化 (PostgreSQL)")
    logger.info("=" * 60)
    logger.info(f"  SQL 文件: {sql_file}")
    logger.info(f"  数据库引擎: {db_name}")
    logger.info(f"  预览模式: {'是' if dry_run else '否'}")
    logger.info(f"  强制模式: {'是' if force else '否'}")
    logger.info("=" * 60)

    # 读取 SQL 文件
    logger.info("正在读取 SQL 文件...")
    try:
        with open(sql_path, "r", encoding="utf-8") as f:
            sql_content = f.read()
    except OSError as e:
        logger.error(f"读取 SQL 文件失败: {e}")
        stats.errors.append(f"读取 SQL 文件失败: {e}")
        return stats

    file_size = len(sql_content)
    line_count = sql_content.count("\n") + 1
    logger.info(f"  文件大小: {file_size} 字节, {line_count} 行")

    # 解析 SQL 语句
    logger.info("正在解析 SQL 语句...")
    statements = split_sql_statements(sql_content)
    logger.info(f"  解析出 {len(statements)} 条 SQL 语句")

    # 分类统计
    type_counts: dict[str, int] = {}
    for stmt in statements:
        stmt_type = _get_statement_type(stmt)
        type_counts[stmt_type] = type_counts.get(stmt_type, 0) + 1
    for stype, count in sorted(type_counts.items()):
        logger.info(f"    {stype}: {count} 条")

    # 测试数据库连接
    if not dry_run:
        logger.info(f"正在测试数据库连接 ({db_name})...")
        # ENGINES 的键是 ai/center/course, DB_FACTORIES 同时支持 engine1/2/3 和 ai/center/course
        engine_key = db_name
        if db_name == "engine1":
            engine_key = "ai"
        elif db_name == "engine2":
            engine_key = "center"
        elif db_name == "engine3":
            engine_key = "course"
        engine = ENGINES.get(engine_key)
        if engine is None:
            logger.error(f"无法获取数据库引擎: {db_name} (映射键: {engine_key})")
            stats.errors.append(f"无法获取数据库引擎: {db_name}")
            return stats
        try:
            conn = engine.connect()
            conn.close()
            logger.info("  数据库连接正常")
        except Exception as e:
            logger.error(f"  数据库连接失败: {e}")
            stats.errors.append(f"数据库连接失败: {e}")
            return stats

    # 执行 SQL
    logger.info("")
    logger.info("开始执行 SQL 语句...")
    logger.info("-" * 60)

    execute_sql(statements, factory, dry_run, force, stats)

    # 执行后验证 (仅非 dry-run 模式)
    if not dry_run and stats.failed == 0:
        logger.info("")
        logger.info("执行后数据验证...")
        _verify_data(factory, stats)

    return stats


def _verify_data(factory: object, stats: ExecStats) -> None:
    """执行后数据验证.

    Args:
        factory: SQLAlchemy sessionmaker
        stats: 统计信息对象
    """
    verify_queries = [
        ("t_lesson 课程数据", "SELECT COUNT(*) AS count FROM t_lesson WHERE id BETWEEN 10001 AND 10045"),
        ("t_lesson_category_relation 关联数据", "SELECT COUNT(*) AS count FROM t_lesson_category_relation WHERE lesson_id BETWEEN 10001 AND 10045"),
    ]

    db = factory()
    try:
        for label, query in verify_queries:
            try:
                result = db.execute(text(query))
                row = result.fetchone()
                count = row[0] if row else 0
                logger.info(f"  {label}: {count} 条")
            except Exception as e:
                logger.warning(f"  {label} 验证失败: {e}")
                stats.errors.append(f"验证失败: {label} - {e}")
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 命令行入口
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    """解析命令行参数."""
    parser = argparse.ArgumentParser(
        description="课程测试数据初始化脚本 (PostgreSQL 版)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python -m scripts.run_init_lesson_data                          # 默认执行
  python -m scripts.run_init_lesson_data --dry-run                # 预览模式
  python -m scripts.run_init_lesson_data --force                  # 强制执行
  python -m scripts.run_init_lesson_data --db engine3             # 指定数据库
  python -m scripts.run_init_lesson_data --dry-run --force        # 预览+强制
  python -m scripts.run_init_lesson_data --sql-file /path/to.sql  # 指定 SQL 文件
        """,
    )
    parser.add_argument(
        "--sql-file",
        default=DEFAULT_SQL_FILE,
        help=f"SQL 文件路径 (默认: {DEFAULT_SQL_FILE})",
    )
    parser.add_argument(
        "--db",
        default=DEFAULT_DB,
        choices=list(DB_FACTORIES.keys()),
        help=f"数据库引擎 (默认: {DEFAULT_DB}, 可选: engine1/engine2/engine3)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="预览模式: 只打印 SQL 语句, 不实际执行",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="强制模式: 忽略错误继续执行 (不回滚已成功的语句)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="详细日志模式 (DEBUG 级别)",
    )
    return parser.parse_args()


def main() -> None:
    """脚本入口."""
    args = parse_args()
    setup_logging(verbose=args.verbose)

    stats = run_init(
        sql_file=args.sql_file,
        db_name=args.db,
        dry_run=args.dry_run,
        force=args.force,
    )

    # 打印统计摘要
    print(stats.summary())

    # 退出码: 有失败则返回 1
    if stats.failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
