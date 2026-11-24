# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""device_key_trust_root 单测 — 钉住 TPM 设备信任根纯逻辑行为。"""

from __future__ import annotations

import base64

import pytest

from app.services.device_key_trust_root import (
    DeviceKeyErrorCode,
    ProtectionPolicyError,
    classify_device_key_error,
    is_fail_closed_exportable,
    new_challenge,
    parse_spki_public_key,
    validate_protection_policy,
    verify_challenge_response_shape,
)

# 真实 P-256 SPKI DER 的 base64(固定头 + 未压缩点)
P256_SPKI_B64 = (
    "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEAAECAwQFBgcICQoLDA0ODxAREhMUFRYX"
    "GBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+Pw=="
)
# RSA 风格头(非 P-256)
BAD_SPKI_B64 = "MIIBCgKCAQEAAAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="


class TestProtectionPolicy:
    def test_valid_tpm(self) -> None:
        out = validate_protection_policy(
            {"protection_class": "tpm", "non_exportable": True}
        )
        assert out == {"protection_class": "tpm", "non_exportable": True}

    def test_missing_key_raises(self) -> None:
        with pytest.raises(ProtectionPolicyError, match="missing keys"):
            validate_protection_policy({"protection_class": "tpm"})

    def test_invalid_class_raises(self) -> None:
        with pytest.raises(ProtectionPolicyError, match="invalid protection_class"):
            validate_protection_policy(
                {"protection_class": "hsm", "non_exportable": True}
            )

    def test_exportable_rejected(self) -> None:
        # fail-closed: 不允许可导出私钥
        with pytest.raises(ProtectionPolicyError, match="non_exportable"):
            validate_protection_policy(
                {"protection_class": "tpm", "non_exportable": False}
            )

    def test_not_mapping_raises(self) -> None:
        with pytest.raises(ProtectionPolicyError, match="mapping"):
            validate_protection_policy("tpm")  # type: ignore[arg-type]


class TestClassifyError:
    def test_tpm_unavailable(self) -> None:
        assert classify_device_key_error("not hardware-backed") is DeviceKeyErrorCode.TPM_UNAVAILABLE

    def test_tpm_configuration(self) -> None:
        assert classify_device_key_error("unexpected P-256 public key (header)") is DeviceKeyErrorCode.TPM_CONFIGURATION

    def test_store_unavailable(self) -> None:
        assert classify_device_key_error("storage provider open failed") is DeviceKeyErrorCode.STORE_UNAVAILABLE

    def test_unusable(self) -> None:
        assert classify_device_key_error("exportable private key") is DeviceKeyErrorCode.UNUSABLE

    def test_exact_enum_prefix(self) -> None:
        assert classify_device_key_error(DeviceKeyErrorCode.TPM_UNAVAILABLE.value) is DeviceKeyErrorCode.TPM_UNAVAILABLE

    def test_unknown_returns_none(self) -> None:
        assert classify_device_key_error("some random error") is None

    def test_empty_returns_none(self) -> None:
        assert classify_device_key_error("") is None


class TestFailClosed:
    def test_exportable_private_key_rejected(self) -> None:
        reject, why = is_fail_closed_exportable(
            private_key_exportable=True, hardware_backed=True
        )
        assert reject is True
        assert "exportable" in why

    def test_not_hardware_backed_rejected(self) -> None:
        reject, why = is_fail_closed_exportable(
            private_key_exportable=False, hardware_backed=False
        )
        assert reject is True
        assert "hardware-backed" in why

    def test_valid_tpm_passes(self) -> None:
        reject, why = is_fail_closed_exportable(
            private_key_exportable=False, hardware_backed=True
        )
        assert reject is False
        assert why is None


class TestSpkiPublicKey:
    def test_valid_p256(self) -> None:
        parsed = parse_spki_public_key(P256_SPKI_B64)
        assert parsed is not None
        assert parsed.is_p256 is True

    def test_non_p256_header(self) -> None:
        parsed = parse_spki_public_key(BAD_SPKI_B64)
        assert parsed is not None
        assert parsed.is_p256 is False

    def test_invalid_base64_returns_none(self) -> None:
        assert parse_spki_public_key("not valid base64!!!") is None

    def test_empty_returns_none(self) -> None:
        assert parse_spki_public_key("") is None

    def test_roundtrip_bytes(self) -> None:
        parsed = parse_spki_public_key(P256_SPKI_B64)
        assert parsed is not None
        # 头字节能还原回固定前缀
        import base64 as _b64

        der = _b64.b64decode(parsed.raw_b64)
        assert der[:26].hex().upper() == "3059301306072A8648CE3D020106082A8648CE3D030107034200"


class TestChallenge:
    def test_valid_challenge(self) -> None:
        ch = new_challenge("key-abc12345", b"nonce123")
        assert ch.key_id == "key-abc12345"
        assert base64.b64decode(ch.nonce_b64) == b"nonce123"

    def test_short_keyid_rejected(self) -> None:
        with pytest.raises(ValueError, match="keyId"):
            new_challenge("short", b"nonce")

    def test_bad_char_keyid_rejected(self) -> None:
        with pytest.raises(ValueError, match="keyId"):
            new_challenge("bad key!", b"nonce")

    def test_empty_nonce_rejected(self) -> None:
        with pytest.raises(ValueError, match="nonce"):
            new_challenge("key-abc12345", b"")


class TestChallengeResponse:
    def test_valid_response(self) -> None:
        ok, why = verify_challenge_response_shape(
            signature_der_base64="MEUCIQ==",
            public_key_spki_base64=P256_SPKI_B64,
            protection_class="tpm",
        )
        assert ok is True
        assert why is None

    def test_missing_signature(self) -> None:
        ok, why = verify_challenge_response_shape(
            signature_der_base64=None,
            public_key_spki_base64=P256_SPKI_B64,
            protection_class="tpm",
        )
        assert ok is False
        assert "signature" in why

    def test_missing_public_key(self) -> None:
        ok, why = verify_challenge_response_shape(
            signature_der_base64="sig",
            public_key_spki_base64=None,
            protection_class="tpm",
        )
        assert ok is False
        assert "publicKey" in why

    def test_non_p256_public_key(self) -> None:
        ok, why = verify_challenge_response_shape(
            signature_der_base64="sig",
            public_key_spki_base64=BAD_SPKI_B64,
            protection_class="tpm",
        )
        assert ok is False
        assert "P-256" in why

    def test_software_protection_rejected(self) -> None:
        # 设备信任根要求 tpm 保护, software 拒绝
        ok, why = verify_challenge_response_shape(
            signature_der_base64="sig",
            public_key_spki_base64=P256_SPKI_B64,
            protection_class="software",
        )
        assert ok is False
        assert "tpm" in why

    def test_invalid_base64_public_key(self) -> None:
        ok, why = verify_challenge_response_shape(
            signature_der_base64="sig",
            public_key_spki_base64="!!!notbase64!!!",
            protection_class="tpm",
        )
        assert ok is False
        assert "base64 DER" in why
