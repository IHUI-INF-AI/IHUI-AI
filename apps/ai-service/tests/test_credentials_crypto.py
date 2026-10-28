# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""credentials_crypto.py 单元测试:AES-256-GCM 凭证加解密。

测试覆盖:
- 加解密往返(round-trip):encrypt → decrypt 还原原 dict
- 各种数据类型:空 dict / 嵌套 dict / 中文 / 特殊字符 / 大对象
- 密钥加载:环境变量 PUBLISH_CREDENTIALS_KEY 合法值 / 非法值 / 缺失降级临时密钥
- **密钥路径锚定**:`_KEY_FILE` 必须是绝对路径,不随 cwd 漂移(静默失效第 8 例)
- **解密环**:换过密钥/换过启动目录后,旧密文仍能读;新密文只许用主密钥加密
- 单例缓存:_KEY 缓存,_get_key 多次调用返回同一密钥
- 异常路径:空字符串 / 非 base64 / 短 blob / 篡改密文 → decrypt 抛 ValueError
- generate_key_b64:返回合法 base64 + 32 字节解码
"""

from __future__ import annotations

import base64
import inspect
import os
import secrets

import pytest
from cryptography.exceptions import InvalidTag

from app.services.publish import credentials_crypto
from app.services.publish.credentials_crypto import (
    _IV_LEN,
    _KEY_LEN,
    _get_key,
    _load_keys,
    decrypt,
    encrypt,
    generate_key_b64,
    key_fingerprint,
    key_ring_size,
    key_source,
)

# =============================================================================
# 辅助:每个测试前重置单例 _KEY(避免上一个测试污染)
# =============================================================================


@pytest.fixture(autouse=True)
def _reset_key_singleton(monkeypatch, tmp_path):
    """每个测试前重置模块级密钥缓存,并把密钥面**完全封闭**到 tmp。

    必须做两件事,否则测试就是"看开发机脸色":
    1. `_LEGACY_KEY_FILES` 置空 —— 它是 cwd 相对的,不清掉会读到仓库根那把真实密钥;
    2. `_KEY_FILE` 指到 tmp —— 否则真实密钥文件会被当成解密环的一把钥混进来,
       连"换密钥应失败"这类断言都会因为环里多了一把而改变异常类型。
    """
    monkeypatch.delenv("PUBLISH_CREDENTIALS_KEY", raising=False)
    monkeypatch.delenv("PUBLISH_CREDENTIALS_KEY_LEGACY", raising=False)
    monkeypatch.setattr(credentials_crypto, "_LEGACY_KEY_FILES", ())
    monkeypatch.setattr(credentials_crypto, "_KEY_FILE", str(tmp_path / "credentials_key"))
    original = (credentials_crypto._KEY, credentials_crypto._LEGACY_KEYS)
    credentials_crypto._KEY = None
    credentials_crypto._LEGACY_KEYS = []
    yield
    credentials_crypto._KEY, credentials_crypto._LEGACY_KEYS = original


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
    loaded = _load_keys()[0]
    assert loaded == key_bytes
    assert len(loaded) == _KEY_LEN


def test_load_key_env_wrong_length_falls_back_to_key_file(monkeypatch, tmp_path):
    """环境变量值解码后非 32 字节 → 降级到持久化密钥文件。"""
    # base64 编码 16 字节(过短)
    monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", base64.b64encode(b"0" * 16).decode())
    monkeypatch.setattr(credentials_crypto, "_KEY_FILE", str(tmp_path / "credentials_key"))
    loaded = _load_keys()[0]
    assert len(loaded) == _KEY_LEN  # 仍是 32 字节


def test_load_key_env_invalid_base64_falls_back(monkeypatch, tmp_path):
    """环境变量非合法 base64 → 降级到持久化密钥文件。"""
    monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", "!!!not base64!!!")
    monkeypatch.setattr(credentials_crypto, "_KEY_FILE", str(tmp_path / "credentials_key"))
    loaded = _load_keys()[0]
    assert len(loaded) == _KEY_LEN


def test_load_key_no_env_persists_to_key_file(monkeypatch, tmp_path):
    """无 PUBLISH_CREDENTIALS_KEY 时首次生成密钥并落盘,重启(重新加载)后复用。"""
    monkeypatch.delenv("PUBLISH_CREDENTIALS_KEY", raising=False)
    key_file = tmp_path / "credentials_key"
    monkeypatch.setattr(credentials_crypto, "_KEY_FILE", str(key_file))
    first = _load_keys()[0]
    assert len(first) == _KEY_LEN
    assert key_file.exists()  # 已落盘
    # 模拟重启:重新加载应读到同一密钥(历史密文可解密)
    second = _load_keys()[0]
    assert first == second


def test_load_key_reuses_existing_key_file(monkeypatch, tmp_path):
    """key file 已存在时直接复用(不重新生成)。"""
    monkeypatch.delenv("PUBLISH_CREDENTIALS_KEY", raising=False)
    key_file = tmp_path / "credentials_key"
    existing = secrets.token_bytes(_KEY_LEN)
    key_file.write_bytes(existing)
    monkeypatch.setattr(credentials_crypto, "_KEY_FILE", str(key_file))
    assert _load_keys()[0] == existing


# =============================================================================
# 密钥路径锚定(回归:静默失效第 8 例)
# =============================================================================


def test_key_file_is_absolute_path() -> None:
    """`_KEY_FILE` 必须是绝对路径 —— 相对路径 = 换个启动目录就换把钥。"""
    assert os.path.isabs(credentials_crypto._KEY_FILE)


def test_key_file_never_derived_from_cwd() -> None:
    """形状锁:可执行代码里不许再出现 cwd 相对的密钥路径构造。

    docstring **和注释**里都会提到旧写法(解释为什么改),所以剥掉 docstring、
    再去掉行末注释后才断言 —— 否则锁会把"说明文字"当"代码"误杀。
    """
    source = inspect.getsource(credentials_crypto)
    parts = source.split('"""')
    code = "".join(part for i, part in enumerate(parts) if i % 2 == 0)
    code = "\n".join(line.split("#", 1)[0] for line in code.splitlines())
    assert 'os.path.join("data"' not in code
    assert "os.path.join('data'" not in code


def test_same_key_regardless_of_cwd(monkeypatch, tmp_path) -> None:
    """换 cwd 前后读到同一把主密钥(锚定的功能证明,不只靠路径字面量)。"""
    key_file = tmp_path / "svc" / "data" / "credentials_key"
    key_file.parent.mkdir(parents=True, exist_ok=True)
    secret = secrets.token_bytes(_KEY_LEN)
    key_file.write_bytes(secret)
    monkeypatch.setattr(credentials_crypto, "_KEY_FILE", str(key_file))

    other = tmp_path / "elsewhere"
    other.mkdir()
    first = _load_keys()[0]
    monkeypatch.chdir(other)
    second = _load_keys()[0]
    assert first == second == secret


# =============================================================================
# 解密环(密钥轮换 / 换过启动目录后,历史密文不许变成死数据)
# =============================================================================


def test_legacy_key_file_decrypts_old_ciphertext(monkeypatch, tmp_path) -> None:
    """主密钥换新后,旧文件里的密文仍能解开;新密文只用主密钥。"""
    old_file = tmp_path / "old" / "credentials_key"
    new_file = tmp_path / "new" / "credentials_key"
    old_file.parent.mkdir(parents=True)
    new_file.parent.mkdir(parents=True)
    old_file.write_bytes(secrets.token_bytes(_KEY_LEN))
    new_file.write_bytes(secrets.token_bytes(_KEY_LEN))

    # ① 用旧密钥加密
    monkeypatch.setattr(credentials_crypto, "_KEY_FILE", str(old_file))
    credentials_crypto._KEY = None
    credentials_crypto._LEGACY_KEYS = []
    old_cipher = encrypt({"token": "old"})

    # ② 换新主密钥,旧文件降级为解密环
    monkeypatch.setattr(credentials_crypto, "_KEY_FILE", str(new_file))
    monkeypatch.setattr(credentials_crypto, "_LEGACY_KEY_FILES", (str(old_file),))
    credentials_crypto._KEY = None
    credentials_crypto._LEGACY_KEYS = []
    assert decrypt(old_cipher) == {"token": "old"}
    assert key_ring_size() == 1

    # ③ 新密文必须能被"只有主密钥"的进程解开(证明加密没用旧钥)
    fresh = encrypt({"token": "new"})
    monkeypatch.setattr(credentials_crypto, "_LEGACY_KEY_FILES", ())
    credentials_crypto._KEY = None
    credentials_crypto._LEGACY_KEYS = []
    assert decrypt(fresh) == {"token": "new"}


def test_env_legacy_key_is_decrypt_only(monkeypatch, tmp_path) -> None:
    """`PUBLISH_CREDENTIALS_KEY_LEGACY` 只参与解密,不参与加密。"""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    old_key = secrets.token_bytes(_KEY_LEN)
    new_key = secrets.token_bytes(_KEY_LEN)
    monkeypatch.setattr(credentials_crypto, "_KEY_FILE", str(tmp_path / "credentials_key"))
    monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", base64.b64encode(new_key).decode())
    monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY_LEGACY", base64.b64encode(old_key).decode())

    iv = secrets.token_bytes(_IV_LEN)
    blob = iv + AESGCM(old_key).encrypt(iv, b'{"token": "legacy"}', None)
    assert decrypt(base64.b64encode(blob).decode()) == {"token": "legacy"}
    assert key_ring_size() == 1
    assert _get_key() == new_key


def test_decrypt_reports_key_mismatch_when_ring_exhausted(monkeypatch, tmp_path) -> None:
    """有解密环却全都不匹配时,报错要点明"密钥不匹配"(上层据此归"需重录")。

    注意:无解密环时仍抛底层 ``InvalidTag``(见上面的篡改密文用例),两种契约
    故意不同 —— 有环时单抛 InvalidTag 会让人以为密文坏了。
    """
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    primary_file = tmp_path / "primary" / "credentials_key"
    legacy_file = tmp_path / "legacy" / "credentials_key"
    primary_file.parent.mkdir(parents=True)
    legacy_file.parent.mkdir(parents=True)
    primary_file.write_bytes(secrets.token_bytes(_KEY_LEN))
    legacy_file.write_bytes(secrets.token_bytes(_KEY_LEN))

    monkeypatch.setattr(credentials_crypto, "_KEY_FILE", str(primary_file))
    monkeypatch.setattr(credentials_crypto, "_LEGACY_KEY_FILES", (str(legacy_file),))
    credentials_crypto._KEY = None
    credentials_crypto._LEGACY_KEYS = []

    foreign = secrets.token_bytes(_KEY_LEN)
    iv = secrets.token_bytes(_IV_LEN)
    blob = iv + AESGCM(foreign).encrypt(iv, b'{"token": "x"}', None)
    with pytest.raises(ValueError, match="密钥不匹配"):
        decrypt(base64.b64encode(blob).decode())


def test_key_source_reports_origin(monkeypatch, tmp_path) -> None:
    """主密钥来源要能在日志/排障里看清:env / 文件 / 新生成。"""
    monkeypatch.setattr(credentials_crypto, "_KEY_FILE", str(tmp_path / "credentials_key"))
    credentials_crypto._KEY = None
    assert key_source() == "generated"
    assert os.path.exists(str(tmp_path / "credentials_key"))
    assert len(key_fingerprint()) == 12

    credentials_crypto._KEY = None
    assert key_source() == str(tmp_path / "credentials_key")


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
    with pytest.raises(InvalidTag):
        decrypt(tampered)


def test_decrypt_tampered_iv_raises():
    """篡改 IV 应导致 GCM 认证失败。"""
    cred = {"k": "v"}
    cipher = encrypt(cred)
    blob = bytearray(base64.b64decode(cipher))
    blob[0] ^= 0xFF  # 改 IV 第一字节
    tampered = base64.b64encode(bytes(blob)).decode()
    with pytest.raises(InvalidTag):
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
    with pytest.raises(InvalidTag):
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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
