# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-019 夹具:语义召回必须把属主下推到检索层,而不是先取全局 top_k 再事后过滤。

旧码行为(`context_recall.py` 的 `search(...)` 不传 user_id):
- pg 路径 SQL 先按全局 top_k 截断,应用层 `continue` 掉他人 ⇒ 本人确有匹配却返回空。
本文件三条:
1) 行为级:他人条目占满名额时,本人仍能召回(旧码红);
2) 下推形状:`search_chunks` 的属主条件必须出现在 LIMIT 之前(旧码无该参数 ⇒ 红);
3) 传参链:vector_memory.search 必须把 user_id 透传给 search_chunks(旧码红)。
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402

from app.services.context_recall import ContextRecallService  # noqa: E402
from app.services.vector_memory import VectorMemoryStore  # noqa: E402


class _PgLimitStore:
    """模拟 pgvector 检索接口:top_k 是检索层名额,属主必须由调用方下推。

    这里刻意不替调用方"兜底过滤"—— 旧码正是没传 user_id 才让检索层返回全局 top_k,
    应用层再 continue 已为时过晚。传了 user_id 的检索层才会先收窄再 LIMIT。
    """

    def __init__(self, entries: list[tuple[str, dict]]) -> None:
        self._entries = entries
        self.calls: list[dict] = []

    async def embed(self, text: str, model: str | None = None) -> list[float]:
        return [0.0]

    async def search(
        self,
        query_embedding: list[float],
        top_k: int = 10,
        threshold: float = 0.7,
        user_id: str | None = None,
    ) -> list[tuple[str, dict, float]]:
        self.calls.append({"top_k": top_k, "user_id": user_id})
        rows = list(self._entries)
        if user_id is not None:
            rows = [r for r in rows if r[1].get("user_id") == user_id]
        return [(eid, entry, 0.9) for eid, entry in rows[:top_k]]


async def test_recall_owner_is_pushed_down_not_crowded_out() -> None:
    """他人命中占满 top_k 名额时,本人仍能召回自己的压缩原文。

    构造:20 条 u-other 的高相似条目排在前面,1 条 u-me 排在最后;top_k=3。
    旧码不传 user_id ⇒ 检索层返回前 3 条全是他人 ⇒ 应用层过滤后 results=[]。
    新码传 user_id ⇒ 检索层先收窄到 u-me ⇒ 命中。
    """
    entries = [
        (f"other-{i}", {"user_id": "u-other", "session_id": "s-other", "text": f"他人内容{i}"})
        for i in range(20)
    ] + [("mine-1", {"user_id": "u-me", "session_id": "s-me", "text": "我自己的旧消息原文"})]
    svc = ContextRecallService(store=_PgLimitStore(entries))  # type: ignore[arg-type]

    result = await svc.recall(session_id=None, query="任意查询", top_k=3, user_id="u-me")

    assert result["ok"] is True
    assert [r["text"] for r in result["results"]] == ["我自己的旧消息原文"]
    # 检索调用必须显式带属主,而不是交给应用层事后过滤。
    assert svc._store.calls[0]["user_id"] == "u-me"  # type: ignore[attr-defined]


async def test_search_chunks_pushes_owner_filter_before_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    """pg SQL 必须先按属主收窄再 LIMIT;旧函数签名没有 user_id ⇒ TypeError(红)。"""
    from app.services import pgvector_store

    class _Pool:
        def __init__(self) -> None:
            self.sql = ""
            self.args: tuple = ()

        async def fetch(self, sql: str, *args: object) -> list:
            self.sql = sql
            self.args = args
            return []

    pool = _Pool()

    async def _fake_get_pool() -> _Pool:
        return pool

    async def _fake_ensure(_pool: object) -> bool:
        return True

    monkeypatch.setattr("app.core.db_pool.get_shared_pool", _fake_get_pool)
    monkeypatch.setattr(pgvector_store, "_ensure_schema", _fake_ensure)
    monkeypatch.setattr(pgvector_store, "_disabled", False)
    monkeypatch.setattr(pgvector_store, "_consecutive_failures", 0)
    monkeypatch.delenv("IHUI_PGVECTOR_DISABLE", raising=False)

    await pgvector_store.search_chunks("vector_memory", [0.1, 0.2], top_k=3, user_id="u-me")

    assert "metadata->>'user_id' = $5" in pool.sql
    assert pool.args[-1] == "u-me"
    # 属主条件出现在 LIMIT 之前 = 下推,而非事后过滤。
    assert pool.sql.index("metadata->>'user_id'") < pool.sql.index("LIMIT")


async def test_vector_memory_forwards_user_id_to_pg_search(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """vector_memory.search 必须把 user_id 透传给 search_chunks;旧码不传 ⇒ 断言红。"""
    from app.services import pgvector_store

    captured: dict = {}

    async def _fake_search_chunks(
        namespace: str,
        query_embedding: list[float],
        top_k: int = 10,
        threshold: float = 0.7,
        user_id: str | None = None,
    ) -> list:
        captured.update({"top_k": top_k, "user_id": user_id})
        return []

    monkeypatch.setattr(pgvector_store, "search_chunks", _fake_search_chunks)
    store = VectorMemoryStore(persist_path=str(tmp_path / "vm.json"))

    await store.search([0.1, 0.2], top_k=3, threshold=0.7, user_id="u-me")

    assert captured["user_id"] == "u-me"
    assert captured["top_k"] == 3
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
