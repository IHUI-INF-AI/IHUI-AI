# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP 资源模板:按已登记资源的 scope 列出并读取单个条目。

具体资源仍是 ``RESOURCE_SCOPES`` 里的精确 URI。模板不进入那张表,避免
``memory://sessions/{sessionId}`` 这种带花括号的字符串被当成一条真实资源。

相对常见的整段替换,这里多三道约束:

- 变量按字面量校验,不先做百分号解码。空值、超长、``..``、前导点、斜杠、反斜杠、
  百分号一律拒绝。
- 模板的 scope 必须已经出现在某条具体资源上,列表与读取走同一道
  ``has_scope`` + ``scope_denied_for_channel``。
- 会话记忆读取显式带上本次调用者的 ``user_id``;技能只回名称和说明。
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Literal

from .capability_gate import RESOURCE_SCOPES, Principal, scope_denied_for_channel

_TEMPLATE_RE = re.compile(r"\A([^{}]*)\{([A-Za-z][A-Za-z0-9]*)\}([^{}]*)\Z")
_VARIABLE_RE = re.compile(r"\A[A-Za-z0-9_.:-]{1,128}\Z")
_MAX_VARIABLE = 128
_KNOWN_SCOPES = frozenset(RESOURCE_SCOPES.values())


@dataclass(frozen=True)
class ResourceTemplateSpec:
    """一条可被调用者看见的资源模板。"""

    uri_template: str
    name: str
    description: str
    mime_type: str
    scope: str
    variable: str
    prefix: str
    suffix: str


def _spec(
    uri_template: str,
    name: str,
    description: str,
    mime_type: str,
    scope: str,
) -> ResourceTemplateSpec:
    matched = _TEMPLATE_RE.fullmatch(uri_template)
    if matched is None:
        raise RuntimeError(f"资源模板 {name} 必须是恰好一个简单变量")
    prefix, variable, suffix = matched.group(1), matched.group(2), matched.group(3)
    if not prefix:
        raise RuntimeError(f"资源模板 {name} 缺少固定前缀")
    if scope not in _KNOWN_SCOPES:
        raise RuntimeError(f"资源模板 {name} 的 scope 不在已登记资源上")
    return ResourceTemplateSpec(
        uri_template=uri_template,
        name=name,
        description=description,
        mime_type=mime_type,
        scope=scope,
        variable=variable,
        prefix=prefix,
        suffix=suffix,
    )


RESOURCE_TEMPLATES: tuple[ResourceTemplateSpec, ...] = (
    _spec(
        "memory://sessions/{sessionId}",
        "session-memory",
        "读取当前调用者的单个会话记忆,不返回其他调用者的会话",
        "application/json",
        "memory:read",
    ),
    _spec(
        "skills://items/{name}",
        "skill-item",
        "按名称读取一个已登记技能的名称与说明,不返回提示词正文",
        "application/json",
        "skills:read",
    ),
)


@dataclass(frozen=True)
class TemplateResolution:
    """一次 URI 与模板表的对照结果。"""

    status: Literal["match", "rejected", "unrelated"]
    template: ResourceTemplateSpec | None = None
    variables: Mapping[str, str] = field(default_factory=dict)
    message: str = ""


def _variable_message(name: str, raw: str) -> str | None:
    if raw == "":
        return f"资源模板变量 {name} 为空"
    if len(raw) > _MAX_VARIABLE:
        return f"资源模板变量 {name} 超过 {_MAX_VARIABLE}"
    if raw in {".", ".."} or ".." in raw or raw.startswith("."):
        return f"资源模板变量 {name} 含路径段"
    if _VARIABLE_RE.fullmatch(raw) is None:
        return f"资源模板变量 {name} 含非法字符"
    return None


def resolve_resource_template(uri: str) -> TemplateResolution:
    """把 URI 判成命中、变量非法,或与模板无关。

    前缀已经对准某条模板时,非法变量不再落到「未知资源」:调用方能看到具体原因。
    """
    if not isinstance(uri, str) or not uri:
        return TemplateResolution("unrelated")
    for template in RESOURCE_TEMPLATES:
        if not uri.startswith(template.prefix):
            continue
        if template.suffix:
            if len(uri) < len(template.prefix) + len(template.suffix):
                continue
            if not uri.endswith(template.suffix):
                continue
            raw = uri[len(template.prefix) : -len(template.suffix)]
        else:
            raw = uri[len(template.prefix) :]
        message = _variable_message(template.variable, raw)
        if message is not None:
            return TemplateResolution("rejected", message=message)
        return TemplateResolution(
            "match",
            template=template,
            variables={template.variable: raw},
        )
    return TemplateResolution("unrelated")


def visible_resource_templates(principal: Principal | None) -> list[ResourceTemplateSpec]:
    """调用者实际读得到的模板。无主体时返回全部已登记模板。"""
    visible: list[ResourceTemplateSpec] = []
    for template in RESOURCE_TEMPLATES:
        if principal is not None and (
            not principal.has_scope(template.scope)
            or scope_denied_for_channel(principal, template.scope)
        ):
            continue
        visible.append(template)
    return visible


async def read_resource_template(
    resolved: TemplateResolution, *, user_id: str | None
) -> dict[str, object]:
    """按已通过校验的模板读取内容。会话记忆必须带调用者身份。"""
    template = resolved.template
    if resolved.status != "match" or template is None:
        return {"ok": False, "error": resolved.message or "不是资源模板"}
    if template.name == "session-memory":
        if not isinstance(user_id, str) or not user_id.strip():
            return {"ok": False, "error": "缺少调用者身份,拒绝读取会话记忆"}
        from .memory import memory_store

        session_id = resolved.variables["sessionId"]
        messages = await memory_store.get(session_id, limit=10, user_id=user_id.strip())
        return {"ok": True, "content": {"sessionId": session_id, "messages": messages}}
    if template.name == "skill-item":
        from .skills import skill_registry

        name = resolved.variables["name"]
        found = next((item for item in skill_registry.list_skills() if item.name == name), None)
        if found is None:
            return {"ok": False, "error": f"未找到技能: {name}"}
        return {"ok": True, "content": {"name": found.name, "description": found.description}}
    return {"ok": False, "error": "未实现的资源模板"}


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
