# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""目录前沿化策略用例(2026-11-12)。"""

from __future__ import annotations

import pytest

from app.services.model_catalog_policy import (
    LEGACY_MODEL_IDS,
    filter_frontier,
    is_legacy_model,
    restore_modality_entries,
)


@pytest.mark.parametrize(
    "model_id",
    [
        "workbuddy/kimi-k2.5",
        "workbuddy/kimi-k2.7",
        "workbuddy/glm-4.7",
        "workbuddy/glm-5.1",
        "workbuddy/deepseek-v3-2-volc",
        # 2026-11-21 机主点名:无版本号的 DeepSeek 老别名与 R1 代也属历史模型
        "deepseek-chat",
        "deepseek-flash",
        "deepseek-ai/deepseek-r1",
        "deepseek-ai/deepseek-r1-0528-qwen3-8b",
        "workbuddy/minimax-m2.5",
        "agnes/agnes-2.5-pro",
        "grok-4.3",
        "ollama/llama3.3:70b",
    ],
)
def test_legacy_models_are_hidden(model_id):
    assert is_legacy_model(model_id) is True


@pytest.mark.parametrize(
    "model_id",
    [
        # 同族最新两代必须留着(藏错模型比多留一个严重得多)
        "workbuddy/kimi-k2.8-preview",
        "workbuddy/kimi-k3-1",
        "workbuddy/glm-5.2",
        "workbuddy/glm-5.3",
        "workbuddy/glm-5.3-flash",
        "workbuddy/deepseek-v4-flash",
        "workbuddy/deepseek-v4.1-flash",
        "workbuddy/minimax-m3",
        "workbuddy/minimax-m3.1-flash",
        "agnes/agnes-3.0-flash",
        "openrouter/liquid/lfm-3-1.7b:free",
        # 小参数/免费模型按代际判断,不按参数量砍
        "openrouter/gemma-4-26b-a4b-it:free",
        "llm7/gpt-oss:20b",
        # 版本序不明确的不动(4.20 变体无法确定比 4.6/4.7 新还是旧)
        "grok-4.20-0309-reasoning",
        # 清单外的新模型默认显示
        "some-vendor/brand-new-model",
    ],
)
def test_frontier_models_are_kept(model_id):
    assert is_legacy_model(model_id) is False


def test_filter_frontier_drops_only_legacy(monkeypatch):
    monkeypatch.delenv("MODEL_CATALOG_HIDE_LEGACY", raising=False)
    models = [
        {"id": "workbuddy/kimi-k3-1"},
        {"id": "workbuddy/kimi-k2.5"},
        {"id": "workbuddy/glm-5.3"},
        {"id": "unknown/model"},
    ]
    kept = [m["id"] for m in filter_frontier(models)]
    assert kept == ["workbuddy/kimi-k3-1", "workbuddy/glm-5.3", "unknown/model"]


def test_filter_frontier_can_be_disabled(monkeypatch):
    monkeypatch.setenv("MODEL_CATALOG_HIDE_LEGACY", "0")
    models = [{"id": "workbuddy/kimi-k2.5"}]
    assert filter_frontier(models) == models


def test_every_legacy_id_is_a_full_model_id():
    """清单必须是完整 id(带厂商前缀/大小写原样),否则过滤永远命不中。

    `deepseek-` 开头的是 provider 自带的裸 id(目录里就叫 `deepseek-chat`,
    没有前缀),与 `grok-` / `llama` 同列 —— 不是漏写厂商前缀。
    """
    for model_id in LEGACY_MODEL_IDS:
        assert "/" in model_id or model_id.startswith(("grok-", "llama", "deepseek-")), model_id
        assert model_id == model_id.strip()


def test_restore_modality_entries_keeps_media_killed_by_chat_probe():
    """chat 探针对媒体模型必然失败(探针打的是 completion)⇒ 模态档要被补回。

    生产实测病灶:image/video/vision 被 filter_available 全批摘掉后,/llm/models
    只剩 21 条全 chat,选择器里自然看不到任何模态模型。
    """
    originals = [
        {"id": "agnes/agnes-image-2.5-flash", "category": "image"},
        {"id": "agnes/agnes-video-2.5-flash", "category": "video"},
        {"id": "gpt-5.6", "category": "chat"},
        {"id": "workbuddy/glm-5.3", "category": "chat"},
    ]
    kept_by_health = [{"id": "workbuddy/glm-5.3", "category": "chat"}]
    restored = restore_modality_entries(originals, kept_by_health)
    ids = [m["id"] for m in restored]
    assert "agnes/agnes-image-2.5-flash" in ids
    assert "agnes/agnes-video-2.5-flash" in ids
    # 探针判死的聊天模型不被这条修复顺手复活
    assert "gpt-5.6" not in ids
    # 已在 kept 里的条目不被重复追加
    assert ids.count("workbuddy/glm-5.3") == 1


def test_restore_modality_entries_is_idempotent():
    originals = [{"id": "agnes/agnes-image-2.5-flash", "category": "image"}]
    once = restore_modality_entries(originals, [])
    twice = restore_modality_entries(originals, once)
    assert [m["id"] for m in twice] == [m["id"] for m in once]


def test_restore_modality_entries_leaves_middleware_hidden():
    """嵌入/重排/审核不是模态,不能被这条修复带回来。"""
    originals = [
        {"id": "x/text-embedding-3", "category": "embedding"},
        {"id": "x/rerank-1", "category": "rerank"},
    ]
    assert restore_modality_entries(originals, []) == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
