"""多模态记忆存储(L6,2026-07-25 立,对标 GPT-4o 多模态记忆)。

为 agent 提供 image / audio / video / document 四种模态的记忆能力:
- store: 存储多模态内容(去重 + LLM 生成 caption + embedding + UPSERT)
- search: 跨模态检索(文本 query → embed → cosine similarity 排序)
- delete: 删除指定记忆
- update_importance: 调整重要度
- load_all_for_user: 启动时 hydrate 到内存缓存

降级链路(任何失败不阻塞主流程):
  - DB 异常 → 仅内存 dict 缓存,warning
  - LLM 失败 → caption=None,继续用 hash 伪向量 embedding
  - 查重命中 → 返回已有记录(更新 access_count)

不引入 numpy / Chroma / Pinecone 等外部依赖,cosine similarity 纯 Python 实现。
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import uuid as _uuid
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg

from ..core.config import settings
from .multimodal_embedder import _hash_embedding, multimodal_embedder

logger = logging.getLogger(__name__)

# 全局连接池(与 meta_learner._pool / user_profile._pool 独立,避免互相影响)
_pool: Optional[asyncpg.Pool] = None

# P0 修复:每用户内存缓存记录上限,防止 _cache 无界增长导致 OOM
_MAX_CACHE_ENTRIES = 500


async def _get_pool() -> asyncpg.Pool:
    """获取 asyncpg 连接池(懒初始化,与其他 service 独立避免互相影响)。"""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=1,
            max_size=5,
            command_timeout=10,
        )
    return _pool


async def close_pool() -> None:
    """P0 修复:关闭全局 asyncpg 连接池(main.py shutdown 调用,防止重启时连接残留)。"""
    global _pool
    if _pool is not None:
        try:
            await _pool.close()
        except Exception:
            pass
        _pool = None


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """纯 Python 实现 cosine similarity:dot / (norm_a * norm_b)。

    不同 modality 的 embedding 维度可能不同,取 min(len) 对齐(与 vector_memory 一致)。
    """
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


def _content_hash(content_bytes: bytes | None, source_uri: str | None) -> str:
    """计算 content_hash:有 bytes 用 bytes,否则用 source_uri,都没有用空串。"""
    if content_bytes is not None:
        return hashlib.sha256(content_bytes).hexdigest()
    if source_uri:
        return hashlib.sha256(source_uri.encode("utf-8")).hexdigest()
    return hashlib.sha256(b"").hexdigest()


def _parse_execute_result(result: Optional[str]) -> int:
    """解析 asyncpg execute 返回值('DELETE N' / 'UPDATE N' / 'INSERT 0 N')为行数。"""
    if not result:
        return 0
    parts = result.split()
    # INSERT 返回 "INSERT 0 N",DELETE/UPDATE 返回 "DELETE N" / "UPDATE N"
    # 取最后一个 token 作为行数
    try:
        return int(parts[-1])
    except (IndexError, ValueError):
        return 0


def _row_to_record(row: Any) -> dict[str, Any]:
    """把 asyncpg fetchrow/fetch 行转成记忆 dict。"""
    emb_raw = row["embedding"]
    if isinstance(emb_raw, str):
        try:
            emb = json.loads(emb_raw)
        except Exception as e:
            logger.warning("multimodal_memory._row_to_record embedding 解析失败: %s", e, exc_info=True)
            emb = []
    else:
        emb = list(emb_raw or [])
    meta_raw = row["metadata"]
    if isinstance(meta_raw, str):
        try:
            meta = json.loads(meta_raw)
        except Exception as e:
            logger.warning("multimodal_memory._row_to_record metadata 解析失败: %s", e, exc_info=True)
            meta = {}
    else:
        meta = dict(meta_raw or {})
    return {
        "id": str(row["id"]),
        "user_id": row["user_id"],
        "modality": row["modality"],
        "source_uri": row["source_uri"],
        "content_hash": row["content_hash"],
        "caption": row["caption"],
        "embedding": [float(x) for x in emb],
        "metadata": meta,
        "importance_score": float(row["importance_score"] or 0.5),
        "access_count": int(row["access_count"] or 0),
        "created_at": row["created_at"].isoformat() if row["created_at"] else "",
        "last_accessed_at": (
            row["last_accessed_at"].isoformat() if row["last_accessed_at"] else ""
        ),
    }


class MultimodalMemory:
    """多模态记忆存储(DB 持久化 + 内存缓存 + 纯 Python cosine similarity)。

    内存模型:_cache: dict[user_id, list[记忆 dict]](每条记忆含 embedding 字段)
    DB 模型:agent_multimodal_memory 表(持久化镜像)

    检索策略:search 在内存 _cache 上做 cosine similarity,避免每次查 DB。
    """

    def __init__(self) -> None:
        # user_id -> 记忆列表(每条含 embedding 字段,用于内存检索)
        self._cache: dict[str, list[dict[str, Any]]] = {}

    # ==================================================================
    # store
    # ==================================================================

    async def store(
        self,
        user_id: str,
        modality: str,
        *,
        source_uri: Optional[str] = None,
        content_bytes: Optional[bytes] = None,
        caption: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """存储多模态记忆。

        流程:
          1. 计算 content_hash(sha256)
          2. 查重:同 user_id + content_hash 已存在 → 返回已有记录(更新 access_count)
          3. 调 multimodal_embedder 生成 embedding
          4. 若 caption 为空且 modality != document,调 LLM 生成 caption(失败 caption=None)
          5. UPSERT 到 DB(SELECT + INSERT/UPDATE)
          6. 失败降级:仅内存 dict 缓存,warning

        Returns:
            记忆 dict(id / user_id / modality / source_uri / content_hash /
            caption / embedding / metadata / importance_score / access_count /
            created_at / last_accessed_at),参数无效返回空 dict。
        """
        if not user_id or not modality:
            return {}

        c_hash = _content_hash(content_bytes, source_uri)
        meta_dict = dict(metadata) if metadata else {}

        # 1. 查重:内存命中 → 返回已有记录(更新 access_count)
        existing = self._find_in_cache(user_id, c_hash)
        if existing is not None:
            existing["access_count"] = int(existing.get("access_count", 0)) + 1
            existing["last_accessed_at"] = datetime.now(timezone.utc).isoformat()
            await self._bump_access_count_db(str(existing.get("id", "")))
            return dict(existing)

        # 2. 查 DB(内存未命中时)
        db_existing = await self._find_in_db(user_id, c_hash)
        if db_existing is not None:
            self._add_to_cache(user_id, db_existing)
            db_existing["access_count"] = int(db_existing.get("access_count", 0)) + 1
            db_existing["last_accessed_at"] = datetime.now(timezone.utc).isoformat()
            await self._bump_access_count_db(str(db_existing.get("id", "")))
            return dict(db_existing)

        # 3. 生成 embedding
        embedding = await self._gen_embedding(
            modality,
            content_bytes=content_bytes,
            source_uri=source_uri,
            caption=caption,
        )

        # 4. 生成 caption(若为空且非 document)
        if not caption and modality != "document":
            caption = await self._gen_caption(
                modality,
                content_bytes=content_bytes,
                source_uri=source_uri,
            )

        # 5. 构造记忆 dict
        memory_id = str(_uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()
        record: dict[str, Any] = {
            "id": memory_id,
            "user_id": user_id,
            "modality": modality,
            "source_uri": source_uri,
            "content_hash": c_hash,
            "caption": caption,
            "embedding": embedding,
            "metadata": meta_dict,
            "importance_score": 0.5,
            "access_count": 1,
            "created_at": now_iso,
            "last_accessed_at": now_iso,
        }

        # 6. UPSERT 到 DB(失败降级仅写内存)
        db_ok = await self._upsert_db(record)
        if not db_ok:
            logger.warning(
                "[multimodal_memory] store DB 失败,降级仅写内存"
                "(user=%s, modality=%s)",
                user_id, modality,
            )

        # 7. 写内存缓存
        self._add_to_cache(user_id, record)
        return dict(record)

    # ==================================================================
    # search
    # ==================================================================

    async def search(
        self,
        user_id: str,
        query: str,
        *,
        modality: Optional[str] = None,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """跨模态检索:文本 query → embed → cosine similarity 排序。

        Args:
            user_id: 用户 ID
            query: 文本查询
            modality: 模态过滤(可空,空表示跨所有模态)
            top_k: 返回条数(默认 5)

        Returns:
            记忆 dict 列表(含 similarity 字段,不含 embedding),按相似度降序。
            失败返回空列表。
        """
        if not user_id or not query:
            return []

        # 1. embed query
        try:
            query_emb = await multimodal_embedder.embed_document(query)
        except Exception as e:
            logger.warning(
                "[multimodal_memory] search embed query 失败: %s", e
            )
            return []

        # 2. 从内存加载该 user 全部(可选 modality 过滤)
        records = list(self._cache.get(user_id, []))
        if modality:
            records = [r for r in records if r.get("modality") == modality]

        # 3. cosine similarity(重要度轻微加权,避免低重要度记忆排前面)
        scored: list[tuple[dict[str, Any], float]] = []
        for r in records:
            emb = r.get("embedding") or []
            sim = _cosine_similarity(query_emb, emb)
            importance = float(r.get("importance_score", 0.5))
            weighted_sim = sim * (0.7 + 0.3 * importance)
            scored.append((r, weighted_sim))

        # 4. 排序 + 截断 top_k
        scored.sort(key=lambda x: x[1], reverse=True)
        results: list[dict[str, Any]] = []
        for r, sim in scored[:top_k]:
            item = dict(r)
            item["similarity"] = round(sim, 4)
            # 返回结果不含 embedding(安全 + 节省带宽)
            item.pop("embedding", None)
            results.append(item)
        return results

    # ==================================================================
    # delete
    # ==================================================================

    async def delete(self, user_id: str, memory_id: str) -> bool:
        """删除指定记忆。

        Returns:
            True 表示内存或 DB 删除成功;False 表示参数无效或两边均未命中。
        """
        if not user_id or not memory_id:
            return False

        # 1. 从内存删除
        mem_removed = self._remove_from_cache(user_id, memory_id)

        # 2. 从 DB 删除
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                result = await conn.execute(
                    """DELETE FROM agent_multimodal_memory
                       WHERE id = $1 AND user_id = $2""",
                    _uuid.UUID(memory_id),
                    user_id,
                )
            db_removed = _parse_execute_result(result) > 0
            return mem_removed or db_removed
        except Exception as e:
            logger.warning(
                "[multimodal_memory] delete DB 失败(memory_id=%s,内存已清=%s): %s",
                memory_id, mem_removed, e,
            )
            # DB 失败时,内存已清除视为成功(降级)
            return mem_removed

    # ==================================================================
    # update_importance
    # ==================================================================

    async def update_importance(
        self,
        user_id: str,
        memory_id: str,
        score: float,
    ) -> bool:
        """更新 importance_score。

        Args:
            score: 重要度(0-1,超出范围自动 clamp)

        Returns:
            True 表示内存或 DB 更新成功;False 表示参数无效或两边均未命中。
        """
        if not user_id or not memory_id:
            return False
        # 限制 0-1
        score = max(0.0, min(1.0, float(score)))

        # 1. 内存更新
        mem_updated = False
        for r in self._cache.get(user_id, []):
            if str(r.get("id", "")) == memory_id:
                r["importance_score"] = score
                mem_updated = True
                break

        # 2. DB 更新
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                result = await conn.execute(
                    """UPDATE agent_multimodal_memory
                       SET importance_score = $1
                       WHERE id = $2 AND user_id = $3""",
                    score,
                    _uuid.UUID(memory_id),
                    user_id,
                )
            db_updated = _parse_execute_result(result) > 0
            return mem_updated or db_updated
        except Exception as e:
            logger.warning(
                "[multimodal_memory] update_importance DB 失败"
                "(memory_id=%s,内存已更=%s): %s",
                memory_id, mem_updated, e,
            )
            return mem_updated

    # ==================================================================
    # load_all_for_user
    # ==================================================================

    async def load_all_for_user(self, user_id: str) -> int:
        """启动时 hydrate:加载该 user 全部记忆到内存缓存。

        Returns:
            加载条数。DB 异常返回 0。
        """
        if not user_id:
            return 0
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT
                           id::text AS id,
                           user_id,
                           modality,
                           source_uri,
                           content_hash,
                           caption,
                           embedding,
                           metadata,
                           importance_score::float AS importance_score,
                           access_count::int AS access_count,
                           created_at,
                           last_accessed_at
                       FROM agent_multimodal_memory
                       WHERE user_id = $1
                       ORDER BY created_at DESC""",
                    user_id,
                )
        except Exception as e:
            logger.warning(
                "[multimodal_memory] load_all_for_user 失败(user=%s): %s",
                user_id, e,
            )
            return 0

        records: list[dict[str, Any]] = [_row_to_record(row) for row in rows]
        # P0 修复:LRU 上限淘汰,SQL 已按 created_at DESC 返回,保留前 N 条最新记录,防止 OOM
        if len(records) > _MAX_CACHE_ENTRIES:
            records = records[:_MAX_CACHE_ENTRIES]
        self._cache[user_id] = records
        return len(records)

    # ==================================================================
    # 内部辅助:内存缓存操作
    # ==================================================================

    def _find_in_cache(
        self, user_id: str, content_hash: str
    ) -> Optional[dict[str, Any]]:
        """从内存缓存按 (user_id, content_hash) 查找。"""
        for r in self._cache.get(user_id, []):
            if r.get("content_hash") == content_hash:
                return r
        return None

    def _add_to_cache(self, user_id: str, record: dict[str, Any]) -> None:
        """添加到内存缓存(去重:同 content_hash 替换不重复加)。"""
        bucket = self._cache.setdefault(user_id, [])
        c_hash = record.get("content_hash")
        for i, r in enumerate(bucket):
            if r.get("content_hash") == c_hash:
                bucket[i] = record
                return
        bucket.append(record)
        # P0 修复:LRU 上限淘汰,超出 _MAX_CACHE_ENTRIES 时移除最旧记录,防止 OOM
        while len(bucket) > _MAX_CACHE_ENTRIES:
            bucket.pop(0)

    def _remove_from_cache(self, user_id: str, memory_id: str) -> bool:
        """从内存缓存删除指定 id。"""
        bucket = self._cache.get(user_id, [])
        for i, r in enumerate(bucket):
            if str(r.get("id", "")) == memory_id:
                bucket.pop(i)
                return True
        return False

    # ==================================================================
    # 内部辅助:DB 操作
    # ==================================================================

    async def _find_in_db(
        self, user_id: str, content_hash: str
    ) -> Optional[dict[str, Any]]:
        """从 DB 按 (user_id, content_hash) 查找(内存未命中时调)。"""
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """SELECT
                           id::text AS id,
                           user_id,
                           modality,
                           source_uri,
                           content_hash,
                           caption,
                           embedding,
                           metadata,
                           importance_score::float AS importance_score,
                           access_count::int AS access_count,
                           created_at,
                           last_accessed_at
                       FROM agent_multimodal_memory
                       WHERE user_id = $1 AND content_hash = $2
                       LIMIT 1""",
                    user_id,
                    content_hash,
                )
        except Exception as e:
            logger.warning(
                "[multimodal_memory] _find_in_db 失败: %s", e
            )
            return None
        if not row:
            return None
        return _row_to_record(row)

    async def _bump_access_count_db(self, memory_id: str) -> None:
        """更新 access_count + last_accessed_at(查重命中时调,失败不影响主流程)。"""
        if not memory_id:
            return
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """UPDATE agent_multimodal_memory
                       SET access_count = access_count + 1,
                           last_accessed_at = NOW()
                       WHERE id = $1""",
                    _uuid.UUID(memory_id),
                )
        except Exception as e:
            logger.warning(
                "[multimodal_memory] _bump_access_count_db 失败(id=%s): %s",
                memory_id, e,
            )

    async def _upsert_db(self, record: dict[str, Any]) -> bool:
        """UPSERT 到 DB(SELECT + INSERT/UPDATE 模式,与 meta_learner 一致)。

        Returns:
            True 表示 DB 写入成功;False 表示失败(调用方降级仅写内存)。
        """
        memory_id = str(record.get("id", ""))
        if not memory_id:
            return False
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                # 先查是否存在(按 user_id + content_hash)
                row = await conn.fetchrow(
                    """SELECT id::text AS id FROM agent_multimodal_memory
                       WHERE user_id = $1 AND content_hash = $2
                       LIMIT 1""",
                    record["user_id"],
                    record["content_hash"],
                )
                if row:
                    # UPDATE:不覆盖已有 embedding / caption(同内容无需重写)
                    await conn.execute(
                        """UPDATE agent_multimodal_memory SET
                               access_count = access_count + 1,
                               last_accessed_at = NOW(),
                               importance_score = GREATEST(
                                   importance_score, $1::real
                               )
                           WHERE id = $2""",
                        float(record.get("importance_score", 0.5)),
                        _uuid.UUID(str(row["id"])),
                    )
                    # 同步内存 id 到 DB id(避免内存 id 与 DB id 不一致)
                    record["id"] = str(row["id"])
                else:
                    # INSERT 新行
                    await conn.execute(
                        """INSERT INTO agent_multimodal_memory
                               (id, user_id, modality, source_uri, content_hash,
                                caption, embedding, metadata, importance_score,
                                access_count, created_at, last_accessed_at)
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                                   NOW(), NOW())""",
                        _uuid.UUID(memory_id),
                        record["user_id"],
                        record["modality"],
                        record["source_uri"],
                        record["content_hash"],
                        record["caption"],
                        json.dumps(record["embedding"]),
                        json.dumps(record["metadata"]),
                        float(record.get("importance_score", 0.5)),
                        int(record.get("access_count", 1)),
                    )
            return True
        except Exception as e:
            logger.warning(
                "[multimodal_memory] _upsert_db 失败(id=%s): %s",
                memory_id, e,
            )
            return False

    # ==================================================================
    # 内部辅助:embedding / caption 生成
    # ==================================================================

    async def _gen_embedding(
        self,
        modality: str,
        *,
        content_bytes: Optional[bytes],
        source_uri: Optional[str],
        caption: Optional[str],
    ) -> list[float]:
        """根据 modality 调对应 embedder 方法(失败降级 hash 伪向量)。"""
        try:
            if modality == "image":
                data: bytes | str = (
                    content_bytes if content_bytes is not None
                    else (source_uri or "")
                )
                return await multimodal_embedder.embed_image(data)
            if modality == "audio":
                data = (
                    content_bytes if content_bytes is not None
                    else (source_uri or "")
                )
                return await multimodal_embedder.embed_audio(data)
            if modality == "video":
                data = (
                    content_bytes if content_bytes is not None
                    else (source_uri or "")
                )
                return await multimodal_embedder.embed_video(data)
            if modality == "document":
                # document 用 caption 或 source_uri 作文本
                text = caption or source_uri or ""
                return await multimodal_embedder.embed_document(text)
            # 未知 modality → hash 伪向量
            logger.warning(
                "[multimodal_memory] 未知 modality=%s,降级 hash 伪向量",
                modality,
            )
            return _hash_embedding(content_bytes or source_uri or modality)
        except Exception as e:
            logger.warning(
                "[multimodal_memory] _gen_embedding 失败(modality=%s): %s",
                modality, e,
            )
            return _hash_embedding(content_bytes or source_uri or modality)

    async def _gen_caption(
        self,
        modality: str,
        *,
        content_bytes: Optional[bytes],
        source_uri: Optional[str],
    ) -> Optional[str]:
        """调 LLM 生成 caption(失败返回 None,不影响主流程)。"""
        try:
            from .multimodal_embedder import _caption_via_llm, _to_bytes
            if content_bytes is not None:
                data = content_bytes
            elif source_uri:
                data = _to_bytes(source_uri)
            else:
                return None
            return await _caption_via_llm(
                modality, data, mime_type=f"{modality}/*"
            )
        except Exception as e:
            logger.warning(
                "[multimodal_memory] _gen_caption 失败(modality=%s): %s",
                modality, e,
            )
            return None


# 单例(与 meta_learner / vector_memory 风格一致)
multimodal_memory = MultimodalMemory()
