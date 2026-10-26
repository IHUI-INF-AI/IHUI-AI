# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Apache-2.0 须保留本声明与 NOTICE。
"""检索评测指标服务模块(2026-10-26 立,纯 stdlib,零现有代码侵入)。

提供三层能力,供 CI / bench 直接调用:

1. 检索指标纯函数:Recall@k / Precision@k / MRR / nDCG@k / Hit Rate@k /
   Context Precision。输入「有序检索结果 ID 列表 + 相关 ID 集合 + k」,
   边界情形(空结果 / 全不相关 / 相关集为空 / k<=0)一律返回 0.0,
   绝不抛异常 —— 评测跑批中一题炸不能带崩整轮。
2. 金标集(Golden Set)schema 与 JSONL 逐行校验:字段口径与校验规则
   同 kb-rag 评测骨架(question_id / question / ground_truth_answer /
   expected_chunk_ids[父块 ID] / source_doc_id / difficulty / tags)。
3. ``run_retrieval_eval`` 汇总编排:金标条目 → retriever_fn 检索 →
   逐题指标 → 均值 / 分布 / per-item 明细报告。

约定:
- retrieved: 检索器返回的**有序** chunk ID 列表(名次即语义,勿先排序)
- relevant:  金标 expected_chunk_ids(视为二值相关:在集内=1,否则=0)
- retriever_fn 为同步回调 ``(query, k) -> list[str]``(与骨架 runner 口径
  一致);异步检索器由调用方自行桥接(如 asyncio.run / 事件循环内预取)。
"""

from __future__ import annotations

import json
import math
from collections.abc import Callable, Sequence
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

__all__ = [
    "RETRIEVAL_METRIC_NAMES",
    "recall_at_k",
    "precision_at_k",
    "mrr",
    "ndcg_at_k",
    "hit_rate_at_k",
    "context_precision",
    "compute_retrieval_metrics",
    "DIFFICULTIES",
    "REQUIRED_FIELDS",
    "GoldenItem",
    "ValidationIssue",
    "ValidationResult",
    "validate_golden_set",
    "RetrieverFn",
    "RetrievalItemResult",
    "RetrievalEvalReport",
    "run_retrieval_eval",
]

# 参与聚合的检索指标名(封闭集,聚合与报告共用)
RETRIEVAL_METRIC_NAMES: tuple[str, ...] = (
    "recall_at_k",
    "precision_at_k",
    "mrr",
    "ndcg_at_k",
    "hit_rate_at_k",
    "context_precision",
)


def _top_k(retrieved: Sequence[str], k: int) -> list[str]:
    return list(retrieved)[: max(k, 0)]


def recall_at_k(retrieved: Sequence[str], relevant: Sequence[str], k: int) -> float:
    """Recall@k = |top-k ∩ relevant| / |relevant|。relevant 为空返回 0。"""
    rel = set(relevant)
    if not rel:
        return 0.0
    hits = len(set(_top_k(retrieved, k)) & rel)
    return hits / len(rel)


def precision_at_k(retrieved: Sequence[str], relevant: Sequence[str], k: int) -> float:
    """Precision@k = |top-k ∩ relevant| / k(严格口径:分母恒为 k,短返回同样扣分)。"""
    if k <= 0:
        return 0.0
    rel = set(relevant)
    hits = len(set(_top_k(retrieved, k)) & rel)
    return hits / k


def mrr(retrieved: Sequence[str], relevant: Sequence[str]) -> float:
    """MRR = 1/(首个相关结果的名次);无相关结果返回 0。名次从 1 起。"""
    rel = set(relevant)
    for rank, rid in enumerate(retrieved, start=1):
        if rid in rel:
            return 1.0 / rank
    return 0.0


def ndcg_at_k(retrieved: Sequence[str], relevant: Sequence[str], k: int) -> float:
    """nDCG@k(二值相关,log2 折扣)。

    DCG@k  = Σ_{i=1..k} rel_i / log2(i+1),rel_i ∈ {0,1}
    IDCG@k = Σ_{i=1..min(k,|relevant|)} 1 / log2(i+1)
    nDCG   = DCG / IDCG;IDCG 为 0(relevant 空)返回 0。
    """
    rel = set(relevant)
    if not rel or k <= 0:
        return 0.0
    dcg = sum(
        1.0 / math.log2(i + 1)
        for i, rid in enumerate(_top_k(retrieved, k), start=1)
        if rid in rel
    )
    ideal_n = min(k, len(rel))
    idcg = sum(1.0 / math.log2(i + 1) for i in range(1, ideal_n + 1))
    return dcg / idcg if idcg > 0 else 0.0


def hit_rate_at_k(retrieved: Sequence[str], relevant: Sequence[str], k: int) -> float:
    """Hit Rate@k:top-k 内出现任意相关块即 1,否则 0。"""
    rel = set(relevant)
    if not rel:
        return 0.0
    return 1.0 if set(_top_k(retrieved, k)) & rel else 0.0


def context_precision(retrieved: Sequence[str], relevant: Sequence[str]) -> float:
    """Context Precision(RAGAS 口径):对每个命中位置 i 取 precision@i 再平均。

    CP = (1/H) · Σ_{i: rel_i=1} (H_i / i),H 为命中总数,H_i 为前 i 位命中数。
    无任何命中返回 0。
    """
    rel = set(relevant)
    hits = 0
    total = 0.0
    for i, rid in enumerate(retrieved, start=1):
        if rid in rel:
            hits += 1
            total += hits / i
    return total / hits if hits else 0.0


def compute_retrieval_metrics(
    retrieved: Sequence[str], relevant: Sequence[str], k: int
) -> dict[str, float]:
    """一次性算全六项检索指标(键即 ``RETRIEVAL_METRIC_NAMES``)。"""
    return {
        "recall_at_k": recall_at_k(retrieved, relevant, k),
        "precision_at_k": precision_at_k(retrieved, relevant, k),
        "mrr": mrr(retrieved, relevant),
        "ndcg_at_k": ndcg_at_k(retrieved, relevant, k),
        "hit_rate_at_k": hit_rate_at_k(retrieved, relevant, k),
        "context_precision": context_precision(retrieved, relevant),
    }


# =========================================================================
# Golden Set(评测金标集)schema 与逐行校验
# =========================================================================

# 难度封闭集
DIFFICULTY_EASY = "easy"
DIFFICULTY_MULTI_HOP = "multi-hop"
DIFFICULTY_ADVERSARIAL = "adversarial"
DIFFICULTIES: tuple[str, ...] = (
    DIFFICULTY_EASY,
    DIFFICULTY_MULTI_HOP,
    DIFFICULTY_ADVERSARIAL,
)

# 必填字段(顺序即 JSONL 推荐字段顺序)
REQUIRED_FIELDS: tuple[str, ...] = (
    "question_id",
    "question",
    "ground_truth_answer",
    "expected_chunk_ids",
    "source_doc_id",
    "difficulty",
)


@dataclass
class GoldenItem:
    """一条金标问答(expected_chunk_ids 用父块 ID;adversarial 允许空列表)。"""

    question_id: str
    question: str
    ground_truth_answer: str
    expected_chunk_ids: list[str]
    source_doc_id: str
    difficulty: str
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ValidationIssue:
    """一条校验错误,定位到 JSONL 行号与字段。"""

    line: int
    field: str
    message: str

    def format(self) -> str:
        return f"第 {self.line} 行 [{self.field}]: {self.message}"


@dataclass
class ValidationResult:
    """校验结果:合法条目 + 全部错误(一次看全,不是遇错即停)。"""

    ok: bool
    total_lines: int
    items: list[GoldenItem] = field(default_factory=list)
    issues: list[ValidationIssue] = field(default_factory=list)

    def report_text(self, max_issues: int = 20) -> str:
        """人类可读的错误报告(默认最多列 20 条,末尾标注剩余数)。"""
        head = (
            f"校验{'通过' if self.ok else '失败'}:共 {self.total_lines} 行,"
            f"合法 {len(self.items)} 条,错误 {len(self.issues)} 条"
        )
        lines = [head]
        for issue in self.issues[:max_issues]:
            lines.append("  " + issue.format())
        if len(self.issues) > max_issues:
            lines.append(f"  ...(其余 {len(self.issues) - max_issues} 条省略)")
        return "\n".join(lines)


def _check_str(raw: dict[str, Any], key: str, line: int) -> ValidationIssue | None:
    """必填非空字符串字段;返回错误 issue(合法时返回 None)。"""
    if key not in raw:
        return ValidationIssue(line, key, f"缺少必填字段 {key!r}")
    value = raw[key]
    if not isinstance(value, str) or not value.strip():
        return ValidationIssue(line, key, f"{key!r} 必须是非空字符串,实得 {value!r}")
    return None


def validate_golden_set(path: str | Path) -> ValidationResult:
    """逐行校验 JSONL 金标集,返回含行号定位的完整结果。

    文件不存在时抛 FileNotFoundError(由调用方决定如何呈现)。
    """
    text = Path(path).read_text(encoding="utf-8")
    issues: list[ValidationIssue] = []
    items: list[GoldenItem] = []
    seen_ids: dict[str, int] = {}
    total_lines = 0

    for lineno, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue  # 跳过空行,不计为错误
        total_lines += 1
        try:
            raw = json.loads(line)
        except json.JSONDecodeError as e:
            issues.append(ValidationIssue(lineno, "-", f"JSON 解析失败: {e}"))
            continue
        if not isinstance(raw, dict):
            issues.append(ValidationIssue(lineno, "-", f"顶层必须是对象,实得 {type(raw).__name__}"))
            continue

        row_issues: list[ValidationIssue] = []
        for key in ("question_id", "question", "ground_truth_answer", "source_doc_id"):
            issue = _check_str(raw, key, lineno)
            if issue:
                row_issues.append(issue)

        # expected_chunk_ids: list[str],元素非空;adversarial 允许空列表
        if "expected_chunk_ids" not in raw:
            row_issues.append(ValidationIssue(lineno, "expected_chunk_ids", "缺少必填字段"))
        else:
            ids = raw["expected_chunk_ids"]
            if not isinstance(ids, list) or not all(isinstance(x, str) and x.strip() for x in ids):
                row_issues.append(
                    ValidationIssue(lineno, "expected_chunk_ids", "必须是字符串列表(元素非空)")
                )
            elif not ids and raw.get("difficulty") != DIFFICULTY_ADVERSARIAL:
                row_issues.append(
                    ValidationIssue(lineno, "expected_chunk_ids", "空列表仅 adversarial 允许")
                )

        # difficulty: 封闭枚举
        if "difficulty" not in raw:
            row_issues.append(ValidationIssue(lineno, "difficulty", "缺少必填字段"))
        elif raw["difficulty"] not in DIFFICULTIES:
            row_issues.append(
                ValidationIssue(
                    lineno,
                    "difficulty",
                    f"必须是 {DIFFICULTIES} 之一,实得 {raw['difficulty']!r}",
                )
            )

        # tags: 可选 list[str]
        tags = raw.get("tags", [])
        if not isinstance(tags, list) or not all(isinstance(t, str) for t in tags):
            row_issues.append(ValidationIssue(lineno, "tags", "必须是字符串列表(可省略)"))
            tags = []

        # question_id 集内唯一
        qid = raw.get("question_id")
        if isinstance(qid, str) and qid.strip():
            if qid in seen_ids:
                row_issues.append(
                    ValidationIssue(lineno, "question_id", f"与第 {seen_ids[qid]} 行重复")
                )
            else:
                seen_ids[qid] = lineno

        if row_issues:
            issues.extend(row_issues)
            continue
        items.append(
            GoldenItem(
                question_id=str(raw["question_id"]),
                question=str(raw["question"]),
                ground_truth_answer=str(raw["ground_truth_answer"]),
                expected_chunk_ids=[str(x) for x in raw["expected_chunk_ids"]],
                source_doc_id=str(raw["source_doc_id"]),
                difficulty=str(raw["difficulty"]),
                tags=[str(t) for t in tags],
            )
        )

    return ValidationResult(ok=not issues, total_lines=total_lines, items=items, issues=issues)


# =========================================================================
# 评测编排:金标条目 → 检索 → 指标 → 汇总报告
# =========================================================================

RetrieverFn = Callable[[str, int], list[str]]

# 指标分布桶(报告用):[0,0.2) ... [0.8,1.0]
_BUCKETS: tuple[tuple[str, float, float], ...] = (
    ("0.0-0.2", 0.0, 0.2),
    ("0.2-0.4", 0.2, 0.4),
    ("0.4-0.6", 0.4, 0.6),
    ("0.6-0.8", 0.6, 0.8),
    ("0.8-1.0", 0.8, 1.0000001),
)


@dataclass
class RetrievalItemResult:
    """单题检索评测明细。"""

    question_id: str
    question: str
    difficulty: str
    retrieved_ids: list[str]
    retrieval_metrics: dict[str, float] = field(default_factory=dict)


@dataclass
class RetrievalEvalReport:
    """一轮检索评测的完整结果(机器可读)。"""

    k: int
    total_items: int
    generated_at: str
    retrieval_means: dict[str, float] = field(default_factory=dict)
    retrieval_distributions: dict[str, dict[str, int]] = field(default_factory=dict)
    per_item: list[RetrievalItemResult] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["per_item"] = [asdict(item) for item in self.per_item]
        return d


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _distribution(values: list[float]) -> dict[str, int]:
    dist = {label: 0 for label, _, _ in _BUCKETS}
    for v in values:
        for label, lo, hi in _BUCKETS:
            if lo <= v < hi:
                dist[label] += 1
                break
    return dist


def run_retrieval_eval(
    golden_items: Sequence[GoldenItem],
    retriever_fn: RetrieverFn,
    *,
    k: int = 5,
) -> RetrievalEvalReport:
    """跑一轮检索评测:逐题调 ``retriever_fn(question, k)`` 并汇总六项指标。

    - golden_items: 已通过 ``validate_golden_set`` 的金标条目(空列表合法,
      此时各指标均值为 0.0,不抛异常)
    - retriever_fn: 同步回调 ``(query, k) -> 有序 chunk_id 列表``
    - 返回 ``RetrievalEvalReport``:均值 / 分布 / per-item 明细可追溯
    """
    per_item: list[RetrievalItemResult] = []
    for item in golden_items:
        retrieved = list(retriever_fn(item.question, k))
        per_item.append(
            RetrievalItemResult(
                question_id=item.question_id,
                question=item.question,
                difficulty=item.difficulty,
                retrieved_ids=retrieved,
                retrieval_metrics=compute_retrieval_metrics(retrieved, item.expected_chunk_ids, k),
            )
        )

    retrieval_means = {
        name: _mean([r.retrieval_metrics[name] for r in per_item])
        for name in RETRIEVAL_METRIC_NAMES
    }
    retrieval_distributions = {
        name: _distribution([r.retrieval_metrics[name] for r in per_item])
        for name in RETRIEVAL_METRIC_NAMES
    }

    return RetrievalEvalReport(
        k=k,
        total_items=len(per_item),
        generated_at=datetime.now(UTC).isoformat(),
        retrieval_means=retrieval_means,
        retrieval_distributions=retrieval_distributions,
        per_item=per_item,
    )
