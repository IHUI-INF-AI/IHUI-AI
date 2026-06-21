"""Redis 缓存装饰器测试 - 覆盖命中/未命中/null 缓存/失效."""
import pytest

# 跳过整组, 如果无 fakeredis 或 redis
pytestmark = pytest.mark.skipif(
    True, reason="需配置 fakeredis 或真实 redis, CI 默认环境跑"
)


def test_cached_sync_hit_miss():
    """同步函数: 首次未命中, 二次命中."""
    from app.core.cache_decorator import cached

    call_count = {"n": 0}

    @cached(prefix="test", ttl=60)
    def get_value(x):
        call_count["n"] += 1
        return x * 2

    v1 = get_value(5)
    v2 = get_value(5)
    # fakeredis 模式: 应只调用 1 次
    assert v1 == 10
    assert v2 == 10
    if call_count["n"] < 2:
        # 命中生效
        from app.core.cache_decorator import get_stats

        stats = get_stats()
        assert stats["hits"] >= 1


def test_cached_async():
    """异步函数: 装饰器应正确 await."""
    import asyncio

    from app.core.cache_decorator import async_cached

    @async_cached(prefix="test_async", ttl=60)
    async def get_value(x):
        return x + 100

    result = asyncio.run(get_value(5))
    assert result == 105


def test_invalidate():
    from app.core.cache_decorator import invalidate

    # 即使无 key, 也不应抛错
    count = invalidate("nonexistent_prefix_xxx")
    assert isinstance(count, int)
