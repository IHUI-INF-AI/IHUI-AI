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

from typing import Any, Optional

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

    instances: list["RecordingLoop"] = []
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
    resp = await client.post(
        f"/api/agent-plan/{plan_id}/decision", json={"approve": False}
    )
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
    r1 = await client.post(
        f"/api/agent-plan/{plan_id}/decision", json={"approve": False}
    )
    assert r1.status_code == 200
    # 对 rejected 再次 decision(批准) -> 非法迁移 409
    r2 = await client.post(
        f"/api/agent-plan/{plan_id}/decision", json={"approve": True}
    )
    assert r2.status_code == 409
    # 不存在的计划 -> 404
    r3 = await client.post(
        "/api/agent-plan/nope/decision", json={"approve": True}
    )
    assert r3.status_code == 404


# ---------------------------------------------------------------------------
# 5. stub 全链路冒烟(无 key 可测)
# ---------------------------------------------------------------------------

async def test_stub_full_flow_smoke(client):
    create = await client.post(
        "/api/agent-plan", json={"goal": "在仓库中查找所有 TODO 注释"}
    )
    assert create.status_code == 200
    data = create.json()["data"]
    # stub 模式下 create_draft 返回合法占位计划
    assert "## 目标" in data["plan_md"]
    plan_id = data["plan_id"]

    resp = await client.post(
        f"/api/agent-plan/{plan_id}/decision", json={"approve": True}
    )
    assert resp.status_code == 200
    out = resp.json()
    assert out["code"] == 0
    assert out["data"]["status"] == "done"
    assert out["data"]["result"]["success"] is True

    get = await client.get(f"/api/agent-plan/{plan_id}")
    assert get.json()["data"]["status"] == "done"
