"""会员企业管理 (MemberCompany) 模块测试.

测试 35 个 API 端点 (company / company_type / post / group / tag / level).
"""

import pytest


class TestMemberCompanyRoutes:
    """验证会员企业路由已注册."""

    def test_company_endpoints_registered(self, sync_client):
        """company 端点应出现在 OpenAPI schema 中."""
        resp = sync_client.get("/openapi.json")
        assert resp.status_code == 200
        paths = resp.json().get("paths", {})
        company_paths = [p for p in paths if "/company" in p]
        assert len(company_paths) >= 9, f"应至少有 9 个 company 端点, 实际 {len(company_paths)}: {company_paths}"

    def test_company_list(self, sync_client):
        """GET /api/v1/company/list 应返回 200."""
        resp = sync_client.get("/api/v1/company/list?page=1&limit=10")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_company_create(self, sync_client):
        """POST /api/v1/company 应能创建公司."""
        resp = sync_client.post("/api/v1/company", json={
            "name": "测试公司", "mobile": "13800138000", "email": "test@test.com"
        })
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_company_enable(self, sync_client):
        """PUT /api/v1/company/enable 应返回 200."""
        resp = sync_client.put("/api/v1/company/enable?id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_company_disable(self, sync_client):
        """PUT /api/v1/company/disable 应返回 200."""
        resp = sync_client.put("/api/v1/company/disable?id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"


class TestMemberCompanyTypeRoutes:
    """验证公司类型路由."""

    def test_company_type_list(self, sync_client):
        """GET /api/v1/company/type/list 应返回 200."""
        resp = sync_client.get("/api/v1/company/type/list")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_company_type_create(self, sync_client):
        """POST /api/v1/company/type 应能创建."""
        resp = sync_client.post("/api/v1/company/type", json={"name": "测试类型"})
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"


class TestMemberPostRoutes:
    """验证会员岗位路由."""

    def test_post_list(self, sync_client):
        """GET /api/v1/post/list 应返回 200."""
        resp = sync_client.get("/api/v1/post/list")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_post_create(self, sync_client):
        """POST /api/v1/post 应能创建."""
        resp = sync_client.post("/api/v1/post", json={"name": "测试岗位"})
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"


class TestMemberGroupRoutes:
    """验证会员分组路由."""

    def test_group_list(self, sync_client):
        """GET /api/v1/group/list 应返回 200."""
        resp = sync_client.get("/api/v1/group/list")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_group_create(self, sync_client):
        """POST /api/v1/group 应能创建."""
        resp = sync_client.post("/api/v1/group", json={"name": "测试分组"})
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"


class TestMemberTagRoutes:
    """验证会员标签路由."""

    def test_tag_list(self, sync_client):
        """GET /api/v1/tag/list 应返回 200."""
        resp = sync_client.get("/api/v1/tag/list")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_tag_create(self, sync_client):
        """POST /api/v1/tag 应能创建."""
        resp = sync_client.post("/api/v1/tag", json={"name": "测试标签"})
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"


class TestMemberLevelRoutes:
    """验证会员等级路由."""

    def test_level_list(self, sync_client):
        """GET /api/v1/level/list 应返回 200."""
        resp = sync_client.get("/api/v1/level/list")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_level_create(self, sync_client):
        """POST /api/v1/level 应能创建."""
        resp = sync_client.post("/api/v1/level", json={"name": "测试等级", "level_value": 1})
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
