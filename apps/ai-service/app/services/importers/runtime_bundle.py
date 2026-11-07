# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""竞品运行时导出的分维导入。

对话解析器只认识消息。这里识别已经取证到的命名空间,把同一份导出拆成
会话、自动化、技能、记忆、能力声明。认不出的键只留下名字,不把值塞进会话。

相对「整包当聊天记录」多三道约束:

- 缺键、空列表、非列表分别是 absent / empty / invalid,不用空列表冒充没提供。
- 凭据字段和 env 整段丢弃,只计个数,值不进结果;正文再走 redact_secrets。
- 同一维度出现第二个键时不合并,避免同一批任务被导入两次。
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from app.core.output_cleaning import redact_secrets

from .ir import VALID_ROLES, Conversation, decode_text, message

_MAX_ITEMS = 50
_NAME_CHARS = 128
_TRIGGER_CHARS = 256
_TEXT_CHARS = 8_000

_CANONICAL = frozenset({"conversations", "automations", "skills", "memory", "capabilities"})
# 取证里逐字出现过的命名空间。未出现的名字不在这里猜测。
_ALIASES: dict[str, str] = {
    "qoderWorkConversations": "conversations",
    "qoderWorkAutomationTasks": "automations",
    "qoderWorkSkills": "skills",
    "qoderQuestMcp": "capabilities",
    "qoderQuestMemory": "memory",
    "codex-sessions": "conversations",
    "codex-automations": "automations",
    "codex-capabilities": "capabilities",
    "codex-memory": "memory",
    "workbuddy-sessions": "conversations",
    "workbuddy-automations": "automations",
}
_SECRET_KEYS = frozenset(
    {
        "apikey",
        "apisecret",
        "token",
        "secret",
        "password",
        "passwd",
        "pwd",
        "accesstoken",
        "refreshtoken",
        "authtoken",
        "bearertoken",
        "authorization",
        "privatekey",
        "clientsecret",
        "secretkey",
        "corpsecret",
    }
)
_ENV_KEYS = frozenset({"env", "environment", "environ"})
_KEY_RE = re.compile(r"[^a-z0-9]")


@dataclass
class RuntimeBundle:
    """一份导出拆开后的结果。conversations 交给既有 finalize,其余走 runtime。"""

    conversations: list[Conversation] = field(default_factory=list)
    dimensions: dict[str, str] = field(default_factory=dict)
    automations: list[dict[str, str]] = field(default_factory=list)
    skills: list[dict[str, str]] = field(default_factory=list)
    memory: list[dict[str, str]] = field(default_factory=list)
    capabilities: list[dict[str, str]] = field(default_factory=list)
    unrecognized: list[str] = field(default_factory=list)
    rejected: list[dict[str, Any]] = field(default_factory=list)
    stripped_secrets: int = 0
    warnings: list[str] = field(default_factory=list)
    truncated: bool = False

    def as_runtime(self) -> dict[str, Any]:
        return {
            "dimensions": self.dimensions,
            "automations": self.automations,
            "skills": self.skills,
            "memory": self.memory,
            "capabilities": self.capabilities,
            "unrecognized": self.unrecognized,
            "rejected": self.rejected,
            "strippedSecrets": self.stripped_secrets,
        }


def classify_runtime_bundle(data: bytes) -> RuntimeBundle | None:
    """是运行时分维导出则返回拆分结果,否则 None,让原来的会话解析器继续。"""
    text = decode_text(data).strip()
    if not text.startswith("{"):
        return None
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    buckets, unrecognized, duplicate_warnings, triggered = _bucket_keys(payload)
    if not triggered:
        return None
    bundle = RuntimeBundle(unrecognized=unrecognized, warnings=duplicate_warnings)
    for dimension in _CANONICAL:
        if dimension not in buckets:
            bundle.dimensions[dimension] = "absent"
            continue
        value = buckets[dimension]
        if not isinstance(value, list):
            bundle.dimensions[dimension] = "invalid"
            bundle.rejected.append({"dimension": dimension, "index": None, "reason": "not_a_list"})
            continue
        if len(value) == 0:
            bundle.dimensions[dimension] = "empty"
            continue
        bundle.dimensions[dimension] = "present"
        items = value
        if len(items) > _MAX_ITEMS:
            bundle.truncated = True
            bundle.warnings.append(f"{dimension} 超过 {_MAX_ITEMS},仅保留前 {_MAX_ITEMS} 条")
            items = items[:_MAX_ITEMS]
        for index, item in enumerate(items):
            _accept(bundle, dimension, index, item)
    return bundle


def _bucket_keys(
    payload: dict[str, Any],
) -> tuple[dict[str, Any], list[str], list[str], bool]:
    buckets: dict[str, Any] = {}
    origin: dict[str, str] = {}
    unrecognized: list[str] = []
    warnings: list[str] = []
    triggered = False
    for key, value in payload.items():
        alias = _ALIASES.get(key)
        if alias is not None:
            dimension: str | None = alias
            triggered = True
        elif key in _CANONICAL:
            dimension = key
            if key != "conversations":
                triggered = True
        else:
            dimension = None
        if dimension is None:
            unrecognized.append(str(key))
            continue
        if dimension in buckets:
            unrecognized.append(str(key))
            warnings.append(f"{key} 与 {origin[dimension]} 指向同一维度,未合并")
            continue
        buckets[dimension] = value
        origin[dimension] = str(key)
    return buckets, unrecognized, warnings, triggered


def _norm_key(key: str) -> str:
    return _KEY_RE.sub("", key.lower())


def _scrub(bundle: RuntimeBundle, item: dict[str, Any]) -> dict[str, Any]:
    clean: dict[str, Any] = {}
    for key, value in item.items():
        norm = _norm_key(str(key))
        if norm in _SECRET_KEYS or norm in _ENV_KEYS:
            bundle.stripped_secrets += 1
            continue
        clean[str(key)] = value
    return clean


def _text(bundle: RuntimeBundle, value: object, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    redacted = redact_secrets(value)
    if redacted != value:
        bundle.stripped_secrets += 1
    return redacted.strip()[:limit]


def _reject(bundle: RuntimeBundle, dimension: str, index: int, reason: str) -> None:
    bundle.rejected.append({"dimension": dimension, "index": index, "reason": reason})


def _accept(bundle: RuntimeBundle, dimension: str, index: int, item: object) -> None:
    if dimension == "conversations":
        conv = _conversation(bundle, index, item)
        if conv is not None:
            bundle.conversations.append(conv)
        return
    if not isinstance(item, dict):
        _reject(bundle, dimension, index, "not_object")
        return
    clean = _scrub(bundle, item)
    if dimension == "automations":
        name = _text(bundle, clean.get("name") or clean.get("id"), _NAME_CHARS)
        trigger = _text(
            bundle,
            clean.get("schedule") or clean.get("trigger") or clean.get("cron"),
            _TRIGGER_CHARS,
        )
        if not name or not trigger:
            _reject(bundle, dimension, index, "missing_name_or_trigger")
            return
        entry = {"name": name, "trigger": trigger}
        prompt = _text(
            bundle,
            clean.get("prompt") or clean.get("instruction") or clean.get("task"),
            _TEXT_CHARS,
        )
        if prompt:
            entry["prompt"] = prompt
        bundle.automations.append(entry)
        return
    if dimension == "skills":
        name = _text(bundle, clean.get("name"), _NAME_CHARS)
        prompt = _text(bundle, clean.get("prompt") or clean.get("description"), _TEXT_CHARS)
        if not name or not prompt:
            _reject(bundle, dimension, index, "missing_name_or_prompt")
            return
        bundle.skills.append({"name": name, "prompt": prompt})
        return
    if dimension == "memory":
        text = _text(
            bundle,
            clean.get("text") or clean.get("content") or clean.get("body"),
            _TEXT_CHARS,
        )
        if not text:
            _reject(bundle, dimension, index, "missing_text")
            return
        bundle.memory.append({"text": text})
        return
    name = _text(bundle, clean.get("name") or clean.get("id"), _NAME_CHARS)
    if not name:
        _reject(bundle, dimension, index, "missing_name")
        return
    entry = {"name": name}
    description = _text(bundle, clean.get("description"), 500)
    if description:
        entry["description"] = description
    bundle.capabilities.append(entry)


def _conversation(bundle: RuntimeBundle, index: int, item: object) -> Conversation | None:
    if not isinstance(item, dict):
        _reject(bundle, "conversations", index, "not_object")
        return None
    clean = _scrub(bundle, item)
    raw_messages = clean.get("messages")
    if not isinstance(raw_messages, list):
        _reject(bundle, "conversations", index, "not_object")
        return None
    messages = []
    for raw in raw_messages:
        if not isinstance(raw, dict):
            continue
        role = raw.get("role")
        content = raw.get("content")
        if role not in VALID_ROLES or not isinstance(content, str):
            continue
        built = message(role, _text(bundle, content, _TEXT_CHARS))
        if built is not None:
            messages.append(built)
    if not messages:
        _reject(bundle, "conversations", index, "no_messages")
        return None
    title = clean.get("title")
    return Conversation(messages=messages, title=title if isinstance(title, str) else None)


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
