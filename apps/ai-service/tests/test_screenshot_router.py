"""app/routers/screenshot.py 单元测试:截图 + 嵌入探测端点全覆盖。

测试覆盖:
- POST /api/screenshot/take:成功 → code 0 / 服务异常 → code 1 + 截断错误消息
- POST /api/screenshot/probe:成功 → code 0 / 服务异常 → code 1
- TakeScreenshotRequest 默认值:width=1280 / height=720 / full_page=False / wait_until="load" / timeout=15000
- ProbeEmbedRequest 必填 url
- 错误消息截断(200 字符)+ 包含异常类型名

测试隔离:用 monkeypatch 替换 take_screenshot / probe_can_embed,不启动真实 Playwright。
"""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.routers import screenshot
from app.services import screenshot_service


# =============================================================================
# 辅助 fixtures
# =============================================================================


@pytest.fixture(autouse=True)
def _bypass_jwt(monkeypatch):
    """隔离 JWT 中间件:清空 jwt_secret → middleware 走跳过路径(node_env=development)。

    .env 中配置了真实 jwt_secret,JWTAuthMiddleware 会验证 token,测试无 token → 401。
    清空 jwt_secret + node_env=development 后,middleware 直接放行。
    """
    from app.core.config import settings
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")


@pytest.fixture
def mock_take_screenshot(monkeypatch):
    """mock take_screenshot,返回固定结果。

    注意:router 用 `from ..services.screenshot_service import take_screenshot` 导入,
    所以 take_screenshot 引用绑定在 app.routers.screenshot 命名空间,
    必须 patch app.routers.screenshot.take_screenshot 而非 screenshot_service.take_screenshot。
    """
    async def fake_take(url, *, width, height, full_page, wait_until, timeout):
        return {
            "screenshot": "base64data",
            "title": "Test Page",
            "url": url,
            "can_embed": False,
            "captured_at": 1700000000000,
        }
    monkeypatch.setattr(screenshot, "take_screenshot", fake_take)
    return fake_take


@pytest.fixture
def mock_probe_can_embed(monkeypatch):
    """mock probe_can_embed,返回固定结果(同样需 patch router 命名空间)。"""
    async def fake_probe(url):
        return {"url": url, "can_embed": True}
    monkeypatch.setattr(screenshot, "probe_can_embed", fake_probe)
    return fake_probe


# =============================================================================
# POST /api/screenshot/take
# =============================================================================


class TestScreenshotTake:
    """测试截图端点。"""

    async def test_returns_success_on_valid_request(self, client, mock_take_screenshot):
        # 正常请求 → code 0 + data
        resp = await client.post("/api/screenshot/take", json={"url": "https://example.com"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["message"] == "success"
        assert body["data"]["screenshot"] == "base64data"
        assert body["data"]["url"] == "https://example.com"

    async def test_passes_all_params_to_service(self, client, mock_take_screenshot):
        # 所有参数都透传到 take_screenshot
        captured = {}

        async def fake_take(url, *, width, height, full_page, wait_until, timeout):
            captured.update({
                "url": url, "width": width, "height": height,
                "full_page": full_page, "wait_until": wait_until, "timeout": timeout,
            })
            return {"screenshot": "x", "url": url}

        # 重新 patch router 命名空间的 take_screenshot
        screenshot.take_screenshot = fake_take

        resp = await client.post("/api/screenshot/take", json={
            "url": "https://test.com",
            "width": 1920,
            "height": 1080,
            "full_page": True,
            "wait_until": "networkidle",
            "timeout": 30000,
        })
        assert resp.status_code == 200
        assert captured["url"] == "https://test.com"
        assert captured["width"] == 1920
        assert captured["height"] == 1080
        assert captured["full_page"] is True
        assert captured["wait_until"] == "networkidle"
        assert captured["timeout"] == 30000

    async def test_uses_defaults_when_params_omitted(self, client, mock_take_screenshot):
        # 默认值:width=1280 / height=720 / full_page=False / wait_until="load" / timeout=15000
        captured = {}

        async def fake_take(url, *, width, height, full_page, wait_until, timeout):
            captured.update({
                "width": width, "height": height,
                "full_page": full_page, "wait_until": wait_until, "timeout": timeout,
            })
            return {"screenshot": "x"}

        # patch router 命名空间
        screenshot.take_screenshot = fake_take

        resp = await client.post("/api/screenshot/take", json={"url": "https://x.com"})
        assert resp.status_code == 200
        assert captured["width"] == 1280
        assert captured["height"] == 720
        assert captured["full_page"] is False
        assert captured["wait_until"] == "load"
        assert captured["timeout"] == 15000

    async def test_returns_422_when_url_missing(self, client, mock_take_screenshot):
        # url 必填,缺失 → 422
        resp = await client.post("/api/screenshot/take", json={})
        assert resp.status_code == 422

    async def test_returns_code_1_on_service_exception(self, client, monkeypatch):
        # take_screenshot 抛异常 → code 1 + data None(不抛 500)
        async def boom(url, **kwargs):
            raise RuntimeError("playwright failed")
        monkeypatch.setattr(screenshot, "take_screenshot", boom)

        resp = await client.post("/api/screenshot/take", json={"url": "https://x.com"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 1
        assert body["data"] is None
        assert "截图失败" in body["message"]
        assert "RuntimeError" in body["message"]
        assert "playwright failed" in body["message"]

    async def test_error_message_includes_exception_type(self, client, monkeypatch):
        # 错误消息含异常类型名 + 异常消息
        async def boom(url, **kwargs):
            raise ValueError("invalid url format")
        monkeypatch.setattr(screenshot, "take_screenshot", boom)

        resp = await client.post("/api/screenshot/take", json={"url": "x"})
        body = resp.json()
        assert "ValueError" in body["message"]
        assert "invalid url format" in body["message"]

    async def test_error_message_truncated_to_200_chars(self, client, monkeypatch):
        # 错误消息超过 200 字符时被截断(str(e)[:200])
        long_msg = "x" * 500
        async def boom(url, **kwargs):
            raise RuntimeError(long_msg)
        monkeypatch.setattr(screenshot, "take_screenshot", boom)

        resp = await client.post("/api/screenshot/take", json={"url": "x"})
        body = resp.json()
        # message 含前缀 "截图失败: RuntimeError: " + 截断后的 500 字符
        # str(e)[:200] 限制 200 字符,所以 500 个 x 会被截断
        msg = body["message"]
        # 检查 x 的数量不超过 200(可能被截断为正好 200)
        x_count = msg.count("x")
        assert x_count <= 200


# =============================================================================
# POST /api/screenshot/probe
# =============================================================================


class TestScreenshotProbe:
    """测试嵌入探测端点。"""

    async def test_returns_success_on_valid_request(self, client, mock_probe_can_embed):
        # 正常请求 → code 0 + data
        resp = await client.post("/api/screenshot/probe", json={"url": "https://example.com"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["message"] == "success"
        assert body["data"]["url"] == "https://example.com"
        assert body["data"]["can_embed"] is True

    async def test_returns_422_when_url_missing(self, client, mock_probe_can_embed):
        # url 必填 → 422
        resp = await client.post("/api/screenshot/probe", json={})
        assert resp.status_code == 422

    async def test_returns_code_1_on_service_exception(self, client, monkeypatch):
        # probe_can_embed 抛异常 → code 1
        async def boom(url):
            raise ConnectionError("network unreachable")
        monkeypatch.setattr(screenshot, "probe_can_embed", boom)

        resp = await client.post("/api/screenshot/probe", json={"url": "https://x.com"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 1
        assert body["data"] is None
        assert "探测失败" in body["message"]
        assert "ConnectionError" in body["message"]
        assert "network unreachable" in body["message"]

    async def test_error_message_truncated_to_200_chars(self, client, monkeypatch):
        # 错误消息截断
        long_msg = "y" * 600
        async def boom(url):
            raise RuntimeError(long_msg)
        monkeypatch.setattr(screenshot, "probe_can_embed", boom)

        resp = await client.post("/api/screenshot/probe", json={"url": "x"})
        body = resp.json()
        y_count = body["message"].count("y")
        assert y_count <= 200


# =============================================================================
# 请求模型字段约束
# =============================================================================


class TestRequestModels:
    """测试请求模型字段定义。"""

    def test_take_screenshot_request_defaults(self):
        # TakeScreenshotRequest 默认值
        req = screenshot.TakeScreenshotRequest(url="https://x.com")
        assert req.width == 1280
        assert req.height == 720
        assert req.full_page is False
        assert req.wait_until == "load"
        assert req.timeout == 15000

    def test_take_screenshot_request_requires_url(self):
        # url 必填
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            screenshot.TakeScreenshotRequest()

    def test_probe_embed_request_requires_url(self):
        # url 必填
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            screenshot.ProbeEmbedRequest()
