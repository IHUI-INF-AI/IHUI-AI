# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`id_native` 轨的首次可判打分:把检索宇宙换成**同 id 索引**(goal-b47)。

背景(现读,不猜):金标的 `expected_chunk_ids` 是本仓 `ParentChildChunker` 的父块 id
(16 位十六进制),而基线 runner 的语料是按 H2/H3 标题现切的结构 id(`faq#p00`)⇒ 两个命名空间
实测零交集,`id_native` 轨 264 条全部 `unjudged`。runner 头注早就写了这一轨
"哪天仓内真落了同 id 的索引,自动点亮(判据现算,不写死)" —— 本件就是那把索引:
**不改判据、不做位置配对、不编 id 表**,分块与 id 一律由本仓切块器现算。

三条纪律:
1. **零连库、零网络、零模型**:语料 = `ParentChildChunker` 对同样那 4 篇仓内文档的父块。
2. **指标一律 import `retrieval_eval`**,本件不写第二份 recall/MRR 公式(§0.6)。
3. **对不上就点名**:落在金标里、但同 id 索引产不出的 id 逐条进 `unmatched_gold_ids`
   (已知的陈旧 id 属数据缺陷那一票),绝不靠"剔题"或"造映射"把这条轨刷绿。

用法:
```bash
cd apps/ai-service && python bench/score_id_native.py --json
```
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable
from dataclasses import dataclass, field, fields, replace
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.parent_child_chunking import ChunkerConfig, ParentChildChunker  # noqa: E402
from app.services.retrieval_eval import (  # noqa: E402 - 指标单源,本件不得自带第二份公式
    context_precision,
    hit_rate_at_k,
    mrr,
    ndcg_at_k,
    precision_at_k,
    recall_at_k,
)
from bench.run_retrieval_golden import (  # noqa: E402
    CORPUS_DOCS,
    GOLDEN_PATH,
    REPO_ROOT,
    Corpus,
    Leaf,
    rank_text_only,
    tokenize,
)

KS: tuple[int, ...] = (1, 3, 5, 10)
TOP_K = 10


@dataclass
class Question:
    """只取打分需要的三件事,不去猜金标加载器的形态。"""

    question_id: str
    question: str
    expected_chunk_ids: list[str]


@dataclass
class SameIdIndex:
    """同 id 索引:一个切块器父块 = 一个打分与返回单元,id 用它自带的 `chunk_id`。"""

    corpus: Corpus
    per_doc_parents: dict[str, int] = field(default_factory=dict)
    config_note: str = ""

    @property
    def universe(self) -> set[str]:
        return {lf.leaf_id for lf in self.corpus.leaves}


def load_questions(path: Path | None = None) -> list[Question]:
    out: list[Question] = []
    for line in (path or GOLDEN_PATH).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        raw = json.loads(line)
        ids = raw.get("expected_chunk_ids")
        if not isinstance(ids, list):
            ids = []
        out.append(
            Question(
                question_id=str(raw.get("question_id", "")),
                question=str(raw.get("question", "")),
                expected_chunk_ids=[str(x) for x in ids],
            )
        )
    return out


def build_same_id_index(
    doc_texts: dict[str, str],
    *,
    parent_max_tokens: int | None = None,
    child_max_tokens: int | None = None,
) -> SameIdIndex:
    """「doc → 正文」→ 同 id 索引。分块配置取 `ChunkerConfig.from_env()` 现读值。"""
    cfg = ChunkerConfig.from_env()
    if parent_max_tokens is not None or child_max_tokens is not None:
        cfg = replace(
            cfg,
            parent_max_tokens=parent_max_tokens if parent_max_tokens is not None else cfg.parent_max_tokens,
            child_max_tokens=child_max_tokens if child_max_tokens is not None else cfg.child_max_tokens,
        )
    chunker = ParentChildChunker(cfg)
    cor = Corpus()
    per_doc: dict[str, int] = {}
    for doc_id, text in doc_texts.items():
        if not text.strip():
            cor.missing_docs.append(doc_id)
            continue
        result = chunker.chunk_document(text, doc_id=doc_id, source=Path(CORPUS_DOCS[doc_id]).name)
        cor.parents_by_doc.setdefault(doc_id, [])
        for parent in result.parents:
            pid = parent.chunk_id
            tokens = tokenize(parent.text)
            cor.parents[pid] = pid
            cor.parents_by_doc[doc_id].append(pid)
            cor.leaves.append(
                Leaf(
                    leaf_id=pid,
                    parent_id=pid,
                    doc_id=doc_id,
                    heading=doc_id,
                    text=parent.text,
                    tokens=tokens,
                )
            )
            cor.leaf_parent[pid] = pid
        per_doc[doc_id] = len(result.parents)
        cor.by_doc[doc_id] = cor.by_doc.get(doc_id, 0) + len(result.parents)

    cor.avg_len = (sum(len(lf.tokens) for lf in cor.leaves) / len(cor.leaves)) if cor.leaves else 0.0
    df: dict[str, int] = {}
    for lf in cor.leaves:
        for term in set(lf.tokens):
            df[term] = df.get(term, 0) + 1
    cor.df = df
    return SameIdIndex(
        corpus=cor,
        per_doc_parents=per_doc,
        config_note="config=" + json.dumps(
            {f.name: getattr(cfg, f.name) for f in fields(cfg)},
            ensure_ascii=False,
            sort_keys=True,
            default=str,
        ),
    )


def score_id_native(
    items: list[Question],
    index: SameIdIndex,
    *,
    ranker: Callable[[str, Corpus, int], list[str]] = rank_text_only,
    top_k: int = TOP_K,
    ks: tuple[int, ...] = KS,
) -> dict[str, Any]:
    """`id_native` 轨打分:相关集直接是金标的 `expected_chunk_ids`。"""
    universe = index.universe
    gold_ids = {cid for it in items for cid in it.expected_chunk_ids}
    per_question: list[dict[str, Any]] = []
    buckets: dict[str, list[float]] = {}
    for k in ks:
        buckets[f"recall@{k}"] = []
        buckets[f"precision@{k}"] = []
        buckets[f"ndcg@{k}"] = []
        buckets[f"hit@{k}"] = []
    buckets["mrr"] = []
    buckets["context_precision"] = []

    for it in items:
        relevant = list(it.expected_chunk_ids)
        if not relevant:
            per_question.append({"question_id": it.question_id, "status": "unjudged", "reason": "empty_expected_ids"})
            continue
        if all(cid not in universe for cid in relevant):
            per_question.append(
                {"question_id": it.question_id, "status": "unjudged", "reason": "relevant_ids_absent_from_index"}
            )
            continue
        retrieved = ranker(it.question, index.corpus, top_k)
        row: dict[str, Any] = {"question_id": it.question_id, "status": "judged", "n_relevant": len(relevant)}
        for k in ks:
            row[f"recall@{k}"] = recall_at_k(retrieved, relevant, k)
            row[f"precision@{k}"] = precision_at_k(retrieved, relevant, k)
            row[f"ndcg@{k}"] = ndcg_at_k(retrieved, relevant, k)
            row[f"hit@{k}"] = hit_rate_at_k(retrieved, relevant, k)
        row["mrr"] = mrr(retrieved, relevant)
        row["context_precision"] = context_precision(retrieved, relevant)
        for key, value in row.items():
            if key in buckets and isinstance(value, float):
                buckets[key].append(value)
        per_question.append(row)

    judged = [r for r in per_question if r["status"] == "judged"]
    return {
        "track": "id_native",
        "index": "parent_child_chunker_same_id",
        "config": index.config_note,
        "per_doc_parents": index.per_doc_parents,
        "golden_questions": len(items),
        "golden_distinct_ids": len(gold_ids),
        "index_distinct_ids": len(universe),
        "intersection": len(universe & gold_ids),
        "unmatched_gold_ids": sorted(gold_ids - universe),
        "judged": len(judged),
        "unjudged": len(items) - len(judged),
        "gold_id_coverage": round(len(universe & gold_ids) / len(gold_ids), 4) if gold_ids else 0.0,
        "metrics": {k: (round(sum(v) / len(v), 6) if v else None) for k, v in buckets.items()},
        "per_question": per_question,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="id_native 轨同 id 索引打分(零连库)")
    ap.add_argument("--goldens", default=None, help="金标件路径;缺省用 runner 的 GOLDEN_PATH")
    ap.add_argument("--json", action="store_true", help="只印一行 summary(不含逐题) ")
    ap.add_argument("--out", default=None, help="把完整结果写成 JSON 到该路径")
    ap.add_argument("--parent-max-tokens", type=int, default=None)
    ap.add_argument("--child-max-tokens", type=int, default=None)
    ns = ap.parse_args(argv)

    doc_texts: dict[str, str] = {}
    for doc_id, rel in CORPUS_DOCS.items():
        path = REPO_ROOT / rel
        if path.is_file():
            doc_texts[doc_id] = path.read_text(encoding="utf-8")
    if not doc_texts:
        print("未判定:CORPUS_DOCS 里的文档一篇都不在盘上(不冒绿)", file=sys.stderr)
        return 1

    items = load_questions(Path(ns.goldens) if ns.goldens else None)
    index = build_same_id_index(
        doc_texts,
        parent_max_tokens=ns.parent_max_tokens,
        child_max_tokens=ns.child_max_tokens,
    )
    result = score_id_native(items, index)
    if ns.out:
        Path(ns.out).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k != "per_question"}, ensure_ascii=False, sort_keys=True))
    return 0 if result["judged"] > 0 else 2


__test__ = {
    "build_same_id_index": build_same_id_index,
    "score_id_native": score_id_native,
    "load_questions": load_questions,
}

if __name__ == "__main__":
    sys.exit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
