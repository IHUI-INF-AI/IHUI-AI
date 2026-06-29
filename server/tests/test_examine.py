"""Examine 模块 10 个 endpoint 单元测试 (Round 21 补齐).

覆盖:
  1. GET  /list                       列表 (含 status_list 多状态筛选 + JOIN category)
  2. GET  /stats/summary              统计 (状态分布 + 近7天 + 审核效率)
  3. POST /submit                     提交审核 (含 agents 表自动补全)
  4. POST /examine/batch-sync-avatar  批量头像同步 (auto + manual 模式)
  5. POST /examine/sync-avatar/{aid}  单智能体头像同步
  6. PUT  /examine/{record_id}        通用更新 (状态变更触发 examine_time)
  7. DELETE /examine/{record_id}      删除审核记录
  8. GET  /{record_id}                详情
  9. PUT  /{record_id}/approve        审核通过 (status=2 + 同步 agent.publish_status)
  10. PUT /{record_id}/reject         审核拒绝 (status=3)

实现策略:
  - dependency_overrides[require_login] 绕过认证
  - 临时 SQLite + Base.metadata.create_all 建真实表
  - patch app.api.v1.agents.examine.get_session 返回临时 session 上下文
"""
from __future__ import annotations

from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pytest


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def examine_db(tmp_path):
    """临时 SQLite + AgentExamine/AgentCategory/Agent 真实表 + get_session patch.

    返回 (engine, SessionClass) 元组, 测试用同一 SessionClass 插入数据,
    避免不同 Session 类的连接池/事务隔离导致看不到数据.
    使用 StaticPool 强制单连接, 确保 commit 后所有 session 立即可见.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from app.database import Base
    from app.models.activity_models import AgentCategory, AgentExamine
    from app.models.agent_models import Agent

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        engine,
        tables=[AgentExamine.__table__, AgentCategory.__table__, Agent.__table__],
    )
    Session = sessionmaker(bind=engine, expire_on_commit=False)

    class _Ctx:
        def __enter__(self):
            self.session = Session()
            return self.session

        def __exit__(self, *a):
            self.session.close()

    ctx_instance = _Ctx()
    with patch("app.api.v1.agents.examine.get_session", return_value=ctx_instance):
        yield engine, Session


@pytest.fixture
def auth_override():
    """覆盖 require_login 依赖, 模拟已登录用户."""
    from app.main import app
    from app.security import require_login

    def _fake_user():
        return "u-test-examine"

    app.dependency_overrides[require_login] = _fake_user
    yield "u-test-examine"
    app.dependency_overrides.pop(require_login, None)


def _insert_examine(session, **kwargs):
    """插入一条 AgentExamine 记录, 默认值兼容必填字段."""
    from app.models.activity_models import AgentExamine

    defaults = {
        "agent_id": "agent-001",
        "agent_name": "测试智能体",
        "agent_avatar": "https://example.com/a.png",
        "prologue": "你好",
        "status": 0,
        "start_time": datetime.now(),
        "start_user": "u-test-examine",
        "start_phone": "13800000000",
        "start_name": "测试发起人",
    }
    defaults.update(kwargs)
    rec = AgentExamine(**defaults)
    session.add(rec)
    session.commit()
    session.refresh(rec)
    return rec


# ---------------------------------------------------------------------------
# 1. GET /list
# ---------------------------------------------------------------------------


class TestListExamine:
    def test_list_empty(self, sync_client, examine_db, auth_override):
        """空表查询返回空列表 + total=0."""
        r = sync_client.get("/api/v1/agents/examine/list?page=1&limit=10")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["data"] == []
        assert body["total"] == 0

    def test_list_with_data(self, sync_client, examine_db, auth_override):
        """插入 2 条后查询返回 total=2. Round 22 路由重构 /examine/list 后解锁."""
        from sqlalchemy.orm import sessionmaker

        engine, Session = examine_db
        s = Session()
        try:
            _insert_examine(s, agent_id="a1")
            _insert_examine(s, agent_id="a2")
        finally:
            s.close()

        r = sync_client.get("/api/v1/agents/examine/list?page=1&limit=10")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] == 2
        assert len(body["data"]) == 2

    def test_list_filter_by_status(self, sync_client, examine_db, auth_override):
        """status 筛选准确. Round 22 路由重构后解锁."""
        from sqlalchemy.orm import sessionmaker

        engine, Session = examine_db
        s = Session()
        try:
            _insert_examine(s, agent_id="a1", status=0)
            _insert_examine(s, agent_id="a2", status=2)
        finally:
            s.close()

        r = sync_client.get("/api/v1/agents/examine/list?status=2")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] == 1
        assert body["data"][0]["agent_id"] == "a2"

    def test_list_status_list_multi(self, sync_client, examine_db, auth_override):
        """status_list 多状态筛选 (逗号分隔)."""
        from sqlalchemy.orm import sessionmaker

        engine, Session = examine_db
        s = Session()
        try:
            _insert_examine(s, agent_id="a1", status=0)
            _insert_examine(s, agent_id="a2", status=2)
            _insert_examine(s, agent_id="a3", status=3)
        finally:
            s.close()

        r = sync_client.get("/api/v1/agents/examine/list?status_list=2,3")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] == 2


# ---------------------------------------------------------------------------
# 2. GET /stats/summary
# ---------------------------------------------------------------------------


class TestExamineStats:
    def test_stats_empty(self, sync_client, examine_db, auth_override):
        """空表统计: total=0, distribution 全 0."""
        r = sync_client.get("/api/v1/agents/examine/stats/summary")
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["total_records"] == 0
        for name in ("pending", "examining", "approved", "rejected", "returned", "delisted"):
            assert body["status_distribution"][name]["count"] == 0

    def test_stats_with_data(self, sync_client, examine_db, auth_override):
        """有数据时统计正确."""
        from sqlalchemy.orm import sessionmaker

        engine, Session = examine_db
        s = Session()
        try:
            _insert_examine(s, agent_id="a1", status=0)
            _insert_examine(s, agent_id="a2", status=2)
            _insert_examine(s, agent_id="a3", status=3)
        finally:
            s.close()

        r = sync_client.get("/api/v1/agents/examine/stats/summary")
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["total_records"] == 3
        assert body["status_distribution"]["pending"]["count"] == 1
        assert body["status_distribution"]["approved"]["count"] == 1
        assert body["status_distribution"]["rejected"]["count"] == 1


# ---------------------------------------------------------------------------
# 3. POST /submit
# ---------------------------------------------------------------------------


class TestSubmitExamine:
    def test_submit_with_full_body(self, sync_client, examine_db, auth_override):
        """完整 body 提交成功, status 默认 1 (审核中)."""
        r = sync_client.post(
            "/api/v1/agents/examine/submit?agent_id=agent-new",
            json={
                "agent_name": "新智能体",
                "agent_avatar": "https://example.com/new.png",
                "prologue": "你好",
                "category_id": "cat-1",
                "status": 1,
                "start_name": "张三",
                "desc": "审核备注",
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["agent_id"] == "agent-new"
        assert body["agent_name"] == "新智能体"
        assert body["status"] == 1

    def test_submit_default_status_is_1(self, sync_client, examine_db, auth_override):
        """未传 status 时默认 1 (审核中)."""
        r = sync_client.post(
            "/api/v1/agents/examine/submit?agent_id=agent-default",
            json={"agent_name": "默认状态"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["data"]["status"] == 1

    def test_submit_auto_fill_from_agents_table(self, sync_client, examine_db, auth_override):
        """body 缺 agent_name/avatar/prologue 时, 从 agents 表自动补全."""
        from sqlalchemy.orm import sessionmaker

        from app.models.agent_models import Agent

        engine, Session = examine_db
        s = Session()
        try:
            s.add(Agent(
                agent_id="agent-auto",
                agent_name="自动补全名称",
                agent_avatar="https://example.com/auto.png",
                prologue="自动开场白",
            ))
            s.commit()
        finally:
            s.close()

        r = sync_client.post(
            "/api/v1/agents/examine/submit?agent_id=agent-auto",
            json={},
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["agent_name"] == "自动补全名称"
        assert body["agent_avatar"] == "https://example.com/auto.png"
        assert body["prologue"] == "自动开场白"


# ---------------------------------------------------------------------------
# 4. POST /examine/batch-sync-avatar
# ---------------------------------------------------------------------------


class TestBatchSyncAvatar:
    def test_batch_empty_agent_ids_no_records(self, sync_client, examine_db, auth_override):
        """无 agent_ids 且无缺失记录时返回 total=0."""
        r = sync_client.post(
            "/api/v1/agents/examine/batch-sync-avatar",
            json={},
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["total"] == 0
        assert body["success_count"] == 0

    def test_batch_auto_mode_picks_missing_avatar(
        self, sync_client, examine_db, auth_override
    ):
        """auto 模式找出 agent_avatar 为空的记录, 从 agents 表同步."""
        from sqlalchemy.orm import sessionmaker

        from app.models.agent_models import Agent

        engine, Session = examine_db
        s = Session()
        try:
            s.add(Agent(
                agent_id="agent-x",
                agent_name="X",
                agent_avatar="https://example.com/x.png",
                prologue="p",
            ))
            _insert_examine(s, agent_id="agent-x", agent_avatar=None)
            s.commit()
        finally:
            s.close()

        r = sync_client.post(
            "/api/v1/agents/examine/batch-sync-avatar",
            json={},
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["auto_mode"] is True
        assert body["success_count"] == 1

    def test_batch_manual_mode(self, sync_client, examine_db, auth_override):
        """显式传 agent_ids 时走 manual 模式."""
        from sqlalchemy.orm import sessionmaker

        from app.models.agent_models import Agent

        engine, Session = examine_db
        s = Session()
        try:
            s.add(Agent(
                agent_id="agent-y",
                agent_name="Y",
                agent_avatar="https://example.com/y.png",
                prologue="p",
            ))
            _insert_examine(s, agent_id="agent-y")
            s.commit()
        finally:
            s.close()

        r = sync_client.post(
            "/api/v1/agents/examine/batch-sync-avatar",
            json={"agent_ids": ["agent-y"]},
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["auto_mode"] is False
        assert body["success_count"] == 1


# ---------------------------------------------------------------------------
# 5. POST /examine/sync-avatar/{agent_id}
# ---------------------------------------------------------------------------


class TestSyncSingleAvatar:
    def test_sync_avatar_success(self, sync_client, examine_db, auth_override):
        """单智能体头像同步成功."""
        from sqlalchemy.orm import sessionmaker

        from app.models.agent_models import Agent

        engine, Session = examine_db
        s = Session()
        try:
            s.add(Agent(
                agent_id="agent-single",
                agent_name="S",
                agent_avatar="https://example.com/s.png",
                prologue="p",
            ))
            _insert_examine(s, agent_id="agent-single", agent_avatar=None)
            s.commit()
        finally:
            s.close()

        r = sync_client.post("/api/v1/agents/examine/sync-avatar/agent-single")
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["agent_id"] == "agent-single"
        assert body["updated_count"] == 1

    def test_sync_avatar_agent_not_found(self, sync_client, examine_db, auth_override):
        """agent 不存在返回 404."""
        r = sync_client.post("/api/v1/agents/examine/sync-avatar/no-such-agent")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["code"] == "404000"


# ---------------------------------------------------------------------------
# 6. PUT /examine/{record_id}
# ---------------------------------------------------------------------------


class TestUpdateExamine:
    def test_update_status_triggers_examine_time(
        self, sync_client, examine_db, auth_override
    ):
        """status 变更为 2/3/4 时自动设置 examine_time."""
        from sqlalchemy.orm import sessionmaker

        engine, Session = examine_db
        s = Session()
        try:
            rec = _insert_examine(s, agent_id="a-upd", status=0)
            record_id = rec.id
        finally:
            s.close()

        r = sync_client.put(
            f"/api/v1/agents/examine/{record_id}",
            json={"status": 2, "desc": "审核通过"},
        )
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["status"] == 2
        assert body["desc"] == "审核通过"

    def test_update_not_found(self, sync_client, examine_db, auth_override):
        """不存在的 record_id 返回 404."""
        r = sync_client.put(
            "/api/v1/agents/examine/99999",
            json={"status": 2},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["code"] == "404000"


# ---------------------------------------------------------------------------
# 7. DELETE /examine/{record_id}
# ---------------------------------------------------------------------------


class TestDeleteExamine:
    def test_delete_success(self, sync_client, examine_db, auth_override):
        """删除成功."""
        from sqlalchemy.orm import sessionmaker

        engine, Session = examine_db
        s = Session()
        try:
            rec = _insert_examine(s, agent_id="a-del")
            record_id = rec.id
        finally:
            s.close()

        r = sync_client.delete(f"/api/v1/agents/examine/{record_id}")
        assert r.status_code == 200, r.text
        assert r.json()["data"]["id"] == record_id

    def test_delete_not_found(self, sync_client, examine_db, auth_override):
        """删除不存在的记录返回 404."""
        r = sync_client.delete("/api/v1/agents/examine/99999")
        body = r.json()
        assert body["code"] == "404000"


# ---------------------------------------------------------------------------
# 8. GET /{record_id}
# ---------------------------------------------------------------------------


class TestGetExamineDetail:
    def test_get_detail_success(self, sync_client, examine_db, auth_override):
        """获取详情成功. Round 22 路由重构 /examine/{record_id} 后解锁."""
        from sqlalchemy.orm import sessionmaker

        engine, Session = examine_db
        s = Session()
        try:
            rec = _insert_examine(s, agent_id="a-det", agent_name="详情测试")
            record_id = rec.id
        finally:
            s.close()

        r = sync_client.get(f"/api/v1/agents/examine/{record_id}")
        assert r.status_code == 200, r.text
        body = r.json()["data"]
        assert body["id"] == record_id
        assert body["agent_name"] == "详情测试"

    def test_get_detail_not_found(self, sync_client, examine_db, auth_override):
        """不存在的 record_id 返回 404. Round 22 路由重构后解锁."""
        r = sync_client.get("/api/v1/agents/examine/99999")
        body = r.json()
        assert body["code"] == "404000"


# ---------------------------------------------------------------------------
# 9. PUT /{record_id}/approve
# ---------------------------------------------------------------------------


class TestApproveExamine:
    def test_approve_success_sets_status_2(
        self, sync_client, examine_db, auth_override
    ):
        """approve 后 status=2 (通过, 修复 Round 19 状态值反转 bug)."""
        from sqlalchemy.orm import sessionmaker

        engine, Session = examine_db
        s = Session()
        try:
            rec = _insert_examine(s, agent_id="a-appr", status=1)
            record_id = rec.id
        finally:
            s.close()

        r = sync_client.put(
            f"/api/v1/agents/examine/{record_id}/approve",
            json={"remark": "审核通过备注"},
        )
        assert r.status_code == 200, r.text

        # 验证 DB 中 status=2 (不是历史误用的 1)
        s2 = Session()
        try:
            from app.models.activity_models import AgentExamine

            updated = s2.query(AgentExamine).filter(AgentExamine.id == record_id).first()
            assert updated.status == 2  # 修复后: 2=approved, 不是 1=examining
            assert updated.desc == "审核通过备注"
        finally:
            s2.close()

    def test_approve_already_approved(self, sync_client, examine_db, auth_override):
        """已通过的记录再次 approve 返回 400."""
        from sqlalchemy.orm import sessionmaker

        engine, Session = examine_db
        s = Session()
        try:
            rec = _insert_examine(s, agent_id="a-appr-2", status=2)
            record_id = rec.id
        finally:
            s.close()

        r = sync_client.put(
            f"/api/v1/agents/examine/{record_id}/approve",
            json={"remark": "再次通过"},
        )
        body = r.json()
        assert body["code"] == "400000"


# ---------------------------------------------------------------------------
# 10. PUT /{record_id}/reject
# ---------------------------------------------------------------------------


class TestRejectExamine:
    def test_reject_success_sets_status_3(
        self, sync_client, examine_db, auth_override
    ):
        """reject 后 status=3 (拒绝, 修复 Round 19 状态值反转 bug)."""
        from sqlalchemy.orm import sessionmaker

        engine, Session = examine_db
        s = Session()
        try:
            rec = _insert_examine(s, agent_id="a-rej", status=1)
            record_id = rec.id
        finally:
            s.close()

        r = sync_client.put(
            f"/api/v1/agents/examine/{record_id}/reject",
            json={"reject_reason": "内容不合规"},
        )
        assert r.status_code == 200, r.text

        # 验证 DB 中 status=3 (不是历史误用的 2)
        s2 = Session()
        try:
            from app.models.activity_models import AgentExamine

            updated = s2.query(AgentExamine).filter(AgentExamine.id == record_id).first()
            assert updated.status == 3  # 修复后: 3=rejected, 不是 2=approved
            assert updated.desc == "内容不合规"
        finally:
            s2.close()

    def test_reject_already_rejected(self, sync_client, examine_db, auth_override):
        """已拒绝的记录再次 reject 返回 400."""
        from sqlalchemy.orm import sessionmaker

        engine, Session = examine_db
        s = Session()
        try:
            rec = _insert_examine(s, agent_id="a-rej-2", status=3)
            record_id = rec.id
        finally:
            s.close()

        r = sync_client.put(
            f"/api/v1/agents/examine/{record_id}/reject",
            json={"reject_reason": "再次拒绝"},
        )
        body = r.json()
        assert body["code"] == "400000"
