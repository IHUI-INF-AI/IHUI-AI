"""SDK 同步基础客户端 — 鉴权、重试、超时、错误处理。

基于 ``urllib.request`` 实现,零运行时依赖(纯 stdlib)。
"""

from __future__ import annotations

import json as _json
import time
import urllib.error
import urllib.request
from io import BytesIO
from typing import Any, Iterator, Mapping, TypedDict, Union
from urllib.request import Request

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
        baseUrl: 基础 URL,默认 ``http://localhost:3001``。
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


def _encode_multipart(
    fields: Mapping[str, str],
    files: Mapping[str, tuple[str, bytes]],
) -> tuple[str, bytes]:
    """编码 multipart/form-data 请求体。

    Args:
        fields: 普通文本字段。
        files: 文件字段,值为 ``(filename, content_bytes)`` 元组。

    Returns:
        ``(boundary, body_bytes)`` 元组。
    """
    import uuid

    boundary = f"----ihui-sdk-{uuid.uuid4().hex}"
    buf = BytesIO()
    # 文本字段
    for name, value in fields.items():
        buf.write(f"--{boundary}\r\n".encode())
        buf.write(
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode()
        )
        buf.write(f"{value}\r\n".encode())
    # 文件字段
    for name, (filename, content) in files.items():
        buf.write(f"--{boundary}\r\n".encode())
        buf.write(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
        )
        buf.write(b"Content-Type: application/octet-stream\r\n\r\n")
        buf.write(content)
        buf.write(b"\r\n")
    # 结束 boundary
    buf.write(f"--{boundary}--\r\n".encode())
    return boundary, buf.getvalue()


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
        # 同时支持 snake_case (Python) 和 camelCase (TS 兼容)
        if not isinstance(config, Mapping):
            raise SdkError(401, "invalid_config", "config must be a mapping")
        api_key = config.get("api_key") or config.get("apiKey")  # type: ignore[assignment]
        if not api_key:
            raise SdkError(401, "missing_api_key", "api_key is required")
        self._api_key: str = api_key
        self._secret: str | None = config.get("secret")  # type: ignore[assignment]
        base_url = config.get("base_url") or config.get("baseUrl") or "http://localhost:3001"  # type: ignore[assignment]
        self._base_url: str = _normalize_base_url(base_url)
        self._timeout: float = float(config.get("timeout", DEFAULT_TIMEOUT))  # type: ignore[arg-type]
        max_retries = config.get("max_retries", config.get("maxRetries", DEFAULT_MAX_RETRIES))  # type: ignore[assignment]
        self._max_retries: int = int(max_retries)  # type: ignore[arg-type]

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

        for attempt in range(self._max_retries + 1):
            if attempt > 0:
                delay = RETRY_DELAYS[min(attempt - 1, len(RETRY_DELAYS) - 1)]
                time.sleep(delay)

            try:
                # 构建请求体
                if multipart is not None:
                    fields, files = multipart
                    boundary, body_bytes = _encode_multipart(fields, files)
                    headers = self._build_headers(None)
                    headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
                elif body is not None:
                    body_bytes = _json.dumps(body).encode("utf-8")
                    headers = self._build_headers("application/json")
                else:
                    body_bytes = None
                    headers = self._build_headers("application/json")

                req = Request(
                    self._build_url(path),
                    data=body_bytes,
                    headers=headers,
                    method=method,
                )

                resp = urllib.request.urlopen(req, timeout=self._timeout)
                try:
                    resp_body = resp.read()
                finally:
                    resp.close()

                if not resp_body:
                    return None
                try:
                    return _json.loads(resp_body.decode("utf-8"))
                except (ValueError, _json.JSONDecodeError):
                    return resp_body

            except urllib.error.HTTPError as e:
                # HTTP 错误(4xx/5xx)— 读取响应体解析错误
                try:
                    err_body = e.read()
                except Exception:
                    err_body = b""
                last_error = self._parse_error_body(e.code, err_body)
                # 429 和 4xx 不重试
                if e.code == 429 or e.code < 500:
                    break
                # 5xx 继续重试

            except urllib.error.URLError as e:
                # 网络错误(DNS/连接失败/超时)
                last_error = NetworkError(0, "network_error", str(e.reason) if e.reason else "Network error")
                # 网络错误继续重试

            except OSError as e:
                # socket 超时 / 连接错误
                last_error = NetworkError(0, "network_error", str(e))
                # 继续重试

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
        try:
            if body is not None:
                body_bytes = _json.dumps(body).encode("utf-8")
                headers = self._build_headers("application/json")
            else:
                body_bytes = None
                headers = self._build_headers("application/json")

            req = Request(
                self._build_url(path),
                data=body_bytes,
                headers=headers,
                method=method,
            )

            # 流式不超时
            resp = urllib.request.urlopen(req, timeout=None)
            # 返回生成器,逐块读取
            try:
                while True:
                    chunk = resp.read(4096)
                    if not chunk:
                        break
                    yield chunk
            finally:
                resp.close()

        except urllib.error.HTTPError as e:
            try:
                err_body = e.read()
            except Exception:
                err_body = b""
            raise self._parse_error_body(e.code, err_body) from None

        except urllib.error.URLError as e:
            raise NetworkError(0, "network_error", str(e.reason) if e.reason else "Network error") from None

        except OSError as e:
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
