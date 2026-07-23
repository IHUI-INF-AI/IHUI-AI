"""app/routers/tools.py 单元测试:3 个工具调用端点全覆盖。

测试覆盖:
- POST /api/tools/search-codebase:正常调用 / 参数传递 / mcp_server 异常透传
- POST /api/tools/search-web:正常调用 / max_results 默认值 / 调用参数
- POST /api/tools/analyze-code:正常调用 / language 默认 "text"
- 请求模型字段校验:必填字段缺失 → 422

测试隔离:用 monkeypatch 替换 mcp_server.call_tool 为 AsyncMock,不调用真实 MCP handler。
"""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.routers import tools
from app.services.mcp_server import mcp_server


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
def mock_call_tool(monkeypatch):
    """mock mcp_server.call_tool,捕获调用参数并返回固定结果。

    返回 (mock_obj, captured_list),captured_list 收集每次调用的 (name, arguments)。
    """
    captured = []

    async def fake_call_tool(name, arguments=None, *, user_role=0):
        captured.append({"name": name, "arguments": arguments, "user_role": user_role})
        return {"ok": True, "tool": name, "echo_args": arguments}

    monkeypatch.setattr(mcp_server, "call_tool", fake_call_tool)
    return captured


# =============================================================================
# POST /api/tools/search-codebase
# =============================================================================


class TestSearchCodebase:
    """测试代码库搜索端点。"""

    async def test_returns_result_on_valid_request(self, client, mock_call_tool):
        # 正常请求 → 200 + 调用 mcp_server.call_tool
        resp = await client.post("/api/tools/search-codebase", json={
            "query": "def hello",
            "path": "/repo",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is True
        assert body["tool"] == "search_codebase"
        # 验证 call_tool 被正确调用
        assert len(mock_call_tool) == 1
        assert mock_call_tool[0]["name"] == "search_codebase"
        assert mock_call_tool[0]["arguments"] == {"query": "def hello", "path": "/repo"}

    async def test_uses_default_path_when_omitted(self, client, mock_call_tool):
        # path 缺失 → 默认 "."
        resp = await client.post("/api/tools/search-codebase", json={"query": "test"})
        assert resp.status_code == 200
        assert mock_call_tool[0]["arguments"]["path"] == "."

    async def test_returns_422_when_query_missing(self, client, mock_call_tool):
        # query 必填,缺失 → 422
        resp = await client.post("/api/tools/search-codebase", json={"path": "."})
        assert resp.status_code == 422
        # 校验失败时不应调用 call_tool
        assert len(mock_call_tool) == 0

    async def test_returns_422_when_body_empty(self, client, mock_call_tool):
        # 空 body → 422(query 必填)
        resp = await client.post("/api/tools/search-codebase", json={})
        assert resp.status_code == 422

    async def test_passes_through_mcp_error(self, client, monkeypatch):
        # mcp_server.call_tool 返回错误 dict(非抛异常)→ 200 + 错误内容透传
        async def fake_error(name, arguments=None, *, user_role=0):
            return {"ok": False, "error": "mcp internal error"}
        monkeypatch.setattr(mcp_server, "call_tool", fake_error)

        resp = await client.post("/api/tools/search-codebase", json={"query": "x"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is False
        assert "mcp internal error" in body["error"]

    async def test_handles_empty_query_string(self, client, mock_call_tool):
        # query 为空字符串(类型正确,值空)→ 仍调用(query 是 str 类型)
        resp = await client.post("/api/tools/search-codebase", json={"query": ""})
        assert resp.status_code == 200
        assert mock_call_tool[0]["arguments"]["query"] == ""


# =============================================================================
# POST /api/tools/search-web
# =============================================================================


class TestSearchWeb:
    """测试网页搜索端点。"""

    async def test_returns_result_on_valid_request(self, client, mock_call_tool):
        # 正常请求 → 200 + 调用 search_web
        resp = await client.post("/api/tools/search-web", json={
            "query": "fastapi tutorial",
            "max_results": 10,
        })
        assert resp.status_code == 200
        assert mock_call_tool[0]["name"] == "search_web"
        assert mock_call_tool[0]["arguments"] == {"query": "fastapi tutorial", "max_results": 10}

    async def test_default_max_results_is_5(self, client, mock_call_tool):
        # max_results 缺失 → 默认 5
        resp = await client.post("/api/tools/search-web", json={"query": "test"})
        assert resp.status_code == 200
        assert mock_call_tool[0]["arguments"]["max_results"] == 5

    async def test_returns_422_when_query_missing(self, client, mock_call_tool):
        # query 必填 → 422
        resp = await client.post("/api/tools/search-web", json={"max_results": 5})
        assert resp.status_code == 422

    async def test_returns_422_when_body_empty(self, client, mock_call_tool):
        # 空 body → 422
        resp = await client.post("/api/tools/search-web", json={})
        assert resp.status_code == 422

    async def test_passes_through_mcp_error(self, client, monkeypatch):
        # call_tool 返回错误 dict(非抛异常)→ 200 + 错误透传
        async def fake_error(name, arguments=None, *, user_role=0):
            return {"ok": False, "error": "network down"}
        monkeypatch.setattr(mcp_server, "call_tool", fake_error)

        resp = await client.post("/api/tools/search-web", json={"query": "x"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is False
        assert "network down" in body["error"]


# =============================================================================
# POST /api/tools/analyze-code
# =============================================================================


class TestAnalyzeCode:
    """测试代码静态分析端点。"""

    async def test_returns_result_on_valid_request(self, client, mock_call_tool):
        # 正常请求 → 200 + 调用 analyze_code
        resp = await client.post("/api/tools/analyze-code", json={
            "code": "def add(a, b): return a + b",
            "language": "python",
        })
        assert resp.status_code == 200
        assert mock_call_tool[0]["name"] == "analyze_code"
        assert mock_call_tool[0]["arguments"] == {
            "code": "def add(a, b): return a + b",
            "language": "python",
        }

    async def test_default_language_is_text(self, client, mock_call_tool):
        # language 缺失 → 默认 "text"
        resp = await client.post("/api/tools/analyze-code", json={"code": "x = 1"})
        assert resp.status_code == 200
        assert mock_call_tool[0]["arguments"]["language"] == "text"

    async def test_returns_422_when_code_missing(self, client, mock_call_tool):
        # code 必填 → 422
        resp = await client.post("/api/tools/analyze-code", json={"language": "python"})
        assert resp.status_code == 422

    async def test_returns_422_when_body_empty(self, client, mock_call_tool):
        # 空 body → 422
        resp = await client.post("/api/tools/analyze-code", json={})
        assert resp.status_code == 422

    async def test_handles_empty_code_string(self, client, mock_call_tool):
        # code 为空字符串 → 仍调用(类型正确)
        resp = await client.post("/api/tools/analyze-code", json={"code": ""})
        assert resp.status_code == 200
        assert mock_call_tool[0]["arguments"]["code"] == ""

    async def test_passes_through_mcp_error(self, client, monkeypatch):
        # call_tool 返回错误 dict(非抛异常)→ 200 + 错误透传
        async def fake_error(name, arguments=None, *, user_role=0):
            return {"ok": False, "error": "invalid code"}
        monkeypatch.setattr(mcp_server, "call_tool", fake_error)

        resp = await client.post("/api/tools/analyze-code", json={"code": "x"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is False
        assert "invalid code" in body["error"]


# =============================================================================
# 请求模型字段约束
# =============================================================================


class TestRequestModels:
    """测试请求模型字段定义(无网络,纯模型校验)。"""

    def test_search_codebase_request_requires_query(self):
        # query 必填
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            tools.SearchCodebaseRequest()

    def test_search_codebase_request_defaults_path_to_dot(self):
        # path 默认 "."
        req = tools.SearchCodebaseRequest(query="x")
        assert req.path == "."

    def test_search_web_request_defaults_max_results_to_5(self):
        # max_results 默认 5
        req = tools.SearchWebRequest(query="x")
        assert req.max_results == 5

    def test_analyze_code_request_defaults_language_to_text(self):
        # language 默认 "text"
        req = tools.AnalyzeCodeRequest(code="x")
        assert req.language == "text"
