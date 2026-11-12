"""AIS-013 回归:Anthropic 缓存 token 不得让输入量低估 / 被钳成 0。

票面:Anthropic 原生 usage 的 input_tokens 不含缓存读/写
(cache_read_input_tokens / cache_creation_input_tokens),旧实现直接把它当
prompt_tokens 交给 cost_ledger,ledger 又按 tokens_in 把缓存量钳掉 ⇒ 缓存重的
请求 tokens_in 低估甚至为 0,近乎免计。

修法(票面方案①):provider 在归一前把 prompt_tokens 置为
input + cache_read + cache_creation(保持 ledger 全量口径);缓存两项仍单独记录
为 cached_tokens / cache_creation_tokens 供展示与缓存感知计价。ledger 侧不再按
tokens_in 截断缓存字段(只钳非负),避免把异常/真实值静默折成 0。
"""

from __future__ import annotations

from pathlib import Path

from app.providers.anthropic_provider import _normalize_anthropic_usage
from app.services.cost_ledger import CostLedger


def _ledger(tmp_path: Path) -> CostLedger:
    """独立文件 + 干净内存的账本(不污染全局单例)。"""
    return CostLedger(file_path=tmp_path / "ledger.json")


def test_anthropic_cache_tokens_added_into_prompt_total():
    """input=100 + cache_read=900 + cache_creation=50 → 输入总量 1050。"""
    usage = _normalize_anthropic_usage(
        {
            "input_tokens": 100,
            "output_tokens": 20,
            "cache_read_input_tokens": 900,
            "cache_creation_input_tokens": 50,
        }
    )
    assert usage["prompt_tokens"] == 1050
    assert usage["completion_tokens"] == 20
    assert usage["total_tokens"] == 1070
    # 缓存字段仍单独保留,供展示/定价,不因加回总量而丢失
    assert usage["cached_tokens"] == 900
    assert usage["cache_creation_tokens"] == 50
    # 原生字段透传(审计可回看)
    assert usage["input_tokens"] == 100
    assert usage["cache_read_input_tokens"] == 900
    assert usage["cache_creation_input_tokens"] == 50


def test_anthropic_without_cache_unchanged():
    """无缓存请求:输入量不变,缓存两字段为 0。"""
    usage = _normalize_anthropic_usage(
        {"input_tokens": 100, "output_tokens": 10}
    )
    assert usage["prompt_tokens"] == 100
    assert usage["total_tokens"] == 110
    assert usage["cached_tokens"] == 0
    assert usage["cache_creation_tokens"] == 0


def test_openai_prompt_tokens_not_double_counted():
    """已带 prompt_tokens(OpenAI/LiteLLM 全量口径)的形态不得再加缓存。"""
    usage = _normalize_anthropic_usage(
        {
            "prompt_tokens": 100,
            "completion_tokens": 10,
            "cache_read_input_tokens": 900,
        }
    )
    assert usage["prompt_tokens"] == 100
    assert usage["cached_tokens"] == 900


def test_normalize_is_idempotent():
    """归一结果二次归一不再叠加缓存(provider 与网关可能各归一一次)。"""
    once = _normalize_anthropic_usage(
        {
            "input_tokens": 100,
            "output_tokens": 20,
            "cache_read_input_tokens": 900,
            "cache_creation_input_tokens": 50,
        }
    )
    twice = _normalize_anthropic_usage(once)
    assert twice["prompt_tokens"] == 1050
    assert twice["total_tokens"] == 1070


def test_ledger_records_full_prompt_total_with_cache_fields(tmp_path: Path):
    """ledger 同口径入账:tokens_in=1050,cached=900,cache_write=50。"""
    usage = _normalize_anthropic_usage(
        {
            "input_tokens": 100,
            "output_tokens": 20,
            "cache_read_input_tokens": 900,
            "cache_creation_input_tokens": 50,
        }
    )
    ledger = _ledger(tmp_path)
    result = ledger.append(
        {
            "record_id": "r1",
            "model": "claude-sonnet-4-5",
            "tokens_in": usage["prompt_tokens"],
            "tokens_out": usage["completion_tokens"],
            "cached_tokens": usage["cached_tokens"],
            "cache_creation_tokens": usage["cache_creation_tokens"],
        }
    )
    entry = result["entry"]
    assert entry["tokens_in"] == 1050
    assert entry["cached_tokens"] == 900
    assert entry["cache_creation_tokens"] == 50
    assert entry["total_tokens"] == 1070
    assert entry["cost_usd"] >= 0


def test_ledger_does_not_zero_cache_when_cached_exceeds_tokens_in(tmp_path: Path):
    """cached > tokens_in 的异常/历史条目:如实记录缓存量,不再被钳成 0。"""
    ledger = _ledger(tmp_path)
    result = ledger.append(
        {
            "record_id": "r2",
            "model": "claude-sonnet-4-5",
            "tokens_in": 100,
            "tokens_out": 10,
            "cached_tokens": 900,
            "cache_creation_tokens": 50,
        }
    )
    entry = result["entry"]
    assert entry["cached_tokens"] == 900
    assert entry["cache_creation_tokens"] == 50
    # 计价侧自行钳 uncached>=0,不产生负成本
    assert entry["cost_usd"] >= 0
