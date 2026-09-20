# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# app/core 请求装配纯算法测试 — 第三十一批(对标 Codex client.rs build_responses_request 内核)
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import uuid

from app.core.responses_request_assembly import (
    OUTPUT_SCHEMA_FORMAT_NAME,
    REASONING_CONTEXT_ALL_TURNS,
    REASONING_SUMMARY_DELIVERY_SEQUENTIAL_CUTOFF,
    RequestRouteTelemetry,
    build_reasoning,
    build_responses_lite_prefix,
    build_stream_options,
    create_text_param_for_request,
    derive_prefixed_id,
    filter_tool_result_metadata,
    is_prefixed_id,
    prepare_response_items,
    resolve_verbosity,
    responses_lite_deterministic_id,
    responses_lite_namespace,
    tool_result_metadata_allowed,
)

# ---------- is_prefixed_id / derive_prefixed_id ----------

def test_prefixed_id_positive():
    assert is_prefixed_id("at_9f2c-uuid") is True
    assert is_prefixed_id("msg_abc") is True

def test_prefixed_id_negative():
    assert is_prefixed_id("bare_server_id") is False or True  # 单下划线两段非空=True
    # 语义精判: bare 有下划线且两段非空 => True
    assert is_prefixed_id("bare_server_id") is True
    assert is_prefixed_id("nounderscore") is False
    assert is_prefixed_id("_leading") is False
    assert is_prefixed_id("trailing_") is False
    assert is_prefixed_id("") is False

def test_derive_prefixed_id_format():
    assert derive_prefixed_id("at", "x1") == "at_x1"
    assert derive_prefixed_id("msg", "y2") == "msg_y2"


# ---------- responses_lite 确定性 ID ----------

def test_namespace_is_uuid5_of_thread():
    ns = responses_lite_namespace("thread-abc")
    assert ns == uuid.uuid5(uuid.NAMESPACE_OID, "thread-abc")

def test_deterministic_id_stable_across_calls():
    ns = responses_lite_namespace("t1")
    a = responses_lite_deterministic_id(ns, "payload", "at")
    b = responses_lite_deterministic_id(ns, "payload", "at")
    assert a == b and a.startswith("at_")

def test_deterministic_id_differs_by_payload():
    ns = responses_lite_namespace("t1")
    assert responses_lite_deterministic_id(ns, "a", "at") != responses_lite_deterministic_id(ns, "b", "at")

def test_lite_prefix_tools_and_instructions():
    prefix = build_responses_lite_prefix("t1", [{"name": "f"}], "be nice")
    assert len(prefix) == 2
    at = prefix[0]
    assert at["type"] == "additional_tools" and at["role"] == "developer"
    assert at["tools"] == [{"name": "f"}]
    assert at["id"] == responses_lite_deterministic_id(responses_lite_namespace("t1"), '[{"name":"f"}]', "at")
    msg = prefix[1]
    assert msg["type"] == "message" and msg["content"] == "be nice"
    assert msg["id"] == responses_lite_deterministic_id(responses_lite_namespace("t1"), "be nice", "msg")

def test_lite_prefix_empty_instructions_skips_message():
    prefix = build_responses_lite_prefix("t1", [], "")
    assert len(prefix) == 1 and prefix[0]["type"] == "additional_tools"

def test_lite_prefix_id_identity_preserved_on_retry():
    p1 = build_responses_lite_prefix("same-thread", [{"name": "x"}], "inst")
    p2 = build_responses_lite_prefix("same-thread", [{"name": "x"}], "inst")
    assert [i["id"] for i in p1] == [i["id"] for i in p2]
    p3 = build_responses_lite_prefix("other-thread", [{"name": "x"}], "inst")
    assert p1[0]["id"] != p3[0]["id"]


# ---------- build_reasoning ----------

def test_reasoning_override_wins():
    r = build_reasoning("high", "low", True, "auto", False)
    assert r["effort"] == "high" and r["summary"] == "auto"

def test_reasoning_falls_back_to_model_default():
    r = build_reasoning(None, "medium", True, "auto", False)
    assert r["effort"] == "medium"

def test_reasoning_resolver_applied():
    r = build_reasoning("x", None, True, "auto", False, resolve_reasoning_effort=lambda v: f"resolved-{v}")
    assert r["effort"] == "resolved-x"

def test_reasoning_summary_gated_by_support():
    r = build_reasoning("high", None, False, "auto", False)
    assert "summary" not in r

def test_reasoning_summary_none_config_dropped():
    r = build_reasoning("high", None, True, "none", False)
    assert "summary" not in r
    r2 = build_reasoning("high", None, True, None, False)
    assert "summary" not in r2

def test_reasoning_lite_context_all_turns_only():
    assert build_reasoning("high", None, True, "auto", True)["context"] == REASONING_CONTEXT_ALL_TURNS
    assert "context" not in build_reasoning("high", None, True, "auto", False)


# ---------- text param ----------

def test_text_param_none_when_both_absent():
    assert create_text_param_for_request(None, None, True) is None

def test_text_param_verbosity_only():
    t = create_text_param_for_request("low", None, True)
    assert t == {"verbosity": "low"}

def test_text_param_schema_strict():
    schema = {"type": "object"}
    t = create_text_param_for_request(None, schema, True)
    assert t["format"]["type"] == "json_schema"
    assert t["format"]["strict"] is True
    assert t["format"]["name"] == OUTPUT_SCHEMA_FORMAT_NAME
    assert t["format"]["schema"] == schema

def test_text_param_both():
    t = create_text_param_for_request("medium", {"type": "object"}, False)
    assert t["verbosity"] == "medium" and t["format"]["strict"] is False


# ---------- stream options ----------

def test_stream_options_requires_all_three():
    assert build_stream_options(True, True, True) == {"reasoning_summary_delivery": REASONING_SUMMARY_DELIVERY_SEQUENTIAL_CUTOFF}
    assert build_stream_options(False, True, True) is None
    assert build_stream_options(True, False, True) is None
    assert build_stream_options(True, True, False) is None


# ---------- verbosity 门控 ----------

def test_verbosity_supported_user_wins():
    v, w = resolve_verbosity(True, "low", "medium", "gpt-x")
    assert v == "low" and w is None

def test_verbosity_supported_default_fallback():
    v, w = resolve_verbosity(True, None, "medium", "gpt-x")
    assert v == "medium" and w is None

def test_verbosity_unsupported_ignored_with_warning():
    v, w = resolve_verbosity(False, "low", None, "gpt-old")
    assert v is None and "gpt-old" in w and "does not support verbosity" in w

def test_verbosity_unsupported_no_warning_when_unset():
    v, w = resolve_verbosity(False, None, "medium", "gpt-old")
    assert v is None and w is None


# ---------- prepare_response_items ----------

def test_prepare_strips_unprefixed_ids():
    items = [{"id": "serverid123", "type": "message"}, {"id": "at_kept", "type": "x"}]
    out = prepare_response_items(items)
    assert out[0]["id"] is None
    assert out[1]["id"] == "at_kept"
    # 原数据不可变
    assert items[0]["id"] == "serverid123"

def test_prepare_strips_bare_server_ids_without_underscore():
    out = prepare_response_items([{"id": "serverid123"}])
    assert out[0]["id"] is None

def test_prepare_clears_content_item_kinds_when_disabled():
    items = [{"content_item_kinds": ["image"], "id": "a_b"}]
    assert prepare_response_items(items, content_item_kinds_enabled=False)[0].get("content_item_kinds") is None
    assert prepare_response_items(items, content_item_kinds_enabled=True)[0]["content_item_kinds"] == ["image"]


# ---------- tool result metadata 过滤 ----------

def test_metadata_allowed_https_openai():
    assert tool_result_metadata_allowed("https://api.openai.com/v1") is True

def test_metadata_denied_http():
    assert tool_result_metadata_allowed("http://api.openai.com/v1") is False

def test_metadata_denied_other_host():
    assert tool_result_metadata_allowed("https://evil.example.com/v1") is False

def test_metadata_allowed_via_extra_hosts():
    assert tool_result_metadata_allowed("https://relay.aizhs.top/v1", frozenset({"relay.aizhs.top"})) is True

def test_filter_keeps_on_allowlist():
    items = [{"codex_tool_result_metadata": {"k": 1}}]
    out = filter_tool_result_metadata(items, "https://api.openai.com/v1")
    assert out[0]["codex_tool_result_metadata"] == {"k": 1}

def test_filter_strips_off_allowlist():
    items = [{"codex_tool_result_metadata": {"k": 1}, "type": "function_call_output"}]
    out = filter_tool_result_metadata(items, "https://other.example.com")
    assert "codex_tool_result_metadata" not in out[0]
    assert out[0]["type"] == "function_call_output"
    assert items[0]["codex_tool_result_metadata"] == {"k": 1}  # 原不可变


# ---------- 路由遥测 ----------

def test_route_telemetry_roundtrip():
    t = RequestRouteTelemetry(transport="ws", attempt=2, fallback_reason="conn refused", extra={"k": 1})
    d = t.as_dict()
    assert d["transport"] == "ws" and d["attempt"] == 2 and d["fallback_reason"] == "conn refused" and d["extra"] == {"k": 1}

def test_route_telemetry_defaults():
    d = RequestRouteTelemetry(transport="http").as_dict()
    assert d["attempt"] == 0 and d["fallback_reason"] is None and d["extra"] == {}
