# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""``/api/v1/ai/sag2/*`` — SAG2 词法多跳检索通道端点（本仓自有实现）。

能力对齐对照程序 SAG Wiki 的前后端：本地文件夹登记（零模型建库）、
离线快速搜索、跨文件多跳检索与可直达原文的引用、索引状态、
以及与本仓既有 ``rag.py`` 向量/关键词通道的 RRF 三通道融合。

本仓增量（对照没有、或形态不同）：跨语言术语桥（词典 + 语料括号对照）、
索引持久化（重启回灌）、路径筛选 + 片段高亮、可解释的桥接扩展预览。
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


class SearchFilters(BaseModel):
    """路径级筛选（与查询词同时生效，AND 语义）。"""

    ext: list[str] | None = Field(None, description="后缀白名单，如 ['.md','txt']")
    prefix: list[str] | None = Field(None, description="路径前缀白名单（任一命中）")
    contains: str | None = Field(None, description="路径包含该子串(大小写不敏感)")


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    page: int = Field(1, ge=1)
    per_page: int = Field(20, ge=1, le=100)
    filters: SearchFilters | None = Field(None, description="路径筛选")
    highlight: bool = Field(True, description="返回片段内的命中区间")


class RetrieveRequest(BaseModel):
    query: str = Field(..., min_length=1)
    candidate_k: int = Field(100, ge=1, le=500)
    seed_k: int = Field(10, ge=1, le=100)
    expansion_term_limit: int = Field(8, ge=1, le=50)
    max_hops: int = Field(2, ge=0, le=2)
    top_k: int = Field(10, ge=1, le=100)
    file_limit: int | None = Field(None, ge=1, le=500)
    cross_lingual: bool = Field(True, description="启用跨语言术语桥（词典+括号对照）")
    bridge_limit: int = Field(20, ge=0, le=100, description="桥接候选取多少条配额")


class FuseRequest(BaseModel):
    sag2_results: list[dict[str, Any]] = Field(default_factory=list)
    rag_sources: list[dict[str, Any]] = Field(default_factory=list)
    k: int = Field(60, ge=1, le=1000)


def _ok(data: Any) -> dict[str, Any]:
    return {"code": 0, "message": "ok", "data": data}


@router.get("/status")
async def sag2_status() -> dict[str, Any]:
    """索引状态：版本 / 文档数 / 块数 / 词表 / 判定 provider / 持久化 / 跨语言。

    首次调用会在**后台**触发持久化回灌（不阻塞本次响应）；
    恢复进度与结果经 ``restore`` 与 ``persistence`` 两段读出。
    """
    started = sag2_lexical_service.start_restore_background()
    data = sag2_lexical_service.status()
    data["restore_started"] = started
    return _ok(data)


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
    filters = req.filters.model_dump(exclude_none=True) if req.filters else None
    return _ok(
        sag2_lexical_service.search(
            req.query,
            page=req.page,
            per_page=req.per_page,
            filters=filters,
            highlight=req.highlight,
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
        cross_lingual=req.cross_lingual,
        bridge_limit=req.bridge_limit,
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


# -- 跨语言桥：可解释的扩展预览 ----------------------------------------------


class BridgeExpandRequest(BaseModel):
    query: str = Field(..., min_length=1)


@router.post("/bridge/expand")
async def sag2_bridge_expand(req: BridgeExpandRequest) -> dict[str, Any]:
    """预览「这句查询会扩展出哪些另一种写法的词」——跨语言可解释性的入口。

    只读、零模型：把词典与语料括号对照的判定过程直接摊开，
    用户能看出「中文问英文答」是靠哪条对照成立的，而不是黑箱。
    """
    from ...services.sag2_lexical.bridge import candidate_keys

    expanded = sag2_lexical_service.bridge.expand(
        req.query, sag2_lexical_service.index, limit=32
    )
    return _ok(
        {
            "query": req.query,
            "candidate_keys": candidate_keys(req.query),
            "expanded": [b.to_dict() for b in expanded],
            "count": len(expanded),
            "reason": "" if expanded else "查询词无可用的跨语言对照(词典与语料均无)",
        }
    )


@router.get("/cross-lingual")
async def sag2_cross_lingual() -> dict[str, Any]:
    """跨语言能力自证：词表规模、语料对照对数、当前索引上能否建桥。"""
    return _ok(sag2_lexical_service.bridge.status(sag2_lexical_service.index))


# -- 持久化：重启不空的自证与手动回灌 ----------------------------------------


@router.get("/persistence")
async def sag2_persistence() -> dict[str, Any]:
    """持久化状态 + **PG 侧与内存侧条数对账**（不一致就是不一致，不掩盖）。"""
    data = sag2_lexical_service.status()["persistence"]
    store = sag2_lexical_service.persistence
    if store is None:
        return _ok({**data, "pg": None, "aligned": False})
    pg = await store.stats()
    memory_docs = int(sag2_lexical_service.index.document_count())
    aligned = (
        "documents" in pg and int(pg["documents"]) == memory_docs
    )
    return _ok(
        {
            **data,
            "pg": pg,
            "memory_documents": memory_docs,
            "aligned": aligned,
            "reason": ""
            if aligned
            else "PG 与内存条数不一致:恢复未完成或有未落库的变更",
        }
    )


@router.post("/persistence/restore")
async def sag2_persistence_restore() -> dict[str, Any]:
    """手动触发回灌（幂等）。返回本次恢复的文档数与耗时。"""
    return _ok(await sag2_lexical_service.ensure_restored())


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
    watch: bool = Field(False, description="是否启动监听（默认关）")
    watch_real: bool = Field(True, description="优先用操作系统事件；不可用时退化为轮询")
    watch_interval_s: float = Field(30.0, ge=5.0, le=3600.0)


class ScanFolderRequest(BaseModel):
    root: str | None = Field(None, description="只扫这个根；为空扫全部登记项")
    force: bool = Field(False, description="忽略 mtime/size 预筛，强制重读重算")


class WatchFolderRequest(BaseModel):
    root: str = Field(..., min_length=1)
    enabled: bool = True
    real: bool = Field(True, description="优先用操作系统事件（ReadDirectoryChangesW / inotify）")
    debounce_ms: int = Field(600, ge=0, le=10000, description="事件抖动合并窗口")
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
        folders.start_watch(
            registered["folder"]["root"],
            interval_s=req.watch_interval_s,
            real=req.watch_real,
        )
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
    """启停监听。

    默认走操作系统事件（Windows ``ReadDirectoryChangesW`` / Linux ``inotify``），
    文件一变就在抖动窗口后触发一轮**增量**扫描；拿不到事件才退化为轮询，
    返回体里的 ``mode`` 是实际生效的模式，不修饰。
    """
    folders = sag2_lexical_service.folders
    if not req.enabled:
        return _ok(folders.stop_watch(req.root))
    return _ok(
        folders.start_watch(
            req.root,
            interval_s=req.interval_s,
            real=req.real,
            debounce_ms=req.debounce_ms,
        )
    )
