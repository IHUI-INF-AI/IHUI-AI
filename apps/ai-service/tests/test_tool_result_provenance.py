# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""tool_result_provenance 测试（R25）——溯源枚举 + 截断元数据契约。

含反向变异：误判 truncated / 未截断未归零 / 溯源标签混淆 / 字段名漂移，均须转红。
"""

from __future__ import annotations

import dataclasses

import pytest

from app.core.tool_result_provenance import (
    ToolResultMetadata,
    ToolResultSource,
    build_result_metadata,
    classify_source,
    metadata_to_dict,
)


# --- 溯源枚举封闭集 -----------------------------------------------------------
def test_source_closed_set():
    """溯源枚举两变体，逐字对照协议层 tool_result_source。"""
    assert {s.value for s in ToolResultSource} == {"codex", "executed_tool_call"}


def test_classify_source_engine_builtin():
    """引擎内置工具 ⇒ CODEX。"""
    assert classify_source(True) is ToolResultSource.CODEX


def test_classify_source_model_call():
    """模型发起工具调用 ⇒ EXECUTED_TOOL_CALL。"""
    assert classify_source(False) is ToolResultSource.EXECUTED_TOOL_CALL


# --- 截断元数据：truncated 显式驱动 -------------------------------------------
def test_truncated_when_exceeds():
    """original_bytes > max_bytes ⇒ truncated=True。"""
    meta = build_result_metadata(original_bytes=1000, max_bytes=500)
    assert meta.truncated is True
    assert meta.original_bytes == 1000
    assert meta.max_bytes == 500


def test_not_truncated_at_boundary():
    """original_bytes == max_bytes ⇒ 未截断（严格大于才截）。"""
    meta = build_result_metadata(original_bytes=500, max_bytes=500)
    assert meta.truncated is False


def test_not_truncated_under_limit():
    """original_bytes < max_bytes ⇒ 未截断。"""
    meta = build_result_metadata(original_bytes=100, max_bytes=500)
    assert meta.truncated is False


def test_negative_input_clamped():
    """负数输入一律视为 0（防误用）。"""
    meta = build_result_metadata(original_bytes=-5, max_bytes=-10)
    assert meta.truncated is False
    assert meta.original_bytes == 0
    assert meta.max_bytes == 0


# --- 超越轴：未截断显式归零 ---------------------------------------------------
def test_untruncated_zeroes_omitted():
    """未截断时 omitted_calls 显式归零（即便调用方误传非零）。"""
    meta = build_result_metadata(
        original_bytes=100, max_bytes=500, omitted_calls=7
    )
    assert meta.truncated is False
    assert meta.omitted_calls == 0


def test_untruncated_zeroes_name_bytes():
    """未截断时 original_name_bytes 显式归零。"""
    meta = build_result_metadata(
        original_bytes=100, max_bytes=500, original_name_bytes=42
    )
    assert meta.truncated is False
    assert meta.original_name_bytes == 0


def test_truncated_preserves_omitted():
    """截断时 omitted_calls / original_name_bytes 保留（凭据不丢）。"""
    meta = build_result_metadata(
        original_bytes=1000,
        max_bytes=500,
        omitted_calls=3,
        original_name_bytes=18,
    )
    assert meta.truncated is True
    assert meta.omitted_calls == 3
    assert meta.original_name_bytes == 18


# --- 序列化：字段名逐字对照 ---------------------------------------------------
def test_metadata_dict_field_names():
    """序列化字段名逐字对照协议层 ToolResultMetadata。"""
    meta = build_result_metadata(original_bytes=1000, max_bytes=500, omitted_calls=2)
    d = metadata_to_dict(meta)
    assert set(d) == {
        "truncated",
        "original_bytes",
        "max_bytes",
        "omitted_calls",
        "original_name_bytes",
    }
    assert d["truncated"] is True
    assert d["original_bytes"] == 1000
    assert d["max_bytes"] == 500
    assert d["omitted_calls"] == 2


def test_metadata_is_frozen():
    """元数据不可变（frozen dataclass）。"""
    meta = build_result_metadata(original_bytes=1000, max_bytes=500)
    with pytest.raises(dataclasses.FrozenInstanceError):
        meta.truncated = False  # type: ignore[misc]


# --- 反向变异（误删判据须转红）-----------------------------------------------
def test_reverse_truncated_judgement_removed():
    """反向变异：把 truncated 判定改成 >=（边界误判截断）须与本实现不同。"""
    # 本实现严格 >，边界相等不截断。
    meta = build_result_metadata(original_bytes=500, max_bytes=500)
    assert meta.truncated is False  # 若误改成 >=，此断言转红


def test_reverse_untruncated_not_zeroed():
    """反向变异：未截断若不归零 omitted_calls，本实现强制归零与之相反。"""
    meta = build_result_metadata(
        original_bytes=100, max_bytes=500, omitted_calls=7
    )
    assert meta.omitted_calls == 0  # 若漏掉归零逻辑，此断言转红


def test_reverse_source_confusion():
    """反向变异：溯源标签混淆（引擎内置误判成 executed_tool_call）须转红。"""
    assert classify_source(True) is not ToolResultSource.EXECUTED_TOOL_CALL


def test_metadata_default_fields():
    """默认 omitted_calls / original_name_bytes 为 0。"""
    meta = ToolResultMetadata(truncated=True, original_bytes=10, max_bytes=5)
    assert meta.omitted_calls == 0
    assert meta.original_name_bytes == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
