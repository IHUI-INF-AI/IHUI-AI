# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-046 / AIS-047 夹具(两条「部分」的当场可修半边)。

AIS-046: `/api/audit/recent` 成功码必须为 0，与 `/api/audit/logs`(audit.py:45) 及全站约定一致。
         旧码写 200 ⇒ 按 code===0 判成功的前端把"查到了"误判成失败。旧码红。
AIS-047: 审计中间件必须把 `request.state.user_id` 传给 `log_agent_action`。
         旧码固定 agent_id="system" 且不传 user_id ⇒ 事后无法定位改动主体。旧码红。
AIS-047 落库半边: `_persist_entry` 的 INSERT 必须带 user_id 列 —— 中间件传了参数
         但 SQL 不写列,主体照样到不了 audit_logs,追责链仍断(列已存在于 R70
         分区重建,本处只补写入)。
"""

from __future__ import annotations

import sys
import time
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import jwt as pyjwt  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from starlette.responses import Response  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.middleware.audit import AuditMiddleware  # noqa: E402
from app.services.audit_service import AuditEntry, audit_service  # noqa: E402

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


async def test_persist_entry_writes_user_id_column(monkeypatch: pytest.MonkeyPatch) -> None:
    """AIS-047 落库半边:audit_logs 的 INSERT 必须带 user_id 列且参数为主体值。

    中间件传参只是前半 —— `_persist_entry` 的 INSERT 列里没有 user_id 时,
    主体到不了库,追责链照样断(列已在 R70 分区重建中存在,只补写入不加迁移)。
    假池把 execute 参数收下来当场判,零 SQL 出站(AGENTS §5 测试隔离铁律)。
    """
    captured: list[tuple[str, tuple[object, ...]]] = []

    class _FakeConn:
        async def execute(self, sql: str, *args: object) -> None:
            captured.append((sql, args))

    class _FakeAcquire:
        async def __aenter__(self) -> _FakeConn:
            return _FakeConn()

        async def __aexit__(self, *exc: object) -> bool:
            return False

    class _FakePool:
        def acquire(self) -> _FakeAcquire:
            return _FakeAcquire()

    async def _fake_get_db_pool() -> _FakePool:
        return _FakePool()

    # _persist_entry 函数内 `from app.core.db import get_db_pool`(晚绑定),
    # patch 模块属性即可命中它真正执行的那一份。
    monkeypatch.setattr("app.core.db.get_db_pool", _fake_get_db_pool)

    entry = AuditEntry(
        action="POST /api/hooks/x",
        details={"status": 200},
        agent_id="system",
        user_id="u-me",
    )
    await audit_service._persist_entry(entry)

    assert len(captured) == 1, f"落库面必须恰好发一条 INSERT,实得 {len(captured)} 条"
    sql, args = captured[0]
    assert "user_id" in sql, f"INSERT 列缺 user_id:{sql}"
    # 参数序:action / resource_type / resource_id / details / created_at / user_id
    assert args[5] == "u-me", f"user_id 参数应为主体值,实得 {args[5]!r}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
