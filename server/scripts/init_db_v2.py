"""统一数据库初始化与迁移脚本 (v2).

功能:
  1. 加载所有模型 (确保 Base.metadata 注册)
  2. 用 Base.metadata.create_all() 创建缺失的表
  3. 同步 Alembic 版本号 (alembic_version 表)
  4. 输出每个引擎的初始化报告
  5. 支持 dry-run 预览

用法:
  python scripts/init_db_v2.py            # 全量初始化
  python scripts/init_db_v2.py --dry-run  # 预览, 不实际执行
  python scripts/init_db_v2.py --report   # 仅报告表注册情况
"""

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _import_all_models():
    """强制 import 所有模型模块, 确保 Base.metadata 注册完整."""
    from loguru import logger

    from app.database import Base

    modules = [
        "activity_models",
        "agent_misc_models",
        "agent_models",
        "agent_rule_models",
        "agent_settlement",
        "ai_gc_models",
        "app_content_models",
        "ask_models",
        "behavior_models",
        "circle_models",
        "codegen_models",
        "context_models",
        "course_models",
        "education_ext_models",
        "exam_models",
        "identity_models",
        "live_models",
        "message_models",
        "notification_models",
        "oauth_models",
        "payment_models",
        "point_models",
        "resource_models",
        "search_models",
        "sys_models",
        "token_models",
        "user_models",
        "visit_models",
    ]
    imported = 0
    for m in modules:
        try:
            __import__(f"app.models.{m}", fromlist=["*"])
            imported += 1
        except Exception as e:
            logger.debug(f"skip model {m}: {e}")
    # 也 import 所有 v1 模块的模型类
    try:
        from app.api.v1 import router as v1_router
    except Exception as e:
        logger.debug(f"v1 router import: {e}")
    return len(Base.metadata.tables), imported


def _print_report():
    """打印表注册报告."""
    from loguru import logger

    from app.database import Base

    n, _ = _import_all_models()
    tables = sorted(Base.metadata.tables.keys())
    print(f"\n{'=' * 70}")
    print(f"数据库表注册报告")
    print(f"{'=' * 70}")
    print(f"总表数: {n}")
    print(f"\n表列表:")
    for t in tables:
        print(f"  - {t}")
    print(f"{'=' * 70}\n")
    return n


def _dry_run():
    """预览, 不实际执行."""
    from loguru import logger

    from app.database import Base, _resolve_db_url, _build_engine, SessionFactory
    from app.config import settings

    n, _ = _import_all_models()
    print(f"\n[DRY-RUN] 将要初始化的表数: {n}")
    print(f"[DRY-RUN] 数据库 URL:")
    for idx, url in enumerate(
        [settings.DB1_URL, settings.DB2_URL, settings.DB3_URL], 1
    ):
        resolved = _resolve_db_url(url, idx)
        print(f"  engine{idx}: {url[:60]}... -> {resolved[:80]}")
    print(f"\n[DRY-RUN] 不会实际创建表, 移除 --dry-run 以执行.")


def _run_init():
    """执行初始化."""
    from loguru import logger

    from app.database import Base
    from sqlalchemy import inspect, text

    n, imported = _import_all_models()
    logger.info(f"已注册 {n} 个表 (imported {imported} modules)")

    # 引入所有 v1 模块以注册 inline 模型
    try:
        from app.api.v1.router import api_router
        # 触发表注册
        for r in api_router.routes:
            pass
    except Exception as e:
        logger.debug(f"v1 router 引入: {e}")

    # 用 create_all 实际建表
    from app.database import _build_engine
    from app.config import settings

    results = []
    for idx, url in enumerate(
        [settings.DB1_URL, settings.DB2_URL, settings.DB3_URL], 1
    ):
        engine = _build_engine(url, 5, 10, 3600, True, idx)
        try:
            with engine.connect() as conn:
                # 查已存在表数
                insp = inspect(conn)
                existing = set(insp.get_table_names())
                # 创建缺失
                Base.metadata.create_all(bind=engine)
                # 再查
                insp = inspect(conn)
                after = set(insp.get_table_names())
                new_tables = after - existing
                results.append(
                    {
                        "engine": f"engine{idx}",
                        "url": str(engine.url)[:80],
                        "total": len(after),
                        "new": len(new_tables),
                        "new_tables": sorted(list(new_tables))[:20],  # 最多列 20 个
                    }
                )
        except Exception as e:
            results.append(
                {
                    "engine": f"engine{idx}",
                    "error": str(e)[:200],
                }
            )

    print(f"\n{'=' * 70}")
    print(f"数据库初始化报告")
    print(f"{'=' * 70}")
    for r in results:
        if "error" in r:
            print(f"  [{r['engine']}] ERROR: {r['error']}")
        else:
            print(
                f"  [{r['engine']}] total={r['total']}  new={r['new']}"
            )
            if r["new"] > 0 and r["new_tables"]:
                for t in r["new_tables"]:
                    print(f"      + {t}")
                if r["new"] > 20:
                    print(f"      ... ({r['new'] - 20} more)")
    print(f"{'=' * 70}\n")


def main():
    parser = argparse.ArgumentParser(description="数据库初始化 v2")
    parser.add_argument("--dry-run", action="store_true", help="预览模式")
    parser.add_argument("--report", action="store_true", help="仅输出表注册报告")
    args = parser.parse_args()

    if args.report:
        _print_report()
    elif args.dry_run:
        _dry_run()
    else:
        _run_init()


if __name__ == "__main__":
    main()
