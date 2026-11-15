# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""sandbox_failure_classifier 归因四态 + exit-gate 防误判 + enforcement 测试。

每条对应 .archify/deepseek-agent-core-src/dsh-sandbox-local__index.js 取证。
"""
from __future__ import annotations

import pytest

from app.core.sandbox_failure_classifier import (
    DENIAL_SIGNATURES,
    RUNNER_FAILURE_RULES,
    STATIC_ENFORCEMENT,
    classify_sandbox_failure,
    enforcement_of,
)


# ---- 四态判定 ----
def test_success_short_circuit():
    v = classify_sandbox_failure(backend="linux_bwrap", exit_code=0, stderr="")
    assert v.kind == "success"


def test_timeout_short_circuit():
    v = classify_sandbox_failure(backend="linux_bwrap", exit_code=None, stderr="", timed_out=True)
    assert v.kind == "timeout"


def test_denied_bwrap_readonly_fs():
    v = classify_sandbox_failure(
        backend="linux_bwrap", exit_code=1, stderr="touch: /etc/passwd: Read-only file system"
    )
    assert v.kind == "denied"
    assert v.matched_denial == "read-only file system"


def test_denied_seatbelt_operation_not_permitted():
    v = classify_sandbox_failure(
        backend="mac_seatbelt", exit_code=1, stderr="cat: /etc/shadow: Operation not permitted"
    )
    assert v.kind == "denied"
    assert v.matched_denial == "operation not permitted"


def test_denied_windows_acl_access_denied():
    v = classify_sandbox_failure(
        backend="windows_acl", exit_code=1, stderr="type: Access is denied."
    )
    assert v.kind == "denied"
    assert v.matched_denial == "access is denied"


def test_denied_is_case_insensitive():
    v = classify_sandbox_failure(
        backend="linux_bwrap", exit_code=1, stderr="READ-ONLY FILE SYSTEM"
    )
    assert v.kind == "denied"


def test_runner_fatal_windows_acl_exit_127():
    v = classify_sandbox_failure(
        backend="windows_acl", exit_code=127, stderr="windows-acl-run: token creation failed"
    )
    assert v.kind == "runner_fatal"
    assert v.matched_fatal == "windows-acl-run: "
    assert v.exit_gated is True  # windows_acl 有 exit-gate(127)


def test_runner_fatal_bwrap_no_gate():
    v = classify_sandbox_failure(
        backend="linux_bwrap", exit_code=1, stderr="bwrap: Creating new namespace failed"
    )
    assert v.kind == "runner_fatal"
    assert v.exit_gated is False  # bwrap 无 exit-gate(任意非 0 命中)


def test_runner_fatal_landlock_informational_not_fatal():
    """landlock 打印 partial enforcement 提示 ⇒ 不算 fatal(降为 denied/business)。"""
    v = classify_sandbox_failure(
        backend="linux_landlock",
        exit_code=1,
        stderr="landlock-run: partial enforcement (older Landlock ABI)\nfoo: permission denied",
    )
    assert v.kind == "denied"  # informational 行不算 fatal,落到 denied
    assert v.notes and "informational" in v.notes[0]


def test_business_failure_no_signature():
    v = classify_sandbox_failure(
        backend="linux_bwrap", exit_code=2, stderr="ls: cannot access 'x': No such file"
    )
    assert v.kind == "business_failure"


def test_oom_killed():
    v = classify_sandbox_failure(
        backend="linux_bwrap", exit_code=137, stderr="Traceback ... MemoryError"
    )
    assert v.kind == "oom_killed"


# ---- exit-gate 防误判(核心超越点)----
def test_exit_gate_prevents_misclassification():
    """命令 merely PRINTS windows-acl-run 但退出码非 127 ⇒ 不算 runner fatal。

    dsh 取证(:237-240):"a confined command that merely PRINTS the signature
    ... is never misclassified as 'the command did not run'."
    """
    v = classify_sandbox_failure(
        backend="windows_acl",
        exit_code=1,  # 非 127,不在 gate
        stderr="myapp: windows-acl-run: just echoing the string",
    )
    assert v.kind != "runner_fatal"  # 防:签名命中但 gate 不过


def test_informational_line_not_misjudged_as_fatal():
    """landlock informational(partial enforcement)打印 ⇒ 不当 fatal。"""
    rule = RUNNER_FAILURE_RULES["linux_landlock"]
    assert rule.informational_lines  # 有 informational 行契约


# ---- enforcement 声明 ----
def test_static_enforcement_backends():
    assert STATIC_ENFORCEMENT["linux_bwrap"] == "full"
    assert STATIC_ENFORCEMENT["mac_seatbelt"] == "full"
    assert STATIC_ENFORCEMENT["windows_acl"] == "partial"  # NTFS 硬链接别名 + 读不设限


def test_enforcement_probe_overrides_static():
    """probe 优先:landlock 静态 full,但 probe 报 partial 时以 probe 为准。"""
    assert enforcement_of("linux_landlock", probed="partial") == "partial"
    assert enforcement_of("linux_landlock", probed="unusable") == "unusable"
    assert enforcement_of("linux_landlock") == "full"  # 无 probe 用静态


def test_verdict_carries_enforcement():
    v = classify_sandbox_failure(
        backend="windows_acl", exit_code=1, stderr="Access is denied.", probed=None
    )
    assert v.enforcement == "partial"


def test_denial_signature_table_completeness():
    """四后端都有否认方言(防漏配)。"""
    for b in ("linux_bwrap", "linux_landlock", "mac_seatbelt", "windows_acl"):
        assert DENIAL_SIGNATURES[b], f"{b} 缺否认方言"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
