# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""票 G-17:schema_check 的"按驱动事实判 sqlite 侧"必须认得"借来的连接"这一型。

事故形态(2026-09-29 普查):SQL 文本住在 A 文件(路由层)、连接是从 B 持久层模块借来的
(`approval_persistence._get_conn()`),A 自己既没 import sqlite3 也没 import asyncpg ⇒
"整文件按驱动事实跳过"这条判据对 A 结构上不成立 ⇒ B 自建的 approval_grants 被当成本服务
的 Postgres 表,CI 报"表不存在 — 数据孤岛"。

本文件钉的是**第四型修法**(补一条归属事实,不是换实现):表由谁的建表 DDL 造出来就归谁,
`scan_sqlite_owned_tables` 把这条事实量出来,引用面按属主划边。三种"消红"改法各有已量到的
坏下场,故本文件同时反向锁死它们:
  ① 把 approval_grants 断言成 PG 表(退回连红四十多次的事故形态);
  ② 整文件跳过借连接文件(连带削掉同文件里的真 Postgres 覆盖);
  ③ 靠名字清单排除(清单腐烂正是第一次事故的根因)。

全部用例都是**纯静态文本判定**:零连库、零建表、零写盘(见 TestNoSideEffects)。
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from app.core import schema_check
from app.core.schema_check import (
    scan_ai_service_sql_tables,
    scan_sqlite_owned_tables,
)

APP_DIR = Path(__file__).resolve().parent.parent / "app"

# 事故现场取材:持久层模块的建表 DDL 逐字形态(app/services/approval_persistence.py:120-130)
_SQLITE_DDL = """
_SCHEMA_DDL = \"\"\"
CREATE TABLE IF NOT EXISTS approval_grants (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    scope       TEXT NOT NULL,
    cache_key   TEXT NOT NULL,
    kind        TEXT NOT NULL
);
\"\"\"
"""

# 借连接形态的裸 SQL 逐字形态(原 llm.py 事故两行,同 approval_persistence.list_grant_rows)
_BORROWED_SQL = """
def _load_grants():
    conn = approval_persistence._get_conn()
    rows = conn.execute(
        "SELECT kind, cache_key, scope, created_at, expires_at FROM approval_grants "
        "WHERE kind IN (?, ?)",
        ("exec_prefix", "mcp_tool"),
    ).fetchall()
    return rows
"""

# 同文件里的真 Postgres 查询(不变量②的正面锚:借连接文件不得整文件跳过)
_REAL_PG_SQL = """
async def load_models(conn):
    sql = "SELECT id, name FROM ai_model_config WHERE enabled = true ORDER BY sort_order"
    return await conn.fetch(sql)
"""


def _make_fixture(app_dir: Path, *, with_ddl: bool = True) -> None:
    """造一棵最小 app 树:持久层(sqlite 侧)+ 路由层(借连接,且带一条真 PG 查询)。"""
    app_dir.mkdir(parents=True, exist_ok=True)
    persistence = "import sqlite3\n\n" + (_SQLITE_DDL if with_ddl else "") + "\n"
    (app_dir / "persistence_like.py").write_text(persistence, encoding="utf-8")
    (app_dir / "router_like.py").write_text(
        "from app.services import approval_persistence\n\n" + _BORROWED_SQL + _REAL_PG_SQL,
        encoding="utf-8",
    )


class TestBorrowedConnectionOwnership:
    """正例:借来的连接 ⇒ 归属判对(sqlite 侧资产,不进 Postgres 校验面)。"""

    def test_borrowed_sql_is_excluded_by_table_owner(self, tmp_path: Path):
        app = tmp_path / "app"
        _make_fixture(app)
        tables = scan_ai_service_sql_tables(app)
        assert "approval_grants" not in tables, (
            "借连接形态又把它当成本服务 Postgres 表了(G-17 事故复现)"
        )

    def test_owner_is_named_by_the_ruler(self, tmp_path: Path):
        """归属必须"可判定"到具体建表源,不能只给一个布尔。"""
        app = tmp_path / "app"
        _make_fixture(app)
        owned = scan_sqlite_owned_tables(app)
        assert owned.get("approval_grants") == "persistence_like.py"

    def test_same_file_real_postgres_query_survives(self, tmp_path: Path):
        """反向对照(不变量②):借连接文件里有真 PG 查询 ⇒ 不得整文件跳过。

        同一条 SQL 文本住在**自己的** sqlite 连接里时(persistence_like.py 若直连执行)
        仍按驱动事实排除;这里问的是 router_like.py 的 ai_model_config 必须还在。
        """
        app = tmp_path / "app"
        _make_fixture(app)
        tables = scan_ai_service_sql_tables(app)
        assert "ai_model_config" in tables, "为消 sqlite 红把真 Postgres 覆盖面一起削了"

    def test_own_sqlite_connection_file_still_excluded(self, tmp_path: Path):
        """正例补格:连接没借(同一文件 import sqlite3 并执行)⇒ 既有整文件跳过照常生效。"""
        app = tmp_path / "app"
        app.mkdir()
        (app / "persistence_like.py").write_text(
            "import sqlite3\n\n"
            + _SQLITE_DDL
            + "\ndef list_all(conn):\n"
            '    return conn.execute("SELECT kind FROM approval_grants WHERE scope = ?").fetchall()\n',
            encoding="utf-8",
        )
        assert "approval_grants" not in scan_ai_service_sql_tables(app)


class TestExclusionIsDrivenByOwnershipFact:
    """排除只认"建表 DDL 归属"这一条事实,不是名字清单、也不是见名就跳。"""

    def test_without_the_ddl_the_reference_is_reported(self, tmp_path: Path):
        """变异对照:同名 SQL 引用还在,但**没有任何建表 DDL 事实** ⇒ 必须照旧进 PG 校验面。

        这一格若翻绿说明排除不靠属主(退成了名字清单 = 第一次事故的根因)。
        """
        app = tmp_path / "app"
        _make_fixture(app, with_ddl=False)
        tables = scan_ai_service_sql_tables(app)
        assert "approval_grants" in tables, "没有归属事实也剔表 ⇒ 判据退化成手工名字清单"
        assert scan_sqlite_owned_tables(app) == {}

    def test_no_hardcoded_sqlite_table_name_list_in_source(self):
        """反向锁:不得把 approval_grants 之类名字写进 schema_check 的排除清单。"""
        src = (APP_DIR / "core" / "schema_check.py").read_text(encoding="utf-8")
        # 只锁"名字 = 集合/元组字面量"这一形态(与既有 _SQLITE_FILES 反向锁同形),
        # 散文里提到 approval_grants 不算(那是判据说明,不是判据实现)。
        offenders = [
            line
            for line in src.splitlines()
            if line.lstrip().startswith(("_SQLITE_TABLES", "_SQLITE_OWNED_TABLES", "_BORROWED_TABLES"))
            and ("{" in line or "(" in line)
        ]
        assert not offenders, f"名字清单回来了:{offenders}"


class TestMixedDriverFile:
    """混合驱动文件(同文件既 sqlite3 又 asyncpg):只按**那条 DDL 自己的方言**划边。"""

    def test_autoincrement_ddl_owned_plain_ddl_stays_postgres(self, tmp_path: Path):
        """混合驱动文件:同文件两条 DDL,一条 sqlite 侧、一条 PG 侧,必须分别划边。

        PG 侧那张刻意**不叫** `pg_*` —— 扫描器把 `pg_` 前缀当系统表过滤(既有判据,与本票无关),
        名字带前缀会让这一格测的是那条过滤而不是归属规则。
        """
        app = tmp_path / "app"
        app.mkdir()
        (app / "mixed_store.py").write_text(
            "import sqlite3\nimport asyncpg\n\n"
            'DDL_LOCAL = "CREATE TABLE IF NOT EXISTS local_cache (id INTEGER PRIMARY KEY AUTOINCREMENT, k TEXT);"\n'
            'DDL_PG = "CREATE TABLE IF NOT EXISTS side_registry (id BIGSERIAL PRIMARY KEY, k TEXT);"\n'
            'Q1 = "SELECT k FROM local_cache WHERE id = ?"\n'
            'Q2 = "SELECT k FROM side_registry WHERE id = $1"\n',
            encoding="utf-8",
        )
        owned = scan_sqlite_owned_tables(app)
        assert "local_cache" in owned
        assert "side_registry" not in owned, "方言事实只在该条 DDL 范围内才算数"
        tables = scan_ai_service_sql_tables(app)
        assert "local_cache" not in tables
        assert "side_registry" in tables, "混合文件里的真 PG 表被整文件/整名消掉了"

    def test_dialect_scope_does_not_leak_across_statements(self, tmp_path: Path):
        """AUTOINCREMENT 出现在**另一条** DDL 里,不得把这条无方言的 DDL 也判成 sqlite 侧。"""
        app = tmp_path / "app"
        app.mkdir()
        (app / "mixed_store.py").write_text(
            "import sqlite3\nimport asyncpg\n\n"
            'DDL_A = "CREATE TABLE t_one (id INTEGER PRIMARY KEY AUTOINCREMENT);"\n'
            'DDL_B = "CREATE TABLE t_two (id BIGSERIAL PRIMARY KEY);"\n'
            'Q = "SELECT id FROM t_two WHERE id = $1"\n',
            encoding="utf-8",
        )
        assert scan_sqlite_owned_tables(app).get("t_two") is None
        assert "t_two" in scan_ai_service_sql_tables(app)


class TestPostgresFactWinsConflict:
    """Drizzle 正面事实优先:TS schema 里声明过的表绝不因"某处有同名建表 DDL"被剔。"""

    def test_drizzle_managed_name_is_kept_and_warned(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
    ):
        app = tmp_path / "app"
        app.mkdir()
        schema_dir = tmp_path / "schema"
        schema_dir.mkdir()
        (schema_dir / "synthetic.ts").write_text(
            """
import { pgTable, bigserial, varchar } from 'drizzle-orm/pg-core';
export const t = pgTable('synthetic_pg_managed', {
  id: bigserial('id', { sequenceName: 'x' }),
  name: varchar('name', { length: 32 }),
});
""",
            encoding="utf-8",
        )
        monkeypatch.setattr(schema_check, "_SCHEMA_DIR", schema_dir)
        # sqlite 侧文件里冒出一张同名建表 DDL(归属冲突形态)
        (app / "conflicting_store.py").write_text(
            "import sqlite3\n\n"
            'DDL = "CREATE TABLE IF NOT EXISTS synthetic_pg_managed (id INTEGER PRIMARY KEY AUTOINCREMENT);"\n',
            encoding="utf-8",
        )
        (app / "pg_repo.py").write_text(
            'import asyncpg\n\nQ = "SELECT name FROM synthetic_pg_managed WHERE id = $1"\n',
            encoding="utf-8",
        )
        with caplog.at_level("WARNING"):
            tables = scan_ai_service_sql_tables(app)
        assert "synthetic_pg_managed" in tables, "PG 正面事实被 sqlite 侧归属推断顶掉了 = 静默漏检"
        assert "synthetic_pg_managed" in caplog.text, "冲突必须点名,不许安静"


class TestNoSideEffects:
    """判据是纯静态文本尺子:不连库、不建表、不写盘。"""

    def test_scan_touches_no_database_and_writes_no_file(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        def _boom(*_args: object, **_kwargs: object) -> None:
            raise AssertionError("schema_check 判据不得连库/建库")

        monkeypatch.setattr(sqlite3, "connect", _boom)
        monkeypatch.setattr(schema_check.asyncpg, "connect", _boom)
        monkeypatch.setattr(schema_check.asyncpg, "create_pool", _boom)

        app = tmp_path / "app"
        _make_fixture(app)
        before = sorted(p.relative_to(tmp_path).as_posix() for p in tmp_path.rglob("*"))
        scan_ai_service_sql_tables(app)
        scan_sqlite_owned_tables(app)
        after = sorted(p.relative_to(tmp_path).as_posix() for p in tmp_path.rglob("*"))
        assert before == after, "只读尺子写出了文件"
        assert not list(tmp_path.rglob("*.db"))


class TestRealAppTree:
    """现读真实 app 树:approval_grants 归属判对,且 Postgres 覆盖面一枚不减。"""

    def test_approval_grants_is_a_sqlite_side_asset(self):
        owned = scan_sqlite_owned_tables(APP_DIR)
        assert "approval_grants" in owned, "建表 DDL 归属量不到 approval_grants"
        assert owned["approval_grants"].replace("\\", "/").endswith(
            "services/approval_persistence.py"
        ), owned["approval_grants"]
        assert "approval_grants" not in scan_ai_service_sql_tables(APP_DIR)

    def test_postgres_coverage_is_not_reduced_by_the_owner_rule(self):
        """不变量②的现读锚:剔除集与 PG 面零交集,真表照旧在面上。"""
        owned = set(scan_sqlite_owned_tables(APP_DIR))
        tables = scan_ai_service_sql_tables(APP_DIR)
        assert not (owned & tables), f"归属剔除把 PG 面也吃掉了:{sorted(owned & tables)}"
        assert {"rag_chunks", "ai_model_config"} <= tables

    def test_sqlite_owned_names_are_not_drizzle_tables_in_the_real_tree(self):
        """归属推断与 Drizzle 面在真实树上是**互斥**的(冲突护栏现在用不上,但不能悄悄成立)。"""
        owned = set(scan_sqlite_owned_tables(APP_DIR))
        drizzle = schema_check.parse_ts_all_table_names(schema_check._SCHEMA_DIR)
        assert not (owned & drizzle) or not schema_check._SCHEMA_DIR.is_dir()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
