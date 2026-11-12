"""AIS-017 回归:行为偏好的内存降级必须带 user 维度,不得跨用户串读。

票面缺陷:Redis 不可用(或 hincrby 抛异常)时写进程内 OrderedDict,键只有
`file_path:symbol`;同一进程的所有用户共用这张表 ⇒ 降级窗口内任一用户能读到
他人的 workspace 文件/符号偏好键(元数据泄漏),并被他人行为影响排序。

本文件钉住:
- 写入按 (user_id, key) 隔离,两个用户的同名文件互不影响;
- boost 只按调用者自己的计数算;
- `_get_user_preferences` 只返回调用者自己的键(不返回他人键,也不泄漏他人键的存在);
- Redis 恢复正常后仍走 Redis 腿(内存腿不越权冒充);
- LRU 上限仍是全局一个(避免每用户各 1000 条把内存放大 N 倍)。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services.context_engine import _USER_BEHAVIOR_MAX, ContextEngine


@pytest.fixture
def engine() -> ContextEngine:
    return ContextEngine()


def _redis_down():
    """Redis 不可用 ⇒ 走内存降级腿。"""
    return patch.object(ContextEngine, "_get_redis", new=AsyncMock(return_value=None))


class TestBehaviorIsolation:
    async def test_two_users_same_key_counted_separately(self, engine):
        with _redis_down():
            await engine._record_user_behavior("/repo/a.ts", "foo", "user-a")
            await engine._record_user_behavior("/repo/a.ts", "foo", "user-a")
            await engine._record_user_behavior("/repo/a.ts", "foo", "user-b")

        assert engine._user_behavior[("user-a", "/repo/a.ts:foo")] == 2
        assert engine._user_behavior[("user-b", "/repo/a.ts:foo")] == 1

    async def test_boost_only_reflects_caller_own_count(self, engine):
        """user-b 访问 30 次不抬高 user-a 的 boost。"""
        with _redis_down():
            for _ in range(30):
                await engine._record_user_behavior("/repo/a.ts", "foo", "user-b")
            boost_a = await engine._get_behavior_boost("/repo/a.ts", "foo", "user-a")
            boost_b = await engine._get_behavior_boost("/repo/a.ts", "foo", "user-b")

        assert boost_a == 0.0, "他人行为不得影响本人 boost"
        assert boost_b == 0.6, "30 次恰在 20-40 段中点的下界:0.6 + (1.0-0.6)*(10/20)"

    async def test_preferences_do_not_leak_other_users_keys(self, engine):
        """偏好列表只含调用者自己的键 —— 键名本身就是 workspace 文件路径。"""
        with _redis_down():
            await engine._record_user_behavior("/repo/secret-plan.md", "s", "user-b")
            await engine._record_user_behavior("/repo/mine.ts", "m", "user-a")
            prefs = await engine._get_user_preferences("user-a")

        keys = [p["key"] for p in prefs]
        assert keys == ["/repo/mine.ts:m"]
        assert "/repo/secret-plan.md:s" not in keys

    async def test_preferences_empty_for_user_without_history(self, engine):
        with _redis_down():
            await engine._record_user_behavior("/repo/a.ts", None, "user-b")
            prefs = await engine._get_user_preferences("user-a")
        assert prefs == []

    async def test_redis_path_still_used_when_available(self, engine):
        """Redis 腿恢复后不得再读内存腿(两腿口径一致,但不是同一份数据)。"""
        fake_redis = AsyncMock()
        fake_redis.hget.return_value = b"12"
        with patch.object(ContextEngine, "_get_redis", new=AsyncMock(return_value=fake_redis)):
            boost = await engine._get_behavior_boost("/repo/a.ts", "foo", "user-a")
        assert 0.3 <= boost <= 0.6
        fake_redis.hget.assert_awaited_once()

    async def test_redis_failure_falls_back_to_own_rows_only(self, engine):
        """hget 抛异常 ⇒ 降级读内存,且只读本人子表。"""
        with _redis_down():
            for _ in range(6):
                await engine._record_user_behavior("/repo/a.ts", "foo", "user-b")
        broken = AsyncMock()
        broken.hget.side_effect = RuntimeError("redis down")
        with patch.object(ContextEngine, "_get_redis", new=AsyncMock(return_value=broken)):
            boost = await engine._get_behavior_boost("/repo/a.ts", "foo", "user-a")
        assert boost == 0.0

    async def test_lru_cap_is_global_not_per_user(self, engine):
        """上限是全局一个(跨用户共享额度),防每用户各 1000 条放大内存。"""
        with _redis_down():
            for i in range(_USER_BEHAVIOR_MAX + 10):
                await engine._record_user_behavior(f"/repo/{i}.ts", None, "user-a")
        assert len(engine._user_behavior) == _USER_BEHAVIOR_MAX

    async def test_eviction_keeps_latest(self, engine):
        with _redis_down():
            for i in range(_USER_BEHAVIOR_MAX):
                await engine._record_user_behavior(f"/repo/{i}.ts", None, "user-a")
            await engine._record_user_behavior("/repo/newest.ts", None, "user-a")
        assert ("user-a", "/repo/newest.ts") in engine._user_behavior
        assert ("user-a", "/repo/0.ts") not in engine._user_behavior
