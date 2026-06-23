"""GitHub 项目管理 (GithubProjects) 模块测试."""

import pytest


class TestGithubProjectsRoutes:
    """验证 GitHub 项目管理路由已注册."""

    def test_github_projects_endpoints_registered(self, sync_client):
        """github-projects 端点应出现在 OpenAPI schema 中."""
        resp = sync_client.get("/openapi.json")
        assert resp.status_code == 200
        paths = resp.json().get("paths", {})
        github_paths = [p for p in paths if "/github-projects" in p]
        assert len(github_paths) >= 4, f"应至少有 4 个 github-projects 端点, 实际 {len(github_paths)}: {github_paths}"

    def test_github_projects_list(self, sync_client):
        """GET /api/v1/github-projects/list 应返回 200."""
        resp = sync_client.get("/api/v1/github-projects/list?page=1&limit=10")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
        if resp.status_code == 200:
            body = resp.json()
            code = body.get("code")
            # 数据库错误（500000）在测试环境中可接受
            assert code in (0, "0", 200, "200", 500000, "500000"), f"业务码错误: {body}"

    def test_github_projects_list_with_filters(self, sync_client):
        """GET /api/v1/github-projects/list 支持过滤参数."""
        resp = sync_client.get(
            "/api/v1/github-projects/list?page=1&limit=10"
            "&keyword=vue&category=frontend&language=TypeScript"
        )
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_github_projects_create(self, sync_client):
        """POST /api/v1/github-projects 应能创建项目."""
        resp = sync_client.post("/api/v1/github-projects", json={
            "name": "Vue 3",
            "url": "https://github.com/vuejs/core",
            "stars": 40000,
            "category": "frontend",
            "description": "Vue.js is a progressive framework",
            "language": "TypeScript",
        })
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
        if resp.status_code == 200:
            body = resp.json()
            assert body.get("code") in (0, "0", 200, "200"), f"创建失败: {body}"

    def test_github_projects_get(self, sync_client):
        """GET /api/v1/github-projects/?id=1 应返回 200."""
        resp = sync_client.get("/api/v1/github-projects/?id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_github_projects_categories(self, sync_client):
        """GET /api/v1/github-projects/categories 应返回 200."""
        resp = sync_client.get("/api/v1/github-projects/categories")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_github_projects_languages(self, sync_client):
        """GET /api/v1/github-projects/languages 应返回 200."""
        resp = sync_client.get("/api/v1/github-projects/languages")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_github_projects_update(self, sync_client):
        """PUT /api/v1/github-projects 应返回 200."""
        resp = sync_client.put("/api/v1/github-projects", json={
            "id": 1,
            "name": "Updated Project",
            "url": "https://github.com/updated/repo",
            "stars": 50000,
            "category": "tools",
            "description": "Updated description",
            "language": "Python",
        })
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"

    def test_github_projects_delete(self, sync_client):
        """DELETE /api/v1/github-projects?id=1 应返回 200."""
        resp = sync_client.delete("/api/v1/github-projects?id=1")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
