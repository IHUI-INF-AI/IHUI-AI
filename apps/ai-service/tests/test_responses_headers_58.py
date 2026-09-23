# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:responses_headers + image_detail_policy + mcp 元数据投影测试。"""

from __future__ import annotations

import pytest

from app.core.responses_headers import (
    CODEX_VERSION_KEY,
    DEFAULT_IMAGE_DETAIL,
    USER_INPUT_REQUESTED_DURING_TURN_KEY,
    X_CODEX_BETA_FEATURES_HEADER,
    X_CODEX_TURN_STATE_HEADER,
    CodexResponsesHeaders,
    build_mcp_metadata_projection,
    build_responses_headers,
    can_request_original_image_detail,
    normalize_output_image_detail,
    sanitize_original_image_detail,
)


class TestResponsesHeaders:
    def test_build_both_headers(self) -> None:
        h = build_responses_headers(["beta_a", "beta_b"], "sticky-token")
        assert h[X_CODEX_BETA_FEATURES_HEADER] == "beta_a,beta_b"
        assert h[X_CODEX_TURN_STATE_HEADER] == "sticky-token"

    def test_build_empty_beta_skipped(self) -> None:
        assert build_responses_headers([], None) == {}
        assert build_responses_headers(None, "tok") == {X_CODEX_TURN_STATE_HEADER: "tok"}

    def test_scoped_to_model(self) -> None:
        h = CodexResponsesHeaders("gpt-x", {"x-a": "1"})
        assert h.model == "gpt-x"
        assert h.headers == {"x-a": "1"}

    def test_repr_hides_values(self) -> None:
        h = CodexResponsesHeaders("m", {"secret-header": "secret-value"})
        r = repr(h)
        assert "secret-value" not in r
        assert "secret-header" in r


class TestImageDetailPolicy:
    def test_can_request_original(self) -> None:
        assert can_request_original_image_detail(True) is True
        assert can_request_original_image_detail(False) is False

    def test_normalize_original_supported(self) -> None:
        assert normalize_output_image_detail(True, "original") == "original"

    def test_normalize_original_unsupported_becomes_none(self) -> None:
        assert normalize_output_image_detail(False, "original") is None

    def test_normalize_none_and_passthrough(self) -> None:
        assert normalize_output_image_detail(True, None) is None
        assert normalize_output_image_detail(False, "low") == "low"
        assert normalize_output_image_detail(True, "high") == "high"

    def test_sanitize_keeps_when_supported(self) -> None:
        items = [{"type": "input_image", "detail": "original"}]
        assert sanitize_original_image_detail(True, items)[0]["detail"] == "original"

    def test_sanitize_replaces_original_with_default(self) -> None:
        items = [
            {"type": "input_image", "detail": "original", "image_url": "x"},
            {"type": "input_text", "text": "hi"},
        ]
        out = sanitize_original_image_detail(False, items)
        assert out[0]["detail"] == DEFAULT_IMAGE_DETAIL
        assert out[1] == {"type": "input_text", "text": "hi"}

    def test_sanitize_noop_for_non_original(self) -> None:
        items = [{"type": "input_image", "detail": "low"}]
        assert sanitize_original_image_detail(False, items)[0]["detail"] == "low"


class TestMcpMetadataProjection:
    def test_strips_harness_owned_keys_and_adds_version(self) -> None:
        payload = {
            "agent_name": "worker",
            "parent_turn_id": "pt",
            "root_turn_id": "rt",
            "window_id": "w1",
        }
        out = build_mcp_metadata_projection(payload, "1.2.3", user_input_requested=False)
        assert out is not None
        assert out[CODEX_VERSION_KEY] == "1.2.3"
        assert "agent_name" not in out
        assert "parent_turn_id" not in out
        assert "root_turn_id" not in out
        assert out["window_id"] == "w1"

    def test_user_input_requested_flag(self) -> None:
        out = build_mcp_metadata_projection({"a": 1}, "v", user_input_requested=True)
        assert out[USER_INPUT_REQUESTED_DURING_TURN_KEY] is True
        out2 = build_mcp_metadata_projection(
            {USER_INPUT_REQUESTED_DURING_TURN_KEY: True}, "v", user_input_requested=False
        )
        assert USER_INPUT_REQUESTED_DURING_TURN_KEY not in out2

    def test_tool_namespaces_info_never_serialized(self) -> None:
        out = build_mcp_metadata_projection(
            {"tool_namespaces_info": {"ns": "desc"}, "window_id": "w"},
            "v",
            user_input_requested=False,
        )
        assert out is not None
        assert "tool_namespaces_info" not in out
        # 仅 harness 资产、剥除后为空 → None(与 codex turn_metadata_value()? 一致)
        only_asset = build_mcp_metadata_projection(
            {"tool_namespaces_info": {"ns": "desc"}}, "v", user_input_requested=False
        )
        assert only_asset is None

    def test_non_dict_returns_none(self) -> None:
        assert build_mcp_metadata_projection("x", "v", user_input_requested=False) is None

    def test_empty_metadata_returns_none(self) -> None:
        assert build_mcp_metadata_projection({}, "v", user_input_requested=False) is None


def test_import_guard() -> None:
    import app.core.responses_headers  # noqa: F401
