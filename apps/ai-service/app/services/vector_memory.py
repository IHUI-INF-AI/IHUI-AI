"""向量记忆存储(纯 Python 实现,无外部依赖)。

对标 Hermes Agent 向量检索引擎:内存向量索引 + cosine similarity 检索 + embedding 生成。
- embedding 优先调 llm_gateway.embed;失败降级为确定性 hash 伪向量(sha256 分段,128 维)。
- cosine similarity 纯 Python 实现:dot / (norm_a * norm_b),不引入 numpy。
- 持久化:JSON 文件快照(.data/vector_memory.json),add/update/delete 后异步写盘,启动时 hydrate 加载。
"""

import asyncio
import hashlib
import json
import logging
import math
import os
from typing import Any

logger = logging.getLogger(__name__)

_HASH_DIM = 128  # hash 伪向量维度

# 持久化文件路径(相对 ai-service 根目录)
_PERSIST_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    ".data",
)
_PERSIST_PATH = os.path.join(_PERSIST_DIR, "vector_memory.json")


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """纯 Python 实现 cosine similarity:dot / (norm_a * norm_b)。"""
    if not a or not b:
        return 0.0
    n = min(len(a), len(b))
    if n == 0:
        return 0.0
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for i in range(n):
        ai = a[i]
        bi = b[i]
        dot += ai * bi
        norm_a += ai * ai
        norm_b += bi * bi
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (math.sqrt(norm_a) * math.sqrt(norm_b))


def _hash_embedding(text: str, dim: int = _HASH_DIM) -> list[float]:
    """确定性 hash 伪向量:sha256 分段生成 dim 维浮点向量,同文本同向量。

    用 offset 作盐,每轮 sha256 输出 32 字节,每 4 字节映射 1 维(共 8 维/轮)。
    """
    vec = [0.0] * dim
    data = text.encode("utf-8")
    offset = 0
    while offset < dim:
        h = hashlib.sha256(data + offset.to_bytes(4, "big")).digest()
        for i in range(8):
            if offset + i >= dim:
                break
            chunk = h[i * 4:(i + 1) * 4]
            val = int.from_bytes(chunk, "big") / 0xFFFFFFFF  # 0~1
            vec[offset + i] = val * 2 - 1  # 归一化到 [-1, 1]
        offset += 8
    return vec


class VectorMemoryStore:
    """向量记忆存储(内存索引 + JSON 文件持久化,纯 Python cosine similarity)。

    不引入 numpy / Chroma / Pinecone 等外部依赖。
    持久化策略:add/update/delete 后标记 dirty,异步写盘(不阻塞主流程)。
    """

    def __init__(self, persist_path: str | None = None) -> None:
        self._entries: dict[str, dict[str, Any]] = {}  # entry_id -> entry
        self._vectors: dict[str, list[float]] = {}     # entry_id -> embedding
        self._persist_path = persist_path or _PERSIST_PATH
        self._dirty = False
        self._hydrated = False

    # ==================================================================
    # 持久化(JSON 文件快照)
    # ==================================================================

    def _persist_sync(self) -> None:
        """同步写盘(在 executor 中调用,避免阻塞事件循环)。"""
        try:
            os.makedirs(os.path.dirname(self._persist_path), exist_ok=True)
            data = {
                "entries": self._entries,
                "vectors": self._vectors,
            }
            # 原子写:先写临时文件再 rename(避免写一半崩溃)
            tmp_path = self._persist_path + ".tmp"
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
            os.replace(tmp_path, self._persist_path)
            self._dirty = False
        except Exception as e:
            logger.warning("向量记忆持久化失败: %s", e)

    async def _persist_async(self) -> None:
        """异步写盘(通过 run_in_executor 避免阻塞事件循环)。"""
        if not self._dirty:
            return
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._persist_sync)

    async def hydrate(self) -> int:
        """启动时从 JSON 文件加载历史向量记忆。返回加载条数。"""
        if self._hydrated:
            return len(self._entries)
        self._hydrated = True
        if not os.path.isfile(self._persist_path):
            return 0
        try:
            with open(self._persist_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            entries = data.get("entries", {})
            vectors = data.get("vectors", {})
            if isinstance(entries, dict) and isinstance(vectors, dict):
                # 只加载 entry_id 在两边都存在的条目(数据一致性)
                common_ids = set(entries.keys()) & set(vectors.keys())
                self._entries = {k: entries[k] for k in common_ids}
                self._vectors = {k: [float(x) for x in vectors[k]] for k in common_ids}
                logger.info("向量记忆 hydrate 完成: %d 条", len(self._entries))
                return len(self._entries)
        except Exception as e:
            logger.warning("向量记忆 hydrate 失败: %s", e)
        return 0

    # ==================================================================
    # 基本操作
    # ==================================================================

    async def embed(self, text: str) -> list[float]:
        """生成 embedding:优先 llm_gateway,失败降级为 hash 伪向量。"""
        try:
            from ..core.llm_gateway import llm_gateway
            result = await llm_gateway.embed(text)
            if isinstance(result, list) and result:
                return [float(x) for x in result]
        except Exception:
            pass
        # 降级:确定性 hash 伪向量
        return _hash_embedding(text)

    async def add_entry(
        self,
        entry_id: str,
        entry: dict[str, Any],
        embedding: list[float],
    ) -> None:
        """添加记忆 + 向量,并触发异步持久化。"""
        self._entries[entry_id] = entry
        self._vectors[entry_id] = embedding
        self._dirty = True
        await self._persist_async()

    async def search(
        self,
        query_embedding: list[float],
        top_k: int = 10,
        threshold: float = 0.7,
    ) -> list[tuple[str, dict[str, Any], float]]:
        """向量检索:返回 [(entry_id, entry, similarity)],按相似度降序。"""
        if not query_embedding:
            return []
        scored: list[tuple[str, dict[str, Any], float]] = []
        for eid, vec in self._vectors.items():
            sim = _cosine_similarity(query_embedding, vec)
            if sim >= threshold:
                entry = self._entries.get(eid, {})
                scored.append((eid, entry, sim))
        scored.sort(key=lambda x: x[2], reverse=True)
        return scored[:top_k]

    async def update_embedding(
        self,
        entry_id: str,
        embedding: list[float],
    ) -> None:
        """更新向量(entry 必须已存在),并触发异步持久化。"""
        if entry_id in self._entries:
            self._vectors[entry_id] = embedding
            self._dirty = True
            await self._persist_async()

    async def delete(self, entry_id: str) -> None:
        """删除记忆 + 向量,并触发异步持久化。"""
        self._entries.pop(entry_id, None)
        self._vectors.pop(entry_id, None)
        self._dirty = True
        await self._persist_async()

    # ==================================================================
    # 辅助方法
    # ==================================================================

    def __len__(self) -> int:
        return len(self._entries)

    def list_entry_ids(self) -> list[str]:
        """列出所有 entry_id(调试 / 测试用)。"""
        return list(self._entries.keys())

    def list_entries(self) -> list[dict[str, Any]]:
        """列出所有 entry 完整数据(供 MemorySystem 纯本地降级检索用)。"""
        return [dict(e) for e in self._entries.values()]


# 全局单例(供 memory.py 的 MemorySystem 导入)
vector_memory = VectorMemoryStore()
