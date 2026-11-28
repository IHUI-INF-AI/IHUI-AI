# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""进程内在飞 agent 任务登记表。

为什么需要这一层：`agent_ops.dispatch` 是在本进程的 asyncio 任务里执行的，
HTTP 账本只能记录状态，不能拿到任务句柄。要真正 cancel，而不是改数据库状态
冒充“已停”，必须让执行侧把 `asyncio.Task` 登记出来，控制侧按 run/session 查找并
`task.cancel()`。

边界：只覆盖**当前 AI 进程**；跨进程/跨实例的 run 查不到任务时返回 not_local，
由调用方明确告知，不伪造成功。表按 key 分桶，同一 session 的并行子任务可以全部取消。
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterable
from typing import Any

__all__ = [
    "cancel_tasks",
    "register_task",
    "run_task_key",
    "session_task_key",
    "task_count",
    "unregister_task",
]

_tasks: dict[str, set[asyncio.Task[Any]]] = {}


def run_task_key(run_id: str) -> str:
    return f"run:{run_id}"


def session_task_key(session_id: str) -> str:
    return f"session:{session_id}"


def register_task(key: str, task: asyncio.Task[Any] | None = None) -> None:
    """登记当前任务；空 key / 空任务直接忽略，不制造无主记录。"""
    if not key:
        return
    target = task or asyncio.current_task()
    if target is None:
        return
    _tasks.setdefault(key, set()).add(target)


def unregister_task(key: str, task: asyncio.Task[Any] | None = None) -> None:
    target = task or asyncio.current_task()
    if not key or target is None:
        return
    bucket = _tasks.get(key)
    if not bucket:
        return
    bucket.discard(target)
    if not bucket:
        _tasks.pop(key, None)


def task_count(key: str) -> int:
    return len(_tasks.get(key, ()))


async def cancel_tasks(
    keys: Iterable[str], *, wait_timeout: float = 10.0
) -> dict[str, Any]:
    """取消 keys 下所有登记任务并等待其收口。

    - 不取消调用者自己：控制请求本身不应被自己发起的取消带走。
    - 返回 matched（取消前命中的任务数）、done、pending；没有命中时 matched=0，
      调用方据此显式返回 not_local，而不是回一个“成功”。
    """
    wanted = {key for key in keys if key}
    tasks: set[asyncio.Task[Any]] = set()
    for key in wanted:
        tasks.update(_tasks.get(key, ()))
    current = asyncio.current_task()
    tasks.discard(current)
    matched = len(tasks)
    if not tasks:
        return {"matched": 0, "done": 0, "pending": 0, "keys": sorted(wanted)}
    for task in tasks:
        task.cancel()
    done, pending = await asyncio.wait(tasks, timeout=wait_timeout)
    return {
        "matched": matched,
        "done": len(done),
        "pending": len(pending),
        "keys": sorted(wanted),
    }
