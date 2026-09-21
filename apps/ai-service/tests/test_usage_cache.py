# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""app/core/usage_cache.py 测试(P0-①,2026-09-18 立)。

覆盖:
- normalize_usage:四厂商(OpenAI/Anthropic/DeepSeek/LiteLLM)输入形态归一化、
  别名探测优先序、缺省回填(total_tokens 互推)、原生字段全保留(只增不删)
- 防御:非 dict / 空输入 / 非法值 / 负数一律降级为缺省口径,不抛错
- extract_cache_metrics:缓存两字段提取(供 ledger/recorder 复用)
"""

from __future__ import annotations

from app.core.usage_cache import extract_cache_metrics, normalize_usage

# =============================================================================
# normalize_usage:各厂商原生形态
# =============================================================================


def test_normalize_openai_implicit_cache_nested():
    """OpenAI 形态:嵌套 prompt_tokens_details.cached_tokens。"""
    raw = {
        "prompt_tokens": 1000,
        "completion_tokens": 200,
        "total_tokens": 1200,
        "prompt_tokens_details": {"cached_tokens": 600},
    }
    out = normalize_usage(raw)
    assert out["prompt_tokens"] == 1000
    assert out["completion_tokens"] == 200
    assert out["total_tokens"] == 1200
    assert out["cached_tokens"] == 600
    assert out["cache_creation_tokens"] == 0
    # 原生嵌套字段原样保留(审计可回看)
    assert out["prompt_tokens_details"] == {"cached_tokens": 600}


def test_normalize_anthropic_native_fields():
    """Anthropic 形态:input_tokens / cache_read/creation_input_tokens。"""
    raw = {
        "input_tokens": 1000,
        "output_tokens": 200,
        "cache_read_input_tokens": 700,
        "cache_creation_input_tokens": 300,
    }
    out = normalize_usage(raw)
    assert out["prompt_tokens"] == 1000
    assert out["completion_tokens"] == 200
    assert out["total_tokens"] == 1200  # 缺省回填
    assert out["cached_tokens"] == 700
    assert out["cache_creation_tokens"] == 300
    # 原生键透传
    assert out["input_tokens"] == 1000
    assert out["cache_read_input_tokens"] == 700
    assert out["cache_creation_input_tokens"] == 300


def test_normalize_deepseek_native_fields():
    """DeepSeek 形态:prompt_cache_hit_tokens(写免费 → write=0)。"""
    raw = {
        "prompt_tokens": 1000,
        "completion_tokens": 200,
        "prompt_cache_hit_tokens": 500,
        "prompt_cache_miss_tokens": 500,
    }
    out = normalize_usage(raw)
    assert out["cached_tokens"] == 500
    assert out["cache_creation_tokens"] == 0


def test_normalize_litellm_mixed_aliases_priority():
    """LiteLLM model_dump 混排多厂商别名:读别名序 cached>cache_read,写序 creation。"""
    raw = {
        "prompt_tokens": 100,
        "completion_tokens": 10,
        "cached_tokens": 40,
        "cache_read_input_tokens": 30,
        "cache_creation_tokens": 20,
        "cache_creation_input_tokens": 15,
    }
    out = normalize_usage(raw)
    assert out["cached_tokens"] == 40
    assert out["cache_creation_tokens"] == 20


# =============================================================================
# normalize_usage:回填与防御
# =============================================================================


def test_normalize_total_tokens_backfill():
    """total_tokens 缺省时用 prompt+completion 回填。"""
    out = normalize_usage({"prompt_tokens": 100, "completion_tokens": 50})
    assert out["total_tokens"] == 150


def test_normalize_total_tokens_inconsistent_upgraded():
    """total_tokens 小于 prompt+completion 时回填修正(OpenAI 口径)。"""
    out = normalize_usage(
        {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 10}
    )
    assert out["total_tokens"] == 150


def test_normalize_non_dict_inputs():
    """非 dict 输入返回 {}(计量失败绝不阻塞主链路)。"""
    assert normalize_usage(None) == {}
    assert normalize_usage([]) == {}
    assert normalize_usage("usage") == {}
    assert normalize_usage(123) == {}


def test_normalize_empty_dict_defaults():
    """空 dict → 五键全 0 显式存在(消费方无需判 None)。"""
    assert normalize_usage({}) == {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "cached_tokens": 0,
        "cache_creation_tokens": 0,
    }


def test_normalize_invalid_values_treated_as_missing():
    """非法值(非数字/负数/None)视为未提供,降级为 0。"""
    out = normalize_usage(
        {
            "prompt_tokens": "abc",
            "completion_tokens": -5,
            "cached_tokens": None,
            "cache_creation_input_tokens": "1x",
        }
    )
    assert out["prompt_tokens"] == 0
    assert out["completion_tokens"] == 0
    assert out["cached_tokens"] == 0
    assert out["cache_creation_tokens"] == 0


def test_normalize_string_numbers_coerced():
    """字符串数字宽容转换(网关层偶发 str 化)。"""
    out = normalize_usage(
        {"prompt_tokens": "100", "completion_tokens": "20", "cached_tokens": "40"}
    )
    assert out["prompt_tokens"] == 100
    assert out["completion_tokens"] == 20
    assert out["cached_tokens"] == 40


def test_normalize_additive_only():
    """归一化只增不删:未知原生键也原样透传。"""
    out = normalize_usage({"prompt_tokens": 1, "vendor_extra": {"x": 1}})
    assert out["vendor_extra"] == {"x": 1}


# =============================================================================
# extract_cache_metrics
# =============================================================================


def test_extract_cache_metrics_anthropic():
    read, write = extract_cache_metrics(
        {
            "input_tokens": 10,
            "cache_read_input_tokens": 7,
            "cache_creation_input_tokens": 3,
        }
    )
    assert (read, write) == (7, 3)


def test_extract_cache_metrics_openai_nested():
    read, write = extract_cache_metrics(
        {"prompt_tokens": 10, "prompt_tokens_details": {"cached_tokens": 6}}
    )
    assert (read, write) == (6, 0)


def test_extract_cache_metrics_non_dict():
    assert extract_cache_metrics(None) == (0, 0)
    assert extract_cache_metrics(123) == (0, 0)


def test_extract_cache_metrics_no_cache_fields():
    assert extract_cache_metrics({"prompt_tokens": 5}) == (0, 0)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
