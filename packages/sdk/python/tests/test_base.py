# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""BaseClient 单元测试 — 鉴权、请求体拼装、重试、错误映射。

通过 monkeypatch 替换 ``urllib.request.urlopen``,全程无真实网络。
"""

from __future__ import annotations

import io
import json
import urllib.error
from typing import Any

import pytest

from ihui_ai.base import BaseClient
from ihui_ai.exceptions import (
    AuthenticationError,
    NetworkError,
    NotFoundError,
    PermissionError,
    QuotaExceededError,
    SdkError,
    ServerError,
)


# ---------------------------------------------------------------------------
# urlopen 夹具:按脚本返回响应或抛 HTTPError
# ---------------------------------------------------------------------------


class _FakeResponse:
    def __init__(self, body: bytes) -> None:
        self._stream = io.BytesIO(body)

    def read(self, n: int = -1) -> bytes:
        return self._stream.read(n)

    def close(self) -> None:
        pass


class UrlopenRecorder:
    """替换 urllib.request.urlopen,记录 Request 并按脚本回放。"""

    def __init__(self, script: list[dict[str, Any]]) -> None:
        self.script = script
        self.requests: list[Any] = []

    def __call__(self, req: Any, timeout: Any = None) -> _FakeResponse:
        self.requests.append(req)
        step = self.script[min(len(self.requests) - 1, len(self.script) - 1)]
        if step.get("raise") == "http":
            raise urllib.error.HTTPError(
                req.full_url, step["status"], step.get("reason", ""), {}, io.BytesIO(step.get("body", b""))
            )
        if step.get("raise") == "url":
            raise urllib.error.URLError(step.get("reason", "connection refused"))
        return _FakeResponse(step.get("body", b""))

    @property
    def call_count(self) -> int:
        return len(self.requests)


@pytest.fixture()
def patch_urlopen(monkeypatch: pytest.MonkeyPatch):
    def _patch(script: list[dict[str, Any]]) -> UrlopenRecorder:
        recorder = UrlopenRecorder(script)
        monkeypatch.setattr("urllib.request.urlopen", recorder)
        # 消除重试退避等待
        monkeypatch.setattr("ihui_ai.base.time.sleep", lambda _s: None)
        return recorder

    return _patch


def make_client(**overrides: Any) -> BaseClient:
    config: dict[str, Any] = {"api_key": "ihui_test_key", "base_url": "http://test.local"}
    config.update(overrides)
    return BaseClient(config)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# 配置校验
# ---------------------------------------------------------------------------


class TestConfig:
    def test_missing_api_key_raises(self) -> None:
        with pytest.raises(SdkError) as exc:
            BaseClient({"api_key": ""})
        assert exc.value.status == 401
        assert exc.value.code == "missing_api_key"

    def test_camel_case_aliases(self) -> None:
        client = BaseClient({"apiKey": "ihui_k", "baseUrl": "http://test.local///", "maxRetries": 0})
        assert client.base_url == "http://test.local"
        assert client._max_retries == 0

    def test_non_mapping_config_raises(self) -> None:
        with pytest.raises(SdkError):
            BaseClient("not-a-mapping")  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# 请求拼装
# ---------------------------------------------------------------------------


class TestRequestAssembly:
    def test_post_body_and_url(self, patch_urlopen: Any) -> None:
        recorder = patch_urlopen([{"body": json.dumps({"ok": True}).encode()}])
        body = {"model": "gpt-4o", "messages": [{"role": "user", "content": "hi"}]}
        out = make_client().request("POST", "/chat/completions", body)
        assert out == {"ok": True}
        req = recorder.requests[0]
        assert req.full_url == "http://test.local/v1/chat/completions"
        assert req.get_method() == "POST"
        assert json.loads(req.data.decode()) == body

    def test_optional_none_fields_stay_none_not_dropped(self, patch_urlopen: Any) -> None:
        """SDK 透传调用方 dict — None 序列化为 null,语义由服务端定义。

        这里锁定当前契约:传什么就发什么,不做静默删改。
        """
        recorder = patch_urlopen([{"body": b"{}"}])
        make_client().request("POST", "/x", {"a": 1, "b": None})
        sent = json.loads(recorder.requests[0].data.decode())
        assert sent == {"a": 1, "b": None}

    def test_get_has_no_body(self, patch_urlopen: Any) -> None:
        recorder = patch_urlopen([{"body": b"{}"}])
        make_client().request("GET", "/models")
        req = recorder.requests[0]
        assert req.get_method() == "GET"
        assert req.data is None

    def test_auth_headers(self, patch_urlopen: Any) -> None:
        recorder = patch_urlopen([{"body": b"{}"}])
        make_client(secret="sec_123").request("GET", "/models")
        req = recorder.requests[0]
        assert req.get_header("Authorization") == "Bearer ihui_test_key"
        assert req.get_header("X-api-secret") == "sec_123"
        assert req.get_header("Content-type") == "application/json"

    def test_empty_response_returns_none(self, patch_urlopen: Any) -> None:
        patch_urlopen([{"body": b""}])
        assert make_client().request("DELETE", "/user/models/m1") is None

    def test_multipart_encoding(self, patch_urlopen: Any) -> None:
        patch_urlopen([{"body": b"{}"}])
        fields = {"purpose": "fine-tune"}
        files = {"file": ("a.txt", b"hello")}
        make_client().request("POST", "/files", multipart=(fields, files))
        # 只验证不抛错;multipart 细节由 files 模块集成测试覆盖


# ---------------------------------------------------------------------------
# 错误映射
# ---------------------------------------------------------------------------


class TestErrorMapping:
    def test_401_flat_body(self, patch_urlopen: Any) -> None:
        patch_urlopen(
            [{"raise": "http", "status": 401, "body": b'{"code":"auth_invalid_api_key","message":"bad key"}'}]
        )
        with pytest.raises(AuthenticationError) as exc:
            make_client().request("GET", "/models")
        assert exc.value.status == 401
        assert exc.value.code == "auth_invalid_api_key"
        assert str(exc.value) == "bad key"

    def test_403_permission(self, patch_urlopen: Any) -> None:
        patch_urlopen([{"raise": "http", "status": 403, "body": b'{"code":"forbidden","message":"no"}'}])
        with pytest.raises(PermissionError):
            make_client().request("GET", "/x")

    def test_404_nested_error_object(self, patch_urlopen: Any) -> None:
        patch_urlopen(
            [
                {
                    "raise": "http",
                    "status": 404,
                    "body": json.dumps(
                        {"error": {"code": "model_not_found", "message": "no such model", "details": {"id": "gpt-9"}}}
                    ).encode(),
                }
            ]
        )
        with pytest.raises(NotFoundError) as exc:
            make_client().request("GET", "/models/gpt-9")
        assert exc.value.code == "model_not_found"
        assert exc.value.details == {"id": "gpt-9"}

    def test_429_quota_no_retry(self, patch_urlopen: Any) -> None:
        recorder = patch_urlopen(
            [{"raise": "http", "status": 429, "body": b'{"code":"rate_limited","message":"slow down"}'}]
        )
        with pytest.raises(QuotaExceededError):
            make_client().request("GET", "/x")
        assert recorder.call_count == 1

    def test_500_retries_then_server_error(self, patch_urlopen: Any) -> None:
        recorder = patch_urlopen([{"raise": "http", "status": 500, "body": b'{"code":"boom","message":"x"}'}])
        with pytest.raises(ServerError):
            make_client().request("GET", "/x")
        assert recorder.call_count == 3  # 1 原始 + 2 重试

    def test_invalid_json_error_body_falls_back(self, patch_urlopen: Any) -> None:
        patch_urlopen([{"raise": "http", "status": 418, "body": b"<html>teapot</html>"}])
        with pytest.raises(SdkError) as exc:
            make_client().request("GET", "/x")
        assert not isinstance(exc.value, (AuthenticationError, ServerError))
        assert exc.value.status == 418

    def test_network_error_retries(self, patch_urlopen: Any) -> None:
        recorder = patch_urlopen([{"raise": "url", "reason": "conn refused"}])
        with pytest.raises(NetworkError) as exc:
            make_client().request("GET", "/x")
        assert exc.value.status == 0
        assert exc.value.code == "network_error"
        assert recorder.call_count == 3

    def test_from_status_hierarchy(self) -> None:
        from ihui_ai.exceptions import from_status

        assert isinstance(from_status(401, None, "m"), AuthenticationError)
        assert isinstance(from_status(403, None, "m"), PermissionError)
        assert isinstance(from_status(404, None, "m"), NotFoundError)
        assert isinstance(from_status(429, None, "m"), QuotaExceededError)
        assert isinstance(from_status(503, None, "m"), ServerError)
        assert type(from_status(400, None, "m")) is SdkError
