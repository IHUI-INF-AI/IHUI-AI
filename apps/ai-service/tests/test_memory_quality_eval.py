# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""记忆质量评测体系测试(2026-09-03,全离线零 DB 零 LLM)。

覆盖:
- 5 维度确定性打分(write_consistency / recall_at_k / precision_at_k /
  mutation_correct / noise_robustness)
- 报告结构(5 维度齐全、overall=均值、as_dict/summary 可序列化)
- 词袋伪 embed 的相似性语义(同词近、异词远)
- InMemoryVectorStore 协议实现(search 排序/阈值/delete/update)
- 注入自定义 embed 失败时降级(返回 None → 零向量,不抛)
- run_offline / run_on_store 便捷入口
"""

import asyncio

from app.services.memory_quality_eval import (
    DimensionScore,
    InMemoryVectorStore,
    MemoryQualityEvaluator,
    MemoryQualityReport,
    _bag_hash_embed,
    _cosine,
    run_offline,
    run_on_store,
)

# ---------------------------------------------------------------------------
# 基础:词袋伪向量与余弦
# ---------------------------------------------------------------------------


def test_bag_hash_semantics_same_words_close() -> None:
    a = _bag_hash_embed("用户喜欢喝咖啡 每天早晨一杯")
    b = _bag_hash_embed("咖啡 用户每天早晨喜欢喝一杯")
    c = _bag_hash_embed("股票市场今日波动较大")
    sim_ab = _cosine(a, b)
    sim_ac = _cosine(a, c)
    assert sim_ab > sim_ac, f"同义文本应比无关文本更近: ab={sim_ab:.3f} ac={sim_ac:.3f}"
    assert sim_ab > 0.5
    assert sim_ac < 0.5


def test_bag_hash_deterministic() -> None:
    assert _bag_hash_embed("长春人工智能公司") == _bag_hash_embed("长春人工智能公司")
    v = _bag_hash_embed("文本")
    norm = sum(x * x for x in v) ** 0.5
    assert abs(norm - 1.0) < 1e-6, "向量应 L2 归一化"


def test_cosine_edges() -> None:
    assert _cosine([], [1.0]) == 0.0
    assert _cosine([1.0, 0.0], [0.0, 1.0]) == 0.0
    assert abs(_cosine([1.0, 2.0], [1.0, 2.0]) - 1.0) < 1e-9


# ---------------------------------------------------------------------------
# 内存存储实现
# ---------------------------------------------------------------------------


async def _seed(store: InMemoryVectorStore, n: int = 5) -> None:
    for i in range(n):
        t = f"事实条目 {i}:用户喜欢 {'咖啡' if i % 2 == 0 else '茶'}"
        await store.add_entry(f"e-{i}", {"content": t, "kind": "fact"}, _bag_hash_embed(t))


def test_inmemory_store_roundtrip() -> None:
    store = InMemoryVectorStore()
    asyncio.run(_seed(store, 3))
    assert len(store.list_entries()) == 3
    assert store.list_entry_ids() == ["e-0", "e-1", "e-2"]


def test_inmemory_search_ranking_and_threshold() -> None:
    store = InMemoryVectorStore()
    asyncio.run(_seed(store, 5))
    hits = asyncio.run(store.search(_bag_hash_embed("用户喜欢咖啡 事实"), top_k=2, threshold=0.0))
    assert len(hits) <= 2
    # 相关性降序
    sims = [s for _eid, _ent, s in hits]
    assert sims == sorted(sims, reverse=True)
    # 高阈值过滤
    strict = asyncio.run(store.search(_bag_hash_embed("完全无关词xyz"), top_k=5, threshold=0.99))
    assert strict == []


def test_inmemory_delete_and_update() -> None:
    store = InMemoryVectorStore()
    asyncio.run(_seed(store, 3))
    asyncio.run(store.delete("e-1"))
    assert "e-1" not in store.list_entry_ids()
    old_vec = _bag_hash_embed("原语义")
    asyncio.run(store.update_embedding("e-2", old_vec))
    # 更新后向量生效(搜"原语义"能命中 e-2)
    hits = asyncio.run(store.search(old_vec, top_k=1, threshold=0.0))
    assert hits and hits[0][0] == "e-2"
    # 更新不存在的 id 静默
    asyncio.run(store.update_embedding("e-99", old_vec))  # 不抛


def test_inmemory_clear() -> None:
    store = InMemoryVectorStore()
    asyncio.run(_seed(store, 3))
    store.clear()
    assert store.list_entry_ids() == []


# ---------------------------------------------------------------------------
# 评测器主流程
# ---------------------------------------------------------------------------


def test_evaluator_run_produces_full_report() -> None:
    report = asyncio.run(run_offline())
    assert isinstance(report, MemoryQualityReport)
    names = {d.name for d in report.dimensions}
    assert names == {
        "write_consistency",
        "recall_at_k",
        "precision_at_k",
        "mutation_correct",
        "noise_robustness",
    }, f"5 维度齐全,实际: {names}"
    for d in report.dimensions:
        assert 0.0 <= d.score <= 1.0, f"{d.name} 分数越界: {d.score}"
        assert d.detail, f"{d.name} 缺 detail"
    assert 0.0 <= report.overall <= 1.0
    assert report.storage_kind == "in-memory"
    assert report.embed_kind == "bag-hash"


def test_dimension_scores_clamp() -> None:
    d = DimensionScore("x", 1.7)
    assert d.score == 1.0
    d2 = DimensionScore("y", -0.3)
    assert d2.score == 0.0


def test_report_as_dict_and_summary() -> None:
    report = asyncio.run(run_offline())
    d = report.as_dict()
    assert set(d) >= {"overall", "duration_ms", "dimensions", "storage_kind", "embed_kind"}
    assert len(d["dimensions"]) == 5
    s = report.summary()
    assert "记忆质量评测报告" in s
    assert "综合分" in s
    assert "write_consistency" in s


# ---------------------------------------------------------------------------
# 关键维度语义断言(确定性场景)
# ---------------------------------------------------------------------------


def test_write_consistency_full_score() -> None:
    report = asyncio.run(run_offline())
    wc = next(d for d in report.dimensions if d.name == "write_consistency")
    assert wc.score == 1.0, wc.detail


def test_mutation_correct_both_checks() -> None:
    report = asyncio.run(run_offline())
    mc = next(d for d in report.dimensions if d.name == "mutation_correct")
    assert mc.score == 1.0, mc.detail


def test_noise_robustness_top1() -> None:
    report = asyncio.run(run_offline())
    ns = next(d for d in report.dimensions if d.name == "noise_robustness")
    assert ns.score == 1.0, ns.detail


def test_recall_and_precision_nonzero() -> None:
    report = asyncio.run(run_offline())
    dims = {d.name: d.score for d in report.dimensions}
    assert dims["recall_at_k"] >= 2 / 3, "3 主题应至少召回 2 个"
    assert dims["precision_at_k"] >= 2 / 3, "A 主题查询 top3 应多数属 A"


# ---------------------------------------------------------------------------
# 注入与降级
# ---------------------------------------------------------------------------


class _BrokenEmbedStore(InMemoryVectorStore):
    """模拟 embed 返回 None(真实后端不可用场景)。"""


async def _none_embed(text: str) -> list[float] | None:
    return None


def test_embed_none_degrades_without_raise() -> None:
    store = InMemoryVectorStore()
    ev = MemoryQualityEvaluator(store=store, embed=_none_embed)
    report = asyncio.run(ev.run())
    # 零向量 embed 下搜索全相似 → 分数不越界、不抛异常
    assert 0.0 <= report.overall <= 1.0
    assert len(report.dimensions) == 5


class _TrackingStore(InMemoryVectorStore):
    """记录被注入的自定义存储是否真正被使用。"""

    def __init__(self) -> None:
        super().__init__()
        self.add_calls = 0

    async def add_entry(self, entry_id, entry, embedding) -> None:  # type: ignore[no-untyped-def]
        self.add_calls += 1
        await super().add_entry(entry_id, entry, embedding)


def test_run_on_store_uses_injected_store() -> None:
    store = _TrackingStore()
    report = asyncio.run(
        run_on_store(
            store,
            lambda t: _async_emb(t),
            storage_kind="tracking",
            embed_kind="bag-hash",
        )
    )
    assert report.storage_kind == "tracking"
    assert store.add_calls > 0, "注入存储必须被评测流程实际使用"
    assert len(report.dimensions) == 5


async def _async_emb(text: str) -> list[float]:
    return _bag_hash_embed(text)


# ---------------------------------------------------------------------------
# 幂等与可重复
# ---------------------------------------------------------------------------


def test_evaluator_idempotent_across_runs() -> None:
    r1 = asyncio.run(run_offline())
    r2 = asyncio.run(run_offline())
    assert r1.overall == r2.overall, "确定性评测:两次运行综合分必须一致"
    assert [d.score for d in r1.dimensions] == [d.score for d in r2.dimensions]


def test_evaluator_is_async_safe() -> None:
    async def _main() -> None:
        results = await asyncio.gather(run_offline(), run_offline(), run_offline())
        scores = {r.overall for r in results}
        assert len(scores) == 1

    asyncio.run(_main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
