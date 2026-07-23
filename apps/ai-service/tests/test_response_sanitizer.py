"""response_sanitizer.py 单元测试:响应脱敏中间件。

测试覆盖:
- _is_sensitive_key:敏感字段识别(子串匹配 / 大小写不敏感 / 边界)
- _sanitize_response:递归脱敏(嵌套 dict / list / 标量 / 不变原对象 / 任意类型值)
- ResponseSanitizerMiddleware:HTTP 行为(2xx 脱敏 / 非 2xx 放行 / SSE 跳过 / skip 标志 / 空 body / header 保留)
- setup 函数:中间件注册
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from starlette.applications import Starlette
from starlette.responses import JSONResponse, Response, StreamingResponse

from app.middleware.response_sanitizer import (
    MASK,
    SENSITIVE_KEYS,
    ResponseSanitizerMiddleware,
    _is_sensitive_key,
    _sanitize_response,
    setup_response_sanitizer_middleware,
)


# =============================================================================
# _is_sensitive_key — 敏感字段识别
# =============================================================================


def test_is_sensitive_key_api_key():
    assert _is_sensitive_key("api_key") is True


def test_is_sensitive_key_password_substring():
    """passwordHash 命中 'password' 子串。"""
    assert _is_sensitive_key("passwordHash") is True


def test_is_sensitive_key_token_substring():
    """refreshToken 命中 'token' 子串。"""
    assert _is_sensitive_key("refreshToken") is True


def test_is_sensitive_key_case_insensitive():
    assert _is_sensitive_key("API_KEY") is True
    assert _is_sensitive_key("Password") is True


def test_is_sensitive_key_secret():
    assert _is_sensitive_key("client_secret") is True


def test_is_sensitive_key_twofactorsecret():
    assert _is_sensitive_key("twoFactorSecret") is True


def test_is_sensitive_key_safe_key_returns_false():
    assert _is_sensitive_key("username") is False
    assert _is_sensitive_key("email") is False


def test_is_sensitive_key_empty_string_returns_false():
    assert _is_sensitive_key("") is False


def test_is_sensitive_key_camelcase_apikey_not_matched():
    """'ApiKey'.lower()='apikey' 不含 'api_key'(缺下划线)→ 不命中(设计行为)。"""
    assert _is_sensitive_key("ApiKey") is False


# =============================================================================
# _sanitize_response — 递归脱敏
# =============================================================================


def test_sanitize_flat_dict_masks_sensitive():
    data = {"name": "alice", "api_key": "sk-123"}
    result = _sanitize_response(data)
    assert result["api_key"] == MASK
    assert result["name"] == "alice"


def test_sanitize_nested_dict_masks_sensitive():
    data = {"user": {"name": "bob", "password": "hidden", "safe": "ok"}}
    result = _sanitize_response(data)
    assert result["user"]["password"] == MASK
    assert result["user"]["name"] == "bob"
    assert result["user"]["safe"] == "ok"


def test_sanitize_list_of_dicts_masks_sensitive():
    data = [{"token": "tok1"}, {"token": "tok2", "name": "item"}]
    result = _sanitize_response(data)
    assert result[0]["token"] == MASK
    assert result[1]["token"] == MASK
    assert result[1]["name"] == "item"


def test_sanitize_deeply_nested_dict():
    data = {"a": {"b": {"c": {"secret": "hidden"}}}}
    result = _sanitize_response(data)
    assert result["a"]["b"]["c"]["secret"] == MASK


def test_sanitize_preserves_scalar_values():
    assert _sanitize_response("plain string") == "plain string"
    assert _sanitize_response(42) == 42
    assert _sanitize_response(3.14) == 3.14
    assert _sanitize_response(None) is None
    assert _sanitize_response(True) is True


def test_sanitize_does_not_mutate_original():
    data = {"api_key": "sk-123", "nested": {"token": "tok"}}
    original = {"api_key": "sk-123", "nested": {"token": "tok"}}
    _sanitize_response(data)
    assert data == original


def test_sanitize_masks_value_regardless_of_type():
    """敏感字段的值无论类型(字符串/数字/对象/数组)都替换为 ***。"""
    data = {
        "password": "string",
        "token": 12345,
        "secret": {"nested": "dict"},
        "api_key": ["a", "b"],
    }
    result = _sanitize_response(data)
    assert result["password"] == MASK
    assert result["token"] == MASK
    assert result["secret"] == MASK
    assert result["api_key"] == MASK


def test_sanitize_no_sensitive_fields_returns_equal():
    data = {"a": 1, "b": "hello", "c": [1, 2, 3], "d": {"e": "f"}}
    result = _sanitize_response(data)
    assert result == data


def test_sanitize_empty_structures():
    assert _sanitize_response({}) == {}
    assert _sanitize_response([]) == []


def test_sanitize_mask_constant_value():
    assert MASK == "***"


# =============================================================================
# ResponseSanitizerMiddleware — HTTP 行为(async httpx + ASGITransport)
# =============================================================================


def _make_response_sanitizer_app() -> Starlette:
    app = Starlette()

    async def json_endpoint(request):
        return JSONResponse({
            "user": "alice",
            "api_key": "sk-secret-123",
            "nested": {"password": "hidden", "safe": "ok"},
            "items": [{"token": "tok-abc", "name": "item1"}],
        })

    async def error_endpoint(request):
        return JSONResponse({"error": "bad", "api_key": "leaked"}, status_code=500)

    async def sse_endpoint(request):
        async def gen():
            yield b'data: {"api_key": "leaked"}\n\n'

        return StreamingResponse(gen(), media_type="text/event-stream")

    async def skip_endpoint(request):
        request.state.skip_response_sanitization = True
        return JSONResponse({"api_key": "sk-not-masked"})

    async def empty_endpoint(request):
        return Response(content=b"", status_code=200, media_type="application/json")

    async def header_endpoint(request):
        resp = JSONResponse({"api_key": "sk"})
        resp.headers["X-Custom"] = "kept"
        return resp

    app.add_route("/json", json_endpoint, methods=["GET"])
    app.add_route("/error", error_endpoint, methods=["GET"])
    app.add_route("/sse", sse_endpoint, methods=["GET"])
    app.add_route("/skip", skip_endpoint, methods=["GET"])
    app.add_route("/empty", empty_endpoint, methods=["GET"])
    app.add_route("/header", header_endpoint, methods=["GET"])
    app.add_middleware(ResponseSanitizerMiddleware)
    return app


async def test_middleware_masks_sensitive_fields_in_json():
    app = _make_response_sanitizer_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/json")
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"] == "alice"
    assert body["api_key"] == MASK
    assert body["nested"]["password"] == MASK
    assert body["nested"]["safe"] == "ok"
    assert body["items"][0]["token"] == MASK
    assert body["items"][0]["name"] == "item1"


async def test_middleware_passes_non_2xx_unmasked():
    app = _make_response_sanitizer_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/error")
    assert resp.status_code == 500
    body = resp.json()
    assert body["error"] == "bad"
    assert body["api_key"] == "leaked"  # 非 2xx 不脱敏


async def test_middleware_skips_sse_response():
    app = _make_response_sanitizer_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/sse")
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers.get("content-type", "")
    # SSE body 不被 JSON 解析/脱敏,api_key 原样保留
    assert b"api_key" in resp.content


async def test_middleware_skips_when_flag_set():
    app = _make_response_sanitizer_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/skip")
    assert resp.status_code == 200
    assert resp.json()["api_key"] == "sk-not-masked"


async def test_middleware_handles_empty_body():
    app = _make_response_sanitizer_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/empty")
    assert resp.status_code == 200
    assert resp.content == b""


async def test_middleware_preserves_custom_headers():
    app = _make_response_sanitizer_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/header")
    assert resp.status_code == 200
    assert resp.headers["x-custom"] == "kept"
    assert resp.json()["api_key"] == MASK


async def test_middleware_updates_content_length_after_mask():
    """脱敏后 body 长度变化,content-length 应反映新 body。"""
    app = _make_response_sanitizer_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/json")
    new_len = int(resp.headers.get("content-length", "0"))
    assert new_len > 0
    assert new_len == len(resp.content)


# =============================================================================
# setup 函数 + 常量
# =============================================================================


def test_setup_response_sanitizer_middleware_registers():
    app = Starlette()
    setup_response_sanitizer_middleware(app)
    assert len(app.user_middleware) >= 1


def test_sensitive_keys_set_contents():
    assert "api_key" in SENSITIVE_KEYS
    assert "secret" in SENSITIVE_KEYS
    assert "token" in SENSITIVE_KEYS
    assert "password" in SENSITIVE_KEYS
    assert "twofactorsecret" in SENSITIVE_KEYS
