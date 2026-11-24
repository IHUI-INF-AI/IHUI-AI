# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""session 权限文件与审计 trace 的 fail-closed 校验。"""

from __future__ import annotations

import json

import pytest

from app.services.session_audit import (
    PERMISSION_FILENAME,
    TRACE_EXITED,
    TRACE_FAILED,
    TRACE_STARTED,
    PermissionDecision,
    TraceEvent,
    append_trace,
    can_execute,
    read_permission_file,
    read_traces,
    session_directory,
    write_permission_file,
)


def test_session_directory_rejects_path_traversal(tmp_path):
    for bad in ["", ".", "..", "../escape", "a/b", "a\\b", "x\x00y"]:
        with pytest.raises(ValueError):
            session_directory(tmp_path, bad)
    assert session_directory(tmp_path, "sess-1") == tmp_path / "sess-1"


def test_permission_file_absent_defaults_to_undetermined_not_allowed(tmp_path):
    directory = session_directory(tmp_path, "s1")
    result = read_permission_file(directory)
    assert result.decision is PermissionDecision.UNDETERMINED
    assert result.reason == "permission-file-absent"
    assert can_execute(directory) is False


def test_permission_file_malformed_or_wrong_version_is_undetermined(tmp_path):
    directory = session_directory(tmp_path, "s1")
    directory.mkdir()
    (directory / PERMISSION_FILENAME).write_text("{not-json", encoding="utf-8")
    assert read_permission_file(directory).reason == "permission-file-malformed"
    assert can_execute(directory) is False

    write_permission_file(directory, allow=True, schema_version=999)
    assert read_permission_file(directory).reason == "permission-file-version"
    assert can_execute(directory) is False


def test_non_bool_allow_is_undetermined_not_truthy(tmp_path):
    directory = session_directory(tmp_path, "s1")
    directory.mkdir()
    for raw in [
        '{"schemaVersion":1,"allow":"true"}',
        '{"schemaVersion":1,"allow":1}',
        '{"schemaVersion":1,"allow":null}',
        '{"schemaVersion":1}',
    ]:
        (directory / PERMISSION_FILENAME).write_text(raw, encoding="utf-8")
        assert read_permission_file(directory).decision is PermissionDecision.UNDETERMINED
        assert can_execute(directory) is False


def test_explicit_deny_and_allow_roundtrip(tmp_path):
    directory = session_directory(tmp_path, "s1")
    write_permission_file(directory, allow=False, reason="operator-denied")
    result = read_permission_file(directory)
    assert result.decision is PermissionDecision.DENIED
    assert result.reason == "permission-explicit-deny"
    assert can_execute(directory) is False

    write_permission_file(directory, allow=True, reason="operator-ok")
    assert read_permission_file(directory).decision is PermissionDecision.ALLOWED
    assert can_execute(directory) is True


def test_trace_lifecycle_started_failed_exited(tmp_path):
    directory = session_directory(tmp_path, "s1")
    append_trace(directory, TraceEvent(TRACE_STARTED, "s1", fields={"argv0": "python"}))
    append_trace(directory, TraceEvent(TRACE_FAILED, "s1", fields={"stage": "spawn"}))
    append_trace(directory, TraceEvent(TRACE_EXITED, "s1", fields={"returncode": -1}))
    traces = read_traces(directory)
    assert [t["event"] for t in traces] == [TRACE_STARTED, TRACE_FAILED, TRACE_EXITED]
    assert all(t["sessionId"] == "s1" for t in traces)
    # 只记诊断字段,不把命令正文/环境写进 trace
    assert "command" not in json.dumps(traces)
    assert "PATH" not in json.dumps(traces)


def test_trace_rejects_unknown_event(tmp_path):
    directory = session_directory(tmp_path, "s1")
    with pytest.raises(ValueError):
        append_trace(directory, TraceEvent("fake-event", "s1"))
    assert read_traces(directory) == []


def test_trace_absent_is_empty_not_error(tmp_path):
    assert read_traces(session_directory(tmp_path, "never-created")) == []


def test_trace_does_not_leak_secrets_in_fields(tmp_path):
    """调用方误传敏感键时拒绝写入(诊断入口也不成为泄漏面)。"""
    directory = session_directory(tmp_path, "s1")
    for key in ["password", "apiKey", "token", "authorization"]:
        with pytest.raises(ValueError):
            append_trace(directory, TraceEvent(TRACE_STARTED, "s1", fields={key: "x"}))
