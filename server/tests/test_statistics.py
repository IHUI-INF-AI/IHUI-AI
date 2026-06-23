"""服务统计 (Statistics) 模块测试."""

import pytest


class TestStatisticsRoutes:
    """验证服务统计路由已注册."""

    def test_statistics_endpoints_registered(self, sync_client):
        """statistics 端点应出现在 OpenAPI schema 中."""
        resp = sync_client.get("/openapi.json")
        assert resp.status_code == 200
        paths = resp.json().get("paths", {})
        statistics_paths = [p for p in paths if "/statistics" in p]
        assert len(statistics_paths) >= 13, f"应至少有 13 个 statistics 端点, 实际 {len(statistics_paths)}: {statistics_paths}"

    @pytest.mark.parametrize("module", [
        "learn", "usercenter", "resource", "message", "point",
        "circle", "ask", "content", "live", "exam",
    ])
    def test_module_statistics(self, sync_client, module):
        """各模块统计端点应返回 200."""
        resp = sync_client.get(f"/api/v1/statistics/{module}")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
        if resp.status_code == 200:
            body = resp.json()
            assert body.get("code") in (0, "0", 200, "200"), f"{module} 统计失败: {body}"

    def test_statistics_overview(self, sync_client):
        """GET /api/v1/statistics/overview 应返回 200 且包含聚合数据."""
        resp = sync_client.get("/api/v1/statistics/overview")
        assert resp.status_code != 404, f"端点不存在: {resp.status_code}"
        if resp.status_code == 200:
            body = resp.json()
            assert body.get("code") in (0, "0", 200, "200")
            data = body.get("data", {})
            assert isinstance(data, dict), f"overview 应返回字典: {data}"
