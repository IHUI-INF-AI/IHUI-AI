# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""persona_registry.py + personas.py 单元测试。

覆盖:
- PersonaContract dataclass 字段
- PERSONAS_CONTRACTS 含 5 个 persona(researcher/coder/reviewer/architect/debugger)
- get_persona_contract 存在/不存在
- list_persona_names 返回 5 个
- 每个 persona 的 input_schema/output_schema 含 required 字段
- FastAPI router 3 端点(GET /personas + /personas/{name} + /personas/{name}/contract)
- 未知 persona 返回 404
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers.personas import router as personas_router
from app.services.persona_registry import (
    PERSONAS_CONTRACTS,
    PersonaContract,
    get_persona_contract,
    list_persona_names,
)

EXPECTED_NAMES = ["researcher", "coder", "reviewer", "architect", "debugger"]


@pytest.fixture
def client():
    """构造独立 FastAPI app(仅挂载 personas router,不依赖 main.py 注册)。"""
    app = FastAPI()
    app.include_router(personas_router, prefix="/api")
    return TestClient(app)


# =============================================================================
# PersonaContract dataclass
# =============================================================================


def test_persona_contract_dataclass_fields():
    """PersonaContract 含 input_schema + output_schema(以及 D01 新增的 tools)。"""
    c = PersonaContract(input_schema={"a": 1}, output_schema={"b": 2})
    assert c.input_schema == {"a": 1}
    assert c.output_schema == {"b": 2}


def test_persona_contract_is_dataclass():
    """PersonaContract 是 dataclass。"""
    import dataclasses

    assert dataclasses.is_dataclass(PersonaContract)


def test_persona_contract_field_count():
    """PersonaContract 恰好 3 个字段(input/output + D01 的工具白名单摘要)。"""
    import dataclasses

    assert len(dataclasses.fields(PersonaContract)) == 3


def test_persona_contract_tools_default_empty():
    """D01:tools 是可省略字段 —— 只给契约的旧调用点构造出来仍是空元组。"""
    c = PersonaContract(input_schema={"a": 1}, output_schema={"b": 2})
    assert c.tools == ()


# =============================================================================
# D01 对话内 Agent 选择器运行时并入(persona_catalog / chat hint / 工具并集)
# =============================================================================


def test_persona_catalog_is_projection_of_registry():
    """目录投影与注册表一一对应:不新造名单,顺序/名字/工具都来自 PERSONAS_CONTRACTS。"""
    from app.services.persona_registry import persona_catalog

    catalog = persona_catalog()
    assert [item["name"] for item in catalog] == list(PERSONAS_CONTRACTS.keys())
    for item in catalog:
        contract = PERSONAS_CONTRACTS[item["name"]]
        assert item["description"] == contract.input_schema.get("description", "")
        assert item["tools"] == list(contract.tools)
        assert isinstance(item["tools"], list)


def test_every_persona_declares_tools():
    """D01:每个 persona 都要有非空工具白名单,否则选择器展示不出"工具摘要"。"""
    for name, contract in PERSONAS_CONTRACTS.items():
        assert contract.tools, f"{name} 缺工具白名单"


def test_persona_chat_hint_mentions_persona_and_tools():
    """选中的 persona 说明:点名 persona、带契约 required 与工具清单。"""
    from app.services.persona_registry import build_persona_chat_hint

    hint = build_persona_chat_hint("coder")
    assert hint is not None
    assert "Persona active: coder" in hint
    assert "affectedFiles" in hint  # input required
    assert "verification" in hint  # output required
    assert "file_edit" in hint  # 工具白名单


def test_persona_chat_hint_unknown_returns_none():
    """未知 persona / 空串 ⇒ None(零行为变化)。"""
    from app.services.persona_registry import build_persona_chat_hint

    assert build_persona_chat_hint("nonexistent") is None
    assert build_persona_chat_hint("") is None


def test_merge_persona_tools_unions_without_duplicates():
    """并集:调用方工具保留在前、persona 工具追加且去重。"""
    from app.services.persona_registry import merge_persona_tools

    merged = merge_persona_tools("coder", ["read_file", "web_search"])
    assert merged[:2] == ["read_file", "web_search"]
    assert "file_edit" in merged
    assert merged.count("read_file") == 1


def test_merge_persona_tools_none_input_still_yields_persona_tools():
    """调用方没给工具 ⇒ 仍拿到 persona 白名单(用户显式选专家是明确意图)。"""
    from app.services.persona_registry import merge_persona_tools

    merged = merge_persona_tools("debugger", None)
    assert merged is not None
    assert "run_command" in merged


def test_merge_persona_tools_unknown_persona_passthrough():
    """未知 persona ⇒ 原样返回(None 仍是 None,不因拼错 id 突然给工具)。"""
    from app.services.persona_registry import merge_persona_tools

    assert merge_persona_tools("nonexistent", None) is None
    assert merge_persona_tools("nonexistent", ["a"]) == ["a"]


# =============================================================================
# PERSONAS_CONTRACTS 字典
# =============================================================================


def test_personas_contracts_count():
    """PERSONAS_CONTRACTS 含 5 个 persona。"""
    assert len(PERSONAS_CONTRACTS) == 5


def test_personas_contracts_keys():
    """PERSONAS_CONTRACTS 键与 CLI 完全对齐。"""
    assert set(PERSONAS_CONTRACTS.keys()) == set(EXPECTED_NAMES)


def test_personas_contracts_value_types():
    """每个值都是 PersonaContract 实例。"""
    for name, contract in PERSONAS_CONTRACTS.items():
        assert isinstance(contract, PersonaContract), f"{name} 不是 PersonaContract"


# =============================================================================
# list_persona_names
# =============================================================================


def test_list_persona_names_count():
    """list_persona_names 返回 5 个。"""
    assert len(list_persona_names()) == 5


def test_list_persona_names_contains_all():
    """list_persona_names 含全部 5 个预期名称。"""
    names = list_persona_names()
    for expected in EXPECTED_NAMES:
        assert expected in names


# =============================================================================
# get_persona_contract — 存在
# =============================================================================


@pytest.mark.parametrize("name", EXPECTED_NAMES)
def test_get_persona_contract_exists(name):
    """每个预期 persona 都能取到契约。"""
    contract = get_persona_contract(name)
    assert contract is not None
    assert isinstance(contract, PersonaContract)


@pytest.mark.parametrize("name", EXPECTED_NAMES)
def test_get_persona_contract_has_input_schema(name):
    """每个 persona 的 input_schema 非空 dict。"""
    contract = get_persona_contract(name)
    assert isinstance(contract.input_schema, dict)
    assert contract.input_schema.get("type") == "object"
    assert "properties" in contract.input_schema


@pytest.mark.parametrize("name", EXPECTED_NAMES)
def test_get_persona_contract_has_output_schema(name):
    """每个 persona 的 output_schema 非空 dict。"""
    contract = get_persona_contract(name)
    assert isinstance(contract.output_schema, dict)
    assert contract.output_schema.get("type") == "object"
    assert "properties" in contract.output_schema


# =============================================================================
# get_persona_contract — 不存在
# =============================================================================


def test_get_persona_contract_unknown_returns_none():
    """未知 persona 返回 None。"""
    assert get_persona_contract("nonexistent") is None


def test_get_persona_contract_empty_string_returns_none():
    """空字符串返回 None。"""
    assert get_persona_contract("") is None


# =============================================================================
# input_schema required 字段
# =============================================================================


def test_researcher_input_required():
    """researcher input required=['task']。"""
    c = get_persona_contract("researcher")
    assert c.input_schema["required"] == ["task"]


def test_coder_input_required():
    """coder input required=['task', 'affectedFiles']。"""
    c = get_persona_contract("coder")
    assert c.input_schema["required"] == ["task", "affectedFiles"]


def test_reviewer_input_required():
    """reviewer input required=['codeDiff']。"""
    c = get_persona_contract("reviewer")
    assert c.input_schema["required"] == ["codeDiff"]


def test_architect_input_required():
    """architect input required=['requirements']。"""
    c = get_persona_contract("architect")
    assert c.input_schema["required"] == ["requirements"]


def test_debugger_input_required():
    """debugger input required=['errorDescription']。"""
    c = get_persona_contract("debugger")
    assert c.input_schema["required"] == ["errorDescription"]


# =============================================================================
# output_schema required 字段
# =============================================================================


def test_researcher_output_required():
    """researcher output required=['researchSummary', 'recommendedApproach']。"""
    c = get_persona_contract("researcher")
    assert c.output_schema["required"] == ["researchSummary", "recommendedApproach"]


def test_coder_output_required():
    """coder output required=['codeChanges', 'verification']。"""
    c = get_persona_contract("coder")
    assert c.output_schema["required"] == ["codeChanges", "verification"]


def test_reviewer_output_required():
    """reviewer output required=['reviewComments', 'decision']。"""
    c = get_persona_contract("reviewer")
    assert c.output_schema["required"] == ["reviewComments", "decision"]


def test_architect_output_required():
    """architect output required=['designDoc', 'fileStructure']。"""
    c = get_persona_contract("architect")
    assert c.output_schema["required"] == ["designDoc", "fileStructure"]


def test_debugger_output_required():
    """debugger output required=['rootCause', 'fix']。"""
    c = get_persona_contract("debugger")
    assert c.output_schema["required"] == ["rootCause", "fix"]


# =============================================================================
# additionalProperties: False(对齐 CLI)
# =============================================================================


@pytest.mark.parametrize("name", EXPECTED_NAMES)
def test_input_schema_additional_properties_false(name):
    """每个 input_schema additionalProperties=False。"""
    c = get_persona_contract(name)
    assert c.input_schema.get("additionalProperties") is False


@pytest.mark.parametrize("name", EXPECTED_NAMES)
def test_output_schema_additional_properties_false(name):
    """每个 output_schema additionalProperties=False。"""
    c = get_persona_contract(name)
    assert c.output_schema.get("additionalProperties") is False


# =============================================================================
# reviewer output_schema enum 字段
# =============================================================================


def test_reviewer_decision_enum():
    """reviewer decision enum=['approve', 'request_changes']。"""
    c = get_persona_contract("reviewer")
    decision = c.output_schema["properties"]["decision"]
    assert decision["enum"] == ["approve", "request_changes"]


def test_reviewer_severity_enum():
    """reviewer severity enum=['P0', 'P1', 'P2']。"""
    c = get_persona_contract("reviewer")
    severity = c.output_schema["properties"]["severity"]
    assert severity["enum"] == ["P0", "P1", "P2"]


# =============================================================================
# FastAPI router — GET /api/personas
# =============================================================================


def test_router_list_personas(client):
    """GET /api/personas 返回 200 + 5 个 persona。"""
    resp = client.get("/api/personas")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 5
    assert len(data["personas"]) == 5


def test_router_list_personas_items_have_name_and_description(client):
    """GET /api/personas 每条含 name + description。"""
    resp = client.get("/api/personas")
    items = resp.json()["personas"]
    for item in items:
        assert "name" in item
        assert "description" in item
        assert isinstance(item["description"], str)
        assert len(item["description"]) > 0


def test_router_list_personas_names_match(client):
    """GET /api/personas 返回的 name 集合与预期一致。"""
    resp = client.get("/api/personas")
    names = {item["name"] for item in resp.json()["personas"]}
    assert names == set(EXPECTED_NAMES)


# =============================================================================
# FastAPI router — GET /api/personas/{name}
# =============================================================================


@pytest.mark.parametrize("name", EXPECTED_NAMES)
def test_router_get_persona(client, name):
    """GET /api/personas/{name} 返回 persona 详情。"""
    resp = client.get(f"/api/personas/{name}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == name
    assert "description" in data
    assert "input_schema" in data
    assert "output_schema" in data
    assert data["input_schema"]["type"] == "object"
    assert data["output_schema"]["type"] == "object"


def test_router_get_persona_unknown_404(client):
    """GET /api/personas/unknown 返回 404。"""
    resp = client.get("/api/personas/nonexistent")
    assert resp.status_code == 404


# =============================================================================
# FastAPI router — GET /api/personas/{name}/contract
# =============================================================================


@pytest.mark.parametrize("name", EXPECTED_NAMES)
def test_router_get_persona_contract(client, name):
    """GET /api/personas/{name}/contract 返回 input_schema + output_schema。"""
    resp = client.get(f"/api/personas/{name}/contract")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == name
    assert "input_schema" in data
    assert "output_schema" in data
    assert "required" in data["input_schema"]
    assert "required" in data["output_schema"]


def test_router_get_persona_contract_unknown_404(client):
    """GET /api/personas/unknown/contract 返回 404。"""
    resp = client.get("/api/personas/nonexistent/contract")
    assert resp.status_code == 404


# =============================================================================
# 契约一致性 — 与 CLI contracts.ts 对齐
# =============================================================================


def test_researcher_input_properties():
    """researcher input 含 task/filePaths/scope 三个属性。"""
    c = get_persona_contract("researcher")
    assert set(c.input_schema["properties"].keys()) == {"task", "filePaths", "scope"}


def test_researcher_output_properties():
    """researcher output 含 researchSummary/recommendedApproach/references。"""
    c = get_persona_contract("researcher")
    assert set(c.output_schema["properties"].keys()) == {
        "researchSummary",
        "recommendedApproach",
        "references",
    }


def test_coder_input_properties():
    """coder input 含 task/affectedFiles/constraints。"""
    c = get_persona_contract("coder")
    assert set(c.input_schema["properties"].keys()) == {"task", "affectedFiles", "constraints"}


def test_coder_output_properties():
    """coder output 含 codeChanges/testResults/verification。"""
    c = get_persona_contract("coder")
    assert set(c.output_schema["properties"].keys()) == {
        "codeChanges",
        "testResults",
        "verification",
    }


def test_reviewer_input_properties():
    """reviewer input 含 codeDiff/reviewCriteria/context。"""
    c = get_persona_contract("reviewer")
    assert set(c.input_schema["properties"].keys()) == {"codeDiff", "reviewCriteria", "context"}


def test_reviewer_output_properties():
    """reviewer output 含 reviewComments/decision/severity。"""
    c = get_persona_contract("reviewer")
    assert set(c.output_schema["properties"].keys()) == {
        "reviewComments",
        "decision",
        "severity",
    }


def test_architect_input_properties():
    """architect input 含 requirements/constraints/existingArchitecture。"""
    c = get_persona_contract("architect")
    assert set(c.input_schema["properties"].keys()) == {
        "requirements",
        "constraints",
        "existingArchitecture",
    }


def test_architect_output_properties():
    """architect output 含 designDoc/fileStructure/apiContracts。"""
    c = get_persona_contract("architect")
    assert set(c.output_schema["properties"].keys()) == {
        "designDoc",
        "fileStructure",
        "apiContracts",
    }


def test_debugger_input_properties():
    """debugger input 含 errorDescription/stackTrace/reproSteps。"""
    c = get_persona_contract("debugger")
    assert set(c.input_schema["properties"].keys()) == {
        "errorDescription",
        "stackTrace",
        "reproSteps",
    }


def test_debugger_output_properties():
    """debugger output 含 rootCause/fix/test。"""
    c = get_persona_contract("debugger")
    assert set(c.output_schema["properties"].keys()) == {"rootCause", "fix", "test"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
