"""
多智能体数据表迁移脚本.

创建三张新表:
  - zhs_crew_session
  - zhs_crew_task
  - zhs_crew_message

用法:
    cd server
    python -m scripts.migrate_crew_tables
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine1
from app.models.crew_models import CrewSession, CrewTask, CrewMessage


def migrate():
    """创建多智能体相关数据表."""
    print("[Crew Migration] 开始创建多智能体数据表...")

    dialect = engine1.dialect.name
    print(f"[Crew Migration] 数据库类型: {dialect}")

    tables = [CrewSession, CrewTask, CrewMessage]
    for table in tables:
        table_name = table.__tablename__
        try:
            table.__table__.create(engine1, checkfirst=True)
            print(f"  [OK] 表 {table_name} 创建成功 (或已存在)")
        except Exception as e:
            print(f"  [SKIP] 表 {table_name} 跳过: {e}")

    print("[Crew Migration] 迁移完成.")


if __name__ == "__main__":
    migrate()
