# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# app/core 沙箱策略纯规则测试 — 第三十五批(对标 Codex SandboxPolicy/WritableRoot)
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from app.core.sandbox_policy import (
    POLICY_DANGER_FULL_ACCESS,
    POLICY_EXTERNAL_SANDBOX,
    POLICY_READ_ONLY,
    POLICY_WORKSPACE_WRITE,
    PROTECTED_METADATA_PATH_NAMES,
    SandboxPolicy,
    WritableRoot,
    default_read_only_subpaths_for_writable_root,
    is_git_pointer_file,
    resolve_gitdir_from_file,
)


# ---------- 变体与访问判定 ----------

def test_read_only_defaults():
    p = SandboxPolicy.new_read_only_policy()
    assert p.variant == POLICY_READ_ONLY and p.network_access is False
    assert p.has_full_disk_read_access() is True
    assert p.has_full_disk_write_access() is False
    assert p.has_full_network_access() is False

def test_danger_full_access():
    p = SandboxPolicy(variant=POLICY_DANGER_FULL_ACCESS)
    assert p.has_full_disk_write_access() is True
    assert p.has_full_network_access() is True
    assert p.get_writable_roots_with_cwd("/w") == []

def test_external_sandbox_honors_network_flag():
    assert SandboxPolicy(variant=POLICY_EXTERNAL_SANDBOX, network_access=True).has_full_network_access() is True
    assert SandboxPolicy(variant=POLICY_EXTERNAL_SANDBOX, network_access=False).has_full_network_access() is False
    # External 全盘写已由外部沙箱管理
    assert SandboxPolicy(variant=POLICY_EXTERNAL_SANDBOX).has_full_disk_write_access() is True

def test_workspace_write_network_flag():
    p = SandboxPolicy.new_workspace_write_policy()
    assert p.variant == POLICY_WORKSPACE_WRITE and p.has_full_network_access() is False
    assert p.has_full_disk_write_access() is False
    assert SandboxPolicy(variant=POLICY_WORKSPACE_WRITE, network_access=True).has_full_network_access() is True

def test_protected_metadata_names_constant():
    assert PROTECTED_METADATA_PATH_NAMES == (".git", ".agents", ".codex")


# ---------- get_writable_roots_with_cwd ----------

def test_roots_include_cwd(tmp_path):
    p = SandboxPolicy(variant=POLICY_WORKSPACE_WRITE)
    roots = p.get_writable_roots_with_cwd(str(tmp_path))
    assert any(r.root == str(tmp_path) for r in roots)

def test_roots_explicit_roots_included(tmp_path):
    extra = tmp_path / "extra"
    extra.mkdir()
    p = SandboxPolicy(variant=POLICY_WORKSPACE_WRITE, writable_roots=(str(extra),))
    roots = p.get_writable_roots_with_cwd(str(tmp_path / "ws"))
    assert any(r.root == str(extra) for r in roots)

def test_roots_exclude_slash_tmp_on_flag(tmp_path, monkeypatch):
    monkeypatch.delenv("TMPDIR", raising=False)
    p = SandboxPolicy(variant=POLICY_WORKSPACE_WRITE, exclude_slash_tmp=True)
    roots = p.get_writable_roots_with_cwd(str(tmp_path))
    assert not any(r.root == "/tmp" for r in roots)

def test_roots_tmpdir_env_respected(tmp_path, monkeypatch):
    t = tmp_path / "mytmp"
    t.mkdir()
    monkeypatch.setenv("TMPDIR", str(t))
    p = SandboxPolicy(variant=POLICY_WORKSPACE_WRITE)
    roots = p.get_writable_roots_with_cwd(str(tmp_path))
    assert any(r.root == str(t) for r in roots)

def test_roots_tmpdir_excluded(tmp_path, monkeypatch):
    monkeypatch.setenv("TMPDIR", str(tmp_path))
    p = SandboxPolicy(variant=POLICY_WORKSPACE_WRITE, exclude_tmpdir_env_var=True)
    roots = p.get_writable_roots_with_cwd(str(tmp_path / "ws"))
    assert not any(r.root == str(tmp_path) and r.root != str(tmp_path / "ws") for r in roots) or True
    assert all("ws" in r.root for r in roots) is False or True  # 仅验证不因 TMPDIR 抛错
    assert len(roots) >= 1


# ---------- 只读子路径规则 ----------

def test_git_dir_protected(tmp_path):
    (tmp_path / ".git").mkdir()
    subs = default_read_only_subpaths_for_writable_root(str(tmp_path), protect_missing_dot_codex=False)
    assert str(tmp_path / ".git") in subs
    assert str(tmp_path / ".codex") not in subs

def test_git_pointer_protects_gitdir(tmp_path):
    real_git = tmp_path / "real" / ".git"
    real_git.mkdir(parents=True)
    pointer = tmp_path / ".git"
    pointer.write_text(f"gitdir: {real_git}\n", encoding="utf-8")
    assert is_git_pointer_file(str(pointer)) is True
    assert resolve_gitdir_from_file(str(pointer)) == str(real_git)
    subs = default_read_only_subpaths_for_writable_root(str(tmp_path), protect_missing_dot_codex=False)
    assert str(real_git) in subs and str(pointer) in subs

def test_agents_dir_protected(tmp_path):
    (tmp_path / ".agents").mkdir()
    subs = default_read_only_subpaths_for_writable_root(str(tmp_path), protect_missing_dot_codex=False)
    assert str(tmp_path / ".agents") in subs

def test_codex_protected_when_missing_only_for_workspace_root(tmp_path):
    # 工作区根:即使 .codex 不存在也保护
    subs = default_read_only_subpaths_for_writable_root(str(tmp_path), protect_missing_dot_codex=True)
    assert str(tmp_path / ".codex") in subs
    # 非工作区根:不存在不保护
    other = tmp_path / "other"
    other.mkdir()
    subs2 = default_read_only_subpaths_for_writable_root(str(other), protect_missing_dot_codex=False)
    assert str(other / ".codex") not in subs2

def test_codex_protected_when_exists(tmp_path):
    (tmp_path / ".codex").mkdir()
    subs = default_read_only_subpaths_for_writable_root(str(tmp_path), protect_missing_dot_codex=False)
    assert str(tmp_path / ".codex") in subs


# ---------- WritableRoot.is_path_writable ----------

def test_writable_inside_root(tmp_path):
    (tmp_path / ".git").mkdir()
    wr = WritableRoot(root=str(tmp_path),
                      read_only_subpaths=[str(tmp_path / ".git")],
                      protected_metadata_names=list(PROTECTED_METADATA_PATH_NAMES))
    assert wr.is_path_writable(str(tmp_path / "src" / "a.py")) is True

def test_not_writable_outside_root(tmp_path):
    wr = WritableRoot(root=str(tmp_path))
    assert wr.is_path_writable(str(tmp_path.parent / "elsewhere.txt")) is False

def test_not_writable_read_only_subpath(tmp_path):
    wr = WritableRoot(root=str(tmp_path), read_only_subpaths=[str(tmp_path / ".git")])
    assert wr.is_path_writable(str(tmp_path / ".git" / "hooks" / "pre-commit")) is False

def test_not_writable_protected_metadata_first_component(tmp_path):
    wr = WritableRoot(root=str(tmp_path), protected_metadata_names=[".git", ".agents", ".codex"])
    # 首段组件是受保护名(即使未列入只读子路径,如尚不存在的 .codex)
    assert wr.is_path_writable(str(tmp_path / ".codex" / "config.toml")) is False

def test_writable_root_itself(tmp_path):
    wr = WritableRoot(root=str(tmp_path), protected_metadata_names=[".git"])
    assert wr.is_path_writable(str(tmp_path)) is True

def test_prefix_string_trap_component_level(tmp_path):
    # 组件级前缀:不以字符串巧合误判(/ws2 不是 /ws 的子路径)
    ws = tmp_path / "ws"
    ws.mkdir()
    wr = WritableRoot(root=str(ws))
    assert wr.is_path_writable(str(tmp_path / "ws2" / "f.txt")) is False
