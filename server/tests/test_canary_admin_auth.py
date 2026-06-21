"""建议 133 测试: Canary API admin 鉴权.

测试 6 个 canary 端点:
  - 无 token -> 401
  - 普通用户 token (非 admin) -> 403
  - admin 用户 token -> 200
  - /canary/stage 只读权限: 同样需要 admin
  - 跨测试隔离: 单例 controller 重置

实现策略:
  - mock `require_role("admin")` 返回的依赖, 让其短路为 True
  - mock `require_login` 让其短路为 True / 抛 401 / 抛 403
"""


import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def tmp_state_file(tmp_path):
    return str(tmp_path / "canary_admin_state.json")


def _make_test_client(monkeypatch, tmp_state_file, auth_mode: str = "admin"):
    """构造带鉴权 mock 的 TestClient.

    auth_mode:
      - "admin"      : 鉴权通过, 返回 admin uuid
      - "no_admin"   : 鉴权 403 拒绝
      - "no_token"   : 鉴权 401 未登录
    """
    monkeypatch.setenv("ZHS_CANARY_STATE_FILE", tmp_state_file)

    # 在 import canary_routes 前, 先把 security 里的 require_role / require_login patch 掉
    from app import security

    if auth_mode == "admin":

        async def _fake_require_login():
            return "test-admin-uuid"

        def _fake_require_role(role):
            async def _dep(user_uuid: str = None):
                return "test-admin-uuid"

            return _dep

        monkeypatch.setattr(security, "require_login", _fake_require_login, raising=True)
        monkeypatch.setattr(security, "require_role", _fake_require_role, raising=True)

    elif auth_mode == "no_admin":

        async def _fake_require_login():
            return "test-user-uuid"

        def _fake_require_role(role):
            async def _dep():
                raise HTTPException(status_code=403, detail=f"Role '{role}' required")

            return _dep

        monkeypatch.setattr(security, "require_login", _fake_require_login, raising=True)
        monkeypatch.setattr(security, "require_role", _fake_require_role, raising=True)

    elif auth_mode == "no_token":

        async def _fake_require_login():
            raise HTTPException(status_code=401, detail="Authentication required")

        def _fake_require_role(role):
            async def _dep():
                raise HTTPException(status_code=401, detail="Authentication required")

            return _dep

        monkeypatch.setattr(security, "require_login", _fake_require_login, raising=True)
        monkeypatch.setattr(security, "require_role", _fake_require_role, raising=True)

    # 重 import canary_routes (在 patch 之后) 让 _admin_dep 捕获 mock 的 require_role
    import importlib

    from app.api.v1 import canary_routes

    importlib.reload(canary_routes)
    canary_routes._CTRL = None

    app = FastAPI()
    app.include_router(canary_routes.router)
    return canary_routes, app


# ---------------------------------------------------------------------------
# TestAdminAllowed
# ---------------------------------------------------------------------------


class TestAdminAllowed:
    """admin 鉴权通过 (返回 200)."""

    def test_get_stage_allowed(self, tmp_state_file, monkeypatch):
        _, app = _make_test_client(monkeypatch, tmp_state_file, "admin")
        with TestClient(app) as c:
            r = c.get("/canary/stage")
            assert r.status_code == 200
            assert r.json()["ok"] is True

    def test_promote_allowed(self, tmp_state_file, monkeypatch):
        _, app = _make_test_client(monkeypatch, tmp_state_file, "admin")
        with TestClient(app) as c:
            r = c.post("/canary/promote", json={"actor": "admin", "reason": "go"})
            assert r.status_code == 200
            assert r.json()["data"]["event"]["event_type"] == "promote"

    def test_rollback_allowed(self, tmp_state_file, monkeypatch):
        _, app = _make_test_client(monkeypatch, tmp_state_file, "admin")
        with TestClient(app) as c:
            r = c.post("/canary/rollback", json={"actor": "admin", "reason": "v2 fail"})
            assert r.status_code == 200

    def test_reset_allowed(self, tmp_state_file, monkeypatch):
        _, app = _make_test_client(monkeypatch, tmp_state_file, "admin")
        with TestClient(app) as c:
            r = c.post("/canary/reset", json={"actor": "admin", "reason": "新周期"})
            assert r.status_code == 200

    def test_failure_allowed(self, tmp_state_file, monkeypatch):
        _, app = _make_test_client(monkeypatch, tmp_state_file, "admin")
        with TestClient(app) as c:
            r = c.post("/canary/failure", json={"reason": "v2 报错"})
            assert r.status_code == 200

    def test_traffic_allowed(self, tmp_state_file, monkeypatch):
        _, app = _make_test_client(monkeypatch, tmp_state_file, "admin")
        with TestClient(app) as c:
            r = c.post("/canary/traffic", json={"count": 10})
            assert r.status_code == 200


# ---------------------------------------------------------------------------
# TestNonAdminForbidden
# ---------------------------------------------------------------------------


class TestNonAdminForbidden:
    """非 admin 用户鉴权失败 (返回 403)."""

    def test_get_stage_forbidden(self, tmp_state_file, monkeypatch):
        _, app = _make_test_client(monkeypatch, tmp_state_file, "no_admin")
        with TestClient(app) as c:
            r = c.get("/canary/stage")
            assert r.status_code == 403

    def test_promote_forbidden(self, tmp_state_file, monkeypatch):
        _, app = _make_test_client(monkeypatch, tmp_state_file, "no_admin")
        with TestClient(app) as c:
            r = c.post("/canary/promote", json={"actor": "user", "reason": "go"})
            assert r.status_code == 403

    def test_rollback_forbidden(self, tmp_state_file, monkeypatch):
        _, app = _make_test_client(monkeypatch, tmp_state_file, "no_admin")
        with TestClient(app) as c:
            r = c.post("/canary/rollback", json={"actor": "user", "reason": "v2 fail"})
            assert r.status_code == 403

    def test_reset_forbidden(self, tmp_state_file, monkeypatch):
        _, app = _make_test_client(monkeypatch, tmp_state_file, "no_admin")
        with TestClient(app) as c:
            r = c.post("/canary/reset", json={"actor": "user", "reason": "新周期"})
            assert r.status_code == 403

    def test_failure_forbidden(self, tmp_state_file, monkeypatch):
        _, app = _make_test_client(monkeypatch, tmp_state_file, "no_admin")
        with TestClient(app) as c:
            r = c.post("/canary/failure", json={"reason": "x"})
            assert r.status_code == 403

    def test_traffic_forbidden(self, tmp_state_file, monkeypatch):
        _, app = _make_test_client(monkeypatch, tmp_state_file, "no_admin")
        with TestClient(app) as c:
            r = c.post("/canary/traffic", json={"count": 10})
            assert r.status_code == 403


# ---------------------------------------------------------------------------
# TestUnauthenticatedRejected
# ---------------------------------------------------------------------------


class TestUnauthenticatedRejected:
    """未登录鉴权失败 (返回 401)."""

    def test_get_stage_unauth(self, tmp_state_file, monkeypatch):
        _, app = _make_test_client(monkeypatch, tmp_state_file, "no_token")
        with TestClient(app) as c:
            r = c.get("/canary/stage")
            assert r.status_code == 401

    def test_promote_unauth(self, tmp_state_file, monkeypatch):
        _, app = _make_test_client(monkeypatch, tmp_state_file, "no_token")
        with TestClient(app) as c:
            r = c.post("/canary/promote", json={"actor": "x"})
            assert r.status_code == 401

    def test_failure_unauth(self, tmp_state_file, monkeypatch):
        _, app = _make_test_client(monkeypatch, tmp_state_file, "no_token")
        with TestClient(app) as c:
            r = c.post("/canary/failure", json={"reason": "x"})
            assert r.status_code == 401


# ---------------------------------------------------------------------------
# TestAllEndpointsCovered
# ---------------------------------------------------------------------------


class TestAllEndpointsCovered:
    """所有 6 个端点都加了 admin 鉴权 (无遗漏)."""

    def test_all_endpoints_have_admin_dep(self):
        """遍历 router.routes, 验证所有非 OPTIONS 端点都依赖 _admin_dep."""
        from app.api.v1.canary_routes import _admin_dep, router

        covered = 0
        for route in router.routes:
            if not hasattr(route, "dependant"):
                continue
            # 收集所有依赖的 call
            deps = set()
            for d in route.dependant.dependencies:
                deps.add(d.call)
            assert _admin_dep in deps, f"端点 {route.path} 未挂 _admin_dep 鉴权!"
            covered += 1
        # 6 个端点都应该覆盖
        assert covered == 6
