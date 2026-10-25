# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""fire-and-forget 后台任务的强引用登记处(全 AI 服务唯一出口,2026-10-25 立)。

为什么必须有这一格:事件循环对 `asyncio.create_task(...)` 返回的 Task **只握弱引用** ——
返回值被丢弃的任务,在跑完之前的任意时刻都可能被 GC 静默回收,而且不报任何错。
本仓实测过的症状族就是它:"蒸馏偶尔什么都没发生"、workflow 实例永逝、试用额度漏计、
发出去的文章存活监控断线……CPython asyncio 文档明文警告过这个陷阱;
`knowledge_card_extractor` / `audit_service` 早已把这写成模块内纪律(带自己的 set),
但没有收口成一条 —— 本模块就是那条收口。

用法(要求当前有 running loop,和 `asyncio.create_task` 同语义;无 loop 抛 RuntimeError,
调用方按原样 try/except 降级):

    from ..core.background_tasks import spawn

    spawn(send_welcome_email(uid), name="welcome-email")

机器闸 = 守门 247 `scripts/check-ai-task-background-reference.mjs`:ai-service 内每个
`create_task(`/`ensure_future(` 调用点,要么包在 `spawn(...)` 里,要么有明确持有/豁免。
不要再在本目录之外手搓第二份 pending-set —— §0.6 单一真相源,第二份必然漂移。
"""

from __future__ import annotations

import asyncio
from collections.abc import Coroutine
from typing import Any

# 运行中 fire-and-forget 任务的强引用集;每个任务 done 回调里自摘,永不无限增长。
_pending: set[asyncio.Task[Any]] = set()


def spawn[T](coro: Coroutine[Any, Any, T], *, name: str | None = None) -> asyncio.Task[T]:
    """提交 fire-and-forget 任务并持强引用到完成。

    无运行中的事件循环时抛 RuntimeError(与 asyncio.create_task 一致)——
    调用方若需要同步上下文降级,自行 try/except RuntimeError。
    """
    task: asyncio.Task[T] = asyncio.create_task(coro, name=name)
    _pending.add(task)
    task.add_done_callback(_pending.discard)
    return task


def pending_count() -> int:
    """观测/测试口:当前未完成任务数。"""
    return len(_pending)


# §22c:供镜像测试 import 真实判据面,不在测试里复制实现。
__test__ = {"spawn": spawn, "pending_count": pending_count, "pending": _pending}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
