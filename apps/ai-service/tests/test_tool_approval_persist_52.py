# © 2026 IHUI AI (智汇AI) · 版权所有者:李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""agent_loop_v2.py 工具审批持久层(批 52:对标 codex PERSIST_SESSION /
PERSIST_ALWAYS 审批决策持久化)单元测试(2026-09-20 立)。

覆盖:
- ① 首次调用弹窗,批准后持久层有 session 记录;
- ② 同键第二次调用不再弹窗(直接放行);
- ③ 不同参数 = 不同键,各弹各的;
- ④ revoke 后同键恢复弹窗;
- ⑤ 持久层 check 抛异常时仍走人工弹窗(fail-closed,绝不静默放行);
- ⑥ grant 抛异常不影响批准返回 None(工具照常执行)。

mock 策略:
- hook_engine 单例替换为 fake(记录 emit 的 tool.approval 事件,不真广播);
- 审批持久层用 tmp_path 注入独立 db(approval_persistence.set_db_path)隔离。
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

import app.services.agent_loop_v2 as agent_loop_v2
from app.services import approval_persistence
from app.services.agent_loop_v2 import (
    AgentLoopV2,
    ToolCall,
    ToolDefinition,
    _tool_approval_cache_key,
    resolve_approval_response,
    revoke_tool_approval,
)

# =============================================================================
# fixture:注入独立持久层 db + 记录 hook_engine emit + 重置审批注册表
# =============================================================================


@pytest.fixture
def _persist_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> list[dict]:
    """隔离持久层到 tmp_path,记录 emit 事件,重置模块级审批注册表。"""
    approval_persistence.set_db_path(tmp_path / "approval_grants.db")
    emitted: list[dict] = []
    emit_lock = asyncio.Lock()

    class FakeHookEngine:
        async def emit(self, event: str, context: dict) -> list:
            async with emit_lock:
                emitted.append({"event": event, **context})
            return []

    monkeypatch.setattr(agent_loop_v2, "hook_engine", FakeHookEngine())
    monkeypatch.setattr(agent_loop_v2, "_approval_registry", {})
    yield emitted
    # 清理:关闭持久层连接并复位 db 路径(避免污染其他测试模块)
    approval_persistence.close()
    approval_persistence.set_db_path(approval_persistence.DEFAULT_DB_PATH)


def _popup_count(emitted: list[dict]) -> int:
    """统计 tool.approval 弹窗事件数。"""
    return sum(1 for e in emitted if e["event"] == "tool.approval")


async def _drive_approval(
    loop: AgentLoopV2,
    tc: ToolCall,
    decision: str,
    emitted: list[dict],
) -> object:
    """驱动一次工具调用:若本次弹窗(tool_call_id==tc.id)则按 decision 响应。

    持久命中的调用不会发 tool.approval 事件,任务会直接放行完成 —— 此时
    task 已 done,循环提前退出,无需响应。注意匹配本 tc 的 tool_call_id,
    避免误命中上一次调用残留的 tool.approval 事件。
    """
    task = asyncio.create_task(loop._execute_single(tc))
    for _ in range(200):
        if task.done():
            # 任务已返回(持久命中放行 / 超时 / 错误)→ 无需再等弹窗
            break
        if any(
            e["event"] == "tool.approval" and e.get("tool_call_id") == tc.id
            for e in emitted
        ):
            break
        await asyncio.sleep(0.005)
    popup = next(
        (
            e
            for e in reversed(emitted)
            if e["event"] == "tool.approval" and e.get("tool_call_id") == tc.id
        ),
        None,
    )
    if popup is not None:
        resolve_approval_response(popup["approval_id"], decision)
    return await task


def _write_loop(executor) -> AgentLoopV2:
    """构造最小高危工具(write_file)审批循环。

    2026-09-26(V3 #47 第二格)补 `user_role=1`:`write_file` 同在
    `mcp_server._ADMIN_ONLY_TOOLS`,而角色闸按设计排在审批闸**之前**,role=0 会让本文件
    的持久授权断言根本到不了审批环节(实测表现为 `approval_persistence.check` 零调用)。
    改的是前置条件,不是判据 —— 本文件断言的仍是"弹窗一次、同 key 二次免弹、撤销恢复"。
    角色闸自身的正反例在 tests/test_engine_role_parity.py。
    """
    return AgentLoopV2(
        None,
        [ToolDefinition(name="write_file", description="写文件", parameters={}, executor=executor)],
        approval_enabled=True,
        approval_timeout=5,
        user_role=1,
    )


# =============================================================================
# ① 首次调用弹窗,批准后持久层有 session 记录
# =============================================================================


async def test_first_call_pops_and_persists(_persist_env: list[dict]) -> None:
    emitted = _persist_env

    async def _exec(args: dict) -> dict:
        return {"ok": True, "path": args.get("path")}

    loop = _write_loop(_exec)
    tc = ToolCall(id="c1", name="write_file", args={"path": "/tmp/x"})
    tr = await _drive_approval(loop, tc, "approve", emitted)

    # 弹窗发生且工具批准执行
    assert _popup_count(emitted) == 1
    assert tr.error is None
    assert tr.result == {"ok": True, "path": "/tmp/x"}
    # 批准后持久层有 session 级记录
    key = _tool_approval_cache_key("write_file", {"path": "/tmp/x"})
    assert approval_persistence.check(key, "mcp_tool") == "session"


# =============================================================================
# ② 同键第二次调用不再弹窗(直接放行)
# =============================================================================


async def test_same_key_second_call_no_popup(_persist_env: list[dict]) -> None:
    emitted = _persist_env

    async def _exec(args: dict) -> dict:
        return {"ok": True}

    loop = _write_loop(_exec)
    key = _tool_approval_cache_key("write_file", {"path": "/tmp/x"})

    # 首次:批准并落盘
    tr1 = await _drive_approval(
        loop, ToolCall(id="c1", name="write_file", args={"path": "/tmp/x"}),
        "approve", emitted,
    )
    assert tr1.error is None
    assert approval_persistence.check(key, "mcp_tool") == "session"

    # 第二次:同键 → 免弹窗直接放行
    tr2 = await _drive_approval(
        loop, ToolCall(id="c2", name="write_file", args={"path": "/tmp/x"}),
        "approve", emitted,
    )
    assert tr2.error is None
    # 仅弹窗一次(第二次命中持久授权)
    assert _popup_count(emitted) == 1
    # 决策 hint 记录持久命中
    assert loop._decision_hints["c2"] == ("approval_persist_hit", "持久授权命中: session")


# =============================================================================
# ③ 不同参数 = 不同键,各弹各的
# =============================================================================


async def test_different_args_different_keys(_persist_env: list[dict]) -> None:
    emitted = _persist_env

    async def _exec(args: dict) -> dict:
        return {"ok": True}

    loop = _write_loop(_exec)
    # 不同参数 → 不同键,各自弹窗各自落盘
    await _drive_approval(
        loop, ToolCall(id="c1", name="write_file", args={"path": "/tmp/a"}),
        "approve", emitted,
    )
    await _drive_approval(
        loop, ToolCall(id="c2", name="write_file", args={"path": "/tmp/b"}),
        "approve", emitted,
    )
    assert _popup_count(emitted) == 2
    key_a = _tool_approval_cache_key("write_file", {"path": "/tmp/a"})
    key_b = _tool_approval_cache_key("write_file", {"path": "/tmp/b"})
    assert approval_persistence.check(key_a, "mcp_tool") == "session"
    assert approval_persistence.check(key_b, "mcp_tool") == "session"


# =============================================================================
# ④ revoke 后同键恢复弹窗
# =============================================================================


async def test_revoke_restores_popup(_persist_env: list[dict]) -> None:
    emitted = _persist_env

    async def _exec(args: dict) -> dict:
        return {"ok": True}

    loop = _write_loop(_exec)
    key = _tool_approval_cache_key("write_file", {"path": "/tmp/x"})

    await _drive_approval(
        loop, ToolCall(id="c1", name="write_file", args={"path": "/tmp/x"}),
        "approve", emitted,
    )
    assert approval_persistence.check(key, "mcp_tool") == "session"

    # 撤销两 scope 授权
    revoke_tool_approval("write_file", {"path": "/tmp/x"})
    assert approval_persistence.check(key, "mcp_tool") is None

    # 撤销后同键恢复弹窗
    await _drive_approval(
        loop, ToolCall(id="c2", name="write_file", args={"path": "/tmp/x"}),
        "approve", emitted,
    )
    assert _popup_count(emitted) == 2


# =============================================================================
# ⑤ 持久层 check 抛异常时仍走人工弹窗(fail-closed)
# =============================================================================


async def test_check_exception_falls_through_to_popup(
    _persist_env: list[dict], monkeypatch: pytest.MonkeyPatch
) -> None:
    emitted = _persist_env

    async def _exec(args: dict) -> dict:
        return {"ok": True}

    def _boom(*_a, **_k):  # 持久层故障
        raise RuntimeError("persist down")

    monkeypatch.setattr(approval_persistence, "check", _boom)

    loop = _write_loop(_exec)
    tr = await _drive_approval(
        loop, ToolCall(id="c1", name="write_file", args={"path": "/tmp/x"}),
        "approve", emitted,
    )
    # check 异常 → 仍走人工弹窗并批准执行(fail-closed,不静默放行)
    assert _popup_count(emitted) == 1
    assert tr.error is None
    assert tr.result == {"ok": True}


# =============================================================================
# ⑥ grant 抛异常不影响批准返回 None(工具照常执行)
# =============================================================================


async def test_grant_exception_still_approves(
    _persist_env: list[dict], monkeypatch: pytest.MonkeyPatch
) -> None:
    emitted = _persist_env

    async def _exec(args: dict) -> dict:
        return {"ok": True}

    def _boom(*_a, **_k):  # 落盘失败
        raise RuntimeError("grant down")

    monkeypatch.setattr(approval_persistence, "grant", _boom)

    loop = _write_loop(_exec)
    tr = await _drive_approval(
        loop, ToolCall(id="c1", name="write_file", args={"path": "/tmp/x"}),
        "approve", emitted,
    )
    # grant 异常 → 仍返回 None(批准),工具照常执行;持久层未落盘
    assert _popup_count(emitted) == 1
    assert tr.error is None
    assert tr.result == {"ok": True}
    key = _tool_approval_cache_key("write_file", {"path": "/tmp/x"})
    assert approval_persistence.check(key, "mcp_tool") is None
