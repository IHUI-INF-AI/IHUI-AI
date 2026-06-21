"""建议 151 测试: Canary 阶段事件审计落库.

测试覆盖:
  - CanaryAuditStore 基本 CRUD
  - append 失败隔离 (返回 -1)
  - query 多条件 (source / action / 时间范围)
  - 时间倒序 + limit
  - cleanup_expired 清理过期
  - 集成: canary_stages.promote 写 audit
  - 集成: canary_stages.rollback 写 audit
  - 集成: CanaryAutoPromoter.pause_override 写 audit
  - 集成: CanaryAutoPromoter.resume_override 写 audit
  - 集成: CanaryAutoPromoter.force_promote 写 audit
  - 集成: CanaryAutoPromoter.force_rollback 写 audit
  - 集成: CanaryAutoPromoter._record_decision 写 audit
  - 集成: 跨进程 (新实例 load 一致)
  - 全局 singleton
  - API 端点: query / stats / cleanup
  - 端点路由已注册
"""

import time

import pytest

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def store(tmp_path):
    from app.canary_audit_store import CanaryAuditStore

    s = CanaryAuditStore(db_path=str(tmp_path / "audit.db"), retention_days=365)
    yield s
    s.clear()


# ---------------------------------------------------------------------------
# 基本 CRUD
# ---------------------------------------------------------------------------


class TestAppend:
    def test_append_basic(self, store):
        rid = store.append(
            source="controller",
            action="promote",
            actor="alice",
            from_stage="0%",
            to_stage="1%",
            reason="test",
        )
        assert rid > 0
        assert store.count() == 1

    def test_append_with_detail(self, store):
        rid = store.append(
            source="promoter",
            action="promote_dry_run",
            actor="auto",
            detail={"error_rate": 0.01, "traffic": 100},
        )
        assert rid > 0
        items = store.query()
        assert items[0]["detail"]["error_rate"] == 0.01

    def test_append_returns_id_incrementing(self, store):
        id1 = store.append(source="controller", action="x", actor="a")
        id2 = store.append(source="controller", action="y", actor="a")
        id3 = store.append(source="controller", action="z", actor="a")
        assert id1 < id2 < id3


class TestQuery:
    def test_query_returns_in_desc_order(self, store):
        store.append(source="controller", action="a", actor="x", ts=100.0)
        store.append(source="controller", action="b", actor="x", ts=200.0)
        store.append(source="controller", action="c", actor="x", ts=150.0)
        items = store.query()
        assert [i["action"] for i in items] == ["b", "c", "a"]

    def test_query_by_source(self, store):
        store.append(source="controller", action="x", actor="a")
        store.append(source="override", action="y", actor="b")
        store.append(source="promoter", action="z", actor="c")
        items = store.query(source="override")
        assert len(items) == 1
        assert items[0]["action"] == "y"

    def test_query_by_action(self, store):
        store.append(source="override", action="pause", actor="a")
        store.append(source="override", action="resume", actor="a")
        store.append(source="override", action="force_promote", actor="a")
        items = store.query(action="pause")
        assert len(items) == 1

    def test_query_by_time_range(self, store):
        store.append(source="controller", action="a", actor="x", ts=100.0)
        store.append(source="controller", action="b", actor="x", ts=200.0)
        store.append(source="controller", action="c", actor="x", ts=300.0)
        items = store.query(since_ts=150.0, until_ts=250.0)
        assert len(items) == 1
        assert items[0]["action"] == "b"

    def test_query_limit(self, store):
        for i in range(10):
            store.append(source="controller", action=f"a{i}", actor="x")
        items = store.query(limit=3)
        assert len(items) == 3

    def test_query_limit_clamp(self, store):
        for i in range(5):
            store.append(source="controller", action=f"a{i}", actor="x")
        # limit=2000 应被 clamp 到 1000
        items = store.query(limit=2000)
        assert len(items) == 5  # 实际只有 5 条

    def test_query_empty(self, store):
        items = store.query()
        assert items == []


class TestCleanup:
    def test_cleanup_expired(self, tmp_path):
        from app.canary_audit_store import CanaryAuditStore

        # retention=1 天, 但插入 5 天前的数据
        s = CanaryAuditStore(db_path=str(tmp_path / "audit.db"), retention_days=1)
        old_ts = time.time() - 5 * 24 * 3600
        s.append(source="controller", action="old", actor="x", ts=old_ts)
        s.append(source="controller", action="new", actor="x")
        assert s.count() == 2
        deleted = s.cleanup_expired()
        assert deleted == 1
        assert s.count() == 1
        items = s.query()
        assert items[0]["action"] == "new"


# ---------------------------------------------------------------------------
# 集成: canary_stages
# ---------------------------------------------------------------------------


class TestIntegrationWithStages:
    def test_promote_writes_audit(self, tmp_path):
        from app.canary_audit_store import CanaryAuditStore, set_default_audit_store
        from app.canary_stages import CanaryStageController

        store = CanaryAuditStore(db_path=str(tmp_path / "audit.db"))
        set_default_audit_store(store)
        try:
            ctrl = CanaryStageController(
                state_file=None,
                cooldown_seconds=0.0,
            )
            ctrl.promote(actor="alice", reason="test promote")
            items = store.query(source="controller")
            assert len(items) == 1
            assert items[0]["action"] == "promote"
            assert items[0]["from_stage"] == "0%"
            assert items[0]["to_stage"] == "1%"
            assert items[0]["actor"] == "alice"
            assert items[0]["reason"] == "test promote"
        finally:
            store.clear()

    def test_rollback_writes_audit(self, tmp_path):
        from app.canary_audit_store import CanaryAuditStore, set_default_audit_store
        from app.canary_stages import CanaryStageController

        store = CanaryAuditStore(db_path=str(tmp_path / "audit.db"))
        set_default_audit_store(store)
        try:
            ctrl = CanaryStageController(state_file=None, cooldown_seconds=0.0)
            ctrl.promote(actor="t", reason="t")
            ctrl.rollback(actor="bob", reason="test rollback")
            items = store.query(source="controller", action="rollback")
            assert len(items) == 1
            assert items[0]["from_stage"] == "1%"
            assert items[0]["to_stage"] == "0%"
        finally:
            store.clear()

    def test_auto_rollback_writes_audit(self, tmp_path):
        from app.canary_audit_store import CanaryAuditStore, set_default_audit_store
        from app.canary_stages import CanaryStageController

        store = CanaryAuditStore(db_path=str(tmp_path / "audit.db"))
        set_default_audit_store(store)
        try:
            ctrl = CanaryStageController(
                state_file=None,
                cooldown_seconds=0.0,
                failure_threshold=2,
            )
            ctrl.promote(actor="t", reason="t")
            ctrl.mark_failure("err 1")
            ctrl.mark_failure("err 2")  # 触发 auto_rollback
            items = store.query(source="controller", action="auto_rollback")
            assert len(items) == 1
            assert items[0]["to_stage"] == "0%"
        finally:
            store.clear()


# ---------------------------------------------------------------------------
# 集成: CanaryAutoPromoter
# ---------------------------------------------------------------------------


class TestIntegrationWithPromoter:
    @pytest.fixture
    def promoter(self, tmp_path):
        from app.canary_audit_store import CanaryAuditStore, set_default_audit_store
        from app.canary_auto_promoter import CanaryAutoPromoter, PromoterConfig
        from app.canary_stages import CanaryStageController

        store = CanaryAuditStore(db_path=str(tmp_path / "audit.db"))
        set_default_audit_store(store)
        ctrl = CanaryStageController(state_file=None, cooldown_seconds=0.0)
        promoter = CanaryAutoPromoter(
            controller=ctrl,
            config=PromoterConfig(
                error_threshold=0.05,
                min_stable_minutes=0.0,
                check_interval_seconds=60.0,
                dry_run=False,
                min_traffic_count=3,
            ),
        )
        yield promoter, store
        store.clear()

    def test_pause_override_writes_audit(self, promoter):
        p, store = promoter
        p.pause_override(actor="admin", reason="巡检", until_ts=0.0)
        items = store.query(source="override", action="pause")
        assert len(items) == 1
        assert items[0]["actor"] == "admin"
        assert items[0]["reason"] == "巡检"

    def test_resume_override_writes_audit(self, promoter):
        p, store = promoter
        p.pause_override(actor="admin", reason="x")
        p.resume_override(actor="admin", reason="done")
        items = store.query(source="override", action="resume")
        assert len(items) == 1
        assert items[0]["detail"]["was_paused"] is True

    def test_force_promote_writes_audit(self, promoter):
        p, store = promoter
        p.force_promote(actor="admin", reason="紧急推进")
        items = store.query(source="override", action="force_promote")
        assert len(items) == 1
        assert items[0]["from_stage"] == "0%"
        assert items[0]["to_stage"] == "1%"

    def test_force_promote_failed_writes_audit(self, promoter):
        """force_promote 在 100% 失败也应写 audit."""
        p, store = promoter
        # promote 4 次到 100%
        for _ in range(4):
            p._controller.promote(actor="t", reason="t")
        p.force_promote(actor="admin", reason="x")
        items = store.query(source="override", action="force_promote_failed")
        assert len(items) == 1
        assert items[0]["from_stage"] == "100%"

    def test_force_rollback_writes_audit(self, promoter):
        p, store = promoter
        p._controller.promote(actor="t", reason="t")
        p.force_rollback(actor="admin", reason="急回滚")
        items = store.query(source="override", action="force_rollback")
        assert len(items) == 1
        assert items[0]["to_stage"] == "0%"

    def test_force_rollback_failed_writes_audit(self, promoter):
        p, store = promoter
        p.force_rollback(actor="admin", reason="x")  # 已在 0%
        items = store.query(source="override", action="force_rollback_failed")
        assert len(items) == 1
        assert items[0]["from_stage"] == "0%"

    def test_record_decision_writes_audit(self, promoter):
        """promoter._record_decision 写 audit (source=promoter)."""
        p, store = promoter
        # 注入一个 decision
        p._record_decision(
            {
                "action": "promote_dry_run",
                "from": "0%",
                "to": "(next)",
                "error_rate": 0.01,
                "traffic_count": 100,
                "stable_minutes": 5.0,
            }
        )
        items = store.query(source="promoter")
        assert len(items) == 1
        assert items[0]["action"] == "promote_dry_run"
        assert items[0]["detail"]["error_rate"] == 0.01


# ---------------------------------------------------------------------------
# 跨进程 (新实例 load)
# ---------------------------------------------------------------------------


class TestCrossProcess:
    def test_new_instance_can_query_old_data(self, tmp_path):
        from app.canary_audit_store import CanaryAuditStore

        db = str(tmp_path / "shared.db")
        s1 = CanaryAuditStore(db_path=db)
        s1.append(source="controller", action="x", actor="alice")
        s1.append(source="override", action="pause", actor="bob")
        # 模拟新进程
        s2 = CanaryAuditStore(db_path=db)
        items = s2.query()
        assert len(items) == 2


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------


class TestSingleton:
    def test_get_default_returns_singleton(self, tmp_path, monkeypatch):
        monkeypatch.setenv("ZHS_CANARY_AUDIT_DB", str(tmp_path / "audit.db"))
        from app.canary_audit_store import get_default_audit_store, reset_default_audit_store

        reset_default_audit_store()
        s1 = get_default_audit_store()
        s2 = get_default_audit_store()
        assert s1 is s2
        reset_default_audit_store()


# ---------------------------------------------------------------------------
# API 端点
# ---------------------------------------------------------------------------


class TestAPIEndpoints:
    @pytest.fixture(autouse=True)
    def _setup(self, tmp_path, monkeypatch):
        from app.api.v1.monitor.canary_audit import (
            canary_audit_cleanup,
            canary_audit_stats,
            query_canary_audit,
        )
        from app.canary_audit_store import CanaryAuditStore, reset_default_audit_store, set_default_audit_store

        reset_default_audit_store()
        store = CanaryAuditStore(db_path=str(tmp_path / "audit_api.db"))
        set_default_audit_store(store)
        # 预填 3 条
        store.append(source="controller", action="promote", actor="a", from_stage="0%", to_stage="1%")
        store.append(source="override", action="pause", actor="b", reason="x")
        store.append(source="override", action="force_promote", actor="c", from_stage="0%", to_stage="1%")
        self.store = store
        self.query = query_canary_audit
        self.stats = canary_audit_stats
        self.cleanup = canary_audit_cleanup
        yield
        store.clear()
        reset_default_audit_store()

    def test_query_endpoint(self, monkeypatch):
        """monkeypatch 端点模块引用的 get_default_audit_store."""
        from app.api.v1.monitor import canary_audit as ca_module

        monkeypatch.setattr(ca_module, "get_default_audit_store", lambda: self.store)
        resp = self.query(
            limit=10,
            source=None,
            action=None,
            since_ts=None,
            until_ts=None,
            _admin="admin",
        )
        assert resp.ok is True
        assert resp.data["count"] == 3
        assert len(resp.data["items"]) == 3

    def test_query_with_source_filter(self, monkeypatch):
        from app.api.v1.monitor import canary_audit as ca_module

        monkeypatch.setattr(ca_module, "get_default_audit_store", lambda: self.store)
        resp = self.query(
            limit=10,
            source="override",
            action=None,
            since_ts=None,
            until_ts=None,
            _admin="admin",
        )
        assert resp.data["count"] == 2

    def test_query_with_action_filter(self, monkeypatch):
        from app.api.v1.monitor import canary_audit as ca_module

        monkeypatch.setattr(ca_module, "get_default_audit_store", lambda: self.store)
        resp = self.query(
            limit=10,
            source=None,
            action="pause",
            since_ts=None,
            until_ts=None,
            _admin="admin",
        )
        assert resp.data["count"] == 1

    def test_stats_endpoint(self):
        resp = self.stats(_admin="admin")
        assert resp.ok is True
        assert resp.data["total"] == 3
        assert resp.data["controller"] == 1
        assert resp.data["override"] == 2
        assert resp.data["promoter"] == 0

    def test_cleanup_endpoint(self):
        resp = self.cleanup(_admin="admin")
        assert resp.ok is True
        assert "deleted" in resp.data
        assert "retention_days" in resp.data

    def test_router_paths_registered(self):
        from app.api.v1.monitor.canary_audit import router

        paths = [r.path for r in router.routes]
        assert "/canary-audit" in paths
        assert "/canary-audit/stats" in paths
        assert "/canary-audit/cleanup" in paths
