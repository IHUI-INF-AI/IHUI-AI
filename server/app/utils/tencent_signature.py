"""
Tencent Cloud API v3 signature tool.
Implements TC3-HMAC-SHA256 signing algorithm per Tencent docs.
"""

import hashlib
import hmac
import time
from datetime import datetime
from typing import Any
from urllib.parse import quote

from app.config import settings


class TencentCloudSignature:
    """Tencent Cloud API v3 signature generator."""

    def __init__(self, secret_id: str | None = None, secret_key: str | None = None):
        self.secret_id = secret_id or settings.TENCENT_SECRET_ID
        self.secret_key = secret_key or settings.TENCENT_SECRET_KEY
        if not self.secret_id or not self.secret_key:
            raise ValueError("Tencent Cloud SecretId and SecretKey must be set")

    def sha256_hex(self, data: str) -> str:
        return hashlib.sha256(data.encode("utf-8")).hexdigest()

    def hmac_sha256(self, key: bytes, message: str) -> bytes:
        return hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()

    def generate_authorization_header(
        self,
        method: str = "POST",
        uri: str = "/",
        query_params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        payload: str = "",
        service: str = "",
        host: str = "",
        action: str = "",
        version: str = "",
        region: str = "",
        timestamp: int | None = None,
    ) -> dict[str, str]:
        """Generate full request headers including Authorization for Tencent Cloud API."""
        if timestamp is None:
            timestamp = int(time.time())
        date = datetime.utcfromtimestamp(timestamp).strftime("%Y-%m-%d")
        algorithm = "TC3-HMAC-SHA256"

        request_headers = {
            "Host": host,
            "Content-Type": "application/json; charset=utf-8",
            "X-TC-Action": action,
            "X-TC-Version": version,
            "X-TC-Timestamp": str(timestamp),
        }
        if region:
            request_headers["X-TC-Region"] = region

        # Canonical request
        sorted_params = sorted((query_params or {}).items())
        canonical_qs = "&".join(f"{quote(str(k), safe='') }={quote(str(v), safe='')}" for k, v in sorted_params)

        sorted_hdrs = sorted((k.lower(), str(v).strip()) for k, v in request_headers.items())
        canonical_hdrs = "\n".join(f"{k}:{v}" for k, v in sorted_hdrs)
        signed_hdrs = ";".join(k for k, _ in sorted_hdrs)

        hashed_payload = self.sha256_hex(payload)

        canonical_request = "\n".join(
            [
                method.upper(),
                uri,
                canonical_qs,
                canonical_hdrs,
                signed_hdrs,
                hashed_payload,
            ]
        )

        credential_scope = f"{date}/{service}/tc3_request"
        hashed_canonical = self.sha256_hex(canonical_request)
        string_to_sign = "\n".join([algorithm, str(timestamp), credential_scope, hashed_canonical])

        secret_date = self.hmac_sha256(f"TC3{self.secret_key}".encode(), date)
        secret_service = self.hmac_sha256(secret_date, service)
        secret_signing = self.hmac_sha256(secret_service, "tc3_request")
        signature = self.hmac_sha256(secret_signing, string_to_sign).hex()

        request_headers["Authorization"] = (
            f"{algorithm} Credential={self.secret_id}/{credential_scope}, "
            f"SignedHeaders={signed_hdrs}, Signature={signature}"
        )
        return request_headers


def create_tencent_signature(
    secret_id: str | None = None,
    secret_key: str | None = None,
) -> TencentCloudSignature:
    return TencentCloudSignature(secret_id, secret_key)
