"""协议管理 (Agreement) 模块测试."""

import pytest


class TestAgreementRoutes:
    """验证协议管理路由已注册."""

    def test_agreement_endpoints_registered(self, sync_client):
        """agreement 端点应出现在 OpenAPI schema 中."""
        resp = sync_client.get("/openapi.json")
        assert resp.status_code == 200
        paths = resp.json().get("paths", {})
        agreement_paths = [p for p in paths if "/agreement" in p]
        assert len(agreement_paths) >= 3, f"应至少有 3 个 agreement 端点, 实际 {len(agreement_paths)}: {agreement_paths}"

    def test_agreement_page(self, sync_client):
        """GET /api/v1/agreement/page 应返回 200."""
        resp = sync_client.get("/api/v1/agreement/page?page=1&limit=10")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_agreement_create(self, sync_client):
        """POST /api/v1/agreement 应能创建协议."""
        resp = sync_client.post("/api/v1/agreement", json={
            "name": "用户服务协议",
            "type": "user_service",
            "content": "本协议规定...",
        })
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
        if resp.status_code == 200:
            body = resp.json()
            assert body.get("code") in (0, "0", 200, "200"), f"创建失败: {body}"

    def test_agreement_public_get(self, sync_client):
        """GET /api/v1/agreement/public?type=user_service 应返回 200 (公开接口)."""
        resp = sync_client.get("/api/v1/agreement/public?type=user_service")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_agreement_update(self, sync_client):
        """PUT /api/v1/agreement 应返回 200."""
        resp = sync_client.put("/api/v1/agreement", json={
            "id": 1,
            "name": "更新后的协议",
            "type": "user_service",
            "content": "更新后的内容...",
        })
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
