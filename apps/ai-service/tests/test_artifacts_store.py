"""artifacts_store 持久化抽象层测试。

覆盖:
- Redis hash 往返:save → load 返回相同数据(证明 Redis 为真相源,非 fallback)
- TTL:save 触发 EXPIRE 7d
- 进程内降级:Redis 不可用(_get_redis→None)→ save/load 走 fallback dict
- Redis 读取异常 → 降级 fallback
- delete:清 Redis + fallback
- 空 conv_id / 未命中 key → {}
- _ARTIFACTS_CACHE 别名兼容:mcp_server._ARTIFACTS_CACHE is _fallback_cache,
  直写后 load_artifacts 能读回(保证现有 test_mcp_server.py 行为)

使用 _FakeRedis 模拟 HSET/HGETALL/EXPIRE/DELETE/pipeline,不依赖真实 Redis。
"""

from __future__ import annotations

import pytest

from app.services import artifacts_store
from app.services.artifacts_store import (
    _ARTIFACTS_TTL_SECONDS,
    _fallback_cache,
    delete_artifacts,
    load_artifacts,
    reset_for_testing,
    save_artifacts,
)


class _FakeRedis:
    """模拟同步 redis 客户端:store[key]={field:value} / ttl[key]=seconds。"""

    def __init__(self):
        self.store: dict[str, dict[str, str]] = {}
        self.ttl: dict[str, int] = {}
        self.hset_calls: list[tuple] = []
        self.expire_calls: list[tuple] = []
        self.delete_calls: list[str] = []

    def ping(self):
        return True

    def pipeline(self):
        fake = self

        class _Pipe:
            def hset(self, key, field, value):
                fake.hset_calls.append((key, field, value))
                fake.store.setdefault(key, {})[field] = value
                return self

            def expire(self, key, ttl):
                fake.expire_calls.append((key, ttl))
                fake.ttl[key] = ttl
                return self

            def execute(self):
                return []

        return _Pipe()

    def hgetall(self, key):
        return self.store.get(key, {}).copy()

    def delete(self, key):
        self.delete_calls.append(key)
        existed = key in self.store
        self.store.pop(key, None)
        self.ttl.pop(key, None)
        return 1 if existed else 0


@pytest.fixture(autouse=True)
def _reset_store():
    """每个测试前后重置 artifacts_store 模块状态(清 fallback + Redis 探测缓存)。"""
    reset_for_testing()
    yield
    reset_for_testing()


# =============================================================================
# Redis 往返 + TTL
# =============================================================================

async def test_redis_round_trip(monkeypatch):
    """save → load 返回相同数据,且数据来自 Redis(非 fallback)。"""
    fake = _FakeRedis()
    monkeypatch.setattr(artifacts_store, "_get_redis", lambda: fake)

    data = {
        "plans": [{"id": "p1"}],
        "sources": [{"url": "https://x.com"}],
        "tool_calls": [{"tool": "read_file"}, {"tool": "write_file"}],
    }
    ok = save_artifacts("conv-rt", data)
    assert ok is True

    # 清空 fallback,证明 load 从 Redis 读取(而非进程内镜像)
    _fallback_cache.clear()
    loaded = load_artifacts("conv-rt")
    assert loaded == data
    assert "mcp:artifacts:conv-rt" in fake.store
    assert fake.store["mcp:artifacts:conv-rt"]["payload"].__class__ is str


async def test_redis_ttl_set(monkeypatch):
    """save 触发 EXPIRE 7 天(604800 秒)。"""
    fake = _FakeRedis()
    monkeypatch.setattr(artifacts_store, "_get_redis", lambda: fake)

    save_artifacts("conv-ttl", {"x": 1})

    assert ("mcp:artifacts:conv-ttl", _ARTIFACTS_TTL_SECONDS) in fake.expire_calls
    assert _ARTIFACTS_TTL_SECONDS == 7 * 24 * 60 * 60
    assert fake.ttl["mcp:artifacts:conv-ttl"] == 604800


async def test_redis_hset_uses_payload_field(monkeypatch):
    """HSET 写入单 field 'payload'(整个 dict JSON 序列化)。"""
    fake = _FakeRedis()
    monkeypatch.setattr(artifacts_store, "_get_redis", lambda: fake)

    save_artifacts("conv-h", {"a": 1})

    assert len(fake.hset_calls) == 1
    key, field, value = fake.hset_calls[0]
    assert key == "mcp:artifacts:conv-h"
    assert field == "payload"
    assert '"a"' in value  # JSON 序列化


# =============================================================================
# 进程内降级
# =============================================================================

async def test_fallback_when_redis_unavailable(monkeypatch):
    """Redis 不可用(_get_redis→None)→ save 降级返回 False,load 走 fallback。"""
    monkeypatch.setattr(artifacts_store, "_get_redis", lambda: None)

    ok = save_artifacts("conv-fb", {"plans": [1, 2]})
    assert ok is False  # 降级到进程内
    assert "conv-fb" in _fallback_cache

    loaded = load_artifacts("conv-fb")
    assert loaded == {"plans": [1, 2]}


async def test_redis_read_failure_falls_back(monkeypatch):
    """Redis 读取异常(hgetall 抛错)→ 降级 fallback dict。"""
    class _BrokenRedis:
        def hgetall(self, key):
            raise ConnectionError("Redis 断开")

        def ping(self):
            return True

        def pipeline(self):
            raise ConnectionError("Redis 断开")

    monkeypatch.setattr(artifacts_store, "_get_redis", lambda: _BrokenRedis())

    # save 时 pipeline 抛错 → 降级,但 fallback 已镜像
    save_artifacts("conv-broken", {"a": 1})
    # load 时 hgetall 抛错 → 降级 fallback
    loaded = load_artifacts("conv-broken")
    assert loaded == {"a": 1}


# =============================================================================
# delete / 边界
# =============================================================================

async def test_delete_artifacts(monkeypatch):
    """delete 清 Redis + fallback,之后 load 返回 {}。"""
    fake = _FakeRedis()
    monkeypatch.setattr(artifacts_store, "_get_redis", lambda: fake)

    save_artifacts("conv-del", {"a": 1})
    assert load_artifacts("conv-del") == {"a": 1}

    deleted = delete_artifacts("conv-del")
    assert deleted is True
    assert "mcp:artifacts:conv-del" in fake.delete_calls
    assert "conv-del" not in _fallback_cache
    assert load_artifacts("conv-del") == {}


async def test_empty_conv_id():
    """空 conv_id:save/delete 返回 False,load 返回 {}。"""
    assert save_artifacts("", {"a": 1}) is False
    assert load_artifacts("") == {}
    assert delete_artifacts("") is False


async def test_load_missing_key(monkeypatch):
    """未命中的 key → {}(Redis 空 + fallback 空)。"""
    fake = _FakeRedis()
    monkeypatch.setattr(artifacts_store, "_get_redis", lambda: fake)

    assert load_artifacts("never-saved") == {}


async def test_save_invalid_artifacts(monkeypatch):
    """artifacts 非 dict → save 返回 False,不写 fallback。"""
    monkeypatch.setattr(artifacts_store, "_get_redis", lambda: _FakeRedis())
    assert save_artifacts("conv-x", "not-a-dict") is False  # type: ignore[arg-type]
    assert "conv-x" not in _fallback_cache


# =============================================================================
# _ARTIFACTS_CACHE 别名兼容(向后兼容现有 test_mcp_server.py)
# =============================================================================

async def test_artifacts_cache_alias_is_fallback():
    """mcp_server._ARTIFACTS_CACHE 与 artifacts_store._fallback_cache 是同一对象。"""
    from app.services.mcp_server import _ARTIFACTS_CACHE as mcp_cache

    assert _fallback_cache is mcp_cache


async def test_artifacts_cache_direct_write_readable(monkeypatch):
    """直写 _ARTIFACTS_CACHE(= fallback)后 load_artifacts 能读回。

    模拟现有 test_mcp_server.py 的用法:_ARTIFACTS_CACHE["conv1"] = {...}
    然后 _tool_summarize_artifacts 通过 load_artifacts 读取。
    """
    from app.services.mcp_server import _ARTIFACTS_CACHE as mcp_cache

    monkeypatch.setattr(artifacts_store, "_get_redis", lambda: None)
    mcp_cache.clear()
    mcp_cache["conv1"] = {
        "plans": [{"id": "p1"}],
        "tool_calls": [{"tool": "read_file"}, {"tool": "write_file"}],
    }

    loaded = load_artifacts("conv1")
    assert loaded["plans"] == [{"id": "p1"}]
    assert len(loaded["tool_calls"]) == 2


async def test_summarize_artifacts_uses_store(monkeypatch):
    """端到端:_tool_summarize_artifacts 通过 artifacts_store 读取(进程内降级)。"""
    from app.services.mcp_server import _ARTIFACTS_CACHE as mcp_cache, _tool_summarize_artifacts

    monkeypatch.setattr(artifacts_store, "_get_redis", lambda: None)
    mcp_cache.clear()
    mcp_cache["conv-e2e"] = {
        "plans": [{"id": "p1"}],
        "sources": [{"url": "https://x.com"}],
        "artifacts": [{"name": "a.py"}],
        "tool_calls": [{"tool": "read_file"}, {"tool": "read_file"}, {"tool": "write_file"}],
    }

    out = await _tool_summarize_artifacts({"conversation_id": "conv-e2e"})
    assert out["ok"] is True
    assert len(out["plans"]) == 1
    assert len(out["sources"]) == 1
    assert len(out["artifacts"]) == 1
    assert out["tool_calls_summary"]["total"] == 3
    assert out["tool_calls_summary"]["by_tool"]["read_file"] == 2
    assert out["tool_calls_summary"]["by_tool"]["write_file"] == 1


# =============================================================================
# ArtifactsStore(async per-artifact CRUD)+ dispatch_helper 测试
#
# 与上方 save_artifacts/load_artifacts 测试共存:
# - 复用上方已建立的模块绑定 `artifacts_store`(= app.services.artifacts_store 模块),
#   通过 artifacts_store.ArtifactsStore / artifacts_store.artifacts_store 访问类与单例,
#   不再 `from ... import artifacts_store`(避免把模块名遮蔽成单例,破坏上方 12 个测试)。
# - FakeAsyncRedis 模拟 redis.asyncio(异步),独立于上方 _FakeRedis(同步)。
# =============================================================================

# 取类与单例引用(通过模块绑定,不遮蔽模块名本身)
_ArtifactsStore = artifacts_store.ArtifactsStore
_artifacts_store_singleton = artifacts_store.artifacts_store


class FakeAsyncRedis:
    """模拟 redis.asyncio 异步客户端(内存实现,不连真实 Redis)。"""

    def __init__(self) -> None:
        self._hashes: dict[str, dict[str, str]] = {}
        self._sets: dict[str, set[str]] = {}
        self.expires: dict[str, int] = {}

    async def ping(self) -> bool:
        return True

    async def hset(self, name: str, key: str, value: str) -> int:
        self._hashes.setdefault(name, {})[key] = value
        return 1

    async def hget(self, name: str, key: str) -> str | None:
        return self._hashes.get(name, {}).get(key)

    async def hgetall(self, name: str) -> dict[str, str]:
        return dict(self._hashes.get(name, {}))

    async def hdel(self, name: str, *keys: str) -> int:
        h = self._hashes.get(name, {})
        n = 0
        for k in keys:
            if k in h:
                del h[k]
                n += 1
        return n

    async def sadd(self, name: str, *values: str) -> int:
        s = self._sets.setdefault(name, set())
        return sum(1 for v in values if v not in s and not s.add(v))

    async def smembers(self, name: str) -> set[str]:
        return set(self._sets.get(name, set()))

    async def srem(self, name: str, *values: str) -> int:
        s = self._sets.get(name, set())
        return sum(1 for v in values if v in s and not s.discard(v))

    async def delete(self, *names: str) -> int:
        n = 0
        for nm in names:
            if nm in self._hashes:
                del self._hashes[nm]
                n += 1
            if nm in self._sets:
                del self._sets[nm]
                n += 1
        return n

    async def expire(self, name: str, seconds: int) -> bool:
        self.expires[name] = seconds
        return True


@pytest.fixture
def mem_store():
    """内存模式 ArtifactsStore(独立实例,隔离状态)。"""
    s = _ArtifactsStore()
    s._use_redis = False
    s._redis = None
    return s


@pytest.fixture
def redis_store():
    """Redis 模式 ArtifactsStore(注入 FakeAsyncRedis,测试真实 Redis 代码路径)。"""
    s = _ArtifactsStore()
    fake = FakeAsyncRedis()
    s._use_redis = True
    s._redis = fake  # 跳过 from_url/ping,直接用 fake
    return s, fake


# -----------------------------------------------------------------------------
# ArtifactsStore:内存模式 CRUD
# -----------------------------------------------------------------------------


class TestArtifactsStoreMemory:
    async def test_add_success(self, mem_store):
        r = await mem_store.add("c1", {"type": "plan", "title": "P1", "content": "x"})
        assert r["ok"] is True
        assert isinstance(r["artifact_id"], str) and r["artifact_id"]

    async def test_add_generates_id_and_created_at(self, mem_store):
        r = await mem_store.add("c1", {"type": "file", "title": "f", "content": "c"})
        got = await mem_store.get("c1", r["artifact_id"])
        art = got["artifact"]
        assert art["id"] == r["artifact_id"]
        assert art["type"] == "file"
        assert art["title"] == "f"
        assert art["metadata"] == {}
        assert "created_at" in art
        assert art["tool_name"] is None

    async def test_add_defaults_invalid_type_to_file(self, mem_store):
        r = await mem_store.add("c1", {"type": "unknown_type", "title": "t"})
        got = await mem_store.get("c1", r["artifact_id"])
        assert got["artifact"]["type"] == "file"

    async def test_add_missing_conversation_id(self, mem_store):
        r = await mem_store.add("", {"type": "plan"})
        assert r["ok"] is False
        assert r["errorCode"] == "MISSING_PARAMS"

    async def test_get_success(self, mem_store):
        r = await mem_store.add("c1", {"type": "plan", "title": "P", "content": "x"})
        got = await mem_store.get("c1", r["artifact_id"])
        assert got["ok"] is True
        assert got["artifact"]["title"] == "P"

    async def test_get_not_found(self, mem_store):
        got = await mem_store.get("c1", "nonexistent-id")
        assert got["ok"] is False
        assert got["errorCode"] == "NOT_FOUND"

    async def test_list_all(self, mem_store):
        await mem_store.add("c1", {"type": "plan", "title": "p1"})
        await mem_store.add("c1", {"type": "source", "title": "s1"})
        await mem_store.add("c1", {"type": "file", "title": "f1"})
        lst = await mem_store.list("c1")
        assert lst["ok"] is True
        assert len(lst["artifacts"]) == 3

    async def test_list_with_type_filter(self, mem_store):
        await mem_store.add("c1", {"type": "plan", "title": "p1"})
        await mem_store.add("c1", {"type": "source", "title": "s1"})
        await mem_store.add("c1", {"type": "plan", "title": "p2"})
        lst = await mem_store.list("c1", artifact_type="plan")
        assert len(lst["artifacts"]) == 2
        assert all(a["type"] == "plan" for a in lst["artifacts"])

    async def test_list_empty(self, mem_store):
        lst = await mem_store.list("no-such-conv")
        assert lst["ok"] is True
        assert lst["artifacts"] == []

    async def test_update_success(self, mem_store):
        r = await mem_store.add("c1", {"type": "plan", "title": "old", "content": "x"})
        upd = await mem_store.update("c1", r["artifact_id"], {"title": "new", "content": "y"})
        assert upd["ok"] is True
        assert upd["artifact"]["title"] == "new"
        assert upd["artifact"]["content"] == "y"
        assert upd["artifact"]["id"] == r["artifact_id"]  # id 不可改

    async def test_update_merges_metadata(self, mem_store):
        r = await mem_store.add("c1", {"type": "file", "metadata": {"a": 1, "b": 2}})
        upd = await mem_store.update("c1", r["artifact_id"], {"metadata": {"b": 99, "c": 3}})
        assert upd["artifact"]["metadata"] == {"a": 1, "b": 99, "c": 3}

    async def test_update_not_found(self, mem_store):
        upd = await mem_store.update("c1", "no-id", {"title": "x"})
        assert upd["ok"] is False
        assert upd["errorCode"] == "NOT_FOUND"

    async def test_remove_success(self, mem_store):
        r = await mem_store.add("c1", {"type": "file", "title": "t"})
        rm = await mem_store.remove("c1", r["artifact_id"])
        assert rm["ok"] is True
        assert rm["artifact_id"] == r["artifact_id"]
        got = await mem_store.get("c1", r["artifact_id"])
        assert got["ok"] is False

    async def test_remove_not_found(self, mem_store):
        rm = await mem_store.remove("c1", "no-id")
        assert rm["ok"] is False
        assert rm["errorCode"] == "NOT_FOUND"

    async def test_clear(self, mem_store):
        await mem_store.add("c1", {"type": "plan", "title": "p"})
        await mem_store.add("c1", {"type": "source", "title": "s"})
        cl = await mem_store.clear("c1")
        assert cl["ok"] is True
        assert cl["cleared"] == 2
        lst = await mem_store.list("c1")
        assert lst["artifacts"] == []

    async def test_summarize(self, mem_store):
        await mem_store.add("c1", {"type": "plan", "title": "p1"})
        await mem_store.add("c1", {"type": "source", "title": "s1"})
        await mem_store.add("c1", {"type": "tool_call_result", "title": "tc1", "tool_name": "read_file"})
        await mem_store.add("c1", {"type": "tool_call_result", "title": "tc2", "tool_name": "read_file"})
        await mem_store.add("c1", {"type": "tool_call_result", "title": "tc3", "tool_name": "search_web"})
        await mem_store.add("c1", {"type": "screenshot", "title": "sc1"})
        s = await mem_store.summarize("c1")
        assert s["ok"] is True
        summary = s["summary"]
        assert len(summary["plans"]) == 1
        assert len(summary["sources"]) == 1
        assert len(summary["artifacts"]) == 4  # 3 tool_call_result + 1 screenshot
        tcs = summary["tool_calls_summary"]
        assert tcs["total"] == 3
        assert tcs["by_tool"] == {"read_file": 2, "search_web": 1}

    async def test_summarize_empty(self, mem_store):
        s = await mem_store.summarize("no-such-conv")
        assert s["ok"] is True
        assert s["summary"]["tool_calls_summary"]["total"] == 0
        assert s["summary"]["tool_calls_summary"]["by_tool"] == {}


# -----------------------------------------------------------------------------
# ArtifactsStore:Redis 代码路径(FakeAsyncRedis)
# -----------------------------------------------------------------------------


class TestArtifactsStoreRedis:
    async def test_redis_add_get(self, redis_store):
        store, fake = redis_store
        r = await store.add("c1", {"type": "plan", "title": "P", "content": "x"})
        assert r["ok"] is True
        aid = r["artifact_id"]
        assert aid in fake._hashes["mcp:artifacts:c1"]
        assert aid in fake._sets["mcp:artifacts_index:c1"]
        assert fake.expires.get("mcp:artifacts:c1") == 7 * 24 * 60 * 60
        got = await store.get("c1", aid)
        assert got["ok"] is True
        assert got["artifact"]["title"] == "P"

    async def test_redis_list_and_remove(self, redis_store):
        store, fake = redis_store
        r = await store.add("c1", {"type": "file", "title": "f1"})
        await store.add("c1", {"type": "plan", "title": "p1"})
        lst = await store.list("c1")
        assert len(lst["artifacts"]) == 2
        rm = await store.remove("c1", r["artifact_id"])
        assert rm["ok"] is True
        assert r["artifact_id"] not in fake._hashes["mcp:artifacts:c1"]
        assert r["artifact_id"] not in fake._sets["mcp:artifacts_index:c1"]
        assert len((await store.list("c1"))["artifacts"]) == 1

    async def test_redis_update_and_clear(self, redis_store):
        store, fake = redis_store
        import json as _json
        r = await store.add("c1", {"type": "plan", "title": "old"})
        upd = await store.update("c1", r["artifact_id"], {"title": "new"})
        assert upd["ok"] is True
        stored = _json.loads(fake._hashes["mcp:artifacts:c1"][r["artifact_id"]])
        assert stored["title"] == "new"
        await store.add("c1", {"type": "file", "title": "x"})
        cl = await store.clear("c1")
        assert cl["ok"] is True
        assert cl["cleared"] == 2
        assert "mcp:artifacts:c1" not in fake._hashes
        assert "mcp:artifacts_index:c1" not in fake._sets

    async def test_redis_summarize(self, redis_store):
        store, _ = redis_store
        await store.add("c1", {"type": "plan", "title": "p1"})
        await store.add("c1", {"type": "tool_call_result", "tool_name": "t1"})
        s = await store.summarize("c1")
        assert s["ok"] is True
        assert len(s["summary"]["plans"]) == 1
        assert s["summary"]["tool_calls_summary"]["by_tool"] == {"t1": 1}

    async def test_redis_list_skips_legacy_payload_field(self, redis_store):
        """共存验证:同 hash 内若存在 legacy 'payload' 整 blob 字段,list 应跳过。"""
        store, fake = redis_store
        # 模拟其他写入者(save_artifacts)写入 "payload" 整 blob 字段
        fake._hashes.setdefault("mcp:artifacts:c1", {})["payload"] = (
            '{"plans": [], "sources": [], "tool_calls": []}'  # 无 id/type
        )
        await store.add("c1", {"type": "plan", "title": "real-plan"})
        lst = await store.list("c1")
        # 仅返回真实 artifact,"payload" 被过滤
        assert len(lst["artifacts"]) == 1
        assert lst["artifacts"][0]["title"] == "real-plan"


# -----------------------------------------------------------------------------
# ArtifactsStore:Redis 不可用降级
# -----------------------------------------------------------------------------


class TestArtifactsStoreDegradation:
    def test_stub_mode_when_redis_url_empty(self, monkeypatch):
        """settings.redis_url 为空 → _use_redis=False(内存模式)。"""
        from app.core.config import settings
        monkeypatch.setattr(settings, "redis_url", "")
        s = _ArtifactsStore()
        assert s._use_redis is False

    async def test_redis_ping_failure_degrades_to_memory(self, monkeypatch):
        """Redis ping 失败 → 切内存模式,不抛异常。"""
        s = _ArtifactsStore()
        s._use_redis = True
        s._redis = None

        class _FailingRedis:
            async def ping(self):
                raise ConnectionError("no redis")

        monkeypatch.setattr(
            artifacts_store.aioredis, "from_url",
            lambda *a, **kw: _FailingRedis(),
        )
        r = await s.add("c1", {"type": "plan", "title": "p"})
        assert r["ok"] is True
        assert s._use_redis is False  # 已降级
        assert s._redis is None
        got = await s.get("c1", r["artifact_id"])
        assert got["ok"] is True
        assert got["artifact"]["title"] == "p"

    def test_singleton_importable(self):
        """模块级单例 artifacts_store 可用且为 ArtifactsStore 实例。"""
        assert isinstance(_artifacts_store_singleton, _ArtifactsStore)


# -----------------------------------------------------------------------------
# dispatch_helper:dispatch_single
# -----------------------------------------------------------------------------


class TestDispatchSingle:
    async def test_success_stub_mode(self):
        """stub 模式(conftest 已清空 key)下,已知 agent → mock 成功。"""
        from app.services.dispatch_helper import dispatch_single
        r = await dispatch_single("coder", "实现登录功能")
        assert r["ok"] is True
        assert r["agent_name"] == "coder"
        assert r["status"] == "completed"
        assert "[stub]" in r["output"]
        assert r["error"] is None

    async def test_agent_not_found(self):
        from app.services.dispatch_helper import dispatch_single
        r = await dispatch_single("nonexistent_xyz", "x")
        assert r["ok"] is False
        assert r["errorCode"] == "AGENT_NOT_FOUND"
        assert "nonexistent_xyz" in r["message"]

    async def test_missing_params(self):
        from app.services.dispatch_helper import dispatch_single
        r = await dispatch_single("", "x")
        assert r["ok"] is False
        assert r["errorCode"] == "MISSING_PARAMS"
        r2 = await dispatch_single("coder", "")
        assert r2["ok"] is False
        assert r2["errorCode"] == "MISSING_PARAMS"

    async def test_non_stub_invokes_orchestrator(self, monkeypatch):
        """非 stub 模式:调用 agent_orchestrator.invoke 并映射结果。"""
        from app.services.agent_orchestrator import AgentStepResult, agent_orchestrator
        from app.services import dispatch_helper
        monkeypatch.setattr(dispatch_helper, "_is_stub_mode", lambda: False)

        async def mock_invoke(agent_name, user_input, session_id=None, model_override=None):
            return AgentStepResult(
                agent_name=agent_name, input=user_input, output=f"real-{agent_name}",
                status="completed", duration_ms=42.0, iterations=2,
                tool_calls=[{"tool": "t1"}], error=None,
            )
        monkeypatch.setattr(agent_orchestrator, "invoke", mock_invoke)
        r = await dispatch_helper.dispatch_single("coder", "real task")
        assert r["ok"] is True
        assert r["output"] == "real-coder"
        assert r["duration_ms"] == 42.0
        assert r["iterations"] == 2
        assert r["tool_calls"] == [{"tool": "t1"}]


# -----------------------------------------------------------------------------
# dispatch_helper:dispatch_parallel
# -----------------------------------------------------------------------------


class TestDispatchParallel:
    async def test_success_stub_mode(self):
        from app.services.dispatch_helper import dispatch_parallel
        tasks = [
            {"name": "coder", "task": "实现 A"},
            {"name": "researcher", "task": "调研 B"},
            {"name": "debugger", "task": "调试 C"},
        ]
        r = await dispatch_parallel(tasks)
        assert r["ok"] is True
        assert r["total"] == 3
        assert r["succeeded"] == 3
        assert r["failed"] == 0
        assert len(r["results"]) == 3
        for res in r["results"]:
            assert res["status"] == "completed"
            assert "[stub]" in res["output"]
            assert "agent_name" in res  # 映射为 agent_name(非 name)

    async def test_empty_tasks(self):
        from app.services.dispatch_helper import dispatch_parallel
        r = await dispatch_parallel([])
        assert r["ok"] is False
        assert r["errorCode"] == "EMPTY_TASKS"

    async def test_too_many_tasks(self):
        from app.services.dispatch_helper import dispatch_parallel
        tasks = [{"name": "coder", "task": f"t{i}"} for i in range(11)]
        r = await dispatch_parallel(tasks)
        assert r["ok"] is False
        assert r["errorCode"] == "TOO_MANY_TASKS"
        assert "max 10" in r["message"]

    async def test_partial_failure_non_stub(self, monkeypatch):
        """非 stub:1 failed / 2 success,验证 results 字段映射 name→agent_name。"""
        from app.services.agent_orchestrator import agent_orchestrator
        from app.services import dispatch_helper
        monkeypatch.setattr(dispatch_helper, "_is_stub_mode", lambda: False)

        async def mock_invoke_parallel(tasks, max_concurrency=5):
            results = []
            for t in tasks:
                name = t["name"]
                if name == "debugger":
                    results.append({"name": name, "task": t["task"], "status": "failed",
                                    "output": "", "error": "模拟调试失败", "duration_ms": 10.0})
                else:
                    results.append({"name": name, "task": t["task"], "status": "completed",
                                    "output": f"ok-{name}", "error": None, "duration_ms": 10.0})
            succeeded = sum(1 for r in results if r["status"] == "completed")
            return {"ok": True, "total": len(results), "succeeded": succeeded,
                    "failed": len(results) - succeeded, "results": results, "message": "x"}
        monkeypatch.setattr(agent_orchestrator, "invoke_parallel", mock_invoke_parallel)

        tasks = [
            {"name": "coder", "task": "A"},
            {"name": "debugger", "task": "B"},
            {"name": "researcher", "task": "C"},
        ]
        r = await dispatch_helper.dispatch_parallel(tasks)
        assert r["ok"] is True
        assert r["total"] == 3
        assert r["succeeded"] == 2
        assert r["failed"] == 1
        failed = [x for x in r["results"] if x["status"] == "failed"]
        assert len(failed) == 1
        assert failed[0]["agent_name"] == "debugger"
        assert "模拟调试失败" in failed[0]["error"]

    async def test_all_failed_non_stub(self, monkeypatch):
        from app.services.agent_orchestrator import agent_orchestrator
        from app.services import dispatch_helper
        monkeypatch.setattr(dispatch_helper, "_is_stub_mode", lambda: False)

        async def mock_invoke_parallel(tasks, max_concurrency=5):
            results = [{"name": t["name"], "task": t["task"], "status": "failed",
                        "output": "", "error": "boom", "duration_ms": 5.0} for t in tasks]
            return {"ok": True, "total": len(results), "succeeded": 0,
                    "failed": len(results), "results": results, "message": "x"}
        monkeypatch.setattr(agent_orchestrator, "invoke_parallel", mock_invoke_parallel)

        r = await dispatch_helper.dispatch_parallel(
            [{"name": "coder", "task": "A"}, {"name": "researcher", "task": "B"}]
        )
        assert r["ok"] is True
        assert r["succeeded"] == 0
        assert r["failed"] == 2
        assert all(x["status"] == "failed" for x in r["results"])


# -----------------------------------------------------------------------------
# dispatch_helper:validate_dispatch_request
# -----------------------------------------------------------------------------


class TestValidateDispatchRequest:
    async def test_single_mode(self):
        from app.services.dispatch_helper import validate_dispatch_request
        r = await validate_dispatch_request({"agent_name": "coder", "task": "do x"})
        assert r["ok"] is True
        assert r["mode"] == "single"
        assert r["normalized"] == {"name": "coder", "task": "do x"}

    async def test_single_mode_with_name_alias(self):
        from app.services.dispatch_helper import validate_dispatch_request
        r = await validate_dispatch_request({"name": "coder", "task": "do y"})
        assert r["ok"] is True
        assert r["mode"] == "single"
        assert r["normalized"]["name"] == "coder"

    async def test_parallel_mode(self):
        from app.services.dispatch_helper import validate_dispatch_request
        r = await validate_dispatch_request({
            "tasks": [
                {"agent_name": "coder", "task": "A"},
                {"name": "researcher", "task": "B"},
            ]
        })
        assert r["ok"] is True
        assert r["mode"] == "parallel"
        assert len(r["normalized"]) == 2
        assert r["normalized"][0] == {"name": "coder", "task": "A"}
        assert r["normalized"][1] == {"name": "researcher", "task": "B"}

    async def test_invalid_mode_missing_both(self):
        from app.services.dispatch_helper import validate_dispatch_request
        r = await validate_dispatch_request({})
        assert r["ok"] is False
        assert r["errorCode"] == "INVALID_PARAMS"

    async def test_invalid_single_missing_task(self):
        from app.services.dispatch_helper import validate_dispatch_request
        r = await validate_dispatch_request({"agent_name": "coder"})
        assert r["ok"] is False
        assert r["errorCode"] == "INVALID_PARAMS"

    async def test_parallel_empty(self):
        from app.services.dispatch_helper import validate_dispatch_request
        r = await validate_dispatch_request({"tasks": []})
        assert r["ok"] is False
        assert r["errorCode"] == "EMPTY_TASKS"

    async def test_parallel_too_many(self):
        from app.services.dispatch_helper import validate_dispatch_request
        r = await validate_dispatch_request({
            "tasks": [{"agent_name": "coder", "task": f"t{i}"} for i in range(11)]
        })
        assert r["ok"] is False
        assert r["errorCode"] == "TOO_MANY_TASKS"

    async def test_parallel_invalid_item_missing_fields(self):
        from app.services.dispatch_helper import validate_dispatch_request
        r = await validate_dispatch_request({"tasks": [{"agent_name": "coder"}]})  # 缺 task
        assert r["ok"] is False
        assert r["errorCode"] == "INVALID_PARAMS"

    async def test_non_dict_args(self):
        from app.services.dispatch_helper import validate_dispatch_request
        r = await validate_dispatch_request("not a dict")  # type: ignore[arg-type]
        assert r["ok"] is False
        assert r["errorCode"] == "INVALID_PARAMS"


# -----------------------------------------------------------------------------
# 端到端:validate → dispatch 联动
# -----------------------------------------------------------------------------


class TestValidateDispatchIntegration:
    async def test_validate_then_single_dispatch(self):
        from app.services.dispatch_helper import dispatch_single, validate_dispatch_request
        v = await validate_dispatch_request({"agent_name": "coder", "task": "实现 X"})
        assert v["ok"] is True
        norm = v["normalized"]
        r = await dispatch_single(norm["name"], norm["task"])
        assert r["ok"] is True
        assert r["agent_name"] == "coder"

    async def test_validate_then_parallel_dispatch(self):
        from app.services.dispatch_helper import dispatch_parallel, validate_dispatch_request
        v = await validate_dispatch_request({
            "tasks": [
                {"agent_name": "coder", "task": "A"},
                {"agent_name": "researcher", "task": "B"},
            ]
        })
        assert v["ok"] is True
        r = await dispatch_parallel(v["normalized"])
        assert r["ok"] is True
        assert r["succeeded"] == 2
