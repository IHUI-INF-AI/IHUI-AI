"""状态机端点业务正确性测试.

验证第 10 轮新增的 14 个状态迁移端点:
- certificate/routes.py: 5 个 PUT 端点 (/{cid}/valid, /suspended, /revoked, /cancelled, /expired)
- invoice/routes.py: 5 个 PUT 端点 (/application/{aid}/approved, /rejected, /invoicing, /invoiced, /canceled)
- news/routes.py: 4 个端点 (POST/DELETE /{nid}/recommend, /top)

测试策略:
由于这些端点都遵循相同模式 (查询记录 → 设置 status/flag 字段 → 返回 success),
采用参数化测试 + TestClient 集成测试, 用 999999 作为不存在的 ID 验证 404 路径.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def _ensure_state_machine_tables():
    """在 SQLite 测试库上创建 certificate/invoice/news 表, 让 404 路径可被验证.

    conftest.py 默认 SKIP_SCHEMA_INIT=1, 不会自动建表; 这里显式建一次.
    建表失败不阻断测试, 路由注册测试仍可独立通过.
    """
    try:
        from app.database import Base, engine1
        from app.models.certificate_models import (
            Certificate,
            CertificateTemplate,
        )
        from app.models.invoice_models import InvoiceApplication, InvoiceTitle
        from app.models.news_models import Article, News

        tables = [
            Certificate.__table__,
            CertificateTemplate.__table__,
            InvoiceApplication.__table__,
            InvoiceTitle.__table__,
            News.__table__,
            Article.__table__,
        ]
        Base.metadata.create_all(engine1, tables=tables, checkfirst=True)
    except Exception:
        # 建表失败时 404 测试会给出明确报错, 路由注册测试不受影响
        pass
    yield


def _assert_not_found_code(payload: dict) -> None:
    """断言响应体 code 是 404 (兼容字符串和整数两种形式).

    error() 函数返回 str(code) = "404"; 兼容未来可能返回 int 404 的情况.
    """
    code = payload.get("code")
    assert code in ("404", 404), (
        f"期望 code=404 (记录不存在), 实际 code={code!r}, body={payload}"
    )


# ============ Certificate 状态机 (5 个状态) ============


@pytest.mark.parametrize(
    "endpoint,status_value",
    [
        ("/valid", "valid"),
        ("/suspended", "suspended"),
        ("/revoked", "revoked"),
        ("/cancelled", "cancelled"),
        ("/expired", "expired"),
    ],
)
def test_certificate_state_transitions(endpoint, status_value):
    """证书状态迁移端点: 不存在的 cid 应返回 code=404."""
    response = client.put(f"/api/v1/certificate/999999{endpoint}")
    assert response.status_code == 200, (
        f"HTTP 状态码异常: {response.status_code}, body={response.text}"
    )
    _assert_not_found_code(response.json())


# ============ Invoice 状态机 (5 个状态) ============


@pytest.mark.parametrize(
    "endpoint,expected_status",
    [
        ("/approved", 0),
        ("/rejected", 3),
        ("/invoicing", 1),
        ("/invoiced", 2),
        ("/canceled", 4),
    ],
)
def test_invoice_application_state_transitions(endpoint, expected_status):
    """发票申请状态迁移端点: 不存在的 aid 应返回 code=404."""
    response = client.put(f"/api/v1/invoice/application/999999{endpoint}")
    assert response.status_code == 200, (
        f"HTTP 状态码异常: {response.status_code}, body={response.text}"
    )
    _assert_not_found_code(response.json())


# ============ News 推荐/置顶 (4 个端点) ============


def test_news_recommend():
    """推荐资讯端点: 不存在的 nid 应返回 code=404."""
    response = client.post("/api/v1/news/999999/recommend")
    assert response.status_code == 200, (
        f"HTTP 状态码异常: {response.status_code}, body={response.text}"
    )
    _assert_not_found_code(response.json())


def test_news_unrecommend():
    """取消推荐端点: 不存在的 nid 应返回 code=404."""
    response = client.delete("/api/v1/news/999999/recommend")
    assert response.status_code == 200, (
        f"HTTP 状态码异常: {response.status_code}, body={response.text}"
    )
    _assert_not_found_code(response.json())


def test_news_top():
    """置顶资讯端点: 不存在的 nid 应返回 code=404."""
    response = client.post("/api/v1/news/999999/top")
    assert response.status_code == 200, (
        f"HTTP 状态码异常: {response.status_code}, body={response.text}"
    )
    _assert_not_found_code(response.json())


def test_news_untop():
    """取消置顶端点: 不存在的 nid 应返回 code=404."""
    response = client.delete("/api/v1/news/999999/top")
    assert response.status_code == 200, (
        f"HTTP 状态码异常: {response.status_code}, body={response.text}"
    )
    _assert_not_found_code(response.json())


# ============ 路由注册验证 (14 个端点) ============


def test_state_machine_routes_registered():
    """验证 14 个状态机端点都已注册到 app.routes."""
    routes = [getattr(r, "path", "") for r in app.routes]

    # certificate: 5 个 PUT 端点 /api/v1/certificate/{cid}/{state}
    for state in ("/valid", "/suspended", "/revoked", "/cancelled", "/expired"):
        expected = f"/api/v1/certificate/{{cid}}{state}"
        assert expected in routes, f"证书状态机端点未注册: {expected}"

    # invoice: 5 个 PUT 端点 /api/v1/invoice/application/{aid}/{state}
    for state in ("/approved", "/rejected", "/invoicing", "/invoiced", "/canceled"):
        expected = f"/api/v1/invoice/application/{{aid}}{state}"
        assert expected in routes, f"发票状态机端点未注册: {expected}"

    # news: POST/DELETE /api/v1/news/{nid}/recommend 和 /top
    for action in ("/recommend", "/top"):
        expected = f"/api/v1/news/{{nid}}{action}"
        assert expected in routes, f"资讯推荐/置顶端点未注册: {expected}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
