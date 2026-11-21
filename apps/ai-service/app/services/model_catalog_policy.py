# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""目录展示策略:只给用户前沿模型(2026-11-12 立)。

口径(与机主确认):
- 同一家族只保留最新两代;小参数/免费模型按代际判断,不按参数量砍
  (lfm-3-1.7b、gpt-oss:20b 这类虽然小,但属当前代,继续展示)。
- 不用启发式版本比较:grok-4.20 与 grok-4.3、hy3-x 与 hy4-preview 这种 marketing
  版本号混排,自动比较必然误判(会把新模型当旧的藏掉)。全部走显式清单,
  **清单里没有的新模型一律显示**,新增目录时默认不会被误伤。
- 清单只收"同一目录里已有更新一代"的旧模型,以及仓库里明确过时的 llama3.3。
- MODEL_CATALOG_HIDE_LEGACY=0 可整体关掉(排障/对比用),默认开启。
"""

from __future__ import annotations

import os
from typing import Any

from .model_catalog import MODALITY_CATEGORIES

#: 模态用途的字符串值集合(与 model_catalog.MODALITY_CATEGORIES 同源,禁另写一份)
_MODALITY_CATEGORY_VALUES = frozenset(c.value for c in MODALITY_CATEGORIES)

# 历史模型清单(2026-11-12 目录快照)。
# 保留:workbuddy/kimi-k2.8-preview、kimi-k3-1;glm-5.2、glm-5.3(+flash/5v-turbo);
#      deepseek-v4-flash/pro、v4.1-flash;minimax-m3、m3.1-flash;agnes-3.0-flash;
#      openrouter/liquid/lfm-3-1.7b;grok-4.6、4.7(及 4.20 变体,版本序不明确不砍)。
LEGACY_MODEL_IDS = frozenset(
    {
        # Kimi:2.5/2.6/2.7 与初代 thinking 均被 k2.8-preview、k3-1 取代
        "workbuddy/kimi-k2-thinking",
        "workbuddy/kimi-k2.5",
        "workbuddy/kimi-k2.6",
        "workbuddy/kimi-k2.7",
        # GLM:4.x 与 5.0/5.1 已被 5.2/5.3 取代(5.3-flash、5v-turbo 属当前代)
        "workbuddy/glm-4.6",
        "workbuddy/glm-4.6v",
        "workbuddy/glm-4.7",
        "workbuddy/glm-5.0",
        "workbuddy/glm-5.1",
        # DeepSeek:保留 v4 与 v4.1,v3-2 属上一代
        "workbuddy/deepseek-v3-2-volc",
        # DeepSeek 无版本号的老别名(2026-11-21 机主点名:这两个也都是历史模型):
        # 目录里没有 release_date、也没有同系列更高代次可比较,版本引擎判不出旧,
        # 但 `deepseek-chat` / `deepseek-flash` 就是 V3 代别名,`deepseek-ai/deepseek-r1*`
        # 是 R1 代蒸馏/原版。全部按显式清单摘除(选择器与模型目录同一份裁决)。
        "deepseek-chat",
        "deepseek-flash",
        "deepseek-ai/deepseek-r1",
        "deepseek-ai/deepseek-r1-0528-qwen3-8b",
        # MiniMax:m3/m3.1 已取代 m2.5
        "workbuddy/minimax-m2.5",
        # Agnes:3.0 已取代 2.5(图像/视频模型不走本清单,由 chat 能力过滤负责)
        "agnes/agnes-2.5-flash",
        "agnes/agnes-2.5-pro",
        # Liquid:lfm-3 已取代 lfm-2.5
        "openrouter/liquid/lfm-2.5-2.6b:free",
        # Grok:保留 4.6/4.7 与版本序不明的 4.20 变体,4.3/4.5 属旧代
        "grok-4.3",
        "grok-4.5",
        # Llama 3.3:上游已到 Llama 4,本地两家只挂了 3.3,属明确过时
        "ollama/llama3.3:70b",
        "lmstudio/llama-3.3-70b",
    }
)


def _hide_enabled() -> bool:
    return os.environ.get("MODEL_CATALOG_HIDE_LEGACY", "1").strip() not in {"0", "false", "False"}


def is_legacy_model(model_id: str) -> bool:
    return (model_id or "").strip() in LEGACY_MODEL_IDS


def filter_frontier(models: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """把历史模型从对外目录里摘掉。清单外的模型原样保留。"""
    if not _hide_enabled():
        return models
    return [m for m in models if not is_legacy_model(str(m.get("id") or ""))]


#: 选择器挡在门外的用途(2026-11-20 立,同日按机主要求收窄)。
#: 只挡"拣选/打分/审核/未归类"这类流水线中间件:它们不是另一种模态,选中后聊天产不出可读回复。
#: 图像(image)/视频(video)/语音(tts/asr)/视觉(vision)/OCR(ocr)一律**展示**。
#: 与 ``model_catalog.MIDDLEWARE_CATEGORIES`` 同口径(改动必须同笔对齐)。
_SELECTOR_EXCLUDED_CATEGORIES = frozenset({"embedding", "rerank", "guard", "other"})


def is_hidden_from_selector(model: dict[str, Any]) -> bool:
    """聊天模型选择器是否不展示该模型(2026-11-20 机主定档:取消「历史模型」折叠区)。

    三条并集(任何一条成立即隐藏,不是折叠):
      1. 命中 ``LEGACY_MODEL_IDS`` —— 与 ``/llm/models`` 出口同一份清单裁决;
      2. ``model_tier == "legacy"`` —— 版本比较判旧的(如 gpt-4o 对 gpt-5.6),
         清单没收但确实旧一代的也一并藏掉;
      3. 用途落在 ``_SELECTOR_EXCLUDED_CATEGORIES`` —— 嵌入/重排/审核这类中间件
         不进聊天选择器;图像/视频/语音等**照常展示**(机主 2026-11-20 追加要求)。

    刻意**不改** ``/llm/models`` 目录本身:模型市场、Agent 创建器、图像/视频工具要按用途
    看全量目录,只在"选择器"这一消费面收窄。``MODEL_CATALOG_HIDE_LEGACY=0`` 时整体恢复
    (排障档,与 ``filter_frontier`` 共用开关语义)。
    """
    if not _hide_enabled():
        return False
    if is_legacy_model(str(model.get("id") or "")):
        return True
    if str(model.get("model_tier") or "") == "legacy":
        return True
    return str(model.get("category") or "chat") in _SELECTOR_EXCLUDED_CATEGORIES


def restore_modality_entries(
    originals: list[dict[str, Any]],
    kept: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """把被"chat 探针"误杀的模态档补回(2026-11-21 立,纯判据,无 IO)。

    病灶:``model_health.filter_available`` 的探针打的是 chat completion,对
    image/video/tts/asr/ocr 模型必然失败,于是把模态档整批判死 —— 生产实测
    ``/llm/models`` 只剩 21 条全 chat,image/video/vision 一条不剩,选择器里
    自然看不到它们。"能不能产出"对媒体模型该由生成通道裁决(POST /image-gen
    对未接通模型回 400 并给可用清单),不该由 chat 探针代判。

    只补**被摘掉的**模态条目(``kept`` 里已有 id 一律不动),因此重复调用幂等;
    非模态条目与"探针判死"的聊天模型行为逐字不变。
    """
    kept_ids = {str(m.get("id") or "") for m in kept}
    restored = list(kept)
    for m in originals:
        mid = str(m.get("id") or "")
        if not mid or mid in kept_ids:
            continue
        if str(m.get("category") or "chat") in _MODALITY_CATEGORY_VALUES:
            restored.append(m)
    return restored
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
