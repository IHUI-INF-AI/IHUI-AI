# app/core 权限指令与已批准命令前缀片段测试 — 第五十六批(对标 Codex
# permissions_instructions.rs / approved_command_prefix_saved.rs /
# world_state/permissions.rs)
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from app.core.permissions_instructions import (
    APPROVED_COMMAND_PREFIX_SAVED_MESSAGE_PREFIX,
    PERMISSIONS_INSTRUCTIONS_CLOSE_TAG,
    PERMISSIONS_INSTRUCTIONS_OPEN_TAG,
    PermissionsState,
    build_approved_command_prefix_saved_fragment,
    build_permissions_instructions_fragment,
    format_allow_prefixes,
)


# ---------------------------------------------------------------------------
# format_allow_prefixes
# ---------------------------------------------------------------------------
def test_format_allow_prefixes_empty_set_is_none():
    assert format_allow_prefixes(set()) is None


def test_format_allow_prefixes_empty_list_is_none():
    assert format_allow_prefixes([]) is None


def test_format_allow_prefixes_single_prefix():
    out = format_allow_prefixes([["git", "status"]])
    assert out == '- ["git", "status"]'


def test_format_allow_prefixes_json_encodes_tokens():
    # 含空格/引号/特殊字符的 token 必须经 JSON 编码
    out = format_allow_prefixes([["echo", "hello world"]])
    assert out == '- ["echo", "hello world"]'
    out2 = format_allow_prefixes([['sh', '-c', 'echo "x"']])
    assert out2 == '- ["sh", "-c", "echo \\"x\\""]'


def test_format_allow_prefixes_sorts_by_length_then_chars():
    out = format_allow_prefixes([["b", "c"], ["a"], ["aa", "bb"]])
    assert out == '- ["a"]\n- ["b", "c"]\n- ["aa", "bb"]'


def test_format_allow_prefixes_multiple_groups_render():
    out = format_allow_prefixes(
        [["npm", "run", "dev"], ["gh", "pr", "check"], ["cargo", "test"]]
    )
    assert out == (
        '- ["cargo", "test"]\n- ["gh", "pr", "check"]\n- ["npm", "run", "dev"]'
    )


def test_format_allow_prefixes_set_input_accepted():
    out = format_allow_prefixes({("git", "log")})
    assert out == '- ["git", "log"]'


# ---------------------------------------------------------------------------
# build_approved_command_prefix_saved_fragment(逐字)
# ---------------------------------------------------------------------------
def test_saved_fragment_verbatim():
    frag = build_approved_command_prefix_saved_fragment('- ["git", "status"]')
    assert frag is not None
    assert frag["type"] == "message"
    assert frag["role"] == "developer"
    assert frag["content"][0]["type"] == "input_text"
    assert (
        frag["content"][0]["text"]
        == f"{APPROVED_COMMAND_PREFIX_SAVED_MESSAGE_PREFIX}\n- [\"git\", \"status\"]"
    )


def test_saved_fragment_no_markers():
    frag = build_approved_command_prefix_saved_fragment("- [\"git\", \"status\"]")
    assert frag is not None
    assert PERMISSIONS_INSTRUCTIONS_OPEN_TAG not in frag["content"][0]["text"]


def test_saved_fragment_empty_is_none():
    assert build_approved_command_prefix_saved_fragment(None) is None
    assert build_approved_command_prefix_saved_fragment("") is None


# ---------------------------------------------------------------------------
# build_permissions_instructions_fragment
# ---------------------------------------------------------------------------
def test_instructions_fragment_is_developer_with_markers():
    frag = build_permissions_instructions_fragment(
        approval_policy="never",
        sandbox_variant="workspace-write",
        writable_roots=[],
        cwd="/repo",
    )
    assert frag["role"] == "developer"
    text = frag["content"][0]["text"]
    assert text.startswith(f"{PERMISSIONS_INSTRUCTIONS_OPEN_TAG}\n")
    assert text.rstrip().endswith(PERMISSIONS_INSTRUCTIONS_CLOSE_TAG)


def test_instructions_fragment_contains_approval_text_and_cwd():
    frag = build_permissions_instructions_fragment(
        approval_policy="never",
        sandbox_variant="workspace-write",
        writable_roots=[],
        cwd="/repo",
    )
    text = frag["content"][0]["text"]
    assert "Approval policy" in text
    assert "/repo" in text
    assert "sandbox_mode` is `workspace-write`" in text


def test_instructions_fragment_network_access_word():
    on = build_permissions_instructions_fragment(
        approval_policy="never", sandbox_variant="read-only", writable_roots=[], cwd="/x", network_access=True
    )
    off = build_permissions_instructions_fragment(
        approval_policy="never", sandbox_variant="read-only", writable_roots=[], cwd="/x", network_access=False
    )
    assert "Network access is enabled." in on["content"][0]["text"]
    assert "Network access is restricted." in off["content"][0]["text"]


def test_instructions_fragment_no_writable_roots_for_read_only():
    frag = build_permissions_instructions_fragment(
        approval_policy="never", sandbox_variant="read-only", writable_roots=[], cwd="/x"
    )
    assert "writable root" not in frag["content"][0]["text"]


# ---------------------------------------------------------------------------
# PermissionsState / render_diff 三分支
# ---------------------------------------------------------------------------
def test_permissions_state_new_snapshot_shape():
    st = PermissionsState.new("never", "read-only", [], "/repo", [["git", "status"]])
    snap = st.snapshot
    assert isinstance(snap, tuple)
    assert isinstance(snap[0], str)  # 指令哈希
    assert isinstance(snap[1], frozenset)


def test_diff_same_hash_same_prefixes_is_none():
    st = PermissionsState.new("never", "read-only", [], "/repo", [["git", "status"]])
    snap = st.snapshot
    st2 = PermissionsState.new("never", "read-only", [], "/repo", [["git", "status"]])
    assert st2.render_diff(snap) is None


def test_diff_same_hash_subset_added_returns_saved():
    st = PermissionsState.new("never", "read-only", [], "/repo", [["git", "status"]])
    snap = st.snapshot
    st2 = PermissionsState.new(
        "never", "read-only", [], "/repo", [["git", "status"], ["npm", "run", "dev"]]
    )
    diff = st2.render_diff(snap)
    assert diff is not None
    text = diff["content"][0]["text"]
    assert text.startswith(f"{APPROVED_COMMAND_PREFIX_SAVED_MESSAGE_PREFIX}\n")
    assert '- ["npm", "run", "dev"]' in text
    assert '- ["git", "status"]' not in text  # 仅增量


def test_diff_instructions_changed_resends_whole():
    st = PermissionsState.new("never", "read-only", [], "/repo", [])
    snap = st.snapshot
    st2 = PermissionsState.new("on_request", "read-only", [], "/repo", [])
    diff = st2.render_diff(snap)
    assert diff is not None
    assert PERMISSIONS_INSTRUCTIONS_OPEN_TAG in diff["content"][0]["text"]


def test_diff_non_subset_removal_resends_whole():
    st = PermissionsState.new("never", "read-only", [], "/repo", [["git", "status"], ["npm", "run"]])
    snap = st.snapshot
    st2 = PermissionsState.new("never", "read-only", [], "/repo", [["git", "status"]])
    diff = st2.render_diff(snap)
    assert diff is not None
    assert PERMISSIONS_INSTRUCTIONS_OPEN_TAG in diff["content"][0]["text"]


def test_diff_absent_resends_whole():
    st = PermissionsState.new("never", "read-only", [], "/repo", [])
    diff = st.render_diff(None)
    assert diff is not None
    assert PERMISSIONS_INSTRUCTIONS_OPEN_TAG in diff["content"][0]["text"]


def test_diff_workspace_write_cwd_change_resends_whole():
    st = PermissionsState.new("never", "workspace-write", [], "/repo", [])
    snap = st.snapshot
    st2 = PermissionsState.new("never", "workspace-write", [], "/other", [])
    diff = st2.render_diff(snap)
    assert diff is not None
    assert PERMISSIONS_INSTRUCTIONS_OPEN_TAG in diff["content"][0]["text"]
    assert "/other" in diff["content"][0]["text"]
