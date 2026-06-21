"""P15-B 业务模块加测: commission_service 纯函数.

目标: 覆盖 _calc_return_token / _calc_return_vip / _calc_return_trader /
      create_commission_flows 5 个核心函数的所有分支, 全部用 SimpleNamespace
      模拟 SQLAlchemy ORM 对象, 零 DB 依赖, 5-10ms 跑完.

设计原则: 复刻 P13-D 风格, 最小依赖, 单元级, 边界 + 负面路径 + 分支全覆盖.
"""

from types import SimpleNamespace

from app.services.commission_service import (
    _calc_return_token,
    _calc_return_trader,
    _calc_return_vip,
    create_commission_flows,
)

# ---------------------------------------------------------------------------
# TestCalcReturnToken: 普通用户 token 数量型佣金
# ---------------------------------------------------------------------------


class TestCalcReturnToken:
    """_calc_return_token(token_quantity, proportion) -> int.

    算法: token_quantity * token_proportion // 100 (整数除, 向下取整).
    """

    def test_none_proportion_returns_zero(self):
        assert _calc_return_token(1000, None) == 0

    def test_normal_calculation(self):
        """1000 tokens * 10% = 100 tokens."""
        prop = SimpleNamespace(token_proportion=10)
        assert _calc_return_token(1000, prop) == 100

    def test_zero_proportion_returns_zero(self):
        """比例 0% 时, 不管 token 多少都返 0."""
        prop = SimpleNamespace(token_proportion=0)
        assert _calc_return_token(9999, prop) == 0

    def test_integer_division_truncates(self):
        """整数除法向下取整: 1500 * 7 / 100 = 105 (不是 105.0)."""
        prop = SimpleNamespace(token_proportion=7)
        result = _calc_return_token(1500, prop)
        assert result == 105
        assert isinstance(result, int)


# ---------------------------------------------------------------------------
# TestCalcReturnVip: VIP/Trader 父级金额型佣金 (复杂分支)
# ---------------------------------------------------------------------------


class TestCalcReturnVip:
    """_calc_return_vip(order_amount, order_type, product_identity_id, is_trader, proportion).

    order_type 1=membership / 2=token / 3=activity / 4=identity
    is_trader=True 时走 trader_* 比率, 否则走普通 vip_/routine_ 比率.
    """

    def test_none_proportion_returns_zero(self):
        assert _calc_return_vip(10000, 1, "VIP", False, None) == 0

    def test_membership_normal_user(self):
        """order_type=1 + !is_trader → vip_proportion."""
        prop = SimpleNamespace(vip_proportion=5)
        # 10000 cents * 5% = 500
        assert _calc_return_vip(10000, 1, "VIP", False, prop) == 500

    def test_membership_trader(self):
        """order_type=1 + is_trader → trader_vip_proportion."""
        prop = SimpleNamespace(trader_vip_proportion=8)
        assert _calc_return_vip(10000, 1, "VIP", True, prop) == 800

    def test_token_order_normal_user(self):
        """order_type=2 + !is_trader → routine_proportion."""
        prop = SimpleNamespace(routine_proportion=3)
        assert _calc_return_vip(10000, 2, None, False, prop) == 300

    def test_activity_order_trader(self):
        """order_type=3 + is_trader → trader_routine_proportion."""
        prop = SimpleNamespace(trader_routine_proportion=6)
        assert _calc_return_vip(10000, 3, None, True, prop) == 600

    def test_identity_vip_product_normal(self):
        """order_type=4 + product_identity_id=VIP + !is_trader → vip_proportion."""
        prop = SimpleNamespace(vip_proportion=10)
        assert _calc_return_vip(10000, 4, "VIP", False, prop) == 1000

    def test_identity_operate_product_normal(self):
        """order_type=4 + product_identity_id=OPERATE + !is_trader → trader_proportion."""
        prop = SimpleNamespace(trader_proportion=12)
        assert _calc_return_vip(10000, 4, "OPERATE", False, prop) == 1200

    def test_identity_trader_product_trader(self):
        """order_type=4 + product_identity_id=TRADER + is_trader → trader_trader_proportion."""
        prop = SimpleNamespace(trader_trader_proportion=15)
        assert _calc_return_vip(10000, 4, "TRADER", True, prop) == 1500

    def test_identity_unknown_product_returns_zero(self):
        """order_type=4 + product_identity_id=BAD → 0 (Java 拒绝)."""
        prop = SimpleNamespace(vip_proportion=10, trader_proportion=10)
        assert _calc_return_vip(10000, 4, "UNKNOWN", False, prop) == 0

    def test_invalid_order_type_returns_zero(self):
        """order_type 不在 1-4 范围 → 0."""
        prop = SimpleNamespace(vip_proportion=10)
        assert _calc_return_vip(10000, 99, "VIP", False, prop) == 0


# ---------------------------------------------------------------------------
# TestCalcReturnTrader: 祖父级 (必须是 trader) 佣金
# ---------------------------------------------------------------------------


class TestCalcReturnTrader:
    """_calc_return_trader(order_amount, order_type, product_identity_id, proportion).

    祖父统一使用 grand_* 比率, 不分 is_trader.
    """

    def test_none_proportion_returns_zero(self):
        assert _calc_return_trader(10000, 1, "VIP", None) == 0

    def test_membership(self):
        """order_type=1 → grand_vip_proportion."""
        prop = SimpleNamespace(grand_vip_proportion=4)
        assert _calc_return_trader(10000, 1, "VIP", prop) == 400

    def test_token_order(self):
        """order_type=2 → grand_routine_proportion."""
        prop = SimpleNamespace(grand_routine_proportion=2)
        assert _calc_return_trader(10000, 2, None, prop) == 200

    def test_activity_order(self):
        """order_type=3 → grand_routine_proportion."""
        prop = SimpleNamespace(grand_routine_proportion=3)
        assert _calc_return_trader(10000, 3, None, prop) == 300

    def test_identity_vip_product(self):
        """order_type=4 + VIP → grand_vip_proportion."""
        prop = SimpleNamespace(grand_vip_proportion=5)
        assert _calc_return_trader(10000, 4, "VIP", prop) == 500

    def test_identity_operate_product(self):
        """order_type=4 + OPERATE → grand_trader_proportion."""
        prop = SimpleNamespace(grand_trader_proportion=7)
        assert _calc_return_trader(10000, 4, "OPERATE", prop) == 700

    def test_identity_unknown_product_returns_zero(self):
        """order_type=4 + BAD → 0."""
        prop = SimpleNamespace(grand_vip_proportion=10, grand_trader_proportion=10)
        assert _calc_return_trader(10000, 4, "BAD", prop) == 0

    def test_invalid_order_type_returns_zero(self):
        """order_type 不在 1-4 → 0."""
        prop = SimpleNamespace(grand_vip_proportion=10)
        assert _calc_return_trader(10000, 0, "VIP", prop) == 0


# ---------------------------------------------------------------------------
# TestCreateCommissionFlows: 完整组装 CommissionFlow 对象
# ---------------------------------------------------------------------------


class TestCreateCommissionFlows:
    """create_commission_flows(parent_users, user, order, proportion) -> list[CommissionFlow].

    - parent_users[0] = 父级 (必须有)
    - parent_users[1] = 祖父级 (可选, None 时只返 1 条 flow)
    - 父级是 normal user → type=0 (token 佣金)
    - 父级是 VIP/trader → type=1 (金额佣金)
    - 祖父级 (若有) → type=2 (金额佣金)
    """

    def _prop(
        self,
        token=0,
        vip=0,
        trader=0,
        trader_vip=0,
        routine=0,
        trader_routine=0,
        trader_trader=0,
        grand_vip=0,
        grand_routine=0,
        grand_trader=0,
    ):
        return SimpleNamespace(
            token_proportion=token,
            vip_proportion=vip,
            trader_proportion=trader,
            trader_vip_proportion=trader_vip,
            routine_proportion=routine,
            trader_routine_proportion=trader_routine,
            trader_trader_proportion=trader_trader,
            grand_vip_proportion=grand_vip,
            grand_routine_proportion=grand_routine,
            grand_trader_proportion=grand_trader,
        )

    def test_normal_user_parent_gets_token_commission(self):
        """父级 is_vip=0 → type=0 + token 佣金."""
        buyer = SimpleNamespace(uuid="u1", token_quantity=1000)
        order = SimpleNamespace(id=100, amount=10000, order_type=2, product_identity_id="")
        parent = SimpleNamespace(uuid="p1", is_vip=0, identity_type=0)

        flows = create_commission_flows([parent], buyer, order, self._prop(token=10))

        assert len(flows) == 1
        assert flows[0].type == 0
        assert flows[0].token == "100"  # 1000 * 10% = 100
        assert flows[0].belongers_open_id == "p1"
        assert flows[0].user_id == "u1"
        assert flows[0].order_id == "100"

    def test_vip_parent_gets_money_commission(self):
        """父级 is_vip=1 + identity_type=0 (非 trader) → type=1 + 金额."""
        buyer = SimpleNamespace(uuid="u1", token_quantity=0)
        order = SimpleNamespace(id=101, amount=10000, order_type=1, product_identity_id="VIP")
        parent = SimpleNamespace(uuid="p1", is_vip=1, identity_type=0)

        flows = create_commission_flows([parent], buyer, order, self._prop(vip=5))

        assert len(flows) == 1
        assert flows[0].type == 1
        assert flows[0].amount == 500  # 10000 * 5%
        assert flows[0].belongers_open_id == "p1"

    def test_trader_parent_gets_trader_ratio(self):
        """父级 is_vip=1 + identity_type=1 (trader) → trader_vip_proportion."""
        buyer = SimpleNamespace(uuid="u1", token_quantity=0)
        order = SimpleNamespace(id=102, amount=10000, order_type=1, product_identity_id="VIP")
        parent = SimpleNamespace(uuid="p1", is_vip=1, identity_type=1)

        flows = create_commission_flows([parent], buyer, order, self._prop(trader_vip=10))

        assert len(flows) == 1
        assert flows[0].type == 1
        assert flows[0].amount == 1000  # 10000 * 10%

    def test_no_grandparent_returns_one_flow(self):
        """父级链只有 1 人 (无祖父) → 返 1 条 flow."""
        buyer = SimpleNamespace(uuid="u1", token_quantity=1000)
        order = SimpleNamespace(id=103, amount=10000, order_type=2, product_identity_id="")
        parent = SimpleNamespace(uuid="p1", is_vip=0, identity_type=0)

        flows = create_commission_flows([parent], buyer, order, self._prop(token=5))

        assert len(flows) == 1
        assert flows[0].belongers_open_id == "p1"

    def test_with_grandparent_returns_two_flows(self):
        """父级 + 祖父级都在 → 返 2 条 flow (父 type=0/1, 祖父 type=2)."""
        buyer = SimpleNamespace(uuid="u1", token_quantity=1000)
        order = SimpleNamespace(id=104, amount=10000, order_type=1, product_identity_id="VIP")
        parent = SimpleNamespace(uuid="p1", is_vip=1, identity_type=0)
        grand = SimpleNamespace(uuid="g1", is_vip=1, identity_type=1)

        flows = create_commission_flows(
            [parent, grand],
            buyer,
            order,
            self._prop(vip=10, grand_vip=3),
        )

        assert len(flows) == 2
        # 父级: VIP → type=1 + 金额 10000 * 10% = 1000
        assert flows[0].type == 1
        assert flows[0].amount == 1000
        assert flows[0].belongers_open_id == "p1"
        # 祖父级: type=2 + 金额 10000 * 3% = 300
        assert flows[1].type == 2
        assert flows[1].amount == 300
        assert flows[1].belongers_open_id == "g1"

    def test_user_uses_id_fallback_when_no_uuid(self):
        """user 对象没 uuid 属性 → fallback 到 id."""
        buyer = SimpleNamespace(id="buyer-1")  # 无 uuid
        order = SimpleNamespace(id=105, amount=1000, order_type=2, product_identity_id="")
        parent = SimpleNamespace(uuid="p1", is_vip=0, identity_type=0)

        flows = create_commission_flows([parent], buyer, order, self._prop(token=50))

        assert len(flows) == 1
        assert flows[0].user_id == "buyer-1"
        assert flows[0].open_id == ""
