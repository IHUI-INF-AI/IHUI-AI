# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""设备信任根（TPM 硬件密钥）纯逻辑层。

取证来源
--------
``.ihui-agent/tmp/goal-codex-r11/native-plugin-mechanisms-deep.md`` §1
remote-control-device-key.node（Rust N-API, TPM 硬件信任根）实测::

    N-API 导出: createDeviceKey(protectionPolicy) / getDeviceKeyPublic /
      signDeviceKey(keyId, payload) / deleteDeviceKey(keyId)
    返回字段: errorCode / keyId / publicKeySpkiDerBase64 / protectionClass /
      signatureDerBase64
    错误码(稳定枚举): remote_control_device_key_tpm_unavailable /
      _tpm_configuration / _store_unavailable / _unusable
    Win32 面: NCryptOpenStorageProvider/OpenKey/CreatePersistedKey/
      SetProperty(export policy)/ExportKey(只导公钥)/DeleteKey/BCryptGenRandom
    fail-closed: 若 CNG 返回可导出私钥 → 报错拒绝; 非 hardware-backed → 拒绝;
      曲线固定 P-256

设计边界（本仓复现）
--------------------
真实 CNG/NCrypt/TPM 调用需 Windows + 硬件, 本模块**不碰**。只复现其**纯逻辑
判定层**: 错误码枚举、保护策略合法性、导出策略 fail-closed、公钥 SPKI/P-256
格式校验、challenge-response 流程状态机。平台绑定部分留给各端 adapter
（Windows CNG TPM / macOS Secure Enclave / Linux tpm2-tss）。

安全边界
--------
本模块不生成、不存储、不导出任何私钥; 只做**格式与策略判定**。私钥永不离开
硬件是设计铁律, 本模块的所有判定都朝"拒绝可疑"方向 fail-closed。
"""

from __future__ import annotations

import base64
import binascii
import re
from dataclasses import dataclass
from enum import StrEnum

__all__ = [
    "PROTECTION_CLASSES",
    "REQUIRED_PROTECTION_POLICY_KEYS",
    "VALID_PROTECTION_POLICIES",
    "SPKI_P256_HEADER_HEX",
    "DeviceKeyErrorCode",
    "ProtectionPolicyError",
    "SpkiPublicKey",
    "DeviceKeyChallenge",
    "validate_protection_policy",
    "classify_device_key_error",
    "parse_spki_public_key",
    "is_fail_closed_exportable",
    "new_challenge",
    "verify_challenge_response_shape",
]

# ---------------------------------------------------------------------------
# 保护等级(取证: protectionClass / protectionPolicy)
# ---------------------------------------------------------------------------
PROTECTION_CLASSES: tuple[str, ...] = (
    "tpm",          # 硬件 TPM 保护, 私钥不可导出
    "software",     # 软件保护(降级, 设备信任根应拒绝)
)

# createDeviceKey(protectionPolicy) 的合法策略键
REQUIRED_PROTECTION_POLICY_KEYS: frozenset[str] = frozenset(
    {"protection_class", "non_exportable"}
)
VALID_PROTECTION_POLICIES: frozenset[str] = frozenset(PROTECTION_CLASSES)


class ProtectionPolicyError(ValueError):
    """保护策略非法。"""


def validate_protection_policy(policy: dict[str, object]) -> dict[str, object]:
    """校验 createDeviceKey 的保护策略, 返回规范化策略。

    取证: 私钥不可导出、TPM 硬件保护是设计铁律。策略须显式声明
    ``protection_class`` 与 ``non_exportable=True``; 缺任一即拒绝(fail-closed)。
    """
    if not isinstance(policy, dict):
        raise ProtectionPolicyError("protection policy must be a mapping")
    missing = REQUIRED_PROTECTION_POLICY_KEYS - set(policy)
    if missing:
        raise ProtectionPolicyError(
            f"protection policy missing keys: {sorted(missing)}"
        )
    cls = policy.get("protection_class")
    if cls not in VALID_PROTECTION_POLICIES:
        raise ProtectionPolicyError(
            f"invalid protection_class {cls!r}; expected one of {sorted(VALID_PROTECTION_POLICIES)}"
        )
    non_exportable = policy.get("non_exportable")
    if non_exportable is not True:
        # fail-closed: 不允许可导出私钥
        raise ProtectionPolicyError(
            "non_exportable must be True; exportable private keys are rejected"
        )
    return {"protection_class": cls, "non_exportable": True}


# ---------------------------------------------------------------------------
# 错误码(稳定枚举, 取证直读)
# ---------------------------------------------------------------------------
class DeviceKeyErrorCode(StrEnum):
    TPM_UNAVAILABLE = "remote_control_device_key_tpm_unavailable"
    TPM_CONFIGURATION = "remote_control_device_key_tpm_configuration"
    STORE_UNAVAILABLE = "remote_control_device_key_store_unavailable"
    UNUSABLE = "remote_control_device_key_unusable"


def classify_device_key_error(raw: str) -> DeviceKeyErrorCode | None:
    """把原始错误串归类到稳定错误码枚举; 未命中返回 None。

    便于把平台层(CNG/TPM)的杂乱报错归一到取证确证的 4 个稳定枚举。
    """
    if not raw:
        return None
    low = raw.lower()
    if "not hardware-backed" in low or "tpm unavailable" in low:
        return DeviceKeyErrorCode.TPM_UNAVAILABLE
    if "tpm configuration" in low or "unexpected p-256" in low:
        return DeviceKeyErrorCode.TPM_CONFIGURATION
    if "storage provider" in low or "store unavailable" in low:
        return DeviceKeyErrorCode.STORE_UNAVAILABLE
    if "exportable private key" in low or "unusable" in low:
        return DeviceKeyErrorCode.UNUSABLE
    # 前缀兜底
    for code in DeviceKeyErrorCode:
        if low.startswith(code.value) or code.value in low:
            return code
    return None


# ---------------------------------------------------------------------------
# fail-closed 导出策略
# ---------------------------------------------------------------------------
def is_fail_closed_exportable(
    *, private_key_exportable: bool, hardware_backed: bool
) -> tuple[bool, str | None]:
    """判定是否须 fail-closed 拒绝。

    取证: 私钥若 CNG 报"可导出" → 拒绝; 非 hardware-backed → 拒绝。
    返回 (是否拒绝, 原因)。
    """
    if private_key_exportable:
        return True, "Windows CNG created an exportable private key"
    if not hardware_backed:
        return True, "Windows TPM key storage provider is not hardware-backed"
    return False, None


# ---------------------------------------------------------------------------
# 公钥 SPKI / P-256 校验
# ---------------------------------------------------------------------------
# P-256 的 SubjectPublicKeyInfo DER 前缀(固定头, 取证: "unexpected P-256 public key (header)")
SPKI_P256_HEADER_HEX = "3059301306072a8648ce3d020106082a8648ce3d030107034200"


@dataclass(frozen=True)
class SpkiPublicKey:
    """解析后的 SPKI 公钥。"""

    raw_b64: str
    is_p256: bool
    header_valid: bool


def parse_spki_public_key(spki_der_base64: str) -> SpkiPublicKey | None:
    """解析 base64(SPKI DER) 公钥, 校验是否 P-256。

    取证: 曲线固定 P-256, 头不符报错。返回 None 表示 base64/DER 不可解析。
    """
    if not spki_der_base64:
        return None
    try:
        der = base64.b64decode(spki_der_base64, validate=True)
    except (binascii.Error, ValueError):
        return None
    if not der:
        return None
    header = der[: len(SPKI_P256_HEADER_HEX) // 2].hex()
    return SpkiPublicKey(
        raw_b64=spki_der_base64,
        is_p256=header.lower() == SPKI_P256_HEADER_HEX.lower(),
        header_valid=True,
    )


# ---------------------------------------------------------------------------
# challenge-response 流程
# ---------------------------------------------------------------------------
# keyId 形态: 服务端预注册的密钥标识(取证仅给字段名, 形态留 adapter)
_KEYID_RE = re.compile(r"^[A-Za-z0-9._\-]{8,128}$")


@dataclass(frozen=True)
class DeviceKeyChallenge:
    """一次远程控制授权的 challenge。"""

    key_id: str
    nonce_b64: str


def new_challenge(key_id: str, nonce: bytes) -> DeviceKeyChallenge:
    """构造 challenge(keyId + 随机 nonce)。nonce 须非空。"""
    if not _KEYID_RE.match(key_id or ""):
        raise ValueError("keyId must be 8-128 chars of [A-Za-z0-9._-]")
    if not nonce:
        raise ValueError("nonce must be non-empty")
    return DeviceKeyChallenge(key_id=key_id, nonce_b64=base64.b64encode(nonce).decode())


def verify_challenge_response_shape(
    *,
    signature_der_base64: str | None,
    public_key_spki_base64: str | None,
    protection_class: str | None,
) -> tuple[bool, str | None]:
    """校验 signDeviceKey 回传的字段形态是否可用于服务端验签。

    取证: 回传 signatureDerBase64 + publicKeySpkiDerBase64 + protectionClass。
    这里只校验**形态**(非空、公钥 P-256、protection_class 合法), 不做真实验签
    (验签需服务端私钥对, 属业务层)。返回 (是否通过, 原因)。
    """
    if not signature_der_base64:
        return False, "missing signatureDerBase64"
    if not public_key_spki_base64:
        return False, "missing publicKeySpkiDerBase64"
    parsed = parse_spki_public_key(public_key_spki_base64)
    if parsed is None:
        return False, "publicKeySpkiDerBase64 is not valid base64 DER"
    if not parsed.is_p256:
        return False, "public key is not P-256"
    if protection_class != "tpm":
        # 设备信任根要求硬件保护
        return False, f"protection_class must be 'tpm', got {protection_class!r}"
    return True, None
