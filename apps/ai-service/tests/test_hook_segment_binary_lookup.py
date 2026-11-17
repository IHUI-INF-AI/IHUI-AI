# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R85: most inline hook segments have no serde FIELDS array — and that is the finding."""

from __future__ import annotations

import pytest

from app.core.hook_contract_schema import HOOK_SCHEMA_FIELDS
from app.core.hook_segment_binary_lookup import (
    ALL_SEGMENTS_LOCATED,
    DERIVE_SPLIT,
    INPUT_LOCATED,
    LOCATED,
    LOCATED_COUNT,
    OUTPUT_LOCATED,
    SEGMENT_TOTAL,
    SEGMENTS_ATTESTED,
    SHARED_ADDRESSES,
    THIN_EVIDENCE,
    UNLOCATED,
    UNLOCATED_COUNT,
    SegmentLookupError,
    address_of,
    input_share_of_located,
    segment_lookup_summary,
    validate_segment_lookup,
)


def test_three_of_twenty_three_are_located() -> None:
    assert SEGMENT_TOTAL == len(HOOK_SCHEMA_FIELDS) == 23
    assert LOCATED_COUNT == 3
    assert UNLOCATED_COUNT == 20
    assert LOCATED_COUNT + UNLOCATED_COUNT == SEGMENT_TOTAL
    assert ALL_SEGMENTS_LOCATED is False
    validate_segment_lookup()


def test_every_located_segment_is_an_output_block() -> None:
    assert OUTPUT_LOCATED == 3
    assert INPUT_LOCATED == 0
    assert input_share_of_located() == 0.0
    for seg in LOCATED:
        assert seg.endswith(".output"), seg


def test_no_input_block_has_a_field_table() -> None:
    for seg in UNLOCATED:
        assert seg.endswith(".input") or seg.endswith(".output")
    inputs = [s for s in UNLOCATED if s.endswith(".input")]
    assert len(inputs) == 12


def test_each_located_field_count_matches_the_schema() -> None:
    for seg, (field_count, _addrs, _o, _w) in LOCATED.items():
        assert field_count == len(HOOK_SCHEMA_FIELDS[seg]), seg


def test_the_two_compact_outputs_share_both_addresses() -> None:
    assert len(SHARED_ADDRESSES) == 2
    for address, members in SHARED_ADDRESSES:
        assert set(members) == {
            "post-compact.command.output", "pre-compact.command.output"}
        for m in members:
            assert address in LOCATED[m][1]
    assert {a for a, _m in SHARED_ADDRESSES} == {"0x151f986a0", "0x151f9e290"}
    assert len(LOCATED["post-compact.command.output"][1]) == 2


def test_compact_outputs_are_whole_runs() -> None:
    for seg in ("post-compact.command.output", "pre-compact.command.output"):
        entry = LOCATED[seg]
        assert entry[3] is True and entry[2] == 0
        assert entry[1] == ("0x151f986a0", "0x151f9e290")
    assert address_of("post-compact.command.output") == "0x151f986a0"


def test_the_single_field_segment_is_thin() -> None:
    assert THIN_EVIDENCE == ("interrupt.command.output",)
    assert LOCATED["interrupt.command.output"][0] == 1
    assert LOCATED["interrupt.command.output"][3] is False


def test_attested_count_excludes_thin() -> None:
    assert SEGMENTS_ATTESTED is True
    confirmed = [s for s, (_n, _a, _o, ex) in LOCATED.items() if ex and s not in THIN_EVIDENCE]
    assert len(confirmed) == 2


def test_derive_split_is_stated() -> None:
    assert DERIVE_SPLIT == "definitions-are-derived-structs-inline-outputs-are-not"


def test_summary_matches() -> None:
    s = segment_lookup_summary()
    assert s["located"] == 3
    assert s["unlocated"] == 20
    assert s["output_located"] == 3
    assert s["input_located"] == 0


def test_validator_rejects_claiming_all_located(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import hook_segment_binary_lookup as mod
    monkeypatch.setattr(mod, "ALL_SEGMENTS_LOCATED", True)
    with pytest.raises(SegmentLookupError, match="must stay false"):
        mod.validate_segment_lookup()


def test_validator_rejects_an_unknown_address(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import hook_segment_binary_lookup as mod
    bad = dict(LOCATED)
    count, _addrs, off, whole = bad["interrupt.command.output"]
    bad["interrupt.command.output"] = (count, ("segment-not-an-address",), off, whole)
    monkeypatch.setattr(mod, "LOCATED", bad)
    with pytest.raises(SegmentLookupError, match="not a hex literal"):
        mod.validate_segment_lookup()


def test_validator_rejects_a_broken_shared_member(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import hook_segment_binary_lookup as mod
    bad = dict(LOCATED)
    count, _addrs, off, whole = bad["pre-compact.command.output"]
    bad["pre-compact.command.output"] = (count, ("0x151f9e290",), off, whole)
    monkeypatch.setattr(mod, "LOCATED", bad)
    monkeypatch.setattr(mod, "SHARED_ADDRESSES", (("0x151f986a0",
                                                  ("post-compact.command.output",
                                                   "pre-compact.command.output")),))
    with pytest.raises(SegmentLookupError, match="not recorded at its shared address"):
        mod.validate_segment_lookup()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
