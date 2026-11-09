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

# -- 自适应门控融合：查询侧可解释信号与权重边界 ---------------------------
# 为什么这些信号能区分「单跳 / 多跳」查询（全部取自查询侧，不看 ground truth、
# 不按答案调权重、也不写死「某类语料加权」）：
# · overlap（通道重合度，主信号）：单跳查询里查询词元直接出现在答案文档中，
#   SAG2 词法腿与 RAG 向量/关键词腿会各自把同一批答案文档排到前列，两通道
#   top-K 文档集合高度重合；多跳查询里答案文档不含查询词元，只有 SAG2 的
#   「扩展轮」沿桥接文档才能到达，RAG 单跳腿没有扩展能力、只能返回字面/语义
#   相近的噪声文档，两通道集合几乎不重合。overlap 低是「RAG 腿对答案无贡献、
#   其 RRF 分数只会挤占 SAG2 多跳答案前列名次」的可解释证据。
# · expansion_ratio（扩展是否引入新文档）：SAG2 结果里 hop>=1 的文档占比，
#   直接度量本查询是否依赖扩展轮；多跳显著为正，单跳近零。
# · sag2_top_gap（单跳候选 top1/top2 分数落差）：单跳常有一个 BM25 明显主导
#   的文档、落差大；多跳经扩展后前列分数较平、落差小。
# 三者加权成 multihop_signal∈[0,1]；两腿权重是它的连续线性函数。
_FUSION_W_MAX = 1.6   # 单跳/两腿一致：放大 RAG 腿（一致性 boost）
_FUSION_W_MIN = 0.15  # 多跳/两腿分歧：压低 RAG 腿，保护 SAG2 多跳排序
_FUSION_SIGNAL_W = (0.7, 0.15, 0.15)  # overlap / expansion / gap


def _fusion_doc_id(item: dict[str, Any]) -> str:
    """跨通道统一的文档标识：既是重合度口径，也是融合去重键。

    优先 ``path`` 而非 ``key``：SAG2 腿的 ``key`` 是 chunk 级锚点（同一文档
    可分块多次出现），RAG 腿通常只有 ``path``/``content``。若各腿用自己的
    命名空间建键，同一文档会在融合列表里占两个名次 —— 端到端真检索实测中
    多跳答案因此被重复名额挤出 top10（recall 1.0 -> 0.9375）。统一按文档
    去重后，两腿对同一文档的 RRF 贡献相加、只占一个位置，``fused_from``
    也能如实标出双通道命中。
    """
    for field in ("path", "key"):
        value = item.get(field)
        if value is not None and str(value) != "":
            return "id:" + str(value)
    content = str(item.get("content", ""))
    digest = hashlib.sha256(content[:200].encode("utf-8")).hexdigest()[:16]
    return "id:" + digest


def _fusion_item_score(item: dict[str, Any], rank: int, k: int) -> float:
    """通道给该文档的相关性分数；调用方未给 score 时退回名次置信度。"""
    raw = item.get("score")
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        return float(raw)
    return 1.0 / (k + rank + 1)


def _adaptive_fusion_signals(
    sag2_results: list[dict[str, Any]],
    rag_sources: list[dict[str, Any]],
    k: int,
) -> dict[str, Any]:
    """从两腿召回列表提取查询侧可解释信号，输出连续权重（不接触 ground truth）。"""
    depth = min(len(sag2_results), len(rag_sources), 10)
    if depth > 0:
        s_ids = {
            _fusion_doc_id(item)
            for item in sag2_results[:depth]
        }
        r_ids = {
            _fusion_doc_id(item)
            for item in rag_sources[:depth]
        }
        union = s_ids | r_ids
        overlap = len(s_ids & r_ids) / len(union) if union else 0.0
    else:
        overlap = 0.0

    if sag2_results:
        expanded = sum(
            1
            for item in sag2_results
            if isinstance(item.get("hop"), (int, float))
            and not isinstance(item.get("hop"), bool)
            and item["hop"] >= 1
        )
        expansion_ratio = expanded / len(sag2_results)
    else:
        expansion_ratio = 0.0

    if len(sag2_results) >= 2:
        s0 = _fusion_item_score(sag2_results[0], 0, k)
        s1 = _fusion_item_score(sag2_results[1], 1, k)
        sag2_top_gap = min(1.0, max(0.0, (s0 - s1) / max(s0, 1e-9)))
    else:
        sag2_top_gap = 0.5

    w_overlap, w_exp, w_gap = _FUSION_SIGNAL_W
    signal = (
        w_overlap * (1.0 - overlap)
        + w_exp * expansion_ratio
        + w_gap * (1.0 - sag2_top_gap)
    )
    signal = min(1.0, max(0.0, signal))
    w_rag = _FUSION_W_MAX - (_FUSION_W_MAX - _FUSION_W_MIN) * signal
    return {
        "overlap": round(overlap, 6),
        "expansion_ratio": round(expansion_ratio, 6),
        "sag2_top_gap": round(sag2_top_gap, 6),
        "multihop_signal": round(signal, 6),
        "weights": {
            "sag2-lexical-multihop": 1.0,
            "rag-vector-keyword": round(w_rag, 6),
        },
    }


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
        self._folders: Any | None = None

    # -- 文件夹登记 / 增量扫描（懒加载，避免与 folder_ingest 循环导入） --------

    @property
    def folders(self) -> Any:
        if self._folders is None:
            from .folder_ingest import FolderIngest

            self._folders = FolderIngest(self)
        return self._folders

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
        strategy: str = "adaptive",
    ) -> list[dict[str, Any]]:
        """三通道融合：SAG2 词法多跳腿 + 既有向量/关键词腿。

        默认 ``strategy="adaptive"`` 为**最优策略**：用查询侧可解释信号
        （见 ``_adaptive_fusion_signals`` 注释）在线估计「本查询是单跳还是
        多跳」，据此对两腿的 RRF 贡献加权 —— 多跳查询里压低对答案无贡献的
        RAG 腿、保护 SAG2 多跳排序；单跳查询里放大两腿一致的 RAG 排序。
        ``strategy="rrf"`` 逐字保留上一轮的等权 RRF 行为，供对照 / 回滚。

        返回行保留 ``rrf_score`` / ``fused_from``（既有调用方不破），并新增
        ``fusion_strategy`` / ``fusion_weights`` / ``fusion_signals`` 自证字段，
        使每条结果的权重与门控依据可审计。
        """
        if strategy == "adaptive":
            signals = _adaptive_fusion_signals(sag2_results, rag_sources, k)
            weights = signals["weights"]
        else:
            signals = None
            weights = {
                "sag2-lexical-multihop": 1.0,
                "rag-vector-keyword": 1.0,
            }
        w_sag2 = weights["sag2-lexical-multihop"]
        w_rag = weights["rag-vector-keyword"]

        scores: dict[str, float] = {}
        meta: dict[str, dict[str, Any]] = {}
        channels: dict[str, set[str]] = {}

        def add(key: str, rank: int, item: dict[str, Any], channel: str) -> None:
            weight = w_sag2 if channel == "sag2-lexical-multihop" else w_rag
            scores[key] = scores.get(key, 0.0) + weight / (k + rank + 1)
            meta.setdefault(key, dict(item))
            channels.setdefault(key, set()).add(channel)

        # adaptive 用文档级统一键：同一文档只占一个名次、两腿 RRF 贡献相加，
        # 避免按通道建键时重复占位；strategy="rrf" 逐字保留旧命名空间语义，
        # 供对照与回滚（既有回归测试断言它与独立等权基线逐项等价）。
        unified = strategy == "adaptive"
        for rank, item in enumerate(sag2_results):
            key = (
                _fusion_doc_id(item)
                if unified
                else "sag2:" + str(item.get("key", item.get("path", rank)))
            )
            add(key, rank, item, "sag2-lexical-multihop")
        for rank, item in enumerate(rag_sources):
            if unified:
                key = _fusion_doc_id(item)
            else:
                content = str(item.get("content", ""))
                digest = hashlib.sha256(content[:200].encode("utf-8")).hexdigest()[:16]
                key = "rag:" + digest
            add(key, rank, item, "rag-vector-keyword")

        fused = []
        for key in sorted(scores, key=lambda item: (-scores[item], item)):
            row = dict(meta[key])
            row["rrf_score"] = round(scores[key], 8)
            row["fused_from"] = "+".join(sorted(channels[key]))
            row["fusion_strategy"] = (
                "adaptive-gated-weighted-rrf" if signals is not None
                else "equal-weight-rrf"
            )
            row["fusion_weights"] = dict(weights)
            if signals is not None:
                row["fusion_signals"] = {
                    name: signals[name]
                    for name in (
                        "overlap", "expansion_ratio", "sag2_top_gap",
                        "multihop_signal",
                    )
                }
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
