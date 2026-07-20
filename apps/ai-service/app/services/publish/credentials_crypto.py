"""平台凭证 AES-256-GCM 加解密。

设计:
- 密钥来自环境变量 PUBLISH_CREDENTIALS_KEY(32 字节 base64 编码)
- 未设置时自动生成一次(进程级),并打印 warning(生产必须显式设置)
- encrypt(dict) → str(base64(iv(12B) + ciphertext + tag(16B)))
- decrypt(str) → dict
- 使用 cryptography.hazmat 的 AESGCM(已在 pyproject 依赖中)
"""
from __future__ import annotations

import base64
import json
import os
import secrets
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)

_KEY_ENV = "PUBLISH_CREDENTIALS_KEY"
# 12 字节 IV(GCM 推荐值)
_IV_LEN = 12
# 32 字节密钥(AES-256)
_KEY_LEN = 32


def _load_key() -> bytes:
    """加载 AES-256 密钥。

    优先从环境变量 PUBLISH_CREDENTIALS_KEY 读取(base64 编码,解码后 32 字节)。
    未设置 → 生成临时密钥(进程级,重启后无法解密历史数据)+ warning。
    """
    env_val = os.environ.get(_KEY_ENV, "").strip()
    if env_val:
        try:
            key = base64.b64decode(env_val, validate=True)
            if len(key) != _KEY_LEN:
                raise ValueError(f"key must be {_KEY_LEN} bytes after base64 decode, got {len(key)}")
            return key
        except Exception as e:
            logger.warning(
                "[credentials_crypto] invalid %s: %s. generating ephemeral key.",
                _KEY_ENV,
                e,
            )

    # 生成临时密钥(进程级,生产环境必须显式设置)
    ephemeral = secrets.token_bytes(_KEY_LEN)
    logger.warning(
        "[credentials_crypto] %s not set. using EPHEMERAL key (RESTART = DATA LOSS). "
        "Set %s=<base64(32 bytes)> for production.",
        _KEY_ENV,
        _KEY_ENV,
    )
    return ephemeral


# 进程级单例密钥(避免每次加解密都重读环境变量)
_KEY: bytes | None = None


def _get_key() -> bytes:
    global _KEY
    if _KEY is None:
        _KEY = _load_key()
    return _KEY


def encrypt(credentials: dict[str, Any]) -> str:
    """加密凭证 dict → base64 字符串。"""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    key = _get_key()
    iv = secrets.token_bytes(_IV_LEN)
    aesgcm = AESGCM(key)
    plaintext = json.dumps(credentials, ensure_ascii=False).encode("utf-8")
    # AESGCM.encrypt 返回 ciphertext + tag(末尾 16 字节为 tag)
    ct_and_tag = aesgcm.encrypt(iv, plaintext, associated_data=None)
    blob = iv + ct_and_tag
    return base64.b64encode(blob).decode("ascii")


def decrypt(cipher_str: str) -> dict[str, Any]:
    """解密 base64 字符串 → 凭证 dict。"""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    if not cipher_str:
        raise ValueError("empty cipher string")
    key = _get_key()
    try:
        blob = base64.b64decode(cipher_str, validate=True)
    except Exception as e:
        raise ValueError(f"invalid base64 cipher: {e}")
    if len(blob) < _IV_LEN + 16:
        raise ValueError(f"cipher blob too short: {len(blob)} bytes")
    iv = blob[:_IV_LEN]
    ct_and_tag = blob[_IV_LEN:]
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(iv, ct_and_tag, associated_data=None)
    return json.loads(plaintext.decode("utf-8"))


def generate_key_b64() -> str:
    """生成一个新的 32 字节随机密钥(base64 编码),供用户初始化用。"""
    return base64.b64encode(secrets.token_bytes(_KEY_LEN)).decode("ascii")
