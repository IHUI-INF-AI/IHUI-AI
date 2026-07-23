"""audit.py 单元测试:审计日志中间件。

测试覆盖:
- AuditMiddleware HTTP 行为:写操作(POST/PATCH/PUT/DELETE)记录,读操作(GET/HEAD/OPTIONS)跳过
- 记录内容:action(method+path)、details(status/latency_ms/ip/user_agent)、trace_id
- trace_id:从 traceparent 头解析(W3C 格式)/ 无 traceparent 时为 None
- 隔离:monkeypatch audit_service.log_agent_action / extract_trace_id,不依赖真实缓冲区/日志
- setup 函数:中间件注册
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from starlette.applications import Starlette
from starlette.responses import JSONResponse

from app.middleware.audit import AuditMiddleware, setup_audit_middleware
from app.services.audit_service import audit_service


# =============================================================================
# 辅助:构建最小 Starlette app + monkeypatch 捕获审计调用
# =============================================================================


def _make_audit_app() -> Starlette:
    """构建带 AuditMiddleware 的最小 app(支持多方法)。"""
    app = Starlette()

    async def root(request):
        return JSONResponse({"ok": True})

    app.add_route("/", root, methods=["GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"])
    app.add_middleware(AuditMiddleware)
    return app


def _patch_audit(monkeypatch, capture: list):
    """monkeypatch audit_service.log_agent_action 收集调用,extract_trace_id 用真实实现。"""

    def fake_log(agent_id, action, details, trace_id=None, user_id=None):
        capture.append({
            "agent_id": agent_id,
            "action": action,
            "details": details,
            "trace_id": trace_id,
            "user_id": user_id,
        })

    monkeypatch.setattr(audit_service, "log_agent_action", fake_log)
    # extract_trace_id 保持真实实现(纯函数,无副作用)


def _patch_audit_no_trace(monkeypatch, capture: list):
    """monkeypatch log_agent_action + extract_trace_id 强制返回 None。"""

    def fake_log(agent_id, action, details, trace_id=None, user_id=None):
        capture.append({
            "agent_id": agent_id,
            "action": action,
            "details": details,
            "trace_id": trace_id,
        })

    monkeypatch.setattr(audit_service, "log_agent_action", fake_log)
    monkeypatch.setattr(audit_service, "extract_trace_id", lambda tp: None)


# =============================================================================
# 读操作不记录
# =============================================================================


async def test_get_request_not_recorded(monkeypatch):
    capture: list = []
    _patch_audit_no_trace(monkeypatch, capture)
    app = _make_audit_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/")
    assert resp.status_code == 200
    assert capture == []


async def test_head_request_not_recorded(monkeypatch):
    capture: list = []
    _patch_audit_no_trace(monkeypatch, capture)
    app = _make_audit_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.head("/")
    assert resp.status_code == 200
    assert capture == []


async def test_options_request_not_recorded(monkeypatch):
    capture: list = []
    _patch_audit_no_trace(monkeypatch, capture)
    app = _make_audit_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.options("/")
    assert resp.status_code == 200
    assert capture == []


# =============================================================================
# 写操作记录
# =============================================================================


async def test_post_request_recorded(monkeypatch):
    capture: list = []
    _patch_audit_no_trace(monkeypatch, capture)
    app = _make_audit_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/", json={"x": 1})
    assert resp.status_code == 200
    assert len(capture) == 1
    assert capture[0]["agent_id"] == "system"
    assert capture[0]["action"] == "POST /"


async def test_patch_request_recorded(monkeypatch):
    capture: list = []
    _patch_audit_no_trace(monkeypatch, capture)
    app = _make_audit_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.patch("/", json={"x": 1})
    assert resp.status_code == 200
    assert len(capture) == 1
    assert capture[0]["action"] == "PATCH /"


async def test_put_request_recorded(monkeypatch):
    capture: list = []
    _patch_audit_no_trace(monkeypatch, capture)
    app = _make_audit_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.put("/", json={"x": 1})
    assert resp.status_code == 200
    assert len(capture) == 1
    assert capture[0]["action"] == "PUT /"


async def test_delete_request_recorded(monkeypatch):
    capture: list = []
    _patch_audit_no_trace(monkeypatch, capture)
    app = _make_audit_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.delete("/")
    assert resp.status_code == 200
    assert len(capture) == 1
    assert capture[0]["action"] == "DELETE /"


# =============================================================================
# 记录内容正确性
# =============================================================================


async def test_action_includes_method_and_path(monkeypatch):
    capture: list = []
    _patch_audit_no_trace(monkeypatch, capture)
    app = Starlette()

    async def handler(request):
        return JSONResponse({"ok": True})

    app.add_route("/api/agents/run", handler, methods=["POST"])
    app.add_middleware(AuditMiddleware)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/api/agents/run")
    assert capture[0]["action"] == "POST /api/agents/run"


async def test_details_includes_status_code(monkeypatch):
    capture: list = []
    _patch_audit_no_trace(monkeypatch, capture)
    app = _make_audit_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/")
    assert capture[0]["details"]["status"] == 200


async def test_details_includes_latency_ms_non_negative(monkeypatch):
    capture: list = []
    _patch_audit_no_trace(monkeypatch, capture)
    app = _make_audit_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/")
    latency = capture[0]["details"]["latency_ms"]
    assert isinstance(latency, float)
    assert latency >= 0.0


async def test_details_includes_user_agent(monkeypatch):
    capture: list = []
    _patch_audit_no_trace(monkeypatch, capture)
    app = _make_audit_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/", json={"x": 1}, headers={"user-agent": "test-agent/1.0"})
    assert capture[0]["details"]["user_agent"] == "test-agent/1.0"


async def test_details_includes_ip_key(monkeypatch):
    capture: list = []
    _patch_audit_no_trace(monkeypatch, capture)
    app = _make_audit_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/")
    # ASGI test transport 下 request.client 可能为 None → ip 为 None,但 key 必存在
    assert "ip" in capture[0]["details"]


async def test_details_user_agent_empty_when_not_set(monkeypatch):
    capture: list = []
    _patch_audit_no_trace(monkeypatch, capture)
    app = _make_audit_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 不带 user-agent(httpx 默认会带,手动清空)
        await ac.post("/", json={"x": 1}, headers={"user-agent": ""})
    assert capture[0]["details"]["user_agent"] == ""


# =============================================================================
# trace_id 透传
# =============================================================================


async def test_trace_id_extracted_from_traceparent(monkeypatch):
    capture: list = []
    _patch_audit(monkeypatch, capture)  # 用真实 extract_trace_id
    app = _make_audit_app()
    tp = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/", json={"x": 1}, headers={"traceparent": tp})
    assert capture[0]["trace_id"] == "0af7651916cd43dd8448eb211c80319c"


async def test_trace_id_none_without_traceparent(monkeypatch):
    capture: list = []
    _patch_audit(monkeypatch, capture)  # 真实 extract_trace_id
    app = _make_audit_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/", json={"x": 1})
    assert capture[0]["trace_id"] is None


async def test_trace_id_none_for_malformed_traceparent(monkeypatch):
    capture: list = []
    _patch_audit(monkeypatch, capture)
    app = _make_audit_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/", json={"x": 1}, headers={"traceparent": "invalid"})
    # 格式非法时 extract_trace_id 返回 None(parts < 2)
    assert capture[0]["trace_id"] is None


# =============================================================================
# 响应正常返回(审计不阻塞)
# =============================================================================


async def test_audit_does_not_block_response(monkeypatch):
    capture: list = []
    _patch_audit_no_trace(monkeypatch, capture)
    app = _make_audit_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/", json={"x": 1})
    # 响应正常返回,审计异步记录
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert len(capture) == 1


async def test_audit_records_error_status(monkeypatch):
    """下游返回 500 时,审计仍记录实际 status。"""
    capture: list = []
    _patch_audit_no_trace(monkeypatch, capture)
    app = Starlette()

    async def handler(request):
        return JSONResponse({"err": "boom"}, status_code=500)

    app.add_route("/fail", handler, methods=["POST"])
    app.add_middleware(AuditMiddleware)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/fail")
    assert resp.status_code == 500
    assert capture[0]["details"]["status"] == 500
    assert capture[0]["action"] == "POST /fail"


# =============================================================================
# setup 函数
# =============================================================================


def test_setup_audit_middleware_registers():
    app = Starlette()
    setup_audit_middleware(app)
    assert len(app.user_middleware) >= 1
