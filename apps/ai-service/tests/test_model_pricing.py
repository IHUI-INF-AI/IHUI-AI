# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""app/core/model_pricing.py + routers/model_pricing_api.py 测试。

覆盖:
- resolve_model_pricing_per_1m:模型级前缀特异性(gpt-4o-mini 先于 gpt-4o)、
  厂商兜底、全局默认、运行时覆盖最高优先级
- is_model_price_known / estimate_cost_usd(estimated 口径)
- set_model_pricing / get_overrides 覆盖注入与只读拷贝
- build_pricing_snapshot:覆盖率统计、排序、meta;router 信封契约
"""

from __future__ import annotations

import pytest

from app.core import model_pricing
from app.routers.model_pricing_api import build_pricing_snapshot, get_model_pricing


@pytest.fixture(autouse=True)
def _clean_overrides():
    """每用例前后清空运行时覆盖,防用例间污染。"""
    model_pricing._OVERRIDES.clear()
    yield
    model_pricing._OVERRIDES.clear()


# =============================================================================
# resolve_model_pricing_per_1m
# =============================================================================


def test_resolve_model_level_exact():
    r = model_pricing.resolve_model_pricing_per_1m("gpt-4o")
    assert r == {"input": 2.50, "output": 10.00}


def test_resolve_prefix_specificity_mini_before_full():
    """gpt-4o-mini 必须命中自己的价,不得前缀误吞 gpt-4o 价。"""
    mini = model_pricing.resolve_model_pricing_per_1m("gpt-4o-mini-2024-07-18")
    full = model_pricing.resolve_model_pricing_per_1m("gpt-4o-2024-11-20")
    assert mini["input"] == 0.15
    assert full["input"] == 2.50


def test_resolve_case_and_whitespace_normalized():
    r = model_pricing.resolve_model_pricing_per_1m("  GPT-4O-Mini ")
    assert r["input"] == 0.15


def test_resolve_provider_fallback_when_model_unknown():
    r = model_pricing.resolve_model_pricing_per_1m("totally-unknown-model", provider="anthropic")
    assert r == {"input": 3.00, "output": 15.00}


def test_resolve_global_default_when_all_unknown():
    r = model_pricing.resolve_model_pricing_per_1m("no-such-model", provider="no-vendor")
    assert r == model_pricing.DEFAULT_PRICE_PER_1M


def test_override_beats_model_table():
    model_pricing.set_model_pricing("gpt-4o", 9.99, 19.99)
    r = model_pricing.resolve_model_pricing_per_1m("gpt-4o")
    assert r == {"input": 9.99, "output": 19.99}


def test_set_pricing_ignores_blank_model():
    model_pricing.set_model_pricing("  ", 1.0, 1.0)
    assert model_pricing.get_overrides() == {}


# =============================================================================
# is_model_price_known / estimate_cost_usd
# =============================================================================


def test_is_model_price_known():
    assert model_pricing.is_model_price_known("claude-sonnet-4-20250514") is True
    assert model_pricing.is_model_price_known("no-such-model") is False


def test_estimate_cost_usd_exact_vs_estimated():
    exact = model_pricing.estimate_cost_usd("gpt-4o", tokens_in=1_000_000, tokens_out=1_000_000)
    assert exact["cost_usd"] == pytest.approx(12.50)
    assert exact["estimated"] is False
    est = model_pricing.estimate_cost_usd("no-such-model", tokens_in=1_000_000, tokens_out=0)
    assert est["estimated"] is True  # 走全局默认兜底价


def test_estimate_zero_tokens_zero_cost():
    r = model_pricing.estimate_cost_usd("gpt-4o", tokens_in=0, tokens_out=0)
    assert r["cost_usd"] == 0.0


# =============================================================================
# get_overrides / snapshot / router
# =============================================================================


def test_get_overrides_returns_copy():
    model_pricing.set_model_pricing("m1", 1.0, 2.0)
    snap = model_pricing.get_overrides()
    snap["m1"]["input"] = 999.0
    snap["injected"] = {"input": 0, "output": 0}
    assert model_pricing.get_overrides()["m1"]["input"] == 1.0
    assert "injected" not in model_pricing.get_overrides()


def test_snapshot_coverage_and_order():
    data = build_pricing_snapshot()
    assert data["coverage"]["model_count"] == len(model_pricing._MODEL_PRICES_PER_1M)
    assert data["coverage"]["provider_count"] == len(model_pricing.PROVIDER_PRICES_PER_1M)
    assert data["coverage"]["override_count"] == 0
    models = data["models"]
    # 排序:键长度降序(前缀特异性优先)
    lens = [len(m["model"]) for m in models]
    assert lens == sorted(lens, reverse=True)
    assert data["meta"]["source"] == "public-rates"


def test_snapshot_reflects_overrides():
    model_pricing.set_model_pricing("my-finetune", 3.0, 6.0)
    data = build_pricing_snapshot()
    assert data["overrides"]["my-finetune"] == {"input": 3.0, "output": 6.0}
    assert data["coverage"]["override_count"] == 1


@pytest.mark.asyncio
async def test_router_envelope_contract():
    res = await get_model_pricing()
    assert res["code"] == 0
    assert res["message"] == "ok"
    assert res["data"]["coverage"]["model_count"] > 30
    assert {"models", "providers", "overrides", "coverage", "meta"} <= set(res["data"].keys())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
