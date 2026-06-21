"""自动从 SQLAlchemy metadata 生成 Alembic 迁移.

用法:
  python scripts/alembic_autogen.py              # 生成迁移到 alembic/versions/
  python scripts/alembic_autogen.py --message "add xyz"

注意:
  - 需要 alembic 已配置 (alembic.ini + env.py)
  - 当前环境用 SQLite fallback, 生成的迁移在 PostgreSQL 上需手工调整类型
  - 仅生成, 不自动执行 (alembic upgrade head 单独运行)
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser(description="从 SQLAlchemy metadata 自动生成 Alembic 迁移")
    parser.add_argument("--message", default="auto", help="迁移消息")
    args = parser.parse_args()

    from alembic.autogenerate import compare_metadata
    from alembic.config import Config
    from alembic.runtime.migration import MigrationContext
    from alembic.script import ScriptDirectory
    from alembic.operations import Operations
    from alembic.operations.ops import (
        AddColumnOp,
        CreateTableOp,
        DropColumnOp,
        DropTableOp,
    )
    from loguru import logger
    from sqlalchemy import create_engine

    # 强制 import 所有模型
    from app.database import Base, _resolve_db_url
    from app.config import settings

    # 触发所有模型 import
    import app.models  # noqa
    from app.api.v1 import router as _v1  # noqa
    from app.api.v1.router import api_router  # noqa
    for _r in api_router.routes:
        pass

    # 用 _resolve_db_url 自动降级到 SQLite (dev 环境)
    src_url = _resolve_db_url(settings.DB1_URL or "postgresql+psycopg2://zhs:zhs_pg_pass@127.0.0.1:5432/zhs_platform", 1)
    engine = create_engine(src_url)

    # Alembic 配置
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", src_url)

    # 当前 DB 状态
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        diff = compare_metadata(ctx, Base.metadata)
        logger.info(f"自动检测到的差异: {diff}")

    if not diff:
        print("✅ 数据库结构与 metadata 同步, 无需生成迁移.")
        return 0

    # 统计差异
    counts: dict[str, int] = {}
    for op in diff:
        op_type = type(op).__name__
        counts[op_type] = counts.get(op_type, 0) + 1
    print(f"\n差异统计:")
    for k, v in counts.items():
        print(f"  {k}: {v}")

    # 用 alembic revision --autogenerate 生成迁移文件
    from alembic.command import revision

    try:
        revision(
            cfg,
            autogenerate=True,
            message=args.message,
        )
        print(f"\n✅ 已生成迁移, 文件在 alembic/versions/")
    except Exception as e:
        print(f"\n❌ 生成失败: {e}")
        print("提示: 可手动执行 alembic revision --autogenerate -m '<message>'")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
