# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管智能体 · 按请求解析定义（P2-02 / 01 §7.2）。

设计要点
--------
- **不查全局表**：resolver 只读一份 `RegistrySnapshot`，快照由 `agent_registry_client`
  从内部 API 拉取。这样“用户定义不进进程全局单例”这条在代码结构上成立，不靠约定。
- 可见性在解析时算：system 全员可见；personal 仅 owner；team 仅成员。
- 裸名多义必须报 `AGENT_AMBIGUOUS` 并给限定名候选，不能“取第一个”。
- 限定名语法：`personal:name`、`team:<teamId>:name`、`system:name`。
"""

from __future__ import annotations

import base64
import binascii
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass

from .agent_definition import RuntimeAgentDefinition


class AgentResolveError(LookupError):
    """解析失败；`code` 与 API 错误码同值，`details` 给 UI/工具原样展示。"""

    def __init__(self, code: str, message: str, details: dict[str, object] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


@dataclass(frozen=True)
class RegistrySnapshot:
    """注册表快照。`tombstones` 是已删定义 id；版本只增不减。"""

    version: int
    definitions: Mapping[str, RuntimeAgentDefinition]
    by_name: Mapping[str, tuple[str, ...]]
    tombstones: frozenset[str]
    fetched_at: float
    degraded: bool = False

    @classmethod
    def empty(
        cls, *, version: int = 0, fetched_at: float = 0.0, degraded: bool = True
    ) -> RegistrySnapshot:
        return cls(
            version=version,
            definitions={},
            by_name={},
            tombstones=frozenset(),
            fetched_at=fetched_at,
            degraded=degraded,
        )

    def is_empty(self) -> bool:
        return not self.definitions


@dataclass(frozen=True)
class VisibleAgentPage:
    items: tuple[RuntimeAgentDefinition, ...]
    total: int
    limit: int
    next_cursor: str | None


class AgentResolver:
    """一次请求一个 resolver；`actor_user_id` 与 `team_ids` 来自已验证身份。"""

    def __init__(
        self,
        actor_user_id: str,
        team_ids: Sequence[str],
        snapshot: RegistrySnapshot,
    ) -> None:
        self._actor_user_id = actor_user_id
        self._team_ids = frozenset(str(team_id) for team_id in team_ids if team_id)
        self._snapshot = snapshot

    @property
    def snapshot(self) -> RegistrySnapshot:
        return self._snapshot

    def resolve(self, ref: str) -> RuntimeAgentDefinition:
        text = (ref or "").strip()
        if not text:
            raise AgentResolveError("AGENT_NOT_FOUND", "解析引用为空")

        scoped = self._parse_qualified(text)
        if scoped is not None:
            definition = self._resolve_qualified(scoped)
            return self._ensure_active(definition)

        # 内部调用常用 definitionId；id 不一定是 UUID（测试/迁移期），先按精确 id 命中。
        exact = self._snapshot.definitions.get(text)
        if exact is not None:
            if not self._is_visible(exact):
                raise AgentResolveError("AGENT_NOT_FOUND", "定义不存在或不可见", {"ref": text})
            return self._ensure_active(exact)

        if _looks_like_uuid(text):
            raise AgentResolveError("AGENT_NOT_FOUND", "定义不存在或不可见", {"ref": text})

        candidates = self._visible_by_name(text)
        if not candidates:
            raise AgentResolveError("AGENT_NOT_FOUND", f"没有可见的定义 {text}", {"ref": text})
        if len(candidates) > 1:
            raise AgentResolveError(
                "AGENT_AMBIGUOUS",
                f"裸名 {text} 有多条可见定义，请使用限定名",
                {"ref": text, "candidates": [item.qualified_name() for item in candidates]},
            )
        return self._ensure_active(candidates[0])

    def resolve_many(self, refs: Sequence[str]) -> list[RuntimeAgentDefinition]:
        return [self.resolve(ref) for ref in refs]

    def list_visible(
        self,
        query: str | None = None,
        status: str | None = None,
        limit: int = 20,
        cursor: str | None = None,
    ) -> VisibleAgentPage:
        safe_limit = max(1, min(int(limit), 100))
        q = (query or "").strip().lower()
        items = [item for item in self._snapshot.definitions.values() if self._is_visible(item)]
        if status:
            items = [item for item in items if item.status == status]
        if q:
            items = [
                item
                for item in items
                if q in item.name.lower()
                or q in item.display_name.lower()
                or q in item.description.lower()
            ]
        items.sort(key=lambda item: (item.name, item.id))

        start = 0
        if cursor:
            after_name, after_id = _decode_cursor(cursor)
            start = next(
                (
                    index
                    for index, item in enumerate(items)
                    if (item.name, item.id) > (after_name, after_id)
                ),
                len(items),
            )
        page = items[start : start + safe_limit]
        next_cursor = (
            _encode_cursor(page[-1].name, page[-1].id) if start + safe_limit < len(items) else None
        )
        return VisibleAgentPage(
            items=tuple(page),
            total=len(items),
            limit=safe_limit,
            next_cursor=next_cursor,
        )

    def _parse_qualified(self, text: str) -> dict[str, str] | None:
        if text.startswith("system:"):
            return {"scope": "system", "name": text[len("system:") :]}
        if text.startswith("personal:"):
            return {"scope": "personal", "name": text[len("personal:") :]}
        if text.startswith("team:"):
            rest = text[len("team:") :]
            team_id, sep, name = rest.partition(":")
            if not sep:
                raise AgentResolveError(
                    "AGENT_NOT_FOUND",
                    "team 限定名格式是 team:<teamId>:<name>",
                    {"ref": text},
                )
            return {"scope": "team", "team_id": team_id, "name": name}
        return None

    def _resolve_qualified(self, parsed: dict[str, str]) -> RuntimeAgentDefinition:
        name = parsed["name"]
        candidates = list(self._snapshot.by_name.get(name, ()))
        if parsed["scope"] == "system":
            matches = [
                self._snapshot.definitions[item_id]
                for item_id in candidates
                if self._snapshot.definitions[item_id].scope == "system"
            ]
        elif parsed["scope"] == "personal":
            matches = [
                self._snapshot.definitions[item_id]
                for item_id in candidates
                if self._snapshot.definitions[item_id].scope == "personal"
                and self._snapshot.definitions[item_id].owner_user_id == self._actor_user_id
            ]
        else:
            team_id = parsed.get("team_id", "")
            if team_id not in self._team_ids:
                matches = []
            else:
                matches = [
                    self._snapshot.definitions[item_id]
                    for item_id in candidates
                    if self._snapshot.definitions[item_id].scope == "team"
                    and self._snapshot.definitions[item_id].team_id == team_id
                ]
        if not matches:
            raise AgentResolveError("AGENT_NOT_FOUND", "限定名没有匹配到可见定义", {"ref": parsed})
        if len(matches) > 1:
            raise AgentResolveError(
                "AGENT_AMBIGUOUS",
                "限定名仍有多条定义",
                {"ref": parsed, "ids": [item.id for item in matches]},
            )
        return matches[0]

    def _visible_by_name(self, name: str) -> list[RuntimeAgentDefinition]:
        candidates = [
            self._snapshot.definitions[item_id]
            for item_id in self._snapshot.by_name.get(name, ())
            if self._is_visible(self._snapshot.definitions[item_id])
        ]
        priority = {"personal": 0, "team": 1, "system": 2}
        candidates.sort(key=lambda item: (priority.get(item.scope, 9), item.name, item.id))
        return candidates

    def _is_visible(self, definition: RuntimeAgentDefinition) -> bool:
        if definition.id in self._snapshot.tombstones:
            return False
        if definition.scope == "system":
            return True
        if definition.scope == "personal":
            return definition.owner_user_id == self._actor_user_id
        if definition.scope == "team":
            return definition.team_id in self._team_ids
        return False

    @staticmethod
    def _ensure_active(definition: RuntimeAgentDefinition) -> RuntimeAgentDefinition:
        if definition.status == "deleted":
            raise AgentResolveError("AGENT_DELETED", "定义已删除", {"definitionId": definition.id})
        if definition.status != "active":
            raise AgentResolveError("AGENT_DISABLED", "定义未启用", {"definitionId": definition.id})
        return definition


def build_snapshot(
    *,
    version: int,
    definitions: Iterable[RuntimeAgentDefinition],
    tombstones: Iterable[str],
    fetched_at: float,
    degraded: bool = False,
) -> RegistrySnapshot:
    """由定义列表构建 name 索引；同名的多条保留全部 id，交给裸名歧义判定。"""
    items = {definition.id: definition for definition in definitions}
    by_name: dict[str, tuple[str, ...]] = {}
    for name in {definition.name for definition in items.values()}:
        by_name[name] = tuple(
            definition.id for definition in items.values() if definition.name == name
        )
    return RegistrySnapshot(
        version=version,
        definitions=items,
        by_name=by_name,
        tombstones=frozenset(str(item) for item in tombstones),
        fetched_at=fetched_at,
        degraded=degraded,
    )


def _looks_like_uuid(value: str) -> bool:
    if len(value) != 36:
        return False
    parts = value.split("-")
    return len(parts) == 5 and all(len(part) in (8, 4, 4, 4, 12) for part in parts)


def _encode_cursor(name: str, definition_id: str) -> str:
    raw = f"{name}\x00{definition_id}".encode()
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _decode_cursor(cursor: str) -> tuple[str, str]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")
        name, sep, definition_id = raw.partition("\x00")
        if not sep:
            raise ValueError("cursor 缺少 id 分段")
        return name, definition_id
    except (binascii.Error, UnicodeDecodeError, ValueError) as exc:
        raise AgentResolveError("INVALID_CURSOR", "游标不合法", {"cursor": cursor}) from exc
