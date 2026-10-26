# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""默认对话模型的**单一解析入口**(2026-10-26 立)。

为什么要这一层:
    2026-10-26 stepfun(阶跃星辰)订阅失效后排查发现,全仓有 **19 个文件**把
    `_DEFAULT_MODEL = "stepfun/step-3.7-flash"` 之类的字面量写死在模块里
    (ai_tutor / agent_graph / canvas_graph / ai_marking / pr_reviewer /
    news / news_scheduler / self_healing_llm …)。
    后果是:env 里的 COMBO_CHAINS / LITELLM_MODEL 改了也没用 —— 这些业务模块
    照旧把请求打给已经 400 的 provider,且**没有任何自动修复路径**:上游换了名、
    换了版本,只能人工去 19 个文件里逐个改字面量。

    这与机主"应该有自动获取上游最新模型的能力,自动获取自动更新替换"的诉求正相反。
    故收敛出一个解析函数:所有模块只声明"我要一个通用对话模型",具体是谁由
    运行期配置决定 —— 配置变了、上游模型被 model_sync 自动替换了,它们自动跟随。

解析优先级(靠前者胜):
    1. 调用方显式传入的 explicit(如模块自己的 env 覆盖 AGENT_SELF_HEALING_MODEL)
    2. settings.litellm_model(= LITELLM_MODEL,运维在主链路预设的档位)
    3. settings.litellm_fallback_model(= LITELLM_FALLBACK_MODEL)
    4. COMBO_CHAINS 里 maximize-free 链的首条腿
    5. 末位常量 _LAST_RESORT_CHAIN[0]

退役守卫:
    解析结果若命中 RETIRED_MODEL_PREFIXES(永久退役的 provider 前缀),
    直接判为不可用并继续往下找 —— 防止哪天有人把 LITELLM_MODEL 改回退役档。
"""

from __future__ import annotations

import json
import os
from typing import Any

# ---------------------------------------------------------------------------
# 永久退役的 provider 前缀(与 model_sync.RETIRED_PROVIDERS 同源语义)
# ---------------------------------------------------------------------------
# 2026-10-26:stepfun 订阅失效(余额 -0.09 CNY,chat 恒定 400)且机主明确不再续费。
RETIRED_MODEL_PREFIXES: tuple[str, ...] = ("stepfun/",)

# 末位兜底链(2026-10-26 实测直连 200 的两家;与 COMBO_CHAINS.maximize-free 同族同序)
_LAST_RESORT_CHAIN: tuple[str, ...] = (
    "agnes/agnes-2.5-flash",
    "agnes/agnes-2.0-flash",
    "pollinations/openai-fast",
)


def is_retired_model(model: str | None) -> bool:
    """模型 id 是否属于已永久退役的 provider。"""
    if not model:
        return False
    m = model.strip().lower()
    return any(m.startswith(p) for p in RETIRED_MODEL_PREFIXES)


def _combo_chain_head() -> str | None:
    """从 COMBO_CHAINS(环境变量 JSON)取 maximize-free 链的首条可用腿。

    直接读 os.environ 而不 import ComboRouter —— 本模块位于 app/core,
    引 services 层会形成循环导入。
    """
    raw = os.environ.get("COMBO_CHAINS") or os.environ.get("COMBBO_CHAINS")
    if not raw:
        return None
    try:
        data: Any = json.loads(raw)
    except (TypeError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    combo = data.get("maximize-free")
    if not isinstance(combo, dict):
        return None
    chain = combo.get("chain")
    if not isinstance(chain, list):
        return None
    for item in chain:
        if isinstance(item, str) and item.strip() and not is_retired_model(item):
            return item.strip()
    return None


def default_chat_model(explicit: str | None = None) -> str:
    """解析当前应当使用的通用对话模型。

    Args:
        explicit: 调用方自己的显式覆盖(如模块专用 env)。为 None / 空 / 退役档时
            继续往下找,**不会**把退役档直接返回。

    Returns:
        可直接传给 llm_gateway.complete() 的模型 id(带 provider 前缀)。
    """
    candidates: list[str] = []

    if explicit and explicit.strip():
        candidates.append(explicit.strip())

    # 延迟导入:settings 在 app.core.config,本模块也在 core,但避免 import 期耦合
    try:
        from .config import settings

        candidates.append(str(getattr(settings, "litellm_model", "") or ""))
        candidates.append(str(getattr(settings, "litellm_fallback_model", "") or ""))
    except Exception:  # noqa: BLE001 - 配置装载异常时退化到末位链,不得拖垮调用方
        pass

    head = _combo_chain_head()
    if head:
        candidates.append(head)
    candidates.extend(_LAST_RESORT_CHAIN)

    for c in candidates:
        if c and not is_retired_model(c):
            return c
    # 理论上不可达(_LAST_RESORT_CHAIN 一定非退役档),留作最后防线
    return _LAST_RESORT_CHAIN[0]


def default_chat_chain(explicit: str | None = None) -> list[str]:
    """解析默认模型**链**(首选 + 兜底),供需要 fallback 序列的调用方使用。"""
    primary = default_chat_model(explicit)
    chain: list[str] = [primary]
    head = _combo_chain_head()
    for item in (head, *_LAST_RESORT_CHAIN):
        if item and item not in chain and not is_retired_model(item):
            chain.append(item)
    return chain
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
