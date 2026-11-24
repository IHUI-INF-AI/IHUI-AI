# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the provider wire protocol findings (R106)."""

from __future__ import annotations

import pytest

from app.core.codex_provider_wire_api import (
    ADAPTER_EXISTS_HERE,
    ADAPTER_REQUIRED,
    CAPABILITY_MATRIX,
    CHAT_PATH,
    CHAT_REMOVED_IN_THIS_BUILD,
    DEFAULT_WIRE_API,
    HOOK_PREMISE_RESOLVED,
    LOCAL_CHAT_ROUTE_EXISTS,
    LOCAL_CHAT_STATUSES,
    LOCAL_CHAT_UPSTREAM_WORKING,
    LOCAL_POOL_MODEL_COUNT,
    LOCAL_PROVIDER_USABLE_BY_THIS_BUILD,
    LOCAL_RESPONSES_IMPLEMENTED,
    LOCAL_RESPONSES_STATUS,
    MATRIX_IS_INVERTED,
    NETWORK_BLOCKER_CONFIRMED,
    NETWORK_BLOCKER_FIXED,
    R93_RELAY_STILL_VALID,
    REMOVAL_ERROR_TEXT,
    RESPONSES_PATH,
    SUPPORTED_WIRE_APIS,
    ProviderWireError,
    adapter_can_bridge,
    local_pool_serves,
    provider_accepts,
    provider_contract,
    validate_provider_contract,
)


def test_contract_validates() -> None:
    validate_provider_contract()


def test_responses_is_the_only_protocol() -> None:
    assert SUPPORTED_WIRE_APIS == ("responses",)
    assert DEFAULT_WIRE_API == "responses"
    assert provider_accepts("responses") is True
    assert provider_accepts("chat") is False


def test_chat_removal_text_is_verbatim() -> None:
    assert "is no longer supported" in REMOVAL_ERROR_TEXT
    assert 'set `wire_api = "responses"`' in REMOVAL_ERROR_TEXT
    assert "discussions/7782" in REMOVAL_ERROR_TEXT
    assert CHAT_REMOVED_IN_THIS_BUILD is True


def test_paths() -> None:
    assert RESPONSES_PATH == "/v1/responses"
    assert CHAT_PATH == "/v1/chat/completions"


def test_local_pool_implements_responses_not() -> None:
    assert LOCAL_RESPONSES_STATUS == 502
    assert LOCAL_RESPONSES_IMPLEMENTED is False
    assert local_pool_serves("responses") is False


def test_local_chat_route_exists_but_upstream_fails() -> None:
    assert LOCAL_CHAT_ROUTE_EXISTS is True
    assert LOCAL_CHAT_UPSTREAM_WORKING is False
    assert LOCAL_CHAT_STATUSES == (400, 503)
    assert local_pool_serves("chat") is False


def test_model_listing_works_while_generation_does_not() -> None:
    assert LOCAL_POOL_MODEL_COUNT == 1043


def test_the_two_sides_are_inverted() -> None:
    assert len(CAPABILITY_MATRIX) == 4
    assert MATRIX_IS_INVERTED is True
    # every capability one side has, the other lacks
    for side, api, works in CAPABILITY_MATRIX:
        if side == "local-pool":
            assert works == (api == "chat")
        else:
            assert works == (api == "responses")


def test_adapter_required_absent() -> None:
    assert ADAPTER_REQUIRED is True
    assert ADAPTER_EXISTS_HERE is False
    assert adapter_can_bridge() is True
    assert LOCAL_PROVIDER_USABLE_BY_THIS_BUILD is False


def test_r93_invalidated() -> None:
    assert R93_RELAY_STILL_VALID is False


def test_blocker_confirmed_but_not_fixed() -> None:
    assert NETWORK_BLOCKER_CONFIRMED is True
    assert NETWORK_BLOCKER_FIXED is False
    assert HOOK_PREMISE_RESOLVED is False


def test_contract_mapping() -> None:
    c = provider_contract()
    assert c["supported"] == ("responses",)
    assert c["local_responses_status"] == 502
    assert c["r93_still_valid"] is False
    assert c["hook_premise_resolved"] is False


def test_validate_rejects_chat_as_supported(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.codex_provider_wire_api.SUPPORTED_WIRE_APIS", ("chat", "responses")
    )
    with pytest.raises(ProviderWireError):
        validate_provider_contract()


def test_validate_rejects_premise_settled_claim(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.core.codex_provider_wire_api.HOOK_PREMISE_RESOLVED", True
    )
    with pytest.raises(ProviderWireError):
        validate_provider_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
