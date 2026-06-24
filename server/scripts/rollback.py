"""迁移回滚 CLI 入口.

按 migration_batch 精确回滚 G 盘数据 + id_mapping 记录.

用法:
    python -m scripts.rollback --batch v2026_06_24_01
    python -m scripts.rollback --batch v2026_06_24_01 --dry-run
    python -m scripts.rollback --batch v2026_06_24_01 --keep-mappings   # 只删业务数据, 保留 id_mapping
    python -m scripts.rollback --all-mappings                          # 清空所有 id_mapping (慎用)
    python -m scripts.rollback --list                                   # 列出可回滚批次

⚠️ 危险操作, 默认要求 --confirm
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from loguru import logger
from sqlalchemy import text

from scripts.etl.checkpoint import MigrationCheckpoint, get_checkpoint
from scripts.etl.config import BATCHES, get_batch
from app.database import get_session


def _setup_logging():
    logger.remove()
    logger.add(sys.stderr, level="INFO", colorize=True)
    Path("logs").mkdir(exist_ok=True)
    logger.add(
        "logs/rollback_{time:YYYY-MM-DD}.log",
        level="DEBUG",
        rotation="100 MB",
        retention="30 days",
        enqueue=True,
    )


def _list_rollbackable():
    """列出所有有 checkpoint 记录且非 done 的批次."""
    print("可回滚的批次:")
    with get_session() as db:
        batches = (
            db.query(MigrationCheckpoint.batch_id)
            .distinct()
            .order_by(MigrationCheckpoint.batch_id)
            .all()
        )
    for (bid,) in batches:
        ck = get_checkpoint(bid.split("_")[0] + "_" + bid.split("_")[1] + "_" + bid.split("_")[2] + "_" + bid.split("_")[3], "")  # noqa
        # 直接 SQL 统计
        with get_session() as db:
            total = db.query(MigrationCheckpoint).filter(MigrationCheckpoint.batch_id == bid).count()
            done = (
                db.query(MigrationCheckpoint)
                .filter(MigrationCheckpoint.batch_id == bid, MigrationCheckpoint.status == "done")
                .count()
            )
        print(f"  {bid:24s}  tables: {total:>3d}  done: {done:>3d}")


def _rollback_batch(batch_id: str, dry_run: bool, keep_mappings: bool, confirm: bool):
    """回滚指定批次.

    步骤:
    1. 列出该批次所有 task 对应的 G 盘表
    2. 删 G 盘数据 (按 created_at >= batch_start_time, 不存在则按 id IN mapping)
    3. 删 id_mapping (除非 --keep-mappings)
    4. 删 checkpoint
    """
    batch = get_batch(batch_id)
    logger.info(f"[rollback] {batch_id} {batch.description}")

    # 取该批次所有 task
    with get_session() as db:
        checkpoints = (
            db.query(MigrationCheckpoint)
            .filter(MigrationCheckpoint.batch_id == batch_id)
            .all()
        )
        if not checkpoints:
            logger.warning(f"[rollback] 批次 {batch_id} 没有任何 checkpoint 记录")
            return

        # 收集目标表和映射计数
        target_tables = list({ck.target_table for ck in checkpoints})
        mapping_count = db.execute(
            text("SELECT COUNT(*) FROM id_mapping WHERE migration_batch = :b"),
            {"b": batch_id},
        ).scalar()
        business_count = sum(ck.migrated_rows or 0 for ck in checkpoints)

    logger.info(f"[plan] 目标表 {len(target_tables)} 张, 业务数据 {business_count} 行, 映射 {mapping_count} 条")
    logger.info(f"[plan] 目标表: {target_tables}")

    if dry_run:
        logger.info("[dry-run] 跳过实际删除")
        return

    if not confirm:
        logger.error("⚠️  删除操作要求 --confirm 参数")
        sys.exit(1)

    # 执行删除
    with get_session() as db:
        for table in target_tables:
            try:
                result = db.execute(
                    text(f"DELETE FROM {table} WHERE id IN (SELECT new_uuid FROM id_mapping WHERE migration_batch = :b)"),
                    {"b": batch_id},
                )
                logger.info(f"[delete] {table} → {result.rowcount} rows")
            except Exception as e:
                logger.error(f"[delete] {table} 失败: {e}")
                raise

        if not keep_mappings:
            result = db.execute(
                text("DELETE FROM id_mapping WHERE migration_batch = :b"),
                {"b": batch_id},
            )
            logger.info(f"[delete] id_mapping → {result.rowcount} rows")

        # 删 checkpoint
        result = db.execute(
            text("DELETE FROM migration_checkpoint WHERE batch_id = :b"),
            {"b": batch_id},
        )
        logger.info(f"[delete] migration_checkpoint → {result.rowcount} rows")

    logger.success(f"[rollback] {batch_id} 回滚完成")


def _clear_all_mappings(confirm: bool):
    """清空 id_mapping 全部记录."""
    if not confirm:
        logger.error("⚠️  清空操作要求 --confirm 参数")
        sys.exit(1)
    with get_session() as db:
        result = db.execute(text("DELETE FROM id_mapping"))
    logger.warning(f"[clear] id_mapping 清空 {result.rowcount} 条")


def main():
    parser = argparse.ArgumentParser(description="迁移回滚 CLI")
    parser.add_argument("--batch", help="要回滚的批次 ID")
    parser.add_argument("--dry-run", action="store_true", help="只打印将要做的事")
    parser.add_argument("--keep-mappings", action="store_true", help="只删业务数据, 保留 id_mapping")
    parser.add_argument("--confirm", action="store_true", help="确认执行删除")
    parser.add_argument("--all-mappings", action="store_true", help="清空所有 id_mapping (慎用)")
    parser.add_argument("--list", action="store_true", help="列出可回滚批次")
    args = parser.parse_args()

    _setup_logging()

    if args.list:
        _list_rollbackable()
        return
    if args.all_mappings:
        _clear_all_mappings(args.confirm)
        return
    if not args.batch:
        parser.print_help()
        return

    _rollback_batch(args.batch, args.dry_run, args.keep_mappings, args.confirm)


if __name__ == "__main__":
    main()
