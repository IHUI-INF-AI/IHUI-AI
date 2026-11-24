# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R78: reading the pool after the template adds exactly one struct."""

from __future__ import annotations

import pytest

from app.core.struct_bidirectional_pool import (
    AFTER_ACCEPTED,
    AFTER_BLOCKS_FIELD_SHAPED,
    AFTER_BLOCKS_WITH_NAMES,
    AFTER_EXACT_SITES,
    BEFORE_ACCEPTED_COUNT,
    BEFORE_MATCHES_R75,
    BIDIRECTIONAL_GAIN,
    BOTH_ACCEPTED_COUNT,
    ONLY_VIA_AFTER,
    POST_TEMPLATE_POOL_RICH,
    BidirectionalPoolError,
    bidirectional_summary,
)
from app.core.struct_strict_reconstruction import STRICT_STRUCTURES


def test_before_pool_reproduces_r75() -> None:
    assert BEFORE_MATCHES_R75 is True
    assert BEFORE_ACCEPTED_COUNT == len(STRICT_STRUCTURES) == 277


def test_gain_is_exactly_one_after_only_name() -> None:
    assert BIDIRECTIONAL_GAIN == 1
    assert ONLY_VIA_AFTER == ("FsReadFileResponse",)
    assert BOTH_ACCEPTED_COUNT == BEFORE_ACCEPTED_COUNT + 1


def test_after_only_names_are_not_already_in_r75() -> None:
    for name in ONLY_VIA_AFTER:
        assert name not in STRICT_STRUCTURES


def test_after_block_is_poor() -> None:
    assert POST_TEMPLATE_POOL_RICH is False
    assert AFTER_BLOCKS_WITH_NAMES == 86
    assert AFTER_BLOCKS_FIELD_SHAPED == 3
    assert AFTER_BLOCKS_FIELD_SHAPED < AFTER_BLOCKS_WITH_NAMES


def test_after_acceptance_is_tiny() -> None:
    assert AFTER_EXACT_SITES == 3
    assert len(AFTER_ACCEPTED) == 2
    assert "ErrorEnvelope" in AFTER_ACCEPTED


def test_summary_matches_the_measures() -> None:
    s = bidirectional_summary()
    assert s["before_accepted"] == 277
    assert s["both_accepted"] == 278
    assert s["gain"] == 1
    assert s["post_template_pool_rich"] is False


def test_validator_rejects_a_claim_of_after_only_membership(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_bidirectional_pool as mod
    monkeypatch.setattr(mod, "ONLY_VIA_AFTER", ("ErrorEnvelope",))
    with pytest.raises(BidirectionalPoolError, match="already in R75"):
        mod.validate_bidirectional_pool()


def test_validator_rejects_a_rich_after_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_bidirectional_pool as mod
    monkeypatch.setattr(mod, "AFTER_BLOCKS_FIELD_SHAPED", 86)
    with pytest.raises(BidirectionalPoolError, match="might be rich"):
        mod.validate_bidirectional_pool()


def test_validator_rejects_a_broken_gain(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_bidirectional_pool as mod
    monkeypatch.setattr(mod, "BIDIRECTIONAL_GAIN", 5)
    with pytest.raises(BidirectionalPoolError, match="union count"):
        mod.validate_bidirectional_pool()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
