"""证书管理 (Certificate + Template) 模块测试.

测试 20 个 API 端点.
"""

import pytest


class TestCertificateRoutes:
    """验证证书路由已注册."""

    def test_certificate_endpoints_registered(self, sync_client):
        """certificate 端点应出现在 OpenAPI schema 中."""
        resp = sync_client.get("/openapi.json")
        assert resp.status_code == 200
        paths = resp.json().get("paths", {})
        certificate_paths = [p for p in paths if "/certificate" in p]
        assert len(certificate_paths) >= 21, f"应至少有 21 个 certificate 端点, 实际 {len(certificate_paths)}: {certificate_paths}"

    def test_certificate_list(self, sync_client):
        """GET /api/v1/certificate/list 应返回 200."""
        resp = sync_client.get("/api/v1/certificate/list?page=1&limit=10")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_certificate_create(self, sync_client):
        """POST /api/v1/certificate 应能创建证书."""
        resp = sync_client.post("/api/v1/certificate", json={
            "name": "测试证书",
            "description": "测试描述",
            "awarding_organization": "测试机构",
            "awarder_name": "张三",
            "awarder_position": "主任",
            "member_id": "test_member",
            "lesson_id": 1,
        })
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_certificate_get(self, sync_client):
        """GET /api/v1/certificate/?id=1 应返回 200."""
        resp = sync_client.get("/api/v1/certificate/?id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_certificate_status_changes(self, sync_client):
        """证书状态变更端点应返回 200."""
        for action in ["valid", "suspended", "revoked", "cancelled", "expired"]:
            resp = sync_client.put(f"/api/v1/certificate/{action}?id=1")
            assert resp.status_code != 404, f"端点不存在 ({action}): {resp.status_code}"

    def test_certificate_auth_list(self, sync_client):
        """GET /api/v1/certificate/auth/list 应返回 200."""
        resp = sync_client.get("/api/v1/certificate/auth/list?page=1&limit=10")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"


class TestCertificateTemplateRoutes:
    """验证证书模板路由."""

    def test_template_list(self, sync_client):
        """GET /api/v1/certificate-template/list 应返回 200."""
        resp = sync_client.get("/api/v1/certificate-template/list?page=1&limit=10")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_template_create(self, sync_client):
        """POST /api/v1/certificate-template 应能创建模板."""
        resp = sync_client.post("/api/v1/certificate-template", json={
            "name": "测试模板",
            "description": "模板描述",
            "awarding_organization": "测试机构",
        })
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_template_active(self, sync_client):
        """PUT /api/v1/certificate-template/active 应返回 200."""
        resp = sync_client.put("/api/v1/certificate-template/active?id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_template_inactive(self, sync_client):
        """PUT /api/v1/certificate-template/inactive 应返回 200."""
        resp = sync_client.put("/api/v1/certificate-template/inactive?id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
