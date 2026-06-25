"""token_utils_service 单元测试 (Phase 14 加法启用).

覆盖业务核心模块 app/services/token_utils_service.py:
  - check_user_is_vip: VIP 等级判定 (4 分支)
  - check_user_token_sufficient: 余额充足性 (4 分支)
  - calculate_tokens_per_yuan: VIP/促销期/token 价格 (5 分支)
  - calculate_and_deduct_tokens_by_cost: 扣费 (success=False 不扣)
  - calculate_and_deduct_tokens_for_hunyuan3d: 固定 1.5 元
  - is_active_promotion_period: 异常路径

2026-06-25 修复: 同步函数去掉 await, mock 目标从 SessionFactory1/2 改为 get_session.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.services import token_utils_service as tu


def _mock_db(mock_get_session):
    """辅助: 从 patch get_session 取出上下文管理器内部的 mock db."""
    return mock_get_session.return_value.__enter__.return_value


# ---------------------------------------------------------------------------
# 1. check_user_is_vip (7 测试) — 同步函数
# ---------------------------------------------------------------------------


class TestCheckUserIsVip:
    def test_empty_uuid_returns_false(self):
        assert tu.check_user_is_vip("") is False

    def test_none_uuid_returns_false(self):
        assert tu.check_user_is_vip(None) is False

    def test_normal_user_returns_false(self):
        with patch.object(tu, "get_session") as mock_gs:
            mock_db = _mock_db(mock_gs)
            mock_user = mock_db.query.return_value.filter.return_value.first.return_value
            mock_user.is_vip = 0
            assert tu.check_user_is_vip("user-001") is False

    def test_vip_level_1_returns_true(self):
        with patch.object(tu, "get_session") as mock_gs:
            mock_db = _mock_db(mock_gs)
            mock_user = mock_db.query.return_value.filter.return_value.first.return_value
            mock_user.is_vip = 1
            assert tu.check_user_is_vip("user-002") is True

    def test_trader_level_2_returns_true(self):
        with patch.object(tu, "get_session") as mock_gs:
            mock_db = _mock_db(mock_gs)
            mock_user = mock_db.query.return_value.filter.return_value.first.return_value
            mock_user.is_vip = 2
            assert tu.check_user_is_vip("user-003") is True

    def test_user_not_found_returns_false(self):
        with patch.object(tu, "get_session") as mock_gs:
            mock_db = _mock_db(mock_gs)
            mock_db.query.return_value.filter.return_value.first.return_value = None
            assert tu.check_user_is_vip("ghost") is False

    def test_db_error_returns_false(self):
        with patch.object(tu, "get_session") as mock_gs:
            mock_gs.return_value.__enter__.return_value.query.side_effect = Exception("db down")
            assert tu.check_user_is_vip("user-err") is False


# ---------------------------------------------------------------------------
# 2. check_user_token_sufficient (4 测试) — 同步函数
# ---------------------------------------------------------------------------


class TestCheckUserTokenSufficient:
    def test_empty_uuid_returns_insufficient(self):
        r = tu.check_user_token_sufficient("", min_tokens=1)
        assert r["sufficient"] is False
        assert r["balance"] == 0
        assert r["user_uuid"] == ""

    def test_user_not_found_returns_insufficient(self):
        with patch.object(tu, "get_session") as mock_gs:
            mock_db = _mock_db(mock_gs)
            mock_db.query.return_value.filter.return_value.first.return_value = None
            r = tu.check_user_token_sufficient("ghost")
            assert r["sufficient"] is False
            assert r["balance"] == 0
            assert "user not found" in r["error"]

    def test_balance_meets_min_returns_sufficient(self):
        with patch.object(tu, "get_session") as mock_gs:
            mock_db = _mock_db(mock_gs)
            mock_margin = mock_db.query.return_value.filter.return_value.first.return_value
            mock_margin.token_quantity = 100
            r = tu.check_user_token_sufficient("user-001", min_tokens=10)
            assert r["sufficient"] is True
            assert r["balance"] == 100

    def test_balance_below_min_returns_insufficient(self):
        with patch.object(tu, "get_session") as mock_gs:
            mock_db = _mock_db(mock_gs)
            mock_margin = mock_db.query.return_value.filter.return_value.first.return_value
            mock_margin.token_quantity = 5
            r = tu.check_user_token_sufficient("user-002", min_tokens=10)
            assert r["sufficient"] is False
            assert r["balance"] == 5


# ---------------------------------------------------------------------------
# 3. calculate_tokens_per_yuan (6 测试) — 异步函数 (asyncio.to_thread 包装同步调用)
# ---------------------------------------------------------------------------


class TestCalculateTokensPerYuan:
    @pytest.mark.asyncio
    async def test_empty_uuid_returns_normal_rate(self):
        r = await tu.calculate_tokens_per_yuan("")
        assert r["user_vip_level"] == 0
        assert r["is_promotion_period"] is False
        assert r["tokens_per_yuan"] == tu.settings.TOKEN_NORMAL_USER_PER_YUAN

    @pytest.mark.asyncio
    async def test_user_not_found_returns_normal_rate(self):
        with patch.object(tu, "get_session") as mock_gs:
            mock_db = _mock_db(mock_gs)
            mock_db.query.return_value.filter.return_value.first.return_value = None
            with patch.object(tu, "is_active_promotion_period", return_value={"is_active": False}):
                r = await tu.calculate_tokens_per_yuan("ghost")
                assert r["reason"] == "user not found"
                assert r["tokens_per_yuan"] == tu.settings.TOKEN_NORMAL_USER_PER_YUAN

    @pytest.mark.asyncio
    async def test_normal_level_returns_normal_rate(self):
        with patch.object(tu, "get_session") as mock_gs:
            mock_db = _mock_db(mock_gs)
            mock_user = mock_db.query.return_value.filter.return_value.first.return_value
            mock_user.is_vip = 0
            with patch.object(tu, "is_active_promotion_period", return_value={"is_active": False}):
                r = await tu.calculate_tokens_per_yuan("user-001")
                assert r["tokens_per_yuan"] == tu.settings.TOKEN_NORMAL_USER_PER_YUAN
                assert "normal" in r["reason"]

    @pytest.mark.asyncio
    async def test_vip_level_1_returns_vip_rate(self):
        with patch.object(tu, "get_session") as mock_gs:
            mock_db = _mock_db(mock_gs)
            mock_user = mock_db.query.return_value.filter.return_value.first.return_value
            mock_user.is_vip = 1
            with patch.object(tu, "is_active_promotion_period", return_value={"is_active": False}):
                r = await tu.calculate_tokens_per_yuan("user-002")
                assert r["tokens_per_yuan"] == tu.settings.TOKEN_VIP_USER_PER_YUAN
                assert r["user_vip_level"] == 1

    @pytest.mark.asyncio
    async def test_trader_level_2_returns_trader_rate(self):
        with patch.object(tu, "get_session") as mock_gs:
            mock_db = _mock_db(mock_gs)
            mock_user = mock_db.query.return_value.filter.return_value.first.return_value
            mock_user.is_vip = 2
            with patch.object(tu, "is_active_promotion_period", return_value={"is_active": False}):
                r = await tu.calculate_tokens_per_yuan("user-003")
                assert r["tokens_per_yuan"] == tu.settings.TOKEN_TRADER_USER_PER_YUAN
                assert r["user_vip_level"] == 2

    @pytest.mark.asyncio
    async def test_promotion_overrides_vip(self):
        """促销期生效时, 不论 VIP 等级都用促销价."""
        with patch.object(tu, "get_session") as mock_gs:
            mock_db = _mock_db(mock_gs)
            mock_user = mock_db.query.return_value.filter.return_value.first.return_value
            mock_user.is_vip = 2
            with patch.object(tu, "is_active_promotion_period", return_value={"is_active": True}):
                r = await tu.calculate_tokens_per_yuan("user-003")
                assert r["tokens_per_yuan"] == tu.settings.TOKEN_PROMOTION_PER_YUAN
                assert r["is_promotion_period"] is True


# ---------------------------------------------------------------------------
# 4. calculate_and_deduct_tokens_by_cost (3 测试)
# ---------------------------------------------------------------------------


class TestCalculateAndDeductTokens:
    @pytest.mark.asyncio
    async def test_success_false_does_not_deduct(self):
        r = await tu.calculate_and_deduct_tokens_by_cost(
            user_uuid="user-001", yuan_cost=1.0, service_name="test", success=False
        )
        assert r["success"] is True
        assert r["tokens_deducted"] == 0
        assert "no deduction" in r["reason"]

    @pytest.mark.asyncio
    async def test_deduct_success_returns_balance(self):
        with patch.object(tu, "calculate_tokens_per_yuan", return_value={"tokens_per_yuan": 10}):
            with patch.object(tu, "deduct_user_token", return_value={"success": True, "balance": 95}):
                r = await tu.calculate_and_deduct_tokens_by_cost(
                    user_uuid="user-001", yuan_cost=2.0, service_name="svc"
                )
                assert r["success"] is True
                expected = round(10 * 2.0 * tu.settings.TOKEN_BASE_MULTIPLIER)
                assert r["tokens_deducted"] == expected
                assert r["balance"] == 95
                assert r["yuan_cost"] == 2.0

    @pytest.mark.asyncio
    async def test_deduct_failure_returns_reason(self):
        with patch.object(tu, "calculate_tokens_per_yuan", return_value={"tokens_per_yuan": 10}):
            with patch.object(tu, "deduct_user_token", return_value={"success": False, "reason": "insufficient"}):
                r = await tu.calculate_and_deduct_tokens_by_cost(
                    user_uuid="user-002", yuan_cost=1.0, service_name="svc"
                )
                assert r["success"] is False
                assert r["tokens_deducted"] == 0
                assert r["reason"] == "insufficient"


# ---------------------------------------------------------------------------
# 5. calculate_and_deduct_tokens_for_hunyuan3d (1 测试)
# ---------------------------------------------------------------------------


class TestCalculateAndDeductHunyuan3D:
    @pytest.mark.asyncio
    async def test_hunyuan_uses_fixed_1_5_yuan(self):
        """Hunyuan3D 固定 1.5 元, 验证 deduct_user_token 收到的 token 数."""
        with patch.object(tu, "calculate_tokens_per_yuan", return_value={"tokens_per_yuan": 10}):
            with patch.object(tu, "deduct_user_token", return_value={"success": True, "balance": 85}) as mock_deduct:
                r = await tu.calculate_and_deduct_tokens_for_hunyuan3d(user_uuid="user-h", success=True)
                assert r["success"] is True
                expected_tokens = round(10 * 1.5 * tu.settings.TOKEN_BASE_MULTIPLIER)
                assert mock_deduct.call_args.args[1] == expected_tokens


# ---------------------------------------------------------------------------
# 6. is_active_promotion_period (2 测试) — 同步函数
# ---------------------------------------------------------------------------


class TestIsActivePromotionPeriod:
    def test_no_active_promo_returns_false(self):
        with patch.object(tu, "get_session") as mock_gs:
            mock_db = _mock_db(mock_gs)
            chain = mock_db.query.return_value.filter.return_value.filter.return_value
            chain.order_by.return_value.first.return_value = None
            r = tu.is_active_promotion_period()
            assert r["is_active"] is False
            assert "error" not in r

    def test_db_error_returns_false_with_error_msg(self):
        with patch.object(tu, "get_session") as mock_gs:
            mock_gs.return_value.__enter__.return_value.query.side_effect = Exception("db boom")
            r = tu.is_active_promotion_period()
            assert r["is_active"] is False
            assert "db boom" in r["error"]
