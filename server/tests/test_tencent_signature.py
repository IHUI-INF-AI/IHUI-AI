"""腾讯云 API v3 签名工具单测."""

import pytest

from app.utils.tencent_signature import TencentCloudSignature, create_tencent_signature

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def secret_id() -> str:
    return "AKIDz8krbsJ5yKBZQpn74WFkmLPx3EXAMPLE"


@pytest.fixture
def secret_key() -> str:
    return "Gu5t9xGARNpq86cd98joQYCN3EXAMPLEKEY"


@pytest.fixture
def signer(secret_id, secret_key) -> TencentCloudSignature:
    return TencentCloudSignature(secret_id, secret_key)


# ---------------------------------------------------------------------------
# TestInit
# ---------------------------------------------------------------------------


class TestInit:
    def test_creates_with_credentials(self, secret_id, secret_key):
        sig = TencentCloudSignature(secret_id, secret_key)
        assert sig.secret_id == secret_id
        assert sig.secret_key == secret_key

    def test_creates_via_factory(self, secret_id, secret_key):
        sig = create_tencent_signature(secret_id, secret_key)
        assert isinstance(sig, TencentCloudSignature)

    def test_raises_when_secret_id_missing(self, secret_key, monkeypatch):
        monkeypatch.setattr("app.config.settings.TENCENT_SECRET_ID", "")
        with pytest.raises(ValueError, match="SecretId"):
            TencentCloudSignature()

    def test_raises_when_secret_key_missing(self, secret_id, monkeypatch):
        monkeypatch.setattr("app.config.settings.TENCENT_SECRET_KEY", "")
        with pytest.raises(ValueError, match="SecretKey"):
            TencentCloudSignature(secret_id=secret_id)

    def test_raises_when_both_missing(self, monkeypatch):
        monkeypatch.setattr("app.config.settings.TENCENT_SECRET_ID", "")
        monkeypatch.setattr("app.config.settings.TENCENT_SECRET_KEY", "")
        with pytest.raises(ValueError):
            TencentCloudSignature()


# ---------------------------------------------------------------------------
# TestPrimitiveHash
# ---------------------------------------------------------------------------


class TestPrimitiveHash:
    def test_sha256_hex_known_value(self, signer):
        # sha256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
        assert signer.sha256_hex("") == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    def test_sha256_hex_hello(self, signer):
        # sha256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
        assert signer.sha256_hex("hello") == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"

    def test_hmac_sha256_returns_bytes(self, signer):
        out = signer.hmac_sha256(b"key", "msg")
        assert isinstance(out, bytes)
        assert len(out) == 32  # SHA-256 → 32 bytes


# ---------------------------------------------------------------------------
# TestAuthorizationHeader
# ---------------------------------------------------------------------------


class TestAuthorizationHeader:
    def test_contains_required_headers(self, signer):
        headers = signer.generate_authorization_header(
            method="POST",
            uri="/",
            service="cvm",
            host="cvm.tencentcloudapi.com",
            action="DescribeInstances",
            version="2017-03-12",
            region="ap-guangzhou",
        )
        assert "Host" in headers
        assert headers["Host"] == "cvm.tencentcloudapi.com"
        assert headers["X-TC-Action"] == "DescribeInstances"
        assert headers["X-TC-Version"] == "2017-03-12"
        assert headers["X-TC-Region"] == "ap-guangzhou"
        assert "X-TC-Timestamp" in headers
        assert "Authorization" in headers

    def test_authorization_format(self, signer):
        headers = signer.generate_authorization_header(
            method="GET",
            uri="/",
            service="cvm",
            host="cvm.tencentcloudapi.com",
            action="DescribeInstances",
            version="2017-03-12",
            region="ap-guangzhou",
            timestamp=1700000000,
        )
        auth = headers["Authorization"]
        assert auth.startswith("TC3-HMAC-SHA256 Credential=")
        # AKIDz8krbsJ5yKBZQpn74WFkmLPx3EXAMPLE/2023-11-14/cvm/tc3_request
        assert "AKIDz8krbsJ5yKBZQpn74WFkmLPx3EXAMPLE/2023-11-14/cvm/tc3_request" in auth
        assert "SignedHeaders=" in auth
        assert "Signature=" in auth
        # Signature 是 64 字符 hex
        sig = auth.split("Signature=")[1]
        assert len(sig) == 64
        int(sig, 16)  # 可解析为 hex

    def test_timestamp_uses_now_when_none(self, signer):
        h1 = signer.generate_authorization_header(
            method="POST",
            service="cvm",
            host="h",
            action="A",
            version="V",
        )
        h2 = signer.generate_authorization_header(
            method="POST",
            service="cvm",
            host="h",
            action="A",
            version="V",
        )
        # 两次调用时间戳应一致 (1s 内)
        assert h1["X-TC-Timestamp"] == h2["X-TC-Timestamp"]

    def test_explicit_timestamp_used(self, signer):
        h = signer.generate_authorization_header(
            method="POST",
            service="cvm",
            host="h",
            action="A",
            version="V",
            timestamp=1234567890,
        )
        assert h["X-TC-Timestamp"] == "1234567890"

    def test_query_params_sorted(self, signer):
        h_with = signer.generate_authorization_header(
            method="GET",
            uri="/",
            query_params={"b": "2", "a": "1"},
            service="cvm",
            host="h",
            action="A",
            version="V",
        )
        h_inv = signer.generate_authorization_header(
            method="GET",
            uri="/",
            query_params={"a": "1", "b": "2"},
            service="cvm",
            host="h",
            action="A",
            version="V",
        )
        # 同样的参数顺序,签名应一致
        assert h_with["Authorization"] == h_inv["Authorization"]

    def test_no_region_omits_header(self, signer):
        h = signer.generate_authorization_header(
            method="POST",
            service="cvm",
            host="h",
            action="A",
            version="V",
            region="",
        )
        assert "X-TC-Region" not in h

    def test_payload_affects_signature(self, signer):
        h_empty = signer.generate_authorization_header(
            method="POST",
            service="cvm",
            host="h",
            action="A",
            version="V",
            payload="",
            timestamp=1700000000,
        )
        h_with = signer.generate_authorization_header(
            method="POST",
            service="cvm",
            host="h",
            action="A",
            version="V",
            payload='{"x":1}',
            timestamp=1700000000,
        )
        sig_empty = h_empty["Authorization"].split("Signature=")[1]
        sig_with = h_with["Authorization"].split("Signature=")[1]
        assert sig_empty != sig_with

    def test_different_action_different_signature(self, signer):
        h1 = signer.generate_authorization_header(
            method="POST",
            service="cvm",
            host="h",
            action="DescribeInstances",
            version="V",
            timestamp=1700000000,
        )
        h2 = signer.generate_authorization_header(
            method="POST",
            service="cvm",
            host="h",
            action="RunInstances",
            version="V",
            timestamp=1700000000,
        )
        s1 = h1["Authorization"].split("Signature=")[1]
        s2 = h2["Authorization"].split("Signature=")[1]
        assert s1 != s2

    def test_method_uppercased(self, signer):
        h_lower = signer.generate_authorization_header(
            method="post",
            service="cvm",
            host="h",
            action="A",
            version="V",
            timestamp=1700000000,
        )
        h_upper = signer.generate_authorization_header(
            method="POST",
            service="cvm",
            host="h",
            action="A",
            version="V",
            timestamp=1700000000,
        )
        # 同样 method (大小写被归一) → 同样签名
        assert h_lower["Authorization"] == h_upper["Authorization"]
