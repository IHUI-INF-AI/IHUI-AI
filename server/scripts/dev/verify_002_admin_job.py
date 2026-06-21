"""验证 alembic 002 迁移在 PostgreSQL 语法下能正确建表 (本地用 SQLite 模拟).

用途:
  - 静态校验 sys_job / sys_job_log DDL 字段完整
  - 跑完迁移后清空, 不污染测试 db
"""

import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TMP_DB = ROOT / "zhs_alembic_verify.db"

if TMP_DB.exists():
    TMP_DB.unlink()

# 读 002 migration 文件提取 DDL
MIG_FILE = ROOT / "alembic" / "versions" / "002_admin_job.py"
sql_text = MIG_FILE.read_text(encoding="utf-8")

# 替换 f-string 占位符为 PostgreSQL 实际值 (PG 生产模式)
# auto_inc = "BIGSERIAL", pk_clause = ", PRIMARY KEY (job_id)"
sql_text = re.sub(r"\{auto_inc\.replace\([^)]+\)[^}]*\}", "BIGSERIAL", sql_text)
sql_text = sql_text.replace("{auto_inc}", "BIGSERIAL")
sql_text = re.sub(r"\{pk_clause\.replace\([^)]+\)\}", ", PRIMARY KEY (job_log_id)", sql_text)
sql_text = sql_text.replace("{pk_clause}", ", PRIMARY KEY (job_id)")

# 提取 CREATE TABLE 语句 (允许跨行, 匹配到行首的右括号)
create_stmts = re.findall(r"CREATE TABLE[^(]*\(.*?\n\s*\)", sql_text, flags=re.DOTALL)
print(f"找到 {len(create_stmts)} 个 CREATE TABLE 语句")
assert len(create_stmts) == 2, f"应该 2 个 CREATE TABLE, 实际 {len(create_stmts)}"

# 验证: 必须有 sys_job 和 sys_job_log
table_names = ["sys_job", "sys_job_log"]

# 用 SQLite 跑这些 DDL (SQLite 不支持 BIGSERIAL, 替换为 INTEGER PRIMARY KEY)
con = sqlite3.connect(str(TMP_DB))
for stmt in create_stmts:
    # SQLite 不支持 CREATE TABLE IF NOT EXISTS 后再跟 IF NOT EXISTS
    cleaned = re.sub(r"CREATE TABLE IF NOT EXISTS", "CREATE TABLE", stmt, count=1)
    # SQLite 不支持 BIGSERIAL, 替换为 INTEGER PRIMARY KEY (走 rowid 自增)
    cleaned = re.sub(r"(\w+)\s+BIGSERIAL", r"\1 INTEGER PRIMARY KEY", cleaned)
    # SQLite 不支持 PRIMARY KEY (col) 子句 (已由 INTEGER PRIMARY KEY 覆盖), 删除
    cleaned = re.sub(r",\s*PRIMARY KEY\s*\([^)]+\)", "", cleaned)
    try:
        con.execute(cleaned)
        print(f"  ✓ 成功建表: {table_names[create_stmts.index(stmt)]}")
    except Exception as e:
        print(f"  ✗ 失败: {e}")
        raise

# 验证字段
cur = con.execute("PRAGMA table_info(sys_job)")
job_cols = [r[1] for r in cur.fetchall()]
print(f"sys_job 字段: {job_cols}")
assert "job_id" in job_cols
assert "cron_expression" in job_cols
assert "invoke_target" in job_cols

cur = con.execute("PRAGMA table_info(sys_job_log)")
log_cols = [r[1] for r in cur.fetchall()]
print(f"sys_job_log 字段: {log_cols}")
assert "job_log_id" in log_cols
assert "exception_info" in log_cols

# 验证 INSERT (默认 admin 账号)
con.execute(
    "INSERT INTO sys_job (job_name, invoke_target) VALUES (?, ?)",
    ("test_job", "module.func"),
)
con.execute(
    "INSERT INTO sys_job_log (job_name, invoke_target, status) VALUES (?, ?, ?)",
    ("test_job", "module.func", "1"),
)
con.commit()

n_job = con.execute("SELECT COUNT(*) FROM sys_job").fetchone()[0]
n_log = con.execute("SELECT COUNT(*) FROM sys_job_log").fetchone()[0]
print(f"INSERT 验证: sys_job={n_job}, sys_job_log={n_log}")
assert n_job == 1
assert n_log == 1

con.close()
TMP_DB.unlink()
print("\n✓ alembic 002 迁移 DDL 验证通过")
