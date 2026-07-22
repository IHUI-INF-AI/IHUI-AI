"""SDK 异常层级 — 统一错误处理。

异常层级:
    SdkError                    # 基类,携带 status / code / details
    ├── AuthenticationError     # 401 未授权
    ├── PermissionError         # 403 禁止访问
    ├── NotFoundError           # 404 资源不存在
    ├── QuotaExceededError      # 429 配额超限
    ├── ServerError             # 5xx 服务端错误
    └── NetworkError            # 0 网络错误(无 HTTP 响应)
"""

from __future__ import annotations

from typing import Any


class SdkError(Exception):
    """SDK 错误基类,携带 HTTP 状态码 + 错误码 + 详情。

    Attributes:
        status: HTTP 状态码(网络错误为 0)。
        code: 错误码字符串(如 ``auth_invalid_api_key``),可能为 None。
        details: 错误详情(来自响应体),可能为 None。
    """

    status: int
    code: str | None
    details: dict[str, Any] | None

    def __init__(
        self,
        status: int,
        code: str | None,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.details = details

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(status={self.status!r}, "
            f"code={self.code!r}, message={self.args[0]!r})"
        )


class AuthenticationError(SdkError):
    """401 未授权 — API Key 无效或缺失。"""


class PermissionError(SdkError):  # noqa: A001 - 故意覆盖内置以匹配 SDK 语义
    """403 禁止访问 — API Key 权限不足。"""


class NotFoundError(SdkError):
    """404 资源不存在。"""


class QuotaExceededError(SdkError):
    """429 配额超限 — 请求频率或 token 配额用尽。"""


class ServerError(SdkError):
    """5xx 服务端错误。"""


class NetworkError(SdkError):
    """网络错误 — 无法连接服务器(无 HTTP 响应)。"""


def from_status(
    status: int,
    code: str | None,
    message: str,
    details: dict[str, Any] | None = None,
) -> SdkError:
    """根据 HTTP 状态码构造对应的异常子类。"""
    if status == 401:
        return AuthenticationError(status, code, message, details)
    if status == 403:
        return PermissionError(status, code, message, details)
    if status == 404:
        return NotFoundError(status, code, message, details)
    if status == 429:
        return QuotaExceededError(status, code, message, details)
    if status >= 500:
        return ServerError(status, code, message, details)
    return SdkError(status, code, message, details)


__all__ = [
    "SdkError",
    "AuthenticationError",
    "PermissionError",
    "NotFoundError",
    "QuotaExceededError",
    "ServerError",
    "NetworkError",
    "from_status",
]
