# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R79: the FIELDS record array is not adjacent to the serde template."""

from __future__ import annotations

import pytest

from app.core.struct_template_fields_adjacency import (
    ADJACENT_PAIRS,
    ADJACENT_PAIRS_ATTESTED,
    ALIGNMENTS_TRIED,
    FALSIFICATION_ID,
    LOOKBACK_BYTES,
    RUN_LENGTH_EQ_ARITY,
    TEMPLATE_FOLLOWS_FIELDS,
    TEMPLATE_TOTAL,
    WITH_RECORD_RUN,
    AdjacencyError,
    adjacency_summary,
    recurrence_rate,
)


def test_recurrence_is_rare() -> None:
    assert TEMPLATE_TOTAL == 3186
    assert WITH_RECORD_RUN == 29
    assert recurrence_rate() < 0.01


def test_claim_is_explicitly_denied() -> None:
    assert TEMPLATE_FOLLOWS_FIELDS is False
    assert FALSIFICATION_ID == "template-not-adjacent-to-fields-array"
    assert LOOKBACK_BYTES == 512
    assert ALIGNMENTS_TRIED == 16


def test_pairs_stay_observations() -> None:
    assert ADJACENT_PAIRS_ATTESTED is False
    assert len(ADJACENT_PAIRS) == RUN_LENGTH_EQ_ARITY == 5
    for value in ADJACENT_PAIRS.values():
        assert isinstance(value, str)


def test_arity_matches_are_a_subset_of_runs() -> None:
    assert RUN_LENGTH_EQ_ARITY <= WITH_RECORD_RUN


def test_summary_matches_the_measures() -> None:
    s = adjacency_summary()
    assert s["templates"] == 3186
    assert s["with_record_run"] == 29
    assert s["run_eq_arity"] == 5
    assert s["template_follows_fields"] is False
    assert s["pairs_attested"] is False


def test_validator_rejects_a_common_recurrence(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_template_fields_adjacency as mod
    monkeypatch.setattr(mod, "WITH_RECORD_RUN", 1000)
    with pytest.raises(AdjacencyError, match="common enough"):
        mod.validate_adjacency()


def test_validator_rejects_promoting_the_pairs(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_template_fields_adjacency as mod
    monkeypatch.setattr(mod, "ADJACENT_PAIRS_ATTESTED", True)
    with pytest.raises(AdjacencyError, match="never attested"):
        mod.validate_adjacency()


def test_validator_rejects_a_contradicting_pairs_count(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_template_fields_adjacency as mod
    monkeypatch.setattr(mod, "RUN_LENGTH_EQ_ARITY", 4)
    with pytest.raises(AdjacencyError, match="pair count"):
        mod.validate_adjacency()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
