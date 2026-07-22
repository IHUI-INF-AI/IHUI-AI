"""SDK asyncio 基础客户端 — 异步版鉴权、重试、超时、错误处理。

基于 ``asyncio`` 原生 stream reader 实现,零运行时依赖(纯 stdlib)。
"""

from __future__ import annotations

import asyncio
import json as _json
from typing import Any, AsyncIterator, Mapping

from .base import SdkConfig, _encode_multipart, _normalize_base_url
from .exceptions import NetworkError, SdkError, from_status

#: 默认请求超时(秒)。
DEFAULT_TIMEOUT = 30.0
#: 默认最大重试次数。
DEFAULT_MAX_RETRIES = 2
#: 重试退避延迟(秒)。
RETRY_DELAYS = (0.5, 1.0)


class AsyncBaseClient:
    """SDK asyncio 基础客户端。

    基于 ``asyncio.open_connection`` 实现真正的异步 I/O,
    所有方法都是协程,支持高并发场景。

    Example:
        >>> client = AsyncBaseClient({"apiKey": "ihui_xxx"})
        >>> models = await client.request("GET", "/models")
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
        base_url = config.get("base_url") or config.get("baseUrl") or "http://localhost:8802"  # type: ignore[assignment]
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

    def _parse_url(self, path: str) -> tuple[str, int, str]:
        """解析 URL 为 (host, port, path_with_query) 元组。"""
        from urllib.parse import urlparse

        url = self._build_url(path)
        parsed = urlparse(url)
        host = parsed.hostname or "localhost"
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        req_path = parsed.path
        if parsed.query:
            req_path += f"?{parsed.query}"
        return host, port, req_path

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

    async def _send_request(
        self,
        method: str,
        path: str,
        body_bytes: bytes | None,
        headers: dict[str, str],
        *,
        read_timeout: float | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        """发送 HTTP 请求并返回 (status, headers, body_bytes)。

        使用 asyncio.open_connection 实现真正的异步 I/O。
        """
        from urllib.parse import urlparse

        url = self._build_url(path)
        parsed = urlparse(url)
        host = parsed.hostname or "localhost"
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        req_path = parsed.path
        if parsed.query:
            req_path += f"?{parsed.query}"
        use_ssl = parsed.scheme == "https"

        # 构建 HTTP 请求文本
        lines = [f"{method} {req_path} HTTP/1.1", f"Host: {host}"]
        for key, value in headers.items():
            if key.lower() != "host":
                lines.append(f"{key}: {value}")
        if body_bytes is not None:
            lines.append(f"Content-Length: {len(body_bytes)}")
        lines.append("Connection: close")
        lines.append("")
        lines.append("")
        request_header = "\r\n".join(lines).encode("latin-1")

        # 连接
        try:
            if use_ssl:
                import ssl

                ctx = ssl.create_default_context()
                reader, writer = await asyncio.open_connection(host, port, ssl=ctx)
            else:
                reader, writer = await asyncio.open_connection(host, port)
        except OSError as e:
            raise NetworkError(0, "network_error", f"Connection failed: {e}") from None

        try:
            # 发送请求
            writer.write(request_header)
            if body_bytes is not None:
                writer.write(body_bytes)
            await writer.drain()

            # 读取响应 — 解析 HTTP 状态行 + headers
            timeout = read_timeout if read_timeout is not None else self._timeout
            try:
                status_line = await asyncio.wait_for(reader.readline(), timeout=timeout)
            except asyncio.TimeoutError:
                raise NetworkError(0, "timeout", f"Request timed out after {timeout}s") from None

            if not status_line:
                raise NetworkError(0, "network_error", "Empty response from server")

            # 解析状态行: "HTTP/1.1 200 OK\r\n"
            status_parts = status_line.decode("latin-1").strip().split(" ", 2)
            if len(status_parts) < 2:
                raise NetworkError(0, "network_error", f"Invalid status line: {status_line!r}")
            status = int(status_parts[1])

            # 读取 headers
            resp_headers: dict[str, str] = {}
            while True:
                header_line = await asyncio.wait_for(reader.readline(), timeout=timeout)
                if not header_line or header_line in (b"\r\n", b"\n"):
                    break
                decoded = header_line.decode("latin-1").strip()
                if ":" in decoded:
                    key, _, value = decoded.partition(":")
                    resp_headers[key.strip().lower()] = value.strip()

            # 读取 body
            body = await self._read_body(reader, resp_headers, timeout)

            return status, resp_headers, body

        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass

    async def _read_body(
        self,
        reader: asyncio.StreamReader,
        headers: dict[str, str],
        timeout: float,
    ) -> bytes:
        """根据 Transfer-Encoding / Content-Length 读取响应体。"""
        transfer_encoding = headers.get("transfer-encoding", "").lower()
        content_length_str = headers.get("content-length")

        chunks: list[bytes] = []

        if "chunked" in transfer_encoding:
            # 分块传输编码
            while True:
                size_line = await asyncio.wait_for(reader.readline(), timeout=timeout)
                if not size_line:
                    break
                size_str = size_line.decode("latin-1").strip()
                if not size_str:
                    continue
                # 处理 chunk 扩展(;后面)
                size_str = size_str.split(";")[0].strip()
                try:
                    chunk_size = int(size_str, 16)
                except ValueError:
                    break
                if chunk_size == 0:
                    # 读取 trailer
                    while True:
                        trailer = await asyncio.wait_for(reader.readline(), timeout=timeout)
                        if not trailer or trailer in (b"\r\n", b"\n"):
                            break
                    break
                chunk = await asyncio.wait_for(reader.readexactly(chunk_size), timeout=timeout)
                chunks.append(chunk)
                # 读取行尾 \r\n
                await reader.readexactly(2)
        elif content_length_str is not None:
            try:
                length = int(content_length_str)
                if length > 0:
                    body = await asyncio.wait_for(reader.readexactly(length), timeout=timeout)
                    chunks.append(body)
            except ValueError:
                pass
        else:
            # 无 Content-Length,读到连接关闭
            while True:
                try:
                    chunk = await asyncio.wait_for(reader.read(4096), timeout=timeout)
                    if not chunk:
                        break
                    chunks.append(chunk)
                except asyncio.TimeoutError:
                    break

        return b"".join(chunks)

    # ---- 公开方法 -------------------------------------------------------

    async def request(
        self,
        method: str,
        path: str,
        body: Any = None,
        *,
        multipart: tuple[Mapping[str, str], Mapping[str, tuple[str, bytes]]] | None = None,
    ) -> Any:
        """发起异步 JSON 请求并解析响应。

        网络错误和 5xx 自动重试(指数退避 0.5s/1.0s),429 和 4xx 不重试。

        Args:
            method: HTTP 方法(GET/POST/PUT/DELETE)。
            path: 路径(不含 ``/v1`` 前缀)。
            body: 请求体(JSON 序列化)。
            multipart: ``(fields, files)`` 元组,用于 multipart 上传。

        Returns:
            解析后的 JSON 响应(空响应返回 None)。

        Raises:
            SdkError: 请求失败。
        """
        last_error: SdkError | None = None

        for attempt in range(self._max_retries + 1):
            if attempt > 0:
                delay = RETRY_DELAYS[min(attempt - 1, len(RETRY_DELAYS) - 1)]
                await asyncio.sleep(delay)

            try:
                # 构建请求体和 headers
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

                status, resp_headers, resp_body = await self._send_request(
                    method, path, body_bytes, headers
                )

                if 200 <= status < 300:
                    if not resp_body:
                        return None
                    try:
                        return _json.loads(resp_body.decode("utf-8"))
                    except (ValueError, _json.JSONDecodeError):
                        return resp_body

                # 错误响应
                last_error = self._parse_error_body(status, resp_body)
                if status == 429 or status < 500:
                    break
                # 5xx 继续重试

            except SdkError:
                raise
            except NetworkError as e:
                last_error = e
                # 网络错误继续重试
            except OSError as e:
                last_error = NetworkError(0, "network_error", str(e))
                # 继续重试

        raise last_error or SdkError(500, "unknown_error", "Unknown error")

    async def request_stream(self, method: str, path: str, body: Any = None) -> asyncio.StreamReader:
        """发起异步流式请求,返回 asyncio.StreamReader。

        流式请求不超时、不重试(无法安全回放流)。
        返回的 StreamReader 可配合 ``parse_chat_stream_async`` / ``parse_agent_stream_async`` 使用。

        Args:
            method: HTTP 方法(通常为 POST)。
            path: 路径。
            body: 请求体(JSON 序列化)。

        Returns:
            ``asyncio.StreamReader``,其 ``readline()`` 可逐行读取 SSE 事件。

        Raises:
            SdkError: 请求失败(连接建立阶段)。
        """
        if body is not None:
            body_bytes = _json.dumps(body).encode("utf-8")
            headers = self._build_headers("application/json")
        else:
            body_bytes = None
            headers = self._build_headers("application/json")

        # 流式请求需要保持连接不断开,手动处理
        from urllib.parse import urlparse

        url = self._build_url(path)
        parsed = urlparse(url)
        host = parsed.hostname or "localhost"
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        req_path = parsed.path
        if parsed.query:
            req_path += f"?{parsed.query}"
        use_ssl = parsed.scheme == "https"

        lines = [f"{method} {req_path} HTTP/1.1", f"Host: {host}"]
        for key, value in headers.items():
            if key.lower() != "host":
                lines.append(f"{key}: {value}")
        if body_bytes is not None:
            lines.append(f"Content-Length: {len(body_bytes)}")
        lines.append("Connection: close")
        lines.append("")
        lines.append("")
        request_header = "\r\n".join(lines).encode("latin-1")

        try:
            if use_ssl:
                import ssl

                ctx = ssl.create_default_context()
                reader, writer = await asyncio.open_connection(host, port, ssl=ctx)
            else:
                reader, writer = await asyncio.open_connection(host, port)
        except OSError as e:
            raise NetworkError(0, "network_error", f"Connection failed: {e}") from None

        try:
            writer.write(request_header)
            if body_bytes is not None:
                writer.write(body_bytes)
            await writer.drain()

            # 读取状态行
            status_line = await reader.readline()
            if not status_line:
                raise NetworkError(0, "network_error", "Empty response from server")

            status_parts = status_line.decode("latin-1").strip().split(" ", 2)
            if len(status_parts) < 2:
                raise NetworkError(0, "network_error", f"Invalid status line: {status_line!r}")
            status = int(status_parts[1])

            # 读取 headers
            resp_headers: dict[str, str] = {}
            while True:
                header_line = await reader.readline()
                if not header_line or header_line in (b"\r\n", b"\n"):
                    break
                decoded = header_line.decode("latin-1").strip()
                if ":" in decoded:
                    key, _, value = decoded.partition(":")
                    resp_headers[key.strip().lower()] = value.strip()

            if status >= 400:
                body = await self._read_body(reader, resp_headers, self._timeout)
                writer.close()
                try:
                    await writer.wait_closed()
                except Exception:
                    pass
                raise self._parse_error_body(status, body)

            # 返回 reader(调用方负责读取;writer 在 reader EOF 后自动关闭)
            # 注意:我们不显式关闭 writer,因为调用方还需要从 reader 读取
            # 连接会在 reader 读到 EOF 后由 asyncio 清理
            return reader

        except SdkError:
            raise
        except NetworkError:
            raise
        except OSError as e:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass
            raise NetworkError(0, "network_error", str(e)) from None


__all__ = ["AsyncBaseClient"]
