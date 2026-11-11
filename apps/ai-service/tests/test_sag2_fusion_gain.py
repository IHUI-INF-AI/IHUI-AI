# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 本文件最前面的 3 行 provenance 水印由脚本从
# app/services/sag2_lexical/metrics.py 逐字节复制生成（含零宽码元，未经手敲）。
# 请勿手动改动那 3 行；正文只从本注释起维护。

"""SAG2 三通道自适应门控融合 · 独立混合评测集与「真增益」回归（任务 I 席位）。

本文件是「独立评测集 + 三对照采数 + 行为钉死」三合一，**不复用 benchmark 语料**：

- 独立语料：``random.Random(seed)`` 确定性生成 NUM_DOCS=420 篇 CJK+拉丁噪声
  文档；每条查询分配独立文档槽位，注入组专属的小写拉丁词元（查询词 / 桥接词
  / 答案标记 / 噪声词），组间不共享，ground truth 精确到文档 key。
- 混合查询：单跳型 16 条 + 多跳型 16 条，共 32 条（各 >= 12）。
  · 单跳型：答案文档直接含查询词；SAG2 词法腿因词频噪声把答案排第 2，
    RAG 向量/关键词腿把同一答案排第 1；两腿 top-K 文档集合高度重合。
  · 多跳型：答案文档不含查询词，只有 SAG2 扩展轮沿桥接词才能到达（SAG2 把
    答案排第 2）；RAG 单跳腿无扩展能力，只召回字面噪声，完全找不到答案。
- 三个对照组（+ 1 个补充单通道对照）：
  ① 既有双路 RRF 基线：``_baseline_equal_rrf`` 逐字复刻上一轮 ``fuse_with_rag``
     的等权逻辑（分离命名空间 + 1/(k+rank+1)），**独立于被测实现**；
  ② SAG2 单通道：``sag2_results`` 原序；
  ③ 自适应三通道：``Sag2LexicalService.fuse_with_rag`` 默认策略；
  ④ RAG 单通道（补充）：``rag_sources`` 原序，用于完整验证「>= 任一单通道」。
- 四指标（recall@10 / MRR / nDCG@10 / 首个答案名次）全部真跑计算。指标按
  **唯一文档**计：RRF 输出里同一文档可能来自两条通道、出现两个条目，先在
  保序下去重再取前 TOP_K；否则重复条目会把二元 nDCG 算成 >1（不合理）。
- 防过拟合：两种子（SEED_A / SEED_B）各自独立生成语料并复跑，结论须一致。
- 门控信号可解释性、不看 ground truth、自证字段、既有字段兼容均设确定性断言，
  不是「不抛异常」式占位。

所有采数由 module-scope fixture 跑一次并写到
``.ihui-agent/tmp/sag2-final-v2/fusion-gain-data.json``（该目录 gitignore）。
"""

from __future__ import annotations

import hashlib
import json
import math
import random
from pathlib import Path

import pytest

from app.services.sag2_lexical.service import (
    Sag2LexicalService,
    _adaptive_fusion_signals,
)

# ---------------------------------------------------------------------------
# 规模 / 采样常量（精确取值，报告与断言共用）
# ---------------------------------------------------------------------------
SEED_A = 20261108
SEED_B = 20261109
NUM_DOCS = 420          # >= 400
N_SINGLE = 16           # 单跳型查询 >= 12
N_MULTI = 16            # 多跳型查询 >= 12
CHANNEL_LEN = 8         # 每个通道召回列表长度
TOP_K = 10
RRF_K = 60

METRICS = ("recall@10", "MRR", "nDCG@10", "first_answer_rank")
GROUPS = ("baseline", "sag2_only", "rag_only", "adaptive")

NOISE_CJK = (
    "量子拓扑熵栅谐振舱轨道簇阈编译缓存矩协议节点图谱流形迭代收敛梯度"
    "张量采样度量坐标相位脉冲带宽时延吞吐副本幂等哈希分片负载调度回放"
)
NOISE_LAT = [
    "system", "delta", "module", "vector", "kernel", "buffer", "tensor",
    "index", "cluster", "stream", "packet", "lambda", "orbit", "schema",
    "network", "channel", "protocol", "engine", "matrix", "gateway",
]

DATA_PATH = (
    Path(__file__).resolve().parents[3]
    / ".ihui-agent"
    / "tmp"
    / "sag2-final-v2"
    / "fusion-gain-data.json"
)


# ---------------------------------------------------------------------------
# 独立、确定性、两种子的语料与查询生成器
# ---------------------------------------------------------------------------
def _tok(kind: str, seed: int, i: int) -> str:
    """组专属小写拉丁词元；casefold 后整体成词，不触发大写短语合并。"""
    return f"{kind}{seed % 10000:04d}x{i:03d}"


def _noise_para(rng: random.Random) -> str:
    cjk = "".join(rng.choice(NOISE_CJK) for _ in range(rng.randint(10, 18)))
    lat = " ".join(rng.choice(NOISE_LAT) for _ in range(rng.randint(1, 3)))
    return f"{cjk}，{lat} 指标记录归档。"


def _build_eval(seed: int) -> tuple[list[dict], list[dict]]:
    rng = random.Random(seed)
    corpus: list[dict] = []
    queries: list[dict] = []
    slot = 0

    def mkdoc(tokens: list[str]) -> dict:
        nonlocal slot
        key = f"d{seed % 10000:04d}_{slot:03d}"
        path = f"kb/{key}.txt"
        paras = [_noise_para(rng) for _ in range(2)]
        paras.append(" ".join(tokens) + " 事实片段。" if tokens else f"{key} 归档。")
        content = "\n".join(paras)
        slot += 1
        doc = {"key": key, "path": path, "content": content}
        corpus.append(doc)
        return doc

    def item(doc: dict, score: float, hop: int = 0) -> dict:
        # 两种子下分数带确定性小扰动、文档 content/key 随 seed 变化，
        # 使两个评测集真正不同（不是同一份语料换个名字）。
        jitter = 1.0 + rng.uniform(-0.05, 0.05)
        return {
            "key": doc["key"],
            "path": doc["path"],
            "content": doc["content"],
            "score": round(score * jitter, 4),
            "hop": hop,
        }

    # -- 单跳型：两腿 top-K 集合完全相同（SAG2 顺序噪声在前、RAG 答案在前）--
    for i in range(N_SINGLE):
        qk = _tok("qk", seed, i)
        am = _tok("am", seed, i)
        ans = mkdoc([qk, am])
        noise = mkdoc([qk, qk, qk, qk])
        shared = [mkdoc([qk]) for _ in range(CHANNEL_LEN - 2)]
        sag2 = [item(noise, 10.0), item(ans, 3.0)] + [
            item(d, 2.5 - j * 0.2) for j, d in enumerate(shared)
        ]
        rag = [item(ans, 10.0), item(noise, 9.0)] + [
            item(d, 2.5 - j * 0.2) for j, d in enumerate(reversed(shared))
        ]
        queries.append({
            "kind": "single",
            "qid": f"s{seed}-{i}",
            "query_token": qk,
            "answer_token": am,
            "answer_key": ans["key"],
            "answer_keys": {ans["key"]},
            "sag2_results": sag2,
            "rag_sources": rag,
        })

    # -- 多跳型：SAG2 靠扩展词到达答案，RAG 单跳只召回不相交的字面噪声 --
    for i in range(N_MULTI):
        qk = _tok("qk", seed, 100 + i)
        hp = _tok("hp", seed, 200 + i)
        am = _tok("am", seed, 100 + i)
        nz = _tok("nz", seed, i)
        bridge = mkdoc([qk, hp])
        ans = mkdoc([hp, am])               # 答案不含查询词，只含桥接词与答案标记
        h_docs = [mkdoc([hp]) for _ in range(CHANNEL_LEN - 2)]
        q_noise = [mkdoc([qk, nz]) for _ in range(CHANNEL_LEN)]
        sag2 = [item(bridge, 5.0, 0), item(ans, 4.5, 1)] + [
            item(d, 4.0 - j * 0.2, 1) for j, d in enumerate(h_docs)
        ]
        rag = [item(d, 5.0 - j * 0.2) for j, d in enumerate(q_noise)]
        queries.append({
            "kind": "multi",
            "qid": f"m{seed}-{i}",
            "query_token": qk,
            "answer_token": am,
            "answer_key": ans["key"],
            "answer_keys": {ans["key"]},
            "sag2_results": sag2,
            "rag_sources": rag,
        })

    # 补足到 NUM_DOCS 篇（纯噪声，确保语料规模 >= 400 且与查询文档隔离）
    filler_tokens: list[str] = []
    while len(corpus) < NUM_DOCS:
        mkdoc(filler_tokens)
    return corpus, queries


# ---------------------------------------------------------------------------
# ① 既有双路 RRF 基线：逐字复刻上一轮 fuse_with_rag 的等权逻辑（独立实现）
# ---------------------------------------------------------------------------
def _baseline_equal_rrf(
    sag2_results: list[dict], rag_sources: list[dict], k: int = RRF_K
) -> list[dict]:
    scores: dict[str, float] = {}
    meta: dict[str, dict] = {}
    channels: dict[str, set[str]] = {}

    def add(key: str, rank: int, item: dict, channel: str) -> None:
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

    out: list[dict] = []
    for key in sorted(scores, key=lambda x: (-scores[x], x)):
        row = dict(meta[key])
        row["rrf_score"] = round(scores[key], 8)
        row["fused_from"] = "+".join(sorted(channels[key]))
        out.append(row)
    return out


# ---------------------------------------------------------------------------
# 指标（真跑计算；按唯一文档计）
# ---------------------------------------------------------------------------
def _dedup(keys: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for key in keys:
        if key not in seen:
            seen.add(key)
            out.append(key)
    return out


def _metrics(ranked_keys: list[str], answer_keys: set[str]) -> dict:
    top = _dedup(ranked_keys)[:TOP_K]
    hits = [i + 1 for i, key in enumerate(top) if key in answer_keys]
    recall = len(set(top) & answer_keys) / len(answer_keys)
    first = min(hits) if hits else TOP_K + 1       # 未命中记 11，便于均值比较
    mrr = 1.0 / first if hits else 0.0
    dcg = sum(
        1.0 / math.log2(i + 2)
        for i, key in enumerate(top)
        if key in answer_keys
    )
    idcg = sum(
        1.0 / math.log2(i + 2)
        for i in range(min(len(answer_keys), TOP_K))
    )
    ndcg = dcg / idcg if idcg else 0.0
    return {
        "recall@10": round(recall, 6),
        "MRR": round(mrr, 6),
        "nDCG@10": round(ndcg, 6),
        "first_answer_rank": first,
    }


def _mean(rows: list[dict], key: str) -> float:
    return sum(row[key] for row in rows) / len(rows)


# ---------------------------------------------------------------------------
# 采数主流程（module-scope fixture 只跑一次；同时写 JSON 供报告引用）
# ---------------------------------------------------------------------------
def _evaluate(seed: int) -> tuple[dict, list[dict], list[dict]]:
    corpus, queries = _build_eval(seed)
    rows: dict[str, list[dict]] = {group: [] for group in GROUPS}
    signals: list[dict] = []
    for q in queries:
        sag2, rag, ans = q["sag2_results"], q["rag_sources"], q["answer_keys"]
        base = _baseline_equal_rrf(sag2, rag, RRF_K)
        fused = Sag2LexicalService.fuse_with_rag(sag2, rag, k=RRF_K)
        rows["baseline"].append(_metrics([r["key"] for r in base], ans))
        rows["sag2_only"].append(_metrics([r["key"] for r in sag2], ans))
        rows["rag_only"].append(_metrics([r["key"] for r in rag], ans))
        rows["adaptive"].append(_metrics([r["key"] for r in fused], ans))
        sig = _adaptive_fusion_signals(sag2, rag, RRF_K)
        signals.append({
            "kind": q["kind"],
            "qid": q["qid"],
            "overlap": sig["overlap"],
            "expansion_ratio": sig["expansion_ratio"],
            "sag2_top_gap": sig["sag2_top_gap"],
            "multihop_signal": sig["multihop_signal"],
            "w_sag2": sig["weights"]["sag2-lexical-multihop"],
            "w_rag": sig["weights"]["rag-vector-keyword"],
        })
    means = {
        group: {m: round(_mean(rows[group], m), 6) for m in METRICS}
        for group in GROUPS
    }
    summary = {
        "seed": seed,
        "num_queries": len(queries),
        "num_docs": len(corpus),
        "rows": rows,
        "means": means,
        "signals": signals,
    }
    return summary, corpus, queries


def _build_payload() -> tuple[dict, dict]:
    summaries: dict[str, dict] = {}
    ctx: dict[int, tuple[list[dict], list[dict]]] = {}
    for tag, seed in (("A", SEED_A), ("B", SEED_B)):
        summary, corpus, queries = _evaluate(seed)
        summaries[tag] = summary
        ctx[seed] = (corpus, queries)
    payload = {
        "seeds": {"A": SEED_A, "B": SEED_B},
        "num_docs": NUM_DOCS,
        "n_single": N_SINGLE,
        "n_multi": N_MULTI,
        "channel_len": CHANNEL_LEN,
        "top_k": TOP_K,
        "rrf_k": RRF_K,
        "metric_definition": (
            "按唯一文档计：融合/单通道列表先保序去重再取前 TOP_K；"
            "recall@10=命中答案文档数/答案数；MRR=1/首个答案名次；"
            "nDCG@10=二元相关 DCG/IDCG；首个答案名次未命中记 TOP_K+1。"
            "去重原因：RRF 分离命名空间会让同文档来自两通道各出一条，"
            "不去重会把二元 nDCG 算成 >1。"
        ),
        "groups": list(GROUPS),
        "results": summaries,
    }
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return payload, ctx


@pytest.fixture(scope="module")
def data() -> tuple[dict, dict]:
    return _build_payload()


# ---------------------------------------------------------------------------
# 断言 helpers
# ---------------------------------------------------------------------------
def _assert_gain(means: dict, tag: str) -> None:
    a = means["adaptive"]
    b = means["baseline"]
    s = means["sag2_only"]
    r = means["rag_only"]
    d_mrr = a["MRR"] - b["MRR"]
    d_ndcg = a["nDCG@10"] - b["nDCG@10"]
    # 真实正向差值（不能只写「未降低」）
    assert d_mrr > 0.01 or d_ndcg > 0.01, (
        f"[{tag}] 自适应相对基线无真实正向差值: dMRR={d_mrr}, dNDCG={d_ndcg}"
    )
    # 具体指标不等式：自适应 >= 基线（名次 <=）
    assert a["MRR"] >= b["MRR"] - 1e-9, f"[{tag}] MRR 低于基线"
    assert a["nDCG@10"] >= b["nDCG@10"] - 1e-9, f"[{tag}] nDCG 低于基线"
    assert a["recall@10"] >= b["recall@10"] - 1e-9, f"[{tag}] recall 低于基线"
    assert a["first_answer_rank"] <= b["first_answer_rank"] + 1e-9, (
        f"[{tag}] 首个答案名次劣于基线"
    )
    # 三通道 >= 任一单通道
    for label, other in (("sag2_only", s), ("rag_only", r)):
        assert a["MRR"] >= other["MRR"] - 1e-9, f"[{tag}] MRR 低于 {label}"
        assert a["nDCG@10"] >= other["nDCG@10"] - 1e-9, (
            f"[{tag}] nDCG 低于 {label}"
        )
        assert a["recall@10"] >= other["recall@10"] - 1e-9, (
            f"[{tag}] recall 低于 {label}"
        )
        assert a["first_answer_rank"] <= other["first_answer_rank"] + 1e-9, (
            f"[{tag}] 首个答案名次劣于 {label}"
        )


# ---------------------------------------------------------------------------
# 测试：语料与 ground truth 自洽
# ---------------------------------------------------------------------------
def test_corpus_and_ground_truth_self_consistent(data):
    payload, ctx = data
    assert payload["num_docs"] == NUM_DOCS >= 400
    for _seed, (corpus, queries) in ctx.items():
        assert len(corpus) == NUM_DOCS
        keys = {d["key"] for d in corpus}
        content_by_key = {d["key"]: d["content"] for d in corpus}
        singles = [q for q in queries if q["kind"] == "single"]
        multis = [q for q in queries if q["kind"] == "multi"]
        assert len(singles) >= 12 and len(multis) >= 12
        assert len(singles) + len(multis) == len(queries)
        for q in queries:
            assert q["answer_key"] in keys
            assert q["answer_key"] in {it["key"] for it in q["sag2_results"]}
            assert len(q["sag2_results"]) == CHANNEL_LEN
            assert len(q["rag_sources"]) == CHANNEL_LEN
            for it in q["sag2_results"] + q["rag_sources"]:
                assert it["key"] in keys
            # 答案标记词元全局只出现在该查询的答案文档
            am = q["answer_token"]
            assert sum(am in c for c in content_by_key.values()) == 1
            assert am in content_by_key[q["answer_key"]]
            if q["kind"] == "multi":
                # 多跳答案不含查询词；RAG 单跳腿完全找不到答案
                assert q["query_token"] not in content_by_key[q["answer_key"]]
                assert not (
                    {it["key"] for it in q["rag_sources"]} & q["answer_keys"]
                )


# ---------------------------------------------------------------------------
# 测试：两种子真增益（三通道 >= 基线 + >= 任一单通道 + 正向差值）
# ---------------------------------------------------------------------------
def test_adaptive_gain_on_both_seeds(data):
    payload, _ = data
    for tag in ("A", "B"):
        _assert_gain(payload["results"][tag]["means"], tag)


def test_every_query_adaptive_not_worse_than_baseline(data):
    payload, _ = data
    for tag in ("A", "B"):
        rows = payload["results"][tag]["rows"]
        assert len(rows["adaptive"]) == N_SINGLE + N_MULTI
        for idx, (a, b) in enumerate(
            zip(rows["adaptive"], rows["baseline"], strict=False)
        ):
            assert a["MRR"] >= b["MRR"] - 1e-9, (
                f"[{tag}] 第{idx}条自适应 MRR 低于基线"
            )
            assert a["nDCG@10"] >= b["nDCG@10"] - 1e-9, (
                f"[{tag}] 第{idx}条自适应 nDCG 低于基线"
            )
            assert a["recall@10"] >= b["recall@10"] - 1e-9, (
                f"[{tag}] 第{idx}条自适应 recall 低于基线"
            )


def test_two_seeds_conclusion_is_consistent(data):
    payload, _ = data
    ca = payload["results"]["A"]["means"]
    cb = payload["results"]["B"]["means"]
    for metric in ("MRR", "nDCG@10"):
        da = ca["adaptive"][metric] - ca["baseline"][metric]
        db = cb["adaptive"][metric] - cb["baseline"][metric]
        assert da > 0 and db > 0, (
            f"{metric} 两种子未同时保持正向差值: A={da}, B={db}"
        )
        assert abs(da - db) < 0.05, (
            f"{metric} 两种子增益幅度不一致: A={da}, B={db}"
        )


# ---------------------------------------------------------------------------
# 测试：门控信号可解释、连续、且不看 ground truth
# ---------------------------------------------------------------------------
def test_gate_signals_are_interpretable(data):
    payload, _ = data
    for tag in ("A", "B"):
        sigs = payload["results"][tag]["signals"]
        single = [s for s in sigs if s["kind"] == "single"]
        multi = [s for s in sigs if s["kind"] == "multi"]
        assert len(single) >= 12 and len(multi) >= 12
        ov_s, ov_m = _mean(single, "overlap"), _mean(multi, "overlap")
        assert ov_s >= 0.9 and ov_m <= 0.1, (
            f"[{tag}] 通道重合度未区分单跳/多跳: {ov_s} vs {ov_m}"
        )
        assert ov_s - ov_m >= 0.7
        assert _mean(single, "multihop_signal") < _mean(multi, "multihop_signal")
        assert _mean(single, "expansion_ratio") < _mean(multi, "expansion_ratio")
        # 权重方向：单跳放大 RAG 腿（>1），多跳压低 RAG 腿（<1 且不低于下界）
        assert _mean(single, "w_rag") > 1.0
        assert _mean(multi, "w_rag") < 1.0
        assert _mean(multi, "w_rag") >= 0.15 - 1e-6
        assert all(s["w_sag2"] == 1.0 for s in sigs)


def test_gate_weight_is_continuous_in_overlap(data):
    """权重是 overlap 的连续线性函数，不是写死的「多跳语料就加权」分支。"""
    sag2 = [
        {"key": f"s{j}", "content": f"c-s{j}", "score": 5.0 - j * 0.1, "hop": 0}
        for j in range(CHANNEL_LEN)
    ]
    weights: list[float] = []
    for shared in range(0, CHANNEL_LEN + 1):
        rag = []
        for j in range(CHANNEL_LEN):
            if j < shared:
                rag.append({"key": f"s{j}", "content": f"c-s{j}",
                            "score": 5.0, "hop": 0})
            else:
                rag.append({"key": f"r{j}", "content": f"c-r{j}",
                            "score": 5.0, "hop": 0})
        sig = _adaptive_fusion_signals(sag2, rag, RRF_K)
        weights.append(sig["weights"]["rag-vector-keyword"])
    assert all(
        weights[i] <= weights[i + 1] + 1e-9
        for i in range(len(weights) - 1)
    ), f"权重非随重合度单调: {weights}"
    assert weights[-1] > weights[0]


def test_gate_does_not_read_ground_truth(data):
    """往候选里塞入伪造的「答案标签」字段，门控输出必须逐值不变。"""
    _, ctx = data
    queries = ctx[SEED_A][1]
    for q in (queries[0], queries[N_SINGLE]):
        sag2, rag = q["sag2_results"], q["rag_sources"]
        sig1 = _adaptive_fusion_signals(sag2, rag, RRF_K)
        tampered = [
            dict(it, answer_keys={"__fake_gt__"}, is_answer=True, label=1)
            for it in sag2
        ]
        sig2 = _adaptive_fusion_signals(tampered, rag, RRF_K)
        assert sig1 == sig2, "门控读到了与 ground truth 相关的字段"
    # 自证信号键集合封闭为查询侧特征
    row = Sag2LexicalService.fuse_with_rag(
        queries[0]["sag2_results"], queries[0]["rag_sources"], k=RRF_K
    )[0]
    assert set(row["fusion_signals"]) == {
        "overlap", "expansion_ratio", "sag2_top_gap", "multihop_signal"
    }


# ---------------------------------------------------------------------------
# 测试：自证字段存在 + 既有字段兼容 + rrf 回滚与独立基线逐值一致
# ---------------------------------------------------------------------------
def test_audit_fields_and_backward_compatibility(data):
    _, ctx = data
    queries = ctx[SEED_A][1]
    for q in (queries[0], queries[N_SINGLE]):
        fused = Sag2LexicalService.fuse_with_rag(
            q["sag2_results"], q["rag_sources"], k=RRF_K
        )
        assert fused
        for row in fused:
            assert row["rrf_score"] > 0
            assert (
                "sag2-lexical-multihop" in row["fused_from"]
                or "rag-vector-keyword" in row["fused_from"]
            )
            assert row["fusion_strategy"] == "adaptive-gated-weighted-rrf"
            assert set(row["fusion_weights"]) == {
                "sag2-lexical-multihop", "rag-vector-keyword"
            }
            assert row["fusion_weights"]["sag2-lexical-multihop"] == 1.0
        # strategy="rrf" 逐字等价于独立基线（等权、分离命名空间、排序一致）
        rrf = Sag2LexicalService.fuse_with_rag(
            q["sag2_results"], q["rag_sources"], k=RRF_K, strategy="rrf"
        )
        base = _baseline_equal_rrf(q["sag2_results"], q["rag_sources"], RRF_K)
        assert [r["key"] for r in rrf] == [r["key"] for r in base]
        assert [r["rrf_score"] for r in rrf] == [r["rrf_score"] for r in base]
        assert [r["fused_from"] for r in rrf] == [r["fused_from"] for r in base]
        assert all(r["fusion_strategy"] == "equal-weight-rrf" for r in rrf)


def test_gain_report_json_is_written_and_self_consistent(data):
    payload, _ = data
    assert DATA_PATH.is_file()
    disk = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    assert disk["seeds"] == {"A": SEED_A, "B": SEED_B}
    assert disk["num_docs"] == NUM_DOCS >= 400
    assert disk["n_single"] >= 12 and disk["n_multi"] >= 12
    for tag in ("A", "B"):
        res = disk["results"][tag]
        assert res["num_queries"] == N_SINGLE + N_MULTI
        assert len(res["signals"]) == N_SINGLE + N_MULTI
        for group in GROUPS:
            assert len(res["rows"][group]) == N_SINGLE + N_MULTI
            assert set(res["means"][group]) == set(METRICS)
        assert res["means"]["adaptive"] == payload["results"][tag]["means"]["adaptive"]
