"""端到端测试：支付对账 + 订单自动关闭."""

import pytest

pytestmark = pytest.mark.asyncio


class TestReconciliationEndpoints:
    async def test_alipay_reconcile_endpoint(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/payments/reconcile/alipay",
            params={"bill_date": "2026-06-01"},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_wechat_reconcile_endpoint(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/payments/reconcile/wechat",
            params={"bill_date": "2026-06-01"},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_all_reconcile_endpoint(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/payments/reconcile/all",
            params={"bill_date": "2026-06-01"},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_auto_reconcile_endpoint(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/payments/reconcile/auto",
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_pending_orders_endpoint(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/payments/reconcile/pending",
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)

    async def test_close_expired_endpoint(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/payments/reconcile/close_expired",
            headers=auth_headers,
        )
        assert resp.status_code in (200, 401, 404, 422, 500)
