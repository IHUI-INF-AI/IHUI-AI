# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""文件系统路径封闭集（FileSystemPath，3 struct variant）—— 统一工程规范 R58。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + 元素数机器反推）：
::

    struct variant FileSystemPath::GlobPattern with 1 element
    struct variant FileSystemPath::Path with 1 element
    struct variant FileSystemPath::Special with 1 element

三档逐字确证（元素数均 1）。归属过滤：对照二进制里 ``ExecFileSystemPath`` /
``RawFileSystemPath`` 与 ``FileSystemPath`` 三族元素数表**逐字同构**（GlobPattern/Path/
Special 各 1）——同一路径三态语义的三个类型名，只落一个避免重复（同 R57 Guardian
同构去重先例）。本仓边界：全仓 app 层 ``GlobPattern`` 零命中、``FileSystemPath`` 零命中。

本仓已有 path 解析是具体路径处理，不是「字面 glob / 显式路径 / 特殊路径」的三态封闭集，
本模块不替换。

一轴超越：对照把三态散在路径解析处靠 enum 匹配隐式区分，无显式归类、无元素数一致性
判据。本模块提供 ``path_kind`` 三分类 + ``expected_element_count`` 逐字元素数表 +
``validate_path`` 一致性守门；并记录三族同构别名供机检。

诚实边界：三档 variant 名与元素数逐字确证；三族同构（Exec/Raw/FileSystem）逐字比对确证；
serde tag/rename 与 ``Special`` 的具体特殊路径值未确证；``path_kind`` 三分类是本仓语义归类
非对照原生判据；未接路径解析发射点。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "FileSystemPath",
    "FileSystemPathError",
    "FILE_SYSTEM_PATH_ELEMENTS",
    "FILE_SYSTEM_PATH_ALIASES",
    "PATH_KIND",
    "path_names",
    "expected_element_count",
    "ensure_file_system_path",
    "path_kind",
    "validate_path",
]

#: 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
FILE_SYSTEM_PATH_ELEMENTS: Final[dict[str, int]] = {
    "GlobPattern": 1,
    "Path": 1,
    "Special": 1,
}

#: 逐字同构别名族（三族元素数表完全相同，pytest 钉死防漂移）。
FILE_SYSTEM_PATH_ALIASES: Final[tuple[str, ...]] = (
    "FileSystemPath",
    "ExecFileSystemPath",
    "RawFileSystemPath",
)

#: 本仓语义归类：字面 glob / 显式路径 / 特殊路径。
PATH_KIND: Final[dict[str, str]] = {
    "GlobPattern": "glob",
    "Path": "explicit",
    "Special": "special",
}

_CLOSED_SET: Final[frozenset[str]] = frozenset(FILE_SYSTEM_PATH_ELEMENTS)


class FileSystemPath(StrEnum):
    """对照 FileSystemPath 三档 variant（逐字登记，真相源）。"""

    GLOB_PATTERN = "GlobPattern"
    PATH = "Path"
    SPECIAL = "Special"


class FileSystemPathError(ValueError):
    """未登记的文件系统路径 variant（封闭集/元素数判据点名）。"""


def path_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(FILE_SYSTEM_PATH_ELEMENTS)


def expected_element_count(name: str) -> int:
    """该路径 struct variant 的逐字元素数（未登记抛错）。"""
    if name not in _CLOSED_SET:
        raise FileSystemPathError(
            f"未登记的文件系统路径 variant: {name!r} —— "
            "先在 app/core/file_system_path.py 的 FILE_SYSTEM_PATH_ELEMENTS 登记"
        )
    return FILE_SYSTEM_PATH_ELEMENTS[name]


def ensure_file_system_path(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`FileSystemPathError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise FileSystemPathError(
            f"未登记的文件系统路径: {value!r} —— "
            "先在 app/core/file_system_path.py 的 FileSystemPath 登记后再产出"
        )
    return value


def path_kind(value: str) -> str:
    """归类：glob / explicit / special（登记外抛错）。"""
    ensure_file_system_path(value)
    return PATH_KIND[value]


def validate_path(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_file_system_path(name)
    expected = expected_element_count(name)
    if element_count != expected:
        raise FileSystemPathError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
