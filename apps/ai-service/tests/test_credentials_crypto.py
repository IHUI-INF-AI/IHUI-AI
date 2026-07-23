"""credentials_crypto.py 单元测试:AES-256-GCM 凭证加解密。

测试覆盖:
- 加解密往返(round-trip):encrypt → decrypt 还原原 dict
- 各种数据类型:空 dict / 嵌套 dict / 中文 / 特殊字符 / 大对象
- 密钥加载:环境变量 PUBLISH_CREDENTIALS_KEY 合法值 / 非法值 / 缺失降级临时密钥
- 单例缓存:_KEY 缓存,_get_key 多次调用返回同一密钥
- 异常路径:空字符串 / 非 base64 / 短 blob / 篡改密文 → decrypt 抛 ValueError
- generate_key_b64:返回合法 base64 + 32 字节解码
"""

from __future__ import annotations

import base64
import os
import secrets
from typing import Any

import pytest

from app.services.publish import credentials_crypto
from app.services.publish.credentials_crypto import (
    _KEY_LEN,
    _IV_LEN,
    _get_key,
    _load_key,
    decrypt,
    encrypt,
    generate_key_b64,
)


# =============================================================================
# 辅助:每个测试前重置单例 _KEY(避免上一个测试污染)
# =============================================================================


@pytest.fixture(autouse=True)
def _reset_key_singleton(monkeypatch):
    """每个测试前重置模块级 _KEY 单例,并清理环境变量。"""
    monkeypatch.delenv("PUBLISH_CREDENTIALS_KEY", raising=False)
    original = credentials_crypto._KEY
    credentials_crypto._KEY = None
    yield
    credentials_crypto._KEY = original


# =============================================================================
# 加解密往返(happy path)
# =============================================================================


def test_encrypt_decrypt_roundtrip_simple():
    """encrypt → decrypt 应还原原 dict。"""
    cred = {"token": "abc123", "user": "alice"}
    cipher = encrypt(cred)
    assert isinstance(cipher, str)
    assert cipher  # 非空
    restored = decrypt(cipher)
    assert restored == cred


def test_encrypt_decrypt_empty_dict():
    """空 dict 也能加解密。"""
    cipher = encrypt({})
    assert cipher
    assert decrypt(cipher) == {}


def test_encrypt_decrypt_nested_dict():
    """嵌套 dict 保留结构。"""
    cred = {
        "app_id": "12345",
        "app_secret": "secret",
        "tokens": {"access": "a1", "refresh": "r1"},
        "meta": {"owner": {"name": "alice", "id": 42}},
    }
    restored = decrypt(encrypt(cred))
    assert restored == cred
    assert restored["tokens"]["access"] == "a1"
    assert restored["meta"]["owner"]["id"] == 42


def test_encrypt_decrypt_chinese_content():
    """中文内容(UTF-8)加解密往返。"""
    cred = {"name": "小红", "desc": "测试凭证加密,包含中文"}
    restored = decrypt(encrypt(cred))
    assert restored == cred
    assert restored["name"] == "小红"


def test_encrypt_decrypt_special_characters():
    """特殊字符 / emoji / 引号 / 换行。"""
    cred = {
        "emoji": "🚀🔐",
        "quote": 'he said "hi"',
        "newline": "line1\nline2",
        "tab": "a\tb",
        "backslash": "C:\\\\path",
    }
    restored = decrypt(encrypt(cred))
    assert restored == cred


def test_encrypt_decrypt_large_object():
    """大对象(10KB 字符串)。"""
    cred = {"data": "x" * 10240}
    restored = decrypt(encrypt(cred))
    assert restored == cred
    assert len(restored["data"]) == 10240


def test_encrypt_returns_base64_ascii():
    """encrypt 返回值应为纯 ASCII base64 字符串。"""
    cipher = encrypt({"a": 1})
    # 应可被 base64 解码(allow decode)
    decoded = base64.b64decode(cipher, validate=True)
    assert isinstance(decoded, bytes)
    # ASCII 字符集
    assert all(ord(c) < 128 for c in cipher)


def test_encrypt_blob_structure_iv_plus_ct_plus_tag():
    """加密 blob 应为 iv(12B) + ciphertext + tag(16B),总长 > 28。"""
    cipher = encrypt({"k": "v"})
    blob = base64.b64decode(cipher)
    # iv(12) + tag(16) = 28,加上至少 1 字节明文,总长 > 28
    assert len(blob) > _IV_LEN + 16
    # iv 是前 12 字节
    iv = blob[:_IV_LEN]
    assert len(iv) == _IV_LEN


def test_encrypt_produces_different_ciphers_for_same_input():
    """同一明文两次加密应得到不同密文(随机 IV)。"""
    cred = {"x": 1}
    c1 = encrypt(cred)
    c2 = encrypt(cred)
    assert c1 != c2  # IV 随机
    # 但都能解回同一明文
    assert decrypt(c1) == cred
    assert decrypt(c2) == cred


# =============================================================================
# 密钥加载
# =============================================================================


def test_load_key_from_env_valid(monkeypatch):
    """合法 PUBLISH_CREDENTIALS_KEY(base64 编码 32 字节)应被使用。"""
    key_bytes = secrets.token_bytes(_KEY_LEN)
    monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", base64.b64encode(key_bytes).decode())
    loaded = _load_key()
    assert loaded == key_bytes
    assert len(loaded) == _KEY_LEN


def test_load_key_env_wrong_length_falls_back_to_ephemeral(monkeypatch):
    """环境变量值解码后非 32 字节 → 降级到临时密钥(并 warning)。"""
    # base64 编码 16 字节(过短)
    monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", base64.b64encode(b"0" * 16).decode())
    loaded = _load_key()
    assert len(loaded) == _KEY_LEN  # 仍是 32 字节(临时密钥)


def test_load_key_env_invalid_base64_falls_back(monkeypatch):
    """环境变量非合法 base64 → 降级到临时密钥。"""
    monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", "!!!not base64!!!")
    loaded = _load_key()
    assert len(loaded) == _KEY_LEN


def test_load_key_no_env_generates_ephemeral(monkeypatch):
    """无 PUBLISH_CREDENTIALS_KEY 时生成临时密钥。"""
    monkeypatch.delenv("PUBLISH_CREDENTIALS_KEY", raising=False)
    loaded = _load_key()
    assert len(loaded) == _KEY_LEN
    # 每次调用应不同(随机)
    other = _load_key()
    # 注意:两次随机应有极大概率不同
    assert loaded != other


def test_get_key_caches_singleton(monkeypatch):
    """_get_key 应缓存密钥,多次调用返回同一对象。"""
    monkeypatch.delenv("PUBLISH_CREDENTIALS_KEY", raising=False)
    k1 = _get_key()
    k2 = _get_key()
    assert k1 is k2  # 同一对象(缓存)


def test_encrypt_decrypt_with_explicit_env_key(monkeypatch):
    """显式设置环境变量后,加解密应使用该密钥。"""
    key_bytes = secrets.token_bytes(_KEY_LEN)
    monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", base64.b64encode(key_bytes).decode())
    cred = {"token": "xyz"}
    cipher = encrypt(cred)
    assert decrypt(cipher) == cred


def test_ephemeral_key_roundtrip_within_process():
    """临时密钥模式下,同进程内加解密仍可往返。"""
    cred = {"a": [1, 2, 3]}
    cipher = encrypt(cred)
    assert decrypt(cipher) == cred


# =============================================================================
# 异常路径
# =============================================================================


def test_decrypt_empty_string_raises_value_error():
    """空字符串 decrypt 应抛 ValueError。"""
    with pytest.raises(ValueError, match="empty cipher string"):
        decrypt("")


def test_decrypt_invalid_base64_raises_value_error():
    """非 base64 字符串 decrypt 应抛 ValueError(含 'invalid base64')。"""
    with pytest.raises(ValueError, match="invalid base64 cipher"):
        decrypt("!!!not base64!!!")


def test_decrypt_short_blob_raises_value_error():
    """解码后字节过短(< iv + tag)应抛 ValueError(含 'too short')。"""
    short_blob = base64.b64encode(b"short").decode()
    with pytest.raises(ValueError, match="cipher blob too short"):
        decrypt(short_blob)


def test_decrypt_tampered_ciphertext_raises():
    """篡改密文(改最后一个字节)应导致 GCM 认证失败(抛异常)。"""
    cred = {"k": "v"}
    cipher = encrypt(cred)
    blob = bytearray(base64.b64decode(cipher))
    # 翻转最后一个字节(tag 部分)
    blob[-1] ^= 0xFF
    tampered = base64.b64encode(bytes(blob)).decode()
    with pytest.raises(Exception):
        decrypt(tampered)


def test_decrypt_tampered_iv_raises():
    """篡改 IV 应导致 GCM 认证失败。"""
    cred = {"k": "v"}
    cipher = encrypt(cred)
    blob = bytearray(base64.b64decode(cipher))
    blob[0] ^= 0xFF  # 改 IV 第一字节
    tampered = base64.b64encode(bytes(blob)).decode()
    with pytest.raises(Exception):
        decrypt(tampered)


def test_decrypt_with_different_key_fails(monkeypatch):
    """用密钥 A 加密,切换到密钥 B 后解密应失败。"""
    # 密钥 A
    key_a = secrets.token_bytes(_KEY_LEN)
    monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", base64.b64encode(key_a).decode())
    credentials_crypto._KEY = None
    cipher = encrypt({"k": "v"})

    # 切换到密钥 B
    key_b = secrets.token_bytes(_KEY_LEN)
    monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", base64.b64encode(key_b).decode())
    credentials_crypto._KEY = None
    with pytest.raises(Exception):
        decrypt(cipher)


# =============================================================================
# generate_key_b64
# =============================================================================


def test_generate_key_b64_returns_valid_base64():
    """generate_key_b64 应返回可解码的 base64 字符串。"""
    k = generate_key_b64()
    assert isinstance(k, str)
    decoded = base64.b64decode(k, validate=True)
    assert len(decoded) == _KEY_LEN


def test_generate_key_b64_each_call_different():
    """每次调用 generate_key_b64 应返回不同的随机密钥。"""
    keys = {generate_key_b64() for _ in range(5)}
    assert len(keys) == 5  # 全部不同


def test_generate_key_b64_usable_as_env_key(monkeypatch):
    """generate_key_b64 的输出应可直接作为 PUBLISH_CREDENTIALS_KEY 使用。"""
    k = generate_key_b64()
    monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", k)
    credentials_crypto._KEY = None
    cred = {"token": "test"}
    assert decrypt(encrypt(cred)) == cred
