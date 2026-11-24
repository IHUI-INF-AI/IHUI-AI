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
from collections.abc import Callable, Iterable, Sequence
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


class AccessGuard:
    """一次装载、多次判定的访问闸。

    检索/枚举面按**同一批根**连续判几千条路径,逐条 `check_access()` 会重复
    stat 规则文件;这里把每个根的 `IgnoreSet` 装一次,之后只做纯正则求值。
    规则文件在长扫描中途被改,本闸保持扫描开始时的快照 —— 与一次工具调用的
    输入一致,下一次工具调用重新装载。
    """

    __slots__ = ("roots", "_sets")

    def __init__(self, roots: Sequence[str | os.PathLike[str]]) -> None:
        resolved: list[Path] = []
        for raw in roots:
            try:
                root = Path(raw).resolve(strict=False)
            except OSError:
                continue
            if root not in resolved:
                resolved.append(root)
        self.roots = tuple(resolved)
        self._sets = tuple(load_access_ignore(root) for root in self.roots)

    @staticmethod
    def _denial(
        root: Path, rel: str, ignore: IgnoreSet
    ) -> AccessDenial | None:
        if ignore.errors:
            return AccessDenial(root=root, rel=rel, rule=None, errors=tuple(ignore.errors))
        denied, rule = is_ignored(normalize_rel_path(rel), ignore)
        if not denied:
            return None
        return AccessDenial(root=root, rel=rel, rule=rule, errors=())

    def denial_for_resolved(
        self, resolved_path: str | os.PathLike[str]
    ) -> AccessDenial | None:
        resolved = Path(resolved_path).resolve(strict=False)
        for root, ignore in zip(self.roots, self._sets, strict=True):
            if not resolved.is_relative_to(root):
                continue
            try:
                rel = resolved.relative_to(root).as_posix()
            except ValueError:
                continue
            denial = self._denial(root, rel, ignore)
            if denial is not None:
                return denial
        return None

    def denial_for_relative(self, rel: str) -> AccessDenial | None:
        """索引切片只带仓库相对路径时使用;逐个根按同一相对路径求值。"""
        norm = normalize_rel_path(rel)
        for root, ignore in zip(self.roots, self._sets, strict=True):
            denial = self._denial(root, norm, ignore)
            if denial is not None:
                return denial
        return None

    def denial_for_path(self, raw_path: str | os.PathLike[str]) -> AccessDenial | None:
        raw = os.fspath(raw_path)
        if not raw.strip():
            return None
        path = Path(raw)
        if path.is_absolute():
            return self.denial_for_resolved(path)
        return self.denial_for_relative(raw)


def filter_denied_items[T](
    items: Iterable[T],
    *,
    roots: Sequence[str | os.PathLike[str]],
    path_of: Callable[[T], str | os.PathLike[str] | None],
    max_denied: int = 20,
) -> tuple[list[T], list[AccessDenial], int]:
    """过滤被 `.cursorignore` 拒绝的条目。

    返回 `(保留项, 拒绝样本, 拒绝总数)`。样本有上限,计数不截断 ——
    检索面要能报"这次滤掉了几条",又不能把上千条拒绝清单塞进上下文。
    """
    guard = AccessGuard(roots)
    kept: list[T] = []
    denied: list[AccessDenial] = []
    denied_count = 0
    for item in items:
        raw = path_of(item)
        if raw is None:
            kept.append(item)
            continue
        denial = guard.denial_for_path(raw)
        if denial is None:
            kept.append(item)
            continue
        denied_count += 1
        if len(denied) < max_denied:
            denied.append(denial)
    return kept, denied, denied_count


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
    return AccessGuard(roots).denial_for_resolved(resolved_path)


__all__ = [
    "ACCESS_IGNORE_FILENAMES",
    "CURSORIGNORE_FILENAME",
    "AccessDenial",
    "AccessGuard",
    "access_denied_for_resolved",
    "check_access",
    "filter_denied_items",
    "load_access_ignore",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
