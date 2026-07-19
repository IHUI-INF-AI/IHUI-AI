"""ai-service 数据库 schema 字段对照校验。

防止 ai-service(asyncpg 原生 SQL)与 packages/database(Drizzle TS schema)字段漂移。

校验维度:
1. 自动扫描 ai-service/app 下所有 .py 文件中的 SQL,提取引用的表名
2. 对每个表:
   - 检查表在 DB 中存在
   - 从 TS schema 源码自动解析期望字段(无需手动同步字典)
   - 对比 DB 实际字段与 TS schema 期望字段
   - 检查表在 TS schema 中是否有定义(未定义 = 数据孤岛风险)
3. 关键字段缺失时 ERROR,普通字段缺失 WARNING,多余字段 INFO

校验时机:
1. 应用启动时(lifespan 注入,字段缺失仅 warning,不阻塞启动)
2. 手动执行 `python -m app.core.schema_check`(CI / 排查)
"""
import logging
import re
from pathlib import Path
from typing import Any, Optional

import asyncpg

from .config import settings

logger = logging.getLogger(__name__)

# ai-service 代码根目录(用于扫描 SQL 表名)
_APP_DIR = Path(__file__).resolve().parent.parent  # apps/ai-service/app

# packages/database/src/schema 目录(用于解析 TS schema)
# 从 apps/ai-service/app/core/ 回溯到 monorepo 根,再进入 packages/database
# 容器部署时 ai-service 镜像只 COPY app/,没有 monorepo 完整结构,parents[4] 会 IndexError
# 此时 _SCHEMA_DIR 指向不存在路径,后续 is_dir() 返回 False,自动走 FALLBACK_EXPECTED_COLUMNS
try:
    _SCHEMA_DIR = Path(__file__).resolve().parents[4] / "packages" / "database" / "src" / "schema"
except IndexError:
    _SCHEMA_DIR = Path("/nonexistent/packages/database/src/schema")

# 硬编码 fallback(当 TS 源码不可访问时使用,确保关键字段始终校验)
FALLBACK_EXPECTED_COLUMNS: dict[str, dict[str, str]] = {
    "ai_model_config": {
        "id": "bigint",
        "name": "varchar",
        "provider_code": "varchar",
        "is_builtin": "boolean",
        "base_url": "varchar",
        "api_format": "varchar",
        "api_key_enc": "text",
        "model_id_for_test": "varchar",
        "enabled": "boolean",
        "description": "text",
        "sort_order": "integer",
        "owner_uuid": "varchar",
        "last_test_status": "varchar",
        "last_test_response_ms": "integer",
        "last_tested_at": "varchar",
        "last_test_error": "text",
        "extra_config": "text",
        "created_at": "timestamp",
        "updated_at": "timestamp",
    },
}

# ai_model_config 关键字段(缺失即查询失败,优先级最高)
CRITICAL_FIELDS: dict[str, tuple[str, ...]] = {
    "ai_model_config": (
        "api_key_enc",
        "base_url",
        "api_format",
        "provider_code",
        "enabled",
        "owner_uuid",
        "sort_order",
        "id",
    ),
}

# TS Drizzle 列类型 → PostgreSQL 数据类型映射
TS_TYPE_TO_PG: dict[str, str] = {
    "bigserial": "bigint",
    "serial": "integer",
    "smallserial": "smallint",
    "varchar": "varchar",
    "char": "character",
    "integer": "integer",
    "text": "text",
    "boolean": "boolean",
    "timestamp": "timestamp",
    "bigint": "bigint",
    "smallint": "smallint",
    "jsonb": "jsonb",
    "json": "json",
    "decimal": "numeric",
    "numeric": "numeric",
    "real": "real",
    "doubleprecision": "double precision",
    "uuid": "uuid",
    "bytea": "bytea",
    "date": "date",
    "time": "time",
    "interval": "interval",
    "inet": "inet",
    "cidr": "cidr",
    "macaddr": "macaddr",
}

# Drizzle 列类型(用于排除 index/unique 等非列定义)
_DRIZZLE_COLUMN_TYPES = (
    r"(?:bigserial|serial|smallserial|varchar|char|integer|int|text|boolean|"
    r"timestamp|bigint|smallint|jsonb|json|decimal|numeric|real|"
    r"doublePrecision|uuid|bytea|date|time|interval|inet|cidr|macaddr|"
    r"bit|bitVarying|point|line|lseg|box|path|polygon|circle|"
    r"tsvector|tsquery|vector|geometry|bytea)"
)

# 正则:匹配 pgTable('table_name', { — 捕获表名
_PGTABLE_RE = re.compile(r"""pgTable\(\s*['"]([^'"]+)['"]\s*,\s*\{""", re.DOTALL)

# 正则:匹配 Drizzle 列定义 tsName: type('db_field', { ... }) — 仅匹配已知列类型
_COLUMN_RE = re.compile(
    rf"""(\w+):\s*({_DRIZZLE_COLUMN_TYPES})\(\s*['"]([^'"]+)['"]""",
    re.DOTALL | re.IGNORECASE,
)

# 正则:匹配 Python 字符串字面量(单引号/双引号/三引号)— SQL 只在字符串中
_STRING_LITERAL_RE = re.compile(
    r'"""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\'|"[^"\\]*(?:\\.[^"\\]*)*"|\'[^\'\\]*(?:\\.[^\'\\]*)*\'',
    re.DOTALL,
)

# 正则:匹配 SQL 中的表引用 FROM/INTO/UPDATE/JOIN table_name
_SQL_TABLE_RE = re.compile(
    r"""(?:FROM|INTO|UPDATE|JOIN)\s+(\w+)""",
    re.IGNORECASE,
)

# SQL 关键字(过滤误匹配)
_SQL_KEYWORDS = frozenset({
    "select", "where", "and", "or", "as", "on", "set", "values", "null",
    "default", "not", "in", "is", "like", "between", "group", "order",
    "limit", "offset", "distinct", "case", "when", "then", "else", "end",
    "join", "left", "right", "inner", "outer", "full", "cross", "using",
    "union", "intersect", "except", "all", "any", "exists", "some", "with",
    "recursive", "into", "from", "natural", "lateral", "table", "only",
    "partition", "over", "rows", "range", "unbounded", "preceding",
    "following", "current", "row", "first_value", "last_value", "lag",
    "lead", "ntile", "cume_dist", "percent_rank", "dense_rank", "rank",
    "row_number", "filter", "within", "without", "returning", "conflict",
    "do", "nothing", "excluded", "constraint", "cascade", "restrict",
    "view", "materialized", "create", "alter", "drop", "trigger",
    "function", "procedure", "schema", "database", "index", "sequence",
    "grant", "revoke", "begin", "commit", "rollback", "savepoint",
    "transaction", "lock", "share", "mode", "nowait", "skip", "locked",
})


def _find_table_end(content: str, start: int) -> int:
    """找到 pgTable 调用匹配的结束位置。

    从 start 开始(start 已在 pgTable 的 `{{` 之后),跟踪括号深度,
    跳过字符串/注释,返回与 pgTable( 配对的右括号位置 + 1。
    处理 schema 注释中包含的 `);`(如 migration 注释)。

    Args:
        content: TS 源文件全文
        start: pgTable 第一个 `{` 之后的位置(已在 pgTable 调用体内)

    Returns:
        匹配的结束位置(右括号后一位);未找到返回 start + 5000
    """
    # 已经在 pgTable(...) 内部,深度从 1 起
    depth = 1
    i = start
    n = len(content)
    in_string: str | None = None
    in_block_comment = False
    in_line_comment = False

    while i < n:
        ch = content[i]
        nxt = content[i + 1] if i + 1 < n else ""

        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
            i += 1
            continue

        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue

        if in_string is not None:
            if ch == "\\" and nxt:
                i += 2
                continue
            if ch == in_string:
                in_string = None
            i += 1
            continue

        if ch == "/" and nxt == "/":
            in_line_comment = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue
        if ch in ('"', "'", "`"):
            in_string = ch
            i += 1
            continue

        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1

    return start + 5000


def parse_ts_table_fields(schema_dir: Path, table_name: str) -> Optional[dict[str, str]]:
    """从 TS schema 源码解析指定表的字段定义。

    Args:
        schema_dir: packages/database/src/schema 目录
        table_name: PostgreSQL 表名(如 'ai_model_config')

    Returns:
        { db_field_name: pg_type } 或 None(未找到)
    """
    if not schema_dir.is_dir():
        return None

    table_pattern = re.compile(
        rf"""pgTable\(\s*['"]({re.escape(table_name)})['"]\s*,\s*\{{""",
        re.DOTALL,
    )

    for ts_file in schema_dir.glob("*.ts"):
        try:
            content = ts_file.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        match = table_pattern.search(content)
        if not match:
            continue

        # 找到表定义位置,向后扫描直到 ); 闭合或下一个 pgTable
        start = match.end()
        # 找到 pgTable 调用的结束位置(匹配的右括号,不在注释/字符串中)
        end_marker = _find_table_end(content, start)
        block = content[start:end_marker]

        fields: dict[str, str] = {}
        for col_match in _COLUMN_RE.finditer(block):
            _ts_name, col_type, db_name = col_match.groups()
            pg_type = TS_TYPE_TO_PG.get(col_type.lower(), col_type.lower())
            fields[db_name] = pg_type

        return fields if fields else None

    return None


def parse_ts_all_table_names(schema_dir: Path) -> set[str]:
    """从 TS schema 源码解析所有表名。

    Returns:
        { table_name, ... }
    """
    if not schema_dir.is_dir():
        return set()

    names: set[str] = set()
    for ts_file in schema_dir.glob("*.ts"):
        try:
            content = ts_file.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for match in _PGTABLE_RE.finditer(content):
            names.add(match.group(1))
    return names


def scan_ai_service_sql_tables(app_dir: Path = _APP_DIR) -> set[str]:
    """扫描 ai-service/app 下所有 .py 文件,提取 SQL 中引用的表名。

    只在包含 SQL 关键字(SELECT/INSERT/UPDATE/DELETE)的字符串字面量中匹配,
    避免误匹配 import 语句和日志文本。排除系统表和 schema_check.py 自身。

    Returns:
        { table_name, ... }(小写)
    """
    _sql_indicator = re.compile(r"\b(SELECT|INSERT|UPDATE|DELETE)\b", re.IGNORECASE)
    tables: set[str] = set()
    for py_file in app_dir.rglob("*.py"):
        if py_file.name.startswith("_") or py_file.name == "schema_check.py":
            continue
        try:
            content = py_file.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        # 只在字符串字面量中匹配 SQL 表名(避免 FROM __future__ import 误匹配)
        for str_match in _STRING_LITERAL_RE.finditer(content):
            string_content = str_match.group(0)
            # 只处理包含 SQL 关键字的字符串(过滤日志文本如 "load from redis failed")
            if not _sql_indicator.search(string_content):
                continue
            for match in _SQL_TABLE_RE.finditer(string_content):
                table = match.group(1).lower()
                # 过滤 SQL 关键字 + 系统表(information_schema / pg_*)
                if table in _SQL_KEYWORDS:
                    continue
                if table == "information_schema" or table.startswith("pg_"):
                    continue
                tables.add(table)
    return tables


async def fetch_actual_columns(
    conn: asyncpg.Connection,
    table_name: str,
) -> dict[str, str]:
    """从 information_schema 查询表的实际列定义。

    Returns:
        字段名 → 数据类型(小写)的字典。空字典表示表不存在。
    """
    rows = await conn.fetch(
        """
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = $1
        ORDER BY ordinal_position
        """,
        table_name,
    )
    return {row["column_name"]: (row["data_type"] or "").lower() for row in rows}


def _normalize_type(t: str) -> str:
    """规范化类型字符串以容差匹配。"""
    t = t.lower().strip()
    if t == "character varying":
        return "varchar"
    if t in ("timestamp with time zone", "timestamp without time zone"):
        return "timestamp"
    if t == "smallint":
        return "integer"
    if t == "double precision":
        return "double"
    return t


def diff_columns(
    expected: dict[str, str],
    actual: dict[str, str],
) -> tuple[set[str], set[str], dict[str, tuple[str, str]]]:
    """对比期望与实际字段。

    Returns:
        (缺失字段, 多余字段, 类型不匹配字段 → (期望, 实际))
    """
    missing = set(expected) - set(actual)
    extra = set(actual) - set(expected)
    mismatched: dict[str, tuple[str, str]] = {}
    for name in set(expected) & set(actual):
        exp = _normalize_type(expected[name])
        act = _normalize_type(actual[name])
        if exp != act:
            mismatched[name] = (exp, act)
    return missing, extra, mismatched


async def check_schema(
    pool: Optional[asyncpg.Pool] = None,
) -> dict[str, Any]:
    """执行多表 schema 字段对照校验。

    自动扫描 ai-service SQL 引用的表,对每个表:
    1. 检查 DB 表是否存在
    2. 从 TS schema 源码解析期望字段(降级到硬编码 fallback)
    3. 对比 DB 实际字段与期望字段
    4. 检查表是否在 TS schema 中管理(数据孤岛检测)

    Returns:
        校验结果字典:
          - ok: bool(所有关键字段齐全即 True)
          - tables: dict[表名, 该表的校验结果]
          - total_tables: int
          - critical_missing: list[str](关键字段缺失,格式 "表名.字段名")
    """
    own_pool = False
    if pool is None:
        pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=1,
            max_size=1,
            command_timeout=5,
        )
        own_pool = True

    try:
        # 1. 自动扫描 ai-service SQL 引用的表
        sql_tables = scan_ai_service_sql_tables()
        # 2. 从 TS schema 源码解析所有表名
        ts_table_names = parse_ts_all_table_names(_SCHEMA_DIR)

        table_results: dict[str, Any] = {}
        critical_missing: list[str] = []
        any_error = False

        async with pool.acquire() as conn:
            for table in sorted(sql_tables):
                actual = await fetch_actual_columns(conn, table)

                if not actual:
                    table_results[table] = {
                        "exists": False,
                        "in_ts_schema": table in ts_table_names,
                        "missing": [],
                        "extra": [],
                        "mismatched": {},
                        "critical_missing": [],
                        "error": f"table {table} not found in database",
                    }
                    any_error = True
                    continue

                # 从 TS 源码解析期望字段,降级到硬编码 fallback
                expected = parse_ts_table_fields(_SCHEMA_DIR, table)
                source = "ts_schema"
                if not expected:
                    expected = FALLBACK_EXPECTED_COLUMNS.get(table, {}).copy()
                    source = "fallback" if expected else "none"

                if not expected:
                    # TS schema 和 fallback 都没有该表定义
                    table_results[table] = {
                        "exists": True,
                        "in_ts_schema": table in ts_table_names,
                        "expected_source": "none",
                        "missing": [],
                        "extra": [],
                        "mismatched": {},
                        "critical_missing": [],
                        "warning": f"table {table} not defined in TS schema or fallback (no field-level check)",
                    }
                    if table not in ts_table_names:
                        any_error = True  # 数据孤岛
                    continue

                missing, extra, mismatched = diff_columns(expected, actual)
                crit_fields = CRITICAL_FIELDS.get(table, ())
                crit_missing = [f for f in crit_fields if f in missing]

                table_results[table] = {
                    "exists": True,
                    "in_ts_schema": table in ts_table_names,
                    "expected_source": source,
                    "missing": sorted(missing),
                    "extra": sorted(extra),
                    "mismatched": {k: list(v) for k, v in mismatched.items()},
                    "critical_missing": sorted(crit_missing),
                }

                if crit_missing:
                    for f in crit_missing:
                        critical_missing.append(f"{table}.{f}")
                    any_error = True

        return {
            "ok": not any_error and len(critical_missing) == 0,
            "tables": table_results,
            "total_tables": len(sql_tables),
            "critical_missing": sorted(critical_missing),
            "schema_dir": str(_SCHEMA_DIR) if _SCHEMA_DIR.is_dir() else "(not found, using fallback)",
        }
    finally:
        if own_pool:
            await pool.close()


def log_report(result: dict[str, Any]) -> None:
    """将校验结果格式化输出到 logger。"""
    tables = result.get("tables", {})
    total = result.get("total_tables", 0)
    schema_dir = result.get("schema_dir", "?")

    logger.info("[schema_check] 扫描到 %d 张表,schema 源: %s", total, schema_dir)

    if not tables:
        logger.warning("[schema_check] 未扫描到任何 SQL 表引用")
        return

    for table, info in tables.items():
        if not info.get("exists", False):
            if info.get("in_ts_schema"):
                logger.error("[schema_check] %s: 表不存在(DB 缺失,TS schema 有定义) — 需补建 migration", table)
            else:
                logger.error("[schema_check] %s: 表不存在(DB 缺失,TS schema 也无定义) — 数据孤岛", table)
            continue

        crit = info.get("critical_missing", [])
        if crit:
            logger.error(
                "[schema_check] %s: 关键字段缺失(查询会失败): %s",
                table,
                ", ".join(crit),
            )

        missing = info.get("missing", [])
        if missing:
            logger.warning(
                "[schema_check] %s: 缺失字段(期望有/DB 无): %s",
                table,
                ", ".join(missing),
            )

        extra = info.get("extra", [])
        if extra:
            logger.info(
                "[schema_check] %s: 多余字段(DB 有/期望无,非阻塞): %s",
                table,
                ", ".join(extra),
            )

        mismatched = info.get("mismatched", {})
        for name, (exp, act) in mismatched.items():
            logger.warning("[schema_check] %s: 类型不匹配 %s: 期望 %s / 实际 %s", table, name, exp, act)

        if not crit and not missing and not extra and not mismatched:
            source = info.get("expected_source", "?")
            logger.info("[schema_check] %s: 字段对照一致 (源: %s)", table, source)

        if not info.get("in_ts_schema", True):
            logger.warning("[schema_check] %s: 表未在 TS schema 中管理(数据孤岛风险)", table)


async def main() -> int:
    """CLI 入口:`python -m app.core.schema_check`。

    Returns:
        0 = 所有表存在且关键字段齐全
        1 = 有表不存在或关键字段缺失
    """
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    result = await check_schema()
    log_report(result)
    print()
    print("=== schema_check report ===")
    print(f"  ok: {result['ok']}")
    print(f"  total_tables: {result['total_tables']}")
    print(f"  schema_dir: {result['schema_dir']}")
    print(f"  critical_missing: {result['critical_missing']}")
    print("  tables:")
    for table, info in result.get("tables", {}).items():
        exists = info.get("exists", False)
        in_ts = info.get("in_ts_schema", False)
        source = info.get("expected_source", "?")
        missing = len(info.get("missing", []))
        extra = len(info.get("extra", []))
        crit = len(info.get("critical_missing", []))
        status = "OK" if exists and crit == 0 else "FAIL"
        print(
            f"    [{status}] {table}: exists={exists} in_ts_schema={in_ts} "
            f"source={source} missing={missing} extra={extra} critical={crit}"
        )
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    import asyncio
    import sys

    sys.exit(asyncio.run(main()))
