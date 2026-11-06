"""预算硬停止原因的封闭集(与 packages/shared/src/sse/contract.ts 逐字一致)。

设计口径(批次 3:预算与上下文账本):
- 网关/前端/BI 只认这 6 个码,不再消费 free-text reason。历史 reason 是给人看的中文/英文
  散文(如 "daily token limit exceeded"),跨端对账时无法穷举 ⇒ 归一化在这里一次性完成,
  不让每个消费方各写一份字符串匹配。
- 归一化**不猜**:能取到实际判据(各维占比)时按判据定码;只有确实拿不到判据时才回落到
  `daily_token_limit`。回落分支不是"瞎猜",而是当前 governor 的唯一可达硬停分支
  (见 `reason_code_for_usage` 注释:check_budget 的硬停判据只由日 token / 日成本 / 小时
  token 三维构成,且 token 维是默认配置项),不会返回 None 让调用方静默丢失。
"""

from __future__ import annotations

# 与 contract.ts: BUDGET_STOP_REASON_CODES 逐字一致(顺序也一致,BI 侧按顺序渲染)。
BUDGET_STOP_REASON_CODES: tuple[str, ...] = (
    "daily_token_limit",
    "daily_cost_limit",
    "hourly_token_limit",
    "pillar_token_limit",
    "request_token_limit",
    "provider_budget_exhausted",
)

# scope 封闭集(与 contract.ts: BudgetStopScope 一致)。
BUDGET_STOP_SCOPES: tuple[str, ...] = ("daily", "hourly", "pillar", "request", "provider")

# free-text → 封闭集码的关键词表。顺序即优先级:更具体的维度放前面,
# 避免 "hourly token limit" 被 "daily" 类宽词先吃掉。
_REASON_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("hourly_token_limit", ("hourly", "per_hour", "每小时", "小时")),
    ("daily_cost_limit", ("cost", "usd", "dollar", "成本", "美元", "费用")),
    ("pillar_token_limit", ("pillar", "支柱")),
    ("request_token_limit", ("request", "单请求", "单次请求", "本次请求")),
    ("provider_budget_exhausted", ("provider", "供应商", "上游", "账户额度")),
    ("daily_token_limit", ("daily", "每日", "当日", "今日", "天")),
)


def normalize_budget_reason(reason: str | None) -> str:
    """把 free-text 停止原因归一为封闭集码。

    Args:
        reason: governor 抛出的 BudgetExceededError 文案,或空/None。

    Returns:
        封闭集内的码。无法从文案识别维度时返回 `daily_token_limit` —— 这是
        `BudgetConfig` 唯一的默认硬停维度(`check_budget` 的日 token 判据),
        也是"配置里没有任何自定义阈值"时唯一可能踩到的线,故回落有据可依,
        不是随机挑一个。
    """
    text = (reason or "").strip().lower()
    if not text:
        return "daily_token_limit"
    for code, keywords in _REASON_KEYWORDS:
        if any(k in text for k in keywords):
            return code
    # 文案既非空又不含任何维度关键词(例如上游自定义异常文案):仍然只能是
    # 日 token 维,因为其余维度要么由别的通道(gateway 限额/provider 配额)单独
    # 报码,要么当前 governor 不参与硬停判定。
    return "daily_token_limit"


def scope_for_budget_reason(code: str) -> str:
    """reason code → scope(封闭集)。未知码不抛错,沿用日维(与归一化回落同一口径)。"""
    return {
        "hourly_token_limit": "hourly",
        "pillar_token_limit": "pillar",
        "request_token_limit": "request",
        "provider_budget_exhausted": "provider",
    }.get(code, "daily")


def reason_code_for_usage(
    *,
    reason: str | None = None,
    daily_token_percent: float = 0.0,
    daily_cost_percent: float = 0.0,
    hourly_token_percent: float = 0.0,
    provider_exhausted: bool = False,
) -> tuple[str, str]:
    """按**实际判据**给出 (reason_code, scope)。

    优先级:
    1. 上游 provider 配额耗尽(网关/provider 通道明确报出)⇒ provider_budget_exhausted。
    2. 日 token / 日成本 / 小时 token 三维中达到硬停线且占比最高者 ⇒ 对应码。
       三维都是 `check_budget` 的真实硬停输入(`usage_percent` 取三者最大值);
       `pillar` 维当前只进用量快照、不参与硬停,故不在此判定(它的码由 free-text
       归一化保留,供未来支柱级硬启用时使用)。
    3. 都未过线(理论上不会在 hard_stop 分支被调用)或取不到判据 ⇒ 用 free-text 归一化。

    注意:第 2 步用 `> = 1.0` 作为硬停线,与 governor 的 `hard_stop_at` 默认值一致;
    采用"占比最高"而非"第一个过线"是为了让同时踩两线时报告更严重的那一维。
    """
    if provider_exhausted:
        return "provider_budget_exhausted", "provider"

    candidates: list[tuple[float, str, str]] = [
        (float(daily_token_percent or 0.0), "daily_token_limit", "daily"),
        (float(daily_cost_percent or 0.0), "daily_cost_limit", "daily"),
        (float(hourly_token_percent or 0.0), "hourly_token_limit", "hourly"),
    ]
    stopped = [c for c in candidates if c[0] >= 1.0]
    if stopped:
        # 占比最高者;并列时保留候选顺序(daily token 优先,它是主判据)。
        best = max(stopped, key=lambda item: item[0])
        return best[1], best[2]

    code = normalize_budget_reason(reason)
    return code, scope_for_budget_reason(code)
