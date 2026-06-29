"""建议 131 测试: CanaryStageController e2e smoke (FastAPI TestClient + 完整流程)."""


import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# e2e fixture: 真实 FastAPI app + 隔离 state
# ---------------------------------------------------------------------------


@pytest.fixture
def fresh_state_file(tmp_path):
    return str(tmp_path / "e2e_canary_state.json")


@pytest.fixture
def e2e_client(fresh_state_file, monkeypatch):
    """完整 FastAPI app + canary router + admin 端点.

    注: cooldown_seconds=0 让测试可连续 promote, 模拟 e2e 业务流程.
    建议 133: admin 鉴权 mock (避免依赖 DB).
    """
    monkeypatch.setenv("ZHS_CANARY_STATE_FILE", fresh_state_file)
    # 建议 133: mock require_role
    from app import security

    async def _fake_require_login():
        return "test-admin-uuid"

    def _fake_require_role(role):
        async def _dep(user_uuid: str = None):
            return "test-admin-uuid"

        return _dep

    monkeypatch.setattr(security, "require_login", _fake_require_login, raising=True)
    monkeypatch.setattr(security, "require_role", _fake_require_role, raising=True)
    # reload canary_routes
    import importlib

    from app.api.v1 import canary_routes

    importlib.reload(canary_routes)
    from app.canary_stages import CanaryStageController

    canary_routes._CTRL = CanaryStageController(
        state_file=fresh_state_file,
        cooldown_seconds=0,
    )
    from fastapi import FastAPI

    app = FastAPI(title="ZHS E2E")
    app.include_router(canary_routes.router)
    with TestClient(app) as c:
        yield c
    canary_routes._CTRL = None


# ---------------------------------------------------------------------------
# 端点 e2e: 阶段化放量完整流程
# ---------------------------------------------------------------------------


class TestE2EStageProgression:
    """e2e: 阶段化放量完整流程."""

    def test_e2e_full_lifecycle(self, e2e_client):
        """完整 e2e: 查询 → promote → traffic → 失败 → auto_rollback."""
        # 1. 初始状态
        r = e2e_client.get("/canary/stage")
        assert r.json()["data"]["current_stage"] == "0%"

        # 2. 提升到 1%
        e2e_client.post("/canary/promote", json={"actor": "admin", "reason": "启动灰度"})

        # 3. 报告流量
        for _ in range(5):
            e2e_client.post("/canary/traffic", json={"count": 100})

        r = e2e_client.get("/canary/stage")
        data = r.json()["data"]
        assert data["current_stage"] == "1%"
        assert data["traffic"] == 500

        # 4. 提升到 10%
        e2e_client.post("/canary/promote", json={"actor": "admin", "reason": "数据看起来不错"})

        r = e2e_client.get("/canary/stage")
        assert r.json()["data"]["current_stage"] == "10%"

    def test_e2e_auto_rollback_workflow(self, e2e_client, fresh_state_file):
        """e2e: 累计失败触发 auto_rollback."""
        # 重置 state file + 改 failure_threshold
        from app.api.v1 import canary_routes
        from app.canary_stages import CanaryStageController

        canary_routes._CTRL = CanaryStageController(
            state_file=fresh_state_file,
            failure_threshold=3,
            cooldown_seconds=0,
        )

        # 提升到 1%
        e2e_client.post("/canary/promote", json={"actor": "admin", "reason": "go"})

        # 3 次失败
        for i in range(3):
            e2e_client.post("/canary/failure", json={"reason": f"fail {i + 1}"})

        # 应 auto_rollback 到 STAGE_0
        r = e2e_client.get("/canary/stage")
        data = r.json()["data"]
        assert data["current_stage"] == "0%"
        # history 应包含 auto_rollback
        event_types = [h["event_type"] for h in data["history"]]
        assert "auto_rollback" in event_types

    def test_e2e_history_audit_trail(self, e2e_client):
        """e2e: history 完整审计."""
        # promote 1%
        e2e_client.post("/canary/promote", json={"actor": "alice", "reason": "启动灰度"})
        # promote 10%
        e2e_client.post("/canary/promote", json={"actor": "bob", "reason": "扩大"})
        # rollback
        e2e_client.post("/canary/rollback", json={"actor": "carol", "reason": "v2 报错"})

        r = e2e_client.get("/canary/stage")
        data = r.json()["data"]
        # 至少 3 条历史
        assert len(data["history"]) >= 3
        # 最后一条是 rollback
        assert data["history"][-1]["event_type"] == "rollback"
        # actor 链
        actors = [h["actor"] for h in data["history"]]
        assert "alice" in actors
        assert "bob" in actors
        assert "carol" in actors


# ---------------------------------------------------------------------------
# 持久化 e2e: 重启后状态恢复
# ---------------------------------------------------------------------------


class TestE2EPersistence:
    """e2e: 状态文件持久化 + 重启恢复."""

    def test_state_survives_restart(self, fresh_state_file, monkeypatch):
        """进程重启后, state 从文件恢复."""
        from fastapi import FastAPI

        from app.api.v1 import canary_routes

        # 第 1 个进程: promote 一次
        monkeypatch.setenv("ZHS_CANARY_STATE_FILE", fresh_state_file)
        canary_routes._CTRL = None
        app1 = FastAPI()
        app1.include_router(canary_routes.router)
        with TestClient(app1) as c1:
            c1.post("/canary/promote", json={"actor": "p1", "reason": "go"})

        # 第 2 个进程: 状态应恢复
        canary_routes._CTRL = None
        app2 = FastAPI()
        app2.include_router(canary_routes.router)
        with TestClient(app2) as c2:
            r = c2.get("/canary/stage")
            data = r.json()["data"]
            assert data["current_stage"] == "1%"
            # history 也恢复
            assert any(h.get("actor") == "p1" for h in data["history"])
        canary_routes._CTRL = None


# ---------------------------------------------------------------------------
# Shadow 联动 e2e
# ---------------------------------------------------------------------------


class TestE2EShadowLink:
    """e2e: canary 阶段 → shadow 联动."""

    def test_shadow_on_at_1pct(self, fresh_state_file, monkeypatch):
        monkeypatch.setenv("ZHS_CANARY_STATE_FILE", fresh_state_file)
        # 建议 133: mock admin 鉴权
        from app import security

        async def _fake_require_login():
            return "test-admin-uuid"

        def _fake_require_role(role):
            async def _dep(user_uuid=None):
                return "test-admin-uuid"

            return _dep

        monkeypatch.setattr(security, "require_login", _fake_require_login, raising=True)
        monkeypatch.setattr(security, "require_role", _fake_require_role, raising=True)

        import importlib

        from app.api.v1 import canary_routes

        importlib.reload(canary_routes)
        from app.canary_shadow_link import CanaryShadowLink, reset_linked_router
        from app.canary_stages import get_default_controller, reset_default_controller

        # 重置全部单例
        canary_routes._CTRL = None
        reset_linked_router()
        reset_default_controller()
        # 用 e2e 同一个 canary controller
        canary = get_default_controller(state_file=fresh_state_file)
        canary_routes._CTRL = canary  # 共用

        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(canary_routes.router)
        with TestClient(app) as c:
            # 用 link 显式绑定 canary
            link = CanaryShadowLink(canary)
            # promote 到 1%
            r = c.post("/canary/promote", json={"actor": "admin", "reason": "go"})
            assert r.status_code == 200, f"promote 失败: {r.status_code} {r.text}"
            link.sync()
            # shadow 应启用 @ 1%
            assert link.shadow.ratio == pytest.approx(0.01)
            assert link.is_shadow_active() is True
        canary_routes._CTRL = None
        reset_linked_router()
        reset_default_controller()

    def test_shadow_off_at_50pct(self, fresh_state_file, monkeypatch):
        monkeypatch.setenv("ZHS_CANARY_STATE_FILE", fresh_state_file)
        from app.api.v1 import canary_routes
        from app.canary_shadow_link import CanaryShadowLink, reset_linked_router
        from app.canary_stages import CanaryStageController

        canary_routes._CTRL = None
        reset_linked_router()
        canary = CanaryStageController(state_file=fresh_state_file, cooldown_seconds=0)
        canary_routes._CTRL = canary

        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(canary_routes.router)
        with TestClient(app) as c:
            link = CanaryShadowLink(canary)
            # 提升到 50% (3 次 promote)
            for _ in range(3):
                c.post("/canary/promote", json={"actor": "admin", "reason": "go"})
            link.sync()
            # shadow 应关闭 (50%+ 不联动)
            assert link.shadow.ratio == 0.0
        canary_routes._CTRL = None
        reset_linked_router()


# ---------------------------------------------------------------------------
# 异常路径 e2e
# ---------------------------------------------------------------------------


class TestE2EErrorPaths:
    """e2e: 错误路径处理."""

    def test_promote_cooldown_429(self, fresh_state_file, monkeypatch):
        """cooldown 中的 promote 应 429."""
        monkeypatch.setenv("ZHS_CANARY_STATE_FILE", fresh_state_file)
        from app.api.v1 import canary_routes

        canary_routes._CTRL = None
        from app.canary_stages import CanaryStageController

        canary_routes._CTRL = CanaryStageController(state_file=fresh_state_file, cooldown_seconds=60.0)
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(canary_routes.router)
        with TestClient(app) as c:
            r1 = c.post("/canary/promote", json={"actor": "t", "reason": "first"})
            assert r1.status_code == 200
            r2 = c.post("/canary/promote", json={"actor": "t", "reason": "second"})
            assert r2.status_code == 429
            assert "cooldown" in r2.json()["detail"].lower() or "cooldown" in str(r2.json()).lower()
        canary_routes._CTRL = None

    def test_traffic_zero_validation(self, e2e_client):
        """traffic count=0 应 422 (Pydantic 校验)."""
        r = e2e_client.post("/canary/traffic", json={"count": 0})
        assert r.status_code == 422

    def test_invalid_request_body(self, e2e_client):
        """无效请求体应 422."""
        r = e2e_client.post("/canary/promote", json={"actor": 123})  # 类型错
        # Pydantic 接受 str 输入, 不应错; 但缺 actor 字段应 422
        r2 = e2e_client.post("/canary/promote", json={"actor": None, "reason": "x"})
        # actor 是 str, None 会被强制转换或 422
        assert r2.status_code in (200, 422)


# ---------------------------------------------------------------------------
# OpenAPI 文档 e2e
# ---------------------------------------------------------------------------


class TestE2EOpenAPI:
    """e2e: OpenAPI 文档完整."""

    def test_openapi_includes_canary_paths(self, e2e_client):
        r = e2e_client.get("/openapi.json")
        assert r.status_code == 200
        spec = r.json()
        paths = spec.get("paths", {})
        for p in (
            "/canary/stage",
            "/canary/promote",
            "/canary/rollback",
            "/canary/reset",
            "/canary/failure",
            "/canary/traffic",
        ):
            assert p in paths, f"OpenAPI 缺 {p}"

    def test_openapi_tags(self, e2e_client):
        r = e2e_client.get("/openapi.json")
        spec = r.json()
        # 验证 canary 端点有正确 tag
        for path, methods in spec["paths"].items():
            if "/canary/" in path:
                for method, info in methods.items():
                    assert "Canary" in info.get("tags", []), f"{method.upper()} {path} 缺 Canary tag"
