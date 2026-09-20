# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:git workspaces 元数据测试 — 对标 codex turn_metadata.rs git enrichment + sanitized_git_url.rs。"""

from __future__ import annotations

import os
import subprocess

import pytest

from app.core.git_workspaces_metadata import (
    WorkspaceGitMetadata,
    collect_git_workspaces,
    sanitize_git_url,
    workspaces_to_metadata_value,
)


def _init_repo(tmp_path: str) -> str:
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.email", "t@t"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.name", "t"], cwd=tmp_path, check=True)
    open(os.path.join(tmp_path, "f.txt"), "w").write("x")
    subprocess.run(["git", "add", "f.txt"], cwd=tmp_path, check=True)
    subprocess.run(["git", "commit", "-qm", "c1"], cwd=tmp_path, check=True)
    return tmp_path


class TestSanitizeGitUrl:
    def test_no_credentials_preserved_verbatim(self) -> None:
        u = "https://github.com/x/y.git"
        assert sanitize_git_url(u).value == u

    def test_https_password_stripped(self) -> None:
        out = sanitize_git_url("https://user:secret@github.com/x/y.git")
        assert "secret" not in out.value
        assert out.value == "https://github.com/x/y.git"

    def test_https_username_stripped(self) -> None:
        out = sanitize_git_url("https://user@github.com/x/y.git")
        assert "user@" not in out.value
        assert out.value == "https://github.com/x/y.git"

    def test_ssh_git_user_preserved(self) -> None:
        u = "ssh://git@github.com/x/y.git"
        assert sanitize_git_url(u).value == u

    def test_ssh_other_user_stripped(self) -> None:
        out = sanitize_git_url("ssh://alice@github.com/x/y.git")
        assert "alice" not in out.value
        assert out.value == "ssh://github.com/x/y.git"

    def test_scp_style_user_stripped_host_path_kept(self) -> None:
        out = sanitize_git_url("alice@github.com:x/y.git")
        assert out.value == "github.com:x/y.git"

    def test_helper_prefix_peeled_and_sanitized(self) -> None:
        out = sanitize_git_url("ext::https://user:pw@host/x.git")
        assert "pw" not in out.value
        assert out.value == "ext::https://host/x.git"

    def test_helper_with_whitespace_rejected(self) -> None:
        assert sanitize_git_url("helper::echo secret | sh") is None


class TestCollectGitWorkspaces:
    def test_collect_on_real_repo(self, tmp_path) -> None:
        root = str(tmp_path)
        _init_repo(root)
        ws = collect_git_workspaces(root)
        assert len(ws) == 1
        meta = next(iter(ws.values()))
        assert meta.latest_git_commit_hash and len(meta.latest_git_commit_hash) == 40
        assert meta.has_changes is False

    def test_detects_uncommitted_changes(self, tmp_path) -> None:
        root = str(tmp_path)
        _init_repo(root)
        open(os.path.join(root, "f.txt"), "a").write("more")
        meta = next(iter(collect_git_workspaces(root).values()))
        assert meta.has_changes is True

    def test_non_repo_returns_empty(self, tmp_path) -> None:
        assert collect_git_workspaces(str(tmp_path)) == {}

    def test_metadata_value_shape(self, tmp_path) -> None:
        root = str(tmp_path)
        _init_repo(root)
        value = workspaces_to_metadata_value(collect_git_workspaces(root))
        (entry,) = value.values()
        assert "latest_git_commit_hash" in entry
        assert entry["has_changes"] is False
        # 无 remote 时 associated_remote_urls 缺省
        assert "associated_remote_urls" not in entry


def test_workspace_metadata_empty_check() -> None:
    assert WorkspaceGitMetadata().is_empty()
    assert not WorkspaceGitMetadata(has_changes=False).is_empty()


@pytest.mark.parametrize(
    "url,expect_none",
    [
        ("https://ok.com/a.git", False),
        ("::bad", True),
    ],
)
def test_param_url_shapes(url: str, expect_none: bool) -> None:
    out = sanitize_git_url(url)
    assert (out is None) == expect_none
