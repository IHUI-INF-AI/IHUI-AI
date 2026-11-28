# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""进程内任务登记/取消的封闭行为。"""

from __future__ import annotations

import asyncio

import pytest

from app.services.agent_task_registry import (
    cancel_tasks,
    register_task,
    run_task_key,
    task_count,
    unregister_task,
)


@pytest.mark.asyncio
async def test_cancel_tasks_cancels_registered_task() -> None:
    started = asyncio.Event()
    cancelled = asyncio.Event()

    async def worker() -> None:
        started.set()
        try:
            await asyncio.sleep(30)
        except asyncio.CancelledError:
            cancelled.set()
            raise

    task = asyncio.create_task(worker())
    await started.wait()
    key = run_task_key("run-1")
    register_task(key, task)
    assert task_count(key) == 1
    try:
        result = await cancel_tasks([key], wait_timeout=2)
        assert result["matched"] == 1
        assert result["done"] == 1
        assert task.cancelled()
        assert cancelled.is_set()
    finally:
        unregister_task(key, task)


@pytest.mark.asyncio
async def test_cancel_tasks_without_registration_is_explicitly_zero() -> None:
    result = await cancel_tasks([run_task_key("run-missing")], wait_timeout=1)
    assert result == {"matched": 0, "done": 0, "pending": 0, "keys": ["run:run-missing"]}
