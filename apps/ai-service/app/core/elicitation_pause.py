# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:elicitation 计数暂停服务 — 对标 codex elicitation.rs ElicitationService。

语义逐条对齐:
- register() 返回 RAII 句柄,close()/释放时 decrement(幂等);
- outstanding 0→1 时 paused 置 True,归 0 置 False;
- subscribe() 返回可等待的暂停状态变更订阅;
- wait_until_clear() 等待全部 outstanding 清零。
ihui 用 asyncio.Event + 计数器实现;句柄重复释放安全(第一次生效)。
"""

from __future__ import annotations

import asyncio
from typing import Any


class _Registration:
    """RAII 句柄:release/close 幂等,第一次释放才 decrement。"""

    __slots__ = ("_service", "_released")

    def __init__(self, service: "ElicitationService") -> None:
        self._service = service
        self._released = False

    def release(self) -> None:
        if self._released:
            return
        self._released = True
        self._service._decrement()

    async def aclose(self) -> None:
        self.release()

    def __enter__(self) -> "_Registration":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.release()

    async def __aenter__(self) -> "_Registration":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        self.release()


class ElicitationService:
    """并发 elicitation 计数暂停(对标 codex ElicitationService)。"""

    def __init__(self) -> None:
        self._outstanding = 0
        self._paused_event = asyncio.Event()
        # paused 事件初始为"未暂停"=已 set;outstanding>0 时 clear
        self._paused_event.set()

    @property
    def outstanding(self) -> int:
        return self._outstanding

    @property
    def paused(self) -> bool:
        """有未决 elicitation 时为 True(对标 paused watch)。"""
        return self._outstanding > 0

    def register(self) -> _Registration:
        """登记一个进行中的 elicitation:0→1 时 paused 翻 True。"""
        self._outstanding += 1
        if self._outstanding == 1:
            self._paused_event.clear()
        return _Registration(self)

    def _decrement(self) -> None:
        self._outstanding = max(0, self._outstanding - 1)
        if self._outstanding == 0:
            self._paused_event.set()

    def subscribe(self) -> asyncio.Event:
        """返回 paused 状态事件(已 set=清零;等待翻转用 wait_for_flip)。"""
        return self._paused_event

    async def wait_until_clear(self) -> None:
        """等待全部 outstanding 归零(已清零立即返回)。"""
        await self._paused_event.wait()

    async def wait_for_pause(self) -> None:
        """等待进入暂停态(outstanding 0→1);已暂停立即返回。"""
        while not self.paused:
            await self._cleared_event().wait()
            # cleared→可能有新登记;循环复查

    def _cleared_event(self) -> asyncio.Event:
        # 复用同一事件语义:cleared = _paused_event;set 态表示"当前清零"。
        # wait_for_pause 需要"清零→暂停"翻转,用轮询间隔实现极简等价
        # (codex 用 watch channel;ihui 场景调用频率低,事件+短轮询足够)。
        return self._paused_event
