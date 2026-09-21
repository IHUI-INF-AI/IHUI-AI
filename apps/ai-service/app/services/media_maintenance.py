# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""媒体产物/任务生命周期维护(2026-09-09 立,第八轮审计 P0 修复)。

此前 tmp/charts 只写不删(每次 generate_chart 增 2 文件,永久堆积)、媒体任务
若无回调且 poller 关闭会永久卡 processing。本模块提供单例后台循环:

1. 磁盘清扫:删除项目根 tmp/charts(及 ai-service 本地 tmp/charts)中
   超过 MEDIA_MAINTENANCE_FILE_TTL_DAYS(默认 7 天)的 .html 与配对 .owner;
   反向孤儿(html 已删但 .owner 残留)一并清理。
2. 僵尸任务强失败:updated_at 超过 MEDIA_MAINTENANCE_STUCK_MINUTES(默认
   30 分钟)仍处于在途状态的任务,条件更新置 failed(带 only_if_in_flight
   语义的 SQL,不会翻转已终态任务)。

循环每 MEDIA_MAINTENANCE_INTERVAL_SECONDS(默认 3600s)执行一次;所有清理
均 fail-open(异常记日志,不影响主服务)。
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import time
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[4]  # app/services/ → app → ai-service → apps → repo root
_CHART_DIRS: tuple[Path, ...] = (
    _REPO_ROOT / "tmp" / "charts",
    _REPO_ROOT / "apps" / "ai-service" / "tmp" / "charts",
)

_FILE_TTL_DAYS = int(os.getenv("MEDIA_MAINTENANCE_FILE_TTL_DAYS", "7"))
_STUCK_MINUTES = int(os.getenv("MEDIA_MAINTENANCE_STUCK_MINUTES", "30"))
_INTERVAL_SECONDS = int(os.getenv("MEDIA_MAINTENANCE_INTERVAL_SECONDS", "3600"))

# 与 services/media_tasks.py 的在途状态集合保持一致(不直接 import 避免循环依赖)
_IN_FLIGHT: tuple[str, ...] = ("processing", "accepted", "submitted", "pending")


def sweep_chart_files(now: float | None = None) -> dict[str, int]:
    """清扫图表产物目录:按 TTL 删除 html+owner,反向清理孤儿 owner。返回删除计数。"""
    now = now if now is not None else time.time()
    ttl_seconds = _FILE_TTL_DAYS * 86400
    removed = {"html": 0, "owner": 0}
    for chart_dir in _CHART_DIRS:
        if not chart_dir.is_dir():
            continue
        try:
            entries = list(chart_dir.iterdir())
        except OSError as e:  # noqa: BLE001
            logger.warning("[media_maintenance] 列目录失败 %s: %s", chart_dir, e)
            continue
        html_stems: set[str] = set()
        for p in entries:
            if p.is_file() and p.suffix == ".html":
                html_stems.add(p.stem)
        for p in entries:
            if not p.is_file():
                continue
            try:
                if p.suffix == ".html":
                    if p.stat().st_mtime < now - ttl_seconds:
                        p.unlink(missing_ok=True)
                        Path(str(p) + ".owner").unlink(missing_ok=True)
                        removed["html"] += 1
                elif p.name.endswith(".owner"):
                    # 孤儿 sidecar:对应 html 已不存在 → 删;html 存在但超 TTL
                    # 会在上面分支配对删除,此处兜底
                    if p.stem not in html_stems or p.stat().st_mtime < now - ttl_seconds:
                        p.unlink(missing_ok=True)
                        removed["owner"] += 1
            except OSError as e:  # noqa: BLE001
                logger.warning("[media_maintenance] 清理失败 %s: %s", p, e)
    if removed["html"] or removed["owner"]:
        logger.info("[media_maintenance] 磁盘清扫: html=%d owner=%d", removed["html"], removed["owner"])
    return removed


async def fail_stuck_tasks() -> int:
    """把超时未收到终态的在途任务强失败(SQL 条件更新,不翻转已终态)。返回受影响行数。"""
    from app.services.media_tasks import get_db_conn

    sql = (
        "UPDATE media_tasks SET status='failed', "
        "result=$1::jsonb, message='任务超时未收到终态回调/轮询结果(自动强失败)', "
        "updated_at=now() "
        "WHERE status = ANY($2) AND updated_at < now() - ($3 || ' minutes')::interval "
        "RETURNING task_id"
    )
    payload = json.dumps(
        {"error": "任务超时未收到终态回调/轮询结果", "via": "maintenance"},
        ensure_ascii=False,
    )
    try:
        conn = await get_db_conn()
        try:
            rows = await conn.fetch(sql, payload, list(_IN_FLIGHT), str(_STUCK_MINUTES))
        finally:
            await conn.close()
    except Exception as e:  # noqa: BLE001
        logger.warning("[media_maintenance] 僵尸任务清扫失败: %s", e)
        return 0
    if rows:
        logger.warning(
            "[media_maintenance] 强失败 %d 个超时任务: %s",
            len(rows),
            [str(r["task_id"])[:40] for r in rows[:10]],
        )
    return len(rows)


class _MediaMaintenance:
    """单例后台维护循环(asyncio task,每小时执行一次,全部 fail-open)。"""

    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None

    def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._task = asyncio.create_task(self._loop(), name="media-maintenance")

    async def stop(self) -> None:
        if self._task is not None and not self._task.done():
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        self._task = None

    async def _loop(self) -> None:
        logger.info(
            "[media_maintenance] 启动: interval=%ds file_ttl=%dd stuck=%dmin dirs=%s",
            _INTERVAL_SECONDS,
            _FILE_TTL_DAYS,
            _STUCK_MINUTES,
            [str(d) for d in _CHART_DIRS],
        )
        while True:
            try:
                await asyncio.to_thread(sweep_chart_files)
            except Exception as e:  # noqa: BLE001
                logger.warning("[media_maintenance] sweep 异常(忽略): %s", e)
            try:
                await fail_stuck_tasks()
            except Exception as e:  # noqa: BLE001
                logger.warning("[media_maintenance] stuck-sweep 异常(忽略): %s", e)
            await asyncio.sleep(_INTERVAL_SECONDS)


media_maintenance = _MediaMaintenance()

__all__ = ["media_maintenance", "sweep_chart_files", "fail_stuck_tasks"]

_ = settings  # 预留:未来按 settings 开关启停
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
