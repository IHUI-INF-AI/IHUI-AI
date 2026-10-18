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
from app.services.session_store import SessionStore, normalize_goal_state


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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
