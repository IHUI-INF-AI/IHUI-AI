"""离线生成 zhs-platform 首版 DDL 脚本（PostgreSQL）.

运行：python alembic/gen_init_sql.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.schema import CreateTable, CreateIndex
from sqlalchemy.dialects import postgresql

from app.database import Base
import app.models.bootstrap  # noqa: F401

output_path = Path(__file__).parent / "versions" / "001_init.sql"
output_path.parent.mkdir(parents=True, exist_ok=True)

db_table_map = {
    # zhs_center_project (engine2)
    "users": "zhs_center_project", "user_margin": "zhs_center_project",
    "user_auth_info": "zhs_center_project", "user_sk_info": "zhs_center_project",
    "user_third_party_accounts": "zhs_center_project",
    "oauth_apps": "zhs_center_project", "oauth_sessions": "zhs_center_project",
    "oauth_users": "zhs_center_project", "oauth_private_keys": "zhs_center_project",
    "sys_user_post": "zhs_center_project",
    # zhs_educational_training (engine3)
    "zhs_course": "zhs_educational_training", "zhs_course_video": "zhs_educational_training",
    "zhs_course_audit": "zhs_educational_training", "zhs_course_pay": "zhs_educational_training",
    "zhs_course_pay_log": "zhs_educational_training", "zhs_course_platform_log": "zhs_educational_training",
    "zhs_education_platform": "zhs_educational_training",
    "zhs_educational_course": "zhs_educational_training",
    "zhs_category_dictionary": "zhs_educational_training",
    "zhs_identity": "zhs_educational_training", "zhs_organization": "zhs_educational_training",
    "zhs_user_comment_log": "zhs_educational_training",
    "zhs_user_video_comment": "zhs_educational_training",
    "zhs_user_video_log": "zhs_educational_training",
    "zhs_user_platform": "zhs_educational_training",
    "zhs_course_temp": "zhs_educational_training", "zhs_course_video_temp": "zhs_educational_training",
    # Everything else defaults to zhs_ai_project (engine1)
}

tables = list(Base.metadata.sorted_tables)
print(f"发现 {len(tables)} 张表")

dialect = postgresql.dialect()
current_db = None
lines = [
    "-- =============================================================",
    f"-- zhs-platform 首版 schema - 共 {len(tables)} 张表",
    "-- 适用 PostgreSQL",
    "-- =============================================================",
    "",
]

for table in tables:
    real_db = db_table_map.get(table.name, "zhs_ai_project")
    if real_db != current_db:
        current_db = real_db
        lines.append(f"-- ===== Database: {real_db} =====")
    lines.append(f'DROP TABLE IF EXISTS "{table.name}";')
    ddl = str(CreateTable(table).compile(dialect=dialect))
    lines.append(ddl + ";")
    for idx in table.indexes:
        try:
            lines.append(str(CreateIndex(idx).compile(dialect=dialect)) + ";")
        except Exception:
            pass
    lines.append("")

lines.append("")
output_path.write_text("\n".join(lines), encoding="utf-8")
print(f"DDL 已写入 {output_path}")
