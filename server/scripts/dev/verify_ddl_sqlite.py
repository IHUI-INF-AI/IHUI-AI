"""本地 SQLite 验证全部 ORM model 可成功建表.

运行：python scripts/dev/verify_ddl_sqlite.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlalchemy import create_engine

from app.database import Base
import app.models.bootstrap  # noqa: F401
from app.api.v1.ws.timbre import Timbre  # noqa: F401  注册 zhs_timbre

sqlite_path = Path(__file__).resolve().parent.parent.parent / "zhs_test.db"
if sqlite_path.exists():
    sqlite_path.unlink()

engine = create_engine(f"sqlite:///{sqlite_path}")

tables = list(Base.metadata.sorted_tables)
print(f"ORM 共 {len(tables)} 张表，开始在 SQLite 建表...")

failed = []
for table in tables:
    try:
        table.create(engine, checkfirst=True)
    except Exception as e:
        failed.append((table.name, str(e)[:200]))

print(f"成功：{len(tables) - len(failed)}，失败：{len(failed)}")
for name, err in failed[:10]:
    print(f"  ✗ {name}: {err}")

sqlite_path.unlink()
print(f"验证完成。SQLite 文件已清理。")
