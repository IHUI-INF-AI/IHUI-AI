# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""``/api/v1/ai/sag2/*`` — SAG2 词法多跳检索通道端点（本仓自有实现）。

能力对齐对照程序 SAG Wiki 的前后端：本地文件夹登记（零模型建库）、
离线快速搜索、跨文件多跳检索与可直达原文的引用、索引状态、
以及与本仓既有 ``rag.py`` 向量/关键词通道的 RRF 三通道融合。
"""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ...services.sag2_lexical import Sag2Options, sag2_lexical_service

router = APIRouter()


class AddDocumentRequest(BaseModel):
    """登记一个本地文档（原文不改动，只建词法索引）。"""

    path: str = Field(..., min_length=1, description="文档路径或标识")
    content: str = Field(..., min_length=1, description="文档正文")
    title: str | None = Field(None, description="标题(默认取路径末段)")
    heading: str = Field("", description="章节标题路径")
    chunk_size: int = Field(512, ge=64, le=4096)
    overlap: int = Field(80, ge=0, le=512)


class RemoveDocumentRequest(BaseModel):
    path: str = Field(..., min_length=1)


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    page: int = Field(1, ge=1)
    per_page: int = Field(20, ge=1, le=100)


class RetrieveRequest(BaseModel):
    query: str = Field(..., min_length=1)
    candidate_k: int = Field(100, ge=1, le=500)
    seed_k: int = Field(10, ge=1, le=100)
    expansion_term_limit: int = Field(8, ge=1, le=50)
    max_hops: int = Field(2, ge=0, le=2)
    top_k: int = Field(10, ge=1, le=100)
    file_limit: int | None = Field(None, ge=1, le=500)


class FuseRequest(BaseModel):
    sag2_results: list[dict[str, Any]] = Field(default_factory=list)
    rag_sources: list[dict[str, Any]] = Field(default_factory=list)
    k: int = Field(60, ge=1, le=1000)


def _ok(data: Any) -> dict[str, Any]:
    return {"code": 0, "message": "ok", "data": data}


@router.get("/status")
async def sag2_status() -> dict[str, Any]:
    """索引状态：版本 / 文档数 / 块数 / 词表大小 / 判定 provider。"""
    return _ok(sag2_lexical_service.status())


@router.post("/documents")
async def sag2_add_document(req: AddDocumentRequest) -> dict[str, Any]:
    """登记文档；hash 未变时跳过重建，建库过程零模型调用。"""
    return _ok(
        sag2_lexical_service.add_document(
            req.path,
            req.content,
            title=req.title,
            heading=req.heading,
            chunk_size=req.chunk_size,
            overlap=req.overlap,
        )
    )


@router.delete("/documents")
async def sag2_remove_document(req: RemoveDocumentRequest) -> dict[str, Any]:
    """移除索引登记（原文件不动）。"""
    return _ok(sag2_lexical_service.remove_document(req.path))


@router.post("/search")
async def sag2_search(req: SearchRequest) -> dict[str, Any]:
    """离线 BM25 快速搜索：零模型、按文件合并分页。"""
    return _ok(
        sag2_lexical_service.search(
            req.query, page=req.page, per_page=req.per_page
        )
    )


@router.post("/retrieve")
async def sag2_retrieve(req: RetrieveRequest) -> dict[str, Any]:
    """查询时多跳检索：返回 citations / trace / judge 自证 / paths 留痕。"""
    options = Sag2Options(
        candidate_k=req.candidate_k,
        seed_k=req.seed_k,
        expansion_term_limit=req.expansion_term_limit,
        max_hops=req.max_hops,
        top_k=req.top_k,
        file_limit=req.file_limit,
    )
    result = await sag2_lexical_service.retrieve(req.query, options)
    return _ok(result.to_dict())


@router.post("/fuse")
async def sag2_fuse(req: FuseRequest) -> dict[str, Any]:
    """把 SAG2 通道与既有 RAG 通道做 RRF 融合（三通道混合）。"""
    return _ok(
        {
            "results": sag2_lexical_service.fuse_with_rag(
                req.sag2_results, req.rag_sources, k=req.k
            ),
            "channels": ["sag2-lexical-multihop", "rag-vector-keyword"],
            "rrf_k": req.k,
        }
    )


# -- 本地文件夹登记 / 增量扫描（对照的「Add a local folder」） ----------------


class AddFolderRequest(BaseModel):
    """登记一个本地文件夹：文件留在原处，只建词法索引。"""

    root: str = Field(..., min_length=1, description="文件夹绝对路径")
    include: list[str] | None = Field(
        None, description="扩展名白名单（默认 md/txt/html/docx/xlsx/epub/pdf 等）"
    )
    exclude: list[str] | None = Field(None, description="路径子串排除项")
    recursive: bool = Field(True, description="是否递归子目录")
    scan: bool = Field(True, description="登记后立刻跑一轮增量扫描")
    watch: bool = Field(False, description="是否启动轮询 watcher（默认关）")
    watch_interval_s: float = Field(30.0, ge=5.0, le=3600.0)


class ScanFolderRequest(BaseModel):
    root: str | None = Field(None, description="只扫这个根；为空扫全部登记项")
    force: bool = Field(False, description="忽略 mtime/size 预筛，强制重读重算")


class WatchFolderRequest(BaseModel):
    root: str = Field(..., min_length=1)
    enabled: bool = True
    interval_s: float = Field(30.0, ge=5.0, le=3600.0)


@router.post("/folders")
async def sag2_add_folder(req: AddFolderRequest) -> dict[str, Any]:
    """登记本地文件夹；``scan=true`` 时立刻跑一轮增量扫描。

    扫描是同步 IO/CPU 活，放线程池里跑，不阻塞事件循环。
    """
    folders = sag2_lexical_service.folders
    registered = folders.register(
        req.root,
        include=req.include,
        exclude=req.exclude,
        recursive=req.recursive,
    )
    if not registered.get("registered"):
        return _ok({**registered, "scan": None})
    scan = await asyncio.to_thread(folders.scan, registered["folder"]["root"])
    watch = (
        folders.start_watch(registered["folder"]["root"], interval_s=req.watch_interval_s)
        if req.watch
        else None
    )
    return _ok({**registered, "scan": scan, "watch": watch})


@router.get("/folders")
async def sag2_list_folders() -> dict[str, Any]:
    """已登记的文件夹 + 各自最近一轮扫描读数 + watcher 状态。"""
    return _ok(sag2_lexical_service.folders.list_folders())


@router.post("/folders/scan")
async def sag2_scan_folders(req: ScanFolderRequest) -> dict[str, Any]:
    """幂等增量扫描：mtime/size 未变且索引 hash 一致的文件**不读盘**。"""
    return _ok(await asyncio.to_thread(sag2_lexical_service.folders.scan, req.root, force=req.force))


@router.delete("/folders")
async def sag2_remove_folder(root: str) -> dict[str, Any]:
    """注销登记，并把该根下已入索引的文档一并移除（不留孤儿片）。"""
    return _ok(sag2_lexical_service.folders.unregister(root))


@router.post("/folders/watch")
async def sag2_watch_folder(req: WatchFolderRequest) -> dict[str, Any]:
    """启停轮询 watcher（对照是常驻文件监听；本仓默认关闭，显式开启才跑）。"""
    if not req.enabled:
        return _ok(sag2_lexical_service.folders.stop_watch(req.root))
    return _ok(
        sag2_lexical_service.folders.start_watch(req.root, interval_s=req.interval_s)
    )
