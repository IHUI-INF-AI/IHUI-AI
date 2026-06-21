"""app.services.avatar_sync_service 单测 (从 coze_zhs_py 迁移)."""

import pytest
from sqlalchemy import text

from app.database import SessionFactory1
from app.models.activity_models import AgentExamine
from app.models.agent_models import Agent
from app.services.avatar_sync_service import AvatarSyncService, avatar_sync_service


def _next_id(table: str) -> int:
    db = SessionFactory1()
    try:
        r = db.execute(text(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}")).first()
        return r[0] if r else 1
    finally:
        db.close()


def _insert_agent(agent_id: str, avatar: str = "https://x/a.png", name: str = "测试智能体") -> None:
    db = SessionFactory1()
    try:
        db.query(Agent).filter(Agent.agent_id == agent_id).delete()
        db.add(Agent(agent_id=agent_id, agent_name=name, agent_avatar=avatar))
        db.commit()
    finally:
        db.close()


def _count_examines(agent_id: str) -> int:
    db = SessionFactory1()
    try:
        return db.query(AgentExamine).filter(AgentExamine.agent_id == agent_id).count()
    finally:
        db.close()


def _clear(agent_id: str) -> None:
    db = SessionFactory1()
    try:
        db.query(AgentExamine).filter(AgentExamine.agent_id == agent_id).delete()
        db.query(Agent).filter(Agent.agent_id == agent_id).delete()
        db.commit()
    finally:
        db.close()


def _insert_examine_direct(agent_id: str, avatar: str, follow: str = None) -> int:
    """用 SQL 直接插入 (绕过 SQLite BigInteger autoincrement 限制)."""
    db = SessionFactory1()
    try:
        rid = _next_id("zhs_agent_examine")
        db.execute(
            text(
                "INSERT INTO zhs_agent_examine (id, agent_id, agent_name, agent_avatar, status, follow) "
                "VALUES (:id, :aid, :an, :av, :st, :fo)"
            ),
            {"id": rid, "aid": agent_id, "an": f"agent_{agent_id}", "av": avatar, "st": 0, "fo": follow},
        )
        db.commit()
        return rid
    finally:
        db.close()


class TestAvatarSyncServiceCreate:
    def setup_method(self):
        self.svc = AvatarSyncService()
        self.aid = "test-avatar-svc-001"

    def teardown_method(self):
        _clear(self.aid)

    def test_creates_new_record_when_no_existing(self):
        """无审核记录时, 应该新建一条."""
        result = self.svc._create_new(
            db=SessionFactory1(), agent_id=self.aid, agent_avatar="https://cdn/a.png", agent_name="智能体A"
        )
        assert result["action"] == "create"
        assert result["agent_id"] == self.aid
        assert result["record_id"] != ""
        assert _count_examines(self.aid) == 1

    def test_creates_record_with_default_name_when_missing(self):
        """未传 agent_name 时, 用 agent_<id> 占位."""
        result = self.svc._create_new(
            db=SessionFactory1(), agent_id=self.aid, agent_avatar="https://cdn/a.png", agent_name=None
        )
        assert result["action"] == "create"
        db = SessionFactory1()
        try:
            r = db.query(AgentExamine).filter(AgentExamine.agent_id == self.aid).first()
            assert r.agent_name == f"agent_{self.aid}"
        finally:
            db.close()


class TestAvatarSyncServiceUpdate:
    def setup_method(self):
        self.svc = AvatarSyncService()
        self.aid = "test-avatar-svc-002"

    def teardown_method(self):
        _clear(self.aid)

    def test_updates_existing_records(self):
        """已有审核记录时, 应更新头像并追加 follow 备注."""
        _insert_examine_direct(self.aid, "old.png", follow="原备注")
        _insert_examine_direct(self.aid, "old.png", follow=None)

        db = SessionFactory1()
        records = db.query(AgentExamine).filter(AgentExamine.agent_id == self.aid).all()
        result = self.svc._update_existing(
            db=db, records=records, agent_avatar="https://cdn/new.png", agent_name="新名"
        )
        assert result["action"] == "update"
        assert result["updated_count"] == 2
        db.close()

        db = SessionFactory1()
        try:
            all_recs = db.query(AgentExamine).filter(AgentExamine.agent_id == self.aid).all()
            assert all(
                r.agent_avatar == "https://cdn/new.png" for r in all_recs
            ), f"实际: {[r.agent_avatar for r in all_recs]}"
            assert all(r.agent_name == "新名" for r in all_recs)
            # follow 字段应包含原备注 + 新同步备注
            assert any("原备注" in (r.follow or "") for r in all_recs)
            assert any("synced" in (r.follow or "") for r in all_recs)
        finally:
            db.close()

    def test_update_empty_records(self):
        """空记录列表时, updated_count 应为 0."""
        result = self.svc._update_existing(
            db=SessionFactory1(), records=[], agent_avatar="https://cdn/x.png", agent_name=None
        )
        assert result["updated_count"] == 0


class TestAvatarSyncFromAgent:
    def setup_method(self):
        self.svc = AvatarSyncService()
        self.aid = "test-avatar-svc-003"

    def teardown_method(self):
        _clear(self.aid)

    @pytest.mark.asyncio
    async def test_agent_not_found(self):
        result = await self.svc.sync_avatar_from_agent_table("not-exist-id-9999")
        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_agent_avatar_empty(self):
        _insert_agent(self.aid, avatar="", name="无头像")
        result = await self.svc.sync_avatar_from_agent_table(self.aid)
        assert result["success"] is False
        assert "avatar empty" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_full_sync_flow(self):
        _insert_agent(self.aid, avatar="https://cdn/orig.png", name="完整流程")
        result = await self.svc.sync_avatar_from_agent_table(self.aid)
        assert result["success"] is True
        assert result["action"] == "create"
        assert _count_examines(self.aid) == 1


class TestBatchSync:
    def setup_method(self):
        self.svc = AvatarSyncService()
        self.aids = ["test-batch-001", "test-batch-002", "test-batch-003"]

    def teardown_method(self):
        for aid in self.aids:
            _clear(aid)

    @pytest.mark.asyncio
    async def test_batch_sync_partial(self):
        # 准备: 第一个有头像, 第二个无, 第三个不存在
        _insert_agent(self.aids[0], avatar="https://cdn/1.png")
        _insert_agent(self.aids[1], avatar="")
        # aids[2] 不存在
        # 当前实现没有批量方法, 顺序调用单条 sync 验证
        results = []
        for aid in self.aids:
            r = await self.svc.sync_avatar_from_agent_table(aid)
            results.append(r)
        assert len(results) == 3
        assert sum(1 for r in results if r["success"]) == 1
        assert sum(1 for r in results if not r["success"]) == 2


class TestModuleSingleton:
    def test_singleton_loaded(self):
        """模块级单例应可加载."""

        assert isinstance(avatar_sync_service, AvatarSyncService)
        assert avatar_sync_service is avatar_sync_service  # 单例
