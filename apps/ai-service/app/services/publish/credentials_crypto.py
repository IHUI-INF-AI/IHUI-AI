# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import hashlib
import json
import os
import secrets
from pathlib import Path
from typing import Any, cast

from app.core.logging import get_logger

logger = get_logger(__name__)

_KEY_ENV = "PUBLISH_CREDENTIALS_KEY"
# 轮换期旧密钥(逗号分隔的 base64),**仅用于解密**历史密文,绝不用于加密。
_LEGACY_ENV = "PUBLISH_CREDENTIALS_KEY_LEGACY"
# 12 字节 IV(GCM 推荐值)
_IV_LEN = 12
# 32 字节密钥(AES-256)
_KEY_LEN = 32

# 密钥文件路径**锚定到服务根**,不跟 cwd 走 —— 2026-10-26 修的静默失效第 8 例。
#
# 原实现是 os.path.join("data", "credentials_key")(相对路径)⇒ 从仓库根启动与从
# apps/ai-service 启动会读到**两个不同的文件**;而文件不存在时会**静默新建一把**,
# 等于"换一次启动目录 = 全部历史密文作废",且全程零报错。本机实测到该后果:
#   data/credentials_key              mtime 2026-09-29 14:49
#   apps/ai-service/data/credentials_key  mtime 2026-10-20 14:16
# 两把内容不同,21 行 publish 凭证**两把都解不开**(原加密密钥已不在盘上)。
_SERVICE_ROOT = Path(__file__).resolve().parents[3]
_KEY_FILE = str(_SERVICE_ROOT / "data" / "credentials_key")

# 旧实现留下的 cwd 相对位置:只读、永不写入。
# 存在的历史密钥进**解密环**,保证"换了启动目录"不再等于"历史密文全丢"。
_LEGACY_KEY_FILES = ("data/credentials_key",)


def _decode_env_key(name: str) -> bytes | None:
    """读环境变量里的 base64 密钥;非法/长度不对返回 None(调用方决定降级)。"""
    raw = os.environ.get(name, "").strip()
    if not raw:
        return None
    try:
        key = base64.b64decode(raw, validate=True)
    except Exception as e:  # noqa: BLE001 —— 配置错误一律降级,不让服务起不来
        logger.warning("[credentials_crypto] invalid %s: %s", name, e)
        return None
    if len(key) != _KEY_LEN:
        logger.warning(
            "[credentials_crypto] %s must be %d bytes after base64 decode, got %d",
            name, _KEY_LEN, len(key),
        )
        return None
    return key


def _read_key_file(path: str) -> bytes | None:
    """读密钥文件;不存在/长度不对/不可读都返回 None(逐条 warn,不抛)。"""
    try:
        with open(path, "rb") as f:
            key = f.read()
    except FileNotFoundError:
        return None
    except OSError as e:
        logger.warning("[credentials_crypto] key file unreadable (%s): %s", path, e)
        return None
    if len(key) != _KEY_LEN:
        logger.warning(
            "[credentials_crypto] key file %s invalid (%d bytes), ignored.", path, len(key)
        )
        return None
    return key


def _candidate_key_files() -> list[str]:
    """主位置在前,旧(cwd 相对)位置在后;绝对化后去重。"""
    out = [_KEY_FILE]
    for rel in _LEGACY_KEY_FILES:
        path = os.path.abspath(rel)
        if path not in out:
            out.append(path)
    return out


def _load_keys() -> tuple[bytes, list[bytes], str]:
    """加载 (主密钥, 解密环旧密钥, 主密钥来源说明)。

    主密钥选取顺序:``PUBLISH_CREDENTIALS_KEY`` → 锚定位置密钥文件 → 生成新密钥。
    其余能读到的历史密钥(``_LEGACY_ENV``、旧 cwd 位置)只进解密环。

    为什么要有解密环:密钥轮换/换启动目录这类事**一定会再发生**,而 AES-GCM
    一旦主密钥变了,历史密文就只会抛 InvalidTag。把旧密钥留在环里,轮换就只是
    "新数据用新钥、老数据照旧能读",不再是一次性把所有账号打哑。
    """
    legacy: list[bytes] = []

    env_legacy = os.environ.get(_LEGACY_ENV, "").strip()
    for part in env_legacy.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            k = base64.b64decode(part, validate=True)
        except Exception as e:  # noqa: BLE001
            logger.warning("[credentials_crypto] invalid %s entry: %s", _LEGACY_ENV, e)
            continue
        if len(k) == _KEY_LEN:
            legacy.append(k)
        else:
            logger.warning("[credentials_crypto] %s entry wrong length: %d", _LEGACY_ENV, len(k))

    file_primary: bytes | None = None
    for path in _candidate_key_files():
        key = _read_key_file(path)
        if key is None:
            continue
        if file_primary is None:
            file_primary = key
        elif key != file_primary:
            legacy.append(key)
            logger.warning(
                "[credentials_crypto] 发现第二把历史密钥 %s,已加入解密环(不用于加密)。"
                "两处并存说明本机曾换过启动目录 —— 建议只保留 %s。",
                path, _KEY_FILE,
            )

    env_key = _decode_env_key(_KEY_ENV)
    if env_key is not None:
        primary, source = env_key, f"env {_KEY_ENV}"
        if file_primary is not None and file_primary != env_key:
            legacy.append(file_primary)
    elif file_primary is not None:
        primary, source = file_primary, _KEY_FILE
    else:
        primary = secrets.token_bytes(_KEY_LEN)
        source = "generated"
        try:
            os.makedirs(os.path.dirname(_KEY_FILE), exist_ok=True)
            with open(_KEY_FILE, "wb") as f:
                f.write(primary)
            logger.warning(
                "[credentials_crypto] %s 未设置且无历史密钥文件,已生成新的持久化密钥 %s。"
                "注意:此前用别的密钥加密的密文将无法解密(需重新录入)。生产请显式设置 %s。",
                _KEY_ENV, _KEY_FILE, _KEY_ENV,
            )
        except OSError as e:
            logger.warning(
                "[credentials_crypto] %s 未设置且密钥文件不可写(%s)。使用进程内临时密钥"
                "(RESTART = DATA LOSS)。",
                _KEY_ENV, e,
            )

    ring: list[bytes] = []
    for k in legacy:
        if k != primary and k not in ring:
            ring.append(k)
    return primary, ring, source


# 进程级单例(避免每次加解密都重读环境变量/密钥文件)
_KEY: bytes | None = None
_LEGACY_KEYS: list[bytes] = []
_KEY_SOURCE: str = ""


def _get_keys() -> tuple[bytes, list[bytes]]:
    global _KEY, _LEGACY_KEYS, _KEY_SOURCE
    if _KEY is None:
        _KEY, _LEGACY_KEYS, _KEY_SOURCE = _load_keys()
        logger.info(
            "[credentials_crypto] 主密钥来源=%s 指纹=%s 解密环=%d 把",
            _KEY_SOURCE, key_fingerprint(), len(_LEGACY_KEYS),
        )
    return _KEY, _LEGACY_KEYS


def key_fingerprint() -> str:
    """主密钥指纹(sha256 前 12 位十六进制),用于日志/排障时确认"是不是同一把钥"。

    只暴露摘要,不暴露密钥本身 —— 指纹相同即同钥,便于比对两台机/两次启动。
    """
    key = _get_key()
    return hashlib.sha256(key).hexdigest()[:12]


def key_source() -> str:
    """主密钥来源:``env PUBLISH_CREDENTIALS_KEY`` / 文件路径 / ``generated``。"""
    _get_keys()
    return _KEY_SOURCE


def key_ring_size() -> int:
    """解密环里旧密钥的把数(0 表示没有可用的历史密钥)。"""
    return len(_get_keys()[1])


def _get_key() -> bytes:
    return _get_keys()[0]


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
    """解密 base64 字符串 → 凭证 dict。

    主密钥解不开时**依次试解密环里的旧密钥**(密钥轮换/换过启动目录的历史数据)。
    全部失败时:无解密环 → 原样抛底层 ``InvalidTag``;有解密环 → 抛 ``ValueError``
    并点明"密钥不匹配"。两种都表示数据读不出来,区别只在现场信息的取舍。
    """
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    if not cipher_str:
        raise ValueError("empty cipher string")
    try:
        blob = base64.b64decode(cipher_str, validate=True)
    except Exception as e:
        raise ValueError(f"invalid base64 cipher: {e}")
    if len(blob) < _IV_LEN + 16:
        raise ValueError(f"cipher blob too short: {len(blob)} bytes")
    iv = blob[:_IV_LEN]
    ct_and_tag = blob[_IV_LEN:]

    primary, legacy = _get_keys()
    last_exc: Exception | None = None
    for idx, key in enumerate([primary, *legacy]):
        try:
            plaintext = AESGCM(key).decrypt(iv, ct_and_tag, associated_data=None)
        except Exception as e:  # noqa: BLE001 —— 换下一把钥,全部失败才算真失败
            last_exc = e
            continue
        if idx > 0:
            logger.warning(
                "[credentials_crypto] 该密文由解密环第 %d 把旧密钥解开(主密钥不匹配)。"
                "建议尽快用主密钥重写该行,否则删掉旧密钥后即不可读。",
                idx,
            )
        return cast(dict[str, Any], json.loads(plaintext.decode("utf-8")))

    # 失败时的异常类型分两种,故意不一样:
    # - **无解密环**:原样抛底层 InvalidTag —— 保持历史契约,调用方/测试区分得出
    #   "密文被篡改/损坏"与"配置问题"。
    # - **有解密环**:只抛 InvalidTag 会误导(读者以为是密文坏了,其实是环里也没有
    #   这把钥)。换成点名"密钥不匹配"的 ValueError,并链上原始异常保完整现场。
    if legacy and last_exc is not None:
        raise ValueError(
            f"凭证解密失败: 主密钥与 {len(legacy)} 把历史密钥均不匹配(密钥不匹配或密文损坏)"
        ) from last_exc
    if last_exc is not None:
        raise last_exc
    raise ValueError("empty cipher string")


def generate_key_b64() -> str:
    """生成一个新的 32 字节随机密钥(base64 编码),供用户初始化用。"""
    return base64.b64encode(secrets.token_bytes(_KEY_LEN)).decode("ascii")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
