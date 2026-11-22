# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""host_executable 声明校验 gate —— 遵循统一工程规范。

## 设计依据（2026-11-15，本轮 round 11 深潜）

对照物：``codex-command-runner.exe``（MSIX ``26.1111.2228.0``，Rust），strings 定向
抽取命中 host_executable 声明的四条校验判据（逐字）：

```
host_executable name cannot be empty
host_executable name must be a bare executable name (got <值>)
host_executable paths must be strings (got <类型>)
host_executable paths must be absolute (got <值>)
```

## 它管什么 / 不管什么

* **管**：给定 execpolicy 里声明的 host_executable（``{name, paths}``），判断这份声明
  **能不能合法建表**。输出结构化 verdict（accepted / rejected / undetermined +
  命中的 codex 错误锚）。**纯函数验证层**，输入是声明形状，输出是三态结论。
* **不管**：真正的可执行文件解析（``exec_env.resolve_stdio_command`` 的 PATH 搜索
  射程）、cwd 工作区边界校验（``worker_exec_context`` 的 allowlist 射程）、真实进程拉起。

## 与既有模块的分工（不重复造轮子）

* ``exec_env.resolve_stdio_command``：**运行时 PATH 解析** —— 输入命令名，输出解析到的
  绝对路径（裸名按 PATH 各目录试）。回答"这个命令**在哪**"。
* ``worker_exec_context``：**cwd 工作区边界** —— cwd 必须绝对且落在允许根内。回答"在
  **哪**执行"。
* **本 gate**：**声明时语法校验** —— name 必须是 bare name（无目录成分）、paths 必须
  是绝对路径字符串列表。回答"这份**声明本身**合不合法"。

三者互补不重复：声明（本 gate）→ 解析（exec_env）→ 执行边界（worker_exec_context）。

## 一轴超越

对照把校验埋在 execpolicy serde 反序列化层，错误只在**引擎加载策略那一刻**抛（晚了
——策略已下发、可能已被执行）。本仓把校验抽成**策略下发前**的纯函数 gate：结论可
diff、可单测、可在声明写库前拦下非法形状，且拒绝原因结构化成 rule id + codex 错误锚。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

__all__ = [
    "HostExecutableVerdict",
    "HostExecutableValidation",
    "CODEX_ERR_NAME_EMPTY",
    "CODEX_ERR_NAME_NOT_BARE",
    "CODEX_ERR_PATHS_NOT_STRINGS",
    "CODEX_ERR_PATHS_NOT_ABSOLUTE",
    "validate_host_executable",
]

# ---------------------------------------------------------------------------
# 逐字错误锚（测试按常量断言，不手抄字符串）
# ---------------------------------------------------------------------------
CODEX_ERR_NAME_EMPTY = "host_executable name cannot be empty"
CODEX_ERR_NAME_NOT_BARE = "host_executable name must be a bare executable name"
CODEX_ERR_PATHS_NOT_STRINGS = "host_executable paths must be strings"
CODEX_ERR_PATHS_NOT_ABSOLUTE = "host_executable paths must be absolute"


class HostExecutableVerdict(str, Enum):  # noqa: UP042 — 改 StrEnum 会变 str() 输出,属行为重写
    """声明校验三态：ACCEPTED / REJECTED / UNDETERMINED。"""

    ACCEPTED = "accepted"
    REJECTED = "rejected"
    UNDETERMINED = "undetermined"


@dataclass(frozen=True)
class HostExecutableValidation:
    """结构化结论：三态 + 命中的 codex 错误锚（rejected 时非空）+ rule id + 细节。"""

    state: HostExecutableVerdict
    rule_id: str | None = None
    codex_error: str | None = None
    detail: str = ""


def _has_path_separator(name: str) -> bool:
    """bare name = 不含任何目录成分：拒绝 ``/`` 与 ``\\``（跨平台路径分隔符）。"""
    return "/" in name or "\\" in name


def _is_absolute_path(path: str) -> bool:
    """绝对路径判定（跨平台）：Windows 盘符/UNC 或 POSIX 根。

    用 ntpath 与 posixpath 双判：任一认作绝对即算绝对（遵循统一工程规范
    声明侧接受任一平台的绝对形态，运行侧按当前平台解析）。
    """
    if not path:
        return False
    import ntpath
    import posixpath

    return ntpath.isabs(path) or posixpath.isabs(path)


# ---------------------------------------------------------------------------
# 核心验证：host_executable 声明能否合法建表（纯函数，遵循统一工程规范）
# ---------------------------------------------------------------------------

# 四条判据固定检查顺序（先拦语法非法，再拦语义非法）：
#   1 name 空 → 2 name 非 bare → 3 paths 类型错 → 4 paths 非绝对 → ACCEPTED
# 对齐 codex serde 反序列化顺序：先校验标量字段（name），再校验列表字段（paths）。


def validate_host_executable(
    name: object, paths: object
) -> HostExecutableValidation:
    """校验一份 host_executable 声明能否合法建表（遵循统一工程规范）。

    四条判据（按行为规格 ``外部实现-command-runner.exe`` strings）：

    1. ``host_executable name cannot be empty`` —— name.strip() 为空。
    2. ``host_executable name must be a bare executable name (got <值>)``
       —— name 含 ``/`` 或 ``\\``（带目录成分，不是 bare name）。
    3. ``host_executable paths must be strings (got <类型>)`` —— paths 不是 list
       或元素不是 str。
    4. ``host_executable paths must be absolute (got <值>)`` —— paths 里有相对路径。

    失效方向恒为「多要一次定向说明」：``name`` 非字符串 ⇒ UNDETERMINED 点名原因
    （§0.3「没判绝不写成判过」）。``paths`` 类型本身非法 ⇒ REJECTED（这是对侧
    serde 的 type error，有明确判据，不是"没判"）。
    """
    # name 非 str ⇒ UNDETERMINED（不是非法，是没判）
    if not isinstance(name, str):
        return HostExecutableValidation(
            state=HostExecutableVerdict.UNDETERMINED,
            rule_id="host_executable.name",
            detail=f"未判定: name 不是字符串（got {type(name).__name__}）",
        )

    # 判据 1：name 空
    if not name.strip():
        return HostExecutableValidation(
            state=HostExecutableVerdict.REJECTED,
            rule_id="host_executable.name.empty",
            codex_error=CODEX_ERR_NAME_EMPTY,
        )

    # 判据 2：name 含路径分隔符（不是 bare name）
    if _has_path_separator(name):
        return HostExecutableValidation(
            state=HostExecutableVerdict.REJECTED,
            rule_id="host_executable.name.not_bare",
            codex_error=f"{CODEX_ERR_NAME_NOT_BARE} (got {name!r})",
        )

    # paths 非 list ⇒ REJECTED（type error，有明确判据）
    if not isinstance(paths, list):
        return HostExecutableValidation(
            state=HostExecutableVerdict.REJECTED,
            rule_id="host_executable.paths.type",
            codex_error=f"{CODEX_ERR_PATHS_NOT_STRINGS} (got {type(paths).__name__})",
        )

    # 判据 3：paths 含非字符串元素
    non_str = [p for p in paths if not isinstance(p, str)]
    if non_str:
        return HostExecutableValidation(
            state=HostExecutableVerdict.REJECTED,
            rule_id="host_executable.paths.element_type",
            codex_error=f"{CODEX_ERR_PATHS_NOT_STRINGS} (got {type(non_str[0]).__name__} at index {paths.index(non_str[0])})",
            detail=f"首个非字符串元素: {non_str[0]!r}",
        )

    # 判据 4：paths 含相对路径
    for p in paths:
        if not _is_absolute_path(p):
            return HostExecutableValidation(
                state=HostExecutableVerdict.REJECTED,
                rule_id="host_executable.paths.not_absolute",
                codex_error=f"{CODEX_ERR_PATHS_NOT_ABSOLUTE} (got {p!r})",
                detail=f"首个相对路径: {p!r}",
            )

    return HostExecutableValidation(
        state=HostExecutableVerdict.ACCEPTED,
        rule_id="host_executable.ok",
        detail=f"name={name!r} paths={paths!r} 可建表",
    )
