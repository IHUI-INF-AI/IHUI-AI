"""截图路由测试(app/routers/screenshot.py + app/services/screenshot_service.py)。

测试覆盖:
1. 截图参数校验(URL 必填、width/height 类型校验、wait_until 取值)
2. 截图成功路径(mock take_screenshot 返回完整 dict)
3. 截图超时处理(mock take_screenshot 抛 TimeoutError → code=1)
4. Playwright 未安装时的降级处理(mock take_screenshot 抛 RuntimeError → code=1)
5. 截图格式选项(返回 data 字段含 screenshot/title/url/can_embed/captured_at)
6. probe_can_embed 端点(mock 返回 can_embed=True/False)
7. _check_headers_can_embed 头部判定逻辑(X-Frame-Options / CSP frame-ancestors)

设计:
- 不真实启动 Playwright/Chromium。
- 路由层测试用 httpx ASGITransport client + monkeypatch 拦截 take_screenshot / probe_can_embed。
- 服务层 _check_headers_can_embed 是纯函数,直接断言。
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.services.screenshot_service import _check_headers_can_embed


# =============================================================================
# 覆盖 conftest.py 中引用已废弃属性的 _isolate_vector_memory fixture。
# VectorMemoryStore 用 _entries / _vectors 而非 _store,_next_id 已移除。
# =============================================================================


@pytest.fixture(autouse=True)
def _isolate_vector_memory(monkeypatch: pytest.MonkeyPatch):
    """覆盖 conftest 中 broken 的同名 fixture(引用了不存在的 _store / _next_id)。
    同时清空 jwt_secret,让 JWT 中间件在 development 模式跳过认证(HTTP 测试需要)。
    """
    from app.core.config import settings
    from app.services.vector_memory import vector_memory

    monkeypatch.setattr(settings, "jwt_secret", "")
    vector_memory._use_redis = False
    vector_memory._redis = None
    vector_memory._entries.clear()
    vector_memory._vectors.clear()
    yield
    vector_memory._use_redis = False
    vector_memory._redis = None
    vector_memory._entries.clear()
    vector_memory._vectors.clear()


# =============================================================================
# 1. 参数校验(URL 必填 / width/height 类型 / wait_until 取值)
# =============================================================================


async def test_screenshot_take_missing_url_returns_422(client) -> None:
    """POST /api/screenshot/take 缺少 url 字段 → Pydantic 422。"""
    resp = await client.post(
        "/api/screenshot/take",
        json={"width": 1280, "height": 720},
    )
    assert resp.status_code == 422
    # Pydantic 错误响应应提到 url
    body = resp.json()
    assert "detail" in body
    assert any("url" in str(d) for d in body["detail"])


async def test_screenshot_take_invalid_width_type_returns_422(client) -> None:
    """POST /api/screenshot/take width 传字符串 → Pydantic 422。"""
    resp = await client.post(
        "/api/screenshot/take",
        json={"url": "https://example.com", "width": "not-an-int"},
    )
    assert resp.status_code == 422


async def test_screenshot_take_invalid_height_type_returns_422(client) -> None:
    """POST /api/screenshot/take height 传字符串 → Pydantic 422。"""
    resp = await client.post(
        "/api/screenshot/take",
        json={"url": "https://example.com", "height": "bad"},
    )
    assert resp.status_code == 422


async def test_screenshot_take_uses_defaults_when_omitted(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """POST /api/screenshot/take 仅传 url → 默认 width=1280 / height=720 / full_page=False。"""
    captured_kwargs: dict[str, Any] = {}

    async def _fake_take(url, *, width, height, full_page, wait_until, timeout):
        captured_kwargs.update(
            url=url, width=width, height=height,
            full_page=full_page, wait_until=wait_until, timeout=timeout,
        )
        return {"screenshot": "abc", "title": url, "url": url, "can_embed": True}

    # 路由层 from ..services.screenshot_service import take_screenshot
    monkeypatch.setattr("app.routers.screenshot.take_screenshot", _fake_take)

    resp = await client.post(
        "/api/screenshot/take",
        json={"url": "https://example.com"},
    )
    assert resp.status_code == 200
    assert captured_kwargs["width"] == 1280
    assert captured_kwargs["height"] == 720
    assert captured_kwargs["full_page"] is False
    assert captured_kwargs["wait_until"] == "load"
    assert captured_kwargs["timeout"] == 15000


async def test_screenshot_take_passes_custom_params(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """POST /api/screenshot/take 透传自定义 width/height/full_page/wait_until/timeout。"""
    captured: dict[str, Any] = {}

    async def _fake_take(url, *, width, height, full_page, wait_until, timeout):
        captured.update(
            url=url, width=width, height=height,
            full_page=full_page, wait_until=wait_until, timeout=timeout,
        )
        return {"screenshot": "x", "title": url, "url": url, "can_embed": False}

    monkeypatch.setattr("app.routers.screenshot.take_screenshot", _fake_take)

    resp = await client.post(
        "/api/screenshot/take",
        json={
            "url": "https://example.com/page",
            "width": 1920,
            "height": 1080,
            "full_page": True,
            "wait_until": "networkidle",
            "timeout": 5000,
        },
    )
    assert resp.status_code == 200
    assert captured["width"] == 1920
    assert captured["height"] == 1080
    assert captured["full_page"] is True
    assert captured["wait_until"] == "networkidle"
    assert captured["timeout"] == 5000


# =============================================================================
# 2. 截图成功路径 + 返回值字段完整性
# =============================================================================


async def test_screenshot_take_success_returns_code_0(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """POST /api/screenshot/take mock 截图成功 → code=0 + data 含完整字段。"""
    expected_data = {
        "screenshot": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "title": "Example Domain",
        "url": "https://example.com/",
        "can_embed": True,
        "captured_at": 1700000000000,
    }

    async def _fake_take(url, **kwargs):
        return expected_data

    monkeypatch.setattr("app.routers.screenshot.take_screenshot", _fake_take)

    resp = await client.post(
        "/api/screenshot/take",
        json={"url": "https://example.com"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["message"] == "success"
    assert body["data"] == expected_data
    # 关键字段齐全
    assert "screenshot" in body["data"]
    assert "title" in body["data"]
    assert "url" in body["data"]
    assert "can_embed" in body["data"]
    assert "captured_at" in body["data"]


async def test_screenshot_take_full_page_flag_routes_correctly(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """full_page=True 时调用 take_screenshot 收到 full_page=True。"""
    captured: dict[str, Any] = {}

    async def _fake_take(url, *, width, height, full_page, wait_until, timeout):
        captured["full_page"] = full_page
        return {"screenshot": "x", "title": url, "url": url, "can_embed": True}

    monkeypatch.setattr("app.routers.screenshot.take_screenshot", _fake_take)

    resp = await client.post(
        "/api/screenshot/take",
        json={"url": "https://example.com", "full_page": True},
    )
    assert resp.status_code == 200
    assert captured["full_page"] is True


# =============================================================================
# 3. 截图超时处理
# =============================================================================


async def test_screenshot_take_timeout_returns_code_1(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """take_screenshot 抛 TimeoutError → 路由返回 code=1 + message 含 'Timeout'。"""
    async def _fake_take(url, **kwargs):
        raise TimeoutError("page.goto timeout 5000ms exceeded")

    monkeypatch.setattr("app.routers.screenshot.take_screenshot", _fake_take)

    resp = await client.post(
        "/api/screenshot/take",
        json={"url": "https://slow.example.com", "timeout": 100},
    )
    assert resp.status_code == 200  # 路由捕获异常返回 200 + code=1
    body = resp.json()
    assert body["code"] == 1
    assert body["data"] is None
    # message 应包含异常类型名 + 截图失败前缀
    assert "截图失败" in body["message"]
    assert "TimeoutError" in body["message"]


async def test_screenshot_take_asyncio_timeout_returns_code_1(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """take_screenshot 抛 asyncio.TimeoutError → 路由返回 code=1。"""
    import asyncio as _asyncio

    async def _fake_take(url, **kwargs):
        raise _asyncio.TimeoutError()

    monkeypatch.setattr("app.routers.screenshot.take_screenshot", _fake_take)

    resp = await client.post(
        "/api/screenshot/take",
        json={"url": "https://example.com"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 1
    assert body["data"] is None


# =============================================================================
# 4. Playwright 未安装时的降级处理
# =============================================================================


async def test_screenshot_take_playwright_not_installed_returns_code_1(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """take_screenshot 抛 RuntimeError(Playwright 未安装)→ 路由返回 code=1,不崩溃。"""
    async def _fake_take(url, **kwargs):
        raise RuntimeError(
            "Playwright 未安装。请在 ai-service 目录执行: "
            "pip install playwright && playwright install chromium"
        )

    monkeypatch.setattr("app.routers.screenshot.take_screenshot", _fake_take)

    resp = await client.post(
        "/api/screenshot/take",
        json={"url": "https://example.com"},
    )
    assert resp.status_code == 200  # 路由捕获异常,不抛 500
    body = resp.json()
    assert body["code"] == 1
    assert body["data"] is None
    assert "截图失败" in body["message"]
    assert "RuntimeError" in body["message"]
    # message 截断到 200 字符以内(避免长错误信息泄漏)
    assert len(body["message"]) <= 250


async def test_screenshot_take_generic_exception_returns_code_1(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """take_screenshot 抛任意异常 → 路由返回 code=1,不崩溃。"""
    async def _fake_take(url, **kwargs):
        raise ValueError("something went wrong")

    monkeypatch.setattr("app.routers.screenshot.take_screenshot", _fake_take)

    resp = await client.post(
        "/api/screenshot/take",
        json={"url": "https://example.com"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 1
    assert "ValueError" in body["message"]


# =============================================================================
# 5. probe_can_embed 端点
# =============================================================================


async def test_screenshot_probe_can_embed_true(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """POST /api/screenshot/probe mock 返回 can_embed=True → code=0。"""
    async def _fake_probe(url):
        return {"url": url, "can_embed": True}

    monkeypatch.setattr("app.routers.screenshot.probe_can_embed", _fake_probe)

    resp = await client.post(
        "/api/screenshot/probe",
        json={"url": "https://embeddable.example.com"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["can_embed"] is True
    assert body["data"]["url"] == "https://embeddable.example.com"


async def test_screenshot_probe_can_embed_false(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """POST /api/screenshot/probe mock 返回 can_embed=False → code=0(成功探测,只是不可嵌入)。"""
    async def _fake_probe(url):
        return {"url": url, "can_embed": False}

    monkeypatch.setattr("app.routers.screenshot.probe_can_embed", _fake_probe)

    resp = await client.post(
        "/api/screenshot/probe",
        json={"url": "https://x-frame-deny.example.com"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["can_embed"] is False


async def test_screenshot_probe_missing_url_returns_422(client) -> None:
    """POST /api/screenshot/probe 缺 url → 422。"""
    resp = await client.post("/api/screenshot/probe", json={})
    assert resp.status_code == 422


async def test_screenshot_probe_exception_returns_code_1(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """probe_can_embed 抛异常 → 路由返回 code=1。"""
    async def _fake_probe(url):
        raise RuntimeError("network error")

    monkeypatch.setattr("app.routers.screenshot.probe_can_embed", _fake_probe)

    resp = await client.post(
        "/api/screenshot/probe",
        json={"url": "https://broken.example.com"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 1
    assert "探测失败" in body["message"]


# =============================================================================
# 6. _check_headers_can_embed 头部判定逻辑(纯函数,直接断言)
# =============================================================================


def test_check_headers_no_restrictions_returns_true() -> None:
    """无 X-Frame-Options / CSP → 可嵌入。"""
    assert _check_headers_can_embed({}) is True
    assert _check_headers_can_embed({"content-type": "text/html"}) is True


def test_check_headers_x_frame_options_deny_returns_false() -> None:
    """X-Frame-Options: DENY → 不可嵌入。"""
    assert _check_headers_can_embed({"x-frame-options": "DENY"}) is False


def test_check_headers_x_frame_options_sameorigin_returns_false() -> None:
    """X-Frame-Options: SAMEORIGIN → 不可嵌入(跨域)。"""
    assert _check_headers_can_embed({"x-frame-options": "SAMEORIGIN"}) is False


def test_check_headers_x_frame_options_allowall_returns_true() -> None:
    """X-Frame-Options: ALLOWALL(非标准但有些站点用)→ 可嵌入。"""
    assert _check_headers_can_embed({"x-frame-options": "ALLOWALL"}) is True


def test_check_headers_x_frame_options_case_insensitive() -> None:
    """X-Frame-Options 取值大小写不敏感。"""
    assert _check_headers_can_embed({"x-frame-options": "deny"}) is False
    assert _check_headers_can_embed({"x-frame-options": "Sameorigin"}) is False


def test_check_headers_csp_frame_ancestors_none_returns_false() -> None:
    """CSP frame-ancestors 'none' → 不可嵌入。"""
    assert _check_headers_can_embed(
        {"content-security-policy": "frame-ancestors 'none'"}
    ) is False


def test_check_headers_csp_frame_ancestors_self_returns_false() -> None:
    """CSP frame-ancestors 'self' → 不可嵌入(跨域)。"""
    assert _check_headers_can_embed(
        {"content-security-policy": "frame-ancestors 'self'"}
    ) is False


def test_check_headers_csp_frame_ancestors_wildcard_returns_true() -> None:
    """CSP frame-ancestors * → 可嵌入。"""
    assert _check_headers_can_embed(
        {"content-security-policy": "frame-ancestors *"}
    ) is True


def test_check_headers_csp_without_frame_ancestors_returns_true() -> None:
    """CSP 不含 frame-ancestors → 不影响嵌入判定。"""
    assert _check_headers_can_embed(
        {"content-security-policy": "default-src 'self'"}
    ) is True


def test_check_headers_both_xfo_and_csp_returns_false() -> None:
    """同时有 X-Frame-Options + CSP frame-ancestors → 任一限制即不可嵌入。"""
    assert _check_headers_can_embed(
        {
            "x-frame-options": "DENY",
            "content-security-policy": "frame-ancestors 'self'",
        }
    ) is False


# =============================================================================
# 7. mock page.screenshot 返回值验证(通过 mock _take_screenshot_sync)
# =============================================================================


@pytest.mark.asyncio
async def test_take_screenshot_async_wrapper_returns_sync_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """take_screenshot async wrapper 把 _take_screenshot_sync 的返回值透传出来。"""
    import app.services.screenshot_service as svc

    expected = {
        "screenshot": "base64data",
        "title": "Test Page",
        "url": "https://test.example.com",
        "can_embed": True,
        "captured_at": 1700000000000,
    }

    def _fake_sync(url, width, height, full_page, wait_until, timeout):
        return expected

    monkeypatch.setattr(svc, "_take_screenshot_sync", _fake_sync)

    result = await svc.take_screenshot(
        "https://test.example.com",
        width=1280,
        height=720,
        full_page=False,
        wait_until="load",
        timeout=15000,
    )
    assert result == expected
    assert result["screenshot"] == "base64data"
    assert result["can_embed"] is True


@pytest.mark.asyncio
async def test_probe_can_embed_async_wrapper_returns_sync_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """probe_can_embed async wrapper 透传 _probe_can_embed_sync 结果。"""
    import app.services.screenshot_service as svc

    expected = {"url": "https://x.example.com", "can_embed": False}

    def _fake_probe_sync(url):
        return expected

    monkeypatch.setattr(svc, "_probe_can_embed_sync", _fake_probe_sync)

    result = await svc.probe_can_embed("https://x.example.com")
    assert result == expected
    assert result["can_embed"] is False


@pytest.mark.asyncio
async def test_take_screenshot_propagates_sync_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """_take_screenshot_sync 抛异常时,take_screenshot async wrapper 透传异常。"""
    import app.services.screenshot_service as svc

    def _fake_sync(url, width, height, full_page, wait_until, timeout):
        raise RuntimeError("playwright not installed")

    monkeypatch.setattr(svc, "_take_screenshot_sync", _fake_sync)

    with pytest.raises(RuntimeError, match="playwright not installed"):
        await svc.take_screenshot("https://example.com")


# =============================================================================
# 8. _get_browser_sync Playwright 未安装降级(直接调用纯逻辑)
# =============================================================================


def test_get_browser_sync_raises_when_playwright_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """_get_browser_sync 在 playwright 模块不可导入时抛 RuntimeError,提示安装命令。"""
    import builtins

    import app.services.screenshot_service as svc

    # 重置单例
    monkeypatch.setattr(svc, "_browser", None)
    monkeypatch.setattr(svc, "_playwright", None)

    # 让 import playwright.sync_api 抛 ImportError
    real_import = builtins.__import__

    def _fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "playwright.sync_api" or (
            name == "playwright" and fromlist and "sync_api" in fromlist
        ):
            raise ImportError("No module named 'playwright'")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", _fake_import)

    with pytest.raises(RuntimeError, match="Playwright 未安装"):
        svc._get_browser_sync()
