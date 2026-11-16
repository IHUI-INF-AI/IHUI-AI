# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/guardian_managed_policy.py
"""Guardian 托管策略层(按运行时行为规格 managed requirements.toml,2026-11-16)。

遵循统一工程规范)中的**托管策略注入 + 约束门控**,
取证来自 ``外部程序`` 静态字符串(见
``内部规格``)。

**统一规范 取证要点**:
- ``ConfigRequirementsToml`` 46 字段,含两层 guardian 策略:
  - ``guardian_policy_config``:主安全策略(注入 classifier prompt 的
    ``{{ tenant_policy_config }}`` 段);
  - ``guardian_extra_policy``:附加策略原文:"To enforce additional Guardian rules,
    set guardian_extra_policy in managed requirements.toml"——**这是企业托管方
    强加额外 Guardian 规则的入口**(比主策略更高优先级的强制约束);
- 约束门控(allowlist):``allowed_sandbox_modes`` / ``allowed_approval_policies`` /
  ``allowed_approvals_reviewers`` / ``allowed_permission_profiles`` /
  ``allowed_web_search_modes`` / ``allow_managed_hooks_only`` /
  ``allow_browser_and_computer_use`` / ``allow_remote_control`` /
  ``allow_appshots`` / ``enforce_residency`` 等——托管方圈定**允许的配置取值集合**,
  用户 config 只能在圈内取值;
- ``SandboxModeRequirement = read-only | workspace-write | danger-full-access |
  external-sandbox``(沙箱模式要求四档)。

**这是"企业托管强制"层**:区别于用户可自由改的 ``config.toml``,托管方通过
``requirements.toml``(**强制**)下发策略——``guardian_extra_policy`` 注入额外规则,
``allowed_*`` 圈死取值范围,用户即便想放宽也被托管约束拦住。这是 统一规范 的
企业管控安全模型。

**为什么复现**:本仓 ``mcp_tool_approval`` / ``permission_mode`` 是用户侧自由配置,
缺"托管方强制约束"这层——即"企业下发 guardian 额外策略 + 圈死允许的审批/沙箱/
权限取值集合,用户越界即拒绝"。本模块用纯函数复现该门控内核。

**安全语义(fail-closed)**:
- 约束门控:**拒绝越界**——用户请求的取值不在 ``allowed_*`` 圈内 → 拒绝(绝不放行);
- ``allow_managed_hooks_only=True`` → 非托管来源的 hook 一律拒绝;
- ``guardian_extra_policy`` 注入的额外规则**叠加在主策略之上**(更严不更松);
- 未配置约束(None)→ 不限制(向后兼容单机场景),但一旦配置即强制。

设计纪律:纯函数、无 IO、不解析 TOML(调用方若从 requirements.toml 读,自行喂字段)。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

__all__ = [
    "SandboxModeRequirement",
    "ManagedPolicyRequirements",
    "GuardianExtraPolicy",
    "check_sandbox_mode_allowed",
    "check_approval_policy_allowed",
    "check_permission_profile_allowed",
    "check_hooks_source_allowed",
    "compose_guardian_policy",
]


class SandboxModeRequirement(StrEnum):
    """沙箱模式要求四档(按行为规格 外部实现 ``SandboxModeRequirement``)。"""

    READ_ONLY = "read-only"
    WORKSPACE_WRITE = "workspace-write"
    DANGER_FULL_ACCESS = "danger-full-access"
    EXTERNAL_SANDBOX = "external-sandbox"


@dataclass
class GuardianExtraPolicy:
    """托管方注入的额外 Guardian 规则(按行为规格 ``guardian_extra_policy``)。

    ``rules`` 是企业额外强制的策略文本,叠加在主策略 ``guardian_policy_config``
    之上(**只收紧不放宽**)。统一规范 原文:它走 managed requirements.toml 下发,
    用于 "enforce additional Guardian rules"。
    """

    rules: str = ""
    #: 是否禁用自动复核(托管方可强制关闭 auto-review,按行为规格 disable/enable_auto_review)。
    disable_auto_review: bool = False

    @property
    def is_empty(self) -> bool:
        """是否无额外规则(空 rules 且未禁用 auto-review)。"""
        return not self.rules.strip() and not self.disable_auto_review


@dataclass
class ManagedPolicyRequirements:
    """托管策略约束门控(按行为规格 ``ConfigRequirementsToml`` 的 allowed_* 字段)。

    每个 ``allowed_*`` 为 None 表示"不限制"(单机场景向后兼容);一旦配置成
    集合,用户请求的取值必须落在集合内,否则拒绝(fail-closed)。
    """

    allowed_sandbox_modes: frozenset[str] | None = None
    allowed_approval_policies: frozenset[str] | None = None
    allowed_permission_profiles: frozenset[str] | None = None
    allowed_web_search_modes: frozenset[str] | None = None
    #: 仅允许托管来源的 hook(非托管 hook 一律拒绝)。
    allow_managed_hooks_only: bool = False
    allow_browser_and_computer_use: bool = True
    allow_remote_control: bool = False
    allow_appshots: bool = True
    enforce_residency: bool = False
    extra_policy: GuardianExtraPolicy = field(default_factory=GuardianExtraPolicy)


def check_sandbox_mode_allowed(
    requested: str,
    requirements: ManagedPolicyRequirements,
) -> tuple[bool, str | None]:
    """校验请求的沙箱模式是否被托管约束允许。

    Returns:
        ``(allowed, reason)``:allowed=False 时 reason 说明违反了哪条约束。
        fail-closed:请求模式非法或不在 allowed 集合 → 拒绝。
    """
    # 先校验请求本身是合法沙箱模式(四档之一)。
    try:
        SandboxModeRequirement(requested)
    except ValueError:
        return False, f"invalid sandbox mode: {requested}"

    allowed = requirements.allowed_sandbox_modes
    if allowed is not None and requested not in allowed:
        return (
            False,
            f"sandbox mode '{requested}' not in managed allowed_sandbox_modes",
        )
    return True, None


def check_approval_policy_allowed(
    requested: str,
    requirements: ManagedPolicyRequirements,
) -> tuple[bool, str | None]:
    """校验请求的审批策略是否被托管约束允许(按行为规格 allowed_approval_policies)。"""
    allowed = requirements.allowed_approval_policies
    if allowed is not None and requested not in allowed:
        return (
            False,
            f"approval policy '{requested}' not in managed allowed_approval_policies",
        )
    return True, None


def check_permission_profile_allowed(
    requested: str,
    requirements: ManagedPolicyRequirements,
) -> tuple[bool, str | None]:
    """校验请求的权限 profile 是否被托管约束允许(按行为规格 allowed_permission_profiles)。"""
    allowed = requirements.allowed_permission_profiles
    if allowed is not None and requested not in allowed:
        return (
            False,
            f"permission profile '{requested}' not in managed allowed_permission_profiles",
        )
    return True, None


def check_hooks_source_allowed(
    is_managed: bool,
    requirements: ManagedPolicyRequirements,
) -> tuple[bool, str | None]:
    """校验 hook 来源:``allow_managed_hooks_only=True`` 时非托管 hook 一律拒绝。

    对齐 统一规范 ``allow_managed_hooks_only``——企业托管下只信自己下发的 hook,
    用户自定义 hook 一律拦(供应链安全)。
    """
    if requirements.allow_managed_hooks_only and not is_managed:
        return False, "non-managed hook rejected: allow_managed_hooks_only is enforced"
    return True, None


def compose_guardian_policy(
    base_policy: str,
    requirements: ManagedPolicyRequirements,
) -> str:
    """合成最终注入 classifier prompt 的安全策略文本。

    逐条对齐 统一规范:
    - 主策略 ``base_policy``(对应 ``guardian_policy_config`` / ``tenant_policy_config``);
    - 托管 ``guardian_extra_policy`` **叠加在其后**(只收紧不放宽)。

    Returns:
        合成后的策略文本;extra_policy 为空时原样返回 base_policy。
    """
    extra = requirements.extra_policy
    if extra.is_empty:
        return base_policy
    parts = [base_policy.rstrip()]
    if extra.rules.strip():
        parts.append(extra.rules.strip())
    if extra.disable_auto_review:
        parts.append("Auto-review is disabled by managed policy.")
    return "\n\n".join(parts)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
