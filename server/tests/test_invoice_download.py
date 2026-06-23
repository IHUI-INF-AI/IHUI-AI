import os

os.environ.setdefault('SKIP_SCHEMA_INIT', '1')

import pytest

pytestmark = pytest.mark.asyncio


@pytest.fixture
def auth_headers():
    from app.security import create_access_token

    # #101: subject 必须是字符串 (jose 解码 sub 为字典的 token 会失败),
    # 原 _uid() 允许 guest 绕过了 token 无效问题, 改为 require_login 后需有效 token
    token = create_access_token('test-user', extra_claims={'role': 'admin'})
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture
async def client():
    from app.database import create_all_per_db

    import httpx
    from app.main import create_app

    app = create_app()
    create_all_per_db()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as ac:
        yield ac


async def test_download_invoice_accepts_get(client, auth_headers):
    prev = os.environ.get('MOCK_ROUTES')
    os.environ['MOCK_ROUTES'] = 'off'
    try:
        resp = await client.get(
            '/api/v1/payments/invoice/application/order/1',
            headers=auth_headers,
        )
        assert resp.status_code in (200, 404, 422, 500)
    finally:
        if prev is None:
            os.environ.pop('MOCK_ROUTES', None)
        else:
            os.environ['MOCK_ROUTES'] = prev


async def test_download_invoice_returns_pdf_for_issued_application(
    client, auth_headers, monkeypatch
):
    from unittest import mock

    application = mock.Mock(
        order_id=1,
        invoice_url='G:/IHUI-AI/server/tests/test_invoice_download.py',
    )
    order = mock.Mock(id=1, order_no='TEST001')

    def fake_get_session(factory=None):
        session = mock.MagicMock()
        session.__enter__ = mock.Mock(return_value=session)
        session.__exit__ = mock.Mock(return_value=False)
        session.query.side_effect = lambda model: (
            mock.Mock(filter=mock.Mock(return_value=mock.Mock(order_by=mock.Mock(return_value=mock.Mock(first=mock.Mock(return_value=application)))))) if model.__name__ == 'InvoiceApplication'
            else mock.Mock(first=mock.Mock(return_value=order))
        )
        session.commit = mock.Mock()
        session.flush = mock.Mock()
        return session

    monkeypatch.setattr('app.api.v1.payments.invoice.get_session', fake_get_session)

    import app.api.v1.payments.invoice as invoice_module
    invoice_module.get_session = fake_get_session

    prev = os.environ.get('MOCK_ROUTES')
    os.environ['MOCK_ROUTES'] = 'off'
    try:
        resp = await client.get(
            '/api/v1/payments/invoice/application/order/1',
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.headers.get('content-type') == 'application/pdf'
        assert 'attachment' in resp.headers.get('content-disposition', '').lower()
        assert '?票_TEST001.pdf' in resp.headers.get('content-disposition', '')
    finally:
        if prev is None:
            os.environ.pop('MOCK_ROUTES', None)
        else:
            os.environ['MOCK_ROUTES'] = prev

async def test_approve_rejects_unsafe_invoice_url(client, auth_headers):
    resp = await client.put(
        '/api/v1/payments/invoice/application/1/approve',
        params={'invoice_url': '/etc/passwd'},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert resp.headers.get("content-type") == "application/json"
    assert resp.json()["msg"] == "发票文件URL不安全"
    assert resp.headers.get("content-type") == "application/json"
    assert resp.json()["msg"] == "发票文件URL不安全"


async def test_issue_rejects_file_prefix_invoice_url(client, auth_headers):
    resp = await client.put(
        '/api/v1/payments/invoice/application/1/issue',
        params={'invoice_no': '111', 'invoice_url': 'file:///etc/passwd'},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert resp.headers.get("content-type") == "application/json"
    assert resp.json()["msg"] == "发票文件URL不安全"
