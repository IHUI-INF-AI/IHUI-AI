# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""LangGraph 线程归属持久账(2026-10-31 安全强化第 26 批)。

归属的进程内账(canvas_graph 的 owner 表)只管画布会话的当下:进程重启后它清空,
而 LangGraph saver 表里的线程状态仍在 —— 重启后任何人拿到 threadId 都能经
`GET /api/langgraph/{thread_id}/state` 读走 graphState(整段对话与工具结果)。
本模块是归属的**持久**真相源:

- `claim_thread_owner`:执行类入口首次接触时登记(原子 UPSERT + 读回实际归属);
- `load_thread_owner`:读取类入口只比对,不登记(读一次就取得归属 = 先到先得,
  等于把"猜到 threadId 的人"变成主人)。

主体形态由调用方(langgraph 路由)先判:只有 UUID 形态的主体才可归属 —— 系统身份
(system-worker)与开发占位(dev-anonymous)不是 uuid。这里不复制那份判据,但
`user_id` 列是 uuid 类型,漏判会在写入处被数据库拒绝(第二道防线)。

失效方向:本模块不吞异常、不编造归属。DB 不可用时由调用方捕获并按"未判定"处理
(§0.3:取不到 ≠ 无主可放行)。
"""

from __future__ import annotations

import logging

from app.core.db_pool import get_shared_pool

logger = logging.getLogger(__name__)

_SELECT_OWNER_SQL = "SELECT user_id FROM langgraph_thread_owners WHERE thread_id = $1"

# ON CONFLICT 里 `SET user_id = <表>.user_id` 是刻意写的空更新:它让冲突行仍进入
# RETURNING,后到者因此能读回先到者的归属,而不必"先查后写"(那一步之间正是竞态窗)。
_CLAIM_SQL = (
    "INSERT INTO langgraph_thread_owners (thread_id, user_id) "
    "VALUES ($1, $2::uuid) "
    "ON CONFLICT (thread_id) DO UPDATE SET user_id = langgraph_thread_owners.user_id "
    "RETURNING user_id"
)


async def load_thread_owner(thread_id: str) -> str | None:
    """读取线程归属;未登记返回 None。DB 异常向上抛,由调用方按未判定处理。"""
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(_SELECT_OWNER_SQL, thread_id)
    return str(row["user_id"]) if row is not None else None


async def claim_thread_owner(thread_id: str, user_id: str) -> str | None:
    """登记线程归属并返回**登记后的实际归属**。

    并发两个主体同时首次接触同一 thread 时只有先写入的一方成为 owner,后到者拿到
    先到者的 user_id(调用方据此拒绝)。thread_id 只由承载层传入,不接受客户端直写。
    """
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(_CLAIM_SQL, thread_id, user_id)
    if row is None:
        logger.warning("线程归属登记未返回行 thread=%s", thread_id)
        return None
    return str(row["user_id"])


__all__ = ["claim_thread_owner", "load_thread_owner"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
