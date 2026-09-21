# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""跨会话记忆自动沉淀(D10,2026-09-19 立)。

问题:现有 MemoryExtractor 只能被显式调用,对话里的长期事实(用户偏好 / 项目约定 /
历史决策 / 反馈)不会自动落库。

方案:主聊天会话每 N 轮用户消息自动触发一次后台沉淀任务,把该会话近期消息交给
现有 MemorySystem.add_with_extraction 抽取长期记忆并写入统一记忆存储(向量库 +
API 跨端同步),复用既有能力,不新建表。

- 触发计数:按 session_id 维护 LRU 计数;达到阈值(默认 10,N 由环境变量
  IHUI_MEMORY_SEDIMENT_EVERY 控制,0=禁用)才触发一次,触发后计数归零。
- 执行:fire-and-forget(asyncio.create_task),失败静默(只记日志,绝不冒泡到主链路)。
- 可测试性:_store_fn 为可替换接缝(测试注入 fake extractor/store)。
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# 每多少次用户消息触发一次沉淀(阈值来源于环境变量,0=禁用)
_DEFAULT_EVERY = 10

# 单次沉淀最多取会话最近多少条消息交给抽取器
_RECENT_LIMIT = 40

# 后台任务引用集合(防 GC 提前回收;done 后自动移除)
_pending: set[asyncio.Task[None]] = set()

# 每会话用户消息计数(session_id -> count)
_COUNT: dict[str, int] = {}


def _threshold() -> int:
    """读取环境变量阈值;非法值回退默认。0=禁用。"""
    raw = os.getenv("IHUI_MEMORY_SEDIMENT_EVERY", "")
    if raw is None or raw == "":
        return _DEFAULT_EVERY
    try:
        val = int(raw)
    except (TypeError, ValueError):
        return _DEFAULT_EVERY
    return val


async def _default_store(
    user_uuid: str | None,
    messages: list[dict[str, str]],
    session_id: str | None,
) -> None:
    """默认沉淀实现:复用现有 MemorySystem.add_with_extraction。

    persist_messages=False:消息已由调用方(对话过程 / 请求体)持有,不重复写回
    MemoryStore,避免数据膨胀。scope=session 表示会话级长期记忆。
    """
    from .memory import memory_system

    await memory_system.add_with_extraction(
        user_uuid,  # type: ignore[arg-type]
        messages,
        scope="session",
        session_id=session_id,
        persist_messages=False,
    )


# 可替换接缝:测试注入 fake extractor/store
_store_fn = _default_store


def _normalize(messages: list[dict[str, Any]]) -> list[dict[str, str]]:
    """把任意消息列表规范为 {role, content} 且 content 非空。"""
    out: list[dict[str, str]] = []
    for m in messages or []:
        if not isinstance(m, dict):
            continue
        role = str(m.get("role", "user"))
        content = str(m.get("content", "")).strip()
        if content:
            out.append({"role": role, "content": content})
    return out


async def _fetch_recent(session_id: str, user_uuid: str | None) -> list[dict[str, str]]:
    """recent_messages 未提供时,从 MemoryStore 取最近消息(降级:失败返回空)。"""
    try:
        from .memory import memory_store

        raw = await memory_store.get(session_id, _RECENT_LIMIT, user_id=user_uuid)
        return _normalize(raw)
    except Exception as e:  # 取历史失败不应阻断沉淀
        logger.warning("memory_sedimenter 取近期消息失败(降级为空): %s", e)
        return []


async def _run_sediment(
    session_id: str,
    user_uuid: str | None,
    recent_messages: list[dict[str, Any]] | None,
) -> None:
    """后台沉淀任务:抽取 + 写入。整段 try/except,失败静默。"""
    try:
        messages = _normalize(recent_messages) if recent_messages else await _fetch_recent(
            session_id, user_uuid
        )
        if not messages:
            return
        await _store_fn(user_uuid, messages, session_id)
    except Exception as e:
        logger.warning("memory_sedimenter 沉淀失败(静默): %s", e, exc_info=True)


async def maybe_sediment(
    session_id: str,
    user_uuid: str | None = None,
    *,
    recent_messages: list[dict[str, Any]] | None = None,
) -> None:
    """主聊天会话每 N 轮用户消息触发一次后台记忆沉淀。

    Args:
        session_id:       会话 ID(计数键;None 则跳过)
        user_uuid:        用户 ID(沉淀归属;None 则跳过)
        recent_messages:  可选,直接传入的近期消息;缺省时尝试从 MemoryStore 取

    行为:
        - IHUI_MEMORY_SEDIMENT_EVERY=0 → 全局禁用,直接返回。
        - 计数未达阈值 → 仅累加,不触发。
        - 计数达阈值 → 重置并 fire-and-forget 后台沉淀;本函数本身不抛异常。
    """
    if not session_id or not user_uuid:
        return
    every = _threshold()
    if every <= 0:
        return

    # 模块级计数(单线程 asyncio 内同步访问,原子性由无 await 保证)
    counts = _counts()  # 延迟取,避免循环导入
    n = counts.get(session_id, 0) + 1
    if n < every:
        counts[session_id] = n
        return

    # 达阈值:重置并触发
    counts[session_id] = 0
    task = asyncio.create_task(_run_sediment(session_id, user_uuid, recent_messages))
    _pending.add(task)
    task.add_done_callback(_pending.discard)


def _counts() -> dict[str, int]:
    return _COUNT
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
