# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R87: hook enum variant sets as record arrays."""

from __future__ import annotations

import pytest

from app.core.hook_definition_contract import HOOK_DEFINITION_ENUMS
from app.core.hook_enum_binary_lookup import (
    ALL_ENUMS_LOCATED,
    ENUM_ARRAYS_ATTESTED,
    ENUM_TOTAL,
    LOCATED,
    LOCATED_COUNT,
    MULTI_COPY,
    THIN_EVIDENCE,
    UNLOCATED,
    VARIANTS,
    EnumLookupError,
    addresses_of,
    enum_lookup_summary,
    validate_enum_lookup,
)


def test_three_of_four_enums_located() -> None:
    assert ENUM_TOTAL == len(HOOK_DEFINITION_ENUMS) == 4
    assert LOCATED_COUNT == 3
    assert UNLOCATED == ("PreToolUsePermissionDecisionWire",)
    assert ALL_ENUMS_LOCATED is False
    validate_enum_lookup()


def test_variant_sets_match_the_schema() -> None:
    for name, variants in VARIANTS.items():
        assert variants == tuple(HOOK_DEFINITION_ENUMS[name]), name


def test_unlocated_enum_has_three_variants() -> None:
    assert len(HOOK_DEFINITION_ENUMS["PreToolUsePermissionDecisionWire"]) == 3
    assert addresses_of("PreToolUsePermissionDecisionWire") == ()


def test_the_two_variant_decision_enum_is_a_whole_run() -> None:
    entry = LOCATED["PreToolUseDecisionWire"]
    assert entry[1] == ("0x151f9dc30",)
    assert entry[2] == 0 and entry[3] is True


def test_the_behavior_enum_has_thirteen_copies() -> None:
    assert len(MULTI_COPY) == 1
    name, variant_count, copies, addrs = MULTI_COPY[0]
    assert name == "PermissionRequestBehaviorWire"
    assert variant_count == 2
    assert copies == 13
    assert len(addrs) == 3


def test_the_single_variant_enum_is_thin() -> None:
    assert THIN_EVIDENCE == ("BlockDecisionWire",)
    assert LOCATED["BlockDecisionWire"][0] == 1


def test_attested_is_true_but_not_all_located() -> None:
    assert ENUM_ARRAYS_ATTESTED is True
    assert ALL_ENUMS_LOCATED is False


def test_summary_matches() -> None:
    s = enum_lookup_summary()
    assert s["enums"] == 4
    assert s["located"] == 3
    assert s["multi_copy"] == 1


def test_validator_rejects_claiming_all(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import hook_enum_binary_lookup as mod
    monkeypatch.setattr(mod, "ALL_ENUMS_LOCATED", True)
    with pytest.raises(EnumLookupError, match="flag must stay false"):
        mod.validate_enum_lookup()


def test_validator_rejects_a_variant_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import hook_enum_binary_lookup as mod
    bad = dict(VARIANTS)
    bad["PreToolUseDecisionWire"] = ("approve",)
    monkeypatch.setattr(mod, "VARIANTS", bad)
    with pytest.raises(EnumLookupError, match="variant count disagrees"):
        mod.validate_enum_lookup()


def test_validator_rejects_a_bad_multi_copy(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import hook_enum_binary_lookup as mod
    monkeypatch.setattr(mod, "MULTI_COPY", (("PermissionRequestBehaviorWire", 2, 1, ()),))
    with pytest.raises(EnumLookupError, match="at least two addresses"):
        mod.validate_enum_lookup()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
