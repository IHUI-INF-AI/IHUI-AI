"""腾讯云 TC3-HMAC-SHA256 签名工具。

提取腾讯云 API V3 签名算法为独立模块,供 hunyuan / tmt / cvm 等 provider 复用。
规范参考: https://cloud.tencent.com/document/api/213/30654
"""

from __future__ import annotations

import hashlib
import hmac
import time
from collections.abc import Mapping
from datetime import UTC, datetime

ALGORITHM = "TC3-HMAC-SHA256"
CONTENT_TYPE = "application/json; charset=utf-8"


def _hash(message: str) -> str:
    """计算字符串的 SHA256 十六进制摘要。

    Args:
        message: 原文字符串(UTF-8 编码)。

    Returns:
        64 字符小写十六进制摘要。
    """
    return hashlib.sha256(message.encode("utf-8")).hexdigest()


def _hmac(key: bytes, message: str) -> bytes:
    """HMAC-SHA256 计算。

    Args:
        key: HMAC 密钥(字节)。
        message: 待签消息字符串(UTF-8 编码)。

    Returns:
        32 字节原始摘要。
    """
    return hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()


def _build_canonical_request(
    method: str,
    path: str,
    query: str,
    headers: Mapping[str, str],
    body: str,
) -> str:
    """拼接规范请求串 CanonicalRequest。

    Args:
        method: HTTP 方法(POST / GET)。
        path: 请求路径(如 "/")。
        query: 规范化查询字符串(如 "k1=v1&k2=v2",无查询参数传空串)。
        headers: 参与签名的请求头(键已小写、值已去首尾空白)。
        body: 已序列化的请求体字符串。

    Returns:
        CanonicalRequest 字符串。
    """
    canonical_headers = "".join(
        f"{k.lower().strip()}:{v.strip()}\n" for k, v in headers.items()
    )
    signed_headers = ";".join(k.lower().strip() for k in headers)
    return (
        f"{method.upper()}\n{path}\n{query}\n{canonical_headers}\n"
        f"{signed_headers}\n{_hash(body)}"
    )


def _build_string_to_sign(
    timestamp: int,
    service: str,
    canonical_request: str,
) -> str:
    """拼接待签名串 StringToSign。

    Args:
        timestamp: Unix 时间戳(秒)。
        service: 服务名(如 "hunyuan")。
        canonical_request: 规范请求串。

    Returns:
        StringToSign 字符串。
    """
    date = datetime.fromtimestamp(timestamp, tz=UTC).strftime("%Y-%m-%d")
    credential_scope = f"{date}/{service}/tc3_request"
    return f"{ALGORITHM}\n{timestamp}\n{credential_scope}\n{_hash(canonical_request)}"


def _build_signature(
    secret_key: str,
    date: str,
    service: str,
    string_to_sign: str,
) -> str:
    """派生签名密钥并计算 Signature。

    Args:
        secret_key: 腾讯云 SecretKey。
        date: UTC 日期字符串(YYYY-MM-DD)。
        service: 服务名。
        string_to_sign: 待签名串。

    Returns:
        64 字符小写十六进制签名。
    """
    secret_date = _hmac(("TC3" + secret_key).encode("utf-8"), date)
    secret_service = _hmac(secret_date, service)
    secret_signing = _hmac(secret_service, "tc3_request")
    return hmac.new(
        secret_signing, string_to_sign.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def _build_authorization(
    secret_id: str,
    credential_scope: str,
    signed_headers: str,
    signature: str,
    algorithm: str = ALGORITHM,
) -> str:
    """拼接 Authorization header。

    Args:
        secret_id: 腾讯云 SecretId。
        credential_scope: 凭证范围(Date/Service/tc3_request)。
        signed_headers: 参与签名的头部名(分号分隔)。
        signature: 已计算的签名串。
        algorithm: 签名算法名(默认 TC3-HMAC-SHA256)。

    Returns:
        Authorization header 字符串。
    """
    return (
        f"{algorithm} Credential={secret_id}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )


def sign_request(
    secret_id: str,
    secret_key: str,
    service: str,
    method: str,
    endpoint: str,
    path: str,
    headers: dict[str, str],
    body: str,
    region: str | None = None,
) -> dict[str, str]:
    """生成腾讯云 API V3 (TC3-HMAC-SHA256) 签名请求头。

    Args:
        secret_id: 腾讯云 SecretId。
        secret_key: 腾讯云 SecretKey。
        service: 服务名(如 "hunyuan" / "tmt" / "cvm")。
        method: HTTP 方法(POST / GET)。
        endpoint: API 域名(如 "hunyuan.tencentcloudapi.com")。
        path: 请求路径(如 "/")。
        headers: 业务请求头 dict(可含 X-TC-Action / X-TC-Version /
            X-TC-Region 等业务头,签名仅覆盖 content-type 与 host,
            其余 X-TC-* 头原样回填到返回 dict)。
        body: 已序列化的请求体字符串。
        region: 地域(如 "ap-beijing");None 留空字符串。

    Returns:
        完整签名后的 headers dict,含 Authorization / Content-Type / Host /
        X-TC-Timestamp / X-TC-Region 及从 headers 入参透传的 X-TC-Action /
        X-TC-Version 等业务头。

    Example:
        >>> h = sign_request(
        ...     "AKIDxxxx", "secret", "hunyuan", "POST",
        ...     "hunyuan.tencentcloudapi.com", "/",
        ...     {"X-TC-Action": "ChatCompletions", "X-TC-Version": "2023-09-01"},
        ...     "{}", "ap-beijing",
        ... )
        >>> h["Authorization"].startswith("TC3-HMAC-SHA256 ")
        True
        >>> h["X-TC-Action"]
        'ChatCompletions'
    """
    ts = int(time.time())
    date = datetime.fromtimestamp(ts, tz=UTC).strftime("%Y-%m-%d")

    sign_headers: dict[str, str] = {
        "content-type": CONTENT_TYPE,
        "host": endpoint,
    }
    canonical_request = _build_canonical_request(
        method, path, "", sign_headers, body,
    )
    string_to_sign = _build_string_to_sign(ts, service, canonical_request)
    signature = _build_signature(secret_key, date, service, string_to_sign)
    credential_scope = f"{date}/{service}/tc3_request"
    signed_headers = "content-type;host"
    authorization = _build_authorization(
        secret_id, credential_scope, signed_headers, signature,
    )

    result: dict[str, str] = {
        "Authorization": authorization,
        "Content-Type": CONTENT_TYPE,
        "Host": endpoint,
        "X-TC-Timestamp": str(ts),
        "X-TC-Region": region or "",
    }
    for k, v in (headers or {}).items():
        if k.startswith("X-TC-"):
            result[k] = v
    return result
