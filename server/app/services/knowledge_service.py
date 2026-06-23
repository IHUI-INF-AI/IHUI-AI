"""知识库服务 (RAG).

提供文档入库、语义检索和 RAG 上下文生成功能.
使用 DashScope embedding API 生成向量, SQLite/PostgreSQL 存储文档和切片.
"""

import hashlib
import json
import os
import re
from typing import Any

import httpx
from loguru import logger
from sqlalchemy import desc, text

from app.database import get_session
from app.models.knowledge_models import KnowledgeChunk, KnowledgeDoc


def _get_embedding_api_key() -> str:
    """获取 embedding API 密钥."""
    return os.getenv("DASHSCOPE_API_KEY", "")


def _get_embedding(text: str) -> list[float] | None:
    """调用 DashScope API 生成 embedding.

    使用 text-embedding-v2 模型, 1536 维向量.
    如果 API 不可用, 返回 None (退化为关键词匹配).
    """
    api_key = _get_embedding_api_key()
    if not api_key:
        return None

    try:
        resp = httpx.post(
            "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "text-embedding-v2",
                "input": {"texts": [text[:2048]]},
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        embeddings = data.get("output", {}).get("embeddings", [])
        if embeddings:
            return embeddings[0].get("embedding", [])
    except Exception as e:
        logger.warning(f"Embedding 生成失败: {e}")
    return None


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """计算余弦相似度."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _keyword_score(query: str, content: str) -> float:
    """关键词匹配分数 (embedding 不可用时的回退方案)."""
    query_words = set(re.findall(r"[\w\u4e00-\u9fff]+", query.lower()))
    content_words = set(re.findall(r"[\w\u4e00-\u9fff]+", content.lower()))
    if not query_words or not content_words:
        return 0.0
    overlap = query_words & content_words
    return len(overlap) / len(query_words)


def _split_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """将文本切分为重叠的片段."""
    if not text or not text.strip():
        return []
    text = text.strip()
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        # 尝试在句号或换行处切分
        if end < len(text):
            for sep in ["\n", "。", "！", "？", ".", "!", "?"]:
                pos = text.rfind(sep, start, end)
                if pos > start:
                    end = pos + len(sep)
                    break
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - overlap if end - overlap > start else end
    return chunks


class KnowledgeService:
    """知识库服务."""

    def ingest_text(
        self,
        owner_uuid: str,
        title: str,
        text: str,
        collection_name: str = "default",
    ) -> int:
        """将文本入库, 返回切片数量."""
        if not text or not text.strip():
            return 0

        chunks = _split_text(text)
        if not chunks:
            return 0

        content_hash = hashlib.md5(text.encode("utf-8")).hexdigest()

        with get_session() as db:
            doc = KnowledgeDoc(
                owner_uuid=owner_uuid,
                title=title,
                source_type="text",
                content_hash=content_hash,
                chunk_count=len(chunks),
                status="active",
            )
            db.add(doc)
            db.flush()

            for i, chunk_text in enumerate(chunks):
                embedding = _get_embedding(chunk_text)
                chunk = KnowledgeChunk(
                    doc_id=doc.id,
                    collection_name=collection_name,
                    owner_uuid=owner_uuid,
                    chunk_index=i,
                    content=chunk_text,
                    embedding=json.dumps(embedding) if embedding else None,
                )
                db.add(chunk)

            db.commit()

        logger.info(f"文档入库: {title}, {len(chunks)} 个切片")
        return len(chunks)

    def search(
        self,
        query: str,
        collection_name: str = "default",
        top_k: int = 5,
        score_threshold: float = 0.0,
        owner_uuid: str = "",
    ) -> list[dict[str, Any]]:
        """语义检索, 返回匹配的切片列表."""
        query_embedding = _get_embedding(query)

        with get_session() as db:
            q = db.query(KnowledgeChunk).filter(
                KnowledgeChunk.collection_name == collection_name
            )
            if owner_uuid:
                q = q.filter(KnowledgeChunk.owner_uuid == owner_uuid)

            chunks = q.all()

            results = []
            for chunk in chunks:
                if query_embedding and chunk.embedding:
                    try:
                        chunk_embedding = json.loads(chunk.embedding)
                        score = _cosine_similarity(query_embedding, chunk_embedding)
                    except Exception:
                        score = _keyword_score(query, chunk.content)
                else:
                    score = _keyword_score(query, chunk.content)

                if score >= score_threshold:
                    results.append({
                        "id": chunk.id,
                        "doc_id": chunk.doc_id,
                        "content": chunk.content,
                        "score": score,
                        "chunk_index": chunk.chunk_index,
                    })

            results.sort(key=lambda x: x["score"], reverse=True)
            return results[:top_k]

    def get_rag_context(
        self,
        query: str,
        collection_name: str = "default",
        top_k: int = 5,
        owner_uuid: str = "",
    ) -> str:
        """生成 RAG 上下文字符串."""
        results = self.search(
            query=query,
            collection_name=collection_name,
            top_k=top_k,
            owner_uuid=owner_uuid,
        )

        if not results:
            return ""

        context_parts = []
        for i, r in enumerate(results, 1):
            context_parts.append(f"[{i}] {r['content']}")

        return "\n\n".join(context_parts)

    def list_docs(self, owner_uuid: str) -> list[dict[str, Any]]:
        """列出所有文档."""
        with get_session() as db:
            docs = (
                db.query(KnowledgeDoc)
                .filter(
                    KnowledgeDoc.owner_uuid == owner_uuid,
                    KnowledgeDoc.status == "active",
                )
                .order_by(desc(KnowledgeDoc.created_at))
                .all()
            )
            return [
                {
                    "id": d.id,
                    "title": d.title,
                    "source_type": d.source_type,
                    "chunk_count": d.chunk_count,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                }
                for d in docs
            ]

    def delete_doc(self, doc_id: int, owner_uuid: str) -> bool:
        """删除文档 (软删除)."""
        with get_session() as db:
            doc = (
                db.query(KnowledgeDoc)
                .filter(
                    KnowledgeDoc.id == doc_id,
                    KnowledgeDoc.owner_uuid == owner_uuid,
                )
                .first()
            )
            if not doc:
                return False
            doc.status = "deleted"
            db.query(KnowledgeChunk).filter(KnowledgeChunk.doc_id == doc_id).delete()
            db.commit()
            return True

    def batch_delete_docs(self, doc_ids: list[int], owner_uuid: str) -> dict[str, Any]:
        """批量删除文档."""
        success = []
        failed = []
        for doc_id in doc_ids:
            if self.delete_doc(doc_id, owner_uuid):
                success.append(doc_id)
            else:
                failed.append(doc_id)
        return {"success": success, "failed": failed}

    def get_doc_detail(self, doc_id: int, owner_uuid: str) -> dict[str, Any] | None:
        """获取文档详情."""
        with get_session() as db:
            doc = (
                db.query(KnowledgeDoc)
                .filter(
                    KnowledgeDoc.id == doc_id,
                    KnowledgeDoc.owner_uuid == owner_uuid,
                    KnowledgeDoc.status == "active",
                )
                .first()
            )
            if not doc:
                return None
            return {
                "id": doc.id,
                "title": doc.title,
                "source_type": doc.source_type,
                "source_path": doc.source_path,
                "chunk_count": doc.chunk_count,
                "content_hash": doc.content_hash,
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
            }

    def get_doc_chunks(
        self, doc_id: int, owner_uuid: str, limit: int = 10
    ) -> list[dict[str, Any]]:
        """获取文档切片预览."""
        with get_session() as db:
            doc = (
                db.query(KnowledgeDoc)
                .filter(
                    KnowledgeDoc.id == doc_id,
                    KnowledgeDoc.owner_uuid == owner_uuid,
                )
                .first()
            )
            if not doc:
                return []

            chunks = (
                db.query(KnowledgeChunk)
                .filter(KnowledgeChunk.doc_id == doc_id)
                .order_by(KnowledgeChunk.chunk_index)
                .limit(limit)
                .all()
            )
            return [
                {
                    "id": c.id,
                    "chunk_index": c.chunk_index,
                    "content": c.content,
                }
                for c in chunks
            ]


knowledge_service = KnowledgeService()
