# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R84: hook definitions cross-checked against binary field arrays."""

from __future__ import annotations

import pytest

from app.core.hook_definition_binary_crosscheck import (
    ALL_LOCATED,
    DEFINITION_TOTAL,
    LOCATED,
    LOCATED_ATTESTED,
    LOCATED_COUNT,
    REGION,
    SHARED_ADDRESSES,
    UNLOCATED,
    WHOLE_RUN_COUNT,
    WINDOW_ONLY_COUNT,
    CrosscheckError,
    address_of,
    crosscheck_summary,
    located_share,
    validate_crosscheck,
)
from app.core.hook_definition_contract import HOOK_DEFINITION_OBJECTS


def test_six_of_seven_are_located() -> None:
    assert DEFINITION_TOTAL == len(HOOK_DEFINITION_OBJECTS) == 7
    assert LOCATED_COUNT == 6
    assert UNLOCATED == ("PostToolUseHookSpecificOutputWire",)
    assert ALL_LOCATED is False
    validate_crosscheck()


def test_whole_run_and_window_split() -> None:
    assert WHOLE_RUN_COUNT + WINDOW_ONLY_COUNT == LOCATED_COUNT
    assert WHOLE_RUN_COUNT == 3
    assert WINDOW_ONLY_COUNT == 3


def test_each_located_field_count_matches_the_schema() -> None:
    for name, (field_count, _address, _off, _whole) in LOCATED.items():
        assert field_count == len(HOOK_DEFINITION_OBJECTS[name][0]), name


def test_required_members_are_present() -> None:
    for name, (_n, _address, _off, _whole) in LOCATED.items():
        fields, required = HOOK_DEFINITION_OBJECTS[name]
        for req in required:
            assert req in fields, name


def test_the_three_identical_schemas_share_one_address() -> None:
    assert len(SHARED_ADDRESSES) == 1
    address, members = SHARED_ADDRESSES[0]
    assert address == "0x151f9dee0"
    assert set(members) == {
        "SessionStartHookSpecificOutputWire",
        "SubagentStartHookSpecificOutputWire",
        "UserPromptSubmitHookSpecificOutputWire",
    }
    for m in members:
        assert len(HOOK_DEFINITION_OBJECTS[m][0]) == 2
        assert address_of(m) == address


def test_all_addresses_sit_in_one_region() -> None:
    lo, hi = [int(x, 16) for x in REGION.split("-")]
    for _n, (_c, address, _o, _w) in LOCATED.items():
        assert lo <= int(address, 16) < hi


def test_pre_tool_use_is_a_whole_run() -> None:
    assert address_of("PreToolUseHookSpecificOutputWire") == "0x151f9de60"
    entry = LOCATED["PreToolUseHookSpecificOutputWire"]
    assert entry[2] == 0
    assert entry[3] is False


def test_the_unlocated_one_is_not_assumed_present() -> None:
    assert address_of("PostToolUseHookSpecificOutputWire") is None
    assert len(HOOK_DEFINITION_OBJECTS["PostToolUseHookSpecificOutputWire"][0]) == 3


def test_located_share_is_measured() -> None:
    assert located_share() == pytest.approx(6 / 7)


def test_attested_flag_is_the_strong_claim() -> None:
    assert LOCATED_ATTESTED is True


def test_summary_matches() -> None:
    s = crosscheck_summary()
    assert s["located"] == 6
    assert s["unlocated"] == "PostToolUseHookSpecificOutputWire"
    assert s["whole_runs"] == 3
    assert s["shared_addresses"] == 1


def test_validator_rejects_claiming_all_located(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import hook_definition_binary_crosscheck as mod
    monkeypatch.setattr(mod, "ALL_LOCATED", True)
    with pytest.raises(CrosscheckError, match="one definition is unlocated"):
        mod.validate_crosscheck()


def test_validator_rejects_a_whole_run_with_offset(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import hook_definition_binary_crosscheck as mod
    bad = dict(LOCATED)
    count, address, _off, _whole = bad["PreToolUseHookSpecificOutputWire"]
    bad["PreToolUseHookSpecificOutputWire"] = (count, address, 2, True)
    monkeypatch.setattr(mod, "LOCATED", bad)
    with pytest.raises(CrosscheckError, match="whole run cannot start at an offset"):
        mod.validate_crosscheck()


def test_validator_rejects_a_broken_shared_address(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import hook_definition_binary_crosscheck as mod
    bad = dict(LOCATED)
    count, _a, off, whole = bad["SessionStartHookSpecificOutputWire"]
    bad["SessionStartHookSpecificOutputWire"] = (count, "0x151f9df00", off, whole)
    monkeypatch.setattr(mod, "LOCATED", bad)
    with pytest.raises(CrosscheckError, match="not recorded at its shared address"):
        mod.validate_crosscheck()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
