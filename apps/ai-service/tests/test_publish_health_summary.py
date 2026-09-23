# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""账号健康度/风险批量端点测试(2026-09-23 IP 封禁事故根治)。

覆盖:
- account_state 阈值分档(含 7 天/14 天两个边界,以及两套档位在同一时刻的既有分歧)
- `/accounts/health-summary` 与两个单账号端点**口径一致**(共用推导,不是复制实现)
- 静态路由必须声明在 `/accounts/{user_id}` 之前(否则被路径参数劫持,同 batch_template 事故)
- 空账号 / 从未验证账号的降级形态
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.routers import publish as publish_mod
from app.services.publish import account_groups as groups_mod
from app.services.publish.account_state import (
    COOKIE_VALIDITY_DAYS,
    HEALTHY_WINDOW_DAYS,
    NEVER_VERIFIED_DAYS,
    cookie_health_level,
    cookie_health_payload,
    days_since_verified,
    days_until_expiry,
    risk_cookie_status,
)

NOW = datetime(2026, 9, 23, 12, 0, 0, tzinfo=UTC)


def _ago(days: float) -> datetime:
    return NOW - timedelta(days=days)


# =============================================================================
# account_state:阈值口径
# =============================================================================


class TestAccountStateThresholds:
    def test_never_verified_uses_sentinel_days(self) -> None:
        assert days_since_verified(None, NOW) == NEVER_VERIFIED_DAYS
        assert cookie_health_level(NEVER_VERIFIED_DAYS) == "expired"

    @pytest.mark.parametrize(
        ("days", "expected"),
        [
            (0, "healthy"),
            (HEALTHY_WINDOW_DAYS, "healthy"),  # 整 7 天仍算 healthy(<=)
            (7.1, "expiring"),
            (COOKIE_VALIDITY_DAYS, "expiring"),  # 整 14 天仍算 expiring(<=)
            (14.1, "expired"),
        ],
    )
    def test_cookie_health_level_bands(self, days: float, expected: str) -> None:
        assert cookie_health_level(days_since_verified(_ago(days), NOW)) == expected

    @pytest.mark.parametrize(
        # days = 距上次验证多少天;风险侧档位看的是"距 14 天过期还剩多少天"
        ("days", "expected"),
        [
            (0, "healthy"),  # 还剩 14 天
            (6.9, "healthy"),  # 还剩 7.1 天
            (HEALTHY_WINDOW_DAYS, "expiring_soon"),  # 剩整 7 天(<=)
            (7.1, "expiring_soon"),  # 剩 6.9 天
            (15, "expired"),  # 已过阈值
        ],
    )
    def test_risk_cookie_status_bands(self, days: float, expected: str) -> None:
        until = days_until_expiry(_ago(days), NOW.timestamp())
        assert risk_cookie_status(until) == expected

    def test_two_bands_deliberately_disagree_at_exactly_7_days(self) -> None:
        """整 7 天时徽章说 healthy、风险因子说 expiring_soon —— 这是两端点既有行为。

        本断言钉住"不做顺手统一"的决定:统一会静默改变线上风险评分。
        """
        lv = _ago(7)
        assert cookie_health_level(days_since_verified(lv, NOW)) == "healthy"
        assert risk_cookie_status(days_until_expiry(lv, NOW.timestamp())) == "expiring_soon"

    def test_cookie_health_payload_never_verified(self) -> None:
        payload = cookie_health_payload(1, "juejin", "active", None, None, NOW)
        assert payload["level"] == "expired"
        assert payload["days_since_verified"] is None
        assert payload["last_verified_at"] is None
        assert payload["predicted_expiry"] is None

    def test_cookie_health_payload_predicted_expiry_is_last_verified_plus_14d(self) -> None:
        lv = _ago(3)
        payload = cookie_health_payload(7, "csdn", "active", lv, "ok", NOW)
        assert payload["level"] == "healthy"
        assert payload["days_since_verified"] == pytest.approx(3.0, abs=0.1)
        assert payload["predicted_expiry"] == (
            lv + timedelta(days=COOKIE_VALIDITY_DAYS)
        ).isoformat()


# =============================================================================
# 批量端点
# =============================================================================


def _rows(*accounts: tuple[int, str, datetime | None]) -> list[dict[str, Any]]:
    return [
        {
            "id": aid,
            "platform": platform,
            "status": "active",
            "last_verified_at": lv,
            "last_verify_msg": "ok" if lv else None,
        }
        for aid, platform, lv in accounts
    ]


class _RecordingScorer:
    """记录每次评分收到的 cookie_health,用于断言批量与单账号喂进去的东西一致。"""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def calculate_risk_score(
        self,
        account_id: str,
        platform: str,
        publish_history: Any = None,
        cookie_health: Any = None,
    ) -> MagicMock:
        self.calls.append({"account_id": account_id, "cookie_health": cookie_health})
        result = MagicMock()
        result.score = 42
        result.level = "low"
        result.factors = ["cookie"]
        result.cooldown_until = None
        return result


def _conn_for(rows: list[dict[str, Any]], single: dict[str, Any] | None = None) -> AsyncMock:
    conn = AsyncMock()
    conn.fetch.return_value = rows
    conn.fetchrow.return_value = single
    return conn


class TestAccountsHealthSummary:
    @pytest.mark.asyncio
    async def test_empty_accounts_returns_empty_items(self) -> None:
        request = MagicMock()
        request.state.user_id = "u1"
        with patch.object(publish_mod, "_get_conn", AsyncMock(return_value=_conn_for([]))):
            result = await publish_mod.accounts_health_summary(request)
        assert result["code"] == 0
        assert result["data"] == {"items": [], "count": 0}

    @pytest.mark.asyncio
    async def test_one_request_covers_every_account(self) -> None:
        """20 个账号只需 1 次查询、20 次评分,而不是 40 次 HTTP 往返。"""
        request = MagicMock()
        request.state.user_id = "u1"
        rows = _rows(*[(i, "juejin", _ago(i)) for i in range(1, 21)])
        conn = _conn_for(rows)
        scorer = _RecordingScorer()
        with patch.object(publish_mod, "_get_conn", AsyncMock(return_value=conn)), patch(
            "app.services.publish.anti_risk.risk_scoring.get_instance", return_value=scorer
        ):
            result = await publish_mod.accounts_health_summary(request)
        data = result["data"]
        assert data["count"] == 20
        assert len(data["items"]) == 20
        assert conn.fetch.await_count == 1
        assert len(scorer.calls) == 20
        assert {c["account_id"] for c in scorer.calls} == {str(i) for i in range(1, 21)}

    @pytest.mark.asyncio
    async def test_cookie_health_matches_single_endpoint_exactly(self) -> None:
        """批量端点的 cookieHealth 必须与单账号端点逐字段相同 —— 两者共用同一函数。"""
        request = MagicMock()
        request.state.user_id = "u1"
        lv = _ago(9)  # expiring 档
        row = {
            "id": 17,
            "platform": "juejin",
            "status": "active",
            "last_verified_at": lv,
            "last_verify_msg": "ok",
        }
        single = _conn_for([], single=row)
        batch = _conn_for([row])
        scorer = _RecordingScorer()
        with patch(
            "app.services.publish.anti_risk.risk_scoring.get_instance", return_value=scorer
        ):
            with patch.object(groups_mod, "_get_conn", AsyncMock(return_value=single)):
                one = await groups_mod.get_cookie_health(17, request)
            with patch.object(publish_mod, "_get_conn", AsyncMock(return_value=batch)):
                many = await publish_mod.accounts_health_summary(request)
        assert many["data"]["items"][0]["cookieHealth"] == one["data"]

    @pytest.mark.asyncio
    async def test_risk_feeds_scorer_same_cookie_health_as_single_endpoint(self) -> None:
        """风险评分收到的 cookie_health 入参,批量与单账号必须一致。"""
        request = MagicMock()
        request.state.user_id = "u1"
        lv = _ago(20)  # 已过期
        row = {
            "id": 21,
            "platform": "juejin",
            "status": "active",
            "last_verified_at": lv,
            "last_verify_msg": "ok",
            "display_name": "n",
            # 单账号 risk 端点会校验归属,缺这个字段直接 KeyError
            "user_id": "u1",
        }
        single = _conn_for([], single=row)
        batch = _conn_for([row])

        one_scorer = _RecordingScorer()
        batch_scorer = _RecordingScorer()
        with patch.object(publish_mod, "_get_conn", AsyncMock(return_value=single)), patch(
            "app.services.publish.anti_risk.risk_scoring.get_instance",
            return_value=one_scorer,
        ):
            await publish_mod.get_account_risk(21, request)
        with patch.object(publish_mod, "_get_conn", AsyncMock(return_value=batch)), patch(
            "app.services.publish.anti_risk.risk_scoring.get_instance",
            return_value=batch_scorer,
        ):
            await publish_mod.accounts_health_summary(request)

        assert one_scorer.calls[0]["cookie_health"] == batch_scorer.calls[0]["cookie_health"]
        assert one_scorer.calls[0]["cookie_health"]["status"] == "expired"

    @pytest.mark.asyncio
    async def test_never_verified_account_degrades_without_keyerror(self) -> None:
        request = MagicMock()
        request.state.user_id = "u1"
        rows = _rows((5, "juejin", None))
        scorer = _RecordingScorer()
        with patch.object(publish_mod, "_get_conn", AsyncMock(return_value=_conn_for(rows))), patch(
            "app.services.publish.anti_risk.risk_scoring.get_instance", return_value=scorer
        ):
            result = await publish_mod.accounts_health_summary(request)
        item = result["data"]["items"][0]
        assert item["cookieHealth"]["level"] == "expired"
        assert item["cookieHealth"]["predicted_expiry"] is None
        # 从未验证 → 风险评分不参与 cookie 因子(沿用既有行为)
        assert scorer.calls[0]["cookie_health"] is None


# =============================================================================
# 路由注册顺序
# =============================================================================


class TestRouteOrdering:
    """FastAPI 按声明顺序匹配:`/accounts/health-summary` 若排在 `/accounts/{user_id}`
    之后会被当成 user_id 劫持,永远返回 list_accounts 的形状。batch_template 踩过同一个坑。"""

    def _paths(self) -> list[str]:
        return [r.path for r in publish_mod.router.routes]

    def test_health_summary_declared_before_user_id_param_route(self) -> None:
        paths = self._paths()
        assert "/publish/accounts/health-summary" in paths
        assert paths.index("/publish/accounts/health-summary") < paths.index(
            "/publish/accounts/{user_id}"
        )

    def test_batch_template_still_before_user_id_param_route(self) -> None:
        paths = self._paths()
        assert paths.index("/publish/accounts/batch-template") < paths.index(
            "/publish/accounts/{user_id}"
        )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
