# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""沙箱权限请求档位封闭集测试 —— 遵循统一工程规范。

取证纠偏：三档值域逐字确证（对照物 strings 锚）；``none`` 归属未确证故单列不计入成员。
"""

from __future__ import annotations

import pytest

from app.core.sandbox_permission_request import (
    NONE_DEFAULT,
    SANDBOX_PERMISSION_REQUEST_VALUES,
    SandboxPermissionError,
    SandboxPermissionRequest,
    ensure_sandbox_permission_request,
    is_full_escalation,
    requires_user_approval,
)


class TestClosedSet:
    def test_member_count_is_3(self) -> None:
        """对照物逐字确证三档。"""
        assert len(SandboxPermissionRequest) == 3

    def test_literal_table_matches_members(self) -> None:
        assert tuple(
            m.value for m in SandboxPermissionRequest
        ) == SANDBOX_PERMISSION_REQUEST_VALUES

    def test_binary_token_anchors(self) -> None:
        assert {
            "use_default",
            "require_escalated",
            "with_additional_permissions",
        } == {m.value for m in SandboxPermissionRequest}

    def test_none_not_a_member(self) -> None:
        """``none`` 归属未确证，不计入封闭集成员。"""
        assert NONE_DEFAULT == "none"
        assert "none" not in {m.value for m in SandboxPermissionRequest}


class TestEnsureClosedSet:
    def test_registered_values_pass_through(self) -> None:
        for m in SandboxPermissionRequest:
            assert ensure_sandbox_permission_request(m.value) == m.value

    def test_none_default_passes_through(self) -> None:
        assert ensure_sandbox_permission_request(NONE_DEFAULT) == "none"

    def test_unregistered_raises(self) -> None:
        with pytest.raises(SandboxPermissionError):
            ensure_sandbox_permission_request("sudo_all_the_things")

    def test_empty_string_raises(self) -> None:
        with pytest.raises(SandboxPermissionError):
            ensure_sandbox_permission_request("")

    def test_non_string_raises(self) -> None:
        with pytest.raises(SandboxPermissionError):
            ensure_sandbox_permission_request(123)  # type: ignore[arg-type]

    def test_error_message_names_module(self) -> None:
        with pytest.raises(SandboxPermissionError, match="sandbox_permission_request"):
            ensure_sandbox_permission_request("bogus")


class TestRequiresUserApproval:
    def test_require_escalated_needs_approval(self) -> None:
        assert requires_user_approval("require_escalated") is True

    def test_with_additional_permissions_needs_approval(self) -> None:
        assert requires_user_approval("with_additional_permissions") is True

    def test_use_default_no_approval(self) -> None:
        assert requires_user_approval("use_default") is False

    def test_none_no_approval(self) -> None:
        assert requires_user_approval(NONE_DEFAULT) is False

    def test_unregistered_raises_not_false(self) -> None:
        """未登记档位抛错，不静默判 False（§0 铁律 3）。"""
        with pytest.raises(SandboxPermissionError):
            requires_user_approval("bogus")


class TestIsFullEscalation:
    def test_require_escalated_is_full(self) -> None:
        assert is_full_escalation("require_escalated") is True

    def test_with_additional_permissions_is_not_full(self) -> None:
        """追加权限非整体越权。"""
        assert is_full_escalation("with_additional_permissions") is False

    def test_use_default_is_not_full(self) -> None:
        assert is_full_escalation("use_default") is False

    def test_none_is_not_full(self) -> None:
        assert is_full_escalation(NONE_DEFAULT) is False

    def test_unregistered_raises(self) -> None:
        with pytest.raises(SandboxPermissionError):
            is_full_escalation("bogus")


class TestReverseMutations:
    def test_use_default_must_not_require_approval(self) -> None:
        assert requires_user_approval("use_default") is not True

    def test_require_escalated_must_be_full(self) -> None:
        assert is_full_escalation("require_escalated") is not False

    def test_with_additional_must_require_approval(self) -> None:
        """追加权限若误判为不需审批，此测试暴露。"""
        assert requires_user_approval("with_additional_permissions") is not False


class TestEnumType:
    def test_is_strenum(self) -> None:
        assert SandboxPermissionRequest.USE_DEFAULT.value == "use_default"
        assert isinstance(SandboxPermissionRequest.USE_DEFAULT.value, str)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
