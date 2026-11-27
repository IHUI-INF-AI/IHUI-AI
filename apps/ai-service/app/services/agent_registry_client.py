# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管智能体 · 注册表快照客户端（P2-03/04/05 / 01 §7.2）。

缓存策略
--------
- 内存 60 秒；同进程多请求共享；
- 启动时先读磁盘兜底，再尝试拉 API；
- API 成功：重建快照、原子写磁盘；
- API/Redis 不可用：保留最近快照并标 `degraded=True`（只读），写动作由上层拒绝；
- 收到更高 `version` 的失效通知立即重拉；更低版本丢弃。

为什么磁盘缓存里保存 system_prompt
----------------------------------
断网后仍要在本地跑已有定义。文件权限压到 0600，路径默认在 `data/`，不属于
源码；如果部署环境不允许落盘，把 `enable_disk_cache=False` 或改路径到 tmpfs。
"""

from __future__ import annotations

import asyncio
import inspect
import json
import logging
import os
import time
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx

from ..core.internal_ticket import (
    InternalServiceCredentialError,
    internal_service_headers,
)
from .agent_definition import RuntimeAgentDefinition
from .agent_resolver import RegistrySnapshot, build_snapshot

logger = logging.getLogger(__name__)

_DEFAULT_TTL_SECONDS = 60.0
_DEFAULT_DISK_PATH = "data/agent-registry-snapshot.json"
_FETCH_TIMEOUT = 10.0

FetchCallable = Callable[[str], Awaitable[dict[str, Any]] | dict[str, Any]]


def _api_base_url() -> str:
    override = os.environ.get("API_INTERNAL_BASE_URL", "").strip()
    if override:
        return override.rstrip("/")
    from ..core.config import settings

    return str(getattr(settings, "api_service_url", "http://localhost:8802")).rstrip("/")


def _legacy_secret() -> str:
    return (
        os.environ.get("AI_CALLBACK_SECRET", "").strip()
        or os.environ.get("INTERNAL_SERVICE_TOKEN", "").strip()
    )


def _parse_iso_epoch(value: Any) -> float:
    if not isinstance(value, str) or not value:
        return 0.0
    try:
        from datetime import datetime

        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0.0


class AgentRegistryClient:
    """按用户/团队构建 resolver 所需的快照；不持有任何“全局定义表”。"""

    # 进程级失效代次：Redis 监听器收到变更后自增，所有客户端下一次 get_snapshot 强制重拉。
    # 这不是定义版本（definition.version），而是“本进程见过多少次失效通知”，只进不退。
    _global_epoch: int = 0

    @classmethod
    def invalidate_all(cls) -> int:
        """标记全进程快照过期；返回新代次。调用方不阻塞、不等待拉取。"""
        cls._global_epoch += 1
        return cls._global_epoch

    def __init__(
        self,
        *,
        user_id: str,
        base_url: str | None = None,
        cache_path: str | os.PathLike[str] | None = None,
        ttl_seconds: float = _DEFAULT_TTL_SECONDS,
        enable_disk_cache: bool = True,
        fetcher: FetchCallable | None = None,
        clock: Callable[[], float] = time.monotonic,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._user_id = user_id
        self._base_url = (base_url or _api_base_url()).rstrip("/")
        self._cache_path = Path(cache_path or _DEFAULT_DISK_PATH)
        self._ttl_seconds = max(1.0, float(ttl_seconds))
        self._enable_disk_cache = enable_disk_cache
        self._fetcher = fetcher
        self._clock = clock
        self._snapshot = RegistrySnapshot.empty()
        self._last_error: str | None = None
        self._lock = asyncio.Lock()
        self._transport = transport
        self._epoch_seen = AgentRegistryClient._global_epoch

    @property
    def snapshot(self) -> RegistrySnapshot:
        return self._snapshot

    @property
    def last_error(self) -> str | None:
        return self._last_error

    @property
    def degraded(self) -> bool:
        return bool(self._snapshot.degraded)

    def is_stale(self) -> bool:
        """TTL 过期或进程收到过更高代次的失效通知，任一成立即需重拉。"""
        return (
            self._clock() - self._snapshot.fetched_at
        ) > self._ttl_seconds or self._epoch_seen != AgentRegistryClient._global_epoch

    async def get_snapshot(self, *, force: bool = False) -> RegistrySnapshot:
        if not force and not self.is_stale() and self._snapshot.version > 0:
            return self._snapshot
        async with self._lock:
            if not force and not self.is_stale() and self._snapshot.version > 0:
                return self._snapshot
            return await self._refresh_locked()

    async def _refresh_locked(self) -> RegistrySnapshot:
        if self._enable_disk_cache and self._snapshot.version == 0:
            self._snapshot = self._load_disk() or self._snapshot

        try:
            payload = await self._fetch()
            next_snapshot = self._snapshot_from_payload(payload)
            if next_snapshot.version < self._snapshot.version:
                logger.warning(
                    "[agent-registry] 忽略更低版本快照 current=%s incoming=%s",
                    self._snapshot.version,
                    next_snapshot.version,
                )
                return self._snapshot
            self._snapshot = next_snapshot
            self._epoch_seen = AgentRegistryClient._global_epoch
            self._last_error = None
            if self._enable_disk_cache:
                self._write_disk(payload)
            logger.info(
                "[agent-registry] 快照刷新成功 version=%s definitions=%s tombstones=%s",
                next_snapshot.version,
                len(next_snapshot.definitions),
                len(next_snapshot.tombstones),
            )
            return next_snapshot
        except (httpx.HTTPError, InternalServiceCredentialError, ValueError, KeyError) as exc:
            self._last_error = f"{type(exc).__name__}: {exc}"
            fallback = self._snapshot
            if self._enable_disk_cache and fallback.version == 0:
                fallback = self._load_disk() or fallback
            self._snapshot = RegistrySnapshot(
                version=fallback.version,
                definitions=fallback.definitions,
                by_name=fallback.by_name,
                tombstones=fallback.tombstones,
                fetched_at=fallback.fetched_at,
                degraded=True,
            )
            logger.warning(
                "[agent-registry] 快照拉取失败，保留 version=%s 的只读快照: %s",
                self._snapshot.version,
                self._last_error,
            )
            return self._snapshot

    async def _fetch(self) -> dict[str, Any]:
        if self._fetcher is not None:
            result = self._fetcher(self._base_url)
            if inspect.isawaitable(result):
                result = await result
            body = result
            if isinstance(body, dict):
                data = body.get("data")
                if isinstance(data, dict):
                    return data
                return body
            raise ValueError("fetcher 未返回 dict")
        headers = internal_service_headers(
            self._user_id,
            "agent-registry",
            legacy_token=_legacy_secret(),
        )
        url = f"{self._base_url}/api/internal/agent-registry/snapshot"
        async with httpx.AsyncClient(timeout=_FETCH_TIMEOUT, transport=self._transport) as client:
            response = await client.get(url, headers=headers, params={"includeDeleted": "true"})
            response.raise_for_status()
            body = response.json()
        if not isinstance(body, dict) or body.get("code") != 0:
            raise ValueError("快照响应不是 {code:0}")
        data = body.get("data")
        if not isinstance(data, dict):
            raise ValueError("快照响应缺 data")
        return data

    def _snapshot_from_payload(self, payload: dict[str, Any]) -> RegistrySnapshot:
        raw_items = payload.get("items")
        if not isinstance(raw_items, list):
            raise ValueError("快照缺 items 数组")
        definitions: list[RuntimeAgentDefinition] = []
        tombstones: list[str] = []
        max_updated = 0.0
        for raw in raw_items:
            if not isinstance(raw, dict):
                continue
            definition = RuntimeAgentDefinition.from_mapping(raw)
            max_updated = max(max_updated, _parse_iso_epoch(raw.get("updatedAt")))
            if definition.status == "deleted":
                tombstones.append(definition.id)
            definitions.append(definition)
        version = payload.get("version")
        if isinstance(version, int):
            snapshot_version = version
        elif isinstance(version, str) and version.isdigit():
            snapshot_version = int(version)
        else:
            snapshot_version = int(max_updated * 1000) if max_updated else 1
        if snapshot_version <= 0:
            snapshot_version = 1
        return build_snapshot(
            version=snapshot_version,
            definitions=definitions,
            tombstones=tombstones,
            fetched_at=self._clock(),
            degraded=False,
        )

    def _load_disk(self) -> RegistrySnapshot | None:
        if not self._cache_path.exists():
            return None
        try:
            raw = json.loads(self._cache_path.read_text(encoding="utf-8"))
            payload = raw.get("payload") if isinstance(raw, dict) else None
            if not isinstance(payload, dict):
                return None
            snapshot = self._snapshot_from_payload(payload)
            # 磁盘快照不是刚拉到的，保留 fetched_at 为当前时钟会让 TTL 立即过期，
            # 所以这里用 0 作为 fetched_at，下一次 get 会触发 API 重拉。
            return RegistrySnapshot(
                version=snapshot.version,
                definitions=snapshot.definitions,
                by_name=snapshot.by_name,
                tombstones=snapshot.tombstones,
                fetched_at=0.0,
                degraded=True,
            )
        except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
            logger.warning("[agent-registry] 磁盘快照不可用: %s", exc)
            return None

    def _write_disk(self, payload: dict[str, Any]) -> None:
        try:
            self._cache_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self._cache_path.with_suffix(self._cache_path.suffix + ".tmp")
            tmp.write_text(
                json.dumps({"payload": payload}, ensure_ascii=False),
                encoding="utf-8",
            )
            os.chmod(tmp, 0o600)
            os.replace(tmp, self._cache_path)
        except OSError as exc:
            logger.warning("[agent-registry] 磁盘快照写入失败: %s", exc)

    def accept_invalidation(self, version: int, changed_ids: list[str] | None = None) -> bool:
        """收到 pub/sub 失效通知时调用；返回 True 表示需要立即重拉。"""
        if version < self._snapshot.version:
            return False
        if version > self._snapshot.version:
            logger.info(
                "[agent-registry] 收到更高版本失效通知 version=%s changed=%s",
                version,
                changed_ids or [],
            )
            self._snapshot = RegistrySnapshot(
                version=self._snapshot.version,
                definitions=self._snapshot.definitions,
                by_name=self._snapshot.by_name,
                tombstones=self._snapshot.tombstones,
                fetched_at=0.0,
                degraded=self._snapshot.degraded,
            )
            return True
        return False

    @staticmethod
    def channel_name(bucket: int = 0) -> str:
        """与 API 约定的失效频道；分片时 bucket 由定义 id 哈希决定。"""
        return f"agent-registry:invalidate:{quote(str(bucket))}"
