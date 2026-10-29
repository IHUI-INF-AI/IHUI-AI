# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D08①:团队共享任务列表(子 agent 可认领/更新条目)。

覆盖:
- add 建条目进入 pending、无持有者;缺 title 直接拒
- claim 独占:本人可领、他人已领回 ALREADY_CLAIMED 并带持有者、不存在回 TASK_NOT_FOUND
- update 仅持有者可改;他人改回 FORBIDDEN;非法 status 整条拒绝(INVALID_STATUS)
- list 整表快照;不同 team_id 互相隔离
- 并发抢同一条:持锁 check-and-set ⇒ 恰好一个成功(不靠 sleep 排序,靠锁)
- 工具已登记:_TOOL_HANDLERS 与 _TOOLS 同名在册(两表数量一致性仍由既有门断言)

不起 dev server、不调真实 LLM、不碰 orchestrator:纯看板面。
"""

from __future__ import annotations

import asyncio

import pytest

from app.services import mcp_server
from app.services.mcp_server import (
    _TEAM_TASK_BOARD,
    _TEAM_TASK_STATUS,
    _tool_team_task,
)


@pytest.fixture(autouse=True)
def _clean_board():
    _TEAM_TASK_BOARD.clear()
    yield
    _TEAM_TASK_BOARD.clear()


async def _add(team_id="default", title="写验收用例", agent_id="planner"):
    return await _tool_team_task(
        {"action": "add", "team_id": team_id, "title": title, "agent_id": agent_id}
    )


async def test_add_creates_pending_entry_without_holder():
    r = await _add()
    assert r["ok"] is True
    assert r["task"]["status"] == "pending"
    assert r["task"]["claimed_by"] == ""
    assert r["team_id"] == "default"
    assert r["task"]["title"] == "写验收用例"


async def test_add_requires_title():
    r = await _tool_team_task({"action": "add", "team_id": "default"})
    assert r["ok"] is False
    assert r["errorCode"] == "MISSING_PARAMS"


async def test_claim_sets_holder_and_status():
    added = await _add()
    tid = added["task"]["id"]
    r = await _tool_team_task(
        {"action": "claim", "team_id": "default", "task_id": tid, "agent_id": "worker-a"}
    )
    assert r["ok"] is True
    assert r["task"]["claimed_by"] == "worker-a"
    assert r["task"]["status"] == "claimed"


async def test_claim_by_second_agent_is_rejected_with_holder():
    added = await _add()
    tid = added["task"]["id"]
    await _tool_team_task(
        {"action": "claim", "team_id": "default", "task_id": tid, "agent_id": "worker-a"}
    )
    r = await _tool_team_task(
        {"action": "claim", "team_id": "default", "task_id": tid, "agent_id": "worker-b"}
    )
    assert r["ok"] is False
    assert r["errorCode"] == "ALREADY_CLAIMED"
    assert r["claimed_by"] == "worker-a"
    # 拒绝不改条目:持有者仍是先到那位
    listed = await _tool_team_task({"action": "list", "team_id": "default"})
    assert listed["tasks"][0]["claimed_by"] == "worker-a"


async def test_claim_unknown_task_is_not_found():
    r = await _tool_team_task(
        {"action": "claim", "team_id": "default", "task_id": "nope", "agent_id": "worker-a"}
    )
    assert r["ok"] is False
    assert r["errorCode"] == "TASK_NOT_FOUND"


async def test_claim_closed_task_is_rejected():
    added = await _add()
    tid = added["task"]["id"]
    await _tool_team_task(
        {"action": "claim", "team_id": "default", "task_id": tid, "agent_id": "worker-a"}
    )
    await _tool_team_task(
        {
            "action": "update", "team_id": "default", "task_id": tid,
            "agent_id": "worker-a", "status": "done",
        }
    )
    r = await _tool_team_task(
        {"action": "claim", "team_id": "default", "task_id": tid, "agent_id": "worker-b"}
    )
    assert r["ok"] is False
    assert r["errorCode"] == "TASK_CLOSED"


async def test_update_by_non_holder_is_forbidden():
    added = await _add()
    tid = added["task"]["id"]
    await _tool_team_task(
        {"action": "claim", "team_id": "default", "task_id": tid, "agent_id": "worker-a"}
    )
    r = await _tool_team_task(
        {
            "action": "update", "team_id": "default", "task_id": tid,
            "agent_id": "worker-b", "status": "done",
        }
    )
    assert r["ok"] is False
    assert r["errorCode"] == "FORBIDDEN"
    assert r["claimed_by"] == "worker-a"


async def test_update_by_holder_records_status_and_note():
    added = await _add()
    tid = added["task"]["id"]
    await _tool_team_task(
        {"action": "claim", "team_id": "default", "task_id": tid, "agent_id": "worker-a"}
    )
    r = await _tool_team_task(
        {
            "action": "update", "team_id": "default", "task_id": tid,
            "agent_id": "worker-a", "status": "blocked", "note": "等上游接口",
        }
    )
    assert r["ok"] is True
    assert r["task"]["status"] == "blocked"
    assert r["task"]["note"] == "等上游接口"


async def test_update_rejects_unknown_status():
    added = await _add()
    tid = added["task"]["id"]
    await _tool_team_task(
        {"action": "claim", "team_id": "default", "task_id": tid, "agent_id": "worker-a"}
    )
    r = await _tool_team_task(
        {
            "action": "update", "team_id": "default", "task_id": tid,
            "agent_id": "worker-a", "status": "almost-done",
        }
    )
    assert r["ok"] is False
    assert r["errorCode"] == "INVALID_STATUS"
    # 非法值整条拒绝,不把条目改到半截
    listed = await _tool_team_task({"action": "list", "team_id": "default"})
    assert listed["tasks"][0]["status"] == "claimed"


async def test_list_snapshot_and_team_isolation():
    await _add(team_id="alpha", title="甲队条目")
    await _add(team_id="beta", title="乙队条目")
    a = await _tool_team_task({"action": "list", "team_id": "alpha"})
    b = await _tool_team_task({"action": "list", "team_id": "beta"})
    assert a["total"] == 1 and b["total"] == 1
    assert a["tasks"][0]["title"] == "甲队条目"
    assert b["tasks"][0]["title"] == "乙队条目"
    assert a["tasks"][0]["id"] != b["tasks"][0]["id"]
    # 空队读得到空表,不报 TASK_NOT_FOUND
    empty = await _tool_team_task({"action": "list", "team_id": "gamma"})
    assert empty["ok"] is True and empty["total"] == 0


async def test_concurrent_claim_has_exactly_one_winner():
    added = await _add()
    tid = added["task"]["id"]
    agents = [f"worker-{i}" for i in range(8)]
    results = await asyncio.gather(
        *[
            _tool_team_task(
                {"action": "claim", "team_id": "default", "task_id": tid, "agent_id": a}
            )
            for a in agents
        ]
    )
    winners = [a for a, r in zip(agents, results, strict=True) if r.get("ok")]
    losers = [r for r in results if not r.get("ok")]
    assert len(winners) == 1, f"并发认领应恰好一个赢家,实得 {len(winners)}"
    assert all(r["errorCode"] == "ALREADY_CLAIMED" for r in losers)
    listed = await _tool_team_task({"action": "list", "team_id": "default"})
    assert listed["tasks"][0]["claimed_by"] == winners[0]


async def test_unknown_action_is_rejected():
    r = await _tool_team_task({"action": "drop"})
    assert r["ok"] is False
    assert r["errorCode"] == "INVALID_PARAMS"


def test_tool_is_registered_on_both_faces():
    assert "team_task" in mcp_server._TOOL_HANDLERS
    assert any(t.name == "team_task" for t in mcp_server._TOOLS), "有处理器无定义会被既有门判失配"
    assert set(_TEAM_TASK_STATUS) == {"pending", "claimed", "done", "blocked"}
