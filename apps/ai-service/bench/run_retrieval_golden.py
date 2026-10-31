# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# Apache-2.0 须保留本声明与 NOTICE。
"""金标检索分档评测 runner(2026-11-01 立,goal-b46 R-golden-baseline)。

对 ``bench/fixtures_golden/golden_retrieval_kb.jsonl``(264 条 KB 问答)按档跑检索,
产出可 diff 的指标基线件。六项指标一律 import ``app.services.retrieval_eval``
(AGENTS §0.6 单一真相源 —— 本文件**不重写任何指标公式**)。

三档,与对照侧 Qoder 的五档阶梯对齐(见
``docs/benchmark-evidence/2026-11/*/T9-qoder-search-engine.md``);跑不动的档如实
``unjudged`` 并点名缺的第一个输入,不假装全都能跑:

- ``text_only``(默认):**完全离线** —— 零连库、零模型调用、零网络。语料取仓根 ``docs/`` 下
  4 篇金标源文档(见 ``CORPUS_DOCS``),切块走「叶子块打分 + 父块返回」(对齐金标的父块 ID 契约),
  打分器是本文件内的 BM25(k1/b 写死、可复算)。
- ``vector_only``:显式 ``--mode`` 才跑。向量腿复用本仓既有的零网络确定性向量
  ``app.core.llm_gateway.LLMGateway.embed_local_fallback``(char-trigram 哈希投影,
  **不是**神经向量,读数不得当在线质量看)。
- ``hybrid``:两路叶子排名经本仓真融合腿 ``app.services.reranker.rrf_fuse`` 合并,
  不在这里再造第二份 RRF。两臂任一 import 不到 ⇒ 该档 ``unjudged`` 并点名缺失。

两条判读轨(关键设计,不可混读):

- ``id_native``:相关集 = 金标自带 ``expected_chunk_ids``。该 id 是外部 kb-rag 骨架产出的
  不透明 16 位十六进制;仓内既无 manifest,也不是这 4 篇文档文本的可复算哈希(现读:
  5 种切块 × 4 种摘要 × 11608 个候选哈希,命中 0)。⇒ 只要 runner 产出的 id 命名空间与
  金标命名空间**实测无交集**,本题逐条判 ``unjudged``(reason ``id_namespace_mismatch``),
  **绝不凑映射刷分**;哪天仓内真落了同 id 的索引,这一轨自动点亮(判据现算,不写死)。
- ``evidence_span``:相关块由内容锚点现推 —— 金标 ``ground_truth_answer`` 在语料里实际
  落进哪一块。它量的是「检索器能不能把含金标答案的那一块捞进 top-k」,是比 ``id_native``
  弱一档的断言,报告里两轨分开呈现。

逐段打点(对齐对侧「七段流水线逐段打点」):corpus_load → chunk_build → index_build →
retrieve → id_namespace_reconcile → judge。

退出码:0 = 至少一轨出数;2 = 未判定(金标取不到 / 本轮没有任何一轨判得动);
1 = 输入面错误(参数非法、金标校验未过、语料为空)。
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

AI_ROOT = Path(__file__).resolve().parents[1]  # apps/ai-service(import 与金标用)
REPO_ROOT = Path(__file__).resolve().parents[3]  # 仓根(CORPUS_DOCS 的 docs/ 相对这里)
if str(AI_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_ROOT))

from app.services.retrieval_eval import (  # noqa: E402  (必须先立 sys.path 才 import 得到本包)
    GoldenItem,
    context_precision,
    hit_rate_at_k,
    mrr,
    ndcg_at_k,
    precision_at_k,
    recall_at_k,
    validate_golden_set,
)

GOLDEN_PATH = AI_ROOT / "bench" / "fixtures_golden" / "golden_retrieval_kb.jsonl"
MANIFEST_PATH = AI_ROOT / "bench" / "fixtures_golden" / "golden_retrieval_kb.chunk-manifest.json"
REPORTS_DIR = AI_ROOT / "bench" / "reports"

# 金标 source_doc_id → 仓内语料实文件(现读:4 篇覆盖全部 264 题)
CORPUS_DOCS: dict[str, str] = {
    "faq": "docs/FAQ.md",
    "architecture": "docs/architecture.md",
    "enterprise-deploy": "docs/enterprise-service/deployment-guide.md",
    "blog-rag-pgvector": "docs/blog/04-rag-knowledge-base-pgvector.md",
}
MODES: tuple[str, ...] = ("text_only", "vector_only", "hybrid")
TRACKS: tuple[str, ...] = ("id_native", "evidence_span")
DEFAULT_KS: tuple[int, ...] = (1, 3, 5, 10)
METRIC_ORDER = (
    "recall_at_k",
    "precision_at_k",
    "mrr",
    "ndcg_at_k",
    "hit_rate_at_k",
    "context_precision",
)
BM25_K1 = 1.5
BM25_B = 0.75
RRF_K = 60
LEAF_POOL = 50

_CJK_RE = re.compile(r"[㐀-䶿一-鿿豈-﫿]")
_LATIN_RE = re.compile(r"[a-z0-9]+")
_SENT_SPLIT_RE = re.compile(r"[。；;.\n]")
_MD_LINK_RE = re.compile(r"\[([^\]]*)\]\([^)]*\)")


class InputError(RuntimeError):
    """输入面错误(参数不合法 / 金标读不到 / 语料为空)—— 与「未判定」分开计。"""


class MissingInput(RuntimeError):
    """该档跑不动:缺什么输入点名到具体。"""


@dataclass
class Leaf:
    """叶子块 = 实际打分单位;父块 = 返回单位(对齐金标「expected_chunk_ids 用父块 ID」)。"""

    leaf_id: str
    parent_id: str
    doc_id: str
    heading: str
    text: str
    tokens: list[str] = field(default_factory=list)


@dataclass
class Corpus:
    parents: dict[str, str] = field(default_factory=dict)
    leaves: list[Leaf] = field(default_factory=list)
    by_doc: dict[str, int] = field(default_factory=dict)
    parents_by_doc: dict[str, list[str]] = field(default_factory=dict)
    missing_docs: list[str] = field(default_factory=list)
    avg_len: float = 0.0
    df: dict[str, int] = field(default_factory=dict)
    leaf_parent: dict[str, str] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# 切块与分词
# ---------------------------------------------------------------------------


def heading_sections(text: str, level: int) -> list[tuple[str, str]]:
    """按指定标题层级切段,返回 (标题, 含标题行的正文)。首个标题前的前言也算一段。"""
    pat = re.compile(rf"^{'#' * level}\s+(.*?)\s*$", re.M)
    marks = [(m.start(), m.group(1)) for m in pat.finditer(text)]
    if not marks:
        return [("", text)]
    out: list[tuple[str, str]] = []
    preface = text[: marks[0][0]].strip()
    if preface:
        out.append(("", preface))
    for i, (start, title) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        out.append((title, text[start:end].strip()))
    return out


def tokenize(text: str) -> list[str]:
    """中英混合分词:拉丁/数字按词,CJK 取 unigram + bigram(零依赖、确定性)。"""
    low = text.lower()
    toks = _LATIN_RE.findall(low)
    han = "".join(ch for ch in low if _CJK_RE.match(ch))
    toks.extend(list(han))
    toks.extend(han[i : i + 2] for i in range(len(han) - 1))
    return [t for t in toks if t]


def build_corpus() -> Corpus:
    """读 CORPUS_DOCS 四篇:二级标题做父块,三级标题做叶子块。"""
    cor = Corpus()
    for doc_id, rel in CORPUS_DOCS.items():
        path = REPO_ROOT / rel
        if not path.is_file():
            cor.missing_docs.append(rel)
            continue
        text = path.read_text(encoding="utf-8")
        n_before = len(cor.leaves)
        for p_idx, (p_title, p_body) in enumerate(heading_sections(text, 2)):
            parent_id = f"{doc_id}#p{p_idx:02d}"
            cor.parents[parent_id] = p_title
            for l_idx, (l_title, l_body) in enumerate(heading_sections(p_body, 3)):
                body = l_body if l_title else p_body
                if not body.strip():
                    continue
                if parent_id not in cor.parents_by_doc.setdefault(doc_id, []):
                    cor.parents_by_doc[doc_id].append(parent_id)
                cor.leaves.append(
                    Leaf(
                        leaf_id=f"{parent_id}.l{l_idx:02d}",
                        parent_id=parent_id,
                        doc_id=doc_id,
                        heading=l_title or p_title,
                        text=body,
                        tokens=tokenize(f"{l_title or p_title}\n{body}"),
                    )
                )
        cor.by_doc[doc_id] = len(cor.leaves) - n_before
    if not cor.leaves:
        raise InputError("语料为空:4 篇金标源文档一篇都没读到(核 CORPUS_DOCS 路径)")
    cor.avg_len = sum(len(lf.tokens) for lf in cor.leaves) / len(cor.leaves)
    df: Counter[str] = Counter()
    for lf in cor.leaves:
        df.update(set(lf.tokens))
    cor.df = dict(df)
    cor.leaf_parent = {lf.leaf_id: lf.parent_id for lf in cor.leaves}
    return cor


# ---------------------------------------------------------------------------
# 三条检索腿
# ---------------------------------------------------------------------------


def _bm25_scores(query: str, cor: Corpus) -> list[tuple[float, int, str]]:
    q = tokenize(query)
    n = len(cor.leaves)
    scored: list[tuple[float, int, str]] = []
    for idx, lf in enumerate(cor.leaves):
        tf: Counter[str] = Counter(lf.tokens)
        norm = BM25_K1 * (1 - BM25_B + BM25_B * len(lf.tokens) / max(cor.avg_len, 1.0))
        s = 0.0
        for t in q:
            f = tf.get(t, 0)
            if not f:
                continue
            dft = cor.df.get(t, 0)
            idf = math.log(1.0 + (n - dft + 0.5) / (dft + 0.5))
            s += idf * (f * (BM25_K1 + 1)) / (f + norm)
        scored.append((s, idx, lf.leaf_id))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return scored


def _top_parents(ranked: list[tuple[float, int, str]], cor: Corpus, limit: int) -> list[str]:
    """叶子名次 → 父块名次(去重保最优首现),只留有正分的命中。"""
    out: list[str] = []
    seen: set[str] = set()
    for s, _, leaf in ranked:
        if s <= 0.0:
            continue
        parent = cor.leaf_parent[leaf]
        if parent in seen:
            continue
        seen.add(parent)
        out.append(parent)
        if len(out) >= limit:
            break
    return out


def _leaf_ids(ranked: list[tuple[float, int, str]], limit: int, keep_zero: bool = False) -> list[str]:
    out: list[str] = []
    for s, _, leaf in ranked:
        if s <= 0.0 and not keep_zero:
            continue
        out.append(leaf)
        if len(out) >= limit:
            break
    return out


def _embed(text: str) -> list[float]:
    """本仓零网络确定性向量(哈希投影,非神经向量)。import 不到 ⇒ MissingInput。"""
    try:
        from app.core.llm_gateway import llm_gateway
    except Exception as e:
        raise MissingInput(f"向量腿 import 失败({type(e).__name__}: {str(e)[:120]})") from e
    return llm_gateway.embed_local_fallback(text)


def _leaf_vector(lf: Leaf) -> list[float]:
    """叶子向量缓存:同一块只 embed 一次(264 题 × 250 块 ⇒ 否则 6.6 万次重复哈希)。"""
    cached = _LEAF_VEC_CACHE.get(lf.leaf_id)
    if cached is None:
        cached = _embed(lf.text)
        _LEAF_VEC_CACHE[lf.leaf_id] = cached
    return cached


def _vector_scores(query: str, cor: Corpus) -> list[tuple[float, int, str]]:
    qv = _embed(query)
    scored: list[tuple[float, int, str]] = []
    for idx, lf in enumerate(cor.leaves):
        v = _leaf_vector(lf)
        scored.append((sum(a * b for a, b in zip(qv, v, strict=False)), idx, lf.leaf_id))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return scored


def rank_text_only(query: str, cor: Corpus, limit: int) -> list[str]:
    return _top_parents(_bm25_scores(query, cor), cor, limit)


def rank_vector_only(query: str, cor: Corpus, limit: int) -> list[str]:
    return _top_parents(_vector_scores(query, cor), cor, limit)


def rank_hybrid(query: str, cor: Corpus, limit: int) -> list[str]:
    """两路叶子排名交本仓真 RRF 腿(reranker.rrf_fuse),不重写融合公式。"""
    try:
        from app.services.reranker import rrf_fuse
    except Exception as e:
        raise MissingInput(f"hybrid 腿 import 失败({type(e).__name__}: {str(e)[:120]})") from e
    kw = _leaf_ids(_bm25_scores(query, cor), LEAF_POOL)
    vec = _leaf_ids(_vector_scores(query, cor), LEAF_POOL, keep_zero=True)
    fused = rrf_fuse([kw, vec], k=RRF_K, labels=["keyword", "vector"], key_fn=lambda x: str(x))
    out: list[str] = []
    seen: set[str] = set()
    for f in fused:
        leaf = str(f.item)
        parent = cor.leaf_parent.get(leaf, leaf)
        if parent in seen:
            continue
        seen.add(parent)
        out.append(parent)
        if len(out) >= limit:
            break
    return out


RANKERS = {
    "text_only": rank_text_only,
    "vector_only": rank_vector_only,
    "hybrid": rank_hybrid,
}


# ---------------------------------------------------------------------------
# 判读
# ---------------------------------------------------------------------------


def norm_for_anchor(s: str) -> str:
    """去 markdown 装饰 / 空白 / 链接语法,供内容锚点比对(只服务 evidence_span 轨)。"""
    return re.sub(r"[`*_>#|~\s]", "", _MD_LINK_RE.sub(r"\1", s)).lower()


_ANSWER_NORM_CACHE: dict[str, str] = {}
_LEAF_VEC_CACHE: dict[str, list[float]] = {}


def _leaf_norm(lf: Leaf) -> str:
    cached = _ANSWER_NORM_CACHE.get(lf.leaf_id)
    if cached is None:
        cached = norm_for_anchor(lf.text)
        _ANSWER_NORM_CACHE[lf.leaf_id] = cached
    return cached


def evidence_relevant_ids(answer: str, cor: Corpus) -> tuple[list[str], str]:
    """金标答案落在哪一块 ⇒ 相关父块集;返回 (ids, 匹配形态)。"""
    na = norm_for_anchor(answer)
    if not na:
        return [], "answer_empty"
    matched = [lf for lf in cor.leaves if na in _leaf_norm(lf)]
    kind = "full_answer"
    if not matched:
        first = next((p for p in _SENT_SPLIT_RE.split(answer.strip()) if len(norm_for_anchor(p)) >= 8), "")
        nf = norm_for_anchor(first)
        matched = [lf for lf in cor.leaves if nf in _leaf_norm(lf)] if nf else []
        kind = "first_sentence"
    if not matched:
        return [], "evidence_span_not_located"
    out: list[str] = []
    for lf in matched:
        if lf.parent_id not in out:
            out.append(lf.parent_id)
    return out, kind


def metrics_at(retrieved: list[str], relevant: list[str], ks: list[int]) -> dict[str, dict[str, float]]:
    """逐 k 算六项指标 —— 全部走 retrieval_eval 的单源实现。"""
    res: dict[str, dict[str, float]] = {}
    for k in ks:
        res[f"k{k}"] = {
            "recall_at_k": recall_at_k(retrieved, relevant, k),
            "precision_at_k": precision_at_k(retrieved, relevant, k),
            "mrr": mrr(retrieved, relevant),
            "ndcg_at_k": ndcg_at_k(retrieved, relevant, k),
            "hit_rate_at_k": hit_rate_at_k(retrieved, relevant, k),
            "context_precision": context_precision(retrieved, relevant),
        }
    return res


def current_sha() -> str | None:
    """取 HEAD sha。派生纪律(AGENTS §12g 的 Python 等价物):显式 stdio + 不弹控制台窗口。

    注:`windowsHide` 是 Node `child_process.spawn` 的参数名,CPython 3.12 的
    ``subprocess.Popen`` **没有**这个形参(现读签名),Python 侧的等价写法是
    ``creationflags=CREATE_NO_WINDOW``;写成 windowsHide 会当场 TypeError。
    """
    kwargs: dict[str, Any] = {
        "stdin": subprocess.DEVNULL,
        "capture_output": True,
        "text": True,
        "timeout": 10,
    }
    if os.name == "nt":
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
    try:
        r = subprocess.run(["git", "-C", str(REPO_ROOT), "rev-parse", "HEAD"], **kwargs)
    except Exception as e:  # 取不到不冒充:如实 None,由报告写出「HEAD 未取到」
        print(f"WARN: git rev-parse failed: {type(e).__name__}: {e}")
        return None
    return r.stdout.strip() or None if r.returncode == 0 else None


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------


def run_mode(mode: str, items: list[GoldenItem], cor: Corpus, ks: list[int], top_k: int) -> dict[str, Any]:
    """一个档:逐段打点 + 两轨判读。"""
    t0 = time.perf_counter()
    stages: list[dict[str, Any]] = [
        {"stage": "corpus_load", "status": "ok", "docs_missing": len(cor.missing_docs), "chars": 0},
        {
            "stage": "chunk_build",
            "status": "ok",
            "parents": len(cor.parents),
            "leaves": len(cor.leaves),
            "avg_leaf_tokens": round(cor.avg_len, 2),
        },
        {
            "stage": "index_build",
            "status": "ok",
            "distinct_terms": len(cor.df),
            "elapsed_ms": round((time.perf_counter() - t0) * 1000, 1),
        },
    ]
    ranker = RANKERS[mode]
    t1 = time.perf_counter()
    try:
        retrievals = {it.question_id: ranker(it.question, cor, top_k) for it in items}
    except MissingInput as e:
        stages.append(
            {"stage": "retrieve", "status": "unjudged", "reason": str(e)[:200]}
        )
        return {
            "mode": mode,
            "status": "unjudged",
            "missing_inputs": [str(e)[:200]],
            "stages": stages,
            "tracks": {},
            "per_item": [],
        }
    empty = sum(1 for v in retrievals.values() if not v)
    stages.append(
        {
            "stage": "retrieve",
            "status": "ok",
            "items": len(retrievals),
            "zero_result_items": empty,
            "elapsed_ms": round((time.perf_counter() - t1) * 1000, 1),
        }
    )

    golden_universe = {cid for it in items for cid in it.expected_chunk_ids}
    retrieved_universe = {rid for v in retrievals.values() for rid in v}
    reconciled = bool(golden_universe & retrieved_universe)
    stages.append(
        {
            "stage": "id_namespace_reconcile",
            "status": "ok" if reconciled else "unjudged",
            "intersection": len(golden_universe & retrieved_universe),
            "golden_distinct_ids": len(golden_universe),
            "runner_distinct_ids": len(retrieved_universe),
            "golden_id_samples": sorted(golden_universe)[:3],
            "runner_id_samples": sorted(retrieved_universe)[:3],
        }
    )

    per_item: list[dict[str, Any]] = []
    acc: dict[str, dict[str, list[float]]] = {tr: {} for tr in TRACKS}
    oracle: dict[str, list[float]] = {}
    unjudged: dict[str, Counter[str]] = {tr: Counter() for tr in TRACKS}
    # 未判定样本:每因最多点 5 题,让下一张票能顺着 question_id 追到具体条目
    examples: dict[str, dict[str, list[str]]] = {tr: {} for tr in TRACKS}
    for it in items:
        retrieved = retrievals[it.question_id]
        rec: dict[str, Any] = {
            "question_id": it.question_id,
            "source_doc_id": it.source_doc_id,
            "difficulty": it.difficulty,
            "retrieved_ids": retrieved,
            "tracks": {},
        }
        if reconciled:
            m = metrics_at(retrieved, it.expected_chunk_ids, ks)
            rec["tracks"]["id_native"] = {"judged": True, "relevant_ids": it.expected_chunk_ids, "metrics": m}
            _accumulate(acc["id_native"], m)
        else:
            rec["tracks"]["id_native"] = {
                "judged": False,
                "reason": "id_namespace_mismatch",
                "expected_ids": it.expected_chunk_ids,
            }
            unjudged["id_native"]["id_namespace_mismatch"] += 1
            _note_example(examples["id_native"], "id_namespace_mismatch", it.question_id)
        rel, kind = evidence_relevant_ids(it.ground_truth_answer, cor)
        if not rel:
            rec["tracks"]["evidence_span"] = {"judged": False, "reason": kind}
            unjudged["evidence_span"][kind] += 1
            _note_example(examples["evidence_span"], kind, it.question_id)
        else:
            m = metrics_at(retrieved, rel, ks)
            rec["tracks"]["evidence_span"] = {
                "judged": True,
                "relevant_ids": rel,
                "match_kind": kind,
                "metrics": m,
            }
            _accumulate(acc["evidence_span"], m)
            oracle_list = cor.parents_by_doc.get(it.source_doc_id, [])
            _accumulate(oracle, metrics_at(oracle_list, rel, ks))
        per_item.append(rec)
    stages.append({"stage": "judge", "status": "ok", "items": len(per_item)})

    tracks_out: dict[str, Any] = {}
    for tr in TRACKS:
        judged = sum(1 for p in per_item if p["tracks"][tr]["judged"])
        entry: dict[str, Any] = {
            "judged_items": judged,
            "unjudged_items": len(per_item) - judged,
            "unjudged_reasons": dict(unjudged[tr]),
            "unjudged_examples": {k: sorted(v) for k, v in sorted(examples[tr].items())},
            "match_kinds": dict(Counter(str(p["tracks"][tr].get("match_kind", "")) for p in per_item)),
            "aggregates": {key: round(sum(v) / len(v), 6) for key, v in sorted(acc[tr].items())},
        }
        if tr == "evidence_span" and oracle:
            # 参照系:把「同一篇文档的全部父块按原文顺序」当检索结果算同一批指标。
            # 读数只有与它对拍才有意义 —— BM25 若赢不了"整篇文档",说明关键词腿没加信息。
            entry["reference_oracle_whole_doc"] = {
                key: round(sum(v) / len(v), 6) for key, v in sorted(oracle.items())
            }
        tracks_out[tr] = entry
    return {
        "mode": mode,
        "status": "ok",
        "missing_inputs": [],
        "stages": stages,
        "id_native_reconciled": reconciled,
        "tracks": tracks_out,
        "per_item": per_item,
    }


def _note_example(bucket: dict[str, list[str]], reason: str, qid: str) -> None:
    bucket.setdefault(reason, [])
    if len(bucket[reason]) < 5:
        bucket[reason].append(qid)


def _accumulate(bucket: dict[str, list[float]], m: dict[str, dict[str, float]]) -> None:
    for kk, mv in m.items():
        for name, val in mv.items():
            bucket.setdefault(f"{kk}.{name}", []).append(val)


def render_md(report: dict[str, Any]) -> str:
    """人读报告(中文只写文件,不走 stdout —— 本机 GBK 码页会打挂 print)。"""
    g, c = report["golden"], report["corpus"]
    L: list[str] = [
        f"# 金标检索召回基线 {report['date']}",
        "",
        f"- 生成时刻:{report['generated_at']} · HEAD:`{report['head_sha']}`",
        f"- 金标:{g['path']} —— {g['total_lines']} 条(本轮用 {g['items_used']} 条),"
        f"`expected_chunk_ids` 去重后 {g['expected_ids_distinct']} 个;"
        f"仓内 chunk manifest:{'存在' if g['manifest_present'] else '不存在'}",
        f"- 语料(仓内实文件;父块 {c['parents']} / 叶子块 {c['leaves']} / 叶子均 {c['avg_leaf_tokens']} 词):",
    ]
    for d, v in c["docs"].items():
        L.append(f"  - `{d}` → `{v['path']}`({v['leaves']} 叶)")
    if c["missing_docs"]:
        L.append(f"  - **缺失**:{', '.join(c['missing_docs'])}")
    p = report["params"]
    L += [
        f"- 参数:k={p['ks']} · top_k={p['top_k']} · BM25 k1={p['bm25']['k1']} b={p['bm25']['b']}",
        "",
        "## 复跑(一条命令;默认档零连库、零模型、零网络)",
        "",
        "```bash",
        "cd apps/ai-service && python bench/run_retrieval_golden.py --mode text_only --json",
        "# 全档(需带项目依赖的解释器,如 apps/ai-service/.venv):… --mode all",
        "# 自检:… --mode text_only --self-test",
        "```",
        "",
    ]
    for r in report["runs"]:
        L += [f"## 档 `{r['mode']}` — {r['status']}", ""]
        for m in r["missing_inputs"]:
            L.append(f"- 跑不动,缺的第一个输入:`{m}`")
        L += ["", "### 逐段打点", ""]
        for st in r["stages"]:
            extra = ""
            if "reason" in st:
                extra = f" —— {st['reason']}"
            elif st["stage"] == "id_namespace_reconcile":
                extra = (
                    f" —— 金标 {st['golden_distinct_ids']} 个 id vs runner "
                    f"{st['runner_distinct_ids']} 个 id,交集 {st['intersection']};"
                    f"形态样本 金标 `{st['golden_id_samples'][:2]}` / runner `{st['runner_id_samples'][:2]}`"
                )
            elif st["stage"] == "retrieve":
                extra = f" —— {st.get('items', 0)} 题,零结果题 {st.get('zero_result_items', 0)} 条,耗时 {st.get('elapsed_ms')} ms"
            L.append(f"- `{st['stage']}` → **{st['status']}**{extra}")
        L.append("")
        for tr, v in r["tracks"].items():
            L += [f"### 轨 `{tr}`:判定 {v['judged_items']} 条 / 未判定 {v['unjudged_items']} 条", ""]
            if v["unjudged_reasons"]:
                L.append(f"- 未判定原因逐类计数:`{json.dumps(v['unjudged_reasons'], ensure_ascii=False)}`")
            for reason, qids in v.get("unjudged_examples", {}).items():
                L.append(f"  - `{reason}` 样本(最多 5 题,顺 id 可追):{', '.join(f'`{q}`' for q in qids)}")
            kinds = {k: n for k, n in v["match_kinds"].items() if k}
            if kinds:
                L.append(f"- 内容锚点匹配形态:`{json.dumps(kinds, ensure_ascii=False)}`")
            if not v["aggregates"]:
                L.append("- 无可读聚合:该轨本轮**全部未判定**(不得读成 0)。")
                L.append("")
                continue
            by_k: dict[str, dict[str, float]] = {}
            for key, val in v["aggregates"].items():
                kk, _, name = key.partition(".")
                by_k.setdefault(kk, {})[name] = val
            head = " | ".join(METRIC_ORDER)
            L += ["", f"| k | {head} |", f"|---|{'---|' * len(METRIC_ORDER)}"]
            for kk in [f"k{k}" for k in p["ks"] if f"k{k}" in by_k]:
                row = by_k[kk]
                L.append(f"| @{kk[1:]} | " + " | ".join(f"{row[n]:.4f}" for n in METRIC_ORDER) + " |")
            L.append("")
            orc = v.get("reference_oracle_whole_doc")
            if orc:
                o5, r5 = orc.get("k5.recall_at_k"), v["aggregates"].get("k5.recall_at_k")
                L += [
                    f"- 参照系(`oracle_whole_doc` = 把该题源文档的全部父块按原文顺序当检索结果):"
                    f"Recall@5 = {o5:.4f},MRR = {orc.get('k5.mrr', float('nan')):.4f}"
                    + (
                        " ⇒ **本腿不优于「整篇文档」**,关键词打分没加信息(或金标可判集过小)。**刻意只取"
                        "本轮判得动的题,不借分母差刷高。**"
                        if r5 is not None and o5 is not None and r5 <= o5
                        else " ⇒ 本腿优于「整篇文档」,读数可解释。"
                    ),
                    "",
                ]
    L += [
        "## 两轨口径差异(必读)",
        "",
        "- `id_native`:相关集 = 金标自带 `expected_chunk_ids`。本轮与 runner 产出的 id 命名空间"
        "**实测交集为空** ⇒ 逐条 `unjudged`。金标 id 是外部 kb-rag 骨架产的不透明 16 位十六进制,"
        "仓内无 manifest,也不是这 4 篇文档文本的可复算哈希(5 种切块 × 4 种摘要 × 11608 候选命中 0)。"
        "**本基线不凑映射** —— 凑一个 id 对应关系把分数刷起来是这次交付最坏的失败模式。",
        "- `evidence_span`:相关块 = 金标 `ground_truth_answer` 在语料里真实落的那一块(内容锚点,"
        "先整答案再首句)。它量的是「检索器能否把含金标答案的块捞进 top-k」,断言弱于 `id_native`,"
        "不得替它报数。",
        "- 未判定原因口径:`id_namespace_mismatch` = 两侧 id 体系不同名(需要 chunk manifest 或同 id 索引才能解);"
        "`evidence_span_not_located` = 金标答案是改写/摘要而非原文子串,锚不到块;"
        "`answer_empty` = **金标自带缺陷**(答案字段归一化后为空,实测多为只剩裸 ``` 围栏的条目)。",
        "",
        "## 与对照侧(Qoder 五档阶梯)的对齐与差距",
        "",
        "- 已对齐:分档(`text_only` / `vector_only` / `hybrid`)+ 每档逐段打点 + 缺输入点名到具体。",
        "- 刻意未做:`hybrid_rerank` / `hybrid_llm_rerank` 要真 rerank 模型与在线凭据,"
        "默认档的零网络零模型纪律下不跑;`vector_only` 用本仓确定性哈希向量,"
        "精度显著低于神经向量,读数不得当在线质量看。",
        "- 本仓超越对侧的一格:同一套金标可**零网络、零 DB** 复跑(对侧阶梯依赖在线服务与索引),"
        "且未判定原因逐类计数进基线件,可被后续票 diff。",
        "",
    ]
    return "\n".join(L) + "\n"


def summarize(report: dict[str, Any]) -> dict[str, Any]:
    return {
        "date": report["date"],
        "head_sha": report["head_sha"],
        "golden_total": report["golden"]["total_lines"],
        "corpus": {
            "parents": report["corpus"]["parents"],
            "leaves": report["corpus"]["leaves"],
            "missing_docs": report["corpus"]["missing_docs"],
        },
        "runs": [
            {
                "mode": r["mode"],
                "status": r["status"],
                "id_native_reconciled": bool(r.get("id_native_reconciled", False)),
                "missing_inputs": r["missing_inputs"],
                "tracks": {
                    tr: {
                        "judged": v["judged_items"],
                        "unjudged": v["unjudged_items"],
                        "reasons": v["unjudged_reasons"],
                        "recall@5": v["aggregates"].get("k5.recall_at_k"),
                        "mrr": v["aggregates"].get("k5.mrr"),
                        "ndcg@5": v["aggregates"].get("k5.ndcg_at_k"),
                        "oracle_recall@5": v.get("reference_oracle_whole_doc", {}).get("k5.recall_at_k"),
                        "oracle_mrr": v.get("reference_oracle_whole_doc", {}).get("k5.mrr"),
                    }
                    for tr, v in r["tracks"].items()
                },
            }
            for r in report["runs"]
        ],
    }


def self_test(report: dict[str, Any], items: list[GoldenItem], cor: Corpus) -> int:
    """自检:两轨判定行为必须是**当下现实的**断言,不是今天的读数。"""
    r0 = report["runs"][0]
    if r0["mode"] != "text_only" or r0["status"] != "ok":
        print(f"SELF-TEST: 本轮首档 `{r0['mode']}` 状态 {r0['status']},自检只锁默认档 ⇒ 未判定")
        return 2
    assert not cor.missing_docs, "默认档语料必须 4 篇齐读"
    assert len(cor.leaves) > 0 and len(cor.parents) >= 20
    idn, en = r0["tracks"]["id_native"], r0["tracks"]["evidence_span"]
    reconciled = bool(r0.get("id_native_reconciled"))
    if report["golden"]["manifest_present"] or reconciled:
        assert idn["judged_items"] == len(items), "命名空间已重合 ⇒ 轨 A 必须逐条判"
    else:
        assert idn["judged_items"] == 0, "无 manifest 时轨 A 必须逐条未判定(禁凑映射)"
        assert sum(idn["unjudged_reasons"].values()) == len(items)
        assert set(idn["unjudged_reasons"]) == {"id_namespace_mismatch"}
    assert en["judged_items"] + en["unjudged_items"] == len(items)
    assert en["judged_items"] > 0 and en["aggregates"]["k5.recall_at_k"] > 0.0
    assert all(isinstance(x["retrieved_ids"], list) for x in r0["per_item"])
    assert any(x["retrieved_ids"] for x in r0["per_item"]), "检索腿不得恒返回空集"
    print(f"self-test ok: items={len(items)} leaves={len(cor.leaves)} "
          f"evidence_judged={en['judged_items']} id_native_reconciled={reconciled}")
    return 0


def main(argv: list[str] | None = None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass
    ap = argparse.ArgumentParser(description="金标检索分档评测 runner(默认档完全离线)")
    ap.add_argument("--mode", default="text_only", choices=[*MODES, "all"])
    ap.add_argument("--k", default=",".join(str(x) for x in DEFAULT_KS), help="逗号分隔的 k 集")
    ap.add_argument("--top-k", type=int, default=0, help="检索深度,默认取 k 集最大值")
    ap.add_argument("--limit", type=int, default=0, help="只跑前 N 条(调试)")
    ap.add_argument("--date", default="", help="基线件日期后缀 YYYY-MM-DD,默认今天(UTC)")
    ap.add_argument("--json", action="store_true", help="stdout 只打 ASCII 摘要 JSON")
    ap.add_argument("--no-write", action="store_true", help="只算不落基线件")
    ap.add_argument("--self-test", action="store_true", help="自检两轨判定行为")
    args = ap.parse_args(argv)

    ks = sorted({int(x) for x in args.k.split(",") if x.strip()})
    if not ks or min(ks) <= 0:
        raise InputError(f"--k 非法:{ks}(须为正整数)")
    top_k = args.top_k or max(ks)
    if not GOLDEN_PATH.is_file():
        raise InputError(f"金标文件不存在:{GOLDEN_PATH}")
    res = validate_golden_set(GOLDEN_PATH)
    if not res.ok:
        raise InputError(f"金标校验未过:{res.report_text(5)}")
    items: list[GoldenItem] = res.items if args.limit <= 0 else res.items[: args.limit]
    cor = build_corpus()

    modes = list(MODES) if args.mode == "all" else [args.mode]
    runs = [run_mode(m, items, cor, ks, top_k) for m in modes]

    report: dict[str, Any] = {
        "schema": "retrieval-golden-baseline/1",
        "generated_at": datetime.now(UTC).isoformat(),
        "date": args.date or datetime.now(UTC).strftime("%Y-%m-%d"),
        "head_sha": current_sha(),
        "golden": {
            "path": str(GOLDEN_PATH.relative_to(AI_ROOT)),
            "total_lines": res.total_lines,
            "items_used": len(items),
            "difficulty_hist": dict(Counter(it.difficulty for it in items)),
            "expected_ids_distinct": len({c for it in items for c in it.expected_chunk_ids}),
            "manifest_present": MANIFEST_PATH.is_file(),
        },
        "corpus": {
            "docs": {d: {"path": p, "leaves": cor.by_doc.get(d, 0)} for d, p in CORPUS_DOCS.items()},
            "missing_docs": cor.missing_docs,
            "parents": len(cor.parents),
            "leaves": len(cor.leaves),
            "avg_leaf_tokens": round(cor.avg_len, 2),
        },
        "params": {"ks": ks, "top_k": top_k, "bm25": {"k1": BM25_K1, "b": BM25_B}, "rrf_k": RRF_K},
        "runs": runs,
    }
    if not args.no_write:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        jf = REPORTS_DIR / f"retrieval-golden-baseline-{report['date']}.json"
        mf = REPORTS_DIR / f"retrieval-golden-baseline-{report['date']}.md"
        jf.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        mf.write_text(render_md(report), encoding="utf-8")
        report["written"] = [str(jf.relative_to(REPO_ROOT)), str(mf.relative_to(REPO_ROOT))]

    summary = summarize(report)
    if args.self_test:
        rc = self_test(report, items, cor)
        print(json.dumps(summary, sort_keys=True))
        return rc
    if args.json:
        print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    else:
        for w in report.get("written", []):
            print(f"written: {w}")
        print(json.dumps(summary, ensure_ascii=False, sort_keys=True, indent=2))
    return 0 if any(v["judged_items"] for r in runs for v in r["tracks"].values()) else 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except InputError as e:
        print(f"INPUT-ERROR: {e}")
        sys.exit(1)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
