"""Token 计费服务测试."""

import pytest

from app.services.token_service import (
    OP_COMMISSION,
    OP_DEDUCT,
    OP_EXPIRE,
    OP_RECHARGE,
    OP_REFUND,
)


class TestOpConstants:
    def test_op_enum_values(self):
        """确保 5 类操作的 op_type 编号未变动（流水审计依赖）."""
        assert OP_RECHARGE == 0
        assert OP_DEDUCT == 1
        assert OP_EXPIRE == 2
        assert OP_REFUND == 3
        assert OP_COMMISSION == 4


class TestCheck:
    def test_check_user_token_returns_dict(self):
        """返回结构稳定."""
        from app.services.token_service import check_user_token

        result = check_user_token("nonexistent-user-uuid", min_tokens=0)
        assert "sufficient" in result
        assert "current_balance" in result
        assert "reason" in result
