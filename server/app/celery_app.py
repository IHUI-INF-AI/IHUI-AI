"""Celery application factory + beat schedule.

调度策略:
- run_reconcile_task: 每 6 小时执行一次, 对账 (H 盘 vs G 盘)
- close_expired_orders_task: 每 10 分钟执行一次, 关闭超时未支付订单
- auto_reconcile_yesterday_task: 每日 03:00 执行, 自动对账昨天

启动方式:
    celery -A app.celery_app worker -l info
    celery -A app.celery_app beat   -l info

⚠️  Celery 依赖为可选: 缺失时本模块降级为 stub, 业务代码仍可正常导入.
"""
from __future__ import annotations

import os

try:
    from celery import Celery
    from celery.schedules import crontab

    _CELERY_AVAILABLE = True
except ImportError:  # pragma: no cover
    Celery = None  # type: ignore[assignment]
    crontab = None  # type: ignore[assignment]
    _CELERY_AVAILABLE = False


# ===========================================================================
# Celery 实例
# ===========================================================================

def _build_celery() -> object | None:
    """构造 Celery 实例. 缺失依赖时返回 None (让上层 import 仍可工作)."""
    if not _CELERY_AVAILABLE:
        return None

    redis_url = os.getenv("CELERY_BROKER_URL", os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0"))
    result_backend = os.getenv("CELERY_RESULT_BACKEND", redis_url)

    app = Celery(
        "ihui_ai",
        broker=redis_url,
        backend=result_backend,
        include=[
            "app.tasks.reconcile_tasks",
        ],
    )

    # ---------- 基础配置 ----------
    app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="Asia/Shanghai",
        enable_utc=False,
        task_acks_late=True,
        worker_prefetch_multiplier=1,
        task_default_queue="default",
        broker_connection_retry_on_startup=True,
    )

    # ---------- 周期调度 (beat schedule) ----------
    app.conf.beat_schedule = {
        # 每 6 小时执行一次, 对账 H 盘 vs G 盘
        "run-reconcile-every-6h": {
            "task": "app.tasks.reconcile_tasks.run_reconcile_task",
            "schedule": crontab(minute=0, hour="*/6"),
            "args": (),
            "kwargs": {},
            "options": {"queue": "reconcile"},
        },
        # 每 10 分钟关闭超时未支付订单
        "close-expired-orders-every-10min": {
            "task": "app.tasks.reconcile_tasks.close_expired_orders_task",
            "schedule": crontab(minute="*/10"),
            "args": (),
            "kwargs": {},
            "options": {"queue": "reconcile"},
        },
        # 每天 03:00 自动对账昨天的支付宝 + 微信账单
        "auto-reconcile-yesterday-3am": {
            "task": "app.tasks.reconcile_tasks.auto_reconcile_yesterday_task",
            "schedule": crontab(minute=0, hour=3),
            "args": (),
            "kwargs": {},
            "options": {"queue": "reconcile"},
        },
        # 每天 04:00 归档已读超过 7 天的非置顶站内信
        "archive-old-notifications-4am": {
            "task": "app.tasks.reconcile_tasks.archive_old_notifications_task",
            "schedule": crontab(minute=0, hour=4),
            "args": (),
            "kwargs": {},
            "options": {"queue": "reconcile"},
        },
    }

    return app


# 兼容 `celery -A app.celery_app worker` 的标准入口
celery_app = _build_celery()
