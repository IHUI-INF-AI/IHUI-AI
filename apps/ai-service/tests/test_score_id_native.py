# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`id_native` 同 id 索引打分的钉(goal-b47)。

钉的是"这条轨是怎么被点亮的":①id 全部由本仓切块器现算(不是抄来的表);
②金标 id 的复现率有下限,漏的那一枚必须是点名的陈旧 id;③指标一律走 `retrieval_eval`;
④判不了的题必须给出名字化的原因,不许静默消失。全部零连库、零网络。
"""

from __future__ import annotations

import inspect
import json
from pathlib import Path

from app.services import retrieval_eval
from bench import run_retrieval_golden as RRG
from bench import score_id_native as SIN

REPO = Path(__file__).resolve().parents[3]
STALE_ID = "93d1a33883fd30d9"


def _index() -> SIN.SameIdIndex:
    texts = {}
    for doc_id, rel in RRG.CORPUS_DOCS.items():
        path = REPO / rel
        if path.is_file():
            texts[doc_id] = path.read_text(encoding="utf-8")
    return SIN.build_same_id_index(texts)


def test_ids_are_the_ones_our_chunker_produces_not_a_copied_table():
    index = _index()
    assert index.corpus.leaves, "同 id 索引必须真造得出块"
    assert all(len(cid) == 16 and all(c in "0123456789abcdef" for c in cid) for cid in index.universe)
    assert all(n > 0 for n in index.per_doc_parents.values())
    assert json.loads(json.dumps({"cfg": index.config_note}))["cfg"].startswith("config=")


def test_gold_id_reproduction_is_27_of_28_with_the_stale_one_named():
    index = _index()
    items = SIN.load_questions()
    gold = {cid for it in items for cid in it.expected_chunk_ids}
    reproduced = gold & index.universe
    assert len(gold) == 28, f"金标Distinct id 数漂了(现读 {len(gold)})"
    assert len(reproduced) == 27, f"复现率不是 27/28(现读 {len(reproduced)})"
    unmatched = sorted(gold - index.universe)
    assert unmatched == [STALE_ID], f"未复现的应当只有那枚已知陈旧 id,实得 {unmatched}"
    # 陈旧因由:该题金标写「9 端同源」而现文是「8 端同源」⇒ id 随正文变过(同族数据缺陷一票)
    q = next(it for it in items if STALE_ID in it.expected_chunk_ids)
    assert q.question_id == "q-1194d4444087"


def test_metrics_come_from_retrieval_eval_and_no_second_formula_lives_here():
    src = inspect.getsource(SIN)
    for name in ("def recall_at_k", "def precision_at_k", "def mrr", "def ndcg_at_k"):
        assert name not in src, f"{name} 在本件里被重抄了一份(§0.6 单源要求)"
    for fn in (
        retrieval_eval.recall_at_k,
        retrieval_eval.precision_at_k,
        retrieval_eval.mrr,
        retrieval_eval.ndcg_at_k,
        retrieval_eval.hit_rate_at_k,
    ):
        assert fn.__module__ == "app.services.retrieval_eval"


def test_track_is_lit_and_unjudged_items_still_carry_a_reason():
    result = SIN.score_id_native(SIN.load_questions(), _index())
    assert result["judged"] > 0, "同 id 索引接好后这条轨必须可判,不得再是 0 判定"
    assert result["judged"] + result["unjudged"] == result["golden_questions"]
    reasons = {r.get("reason") for r in result["per_question"] if r["status"] == "unjudged"}
    assert all(r for r in reasons), f"未判定条目必须带原因名,实得 {reasons}"
    m = result["metrics"]
    for key in ("recall@5", "mrr", "precision@5", "ndcg@5"):
        assert isinstance(m[key], float) and 0.0 <= m[key] <= 1.0


def test_scoring_matches_retrieval_eval_arithmetic_on_a_stub_ranker():
    index = _index()
    ids = sorted(index.universe)[:2]
    items = [SIN.Question(question_id="q-x", question="anything", expected_chunk_ids=[ids[0]])]
    out = SIN.score_id_native(items, index, ranker=lambda _q, _c, _k: [ids[1], ids[0]])
    row = next(r for r in out["per_question"] if r["question_id"] == "q-x")
    assert row["recall@1"] == 0.0 and row["recall@3"] == 1.0, "档位表是 (1,3,5,10),不许假设有 @2"
    assert row["mrr"] == retrieval_eval.mrr([ids[1], ids[0]], [ids[0]])
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
