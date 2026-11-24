# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP Elicitation 结果动作封闭集测试 —— 遵循统一工程规范。

取证纠偏：三档以 EnumItems 形态逐字确证并与 ElicitResult.action 字段配对；
同样的 acceptdeclinecancel token 在 persistence/prompts 别轴复用，本集只认与 ElicitResult 配对处。
"""

from __future__ import annotations

import pytest

from app.core.elicit_result_action import (
    ELICIT_RESULT_ACTION_VALUES,
    ElicitResultAction,
    ElicitResultActionError,
    ensure_elicit_result_action,
    is_accept,
    is_terminal_response,
    stops_action,
)


class TestClosedSet:
    def test_member_count_is_3(self) -> None:
        assert len(ElicitResultAction) == 3

    def test_literal_table_matches_members(self) -> None:
        assert tuple(m.value for m in ElicitResultAction) == ELICIT_RESULT_ACTION_VALUES

    def test_binary_token_anchor(self) -> None:
        """strings 逐字锚 ``EnumItems accept decline cancel`` + ``ElicitResultactioncontent``。"""
        assert {"accept", "decline", "cancel"} == {m.value for m in ElicitResultAction}


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", ELICIT_RESULT_ACTION_VALUES)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_elicit_result_action(value) == value

    @pytest.mark.parametrize("bad", ["", "ignore", "retry", "confirmed", "accepted", "APPROVE"])
    def test_unregistered_raises(self, bad: str) -> None:
        """本仓别轴同形字符串（resume 的 accept/abort、super_agent 的 ignore）均被拒。"""
        with pytest.raises(ElicitResultActionError):
            ensure_elicit_result_action(bad)

    def test_non_string_raises(self) -> None:
        with pytest.raises(ElicitResultActionError):
            ensure_elicit_result_action(True)  # type: ignore[arg-type]

    def test_error_message_names_module(self) -> None:
        with pytest.raises(ElicitResultActionError, match="elicit_result_action"):
            ensure_elicit_result_action("ignore")


class TestSemantics:
    def test_accept_submits_data(self) -> None:
        assert is_accept("accept") is True

    @pytest.mark.parametrize("other", ["decline", "cancel"])
    def test_non_accept_not_accept(self, other: str) -> None:
        assert is_accept(other) is False

    @pytest.mark.parametrize("stopper", ["decline", "cancel"])
    def test_decline_and_cancel_stop_action(self, stopper: str) -> None:
        """decline 与 cancel 都让服务器停止 elicitation 触发的动作。"""
        assert stops_action(stopper) is True

    def test_accept_does_not_stop_action(self) -> None:
        assert stops_action("accept") is False

    @pytest.mark.parametrize("value", ELICIT_RESULT_ACTION_VALUES)
    def test_all_registered_are_terminal_response(self, value: str) -> None:
        """语义声明：ElicitResult 一旦返回即终局（不存在 pending result，等待中用别的类型）。"""
        assert is_terminal_response(value) is True

    def test_unregistered_raises_on_semantics(self) -> None:
        with pytest.raises(ElicitResultActionError):
            is_accept("ignore")
        with pytest.raises(ElicitResultActionError):
            stops_action("ignore")
        with pytest.raises(ElicitResultActionError):
            is_terminal_response("ignore")


class TestReverseMutations:
    def test_decline_must_stop_action(self) -> None:
        assert stops_action("decline") is not False

    def test_accept_must_not_stop_action(self) -> None:
        assert stops_action("accept") is not True

    def test_cancel_is_not_accept(self) -> None:
        """cancel 与 decline 同为停止动作，但 cancel 不等于 accept。"""
        assert is_accept("cancel") is False
        assert stops_action("cancel") is True


class TestEnumType:
    def test_is_strenum(self) -> None:
        assert ElicitResultAction.ACCEPT.value == "accept"
        assert isinstance(ElicitResultAction.DECLINE.value, str)


class TestNotOtherAxis:
    def test_persistence_and_prompts_axes_excluded(self) -> None:
        """同样的 acceptdeclinecancel token 在 persistence/prompts 别轴复用，
        但那里没有第三个动作，本集恒为三档 MCP elicitation 决策。"""
        assert ELICIT_RESULT_ACTION_VALUES == ("accept", "decline", "cancel")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
