# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""会话级内存账本的封顶(2026-11-01 安全强化同族第 4 批)。

两处共同形态:**内层有封顶,外层键只增不删**,而外层键都是客户端可控的值。
- `core/sse_contract.ADMISSION_SEEN`:每会话的 inputId 留痕有 `limit` 封顶(调用方传),
  但会话数本身没有 ⇒ 每来一个新 conversationId 就留下一枚永久键;
- `services/artifacts_store._fallback_cache`:此前**每次 save 都镜像**,连 Redis 已写成功
  也照抄一份进进程(与 Redis 那份完全重复),键同样是会话 id。
两处都补外层封顶,并把逐出量做成可观测计数(有上限必须量得到,否则只是口头承诺)。
反向牙:摘掉封顶/恢复"始终镜像",对应断言即红;正向对照证明去重语义与兜底读回都没变。
"""

from __future__ import annotations

import pytest

from app.core import sse_contract
from app.services import artifacts_store


@pytest.fixture(autouse=True)
def _clean():
    sse_contract.ADMISSION_SEEN.clear()
    artifacts_store._fallback_cache.clear()
    yield
    sse_contract.ADMISSION_SEEN.clear()
    artifacts_store._fallback_cache.clear()


# ------------------------------------------------------------------ 准入留痕账本


def test_admission_dedup_semantics_unchanged() -> None:
    """正向对照:同一 inputId 第二次仍判 duplicate(封顶改动没碰协议语义)。"""
    assert sse_contract.take_admission("conv-1", "in-1", limit=8) == "accepted"
    assert sse_contract.take_admission("conv-1", "in-1", limit=8) == "duplicate"


def test_admission_outer_conversation_keys_are_capped(monkeypatch) -> None:
    monkeypatch.setattr(sse_contract, "ADMISSION_CONVERSATIONS_LIMIT", 3)
    for i in range(10):
        sse_contract.take_admission(f"conv-{i}", "same-input", limit=8)
    assert len(sse_contract.ADMISSION_SEEN) <= 3, "外层会话键必须封顶"
    assert sse_contract.admission_conversation_evictions >= 7, "逐出必须量得到"
    # 被逐出的老会话再次准入仍是 accepted(逐出=忘记留痕,不冒充 duplicate)
    assert sse_contract.take_admission("conv-0", "same-input", limit=8) == "accepted"


def test_release_returns_the_conversation_key_when_ledger_empties() -> None:
    """空账本交还键,不靠撞满 FIFO 才回收。"""
    sse_contract.take_admission("conv-x", "in-9", limit=8)
    assert "conv-x" in sse_contract.ADMISSION_SEEN
    sse_contract.release_admission("conv-x", "in-9")
    assert "conv-x" not in sse_contract.ADMISSION_SEEN


def test_release_still_keeps_other_inputs_tracked() -> None:
    """撤痕只撤这一枚,别把同会话其它准入一起清掉(那会误放重复执行)。"""
    sse_contract.take_admission("conv-y", "in-a", limit=8)
    sse_contract.take_admission("conv-y", "in-b", limit=8)
    sse_contract.release_admission("conv-y", "in-a")
    assert sse_contract.take_admission("conv-y", "in-b", limit=8) == "duplicate"
    assert sse_contract.take_admission("conv-y", "in-a", limit=8) == "accepted"


# ------------------------------------------------------------------ 产物降级镜像


def test_fallback_mirror_only_on_degradation(monkeypatch) -> None:
    """Redis 写成功时不再往进程里抄第二份产物正文。"""
    class _Pipe:
        def hset(self, *a, **k): return self
        def expire(self, *a, **k): return self
        def execute(self): return [1, True]

    class _Client:
        def pipeline(self): return _Pipe()
        def delete(self, *a): return 1

    monkeypatch.setattr(artifacts_store, "_get_redis", lambda: _Client())
    assert artifacts_store.save_artifacts("conv-ok", {"a": "payload"}) is True
    assert "conv-ok" not in artifacts_store._fallback_cache, "Redis 成功却仍镜像 = 重复驻留"


def test_fallback_still_used_when_redis_unavailable(monkeypatch) -> None:
    """正向对照:降级路径照常落镜像,且 load 能读回(兜底语义未变)。"""
    monkeypatch.setattr(artifacts_store, "_get_redis", lambda: None)
    assert artifacts_store.save_artifacts("conv-degraded", {"a": 1}) is False
    assert artifacts_store.load_artifacts("conv-degraded") == {"a": 1}


def test_fallback_cache_is_capped(monkeypatch) -> None:
    monkeypatch.setattr(artifacts_store, "_get_redis", lambda: None)
    monkeypatch.setattr(artifacts_store, "_FALLBACK_MAX_ENTRIES", 4)
    for i in range(20):
        artifacts_store.save_artifacts(f"conv-{i}", {"n": i})
    assert len(artifacts_store._fallback_cache) <= 4
    # 最新的必须在,最旧的已被逐出
    assert artifacts_store.load_artifacts("conv-19") == {"n": 19}
    assert artifacts_store.load_artifacts("conv-0") == {}


def test_fallback_alias_stays_a_plain_dict() -> None:
    """形状锁:`mcp_server._ARTIFACTS_CACHE` 是这份 dict 的别名,既有测试直接按 dict 读写它。"""
    from app.services import mcp_server

    assert mcp_server._ARTIFACTS_CACHE is artifacts_store._fallback_cache
    assert isinstance(artifacts_store._fallback_cache, dict)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
