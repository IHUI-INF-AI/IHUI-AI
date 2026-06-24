"""ETL 数据迁移 CLI 入口.

用法:
    python -m scripts.migrate --batch v2026_06_24_01
    python -m scripts.migrate --batch v2026_06_24_01 --task t_member
    python -m scripts.migrate --batch v2026_06_24_01 --dry-run
    python -m scripts.migrate --batch v2026_06_24_01 --restart   # 强制从头开始
    python -m scripts.migrate --list                              # 列出所有批次
    python -m scripts.migrate --verify v2026_06_24_01            # 校验

支持的子命令:
    --batch BATCH_ID      执行指定批次
    --task SOURCE_TABLE   只迁移批次内某张表 (可选)
    --dry-run             只打印将要做的事, 不实际执行
    --restart             忽略已有 checkpoint, 从头开始
    --list                列出所有可用批次
    --verify BATCH_ID     校验批次 (H/G 行数对比 + 抽样)
    --skip-depends        跳过依赖检查 (不推荐)
"""
import argparse
import logging
import sys
import time
from pathlib import Path

# 把 server/ 加入 path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from loguru import logger

from scripts.etl.checkpoint import (
    get_checkpoint,
    upsert_checkpoint,
)
from scripts.etl.config import BATCHES, get_batch
from scripts.etl.extractor import extract_batches, extract_count
from scripts.etl.loader import load_batch
from scripts.etl.mapping import lookup_mappings, persist_mappings
from scripts.etl.transformer import transform_row


def _setup_logging():
    """日志配置: 文件 + 控制台."""
    logger.remove()
    logger.add(sys.stderr, level="INFO", colorize=True)
    Path("logs").mkdir(exist_ok=True)
    logger.add(
        "logs/migrate_{time:YYYY-MM-DD}.log",
        level="DEBUG",
        rotation="100 MB",
        retention="30 days",
        enqueue=True,
    )


def _list_batches():
    print("可用批次:")
    for b in BATCHES:
        deps = f"  (依赖: {', '.join(b.depends_on)})" if b.depends_on else ""
        print(f"  {b.batch_id:24s} {b.description}{deps}")


def _verify_batch(batch_id: str):
    """校验批次: H 盘行数 vs G 盘行数 + id_mapping 覆盖率."""
    batch = get_batch(batch_id)
    print(f"\n=== 校验 {batch_id}: {batch.description} ===\n")
    for task in batch.tasks:
        try:
            h_count = extract_count(task)
        except Exception as e:
            print(f"  [H]  {task.source_table:35s}  ✗ 抽取失败: {e}")
            continue

        from app.database import get_session
        from sqlalchemy import text

        with get_session() as db:
            g_count = db.execute(text(f"SELECT COUNT(*) FROM {task.target_table}")).scalar()

        # id_mapping 覆盖率
        with get_session() as db:
            mapped = db.execute(
                text("SELECT COUNT(*) FROM id_mapping WHERE source_table = :s"),
                {"s": task.source_table},
            ).scalar()

        ratio = (g_count / h_count * 100) if h_count > 0 else 0
        status = "✓" if g_count >= h_count * 0.99 else "✗"
        print(
            f"  {status} {task.source_table:30s} → {task.target_table:30s} "
            f"H={h_count:>8d}  G={g_count:>8d}  mapped={mapped:>8d}  ({ratio:5.1f}%)"
        )


def _check_dependencies(batch, skip_depends: bool):
    """检查依赖批次是否都已 done."""
    if not batch.depends_on or skip_depends:
        return
    from app.database import get_session
    from scripts.etl.checkpoint import MigrationCheckpoint

    with get_session() as db:
        for dep in batch.depends_on:
            unfinished = (
                db.query(MigrationCheckpoint)
                .filter(
                    MigrationCheckpoint.batch_id.like(f"{dep}%"),
                    MigrationCheckpoint.status != "done",
                )
                .count()
            )
            if unfinished > 0:
                raise RuntimeError(
                    f"[DEP] 依赖批次 {dep} 还有 {unfinished} 张表未完成, "
                    f"请先执行: python -m scripts.migrate --batch {dep}"
                )


def _run_task(batch_id: str, task, restart: bool = False, dry_run: bool = False):
    """执行单张表迁移."""
    # 1. checkpoint 检查
    if not restart:
        ck = get_checkpoint(batch_id, task.source_table)
        if ck and ck.status == "done":
            logger.info(f"[skip] {task.source_table} 已 done, 跳过")
            return
        last_id = int(ck.last_pk or "0") if ck else 0
        total = ck.total_rows if ck else 0
        migrated = ck.migrated_rows if ck else 0
    else:
        last_id = 0
        total = 0
        migrated = 0

    # 2. 抽取总行数
    if total == 0:
        try:
            total = extract_count(task)
        except Exception as e:
            logger.error(f"[count] {task.source_table} 失败: {e}")
            upsert_checkpoint(batch_id, task.source_table, task.target_table, "failed", error_msg=str(e))
            raise
    logger.info(f"[start] {task.source_table} → {task.target_table} total={total} last_id={last_id}")

    if dry_run:
        logger.info(f"[dry-run] 跳过实际执行")
        return

    # 3. 加载已有映射 (幂等)
    mapping_cache = lookup_mappings(task)

    # 4. 标记 running
    upsert_checkpoint(batch_id, task.source_table, task.target_table, "running",
                      last_pk=str(last_id), total_rows=total, migrated_rows=migrated)
    t0 = time.time()
    try:
        # 5. 抽取-转换-装载 循环
        for rows in extract_batches(task, last_id=last_id):
            # 转换
            for row in rows:
                transform_row(row, task, mapping_cache)
            # 装载
            inserted = load_batch(task, rows)
            migrated += inserted
            # checkpoint
            current_pk = str(rows[-1][task.pk_columns[0]])
            upsert_checkpoint(batch_id, task.source_table, task.target_table, "running",
                              last_pk=current_pk, total_rows=total, migrated_rows=migrated)
            logger.info(
                f"[progress] {task.target_table} "
                f"{migrated}/{total} ({(migrated/total*100 if total else 0):.1f}%) "
                f"last_pk={current_pk}"
            )
        # 6. 持久化 id_mapping
        persist_mappings(batch_id, task, mapping_cache)
        upsert_checkpoint(batch_id, task.source_table, task.target_table, "done",
                          last_pk=str(last_id), total_rows=total, migrated_rows=migrated)
        logger.success(
            f"[done] {task.source_table} → {task.target_table} "
            f"{migrated} rows in {time.time()-t0:.1f}s"
        )
    except Exception as e:
        logger.exception(f"[fail] {task.source_table}")
        upsert_checkpoint(batch_id, task.source_table, task.target_table, "failed",
                          last_pk=str(last_id), total_rows=total, migrated_rows=migrated,
                          error_msg=str(e))
        raise


def _run_batch(batch_id: str, only_task: str | None, restart: bool, dry_run: bool, skip_depends: bool):
    batch = get_batch(batch_id)
    _check_dependencies(batch, skip_depends)
    logger.info(f"[batch] {batch_id} {batch.description}")

    tasks = batch.tasks
    if only_task:
        tasks = [t for t in tasks if t.source_table == only_task]
        if not tasks:
            raise ValueError(f"批次 {batch_id} 内找不到表 {only_task}")

    for task in tasks:
        _run_task(batch_id, task, restart=restart, dry_run=dry_run)


def main():
    parser = argparse.ArgumentParser(description="ETL 数据迁移 CLI")
    parser.add_argument("--batch", help="要执行的批次 ID")
    parser.add_argument("--task", help="只迁移批次内某张表 (H 盘表名)")
    parser.add_argument("--dry-run", action="store_true", help="只打印将要做的事")
    parser.add_argument("--restart", action="store_true", help="忽略 checkpoint, 从头开始")
    parser.add_argument("--list", action="store_true", help="列出所有批次")
    parser.add_argument("--verify", help="校验批次")
    parser.add_argument("--skip-depends", action="store_true", help="跳过依赖检查")
    args = parser.parse_args()

    _setup_logging()

    if args.list:
        _list_batches()
        return
    if args.verify:
        _verify_batch(args.verify)
        return
    if not args.batch:
        parser.print_help()
        return

    _run_batch(args.batch, args.task, args.restart, args.dry_run, args.skip_depends)


if __name__ == "__main__":
    main()
