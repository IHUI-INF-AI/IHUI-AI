# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Plan Mode(计划模式)端点测试。

覆盖:
1. 创建草稿(stub LLM 返回合法占位 markdown)
2. 批准后执行,且传入 AgentLoopV2 的工具集 ⊆ READONLY_TOOLS
3. 拒绝路径
4. 非法状态迁移(重复 decision / 对非 draft 计划 decision) -> 409;不存在 -> 404
5. stub 全链路冒烟(创建 -> 批准 -> done)
"""

from __future__ import annotations

from typing import Any

import pytest

from app.routers import agent_plan
from app.services import plan_mode
from app.services.plan_mode import READONLY_TOOLS

# ---------------------------------------------------------------------------
# AgentLoopV2 替身:记录构造时传入的工具,立即返回成功结果(避免真实执行/网络/DB)
# ---------------------------------------------------------------------------


class _FakeResult:
    success = True
    final_response = "执行完成(测试替身)"
    stop_reason = "completed"
    error = None
    iterations: list[Any] = []


class RecordingLoop:
    """替换真实 AgentLoopV2,捕获工具集合供断言。"""

    instances: list[RecordingLoop] = []
    last_tools: list[Any] = []

    def __init__(self, llm_complete_fn: Any, tools: list[Any], **kwargs: Any) -> None:
        RecordingLoop.instances.append(self)
        RecordingLoop.last_tools = list(tools)
        self.tools = list(tools)
        self.llm = llm_complete_fn

    async def run(self, messages: list[dict[str, Any]]) -> _FakeResult:
        return _FakeResult()


@pytest.fixture(autouse=True)
def _patch_loop(monkeypatch):
    """用 RecordingLoop 替身替换真实 AgentLoopV2。"""
    monkeypatch.setattr(agent_plan, "AgentLoopV2", RecordingLoop)
    yield
    RecordingLoop.instances = []
    RecordingLoop.last_tools = []


@pytest.fixture(autouse=True)
def _fresh_store():
    """每个测试清空进程内计划存储,避免 TTL/状态串扰。"""
    plan_mode.plan_store._store.clear()
    plan_mode.plan_store._created_at.clear()
    yield


class _FakeMCPTool:
    def __init__(self, name: str) -> None:
        self.name = name
        self.description = f"fake {name}"
        self.input_schema: dict[str, Any] = {"type": "object", "properties": {}}


@pytest.fixture
def fake_mcp_tools(monkeypatch):
    """用受控工具列表替换 mcp_server.list_tools(覆盖只读与非只读)。"""
    from app.services.mcp_server import MCPServer

    readonly_present = ["read_file", "list_files", "search_codebase", "browser_navigate"]
    non_readonly_present = ["write_file", "run_command", "db_query", "generate_test"]
    fake = [_FakeMCPTool(n) for n in readonly_present + non_readonly_present]
    monkeypatch.setattr(MCPServer, "list_tools", lambda self: fake)
    return {"readonly": readonly_present, "non_readonly": non_readonly_present}


# ---------------------------------------------------------------------------
# 1. 创建草稿
# ---------------------------------------------------------------------------


async def test_create_draft_returns_valid_plan(client):
    resp = await client.post("/api/agent-plan", json={"goal": "重构登录模块"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert "plan_id" in data
    assert "## 目标" in data["plan_md"]
    assert "## 步骤" in data["plan_md"]
    assert "## 验收标准" in data["plan_md"]
    assert "## 风险与回滚" in data["plan_md"]
    # 返回的是只读白名单(至少核心只读工具,且绝不含写工具)
    assert "read_file" in data["readonly_tools"]
    assert "write_file" not in data["readonly_tools"]


# ---------------------------------------------------------------------------
# 2. 批准后执行,工具集 ⊆ READONLY_TOOLS
# ---------------------------------------------------------------------------


async def test_approve_executes_with_readonly_tools_only(client, fake_mcp_tools):
    create = await client.post("/api/agent-plan", json={"goal": "g"})
    plan_id = create.json()["data"]["plan_id"]
    resp = await client.post(
        f"/api/agent-plan/{plan_id}/decision",
        json={
            "approve": True,
            "tools": ["read_file", "browser_navigate", "write_file", "run_command"],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["status"] == "done"

    captured = [t.name for t in RecordingLoop.last_tools]
    assert captured, "应至少构建一个工具"
    for name in captured:
        assert name in READONLY_TOOLS, f"{name} 不是只读工具"
    # 非只读被剔除
    assert "write_file" not in captured
    assert "run_command" not in captured
    # 请求的只读工具应被构建
    assert "read_file" in captured
    assert "browser_navigate" in captured


# ---------------------------------------------------------------------------
# 3. 拒绝路径
# ---------------------------------------------------------------------------


async def test_reject_path(client):
    create = await client.post("/api/agent-plan", json={"goal": "g"})
    plan_id = create.json()["data"]["plan_id"]
    resp = await client.post(f"/api/agent-plan/{plan_id}/decision", json={"approve": False})
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "rejected"
    get = await client.get(f"/api/agent-plan/{plan_id}")
    assert get.json()["data"]["status"] == "rejected"


# ---------------------------------------------------------------------------
# 4. 非法状态迁移 -> 409;不存在 -> 404
# ---------------------------------------------------------------------------


async def test_illegal_transition_returns_409(client):
    create = await client.post("/api/agent-plan", json={"goal": "g"})
    plan_id = create.json()["data"]["plan_id"]
    # 第一次 decision 拒绝 -> rejected
    r1 = await client.post(f"/api/agent-plan/{plan_id}/decision", json={"approve": False})
    assert r1.status_code == 200
    # 对 rejected 再次 decision(批准) -> 非法迁移 409
    r2 = await client.post(f"/api/agent-plan/{plan_id}/decision", json={"approve": True})
    assert r2.status_code == 409
    # 不存在的计划 -> 404
    r3 = await client.post("/api/agent-plan/nope/decision", json={"approve": True})
    assert r3.status_code == 404


# ---------------------------------------------------------------------------
# 5. stub 全链路冒烟(无 key 可测)
# ---------------------------------------------------------------------------


async def test_stub_full_flow_smoke(client):
    create = await client.post("/api/agent-plan", json={"goal": "在仓库中查找所有 TODO 注释"})
    assert create.status_code == 200
    data = create.json()["data"]
    # stub 模式下 create_draft 返回合法占位计划
    assert "## 目标" in data["plan_md"]
    plan_id = data["plan_id"]

    resp = await client.post(f"/api/agent-plan/{plan_id}/decision", json={"approve": True})
    assert resp.status_code == 200
    out = resp.json()
    assert out["code"] == 0
    assert out["data"]["status"] == "done"
    assert out["data"]["result"]["success"] is True

    get = await client.get(f"/api/agent-plan/{plan_id}")
    assert get.json()["data"]["status"] == "done"


# ---------------------------------------------------------------------------
# 6. 审批门控闭环:生成后进入 pending_approval 并暂停,须决策后才执行
# ---------------------------------------------------------------------------


async def test_create_enters_pending_approval_gate(client):
    """生成计划后停在 pending_approval,未决策绝不触发执行。"""
    create = await client.post("/api/agent-plan", json={"goal": "g"})
    plan_id = create.json()["data"]["plan_id"]
    get = await client.get(f"/api/agent-plan/{plan_id}")
    assert get.json()["data"]["status"] == "pending_approval"
    # 门未打开 -> 无执行(RecordingLoop 未被构造)
    assert not RecordingLoop.instances


async def test_approve_only_lifts_gate_without_executing(client):
    """approve_only:仅把门从 pending_approval 打开到 approved,暂不执行。"""
    create = await client.post("/api/agent-plan", json={"goal": "g"})
    plan_id = create.json()["data"]["plan_id"]
    r1 = await client.post(
        f"/api/agent-plan/{plan_id}/decision",
        json={"approve": True, "action": "approve_only"},
    )
    assert r1.status_code == 200
    assert r1.json()["data"]["status"] == "approved"
    assert not RecordingLoop.instances
    # 再从 approved 启动执行
    r2 = await client.post(f"/api/agent-plan/{plan_id}/decision", json={"approve": True})
    assert r2.status_code == 200
    assert r2.json()["data"]["status"] == "done"
    assert RecordingLoop.instances


async def test_revise_bumps_version_then_reapprove_executes(client):
    """改签:细化新版本(version bump + reason),回到 pending_approval,可再批准执行。"""
    create = await client.post("/api/agent-plan", json={"goal": "g"})
    plan_id = create.json()["data"]["plan_id"]
    revised_md = (
        "# 修订版\n## 目标\ng\n## 步骤\n1. a\n2. b\n## 验收标准\n- ok\n## 风险与回滚\n- none\n"
    )
    r = await client.post(
        f"/api/agent-plan/{plan_id}/decision",
        json={
            "approve": True,
            "action": "revise",
            "edited_plan_md": revised_md,
            "reason": "补充校验步骤",
        },
    )
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "pending_approval"
    assert r.json()["data"]["version"] == 2

    get = await client.get(f"/api/agent-plan/{plan_id}")
    assert get.json()["data"]["version"] == 2
    assert get.json()["data"]["plan_md"].strip() == revised_md.strip()

    # 新版可批准执行,且执行的是 v2(version 保持 2)
    r2 = await client.post(f"/api/agent-plan/{plan_id}/decision", json={"approve": True})
    assert r2.status_code == 200
    assert r2.json()["data"]["status"] == "done"
    assert r2.json()["data"]["version"] == 2


async def test_revise_without_edits_returns_400(client):
    create = await client.post("/api/agent-plan", json={"goal": "g"})
    plan_id = create.json()["data"]["plan_id"]
    r = await client.post(
        f"/api/agent-plan/{plan_id}/decision",
        json={"approve": True, "action": "revise"},
    )
    assert r.status_code == 400


async def test_reject_with_edits_records_version_and_resubmit(client):
    """拒绝(带改稿)产生新版本;拒绝后可用 revise 基于新版本重提。"""
    create = await client.post("/api/agent-plan", json={"goal": "g"})
    plan_id = create.json()["data"]["plan_id"]
    edited = "# 改稿\n## 目标\ng\n## 步骤\n1. x\n## 验收标准\n- ok\n## 风险与回滚\n- none\n"
    r = await client.post(
        f"/api/agent-plan/{plan_id}/decision",
        json={"approve": False, "edited_plan_md": edited, "reason": "计划太粗糙"},
    )
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "rejected"
    assert r.json()["data"]["version"] == 2
    # 重提:rejected -> pending_approval,提供新内容则再产新版
    edited2 = edited + "2. y\n"
    r2 = await client.post(
        f"/api/agent-plan/{plan_id}/decision",
        json={"approve": True, "action": "revise", "edited_plan_md": edited2, "reason": "重提"},
    )
    assert r2.status_code == 200
    assert r2.json()["data"]["status"] == "pending_approval"
    assert r2.json()["data"]["version"] == 3
    # 重提内容与当前一致则不重复加版本
    r3 = await client.post(
        f"/api/agent-plan/{plan_id}/decision",
        json={"approve": True, "action": "revise", "edited_plan_md": edited2, "reason": "无新内容"},
    )
    assert r3.status_code == 200
    assert r3.json()["data"]["version"] == 3


async def test_decision_after_done_is_illegal(client):
    """既有测试覆盖 rejected 后再次审批;这里补 done 后任意决策均非法(并发/重复提交防护)。"""
    create = await client.post("/api/agent-plan", json={"goal": "g"})
    plan_id = create.json()["data"]["plan_id"]
    await client.post(f"/api/agent-plan/{plan_id}/decision", json={"approve": True})
    for body in ({"approve": False}, {"approve": True, "action": "revise", "edited_plan_md": "x"}):
        resp = await client.post(f"/api/agent-plan/{plan_id}/decision", json=body)
        assert resp.status_code == 409


# ---------------------------------------------------------------------------
# 7. 版本历史与 diff(可追溯"最终执行的是哪个版本、为何")
# ---------------------------------------------------------------------------


async def test_version_history_and_diff(client):
    create = await client.post("/api/agent-plan", json={"goal": "g"})
    plan_id = create.json()["data"]["plan_id"]
    v1_md = create.json()["data"]["plan_md"]
    edited = f"{v1_md}\n## 追加\n- 补充一句\n"
    await client.post(
        f"/api/agent-plan/{plan_id}/decision",
        json={"approve": True, "action": "revise", "edited_plan_md": edited, "reason": "补充分散"},
    )
    versions = await client.get(f"/api/agent-plan/{plan_id}/versions")
    assert versions.status_code == 200
    vd = versions.json()["data"]
    assert vd["current_version"] == 2
    assert [v["version"] for v in vd["versions"]] == [1, 2]
    assert vd["versions"][1]["reason"] == "补充分散"

    diff = await client.get(f"/api/agent-plan/{plan_id}/versions/diff?from_version=1")
    assert diff.status_code == 200
    diff_data = diff.json()["data"]
    assert diff_data["to_version"] == 2
    assert "+## 追加" in diff_data["diff"]

    # 非法版本号 -> 400
    bad = await client.get(f"/api/agent-plan/{plan_id}/versions/diff?from_version=9")
    assert bad.status_code == 400
    bad2 = await client.get(f"/api/agent-plan/{plan_id}/versions/diff?from_version=2&to_version=1")
    assert bad2.status_code == 200
    assert bad2.json()["data"]["diff"] != ""


# ---------------------------------------------------------------------------
# 8. 任务化执行(plan tasks):获批计划展开为可勾选 task 序列
# ---------------------------------------------------------------------------


async def test_tasks_sync_and_status_progression(client):
    create = await client.post("/api/agent-plan", json={"goal": "g"})
    plan_id = create.json()["data"]["plan_id"]

    t0 = await client.get(f"/api/agent-plan/{plan_id}/tasks")
    assert t0.json()["data"]["tasks"] == []

    ts = await client.post(f"/api/agent-plan/{plan_id}/tasks/sync")
    data = ts.json()["data"]
    assert len(data["tasks"]) == 4  # 占位计划 4 个步骤
    assert data["summary"]["total"] == 4 and data["summary"]["done"] == 0
    assert {t["task_id"] for t in data["tasks"]} == {"task-1", "task-2", "task-3", "task-4"}

    # 推进状态
    r = await client.post(f"/api/agent-plan/{plan_id}/tasks/task-1/status", json={"status": "done"})
    assert r.status_code == 200
    assert r.json()["data"]["summary"]["done"] == 1
    r2 = await client.post(
        f"/api/agent-plan/{plan_id}/tasks/task-2/status", json={"status": "blocked"}
    )
    assert r2.json()["data"]["summary"]["blocked"] == 1

    # 非法状态 / 不存在 task -> 400
    r3 = await client.post(
        f"/api/agent-plan/{plan_id}/tasks/task-1/status", json={"status": "nope"}
    )
    assert r3.status_code == 400
    r4 = await client.post(
        f"/api/agent-plan/{plan_id}/tasks/task-99/status", json={"status": "done"}
    )
    assert r4.status_code == 400

    # 重新 sync 保留同名任务已有勾选状态
    ts2 = await client.post(f"/api/agent-plan/{plan_id}/tasks/sync")
    statuses = {t["task_id"]: t["status"] for t in ts2.json()["data"]["tasks"]}
    assert statuses["task-1"] == "done"
    assert statuses["task-2"] == "blocked"


# ---------------------------------------------------------------------------
# 9. 服务层单测:状态机全转移 / derive_tasks / refine_plan / diff_versions
# ---------------------------------------------------------------------------


def test_state_machine_full_cycle():
    """pending_approval -> approved -> executing -> done,以及全量合法/非法迁移。"""
    # 合法闭环
    plan_mode.validate_transition("pending_approval", "approved")
    plan_mode.validate_transition("approved", "executing")
    plan_mode.validate_transition("executing", "done")
    plan_mode.validate_transition("pending_approval", "rejected")
    plan_mode.validate_transition("rejected", "pending_approval")  # 基于新版本重提
    plan_mode.validate_transition("pending_approval", "pending_approval")  # 改签
    # 非法迁移
    for current, target in [
        ("pending_approval", "done"),
        ("done", "executing"),
        ("failed", "approved"),
        ("rejected", "executing"),
        ("nope", "approved"),
    ]:
        with pytest.raises(ValueError):
            plan_mode.validate_transition(current, target)


def test_derive_tasks_from_steps():
    md = "## 目标\nx\n## 步骤\n1. 分析代码\n2. 编写用例\n3. 验证结果\n## 验收标准\n- y\n"
    tasks = plan_mode.derive_tasks(md)
    assert [t["title"] for t in tasks] == ["分析代码", "编写用例", "验证结果"]
    assert all(t["status"] == "pending" for t in tasks)
    # 非步骤章节的编号不纳入
    full = "## 目标\n1. 不属于步骤\n## 步骤\n4. 真步骤\n"
    assert [t["title"] for t in plan_mode.derive_tasks(full)] == ["真步骤"]


def test_refine_plan_bumps_version_and_diff():
    rec = plan_mode.PlanRecord(
        plan_id="p1",
        goal="g",
        plan_md="## 目标\ng\n## 步骤\n1. a\n",
        readonly_tools=frozenset(),
        session_id=None,
        status="pending_approval",
        created_at="2026-09-03T00:00:00+00:00",
        version=1,
        version_history=[
            {
                "version": 1,
                "reason": "initial",
                "channel": "llm",
                "plan_md": "## 目标\ng\n## 步骤\n1. a\n",
                "created_at": "2026-09-03T00:00:00+00:00",
            }
        ],
    )
    plan_mode.refine_plan(rec, "## 目标\ng\n## 步骤\n1. a\n2. b\n", reason="细化")
    assert rec.version == 2
    assert len(rec.version_history) == 2
    assert [v["version"] for v in rec.version_history] == [1, 2]
    # diff 非空且只读
    diff_str = plan_mode.diff_versions(rec, 1, 2)
    assert "+2. b" in diff_str
    assert plan_mode.diff_versions(rec, 1, 1) == ""
    # 非法版本号
    with pytest.raises(ValueError):
        plan_mode.diff_versions(rec, 1, 99)
    # 列表(不含 plan_md)
    meta = plan_mode.list_versions(rec, include_plan_md=False)
    assert "plan_md" not in meta[0]
    # 同名内容 refine 不重复加版本(仅记 reason)
    before = len(rec.version_history)
    plan_mode.refine_plan(rec, "## 目标\ng\n## 步骤\n1. a\n2. b\n", reason="无变更")
    assert len(rec.version_history) == before
    assert rec.version == 2

    # task 状态推进
    plan_mode.sync_tasks(rec)
    task_ids = {t["task_id"] for t in rec.tasks}
    assert "task-2" in task_ids
    assert plan_mode.update_task_status(rec, "task-1", "done") is True
    assert plan_mode.update_task_status(rec, "task-1", "nope") is False
