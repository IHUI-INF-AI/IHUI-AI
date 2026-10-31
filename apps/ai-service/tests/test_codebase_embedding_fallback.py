# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G7 本地 embedding 回落档测试(2026-10-31,goal-b42)。

对标 Trae ckg `-local_embedding -embedding_storage_type=sqlite_vec`(T2 §8-G7):
远端 embedding 不可用(离线/欠费/限流)时,索引向量面不再整批落空 —— 降级为
本地确定性哈希向量并如实标注来源(local-hash),不被冒充为在线质量。

测试隔离(§5):不连远端、不连库 —— llm_gateway.embed 全 monkeypatch;
哈希出口零网络零派生,直接实跑。
"""

from __future__ import annotations

import math
from unittest.mock import AsyncMock

import pytest

from app.core.llm_gateway import llm_gateway


# ---------------------------------------------------------------------------
# 哈希出口本身:确定性 / 维度 / 归一化 / 空文本
# ---------------------------------------------------------------------------


def test_local_fallback_deterministic_and_dimmed() -> None:
    a = llm_gateway.embed_local_fallback("def authenticate(user): ...")
    b = llm_gateway.embed_local_fallback("def authenticate(user): ...")
    assert a == b
    assert len(a) == llm_gateway.LOCAL_EMBEDDING_DIM == 1536
    norm = math.sqrt(sum(x * x for x in a))
    assert norm == pytest.approx(1.0, abs=1e-9)


def test_local_fallback_distinct_inputs_diverge() -> None:
    a = llm_gateway.embed_local_fallback("用户认证逻辑")
    b = llm_gateway.embed_local_fallback("支付回调重试")
    assert a != b


def test_local_fallback_empty_text_is_honest_zero() -> None:
    v = llm_gateway.embed_local_fallback("")
    assert len(v) == 1536 and all(x == 0.0 for x in v)


def test_local_fallback_no_network_no_subprocess_shape() -> None:
    # 出口形态锁:函数体不得含网络/派生调用(G7 承诺零依赖回落)
    import inspect

    src = inspect.getsource(llm_gateway.embed_local_fallback)
    for banned in ("httpx", "requests", "aiohttp", "subprocess", "litellm", "socket"):
        assert banned not in src, f"本地回落档出现禁止依赖: {banned}"


# ---------------------------------------------------------------------------
# 索引接线:远端失败 → 本地档 + 如实标注
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generate_embeddings_batch_falls_back_on_remote_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services.codebase_indexer import CodeChunk, codebase_indexer

    async def boom(text: str, model: str | None = None) -> list[float]:
        raise RuntimeError("gateway offline")

    monkeypatch.setattr(llm_gateway, "embed", boom)
    chunks = [
        CodeChunk(file_path="a.py", line_start=1, line_end=5, content="def fn_a(): pass"),
        CodeChunk(file_path="b.py", line_start=1, line_end=5, content="def fn_b(): pass"),
    ]
    count = await codebase_indexer._generate_embeddings_batch(chunks)
    assert count == 2
    for c in chunks:
        assert c.embedding is not None and len(c.embedding) == 1536
        # 诚实标注:本地档必须带 local-hash 来源,不冒充 remote
        assert c.embedding_provider == "local-hash"


@pytest.mark.asyncio
async def test_generate_embeddings_batch_remote_success_labels_remote(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services.codebase_indexer import CodeChunk, codebase_indexer

    async def fake_embed(text: str, model: str | None = None) -> list[float]:
        return [0.1] * 1536

    monkeypatch.setattr(llm_gateway, "embed", AsyncMock(side_effect=fake_embed))
    chunks = [CodeChunk(file_path="a.py", line_start=1, line_end=5, content="x = 1")]
    count = await codebase_indexer._generate_embeddings_batch(chunks)
    assert count == 1
    assert chunks[0].embedding_provider == "remote"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
