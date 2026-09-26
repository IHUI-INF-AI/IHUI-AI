# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #47 第二格:「谁有权执行高危能力」在三条执行内核里必须同一个答案。

立因(实测,非推断):注册表侧 `mcp_server.call_tool` 有 `_ADMIN_ONLY_TOOLS × user_role`
角色矩阵,而引擎内核(AgentEngine/Codex 移植)自带的 `unified_exec` / `run_code` /
`apply_patch` **不经 call_tool** —— 于是普通登录用户(role 0)在 /api/engine/rpc 上可以
无阻拦地起 shell、写文件。反方向同时坏:引擎路径的注册表工具执行器不传 user_role,
默认 0,连管理员在引擎线程里也永远拿不到 `run_command` / `write_file`。

本文件按「两道闸各自生效、互不遮蔽」组织断言,而不是把它们混成一条:
1. role 0 ⇒ 三条引擎内置高危名被**角色闸**拒,且**未执行、未发出审批**;
2. role 1 ⇒ 同一批名字不再被角色闸拒,但**仍被审批闸挡**(审批是另一道闸);
3. role 1 ⇒ 引擎路径的注册表 admin 工具不再被"默认 0"误拒(反向缺陷的证明);
4. role 0 ⇒ 非 admin 工具(read/search 类)行为不变(非回归);
5. `_spec(thread)` 把 role_id 过桥到工厂(载体链在位)。
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

import app.services.agent_loop_v2 as agent_loop_v2
from app.routers import agents as agents_router
from app.services.agent_engine import AgentEngine, EngineThread, _coerce_role_id, _spec
from app.services.agent_loop_v2 import (
    AgentLoopV2,
    ToolCall,
    ToolDefinition,
    resolve_approval_response,
)

# 经 engine_tool_bridge 归口到 admin 专属能力的三个引擎内置名(2026-09-26 实测:
# unified_exec/run_code → run_command,apply_patch → file_edit,两者均在 _ADMIN_ONLY_TOOLS)
_ENGINE_ADMIN_GATED: tuple[str, ...] = ("unified_exec", "run_code", "apply_patch")


# ---------------------------------------------------------------------------
# 夹具:hook_engine 假广播(记录事件)+ 不连库、不起真 shell
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _fake_events(monkeypatch: pytest.MonkeyPatch) -> dict[str, list[dict[str, Any]]]:
    monkeypatch.setenv("AGENT_ENGINE_PERSIST", "off")
    emitted: list[dict[str, Any]] = []

    class FakeHookEngine:
        async def emit(self, event: str, context: dict[str, Any]) -> list[Any]:
            emitted.append({"event": event, **context})
            return []

    monkeypatch.setattr(agent_loop_v2, "hook_engine", FakeHookEngine())
    monkeypatch.setattr(agent_loop_v2, "_approval_registry", {})
    return {"emitted": emitted}


def _loop(
    tool_names: list[str], *, user_role: int, approval: bool = True
) -> tuple[AgentLoopV2, list[str]]:
    """构造一个只带指定工具的循环;executed 记录**真实执行过的工具名**。

    断言"未执行"只能靠这个副作用清单 —— 只看返回码的话,一次"先执行再报错"的
    实现照样能骗绿(本仓记过同型:授权挪到查库后状态码仍 403,只有 whereSeen==0
    抓得到)。
    """
    executed: list[str] = []
    tools = [
        ToolDefinition(
            name=name,
            description=name,
            parameters={},
            executor=_recording_executor(executed, name),
        )
        for name in tool_names
    ]
    loop = AgentLoopV2(
        None,
        tools,
        approval_enabled=approval,
        approval_timeout=5,
        user_role=user_role,
        session_id="role-parity",
    )
    return loop, executed


def _recording_executor(sink: list[str], name: str) -> Any:
    async def _exec(args: dict[str, Any]) -> dict[str, Any]:
        sink.append(name)
        return {"ok": True, "executed": name}

    return _exec


def _approval_events(emitted: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [e for e in emitted if e["event"] == "tool.approval"]


# ---------------------------------------------------------------------------
# 1. role 0:三条引擎内置高危名被拒,且未执行、未发出审批
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("tool_name", _ENGINE_ADMIN_GATED)
async def test_role_zero_denies_engine_builtin_admin_capability(
    tool_name: str, _fake_events: dict[str, list[dict[str, Any]]]
) -> None:
    loop, executed = _loop([tool_name], user_role=0)
    tr = await loop._execute_single(ToolCall(id="c1", name=tool_name, args={}))

    assert executed == [], f"{tool_name} 在 role=0 下被真实执行了"
    assert _approval_events(_fake_events["emitted"]) == [], "角色闸不得退化成审批弹窗"
    assert tr.error_type == "permission_denied"
    assert isinstance(tr.result, dict) and tr.result.get("errorCode") == "PERMISSION_DENIED"
    # 回执与 call_tool 同形(两侧消费方同一处理):ok=False + error + errorCode 三键
    assert tr.result["ok"] is False and tr.result["error"]
    # 本次拒绝点名了被拒的能力归口(便于审计:unified_exec 的洞在 run_command 那档)
    assert tool_name in (tr.error or "")


# ---------------------------------------------------------------------------
# 2. role 1:不再被角色闸挡,但**仍**被审批闸挡(两闸分别断言,不混成一条)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("tool_name", _ENGINE_ADMIN_GATED)
async def test_role_one_clears_role_gate_but_still_faces_approval_gate(
    tool_name: str, _fake_events: dict[str, list[dict[str, Any]]]
) -> None:
    loop, executed = _loop([tool_name], user_role=1, approval=True)
    task = asyncio.create_task(loop._execute_single(ToolCall(id="c1", name=tool_name, args={})))
    await asyncio.sleep(0)  # 让 _execute_single 跑到审批等待处

    approvals = _approval_events(_fake_events["emitted"])
    assert len(approvals) == 1, f"{tool_name}:role=1 应当过角色闸、进审批闸"
    assert executed == [], "审批未决期间不得执行"

    assert resolve_approval_response(approvals[0]["approval_id"], "approve") is True
    tr = await task
    assert executed == [tool_name]
    assert tr.error is None


@pytest.mark.asyncio
@pytest.mark.parametrize("tool_name", _ENGINE_ADMIN_GATED)
async def test_role_one_with_approval_disabled_executes(
    tool_name: str, _fake_events: dict[str, list[dict[str, Any]]]
) -> None:
    """审批关掉后 role=1 才走到底 —— 证明第二格没把角色闸变成"永远拦"。"""
    loop, executed = _loop([tool_name], user_role=1, approval=False)
    tr = await loop._execute_single(ToolCall(id="c1", name=tool_name, args={}))
    assert executed == [tool_name]
    assert tr.error is None


# ---------------------------------------------------------------------------
# 3. 反方向缺陷:引擎路径的注册表 admin 工具在 role=1 下不再被"默认 0"误拒
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_registry_admin_tool_forwards_role_to_call_tool(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`_build_loop_v2_tools` 的两条支路都必须把角色透传给 call_tool。

    旧实现写的是 `call_tool(name, args)`,于是角色恒落形参默认 0 —— 管理员在引擎线程里
    永远拿不到 run_command / write_file(功能面死锁,且 typecheck 全绿)。
    """
    from app.services import mcp_server

    seen: list[dict[str, Any]] = []

    async def spy(name: str, args: dict[str, Any], *, user_role: int = 0) -> dict[str, Any]:
        seen.append({"name": name, "user_role": user_role})
        return {"ok": True}

    monkeypatch.setattr(mcp_server.mcp_server, "call_tool", spy)

    tools = await agents_router._build_loop_v2_tools(["run_command", "write_file"], user_role=1)
    by_name = {t.name: t for t in tools}
    await by_name["run_command"].executor({"command": "true"})
    await by_name["write_file"].executor({"path": "a"})

    assert [s["user_role"] for s in seen] == [1, 1], "角色未透传 ⇒ 管理员仍被按 role=0 拒"
    assert [s["name"] for s in seen] == ["run_command", "write_file"]


@pytest.mark.asyncio
async def test_supertool_internal_branch_forwards_role(monkeypatch: pytest.MonkeyPatch) -> None:
    """超级工具聚合支路的内置源同样透传(两条支路漏一条就会按路径不同给不同答案)。"""
    from app.services import mcp_server

    seen: list[int] = []

    async def spy(name: str, args: dict[str, Any], *, user_role: int = 0) -> dict[str, Any]:
        seen.append(user_role)
        return {"ok": True, "name": name}

    monkeypatch.setattr(mcp_server.mcp_server, "call_tool", spy)
    out = await agents_router._supertool_invoke(
        agents_router._SUPERTOOL_INTERNAL_SOURCE, "run_command", {}, 1
    )
    assert out == {"ok": True, "name": "run_command"}
    assert seen == [1]
    # 不传角色 ⇒ 仍是 0(fail-closed,不是"没限制")
    await agents_router._supertool_invoke(
        agents_router._SUPERTOOL_INTERNAL_SOURCE, "run_command", {}
    )
    assert seen == [1, 0]


@pytest.mark.asyncio
async def test_real_call_matrix_role_one_is_not_denied(monkeypatch: pytest.MonkeyPatch) -> None:
    """对照真矩阵:role 0 被拒、role 1 放行到 handler(证明"透传"确实改变了结论)。"""
    from app.services import mcp_server

    ran: list[dict[str, Any]] = []

    async def stub(args: dict[str, Any]) -> dict[str, Any]:
        ran.append(args)
        return {"ok": True}

    monkeypatch.setitem(mcp_server._TOOL_HANDLERS, "run_command", stub)

    denied = await mcp_server.mcp_server.call_tool("run_command", {"command": "x"}, user_role=0)
    assert denied.get("errorCode") == "PERMISSION_DENIED"
    assert ran == []

    allowed = await mcp_server.mcp_server.call_tool("run_command", {"command": "x"}, user_role=1)
    assert allowed.get("ok") is True, allowed
    assert len(ran) == 1


# ---------------------------------------------------------------------------
# 4. 非 admin 工具在 role 0 下行为不变(非回归)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_non_admin_tools_unchanged_at_role_zero(
    _fake_events: dict[str, list[dict[str, Any]]],
) -> None:
    # read_file:注册表只读工具,既非高危也非 admin ⇒ role 0 直接执行
    loop, executed = _loop(["read_file"], user_role=0)
    tr = await loop._execute_single(ToolCall(id="c1", name="read_file", args={"path": "a"}))
    assert executed == ["read_file"]
    assert tr.error is None

    # clock_curr_time:引擎内置名,桥表登记为"仅引擎本地"(无注册表等价物)⇒ 不得误伤
    loop2, executed2 = _loop(["clock_curr_time"], user_role=0)
    tr2 = await loop2._execute_single(ToolCall(id="c2", name="clock_curr_time", args={}))
    assert executed2 == ["clock_curr_time"]
    assert tr2.error is None


@pytest.mark.asyncio
async def test_search_tool_forwards_zero_without_special_casing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """只读工具同样透传角色(值为 0)—— 透传是无条件的,不给"某些工具跳过矩阵"留口。"""
    from app.services import mcp_server

    seen: list[int] = []

    async def spy(name: str, args: dict[str, Any], *, user_role: int = 0) -> dict[str, Any]:
        seen.append(user_role)
        return {"ok": True}

    monkeypatch.setattr(mcp_server.mcp_server, "call_tool", spy)
    tools = await agents_router._build_loop_v2_tools(["read_file"], user_role=0)
    await tools[0].executor({"path": "a"})
    assert seen == [0]


# ---------------------------------------------------------------------------
# 5. 载体链:_spec(thread) 带 role_id;取不到即 0
# ---------------------------------------------------------------------------


def test_spec_carries_role_id() -> None:
    thread = EngineThread(
        thread_id="thr_1",
        session_id="s1",
        model=None,
        permission_mode="default",
        max_iterations=8,
        tool_names=None,
        workspace=None,
        user_id="u1",
        conversation_id=None,
        messages=[{"role": "system", "content": "x"}],
        role_id=1,
    )
    assert _spec(thread)["role_id"] == 1
    # 未显式给角色 ⇒ 0(dataclass 默认,与 call_tool 形参默认同档)
    thread.role_id = 0
    assert _spec(thread)["role_id"] == 0


def test_coerce_role_id_is_fail_closed() -> None:
    assert _coerce_role_id(None) == 0
    assert _coerce_role_id("admin") == 0
    assert _coerce_role_id(-3) == 0
    assert _coerce_role_id(True) == 1
    assert _coerce_role_id("2") == 2


@pytest.mark.asyncio
async def test_engine_thread_start_and_prompt_reach_loop_with_role() -> None:
    """端到端(引擎内,不经 HTTP):thread.start 的 roleId → _spec → 工厂 spec。

    承载层 `_bind_principal` 会无条件把 params.roleId 覆盖为令牌里的角色,所以这里给
    的 roleId 等价于"已验证角色";自述值能否生效由
    tests/test_engine_principal_binding_59.py::test_bind_principal_edge_shapes 钉。
    """
    specs: list[dict[str, Any]] = []

    class _FakeLoop:
        async def run(self, messages: list[dict[str, Any]]) -> Any:
            return _Done()

        async def resume_from_checkpoint(self, checkpoint_id: str) -> Any:
            return _Done()

        async def interrupt(self, mode: str = "cancel") -> Any:
            return None

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> Any:
        specs.append(spec)
        return _FakeLoop()

    engine = AgentEngine(loop_factory=factory)

    async def rpc(method: str, params: dict[str, Any], req_id: int = 1) -> dict[str, Any]:
        resp = await engine.handle_message(
            {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
        )
        assert resp is not None and "error" not in resp, resp
        return resp["result"]

    started = await rpc("thread.start", {"userId": "u-admin", "roleId": 1})
    await rpc("thread.prompt", {"threadId": started["threadId"], "input": "hi"}, req_id=2)
    assert specs and specs[0]["role_id"] == 1
    assert specs[0]["user_id"] == "u-admin"

    # 未带角色 ⇒ 0(fail-closed 贯通到工厂,不靠调用方记得传)
    started2 = await rpc("thread.start", {"userId": "u-user"}, req_id=3)
    await rpc("thread.prompt", {"threadId": started2["threadId"], "input": "hi"}, req_id=4)
    assert specs[1]["role_id"] == 0

    # 分叉线程继承角色(否则 fork 成一条绕过角色闸的通道)
    forked = await rpc("thread.fork", {"threadId": started["threadId"]}, req_id=5)
    await rpc("thread.prompt", {"threadId": forked["threadId"], "input": "hi"}, req_id=6)
    assert specs[2]["role_id"] == 1


class _Done:
    success = True
    stop_reason = "end_turn"
    final_response = "done"
    iterations: list[Any] = []
    total_duration_ms = 1.0
    total_tokens_used = 0
    checkpoint_id = None
    error = None
    budget = None
    compaction_events: list[Any] = []


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
