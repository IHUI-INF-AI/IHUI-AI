# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""跨 AI 实例的 run 取消信号。

本地 `agent_task_registry` 只能拿到当前进程的 `asyncio.Task`；控制请求落到另一个
AI 实例时，直接返回 `not_local` 不解决问题。本模块用 Redis 做一个**取消位**：

- 控制侧 `request_remote_cancel(run_id)` 写 `ihui:agent:run-cancel:<runId>`，带 TTL；
- 执行侧每个 in-flight run 起一个 watcher，轮询该 key，命中后调用
  `cancel_tasks(run/session keys)`，由执行任务的 `CancelledError` 路径收口数据库；
- watcher 只取消本进程登记的任务，不碰数据库冒充“已停”；
- Redis 未配置/不可用时返回 False，调用方继续显式 `not_local`。

不用 pub/sub 单条消息：执行侧 watcher 可能晚于消息创建；key 会保留到 TTL，
watcher 第一次轮询就能看见，避免“消息发了但没人收到”。
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from typing import Any

from ..core.config import settings
from .agent_task_registry import cancel_tasks, run_task_key, session_task_key

logger = logging.getLogger(__name__)

_KEY_PREFIX = "ihui:agent:run-cancel:"
_DEFAULT_TTL_SECONDS = 300.0
_DEFAULT_POLL_INTERVAL_SECONDS = 0.5

_client: Any | None = None
_client_lock = asyncio.Lock()


def cancel_key(run_id: str) -> str:
    return f"{_KEY_PREFIX}{run_id}"


async def _get_client() -> Any | None:
    global _client
    if _client is not None:
        return _client
    async with _client_lock:
        if _client is not None:
            return _client
        url = str(getattr(settings, "redis_url", "") or "").strip()
        if not url:
            return None
        try:
            import redis.asyncio as aioredis

            _client = aioredis.from_url(
                url,
                decode_responses=True,
                protocol=2,
                socket_connect_timeout=2,
            )
        except Exception as error:  # noqa: BLE001 -- 取消信号是增强能力，不可用不阻塞派发
            logger.warning("[run-cancel-bus] Redis 客户端不可用: %s", error)
            return None
    return _client


async def request_remote_cancel(
    run_id: str,
    *,
    session_id: str = "",
    action: str = "run_cancel",
    ttl_seconds: float = _DEFAULT_TTL_SECONDS,
) -> bool:
    """写入跨实例取消位；返回 False 表示 Redis 不可用，调用方不得冒充成功。"""
    if not run_id:
        return False
    client = await _get_client()
    if client is None:
        return False
    payload = json.dumps(
        {
            "runId": run_id,
            "sessionId": session_id,
            "action": action,
        },
        ensure_ascii=False,
    )
    try:
        await client.set(cancel_key(run_id), payload, ex=max(1, int(ttl_seconds)))
        logger.info(
            "[run-cancel-bus] remote cancel requested run=%s action=%s", run_id, action
        )
        return True
    except Exception as error:  # noqa: BLE001
        logger.warning("[run-cancel-bus] remote cancel request failed run=%s: %s", run_id, error)
        return False


async def watch_remote_cancel(
    run_id: str,
    session_id: str = "",
    *,
    interval: float = _DEFAULT_POLL_INTERVAL_SECONDS,
) -> None:
    """轮询本 run 的取消位；命中后取消本进程登记的 run/session 任务。"""
    if not run_id:
        return
    client = await _get_client()
    if client is None:
        return
    key = cancel_key(run_id)
    while True:
        try:
            value = await client.get(key)
        except asyncio.CancelledError:
            raise
        except Exception as error:  # noqa: BLE001 -- 轮询失败不能把执行任务带崩
            logger.debug("[run-cancel-bus] poll failed run=%s: %s", run_id, error)
            value = None
        if value:
            with contextlib.suppress(Exception):
                await client.delete(key)
            keys = [run_task_key(run_id)]
            if session_id:
                keys.append(session_task_key(session_id))
            result = await cancel_tasks(keys, wait_timeout=0.2)
            logger.info(
                "[run-cancel-bus] remote cancel applied run=%s matched=%s done=%s pending=%s",
                run_id,
                result.get("matched"),
                result.get("done"),
                result.get("pending"),
            )
            return
        await asyncio.sleep(interval)


def start_remote_cancel_watch(run_id: str, session_id: str = "") -> asyncio.Task[None] | None:
    """为当前 in-flight run 起 watcher；没有事件循环时返回 None。"""
    if not run_id:
        return None
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return None
    return loop.create_task(
        watch_remote_cancel(run_id, session_id),
        name=f"run-cancel-watch:{run_id}",
    )


async def stop_remote_cancel_watch(watcher: asyncio.Task[None] | None) -> None:
    if watcher is None:
        return
    watcher.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await watcher
