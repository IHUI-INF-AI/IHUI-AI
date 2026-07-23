"""base_provider.py 单元测试:厂商适配器基类。

测试覆盖:
- ProviderError 异常:status_code 默认值 / 自定义值 / message
- BaseProvider 是 ABC:不可直接实例化
- 子类实例化:__init__ 存储 api_key / api_base / timeout
- 抽象方法:complete / astream 必须实现,未实现时 TypeError
- list_models 默认返回空列表
- _request:成功返回 json / 4xx 抛 ProviderError / httpx 异常抛 ProviderError
- _strip_prefix:有前缀 / 无前缀 / 多段
"""

from __future__ import annotations

from typing import Any, AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.providers.base_provider import BaseProvider, ProviderError


# =============================================================================
# 测试用具体子类
# =============================================================================


class _FakeProvider(BaseProvider):
    """最小可实例化子类(实现 complete / astream)。"""

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        return {"content": "ok", "model": model}

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        yield {"type": "chunk", "content": "x"}


class _IncompleteProvider(BaseProvider):
    """未实现抽象方法的子类(用于测试 ABC 阻断)。"""
    pass  # type: ignore[abstract]


# =============================================================================
# ProviderError
# =============================================================================


def test_provider_error_default_status_code():
    """ProviderError 默认 status_code=502。"""
    e = ProviderError("boom")
    assert str(e) == "boom"
    assert e.status_code == 502


def test_provider_error_custom_status_code():
    """ProviderError 可自定义 status_code。"""
    e = ProviderError("not found", status_code=404)
    assert e.status_code == 404


def test_provider_error_is_exception():
    """ProviderError 应为 Exception 子类。"""
    e = ProviderError("x")
    assert isinstance(e, Exception)


def test_provider_error_can_be_raised():
    """ProviderError 可被 raise + try/except 捕获。"""
    with pytest.raises(ProviderError, match="boom"):
        raise ProviderError("boom")


# =============================================================================
# BaseProvider ABC
# =============================================================================


def test_base_provider_is_abstract():
    """BaseProvider 是 ABC,不能直接实例化。"""
    with pytest.raises(TypeError, match="abstract"):
        BaseProvider(api_key="sk-x")  # type: ignore[abstract]


def test_incomplete_subclass_still_abstract():
    """未实现 complete/astream 的子类仍不能实例化。"""
    with pytest.raises(TypeError):
        _IncompleteProvider(api_key="sk-x")  # type: ignore[abstract]


def test_complete_subclass_instantiable():
    """实现了 complete/astream 的子类可实例化。"""
    p = _FakeProvider(api_key="sk-x")
    assert isinstance(p, BaseProvider)


# =============================================================================
# __init__ 字段存储
# =============================================================================


def test_init_stores_api_key():
    """__init__ 存储 api_key。"""
    p = _FakeProvider(api_key="sk-secret")
    assert p.api_key == "sk-secret"


def test_init_stores_api_base():
    """__init__ 存储 api_base。"""
    p = _FakeProvider(api_key="k", api_base="http://api.example.com")
    assert p.api_base == "http://api.example.com"


def test_init_api_base_default_none():
    """api_base 默认 None。"""
    p = _FakeProvider(api_key="k")
    assert p.api_base is None


def test_init_stores_timeout():
    """__init__ 存储 timeout。"""
    p = _FakeProvider(api_key="k", timeout=120.0)
    assert p.timeout == 120.0


def test_init_timeout_default_60():
    """timeout 默认 60.0。"""
    p = _FakeProvider(api_key="k")
    assert p.timeout == 60.0


# =============================================================================
# list_models 默认实现
# =============================================================================


async def test_list_models_default_empty():
    """list_models 默认返回空列表。"""
    p = _FakeProvider(api_key="k")
    result = await p.list_models()
    assert result == []


# =============================================================================
# complete / astream(子类实现)
# =============================================================================


async def test_complete_returns_dict():
    """子类 complete 应返回 dict。"""
    p = _FakeProvider(api_key="k")
    result = await p.complete([{"role": "user", "content": "hi"}], "gpt-4")
    assert result["content"] == "ok"
    assert result["model"] == "gpt-4"


async def test_astream_yields_chunks():
    """子类 astream 应 yield chunk。"""
    p = _FakeProvider(api_key="k")
    chunks = []
    async for chunk in p.astream([{"role": "user", "content": "hi"}], "gpt-4"):
        chunks.append(chunk)
    assert len(chunks) == 1
    assert chunks[0]["type"] == "chunk"


# =============================================================================
# _strip_prefix
# =============================================================================


def test_strip_prefix_with_vendor_prefix():
    """stepfun/xxx → xxx。"""
    p = _FakeProvider(api_key="k")
    assert p._strip_prefix("stepfun/step-3.7-flash") == "step-3.7-flash"


def test_strip_prefix_without_prefix():
    """无 '/' 时原样返回。"""
    p = _FakeProvider(api_key="k")
    assert p._strip_prefix("gpt-4") == "gpt-4"


def test_strip_prefix_multiple_slashes():
    """多个 '/' 时只切第一段(split('/', 1))。"""
    p = _FakeProvider(api_key="k")
    assert p._strip_prefix("openai/gpt-4/mini") == "gpt-4/mini"


def test_strip_prefix_empty_string():
    """空字符串原样返回。"""
    p = _FakeProvider(api_key="k")
    assert p._strip_prefix("") == ""


# =============================================================================
# _request 成功路径
# =============================================================================


async def test_request_success_returns_json():
    """_request 成功时返回 resp.json()。"""
    p = _FakeProvider(api_key="k")

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = {"ok": True, "data": "x"}

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with patch("app.providers.base_provider.get_http_client", return_value=fake_client):
        result = await p._request("POST", "http://api/x", json={"q": 1})

    assert result == {"ok": True, "data": "x"}
    fake_client.request.assert_awaited_once()
    args, kwargs = fake_client.request.call_args
    assert args[0] == "POST"
    assert args[1] == "http://api/x"
    assert kwargs["json"] == {"q": 1}


async def test_request_passes_headers():
    """_request 透传 headers 参数。"""
    p = _FakeProvider(api_key="k")

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = {}

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with patch("app.providers.base_provider.get_http_client", return_value=fake_client):
        await p._request("GET", "http://api/x", headers={"Authorization": "Bearer t"})

    _, kwargs = fake_client.request.call_args
    assert kwargs["headers"] == {"Authorization": "Bearer t"}


async def test_request_passes_timeout():
    """_request 透传 self.timeout。"""
    p = _FakeProvider(api_key="k", timeout=42.0)

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = {}

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with patch("app.providers.base_provider.get_http_client", return_value=fake_client):
        await p._request("GET", "http://api/x")

    _, kwargs = fake_client.request.call_args
    assert kwargs["timeout"] == 42.0


# =============================================================================
# _request 异常路径
# =============================================================================


async def test_request_4xx_raises_provider_error():
    """4xx 响应应抛 ProviderError,含状态码。"""
    p = _FakeProvider(api_key="k")

    fake_resp = MagicMock()
    fake_resp.status_code = 401
    fake_resp.json.return_value = {"error": "unauthorized"}

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with patch("app.providers.base_provider.get_http_client", return_value=fake_client):
        with pytest.raises(ProviderError) as exc_info:
            await p._request("POST", "http://api/x")

    assert exc_info.value.status_code == 401
    assert "401" in str(exc_info.value)


async def test_request_5xx_raises_provider_error():
    """5xx 响应应抛 ProviderError。"""
    p = _FakeProvider(api_key="k")

    fake_resp = MagicMock()
    fake_resp.status_code = 500
    fake_resp.json.return_value = {"error": "server error"}

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with patch("app.providers.base_provider.get_http_client", return_value=fake_client):
        with pytest.raises(ProviderError) as exc_info:
            await p._request("POST", "http://api/x")

    assert exc_info.value.status_code == 500


async def test_request_3xx_does_not_raise():
    """3xx 响应(<400)不抛 ProviderError。"""
    p = _FakeProvider(api_key="k")

    fake_resp = MagicMock()
    fake_resp.status_code = 302
    fake_resp.json.return_value = {"redirect": "x"}

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with patch("app.providers.base_provider.get_http_client", return_value=fake_client):
        result = await p._request("GET", "http://api/x")
    assert result == {"redirect": "x"}


async def test_request_httpx_error_raises_provider_error():
    """httpx.HTTPError 应被捕获并转为 ProviderError(含 '网络异常')。"""
    p = _FakeProvider(api_key="k")

    fake_client = MagicMock()
    fake_client.request = AsyncMock(side_effect=httpx.ConnectError("conn refused"))

    with patch("app.providers.base_provider.get_http_client", return_value=fake_client):
        with pytest.raises(ProviderError, match="网络异常"):
            await p._request("GET", "http://api/x")


async def test_request_httpx_timeout_raises_provider_error():
    """httpx 超时异常转 ProviderError。"""
    p = _FakeProvider(api_key="k")

    fake_client = MagicMock()
    fake_client.request = AsyncMock(side_effect=httpx.ReadTimeout("slow"))

    with patch("app.providers.base_provider.get_http_client", return_value=fake_client):
        with pytest.raises(ProviderError) as exc_info:
            await p._request("GET", "http://api/x")

    assert exc_info.value.status_code == 502  # 默认值


async def test_request_error_message_contains_class_name():
    """4xx 错误消息应含子类名(_FakeProvider)。"""
    p = _FakeProvider(api_key="k")

    fake_resp = MagicMock()
    fake_resp.status_code = 404
    fake_resp.json.return_value = {"error": "not found"}

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with patch("app.providers.base_provider.get_http_client", return_value=fake_client):
        with pytest.raises(ProviderError, match="_FakeProvider"):
            await p._request("GET", "http://api/x")
