# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""沙箱诊断标签(仅供诊断/metrics,绝不用于授权判定)。

对标 codex-rs/core/src/sandbox_tags.rs:
- 从 PermissionProfile 派生两个诊断标签 `sandbox`(后端选择)与
  `sandbox_policy`(策略强度);
- 标签仅写入 metrics attributes 与请求 metadata,绝不用于授权文件系统访问;
- 纯函数,无文件系统 IO、无副作用(红线)。

移植范围:
- sandbox_backend_tag: 后端标签(disabled / external / managed→windows_* 或平台标签);
- policy_tag: 策略强度标签(danger-full-access / external-sandbox /
  read-only / workspace-write);
- SandboxTags dataclass + from_policy / append_metric_tags / record_metadata;
- record_policy_metadata: 仅填 sandbox_mode。

判定跳过: 平台沙箱运行时落地(Landlock/Seccomp/macOS seatbelt/Windows
restricted token 执行机制)与 get_platform_sandbox 的真实探测;此处以
platform_sandbox_available 标志与 windows_sandbox_selection 字符串驱动。
"""
from __future__ import annotations

import sys
from dataclasses import dataclass
from typing import Any, List, Tuple

from app.core.sandbox_policy import (
    POLICY_DANGER_FULL_ACCESS,
    POLICY_EXTERNAL_SANDBOX,
    POLICY_READ_ONLY,
    POLICY_WORKSPACE_WRITE,
    SandboxPolicy,
)

# 后端标签常量(对标 codex SandboxType::as_metric_tag / 字面量)
SANDBOX_NONE = "none"
SANDBOX_EXTERNAL = "external"
SANDBOX_WINDOWS_MXC = "windows_mxc"
SANDBOX_WINDOWS_ELEVATED = "windows_elevated"
SANDBOX_WINDOWS_RESTRICTED_TOKEN = "windows_restricted_token"

# windows_sandbox_selection 取值
WINDOWS_SELECTION_MXC = "mxc"
WINDOWS_SELECTION_ELEVATED = "elevated"
WINDOWS_SELECTION_RESTRICTED_TOKEN = "restricted_token"
WINDOWS_SELECTION_DISABLED = "disabled"


def _platform_sandbox_metric_tag() -> str:
    """对标 get_platform_sandbox(false).as_metric_tag();按平台返回默认平台标签。

    真实 codex 在非 Windows 上探测 Landlock/Seccomp/macOS seatbelt 后返回对应
    标签;此处以平台给出代表值,供 disabled 选择且平台可用时回退。
    """
    if sys.platform == "darwin":
        return "macos_seatbelt"
    if sys.platform == "win32":
        return "windows"
    return "linux_seccomp"


def sandbox_backend_tag(
    profile_variant: str,
    *,
    windows_sandbox_selection: str = WINDOWS_SELECTION_DISABLED,
    platform_sandbox_available: bool = False,
    enforce_managed_network: bool = False,
    network_access: bool = False,
) -> str:
    """对标 permission_profile_sandbox_tag。

    profile_variant in {disabled, external, managed}。
    - disabled -> "none"
    - external -> "external"
    - managed -> 需要平台沙箱时按 windows_sandbox_selection 映射;无可用平台沙箱
      (disabled 选择且 platform_sandbox_available=False) 时回退 "none"。
    """
    if profile_variant == "disabled":
        return SANDBOX_NONE
    if profile_variant == "external":
        return SANDBOX_EXTERNAL

    # managed: 默认需要平台沙箱(对标 should_require_platform_sandbox 在
    # Restricted 文件策略下的结果恒为真)。无可用平台沙箱则回退 "none"。
    if not _managed_requires_platform_sandbox(network_access, enforce_managed_network):
        return SANDBOX_NONE
    return _windows_selection_tag(windows_sandbox_selection, platform_sandbox_available)


def _managed_requires_platform_sandbox(
    network_access: bool, enforce_managed_network: bool
) -> bool:
    """对标 should_require_platform_sandbox(file_system=Restricted, network, enforce)。

    managed 文件策略默认 Restricted(workspace-write),故:
    - enforce_managed_network -> True
    - 网络关闭 -> !matches!(ExternalSandbox) = True
    - 网络开启 -> !has_full_disk_write_access() = True
    即恒需平台沙箱。保留结构以便后续接入 ExternalSandbox/Unrestricted 变体。
    """
    if enforce_managed_network:
        return True
    if not network_access:
        return True
    return True


def _windows_selection_tag(
    windows_sandbox_selection: str, platform_sandbox_available: bool
) -> str:
    """对标 WindowsSandboxSelection 匹配臂。"""
    if windows_sandbox_selection == WINDOWS_SELECTION_MXC:
        return SANDBOX_WINDOWS_MXC
    if windows_sandbox_selection == WINDOWS_SELECTION_ELEVATED:
        return SANDBOX_WINDOWS_ELEVATED
    if windows_sandbox_selection == WINDOWS_SELECTION_RESTRICTED_TOKEN:
        return SANDBOX_WINDOWS_RESTRICTED_TOKEN
    # Disabled: 回退到平台沙箱标签,若无可用平台沙箱则 "none"
    return _platform_sandbox_metric_tag() if platform_sandbox_available else SANDBOX_NONE


def policy_tag(
    profile_variant: str,
    *,
    has_full_disk_write: bool,
    has_writable_roots_with_cwd: bool,
) -> str:
    """对标 permission_profile_policy_tag。"""
    if profile_variant == "disabled":
        return POLICY_DANGER_FULL_ACCESS
    if profile_variant == "external":
        return POLICY_EXTERNAL_SANDBOX
    # managed
    if has_full_disk_write:
        return POLICY_DANGER_FULL_ACCESS
    if not has_writable_roots_with_cwd:
        return POLICY_READ_ONLY
    return POLICY_WORKSPACE_WRITE


def _profile_variant_from_policy(policy: SandboxPolicy) -> str:
    """从 IHUI SandboxPolicy 反推 codex 的 profile_variant 高层分类。"""
    if policy.variant == POLICY_DANGER_FULL_ACCESS:
        return "disabled"
    if policy.variant == POLICY_EXTERNAL_SANDBOX:
        return "external"
    return "managed"


@dataclass
class SandboxTags:
    """诊断标签对(对标 codex SandboxTags)。仅诊断/metrics,绝不授权。"""

    sandbox: str
    policy: str

    @classmethod
    def from_policy(cls, policy: SandboxPolicy, cwd: str) -> "SandboxTags":
        """复用 ihui sandbox_policy 的变体/可写根 API 推导两标签。"""
        profile_variant = _profile_variant_from_policy(policy)
        sandbox = sandbox_backend_tag(
            profile_variant,
            windows_sandbox_selection=WINDOWS_SELECTION_DISABLED,
            platform_sandbox_available=False,
            enforce_managed_network=False,
            network_access=policy.network_access,
        )
        has_full = policy.has_full_disk_write_access()
        has_roots = bool(policy.get_writable_roots_with_cwd(cwd))
        policy_label = policy_tag(
            profile_variant,
            has_full_disk_write=has_full,
            has_writable_roots_with_cwd=has_roots,
        )
        return cls(sandbox=sandbox, policy=policy_label)

    def append_metric_tags(self, tags: List[Tuple[str, str]]) -> None:
        """对标 append_metric_tags:追加速度/策略两标签。"""
        tags.append(("sandbox", self.sandbox))
        tags.append(("sandbox_policy", self.policy))

    def record_metadata(self, metadata: Any) -> None:
        """对标 record_metadata:写入 sandbox/sandbox_mode,容错任意对象。"""
        if metadata is None:
            return
        for attr, value in (("sandbox", self.sandbox), ("sandbox_mode", self.policy)):
            try:
                setattr(metadata, attr, value)
            except Exception:
                pass


def record_policy_metadata(profile: SandboxPolicy, cwd: str, metadata: Any) -> None:
    """对标 record_policy_metadata:仅填 sandbox_mode(策略强度标签)。"""
    if metadata is None:
        return
    try:
        tags = SandboxTags.from_policy(profile, cwd)
        setattr(metadata, "sandbox_mode", tags.policy)
    except Exception:
        pass
