"""Celery 任务: 对账 / 关闭超时订单.

依赖 app.celery_app 注入的 `celery_app` 实例.
每个任务独立处理异常, 失败不阻塞其他任务.

⚠️  当 Celery 不可用 (未安装 celery 包) 时, 任务降级为普通函数,
   仍可被业务代码同步调用, 但不会被 beat 调度.
"""
from __future__ import annotations

import logging
from datetime import datetime

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
    started_at = datetime.utcnow()
    logger.info(f"[celery] run_reconcile_task started at {started_at.isoformat()}")
    try:
        from app.services.dual_write import full_reconcile

        reports = full_reconcile()
        total = len(reports)
        balanced = sum(1 for r in reports if r.is_balanced)
        unbalanced = total - balanced
        duration = (datetime.utcnow() - started_at).total_seconds()

        summary = {
            "total": total,
            "balanced": balanced,
            "unbalanced": unbalanced,
            "duration_s": round(duration, 2),
            "started_at": started_at.isoformat(),
            "finished_at": datetime.utcnow().isoformat(),
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
