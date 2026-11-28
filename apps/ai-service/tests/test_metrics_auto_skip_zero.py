# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""自动回收失败不写 0 快照,否则下一轮会被 6 小时窗口挡住,永远不再重试。"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.publish import metrics_collector as mc
from app.services.publish import scheduler as sched


class _FakeMetricsConn:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    async def fetch(self, *args: Any, **kwargs: Any) -> list[dict[str, Any]]:
        return self.rows

    async def close(self) -> None:
        return None


@pytest.mark.asyncio
async def test_failed_collect_skips_insert_when_write_zero_disabled(monkeypatch) -> None:
    async def _boom(*args: Any, **kwargs: Any) -> None:
        metrics = args[3]
        metrics["source"]["error"] = "login expired"

    async def _must_not_write() -> None:
        raise AssertionError("失败快照不应写库")

    monkeypatch.setattr(mc, "_collect_zhihu", _boom)
    monkeypatch.setattr(mc, "get_db_conn", _must_not_write)

    metrics = await mc.collect_metrics(
        "task-1", "zhihu", "content-1", {},
        write_zero_on_error=False,
    )

    assert metrics["source"]["error"] == "login expired"
    assert metrics["views"] == 0


@pytest.mark.asyncio
async def test_failed_metric_task_enters_cooldown_not_blocking_queue(monkeypatch) -> None:
    rows = [
        {
            "task_id": f"task-{i}",
            "platform": "juejin",
            "platform_content_id": f"content-{i}",
            "user_id": "u1",
            "targets": '[{"platform":"juejin","account_id":1}]',
        }
        for i in range(1, 5)
    ]
    calls: list[str] = []

    async def _fake_collect(task_id: str, *args: Any, **kwargs: Any) -> dict[str, Any]:
        calls.append(task_id)
        source = {} if task_id != "task-1" else {"error": "login expired"}
        return {"source": source}

    async def _fake_ensure() -> None:
        return None

    async def _fake_creds(*args: Any, **kwargs: Any) -> dict[str, Any]:
        return {}

    async def _fake_conn() -> _FakeMetricsConn:
        return _FakeMetricsConn(rows)

    monkeypatch.setattr(sched, "_ensure_metrics_table", _fake_ensure)
    monkeypatch.setattr(sched, "collect_metrics", _fake_collect)
    scheduler = sched.PublishScheduler()
    monkeypatch.setattr(scheduler, "_load_credentials", _fake_creds)
    monkeypatch.setattr(scheduler, "_get_conn", _fake_conn)

    await scheduler._metrics_once()
    assert calls == ["task-1", "task-2", "task-3", "task-4"]

    calls.clear()
    await scheduler._metrics_once()
    # task-1 失败后进入 1 小时冷却，第二轮不再占住队首。
    assert calls == ["task-2", "task-3", "task-4"]
    heartbeat = scheduler.status_snapshot()["metrics"]
    assert heartbeat["lastRunAt"]
    assert heartbeat["scanned"] == 4
    assert heartbeat["attempted"] == 3
    assert heartbeat["collected"] == 3
    assert heartbeat["failed"] == 0
    assert heartbeat["lastError"] is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
