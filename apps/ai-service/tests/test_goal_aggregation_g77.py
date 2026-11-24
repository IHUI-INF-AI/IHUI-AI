# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""票 77「My Quests 跨 workspace 全局看板」服务端腿验收。

判据成对(任一条被删掉本文件必有红):
1. 聚合只给**属主精确相等**的行(别人的 / 没有 userId 的历史行都排除);
2. `goalState` 形状不合规的行**剔除**,不补默认值;
3. archived 排除;`set_thread_goal_state(None)` 之后同一行从聚合里消失(正反向成对);
4. limit 有上界;响应字段(threadId/sessionId/workspaceId/goal)与写入值同源。
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.routers import sessions as sessions_router
from app.routers.goal_verification import CriterionOut, _record_engine_assessment
from app.services.session_store import (
    MAX_GOAL_ASSESSMENTS,
    SessionStore,
    normalize_goal_assessments,
    normalize_goal_state,
)


@pytest.fixture()
def store(tmp_path: Path) -> SessionStore:
    s = SessionStore(tmp_path / "g77.db")
    yield s
    s.close()


def _make_goal(store: SessionStore, thread_id: str, *, objective: str, status: str = "active") -> None:
    state = normalize_goal_state({"status": status, "objective": objective, "updatedAt": 1.0})
    assert state is not None
    assert store.set_thread_goal_state(thread_id, state) is not None


def test_aggregates_only_owner_goal_threads(store: SessionStore) -> None:
    mine = store.create_thread(
        title="mine",
        metadata={"conversationId": "conv-mine", "workspaceId": "ws-1"},
        user_id="u1",
    )
    _make_goal(store, mine.thread_id, objective="发布 v1")
    other = store.create_thread(title="other", user_id="u2")
    _make_goal(store, other.thread_id, objective="别人的目标")
    no_owner = store.create_thread(title="legacy")
    _make_goal(store, no_owner.thread_id, objective="无属主历史行")
    plain = store.create_thread(title="plain", user_id="u1")
    _ = plain

    rows = store.list_goal_threads(owner_user_id="u1")

    assert [t.thread_id for t, _ in rows] == [mine.thread_id]
    assert rows[0][1]["objective"] == "发布 v1"


def test_malformed_goal_state_is_excluded_not_defaulted(store: SessionStore) -> None:
    bad_status = store.create_thread(title="bad-status", user_id="u1")
    store.update_thread_metadata(
        bad_status.thread_id,
        {"goalState": {"status": "not-a-status", "objective": "x"}},
        merge=True,
    )
    not_dict = store.create_thread(title="not-dict", user_id="u1")
    store.update_thread_metadata(
        not_dict.thread_id, {"goalState": ["oops"]}, merge=True
    )
    good = store.create_thread(title="good", user_id="u1")
    _make_goal(store, good.thread_id, objective="合规目标")

    rows = store.list_goal_threads(owner_user_id="u1")

    ids = [t.thread_id for t, _ in rows]
    assert ids == [good.thread_id]
    assert bad_status.thread_id not in ids
    assert not_dict.thread_id not in ids


def test_archived_and_cleared_are_absent_with_positive_control(store: SessionStore) -> None:
    archived = store.create_thread(title="archived", user_id="u1")
    _make_goal(store, archived.thread_id, objective="已归档目标")
    assert store.set_thread_archived(archived.thread_id, True) is True

    cleared = store.create_thread(title="cleared", user_id="u1")
    _make_goal(store, cleared.thread_id, objective="将被清除")

    before = [t.thread_id for t, _ in store.list_goal_threads(owner_user_id="u1")]
    assert cleared.thread_id in before
    assert archived.thread_id not in before

    assert store.set_thread_goal_state(cleared.thread_id, None) is not None
    after = [t.thread_id for t, _ in store.list_goal_threads(owner_user_id="u1")]
    assert cleared.thread_id not in after

    # 正向对照:重新写入同一个目标 ⇒ 该行回到聚合(证明上面是"因清除而消失",不是恒空)
    _make_goal(store, cleared.thread_id, objective="重新设定")
    again = [t.thread_id for t, _ in store.list_goal_threads(owner_user_id="u1")]
    assert cleared.thread_id in again


def test_limit_caps_result(store: SessionStore) -> None:
    for i in range(3):
        t = store.create_thread(title=f"t{i}", user_id="u1")
        _make_goal(store, t.thread_id, objective=f"目标{i}")
    rows = store.list_goal_threads(limit=2, owner_user_id="u1")
    assert len(rows) == 2


def test_route_projects_metadata_and_goal(store: SessionStore) -> None:
    with_meta = store.create_thread(
        title="带元数据",
        metadata={"conversationId": "conv-1", "workspaceId": "ws-9"},
        user_id="u1",
    )
    _make_goal(store, with_meta.thread_id, objective="目标 A", status="paused")
    without_meta = store.create_thread(title="缺元数据", user_id="u1")
    _make_goal(store, without_meta.thread_id, objective="目标 B")

    payload = sessions_router.list_goal_threads(limit=100, user_id="u1", store=store)

    assert payload["code"] == 0
    data = payload["data"]
    assert data["total"] == 2
    by_id = {row["threadId"]: row for row in data["goals"]}
    first = by_id[with_meta.thread_id]
    assert first["sessionId"] == "conv-1"
    assert first["workspaceId"] == "ws-9"
    assert first["title"] == "带元数据"
    assert first["goal"]["status"] == "paused"
    assert first["goal"]["objective"] == "目标 A"
    assert isinstance(first["createdAt"], float)
    assert isinstance(first["updatedAt"], float)
    second = by_id[without_meta.thread_id]
    assert second["sessionId"] == ""
    assert second["workspaceId"] == ""


# ---------------------------------------------------------------------------
# 引擎侧自动评估源(票77 第二格):append_goal_assessment + 路由投影 + 校验回灌
# ---------------------------------------------------------------------------


def _entry(aid: str, at: float, status: str = "active", progress: int = 0) -> dict[str, object]:
    return {"id": aid, "at": at, "status": status, "progress": progress, "summary": "", "source": "engine"}


def test_append_goal_assessment_requires_owner_and_goal_thread(store: SessionStore) -> None:
    goal_thread = store.create_thread(title="t", user_id="u1")
    _make_goal(store, goal_thread.thread_id, objective="目标")
    plain = store.create_thread(title="plain", user_id="u1")

    assert store.append_goal_assessment(goal_thread.thread_id, _entry("a1", 1.0), owner_user_id="u2") is None
    assert store.append_goal_assessment(goal_thread.thread_id, _entry("a1", 1.0), owner_user_id="") is None
    assert store.append_goal_assessment(plain.thread_id, _entry("a1", 1.0), owner_user_id="u1") is None
    assert store.append_goal_assessment("no-such-thread", _entry("a1", 1.0), owner_user_id="u1") is None
    assert store.get_thread(goal_thread.thread_id).metadata.get("goalAssessments") is None

    # 正向对照:属主逐字相等且是 goal 线程 ⇒ 落账(证明上面四条不是恒 None)
    history = store.append_goal_assessment(goal_thread.thread_id, _entry("a1", 1.0), owner_user_id="u1")
    assert history is not None and len(history) == 1
    assert history[0]["id"] == "a1"
    assert history[0]["source"] == "engine"


def test_append_goal_assessment_caps_and_advances_terminal_status(store: SessionStore) -> None:
    t = store.create_thread(title="t", user_id="u1")
    _make_goal(store, t.thread_id, objective="目标")
    history: list[dict[str, object]] | None = None
    for i in range(25):
        history = store.append_goal_assessment(t.thread_id, _entry(f"a{i}", float(i)), owner_user_id="u1")
    assert history is not None and len(history) == MAX_GOAL_ASSESSMENTS
    assert history[-1]["id"] == "a24"
    assert history[0]["id"] == "a5"

    # 非终态(None)不动状态机
    assert store.get_thread_goal_state(t.thread_id)["status"] == "active"
    done = store.append_goal_assessment(
        t.thread_id, _entry("done", 100.0, status="done", progress=100), owner_user_id="u1", goal_status="done"
    )
    assert done is not None and done[-1]["id"] == "done"
    state = store.get_thread_goal_state(t.thread_id)
    assert state is not None and state["status"] == "done"


def test_goal_clear_or_replacement_drops_stale_assessments(store: SessionStore) -> None:
    t = store.create_thread(title="t", user_id="u1")
    _make_goal(store, t.thread_id, objective="旧目标")
    assert store.append_goal_assessment(t.thread_id, _entry("a1", 1.0), owner_user_id="u1") is not None

    # pause/resume 同目标:轨迹保留
    paused = normalize_goal_state({"status": "paused", "objective": "旧目标", "updatedAt": 2.0})
    assert paused is not None
    assert store.set_thread_goal_state(t.thread_id, paused) is not None
    assert store.get_thread(t.thread_id).metadata.get("goalAssessments") is not None

    # 换目标:旧轨迹不属于新目标 ⇒ 同事务清除
    replacement = normalize_goal_state({"status": "active", "objective": "新目标", "updatedAt": 3.0})
    assert replacement is not None
    assert store.set_thread_goal_state(t.thread_id, replacement) is not None
    assert store.get_thread(t.thread_id).metadata.get("goalAssessments") is None

    # clear:轨迹随目标一起消失
    assert store.append_goal_assessment(t.thread_id, _entry("a2", 4.0), owner_user_id="u1") is not None
    assert store.set_thread_goal_state(t.thread_id, None) is not None
    meta = store.get_thread(t.thread_id).metadata
    assert "goalState" not in meta
    assert "goalAssessments" not in meta


def test_route_projects_normalized_assessments(store: SessionStore) -> None:
    t = store.create_thread(title="t", metadata={"conversationId": "conv-a"}, user_id="u1")
    _make_goal(store, t.thread_id, objective="目标")
    store.append_goal_assessment(t.thread_id, _entry("gv-1", 1_700_000_000_000.0, progress=60), owner_user_id="u1")
    # 坏项(未知状态 / 空 id)不落账:投影里只剩合规那条
    assert store.append_goal_assessment(
        t.thread_id, {"id": "bad", "at": 2.0, "status": "nope", "progress": 0, "summary": ""}, owner_user_id="u1"
    ) is None

    payload = sessions_router.list_goal_threads(limit=100, user_id="u1", store=store)
    row = payload["data"]["goals"][0]
    assert [a["id"] for a in row["assessments"]] == ["gv-1"]
    assert row["assessments"][0]["progress"] == 60
    assert row["assessments"][0]["source"] == "engine"


def test_normalize_goal_assessments_drops_bad_items() -> None:
    out = normalize_goal_assessments(
        [
            {"id": "ok", "at": 1.5, "status": "active", "progress": 42, "summary": "s"},
            {"id": "bad-status", "at": 2, "status": "nope"},
            {"id": "", "at": 3, "status": "done"},
            "junk",
        ]
    )
    assert [a["id"] for a in out] == ["ok"]
    assert out[0]["progress"] == 42
    assert out[0]["source"] == "engine"


def test_record_engine_assessment_writes_back_on_achieved_and_blocked(
    store: SessionStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(sessions_router, "get_session_store", lambda: store)
    achieved = store.create_thread(title="t", metadata={"conversationId": "conv-ok"}, user_id="u1")
    _make_goal(store, achieved.thread_id, objective="目标 A")
    blocked = store.create_thread(title="b", metadata={"conversationId": "conv-blocked"}, user_id="u1")
    _make_goal(store, blocked.thread_id, objective="目标 B")
    plain = store.create_thread(title="p", metadata={"conversationId": "conv-plain"}, user_id="u1")

    views = [
        CriterionOut(criterion_id="c1", verdict="met", basis="observed", reason="ok"),
        CriterionOut(criterion_id="c2", verdict="unmet", basis="observed", reason="缺"),
    ]
    _record_engine_assessment(
        session_id="conv-ok", principal="u1", result_status="achieved", blocked=False, views=views
    )
    state = store.get_thread_goal_state(achieved.thread_id)
    assert state is not None and state["status"] == "done"
    history = store.get_thread(achieved.thread_id).metadata.get("goalAssessments")
    assert isinstance(history, list) and len(history) == 1
    assert history[0]["status"] == "done"
    assert history[0]["progress"] == 50
    assert history[0]["summary"] == "独立校验:成立 1/2 条(未成立 1,未判定 0)"

    # 他人主体:静默跳过,副作用没发生
    _record_engine_assessment(
        session_id="conv-blocked", principal="u2", result_status="undetermined", blocked=True, views=views
    )
    blocked_state = store.get_thread_goal_state(blocked.thread_id)
    assert blocked_state is not None and blocked_state["status"] == "active"
    assert store.get_thread(blocked.thread_id).metadata.get("goalAssessments") is None
    # 正向对照:同一线程换合法主体 ⇒ 阻塞终态落库
    _record_engine_assessment(
        session_id="conv-blocked", principal="u1", result_status="undetermined", blocked=True, views=views
    )
    blocked_state = store.get_thread_goal_state(blocked.thread_id)
    assert blocked_state is not None and blocked_state["status"] == "blocked"

    # 非 goal 线程 / 不存在的会话:不落账
    _record_engine_assessment(
        session_id="conv-plain", principal="u1", result_status="achieved", blocked=False, views=views
    )
    _record_engine_assessment(
        session_id="conv-missing", principal="u1", result_status="achieved", blocked=False, views=views
    )
    assert store.get_thread(plain.thread_id).metadata.get("goalAssessments") is None


def test_create_and_metadata_write_cannot_inject_assessments(store: SessionStore) -> None:
    forged = {"goalAssessments": [{"id": "forged", "at": 1.0, "status": "active"}]}
    t = store.create_thread(title="t", metadata=forged, user_id="u1")
    assert "goalAssessments" not in t.metadata
    _make_goal(store, t.thread_id, objective="目标")
    store.append_goal_assessment(t.thread_id, _entry("real", 1.0), owner_user_id="u1")
    # 客户端整写(merge=False)也改不动/抹不掉:以库内那份为准
    meta = store.update_thread_metadata(t.thread_id, forged, merge=False)
    assert meta is not None
    assert [a["id"] for a in meta["goalAssessments"]] == ["real"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
