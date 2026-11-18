# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R92: A4 — single-variant enums are structurally unattestable."""

from __future__ import annotations

import pytest

from app.core import single_variant_enum_evidence as mod
from app.core.single_variant_enum_evidence import (
    APPEARS_IN_RUNS,
    FALSIFICATION_ID,
    LENGTH_1_RUNS,
    RUNS_TOTAL,
    SHARED_ADDRESS,
    SHARED_OFFSET,
    SHARING_ENUM,
    SINGLE_VARIANT_ATTESTABLE,
    SINGLE_VARIANT_NAME,
    SINGLE_VARIANT_WORD,
    STANDALONE_RUNS,
    SingleVariantError,
    single_variant_summary,
    storage_owner_known,
    validate_single_variant,
)


def test_no_length_one_run_exists() -> None:
    assert LENGTH_1_RUNS == 0
    assert RUNS_TOTAL == 4005
    validate_single_variant()


def test_the_variant_is_inside_a_run_but_never_standalone() -> None:
    assert SINGLE_VARIANT_WORD == "block"
    assert STANDALONE_RUNS == 0
    assert APPEARS_IN_RUNS == 1


def test_it_sits_inside_another_enums_table() -> None:
    assert SINGLE_VARIANT_NAME == "BlockDecisionWire"
    assert SHARING_ENUM == "PreToolUseDecisionWire"
    assert SHARED_ADDRESS == "0x151f9dc30"
    assert SHARED_OFFSET == 1


def test_the_judgement_does_not_exist() -> None:
    assert storage_owner_known() is False
    assert SINGLE_VARIANT_ATTESTABLE is False
    assert FALSIFICATION_ID == "single-variant-enum-has-no-standalone-signal"


def test_summary_matches() -> None:
    s = single_variant_summary()
    assert s["length1_runs"] == 0
    assert s["offset"] == 1
    assert s["sharing_enum"] == "PreToolUseDecisionWire"
    assert s["attestable"] is False


def test_validator_rejects_a_length1_run(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod, "LENGTH_1_RUNS", 1)
    with pytest.raises(SingleVariantError, match="no longer holds"):
        mod.validate_single_variant()


def test_validator_rejects_a_standalone_hit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod, "STANDALONE_RUNS", 1)
    with pytest.raises(SingleVariantError, match="contradicting"):
        mod.validate_single_variant()


def test_validator_rejects_offset_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod, "SHARED_OFFSET", 0)
    with pytest.raises(SingleVariantError, match="must sit at an offset"):
        mod.validate_single_variant()


def test_validator_rejects_claiming_attestable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod, "SINGLE_VARIANT_ATTESTABLE", True)
    with pytest.raises(SingleVariantError, match="flag must stay false"):
        mod.validate_single_variant()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
