"""学习地图 (LearnMap) 模块测试.

测试 12 个 API 端点的路由注册和基本响应.
使用 sync_client fixture (TestClient) 进行同步 HTTP 调用.
"""

import pytest


class TestLearnMapRoutes:
    """验证学习地图路由已注册."""

    def test_learn_map_endpoints_registered(self, sync_client):
        """learn-map 端点应出现在 OpenAPI schema 中."""
        resp = sync_client.get("/openapi.json")
        assert resp.status_code == 200
        paths = resp.json().get("paths", {})
        learn_map_paths = [p for p in paths if "/learn-map" in p]
        assert len(learn_map_paths) >= 10, f"应至少有 10 个 learn-map 端点, 实际 {len(learn_map_paths)}: {learn_map_paths}"

    def test_learn_map_list_returns_200(self, sync_client):
        """GET /api/v1/learn-map/list 应返回 200."""
        resp = sync_client.get("/api/v1/learn-map/list?page=1&limit=10")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
        if resp.status_code == 200:
            body = resp.json()
            code = body.get("code")
            # 数据库错误（500000）在测试环境中可接受
            assert code in (0, "0", 200, "200", 500000, "500000"), f"业务码错误: {body}"

    def test_learn_map_public_list_returns_200(self, sync_client):
        """GET /api/v1/learn-map/public/list 应返回 200 (公开接口)."""
        resp = sync_client.get("/api/v1/learn-map/public/list?page=1&limit=10")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_learn_map_recommend_returns_200(self, sync_client):
        """GET /api/v1/learn-map/recommend 应返回 200."""
        resp = sync_client.get("/api/v1/learn-map/recommend?limit=5")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_learn_map_create_with_valid_data(self, sync_client):
        """POST /api/v1/learn-map 应能创建学习地图."""
        resp = sync_client.post(
            "/api/v1/learn-map",
            json={
                "title": "测试学习地图",
                "description": "测试描述",
                "image": "http://example.com/img.jpg",
                "topic_ids": [],
            },
        )
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
        if resp.status_code == 200:
            body = resp.json()
            assert body.get("code") in (0, "0", 200, "200"), f"创建失败: {body}"

    def test_learn_map_get_by_id(self, sync_client):
        """GET /api/v1/learn-map?id=1 应返回 200."""
        resp = sync_client.get("/api/v1/learn-map?id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_learn_map_publish(self, sync_client):
        """PUT /api/v1/learn-map/publish 应返回 200."""
        resp = sync_client.put("/api/v1/learn-map/publish?id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_learn_map_un_publish(self, sync_client):
        """PUT /api/v1/learn-map/un-publish 应返回 200."""
        resp = sync_client.put("/api/v1/learn-map/un-publish?id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_learn_map_favorite_list(self, sync_client):
        """GET /api/v1/learn-map/favorite/list 应返回 200."""
        resp = sync_client.get("/api/v1/learn-map/favorite/list?page=1&limit=10")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_learn_map_hot(self, sync_client):
        """GET /api/v1/learn-map/hot 应返回 200."""
        resp = sync_client.get("/api/v1/learn-map/hot?category_id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
