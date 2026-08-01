"""publish.py 7 个 AI 写作 HTTP 端点测试(2026-08-01 立)。

测试覆盖(22 cases):
1. 7 个端点成功响应(7 tests):
   - POST /ai/titles    — 标题候选 → {code:0, message:"success", data:{titles:[...]}}
   - POST /ai/polish    — 正文润色 → {code:0, message:"success", data:{content:"..."}}
   - POST /ai/tags      — 标签推荐 → {code:0, message:"success", data:{tags:[...]}}
   - POST /ai/summary   — SEO 摘要 → {code:0, message:"success", data:{summary:"..."}}
   - POST /ai/seo       — SEO 评分 → {code:0, message:"success", data:{seo:{...}}}
   - POST /ai/cover     — 封面建议 → {code:0, message:"success", data:{covers:[...]}}
   - POST /ai/analyze-all — 批量分析 → {code:0, message:"success", data:{...}}
2. Pydantic 校验失败返回 422(7 tests,parametrized):
   - 缺少必填字段 → 422
3. 服务异常返回 500 + {code:1, message:str(e)}(7 tests,parametrized):
   - ai_writing_service 方法抛异常 → 500
4. 未登录返回 401(1 test):
   - 无 JWT → _get_user_id 抛 401

测试隔离:mock ai_writing_service 方法(不真实调用 LLM),mock _get_user_id(绕过 JWT)。
使用 httpx.AsyncClient + ASGITransport(conftest 提供 client fixture)。
"""
from __future__ import annotations

from typing import Any

import pytest
from unittest.mock import AsyncMock, MagicMock


# =============================================================================
# fixtures
# =============================================================================


@pytest.fixture(autouse=True)
def _clear_jwt_secret(monkeypatch: pytest.MonkeyPatch):
    """清空 jwt_secret → JWTAuthMiddleware 跳过认证(不注入 user_id)。

    success/422/500 测试 patch _get_user_id 直接绕过,中间件行为无关;
    401 测试依赖此设置 → request.state.user_id 未设置 → _get_user_id 抛 401。
    """
    from app.core.config import settings
    monkeypatch.setattr(settings, "jwt_secret", "")


@pytest.fixture
def mock_ai_and_auth(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """Mock _get_user_id(绕过 JWT)+ 7 个 ai_writing_service 方法(不真实调用 LLM)。

    返回 dict:每个方法名 → AsyncMock,测试可覆盖 return_value / side_effect。
    """
    from app.routers import publish as pub_module
    from app.services.publish.ai_assistant import ai_writing_service

    # 绕过 JWT 鉴权
    monkeypatch.setattr(pub_module, "_get_user_id", lambda request: "test-user-123")

    mocks: dict[str, Any] = {}
    mocks["generate_titles"] = AsyncMock(return_value=["标题一", "标题二", "标题三"])
    mocks["polish_content"] = AsyncMock(return_value="润色后的正文内容")
    mocks["recommend_tags"] = AsyncMock(return_value=["AI", "发布", "自动化"])
    mocks["generate_summary"] = AsyncMock(return_value="这是一段 SEO 摘要。")

    mock_seo = MagicMock()
    mock_seo.model_dump = MagicMock(return_value={
        "score": 85, "title_score": 90, "content_score": 80,
        "keyword_density": {"AI": 0.05}, "suggestions": ["增加关键词密度"],
    })
    mocks["analyze_seo"] = AsyncMock(return_value=mock_seo)

    mocks["suggest_cover"] = AsyncMock(return_value=["科技风蓝紫渐变", "简约白色卡片"])
    mocks["analyze_all"] = AsyncMock(return_value={
        "titles": ["标题1"], "tags": ["tag1"], "summary": "摘要",
        "seo": None, "covers": ["封面1"],
    })

    for name, mock in mocks.items():
        monkeypatch.setattr(ai_writing_service, name, mock)

    return mocks


# =============================================================================
# 端点配置(供 parametrized 测试复用)
# =============================================================================


_ENDPOINT_CONFIGS = [
    {
        "name": "titles",
        "path": "/api/publish/ai/titles",
        "valid_body": {"content": "测试正文内容", "platform": "csdn", "count": 3},
        "invalid_body": {"platform": "csdn"},  # 缺少 content
        "method": "generate_titles",
        "data_key": "titles",
    },
    {
        "name": "polish",
        "path": "/api/publish/ai/polish",
        "valid_body": {"content": "需要润色的文本", "style": "professional"},
        "invalid_body": {"style": "casual"},  # 缺少 content
        "method": "polish_content",
        "data_key": "content",
    },
    {
        "name": "tags",
        "path": "/api/publish/ai/tags",
        "valid_body": {"content": "测试正文", "platform": "csdn", "count": 5},
        "invalid_body": {"platform": "csdn"},  # 缺少 content
        "method": "recommend_tags",
        "data_key": "tags",
    },
    {
        "name": "summary",
        "path": "/api/publish/ai/summary",
        "valid_body": {"content": "测试正文", "max_length": 100},
        "invalid_body": {"max_length": 100},  # 缺少 content
        "method": "generate_summary",
        "data_key": "summary",
    },
    {
        "name": "seo",
        "path": "/api/publish/ai/seo",
        "valid_body": {"title": "测试标题", "content": "测试正文", "platform": "csdn"},
        "invalid_body": {"content": "测试正文"},  # 缺少 title
        "method": "analyze_seo",
        "data_key": "seo",
    },
    {
        "name": "cover",
        "path": "/api/publish/ai/cover",
        "valid_body": {"content": "测试正文"},
        "invalid_body": {},  # 缺少 content
        "method": "suggest_cover",
        "data_key": "covers",
    },
    {
        "name": "analyze-all",
        "path": "/api/publish/ai/analyze-all",
        "valid_body": {"content": "测试正文", "title": "测试标题", "platform": "csdn"},
        "invalid_body": {"title": "测试标题"},  # 缺少 content
        "method": "analyze_all",
        "data_key": None,  # analyze-all 直接返回 result dict,无嵌套 data_key
    },
]


# =============================================================================
# 1. 7 个端点成功响应(7 tests)
# =============================================================================


class TestAiEndpointsSuccess:
    """测试 7 个 AI 写作端点成功响应格式 {code:0, message:"success", data:{...}}。"""

    async def test_ai_titles_success(self, client, mock_ai_and_auth):
        """POST /ai/titles → {code:0, message:"success", data:{titles:[...]}}。"""
        resp = await client.post("/api/publish/ai/titles", json={
            "content": "测试正文", "platform": "csdn", "count": 3,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["message"] == "success"
        assert "titles" in data["data"]
        assert isinstance(data["data"]["titles"], list)
        assert len(data["data"]["titles"]) > 0
        mock_ai_and_auth["generate_titles"].assert_awaited_once()

    async def test_ai_polish_success(self, client, mock_ai_and_auth):
        """POST /ai/polish → {code:0, message:"success", data:{content:"..."}}。"""
        resp = await client.post("/api/publish/ai/polish", json={
            "content": "需要润色", "style": "professional",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["message"] == "success"
        assert "content" in data["data"]
        assert isinstance(data["data"]["content"], str)
        mock_ai_and_auth["polish_content"].assert_awaited_once()

    async def test_ai_tags_success(self, client, mock_ai_and_auth):
        """POST /ai/tags → {code:0, message:"success", data:{tags:[...]}}。"""
        resp = await client.post("/api/publish/ai/tags", json={
            "content": "测试正文", "platform": "csdn", "count": 5,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["message"] == "success"
        assert "tags" in data["data"]
        assert isinstance(data["data"]["tags"], list)
        mock_ai_and_auth["recommend_tags"].assert_awaited_once()

    async def test_ai_summary_success(self, client, mock_ai_and_auth):
        """POST /ai/summary → {code:0, message:"success", data:{summary:"..."}}。"""
        resp = await client.post("/api/publish/ai/summary", json={
            "content": "测试正文", "max_length": 100,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["message"] == "success"
        assert "summary" in data["data"]
        assert isinstance(data["data"]["summary"], str)
        mock_ai_and_auth["generate_summary"].assert_awaited_once()

    async def test_ai_seo_success(self, client, mock_ai_and_auth):
        """POST /ai/seo → {code:0, message:"success", data:{seo:{score:...}}}。"""
        resp = await client.post("/api/publish/ai/seo", json={
            "title": "测试标题", "content": "测试正文", "platform": "csdn",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["message"] == "success"
        assert "seo" in data["data"]
        assert data["data"]["seo"]["score"] == 85
        mock_ai_and_auth["analyze_seo"].assert_awaited_once()

    async def test_ai_cover_success(self, client, mock_ai_and_auth):
        """POST /ai/cover → {code:0, message:"success", data:{covers:[...]}}。"""
        resp = await client.post("/api/publish/ai/cover", json={
            "content": "测试正文",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["message"] == "success"
        assert "covers" in data["data"]
        assert isinstance(data["data"]["covers"], list)
        mock_ai_and_auth["suggest_cover"].assert_awaited_once()

    async def test_ai_analyze_all_success(self, client, mock_ai_and_auth):
        """POST /ai/analyze-all → {code:0, message:"success", data:{titles/tags/summary/seo/covers}}。"""
        resp = await client.post("/api/publish/ai/analyze-all", json={
            "content": "测试正文", "title": "测试标题", "platform": "csdn",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["message"] == "success"
        # analyze-all 返回 result dict 作为 data
        assert "titles" in data["data"]
        assert "tags" in data["data"]
        assert "summary" in data["data"]
        assert "seo" in data["data"]
        assert "covers" in data["data"]
        mock_ai_and_auth["analyze_all"].assert_awaited_once()


# =============================================================================
# 2. Pydantic 校验失败返回 422(7 tests,parametrized)
# =============================================================================


@pytest.mark.parametrize(
    "config",
    _ENDPOINT_CONFIGS,
    ids=[c["name"] for c in _ENDPOINT_CONFIGS],
)
async def test_invalid_body_returns_422(config: dict, client, mock_ai_and_auth):
    """缺少必填字段 → FastAPI Pydantic 校验返回 422(不调用 _get_user_id / ai_writing_service)。"""
    resp = await client.post(config["path"], json=config["invalid_body"])
    assert resp.status_code == 422
    # 422 响应含 detail 字段(FastAPI 默认 validation error 格式)
    data = resp.json()
    assert "detail" in data


# =============================================================================
# 3. 服务异常返回 500 + {code:1, message:str(e)}(7 tests,parametrized)
# =============================================================================


@pytest.mark.parametrize(
    "config",
    _ENDPOINT_CONFIGS,
    ids=[c["name"] for c in _ENDPOINT_CONFIGS],
)
async def test_service_failure_returns_500(config: dict, client, mock_ai_and_auth):
    """ai_writing_service 方法抛异常 → 500 + {code:1, message:str(e)}。"""
    mock_ai_and_auth[config["method"]].side_effect = RuntimeError("LLM service unavailable")

    resp = await client.post(config["path"], json=config["valid_body"])
    assert resp.status_code == 500
    data = resp.json()
    assert data["code"] == 1
    assert "LLM service unavailable" in data["message"]


# =============================================================================
# 4. 未登录返回 401(1 test)
# =============================================================================


async def test_unauth_returns_401(client):
    """无 JWT(request.state.user_id 未设置)→ _get_user_id 抛 401。

    不使用 mock_ai_and_auth fixture(不 patch _get_user_id),
    jwt_secret="" 使中间件跳过 → user_id 未设置 → 401。
    """
    resp = await client.post("/api/publish/ai/titles", json={
        "content": "测试正文",
    })
    assert resp.status_code == 401
    assert resp.json()["detail"] == "未登录"
