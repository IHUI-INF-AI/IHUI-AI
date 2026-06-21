"""P1-3 业务埋点 payment/order 测试."""
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def auth_override():
    """覆盖 require_login 依赖, 模拟已登录用户."""
    from app.main import app
    from app.security import require_login

    def _fake_user():
        return "u-test-100"

    app.dependency_overrides[require_login] = _fake_user
    yield "u-test-100"
    app.dependency_overrides.pop(require_login, None)


def test_create_alipay_tracks_order_and_payment(sync_client, auth_override):
    """创建支付宝订单应触发 EVENT_ORDER_CREATE + EVENT_PAYMENT_CREATE + funnel checkout/pay_submit."""
    with patch("app.api.v1.payments.alipay.track_event") as mock_evt, \
         patch("app.api.v1.payments.alipay.track_funnel") as mock_funnel, \
         patch("app.api.v1.payments.alipay.track_latency") as mock_lat, \
         patch("app.api.v1.payments.alipay.create_order",
               return_value={"success": True, "out_trade_no": "OT20260618-001"}), \
         patch("app.api.v1.payments.alipay.alipay.build_signed_url",
               return_value="https://example.com/pay"):
        r = sync_client.post(
            "/api/v1/payments/alipay/create?amount=99.5&subject=test"
        )
        assert r.status_code == 200, r.text
        events = [c.args[0] for c in mock_evt.call_args_list if c.args]
        assert "order_create" in events
        assert "payment_create" in events
        funnel_steps = [c.args[1] for c in mock_funnel.call_args_list if len(c.args) >= 2]
        assert "checkout_click" in funnel_steps
        assert "pay_submit" in funnel_steps
        assert mock_lat.call_count >= 1


def test_create_alipay_tracks_fail_on_create_order_error(sync_client, auth_override):
    """create_order 失败应触发 EVENT_PAYMENT_FAIL."""
    with patch("app.api.v1.payments.alipay.track_event") as mock_evt, \
         patch("app.api.v1.payments.alipay.create_order",
               return_value={"success": False, "msg": "订单创建失败"}):
        r = sync_client.post(
            "/api/v1/payments/alipay/create?amount=1.0"
        )
        assert r.status_code == 200, r.text
        events = [c.args[0] for c in mock_evt.call_args_list if c.args]
        assert "payment_fail" in events


def test_alipay_notify_tracks_payment_success(sync_client, auth_override):
    """alipay_notify 收到合法通知应触发 EVENT_PAYMENT_SUCCESS + funnel pay_success."""
    with patch("app.api.v1.payments.alipay.track_event") as mock_evt, \
         patch("app.api.v1.payments.alipay.track_funnel") as mock_funnel, \
         patch("app.api.v1.payments.alipay.alipay.verify_notify", return_value=True), \
         patch("app.api.v1.payments.alipay.update_order_status",
               return_value={"success": True}), \
         patch("app.services.commission_service.feedback_invite_by_order",
               return_value=None):
        r = sync_client.post(
            "/api/v1/payments/alipay/notify",
            data={
                "out_trade_no": "OT20260618-002",
                "trade_status": "TRADE_SUCCESS",
                "total_amount": "10.00",
                "trade_no": "ALIPAY-TRADE-001",
            },
        )
        assert r.status_code == 200, r.text
        events = [c.args[0] for c in mock_evt.call_args_list if c.args]
        assert "payment_success" in events
        funnel_steps = [c.args[1] for c in mock_funnel.call_args_list if len(c.args) >= 2]
        assert "pay_success" in funnel_steps
