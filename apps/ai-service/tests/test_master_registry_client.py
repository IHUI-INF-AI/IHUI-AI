# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P2-03/04/05 快照客户端：磁盘兜底、版本单调、degraded 只读。"""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from app.services.agent_registry_client import AgentRegistryClient


def _raw_definition(definition_id: str = "def-1", *, version: int = 1) -> dict[str, object]:
    return {
        "id": definition_id,
        "version": version,
        "name": "reviewer-readonly",
        "displayName": "只读审查",
        "description": "测试",
        "role": "reviewer",
        "systemPrompt": "prompt",
        "promptVersion": 1,
        "model": None,
        "temperature": "0.7",
        "maxTokens": None,
        "maxIterations": 5,
        "tools": [],
        "skills": [],
        "permissions": {},
        "memoryPolicy": {},
        "budget": {},
        "concurrencyLimit": 1,
        "status": "active",
        "isBuiltin": False,
        "isDispatchable": True,
        "marketAgentId": None,
        "metadata": {},
        "updatedAt": "2026-11-28T00:00:00.000Z",
    }


def _payload(version: int, *definitions: dict[str, object]) -> dict[str, object]:
    return {"items": list(definitions), "version": version, "serverTime": "2026-11-28T00:00:00Z"}


@pytest.mark.asyncio
async def test_fetch_builds_snapshot_and_disk_cache(tmp_path: Path) -> None:
    cache = tmp_path / "snapshot.json"
    client = AgentRegistryClient(
        user_id="user-1",
        base_url="http://test",
        cache_path=cache,
        fetcher=lambda _base: _success(_payload(7, _raw_definition())),
    )
    snapshot = await client.get_snapshot(force=True)

    assert snapshot.version == 7
    assert snapshot.degraded is False
    assert snapshot.definitions["def-1"].system_prompt == "prompt"
    assert cache.exists()
    cached = json.loads(cache.read_text(encoding="utf-8"))
    assert cached["payload"]["version"] == 7


@pytest.mark.asyncio
async def test_api_failure_falls_back_to_disk_read_only(tmp_path: Path) -> None:
    cache = tmp_path / "snapshot.json"
    seed = AgentRegistryClient(
        user_id="user-1",
        base_url="http://test",
        cache_path=cache,
        fetcher=lambda _base: _success(_payload(3, _raw_definition())),
    )
    await seed.get_snapshot(force=True)

    async def failing(_base: str) -> dict[str, object]:
        raise httpx.ConnectError("api down")

    fallback = AgentRegistryClient(
        user_id="user-1",
        base_url="http://test",
        cache_path=cache,
        fetcher=failing,
    )
    snapshot = await fallback.get_snapshot(force=True)

    assert snapshot.degraded is True
    assert snapshot.version == 3
    assert snapshot.definitions["def-1"].system_prompt == "prompt"
    assert fallback.last_error and "ConnectError" in fallback.last_error


@pytest.mark.asyncio
async def test_lower_version_is_ignored(tmp_path: Path) -> None:
    payloads = iter([_payload(9, _raw_definition()), _payload(4, _raw_definition("def-2"))])

    async def fetch(_base: str) -> dict[str, object]:
        return _success(next(payloads))

    client = AgentRegistryClient(
        user_id="user-1",
        base_url="http://test",
        cache_path=tmp_path / "snapshot.json",
        fetcher=fetch,
    )
    first = await client.get_snapshot(force=True)
    second = await client.get_snapshot(force=True)

    assert first.version == 9
    assert second.version == 9
    assert "def-2" not in second.definitions


@pytest.mark.asyncio
async def test_invalidation_with_higher_version_forces_refetch(tmp_path: Path) -> None:
    payloads = iter([_payload(1, _raw_definition()), _payload(2, _raw_definition("def-2"))])

    async def fetch(_base: str) -> dict[str, object]:
        return _success(next(payloads))

    client = AgentRegistryClient(
        user_id="user-1",
        base_url="http://test",
        cache_path=tmp_path / "snapshot.json",
        fetcher=fetch,
    )
    await client.get_snapshot(force=True)
    assert client.accept_invalidation(2, ["def-2"]) is True
    snapshot = await client.get_snapshot()

    assert snapshot.version == 2
    assert "def-2" in snapshot.definitions


def _success(data: dict[str, object]) -> dict[str, object]:
    return {"code": 0, "message": "success", "data": data}
