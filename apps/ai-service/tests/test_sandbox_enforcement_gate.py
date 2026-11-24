# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core Windows 沙箱强制可行性判据 gate — 本轮（遵循统一工程规范）
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from app.core.sandbox_enforcement_gate import (
    CODEX_ERR_FULL_DISK_WRITES,
    CODEX_ERR_ONLY_MANAGED,
    CODEX_ERR_ONLY_RESTRICTED_MANAGED,
    EnforcementRequest,
    EnforcementState,
    FileSystemAccess,
    ManagedFilesystemScope,
    PermissionProfileKind,
    access_implies_write,
    check_windows_sandbox_enforceable,
    request_from_profile,
)


def _outcome(**kw):
    return check_windows_sandbox_enforceable(EnforcementRequest(**kw))


def test_external_blocked_only_managed():
    """判据1：External 档案不由 Windows 原生沙箱强制。"""
    o = _outcome(kind=PermissionProfileKind.EXTERNAL)
    assert o.state is EnforcementState.BLOCKED
    assert o.codex_error == CODEX_ERR_ONLY_MANAGED


@pytest.mark.parametrize("mode", [FileSystemAccess.WRITE, FileSystemAccess.ENABLED])
def test_full_disk_write_blocked(mode):
    """判据2：请求 full-disk 写（write/enabled 隐含写）超出强制能力。"""
    o = _outcome(
        kind=PermissionProfileKind.MANAGED,
        managed_scope=ManagedFilesystemScope.RESTRICTED,
        access_modes=(mode,),
        full_disk_writes=True,
    )
    assert o.state is EnforcementState.BLOCKED
    assert o.codex_error == CODEX_ERR_FULL_DISK_WRITES


def test_full_disk_read_only_not_blocked_by_full_disk_rule():
    """full-disk 但仅读 → 不触发 full-disk 写判据（走判据4 可强制）。"""
    o = _outcome(
        kind=PermissionProfileKind.MANAGED,
        managed_scope=ManagedFilesystemScope.RESTRICTED,
        access_modes=(FileSystemAccess.READ,),
        full_disk_writes=True,
    )
    assert o.state is EnforcementState.ENFORCEABLE


def test_managed_unrestricted_blocked():
    """判据3：只有 restricted 的 managed 权限可强制，unrestricted 拦下。"""
    o = _outcome(
        kind=PermissionProfileKind.MANAGED,
        managed_scope=ManagedFilesystemScope.UNRESTRICTED,
        access_modes=(FileSystemAccess.READ,),
    )
    assert o.state is EnforcementState.BLOCKED
    assert o.codex_error == CODEX_ERR_ONLY_RESTRICTED_MANAGED


@pytest.mark.parametrize(
    "modes",
    [
        (FileSystemAccess.RESTRICTED,),
        (FileSystemAccess.READ, FileSystemAccess.RESTRICTED),
        (FileSystemAccess.DENY,),
    ],
)
def test_managed_restricted_enforceable(modes):
    """判据4：managed + restricted → 唯一可强制路径（含 restricted 写、纯读、deny）。"""
    o = _outcome(
        kind=PermissionProfileKind.MANAGED,
        managed_scope=ManagedFilesystemScope.RESTRICTED,
        access_modes=modes,
    )
    assert o.state is EnforcementState.ENFORCEABLE
    assert o.codex_error is None


def test_managed_missing_scope_undetermined():
    """managed 档案缺 managed_scope ⇒ 未判定（不冒充结论）。"""
    o = _outcome(kind=PermissionProfileKind.MANAGED)
    assert o.state is EnforcementState.UNDETERMINED
    assert o.codex_error is None


def test_bad_kind_undetermined():
    """kind 非法 ⇒ 未判定（失效方向恒为多要一次定向说明）。"""
    o = _outcome(kind="nonsense")
    assert o.state is EnforcementState.UNDETERMINED


def test_access_none_alias_deny():
    """none 是 deny 的兼容别名。"""
    assert FileSystemAccess.parse("none") is FileSystemAccess.DENY
    assert FileSystemAccess.parse("Read") is FileSystemAccess.READ


def test_access_implies_write():
    assert access_implies_write((FileSystemAccess.WRITE,))
    assert access_implies_write((FileSystemAccess.ENABLED,))
    assert not access_implies_write((FileSystemAccess.RESTRICTED,))
    assert not access_implies_write((FileSystemAccess.READ,))


def test_request_from_profile_roundtrip():
    """便捷构造器：字符串形状 → 请求（非法值在构造期抛 ValueError）。"""
    req = request_from_profile(
        kind="managed",
        managed_scope="restricted",
        access_modes=("read", "restricted"),
    )
    assert req.kind is PermissionProfileKind.MANAGED
    assert req.managed_scope is ManagedFilesystemScope.RESTRICTED
    with pytest.raises(ValueError):
        request_from_profile(kind="nope")
