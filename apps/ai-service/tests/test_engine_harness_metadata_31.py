# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


# app/core/turn_metadata.py 第三十一批(对标 Codex responses_metadata.rs/turn_metadata.rs)单测。

import pytest

from app.core.turn_metadata import (
    AUTO_REVIEW_ENABLED_KEY,
    BACKWARD_COMPATIBLE_RESERVED_METADATA_KEYS,
    CodexResponsesMetadata,
    CodexResponsesRequestKind,
    ExecutionMetadata,
    INSTALLATION_ID_KEY,
    MAX_EXTRA_METADATA_ENTRIES,
    MAX_EXTRA_METADATA_KEY_BYTES,
    MAX_EXTRA_METADATA_VALUE_BYTES,
    RESERVED_METADATA_KEYS,
    SESSION_ID_KEY,
    SubAgentSource,
    SessionSource,
    THREAD_ID_KEY,
    TURN_ID_KEY,
    WINDOW_ID_KEY,
    X_CODEX_WINDOW_ID_HEADER,
    X_OPENAI_SUBAGENT_HEADER,
    filter_extra_metadata,
    subagent_header_value,
    subagent_metadata_kind,
    truncate_extra_metadata_value,
    valid_extra_metadata_key,
    validate_extra_metadata,
)


# ======================================================================
# 常量
# ======================================================================
def test_value_bytes_constant():
    assert MAX_EXTRA_METADATA_VALUE_BYTES == 128


def test_entries_and_key_bytes_constants():
    assert MAX_EXTRA_METADATA_ENTRIES == 16
    assert MAX_EXTRA_METADATA_KEY_BYTES == 64


def test_reserved_contains_core_keys():
    for key in (
        INSTALLATION_ID_KEY,
        SESSION_ID_KEY,
        THREAD_ID_KEY,
        TURN_ID_KEY,
        WINDOW_ID_KEY,
        AUTO_REVIEW_ENABLED_KEY,
    ):
        assert key in RESERVED_METADATA_KEYS


def test_backward_compatible_is_subset_of_reserved():
    for key in BACKWARD_COMPATIBLE_RESERVED_METADATA_KEYS:
        assert key in RESERVED_METADATA_KEYS
    assert "session_id" not in BACKWARD_COMPATIBLE_RESERVED_METADATA_KEYS


# ======================================================================
# valid_extra_metadata_key
# ======================================================================
def test_valid_key_plain():
    assert valid_extra_metadata_key("foo") is True


def test_valid_key_with_separators():
    assert valid_extra_metadata_key("foo_bar.baz-qux") is True


def test_invalid_key_empty():
    assert valid_extra_metadata_key("") is False


def test_invalid_key_starts_with_digit():
    assert valid_extra_metadata_key("1foo") is False


def test_invalid_key_contains_space():
    assert valid_extra_metadata_key("foo bar") is False


def test_invalid_key_multibyte():
    assert valid_extra_metadata_key("中文key") is False


# ======================================================================
# filter_extra_metadata
# ======================================================================
def test_filter_drops_reserved():
    src = [
        ("session_id", "s1"),
        ("my_key", "keep"),
        ("thread_id", "t1"),
    ]
    out = filter_extra_metadata(src)
    assert "session_id" not in out
    assert "thread_id" not in out
    assert out == {"my_key": "keep"}


def test_filter_drops_backward_compatible_reserved_too():
    # filter 会移除全部保留键(含向后兼容键);向后兼容仅对 validate 生效。
    src = [("window_number", "7"), ("custom_app", "v")]
    out = filter_extra_metadata(src)
    assert "window_number" not in out
    assert out == {"custom_app": "v"}


# ======================================================================
# validate_extra_metadata
# ======================================================================
def test_validate_ok():
    validate_extra_metadata([("app_name", "ihui"), ("feature_flag", "on")])


def test_validate_too_many_entries():
    extra = [(f"k{i}", "v") for i in range(MAX_EXTRA_METADATA_ENTRIES + 1)]
    with pytest.raises(ValueError):
        validate_extra_metadata(extra)


def test_validate_reserved_key_rejected():
    with pytest.raises(ValueError):
        validate_extra_metadata([("session_id", "x")])


def test_validate_backward_compatible_reserved_allowed():
    validate_extra_metadata([("window_number", "7")])


def test_validate_key_too_long():
    with pytest.raises(ValueError):
        validate_extra_metadata([("a" * (MAX_EXTRA_METADATA_KEY_BYTES + 1), "v")])


def test_validate_value_too_long():
    with pytest.raises(ValueError):
        validate_extra_metadata([("k", "x" * (MAX_EXTRA_METADATA_VALUE_BYTES + 1))])


# ======================================================================
# truncate_extra_metadata_value
# ======================================================================
def test_truncate_within_limit_unchanged():
    assert truncate_extra_metadata_value("short") == "short"


def test_truncate_long_ascii():
    long = "a" * 200
    out = truncate_extra_metadata_value(long)
    assert len(out.encode("utf-8")) <= MAX_EXTRA_METADATA_VALUE_BYTES
    assert out == "a" * MAX_EXTRA_METADATA_VALUE_BYTES


def test_truncate_multibyte_safe():
    long = "中" * 100  # 每个字符 3 字节 -> 300 字节
    out = truncate_extra_metadata_value(long)
    assert len(out.encode("utf-8")) <= MAX_EXTRA_METADATA_VALUE_BYTES
    # 不应在多字节字符中途切断(解码后仍是完整字符集合)。
    assert len(out) >= 1


# ======================================================================
# subagent_header_value / subagent_metadata_kind
# ======================================================================
def test_subagent_header_review():
    assert subagent_header_value(SessionSource.from_subagent(SubAgentSource.review())) == "review"


def test_subagent_header_compact():
    assert subagent_header_value(SessionSource.from_subagent(SubAgentSource.compact())) == "compact"


def test_subagent_header_memory_consolidation():
    src = SessionSource.from_subagent(SubAgentSource.memory_consolidation())
    assert subagent_header_value(src) == "memory_consolidation"


def test_subagent_header_thread_spawn():
    src = SessionSource.from_subagent(SubAgentSource.thread_spawn())
    assert subagent_header_value(src) == "collab_spawn"


def test_subagent_header_other():
    src = SessionSource.from_subagent(SubAgentSource.other("custom-worker"))
    assert subagent_header_value(src) == "custom-worker"


def test_subagent_header_cli_none():
    assert subagent_header_value(SessionSource.cli()) is None


def test_subagent_header_internal():
    assert subagent_header_value(SessionSource.from_internal("guardian")) == "guardian"
    assert (
        subagent_header_value(SessionSource.from_internal("memory_consolidation"))
        == "memory_consolidation"
    )


def test_subagent_metadata_kind_review():
    src = SessionSource.from_subagent(SubAgentSource.review())
    assert subagent_metadata_kind(src) == "review"


def test_subagent_metadata_kind_thread_spawn():
    src = SessionSource.from_subagent(SubAgentSource.thread_spawn())
    assert subagent_metadata_kind(src) == "thread_spawn"


def test_subagent_metadata_kind_cli_none():
    assert subagent_metadata_kind(SessionSource.cli()) is None
    assert subagent_metadata_kind(SessionSource.from_internal("guardian")) is None


# ======================================================================
# CodexResponsesMetadata: new / as_dict / client_metadata
# ======================================================================
def test_metadata_new_and_as_dict_basic():
    md = CodexResponsesMetadata.new("inst", "sess", "thr", "win")
    md.request_kind = CodexResponsesRequestKind("turn")
    md.turn_id = "t1"
    md.agent_name = "agent"
    md.extra["app"] = "demo"
    payload = md.as_dict()
    assert payload[INSTALLATION_ID_KEY] == "inst"
    assert payload[SESSION_ID_KEY] == "sess"
    assert payload[THREAD_ID_KEY] == "thr"
    assert payload[TURN_ID_KEY] == "t1"
    assert payload[WINDOW_ID_KEY] == "win"
    assert payload["request_kind"] == "turn"
    assert payload["agent_name"] == "agent"
    assert payload["app"] == "demo"
    # None 字段不应出现。
    assert "analytics_enabled" not in payload
    assert "subagent_kind" not in payload


def test_metadata_memory_drops_thread_identity():
    md = CodexResponsesMetadata.new("inst", "sess", "thr", "win")
    md.request_kind = CodexResponsesRequestKind("memory")
    md.turn_id = "t1"
    payload = md.as_dict()
    assert payload["request_kind"] == "memory"
    assert payload[TURN_ID_KEY] == "t1"
    # Memory 请求不携带线程/请求身份。
    assert SESSION_ID_KEY not in payload
    assert THREAD_ID_KEY not in payload
    assert INSTALLATION_ID_KEY not in payload
    assert WINDOW_ID_KEY not in payload


def test_metadata_client_metadata_includes_headers():
    md = CodexResponsesMetadata.new("inst", "sess", "thr", "win")
    md.turn_id = "t1"
    client = md.client_metadata()
    assert client[X_CODEX_WINDOW_ID_HEADER] == "win"
    assert client[SESSION_ID_KEY] == "sess"
    assert client[THREAD_ID_KEY] == "thr"
    assert "x-codex-turn-metadata" not in client  # 无 request_kind 时不注入


def test_metadata_client_metadata_with_subagent_header():
    md = CodexResponsesMetadata.new("inst", "sess", "thr", "win")
    md.subagent_header = "review"
    md.request_kind = CodexResponsesRequestKind("turn")
    client = md.client_metadata()
    assert client[X_OPENAI_SUBAGENT_HEADER] == "review"
    assert "x-codex-turn-metadata" in client


# ======================================================================
# ExecutionMetadata.apply_to
# ======================================================================
def test_execution_metadata_apply_to_sets_extra():
    md = CodexResponsesMetadata.new("inst", "sess", "thr", "win")
    exec_meta = ExecutionMetadata(
        model="gpt-x",
        reasoning_effort="high",
        node_repl_disabled=False,
        auto_review_enabled=True,
        node_repl_auto_review_required=False,
    )
    exec_meta.apply_to(md)
    assert md.auto_review_enabled is True
    assert md.node_repl_disabled is False
    assert md.extra["model"] == "gpt-x"
    assert md.extra["reasoning_effort"] == "high"


def test_execution_metadata_apply_to_removes_reasoning_when_none():
    md = CodexResponsesMetadata.new("inst", "sess", "thr", "win")
    md.extra["reasoning_effort"] = "high"
    exec_meta = ExecutionMetadata(
        model="gpt-x",
        reasoning_effort=None,
        node_repl_disabled=True,
        auto_review_enabled=False,
        node_repl_auto_review_required=True,
    )
    exec_meta.apply_to(md)
    assert "reasoning_effort" not in md.extra
    assert md.extra["model"] == "gpt-x"
