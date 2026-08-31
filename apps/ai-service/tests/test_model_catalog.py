# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型分类引擎回归测试(2026-08-29 立)。

覆盖的都是**真踩过的坑**,每条用例对应一次线上/实测误判:
- 参数量 `32b` 被当成版本号 3.32 → 整组 qwen 的最高代次算错
- 白名单豁免代次比较 → gpt-5/5.1/…/5.6 全被判成"最新"
- 版本元组未定长归一化 → claude-opus-4-8 与 claude-opus-5 并列最新
- nvidia_nim 的 release_date 是 1993 年脏数据 → kimi-k3 被误判过时
- 白名单正则缺左边界 → `solar-pro4` 里的 "o4" 命中 `o[1-9]`
- 价格/快照变体判定晚于白名单 → `deepseek-v4-pro-0813:batch` 混进最新列表
- openrouter 的 `~vendor/xxx-latest` 别名因 `$` 锚点失配未被识别

运行:
    cd apps/ai-service && .venv/Scripts/python.exe -m pytest tests/test_model_catalog.py -v
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.services.model_catalog import (
    LEGACY_RELEASE_DAYS,
    ModelCategory,
    ModelTier,
    annotate_models,
    classify_model,
)

NOW = datetime(2026, 8, 29, tzinfo=timezone.utc)


def _mk(model_id: str, provider: str = "openrouter", **extra) -> dict:
    m = {"id": model_id, "provider": provider, "name": model_id}
    m.update(extra)
    return m


def _tier_of(model_id: str, provider: str = "openrouter", **extra) -> str:
    return classify_model(model_id, provider, now=NOW, **extra).tier.value


def _cat_of(model_id: str, provider: str = "openrouter", **extra) -> str:
    return classify_model(model_id, provider, now=NOW, **extra).category.value


# ---------------------------------------------------------------------------
# 1. 参数量后缀必须剥离(否则 qwen3-32b 会被当 3.32 版本)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "model_id,expected_version",
    [
        ("qwen3-32b", "3"),
        ("qwen3.8-27b", "3.8"),
        ("qwen3.8-2.4t-a95b", "3.8"),
        ("qwen3.5-397b-a17b", "3.5"),
        ("gemma-3-12b-it", "3"),
        ("llama-4-maverick-17b-128e-instruct", "4"),
        ("llama-3.3-70b-versatile", "3.3"),
        ("starcoder2-15b", "2"),
    ],
)
def test_param_scale_not_treated_as_version(model_id: str, expected_version: str) -> None:
    cls = classify_model(model_id, "openrouter", now=NOW)
    assert cls.generation == expected_version, (
        f"{model_id}: 参数量被误判为版本号 → generation={cls.generation}"
    )


def test_qwen_group_max_generation_is_3_8_not_3_32() -> None:
    """回归:曾经 `qwen3-32b` 把整组 max 拉到 3.32,导致 `qwen3.8-27b` 被判过时。"""
    models = [
        _mk("qwen3-32b"),
        _mk("qwen3.8-27b"),
        _mk("qwen3.7-max"),
        _mk("qwen2.5-72b-instruct"),
    ]
    annotate_models(models, now=NOW)
    by_id = {m["id"]: m["model_tier"] for m in models}
    assert by_id["qwen3.8-27b"] == ModelTier.LATEST.value
    assert by_id["qwen3.7-max"] == ModelTier.STANDARD.value
    assert by_id["qwen2.5-72b-instruct"] == ModelTier.LEGACY.value


# ---------------------------------------------------------------------------
# 2. 白名单不得豁免代次比较
# ---------------------------------------------------------------------------


def test_curated_models_still_compare_generation() -> None:
    """gpt-5 / 5.1 / … / 5.6 都在白名单里,但只有 5.6 能留在 latest。"""
    models = [_mk("gpt-5"), _mk("gpt-5.1"), _mk("gpt-5.5"), _mk("gpt-5.6")]
    annotate_models(models, now=NOW)
    by_id = {m["id"]: m["model_tier"] for m in models}
    assert by_id["gpt-5.6"] == ModelTier.LATEST.value
    assert all(by_id[i] != ModelTier.LATEST.value for i in ("gpt-5", "gpt-5.1", "gpt-5.5"))


def test_version_tuple_compares_major_first() -> None:
    """(4, 8) 不能因为位数多就大于 (5,)。"""
    models = [_mk("claude-opus-4-8"), _mk("claude-opus-5")]
    annotate_models(models, now=NOW)
    by_id = {m["id"]: m["model_tier"] for m in models}
    assert by_id["claude-opus-5"] == ModelTier.LATEST.value
    assert by_id["claude-opus-4-8"] == ModelTier.LEGACY.value


# ---------------------------------------------------------------------------
# 3. 脏 release_date / 时间窗
# ---------------------------------------------------------------------------


def test_release_date_before_2020_is_ignored() -> None:
    """nvidia_nim 部分行的 release_date 是 1993-04-26,不能因此判 legacy。"""
    cls = classify_model(
        "moonshotai/kimi-k3",
        "nvidia_nim",
        release_date="1993-04-26T00:00:00+00:00",
        now=NOW,
    )
    assert cls.tier is ModelTier.LATEST
    assert "released" not in cls.reason


def test_older_than_legacy_window_is_legacy() -> None:
    old = (NOW - timedelta(days=LEGACY_RELEASE_DAYS + 30)).isoformat()
    assert _tier_of("some-old-model", "openrouter", release_date=old) == ModelTier.LEGACY.value


# ---------------------------------------------------------------------------
# 4. 白名单正则边界
# ---------------------------------------------------------------------------


def test_openai_o_series_needs_left_boundary() -> None:
    """`solar-pro4` 里的 "o4" 不能命中 o 系列白名单。"""
    assert _tier_of("upstage/solar-pro4", "openrouter") != ModelTier.LATEST.value
    assert _tier_of("o3", "openrouter") == ModelTier.LATEST.value
    assert _tier_of("o4-mini", "openrouter") == ModelTier.LATEST.value


@pytest.mark.parametrize(
    "model_id",
    [
        "~anthropic/claude-opus-latest",
        "~openai/gpt-latest",
        "~z-ai/glm-latest",
        "gemini-flash-latest",
        "gemini-pro-latest",
    ],
)
def test_latest_alias_is_curated(model_id: str) -> None:
    assert _tier_of(model_id, "openrouter") == ModelTier.LATEST.value


def test_latest_alias_of_old_generation_still_demoted() -> None:
    """老代次的 -latest 别名要被代次比较压下去,不能因为别名就常驻最新。"""
    models = [_mk("gemini-3.7-flash"), _mk("gemini-2.5-flash-native-audio-latest")]
    annotate_models(models, now=NOW)
    by_id = {m["id"]: m["model_tier"] for m in models}
    assert by_id["gemini-3.7-flash"] == ModelTier.LATEST.value
    assert by_id["gemini-2.5-flash-native-audio-latest"] != ModelTier.LATEST.value


# ---------------------------------------------------------------------------
# 5. 变体判定必须早于白名单
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "model_id",
    [
        "deepseek-v4-pro-0813",
        "deepseek-v4-pro-0813:batch",
        "z-ai/glm-5.3-flash:batch",
        "minimax/minimax-m3:free",
        "deepseek-v4-flash-free",
    ],
)
def test_pricing_and_snapshot_variants_demoted(model_id: str) -> None:
    assert _tier_of(model_id, "openrouter") != ModelTier.LATEST.value


def test_experimental_demoted_even_if_curated() -> None:
    assert _tier_of("deepseek-v4-flash-vision-exp", "openrouter") == ModelTier.STANDARD.value


# ---------------------------------------------------------------------------
# 6. 用途分类
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "model_id,expected",
    [
        ("@cf/baai/bge-m3", ModelCategory.EMBEDDING.value),  # 含 bge,但要判嵌入
        ("@cf/baai/bge-reranker-base", ModelCategory.RERANK.value),  # rerank 必须先于 embedding
        ("stepfun/step-tts-mini", ModelCategory.TTS.value),
        ("@cf/openai/whisper-large-v3-turbo", ModelCategory.ASR.value),
        ("@cf/black-forest-labs/flux-1-schnell", ModelCategory.IMAGE.value),
        ("gpt-5-image", ModelCategory.IMAGE.value),
        ("gpt-4o", ModelCategory.VISION.value),
        ("deepseek-v4-pro", ModelCategory.CHAT.value),
    ],
)
def test_category_detection(model_id: str, expected: str) -> None:
    assert _cat_of(model_id, "cloudflare_workers_ai") == expected


@pytest.mark.parametrize(
    "model_id",
    ["@cf/baai/bge-m3", "stepfun/step-tts-mini", "@cf/black-forest-labs/flux-1-schnell"],
)
def test_non_conversational_models_are_legacy(model_id: str) -> None:
    """聊天场景调不通嵌入/语音/图像模型,一律不进默认列表。"""
    assert _tier_of(model_id, "cloudflare_workers_ai") == ModelTier.LEGACY.value


# ---------------------------------------------------------------------------
# 7. 预设档位与字段完整性
# ---------------------------------------------------------------------------


def test_preset_tier_is_respected() -> None:
    """default_models.json 手工标注的主力模型不被自动降级。"""
    models = [
        {"id": "stepfun/step-router-v1", "provider": "stepfun", "model_tier": "latest"},
        _mk("stepfun/step-router-v1-old-dep", "stepfun"),
    ]
    annotate_models(models, now=NOW)
    assert models[0]["model_tier"] == ModelTier.LATEST.value
    assert models[0]["classify_reason"].startswith("preset:")


def test_annotate_models_fills_all_fields() -> None:
    models = [_mk("deepseek-v4-pro"), _mk("@cf/baai/bge-m3", "cloudflare_workers_ai")]
    annotate_models(models, now=NOW)
    for m in models:
        for field in ("category", "model_tier", "family", "classify_reason"):
            assert field in m, f"缺少字段 {field}: {m}"


def test_annotate_models_handles_empty() -> None:
    assert annotate_models([]) == []


def test_unknown_tier_defaults_to_latest() -> None:
    """后端字段缺失时不能把模型藏起来。"""
    models = [_mk("some-model-without-metadata")]
    annotate_models(models, now=NOW)
    assert models[0]["model_tier"] == ModelTier.STANDARD.value
    assert models[0]["category"] == ModelCategory.CHAT.value
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
