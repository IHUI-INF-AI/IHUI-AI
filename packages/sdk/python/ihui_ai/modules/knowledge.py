"""知识库 / RAG / 知识图谱模块。

端点(13 个):
- GET    /v1/knowledge/health
- GET    /v1/knowledge/documents
- POST   /v1/knowledge/documents
- GET    /v1/knowledge/documents/:id
- GET    /v1/knowledge/documents/:id/chunks
- DELETE /v1/knowledge/documents/:id
- POST   /v1/knowledge/documents/batch-delete
- POST   /v1/knowledge/search
- POST   /v1/knowledge/rag-context
- POST   /v1/knowledge-graph/extract
- POST   /v1/knowledge-graph/build
- GET    /v1/knowledge-graph/data
- DELETE /v1/knowledge-graph/data
"""

from __future__ import annotations

from urllib.parse import quote

from ..async_base import AsyncBaseClient
from ..base import BaseClient
from ..types import (
    V1BatchDeleteDocumentsRequest,
    V1BatchDeleteDocumentsResponse,
    V1DocumentChunksResponse,
    V1IngestDocumentRequest,
    V1IngestDocumentResponse,
    V1KnowledgeDocumentDetail,
    V1KnowledgeDocumentsResponse,
    V1KnowledgeGraphBuildRequest,
    V1KnowledgeGraphBuildResponse,
    V1KnowledgeGraphDataResponse,
    V1KnowledgeGraphExtractRequest,
    V1KnowledgeGraphExtractResponse,
    V1KnowledgeHealthResponse,
    V1KnowledgeSearchRequest,
    V1KnowledgeSearchResponse,
    V1RagContextRequest,
    V1RagContextResponse,
)


class KnowledgeApi:
    """知识库 / RAG / 知识图谱模块(同步)。"""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def health(self) -> V1KnowledgeHealthResponse:
        """GET /v1/knowledge/health(健康检查)。"""
        return self._client.request("GET", "/knowledge/health")

    def list_documents(self) -> V1KnowledgeDocumentsResponse:
        """GET /v1/knowledge/documents(文档列表)。"""
        return self._client.request("GET", "/knowledge/documents")

    def ingest_document(self, req: V1IngestDocumentRequest) -> V1IngestDocumentResponse:
        """POST /v1/knowledge/documents(文档入库)。"""
        return self._client.request("POST", "/knowledge/documents", req)

    def get_document(self, document_id: str) -> V1KnowledgeDocumentDetail:
        """GET /v1/knowledge/documents/:id(文档详情)。"""
        return self._client.request("GET", f"/knowledge/documents/{quote(document_id, safe='')}")

    def get_document_chunks(self, document_id: str) -> V1DocumentChunksResponse:
        """GET /v1/knowledge/documents/:id/chunks(文档分块)。"""
        return self._client.request(
            "GET", f"/knowledge/documents/{quote(document_id, safe='')}/chunks"
        )

    def delete_document(self, document_id: str) -> None:
        """DELETE /v1/knowledge/documents/:id(删除文档)。"""
        self._client.request("DELETE", f"/knowledge/documents/{quote(document_id, safe='')}")

    def batch_delete_documents(self, req: V1BatchDeleteDocumentsRequest) -> V1BatchDeleteDocumentsResponse:
        """POST /v1/knowledge/documents/batch-delete(批量删除)。"""
        return self._client.request("POST", "/knowledge/documents/batch-delete", req)

    def search(self, req: V1KnowledgeSearchRequest) -> V1KnowledgeSearchResponse:
        """POST /v1/knowledge/search(语义搜索)。"""
        return self._client.request("POST", "/knowledge/search", req)

    def rag_context(self, req: V1RagContextRequest) -> V1RagContextResponse:
        """POST /v1/knowledge/rag-context(RAG 上下文检索)。"""
        return self._client.request("POST", "/knowledge/rag-context", req)

    def extract_graph(self, req: V1KnowledgeGraphExtractRequest) -> V1KnowledgeGraphExtractResponse:
        """POST /v1/knowledge-graph/extract(知识图谱抽取)。"""
        return self._client.request("POST", "/knowledge-graph/extract", req)

    def build_graph(self, req: V1KnowledgeGraphBuildRequest) -> V1KnowledgeGraphBuildResponse:
        """POST /v1/knowledge-graph/build(知识图谱构建)。"""
        return self._client.request("POST", "/knowledge-graph/build", req)

    def get_graph_data(self) -> V1KnowledgeGraphDataResponse:
        """GET /v1/knowledge-graph/data(知识图谱数据)。"""
        return self._client.request("GET", "/knowledge-graph/data")

    def clear_graph(self) -> None:
        """DELETE /v1/knowledge-graph/data(清空知识图谱)。"""
        self._client.request("DELETE", "/knowledge-graph/data")


class AsyncKnowledgeApi:
    """知识库 / RAG / 知识图谱模块(asyncio)。"""

    def __init__(self, client: AsyncBaseClient) -> None:
        self._client = client

    async def health(self) -> V1KnowledgeHealthResponse:
        """GET /v1/knowledge/health(健康检查)。"""
        return await self._client.request("GET", "/knowledge/health")

    async def list_documents(self) -> V1KnowledgeDocumentsResponse:
        """GET /v1/knowledge/documents(文档列表)。"""
        return await self._client.request("GET", "/knowledge/documents")

    async def ingest_document(self, req: V1IngestDocumentRequest) -> V1IngestDocumentResponse:
        """POST /v1/knowledge/documents(文档入库)。"""
        return await self._client.request("POST", "/knowledge/documents", req)

    async def get_document(self, document_id: str) -> V1KnowledgeDocumentDetail:
        """GET /v1/knowledge/documents/:id(文档详情)。"""
        return await self._client.request("GET", f"/knowledge/documents/{quote(document_id, safe='')}")

    async def get_document_chunks(self, document_id: str) -> V1DocumentChunksResponse:
        """GET /v1/knowledge/documents/:id/chunks(文档分块)。"""
        return await self._client.request(
            "GET", f"/knowledge/documents/{quote(document_id, safe='')}/chunks"
        )

    async def delete_document(self, document_id: str) -> None:
        """DELETE /v1/knowledge/documents/:id(删除文档)。"""
        await self._client.request("DELETE", f"/knowledge/documents/{quote(document_id, safe='')}")

    async def batch_delete_documents(self, req: V1BatchDeleteDocumentsRequest) -> V1BatchDeleteDocumentsResponse:
        """POST /v1/knowledge/documents/batch-delete(批量删除)。"""
        return await self._client.request("POST", "/knowledge/documents/batch-delete", req)

    async def search(self, req: V1KnowledgeSearchRequest) -> V1KnowledgeSearchResponse:
        """POST /v1/knowledge/search(语义搜索)。"""
        return await self._client.request("POST", "/knowledge/search", req)

    async def rag_context(self, req: V1RagContextRequest) -> V1RagContextResponse:
        """POST /v1/knowledge/rag-context(RAG 上下文检索)。"""
        return await self._client.request("POST", "/knowledge/rag-context", req)

    async def extract_graph(self, req: V1KnowledgeGraphExtractRequest) -> V1KnowledgeGraphExtractResponse:
        """POST /v1/knowledge-graph/extract(知识图谱抽取)。"""
        return await self._client.request("POST", "/knowledge-graph/extract", req)

    async def build_graph(self, req: V1KnowledgeGraphBuildRequest) -> V1KnowledgeGraphBuildResponse:
        """POST /v1/knowledge-graph/build(知识图谱构建)。"""
        return await self._client.request("POST", "/knowledge-graph/build", req)

    async def get_graph_data(self) -> V1KnowledgeGraphDataResponse:
        """GET /v1/knowledge-graph/data(知识图谱数据)。"""
        return await self._client.request("GET", "/knowledge-graph/data")

    async def clear_graph(self) -> None:
        """DELETE /v1/knowledge-graph/data(清空知识图谱)。"""
        await self._client.request("DELETE", "/knowledge-graph/data")


__all__ = ["KnowledgeApi", "AsyncKnowledgeApi"]
