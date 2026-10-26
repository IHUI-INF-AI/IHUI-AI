# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型同步「上游自动更新替换」单测(2026-10-26 立)。

覆盖两点机主硬需求:
1. stepfun 永久退役:同步服务不得再拉它的清单,且 admin reset 不得解除退役。
2. 上游下架旧模型时,自动在同族里找后继并改写引用点
   (is_default / ai_model_config.default_model_id / model_id_for_test)。

只测纯函数与常量守卫,不连 DB、不发网络请求。
"""

from __future__ import annotations

from app.services.model_sync import (
    RETIRED_PROVIDERS,
    ModelSyncService,
)


def test_stepfun_is_permanently_retired() -> None:
    """stepfun 必须在永久退役清单里(机主 2026-10-26 明确不再续费)。"""
    assert "stepfun" in RETIRED_PROVIDERS
    assert RETIRED_PROVIDERS["stepfun"]


def test_reset_cannot_unretire_stepfun() -> None:
    """reset 只解除技术性故障,不能绕过商务性退役。"""
    svc = ModelSyncService()
    out = svc.reset_provider("stepfun")
    assert out["reset"] is False
    assert out["retired"] is True


def test_reset_still_works_for_normal_provider() -> None:
    """未退役 provider 的 reset 行为保持不变(不得被新守卫误伤)。"""
    svc = ModelSyncService()
    svc._provider_failure_counter["openai"] = 2
    svc._permanently_disabled_providers.add("openai")
    out = svc.reset_provider("openai")
    assert out["reset"] is True
    assert out["previous_failures"] == 2
    assert out["was_disabled"] is True
    assert "openai" not in svc._permanently_disabled_providers


def test_split_stem_version() -> None:
    cases = {
        "step-3.5-flash": ("step", "3.5-flash"),
        "gpt-4o-2024-08-06": ("gpt", "4o-2024-08-06"),
        "agnes-2.5-flash": ("agnes", "2.5-flash"),
        "openrouter/stepfun/step-3.5-flash": ("stepfun/step", "3.5-flash"),
    }
    for mid, want in cases.items():
        assert ModelSyncService._split_stem_version(mid) == want, mid


def test_find_successor_prefers_higher_version() -> None:
    """同族内必须挑版本更高的那个(3.5 -> 3.7,不是 3.1)。"""
    got = ModelSyncService._find_successor(
        "step-3.5-flash",
        {"step-3.7-flash", "step-3.1-flash", "step-3.5-flash"},
        set(),
    )
    assert got == "step-3.7-flash"


def test_find_successor_ignores_size_variant() -> None:
    """gpt-4o 与 gpt-4o-mini 数字段相同,是尺寸变体不是版本迭代,不得互替。"""
    got = ModelSyncService._find_successor("gpt-4o", {"gpt-4o-mini"}, set())
    assert got is None


def test_find_successor_handles_date_suffix() -> None:
    got = ModelSyncService._find_successor(
        "gpt-4o-2024-08-06", {"gpt-4o-2024-11-20", "gpt-4o-mini"}, set()
    )
    assert got == "gpt-4o-2024-11-20"


def test_find_successor_cross_family_is_none() -> None:
    """不同主干不得乱认后继(qwen2.5 不该被替成 qwen3)。"""
    got = ModelSyncService._find_successor(
        "qwen2.5-72b-instruct", {"qwen3-235b-a22b"}, set()
    )
    assert got is None


def test_find_successor_one_candidate_only_claimed_once() -> None:
    """一个后继只能被一个旧模型认领,避免多个旧 id 挤到同一个新 id。"""
    first = ModelSyncService._find_successor(
        "llama-3.1-70b", {"llama-3.3-70b"}, set()
    )
    assert first == "llama-3.3-70b"
    second = ModelSyncService._find_successor(
        "llama-3.2-70b", {"llama-3.3-70b"}, {"llama-3.3-70b"}
    )
    assert second is None


def test_find_successor_v_prefix() -> None:
    got = ModelSyncService._find_successor("old-model-v1", {"old-model-v2"}, set())
    assert got == "old-model-v2"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
