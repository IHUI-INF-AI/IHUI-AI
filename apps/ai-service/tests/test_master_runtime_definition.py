# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""V2-03 RuntimeAgentDefinition：26 字段、hash 稳定、公开/审计视图不外泄 prompt。"""

from __future__ import annotations

from dataclasses import fields

from app.services.agent_definition import RuntimeAgentDefinition, compute_prompt_hash


def _raw(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "id": "def-1",
        "version": 3,
        "name": "reviewer-readonly",
        "displayName": "只读审查",
        "description": "只读审查代码",
        "role": "reviewer",
        "systemPrompt": "你是只读审查员。",
        "promptVersion": 1,
        "model": "doubao-pro",
        "temperature": "0.20",
        "maxTokens": 4096,
        "maxIterations": 7,
        "tools": ["read_file", "search_codebase"],
        "skills": ["review"],
        "permissions": {"fs": "read"},
        "memoryPolicy": {"scope": "run"},
        "budget": {"points": 100},
        "concurrencyLimit": 2,
        "scope": "personal",
        "status": "active",
        "isBuiltin": False,
        "isDispatchable": True,
        "ownerUserId": "user-1",
        "teamId": None,
        "marketAgentId": None,
        "metadata": {"tag": "x"},
    }
    base.update(overrides)
    return base


def test_runtime_definition_has_26_fields_and_parses_api_types() -> None:
    definition = RuntimeAgentDefinition.from_mapping(_raw())

    assert len(fields(RuntimeAgentDefinition)) == 26
    assert definition.version == 3
    assert definition.temperature == 0.2
    assert definition.max_tokens == 4096
    assert definition.max_iterations == 7
    assert definition.tools == ("read_file", "search_codebase")
    assert definition.skills == ("review",)
    assert definition.prompt_hash == compute_prompt_hash(
        "你是只读审查员。", "doubao-pro", ("read_file", "search_codebase")
    )


def test_runtime_definition_public_and_audit_dicts_never_include_prompt() -> None:
    definition = RuntimeAgentDefinition.from_mapping(_raw(systemPrompt="秘密提示词"))
    public = definition.to_public_dict()
    audit = definition.to_audit_dict()

    assert "systemPrompt" not in public
    assert "system_prompt" not in public
    assert public["promptLength"] == len("秘密提示词")
    assert public["promptHash"] == definition.prompt_hash
    assert audit == public
    assert "secret" not in str(public).lower()


def test_runtime_definition_to_legacy_keeps_orchestrator_signature() -> None:
    definition = RuntimeAgentDefinition.from_mapping(_raw())
    legacy = definition.to_legacy()

    assert legacy.name == "reviewer-readonly"
    assert legacy.system_prompt == "你是只读审查员。"
    assert legacy.tools == ["read_file", "search_codebase"]
    assert legacy.metadata["definitionVersion"] == 3
    assert legacy.metadata["promptHash"] == definition.prompt_hash


def test_runtime_definition_accepts_json_strings_from_legacy_rows() -> None:
    definition = RuntimeAgentDefinition.from_mapping(
        _raw(tools='["read_file"]', skills='["review"]', permissions='{"fs":"read"}')
    )
    assert definition.tools == ("read_file",)
    assert definition.skills == ("review",)
    assert definition.permissions == {"fs": "read"}


def test_qualified_name_is_scope_specific() -> None:
    personal = RuntimeAgentDefinition.from_mapping(_raw())
    system = RuntimeAgentDefinition.from_mapping(_raw(scope="system", ownerUserId=None))
    team = RuntimeAgentDefinition.from_mapping(_raw(scope="team", teamId="team-1"))

    assert personal.qualified_name() == "personal:reviewer-readonly"
    assert system.qualified_name() == "system:reviewer-readonly"
    assert team.qualified_name() == "team:team-1:reviewer-readonly"
