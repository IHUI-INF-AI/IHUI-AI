# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 词法通道·门面服务（本仓自有实现）。

对外提供四类能力，与对照程序的「索引 / 快速搜索 / 深度检索 / 状态」对齐：

- ``add_document`` / ``remove_document``：本地文件登记，hash 驱动增量，
  **建库零模型调用**；
- ``search``：本地 BM25 快速搜索，按文件合并分页，零模型；
- ``retrieve``：查询时多跳检索（BM25 粗筛 → 证据判断 → 扩展 → 再判断）；
- ``fuse_with_rag``：把本通道结果与既有 ``rag.py`` 的向量/关键词结果做
  RRF 融合 —— **对照不具备的三通道混合**，是「贴本仓架构」的超越轴。
"""

from __future__ import annotations

import hashlib
import os
import time
from collections.abc import Callable
from typing import Any

from .gateway_adapter import (
    LlmGatewayJudgeAdapter,
    get_last_resolve_reason,
    resolve_sag2_gateway,
)
from .index import LexicalIndex
from .judge import JUDGE_MODEL_ENV, attach_gateway, resolve_judge_from_settings
from .metrics import judge_metrics
from .retrieval import (
    Sag2Options,
    Sag2Result,
    retrieve,
)
from .store_factory import build_store_with_status, resolve_store_status

DEFAULT_RRF_K = 60


class Sag2LexicalService:
    """可被 API 层与既有 RAG 服务共用的门面。"""

    def __init__(
        self,
        index: Any | None = None,
        gateway: Any | None = None,
        judge_model: str | None = None,
        store_status: dict[str, Any] | None = None,
    ) -> None:
        self.index: Any = index or LexicalIndex()
        self.judge = resolve_judge_from_settings(gateway, judge_model)
        self._store_status = store_status

    # -- 索引 ---------------------------------------------------------------

    def add_document(
        self,
        path: str,
        content: str,
        *,
        title: str | None = None,
        heading: str = "",
        chunk_size: int = 512,
        overlap: int = 80,
    ) -> dict[str, Any]:
        outcome = self.index.add_document(
            path,
            content,
            title=title,
            heading=heading,
            chunk_size=chunk_size,
            overlap=overlap,
        )
        return {
            "changed": outcome.changed,
            "reason": outcome.reason,
            "doc_hash": outcome.doc_hash,
            "chunk_count": outcome.chunk_count,
            "version": outcome.version,
            "model_calls": 0,
        }

    def remove_document(self, path: str) -> dict[str, Any]:
        removed = self.index.remove_document(path)
        return {"removed": removed, "version": self.index.version}

    def status(self) -> dict[str, Any]:
        # 原有键逐字保留（含 index.status() 的 backend），仅新增降级自证字段。
        data: dict[str, Any] = dict(self.index.status())
        data["judge_provider"] = type(self.judge).__name__
        store_status = (
            self._store_status
            if self._store_status is not None
            else resolve_store_status(self.index)
        )
        data["effective_backend"] = str(store_status.get("effective_backend", "memory"))
        data["requested_backend"] = str(store_status.get("requested_backend", "memory"))
        data["degraded"] = bool(store_status.get("degraded", False))
        data["degrade_reason"] = str(store_status.get("degrade_reason", "") or "")
        snap = judge_metrics.snapshot()
        data["judge_metrics"] = snap
        data["judge_execution_rate"] = snap["judge_execution_rate"]
        data["judge_calls"] = snap["judge_calls"]
        data["judge_executed"] = snap["judge_executed"]
        data["judge_degraded"] = snap["judge_degraded"]
        data["judge_last_mode"] = snap["last_mode"]
        data["judge_last_reason"] = snap["last_reason"]
        data["judge_gateway_reason"] = get_last_resolve_reason()
        return data

    # -- 快速搜索（零模型） -------------------------------------------------

    def search(
        self,
        query: str,
        *,
        limit: int = 20,
        page: int = 1,
        per_page: int = 20,
    ) -> dict[str, Any]:
        """本地 BM25 快速搜索：按文件取最佳块后分页，不调用任何模型。

        对照的 Quick Search 同样离线可用、按文件合并展示 20 条/页。
        """
        started = time.perf_counter()
        from .text import match_query

        terms = match_query(query)
        hits = self.index.candidate_query(terms, max(limit * 4, per_page * 4))
        best_by_file: dict[str, Any] = {}
        for candidate in hits:
            if not self.index.hydrate(candidate):
                continue
            if candidate.path not in best_by_file:
                best_by_file[candidate.path] = candidate
        ordered = sorted(
            best_by_file.values(), key=lambda c: (-c.bm25, c.path)
        )
        start = max(0, (page - 1) * per_page)
        page_items = ordered[start : start + per_page]
        return {
            "query": query,
            "mode": "lexical-bm25",
            "model_calls": 0,
            "total_files": len(ordered),
            "page": page,
            "per_page": per_page,
            "items": [
                {
                    "path": c.path,
                    "title": c.chunk.title,
                    "snippet": c.content[:240],
                    "bm25": round(c.bm25, 6),
                    "citation": self.index.citation(c),
                }
                for c in page_items
            ],
            "duration_ms": round((time.perf_counter() - started) * 1000.0, 3),
        }

    # -- 深度多跳检索 -------------------------------------------------------

    async def retrieve(
        self,
        query: str,
        options: Sag2Options | None = None,
        *,
        cancel: Callable[[], bool] | None = None,
    ) -> Sag2Result:
        return await retrieve(
            self.index, query, self.judge, options, cancel=cancel
        )

    # -- 与既有 RAG 融合（超越轴） -----------------------------------------

    @staticmethod
    def fuse_with_rag(
        sag2_results: list[dict[str, Any]],
        rag_sources: list[dict[str, Any]],
        *,
        k: int = DEFAULT_RRF_K,
    ) -> list[dict[str, Any]]:
        """RRF 融合：SAG2 词法多跳通道 + 既有向量/关键词通道。

        对照是单一 SQLite 词法通道；本仓已有 ``rag.py`` 的双路 RRF，
        这里把两路按名次再融合一次，形成三通道混合，且保留来源标注，
        让调用方能自证每条结果的名次来自哪条通道。
        """
        scores: dict[str, float] = {}
        meta: dict[str, dict[str, Any]] = {}
        channels: dict[str, set[str]] = {}

        def add(key: str, rank: int, item: dict[str, Any], channel: str) -> None:
            scores[key] = scores.get(key, 0.0) + 1.0 / (k + rank + 1)
            meta.setdefault(key, dict(item))
            channels.setdefault(key, set()).add(channel)

        for rank, item in enumerate(sag2_results):
            key = "sag2:" + str(item.get("key", item.get("path", rank)))
            add(key, rank, item, "sag2-lexical-multihop")
        for rank, item in enumerate(rag_sources):
            content = str(item.get("content", ""))
            digest = hashlib.sha256(content[:200].encode("utf-8")).hexdigest()[:16]
            add("rag:" + digest, rank, item, "rag-vector-keyword")

        fused = []
        for key in sorted(scores, key=lambda item: (-scores[item], item)):
            row = dict(meta[key])
            row["rrf_score"] = round(scores[key], 8)
            row["fused_from"] = "+".join(sorted(channels[key]))
            fused.append(row)
        return fused


def _build_default_service() -> Sag2LexicalService:
    """零环境变量 ⇒ 纯内存单例；环境变量/降级态经工厂产物带入 status()。"""
    store, store_status = build_store_with_status()
    service = Sag2LexicalService(index=store, store_status=store_status)
    gateway = resolve_sag2_gateway()
    if gateway is not None:
        attach_gateway(
            service,
            LlmGatewayJudgeAdapter(gateway),
            model=os.environ.get(JUDGE_MODEL_ENV) or None,
        )
    return service


sag2_lexical_service = _build_default_service()
