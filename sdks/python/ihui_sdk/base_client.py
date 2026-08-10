"""SDK 同步基础客户端 — 基于 requests 实现。

封装鉴权(``Authorization: Bearer``)、重试(指数退避)、超时、错误处理。
所有业务模块共享一个 ``BaseClient`` 实例。
"""

from __future__ import annotations

import json as _json
import time
from typing import Any, Iterator, Mapping, TypedDict

import requests

from .exceptions import NetworkError, SdkError, from_status

#: 默认请求超时(秒)。
DEFAULT_TIMEOUT = 30.0
#: 默认最大重试次数。
DEFAULT_MAX_RETRIES = 2
#: 重试退避延迟(秒),对应第 1 次 / 第 2 次重试。
RETRY_DELAYS = (0.5, 1.0)


class SdkConfig(TypedDict, total=False):
    """SDK 配置选项。

    Attributes:
        apiKey: API Key(必需,格式 ``ihui_xxx``)。
        secret: API Secret(可选,创建/轮换时返回)。
        baseUrl: 基础 URL,默认 ``http://localhost:8802``。
        timeout: 请求超时(秒),默认 30。流式请求不超时。
        maxRetries: 最大重试次数,默认 2。网络错误和 5xx 自动重试,429 不重试。
    """

    apiKey: str
    secret: str
    baseUrl: str
    timeout: float
    maxRetries: int


def _normalize_base_url(base_url: str) -> str:
    """去除尾部 ``/``。"""
    return base_url.rstrip("/")


class BaseClient:
    """SDK 同步基础客户端。

    封装鉴权(``Authorization: Bearer``)、重试(指数退避)、超时、错误处理。
    所有业务模块共享一个 ``BaseClient`` 实例。

    配置键同时接受 Python 风格(snake_case)和 TS 风格(camelCase):
    - ``api_key`` / ``apiKey``
    - ``base_url`` / ``baseUrl``
    - ``max_retries`` / ``maxRetries``

    Example:
        >>> client = BaseClient({"api_key": "ihui_xxx"})
        >>> models = client.request("GET", "/models")
    """

    def __init__(self, config: SdkConfig) -> None:
        if not isinstance(config, Mapping):
            raise SdkError(401, "invalid_config", "config must be a mapping")
        api_key = config.get("api_key") or config.get("apiKey")  # type: ignore[assignment]
        if not api_key:
            raise SdkError(401, "missing_api_key", "api_key is required")
        self._api_key: str = api_key
        self._secret: str | None = config.get("secret")  # type: ignore[assignment]
        base_url = config.get("base_url") or config.get("baseUrl") or "http://localhost:8802"  # type: ignore[assignment]
        self._base_url: str = _normalize_base_url(base_url)
        self._timeout: float = float(config.get("timeout", DEFAULT_TIMEOUT))  # type: ignore[arg-type]
        max_retries = config.get("max_retries", config.get("maxRetries", DEFAULT_MAX_RETRIES))  # type: ignore[assignment]
        self._max_retries: int = int(max_retries)  # type: ignore[arg-type]
        self._session = requests.Session()

    # ---- 属性 -----------------------------------------------------------

    @property
    def base_url(self) -> str:
        return self._base_url

    # ---- 内部工具 -------------------------------------------------------

    def _build_headers(self, content_type: str | None = "application/json") -> dict[str, str]:
        headers: dict[str, str] = {
            "Authorization": f"Bearer {self._api_key}",
        }
        if content_type:
            headers["Content-Type"] = content_type
        if self._secret:
            headers["X-Api-Secret"] = self._secret
        return headers

    def _build_url(self, path: str) -> str:
        p = path if path.startswith("/") else f"/{path}"
        return f"{self._base_url}/v1{p}"

    def _parse_error_body(self, status: int, body_bytes: bytes) -> SdkError:
        """解析错误响应体,构造对应异常。"""
        code: str | None = None
        message: str = f"HTTP {status}"
        details: dict[str, Any] | None = None
        try:
            text = body_bytes.decode("utf-8", errors="replace")
            if text:
                data = _json.loads(text)
                if isinstance(data, dict):
                    err = data.get("error")
                    if isinstance(err, dict):
                        code = err.get("code") or data.get("code")
                        message = err.get("message") or data.get("message") or message
                        details = err.get("details") or data.get("details")
                    else:
                        code = data.get("code")
                        message = data.get("message") or message
                        details = data.get("details")
        except (ValueError, _json.JSONDecodeError):
            pass
        return from_status(status, code, message, details)

    # ---- 公开方法 -------------------------------------------------------

    def request(
        self,
        method: str,
        path: str,
        body: Any = None,
        *,
        multipart: tuple[Mapping[str, str], Mapping[str, tuple[str, bytes]]] | None = None,
    ) -> Any:
        """发起 JSON 请求并解析响应。

        网络错误和 5xx 自动重试(指数退避 0.5s/1.0s),429 和 4xx 不重试。
        若 ``multipart`` 提供,则编码为 multipart/form-data(用于文件上传)。

        Args:
            method: HTTP 方法(GET/POST/PUT/DELETE)。
            path: 路径(不含 ``/v1`` 前缀,如 ``/models``)。
            body: 请求体(JSON 序列化),GET/DELETE 传 None。
            multipart: ``(fields, files)`` 元组,用于 multipart 上传。

        Returns:
            解析后的 JSON 响应(空响应返回 None)。

        Raises:
            SdkError: 请求失败(含状态码和错误详情)。
        """
        last_error: SdkError | None = None
        url = self._build_url(path)

        for attempt in range(self._max_retries + 1):
            if attempt > 0:
                delay = RETRY_DELAYS[min(attempt - 1, len(RETRY_DELAYS) - 1)]
                time.sleep(delay)

            try:
                if multipart is not None:
                    fields, files = multipart
                    # 转换文件格式: (filename, content) -> requests 格式
                    req_files: dict[str, tuple[str, bytes, str]] = {}
                    for name, (filename, content) in files.items():
                        req_files[name] = (filename, content, "application/octet-stream")
                    headers = self._build_headers(None)
                    resp = self._session.request(
                        method, url, data=dict(fields), files=req_files,
                        headers=headers, timeout=self._timeout,
                    )
                else:
                    headers = self._build_headers("application/json")
                    if body is not None:
                        resp = self._session.request(
                            method, url, json=body, headers=headers, timeout=self._timeout,
                        )
                    else:
                        resp = self._session.request(
                            method, url, headers=headers, timeout=self._timeout,
                        )

                resp.raise_for_status()
                if not resp.content:
                    return None
                try:
                    return resp.json()
                except (ValueError, _json.JSONDecodeError):
                    return resp.content

            except requests.exceptions.HTTPError as e:
                resp_obj = e.response
                status = resp_obj.status_code if resp_obj is not None else 500
                err_body = resp_obj.content if resp_obj is not None else b""
                last_error = self._parse_error_body(status, err_body)
                if status == 429 or status < 500:
                    break

            except requests.exceptions.ConnectionError as e:
                last_error = NetworkError(0, "network_error", f"Connection failed: {e}")

            except requests.exceptions.Timeout as e:
                last_error = NetworkError(0, "timeout", f"Request timed out: {e}")

            except requests.exceptions.RequestException as e:
                last_error = NetworkError(0, "network_error", str(e))

        raise last_error or SdkError(500, "unknown_error", "Unknown error")

    def request_stream(self, method: str, path: str, body: Any = None) -> Iterator[bytes]:
        """发起流式请求,返回 bytes 块迭代器。

        流式请求不超时、不重试(无法安全回放流)。

        Args:
            method: HTTP 方法(通常为 POST)。
            path: 路径。
            body: 请求体(JSON 序列化)。

        Yields:
            bytes 块。

        Raises:
            SdkError: 请求失败。
        """
        url = self._build_url(path)
        headers = self._build_headers("application/json")

        try:
            resp = self._session.request(
                method, url, json=body, headers=headers,
                stream=True, timeout=None,
            )
            resp.raise_for_status()
            for chunk in resp.iter_content(chunk_size=4096):
                if chunk:
                    yield chunk

        except requests.exceptions.HTTPError as e:
            resp_obj = e.response
            status = resp_obj.status_code if resp_obj is not None else 500
            err_body = resp_obj.content if resp_obj is not None else b""
            raise self._parse_error_body(status, err_body) from None

        except requests.exceptions.RequestException as e:
            raise NetworkError(0, "network_error", str(e)) from None

    def request_raw(self, method: str, path: str) -> bytes:
        """发起请求,返回原始 bytes(用于二进制下载,如文件内容)。

        Args:
            method: HTTP 方法(通常为 GET)。
            path: 路径。

        Returns:
            原始响应 bytes。

        Raises:
            SdkError: 请求失败。
        """
        return b"".join(self.request_stream(method, path))


__all__ = ["BaseClient", "SdkConfig", "DEFAULT_TIMEOUT", "DEFAULT_MAX_RETRIES"]