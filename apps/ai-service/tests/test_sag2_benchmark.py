# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 本文件最前面的 3 行 provenance 水印与末尾 1 行零宽标记，由脚本从
# tests/test_sag2_lexical.py 逐字节复制生成（含零宽码元，未经手敲）。
# 请勿手动改动那 4 行；正文只从本注释起维护。

"""SAG2 词法通道·大规模延迟 / 召回基准与取消预算实测（P5 独立席位）。

本文件是「行为钉死 + 真跑采数」二合一：

- 可复现语料：``random.Random(SEED)`` 生成 NUM_DOCS 篇 CJK + 拉丁混合段落
  文档；其中每组注入已知「答案片段」，答案文档与噪声文档用组专属词元隔离，
  使 recall 口径可精确计算、且多跳链路在大规模噪声下仍可达答案文档。
- 延迟基准：建库 / 单次 candidate_query 粗筛 / search 等价路径 / 完整 retrieve
  多跳，各重复 REPEATS 次，报 p50 / p95 / max（线性插值分位）。
- 召回基准：每组用 retrieve 的 citations 计算 recall@TOP_K（命中 = citation
  的 path 指向该组答案文档），并与纯 candidate_query 单跳对照。
- 取消 / 预算实测：立即取消、第 N 次才取消、judge_pool_budget 截断三组，
  如实记录 status 与 paths 原文（不改写、不粉饰）。

所有实测数据由 ``_run_all()`` 采出并写到
``.ihui-agent/tmp/sag2-benchmark-report.json``（该目录 gitignore）。
断言用宽松阈值（取自本次实测 p50 的合理倍数）只钉 p50，避免 CI 机器抖动
假红；功能正确性由确定性断言钉死。「未判定绝不写成判过」：budget 字面留痕
缺失一事在报告里单独如实登记。

本席位零修改任何既有文件；本文件可独立运行：
    ./.venv/Scripts/python.exe tests/test_sag2_benchmark.py
"""

from __future__ import annotations

import asyncio
import datetime
import json
import math
import random
import time
from pathlib import Path

import pytest

from app.services.sag2_lexical import (
    LexicalIndex,
    LexicalOnlyJudge,
    Sag2LexicalService,
    Sag2Options,
    match_query,
    retrieve,
)
from app.services.sag2_lexical.retrieval import STATUS_CANCELLED, STATUS_OK

# ---------------------------------------------------------------------------
# 规模 / 采样常量（精确取值，报告与断言共用）
# ---------------------------------------------------------------------------
SEED = 20261108
NUM_DOCS = 400
PARAS_PER_DOC = 3
NUM_GROUPS = 4
ANSWERS_PER_GROUP = 3
REPEATS = 9
CANDIDATE_K = 100
TOP_K = 10
SEED_K = 10
JUDGE_POOL_BUDGET = 3

# 阈值依据：两轮真跑实测 p50 —— 首轮探针 build~287ms / retrieve~2.05ms，
# 本 pytest 运行 build~404ms / retrieve~2.82ms（逐值见报告 JSON）；
# candidate_query / search 为 0.003 / 0.010ms 量级。
# 取较慢那轮 p50 的约 7 倍以上（build 3000ms≈404×7.4、retrieve 200ms≈2.82×71），
# 微秒级阶段用 50ms 绝对地板；只断言 p50 <= ceiling、不卡 max，
# 留足机器抖动余量，避免 CI 假红；性能退化一个数量级以上才红。
CEILING_MS = {
    "build_index": 3000.0,
    "candidate_query": 50.0,
    "search": 50.0,
    "retrieve_multihop": 200.0,
}

# 噪声语料字表 / 词表（确定性随机源；与注入文档的组专属词元完全不重叠，
# 避免通用 CJK bigram 把候选池淹没 —— 这是 v1 探针 recall=0 的根因）。
NOISE_CJK = (
    "量子拓扑熵栅谐振舱轨道簇阈编译缓存矩协议节点图谱流形迭代收敛梯度"
    "张量采样度量坐标相位脉冲带宽时延吞吐副本幂等哈希分片负载调度回放"
)
NOISE_LAT = [
    "system", "delta", "module", "vector", "kernel", "buffer", "tensor",
    "index", "cluster", "stream", "packet", "lambda", "orbit", "schema",
    "network", "channel", "protocol", "engine", "matrix", "gateway",
]
# 每组 2 个罕见 CJK 字（噪声字表绝不含），组间不共享 ⇒ 不跨组串扰。
GROUP_CJK = ["榫卯", "釉箔", "篆砚", "磬铎"]

REPORT_PATH = (
    Path(__file__).resolve().parents[3]
    / ".ihui-agent"
    / "tmp"
    / "sag2-benchmark-report.json"
)


# ---------------------------------------------------------------------------
# 可复现语料生成器
# ---------------------------------------------------------------------------
def _noise_para(rng: random.Random) -> str:
    cjk = "".join(rng.choice(NOISE_CJK) for _ in range(rng.randint(10, 18)))
    lat = " ".join(rng.choice(NOISE_LAT) for _ in range(rng.randint(1, 3)))
    return f"{cjk}，{lat} 指标记录归档。"


def _special_doc(rng: random.Random, g: int, toks: tuple[str, str]) -> str:
    """桥接 / 答案文档：含 CJK + 拉丁混合段落，且只用组专属词元。

    ``toks`` 为 (tokA, tokB)。两 token 之间插入小写隔离词 ``relay{g}``，
    刻意打断 name_phrases 的「连续大写短语」识别 —— 否则 "QTOKEN0 BRIDGE0"
    会被合并成短语词项，而倒排里不存在该 key，桥接词会静默丢失（v1 实测）。
    """
    tok_a, tok_b = toks
    relay = f"relay{g}"
    zchars = GROUP_CJK[g % len(GROUP_CJK)]

    def zc(n: int) -> str:
        return "".join(rng.choice(zchars) for _ in range(n))

    token_para = f"{tok_a} {relay} {tok_b}. {tok_a} {relay} {tok_b} {tok_a}."
    mix_para = f"{zc(8)}，{relay} {zc(5)}。{relay} {zc(6)}。"
    return "\n".join([token_para, mix_para, f"{relay} {zc(7)}。"])


def _gen_corpus() -> tuple[list[tuple[str, str]], list[dict]]:
    rng = random.Random(SEED)
    groups: list[dict] = []
    for g in range(NUM_GROUPS):
        groups.append(
            {
                "group": g,
                "q_token": f"QTOKEN{g}",
                "bridge_token": f"BRIDGE{g}",
                "answer_token": f"ANSWERMARK{g}",
                "query": f"QTOKEN{g}",
                "answer_paths": set(),
                "bridge_path": "",
            }
        )
    special: dict[str, tuple[int, tuple[str, str]]] = {}
    slot = 0
    for grp in groups:
        g = grp["group"]
        bridge_path = f"kb/doc{slot:04d}.txt"
        slot += 1
        grp["bridge_path"] = bridge_path
        special[bridge_path] = (g, (grp["q_token"], grp["bridge_token"]))
        for _ in range(ANSWERS_PER_GROUP):
            answer_path = f"kb/doc{slot:04d}.txt"
            slot += 1
            grp["answer_paths"].add(answer_path)
            special[answer_path] = (g, (grp["bridge_token"], grp["answer_token"]))

    docs: list[tuple[str, str]] = []
    for i in range(NUM_DOCS):
        path = f"kb/doc{i:04d}.txt"
        if path in special:
            g, toks = special[path]
            content = _special_doc(rng, g, toks)
        else:
            content = "\n".join(_noise_para(rng) for _ in range(PARAS_PER_DOC))
        docs.append((path, content))
    return docs, groups


def _build_index(docs: list[tuple[str, str]]) -> LexicalIndex:
    index = LexicalIndex()
    for path, content in docs:
        index.add_document(path, content)
    return index


# ---------------------------------------------------------------------------
# 分位 / 计时工具
# ---------------------------------------------------------------------------
def _percentile(values: list[float], q: float) -> float:
    """线性插值分位（口径：sorted[(n-1)*q] 相邻两点线性插值）。"""
    ordered = sorted(values)
    if not ordered:
        return 0.0
    if len(ordered) == 1:
        return ordered[0]
    pos = (len(ordered) - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    if lo == hi:
        return ordered[lo]
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (pos - lo)


def _summarize(values: list[float]) -> dict:
    return {
        "p50": round(_percentile(values, 0.5), 3),
        "p95": round(_percentile(values, 0.95), 3),
        "max": round(max(values), 3),
        "min": round(min(values), 3),
        "n": len(values),
        "raw": [round(v, 3) for v in values],
    }


def _bench(fn, repeats: int = REPEATS) -> list[float]:
    samples: list[float] = []
    for _ in range(repeats):
        started = time.perf_counter()
        fn()
        samples.append((time.perf_counter() - started) * 1000.0)
    return samples


# ---------------------------------------------------------------------------
# 观察辅助：把 cancel / budget 的 paths 原文与状态原样记录
# ---------------------------------------------------------------------------
class _CancelAfter:
    """第 n 次调用才返回 True 的延迟取消器；自证实际调用次数。"""

    def __init__(self, n: int) -> None:
        self.n = n
        self.calls = 0

    def __call__(self) -> bool:
        self.calls += 1
        return self.calls >= self.n


class _RecordingJudge:
    """转调 LexicalOnlyJudge，同时记录每轮 judge.score 收到的候选数。"""

    def __init__(self) -> None:
        self.pool_sizes: list[int] = []

    async def score(self, question, candidates, evidence):
        self.pool_sizes.append(len(candidates))
        return await LexicalOnlyJudge().score(question, candidates, evidence)


def _observe(result, **extra) -> dict:
    return {
        "status": result.status,
        "degraded": result.degraded,
        "results_count": len(result.results),
        "citations_count": len(result.citations),
        "paths": dict(result.paths),
        "trace_hops": len(result.trace),
        **extra,
    }


# ---------------------------------------------------------------------------
# 主采数流程（module-scope fixture 只跑一次）
# ---------------------------------------------------------------------------
def _run_all() -> dict:
    docs, groups = _gen_corpus()
    index = _build_index(docs)
    scale = index.status()
    query0 = groups[0]["query"]
    terms0 = match_query(query0)

    def options() -> Sag2Options:
        return Sag2Options(
            candidate_k=CANDIDATE_K,
            top_k=TOP_K,
            seed_k=SEED_K,
            max_hops=2,
        )

    # ① 建库 ② 单次 candidate_query ③ search 等价路径 ④ retrieve 多跳
    build_samples = _bench(lambda: _build_index(docs))
    candidate_samples = _bench(
        lambda: index.candidate_query(terms0, CANDIDATE_K)
    )
    service = Sag2LexicalService(index=index)
    search_samples = _bench(lambda: service.search(query0, per_page=TOP_K))

    def one_retrieve():
        return asyncio.run(
            retrieve(index, query0, LexicalOnlyJudge(), options())
        )

    retrieve_samples = _bench(one_retrieve)

    # 召回基准：多跳 retrieve vs 纯 candidate_query 单跳
    recall_rows: list[dict] = []
    for grp in groups:
        result = asyncio.run(
            retrieve(index, grp["query"], LexicalOnlyJudge(), options())
        )
        hit_paths = {
            c["path"]
            for c in result.citations
            if c["path"] in grp["answer_paths"]
        }
        multihop = len(hit_paths) / len(grp["answer_paths"])
        single = index.candidate_query(match_query(grp["query"]), TOP_K)
        single_hit = {
            c.path for c in single if c.path in grp["answer_paths"]
        }
        singlehop = len(single_hit) / len(grp["answer_paths"])
        recall_rows.append(
            {
                "group": grp["group"],
                "query": grp["query"],
                "answer_paths": sorted(grp["answer_paths"]),
                "multihop_recall": round(multihop, 4),
                "multihop_hits": sorted(hit_paths),
                "singlehop_recall": round(singlehop, 4),
                "singlehop_hits": sorted(single_hit),
                "result_status": result.status,
                "trace_hops": len(result.trace),
                "result_paths": sorted({c["path"] for c in result.citations}),
            }
        )
    mean_multihop = sum(r["multihop_recall"] for r in recall_rows) / len(recall_rows)
    mean_singlehop = sum(r["singlehop_recall"] for r in recall_rows) / len(recall_rows)

    # 取消实测：立即 / 第 2 次 / 第 3 次取消
    immediate = asyncio.run(
        retrieve(
            index, query0, LexicalOnlyJudge(), options(), cancel=lambda: True
        )
    )
    cancel2 = _CancelAfter(2)
    delayed2 = asyncio.run(
        retrieve(index, query0, LexicalOnlyJudge(), options(), cancel=cancel2)
    )
    cancel3 = _CancelAfter(3)
    delayed3 = asyncio.run(
        retrieve(index, query0, LexicalOnlyJudge(), options(), cancel=cancel3)
    )

    # 预算实测：judge_pool_budget 很小 + 无 budget 对照
    recorder = _RecordingJudge()
    budget_result = asyncio.run(
        retrieve(
            index,
            query0,
            recorder,
            Sag2Options(
                candidate_k=CANDIDATE_K,
                top_k=TOP_K,
                seed_k=SEED_K,
                max_hops=2,
                judge_pool_budget=JUDGE_POOL_BUDGET,
            ),
        )
    )
    control_result = asyncio.run(
        retrieve(index, query0, LexicalOnlyJudge(), options())
    )
    budget_observed = _observe(
        budget_result, judge_pool_sizes=list(recorder.pool_sizes)
    )
    budget_status_literals = sorted(
        {str(entry.get("status")) for entry in budget_result.paths.values()}
    )

    report = {
        "timestamp_utc": datetime.datetime.now(datetime.UTC).isoformat(),
        "seed": SEED,
        "num_docs": NUM_DOCS,
        "paras_per_doc": PARAS_PER_DOC,
        "num_groups": NUM_GROUPS,
        "answers_per_group": ANSWERS_PER_GROUP,
        "repeats": REPEATS,
        "candidate_k": CANDIDATE_K,
        "top_k": TOP_K,
        "seed_k": SEED_K,
        "judge_pool_budget": JUDGE_POOL_BUDGET,
        "scale": scale,
        "latency_definition": (
            "每阶段重复 REPEATS 次，time.perf_counter 计毫秒；"
            "p50/p95 为 sorted[(n-1)*q] 相邻两点线性插值，max 为最大值。"
        ),
        "recall_definition": (
            "命中 = retrieve 结果 citations 的 path 指向该组注入答案片段的文档；"
            "recall@TOP_K = 命中答案文档数 / 该组答案文档总数(ANSWERS_PER_GROUP)。"
            "对照组 = 纯 index.candidate_query(match_query(query), TOP_K) 单跳粗筛"
            "（无 judge、无扩展轮），同口径计 recall。"
        ),
        "latency_ms": {
            "build_index": _summarize(build_samples),
            "candidate_query": _summarize(candidate_samples),
            "search": _summarize(search_samples),
            "retrieve_multihop": _summarize(retrieve_samples),
        },
        "recall": recall_rows,
        "mean_multihop_recall": round(mean_multihop, 4),
        "mean_singlehop_recall": round(mean_singlehop, 4),
        "cancel": {
            "immediate": _observe(immediate),
            "delayed_n2": _observe(delayed2, cancel_calls=cancel2.calls),
            "delayed_n3": _observe(delayed3, cancel_calls=cancel3.calls),
        },
        "budget": budget_observed,
        "budget_control_no_budget": {
            "status": control_result.status,
            "paths": {
                key: {
                    "status": entry.get("status"),
                    "raw_count": entry.get("raw_count"),
                }
                for key, entry in control_result.paths.items()
            },
        },
        "thresholds": {
            "ceiling_ms": CEILING_MS,
            "basis": (
            "取两轮实测中较慢 p50 的约 7 倍以上（build 3000ms≈404ms×7.4、"
            "retrieve 200ms≈2.82ms×71；微秒级阶段用 50ms 绝对地板），"
            "只断言 p50 <= ceiling、不卡 max，留足机器抖动余量，避免 CI 假红；"
            "性能退化一个数量级以上才判红。"
            ),
        },
        "unverified": [],
    }

    # 「未判定绝不写成判过」：budget 字面留痕若与预期不符，原样登记。
    has_budget_literal = "budget" in budget_status_literals
    report["budget_literal_trace"] = {
        "expected_by_task": "status='budget' 的 path 留痕",
        "observed_status_literals": budget_status_literals,
        "observed": has_budget_literal,
        "verdict": (
            "已观察到字面 budget 留痕"
            if has_budget_literal
            else "未观察到字面 budget 留痕（如实登记，不冒判为已验证）"
        ),
        "evidence": (
            "judge_pool_sizes 被压到 budget 内、对照无 budget 时 hop raw_count "
            "更大，证明截断确已发生；但既有 retrieval.py 在 budget 截断后于同 "
            "hop 再次调用 _path 覆盖了先前写入的 status='budget'，"
            "故最终 paths 的 status 为 ok。本席位不改既有文件。"
        ),
    }
    if not has_budget_literal:
        report["unverified"].append(
            "budget 截断的 status='budget' 字面 path 留痕：既有实现里该痕迹被同 "
            "hop 后续 _path 覆盖，实测 paths 全为 status='ok'；截断本身已由 "
            "judge_pool_sizes 与 raw_count 对照实证，但字面留痕未判定为通过。"
        )

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return report


@pytest.fixture(scope="module")
def bench_report() -> dict:
    return _run_all()


# ---------------------------------------------------------------------------
# 断言：功能正确性确定性钉死 + 延迟宽松回归钉
# ---------------------------------------------------------------------------
def test_scale_is_large_and_ready(bench_report):
    scale = bench_report["scale"]
    assert scale["documents"] == NUM_DOCS
    assert scale["chunks"] >= NUM_DOCS
    assert scale["terms"] > 0
    assert scale["ready"] is True


def test_latency_percentiles_within_loose_ceiling(bench_report):
    for stage, ceiling in CEILING_MS.items():
        stat = bench_report["latency_ms"][stage]
        assert stat["n"] == REPEATS
        assert 0 < stat["p50"] <= ceiling, (
            f"{stage} p50={stat['p50']}ms 超过宽松上限 {ceiling}ms"
        )
        # 分位单调性（确定性，不随机器变）
        assert stat["p50"] <= stat["p95"] <= stat["max"]


def test_recall_multihop_beats_single_hop(bench_report):
    rows = bench_report["recall"]
    assert len(rows) >= 3
    for row in rows:
        assert row["result_status"] == STATUS_OK
        assert row["multihop_recall"] >= 0.5, (
            f"组{row['group']} 多跳 recall 过低：{row['multihop_recall']}"
        )
        assert row["singlehop_recall"] == 0.0
    assert bench_report["mean_multihop_recall"] > bench_report["mean_singlehop_recall"]


def test_cancel_immediate_is_explicit_and_produces_nothing(bench_report):
    obs = bench_report["cancel"]["immediate"]
    assert obs["status"] == STATUS_CANCELLED
    assert obs["degraded"] is True
    assert obs["results_count"] == 0
    assert obs["citations_count"] == 0
    assert obs["paths"]["hop0"]["status"] == "cancelled"
    assert obs["trace_hops"] == 0


def test_cancel_delayed_fires_at_correct_hop(bench_report):
    n2 = bench_report["cancel"]["delayed_n2"]
    assert n2["status"] == STATUS_CANCELLED
    assert n2["cancel_calls"] == 2
    assert n2["paths"]["hop0"]["status"] == "ok"
    assert n2["paths"]["hop1"]["status"] == "cancelled"
    assert n2["results_count"] == 0
    assert n2["trace_hops"] == 1

    n3 = bench_report["cancel"]["delayed_n3"]
    assert n3["status"] == STATUS_CANCELLED
    assert n3["cancel_calls"] == 3
    assert n3["paths"]["hop0"]["status"] == "ok"
    assert n3["paths"]["hop1"]["status"] == "ok"
    assert n3["paths"]["hop2"]["status"] == "cancelled"
    assert n3["results_count"] == 0
    assert n3["trace_hops"] == 2


def test_budget_truncates_pool_without_overflow(bench_report):
    obs = bench_report["budget"]
    assert obs["status"] == STATUS_OK
    assert obs["judge_pool_sizes"], "必须真实调用过 judge.score 才能判不越界"
    assert max(obs["judge_pool_sizes"]) <= JUDGE_POOL_BUDGET
    for key, entry in obs["paths"].items():
        if key.startswith("hop"):
            assert entry["raw_count"] <= JUDGE_POOL_BUDGET
    # 对照：无 budget 时至少有一个 hop 的 raw_count 超出预算，证明截断确发生
    control = bench_report["budget_control_no_budget"]["paths"]
    assert any(
        entry["raw_count"] > JUDGE_POOL_BUDGET
        for key, entry in control.items()
        if key.startswith("hop")
    )


def test_report_json_is_written_and_self_consistent(bench_report):
    assert REPORT_PATH.is_file()
    data = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    assert data["seed"] == SEED
    assert data["num_docs"] == NUM_DOCS
    assert data["repeats"] == REPEATS
    assert set(data["latency_ms"]) == set(CEILING_MS)
    assert data["mean_multihop_recall"] == bench_report["mean_multihop_recall"]
    assert "budget_literal_trace" in data
    assert isinstance(data["unverified"], list)


if __name__ == "__main__":
    print(json.dumps(_run_all(), ensure_ascii=False, indent=2))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
