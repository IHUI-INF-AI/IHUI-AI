"""POST /api/v1/ai/rag — RAG(检索增强生成)端点。

业务流:
1. retrieve: 向量检索 + 关键词 fallback
2. rerank: 阈值过滤 + 去重
3. context: 模板化拼接
4. generate: LLM 基于 context 生成回答
5. cite: 返回 sources(供前端展示)

支持:
- 检索 + 生成一次完成
- 独立添加文档(POST /api/v1/ai/rag/documents)
- 完整 trace 返回
- score_threshold / top_k / max_context_chars 配置
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ...services.rag import rag_service

router = APIRouter()


class RAGQueryRequest(BaseModel):
    """RAG 查询请求。"""

    query: str = Field(..., description="用户问题")
    top_k: int = Field(5, ge=1, le=50, description="检索 top-k")
    session_id: str | None = Field(None, description="限定 session(空=跨会话)")
    score_threshold: float = Field(0.0, ge=0.0, le=1.0, description="score 阈值")
    max_context_chars: int = Field(6000, ge=500, le=32000, description="context 最大字符数")
    model: str | None = Field(None, description="模型名称(空用默认)")


class RAGDocumentRequest(BaseModel):
    """添加 RAG 文档请求。"""

    session_id: str = Field(..., description="session id(用于隔离)")
    content: str = Field(..., description="文档内容")
    role: str = Field("system", description="角色(默认 system)")
    metadata: dict[str, Any] = Field(default_factory=dict, description="元数据")


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.post("/rag")
async def rag_query(req: RAGQueryRequest) -> dict[str, Any]:
    """RAG 查询(retrieve + rerank + context + generate)。"""
    try:
        result = await rag_service.query(
            question=req.query,
            top_k=req.top_k,
            session_id=req.session_id,
            score_threshold=req.score_threshold,
            max_context_chars=req.max_context_chars,
            model=req.model,
        )
        return {
            "code": 0,
            "message": "ok",
            "data": rag_service.result_to_dict(result),
        }
    except Exception as e:
        return {
            "code": 500,
            "message": f"RAG 查询失败: {e}",
            "data": {"error": str(e)},
        }


@router.post("/rag/documents")
async def rag_add_document(req: RAGDocumentRequest) -> dict[str, Any]:
    """向 RAG 知识库添加文档。"""
    try:
        await rag_service.add_document(
            session_id=req.session_id,
            content=req.content,
            role=req.role,
            metadata=req.metadata,
        )
        return {
            "code": 0,
            "message": "ok",
            "data": {
                "session_id": req.session_id,
                "role": req.role,
                "content_length": len(req.content),
            },
        }
    except Exception as e:
        return {
            "code": 500,
            "message": f"添加文档失败: {e}",
            "data": {"error": str(e)},
        }
