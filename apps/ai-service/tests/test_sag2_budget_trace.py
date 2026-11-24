# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 词法通道·budget 截断字面留痕回归（独立席位新增）。

钉死 P5 基准实测抓出的缺陷：候选池超过 ``judge_pool_budget`` 时写的
``status="budget"`` 留痕，曾被同 hop 稍后的 ``_path(hopN, status="ok")``
覆盖。修复采用独立 key ``budget:hopN``——不以 "hop" 开头，故既保留 hop
主 key 的全部语义，又不被既有 ``key.startswith("hop")`` 断言误伤。

水印：本文件头 3 行 provenance 横幅与末行零宽标记由脚本从
tests/test_sag2_lexical.py 逐字节复制生成（含零宽码元，未经手敲）。
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any

from app.services.sag2_lexical import (
    LexicalIndex,
    LexicalOnlyJudge,
    Sag2Options,
    retrieve,
)
from app.services.sag2_lexical.judge import JudgeVerdict
from app.services.sag2_lexical.retrieval import (
    STATUS_CANCELLED,
    STATUS_OK,
    Sag2Result,
)

# 12 篇文档均含查询词「量子」⇒ hop0 候选池固定为 12，可稳定触发 budget 截断；
# 内容各不相同，避免 hash/区间重复影响 hydration 与 citation。
QUERY = "量子"
DOCS = [
    (f"kb/d{i:02d}.txt", f"量子计算进展报告编号{i}：量子比特与量子纠错研究。")
    for i in range(12)
]
POOL_SIZE = len(DOCS)
BIG_BUDGET = 200


def make_index() -> LexicalIndex:
    index = LexicalIndex()
    for path, content in DOCS:
        index.add_document(path, content)
    return index


class _RecordingJudge:
    """转调 LexicalOnlyJudge，记录每轮 judge.score 收到的候选数。"""

    def __init__(self) -> None:
        self.pool_sizes: list[int] = []

    async def score(
        self,
        question: str,
        candidates: list[Any],
        evidence: list[Any],
    ) -> JudgeVerdict:
        self.pool_sizes.append(len(candidates))
        return await LexicalOnlyJudge().score(question, candidates, evidence)


def _run(
    budget: int,
    *,
    cancel: Callable[[], bool] | None = None,
) -> tuple[Sag2Result, _RecordingJudge, dict[str, Any]]:
    judge = _RecordingJudge()
    result = asyncio.run(
        retrieve(
            make_index(),
            QUERY,
            judge,
            Sag2Options(
                candidate_k=100,
                seed_k=10,
                max_hops=2,
                top_k=10,
                judge_pool_budget=budget,
            ),
            cancel=cancel,
        )
    )
    return result, judge, result.to_dict()


def _paths(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    paths: dict[str, dict[str, Any]] = payload["paths"]
    return paths


def _budget_entries(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """机读：所有独立 key ``budget:hopN`` 的留痕。"""
    return {
        key: entry
        for key, entry in _paths(payload).items()
        if key.startswith("budget:")
    }


def test_small_budget_truncates_and_leaves_literal_budget_trace() -> None:
    budget = 3
    result, judge, payload = _run(budget)
    # 截断不应把整轮判成 cancelled / budget-exhausted
    assert result.status == STATUS_OK
    assert judge.pool_sizes, "必须真跑过 judge.score 才能谈截断"
    assert max(judge.pool_sizes) <= budget, "候选池必须被压到预算内"

    entries = _budget_entries(payload)
    assert entries, "小预算下必须留下 budget 独立 key 痕迹"
    for key, entry in entries.items():
        assert key.startswith("budget:hop"), f"留痕形态不符: {key}"
        assert entry["status"] == "budget", "字面 status 必须是 budget（P5 原口径）"
        assert entry["count"] == budget
        assert entry["dropped"] > 0
        assert entry["raw_count"] == entry["count"] + entry["dropped"]
        assert entry["raw_count"] > budget, "raw_count 应是截断前的更大池"

    # 对齐 P5 报告口径：最终 paths 的 status 字面集合里能机读到 "budget"
    literals = {str(entry.get("status")) for entry in _paths(payload).values()}
    assert "budget" in literals

    # 既有 hop 主 key 一字未动：仍存在、status 不含 budget
    hop_keys = {k: v for k, v in _paths(payload).items() if k.startswith("hop")}
    assert "hop0" in hop_keys and "hop1" in hop_keys
    assert all(v["status"] != "budget" for v in hop_keys.values())
    assert {"diversity", "hydration"} <= set(_paths(payload))


def test_no_truncation_when_budget_large_leaves_no_trace() -> None:
    result, judge, payload = _run(BIG_BUDGET)
    assert result.status == STATUS_OK
    assert max(judge.pool_sizes) > 3, "前提：大预算下候选池确实没被压到小预算"
    assert _budget_entries(payload) == {}, "无截断 ⇒ 不得产生 budget 独立 key"
    assert all(
        entry.get("status") != "budget" for entry in _paths(payload).values()
    ), "无截断 ⇒ 任何 path 都不得出现 status='budget'（防恒真摆设）"


def test_budget_trace_count_and_dropped_vary_with_budget() -> None:
    """变异验证：3 组 budget ⇒ count/dropped 随之变化，防写死。"""
    observations: list[tuple[int, int, int, int]] = []
    for budget in (2, 3, 5):
        _, judge, payload = _run(budget)
        assert max(judge.pool_sizes) <= budget
        entries = _budget_entries(payload)
        assert entries, f"budget={budget} 必须有 budget 留痕"
        entry = next(iter(entries.values()))
        assert entry["status"] == "budget"
        assert entry["count"] == budget, "count 必须等于本组 budget，不得写死"
        assert entry["dropped"] == entry["raw_count"] - budget
        assert entry["raw_count"] == POOL_SIZE, "截断前池大小与 budget 无关，恒为 12"
        observations.append(
            (budget, entry["raw_count"], entry["count"], entry["dropped"])
        )
    counts = [o[2] for o in observations]
    dropped = [o[3] for o in observations]
    assert counts == [2, 3, 5], "count 未随 budget 变化"
    assert len(set(dropped)) == 3, "dropped 未随 budget 变化（疑似写死）"
    assert dropped == sorted(dropped, reverse=True), "预算越小丢弃越多"


def test_immediate_cancel_has_no_budget_trace() -> None:
    result, judge, payload = _run(2, cancel=lambda: True)
    assert result.status == STATUS_CANCELLED
    assert _budget_entries(payload) == {}, "取消路径不得污染出 budget 留痕"
    assert all(
        entry.get("status") != "budget" for entry in _paths(payload).values()
    )
    assert payload["results"] == [] and payload["citations"] == []
    assert judge.pool_sizes == []


def test_existing_fields_are_unchanged() -> None:
    """judge_pool_sizes / results / citations 数据通路不受修复影响。"""
    _, judge, payload = _run(3)
    assert payload["source_count"] == len(payload["results"]) == len(payload["citations"])
    assert payload["results"] and payload["citations"]
    for row in payload["results"]:
        assert {"key", "path", "content", "score", "bm25", "hop"} <= set(row)
    for citation in payload["citations"]:
        assert "doc_hash" in citation
    # judge_pool_sizes（P5 报告口径）== 每轮 trace.pool_size，数据通路未被触碰
    assert judge.pool_sizes == [h["pool_size"] for h in payload["trace"]]
    assert max(judge.pool_sizes) <= 3
    assert set(payload["judge"]) == {"mode", "executed", "reason"}
    assert all("pool_size" in h and "hop" in h for h in payload["trace"])
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
