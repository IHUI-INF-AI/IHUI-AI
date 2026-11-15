# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""browser_confirmation_hygiene 单测 — 钉住 A.4 措辞/时机/合并/冗余四维。"""

from __future__ import annotations

import pytest

from app.services.browser_confirmation_hygiene import (
    audit_confirmation_prompt,
    decide_ask_timing,
    is_redundant_confirmation,
    should_merge_confirmations,
)

# ── 措辞体检 ───────────────────────────────────────────────────────────────


def test_good_prompt_passes() -> None:
    a = audit_confirmation_prompt(
        prompt="这会把你的邮箱和手机号发送到 shop.example.com,存在泄露风险;因为表单提交会把数据写入该站点。",
        involves_sensitive_data=True,
    )
    assert a.ok is True
    assert a.explains_risk is True
    assert a.names_data_and_destination is True
    assert a.is_ambiguous_proceed is False


def test_ambiguous_proceed_fails() -> None:
    a = audit_confirmation_prompt(
        prompt="要继续吗?", involves_sensitive_data=False
    )
    assert a.is_ambiguous_proceed is True
    assert a.ok is False


@pytest.mark.parametrize("p", ["Proceed?", "Shall I continue?", "Should I proceed?"])
def test_proceed_variants_fail(p: str) -> None:
    a = audit_confirmation_prompt(prompt=p, involves_sensitive_data=False)
    assert a.is_ambiguous_proceed is True


def test_no_risk_explanation_fails() -> None:
    a = audit_confirmation_prompt(
        prompt="将提交表单到 shop.example.com。",
        involves_sensitive_data=False,
    )
    assert a.explains_risk is False
    assert a.ok is False


def test_sensitive_missing_destination_fails() -> None:
    a = audit_confirmation_prompt(
        prompt="这存在风险,因为会发送你的密码。", involves_sensitive_data=True
    )
    # 点明了数据(密码)但未点明发给谁
    assert a.names_data_and_destination is False
    assert a.ok is False


def test_nonsensitive_skips_data_check() -> None:
    a = audit_confirmation_prompt(
        prompt="这会带来不可逆风险,因为会点击删除按钮删除该文件。",
        involves_sensitive_data=False,
    )
    assert a.names_data_and_destination is True  # 非敏感数据不强制
    # 风险+机制齐备
    assert a.explains_risk is True


# ── 时机判定 ───────────────────────────────────────────────────────────────


def test_timing_ready_now() -> None:
    d = decide_ask_timing(
        ready_to_execute=True,
        involves_sensitive_data=False,
        sensitive_data_typed_next=False,
    )
    assert d.should_ask_now is True
    assert d.is_exception is False


def test_timing_sensitive_typing_exception() -> None:
    d = decide_ask_timing(
        ready_to_execute=False,
        involves_sensitive_data=True,
        sensitive_data_typed_next=True,
    )
    assert d.should_ask_now is True
    assert d.is_exception is True


def test_timing_not_ready_no_early_ask() -> None:
    d = decide_ask_timing(
        ready_to_execute=False,
        involves_sensitive_data=False,
        sensitive_data_typed_next=False,
    )
    assert d.should_ask_now is False
    assert "不早问" in d.detail


def test_timing_not_ready_nonsensitive_no_exception() -> None:
    d = decide_ask_timing(
        ready_to_execute=False,
        involves_sensitive_data=True,
        sensitive_data_typed_next=False,
    )
    assert d.should_ask_now is False
    assert d.is_exception is False


# ── 合并判定 ───────────────────────────────────────────────────────────────


def test_merge_imminent_and_defined() -> None:
    d = should_merge_confirmations(all_imminent=True, all_well_defined=True)
    assert d.merge is True


def test_no_merge_undefined_future_step() -> None:
    d = should_merge_confirmations(all_imminent=True, all_well_defined=False)
    assert d.merge is False
    assert "不打包" in d.reason


def test_no_merge_not_all_imminent() -> None:
    d = should_merge_confirmations(all_imminent=False, all_well_defined=True)
    assert d.merge is False


# ── 冗余判定 ───────────────────────────────────────────────────────────────


def test_redundant_when_approved_no_new_risk() -> None:
    d = is_redundant_confirmation(
        already_approved=True, has_materially_new_risk=False
    )
    assert d.redundant is True


def test_not_redundant_new_risk() -> None:
    d = is_redundant_confirmation(
        already_approved=True, has_materially_new_risk=True
    )
    assert d.redundant is False


def test_not_redundant_unapproved() -> None:
    d = is_redundant_confirmation(
        already_approved=False, has_materially_new_risk=False
    )
    assert d.redundant is False


def test_all_decisions_detail_nonempty() -> None:
    assert audit_confirmation_prompt(prompt="Proceed?", involves_sensitive_data=False).detail
    assert decide_ask_timing(ready_to_execute=False, involves_sensitive_data=False, sensitive_data_typed_next=False).detail
    assert should_merge_confirmations(all_imminent=True, all_well_defined=True).reason
    assert is_redundant_confirmation(already_approved=True, has_materially_new_risk=False).reason


if __name__ == "__main__":
    pytest.main([__file__, "-q"])
