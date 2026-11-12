"""AIS-018 回归:hash 伪向量与远端 embedding 不得在同一集合里混维。

票面缺陷:远端 embed 失败时写入 `_HASH_DIM=128` 的 hash 伪向量,正常查询是 1536 维;
`_cosine_similarity` 用 `n=min(len(a), len(b))` **只比较前 128 维**,pgvector 侧还会把
另一维度的条目整批过滤 —— 结果既不是"降级召回"也不是"零命中",而是拿前缀冒充全维。

本文件钉住的判据:
- 集合维护唯一维度:首条写入定维,窄向量(降级 hash)按集合维度**重算**而不是混存;
- 无正文可重算时**拒绝入库**(不静默混维);
- 检索时维度不一致条目**显式跳过**,不再做截断比较;
- update_embedding 走同一对齐(否则一次 update 就把混存放回来);
- hydrate 混存快照按最大维度归一,并在日志里点名。

不连 DB / 不调远端:hash 伪向量是纯函数,pgvector 镜像在无 DSN 时自动降级。
"""

from __future__ import annotations

import pytest

from app.services.vector_memory import (
    _HASH_DIM,
    VectorMemoryStore,
    _cosine_similarity,
    _hash_embedding,
)


def _entry(text: str = "内容", **extra: object) -> dict[str, object]:
    return {"content": text, **extra}


class TestStoreDimAlignment:
    async def test_first_vector_sets_collection_dim(self, tmp_path):
        store = VectorMemoryStore(persist_path=str(tmp_path / "vm.json"))
        emb = [0.1] * 1536
        await store.add_entry("e1", _entry(), emb)
        assert store._vectors["e1"] == emb
        assert store._vector_dim == 1536

    async def test_narrow_hash_vector_recomputed_to_collection_dim(self, tmp_path):
        """典型缺陷路径:远端先成功(1536),随后失败降级出 128 维 hash。"""
        store = VectorMemoryStore(persist_path=str(tmp_path / "vm.json"))
        await store.add_entry("wide", _entry("宽向量"), [0.01] * 1536)
        await store.add_entry("narrow", _entry("降级向量"), _hash_embedding("降级向量"))

        stored = store._vectors["narrow"]
        assert len(stored) == 1536, "窄向量必须按集合维度重算,不得混存"
        # 重算后的向量仍是同一文本的确定性 hash(可复现)
        assert stored == _hash_embedding("降级向量", dim=1536)

    async def test_wider_vector_promotes_collection_dim(self, tmp_path):
        """远端模型升级(128 → 1536)时提升集合维度,不是把新向量截断。"""
        store = VectorMemoryStore(persist_path=str(tmp_path / "vm.json"))
        await store.add_entry("old", _entry("旧"), _hash_embedding("旧"))
        await store.add_entry("new", _entry("新"), [0.02] * 1536)
        assert store._vector_dim == 1536
        assert len(store._vectors["new"]) == 1536
        # 旧条目保持原样,在检索时被显式跳过(不是被截断比较)
        assert len(store._vectors["old"]) == _HASH_DIM

    async def test_mismatched_vector_without_text_is_rejected(self, tmp_path):
        """无正文可重算 ⇒ 拒绝入库,不写一条注定不可命中的错维向量。"""
        store = VectorMemoryStore(persist_path=str(tmp_path / "vm.json"))
        await store.add_entry("wide", _entry("宽"), [0.01] * 1536)
        await store.add_entry("bad", {}, [0.5] * 8)
        assert "bad" not in store._vectors
        assert "bad" not in store._entries

    async def test_update_embedding_uses_same_alignment(self, tmp_path):
        store = VectorMemoryStore(persist_path=str(tmp_path / "vm.json"))
        await store.add_entry("e1", _entry("正文"), [0.01] * 1536)
        await store.update_embedding("e1", _hash_embedding("正文"))
        assert len(store._vectors["e1"]) == 1536
        assert store._vectors["e1"] == _hash_embedding("正文", dim=1536)


class TestSearchSkipsMismatchedDims:
    async def test_mismatched_entry_is_skipped_not_truncated(self, tmp_path):
        """修前:128 维条目在 1536 维查询下会因前缀比较拿到一个虚假相似度。"""
        store = VectorMemoryStore(persist_path=str(tmp_path / "vm.json"))
        # 直接注入混存(模拟存量快照,绕过写入对齐)
        vec = [0.03] * 128
        store._entries["narrow"] = _entry("窄")
        store._vectors["narrow"] = vec
        store._entries["wide"] = _entry("宽")
        store._vectors["wide"] = [0.03] * 1536
        store._vector_dim = 1536

        hits = await store.search([0.03] * 1536, top_k=10, threshold=0.0)
        assert [h[0] for h in hits] == ["wide"], "维度不一致条目必须跳过,不得截断比较"

    async def test_equal_dim_still_ranks(self, tmp_path):
        store = VectorMemoryStore(persist_path=str(tmp_path / "vm.json"))
        await store.add_entry("a", _entry("甲"), [1.0, 0.0, 0.0])
        await store.add_entry("b", _entry("乙"), [0.0, 1.0, 0.0])
        hits = await store.search([1.0, 0.0, 0.0], top_k=5, threshold=0.5)
        assert [h[0] for h in hits] == ["a"]


class TestHydrateMixedSnapshot:
    async def test_hydrate_normalizes_to_max_dim(self, tmp_path):
        """存量混存快照:以宽者为准,后续窄写入按它重算。"""
        import json

        path = tmp_path / "vm.json"
        path.write_text(
            json.dumps(
                {
                    "entries": {"narrow": _entry("窄"), "wide": _entry("宽")},
                    "vectors": {"narrow": [0.1] * 128, "wide": [0.1] * 1536},
                }
            ),
            encoding="utf-8",
        )
        store = VectorMemoryStore(persist_path=str(path))
        await store.hydrate()
        assert store._vector_dim == 1536
        # 旧条目原样保留(检索时跳过),新写入的窄向量按集合维度重算
        await store.add_entry("fresh", _entry("新降级"), _hash_embedding("新降级"))
        assert len(store._vectors["fresh"]) == 1536


@pytest.mark.parametrize("dim", [1, 8, 128, 1536])
def test_hash_embedding_dim_is_respected(dim: int) -> None:
    """hash 伪向量自身维度可控 —— 集合维度对齐依赖这一点。"""
    assert len(_hash_embedding("x", dim=dim)) == dim


class TestCosineSimilarityStrictness:
    """把"不许截断比较"钉在函数本身,而不只钉在调用点。

    store.search 已显式跳过维度不一致条目;但函数若仍按 min(len) 截断,任何新调用点
    都会重新引入同一型缺陷 —— 判据必须落在唯一实现上。
    """

    def test_mismatched_dims_return_zero(self):
        assert _cosine_similarity([1.0, 2.0], [1.0]) == 0.0
        assert _cosine_similarity([1.0, 0.0], [1.0, 1.0, 1.0]) == 0.0

    def test_equal_dims_unchanged(self):
        assert _cosine_similarity([1.0, 0.0], [1.0, 0.0]) == pytest.approx(1.0)
        assert _cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)
        assert _cosine_similarity([1.0, 0.0], [-1.0, 0.0]) == pytest.approx(-1.0)

    def test_empty_and_zero_vectors(self):
        assert _cosine_similarity([], []) == 0.0
        assert _cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0
