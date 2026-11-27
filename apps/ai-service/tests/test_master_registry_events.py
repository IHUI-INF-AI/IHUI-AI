# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P2-03/P2-04 失效订阅：坏消息不杀循环，低版本不重拉，高版本重拉一次。"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import pytest

from app.services.agent_registry_events import (
    AGENT_REGISTRY_CHANNEL,
    RegistryInvalidationListener,
    consume_messages,
)


class FakeProvider:
    def __init__(self) -> None:
        self.calls: list[tuple[int, list[str]]] = []

    async def apply_invalidation(self, version: int, changed: list[str]) -> bool:
        self.calls.append((version, changed))
        return True


@pytest.mark.asyncio
async def test_handle_message_applies_newer_version() -> None:
    provider = FakeProvider()
    listener = RegistryInvalidationListener(provider, redis_url="redis://test")  # type: ignore[arg-type]

    assert await listener.handle_message(
        b'{"version": 1732788000000, "ids": ["def-1"], "action": "definition.updated"}'
    )
    assert provider.calls == [(1732788000000, ["def-1"])]


@pytest.mark.asyncio
async def test_bad_message_does_not_raise() -> None:
    listener = RegistryInvalidationListener(FakeProvider(), redis_url="redis://test")  # type: ignore[arg-type]
    assert await listener.handle_message("not json") is False
    assert await listener.handle_message(b'{"ids": []}') is False


@pytest.mark.asyncio
async def test_consume_messages_counts_only_applied() -> None:
    provider = FakeProvider()
    listener = RegistryInvalidationListener(provider, redis_url="redis://test")  # type: ignore[arg-type]

    async def messages() -> AsyncIterator[dict[str, Any]]:
        yield {"type": "subscribe", "data": 1}
        yield {"type": "message", "data": '{"version": 10, "ids": ["a"]}'}
        yield {"type": "message", "data": "broken"}
        yield {"type": "message", "data": '{"version": 11, "ids": ["b"]}'}

    assert await consume_messages(messages(), listener) == 2
    assert AGENT_REGISTRY_CHANNEL == "ihui:agent-registry:v1:changed"
