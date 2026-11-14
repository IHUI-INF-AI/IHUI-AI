# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‍⁠

"""团队任务板依赖/CAS/文件触碰提示契约(2026-11-14 立,对标 DSH dsh-agent-team)。

① depends_on:未知依赖拒绝、前置未 done 不可 claim(TASK_BLOCKED)、成环拒绝;
② revision CAS:每次成功 mutation +1,expected_revision 过期回 TASK_STALE_REVISION;
③ write_scopes:只与进行中(claimed)条目比路径前缀,重叠进 write_scope_warnings,
   仅提示不阻断;ready/blocked_by 为派生只读字段;
④ 既有 add/claim/update/list 行为不变(D08 回归由 test_d08 系列覆盖)。
"""

from __future__ import annotations

import pytest

from app.services.mcp_server import _TEAM_TASK_BOARD, _tool_team_task


@pytest.fixture(autouse=True)
def _clean_board():
    _TEAM_TASK_BOARD.clear()
    yield
    _TEAM_TASK_BOARD.clear()


async def _add(**kwargs):
    payload = {"action": "add", "team_id": "t1", "title": "任务", "agent_id": "planner"}
    payload.update(kwargs)
    return await _tool_team_task(payload)


async def _call(**kwargs):
    payload = {"team_id": "t1"}
    payload.update(kwargs)
    return await _tool_team_task(payload)


async def test_dependencies_block_claim_until_done() -> None:
    first = await _add(title="先做接口")
    first_id = first["task"]["id"]
    second = await _add(title="再接页面", depends_on=[first_id])
    second_id = second["task"]["id"]

    listed = await _call(action="list")
    by_id = {t["id"]: t for t in listed["tasks"]}
    assert by_id[first_id]["ready"] is True
    assert by_id[second_id]["ready"] is False
    assert by_id[second_id]["blocked_by"] == [first_id]

    blocked = await _call(action="claim", task_id=second_id, agent_id="worker-b")
    assert blocked["ok"] is False
    assert blocked["errorCode"] == "TASK_BLOCKED"
    assert blocked["blocked_by"] == [first_id]

    await _call(action="claim", task_id=first_id, agent_id="worker-a")
    await _call(
        action="update", task_id=first_id, agent_id="worker-a", status="done"
    )
    unblocked = await _call(action="claim", task_id=second_id, agent_id="worker-b")
    assert unblocked["ok"] is True
    assert unblocked["task"]["claimed_by"] == "worker-b"
    assert unblocked["task"]["ready"] is False  # 已 claimed,不再是 ready


async def test_unknown_dependency_is_rejected() -> None:
    result = await _add(depends_on=["missing-id"])
    assert result["ok"] is False
    assert result["errorCode"] == "TASK_NOT_FOUND"
    assert result["missing_dependency"] == "missing-id"


async def test_dependency_cycle_is_rejected() -> None:
    a = await _add(title="A")
    a_id = a["task"]["id"]
    b = await _add(title="B", depends_on=[a_id])
    b_id = b["task"]["id"]
    await _call(action="claim", task_id=a_id, agent_id="worker-a")

    cyclic = await _call(
        action="update", task_id=a_id, agent_id="worker-a", depends_on=[b_id]
    )
    assert cyclic["ok"] is False
    assert cyclic["errorCode"] == "TASK_DEPENDENCY_CYCLE"

    self_dep = await _call(
        action="update", task_id=a_id, agent_id="worker-a", depends_on=[a_id]
    )
    assert self_dep["ok"] is False
    assert self_dep["errorCode"] == "TASK_DEPENDENCY_SELF"


async def test_revision_cas_rejects_stale_mutation() -> None:
    added = await _add()
    tid = added["task"]["id"]
    assert added["task"]["revision"] == 1

    stale = await _call(
        action="claim", task_id=tid, agent_id="worker-a", expected_revision=99
    )
    assert stale["ok"] is False
    assert stale["errorCode"] == "TASK_STALE_REVISION"
    assert stale["revision"] == 1

    claimed = await _call(
        action="claim", task_id=tid, agent_id="worker-a", expected_revision=1
    )
    assert claimed["ok"] is True
    assert claimed["task"]["revision"] == 2

    stale_update = await _call(
        action="update",
        task_id=tid,
        agent_id="worker-a",
        status="done",
        expected_revision=1,
    )
    assert stale_update["ok"] is False
    assert stale_update["errorCode"] == "TASK_STALE_REVISION"
    assert stale_update["revision"] == 2

    updated = await _call(
        action="update",
        task_id=tid,
        agent_id="worker-a",
        status="done",
        expected_revision=2,
    )
    assert updated["ok"] is True
    assert updated["task"]["revision"] == 3
    assert updated["task"]["status"] == "done"


async def test_write_scope_warnings_only_for_in_progress_overlap() -> None:
    a = await _add(title="改服务", write_scopes=["src/app"])
    a_id = a["task"]["id"]
    b = await _add(title="改接口", write_scopes=["src/app/api"])
    b_id = b["task"]["id"]
    c = await _add(title="改前端", write_scopes=["src/web"])
    c_id = c["task"]["id"]

    await _call(action="claim", task_id=a_id, agent_id="worker-a")
    await _call(action="claim", task_id=b_id, agent_id="worker-b")
    await _call(action="claim", task_id=c_id, agent_id="worker-c")

    listed = await _call(action="list")
    by_id = {t["id"]: t for t in listed["tasks"]}
    assert f"write scopes overlap with {b_id}" in by_id[a_id]["write_scope_warnings"]
    assert f"write scopes overlap with {a_id}" in by_id[b_id]["write_scope_warnings"]
    assert by_id[c_id]["write_scope_warnings"] == []

    # 提示不阻断:重叠条目都已成功认领
    assert by_id[a_id]["status"] == "claimed"
    assert by_id[b_id]["status"] == "claimed"


async def test_pending_task_without_scopes_has_no_warnings() -> None:
    added = await _add(title="普通任务")
    assert added["task"]["write_scope_warnings"] == []
    assert added["task"]["write_scopes"] == []
    assert added["task"]["depends_on"] == []
