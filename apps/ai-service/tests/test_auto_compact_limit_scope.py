# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""auto-compact token 上限作用域封闭集测试 —— 遵循统一工程规范。

取证纠偏：``LimitScope`` 两档逐字确证（对照物 strings 锚 ``LimitScopetotalbody``）；
是否有第三档未确证，故只收两档。
"""

from __future__ import annotations

import pytest

from app.core.auto_compact_limit_scope import (
    AUTO_COMPACT_LIMIT_SCOPE_VALUES,
    AutoCompactLimitScope,
    AutoCompactLimitScopeError,
    body_shares_limit_with_prefix,
    ensure_auto_compact_limit_scope,
    prefix_counts_toward_limit,
)


class TestClosedSet:
    def test_member_count_is_2(self) -> None:
        """对照物逐字确证两档 total/body。"""
        assert len(AutoCompactLimitScope) == 2

    def test_literal_table_matches_members(self) -> None:
        assert tuple(
            m.value for m in AutoCompactLimitScope
        ) == AUTO_COMPACT_LIMIT_SCOPE_VALUES

    def test_binary_token_anchor(self) -> None:
        """strings 逐字锚 ``LimitScopetotalbody``。"""
        assert {"total", "body"} == {m.value for m in AutoCompactLimitScope}


class TestEnsureClosedSet:
    def test_registered_values_pass_through(self) -> None:
        for m in AutoCompactLimitScope:
            assert ensure_auto_compact_limit_scope(m.value) == m.value

    def test_unregistered_raises(self) -> None:
        with pytest.raises(AutoCompactLimitScopeError):
            ensure_auto_compact_limit_scope("prefix_only")

    def test_empty_string_raises(self) -> None:
        with pytest.raises(AutoCompactLimitScopeError):
            ensure_auto_compact_limit_scope("")

    def test_non_string_raises(self) -> None:
        with pytest.raises(AutoCompactLimitScopeError):
            ensure_auto_compact_limit_scope(3)  # type: ignore[arg-type]

    def test_error_message_names_module(self) -> None:
        with pytest.raises(AutoCompactLimitScopeError, match="auto_compact_limit_scope"):
            ensure_auto_compact_limit_scope("bogus")


class TestDenominatorSemantics:
    def test_total_counts_prefix(self) -> None:
        """全窗口口径：prefix 计入分母（挤占 body 预算）。"""
        assert prefix_counts_toward_limit("total") is True
        assert body_shares_limit_with_prefix("total") is True

    def test_body_excludes_prefix(self) -> None:
        """body 口径：prefix 不计入，body 独享 token_limit。"""
        assert prefix_counts_toward_limit("body") is False
        assert body_shares_limit_with_prefix("body") is False

    def test_unregistered_raises_not_bool(self) -> None:
        """未登记档位抛错，不静默判 False（§0 铁律 3）。"""
        with pytest.raises(AutoCompactLimitScopeError):
            prefix_counts_toward_limit("bogus")
        with pytest.raises(AutoCompactLimitScopeError):
            body_shares_limit_with_prefix("bogus")


class TestReverseMutations:
    def test_total_must_count_prefix(self) -> None:
        assert prefix_counts_toward_limit("total") is not False

    def test_body_must_exclude_prefix(self) -> None:
        assert prefix_counts_toward_limit("body") is not True


class TestEnumType:
    def test_is_strenum(self) -> None:
        assert AutoCompactLimitScope.TOTAL.value == "total"
        assert isinstance(AutoCompactLimitScope.BODY.value, str)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
