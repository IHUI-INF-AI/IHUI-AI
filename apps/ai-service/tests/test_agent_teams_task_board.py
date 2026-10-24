# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D121 片一:团队共享任务列表 + 换手事件。

覆盖:
- 任务增删改查(含落盘后重新加载 —— "内存改完就算数"是假绿)
- 并发认领唯一(8 个协程同时 claim,只有一个赢家)
- 换手事件形状(owner 变更才发;认领发;改标题/状态不发;载荷键集固定)
- 非法输入拒绝(多余字段 / 空标题 / 非 kanban 状态词 → 422)
- 路由信封(404 找不到 / 409 已被认领 / 成功 code 0)
"""

from __future__ import annotations

import asyncio

import pytest

from app.routers import team_orchestration as team_router_module
from app.services.agent_teams import (
    TEAM_HANDOFF_EVENT_TYPE,
    TeamTaskBoard,
)


class _RecordingSink:
    """记录换手事件的内存出口(替代编排事件总线,避免测试打 Redis)。"""

    def __init__(self) -> None:
        self.events: list[tuple[str, dict]] = []

    async def __call__(self, event_type: str, payload: dict) -> str:
        self.events.append((event_type, payload))
        return f"evt-{len(self.events)}"


def _board(tmp_path, sink=None) -> TeamTaskBoard:
    return TeamTaskBoard(file_path=tmp_path / "team_tasks.json", sink=sink)


# =============================================================================
# 增删改查
# =============================================================================


async def test_task_crud_roundtrip_survives_reload(tmp_path):
    """建 → 列 → 读 → 改 → 删;并断言换实例后仍读得到(真落了盘)。"""
    store = _board(tmp_path)
    created = store.create("team-a", "写协议文档", owner="alice")
    assert created.id.startswith("tt-")
    assert created.status == "todo"
    assert created.owner == "alice"
    assert created.updated_at != ""

    listed = store.list_tasks("team-a")
    assert [t.id for t in listed] == [created.id]
    # 团队隔离:别的团队看不到
    assert store.list_tasks("team-b") == []

    fetched = store.get_task("team-a", created.id)
    assert fetched is not None and fetched.title == "写协议文档"
    # 团队不匹配按"找不到"处理,不跨团队泄露
    assert store.get_task("team-b", created.id) is None

    updated = await store.update(
        "team-a", created.id, title="写协议文档 v2", status="blocked"
    )
    assert updated.ok is True
    assert updated.task is not None
    assert updated.task.title == "写协议文档 v2"
    assert updated.task.status == "blocked"
    assert updated.task.owner == "alice"  # 未给的字段不动

    reloaded = _board(tmp_path)
    again = reloaded.get_task("team-a", created.id)
    assert again is not None
    assert again.title == "写协议文档 v2"
    assert again.status == "blocked"

    assert reloaded.delete("team-a", created.id) is True
    assert reloaded.get_task("team-a", created.id) is None
    assert reloaded.delete("team-a", created.id) is False  # 重复删不谎报成功
    assert _board(tmp_path).list_tasks("team-a") == []  # 删除也落了盘


# =============================================================================
# 并发认领唯一
# =============================================================================


async def test_concurrent_claim_has_exactly_one_winner(tmp_path):
    """8 个成员同时认领同一任务 → 恰好 1 个 claimed,其余 409 语义。"""
    store = _board(tmp_path)
    task = store.create("team-a", "抢这张票")

    outcomes = await asyncio.gather(
        *(store.claim("team-a", task.id, f"agent-{i}") for i in range(8))
    )
    winners = [o for o in outcomes if o.ok]
    losers = [o for o in outcomes if not o.ok]

    assert len(winners) == 1
    assert len(losers) == 7
    assert {o.reason for o in losers} == {"already_claimed"}
    owner = winners[0].task.owner if winners[0].task else ""
    assert store.get_task("team-a", task.id).owner == owner  # type: ignore[union-attr]
    # 认领即开工:待执行档推进到 in_progress
    assert store.get_task("team-a", task.id).status == "in_progress"  # type: ignore[union-attr]


async def test_claim_is_idempotent_for_same_owner(tmp_path):
    """同一持有者重复认领 = 成功且不重复发事件(否则事件流里会出现假换手)。"""
    sink = _RecordingSink()
    store = _board(tmp_path, sink=sink)
    task = store.create("team-a", "重复认领")

    first = await store.claim("team-a", task.id, "alice")
    second = await store.claim("team-a", task.id, "alice")
    assert first.reason == "claimed"
    assert second.ok is True and second.reason == "already_owned"
    assert len(sink.events) == 1


# =============================================================================
# 换手事件形状
# =============================================================================


async def test_handoff_event_shape_on_owner_change(tmp_path):
    """owner 变更 → 发 `subagent.handoff`,载荷键集与来源/去向逐字可判。"""
    sink = _RecordingSink()
    store = _board(tmp_path, sink=sink)
    task = store.create("team-a", "换手任务", owner="alice")

    mutation = await store.update(
        "team-a", task.id, owner="bob", reason="alice 受阻,转给 bob"
    )
    assert mutation.ok is True
    assert len(sink.events) == 1

    event_type, payload = sink.events[0]
    assert event_type == TEAM_HANDOFF_EVENT_TYPE == "subagent.handoff"
    assert set(payload.keys()) == {
        "handoff_id",
        "team_id",
        "task_id",
        "task_title",
        "from_owner",
        "to_owner",
        "status",
        "reason",
        "at",
    }
    assert payload["team_id"] == "team-a"
    assert payload["task_id"] == task.id
    assert payload["task_title"] == "换手任务"
    assert payload["from_owner"] == "alice"
    assert payload["to_owner"] == "bob"
    assert payload["reason"] == "alice 受阻,转给 bob"
    assert payload["handoff_id"].startswith("ho-")
    assert payload["at"]  # ISO 时刻非空


async def test_no_handoff_when_owner_unchanged_and_release_emits(tmp_path):
    """改标题/状态不发事件;把 owner 释放成空串算一次换手(空的去向要如实发)。"""
    sink = _RecordingSink()
    store = _board(tmp_path, sink=sink)
    task = store.create("team-a", "标题任务", owner="alice")

    await store.update("team-a", task.id, title="改标题", status="done")
    assert sink.events == []

    released = await store.update("team-a", task.id, owner="", reason="alice 完成并释放")
    assert released.ok is True
    assert released.task is not None and released.task.owner == ""
    assert len(sink.events) == 1
    _, payload = sink.events[0]
    assert payload["from_owner"] == "alice"
    assert payload["to_owner"] == ""


async def test_claim_emits_handoff_from_empty_owner(tmp_path):
    """认领 = 从"无人持有"换到某人,事件 from_owner 为空串(不是漏字段)。"""
    sink = _RecordingSink()
    store = _board(tmp_path, sink=sink)
    task = store.create("team-a", "待认领")

    await store.claim("team-a", task.id, "agent-x")
    assert len(sink.events) == 1
    _, payload = sink.events[0]
    assert payload["from_owner"] == ""
    assert payload["to_owner"] == "agent-x"
    assert payload["reason"] == "claim"


async def test_sink_failure_does_not_rollback_owner(tmp_path):
    """事件投递失败时 owner 变更**不回滚**(状态已改是真话,事件缺失只告警)。"""

    async def broken_sink(event_type: str, payload: dict) -> str:
        raise RuntimeError("bus down")

    store = _board(tmp_path, sink=broken_sink)
    task = store.create("team-a", "投递失败")
    mutation = await store.update("team-a", task.id, owner="bob")
    assert mutation.ok is True
    assert store.get_task("team-a", task.id).owner == "bob"  # type: ignore[union-attr]


# =============================================================================
# 非法输入拒绝
# =============================================================================


async def test_invalid_create_body_rejected(client, monkeypatch, tmp_path):
    """多余字段 / 空标题 / 非 kanban 状态词 → 422(不静默吞)。"""
    monkeypatch.setattr(team_router_module, "team_task_board", _board(tmp_path))
    url = "/api/orchestration/teams/team-a/tasks"

    extra = await client.post(url, json={"title": "x", "sneaky": 1})
    assert extra.status_code == 422

    blank = await client.post(url, json={"title": "   "})
    assert blank.status_code == 422

    bad_status = await client.post(url, json={"title": "x", "status": "doing"})
    assert bad_status.status_code == 422

    missing = await client.post(url, json={})
    assert missing.status_code == 422

    # strict=True:类型不隐式转换(数字标题不该被 coerce 成字符串)
    wrong_type = await client.post(url, json={"title": 123})
    assert wrong_type.status_code == 422

    ok = await client.post(url, json={"title": "合法任务"})
    assert ok.json()["code"] == 0


async def test_invalid_claim_and_update_bodies_rejected(client, monkeypatch, tmp_path):
    """认领缺 owner / 改任务带未知字段 → 422。"""
    store = _board(tmp_path)
    monkeypatch.setattr(team_router_module, "team_task_board", store)
    task = store.create("team-a", "票")

    no_owner = await client.post(
        f"/api/orchestration/teams/team-a/tasks/{task.id}/claim", json={}
    )
    assert no_owner.status_code == 422

    bad_update = await client.patch(
        f"/api/orchestration/teams/team-a/tasks/{task.id}",
        json={"owner": "bob", "unknownKey": True},
    )
    assert bad_update.status_code == 422


# =============================================================================
# 路由信封
# =============================================================================


async def test_router_crud_and_conflict_codes(client, monkeypatch, tmp_path):
    """建 → 列 → 认领(200)→ 再认领(409)→ 改(404 语义)→ 删(404)。"""
    sink = _RecordingSink()
    monkeypatch.setattr(
        team_router_module, "team_task_board", _board(tmp_path, sink=sink)
    )
    base = "/api/orchestration/teams/team-a/tasks"

    created = await client.post(base, json={"title": "端到端"})
    assert created.json()["code"] == 0
    task_id = created.json()["data"]["id"]
    assert created.json()["data"]["updatedAt"]

    listed = await client.get(base)
    assert listed.json()["data"]["total"] == 1

    first = await client.post(f"{base}/{task_id}/claim", json={"owner": "alice"})
    assert first.json()["code"] == 0
    assert first.json()["data"]["status"] == "in_progress"

    conflict = await client.post(f"{base}/{task_id}/claim", json={"owner": "bob"})
    assert conflict.json()["code"] == 409

    handoff = await client.patch(f"{base}/{task_id}", json={"owner": "bob", "reason": "转派"})
    assert handoff.json()["code"] == 0
    assert handoff.json()["data"]["owner"] == "bob"
    assert sink.events[-1][1]["from_owner"] == "alice"

    missing = await client.patch(
        "/api/orchestration/teams/team-a/tasks/tt-nope", json={"title": "x"}
    )
    assert missing.json()["code"] == 404

    deleted = await client.delete(f"{base}/{task_id}")
    assert deleted.json()["code"] == 0
    again = await client.delete(f"{base}/{task_id}")
    assert again.json()["code"] == 404


def test_status_vocabulary_is_shared_source(tmp_path):
    """任务板状态词必须来自 kanban 单一真相源,不得另立第二份清单。"""
    from app.services.dag_scheduler import KANBAN_TASK_STATUSES

    store = _board(tmp_path)
    with pytest.raises(ValueError):
        store.create("team-a", "x", status="not-a-status")
    for status in KANBAN_TASK_STATUSES:
        assert store.create("team-a", f"t-{status}", status=status).status == status
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
