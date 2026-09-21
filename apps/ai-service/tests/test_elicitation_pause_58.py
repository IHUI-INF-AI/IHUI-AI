# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:elicitation 计数暂停服务测试 — 对标 codex ElicitationService 语义。"""

from __future__ import annotations

import asyncio

import pytest

from app.core.elicitation_pause import ElicitationService


async def test_register_flips_paused() -> None:
    svc = ElicitationService()
    assert svc.paused is False
    reg = svc.register()
    assert svc.paused is True
    assert svc.outstanding == 1
    reg.release()
    assert svc.paused is False
    assert svc.outstanding == 0


async def test_concurrent_registrations() -> None:
    svc = ElicitationService()
    r1 = svc.register()
    r2 = svc.register()
    r3 = svc.register()
    assert svc.outstanding == 3
    assert svc.paused is True
    r1.release()
    assert svc.paused is True  # 仍有未决
    r2.release()
    r3.release()
    assert svc.paused is False
    assert svc.outstanding == 0


async def test_release_idempotent() -> None:
    svc = ElicitationService()
    reg = svc.register()
    reg.release()
    reg.release()  # 第二次零副作用
    reg.release()
    assert svc.outstanding == 0


async def test_wait_until_clear_blocks_then_resolves() -> None:
    svc = ElicitationService()
    reg = svc.register()
    done = asyncio.Event()

    async def _waiter() -> None:
        await svc.wait_until_clear()
        done.set()

    task = asyncio.ensure_future(_waiter())
    await asyncio.sleep(0.05)
    assert not done.is_set()
    reg.release()
    await asyncio.wait_for(task, 2)
    assert done.is_set()


async def test_wait_until_clear_immediate_when_clear() -> None:
    svc = ElicitationService()
    await asyncio.wait_for(svc.wait_until_clear(), 0.5)  # 不超时即通过


async def test_context_manager_releases() -> None:
    svc = ElicitationService()
    async with svc.register() as reg:
        assert svc.paused is True
        await reg.aclose()
    assert svc.paused is False


async def test_subscribe_event_state() -> None:
    svc = ElicitationService()
    ev = svc.subscribe()
    assert ev.is_set()  # 清零态
    reg = svc.register()
    assert not ev.is_set()  # 暂停态
    reg.release()
    assert ev.is_set()


async def test_decrement_floor_zero() -> None:
    svc = ElicitationService()
    # 直接内部下探不越 0(防御性)
    svc._decrement()
    assert svc.outstanding == 0
    assert svc.paused is False
