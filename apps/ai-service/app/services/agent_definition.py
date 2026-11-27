# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管智能体运行时定义（V2-03 / 01 §7.1）。

为什么单独一个对象而不是直接复用 `AgentDefinition`
------------------------------------------------
旧 `AgentDefinition` 只有 7 个字段，而且 tools/model 是进程内常量。总管要面对
数据库里的用户定义：版本、作用域、工具白名单、预算、并发上限、可见性都必须
跟着一次运行走。`RuntimeAgentDefinition` 是**一次运行的冻结快照**：run 创建后
定义再改，运行仍按旧版本执行（I5）。

与 API 的边界
------------
本对象只从 `GET /api/internal/agent-registry/snapshot` 的 DTO 构造，不直查库。
`to_public_dict()` 与 `to_audit_dict()` 都不含 `system_prompt` 原文；唯一能拿
原文的是 `system_prompt` 字段本身，只允许交给 orchestrator/LLM。
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any


def compute_prompt_hash(system_prompt: str, model: str | None, tools: tuple[str, ...]) -> str:
    """提示词指纹：prompt + model + tools 三者任一变化都换 hash。"""
    payload = json.dumps(
        {
            "systemPrompt": system_prompt,
            "model": model,
            "tools": list(tools),
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class RuntimeAgentDefinition:
    """一次运行冻结的定义快照（26 字段，字段名与 API DTO 对齐）。"""

    id: str
    version: int
    name: str
    display_name: str
    description: str
    role: str
    system_prompt: str
    prompt_hash: str
    tools: tuple[str, ...]
    skills: tuple[str, ...]
    model: str | None
    temperature: float
    max_tokens: int | None
    max_iterations: int
    permissions: dict[str, Any]
    memory_policy: dict[str, Any]
    budget: dict[str, Any]
    concurrency_limit: int
    is_builtin: bool
    is_dispatchable: bool
    owner_user_id: str | None
    team_id: str | None
    scope: str
    status: str
    market_agent_id: str | None
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_mapping(cls, raw: dict[str, Any]) -> RuntimeAgentDefinition:
        """从 API 快照 DTO 构造；缺字段直接报错，不静默补默认值。

        `temperature` 在 API 是 numeric 字符串，这里统一转 float；`tools/skills`
        可能是 list，也可能是 JSON 字符串（旧数据），两种都接。
        """
        tools = _as_str_tuple(raw.get("tools"))
        system_prompt = str(raw.get("systemPrompt") or raw.get("system_prompt") or "")
        model = _as_optional_str(raw.get("model"))
        prompt_hash = str(raw.get("promptHash") or raw.get("prompt_hash") or "")
        if not prompt_hash:
            prompt_hash = compute_prompt_hash(system_prompt, model, tools)
        return cls(
            id=str(raw["id"]),
            version=int(raw["version"]),
            name=str(raw["name"]),
            display_name=str(raw.get("displayName") or raw.get("display_name") or raw["name"]),
            description=str(raw.get("description") or ""),
            role=str(raw.get("role") or "custom"),
            system_prompt=system_prompt,
            prompt_hash=prompt_hash,
            tools=tools,
            skills=_as_str_tuple(raw.get("skills")),
            model=model,
            temperature=_as_float(raw.get("temperature"), 0.7),
            max_tokens=_as_optional_int(_pick(raw, "maxTokens", "max_tokens")),
            max_iterations=_as_int(_pick(raw, "maxIterations", "max_iterations"), 5),
            permissions=_as_dict(raw.get("permissions")),
            memory_policy=_as_dict(_pick(raw, "memoryPolicy", "memory_policy")),
            budget=_as_dict(raw.get("budget")),
            concurrency_limit=_as_int(_pick(raw, "concurrencyLimit", "concurrency_limit"), 2),
            is_builtin=_as_bool(_pick(raw, "isBuiltin", "is_builtin"), False),
            is_dispatchable=_as_bool(_pick(raw, "isDispatchable", "is_dispatchable"), True),
            owner_user_id=_as_optional_str(_pick(raw, "ownerUserId", "owner_user_id")),
            team_id=_as_optional_str(_pick(raw, "teamId", "team_id")),
            scope=str(raw.get("scope") or "personal"),
            status=str(raw.get("status") or "active"),
            market_agent_id=_as_optional_str(_pick(raw, "marketAgentId", "market_agent_id")),
            metadata=_as_dict(raw.get("metadata")),
        )

    def to_legacy(self) -> Any:
        """映射旧 7 字段定义；旧编排器不改签名也能跑。"""
        from .agent_orchestrator import AgentDefinition

        return AgentDefinition(
            name=self.name,
            description=self.description,
            system_prompt=self.system_prompt,
            tools=list(self.tools),
            model=self.model,
            max_iterations=self.max_iterations,
            metadata={
                **self.metadata,
                "definitionId": self.id,
                "definitionVersion": self.version,
                "promptHash": self.prompt_hash,
                "scope": self.scope,
            },
        )

    def to_public_dict(self) -> dict[str, Any]:
        """公开视图：不含提示词原文，只给 hash/长度。"""
        return {
            "id": self.id,
            "version": self.version,
            "name": self.name,
            "displayName": self.display_name,
            "description": self.description,
            "role": self.role,
            "promptHash": self.prompt_hash,
            "promptLength": len(self.system_prompt),
            "tools": list(self.tools),
            "skills": list(self.skills),
            "model": self.model,
            "temperature": self.temperature,
            "maxTokens": self.max_tokens,
            "maxIterations": self.max_iterations,
            "permissions": dict(self.permissions),
            "memoryPolicy": dict(self.memory_policy),
            "budget": dict(self.budget),
            "concurrencyLimit": self.concurrency_limit,
            "isBuiltin": self.is_builtin,
            "isDispatchable": self.is_dispatchable,
            "ownerUserId": self.owner_user_id,
            "teamId": self.team_id,
            "scope": self.scope,
            "status": self.status,
            "marketAgentId": self.market_agent_id,
            "metadata": dict(self.metadata),
        }

    def to_audit_dict(self) -> dict[str, Any]:
        """审计视图：与公开视图同形，prompt 只留 hash/长度，不让审计表存全文。"""
        return self.to_public_dict()

    def qualified_name(self) -> str:
        """唯一限定名：system:name / team:<id>:name / personal:name。"""
        if self.scope == "system":
            return f"system:{self.name}"
        if self.scope == "team":
            return f"team:{self.team_id}:{self.name}"
        return f"personal:{self.name}"


def _pick(raw: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = raw.get(key)
        if value is not None:
            return value
    return None


def _as_bool(value: Any, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _as_str_tuple(value: Any) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return (value,) if value else ()
    if isinstance(value, (list, tuple)):
        return tuple(str(item) for item in value if str(item))
    return ()


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _as_optional_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value)
    return text if text else None


def _as_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _as_optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
