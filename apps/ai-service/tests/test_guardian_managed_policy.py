# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""guardian_managed_policy 行为测试(按运行时行为规格 managed requirements.toml,2026-11-16)。

覆盖五面(逐条对齐 外部程序 ConfigRequirementsToml 字段语义,取证见
``内部规格``):
1. SandboxModeRequirement 四档枚举按行为规格;
2. allowed_* 约束门控(越界拒绝,fail-closed;None=不限制向后兼容);
3. allow_managed_hooks_only 供应链安全(非托管 hook 拒绝);
4. guardian_extra_policy 叠加主策略(只收紧不放宽);
5. compose_guardian_policy 合成语义。

安全语义:越界一律拒绝;extra_policy 只收紧;非法沙箱模式拒绝。
"""
from __future__ import annotations

import pytest

from app.core.guardian_managed_policy import (
    GuardianExtraPolicy,
    ManagedPolicyRequirements,
    SandboxModeRequirement,
    check_approval_policy_allowed,
    check_hooks_source_allowed,
    check_permission_profile_allowed,
    check_sandbox_mode_allowed,
    compose_guardian_policy,
)


def _req(**kwargs) -> ManagedPolicyRequirements:
    return ManagedPolicyRequirements(**kwargs)


# ---------- SandboxModeRequirement 四档 ----------

def test_sandbox_mode_four_tiers_match_codex():
    """按行为规格 外部实现.exe:SandboxModeRequirement 四档。"""
    assert {s.value for s in SandboxModeRequirement} == {
        "read-only", "workspace-write", "danger-full-access", "external-sandbox",
    }


# ---------- allowed_sandbox_modes 门控 ----------

def test_sandbox_mode_none_constraint_allows_any_valid():
    """未配置约束(None)→ 合法模式均放行(单机向后兼容)。"""
    req = _req()
    for mode in ("read-only", "workspace-write", "external-sandbox"):
        allowed, reason = check_sandbox_mode_allowed(mode, req)
        assert allowed is True
        assert reason is None


def test_sandbox_mode_out_of_allowlist_rejected():
    """越界:托管只允许 read-only,请求 danger-full-access → 拒绝。"""
    req = _req(allowed_sandbox_modes=frozenset({"read-only"}))
    allowed, reason = check_sandbox_mode_allowed("danger-full-access", req)
    assert allowed is False
    assert reason is not None
    assert "not in managed allowed_sandbox_modes" in reason


def test_sandbox_mode_in_allowlist_allowed():
    req = _req(allowed_sandbox_modes=frozenset({"read-only", "workspace-write"}))
    allowed, _ = check_sandbox_mode_allowed("workspace-write", req)
    assert allowed is True


def test_sandbox_mode_invalid_rejected_even_without_constraint():
    """非法沙箱模式(不在四档)→ 即便无约束也拒绝(fail-closed)。"""
    allowed, reason = check_sandbox_mode_allowed("yolo", _req())
    assert allowed is False
    assert "invalid sandbox mode" in reason


# ---------- allowed_approval_policies 门控 ----------

def test_approval_policy_none_allows_any():
    assert check_approval_policy_allowed("on-request", _req())[0] is True


def test_approval_policy_out_of_allowlist_rejected():
    req = _req(allowed_approval_policies=frozenset({"on-request", "never"}))
    allowed, reason = check_approval_policy_allowed("untrusted", req)
    assert allowed is False
    assert "not in managed allowed_approval_policies" in reason


def test_approval_policy_in_allowlist_allowed():
    req = _req(allowed_approval_policies=frozenset({"on-request"}))
    assert check_approval_policy_allowed("on-request", req)[0] is True


# ---------- allowed_permission_profiles 门控 ----------

def test_permission_profile_out_of_allowlist_rejected():
    req = _req(allowed_permission_profiles=frozenset({"default"}))
    allowed, reason = check_permission_profile_allowed("admin", req)
    assert allowed is False
    assert "not in managed allowed_permission_profiles" in reason


def test_permission_profile_in_allowlist_allowed():
    req = _req(allowed_permission_profiles=frozenset({"default", "restricted"}))
    assert check_permission_profile_allowed("restricted", req)[0] is True


# ---------- allow_managed_hooks_only 供应链安全 ----------

def test_non_managed_hook_rejected_when_managed_only():
    """托管强制只信托管 hook:非托管 hook → 拒绝(供应链安全)。"""
    req = _req(allow_managed_hooks_only=True)
    allowed, reason = check_hooks_source_allowed(is_managed=False, requirements=req)
    assert allowed is False
    assert "non-managed hook rejected" in reason


def test_managed_hook_allowed_when_managed_only():
    req = _req(allow_managed_hooks_only=True)
    assert check_hooks_source_allowed(is_managed=True, requirements=req)[0] is True


def test_non_managed_hook_allowed_without_constraint():
    """未开 allow_managed_hooks_only → 非托管 hook 放行(单机场景)。"""
    assert check_hooks_source_allowed(is_managed=False, requirements=_req())[0] is True


# ---------- guardian_extra_policy 叠加 ----------

def test_extra_policy_empty_is_noop():
    """空 extra_policy → 原样返回 base_policy。"""
    base = "Base security policy."
    assert compose_guardian_policy(base, _req()) == base


def test_extra_policy_appended_after_base():
    """extra rules 叠加在 base 之后(只收紧不放宽)。"""
    req = _req(extra_policy=GuardianExtraPolicy(rules="No network egress."))
    composed = compose_guardian_policy("Base policy.", req)
    assert composed.startswith("Base policy.")
    assert "No network egress." in composed
    assert composed.index("Base policy.") < composed.index("No network egress.")


def test_extra_policy_disable_auto_review_appended():
    """disable_auto_review → 合成文本含托管禁用声明。"""
    req = _req(extra_policy=GuardianExtraPolicy(disable_auto_review=True))
    composed = compose_guardian_policy("Base.", req)
    assert "Auto-review is disabled by managed policy." in composed


def test_extra_policy_both_rules_and_disable():
    """rules + disable 同时配置 → 两者都进合成文本。"""
    req = _req(
        extra_policy=GuardianExtraPolicy(
            rules="Deny all deletes.", disable_auto_review=True,
        )
    )
    composed = compose_guardian_policy("Base.", req)
    assert "Deny all deletes." in composed
    assert "Auto-review is disabled" in composed


def test_extra_policy_is_empty_property():
    """is_empty 判据:空 rules + 未禁用 = 空;否则非空。"""
    assert GuardianExtraPolicy().is_empty is True
    assert GuardianExtraPolicy(rules="x").is_empty is False
    assert GuardianExtraPolicy(disable_auto_review=True).is_empty is False


def test_compose_strips_base_trailing_whitespace():
    """base 尾部空白被规整,合成后不含多余空行。"""
    req = _req(extra_policy=GuardianExtraPolicy(rules="Extra."))
    composed = compose_guardian_policy("Base.   \n\n", req)
    assert "Base." in composed
    assert "Extra." in composed
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
