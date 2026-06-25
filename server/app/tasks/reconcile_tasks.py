"""Celery 任务: 对账 / 关闭超时订单.

依赖 app.celery_app 注入的 `celery_app` 实例.
每个任务独立处理异常, 失败不阻塞其他任务.

⚠️  当 Celery 不可用 (未安装 celery 包) 时, 任务降级为普通函数,
   仍可被业务代码同步调用, 但不会被 beat 调度.
"""
from __future__ import annotations

import logging

from app.utils.datetime_helper import utcnow

logger = logging.getLogger(__name__)


def _get_celery_or_noop():
    """返回 celery_app 或一个 stub, 使装饰器在缺失 celery 时降级.

    stub.task(name=..., bind=True, max_retries=...) 返回一个装饰器,
    装饰后的函数保持原函数语义 (直接调用 = 立即执行).
    """
    try:
        from app.celery_app import celery_app
    except Exception:
        celery_app = None

    if celery_app is not None:
        return celery_app

    class _StubCelery:
        def task(self, *args, **kwargs):
            def _decorator(fn):
                # 保留原函数语义, 让 from x import y 之后 y() 仍能跑
                fn.__name__ = getattr(fn, "__name__", "task")
                # 加上 .name 属性, 兼容 celery .name 用法
                if args and isinstance(args[0], str):
                    fn.name = args[0]
                elif "name" in kwargs:
                    fn.name = kwargs["name"]
                return fn

            # 兼容 @celery.task() 和 @celery.task(name=...)
            if args and callable(args[0]) and not isinstance(args[0], str):
                return _decorator(args[0])
            return _decorator

    return _StubCelery()


# 共享 task 基类, 用于绑定到具体 Celery 实例 (缺失时降级 stub)
celery_app = _get_celery_or_noop()


# ===========================================================================
# 对账任务
# ===========================================================================

@celery_app.task(name="app.tasks.reconcile_tasks.run_reconcile_task", bind=True, max_retries=3)
def run_reconcile_task(self) -> dict:
    """每 6 小时触发: 全量对账 H 盘 MySQL vs G 盘 PostgreSQL.

    Returns:
        dict: { total: int, balanced: int, unbalanced: int, duration_s: float }
    """
    started_at = utcnow()
    logger.info(f"[celery] run_reconcile_task started at {started_at.isoformat()}")
    try:
        from app.services.dual_write import full_reconcile

        reports = full_reconcile()
        total = len(reports)
        balanced = sum(1 for r in reports if r.is_balanced)
        unbalanced = total - balanced
        duration = (utcnow() - started_at).total_seconds()

        summary = {
            "total": total,
            "balanced": balanced,
            "unbalanced": unbalanced,
            "duration_s": round(duration, 2),
            "started_at": started_at.isoformat(),
            "finished_at": utcnow().isoformat(),
        }
        logger.info(f"[celery] run_reconcile_task finished: {summary}")

        # P1.6: 检测到不平衡时, 推站内信 (admin 后台可见)
        if unbalanced > 0:
            try:
                from app.api.admin_migration import push_notification
                unbal_tables = [
                    r.table for r in reports if not r.is_balanced
                ][:20]  # 最多 20 个表名
                push_notification(
                    title=f"对账不平衡: {unbalanced}/{total} 张表差异",
                    body=(
                        f"调度器在 {started_at.isoformat()} 触发对账, "
                        f"耗时 {duration:.1f}s, "
                        f"以下表存在差异: {', '.join(unbal_tables)}"
                    ),
                    level="error",
                    source="reconcile",
                )
            except Exception as notify_err:
                logger.warning(f"[celery] push_notification failed: {notify_err}")

        return summary
    except Exception as e:
        logger.exception(f"[celery] run_reconcile_task failed: {e}")
        # celery 模式下重试; stub 模式下 self.retry 不存在, 直接 raise
        if hasattr(self, "retry"):
            raise self.retry(exc=e, countdown=60 * (2 ** getattr(self.request, "retries", 0)))
        raise


@celery_app.task(name="app.tasks.reconcile_tasks.close_expired_orders_task", bind=True, max_retries=2)
def close_expired_orders_task(self) -> dict:
    """每 10 分钟触发: 关闭 30 分钟未支付订单."""
    try:
        from app.services.reconciliation_service import auto_close_expired_orders

        result = auto_close_expired_orders()
        # async 协程需在事件循环中运行
        import asyncio

        if asyncio.iscoroutine(result):
            result = asyncio.run(result)
        logger.info(f"[celery] close_expired_orders_task: {result}")
        return result
    except Exception as e:
        logger.exception(f"[celery] close_expired_orders_task failed: {e}")
        if hasattr(self, "retry"):
            raise self.retry(exc=e, countdown=30 * (2 ** getattr(self.request, "retries", 0)))
        raise


@celery_app.task(name="app.tasks.reconcile_tasks.auto_reconcile_yesterday_task", bind=True, max_retries=2)
def auto_reconcile_yesterday_task(self) -> dict:
    """每天 03:00 触发: 自动对账昨天 (支付宝 + 微信)."""
    try:
        from app.services.reconciliation_service import auto_reconcile_yesterday

        result = auto_reconcile_yesterday()
        import asyncio

        if asyncio.iscoroutine(result):
            result = asyncio.run(result)
        logger.info(
            f"[celery] auto_reconcile_yesterday_task: scanned="
            f"{result.get('alipay', {}).get('local_count', 0)}"
        )
        return result
    except Exception as e:
        logger.exception(f"[celery] auto_reconcile_yesterday_task failed: {e}")
        if hasattr(self, "retry"):
            raise self.retry(exc=e, countdown=60 * (2 ** getattr(self.request, "retries", 0)))
        raise


# ===========================================================================
# P1 增强: 站内信归档任务
# ===========================================================================
# 每日凌晨 04:00 清理: 已读超过 7 天且非置顶的站内信 (归档/删除)
# 置顶 (is_top=True) 永不归档 (operator 必须能看到 error 告警)
# 保留期可通过 NOTIFY_ARCHIVE_DAYS 环境变量配置 (默认 7 天)

@celery_app.task(name="app.tasks.reconcile_tasks.archive_old_notifications_task", bind=True, max_retries=2)
def archive_old_notifications_task(self) -> dict:
    """每日凌晨 04:00 触发: 归档已读超过 N 天的非置顶站内信.

    环境变量:
        NOTIFY_ARCHIVE_DAYS (int, 默认 7): 归档阈值天数, 范围 [1, 365]
        NOTIFY_ARCHIVE_DRY_RUN (str, 默认 "0"): 设为 "1"/"true"/"yes" 时只统计不删

    Returns:
        dict: {
            archived: int,             # 实际删除条数 (dry-run 时为 0)
            would_archive: int,        # dry-run 时命中条数
            threshold_days: int,
            dry_run: bool,
            duration_s: float,
        }
    """
    import os
    from datetime import timedelta

    threshold_days = int(os.getenv("NOTIFY_ARCHIVE_DAYS", "7"))
    if threshold_days < 1:
        threshold_days = 7  # 安全: 至少保留 1 天
    if threshold_days > 365:
        threshold_days = 365  # 安全: 最多保留 365 天

    dry_run_raw = str(os.getenv("NOTIFY_ARCHIVE_DRY_RUN", "0")).strip().lower()
    dry_run = dry_run_raw in ("1", "true", "yes", "on")

    started_at = datetime.utcnow()
    logger.info(
        f"[celery] archive_old_notifications_task started: threshold={threshold_days}d, dry_run={dry_run}"
    )
    try:
        from app.database import get_session
        from app.models.message import Message

        cutoff = started_at - timedelta(days=threshold_days)
        archived = 0
        would_archive = 0
        with get_session() as db:
            # 候选: 已读 + read_time 早于 cutoff + 非置顶 (含 NULL)
            q = (
                db.query(Message)
                .filter(Message.is_read.is_(True))
                .filter(Message.read_time.isnot(None))
                .filter(Message.read_time < cutoff)
                .filter(Message.is_top.isnot(True))  # NULL 和 False 都被归档
            )
            if dry_run:
                # dry-run 模式: 只统计条数, 不实际删除
                # 用 count() 而非 load all, 避免大表 OOM
                would_archive = q.count()
            else:
                # 正常模式: 批量删除 (每批 500, 防长事务)
                batch_size = 500
                while True:
                    batch = q.limit(batch_size).all()
                    if not batch:
                        break
                    for m in batch:
                        db.delete(m)
                    db.commit()
                    archived += len(batch)
                    if len(batch) < batch_size:
                        break

        duration = (datetime.utcnow() - started_at).total_seconds()
        summary = {
            "archived": archived,
            "would_archive": would_archive,
            "threshold_days": threshold_days,
            "dry_run": dry_run,
            "duration_s": round(duration, 2),
        }
        if dry_run:
            logger.info(
                f"[celery] archive_old_notifications_task finished (DRY-RUN): "
                f"would archive {would_archive} 条, 阈值 {threshold_days}d, 耗时 {duration:.2f}s"
            )
        else:
            logger.info(f"[celery] archive_old_notifications_task finished: {summary}")
        # P1 增强: 写历史趋势到 jsonl (运维可读 / ELK 收集 / 时序分析)
        _write_archive_history(summary)
        return summary
    except Exception as e:
        logger.exception(f"[celery] archive_old_notifications_task failed: {e}")
        if hasattr(self, "retry"):
            raise self.retry(exc=e, countdown=60 * (2 ** getattr(self.request, "retries", 0)))
        raise


def _write_archive_history(summary: dict) -> None:
    """归档历史趋势 (jsonl).

    文件: logs/notify_archive_history.jsonl
    每行一条: {"ts": ISO8601, "archived": N, "would_archive": N, "threshold_days": N, "dry_run": bool, "duration_s": float}

    运维可用法:
        tail -f logs/notify_archive_history.jsonl                      # 实时
        jq -s 'group_by(.ts[:10]) | ...' logs/notify_archive_history.jsonl  # 按天聚合
        awk -F'"archived":' '{print $2}' | cut -d, -f1                # 提取 archived 列
    """
    import json
    from pathlib import Path

    try:
        # 优先 logs/ 目录, 缺失则用 CWD (兼容容器/开发/CI)
        log_path = Path("logs/notify_archive_history.jsonl")
        try:
            log_path.parent.mkdir(parents=True, exist_ok=True)
        except (OSError, PermissionError):
            # fallback: tmp 目录
            import tempfile
            log_path = Path(tempfile.gettempdir()) / "notify_archive_history.jsonl"
        record = {
            "ts": datetime.utcnow().isoformat() + "Z",
            **summary,
        }
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception as e:  # noqa: BLE001
        # 趋势日志写失败不影响主任务
        logger.warning(f"[celery] archive_old_notifications_task: 写历史趋势失败: {e}")
