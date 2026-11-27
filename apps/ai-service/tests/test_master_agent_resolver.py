# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P2-02 AgentResolver：作用域、同名歧义、分页不重不漏。"""

from __future__ import annotations

import pytest

from app.services.agent_definition import RuntimeAgentDefinition
from app.services.agent_resolver import AgentResolveError, AgentResolver, build_snapshot


def _definition(
    definition_id: str,
    *,
    name: str = "reviewer-readonly",
    scope: str = "personal",
    owner_user_id: str | None = "user-1",
    team_id: str | None = None,
    status: str = "active",
) -> RuntimeAgentDefinition:
    return RuntimeAgentDefinition.from_mapping(
        {
            "id": definition_id,
            "version": 1,
            "name": name,
            "displayName": name,
            "description": "测试定义",
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
            "isBuiltin": scope == "system",
            "isDispatchable": True,
            "ownerUserId": owner_user_id,
            "teamId": team_id,
            "scope": scope,
            "status": status,
            "marketAgentId": None,
            "metadata": {},
        }
    )


def _snapshot(*definitions: RuntimeAgentDefinition, version: int = 1):
    return build_snapshot(
        version=version,
        definitions=definitions,
        tombstones=[item.id for item in definitions if item.status == "deleted"],
        fetched_at=1.0,
    )


def test_personal_only_visible_to_owner() -> None:
    snapshot = _snapshot(_definition("def-personal"))
    owner = AgentResolver("user-1", [], snapshot)
    outsider = AgentResolver("user-2", [], snapshot)

    assert owner.resolve("def-personal").id == "def-personal"
    with pytest.raises(AgentResolveError) as exc:
        outsider.resolve("def-personal")
    assert exc.value.code == "AGENT_NOT_FOUND"


def test_team_visible_only_to_members_and_system_visible_to_all() -> None:
    snapshot = _snapshot(
        _definition("def-team", scope="team", owner_user_id=None, team_id="team-1"),
        _definition("def-system", scope="system", owner_user_id=None, name="planner"),
    )
    member = AgentResolver("user-1", ["team-1"], snapshot)
    outsider = AgentResolver("user-1", ["team-2"], snapshot)

    assert member.resolve("def-team").id == "def-team"
    assert member.resolve("system:planner").id == "def-system"
    assert outsider.resolve("system:planner").id == "def-system"
    with pytest.raises(AgentResolveError) as exc:
        outsider.resolve("team:team-1:reviewer-readonly")
    assert exc.value.code == "AGENT_NOT_FOUND"


def test_bare_name_ambiguous_returns_qualified_candidates() -> None:
    snapshot = _snapshot(
        _definition("def-system", scope="system", owner_user_id=None),
        _definition("def-personal"),
    )
    resolver = AgentResolver("user-1", [], snapshot)

    with pytest.raises(AgentResolveError) as exc:
        resolver.resolve("reviewer-readonly")
    assert exc.value.code == "AGENT_AMBIGUOUS"
    assert exc.value.details["candidates"] == [
        "personal:reviewer-readonly",
        "system:reviewer-readonly",
    ]

    assert resolver.resolve("system:reviewer-readonly").id == "def-system"
    assert resolver.resolve("personal:reviewer-readonly").id == "def-personal"


def test_disabled_definition_is_resolved_but_rejected_for_run() -> None:
    snapshot = _snapshot(_definition("def-disabled", status="disabled"))
    resolver = AgentResolver("user-1", [], snapshot)

    with pytest.raises(AgentResolveError) as exc:
        resolver.resolve("def-disabled")
    assert exc.value.code == "AGENT_DISABLED"


def test_list_visible_paginates_duplicate_names_without_skipping() -> None:
    snapshot = _snapshot(
        _definition("def-a", name="same-name"),
        _definition("def-b", name="same-name"),
        _definition("def-c", name="same-name"),
    )
    resolver = AgentResolver("user-1", [], snapshot)

    page1 = resolver.list_visible(limit=2)
    assert [item.id for item in page1.items] == ["def-a", "def-b"]
    assert page1.next_cursor

    page2 = resolver.list_visible(limit=2, cursor=page1.next_cursor)
    assert [item.id for item in page2.items] == ["def-c"]
    assert page2.next_cursor is None
    assert page1.total == 3


def test_list_visible_query_and_status_filter() -> None:
    snapshot = _snapshot(
        _definition("def-a", name="reviewer-readonly"),
        _definition("def-b", name="planner", status="disabled"),
    )
    resolver = AgentResolver("user-1", [], snapshot)

    assert [item.id for item in resolver.list_visible(query="plan").items] == ["def-b"]
    assert [item.id for item in resolver.list_visible(status="active").items] == ["def-a"]


def test_invalid_cursor_is_explicit() -> None:
    resolver = AgentResolver("user-1", [], _snapshot(_definition("def-a")))
    with pytest.raises(AgentResolveError) as exc:
        resolver.list_visible(cursor="not-base64!!")
    assert exc.value.code == "INVALID_CURSOR"
