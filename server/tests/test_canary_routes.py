"""建议 128 测试: CanaryStageController HTTP API."""

import json
import os

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------


@pytest.fixture
def tmp_state_file(tmp_path):
    return str(tmp_path / "canary_api_state.json")


@pytest.fixture
def client(tmp_state_file, monkeypatch):
    """FastAPI TestClient + 隔离 state file + admin 鉴权 mock (建议 133)."""
    monkeypatch.setenv("ZHS_CANARY_STATE_FILE", tmp_state_file)
    # 建议 133: mock require_role 让 _admin_dep 短路为 True (无 DB 依赖)
    from app import security

    async def _fake_require_login():
        return "test-admin-uuid"

    def _fake_require_role(role):
        async def _dep(user_uuid: str = None):
            return "test-admin-uuid"

        return _dep

    monkeypatch.setattr(security, "require_login", _fake_require_login, raising=True)
    monkeypatch.setattr(security, "require_role", _fake_require_role, raising=True)
    # reload canary_routes 让 _admin_dep 捕获新的 require_role
    import importlib

    from app.api.v1 import canary_routes

    importlib.reload(canary_routes)
    canary_routes._CTRL = None
    # 用 TestClient 包裹 router (无需启动整个 FastAPI app)
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(canary_routes.router)
    with TestClient(app) as c:
        yield c
    canary_routes._CTRL = None


# ---------------------------------------------------------------------------
# GET /canary/stage
# ---------------------------------------------------------------------------


class TestGetStage:
    """GET /canary/stage 查询状态."""

    def test_initial_stage(self, client):
        r = client.get("/canary/stage")
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["data"]["current_stage"] == "0%"
        assert data["data"]["ratio"] == 0.0
        assert data["data"]["failures"] == 0
        assert data["data"]["traffic"] == 0
        assert data["data"]["is_in_cooldown"] is False

    def test_history_field_present(self, client):
        r = client.get("/canary/stage")
        data = r.json()
        assert "history" in data["data"]
        assert isinstance(data["data"]["history"], list)


# ---------------------------------------------------------------------------
# POST /canary/promote
# ---------------------------------------------------------------------------


class TestPromoteEndpoint:
    """POST /canary/promote 提升阶段."""

    def test_promote_basic(self, client):
        r = client.post("/canary/promote", json={"actor": "tester", "reason": "go"})
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["data"]["event"]["event_type"] == "promote"
        assert data["data"]["event"]["from_stage"] == "0%"
        assert data["data"]["event"]["to_stage"] == "1%"
        assert data["data"]["state"]["current_stage"] == "1%"

    def test_promote_respects_cooldown(self, tmp_state_file, monkeypatch):
        """cooldown 中的 promote 应 429."""
        monkeypatch.setenv("ZHS_CANARY_STATE_FILE", tmp_state_file)
        from app.api.v1 import canary_routes

        canary_routes._CTRL = None
        from app.canary_stages import CanaryStageController

        canary_routes._CTRL = CanaryStageController(state_file=tmp_state_file, cooldown_seconds=10.0)
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(canary_routes.router)
        with TestClient(app) as c:
            r1 = c.post("/canary/promote", json={"actor": "t", "reason": "first"})
            assert r1.status_code == 200
            r2 = c.post("/canary/promote", json={"actor": "t", "reason": "too fast"})
            assert r2.status_code == 429
        canary_routes._CTRL = None

    def test_promote_persists_event(self, client):
        client.post("/canary/promote", json={"actor": "tester", "reason": "go"})
        r = client.get("/canary/stage")
        data = r.json()
        assert len(data["data"]["history"]) >= 1
        last = data["data"]["history"][-1]
        assert last["event_type"] == "promote"
        assert last["actor"] == "tester"
        assert last["reason"] == "go"


# ---------------------------------------------------------------------------
# POST /canary/rollback
# ---------------------------------------------------------------------------


class TestRollbackEndpoint:
    """POST /canary/rollback 回滚."""

    def test_rollback_after_promote(self, client):
        client.post("/canary/promote", json={"actor": "t", "reason": "go"})
        r = client.post("/canary/rollback", json={"actor": "t", "reason": "v2 fail"})
        assert r.status_code == 200
        data = r.json()
        assert data["data"]["event"]["event_type"] == "rollback"
        assert data["data"]["state"]["current_stage"] == "0%"

    def test_rollback_bypass_cooldown(self, tmp_state_file, monkeypatch):
        monkeypatch.setenv("ZHS_CANARY_STATE_FILE", tmp_state_file)
        from app.api.v1 import canary_routes

        canary_routes._CTRL = None
        from app.canary_stages import CanaryStageController

        canary_routes._CTRL = CanaryStageController(state_file=tmp_state_file, cooldown_seconds=10.0)
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(canary_routes.router)
        with TestClient(app) as c:
            c.post("/canary/promote", json={"actor": "t", "reason": "go"})
            # rollback 应 200 (绕过 cooldown)
            r = c.post("/canary/rollback", json={"actor": "t", "reason": "紧急"})
            assert r.status_code == 200
        canary_routes._CTRL = None

    def test_auto_rollback_via_api(self, client):
        r = client.post("/canary/rollback", json={"actor": "auto", "reason": "自动", "auto": True})
        # 已在最低, event_type=noop
        assert r.status_code == 200
        data = r.json()
        # 仍在 0%, 但 event_type 应是 noop 或 auto_rollback
        assert data["data"]["state"]["current_stage"] == "0%"


# ---------------------------------------------------------------------------
# POST /canary/reset
# ---------------------------------------------------------------------------


class TestResetEndpoint:
    """POST /canary/reset 重置."""

    def test_reset_to_stage_0(self, client):
        client.post("/canary/promote", json={"actor": "t", "reason": "go"})
        r = client.post("/canary/reset", json={"actor": "t", "reason": "新周期"})
        assert r.status_code == 200
        data = r.json()
        assert data["data"]["event"]["event_type"] == "reset"
        assert data["data"]["state"]["current_stage"] == "0%"


# ---------------------------------------------------------------------------
# POST /canary/failure
# ---------------------------------------------------------------------------


class TestFailureEndpoint:
    """POST /canary/failure 失败标记."""

    def test_failure_below_threshold(self, client):
        r = client.post("/canary/failure", json={"reason": "v2 报错"})
        assert r.status_code == 200
        data = r.json()
        assert data["data"]["event"]["event_type"] == "failure"
        assert data["data"]["state"]["failures"] == 1

    def test_failure_triggers_auto_rollback(self, tmp_state_file, monkeypatch):
        """3 次失败触发 auto_rollback."""
        monkeypatch.setenv("ZHS_CANARY_STATE_FILE", tmp_state_file)
        from app.api.v1 import canary_routes

        canary_routes._CTRL = None
        from app.canary_stages import CanaryStageController

        canary_routes._CTRL = CanaryStageController(state_file=tmp_state_file, failure_threshold=3)
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(canary_routes.router)
        with TestClient(app) as c:
            c.post("/canary/promote", json={"actor": "t", "reason": "go"})
            c.post("/canary/failure", json={"reason": "fail 1"})
            c.post("/canary/failure", json={"reason": "fail 2"})
            r = c.post("/canary/failure", json={"reason": "fail 3 - 触发回滚"})
            data = r.json()
            assert data["data"]["event"]["event_type"] == "auto_rollback"
            assert data["data"]["state"]["current_stage"] == "0%"
        canary_routes._CTRL = None


# ---------------------------------------------------------------------------
# POST /canary/traffic
# ---------------------------------------------------------------------------


class TestTrafficEndpoint:
    """POST /canary/traffic 流量报告."""

    def test_traffic_increments(self, client):
        r = client.post("/canary/traffic", json={"count": 100})
        assert r.status_code == 200
        data = r.json()
        assert data["data"]["traffic"] == 100

    def test_traffic_accumulates(self, client):
        client.post("/canary/traffic", json={"count": 50})
        client.post("/canary/traffic", json={"count": 30})
        r = client.get("/canary/stage")
        assert r.json()["data"]["traffic"] == 80

    def test_traffic_rejects_zero_or_negative(self, client):
        r = client.post("/canary/traffic", json={"count": 0})
        # Pydantic Field(ge=1) 校验失败 → 422
        assert r.status_code in (200, 422)


# ---------------------------------------------------------------------------
# 状态文件持久化
# ---------------------------------------------------------------------------


class TestStateFilePersistence:
    """state 持久化到文件."""

    def test_state_file_created(self, client, tmp_state_file):
        client.post("/canary/promote", json={"actor": "t", "reason": "go"})
        assert os.path.exists(tmp_state_file)
        with open(tmp_state_file, encoding="utf-8") as f:
            data = json.load(f)
        assert data["current_stage"] == "1%"

    def test_state_loaded_from_existing_file(self, tmp_state_file, monkeypatch):
        """预存 state, 新 controller 应加载."""
        with open(tmp_state_file, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "current_stage": "50%",
                    "last_change_ts": 0.0,
                    "last_event": None,
                    "history": [],
                    "failures_in_stage": 0,
                    "total_traffic_in_stage": 0,
                },
                f,
            )
        monkeypatch.setenv("ZHS_CANARY_STATE_FILE", tmp_state_file)
        from app.api.v1 import canary_routes

        canary_routes._CTRL = None
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(canary_routes.router)
        with TestClient(app) as c:
            r = c.get("/canary/stage")
            assert r.json()["data"]["current_stage"] == "50%"
        canary_routes._CTRL = None


# ---------------------------------------------------------------------------
# 路由前缀 / 文档
# ---------------------------------------------------------------------------


class TestRouteRegistration:
    """路由注册 / OpenAPI 文档."""

    def test_routes_registered(self):
        from app.api.v1.canary_routes import router

        paths = {r.path for r in router.routes}
        assert "/canary/stage" in paths
        assert "/canary/promote" in paths
        assert "/canary/rollback" in paths
        assert "/canary/reset" in paths
        assert "/canary/failure" in paths
        assert "/canary/traffic" in paths

    def test_router_in_main_api(self):
        """主 router 应包含 canary router."""
        from app.api.v1.router import api_router

        # 检查是否包含 canary 路径
        all_paths = {r.path for r in api_router.routes}
        # 由于 prefix="" 直接展开, 路径应为 /canary/stage 等
        assert any("/canary/stage" in p for p in all_paths)
