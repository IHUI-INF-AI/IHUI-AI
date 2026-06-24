"""知识库 (RAG) API 路由.

提供文档入库、语义检索、RAG 上下文生成与文档管理能力.
所有端点均通过 owner_uuid 隔离不同用户的数据.
"""

from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from loguru import logger
from pydantic import BaseModel

from app.services.knowledge_service import knowledge_service

router = APIRouter(prefix="/knowledge", tags=["Knowledge RAG"])


# ===== 请求模型 =====


class IngestTextReq(BaseModel):
    """纯文本入库请求."""

    owner_uuid: str
    title: str
    text: str
    collection_name: str = "default"


class SearchReq(BaseModel):
    """语义检索请求."""

    query: str
    collection_name: str = "default"
    top_k: int = 5
    score_threshold: float = 0.0
    owner_uuid: str = ""


class RagContextReq(BaseModel):
    """RAG 上下文生成请求."""

    query: str
    collection_name: str = "default"
    top_k: int = 5
    owner_uuid: str = ""


class BatchDeleteReq(BaseModel):
    """批量删除请求."""

    doc_ids: list[int]
    owner_uuid: str


# ===== 健康检查 =====


@router.get("/health", summary="知识库健康检查")
async def health():
    """知识库服务健康检查."""
    return {
        "code": 0,
        "data": {"status": "ok"},
        "msg": "ok",
    }


# ===== 入库 =====


@router.post("/ingest", summary="纯文本入库")
async def ingest_text(req: IngestTextReq):
    """将纯文本内容切片后入库, 返回切片数量."""
    try:
        chunk_count = knowledge_service.ingest_text(
            owner_uuid=req.owner_uuid,
            title=req.title,
            text=req.text,
            collection_name=req.collection_name,
        )
        return {
            "code": 0,
            "data": {"chunk_count": chunk_count},
            "msg": "ok",
        }
    except Exception as e:
        logger.error(f"文本入库失败: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/ingest/file", summary="文件上传入库")
async def ingest_file(
    owner_uuid: str = Form(...),
    title: str = Form(""),
    collection_name: str = Form("default"),
    file: UploadFile = File(...),
):
    """上传文本文件入库 (.txt/.md/.json/.csv), 返回切片数量."""
    try:
        raw = await file.read()
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            text = raw.decode("gbk", errors="ignore")

        doc_title = title or file.filename or "未命名文档"
        chunk_count = knowledge_service.ingest_text(
            owner_uuid=owner_uuid,
            title=doc_title,
            text=text,
            collection_name=collection_name,
        )
        return {
            "code": 0,
            "data": {
                "chunk_count": chunk_count,
                "filename": file.filename,
                "title": doc_title,
            },
            "msg": "ok",
        }
    except Exception as e:
        logger.error(f"文件入库失败: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ===== 检索 =====


@router.post("/search", summary="语义检索")
async def search(req: SearchReq):
    """语义检索, 返回匹配的文档切片列表 (按相似度降序)."""
    try:
        results = knowledge_service.search(
            query=req.query,
            collection_name=req.collection_name,
            top_k=req.top_k,
            score_threshold=req.score_threshold,
            owner_uuid=req.owner_uuid,
        )
        return {"code": 0, "data": results, "msg": "ok"}
    except Exception as e:
        logger.error(f"语义检索失败: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/rag-context", summary="生成 RAG 上下文")
async def rag_context(req: RagContextReq):
    """生成标准化 RAG 上下文文本, 供 LLM prompt 直接拼接."""
    try:
        context = knowledge_service.get_rag_context(
            query=req.query,
            collection_name=req.collection_name,
            top_k=req.top_k,
            owner_uuid=req.owner_uuid,
        )
        return {
            "code": 0,
            "data": {"context": context, "has_result": bool(context)},
            "msg": "ok",
        }
    except Exception as e:
        logger.error(f"RAG 上下文生成失败: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ===== 文档管理 =====


@router.get("/docs", summary="获取文档列表")
async def list_docs(owner_uuid: str = ""):
    """获取指定用户的文档列表."""
    if not owner_uuid:
        raise HTTPException(status_code=400, detail="owner_uuid 不能为空")
    docs = knowledge_service.list_docs(owner_uuid=owner_uuid)
    return {"code": 0, "data": docs, "msg": "ok"}


@router.get("/docs/{doc_id}", summary="获取文档详情")
async def get_doc(doc_id: int, owner_uuid: str = ""):
    """获取单个文档详情."""
    if not owner_uuid:
        raise HTTPException(status_code=400, detail="owner_uuid 不能为空")
    doc = knowledge_service.get_doc_detail(doc_id=doc_id, owner_uuid=owner_uuid)
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")
    return {"code": 0, "data": doc, "msg": "ok"}


@router.get("/docs/{doc_id}/chunks", summary="查看文档切片")
async def get_doc_chunks(doc_id: int, owner_uuid: str = "", limit: int = 10):
    """查看文档的切片详情."""
    if not owner_uuid:
        raise HTTPException(status_code=400, detail="owner_uuid 不能为空")
    chunks = knowledge_service.get_doc_chunks(
        doc_id=doc_id, owner_uuid=owner_uuid, limit=limit
    )
    return {"code": 0, "data": chunks, "msg": "ok"}


@router.delete("/docs/{doc_id}", summary="删除单个文档")
async def delete_doc(doc_id: int, owner_uuid: str = ""):
    """删除单个文档 (软删除, 同时清理切片)."""
    if not owner_uuid:
        raise HTTPException(status_code=400, detail="owner_uuid 不能为空")
    ok = knowledge_service.delete_doc(doc_id=doc_id, owner_uuid=owner_uuid)
    if not ok:
        raise HTTPException(status_code=404, detail="文档不存在或已删除")
    return {"code": 0, "msg": "已删除"}


@router.post("/docs/batch-delete", summary="批量删除文档")
async def batch_delete_docs(req: BatchDeleteReq):
    """批量删除文档, 返回成功与失败的 doc_id 列表."""
    result: dict[str, Any] = knowledge_service.batch_delete_docs(
        doc_ids=req.doc_ids, owner_uuid=req.owner_uuid
    )
    return {"code": 0, "data": result, "msg": "ok"}
