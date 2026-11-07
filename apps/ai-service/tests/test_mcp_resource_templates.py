# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""资源模板:变量拒绝、scope 同源、调用者隔离。"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from mcp.server.mcpserver.exceptions import ResourceNotFoundError

from app.services import capability_gate as cg
from app.services import mcp_server as internal_mcp
from app.services.mcp_export import read_exported_resource
from app.services.mcp_resource_templates import (
    RESOURCE_TEMPLATES,
    read_resource_template,
    resolve_resource_template,
    visible_resource_templates,
)


def test_template_scopes_already_belong_to_concrete_resources() -> None:
    concrete_scopes = set(cg.RESOURCE_SCOPES.values())
    template_uris = {item.uri_template for item in RESOURCE_TEMPLATES}
    assert {item.scope for item in RESOURCE_TEMPLATES} <= concrete_scopes
    assert template_uris.isdisjoint(cg.RESOURCE_SCOPES)


@pytest.mark.parametrize(
    ("uri", "status"),
    [
        ("memory://current", "unrelated"),
        ("skills://available", "unrelated"),
        ("", "unrelated"),
        ("memory://sessions/sess-1", "match"),
        ("skills://items/code-review", "match"),
        ("skills://items/file.txt", "match"),
        ("memory://sessions/", "rejected"),
        ("memory://sessions/..", "rejected"),
        ("memory://sessions/../secret", "rejected"),
        ("memory://sessions/.hidden", "rejected"),
        ("memory://sessions/a..b", "rejected"),
        ("skills://items/a/b", "rejected"),
        ("skills://items/a\\b", "rejected"),
        ("memory://sessions/%2e%2e", "rejected"),
        ("memory://sessions/" + ("a" * 129), "rejected"),
    ],
)
def test_resolve_resource_template(uri: str, status: str) -> None:
    assert resolve_resource_template(uri).status == status


def test_match_keeps_the_literal_variable() -> None:
    resolved = resolve_resource_template("memory://sessions/123e4567-e89b-12d3-a456-426614174000")
    assert resolved.variables["sessionId"] == "123e4567-e89b-12d3-a456-426614174000"


def test_visible_templates_hide_scopes_the_caller_cannot_read() -> None:
    principal = cg.Principal(kind="jwt", sub="user-42", role=0, scopes=frozenset({"memory:read"}))
    assert [item.name for item in visible_resource_templates(principal)] == ["session-memory"]
    assert [item.name for item in visible_resource_templates(None)] == [
        "session-memory",
        "skill-item",
    ]


def test_channel_denial_hides_the_template(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.mcp_resource_templates.scope_denied_for_channel",
        lambda _principal, _scope: True,
    )
    principal = cg.Principal(
        kind="internal",
        sub="user-42",
        role=0,
        scopes=frozenset({cg.ALL_SCOPES}),
        api_key_id="key-1",
    )
    assert visible_resource_templates(principal) == []


async def test_session_read_is_bound_to_the_caller(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, object] = {}

    async def fake_get(
        session_id: str, limit: int = 100, *, user_id: str | None = None
    ) -> list[dict[str, str]]:
        seen["session_id"] = session_id
        seen["user_id"] = user_id
        seen["limit"] = limit
        return []

    monkeypatch.setattr("app.services.memory.memory_store.get", fake_get)
    resolved = resolve_resource_template("memory://sessions/sess-1")
    missing = await read_resource_template(resolved, user_id=None)
    assert missing["ok"] is False
    assert seen == {}
    read = await read_resource_template(resolved, user_id="user-42")
    assert read["ok"] is True
    assert seen == {"session_id": "sess-1", "user_id": "user-42", "limit": 10}


async def test_skill_read_omits_the_prompt_body(monkeypatch: pytest.MonkeyPatch) -> None:
    skill = SimpleNamespace(name="demo", description="说明", prompt_template="内部提示词")
    monkeypatch.setattr(
        "app.services.skills.skill_registry.list_skills",
        lambda: [skill],
    )
    resolved = resolve_resource_template("skills://items/demo")
    read = await read_resource_template(resolved, user_id="user-42")
    assert read["content"] == {"name": "demo", "description": "说明"}
    missing = await read_resource_template(
        resolve_resource_template("skills://items/other"), user_id="user-42"
    )
    assert missing["ok"] is False


async def test_export_read_uses_the_same_template_and_skips_the_exact_table(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[str] = []

    async def fake_get(
        session_id: str, limit: int = 100, *, user_id: str | None = None
    ) -> list[dict[str, str]]:
        seen.append(f"{user_id}:{session_id}:{limit}")
        return [{"role": "user", "content": "hi"}]

    async def exact_read(uri: str) -> dict[str, object]:
        seen.append(f"exact:{uri}")
        return {"ok": True, "content": {"stub": uri}}

    monkeypatch.setattr("app.services.memory.memory_store.get", fake_get)
    monkeypatch.setattr(internal_mcp.mcp_server, "read_resource", exact_read)
    principal = cg.Principal(kind="jwt", sub="user-42", role=0, scopes=frozenset({"memory:read"}))
    contents = await read_exported_resource(principal, "memory://sessions/sess-1")
    assert contents[0].mime_type == "application/json"
    assert '"sessionId": "sess-1"' in contents[0].content
    assert seen == ["user-42:sess-1:10"]
    with pytest.raises(ResourceNotFoundError):
        await read_exported_resource(principal, "memory://sessions/..")
    assert seen == ["user-42:sess-1:10"]


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
