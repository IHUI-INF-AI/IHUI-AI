# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/shell_snapshot.py 第二十八批测试(对标 Codex shell_snapshot_tests.rs)。

import os
import shutil
from pathlib import Path

import pytest

from app.core.shell_snapshot import (
    ShellSnapshotData,
    bash_snapshot_capture_script,
    capture_shell_snapshot,
    cleanup_stale_snapshots,
    is_secret_env_key,
    parse_snapshot,
    render_snapshot_script,
    snapshot_env_for_exec,
)


RAW = (
    b"# Snapshot file\n"
    b"# Unset all aliases to avoid conflicts with functions\n"
    b"declare -f __ihui_tool\n"
    b"# setopts 2\n"
    b"set -o errexit\n"
    b"set -o pipefail\n"
    b"\0"
    b"# aliases 1\n"
    b"alias ll='ls -la'\n"
    b"\0"
    b"PATH=/usr/local/bin:/usr/bin\0"
    b"MY_VAR=hello\0"
    b"MULTI=line1\nline2\0"
    b"OPENAI_API_KEY=sk-secret\0"
    b"\0"
)

PARENT_ENV = {"PATH": "/usr/bin", "MY_VAR": "old"}


class TestParseSnapshot:
    def test_parse_sections(self):
        data = parse_snapshot(RAW, PARENT_ENV)
        assert data is not None
        assert "# Snapshot file" in data.shell_state
        assert "set -o errexit" in data.shell_state
        assert "alias ll='ls -la'" in data.aliases
        assert data.env["MY_VAR"] == "hello"
        assert data.env["MULTI"] == "line1\nline2"
        assert data.env["OPENAI_API_KEY"] == "sk-secret"

    def test_profile_diff(self):
        data = parse_snapshot(RAW, PARENT_ENV)
        assert "MY_VAR" in data.profile_overwritten_keys
        assert "PATH" in data.profile_overwritten_keys
        assert "MULTI" in data.profile_added_keys

    def test_invalid_rejected(self):
        assert parse_snapshot(b"", PARENT_ENV) is None
        assert parse_snapshot(b"no-null-delims", PARENT_ENV) is None
        assert parse_snapshot(b"a\0b\0c", PARENT_ENV) is None  # 无头标记

    def test_env_record_without_value_sign_skipped(self):
        raw = b"# Snapshot file\nx\0\0NOEQ\0GOOD=1\0"
        data = parse_snapshot(raw)
        assert data is not None
        assert data.env == {"GOOD": "1"}


class TestSecretRedaction:
    def test_secret_key_detection(self):
        assert is_secret_env_key("OPENAI_API_KEY")
        assert is_secret_env_key("my_secret")
        assert is_secret_env_key("GITHUB_TOKEN")
        assert is_secret_env_key("token_count")
        assert not is_secret_env_key("PATH")
        assert not is_secret_env_key("HOME")

    def test_render_redacts_secrets(self):
        data = parse_snapshot(RAW, PARENT_ENV)
        script = render_snapshot_script(data)
        assert "sk-secret" not in script
        assert "OPENAI_API_KEY" not in script
        assert "export MY_VAR=hello" in script
        assert "line1" in script  # 多行值 shlex 引用安全

    def test_render_keep_secrets_when_disabled(self):
        data = parse_snapshot(RAW, PARENT_ENV)
        script = render_snapshot_script(data, redact_secrets=False)
        assert "sk-secret" in script

    def test_render_starts_with_unalias(self):
        data = parse_snapshot(RAW, PARENT_ENV)
        lines = render_snapshot_script(data).splitlines()
        assert lines[0] == "# Snapshot file"
        assert "unalias -a" in lines[2]


class TestCaptureScript:
    def test_script_structure(self):
        script = bash_snapshot_capture_script()
        assert "__ihui_snapshot_command" in script
        assert "declare -f" in script
        assert "alias -p" in script
        assert "env" in script
        assert '. "$HOME/.bashrc"' in script
        assert "unalias -a" in script

    def test_non_interactive_skips_bashrc(self):
        script = bash_snapshot_capture_script(interactive=False)
        assert '. "$HOME/.bashrc"' not in script


class TestCleanup:
    def test_cleanup_removes_only_own_session(self, tmp_path):
        keep = tmp_path / "s1.123.sh"
        stale_tmp = tmp_path / "s1.tmp-456"
        other = tmp_path / "s2.789.sh"
        for p in (keep, stale_tmp, other):
            p.write_text("# Snapshot file\n", encoding="utf-8")
        removed = cleanup_stale_snapshots(tmp_path, "s1")
        assert removed == 2
        assert not keep.exists()
        assert not stale_tmp.exists()
        assert other.exists()

    def test_cleanup_missing_dir(self, tmp_path):
        assert cleanup_stale_snapshots(tmp_path / "nope", "s1") == 0


class TestCaptureIntegration:
    @pytest.mark.skipif(shutil.which("bash") is None, reason="bash 不可用")
    def test_real_bash_capture_roundtrip(self, tmp_path):
        snap = capture_shell_snapshot(
            "bash",
            str(tmp_path),
            str(tmp_path / "snaps"),
            "sess-test",
            parent_env={"PATH": os.environ.get("PATH", ""), "IHUI_TEST_MARKER": "1"},
        )
        if snap is None:
            pytest.skip("登录 shell 捕获在本机不可用(如 profile 崩溃)")
        assert Path(snap.path).exists()
        text = Path(snap.path).read_text(encoding="utf-8")
        assert text.startswith("# Snapshot file")
        assert Path(snap.path).name.startswith("sess-test.")
        assert isinstance(snap.credential_keys, list)
        # 执行环境合成:快照环境覆盖基础,凭据默认排除
        merged = snapshot_env_for_exec(snap, {"BASE": "1"}, exclude_secrets=True)
        assert merged["BASE"] == "1"
        for k in snap.credential_keys:
            assert k not in merged
        # 清理能删除本会话快照
        assert cleanup_stale_snapshots(Path(snap.path).parent, "sess-test") >= 1

    def test_capture_failure_returns_none(self, tmp_path):
        assert (
            capture_shell_snapshot(
                "definitely-not-a-shell-xyz", str(tmp_path), str(tmp_path), "s"
            )
            is None
        )
