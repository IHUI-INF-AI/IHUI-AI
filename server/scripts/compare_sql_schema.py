#!/usr/bin/env python3
"""提取历史项目 init_database.sql 中的表名，与当前 PostgreSQL schema 对比"""
import re
import sys
from pathlib import Path

LEGACY = Path(r"H:\历史项目存档\code\edu\service\service\init_database.sql")
CURRENT = Path(r"g:\IHUI-AI\server\alembic\versions\001_init.sql")

# 1. 历史项目表名 (MySQL 反引号)
legacy_content = LEGACY.read_text(encoding="utf-8", errors="ignore")
legacy_tables = sorted(set(re.findall(r"CREATE TABLE `(\w+)`", legacy_content, re.IGNORECASE)))
print(f"历史项目表数: {len(legacy_tables)}")

# 2. 当前项目表名 (PostgreSQL)
current_content = CURRENT.read_text(encoding="utf-8", errors="ignore")
current_tables = sorted(set(re.findall(r'CREATE TABLE (\w+)', current_content, re.IGNORECASE)))
print(f"当前项目表数: {len(current_tables)}")

# 3. 历史项目有的表,当前项目没有的
legacy_set = set(t.lower() for t in legacy_tables)
current_set = set(t.lower() for t in current_tables)

missing = sorted(legacy_set - current_set)
extra = sorted(current_set - legacy_set)
print(f"\n历史项目有 → 当前项目缺: {len(missing)} 张表")
for t in missing[:50]:
    print(f"  - {t}")

print(f"\n当前项目新增(对比历史): {len(extra)} 张表")
for t in extra[:50]:
    print(f"  + {t}")

# 4. 关键表对照
key_tables = [
    "edu_member", "edu_payment", "edu_order_payment", "edu_order_item",
    "ask_question", "ask_answer", "ask_comment", "ask_like",
    "circle", "circle_post", "circle_member", "circle_category",
    "behavior_like", "behavior_comment", "behavior_favorite",
    "admin_user", "admin_role", "admin_menu", "admin_logininfor",
    "edu_lesson", "edu_course", "edu_chapter", "edu_exam",
    "ai_news", "ai_about_us", "ai_contact", "ai_user_feedback",
    "edu_member_level", "edu_follow", "edu_invoice_application",
]
print(f"\n关键表存在性检查 (历史名 → 当前名):")
for t in key_tables:
    in_legacy = "[LEGACY]" if t in legacy_set else "        "
    in_current = "[CURRENT]" if t in current_set else "         "
    status = "OK" if (t in legacy_set) == (t in current_set) else "DIFF"
    print(f"  {in_legacy} {in_current}  {t}  {status}")
