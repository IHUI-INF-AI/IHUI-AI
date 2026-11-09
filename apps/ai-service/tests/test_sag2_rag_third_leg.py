# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 作为 RAG 第三路召回的接线回归（本仓自有实现）。

要钉住的是「接了没有」而不是「算法好不好」：
1. 索引未就绪 ⇒ ``paths["sag2"]`` 具名 ``empty/index-not-ready``，不进融合；
2. 索引就绪 ⇒ 真出结果，且**没有向量服务时**也能与关键词路做 RRF 融合
   （SAG2 的价值恰在「零 embedding 也能跨文件多跳」，这一支不接等于白建）；
3. 检索抛错 ⇒ 单腿降级成 ``error``，不把整轮 RAG 拖崩。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.rag import RAGSource, rag_service
from app.services.sag2_lexical import LexicalIndex, Sag2LexicalService


def _service_with_docs() -> Sag2LexicalService:
    service = Sag2LexicalService(index=LexicalIndex())
    service.add_document(
        "board.md",
        "2025 年董事会决议：年度研发额度 800 万，责任人王工。",
        title="董事会决议",
    )
    service.add_document(
        "spend.md",
        "王工牵头的向量检索项目第三季花掉 940 万，超上限 140 万。",
        title="第三季支出",
    )
    return service


async def _no_vector(query: str, *args: Any, **kwargs: Any) -> list[RAGSource]:
    return []


async def _keyword_hit(query: str, *args: Any, **kwargs: Any) -> list[RAGSource]:
    return [
        RAGSource(
            session_id="s1",
            role="user",
            content="关键词腿命中的历史消息",
            score=0.42,
        )
    ]


@pytest.mark.asyncio
async def test_sag2_leg_is_named_when_index_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    empty = Sag2LexicalService(index=LexicalIndex())
    monkeypatch.setattr(
        "app.services.sag2_lexical.sag2_lexical_service", empty, raising=True
    )
    monkeypatch.setattr(rag_service, "_vector_retrieve", _no_vector)
    monkeypatch.setattr(rag_service, "_keyword_fallback", _keyword_hit)

    stats: dict[str, Any] = {}
    await rag_service._retrieve("董事会额度", top_k=3, stats=stats)

    entry = stats["paths"]["sag2"]
    assert entry["status"] == "empty"
    assert "index-not-ready" in entry["reason"]
    assert stats["sag2_fused"] is False
    # 空索引不改变既有降级语义：仍然只有关键词一路。
    assert stats["mode"] == "single-source:keyword"


@pytest.mark.asyncio
async def test_sag2_leg_fuses_without_vector(monkeypatch: pytest.MonkeyPatch) -> None:
    ready = _service_with_docs()
    monkeypatch.setattr(
        "app.services.sag2_lexical.sag2_lexical_service", ready, raising=True
    )
    monkeypatch.setattr(rag_service, "_vector_retrieve", _no_vector)
    monkeypatch.setattr(rag_service, "_keyword_fallback", _keyword_hit)

    stats: dict[str, Any] = {}
    sources = await rag_service._retrieve("董事会定的额度后来谁用超了", top_k=5, stats=stats)

    assert stats["paths"]["sag2"]["status"] == "ok"
    assert stats["sag2_fused"] is True
    assert stats["mode"] == "rrf-fusion"
    assert sources, "关键词 + SAG2 两路必须融出结果"
    labels = {s.fused_from for s in sources}
    assert any("sag2" in label for label in labels), labels
    # SAG2 命中必须带得出原文，而不是只留一个路径。
    assert any("940 万" in s.content for s in sources)


@pytest.mark.asyncio
async def test_sag2_leg_error_degrades_alone(monkeypatch: pytest.MonkeyPatch) -> None:
    ready = _service_with_docs()

    async def boom(*args: Any, **kwargs: Any) -> Any:
        raise RuntimeError("index exploded")

    monkeypatch.setattr(
        "app.services.sag2_lexical.sag2_lexical_service", ready, raising=True
    )
    monkeypatch.setattr(ready, "retrieve", boom)
    monkeypatch.setattr(rag_service, "_vector_retrieve", _no_vector)
    monkeypatch.setattr(rag_service, "_keyword_fallback", _keyword_hit)

    stats: dict[str, Any] = {}
    sources = await rag_service._retrieve("董事会额度", top_k=3, stats=stats)

    entry = stats["paths"]["sag2"]
    assert entry["status"] == "error"
    assert "RuntimeError" in entry["reason"]
    assert stats["mode"] == "single-source:keyword"
    assert sources and sources[0].content == "关键词腿命中的历史消息"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
