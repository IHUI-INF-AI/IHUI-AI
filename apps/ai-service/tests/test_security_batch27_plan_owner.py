# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 27 批:计划模式(agent-plan)归属闸。

缺陷(现读,第 16 批同族但在另一条路由族):
  `app/routers/agent_plan.py` 的 8 个端点**全部没有身份入参**,`PlanStore` 的记录也
  没有归属字段。任何登录用户拿到 plan_id 就能:
    · GET /agent-plan/{id}、/versions、/versions/diff、/tasks 读走他人计划全文;
    · POST /tasks/sync、/tasks/{tid}/status 改他人计划的任务账;
    · POST /decision 批准(approve=执行)—— 会真的驱动 AgentLoopV2 跑只读工具
      (read_file / list_files / search_codebase / crawl_site 等),或者拒绝/改签他人计划。

修法:
  · `PlanRecord.owner_user_id`:创建时由承载层(request.state.user_id)写入,不是请求体字段;
  · `PlanStore.get_owned`:归属判据的唯一实现(§0.6),别人的与不存在的一样 KeyError(→ 404);
  · 8 个端点全部改走 get_owned;decide_plan 的校验排在一切动作之前(批准会执行工具);
  · 身份取值收敛到 `core.jwt_auth.actor_user_id`,与 langgraph 线程归属闸同源。

用例:
  A 创建写入归属;属主可读;他人 404。
  B 无主记录(内部创建/开发态)放行 —— 射程声明,不是漏洞登记。
  C 决定面:他人 404 且副作用未发生(状态不变、执行器未被构造)。
  D 版本面与任务面对他人同样 404。
  E 身份取值单源:非 str / 空 / 缺字段一律 None。
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException

from app.core import jwt_auth
from app.routers import agent_plan
from app.services import plan_mode
from app.services.plan_mode import PlanRecord

_ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
_BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


class _RecordingLoop:
    instances: list[_RecordingLoop] = []

    def __init__(self, llm_complete_fn: Any, tools: list[Any], **_kwargs: Any) -> None:
        _RecordingLoop.instances.append(self)

    async def run(self, _messages: list[dict[str, Any]]) -> Any:
        return SimpleNamespace(
            success=True, final_response="ok", stop_reason="done", error=None, iterations=[]
        )


@pytest.fixture(autouse=True)
def _patch_loop(monkeypatch):
    monkeypatch.setattr(agent_plan, "AgentLoopV2", _RecordingLoop)
    _RecordingLoop.instances = []
    yield
    _RecordingLoop.instances = []


@pytest.fixture(autouse=True)
def _fresh_store():
    plan_mode.plan_store._store.clear()
    plan_mode.plan_store._created_at.clear()
    yield
    plan_mode.plan_store._store.clear()
    plan_mode.plan_store._created_at.clear()


def _req(user_id: Any) -> Any:
    return SimpleNamespace(state=SimpleNamespace(user_id=user_id))


def _seed(plan_id: str, owner: str | None) -> PlanRecord:
    rec = PlanRecord(
        plan_id=plan_id,
        goal="g",
        plan_md="## 目标\nx",
        readonly_tools=plan_mode.READONLY_TOOLS,
        session_id=None,
        status="pending_approval",
        created_at="2026-10-31T00:00:00+00:00",
        owner_user_id=owner,
    )
    plan_mode.plan_store.save(rec)
    return rec


# ---------------------------------------------------------------------------
# A:创建写入归属 / 属主可读 / 他人 404
# ---------------------------------------------------------------------------


async def test_create_records_owner_and_owner_can_read():
    resp = await agent_plan.create_plan(
        agent_plan.CreatePlanRequest(goal="重构登录模块"), _req(_ALICE)
    )
    plan_id = resp["data"]["plan_id"]
    assert plan_mode.plan_store.get(plan_id).owner_user_id == _ALICE
    assert (await agent_plan.get_plan(plan_id, _req(_ALICE)))["code"] == 0
    with pytest.raises(HTTPException) as exc:
        await agent_plan.get_plan(plan_id, _req(_BOB))
    assert exc.value.status_code == 404
    # 别人的与"不存在"同形:不给出存在性差异
    assert plan_id in exc.value.detail


# ---------------------------------------------------------------------------
# B:无主记录不在射程
# ---------------------------------------------------------------------------


async def test_unowned_plan_is_out_of_scope():
    _seed("p-unowned", None)
    assert (await agent_plan.get_plan("p-unowned", _req(_BOB)))["code"] == 0
    assert (await agent_plan.get_plan("p-unowned", _req(None)))["code"] == 0


# ---------------------------------------------------------------------------
# C:决定面 404 且无副作用
# ---------------------------------------------------------------------------


async def test_decide_denied_for_stranger_without_side_effect():
    rec = _seed("p-decide", _ALICE)
    with pytest.raises(HTTPException) as exc:
        await agent_plan.decide_plan(
            "p-decide", agent_plan.PlanDecisionRequest(approve=True), _req(_BOB)
        )
    assert exc.value.status_code == 404
    assert rec.status == "pending_approval", "被拒的批准不得改动计划状态"
    assert _RecordingLoop.instances == [], "被拒的批准不得驱动执行器"


async def test_decide_reject_denied_for_stranger():
    rec = _seed("p-reject", _ALICE)
    with pytest.raises(HTTPException):
        await agent_plan.decide_plan(
            "p-reject", agent_plan.PlanDecisionRequest(approve=False), _req(_BOB)
        )
    assert rec.status == "pending_approval"


# ---------------------------------------------------------------------------
# D:版本面与任务面
# ---------------------------------------------------------------------------


async def test_version_and_task_endpoints_deny_stranger():
    _seed("p-tasks", _ALICE)
    calls = [
        agent_plan.list_plan_versions("p-tasks", _req(_BOB)),
        agent_plan.diff_plan_versions("p-tasks", _req(_BOB), 1),
        agent_plan.get_plan_tasks("p-tasks", _req(_BOB)),
        agent_plan.sync_plan_tasks("p-tasks", _req(_BOB)),
        agent_plan.set_plan_task_status(
            "p-tasks", "t1", agent_plan.TaskStatusRequest(status="done"), _req(_BOB)
        ),
    ]
    for coro in calls:
        with pytest.raises(HTTPException) as exc:
            await coro
        assert exc.value.status_code == 404
    # 属主读得动(证明 404 来自归属闸,不是路由坏了)
    assert (await agent_plan.get_plan_tasks("p-tasks", _req(_ALICE)))["code"] == 0


# ---------------------------------------------------------------------------
# E:身份取值单源
# ---------------------------------------------------------------------------


def test_actor_user_id_reads_request_state_only():
    assert jwt_auth.actor_user_id(_req(_ALICE)) == _ALICE
    assert jwt_auth.actor_user_id(_req("")) is None
    assert jwt_auth.actor_user_id(_req(None)) is None
    assert jwt_auth.actor_user_id(_req(123)) is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
