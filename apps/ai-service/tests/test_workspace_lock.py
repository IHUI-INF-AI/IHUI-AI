# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""workspace_lock 多 Agent 工作区锁单测。

测试覆盖:
- 内存降级模式(默认):获取/互斥/重入续期/释放/心跳/强制释放/上下文管理器
- 释放安全:token 不匹配不释放(防误删他人锁)
- Redis 模式(FakeRedis):SET NX EX 互斥 / Lua 原子释放与续期 / 损坏 value 自愈
- Redis IO 异常降级内存锁
- 参数校验(空 workspace/holder → ValueError)
"""

from __future__ import annotations

import asyncio
import json
import time

import pytest

import app.services.workspace_lock as wl
from app.services.workspace_lock import (
    WORKSPACE_LOCK_HEARTBEAT_INTERVAL,
    WORKSPACE_LOCK_TTL,
    LockInfo,
    WorkspaceLock,
    WorkspaceLockHeld,
    workspace_lock,
)


@pytest.fixture(autouse=True)
def _memory_mode(monkeypatch):
    """默认内存降级模式(禁 Redis)+ 每测清空单例内存锁。"""
    monkeypatch.setattr(wl, "_redis_available", False)
    monkeypatch.setattr(wl, "_redis_client_instance", None)
    workspace_lock._reset()
    yield
    workspace_lock._reset()


# =============================================================================
# 内存降级模式:基础语义
# =============================================================================


class TestMemoryAcquireRelease:
    async def test_acquire_and_get_lock(self):
        """获取成功后 get_lock 返回持有者信息。"""
        info = await workspace_lock.acquire("/repo/app", holder="agent-1")
        assert isinstance(info, LockInfo)
        assert info.workspace == "/repo/app"
        assert info.holder == "agent-1"
        assert info.token

        current = await workspace_lock.get_lock("/repo/app")
        assert current is not None
        assert current.holder == "agent-1"
        assert current.token == info.token

    async def test_acquire_conflict_returns_none(self):
        """其他 holder 获取 → None(互斥);原持有者不受影响。"""
        first = await workspace_lock.acquire("/repo/app", holder="agent-1")
        assert first is not None
        second = await workspace_lock.acquire("/repo/app", holder="agent-2")
        assert second is None
        current = await workspace_lock.get_lock("/repo/app")
        assert current is not None and current.holder == "agent-1"

    async def test_reentrant_same_holder_renews(self):
        """同 holder 重入:返回原 token,heartbeat 刷新。"""
        first = await workspace_lock.acquire("/repo/app", holder="agent-1")
        before = first.heartbeat_at
        await asyncio.sleep(0.01)
        again = await workspace_lock.acquire("/repo/app", holder="agent-1")
        assert again is not None
        assert again.token == first.token  # 原 token(释放凭证不变)
        assert again.heartbeat_at > before  # 续期

    async def test_reentrant_release_needs_all_levels(self):
        """重入计数:两次获取需两次释放才真正删除锁。"""
        first = await workspace_lock.acquire("/repo/app", holder="agent-1")
        await workspace_lock.acquire("/repo/app", holder="agent-1")  # 嵌套第 2 层
        # 第 1 次释放:仅退出内层,锁仍被外层持有
        assert await workspace_lock.release("/repo/app", first.token) is True
        assert (await workspace_lock.get_lock("/repo/app")).token == first.token
        # 第 2 次释放:最外层退出,锁真正删除
        assert await workspace_lock.release("/repo/app", first.token) is True
        assert await workspace_lock.get_lock("/repo/app") is None

    async def test_release_with_correct_token(self):
        """正确 token 释放 → True;锁消失。"""
        info = await workspace_lock.acquire("/repo/app", holder="agent-1")
        assert await workspace_lock.release("/repo/app", info.token) is True
        assert await workspace_lock.get_lock("/repo/app") is None

    async def test_release_with_wrong_token_keeps_lock(self):
        """错误 token 释放 → False,锁仍在(防误删他人锁)。"""
        info = await workspace_lock.acquire("/repo/app", holder="agent-1")
        assert await workspace_lock.release("/repo/app", "wrong-token") is False
        current = await workspace_lock.get_lock("/repo/app")
        assert current is not None and current.token == info.token

    async def test_release_after_release_returns_false(self):
        """重复释放 → False(幂等)。"""
        info = await workspace_lock.acquire("/repo/app", holder="agent-1")
        assert await workspace_lock.release("/repo/app", info.token) is True
        assert await workspace_lock.release("/repo/app", info.token) is False

    async def test_release_unknown_workspace_returns_false(self):
        """释放不存在的 workspace → False。"""
        assert await workspace_lock.release("/repo/none", "any") is False

    async def test_locks_are_isolated_by_workspace(self):
        """不同 workspace 互不干扰。"""
        a = await workspace_lock.acquire("/repo/a", holder="agent-1")
        b = await workspace_lock.acquire("/repo/b", holder="agent-2")
        assert a is not None and b is not None
        assert a.token != b.token

    async def test_get_lock_no_lock_returns_none(self):
        """无锁查询 → None。"""
        assert await workspace_lock.get_lock("/repo/app") is None


class TestMemoryRenewAndForce:
    async def test_renew_correct_token(self):
        """正确 token 心跳续期 → True,heartbeat 刷新。"""
        info = await workspace_lock.acquire("/repo/app", holder="agent-1")
        before = (await workspace_lock.get_lock("/repo/app")).heartbeat_at
        await asyncio.sleep(0.01)
        assert await workspace_lock.renew("/repo/app", info.token) is True
        after = (await workspace_lock.get_lock("/repo/app")).heartbeat_at
        assert after > before

    async def test_renew_wrong_token_returns_false(self):
        """错误 token 续期 → False,原 heartbeat 不变。"""
        await workspace_lock.acquire("/repo/app", holder="agent-1")
        before = (await workspace_lock.get_lock("/repo/app")).heartbeat_at
        assert await workspace_lock.renew("/repo/app", "wrong") is False
        assert (await workspace_lock.get_lock("/repo/app")).heartbeat_at == before

    async def test_force_release(self):
        """强制释放(admin)→ True,无视 token。"""
        await workspace_lock.acquire("/repo/app", holder="agent-1")
        assert await workspace_lock.force_release("/repo/app") is True
        assert await workspace_lock.get_lock("/repo/app") is None

    async def test_force_release_no_lock(self):
        assert await workspace_lock.force_release("/repo/none") is False


# =============================================================================
# 上下文管理器
# =============================================================================


class TestLockedContext:
    async def test_locked_releases_on_exit(self):
        """正常退出自动释放。"""
        async with workspace_lock.locked("/repo/app", holder="task-7") as info:
            assert info.holder == "task-7"
            current = await workspace_lock.get_lock("/repo/app")
            assert current is not None and current.token == info.token
        assert await workspace_lock.get_lock("/repo/app") is None

    async def test_locked_releases_on_exception(self):
        """异常退出也自动释放。"""
        with pytest.raises(ValueError, match="boom"):
            async with workspace_lock.locked("/repo/app", holder="task-7"):
                raise ValueError("boom")
        assert await workspace_lock.get_lock("/repo/app") is None

    async def test_locked_raises_when_held(self):
        """被占时抛 WorkspaceLockHeld,current 携带持有者。"""
        await workspace_lock.acquire("/repo/app", holder="agent-1")
        with pytest.raises(WorkspaceLockHeld) as exc_info:
            async with workspace_lock.locked("/repo/app", holder="agent-2"):
                pass  # pragma: no cover - 不会执行
        assert exc_info.value.current.holder == "agent-1"
        assert "agent-1" in str(exc_info.value)
        # 原持有者不受影响
        assert (await workspace_lock.get_lock("/repo/app")).holder == "agent-1"

    async def test_locked_reentrant_same_holder(self):
        """同 holder 嵌套:重入成功,内层退出不释放外层锁。"""
        async with workspace_lock.locked("/repo/app", holder="task-7") as outer:
            async with workspace_lock.locked("/repo/app", holder="task-7") as inner:
                assert inner.token == outer.token
            current = await workspace_lock.get_lock("/repo/app")
            assert current is not None  # 内层退出(重复释放幂等 False)后锁仍在
        assert await workspace_lock.get_lock("/repo/app") is None


# =============================================================================
# 参数校验与常量
# =============================================================================


class TestValidation:
    async def test_empty_workspace_raises(self):
        with pytest.raises(ValueError, match="不能为空"):
            await workspace_lock.acquire("", holder="agent-1")

    async def test_empty_holder_raises(self):
        with pytest.raises(ValueError, match="不能为空"):
            await workspace_lock.acquire("/repo/app", holder="")

    async def test_heartbeat_interval_is_ttl_third(self):
        """心跳间隔 = TTL / 3(至少 1s)。"""
        assert max(
            1, WORKSPACE_LOCK_TTL // 3
        ) == WORKSPACE_LOCK_HEARTBEAT_INTERVAL

    async def test_default_ttl_positive(self):
        assert WORKSPACE_LOCK_TTL > 0


# =============================================================================
# Redis 模式(FakeRedis)
# =============================================================================


class FakeRedis:
    """最小 Redis 桩:支持 get / set(nx+ex) / eval(两段 Lua)/ delete。"""

    def __init__(self):
        self.store: dict[str, str] = {}
        self.ttl: dict[str, int] = {}

    def get(self, key):
        return self.store.get(key)

    def set(self, key, value, nx=False, ex=None):
        if nx and key in self.store:
            return None
        self.store[key] = value
        if ex:
            self.ttl[key] = ex
        return True

    def delete(self, key):
        return 1 if self.store.pop(key, None) is not None else 0

    def eval(self, script, numkeys, key, *args):
        """模拟真实 Lua:pcall(cjson.decode) 后比较 token 字段。"""
        raw = self.store.get(key)
        if raw is None:
            return 0
        try:
            d = json.loads(raw)
        except Exception:
            return 0
        if not isinstance(d, dict) or d.get("token") != args[0]:
            return 0
        if "del" in script:
            del self.store[key]
            self.ttl.pop(key, None)
            return 1
        # renew 脚本:刷新 TTL
        self.ttl[key] = int(args[1])
        return 1


@pytest.fixture()
def fake_redis(monkeypatch):
    """注入 FakeRedis,启用 Redis 模式。"""
    fake = FakeRedis()
    monkeypatch.setattr(wl, "_redis_available", True)
    monkeypatch.setattr(wl, "_redis_client_instance", fake)
    # _redis_client() 直接返回已注入实例(跳过 ping/构建)
    monkeypatch.setattr(wl, "_redis_client", lambda: fake)
    yield fake


class TestRedisMode:
    async def test_acquire_uses_set_nx(self, fake_redis):
        """Redis 模式获取走 SET NX EX,可被另一 holder 互斥。"""
        info = await workspace_lock.acquire("/repo/app", holder="agent-1")
        assert info is not None
        key = wl._lock_key("/repo/app")
        assert key in fake_redis.store
        assert json.loads(fake_redis.store[key])["holder"] == "agent-1"
        assert fake_redis.ttl[key] > 0

        assert await workspace_lock.acquire("/repo/app", holder="agent-2") is None

    async def test_release_lua_token_match(self, fake_redis):
        """Redis 释放:token 匹配删 key,不匹配不动。"""
        info = await workspace_lock.acquire("/repo/app", holder="agent-1")
        assert await workspace_lock.release("/repo/app", "wrong") is False
        assert wl._lock_key("/repo/app") in fake_redis.store
        assert await workspace_lock.release("/repo/app", info.token) is True
        assert wl._lock_key("/repo/app") not in fake_redis.store

    async def test_renew_lua_token_match(self, fake_redis):
        """Redis 续期:token 匹配刷新 TTL。"""
        info = await workspace_lock.acquire("/repo/app", holder="agent-1", ttl=60)
        key = wl._lock_key("/repo/app")
        assert fake_redis.ttl[key] == 60
        assert await workspace_lock.renew("/repo/app", info.token, ttl=120) is True
        assert fake_redis.ttl[key] == 120
        assert await workspace_lock.renew("/repo/app", "wrong", ttl=120) is False
        assert fake_redis.ttl[key] == 120

    async def test_reentrant_renews_ttl(self, fake_redis):
        """Redis 重入:同 holder 刷新 TTL 并返回原 token。"""
        first = await workspace_lock.acquire("/repo/app", holder="agent-1", ttl=60)
        key = wl._lock_key("/repo/app")
        assert fake_redis.ttl[key] == 60
        again = await workspace_lock.acquire("/repo/app", holder="agent-1", ttl=120)
        assert again is not None and again.token == first.token
        assert fake_redis.ttl[key] == 120

    async def test_corrupted_value_treated_as_unlocked(self, fake_redis):
        """value 损坏 → 按无锁处理,可重新获取(自愈)。"""
        key = wl._lock_key("/repo/app")
        fake_redis.store[key] = "not-json{{"
        info = await workspace_lock.acquire("/repo/app", holder="agent-1")
        assert info is not None
        assert json.loads(fake_redis.store[key])["holder"] == "agent-1"

    async def test_force_release_deletes_key(self, fake_redis):
        await workspace_lock.acquire("/repo/app", holder="agent-1")
        assert await workspace_lock.force_release("/repo/app") is True
        assert wl._lock_key("/repo/app") not in fake_redis.store

    async def test_memory_not_used_in_redis_mode(self, fake_redis):
        """Redis 模式下内存锁不参与(释放走 Lua)。"""
        info = await workspace_lock.acquire("/repo/app", holder="agent-1")
        assert workspace_lock._memory_locks == {}
        assert await workspace_lock.release("/repo/app", info.token) is True


# =============================================================================
# Redis IO 异常降级
# =============================================================================


class ExplodingRedis(FakeRedis):
    """所有操作抛连接异常(模拟 Redis 掉线)。"""

    def get(self, key):
        raise ConnectionError("redis down")

    def set(self, key, value, nx=False, ex=None):
        raise ConnectionError("redis down")

    def eval(self, script, numkeys, key, *args):
        raise ConnectionError("redis down")

    def delete(self, key):
        raise ConnectionError("redis down")


class TestRedisFailureDegrade:
    async def test_acquire_degrades_to_memory(self, monkeypatch):
        """Redis IO 异常 → 降级内存锁,语义不变。"""
        monkeypatch.setattr(wl, "_redis_available", True)
        monkeypatch.setattr(wl, "_redis_client", lambda: ExplodingRedis())
        info = await workspace_lock.acquire("/repo/app", holder="agent-1")
        assert info is not None
        # 降级发生在内存锁
        assert "/repo/app" in workspace_lock._memory_locks
        # 互斥语义保持
        assert await workspace_lock.acquire("/repo/app", holder="agent-2") is None

    async def test_release_degrades_to_memory(self, monkeypatch):
        monkeypatch.setattr(wl, "_redis_available", True)
        monkeypatch.setattr(wl, "_redis_client", lambda: ExplodingRedis())
        info = await workspace_lock.acquire("/repo/app", holder="agent-1")
        assert await workspace_lock.release("/repo/app", info.token) is True
        assert await workspace_lock.get_lock("/repo/app") is None

    async def test_get_lock_failure_returns_none(self, monkeypatch):
        monkeypatch.setattr(wl, "_redis_available", True)
        monkeypatch.setattr(wl, "_redis_client", lambda: ExplodingRedis())
        assert await workspace_lock.get_lock("/repo/app") is None


# =============================================================================
# 独立实例(不依赖单例,验证类可多实例)
# =============================================================================


class TestIndependentInstance:
    async def test_fresh_instance_isolated(self):
        lock = WorkspaceLock()
        assert await lock.get_lock("/repo/x") is None
        info = await lock.acquire("/repo/x", holder="h1")
        assert info is not None
        assert await lock.release("/repo/x", info.token) is True
        assert info.acquired_at <= time.time()
