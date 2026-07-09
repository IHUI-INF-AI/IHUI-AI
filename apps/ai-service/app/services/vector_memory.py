"""向量记忆存储(语义检索)。

在 MemoryStore 基础上增加向量嵌入支持,实现跨会话语义搜索:
- add 时生成嵌入向量并存储
- search 时用余弦相似度检索最相关的 N 条记忆
- 内存模式: 嵌入向量存在列表中,遍历计算相似度
- Redis 模式: 可选持久化(用 HSET 存储带 embedding 的消息)

用法:
    store = VectorMemoryStore(llm_gateway)
    await store.add("session-1", "user", "如何配置 Redis?")
    results = await store.search("Redis 配置方法", top_k=5)
"""

import math
from datetime import datetime
from typing import Any

from ..core.llm_gateway import llm_gateway


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """计算两个向量的余弦相似度。"""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class VectorMemoryStore:
    """向量记忆存储,支持语义检索。"""

    def __init__(self, gateway: Any = None) -> None:
        self._gateway = gateway or llm_gateway
        self._store: list[dict[str, Any]] = []  # 每条: {session_id, role, content, embedding, timestamp}

    async def add(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """追加消息并生成嵌入向量。"""
        embedding = await self._gateway.embed(content)
        self._store.append({
            "session_id": session_id,
            "role": role,
            "content": content,
            "metadata": metadata or {},
            "embedding": embedding,
            "timestamp": datetime.utcnow().isoformat(),
        })

    async def search(
        self,
        query: str,
        top_k: int = 5,
        session_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """语义搜索相关记忆。

        Args:
            query: 查询文本。
            top_k: 返回最相关的 N 条。
            session_id: 限定在指定会话内搜索,None 则跨所有会话。

        Returns:
            排序后的记忆列表(不含 embedding),每条含 score 字段。
        """
        if not self._store:
            return []

        query_embedding = await self._gateway.embed(query)

        scored: list[tuple[float, dict[str, Any]]] = []
        for entry in self._store:
            if session_id and entry["session_id"] != session_id:
                continue
            score = _cosine_similarity(query_embedding, entry["embedding"])
            scored.append((score, entry))

        scored.sort(key=lambda x: x[0], reverse=True)

        results: list[dict[str, Any]] = []
        for score, entry in scored[:top_k]:
            results.append({
                "session_id": entry["session_id"],
                "role": entry["role"],
                "content": entry["content"],
                "metadata": entry["metadata"],
                "timestamp": entry["timestamp"],
                "score": round(score, 4),
            })
        return results

    def get_all(self, session_id: str | None = None) -> list[dict[str, Any]]:
        """获取所有记忆(不含 embedding)。"""
        result = []
        for entry in self._store:
            if session_id and entry["session_id"] != session_id:
                continue
            result.append({
                "session_id": entry["session_id"],
                "role": entry["role"],
                "content": entry["content"],
                "metadata": entry["metadata"],
                "timestamp": entry["timestamp"],
            })
        return result

    def clear(self, session_id: str | None = None) -> None:
        """清除记忆。session_id=None 清除全部。"""
        if session_id is None:
            self._store.clear()
        else:
            self._store = [e for e in self._store if e["session_id"] != session_id]

    def count(self, session_id: str | None = None) -> int:
        """返回记忆条数。"""
        if session_id is None:
            return len(self._store)
        return sum(1 for e in self._store if e["session_id"] == session_id)


# 全局单例
vector_memory = VectorMemoryStore()
