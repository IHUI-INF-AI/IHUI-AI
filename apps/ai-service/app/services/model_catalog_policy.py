# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

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
