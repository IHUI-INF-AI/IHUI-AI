# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""O19(2026-09-21)向量记忆属主隔离(user_id 维度)单元测试。

覆盖:
- add_entry(user_id=...) 写入 entry["user_id"] 属主标记(不改动调用方 dict)
- search(user_id=...) 精确相等过滤:同 user 可见 / 异 user 不可见
- 旧格式条目(无 user_id)对任何已认证用户 fail-closed 不可见
- user_id=None 保留旧全量语义(仅进程内可信调用方;HTTP 端点必传认证身份)
- 不传 user_id 参数的既有调用路径行为与改造前一致
- pgvector 路径结果同样按 metadata.user_id 过滤;过滤后为空回落内存索引
- clear(user_id=...) 属主维度清除(旧条目不受影响)
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services import vector_memory as vm_mod
from app.services.vector_memory import VectorMemoryStore

USER_A = "user-a-vm59"
USER_B = "user-b-vm59"

# pgvector search stub 返回的混合属主结果(metadata 即 entry)
_PG_RESULTS_MIXED: list[tuple[str, dict[str, Any], float]] = [
    ("pg-a", {"content": "pg owned by A", "user_id": USER_A}, 0.95),
    ("pg-b", {"content": "pg owned by B", "user_id": USER_B}, 0.90),
    ("pg-legacy", {"content": "pg legacy no owner"}, 0.85),
]


@pytest.fixture(autouse=True)
def _isolate(monkeypatch: pytest.MonkeyPatch) -> None:
    """纯内存模式:禁 Redis L2 + 关 pgvector(零 DB 触达,§5 测试隔离铁律)。"""
    monkeypatch.setattr(vm_mod, "_redis_checked", True)
    monkeypatch.setattr(vm_mod, "_redis_client", None)
    monkeypatch.setenv("IHUI_PGVECTOR_DISABLE", "1")


@pytest.fixture
def store(tmp_path) -> VectorMemoryStore:
    return VectorMemoryStore(persist_path=str(tmp_path / "memory.json"))


# =============================================================================
# add_entry 属主标记
# =============================================================================


async def test_add_entry_with_user_id_writes_owner(store: VectorMemoryStore):
    """传入 user_id 时写入 entry["user_id"],并持久化。"""
    await store.add_entry("e1", {"content": "a"}, [0.1], user_id=USER_A)
    assert store._entries["e1"]["user_id"] == USER_A


async def test_add_entry_does_not_mutate_caller_dict(store: VectorMemoryStore):
    """属主标记写入存储副本,不改动调用方传入的 dict。"""
    entry = {"content": "a"}
    await store.add_entry("e1", entry, [0.1], user_id=USER_A)
    assert "user_id" not in entry
    assert store._entries["e1"]["user_id"] == USER_A


async def test_add_entry_without_user_id_no_field(store: VectorMemoryStore):
    """不传 user_id(既有调用路径)时条目不含 user_id 字段 = 属主未知。"""
    await store.add_entry("e1", {"content": "a"}, [0.1])
    assert "user_id" not in store._entries["e1"]


# =============================================================================
# search 属主过滤(内存路径;pgvector 已被环境变量禁用)
# =============================================================================


async def test_search_same_user_visible(store: VectorMemoryStore):
    """带 user_id 写入后,同一 user 检索可见。"""
    await store.add_entry("e1", {"content": "a"}, [1.0, 0.0], user_id=USER_A)
    results = await store.search([1.0, 0.0], top_k=5, threshold=0.5, user_id=USER_A)
    assert [r[0] for r in results] == ["e1"]
    assert results[0][1]["user_id"] == USER_A


async def test_search_other_user_not_visible(store: VectorMemoryStore):
    """按另一 user 检索不可见(精确相等,无前缀/模糊)。"""
    await store.add_entry("e1", {"content": "a"}, [1.0, 0.0], user_id=USER_A)
    assert await store.search([1.0, 0.0], threshold=0.0, user_id=USER_B) == []


async def test_search_user_id_exact_match_not_prefix(store: VectorMemoryStore):
    """user_id 精确相等:前缀相近但不相等的 user 不可见。"""
    await store.add_entry("e1", {"content": "a"}, [1.0, 0.0], user_id=USER_A)
    assert await store.search([1.0, 0.0], threshold=0.0, user_id=USER_A + "-x") == []


async def test_legacy_entry_invisible_to_any_user(store: VectorMemoryStore):
    """旧格式条目(无 user_id)对任何已认证用户 fail-closed 不可见。"""
    await store.add_entry("legacy", {"content": "old"}, [1.0, 0.0])
    assert await store.search([1.0, 0.0], threshold=0.0, user_id=USER_A) == []
    assert await store.search([1.0, 0.0], threshold=0.0, user_id=USER_B) == []


async def test_search_user_id_none_keeps_full_semantics(store: VectorMemoryStore):
    """user_id=None = 未声明属主,保留旧全量语义(新旧条目都返回)。"""
    await store.add_entry("e1", {"content": "a"}, [1.0, 0.0], user_id=USER_A)
    await store.add_entry("legacy", {"content": "b"}, [1.0, 0.0])
    results = await store.search([1.0, 0.0], threshold=0.0, user_id=None)
    assert {r[0] for r in results} == {"e1", "legacy"}


async def test_search_without_user_id_param_unchanged(store: VectorMemoryStore):
    """不传 user_id 参数的既有调用路径行为与改造前一致(全量返回)。"""
    await store.add_entry("e1", {"content": "a"}, [1.0, 0.0], user_id=USER_A)
    await store.add_entry("legacy", {"content": "b"}, [1.0, 0.0])
    results = await store.search([1.0, 0.0], top_k=5, threshold=0.0)
    assert {r[0] for r in results} == {"e1", "legacy"}


async def test_search_user_filter_applies_before_top_k(store: VectorMemoryStore):
    """属主过滤先于 top_k 截断:异 user 高分条目不挤占同 user 名额。"""
    await store.add_entry("other-high", {"content": "b"}, [1.0, 0.0], user_id=USER_B)
    await store.add_entry("mine", {"content": "a"}, [0.9, 0.1], user_id=USER_A)
    results = await store.search([1.0, 0.0], top_k=1, threshold=0.0, user_id=USER_A)
    assert [r[0] for r in results] == ["mine"]


# =============================================================================
# search 属主过滤(pgvector 路径,mock search_chunks)
# =============================================================================


async def test_pg_results_filtered_by_user(
    store: VectorMemoryStore, monkeypatch: pytest.MonkeyPatch
):
    """pgvector 路径结果同样按 metadata.user_id 精确过滤。"""

    async def _stub_search(*args: Any, **kwargs: Any) -> list[tuple[str, dict[str, Any], float]]:
        return list(_PG_RESULTS_MIXED)

    monkeypatch.setattr("app.services.pgvector_store.search_chunks", _stub_search)

    only_a = await store.search([1.0, 0.0], threshold=0.0, user_id=USER_A)
    assert [r[0] for r in only_a] == ["pg-a"]
    only_b = await store.search([1.0, 0.0], threshold=0.0, user_id=USER_B)
    assert [r[0] for r in only_b] == ["pg-b"]


async def test_pg_results_all_filtered_falls_back_to_memory(
    store: VectorMemoryStore, monkeypatch: pytest.MonkeyPatch
):
    """pg 结果被属主过滤清空后回落内存索引再筛(防镜像缺失漏召回,不泄漏)。"""

    async def _stub_search(*args: Any, **kwargs: Any) -> list[tuple[str, dict[str, Any], float]]:
        return [("pg-b", {"content": "pg owned by B", "user_id": USER_B}, 0.95)]

    monkeypatch.setattr("app.services.pgvector_store.search_chunks", _stub_search)
    await store.add_entry("mem-a", {"content": "a"}, [1.0, 0.0], user_id=USER_A)

    results = await store.search([1.0, 0.0], threshold=0.0, user_id=USER_A)
    assert [r[0] for r in results] == ["mem-a"]


# =============================================================================
# clear 属主维度
# =============================================================================


async def test_clear_by_user_id(store: VectorMemoryStore):
    """clear(user_id=...) 只清该属主条目;旧格式条目不受影响。"""
    await store.add_entry("a1", {"content": "a"}, [0.1], user_id=USER_A)
    await store.add_entry("b1", {"content": "b"}, [0.2], user_id=USER_B)
    await store.add_entry("legacy", {"content": "c"}, [0.3])

    await store.clear(user_id=USER_A)
    assert set(store.list_entry_ids()) == {"b1", "legacy"}


async def test_clear_by_user_and_session(store: VectorMemoryStore):
    """clear(session_id=..., user_id=...) 双条件取交集。"""
    await store.add_entry("a-s1", {"session_id": "s1"}, [0.1], user_id=USER_A)
    await store.add_entry("a-s2", {"session_id": "s2"}, [0.2], user_id=USER_A)
    await store.add_entry("b-s1", {"session_id": "s1"}, [0.3], user_id=USER_B)

    await store.clear(session_id="s1", user_id=USER_A)
    assert set(store.list_entry_ids()) == {"a-s2", "b-s1"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
