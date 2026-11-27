# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P2-06 请求级定义提供器：先准备快照，再同步解析；未准备时明确报错。"""

from __future__ import annotations

import pytest

from app.services.agent_definition import RuntimeAgentDefinition
from app.services.agent_definition_provider import (
    AgentDefinitionProvider,
    RegistryUnavailableError,
    prepare_provider,
)
from app.services.agent_resolver import AgentResolveError, build_snapshot


def _runtime(definition_id: str = "def-1", name: str = "reviewer-readonly") -> RuntimeAgentDefinition:
    return RuntimeAgentDefinition.from_mapping(
        {
            "id": definition_id,
            "version": 2,
            "name": name,
            "displayName": name,
            "description": "测试",
            "role": "reviewer",
            "systemPrompt": "prompt",
            "tools": [],
            "skills": [],
            "model": None,
            "temperature": "0.7",
            "maxTokens": None,
            "maxIterations": 5,
            "permissions": {},
            "memoryPolicy": {},
            "budget": {},
            "concurrencyLimit": 1,
            "isBuiltin": False,
            "isDispatchable": True,
            "ownerUserId": "user-1",
            "teamId": None,
            "scope": "personal",
            "status": "active",
            "marketAgentId": None,
            "metadata": {},
        }
    )


class FakeClient:
    def __init__(self, snapshot, error: Exception | None = None) -> None:
        self._snapshot = snapshot
        self._error = error
        self.calls = 0

    async def get_snapshot(self, *, force: bool = False):  # type: ignore[no-untyped-def]
        self.calls += 1
        if self._error:
            raise self._error
        return self._snapshot


def _snapshot():
    return build_snapshot(
        version=5,
        definitions=[_runtime()],
        tombstones=[],
        fetched_at=1.0,
    )


@pytest.mark.asyncio
async def test_prepare_then_resolve() -> None:
    provider = AgentDefinitionProvider(FakeClient(_snapshot()), user_id="user-1")
    await provider.prepare()

    definition = provider.resolve("reviewer-readonly")
    assert definition.id == "def-1"
    assert provider.ready is True
    assert provider.degraded is False
    assert provider.describe()["version"] == 5


def test_resolve_before_prepare_is_explicit() -> None:
    provider = AgentDefinitionProvider(FakeClient(_snapshot()), user_id="user-1")
    with pytest.raises(AgentResolveError) as exc:
        provider.resolve("reviewer-readonly")
    assert exc.value.code == "AGENT_REGISTRY_NOT_READY"


@pytest.mark.asyncio
async def test_prepare_provider_wraps_unavailable() -> None:
    with pytest.raises(RegistryUnavailableError):
        await prepare_provider(
            FakeClient(_snapshot(), error=ValueError("boom")),  # type: ignore[arg-type]
            user_id="user-1",
        )


@pytest.mark.asyncio
async def test_invalidation_newer_version_refetches_once() -> None:
    snapshots = iter(
        [
            _snapshot(),
            build_snapshot(version=9, definitions=[_runtime("def-9")], tombstones=[], fetched_at=2.0),
        ]
    )

    class SequenceClient(FakeClient):
        async def get_snapshot(self, *, force: bool = False):  # type: ignore[no-untyped-def]
            self.calls += 1
            return next(snapshots)

    client = SequenceClient(_snapshot())
    provider = AgentDefinitionProvider(client, user_id="user-1")
    await provider.prepare()
    assert provider.snapshot is not None and provider.snapshot.version == 5

    assert await provider.apply_invalidation(6, ["def-1"]) is True
    assert provider.snapshot is not None and provider.snapshot.version == 9

    assert await provider.apply_invalidation(9, ["def-9"]) is False
    assert client.calls == 2
