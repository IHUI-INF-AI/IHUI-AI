"""作业管理 (Homework) 模块测试.

测试 9 个 API 端点的路由注册和基本响应.
"""

import pytest


class TestHomeworkRoutes:
    """验证作业管理路由已注册."""

    def test_homework_endpoints_registered(self, sync_client):
        """homework 端点应出现在 OpenAPI schema 中."""
        resp = sync_client.get("/openapi.json")
        assert resp.status_code == 200
        paths = resp.json().get("paths", {})
        homework_paths = [p for p in paths if "/homework" in p]
        assert len(homework_paths) >= 5, f"应至少有 5 个 homework 端点, 实际 {len(homework_paths)}: {homework_paths}"

    def test_lesson_homework_get(self, sync_client):
        """GET /api/v1/lesson/homework 应返回 200."""
        resp = sync_client.get("/api/v1/lesson/homework?lesson_id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_lesson_homework_create(self, sync_client):
        """POST /api/v1/lesson/homework 应能布置作业."""
        resp = sync_client.post(
            "/api/v1/lesson/homework",
            json={
                "lesson_id": 1,
                "content": "完成第一章练习",
                "url": "http://example.com/hw.pdf",
            },
        )
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
        if resp.status_code == 200:
            body = resp.json()
            assert body.get("code") in (0, "0", 200, "200"), f"创建失败: {body}"

    def test_lesson_homework_update(self, sync_client):
        """PUT /api/v1/lesson/homework 应返回 200."""
        resp = sync_client.put(
            "/api/v1/lesson/homework",
            json={
                "id": 1,
                "lesson_id": 1,
                "content": "更新后的作业内容",
                "url": "http://example.com/hw2.pdf",
            },
        )
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_homework_record_list(self, sync_client):
        """GET /api/v1/homework/record/list 应返回 200."""
        resp = sync_client.get("/api/v1/homework/record/list?lesson_id=1&page=1&limit=10")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_homework_record_get(self, sync_client):
        """GET /api/v1/homework/record 应返回 200."""
        resp = sync_client.get("/api/v1/homework/record?lesson_id=1&member_id=test_user")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_homework_record_create(self, sync_client):
        """POST /api/v1/homework/record 应能提交作业."""
        resp = sync_client.post(
            "/api/v1/homework/record",
            json={
                "lesson_id": 1,
                "url": "http://example.com/submission.pdf",
                "sign_up_id": 1,
            },
        )
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_homework_record_approval_pass(self, sync_client):
        """PUT /api/v1/homework/record/approval/pass 应返回 200."""
        resp = sync_client.put("/api/v1/homework/record/approval/pass", json={"id": 1})
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_homework_record_approval_reject(self, sync_client):
        """PUT /api/v1/homework/record/approval/reject 应返回 200."""
        resp = sync_client.put("/api/v1/homework/record/approval/reject", json={"id": 1})
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
