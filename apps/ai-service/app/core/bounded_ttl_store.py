# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""进程内键值存储的**有界 + 带寿命**原语(2026-11-01 安全强化立)。

为什么要有这一份:审计实测 `apps/ai-service` 里有十几处"模块级 dict/list,由请求路径写入,
键或量由调用方控制,却没有任何上限、没有归属份额、也没有清扫"。
后果不是"内存有点紧",而是**单个账号即可把进程写爆**(OOM DoS),
以及更坏的一类:存储里留着别人的会话文本 / 文件正文 / 工作区授权目录 ——
容量与敏感驻留同时不设界时,"重启才清"根本不是保护。

本模块只提供两件事,不提供"第二个真相源":
  1. `BoundedTtlDict` —— 键数硬上限 + 滑动 TTL(读/写都续期,弃用的键自己过期)+ 超限
     按最旧先逐出(FIFO by first-write);
  2. 纯判据函数 `is_expired`,让测试能对"过期"这一维单独举旗,而不是只测容量。

刻意**不做**的:不接管 Redis/DB(那是持久层的事)、不做 LRU 精细排序(滑动 TTL + 首写序
已足够约束攻击者可制造的键数量,而实现更简单、可证)、不静默丢弃(逐出与拒绝都可观测)。
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from typing import Any

__all__ = ["BoundedTtlDict", "is_expired"]


def is_expired(written_at: float, ttl_seconds: float, now: float) -> bool:
    """TTL 判据的唯一表达:`ttl<=0` 表示**不失效**(显式声明,不是"忘了设")。"""
    if ttl_seconds <= 0:
        return False
    return (now - written_at) > ttl_seconds


class BoundedTtlDict:
    """线程安全的"键数有上限 + 条目会过期"字典。

    Args:
        max_keys: 键数硬上限;超出时先逐出最早写入的键(调用方拿不到静默丢弃)。
        ttl_seconds: 滑动寿命(秒)。读写都续期 ⇒ 活跃条目不会被误逐,
            而被弃用的键必然消失 —— 这比"只在重读时判过期"强:后者让
            从未再读的条目永生(实测到的真实缺陷形态)。
        sweep_on_write: 每次写入顺带清一遍过期键(O(条目数),无后台任务、
            不依赖"有人来调清理函数"——那是本仓登记过的"造好没装车"失效型)。
    """

    def __init__(
        self,
        *,
        max_keys: int,
        ttl_seconds: float = 0.0,
        sweep_on_write: bool = True,
        clock: Callable[[], float] = time.time,
    ) -> None:
        if max_keys < 1:
            raise ValueError("max_keys 必须 >= 1(0 键的存储不叫保护,叫禁用)")
        self._max_keys = int(max_keys)
        self._ttl = float(ttl_seconds)
        self._sweep_on_write = sweep_on_write
        self._clock = clock
        self._lock = threading.Lock()
        self._store: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        # 可观测计数:逐出/拒绝都必须量得到,否则"有上限"只是口头承诺
        self.evictions = 0
        self.rejections = 0
        self.expired_swept = 0

    @property
    def max_keys(self) -> int:
        return self._max_keys

    @property
    def ttl_seconds(self) -> float:
        return self._ttl

    def __len__(self) -> int:
        with self._lock:
            return len(self._store)

    def keys(self) -> list[str]:
        with self._lock:
            return list(self._store.keys())

    def set(self, key: str, value: Any) -> None:
        now = self._clock()
        with self._lock:
            if self._sweep_on_write:
                self._sweep_locked(now)
            exists = key in self._store
            if not exists and len(self._store) >= self._max_keys:
                # 满了:逐出最早写入的键(保留最新),而不是拒绝整次写入后静默返回
                evicted_key, _ = self._store.popitem(last=False)
                self.evictions += 1
                del evicted_key
            self._store.pop(key, None)  # 重新入列尾,保持"首写序"单调
            self._store[key] = (now, value)

    def get(self, key: str, default: Any = None) -> Any:
        now = self._clock()
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return default
            written_at, value = entry
            if is_expired(written_at, self._ttl, now):
                self._store.pop(key, None)
                self.expired_swept += 1
                return default
            if self._ttl > 0:
                # 滑动续期:活跃条目不该因为"没人专门来扫"而被逐
                self._store[key] = (now, value)
            return value

    def pop(self, key: str, default: Any = None) -> Any:
        with self._lock:
            entry = self._store.pop(key, None)
            if entry is None:
                return default
            return entry[1]

    def sweep(self) -> int:
        """显式清一遍过期键(给"没有写入发生"的静默期用;写路径已自带顺带清扫)。"""
        with self._lock:
            return self._sweep_locked(self._clock())

    def reset(self) -> None:
        with self._lock:
            self._store.clear()

    # 与仓内既有测试夹具惯用的 `clear()` 同名(两份名字一份实现,不是两套语义)
    def clear(self) -> None:
        self.reset()

    def snapshot(self) -> dict[str, Any]:
        """当前**未过期**条目的浅拷贝(供只读观测端点用,不暴露内部时序)。"""
        now = self._clock()
        with self._lock:
            return {
                k: v
                for k, (written_at, v) in self._store.items()
                if not is_expired(written_at, self._ttl, now)
            }

    def _sweep_locked(self, now: float) -> int:
        if self._ttl <= 0:
            return 0
        doomed = [k for k, (w, _v) in self._store.items() if is_expired(w, self._ttl, now)]
        for k in doomed:
            self._store.pop(k, None)
        self.expired_swept += len(doomed)
        return len(doomed)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
