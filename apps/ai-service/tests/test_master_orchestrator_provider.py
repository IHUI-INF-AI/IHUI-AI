# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P2-06 orchestrator 绑定：provider 命中时带定义元数据，解析失败给明确错误码。"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.agent_definition import RuntimeAgentDefinition
from app.services.agent_orchestrator import AgentOrchestrator, AgentRegistry, AgentStepResult
from app.services.agent_resolver import AgentResolveError


def _runtime(*, status: str = "active") -> RuntimeAgentDefinition:
    return RuntimeAgentDefinition.from_mapping(
        {
            "id": "def-reviewer",
            "version": 3,
            "name": "reviewer-readonly",
            "displayName": "只读评审",
            "description": "测试定义",
            "role": "reviewer",
            "systemPrompt": "只读评审提示词",
            "tools": ["read_file"],
            "skills": [],
            "model": "test-model",
            "temperature": "0.2",
            "maxTokens": 4096,
            "maxIterations": 5,
            "permissions": {},
            "memoryPolicy": {},
            "budget": {},
            "concurrencyLimit": 1,
            "isBuiltin": False,
            "isDispatchable": True,
            "ownerUserId": "user-1",
            "teamId": None,
            "scope": "personal",
            "status": status,
            "marketAgentId": None,
            "metadata": {},
        }
    )


@pytest.mark.asyncio
async def test_provider_hit_attaches_definition_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    orchestrator = AgentOrchestrator(
        registry=AgentRegistry(), definition_provider=lambda _ref: _runtime()
    )
    seen: dict[str, Any] = {}

    async def fake_run(agent, user_input, *args, **kwargs):  # type: ignore[no-untyped-def]
        seen["name"] = agent.name
        seen["prompt"] = agent.system_prompt
        seen["tools"] = agent.tools
        return AgentStepResult(
            agent_name=agent.name, input=user_input, output="ok", status="completed"
        )

    monkeypatch.setattr(orchestrator, "_run_agent", fake_run)
    result = await orchestrator.invoke("reviewer-readonly", "检查一下")

    assert seen == {"name": "reviewer-readonly", "prompt": "只读评审提示词", "tools": ["read_file"]}
    assert result.status == "completed"
    assert result.definition_id == "def-reviewer"
    assert result.definition_version == 3
    assert result.prompt_hash


@pytest.mark.asyncio
async def test_provider_resolve_error_returns_code(monkeypatch: pytest.MonkeyPatch) -> None:
    def provider(_ref: str) -> RuntimeAgentDefinition:
        raise AgentResolveError("AGENT_DISABLED", "定义已停用")

    orchestrator = AgentOrchestrator(registry=AgentRegistry(), definition_provider=provider)
    result = await orchestrator.invoke("reviewer-readonly", "检查一下")

    assert result.status == "failed"
    assert result.error_code == "AGENT_DISABLED"
    assert result.error == "定义已停用"


@pytest.mark.asyncio
async def test_without_provider_keeps_in_memory_registry(monkeypatch: pytest.MonkeyPatch) -> None:
    orchestrator = AgentOrchestrator(registry=AgentRegistry())

    async def fake_run(agent, user_input, *args, **kwargs):  # type: ignore[no-untyped-def]
        return AgentStepResult(agent_name=agent.name, input=user_input, output="ok", status="completed")

    monkeypatch.setattr(orchestrator, "_run_agent", fake_run)
    result = await orchestrator.invoke("researcher", "调研")

    assert result.status == "completed"
    assert result.definition_id is None
