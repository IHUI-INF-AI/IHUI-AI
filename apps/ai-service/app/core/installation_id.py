# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/installation_id.py
"""安装实例 ID(2026-09-19 第二十七批,对标 Codex installation_id.rs)。

每台机器每份数据目录一个稳定 UUID,落盘 ``installation_id`` 文件:

- **文件锁**保证并发读取/生成不竞态(Windows msvcrt 整文件锁 /
  POSIX flock);
- **损坏自愈**:内容非法(非 UUID)时重写为新 UUID(Codex 同款,
  防手工编辑/截断导致的永久损坏);
- **大小写兼容**:已存 UUID 大写也能解析,统一返回小写规范形;
- POSIX 下权限规范化为 0644(Windows 无权限位,no-op)。
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Any

INSTALLATION_ID_FILENAME = "installation_id"


def _lock_file(f: Any) -> None:  # pragma: no cover - 平台分支
    if os.name == "nt":
        import msvcrt

        msvcrt.locking(f.fileno(), msvcrt.LK_LOCK, 1)
    else:
        import fcntl

        fcntl.flock(f.fileno(), fcntl.LOCK_EX)  # type: ignore[attr-defined]


def _unlock_file(f: Any) -> None:  # pragma: no cover - 平台分支
    if os.name == "nt":
        import msvcrt

        try:
            f.seek(0)
            msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)
        except OSError:
            pass
    else:
        import fcntl

        fcntl.flock(f.fileno(), fcntl.LOCK_UN)  # type: ignore[attr-defined]


def resolve_installation_id(base_dir: Path, filename: str = INSTALLATION_ID_FILENAME) -> str:
    """读取或生成安装实例 ID(原子落盘,损坏自愈)。"""
    base_dir = Path(base_dir)
    base_dir.mkdir(parents=True, exist_ok=True)
    path = base_dir / filename

    with open(path, "a+b") as f:
        _lock_file(f)
        try:
            f.seek(0)
            contents = f.read().decode("utf-8", errors="replace").strip()
            try:
                existing = uuid.UUID(contents)
                return str(existing)
            except (ValueError, AttributeError):
                pass

            installation_id = str(uuid.uuid4())
            f.seek(0)
            f.truncate()
            f.write(installation_id.encode("ascii"))
            f.flush()
            os.fsync(f.fileno())
            if os.name != "nt":
                # 权限规范化 0644(POSIX)
                try:
                    os.chmod(path, 0o644)
                except OSError:
                    pass
            return installation_id
        finally:
            _unlock_file(f)


_cached_id: str | None = None


def resolve_installation_id_cached(base_dir: Path) -> str:
    """进程内缓存版(同目录重复调用零 IO;对标 Codex 一次解析多处使用)。"""
    global _cached_id
    if _cached_id is None:
        _cached_id = resolve_installation_id(base_dir)
    return _cached_id
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
