# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管智能体 · 请求级定义提供器（P2-06）。

`AgentOrchestrator` 需要同步的 `definition_provider`，而快照拉取是异步的。
本模块把两者拆开：调用方先 `await provider.prepare()`，之后同一请求内的同步解析
都走同一份快照；快照失败时保持只读，不伪造定义。
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from ..core.internal_ticket import InternalServiceCredentialError
from .agent_definition import RuntimeAgentDefinition
from .agent_registry_client import AgentRegistryClient
from .agent_resolver import AgentResolveError, AgentResolver, RegistrySnapshot


class AgentDefinitionProvider:
    """一个请求/一个用户一个实例；不要把不同用户的 team_ids 混用。"""

    def __init__(
        self,
        client: AgentRegistryClient,
        *,
        user_id: str,
        team_ids: Sequence[str] = (),
    ) -> None:
        self._client = client
        self._user_id = user_id
        self._team_ids = tuple(team_ids)
        self._snapshot: RegistrySnapshot | None = None
        self._resolver: AgentResolver | None = None

    @property
    def ready(self) -> bool:
        return self._resolver is not None

    @property
    def snapshot(self) -> RegistrySnapshot | None:
        return self._snapshot

    @property
    def degraded(self) -> bool:
        return self._snapshot is None or self._snapshot.degraded

    async def prepare(self, *, force: bool = False) -> RegistrySnapshot:
        """拉取快照并构建 resolver；网络/票据失败由 client 兜底为 degraded 快照。"""
        snapshot = await self._client.get_snapshot(force=force)
        self._snapshot = snapshot
        self._resolver = AgentResolver(self._user_id, self._team_ids, snapshot)
        return snapshot

    def resolve(self, ref: str) -> RuntimeAgentDefinition:
        if self._resolver is None:
            raise AgentResolveError(
                "AGENT_REGISTRY_NOT_READY",
                "注册表快照尚未加载，请先 await provider.prepare()",
            )
        return self._resolver.resolve(ref)

    def __call__(self, ref: str) -> RuntimeAgentDefinition:
        return self.resolve(ref)

    def describe(self) -> dict[str, Any]:
        """给运行详情/审计用的轻量说明，不含 prompt 原文。"""
        snapshot = self._snapshot
        return {
            "userId": self._user_id,
            "teamIds": list(self._team_ids),
            "ready": self.ready,
            "version": snapshot.version if snapshot else 0,
            "degraded": self.degraded,
            "definitionCount": len(snapshot.definitions) if snapshot else 0,
        }


class RegistryUnavailableError(RuntimeError):
    """拉取失败且没有可用快照；写面必须拒绝，不能静默退回旧定义。"""

    def __init__(self, cause: Exception | None = None) -> None:
        super().__init__(f"注册表不可用: {cause}" if cause else "注册表不可用")
        self.cause = cause


async def prepare_provider(
    client: AgentRegistryClient,
    *,
    user_id: str,
    team_ids: Sequence[str] = (),
) -> AgentDefinitionProvider:
    """便捷入口；失败时抛 RegistryUnavailableError，方便调用方决定降级策略。"""
    provider = AgentDefinitionProvider(client, user_id=user_id, team_ids=team_ids)
    try:
        await provider.prepare()
    except (InternalServiceCredentialError, ValueError, OSError) as exc:
        raise RegistryUnavailableError(exc) from exc
    return provider
