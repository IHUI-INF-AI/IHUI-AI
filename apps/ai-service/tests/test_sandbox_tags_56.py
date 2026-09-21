# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""sandbox_tags.py 诊断标签测试(对标 codex sandbox_tags_tests.rs)。

覆盖:
- sandbox_backend_tag 各变体/各 windows 选择全分支;
- managed 无平台沙箱 -> none;
- policy_tag 各分支(disabled/external/full-disk/read-only/workspace-write);
- SandboxTags.from_policy 复用 sandbox_policy API;
- append_metric_tags / record_metadata(含字段缺失容错) / record_policy_metadata;
- 红线: 标签纯函数无文件 IO、模块声明不用于授权。
"""

from __future__ import annotations

import sys
import tempfile

from app.core.sandbox_policy import (
    POLICY_DANGER_FULL_ACCESS,
    POLICY_EXTERNAL_SANDBOX,
    POLICY_READ_ONLY,
    POLICY_WORKSPACE_WRITE,
    SandboxPolicy,
)
from app.core.sandbox_tags import (
    SANDBOX_NONE,
    SANDBOX_WINDOWS_ELEVATED,
    SANDBOX_WINDOWS_MXC,
    SANDBOX_WINDOWS_RESTRICTED_TOKEN,
    SandboxTags,
    _platform_sandbox_metric_tag,
    policy_tag,
    record_policy_metadata,
    sandbox_backend_tag,
)
from app.core.turn_metadata import CodexResponsesMetadata


# ---------------------------------------------------------------------------
# sandbox_backend_tag: 顶层变体
# ---------------------------------------------------------------------------
def test_backend_disabled_is_none():
    assert sandbox_backend_tag("disabled") == SANDBOX_NONE


def test_backend_external_is_external():
    assert sandbox_backend_tag("external") == "external"


# ---------------------------------------------------------------------------
# sandbox_backend_tag: managed -> windows 选择映射(全分支)
# ---------------------------------------------------------------------------
def test_backend_managed_mxc():
    assert (
        sandbox_backend_tag("managed", windows_sandbox_selection="mxc")
        == SANDBOX_WINDOWS_MXC
    )


def test_backend_managed_elevated():
    assert (
        sandbox_backend_tag("managed", windows_sandbox_selection="elevated")
        == SANDBOX_WINDOWS_ELEVATED
    )


def test_backend_managed_restricted_token():
    assert (
        sandbox_backend_tag("managed", windows_sandbox_selection="restricted_token")
        == SANDBOX_WINDOWS_RESTRICTED_TOKEN
    )


def test_backend_managed_disabled_no_platform_is_none():
    # managed 无平台沙箱 -> none
    assert (
        sandbox_backend_tag(
            "managed",
            windows_sandbox_selection="disabled",
            platform_sandbox_available=False,
        )
        == SANDBOX_NONE
    )


def test_backend_managed_disabled_platform_available():
    # disabled 选择但平台可用 -> 平台标签
    assert (
        sandbox_backend_tag(
            "managed",
            windows_sandbox_selection="disabled",
            platform_sandbox_available=True,
        )
        == _platform_sandbox_metric_tag()
    )


def test_backend_managed_enforce_network_requires_sandbox():
    # enforce_managed_network -> 仍需按 windows 选择映射(此处 mxc)
    assert (
        sandbox_backend_tag(
            "managed",
            windows_sandbox_selection="mxc",
            enforce_managed_network=True,
        )
        == SANDBOX_WINDOWS_MXC
    )


def test_backend_managed_network_access_true_still_requires():
    # 网络开启 + managed -> 仍需要平台沙箱(对标 Restricted 文件策略)
    assert (
        sandbox_backend_tag(
            "managed",
            windows_sandbox_selection="elevated",
            network_access=True,
        )
        == SANDBOX_WINDOWS_ELEVATED
    )


# ---------------------------------------------------------------------------
# policy_tag: 各分支
# ---------------------------------------------------------------------------
def test_policy_disabled_is_danger():
    assert (
        policy_tag(
            "disabled",
            has_full_disk_write=False,
            has_writable_roots_with_cwd=False,
        )
        == POLICY_DANGER_FULL_ACCESS
    )


def test_policy_external_is_external_sandbox():
    assert (
        policy_tag(
            "external",
            has_full_disk_write=False,
            has_writable_roots_with_cwd=False,
        )
        == POLICY_EXTERNAL_SANDBOX
    )


def test_policy_managed_full_disk_is_danger():
    assert (
        policy_tag(
            "managed",
            has_full_disk_write=True,
            has_writable_roots_with_cwd=False,
        )
        == POLICY_DANGER_FULL_ACCESS
    )


def test_policy_managed_no_writable_root_is_read_only():
    assert (
        policy_tag(
            "managed",
            has_full_disk_write=False,
            has_writable_roots_with_cwd=False,
        )
        == POLICY_READ_ONLY
    )


def test_policy_managed_workspace_write():
    assert (
        policy_tag(
            "managed",
            has_full_disk_write=False,
            has_writable_roots_with_cwd=True,
        )
        == POLICY_WORKSPACE_WRITE
    )


# ---------------------------------------------------------------------------
# SandboxTags.from_policy: 复用 sandbox_policy API
# ---------------------------------------------------------------------------
def test_from_policy_danger_full_access():
    policy = SandboxPolicy(variant=POLICY_DANGER_FULL_ACCESS)
    tags = SandboxTags.from_policy(policy, "/some/cwd")
    assert tags.sandbox == SANDBOX_NONE
    assert tags.policy == POLICY_DANGER_FULL_ACCESS


def test_from_policy_external():
    policy = SandboxPolicy(variant=POLICY_EXTERNAL_SANDBOX, network_access=True)
    tags = SandboxTags.from_policy(policy, "/some/cwd")
    assert tags.sandbox == "external"
    assert tags.policy == POLICY_EXTERNAL_SANDBOX


def test_from_policy_read_only():
    policy = SandboxPolicy.new_read_only_policy()
    tags = SandboxTags.from_policy(policy, "/nonexistent-cwd-xyz")
    assert tags.policy == POLICY_READ_ONLY


def test_from_policy_workspace_write_with_cwd():
    cwd = tempfile.mkdtemp()
    policy = SandboxPolicy.new_workspace_write_policy()
    tags = SandboxTags.from_policy(policy, cwd)
    # managed 默认无可用平台沙箱 -> sandbox none
    assert tags.sandbox == SANDBOX_NONE
    # cwd 在可写根内 -> workspace-write
    assert tags.policy == POLICY_WORKSPACE_WRITE


# ---------------------------------------------------------------------------
# append_metric_tags / record_metadata / record_policy_metadata
# ---------------------------------------------------------------------------
def test_append_metric_tags():
    tags = SandboxTags(sandbox="windows_mxc", policy=POLICY_WORKSPACE_WRITE)
    out: list[tuple[str, str]] = []
    tags.append_metric_tags(out)
    assert ("sandbox", "windows_mxc") in out
    assert ("sandbox_policy", POLICY_WORKSPACE_WRITE) in out


def test_record_metadata_fills_both():
    meta = CodexResponsesMetadata()
    tags = SandboxTags(sandbox="external", policy=POLICY_EXTERNAL_SANDBOX)
    tags.record_metadata(meta)
    assert meta.sandbox == "external"
    assert meta.sandbox_mode == POLICY_EXTERNAL_SANDBOX


def test_record_metadata_missing_attr_tolerant():
    # 无 sandbox/sandbox_mode 槽位的对象 -> 不抛异常
    class Slotted:
        __slots__ = ()

    tags = SandboxTags(sandbox="none", policy=POLICY_READ_ONLY)
    tags.record_metadata(Slotted())  # 不应抛


def test_record_metadata_none_safe():
    tags = SandboxTags(sandbox="none", policy=POLICY_READ_ONLY)
    tags.record_metadata(None)  # 不应抛


def test_record_policy_metadata_only_sandbox_mode():
    meta = CodexResponsesMetadata()
    policy = SandboxPolicy.new_workspace_write_policy()
    record_policy_metadata(policy, tempfile.mkdtemp(), meta)
    assert meta.sandbox_mode == POLICY_WORKSPACE_WRITE
    # 仅填 sandbox_mode,不动 sandbox
    assert meta.sandbox is None


def test_record_policy_metadata_none_safe():
    policy = SandboxPolicy.new_read_only_policy()
    record_policy_metadata(policy, "/x", None)  # 不应抛


# ---------------------------------------------------------------------------
# 红线: 标签纯函数无文件 IO / 不用于授权
# ---------------------------------------------------------------------------
def test_pure_functions_do_no_file_io(monkeypatch):
    calls: list[object] = []
    real_open = open

    def fake_open(*args, **kwargs):
        calls.append(args)
        return real_open(*args, **kwargs)

    monkeypatch.setattr("builtins.open", fake_open)
    # 纯函数不应打开任何文件
    sandbox_backend_tag("managed", windows_sandbox_selection="elevated")
    policy_tag(
        "managed", has_full_disk_write=False, has_writable_roots_with_cwd=True
    )
    assert calls == []


def test_pure_functions_deterministic():
    assert sandbox_backend_tag("managed", windows_sandbox_selection="mxc") == (
        sandbox_backend_tag("managed", windows_sandbox_selection="mxc")
    )
    assert policy_tag(
        "managed", has_full_disk_write=True, has_writable_roots_with_cwd=False
    ) == POLICY_DANGER_FULL_ACCESS


def test_red_line_docstring_declares_no_authorization():
    import app.core.sandbox_tags as mod

    doc = mod.__doc__ or ""
    assert "绝不" in doc and "授权" in doc
