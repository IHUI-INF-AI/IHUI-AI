# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Browser Hub 会话存储状态的加密落盘(2026-11-26 立)。

浏览器会话要跨 AI-SERVICE 重启保留登录态,就必须保存 Playwright 的
``context.storage_state()``(Cookie + localStorage)。这份数据等价于账号凭据,
不能和普通会话元数据一样明文写进 JSON。

- 密钥单独落在 ``apps/ai-service/.data/browser-state.key``(gitignored,0600);
- 可用 ``IHUI_BROWSER_STATE_KEY_PATH`` 改路径,便于测试与多环境隔离;
- 会话 JSON 里只存 Fernet 密文;解密失败时返回 ``None``,不把坏密文当空状态,
  否则会用未登录页面覆盖原记录,造成"重启后登录态凭空消失"。
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

_ENV_KEY_PATH = "IHUI_BROWSER_STATE_KEY_PATH"
_MAX_STATE_BYTES = 2 * 1024 * 1024
_KEY_LOCK = threading.RLock()


class StorageStateError(ValueError):
    """存储状态无法加密/解密;调用方按"保留旧记录"处理,不能覆盖。"""


def _key_path() -> Path:
    configured = os.environ.get(_ENV_KEY_PATH, "").strip()
    if configured:
        return Path(configured).expanduser()
    return Path(__file__).resolve().parents[2] / ".data" / "browser-state.key"


def _read_key(path: Path) -> bytes:
    try:
        key = path.read_text(encoding="utf-8").strip().encode("utf-8")
    except OSError as exc:
        raise StorageStateError(f"浏览器状态密钥不可读: {exc}") from exc
    if not key:
        raise StorageStateError("浏览器状态密钥为空")
    return key


def _load_or_create_key() -> bytes:
    path = _key_path()
    with _KEY_LOCK:
        if path.exists():
            return _read_key(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        key = Fernet.generate_key()
        try:
            fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            return _read_key(path)
        try:
            os.write(fd, key)
        finally:
            os.close(fd)
        try:
            os.chmod(path, 0o600)
        except OSError:
            # Windows 上 chmod 可能只改只读位;真正的隔离由服务账号/目录 ACL 承担。
            pass
        return key


def encrypt_storage_state(state: dict[str, Any]) -> str:
    """把 Playwright storage_state 加密封装成可写 JSON 的字符串。"""
    if not isinstance(state, dict):
        raise StorageStateError("storage_state 必须是对象")
    raw = json.dumps(state, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(raw) > _MAX_STATE_BYTES:
        raise StorageStateError(
            f"storage_state 超过 {_MAX_STATE_BYTES // 1024}KB,拒绝落盘"
        )
    try:
        return Fernet(_load_or_create_key()).encrypt(raw).decode("utf-8")
    except (OSError, ValueError) as exc:
        raise StorageStateError(f"storage_state 加密失败: {exc}") from exc


def decrypt_storage_state(token: str) -> dict[str, Any]:
    """解密 storage_state;坏密文抛错,由调用方决定保留旧记录还是跳过。"""
    if not token:
        raise StorageStateError("storage_state 密文为空")
    try:
        raw = Fernet(_load_or_create_key()).decrypt(token.encode("utf-8"))
    except (InvalidToken, OSError, ValueError) as exc:
        raise StorageStateError(f"storage_state 解密失败: {exc}") from exc
    try:
        state = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise StorageStateError(f"storage_state 内容损坏: {exc}") from exc
    if not isinstance(state, dict):
        raise StorageStateError("storage_state 内容不是对象")
    return state
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
