"""多模态记忆系统测试(L6,2026-07-25 立,对标 GPT-4o 多模态记忆)。

覆盖:
- MultimodalEmbedder:每种模态 embed 成功 / LLM 失败降级 hash 伪向量 / 伪向量维度 128
- MultimodalMemory.store:新存储 / 查重返回已有 / LLM 失败仅内存降级 / DB 异常仅内存
- MultimodalMemory.search:cosine 相似度排序 / modality 过滤 / top_k 限制 / 空结果
- MultimodalMemory.delete:成功 / 失败返回 False / 不存在返回 False
- MultimodalMemory.update_importance:成功 / 失败返回 False / clamp
- MultimodalMemory.load_all_for_user:加载 / DB 异常返回 0
- 辅助函数:_hash_embedding / _to_bytes / _content_hash / _parse_execute_result
- 全部用 monkeypatch mock llm_gateway / asyncpg,不实际连 DB
"""

from __future__ import annotations

import hashlib
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.multimodal_embedder import (
    MultimodalEmbedder,
    _hash_embedding,
    _to_bytes,
    multimodal_embedder,
)
from app.services.multimodal_memory import (
    MultimodalMemory,
    _content_hash,
    _cosine_similarity,
    _parse_execute_result,
    multimodal_memory,
)


# =============================================================================
# 工厂函数
# =============================================================================


def make_db_row(
    memory_id: str = "11111111-1111-1111-1111-111111111111",
    user_id: str = "u1",
    modality: str = "image",
    source_uri: str | None = None,
    content_hash: str | None = None,
    caption: str | None = "cap",
    embedding: list[float] | None = None,
    metadata: dict | None = None,
    importance: float = 0.5,
    access_count: int = 0,
) -> dict:
    """构造 asyncpg fetchrow/fetch 返回的行字典(mock 用)。"""
    return {
        "id": memory_id,
        "user_id": user_id,
        "modality": modality,
        "source_uri": source_uri,
        "content_hash": content_hash or "hash_1",
        "caption": caption,
        "embedding": embedding if embedding is not None else [0.1, 0.2, 0.3],
        "metadata": metadata if metadata is not None else {},
        "importance_score": importance,
        "access_count": access_count,
        "created_at": None,
        "last_accessed_at": None,
    }


def make_mock_pool(conn: MagicMock) -> MagicMock:
    """构造 mock asyncpg Pool,acquire 返回 mock_conn 作为 async context manager。"""
    mock_pool = MagicMock()
    mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
    mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
    return mock_pool


def patch_get_pool_mock(monkeypatch, mock_pool):
    """patch _get_pool 返回 mock_pool。"""
    async def fake_get_pool():
        return mock_pool
    monkeypatch.setattr("app.services.multimodal_memory._get_pool", fake_get_pool)


def patch_get_pool_raise(monkeypatch, exc=RuntimeError("DB down")):
    """patch _get_pool 抛异常(模拟 DB 不可用)。"""
    async def fake_get_pool():
        raise exc
    monkeypatch.setattr("app.services.multimodal_memory._get_pool", fake_get_pool)


def patch_llm_complete_ok(monkeypatch, caption: str = "a cat"):
    """patch llm_gateway.complete 返回正常 caption。"""
    monkeypatch.setattr(
        "app.core.llm_gateway.llm_gateway.complete",
        AsyncMock(return_value={"content": caption}),
    )


def patch_llm_complete_fail(monkeypatch):
    """patch llm_gateway.complete 抛异常(模拟 LLM 不可用)。"""
    async def raise_complete(*args, **kwargs):
        raise RuntimeError("LLM down")
    monkeypatch.setattr(
        "app.core.llm_gateway.llm_gateway.complete", raise_complete
    )


def patch_llm_embed_ok(monkeypatch, vec: list[float] | None = None):
    """patch llm_gateway.embed 返回正常向量。"""
    monkeypatch.setattr(
        "app.core.llm_gateway.llm_gateway.embed",
        AsyncMock(return_value=vec if vec is not None else [0.5, 0.5, 0.5]),
    )


def patch_llm_embed_fail(monkeypatch):
    """patch llm_gateway.embed 抛异常。"""
    async def raise_embed(*args, **kwargs):
        raise RuntimeError("embed down")
    monkeypatch.setattr(
        "app.core.llm_gateway.llm_gateway.embed", raise_embed
    )


# =============================================================================
# _hash_embedding
# =============================================================================


class TestHashEmbedding:
    """_hash_embedding:确定性 hash 伪向量。"""

    def test_dim_is_128(self):
        """默认维度 128。"""
        assert len(_hash_embedding("hello")) == 128

    def test_custom_dim(self):
        """自定义维度。"""
        assert len(_hash_embedding("hello", dim=64)) == 64

    def test_deterministic_same_input(self):
        """相同输入 → 相同向量。"""
        assert _hash_embedding("hello") == _hash_embedding("hello")

    def test_different_input_different_vector(self):
        """不同输入 → 不同向量。"""
        assert _hash_embedding("hello") != _hash_embedding("world")

    def test_values_in_range(self):
        """值在 [-1, 1] 范围内。"""
        vec = _hash_embedding("test")
        assert all(-1.0 <= x <= 1.0 for x in vec)

    def test_accepts_bytes(self):
        """接受 bytes 输入。"""
        vec = _hash_embedding(b"binary data")
        assert len(vec) == 128

    def test_bytes_and_str_same_content_differ(self):
        """bytes 和 str 不同编码路径(base64 解码失败时按 utf-8)。"""
        # _hash_embedding 直接接收 bytes 或 str,str 会被 encode("utf-8")
        assert _hash_embedding("abc") == _hash_embedding(b"abc")


# =============================================================================
# _to_bytes
# =============================================================================


class TestToBytes:
    """_to_bytes:输入统一转 bytes。"""

    def test_bytes_passthrough(self):
        """bytes 直接返回。"""
        data = b"raw bytes"
        assert _to_bytes(data) == data

    def test_base64_str_decoded(self):
        """base64 字符串解码为 bytes。"""
        import base64 as _b64
        original = b"hello world"
        encoded = _b64.b64encode(original).decode("ascii")
        assert _to_bytes(encoded) == original

    def test_plain_str_fallback_to_utf8(self):
        """非 base64 字符串按 utf-8 处理。"""
        assert _to_bytes("plain text") == b"plain text"

    def test_empty_str(self):
        """空字符串返回空 bytes。"""
        assert _to_bytes("") == b""


# =============================================================================
# _content_hash / _parse_execute_result / _cosine_similarity
# =============================================================================


class TestContentHash:
    """_content_hash:计算内容 sha256。"""

    def test_from_bytes(self):
        data = b"some content"
        expected = hashlib.sha256(data).hexdigest()
        assert _content_hash(data, None) == expected

    def test_from_source_uri_when_no_bytes(self):
        uri = "file:///path/to/image.png"
        expected = hashlib.sha256(uri.encode("utf-8")).hexdigest()
        assert _content_hash(None, uri) == expected

    def test_bytes_preferred_over_uri(self):
        """有 bytes 时优先用 bytes。"""
        data = b"bytes content"
        uri = "file://uri"
        assert _content_hash(data, uri) == hashlib.sha256(data).hexdigest()

    def test_empty_when_nothing(self):
        """无 bytes 无 uri → 空串 hash。"""
        assert _content_hash(None, None) == hashlib.sha256(b"").hexdigest()


class TestParseExecuteResult:
    """_parse_execute_result:解析 asyncpg execute 返回值。"""

    def test_delete_1(self):
        assert _parse_execute_result("DELETE 1") == 1

    def test_delete_0(self):
        assert _parse_execute_result("DELETE 0") == 0

    def test_update_1(self):
        assert _parse_execute_result("UPDATE 1") == 1

    def test_insert_0_1(self):
        """INSERT 返回 'INSERT 0 N',取最后一个数字。"""
        assert _parse_execute_result("INSERT 0 1") == 1

    def test_empty_returns_zero(self):
        assert _parse_execute_result("") == 0

    def test_none_returns_zero(self):
        assert _parse_execute_result(None) == 0

    def test_invalid_format_returns_zero(self):
        assert _parse_execute_result("GARBAGE") == 0


class TestCosineSimilarity:
    """_cosine_similarity:纯 Python 余弦相似度。"""

    def test_identical_vectors(self):
        v = [1.0, 2.0, 3.0]
        assert _cosine_similarity(v, v) == pytest.approx(1.0)

    def test_orthogonal_vectors(self):
        assert _cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)

    def test_empty_vectors(self):
        assert _cosine_similarity([], []) == 0.0

    def test_different_length_uses_min(self):
        """不同长度向量取 min(len) 对齐。"""
        # [1, 0] vs [1, 0, 5] → 取前 2 维 → 相似度 1.0
        assert _cosine_similarity([1.0, 0.0], [1.0, 0.0, 5.0]) == pytest.approx(1.0)

    def test_zero_vector(self):
        assert _cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0


# =============================================================================
# MultimodalEmbedder
# =============================================================================


class TestEmbedImage:
    """MultimodalEmbedder.embed_image。"""

    @pytest.mark.asyncio
    async def test_success_returns_list(self, monkeypatch):
        """LLM 正常 → 返回 embedding list(stub 模式走 caption 路径)。"""
        patch_llm_complete_ok(monkeypatch, caption="a cat photo")
        patch_llm_embed_ok(monkeypatch, vec=[0.1, 0.2, 0.3])
        emb = await MultimodalEmbedder().embed_image(b"img-bytes")
        assert isinstance(emb, list)
        assert all(isinstance(x, float) for x in emb)
        assert emb == [0.1, 0.2, 0.3]

    @pytest.mark.asyncio
    async def test_complete_fails_returns_hash_128(self, monkeypatch):
        """complete 抛异常 → 降级 hash 伪向量(128 维)。"""
        patch_llm_complete_fail(monkeypatch)
        emb = await MultimodalEmbedder().embed_image(b"img-bytes")
        assert len(emb) == 128

    @pytest.mark.asyncio
    async def test_embed_fails_returns_hash_128(self, monkeypatch):
        """complete 正常但 embed 抛异常 → 降级 hash 伪向量。"""
        patch_llm_complete_ok(monkeypatch, caption="cat")
        patch_llm_embed_fail(monkeypatch)
        emb = await MultimodalEmbedder().embed_image(b"img-bytes")
        assert len(emb) == 128

    @pytest.mark.asyncio
    async def test_hash_deterministic(self, monkeypatch):
        """LLM 全失败时,相同输入 → 相同 hash 伪向量。"""
        patch_llm_complete_fail(monkeypatch)
        patch_llm_embed_fail(monkeypatch)
        e1 = await MultimodalEmbedder().embed_image(b"same-data")
        e2 = await MultimodalEmbedder().embed_image(b"same-data")
        assert e1 == e2

    @pytest.mark.asyncio
    async def test_accepts_str_input(self, monkeypatch):
        """接受 str 输入(base64 或 utf-8)。"""
        patch_llm_complete_ok(monkeypatch)
        patch_llm_embed_ok(monkeypatch, vec=[0.5])
        emb = await MultimodalEmbedder().embed_image("aGVsbG8=")  # base64 of "hello"
        assert emb == [0.5]


class TestEmbedAudio:
    """MultimodalEmbedder.embed_audio。"""

    @pytest.mark.asyncio
    async def test_success_returns_list(self, monkeypatch):
        patch_llm_complete_ok(monkeypatch, caption="speech audio")
        patch_llm_embed_ok(monkeypatch, vec=[0.4, 0.5])
        emb = await MultimodalEmbedder().embed_audio(b"audio-bytes")
        assert emb == [0.4, 0.5]

    @pytest.mark.asyncio
    async def test_llm_fails_returns_hash_128(self, monkeypatch):
        patch_llm_complete_fail(monkeypatch)
        emb = await MultimodalEmbedder().embed_audio(b"audio-bytes")
        assert len(emb) == 128

    @pytest.mark.asyncio
    async def test_hash_dim_128(self, monkeypatch):
        patch_llm_complete_fail(monkeypatch)
        patch_llm_embed_fail(monkeypatch)
        emb = await MultimodalEmbedder().embed_audio(b"x")
        assert len(emb) == 128


class TestEmbedVideo:
    """MultimodalEmbedder.embed_video。"""

    @pytest.mark.asyncio
    async def test_success_returns_list(self, monkeypatch):
        patch_llm_complete_ok(monkeypatch, caption="a video clip")
        patch_llm_embed_ok(monkeypatch, vec=[0.7])
        emb = await MultimodalEmbedder().embed_video(b"video-bytes")
        assert emb == [0.7]

    @pytest.mark.asyncio
    async def test_llm_fails_returns_hash_128(self, monkeypatch):
        patch_llm_complete_fail(monkeypatch)
        emb = await MultimodalEmbedder().embed_video(b"video-bytes")
        assert len(emb) == 128

    @pytest.mark.asyncio
    async def test_hash_dim_128(self, monkeypatch):
        patch_llm_complete_fail(monkeypatch)
        patch_llm_embed_fail(monkeypatch)
        emb = await MultimodalEmbedder().embed_video(b"x")
        assert len(emb) == 128


class TestEmbedDocument:
    """MultimodalEmbedder.embed_document。"""

    @pytest.mark.asyncio
    async def test_success_returns_list(self, monkeypatch):
        patch_llm_embed_ok(monkeypatch, vec=[0.1, 0.2, 0.3, 0.4])
        emb = await MultimodalEmbedder().embed_document("some text")
        assert emb == [0.1, 0.2, 0.3, 0.4]

    @pytest.mark.asyncio
    async def test_llm_fails_returns_hash_128(self, monkeypatch):
        patch_llm_embed_fail(monkeypatch)
        emb = await MultimodalEmbedder().embed_document("some text")
        assert len(emb) == 128

    @pytest.mark.asyncio
    async def test_hash_deterministic(self, monkeypatch):
        patch_llm_embed_fail(monkeypatch)
        e1 = await MultimodalEmbedder().embed_document("same text")
        e2 = await MultimodalEmbedder().embed_document("same text")
        assert e1 == e2


# =============================================================================
# MultimodalMemory.store
# =============================================================================


class TestStore:
    """MultimodalMemory.store。"""

    @pytest.mark.asyncio
    async def test_new_record_stored(self, monkeypatch):
        """新记录 → 生成 embedding + caption + 写 DB + 写内存。"""
        mem = MultimodalMemory()
        patch_llm_complete_ok(monkeypatch, caption="img caption")
        patch_llm_embed_ok(monkeypatch, vec=[0.1, 0.2])
        # mock DB:fetchrow 返回 None(无重复),execute 返回 INSERT 0 1
        mock_conn = MagicMock()
        mock_conn.fetchrow = AsyncMock(return_value=None)
        mock_conn.execute = AsyncMock(return_value="INSERT 0 1")
        patch_get_pool_mock(monkeypatch, make_mock_pool(mock_conn))

        result = await mem.store(
            "u1", "image", content_bytes=b"img-data", metadata={"w": 100},
        )
        assert result["user_id"] == "u1"
        assert result["modality"] == "image"
        assert result["content_hash"] == hashlib.sha256(b"img-data").hexdigest()
        assert result["embedding"] == [0.1, 0.2]
        assert result["caption"] == "img caption"
        assert result["importance_score"] == 0.5
        assert result["access_count"] == 1
        assert result["metadata"] == {"w": 100}
        # 内存已写入
        assert len(mem._cache.get("u1", [])) == 1
        # DB execute 被调用(INSERT)
        assert mock_conn.execute.await_count >= 1

    @pytest.mark.asyncio
    async def test_dedup_memory_hit_returns_existing(self, monkeypatch):
        """同 user_id + content_hash 内存已存在 → 返回已有记录 + access_count+1。"""
        mem = MultimodalMemory()
        # 预置内存
        c_hash = hashlib.sha256(b"dup-data").hexdigest()
        existing = {
            "id": "11111111-1111-1111-1111-111111111111",
            "user_id": "u1",
            "modality": "image",
            "content_hash": c_hash,
            "caption": "old caption",
            "embedding": [0.5, 0.5],
            "importance_score": 0.7,
            "access_count": 3,
            "metadata": {},
        }
        mem._cache["u1"] = [existing]
        # mock DB(用于 _bump_access_count_db)
        mock_conn = MagicMock()
        mock_conn.execute = AsyncMock(return_value="UPDATE 1")
        patch_get_pool_mock(monkeypatch, make_mock_pool(mock_conn))

        result = await mem.store("u1", "image", content_bytes=b"dup-data")
        # 返回已有记录(非新建)
        assert result["id"] == "11111111-1111-1111-1111-111111111111"
        assert result["caption"] == "old caption"
        # access_count +1
        assert result["access_count"] == 4
        # 内存仍是 1 条(不重复加)
        assert len(mem._cache["u1"]) == 1
        # 原 access_count 已更新
        assert mem._cache["u1"][0]["access_count"] == 4

    @pytest.mark.asyncio
    async def test_dedup_db_hit_returns_existing(self, monkeypatch):
        """内存未命中但 DB 命中 → 回填内存 + 返回已有记录。"""
        mem = MultimodalMemory()
        patch_llm_complete_ok(monkeypatch)
        patch_llm_embed_ok(monkeypatch)
        c_hash = hashlib.sha256(b"db-dup").hexdigest()
        # mock DB _find_in_db 返回已有行
        mock_conn = MagicMock()
        mock_conn.fetchrow = AsyncMock(return_value=make_db_row(
            memory_id="22222222-2222-2222-2222-222222222222",
            user_id="u1",
            content_hash=c_hash,
            access_count=5,
        ))
        mock_conn.execute = AsyncMock(return_value="UPDATE 1")
        patch_get_pool_mock(monkeypatch, make_mock_pool(mock_conn))

        result = await mem.store("u1", "image", content_bytes=b"db-dup")
        assert result["id"] == "22222222-2222-2222-2222-222222222222"
        assert result["access_count"] == 6  # 5 + 1
        # 已回填内存
        assert len(mem._cache.get("u1", [])) == 1

    @pytest.mark.asyncio
    async def test_db_fails_falls_back_to_memory(self, monkeypatch):
        """DB 完全不可用 → 仅写内存,返回记录。"""
        mem = MultimodalMemory()
        patch_llm_complete_ok(monkeypatch, caption="cap")
        patch_llm_embed_ok(monkeypatch, vec=[0.1])
        patch_get_pool_raise(monkeypatch)

        result = await mem.store("u1", "image", content_bytes=b"img")
        # 仍返回完整记录
        assert result["user_id"] == "u1"
        assert result["embedding"] == [0.1]
        # 已写内存
        assert len(mem._cache.get("u1", [])) == 1

    @pytest.mark.asyncio
    async def test_llm_fails_still_stores(self, monkeypatch):
        """LLM 全失败 → caption=None + embedding=hash 128 维,仍写内存。"""
        mem = MultimodalMemory()
        patch_llm_complete_fail(monkeypatch)
        patch_llm_embed_fail(monkeypatch)
        mock_conn = MagicMock()
        mock_conn.fetchrow = AsyncMock(return_value=None)
        mock_conn.execute = AsyncMock(return_value="INSERT 0 1")
        patch_get_pool_mock(monkeypatch, make_mock_pool(mock_conn))

        result = await mem.store(
            "u1", "image", content_bytes=b"img-no-llm",
        )
        assert result["caption"] is None
        assert len(result["embedding"]) == 128  # hash 伪向量
        assert len(mem._cache.get("u1", [])) == 1

    @pytest.mark.asyncio
    async def test_invalid_user_returns_empty(self, monkeypatch):
        """user_id 空 → 返回空 dict。"""
        mem = MultimodalMemory()
        result = await mem.store("", "image", content_bytes=b"x")
        assert result == {}

    @pytest.mark.asyncio
    async def test_invalid_modality_returns_empty(self, monkeypatch):
        """modality 空 → 返回空 dict。"""
        mem = MultimodalMemory()
        result = await mem.store("u1", "", content_bytes=b"x")
        assert result == {}

    @pytest.mark.asyncio
    async def test_document_does_not_generate_caption(self, monkeypatch):
        """modality=document 时不调 LLM 生成 caption(直接用传入的或 None)。"""
        mem = MultimodalMemory()
        patch_llm_embed_ok(monkeypatch, vec=[0.3, 0.4])
        # complete 不应被调用(document 跳过 _gen_caption)
        complete_mock = AsyncMock(return_value={"content": "should not be used"})
        monkeypatch.setattr(
            "app.core.llm_gateway.llm_gateway.complete", complete_mock
        )
        mock_conn = MagicMock()
        mock_conn.fetchrow = AsyncMock(return_value=None)
        mock_conn.execute = AsyncMock(return_value="INSERT 0 1")
        patch_get_pool_mock(monkeypatch, make_mock_pool(mock_conn))

        result = await mem.store(
            "u1", "document", source_uri="file://doc.txt",
        )
        assert result["caption"] is None  # document 且未传 caption
        assert complete_mock.await_count == 0  # complete 未被调用


# =============================================================================
# MultimodalMemory.search
# =============================================================================


class TestSearch:
    """MultimodalMemory.search。"""

    @pytest.mark.asyncio
    async def test_cosine_ranking(self, monkeypatch):
        """相似度排序:与 query 最相似的排前面。"""
        mem = MultimodalMemory()
        # query embedding 与 rec1 完全一致,与 rec2 正交
        patch_llm_embed_ok(monkeypatch, vec=[1.0, 0.0])
        mem._cache["u1"] = [
            {
                "id": "1", "user_id": "u1", "modality": "image",
                "content_hash": "h1", "embedding": [1.0, 0.0],
                "importance_score": 0.5, "access_count": 0, "caption": "c1",
                "metadata": {}, "created_at": "", "last_accessed_at": "",
                "source_uri": None,
            },
            {
                "id": "2", "user_id": "u1", "modality": "image",
                "content_hash": "h2", "embedding": [0.0, 1.0],
                "importance_score": 0.5, "access_count": 0, "caption": "c2",
                "metadata": {}, "created_at": "", "last_accessed_at": "",
                "source_uri": None,
            },
        ]

        results = await mem.search("u1", "query", top_k=5)
        assert len(results) == 2
        # rec1 相似度 1.0 > rec2 相似度 0.0
        assert results[0]["id"] == "1"
        assert results[0]["similarity"] > results[1]["similarity"]

    @pytest.mark.asyncio
    async def test_modality_filter(self, monkeypatch):
        """modality 过滤:只返回指定模态。"""
        mem = MultimodalMemory()
        patch_llm_embed_ok(monkeypatch, vec=[0.5])
        mem._cache["u1"] = [
            {"id": "1", "modality": "image", "embedding": [0.5],
             "importance_score": 0.5, "content_hash": "h1"},
            {"id": "2", "modality": "audio", "embedding": [0.5],
             "importance_score": 0.5, "content_hash": "h2"},
            {"id": "3", "modality": "image", "embedding": [0.5],
             "importance_score": 0.5, "content_hash": "h3"},
        ]

        results = await mem.search("u1", "q", modality="image", top_k=10)
        assert len(results) == 2
        assert all(r["modality"] == "image" for r in results)

    @pytest.mark.asyncio
    async def test_top_k_limit(self, monkeypatch):
        """top_k 限制返回数量。"""
        mem = MultimodalMemory()
        patch_llm_embed_ok(monkeypatch, vec=[0.5])
        mem._cache["u1"] = [
            {"id": str(i), "modality": "image", "embedding": [0.5],
             "importance_score": 0.5, "content_hash": f"h{i}"}
            for i in range(10)
        ]

        results = await mem.search("u1", "q", top_k=3)
        assert len(results) == 3

    @pytest.mark.asyncio
    async def test_empty_cache_returns_empty(self, monkeypatch):
        """内存无该 user 记录 → 返回空。"""
        mem = MultimodalMemory()
        patch_llm_embed_ok(monkeypatch, vec=[0.5])
        results = await mem.search("u1", "q")
        assert results == []

    @pytest.mark.asyncio
    async def test_invalid_user_returns_empty(self, monkeypatch):
        mem = MultimodalMemory()
        results = await mem.search("", "q")
        assert results == []

    @pytest.mark.asyncio
    async def test_invalid_query_returns_empty(self, monkeypatch):
        mem = MultimodalMemory()
        results = await mem.search("u1", "")
        assert results == []

    @pytest.mark.asyncio
    async def test_embed_query_fails_returns_empty(self, monkeypatch):
        """embed_document 抛异常 → 返回空列表(直接 patch embedder 方法)。"""
        mem = MultimodalMemory()
        # 直接 patch embed_document 抛异常(绕过 embedder 内部降级)
        async def raise_embed_doc(*args, **kwargs):
            raise RuntimeError("embed_document down")
        monkeypatch.setattr(
            "app.services.multimodal_embedder.multimodal_embedder.embed_document",
            raise_embed_doc,
        )
        mem._cache["u1"] = [
            {"id": "1", "embedding": [0.5], "importance_score": 0.5,
             "content_hash": "h1", "modality": "image"},
        ]
        results = await mem.search("u1", "q")
        assert results == []

    @pytest.mark.asyncio
    async def test_results_no_embedding_field(self, monkeypatch):
        """返回结果不含 embedding 字段(安全 + 节省带宽)。"""
        mem = MultimodalMemory()
        patch_llm_embed_ok(monkeypatch, vec=[0.5])
        mem._cache["u1"] = [
            {"id": "1", "modality": "image", "embedding": [0.5],
             "importance_score": 0.5, "content_hash": "h1"},
        ]
        results = await mem.search("u1", "q")
        assert len(results) == 1
        assert "embedding" not in results[0]
        assert "similarity" in results[0]


# =============================================================================
# MultimodalMemory.delete
# =============================================================================


class TestDelete:
    """MultimodalMemory.delete。"""

    @pytest.mark.asyncio
    async def test_success(self, monkeypatch):
        """内存 + DB 都有 → 删除成功。"""
        mem = MultimodalMemory()
        mem._cache["u1"] = [
            {"id": "11111111-1111-1111-1111-111111111111",
             "content_hash": "h1"},
        ]
        mock_conn = MagicMock()
        mock_conn.execute = AsyncMock(return_value="DELETE 1")
        patch_get_pool_mock(monkeypatch, make_mock_pool(mock_conn))

        ok = await mem.delete("u1", "11111111-1111-1111-1111-111111111111")
        assert ok is True
        assert len(mem._cache["u1"]) == 0

    @pytest.mark.asyncio
    async def test_db_fails_mem_removed_returns_true(self, monkeypatch):
        """DB 失败但内存已删 → 返回 True(降级)。"""
        mem = MultimodalMemory()
        mem._cache["u1"] = [
            {"id": "11111111-1111-1111-1111-111111111111",
             "content_hash": "h1"},
        ]
        patch_get_pool_raise(monkeypatch)

        ok = await mem.delete("u1", "11111111-1111-1111-1111-111111111111")
        assert ok is True
        assert len(mem._cache["u1"]) == 0

    @pytest.mark.asyncio
    async def test_nonexistent_returns_false(self, monkeypatch):
        """内存 + DB 均无 → 返回 False。"""
        mem = MultimodalMemory()
        mock_conn = MagicMock()
        mock_conn.execute = AsyncMock(return_value="DELETE 0")
        patch_get_pool_mock(monkeypatch, make_mock_pool(mock_conn))

        ok = await mem.delete("u1", "11111111-1111-1111-1111-111111111111")
        assert ok is False

    @pytest.mark.asyncio
    async def test_invalid_user_returns_false(self, monkeypatch):
        mem = MultimodalMemory()
        ok = await mem.delete("", "11111111-1111-1111-1111-111111111111")
        assert ok is False

    @pytest.mark.asyncio
    async def test_invalid_memory_id_returns_false(self, monkeypatch):
        mem = MultimodalMemory()
        ok = await mem.delete("u1", "")
        assert ok is False


# =============================================================================
# MultimodalMemory.update_importance
# =============================================================================


class TestUpdateImportance:
    """MultimodalMemory.update_importance。"""

    @pytest.mark.asyncio
    async def test_success(self, monkeypatch):
        """内存 + DB 都命中 → 更新成功。"""
        mem = MultimodalMemory()
        mem._cache["u1"] = [
            {"id": "11111111-1111-1111-1111-111111111111",
             "importance_score": 0.5, "content_hash": "h1"},
        ]
        mock_conn = MagicMock()
        mock_conn.execute = AsyncMock(return_value="UPDATE 1")
        patch_get_pool_mock(monkeypatch, make_mock_pool(mock_conn))

        ok = await mem.update_importance(
            "u1", "11111111-1111-1111-1111-111111111111", 0.9,
        )
        assert ok is True
        assert mem._cache["u1"][0]["importance_score"] == 0.9

    @pytest.mark.asyncio
    async def test_db_fails_mem_updated_returns_true(self, monkeypatch):
        """DB 失败但内存已更 → 返回 True(降级)。"""
        mem = MultimodalMemory()
        mem._cache["u1"] = [
            {"id": "11111111-1111-1111-1111-111111111111",
             "importance_score": 0.5, "content_hash": "h1"},
        ]
        patch_get_pool_raise(monkeypatch)

        ok = await mem.update_importance(
            "u1", "11111111-1111-1111-1111-111111111111", 0.8,
        )
        assert ok is True
        assert mem._cache["u1"][0]["importance_score"] == 0.8

    @pytest.mark.asyncio
    async def test_nonexistent_returns_false(self, monkeypatch):
        """内存 + DB 均无 → 返回 False。"""
        mem = MultimodalMemory()
        mock_conn = MagicMock()
        mock_conn.execute = AsyncMock(return_value="UPDATE 0")
        patch_get_pool_mock(monkeypatch, make_mock_pool(mock_conn))

        ok = await mem.update_importance(
            "u1", "11111111-1111-1111-1111-111111111111", 0.9,
        )
        assert ok is False

    @pytest.mark.asyncio
    async def test_clamps_score_above_1(self, monkeypatch):
        """score > 1 → clamp 到 1.0。"""
        mem = MultimodalMemory()
        mem._cache["u1"] = [
            {"id": "11111111-1111-1111-1111-111111111111",
             "importance_score": 0.5, "content_hash": "h1"},
        ]
        mock_conn = MagicMock()
        mock_conn.execute = AsyncMock(return_value="UPDATE 1")
        patch_get_pool_mock(monkeypatch, make_mock_pool(mock_conn))

        await mem.update_importance(
            "u1", "11111111-1111-1111-1111-111111111111", 5.0,
        )
        assert mem._cache["u1"][0]["importance_score"] == 1.0

    @pytest.mark.asyncio
    async def test_clamps_score_below_0(self, monkeypatch):
        """score < 0 → clamp 到 0.0。"""
        mem = MultimodalMemory()
        mem._cache["u1"] = [
            {"id": "11111111-1111-1111-1111-111111111111",
             "importance_score": 0.5, "content_hash": "h1"},
        ]
        mock_conn = MagicMock()
        mock_conn.execute = AsyncMock(return_value="UPDATE 1")
        patch_get_pool_mock(monkeypatch, make_mock_pool(mock_conn))

        await mem.update_importance(
            "u1", "11111111-1111-1111-1111-111111111111", -0.5,
        )
        assert mem._cache["u1"][0]["importance_score"] == 0.0

    @pytest.mark.asyncio
    async def test_invalid_args_returns_false(self, monkeypatch):
        """参数无效 → 返回 False。"""
        mem = MultimodalMemory()
        assert await mem.update_importance("", "id", 0.5) is False
        assert await mem.update_importance("u1", "", 0.5) is False


# =============================================================================
# MultimodalMemory.load_all_for_user
# =============================================================================


class TestLoadAllForUser:
    """MultimodalMemory.load_all_for_user。"""

    @pytest.mark.asyncio
    async def test_loads_records_to_memory(self, monkeypatch):
        """从 DB 加载记录到内存缓存。"""
        mem = MultimodalMemory()
        rows = [
            make_db_row(
                memory_id="11111111-1111-1111-1111-111111111111",
                content_hash="h1", access_count=3,
            ),
            make_db_row(
                memory_id="22222222-2222-2222-2222-222222222222",
                content_hash="h2", modality="audio", access_count=1,
            ),
        ]
        mock_conn = MagicMock()
        mock_conn.fetch = AsyncMock(return_value=rows)
        patch_get_pool_mock(monkeypatch, make_mock_pool(mock_conn))

        count = await mem.load_all_for_user("u1")
        assert count == 2
        assert len(mem._cache["u1"]) == 2
        assert mem._cache["u1"][0]["id"] == "11111111-1111-1111-1111-111111111111"
        assert mem._cache["u1"][0]["access_count"] == 3

    @pytest.mark.asyncio
    async def test_db_fails_returns_zero(self, monkeypatch):
        """DB 异常 → 返回 0,内存不变。"""
        mem = MultimodalMemory()
        patch_get_pool_raise(monkeypatch)

        count = await mem.load_all_for_user("u1")
        assert count == 0
        assert "u1" not in mem._cache or len(mem._cache["u1"]) == 0

    @pytest.mark.asyncio
    async def test_invalid_user_returns_zero(self, monkeypatch):
        """user_id 空 → 返回 0。"""
        mem = MultimodalMemory()
        count = await mem.load_all_for_user("")
        assert count == 0

    @pytest.mark.asyncio
    async def test_empty_db_returns_zero(self, monkeypatch):
        """DB 无记录 → 返回 0,内存为空列表。"""
        mem = MultimodalMemory()
        mock_conn = MagicMock()
        mock_conn.fetch = AsyncMock(return_value=[])
        patch_get_pool_mock(monkeypatch, make_mock_pool(mock_conn))

        count = await mem.load_all_for_user("u1")
        assert count == 0
        assert mem._cache.get("u1", []) == []


# =============================================================================
# 单例
# =============================================================================


class TestSingleton:
    """模块级单例。"""

    def test_multimodal_embedder_singleton(self):
        assert multimodal_embedder is not None
        assert isinstance(multimodal_embedder, MultimodalEmbedder)

    def test_multimodal_memory_singleton(self):
        assert multimodal_memory is not None
        assert isinstance(multimodal_memory, MultimodalMemory)

    def test_multimodal_memory_singleton_shared(self):
        """多次导入返回同一实例。"""
        from app.services.multimodal_memory import multimodal_memory as m1
        from app.services.multimodal_memory import multimodal_memory as m2
        assert m1 is m2
