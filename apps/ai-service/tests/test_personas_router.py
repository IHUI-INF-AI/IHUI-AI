"""app/routers/personas.py 单元测试:3 个 persona 端点全覆盖。

测试覆盖:
- GET /api/personas:列出全部 persona(name + description + count)
- GET /api/personas/{name}:存在 → 详情;不存在 → 404
- GET /api/personas/{name}/contract:存在 → input_schema + output_schema;不存在 → 404

测试隔离:直接用真实 PERSONAS_CONTRACTS registry(纯数据,无外部依赖)。
"""
from __future__ import annotations

import pytest

from app.routers import personas
from app.services.persona_registry import (
    PERSONAS_CONTRACTS,
    PersonaContract,
    get_persona_contract,
    list_persona_names,
)


# =============================================================================
# 辅助 fixtures
# =============================================================================


@pytest.fixture(autouse=True)
def _bypass_jwt(monkeypatch):
    """隔离 JWT 中间件:清空 jwt_secret → middleware 走跳过路径(node_env=development)。

    .env 中配置了真实 jwt_secret,JWTAuthMiddleware 会验证 token,测试无 token → 401。
    清空 jwt_secret + node_env=development 后,middleware 直接放行。
    """
    from app.core.config import settings
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")


@pytest.fixture
def known_persona_names():
    """返回 registry 中已知的 persona 名字列表(至少含 researcher / coder)。"""
    return list(PERSONAS_CONTRACTS.keys())


# =============================================================================
# list_persona_names / get_persona_contract(底层服务函数)
# =============================================================================


class TestRegistryHelpers:
    """测试 persona_registry 暴露的辅助函数(被 router 调用)。"""

    def test_list_persona_names_returns_known_personas(self):
        # list_persona_names 至少包含 researcher / coder / reviewer / architect / debugger
        names = list_persona_names()
        assert isinstance(names, list)
        assert len(names) >= 5
        for expected in ("researcher", "coder", "reviewer", "architect", "debugger"):
            assert expected in names

    def test_get_persona_contract_returns_contract_for_known_name(self):
        # 已知 persona → 返回 PersonaContract
        contract = get_persona_contract("researcher")
        assert contract is not None
        assert isinstance(contract, PersonaContract)
        assert "description" in contract.input_schema
        assert "properties" in contract.input_schema

    def test_get_persona_contract_returns_none_for_unknown_name(self):
        # 未知 persona → None
        assert get_persona_contract("nonexistent_persona_xyz") is None

    def test_get_persona_contract_returns_none_for_empty_string(self):
        # 空字符串 → None
        assert get_persona_contract("") is None


# =============================================================================
# GET /api/personas 列表端点
# =============================================================================


class TestListPersonas:
    """测试 GET /api/personas 列表端点。"""

    async def test_returns_all_personas_with_count(self, client):
        # 返回 {personas: [...], count: N},N 与 registry 大小一致
        resp = await client.get("/api/personas")
        assert resp.status_code == 200
        data = resp.json()
        assert "personas" in data
        assert "count" in data
        assert data["count"] == len(PERSONAS_CONTRACTS)
        assert len(data["personas"]) == len(PERSONAS_CONTRACTS)

    async def test_each_persona_has_name_and_description(self, client):
        # 每个 persona 项含 name + description 字段
        resp = await client.get("/api/personas")
        items = resp.json()["personas"]
        for item in items:
            assert "name" in item
            assert "description" in item
            assert isinstance(item["name"], str)
            assert isinstance(item["description"], str)
            assert item["name"] in PERSONAS_CONTRACTS

    async def test_count_matches_registry_size(self, client):
        # count 字段等于 PERSONAS_CONTRACTS 字典大小
        resp = await client.get("/api/personas")
        assert resp.json()["count"] == len(PERSONAS_CONTRACTS)


# =============================================================================
# GET /api/personas/{name} 详情端点
# =============================================================================


class TestGetPersona:
    """测试 GET /api/personas/{name} 详情端点。"""

    async def test_returns_details_for_known_persona(self, client, known_persona_names):
        # 已知 persona → 200 + 详情(name / description / input_schema / output_schema)
        name = known_persona_names[0]
        resp = await client.get(f"/api/personas/{name}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == name
        assert "description" in data
        assert "input_schema" in data
        assert "output_schema" in data
        # input_schema 应与 registry 中一致
        assert data["input_schema"] == PERSONAS_CONTRACTS[name].input_schema
        assert data["output_schema"] == PERSONAS_CONTRACTS[name].output_schema

    async def test_returns_404_for_unknown_persona(self, client):
        # 未知 persona → 404
        resp = await client.get("/api/personas/nonexistent_xyz")
        assert resp.status_code == 404
        detail = resp.json()["detail"]
        assert "nonexistent_xyz" in detail

    async def test_description_matches_input_schema_description(self, client, known_persona_names):
        # description 字段取自 input_schema.description
        name = known_persona_names[0]
        resp = await client.get(f"/api/personas/{name}")
        data = resp.json()
        expected_desc = PERSONAS_CONTRACTS[name].input_schema.get("description", "")
        assert data["description"] == expected_desc


# =============================================================================
# GET /api/personas/{name}/contract 契约端点
# =============================================================================


class TestGetPersonaContract:
    """测试 GET /api/personas/{name}/contract 契约端点。"""

    async def test_returns_contract_for_known_persona(self, client, known_persona_names):
        # 已知 persona → 200 + 契约(name / input_schema / output_schema)
        name = known_persona_names[0]
        resp = await client.get(f"/api/personas/{name}/contract")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == name
        assert "input_schema" in data
        assert "output_schema" in data
        assert data["input_schema"] == PERSONAS_CONTRACTS[name].input_schema
        assert data["output_schema"] == PERSONAS_CONTRACTS[name].output_schema

    async def test_returns_404_for_unknown_persona(self, client):
        # 未知 persona → 404
        resp = await client.get("/api/personas/ghost_persona/contract")
        assert resp.status_code == 404
        assert "ghost_persona" in resp.json()["detail"]

    async def test_contract_differs_from_details_endpoint(self, client, known_persona_names):
        # /contract 端点不返回 description,只返回 schema
        name = known_persona_names[0]
        resp = await client.get(f"/api/personas/{name}/contract")
        data = resp.json()
        assert "description" not in data
        assert "input_schema" in data
        assert "output_schema" in data

    async def test_all_known_personas_have_valid_contract(self, client, known_persona_names):
        # 遍历所有已知 persona,确保都能返回 200 + 有效 schema
        for name in known_persona_names:
            resp = await client.get(f"/api/personas/{name}/contract")
            assert resp.status_code == 200, f"persona {name} 应返回 200"
            data = resp.json()
            assert data["name"] == name
            assert isinstance(data["input_schema"], dict)
            assert isinstance(data["output_schema"], dict)
