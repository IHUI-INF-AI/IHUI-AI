# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""语义压缩回捞层(检索回捞服务)。

压缩发生时,被替换掉的旧消息快照(原文 + 摘要)写入向量库(vector_memory),
供 agent loop / MCP 工具 context_recall 按语义查询回捞,弥补"压缩即丢弃"的缺陷。

设计约束:
- 纯写入 / 查询,绝不修改 context_compaction 任何行为(仅复用其常量做摘要定位)。
- embed 失败自动降级 hash 伪向量(vector_memory.embed 已内置),本模块对 embed / 写盘
  失败一律降级 log,不向主链路(llm.py 压缩调用点)抛异常。
- 模块级单例 `context_recall` 与 vector_memory 同风格(模块加载即构造)。
- fire-and-forget 写入由调用方(asyncio.create_task)负责,本模块提供协程接口即可。
"""

from __future__ import annotations

import logging
import time
from typing import Any

from .vector_memory import VectorMemoryStore, vector_memory

logger = logging.getLogger(__name__)

_DEFAULT_TOP_K = 8
_RECALL_THRESHOLD = 0.7  # 与 vector_memory.search 默认阈值一致(相关性闸门)


def _extract_text(msg: dict[str, Any]) -> str:
    """从 OpenAI 格式消息提取纯文本。

    兼容 str content / list[vision part] / 空 content(仅 tool_calls 的 assistant 消息)。
    """
    content = msg.get("content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, dict):
                text = part.get("text") or str(part.get("content", ""))
                if text:
                    parts.append(text)
        return "\n".join(parts)
    return str(content) if content else ""


class ContextRecallService:
    """压缩回捞服务:把被压缩移除的消息快照写入向量库,并提供语义回捞查询。"""

    def __init__(self, store: VectorMemoryStore | None = None) -> None:
        # 默认复用全局 vector_memory 单例(与 memory.py 的 MemorySystem 共享同一持久化);
        # 测试可注入隔离实例(传入自定义 persist_path 的 VectorMemoryStore)。
        # 注意:VectorMemoryStore 定义了 __len__,空实例为 falsy,故用 `is not None` 判定,
        # 不能用 `store or vector_memory`(空隔离实例会被误判为未注入而回退到全局单例)。
        self._store: VectorMemoryStore = store if store is not None else vector_memory

    async def snapshot_compacted(
        self,
        session_id: str,
        user_id: str | None,
        removed_messages: list[dict[str, Any]],
        summary: str | None = None,
        reason: str = "compaction",
    ) -> int:
        """把被压缩移除的消息逐条写入向量库,返回实际写入条数。

        Args:
            session_id: 会话标识(compact:{session_id}:{ts}:{seq} 作为 entry_id 前缀)。
            user_id: 用户标识(尽量从 JWT 派生,用于归属与审计;取不到传 None)。
            removed_messages: 被压缩裁剪掉的旧消息(OpenAI 格式 dict 列表)。
            summary: 压缩生成的结构化摘要文本(来自压缩产物的 summary 消息),可空。
            reason: 触发原因(默认 "compaction",便于后续扩展区分 truncate / ratio 等)。

        Returns:
            写入向量库的 entry 条数。removed 为空 / embed 失败 / 写盘失败均不抛,
            降级为 log 并返回已成功写入的条数(失败项为 0 贡献)。
        """
        if not removed_messages:
            return 0
        written = 0
        compressed_at = int(time.time())
        seq = 0
        for msg in removed_messages:
            seq += 1
            entry_id = f"compact:{session_id}:{compressed_at}:{seq}"
            text = _extract_text(msg)
            if not text:
                # 空 content(典型:仅 tool_calls 的 assistant 消息)跳过,无可回捞文本
                continue
            role = msg.get("role", "unknown")
            entry = {
                "session_id": session_id,
                "user_id": user_id,
                "turn_range": seq,
                "original_role": role,
                "text": text,
                "summary": summary or "",
                "reason": reason,
                "compressed_at": compressed_at,
            }
            try:
                embedding = await self._store.embed(text)
                await self._store.add_entry(entry_id, entry, embedding)
                written += 1
            except Exception as e:
                logger.warning("context_recall 快照写入失败(entry=%s): %s", entry_id, e)
        return written

    async def recall(
        self,
        session_id: str | None,
        query: str,
        top_k: int = _DEFAULT_TOP_K,
    ) -> dict[str, Any]:
        """语义回捞:embed query → 向量检索 → 组装结果。

        Args:
            session_id: 会话标识;为空时全库检索,非空时按 session 二次过滤。
            query: 自然语言查询(语义检索)。
            top_k: 返回条数上限(默认 8)。

        Returns:
            {ok: True, results: [{session_id, text, summary, similarity,
            original_role, compressed_at}]};异常时 {ok: False, error: ...}。
            query 为空直接返回 ok + 空 results。
        """
        if not query or not query.strip():
            return {"ok": True, "results": []}
        try:
            query_embedding = await self._store.embed(query)
        except Exception as e:
            logger.warning("context_recall 查询 embed 失败: %s", e)
            return {"ok": False, "error": str(e)}
        try:
            hits = await self._store.search(
                query_embedding, top_k=top_k, threshold=_RECALL_THRESHOLD
            )
        except Exception as e:
            logger.warning("context_recall 查询检索失败: %s", e)
            return {"ok": False, "error": str(e)}
        results: list[dict[str, Any]] = []
        for _eid, entry, sim in hits:
            if session_id and entry.get("session_id") != session_id:
                continue
            results.append(
                {
                    "session_id": entry.get("session_id"),
                    "text": entry.get("text", ""),
                    "summary": entry.get("summary", ""),
                    "similarity": sim,
                    "original_role": entry.get("original_role", "unknown"),
                    "compressed_at": entry.get("compressed_at"),
                }
            )
        return {"ok": True, "results": results}


# 模块级单例(与 vector_memory 同风格:模块加载即构造,全局复用)
context_recall = ContextRecallService()
