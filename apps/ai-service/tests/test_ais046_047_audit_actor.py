# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""AIS-046 / AIS-047 夹具(两条「部分」的当场可修半边)。

AIS-046: `/api/audit/recent` 成功码必须为 0，与 `/api/audit/logs`(audit.py:45) 及全站约定一致。
         旧码写 200 ⇒ 按 code===0 判成功的前端把"查到了"误判成失败。旧码红。
AIS-047: 审计中间件必须把 `request.state.user_id` 传给 `log_agent_action`。
         旧码固定 agent_id="system" 且不传 user_id ⇒ 事后无法定位改动主体。旧码红。
"""

from __future__ import annotations

import sys
import time
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
import jwt as pyjwt  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from starlette.responses import Response  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.middleware.audit import AuditMiddleware  # noqa: E402
from app.services.audit_service import audit_service  # noqa: E402

TEST_SECRET = "ais046-audit-code-secret"


def _admin_token() -> str:
    now = int(time.time())
    payload = {
        "userId": "u-admin-1",
        "roleId": 1,
        "iat": now,
        "exp": now + 3600,
        "iss": "ihui-ai",
        "aud": "ihui-ai-users",
        "type": "access",
    }
    return pyjwt.encode(payload, TEST_SECRET, algorithm="HS256")


def test_audit_recent_success_code_is_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    """AIS-046:成功码 200 → 0。旧码返回 200,断言红。"""
    monkeypatch.setattr(settings, "jwt_secret", TEST_SECRET)
    monkeypatch.setattr(settings, "jwt_issuer", "ihui-ai")

    from app.main import create_app

    client = TestClient(create_app())
    resp = client.get(
        "/api/audit/recent", headers={"Authorization": f"Bearer {_admin_token()}"}
    )

    assert resp.status_code == 200
    assert resp.json()["code"] == 0


class _FakeRequest:
    """只承载审计中间件用到的字段;state 模拟 JWT 中间件已验证的主体。"""

    method = "POST"
    url = SimpleNamespace(path="/api/hooks/x")
    headers: dict[str, str] = {}
    client = SimpleNamespace(host="127.0.0.1")
    state = SimpleNamespace(user_id="u-me")


async def test_audit_middleware_records_actor_user_id(monkeypatch: pytest.MonkeyPatch) -> None:
    """AIS-047:落库主体必须来自 request.state.user_id;旧码不传 ⇒ None,断言红。"""
    captured: dict = {}

    def _capture(**kwargs: object) -> None:
        captured.update(kwargs)

    monkeypatch.setattr(audit_service, "log_agent_action", _capture)

    async def _call_next(_request: object) -> Response:
        return Response(status_code=201)

    middleware = AuditMiddleware(app=None)  # type: ignore[arg-type]
    await middleware.dispatch(_FakeRequest(), _call_next)  # type: ignore[arg-type]

    assert captured.get("user_id") == "u-me"
    assert captured.get("agent_id") == "system"
    assert captured.get("trace_id") is None
