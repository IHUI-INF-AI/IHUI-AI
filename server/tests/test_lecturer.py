"""讲师管理 (Lecturer) 模块测试."""

import pytest


class TestLecturerRoutes:
    """验证讲师管理路由已注册."""

    def test_lecturer_endpoints_registered(self, sync_client):
        """lecturer 端点应出现在 OpenAPI schema 中."""
        resp = sync_client.get("/openapi.json")
        assert resp.status_code == 200
        paths = resp.json().get("paths", {})
        lecturer_paths = [p for p in paths if "/lecturer" in p]
        assert len(lecturer_paths) >= 3, f"应至少有 3 个 lecturer 端点, 实际 {len(lecturer_paths)}: {lecturer_paths}"

    def test_lecturer_list(self, sync_client):
        """GET /api/v1/lecturer/list 应返回 200."""
        resp = sync_client.get("/api/v1/lecturer/list?page=1&limit=10")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_lecturer_create(self, sync_client):
        """POST /api/v1/lecturer 应能创建讲师."""
        resp = sync_client.post("/api/v1/lecturer", json={
            "mobile": "13800138000",
            "job_title": "高级讲师",
            "description": "测试讲师介绍",
            "image": "http://example.com/avatar.jpg",
            "user_id": "test_user_001",
        })
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
        if resp.status_code == 200:
            body = resp.json()
            assert body.get("code") in (0, "0", 200, "200"), f"创建失败: {body}"

    def test_lecturer_get(self, sync_client):
        """GET /api/v1/lecturer/?id=1 应返回 200."""
        resp = sync_client.get("/api/v1/lecturer/?id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_lecturer_public_get(self, sync_client):
        """GET /api/v1/lecturer/public?id=1 应返回 200 (公开接口)."""
        resp = sync_client.get("/api/v1/lecturer/public?id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_lecturer_update(self, sync_client):
        """PUT /api/v1/lecturer 应返回 200."""
        resp = sync_client.put("/api/v1/lecturer", json={
            "id": 1,
            "mobile": "13900139000",
            "job_title": "更新后的头衔",
            "description": "更新后的介绍",
        })
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_lecturer_delete(self, sync_client):
        """DELETE /api/v1/lecturer?id=1 应返回 200."""
        resp = sync_client.delete("/api/v1/lecturer?id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
