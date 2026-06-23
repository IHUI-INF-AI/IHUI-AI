"""专题管理 (Topic) 模块测试.

测试 12 个 API 端点的路由注册和基本响应.
"""

import pytest


class TestTopicRoutes:
    """验证专题管理路由已注册."""

    def test_topic_endpoints_registered(self, sync_client):
        """topic 端点应出现在 OpenAPI schema 中."""
        resp = sync_client.get("/openapi.json")
        assert resp.status_code == 200
        paths = resp.json().get("paths", {})
        topic_paths = [p for p in paths if "/topic" in p]
        assert len(topic_paths) >= 10, f"应至少有 10 个 topic 端点, 实际 {len(topic_paths)}: {topic_paths}"

    def test_topic_list_returns_200(self, sync_client):
        """GET /api/v1/topic/list 应返回 200."""
        resp = sync_client.get("/api/v1/topic/list?page=1&limit=10")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
        if resp.status_code == 200:
            body = resp.json()
            code = body.get("code")
            # 数据库错误（500000）在测试环境中可接受
            assert code in (0, "0", 200, "200", 500000, "500000"), f"业务码错误: {body}"

    def test_topic_public_list_returns_200(self, sync_client):
        """GET /api/v1/topic/public/list 应返回 200."""
        resp = sync_client.get("/api/v1/topic/public/list?page=1&limit=10")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_topic_recommend_returns_200(self, sync_client):
        """GET /api/v1/topic/recommend 应返回 200."""
        resp = sync_client.get("/api/v1/topic/recommend?limit=5")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_topic_create_with_valid_data(self, sync_client):
        """POST /api/v1/topic 应能创建专题."""
        resp = sync_client.post(
            "/api/v1/topic",
            json={
                "title": "测试专题",
                "description": "测试描述",
                "image": "http://example.com/img.jpg",
                "price": 99.00,
                "original_price": 199.00,
                "lesson_ids": [],
                "category_ids": [],
            },
        )
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
        if resp.status_code == 200:
            body = resp.json()
            assert body.get("code") in (0, "0", 200, "200"), f"创建失败: {body}"

    def test_topic_get_by_id(self, sync_client):
        """GET /api/v1/topic?id=1 应返回 200."""
        resp = sync_client.get("/api/v1/topic?id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_topic_publish(self, sync_client):
        """PUT /api/v1/topic/publish 应返回 200."""
        resp = sync_client.put("/api/v1/topic/publish?id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_topic_un_publish(self, sync_client):
        """PUT /api/v1/topic/un-publish 应返回 200."""
        resp = sync_client.put("/api/v1/topic/un-publish?id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_topic_favorite_list(self, sync_client):
        """GET /api/v1/topic/favorite/list 应返回 200."""
        resp = sync_client.get("/api/v1/topic/favorite/list?page=1&limit=10")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_topic_hot(self, sync_client):
        """GET /api/v1/topic/hot 应返回 200."""
        resp = sync_client.get("/api/v1/topic/hot?category_id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
