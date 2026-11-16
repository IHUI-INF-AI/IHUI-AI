# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工作区变更解析 — 复现 DeepSeek dsh-workspace-changes 的纯解析函数。

取证来源
--------
``.ihui-agent/tmp/dsh-src/dsh-workspace-changes/src/{numstat,paths}.ts``（完整直读）::

    parseNumstat(output): 解析 ``git diff-tree -r -M -z --numstat`` 输出。
      NUL 终止; 仅前两个 TAB 分隔字段（文件名可含 TAB）; rename 记录:
      空路径字段 + old path + new path; added/deleted 为 '-' 表二进制 → 0 + binary=true。

    toPosix / isInside / displayPathOf / durablePathOf / compareDisplay:
      路径归一与展示形态（slash 分隔; cwd/root 内相对、home 内 ~/、否则绝对;
      display 按 code-unit 排序, 使 ../ 与绝对路径排在字母前）。

对照 IHUI 缺口
--------------
IHUI 无 git numstat 解析（workspace_index_policy / ai_code_attribution_git /
workspace_roots 均未含）。本模块补齐 numstat 解析 + 路径分类纯函数。

设计要点（纯函数, 零 IO）
------------------------
1. ``parse_numstat``: NUL 终止 numstat 记录 → 结构化条目（含 rename/binary）;
2. ``to_posix`` / ``is_inside``: 路径归一 + 包含判断;
3. ``display_path_of`` / ``durable_path_of`` / ``compare_display``: 展示与排序。
"""

from __future__ import annotations

import posixpath
from dataclasses import dataclass


@dataclass(frozen=True)
class NumstatEntry:
    """一条 ``--numstat`` 记录（路径 slash 分隔, 相对仓库根）。"""

    path: str
    added: int
    deleted: int
    binary: bool
    old_path: str | None = None  # 检测到 rename 时的旧路径; 未改名则 None


def parse_numstat(output: str) -> list[NumstatEntry]:
    """解析 NUL 终止的 numstat 记录（纯函数）。

    rename 记录: 空路径字段后跟 old path + new path 两个字段。
    输出未 NUL 终止或记录畸形 → 抛 ValueError（指示输出被截断）。
    """
    queue = output.split("\0")
    if queue and queue[-1] != "":
        raise ValueError("numstat output is not NUL-terminated")
    if queue:
        queue.pop()
    entries: list[NumstatEntry] = []
    while queue:
        record = queue.pop(0)
        # 只有前两个 TAB 分隔字段; 文件名可保留自己的 TAB
        first = record.find("\t")
        second = record.find("\t", first + 1) if first >= 0 else -1
        if second < 0:
            raise ValueError(f"malformed numstat record: {record}")
        added = record[:first]
        deleted = record[first + 1 : second]
        path = record[second + 1 :]
        target = path
        old_path: str | None = None
        if target == "":
            # rename 记录: 取 old + new
            if len(queue) < 2:
                raise ValueError("malformed numstat rename record")
            old_path = queue.pop(0)
            target = queue.pop(0)
        binary = added == "-"
        entries.append(
            NumstatEntry(
                path=target,
                added=0 if binary else int(added),
                deleted=0 if binary else int(deleted),
                binary=binary,
                old_path=old_path,
            )
        )
    return entries


# ── 路径归一与分类 ──────────────────────────────────────────────────────────


def to_posix(path: str) -> str:
    """原生路径 → slash 分隔（Windows ``\\`` → ``/``）（纯函数）。"""
    return path.replace("\\", "/")


def is_inside(root: str, path: str) -> bool:
    """path 是否等于 root 或位于其下（纯函数）。

    用 posixpath 归一后做前缀判断, 避免平台 sep 差异。
    """
    r = to_posix(root).rstrip("/")
    p = to_posix(path).rstrip("/")
    if p == r:
        return True
    return p.startswith(r + "/")


def display_path_of(absolute: str, cwd: str, root: str, home: str) -> str:
    """变更文件的展示路径（纯函数）。

    cwd/root 内 → 相对 cwd; home 内 → ``~/...``; 否则绝对路径。
    """
    if is_inside(cwd, absolute) or is_inside(root, absolute):
        return to_posix(posixpath.relpath(absolute, cwd))
    if home != "" and is_inside(home, absolute):
        return "~/" + to_posix(posixpath.relpath(absolute, home))
    return to_posix(absolute)


def durable_path_of(absolute: str, cwd: str) -> str:
    """持久 path 字段: cwd 内相对, 否则绝对（纯函数）。"""
    return to_posix(posixpath.relpath(absolute, cwd)) if is_inside(cwd, absolute) else to_posix(absolute)


def compare_display(a: str, b: str) -> int:
    """display 路径的 code-unit 排序（纯函数）。

    使 ``../`` 与绝对路径排在字母前, 匹配 git 自身的相对路径列表顺序。
    """
    if a < b:
        return -1
    if a > b:
        return 1
    return 0


__all__ = [
    "NumstatEntry",
    "parse_numstat",
    "to_posix",
    "is_inside",
    "display_path_of",
    "durable_path_of",
    "compare_display",
]
