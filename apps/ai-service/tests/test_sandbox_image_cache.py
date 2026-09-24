# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""镜像缓存:并发拉取去重 + LRU 淘汰 + 失败不落账。"""
from __future__ import annotations

import asyncio

import pytest

from app.services.sandbox.image_cache import ImageCache, ImagePullError


class FakeImageRuntime:
    def __init__(self, *, fail_images: tuple[str, ...] = (), remove_fails: bool = False) -> None:
        self.pull_calls: list[str] = []
        self.remove_calls: list[str] = []
        self.fail_images = set(fail_images)
        self.remove_fails = remove_fails

    async def pull_image(self, image: str) -> None:
        self.pull_calls.append(image)
        await asyncio.sleep(0.01)  # 让并发 ensure 真的重叠,否则去重判据测不到
        if image in self.fail_images:
            raise RuntimeError("no manifest")

    async def remove_image(self, image: str) -> None:
        if self.remove_fails:
            raise OSError("device busy")
        self.remove_calls.append(image)


async def test_concurrent_ensure_pulls_once() -> None:
    # 反向对照:防"N 个并发任务各拉一次同一镜像"(registry 限流 + 磁盘写放大)
    runtime = FakeImageRuntime()
    cache = ImageCache(runtime=runtime, capacity=4)
    results = await asyncio.gather(*(cache.ensure("python:3.12-slim") for _ in range(8)))
    assert runtime.pull_calls == ["python:3.12-slim"], "同一镜像同时只允许拉一次"
    assert sum(1 for r in results if r.pulled) == 1
    stats = cache.stats
    assert stats.pulls == 1 and stats.hits == 7 and stats.dedup_waits >= 1


async def test_distinct_images_are_not_deduped() -> None:
    # 反向对照的上半:证明上一条不是因为"缓存把 pull 全吞了"
    runtime = FakeImageRuntime()
    cache = ImageCache(runtime=runtime, capacity=8)
    await asyncio.gather(*(cache.ensure(f"img{i}") for i in range(8)))
    assert sorted(runtime.pull_calls) == sorted(f"img{i}" for i in range(8))


async def test_second_sequential_ensure_is_a_hit() -> None:
    runtime = FakeImageRuntime()
    cache = ImageCache(runtime=runtime, capacity=2)
    first = await cache.ensure("a")
    second = await cache.ensure("a")
    assert (first.pulled, first.already_present) == (True, False)
    assert (second.pulled, second.already_present) == (False, True)
    assert len(runtime.pull_calls) == 1


async def test_lru_evicts_least_recently_used_not_oldest_inserted() -> None:
    # 防"按插入顺序淘汰" —— 热点镜像会被反复重拉
    runtime = FakeImageRuntime()
    cache = ImageCache(runtime=runtime, capacity=2)
    await cache.ensure("a")
    await cache.ensure("b")
    await cache.ensure("a")  # a 被再次使用,应比 b 更"新"
    await cache.ensure("c")
    assert cache.cached() == ("a", "c")
    assert runtime.remove_calls == ["b"], "淘汰必须真的将镜像从磁盘侧移除"
    assert cache.stats.evictions == 1


async def test_pull_failure_is_not_recorded_as_present() -> None:
    # 防"失败被记成已就绪" ⇒ 后续任务在无镜像的节点上起跑
    runtime = FakeImageRuntime(fail_images=("bad",))
    cache = ImageCache(runtime=runtime, capacity=2)
    with pytest.raises(ImagePullError) as caught:
        await cache.ensure("bad")
    assert caught.value.image == "bad"
    assert cache.cached() == ()
    assert cache.stats.failures == 1

    runtime.fail_images = set()
    outcome = await cache.ensure("bad")
    assert outcome.pulled is True
    assert cache.cached() == ("bad",)


async def test_remove_failure_keeps_capacity_invariant() -> None:
    # 磁盘侧删除失败不得让缓存超容 —— 记账先于删除是容量上限唯一可信依据
    runtime = FakeImageRuntime(remove_fails=True)
    cache = ImageCache(runtime=runtime, capacity=1)
    await cache.ensure("a")
    await cache.ensure("b")
    assert cache.cached() == ("b",)
    assert cache.stats.remove_failures == 1


def test_capacity_must_be_positive() -> None:
    with pytest.raises(ValueError):
        ImageCache(runtime=FakeImageRuntime(), capacity=0)


async def test_known_images_seed_without_pull() -> None:
    runtime = FakeImageRuntime()
    cache = ImageCache(runtime=runtime, capacity=2, known_images=("pre",))
    result = await cache.ensure("pre")
    assert result.already_present is True
    assert runtime.pull_calls == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
