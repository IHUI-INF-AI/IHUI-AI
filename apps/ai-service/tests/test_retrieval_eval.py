# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# Apache-2.0 须保留本声明与 NOTICE。
"""retrieval_eval 检索评测模块单元测试。

测试覆盖:
- 指标手算对照(小样例,逐指标断言精确值,与骨架 metrics.py 公式一致)
- 边界:空金标集 / retriever 空返回 / 全部未命中 / 重复 ID 去重行为 / k<=0
- run_retrieval_eval 端到端:均值统计字段齐全、per-item 明细可追溯
- schema 校验:非法条目(缺 expected_chunk_ids、空 question 等)被拒且报错可读
- 与骨架 metrics.py 交叉验证:同一批样例逐指标数值相等(tmp 骨架缺失则跳过)
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import pytest

from app.services.retrieval_eval import (
    DIFFICULTIES,
    RETRIEVAL_METRIC_NAMES,
    GoldenItem,
    compute_retrieval_metrics,
    context_precision,
    hit_rate_at_k,
    mrr,
    ndcg_at_k,
    precision_at_k,
    recall_at_k,
    run_retrieval_eval,
    validate_golden_set,
)

# =============================================================================
# 指标手算对照
# =============================================================================

# 基准样例:retrieved=[c1,c2,c3],relevant={c2,c5},k=3
#   top-3 命中 1 个(c2,第 2 名)
BASE_RET = ["c1", "c2", "c3"]
BASE_REL = ["c2", "c5"]
BASE_K = 3


class TestMetricsHandComputed:
    def test_recall_at_k(self):
        # |top3 ∩ rel| / |rel| = 1/2
        assert recall_at_k(BASE_RET, BASE_REL, BASE_K) == pytest.approx(0.5)

    def test_precision_at_k(self):
        # 严格口径:分母恒为 k → 1/3
        assert precision_at_k(BASE_RET, BASE_REL, BASE_K) == pytest.approx(1 / 3)

    def test_mrr(self):
        # 首个相关结果在第 2 名 → 1/2
        assert mrr(BASE_RET, BASE_REL) == pytest.approx(0.5)

    def test_ndcg_at_k(self):
        # DCG = 1/log2(3);IDCG = 1/log2(2) + 1/log2(3)(min(k,|rel|)=2)
        dcg = 1.0 / math.log2(3)
        idcg = 1.0 / math.log2(2) + 1.0 / math.log2(3)
        assert ndcg_at_k(BASE_RET, BASE_REL, BASE_K) == pytest.approx(dcg / idcg)

    def test_hit_rate_at_k(self):
        assert hit_rate_at_k(BASE_RET, BASE_REL, BASE_K) == 1.0

    def test_context_precision(self):
        # 唯一命中在 i=2,H_i/i = 1/2,H=1 → 0.5
        assert context_precision(BASE_RET, BASE_REL) == pytest.approx(0.5)

    def test_compute_all_six_keys(self):
        d = compute_retrieval_metrics(BASE_RET, BASE_REL, BASE_K)
        assert set(d) == set(RETRIEVAL_METRIC_NAMES)
        assert d["recall_at_k"] == pytest.approx(0.5)
        assert d["precision_at_k"] == pytest.approx(1 / 3)
        assert d["mrr"] == pytest.approx(0.5)
        assert d["context_precision"] == pytest.approx(0.5)

    def test_precision_denominator_is_k_not_len_retrieved(self):
        # 短返回(2 条全中,k=5):precision = 2/5 而非 2/2
        assert precision_at_k(["a", "b"], ["a", "b"], 5) == pytest.approx(0.4)


# =============================================================================
# 边界
# =============================================================================


class TestEdgeCases:
    def test_empty_retrieved_all_zero(self):
        d = compute_retrieval_metrics([], ["x"], 3)
        assert all(v == 0.0 for v in d.values())

    def test_all_missed_all_zero(self):
        d = compute_retrieval_metrics(["a", "b", "c"], ["x", "y"], 3)
        assert all(v == 0.0 for v in d.values())

    def test_empty_relevant_all_zero(self):
        # 相关集为空(adversarial):各指标一律 0,不抛
        d = compute_retrieval_metrics(["a", "b"], [], 2)
        assert all(v == 0.0 for v in d.values())

    def test_k_non_positive(self):
        assert recall_at_k(["a"], ["a"], 0) == 0.0
        assert precision_at_k(["a"], ["a"], 0) == 0.0
        assert precision_at_k(["a"], ["a"], -1) == 0.0
        assert ndcg_at_k(["a"], ["a"], 0) == 0.0
        assert hit_rate_at_k(["a"], ["a"], 0) == 0.0

    def test_duplicate_ids_dedup_in_set_metrics_no_dedup_in_rank_metrics(self):
        # 交集类指标(recall/precision/hit)按集合去重;
        # 名次类(mrr/ndcg/cp)逐位置计分,重复命中不合并(骨架口径)。
        ret = ["a", "a", "b"]
        rel = ["a"]
        assert recall_at_k(ret, rel, 3) == 1.0  # 去重后仍全召回
        assert precision_at_k(ret, rel, 3) == pytest.approx(1 / 3)  # 交集只算一次
        assert hit_rate_at_k(ret, rel, 3) == 1.0
        assert mrr(ret, rel) == 1.0
        # DCG 含两个位置(1、2)的重复命中,IDCG 只 1 项 → 可 >1(不截断)
        assert ndcg_at_k(ret, rel, 3) == pytest.approx(1.0 / math.log2(2) + 1.0 / math.log2(3))
        # CP:命中在 i=1(1/1)与 i=2(2/2)→ (1+1)/2 = 1.0
        assert context_precision(ret, rel) == 1.0

    def test_run_empty_golden_set(self):
        report = run_retrieval_eval([], lambda q, k: ["whatever"])
        assert report.total_items == 0
        assert report.per_item == []
        assert set(report.retrieval_means) == set(RETRIEVAL_METRIC_NAMES)
        assert all(v == 0.0 for v in report.retrieval_means.values())
        assert all(sum(dist.values()) == 0 for dist in report.retrieval_distributions.values())

    def test_run_retriever_returns_empty(self):
        items = [_item("g1", ["A", "B"])]
        report = run_retrieval_eval(items, lambda q, k: [])
        assert report.total_items == 1
        assert all(v == 0.0 for v in report.per_item[0].retrieval_metrics.values())


# =============================================================================
# run_retrieval_eval 端到端(5 条金标、已知命中排名)
# =============================================================================


def _item(qid: str, expected: list[str], difficulty: str = "easy") -> GoldenItem:
    return GoldenItem(
        question_id=qid,
        question=f"问题-{qid}",
        ground_truth_answer="参考答案",
        expected_chunk_ids=expected,
        source_doc_id=f"doc-{qid}",
        difficulty=difficulty,
    )


# g1: rel=[A,B] ret=[A,C,B,D] → 第 1、3 名命中
# g2: rel=[X]    ret=[Y,Z,X,W] → 第 3 名命中
# g3: rel=[P,Q]  ret=[Q,P]     → 第 1、2 名全中(短返回)
# g4: rel=[M]    ret=[N,O,P]   → 全不中
# g5: rel=[](adversarial) ret=[A,B,C] → 一律 0
_GOLDEN_5 = [
    _item("g1", ["A", "B"]),
    _item("g2", ["X"]),
    _item("g3", ["P", "Q"]),
    _item("g4", ["M"]),
    _item("g5", [], difficulty="adversarial"),
]
_TABLE_5 = {
    "问题-g1": ["A", "C", "B", "D"],
    "问题-g2": ["Y", "Z", "X", "W"],
    "问题-g3": ["Q", "P"],
    "问题-g4": ["N", "O", "P"],
    "问题-g5": ["A", "B", "C"],
}


def _table_retriever(query: str, k: int) -> list[str]:
    return _TABLE_5.get(query, [])[:k]


class TestRunRetrievalEval:
    def test_means_exact(self):
        report = run_retrieval_eval(_GOLDEN_5, _table_retriever, k=3)
        assert report.k == 3
        assert report.total_items == 5
        # 手算均值:recall (1+1+1+0+0)/5;precision (2/3+1/3+2/3)/5;
        # mrr (1+1/3+1)/5;hit 3/5;cp (5/6+1/3+1)/5
        ndcg_g1 = (1.0 / math.log2(2) + 1.0 / math.log2(4)) / (1.0 / math.log2(2) + 1.0 / math.log2(3))
        assert report.retrieval_means["recall_at_k"] == pytest.approx(0.6)
        assert report.retrieval_means["precision_at_k"] == pytest.approx((2 / 3 + 1 / 3 + 2 / 3) / 5)
        assert report.retrieval_means["mrr"] == pytest.approx((1 + 1 / 3 + 1) / 5)
        assert report.retrieval_means["ndcg_at_k"] == pytest.approx((ndcg_g1 + 0.5 + 1.0) / 5)
        assert report.retrieval_means["hit_rate_at_k"] == pytest.approx(0.6)
        assert report.retrieval_means["context_precision"] == pytest.approx((5 / 6 + 1 / 3 + 1) / 5)

    def test_means_fields_complete(self):
        report = run_retrieval_eval(_GOLDEN_5, _table_retriever, k=3)
        assert set(report.retrieval_means) == set(RETRIEVAL_METRIC_NAMES)
        assert set(report.retrieval_distributions) == set(RETRIEVAL_METRIC_NAMES)

    def test_per_item_traceable(self):
        report = run_retrieval_eval(_GOLDEN_5, _table_retriever, k=3)
        assert [r.question_id for r in report.per_item] == ["g1", "g2", "g3", "g4", "g5"]
        by_id = {r.question_id: r for r in report.per_item}
        assert by_id["g1"].retrieved_ids == ["A", "C", "B"]  # 表截断至 k=3
        assert by_id["g1"].difficulty == "easy"
        assert by_id["g5"].difficulty == "adversarial"
        assert all(v == 0.0 for v in by_id["g4"].retrieval_metrics.values())
        assert all(v == 0.0 for v in by_id["g5"].retrieval_metrics.values())

    def test_distributions_sum_to_total(self):
        report = run_retrieval_eval(_GOLDEN_5, _table_retriever, k=3)
        for name, dist in report.retrieval_distributions.items():
            assert sum(dist.values()) == 5, name
        # recall 分布:3 个 1.0 + 2 个 0.0
        assert report.retrieval_distributions["recall_at_k"]["0.8-1.0"] == 3
        assert report.retrieval_distributions["recall_at_k"]["0.0-0.2"] == 2

    def test_report_json_serializable(self):
        report = run_retrieval_eval(_GOLDEN_5, _table_retriever, k=3)
        d = report.to_dict()
        json.dumps(d)  # 不抛异常
        assert d["per_item"][0]["question_id"] == "g1"


# =============================================================================
# schema 校验
# =============================================================================


def _write_jsonl(tmp_path: Path, rows: list[dict], name: str = "golden.jsonl") -> Path:
    p = tmp_path / name
    p.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")
    return p


def _valid_row(qid: str = "q1", **overrides) -> dict:
    row = {
        "question_id": qid,
        "question": f"问题-{qid}",
        "ground_truth_answer": "答案",
        "expected_chunk_ids": ["chunk-1"],
        "source_doc_id": "doc-1",
        "difficulty": "easy",
    }
    row.update(overrides)
    return row


class TestGoldenSchemaValidation:
    def test_valid_set_passes(self, tmp_path):
        rows = [
            _valid_row("q1"),
            _valid_row("q2", difficulty="multi-hop", tags=["a", "b"]),
            _valid_row("q3", difficulty="adversarial", expected_chunk_ids=[]),
        ]
        result = validate_golden_set(_write_jsonl(tmp_path, rows))
        assert result.ok is True
        assert result.total_lines == 3
        assert [it.question_id for it in result.items] == ["q1", "q2", "q3"]
        assert result.items[2].expected_chunk_ids == []

    def test_invalid_rows_rejected_with_line_located_errors(self, tmp_path):
        missing = _valid_row("q2")
        del missing["expected_chunk_ids"]  # 缺 expected_chunk_ids
        rows = [
            _valid_row("q1"),
            missing,
            _valid_row("q3", question=""),  # 空 question
            _valid_row("q4", difficulty="hard"),  # 非法 difficulty
            _valid_row("q1"),  # question_id 重复
        ]
        result = validate_golden_set(_write_jsonl(tmp_path, rows))

        assert result.ok is False
        by_line = {}
        for issue in result.issues:
            by_line.setdefault(issue.line, []).append(issue.field)
        assert "expected_chunk_ids" in by_line[2]
        assert "question" in by_line[3]
        assert "difficulty" in by_line[4]
        assert "question_id" in by_line[5]
        # 合法行仍被收集(一次看全,不是遇错即停)
        assert [it.question_id for it in result.items] == ["q1"]

    def test_report_text_readable(self, tmp_path):
        rows = [_valid_row("q1", question="   "), _valid_row("q2", expected_chunk_ids=[])]
        result = validate_golden_set(_write_jsonl(tmp_path, rows))
        text = result.report_text()
        assert "校验失败" in text
        assert "第 1 行 [question]" in text
        assert "第 2 行 [expected_chunk_ids]" in text

    def test_json_parse_error_located(self, tmp_path):
        p = tmp_path / "bad.jsonl"
        p.write_text("{not-json}\n", encoding="utf-8")
        result = validate_golden_set(p)
        assert result.ok is False
        assert result.issues[0].line == 1
        assert "JSON 解析失败" in result.issues[0].message

    def test_difficulty_enum_closed(self):
        assert DIFFICULTIES == ("easy", "multi-hop", "adversarial")


# =============================================================================
# 与骨架 metrics.py 交叉验证(同批样例逐指标数值相等)
# =============================================================================

_SCAFFOLD_EVAL_DIR = Path(__file__).resolve().parents[3] / ".ihui-agent" / "tmp" / "kb-rag-scaffold" / "eval"

# 覆盖正常 / 边界 / 重复 ID / 短返回 / k<=0 / 全不中 的样例集
_CROSS_SAMPLES: list[tuple[list[str], list[str], int]] = [
    (["c1", "c2", "c3"], ["c2", "c5"], 3),
    (["A", "C", "B", "D"], ["A", "B"], 3),
    (["Y", "Z", "X", "W"], ["X"], 3),
    (["Q", "P"], ["P", "Q"], 3),
    (["N", "O", "P"], ["M"], 3),
    (["A", "B", "C"], [], 3),
    ([], ["x"], 3),
    (["a", "a", "b"], ["a"], 3),
    (["a", "b", "c", "d", "e"], ["e", "c"], 10),
    (["a"], ["a"], 0),
    (["a"], ["a"], -2),
    (["x", "y"], ["y", "x", "z"], 2),
]


def _load_scaffold_metrics():
    if not (_SCAFFOLD_EVAL_DIR / "metrics.py").is_file():
        pytest.skip(f"骨架 metrics.py 不存在: {_SCAFFOLD_EVAL_DIR}")
    sys.path.insert(0, str(_SCAFFOLD_EVAL_DIR))
    try:
        import metrics as scaffold_metrics
    finally:
        sys.path.remove(str(_SCAFFOLD_EVAL_DIR))
    return scaffold_metrics


class TestScaffoldCrossValidation:
    @pytest.mark.parametrize(("retrieved", "relevant", "k"), _CROSS_SAMPLES)
    def test_each_metric_bitwise_equal_to_scaffold(self, retrieved, relevant, k):
        sm = _load_scaffold_metrics()
        prod = compute_retrieval_metrics(retrieved, relevant, k)
        scaffold = {
            "recall_at_k": sm.recall_at_k(retrieved, relevant, k),
            "precision_at_k": sm.precision_at_k(retrieved, relevant, k),
            "mrr": sm.mrr(retrieved, relevant),
            "ndcg_at_k": sm.ndcg_at_k(retrieved, relevant, k),
            "hit_rate_at_k": sm.hit_rate_at_k(retrieved, relevant, k),
            "context_precision": sm.context_precision(retrieved, relevant),
        }
        assert prod == scaffold  # 逐指标数值完全相等(同一套纯函数实现)

    def test_metric_name_sets_match(self):
        sm = _load_scaffold_metrics()
        assert RETRIEVAL_METRIC_NAMES == sm.RETRIEVAL_METRIC_NAMES
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
