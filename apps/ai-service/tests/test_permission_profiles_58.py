# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:placeholder
"""批58(十八):权限档案 PermissionProfile 测试(对标 codex permissions_toml.rs)。"""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.core.permission_profiles import (  # noqa: E402
    CycleError,
    FileSystemAccessMode,
    NetworkDomainPermission,
    NetworkMode,
    NetworkSettings,
    PermissionProfile,
    UndefinedParentError,
    UndefinedProfileError,
    UnsupportedBuiltInParentError,
    merge_permission_profiles,
    normalize_host,
    normalize_profile_network_domains,
    parse_filesystem_entries,
    resolve_enabled_roots,
    resolve_permission_profile,
)


def _prof(**kwargs) -> PermissionProfile:
    return PermissionProfile(**kwargs)


# --- normalize_host ---


def test_normalize_host_lowercases_and_strips_trailing_dot():
    assert normalize_host("Example.COM.") == "example.com"


def test_normalize_host_strips_port_when_single_colon():
    assert normalize_host("x.com:443") == "x.com"


def test_normalize_host_unbracketed_ipv6_preserved():
    assert normalize_host("2001:db8::1") == "2001:db8::1"


def test_normalize_host_bracketed_ipv6_peels_brackets():
    assert normalize_host("[2001:db8::1]:443") == "2001:db8::1"


def test_normalize_host_strips_scope_suffix():
    assert normalize_host("fe80::1%25eth0") == "fe80::1"
    assert normalize_host("fe80::1%eth0") == "fe80::1"


def test_normalize_host_trims_whitespace():
    assert normalize_host("  a.com  ") == "a.com"


# --- FileSystemAccessMode ---


def test_filesystem_mode_parse_and_capabilities():
    assert FileSystemAccessMode.parse("read") is FileSystemAccessMode.READ
    assert FileSystemAccessMode.parse("NONE") is FileSystemAccessMode.DENY  # 兼容别名
    assert FileSystemAccessMode.READ.can_read is True
    assert FileSystemAccessMode.DENY.can_read is False
    assert FileSystemAccessMode.WRITE.can_write is True
    assert FileSystemAccessMode.READ.can_write is False


def test_parse_filesystem_entries_skips_invalid():
    parsed = parse_filesystem_entries({
        "/a": "read",
        "/b": "none",
        "/bad": "explode",
    })
    assert parsed["/a"] is FileSystemAccessMode.READ
    assert parsed["/b"] is FileSystemAccessMode.DENY
    assert "/bad" not in parsed


# --- 单档案字段 ---


def test_enabled_roots_filters_false_and_sorts():
    prof = _prof(workspace_roots={"/z": True, "/a": True, "/m": False})
    assert prof.enabled_roots() == ["/a", "/z"]
    assert resolve_enabled_roots(prof) == ["/a", "/z"]


def test_network_allowed_and_denied_domains_none_when_empty():
    net = NetworkSettings()
    assert net.allowed_domains() is None
    assert net.denied_domains() is None
    net = NetworkSettings(domains={
        "a.com": NetworkDomainPermission.ALLOW,
        "b.com": NetworkDomainPermission.DENY,
    })
    assert net.allowed_domains() == ["a.com"]
    assert net.denied_domains() == ["b.com"]


def test_normalize_profile_network_domains_sorted_and_normalized():
    prof = _prof(network=NetworkSettings(domains={
        "Z.com:443": NetworkDomainPermission.DENY,
        "a.COM.": NetworkDomainPermission.ALLOW,
    }))
    normalize_profile_network_domains(prof)
    assert list(prof.network.domains) == ["a.com", "z.com"]


def test_normalize_noop_without_domains():
    prof = _prof(network=NetworkSettings())
    normalize_profile_network_domains(prof)
    assert prof.network.domains == {}


# --- 解析:单档案 / 继承 / 错误面 ---


def test_resolve_single_profile_without_extends():
    prof = resolve_permission_profile("solo", {"solo": _prof(description="s")})
    assert prof.description == "s"


def test_resolve_child_overrides_parent_and_keeps_own_metadata():
    entries = {
        "parent": _prof(description="p", workspace_roots={"/a": True}, network=NetworkSettings(enabled=True)),
        "child": _prof(
            description="c",
            extends="parent",
            workspace_roots={"/b": True},
            network=NetworkSettings(mode=NetworkMode.FULL),
        ),
    }
    prof = resolve_permission_profile("child", entries)
    assert prof.description == "c"  # 被选档案的声明元数据
    assert prof.extends == "parent"  # extends 也保留
    assert prof.enabled_roots() == ["/a", "/b"]
    assert prof.network.enabled is True  # 父值继承
    assert prof.network.mode is NetworkMode.FULL  # 子值覆盖


def test_resolve_three_level_chain():
    entries = {
        "A": _prof(description="A", extends="B", workspace_roots={"/a": True}),
        "B": _prof(description="B", extends="C", workspace_roots={"/b": True}),
        "C": _prof(description="C", workspace_roots={"/c": True}),
    }
    prof = resolve_permission_profile("A", entries)
    assert prof.description == "A"
    assert prof.enabled_roots() == ["/a", "/b", "/c"]


def test_resolve_merges_network_domains_when_both_declared():
    entries = {
        "parent": _prof(network=NetworkSettings(domains={"Example.COM.": NetworkDomainPermission.ALLOW})),
        "child": _prof(
            extends="parent",
            network=NetworkSettings(domains={"x.com:443": NetworkDomainPermission.DENY}),
        ),
    }
    prof = resolve_permission_profile("child", entries)
    assert prof.network.domains == {
        "example.com": NetworkDomainPermission.ALLOW,
        "x.com": NetworkDomainPermission.DENY,
    }


def test_resolve_does_not_mutate_input_profiles():
    """合并过程不得改写调用方持有的档案对象(深拷贝语义)。"""
    parent = _prof(
        description="p",
        network=NetworkSettings(domains={"A.COM": NetworkDomainPermission.ALLOW}),
    )
    child = _prof(
        extends="parent",
        network=NetworkSettings(domains={"b.com": NetworkDomainPermission.DENY}),
    )
    resolve_permission_profile("child", {"parent": parent, "child": child})
    assert parent.description == "p"
    assert list(parent.network.domains) == ["A.COM"]


def test_undefined_profile_error_message_verbatim():
    with pytest.raises(UndefinedProfileError) as ei:
        resolve_permission_profile("ghost", {})
    assert str(ei.value) == "default_permissions refers to undefined profile `ghost`"


def test_undefined_parent_error_message_verbatim():
    entries = {"child": _prof(extends="ghost")}
    with pytest.raises(UndefinedParentError) as ei:
        resolve_permission_profile("child", entries)
    assert str(ei.value) == (
        "permissions profile `child` extends undefined profile `ghost`"
    )


def test_builtin_parent_prefix_raises_unsupported():
    entries = {"child": _prof(extends=":read-only")}
    with pytest.raises(UnsupportedBuiltInParentError) as ei:
        resolve_permission_profile("child", entries)
    assert str(ei.value) == (
        "permissions profile `child` cannot extend unsupported built-in profile"
        " `:read-only`"
    )


def test_cycle_detection_reports_chain():
    entries = {
        "a": _prof(extends="b"),
        "b": _prof(extends="a"),
    }
    with pytest.raises(CycleError) as ei:
        resolve_permission_profile("a", entries)
    assert ei.value.cycle == ["a", "b", "a"]
    assert "a -> b -> a" in str(ei.value)


def test_parent_lookup_callback_used():
    builtin = _prof(description="builtin", workspace_roots={"/builtin": True})
    prof = resolve_permission_profile(
        "child",
        {"child": _prof(extends=":builtin", workspace_roots={"/c": True})},
        parent_lookup=lambda name: builtin if name == ":builtin" else None,
    )
    assert prof.enabled_roots() == ["/builtin", "/c"]


def test_entries_take_precedence_over_parent_lookup():
    prof = resolve_permission_profile(
        "child",
        {"child": _prof(workspace_roots={"/own": True})},
        parent_lookup=lambda _name: _prof(workspace_roots={"/cb": True}),
    )
    assert prof.enabled_roots() == ["/own"]


# --- 合并函数直测 ---


def test_merge_clears_parent_declaration_metadata():
    parent = _prof(description="p", extends="X")
    child = _prof(description="c")
    merged = merge_permission_profiles(parent, child)
    assert merged.description == "c"
    assert merged.extends is None
    # 父对象被就地清理(codex: parent.description = None)
    assert parent.description is None and parent.extends is None


def test_merge_scalar_child_wins_parent_fallback():
    parent = _prof(network=NetworkSettings(enabled=True, proxy_url="http://p"))
    child = _prof(network=NetworkSettings(proxy_url="http://c"))
    merged = merge_permission_profiles(parent, child)
    assert merged.network.enabled is True
    assert merged.network.proxy_url == "http://c"


def test_merge_glob_scan_depth_child_wins():
    parent = _prof(glob_scan_max_depth=3)
    child = _prof()
    assert merge_permission_profiles(parent, child).glob_scan_max_depth == 3
    child2 = _prof(glob_scan_max_depth=7)
    assert merge_permission_profiles(parent, child2).glob_scan_max_depth == 7
