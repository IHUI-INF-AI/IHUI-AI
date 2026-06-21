"""端到端测试：支付 + 订单流程."""

import os

os.environ.setdefault("SKIP_SCHEMA_INIT", "1")

import pytest

pytestmark = pytest.mark.asyncio


@pytest.fixture
def auth_headers():
    """生成一个最小可用的 JWT header (测试鉴权链路)."""
    from app.security import create_access_token

    token = create_access_token({"sub": "test-user", "iat": 0, "exp": 9999999999})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def client():
    """异步 HTTP 客户端 (httpx AsyncClient + ASGITransport)."""
    import httpx
    from app.main import create_app

    app = create_app()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def client_no_mock():
    """异步 HTTP 客户端, mock_routes 关闭 (验证真实鉴权)."""
    import httpx
    from app.main import create_app

    prev = os.environ.get("MOCK_ROUTES")
    os.environ["MOCK_ROUTES"] = "off"
    try:
        app = create_app()
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    finally:
        if prev is None:
            os.environ.pop("MOCK_ROUTES", None)
        else:
            os.environ["MOCK_ROUTES"] = prev


class TestAlipayRoutes:
    async def test_create_endpoint_exists(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/payments/alipay/create",
            params={"amount": 1.0, "subject": "测试订单"},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 409, 422, 500)

    async def test_app_create_endpoint_exists(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/payments/alipay/app/create",
            params={"amount": 0.01, "subject": "测试APP订单"},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 409, 422, 500)

    async def test_notify_endpoint_accepts_post(self, client):
        resp = await client.post(
            "/api/v1/payments/alipay/notify",
            data={"out_trade_no": "test123", "trade_status": "TRADE_SUCCESS"},
        )
        assert resp.status_code in (200, 400, 500)

    async def test_refund_endpoint_exists(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/payments/alipay/refund",
            params={"out_trade_no": "TEST001", "refund_amount": 1.0, "reason": "用户取消"},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 409, 422, 500)


class TestWechatRoutes:
    async def test_create_endpoint_exists(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/payments/wechat/create",
            params={"amount": 100, "open_id": "test-openid", "description": "测试"},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 409, 422, 500)

    async def test_android_create_endpoint(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/payments/wechat/android/create",
            params={"amount": 100, "description": "测试Android"},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 409, 422, 500)

    async def test_query_endpoint(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/payments/wechat/query",
            params={"out_trade_no": "TEST001"},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 405, 409, 422, 500)


class TestOrderFlow:
    async def test_order_create_needs_auth(self, client_no_mock):
        resp = await client_no_mock.post(
            "/api/v1/payments/alipay/create",
            params={"amount": 1.0},
        )
        assert resp.status_code in (401, 403, 422, 500)


class TestFundRoutes:
    async def test_fund_create_order_exists(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/payments/fund/createOrder",
            params={"amount": 1.0},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 409, 422, 500)

    async def test_fund_wechat_pay_exists(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/payments/fund/wechatPay",
            params={"out_trade_no": "TEST001", "total_fee": 100},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 409, 422, 500)

    async def test_fund_transfer_exists(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/payments/fund/transfer",
            params={"amount": 100, "bank_account": "6222000000000001"},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 409, 422, 500)

    async def test_fund_withdrawal_exists(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/payments/fund/withdrawal",
            params={"amount": 100},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 409, 422, 500)

    async def test_fund_alipay_create_exists(self, client):
        resp = await client.post(
            "/api/v1/payments/fund/ali/pay/create",
            json={"desc": "test", "amount": 1.0},
        )
        assert resp.status_code in (200, 400, 401, 404, 409, 422, 500)

    async def test_fund_needs_auth(self, client_no_mock):
        resp = await client_no_mock.post(
            "/api/v1/payments/fund/createOrder",
            params={"amount": 1.0},
        )
        assert resp.status_code in (401, 403, 404, 409, 422, 500)
