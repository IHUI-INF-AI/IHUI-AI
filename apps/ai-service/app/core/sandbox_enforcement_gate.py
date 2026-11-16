# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""Windows 沙箱强制可行性判据 gate —— 对标 Codex 26.1111 ``codex-command-runner.exe``。

## 取证来源（2026-11-15，本轮 round 11 深潜）

对照物：``Codex`` 桌面端 MSIX ``26.1111.2228.0`` 引擎侧原生二进制
``codex-command-runner.exe``（Rust，rustc 59807616e1fa2540724bfbac14d7976d7e4a3860）。
strings 定向抽取（不反编译，纯只读）命中的三条强制判据错误消息（逐字）：

```
only restricted managed filesystem permissions can be enforced by the Windows sandbox
only managed permission profiles can be enforced by the Windows sandbox
permission profile requests full-disk filesystem writes, which cannot be enforced by the Windows sandbox
```

以及访问档枚举形状（`read/write/deny/restricted/enabled` + `none` 别名）与
托管档案形状（``TaggedPermissionProfile::{Managed,External}`` ×
``SerializedManagedFileSystemPermissions::{Restricted,Unrestricted}``）。

## 它管什么 / 不管什么（边界必须说清）

* **管**：给定一份「请求执行的权限档案」，判断 Windows 沙箱**能不能把它强制落地**
  （enforce）。输出结构化 verdict：`enforceable` / `blocked` + 命中哪条 codex 错误。
  这是**纯函数判据层**——输入是档案形状，输出是三态结论，不碰进程、不碰 token、
  不真创建沙箱账户。
* **不管**：真实降权执行（``proc_sandbox.py`` / ``code_exec_sandbox.py`` 的射程）、
  托管权限组合求解（``managed_permissions.py`` 的射程）、档案声明解析与 extends
  继承（``permission_profiles.py`` 的射程）。本 gate 只回答一件事：**这套档案
  Windows 沙箱 enforce 得动吗**。

## 与既有模块的关系（不重复造轮子）

``permission_profiles.py`` 的 ``FileSystemAccessMode`` 只有 ``read/write/deny`` 三档；
本轮取证证明 Codex 引擎侧实为**五档**（``restricted`` / ``enabled`` 另有两档），
且「能否被 Windows sandbox 强制」是**独立于档案解析之外的一层可行性判据**——
本模块补的正是这一层，不改动 ``permission_profiles.py``（在飞件，冷却中）。

## 一轴超越（对照只靠运行时抛错）

对照把判据埋在引擎内部、只在真的去 enforce 那一刻才抛错（晚了——策略已下发、
cell 可能已起）。本仓把「能不能 enforce」**提前到下发前**作为纯函数判据，结论可
diff、可单测、可在审批/预检阶段拦下不可强制的档案，避免「跑到一半才发现沙箱管不住」。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

__all__ = [
    "FileSystemAccess",
    "PermissionProfileKind",
    "ManagedFilesystemScope",
    "EnforcementRequest",
    "EnforcementOutcome",
    "EnforcementState",
    "CODEX_ERR_ONLY_RESTRICTED_MANAGED",
    "CODEX_ERR_ONLY_MANAGED",
    "CODEX_ERR_FULL_DISK_WRITES",
    "check_windows_sandbox_enforceable",
    "access_implies_write",
]

# ---------------------------------------------------------------------------
# 逐字错误消息（作为规则 id 的锚；测试按此常量断言，不手抄字符串）
# ---------------------------------------------------------------------------
CODEX_ERR_ONLY_RESTRICTED_MANAGED = (
    "only restricted managed filesystem permissions "
    "can be enforced by the Windows sandbox"
)
CODEX_ERR_ONLY_MANAGED = (
    "only managed permission profiles can be enforced by the Windows sandbox"
)
CODEX_ERR_FULL_DISK_WRITES = (
    "permission profile requests full-disk filesystem writes, "
    "which cannot be enforced by the Windows sandbox"
)

# ---------------------------------------------------------------------------
# 形状枚举（对标 Codex 引擎侧取证形状，五档 access）
# ---------------------------------------------------------------------------


class FileSystemAccess(str, Enum):  # noqa: UP042 — 改 StrEnum 会变 str() 输出,属行为重写
    """文件系统条目访问档（对标 ``read/write/deny/restricted/enabled`` + ``none`` 别名）。

    相较 ``permission_profiles.FileSystemAccessMode``（三档）多出
    ``restricted`` / ``enabled`` 两档——本轮取证证实的引擎侧真实形状。
    ``none`` 仍是兼容旧输入的别名 → ``deny``。
    """

    READ = "read"
    WRITE = "write"
    DENY = "deny"
    RESTRICTED = "restricted"
    ENABLED = "enabled"

    @classmethod
    def parse(cls, value: str) -> FileSystemAccess:
        lowered = str(value).strip().lower()
        if lowered == "none":
            return cls.DENY
        return cls(lowered)

    @property
    def implies_write(self) -> bool:
        """是否可能构成写能力。

        ``write`` / ``enabled`` 直接构成写能力；``restricted`` 在 Windows sandbox
        语境下是受限写（受限 token 范围内），参与 full-disk 判定但本身可被强制；
        ``read`` / ``deny`` 不构成写。
        """
        return self in (FileSystemAccess.WRITE, FileSystemAccess.ENABLED)


class PermissionProfileKind(str, Enum):  # noqa: UP042 — 同上
    """权限档案种类（对标 ``TaggedPermissionProfile::{Managed,External}``）。

    Windows sandbox 只能强制 ``Managed`` 档案（``External`` 表示由外部沙箱接管，
    非 Windows 原生沙箱强制路径）。
    """

    MANAGED = "managed"
    EXTERNAL = "external"


class ManagedFilesystemScope(str, Enum):  # noqa: UP042 — 同上
    """托管文件系统权限范围（对标 ``SerializedManagedFileSystemPermissions``）。

    ``Restricted``（受限，可被 Windows sandbox 强制）/
    ``Unrestricted``（不受限，超 Windows sandbox 强制能力）。
    """

    RESTRICTED = "restricted"
    UNRESTRICTED = "unrestricted"


class EnforcementState(str, Enum):  # noqa: UP042 — 同上
    """判据三态：``ENFORCEABLE`` / ``BLOCKED`` / ``UNDETERMINED``。"""

    ENFORCEABLE = "enforceable"
    BLOCKED = "blocked"
    UNDETERMINED = "undetermined"


@dataclass(frozen=True)
class EnforcementRequest:
    """待判定的权限档案请求。

    ``kind=EXTERNAL`` 时 ``managed_scope`` 应为 ``None``；
    ``kind=MANAGED`` 时 ``managed_scope`` 指明 restricted/unrestricted。
    """

    kind: PermissionProfileKind
    managed_scope: ManagedFilesystemScope | None = None
    # 档案声明的文件系统访问档集合（去重后）；空集表示未声明文件系统条目
    access_modes: tuple[FileSystemAccess, ...] = ()
    # 是否请求 full-disk 写（writable root 覆盖整个文件系统 / 无边界）
    full_disk_writes: bool = False


@dataclass(frozen=True)
class EnforcementOutcome:
    """结构化结论 + 命中的 codex 错误锚（blocked 时非空）。"""

    state: EnforcementState
    codex_error: str | None = None
    reason: str = ""

# ---------------------------------------------------------------------------
# 核心判据：Windows sandbox 能否强制这套档案（纯函数）
# ---------------------------------------------------------------------------


def access_implies_write(modes: tuple[FileSystemAccess, ...]) -> bool:
    """访问档集合是否隐含写能力（用于 full-disk 写判定的前置）。

    任一条目 ``implies_write`` 即视为隐含写；``restricted`` 不计入写能力
    （它是 Windows sandbox 可强制的受限写）。
    """
    return any(m.implies_write for m in modes)


def check_windows_sandbox_enforceable(
    request: EnforcementRequest,
) -> EnforcementOutcome:
    """判定 Windows sandbox 能否强制这套权限档案（对标三条 codex 判据）。

    判据顺序固定（先拦不可强制的形状，再放行可强制的）：

    1. **External 档案** → ``BLOCKED`` + ``CODEX_ERR_ONLY_MANAGED``
       （Windows sandbox 只能强制 managed 档案）。
    2. **请求 full-disk 写** → ``BLOCKED`` + ``CODEX_ERR_FULL_DISK_WRITES``
       （full-disk 写超出 Windows sandbox 强制能力）。
    3. **Managed 但 Unrestricted** → ``BLOCKED`` + ``CODEX_ERR_ONLY_RESTRICTED_MANAGED``
       （只有 restricted 的 managed 文件系统权限可被强制）。
    4. **Managed + Restricted** → ``ENFORCEABLE``（唯一可强制路径）。

    判据 2/3 的先后：先判 full-disk 写（更具体的写越界），再判 unrestricted
    （更笼统的不可强制），使更精确的错误优先暴露。

    失效方向恒为「多要一次定向说明」：``kind`` 缺失、managed 档案缺
    ``managed_scope`` ⇒ ``UNDETERMINED`` 并点名原因（不冒充结论、不静默放行）。
    """
    # 输入完备性：没判绝不写成判过
    if not isinstance(request.kind, PermissionProfileKind):
        return EnforcementOutcome(
            state=EnforcementState.UNDETERMINED,
            reason=f"未判定: kind 缺失或非 PermissionProfileKind（got {request.kind!r}）",
        )

    # 判据 1：Windows sandbox 只能强制 managed 档案
    if request.kind is PermissionProfileKind.EXTERNAL:
        return EnforcementOutcome(
            state=EnforcementState.BLOCKED,
            codex_error=CODEX_ERR_ONLY_MANAGED,
            reason="External 档案不由 Windows 原生沙箱强制（由外部沙箱接管）",
        )

    # 以下均为 Managed 路径
    if request.managed_scope is None:
        return EnforcementOutcome(
            state=EnforcementState.UNDETERMINED,
            reason="未判定: managed 档案缺 managed_scope（restricted/unrestricted 未指明）",
        )

    # 判据 2：full-disk 写超出强制能力（更具体，优先暴露）
    if request.full_disk_writes and access_implies_write(request.access_modes):
        return EnforcementOutcome(
            state=EnforcementState.BLOCKED,
            codex_error=CODEX_ERR_FULL_DISK_WRITES,
            reason="档案请求 full-disk 文件系统写，Windows sandbox 无法强制",
        )

    # 判据 3：只有 restricted 的 managed 文件系统权限可被强制
    if request.managed_scope is ManagedFilesystemScope.UNRESTRICTED:
        return EnforcementOutcome(
            state=EnforcementState.BLOCKED,
            codex_error=CODEX_ERR_ONLY_RESTRICTED_MANAGED,
            reason="只有 restricted 的 managed 文件系统权限可被 Windows sandbox 强制",
        )

    # 判据 4：managed + restricted → 可强制
    return EnforcementOutcome(
        state=EnforcementState.ENFORCEABLE,
        reason="managed + restricted 文件系统权限，Windows sandbox 可强制",
    )

# ---------------------------------------------------------------------------
# 便捷构造器（对标 codex 档案形状 → 本 gate 输入）
# ---------------------------------------------------------------------------


def request_from_profile(
    *,
    kind: str,
    managed_scope: str | None = None,
    access_modes: tuple[str, ...] = (),
    full_disk_writes: bool = False,
) -> EnforcementRequest:
    """由原始字符串形状构造判定请求（方便调用方传入未归一的输入）。

    非法 ``kind`` / ``managed_scope`` / ``access_modes`` 元素会在构造期抛
    ``ValueError``——调用方须保证形状合法；本 gate 自身的失效方向是返回
    ``UNDETERMINED``，不在解析层吞错。
    """
    return EnforcementRequest(
        kind=PermissionProfileKind(kind),
        managed_scope=(
            None if managed_scope is None else ManagedFilesystemScope(managed_scope)
        ),
        access_modes=tuple(FileSystemAccess(m) for m in access_modes),
        full_disk_writes=full_disk_writes,
    )
