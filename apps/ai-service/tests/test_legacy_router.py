"""Legacy 路由测试:7 个端点全覆盖。

测试覆盖:
- GET /api/legacy/socketio/status: 兼容提示
- POST /api/legacy/card/convert: 卡片格式转换(完整/空/缺 card 键)
- GET /api/legacy/category/cache: Redis 不可用 503 + 缓存命中/未命中/非法 JSON
- POST /api/legacy/category/cache/refresh: Redis 不可用 503 + 成功删除
- GET /api/legacy/public-socket/status
- GET /api/legacy/ws-audio/status
- GET /api/legacy/coze/compat
- GET /api/legacy/old-api/status
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from app.routers import legacy


class TestSocketioStatus:
    async def test_returns_unsupported_with_alternative(self, client):
        resp = await client.get("/api/legacy/socketio/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["supported"] is False
        assert data["alternative"] == "/ws/chat"
        assert "message" in data


class TestCardConvert:
    async def test_converts_full_card(self, client):
        resp = await client.post("/api/legacy/card/convert", json={
            "card": {
                "type": "article",
                "title": "测试标题",
                "content": "内容",
                "images": ["img1.png"],
                "actions": [{"label": "确定"}],
                "footer": "页脚",
            }
        })
        assert resp.status_code == 200
        converted = resp.json()["converted"]
        assert converted["type"] == "article"
        assert converted["title"] == "测试标题"
        assert converted["images"] == ["img1.png"]
        assert converted["actions"] == [{"label": "确定"}]
        assert converted["footer"] == "页脚"

    async def test_converts_empty_card_with_defaults(self, client):
        resp = await client.post("/api/legacy/card/convert", json={"card": {}})
        assert resp.status_code == 200
        converted = resp.json()["converted"]
        assert converted["type"] == "default"
        assert converted["title"] == ""
        assert converted["images"] == []

    async def test_converts_missing_card_key(self, client):
        resp = await client.post("/api/legacy/card/convert", json={})
        assert resp.status_code == 200
        assert resp.json()["converted"]["type"] == "default"


class TestCategoryCacheGet:
    async def test_returns_503_when_redis_unavailable(self, client, monkeypatch):
        monkeypatch.setattr(legacy, "_use_redis", False)
        monkeypatch.setattr(legacy, "_redis_client", None)
        resp = await client.get("/api/legacy/category/cache")
        assert resp.status_code == 503
        assert "Redis" in resp.json()["detail"]

    async def test_returns_empty_when_cache_miss(self, client, monkeypatch):
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)
        monkeypatch.setattr(legacy, "_use_redis", True)
        monkeypatch.setattr(legacy, "_redis_client", mock_redis)
        resp = await client.get("/api/legacy/category/cache")
        assert resp.status_code == 200
        data = resp.json()
        assert data["categories"] == []
        assert data["cached"] is False

    async def test_returns_categories_from_dict(self, client, monkeypatch):
        cache_data = {"agent": [{"id": 1, "name": "分类1"}], "tool": []}
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=json.dumps(cache_data))
        monkeypatch.setattr(legacy, "_use_redis", True)
        monkeypatch.setattr(legacy, "_redis_client", mock_redis)
        resp = await client.get("/api/legacy/category/cache?category_type=agent")
        assert resp.status_code == 200
        data = resp.json()
        assert data["categories"] == [{"id": 1, "name": "分类1"}]
        assert data["cached"] is True

    async def test_returns_empty_on_invalid_json(self, client, monkeypatch):
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value="not-json{")
        monkeypatch.setattr(legacy, "_use_redis", True)
        monkeypatch.setattr(legacy, "_redis_client", mock_redis)
        resp = await client.get("/api/legacy/category/cache")
        assert resp.status_code == 200
        data = resp.json()
        assert data["categories"] == []
        assert data["cached"] is False
        assert "error" in data


class TestCategoryCacheRefresh:
    async def test_returns_503_when_redis_unavailable(self, client, monkeypatch):
        monkeypatch.setattr(legacy, "_use_redis", False)
        monkeypatch.setattr(legacy, "_redis_client", None)
        resp = await client.post("/api/legacy/category/cache/refresh")
        assert resp.status_code == 503

    async def test_refreshes_and_returns_deleted_count(self, client, monkeypatch):
        mock_redis = AsyncMock()
        mock_redis.delete = AsyncMock(return_value=1)
        monkeypatch.setattr(legacy, "_use_redis", True)
        monkeypatch.setattr(legacy, "_redis_client", mock_redis)
        resp = await client.post("/api/legacy/category/cache/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["refreshed"] is True
        assert data["deleted"] == 1
        mock_redis.delete.assert_called_once_with(legacy._CATEGORY_CACHE_KEY)


class TestOtherStatusEndpoints:
    async def test_public_socket_status(self, client):
        resp = await client.get("/api/legacy/public-socket/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["supported"] is False
        assert data["alternative"] == "/ws/notifications"

    async def test_ws_audio_status(self, client):
        resp = await client.get("/api/legacy/ws-audio/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["supported"] is True
        assert data["endpoint"] == "/ws/realtime/pcm"

    async def test_coze_compat(self, client):
        resp = await client.get("/api/legacy/coze/compat")
        assert resp.status_code == 200
        data = resp.json()
        assert data["supported"] is True
        assert data["alternative"] == "/api/agents"

    async def test_old_api_status(self, client):
        resp = await client.get("/api/legacy/old-api/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["migrated"] is True
        assert data["newApi"] == "/api/agents"
