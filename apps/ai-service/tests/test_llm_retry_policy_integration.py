# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""重试策略接线:白名单拦截、always 档扩展预算、取消抑制退避等待。"""
from __future__ import annotations

import asyncio

import pytest

from app.core.llm_retry_policy import LlmRetryPolicy
from app.services.agent_loop_v2 import AgentLoopV2


def _messages():
    return [{"role": "user", "content": "hi"}]


@pytest.mark.asyncio
async def test_whitelist_blocks_unlisted_error_family():
    calls = 0

    async def llm(messages, tools):
        nonlocal calls
        calls += 1
        raise RuntimeError("HTTP 404 not found")

    loop = AgentLoopV2(
        llm,
        [],
        max_iterations=3,
        llm_retry_max=3,
        llm_retry_backoff=0.0,
        enable_checkpoint=False,
        llm_retry_policy=LlmRetryPolicy(retryable_codes=frozenset({"timeout"})),
    )
    result = await loop.run(_messages())
    assert result.success is False
    assert calls == 1  # 白名单外一次都不重试


@pytest.mark.asyncio
async def test_always_mode_extends_zero_configured_budget():
    calls = 0

    async def llm(messages, tools):
        nonlocal calls
        calls += 1
        if calls < 3:
            raise RuntimeError("HTTP 503 upstream")
        return {"content": "ok", "tool_calls": None}

    loop = AgentLoopV2(
        llm,
        [],
        max_iterations=3,
        llm_retry_max=0,
        llm_retry_backoff=0.0,
        enable_checkpoint=False,
        llm_retry_policy=LlmRetryPolicy(mode="always"),
    )
    result = await loop.run(_messages())
    assert result.success is True
    assert calls == 3  # always 档不受 llm_retry_max=0 限制


@pytest.mark.asyncio
async def test_cancel_during_backoff_does_not_issue_another_attempt():
    calls = 0
    first_failed = asyncio.Event()

    async def llm(messages, tools):
        nonlocal calls
        calls += 1
        first_failed.set()
        raise RuntimeError("HTTP 503 upstream")

    loop = AgentLoopV2(
        llm,
        [],
        max_iterations=3,
        llm_retry_max=2,
        llm_retry_backoff=1.0,
        enable_checkpoint=False,
        llm_retry_policy=LlmRetryPolicy(mode="always"),
    )

    async def cancel_soon():
        await first_failed.wait()
        loop._cancel_requested = True

    task = asyncio.create_task(loop.run(_messages()))
    asyncio.create_task(cancel_soon())
    result = await task
    assert calls == 1  # 退避期间取消,不再打第二发
    assert result.success is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
