# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`.cursorignore` 访问面判据(2026-11-24 产品定档:AI 不许读写)。

此前刻意没并入索引剪枝,理由是"隐私语义未定档"。定档后的口径只有一句:
**`.cursorignore` 命中 = AI 不许读、不许写、不许进索引**;仓库树渲染与
`list_files` 仍可见文件名(与 Cursor 一致:看得见路径,拿不到内容)。

与 `.cursorindexingignore` 的分工:

- `.cursorindexingignore` 只影响索引/检索取材面,不影响读文件;
- `.cursorignore` 同时是访问面 deny:读/写/编辑/影子事务/索引全部拒。

实现边界:
- 只认**工作区根**的 `.cursorignore`(Cursor 文档形态);嵌套规则不扫,避免把
  node_modules 里的第三方 `.cursorignore` 当成自己的隐私规则。
- 规则文件读不动 ⇒ 不静默放行:返回的 `IgnoreSet.errors` 由调用方决定是否放行。
  本模块默认 fail-closed(读不动时 `denied` 的第三态由调用方处理;见 `check_access`)。
- 命中出处随拒绝结果返回(`file:line`),让"为什么这枚读不到"可解释。
"""

from __future__ import annotations

import os
from collections.abc import Sequence
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.services.ignore_rules import (
    IgnoreRule,
    IgnoreSet,
    is_ignored,
    load_ignore_set,
    normalize_rel_path,
)

CURSORIGNORE_FILENAME = ".cursorignore"
ACCESS_IGNORE_FILENAMES: tuple[str, ...] = (CURSORIGNORE_FILENAME,)


@dataclass(frozen=True)
class AccessDenial:
    """一次访问拒绝的完整出处:命中规则或规则文件读不动。"""

    root: Path
    rel: str
    rule: IgnoreRule | None
    errors: tuple[str, ...]

    @property
    def where(self) -> str:
        if self.rule is not None:
            return self.rule.where()
        return f"{CURSORIGNORE_FILENAME}:unreadable"


@lru_cache(maxsize=128)
def _load_cached(root: str, signature: tuple[int, int]) -> IgnoreSet:
    """root + (mtime,size) 缓存;签名变了自然重读,不另造失效表。"""
    del signature
    return load_ignore_set(Path(root), filenames=ACCESS_IGNORE_FILENAMES, max_depth=0)


def load_access_ignore(root: Path) -> IgnoreSet:
    path = root / CURSORIGNORE_FILENAME
    try:
        stat = path.stat()
    except OSError:
        return IgnoreSet()
    return _load_cached(str(root), (stat.st_mtime_ns, stat.st_size))


def check_access(root: Path, rel: str) -> tuple[bool, IgnoreRule | None, list[str]]:
    """返回 (是否拒绝, 命中的规则, 规则文件错误清单)。

    规则文件存在但读不动时 `errors` 非空 ⇒ **整根 fail-closed 拒绝**(规则名单
    不完整时放行等于拿隐私赌一次 IO);命中出处退化为 `cursorignore:unreadable`。
    """
    ignore = load_access_ignore(root)
    norm = normalize_rel_path(rel)
    if ignore.errors:
        return True, None, list(ignore.errors)
    denied, rule = is_ignored(norm, ignore)
    return denied, rule, []


def access_denied_for_resolved(
    resolved_path: str | os.PathLike[str], roots: Sequence[str]
) -> AccessDenial | None:
    """绝对路径 → 落在哪个根下、相对路径、拒绝出处;未命中返回 None。"""
    resolved = Path(resolved_path).resolve(strict=False)
    for raw_root in roots:
        root = Path(raw_root).resolve(strict=False)
        if not resolved.is_relative_to(root):
            continue
        try:
            rel = resolved.relative_to(root).as_posix()
        except ValueError:
            continue
        denied, rule, errors = check_access(root, rel)
        if denied:
            return AccessDenial(root=root, rel=rel, rule=rule, errors=tuple(errors))
    return None


__all__ = [
    "ACCESS_IGNORE_FILENAMES",
    "CURSORIGNORE_FILENAME",
    "AccessDenial",
    "access_denied_for_resolved",
    "check_access",
    "load_access_ignore",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
