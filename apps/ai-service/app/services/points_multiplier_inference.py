# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""积分消耗倍数关键词推断:Python 侧解释器(2026-11-23 立)。

与 TS 侧 ``packages/shared/src/constants/points-multiplier-rules.ts`` 的
``inferPointsMultiplierFromRules`` 逐条对齐:规则数据来自同一份
``points-multiplier-rules.json`` 派生的 :mod:`points_multiplier_rules` 模块,
判定顺序、``containsAll`` / ``containsAny`` 匹配与关键词 exclusion 语义完全一致。

纯函数、零 IO、大小写不敏感、允许空串。跨语言一致性由共享语料
``points-multiplier-corpus.json`` 与 ai-service pytest 钉住;规则改动只改
JSON 源,再跑 ``node scripts/gen-points-multiplier-rules.mjs`` 重新派生两端数据。
"""

from __future__ import annotations

from .points_multiplier_rules import IHUI_MODEL_MAP, ORDERED_RULES, TIERS, RuleLayer


def _keyword_hits(layer: RuleLayer, keyword: str, mid: str) -> bool:
    """单个关键词是否命中;命中 exclusion 登记的排除词时该关键词不作数。"""
    if keyword not in mid:
        return False
    for registered_keyword, blocked_words in layer.exclusions:
        if registered_keyword != keyword:
            continue
        return not any(blocked in mid for blocked in blocked_words)
    return True


def _layer_matches(layer: RuleLayer, mid: str) -> bool:
    """一条规则层是否命中(containsAll 优先于 containsAny,与 TS 侧同序)。"""
    if layer.contains_all:
        return all(keyword in mid for keyword in layer.contains_all)
    if not layer.contains_any:
        return False
    return any(_keyword_hits(layer, keyword, mid) for keyword in layer.contains_any)


def infer_points_multiplier(model_id: str) -> float:
    """根据 model_id 推断积分消耗倍数(5+1 档梯度)。

    判定顺序(顺序敏感,与 TS 解释器逐字对齐):
      1. ``ihui/`` 显式映射(:data:`IHUI_MODEL_MAP`)优先;
      2. 免费(0x)→ 经济(1x)→ 旗舰(30x)→ 高级(10x)→ 标准(3x);
      3. 未命中任何规则层时返回默认档(:data:`TIERS["fallback"]`)。

    Args:
        model_id: 模型标识,大小写不敏感,允许传空字符串。

    Returns:
        积分消耗倍数(0.0 / 1.0 / 3.0 / 10.0 / 30.0,以及 ihui 映射里的
        6.0 / 15.0 / 18.0 等非阶梯值)。

    Examples:
        >>> infer_points_multiplier("claude-3-opus-20240229")
        30.0
        >>> infer_points_multiplier("gpt-4o-mini")
        1.0
        >>> infer_points_multiplier("deepseek-chat")
        3.0
        >>> infer_points_multiplier("deepseek-v4.1-flash")
        1.0
        >>> infer_points_multiplier("thinkingmachines/inkling")
        3.0
        >>> infer_points_multiplier("ollama/llama3")
        0.0
        >>> infer_points_multiplier("")
        1.0
    """
    mid = (model_id or "").lower()
    explicit = IHUI_MODEL_MAP.get(mid)
    if explicit is not None:
        return explicit
    for layer in ORDERED_RULES:
        if _layer_matches(layer, mid):
            return TIERS[layer.tier]
    return TIERS["fallback"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
