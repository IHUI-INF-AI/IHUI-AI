# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""镜像缓存:LRU 淘汰 + 并发拉取去重(同一镜像同时只拉一次)。"""
from __future__ import annotations

import asyncio
from collections import OrderedDict
from dataclasses import dataclass
from typing import Protocol, Sequence, runtime_checkable

__all__ = ["EnsureResult", "ImageCache", "ImageCacheStats", "ImagePullError", "ImageRuntime"]


class ImagePullError(RuntimeError):
    def __init__(self, image: str, reason: str) -> None:
        super().__init__(f"镜像 {image} 拉取失败: {reason}")
        self.image = image
        self.reason = reason


@runtime_checkable
class ImageRuntime(Protocol):
    async def pull_image(self, image: str) -> None: ...

    async def remove_image(self, image: str) -> None: ...


@dataclass(frozen=True)
class EnsureResult:
    image: str
    already_present: bool
    pulled: bool


@dataclass(frozen=True)
class ImageCacheStats:
    pulls: int
    hits: int
    dedup_waits: int
    evictions: int
    remove_failures: int
    failures: int


class ImageCache:
    def __init__(
        self,
        *,
        runtime: ImageRuntime,
        capacity: int = 4,
        known_images: Sequence[str] = (),
    ) -> None:
        if capacity < 1:
            raise ValueError("capacity 必须 >= 1")
        self._runtime = runtime
        self._capacity = capacity
        self._lru: OrderedDict[str, None] = OrderedDict()
        for image in known_images:
            self._lru[image] = None
        self._locks: dict[str, asyncio.Lock] = {}
        self._pulls = 0
        self._hits = 0
        self._dedup_waits = 0
        self._evictions = 0
        self._remove_failures = 0
        self._failures = 0

    @property
    def capacity(self) -> int:
        return self._capacity

    @property
    def stats(self) -> ImageCacheStats:
        return ImageCacheStats(
            pulls=self._pulls,
            hits=self._hits,
            dedup_waits=self._dedup_waits,
            evictions=self._evictions,
            remove_failures=self._remove_failures,
            failures=self._failures,
        )

    def cached(self) -> tuple[str, ...]:
        """从最久未用到最近使用。"""
        return tuple(self._lru.keys())

    async def ensure(self, image: str) -> EnsureResult:
        if image in self._lru:
            self._hits += 1
            self._lru.move_to_end(image)
            return EnsureResult(image=image, already_present=True, pulled=False)
        # 锁对象永不删除:若在释放时删键,第三个协程会 setdefault 出一把新锁并同时拉取
        lock = self._locks.setdefault(image, asyncio.Lock())
        if lock.locked():
            self._dedup_waits += 1
        async with lock:
            if image in self._lru:
                self._hits += 1
                self._lru.move_to_end(image)
                return EnsureResult(image=image, already_present=True, pulled=False)
            await self._pull(image)
            self._pulls += 1
            self._lru[image] = None
            await self._evict_overflow()
            return EnsureResult(image=image, already_present=False, pulled=True)

    async def _pull(self, image: str) -> None:
        try:
            await self._runtime.pull_image(image)
        except ImagePullError:
            self._failures += 1
            raise
        except Exception as exc:
            self._failures += 1
            raise ImagePullError(image, f"{type(exc).__name__}: {exc}") from exc

    async def _evict_overflow(self) -> None:
        while len(self._lru) > self._capacity:
            oldest = next(iter(self._lru))
            del self._lru[oldest]
            self._evictions += 1
            try:
                await self._runtime.remove_image(oldest)
            except Exception:
                # 磁盘侧删除失败不得回滚缓存记账,否则容量上限被绕过
                self._remove_failures += 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
