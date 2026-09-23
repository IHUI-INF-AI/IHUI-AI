# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Cookie 健康度与风险侧 Cookie 状态的阈值口径(单一真相源)。

原先这两套判定各自内联在两个端点里:
- `account_groups.get_cookie_health` —— 按「距上次验证多少天」分 healthy/expiring/expired
- `publish.get_account_risk`         —— 按「距 14 天过期还剩多少天」分 healthy/expiring_soon/expired

两者其实是同一件事的两种表述,但阈值散在两处,改一处就会让「健康度徽章」和
「风险评分里的 Cookie 因子」互相打脸。批量端点上线后会有第三个消费方,故收拢到本模块。

注意:两个函数的**分档边界并不完全相同**(整 7 天时前者仍算 healthy,后者算 expiring_soon),
这是两端点既有行为的差异,本模块按原样保留,不做"顺手统一" —— 统一会静默改变线上评分。
"""

from __future__ import annotations

from datetime import UTC, datetime

# Cookie 有效期阈值(天):超过即视为过期
COOKIE_VALIDITY_DAYS = 14
# 「健康」窗口(天):距上次验证不超过此天数
HEALTHY_WINDOW_DAYS = 7
# 从未验证时使用的哨兵天数(沿用 get_cookie_health 既有取值,勿改成 inf)
NEVER_VERIFIED_DAYS = 999.0


def days_since_verified(
    last_verified_at: datetime | None, now: datetime | None = None
) -> float:
    """距上次验证的天数;从未验证返回 NEVER_VERIFIED_DAYS。"""
    if not last_verified_at:
        return NEVER_VERIFIED_DAYS
    ref = now or datetime.now(UTC)
    return (ref - last_verified_at).total_seconds() / 86400


def cookie_health_level(days_since: float) -> str:
    """健康度徽章档位。"""
    if days_since <= HEALTHY_WINDOW_DAYS:
        return "healthy"
    if days_since <= COOKIE_VALIDITY_DAYS:
        return "expiring"
    return "expired"


def risk_cookie_status(days_until_expiry: float) -> str:
    """风险评分里 Cookie 因子的档位(注意边界与 cookie_health_level 不同,见模块 docstring)。"""
    if days_until_expiry <= 0:
        return "expired"
    if days_until_expiry <= HEALTHY_WINDOW_DAYS:
        return "expiring_soon"
    return "healthy"


def days_until_expiry(last_verified_at: datetime, now_ts: float) -> float:
    """距 14 天过期还剩多少天(可为负)。仅在 last_verified_at 存在时调用。"""
    return (last_verified_at.timestamp() + COOKIE_VALIDITY_DAYS * 86400 - now_ts) / 86400


def cookie_health_payload(
    account_id: int,
    platform: str,
    status: str | None,
    last_verified_at: datetime | None,
    last_verify_msg: str | None,
    now: datetime | None = None,
) -> dict[str, object]:
    """健康度徽章端点的响应体。

    单账号端点 `account_groups.get_cookie_health` 与批量端点
    `publish.accounts_health_summary` 共用本函数 —— 字段名与取值口径只有一处定义。
    """
    ref = now or datetime.now(UTC)
    since = days_since_verified(last_verified_at, ref)
    return {
        "account_id": account_id,
        "platform": platform,
        "level": cookie_health_level(since),
        "days_since_verified": round(since, 1) if last_verified_at else None,
        "last_verified_at": last_verified_at.isoformat() if last_verified_at else None,
        "predicted_expiry": (
            datetime.fromtimestamp(
                last_verified_at.timestamp() + COOKIE_VALIDITY_DAYS * 86400, tz=UTC
            ).isoformat()
            if last_verified_at
            else None
        ),
        "last_verify_msg": last_verify_msg,
        "status": status,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
