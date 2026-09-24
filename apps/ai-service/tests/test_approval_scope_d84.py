# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D84 审批作用域四件套(2026-09-23 立):once / session / always / 拒绝+原因。

对标 codex PERSIST_ONCE/SESSION/ALWAYS:
- once   = 仅本次执行,绝不落任何授权(最小特权;旧版"批准即授 session"已收窄);
- session= 同键(工具+参数归一)本会话免弹窗,服务重启/过期即失效;
- always = 同键跨会话免弹窗(approval_grants.db 持久行);
- 拒绝可附原因,进决策提示(_decision_hints),不参与判定;
- 授权按 cache_key 精确匹配:**任何作用域都不放大到其他工具/参数(不回退成全局)**;
- scope 缺省(None,旧客户端)保持批 52 兼容行为(授 session)。
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest


@pytest.fixture()
def persist(monkeypatch, tmp_path):
    """独立 db 路径(隔离全局单例),对齐 test_approval_wiring_51 的 fixture 模式。"""
    from app.services import approval_persistence as ap

    ap.set_db_path(tmp_path / "grants.db")
    yield ap
    ap.close()
    ap.set_db_path(ap.DEFAULT_DB_PATH)


def _clean_registry():
    from app.services import agent_loop_v2 as v2

    v2._approval_registry.clear()
    v2._approval_persist_keys.clear()
    return v2


@dataclass
class _StubToolCall:
    """最小 ToolCall 形态(_request_approval 只消费 name/args/id)。"""

    id: str = "tc_1"
    name: str = "write_file"
    args: dict[str, Any] = field(default_factory=lambda: {"path": "/tmp/a.txt"})


class _StubLoop:
    """_request_approval 的最小 self(鸭子类型,不构造完整 AgentLoopV2)。"""

    def __init__(self) -> None:
        self._decision_hints: dict[str, tuple[str, str]] = {}
        self._user_id = "user-1"
        self._session_id = "sess-1"
        self._approval_timeout = 5
        self.emitted: list[dict[str, Any]] = []
        self._events = SimpleNamespace(tool_approval=self._emit)

    async def _emit(self, **kwargs: Any) -> None:
        self.emitted.append(kwargs)


def _drive_approve(v2, scope: str | None, decision: str = "approve", reason: str | None = None):
    """驱动真实 _request_approval 到结算,返回 (结果, cache_key)。"""

    async def scenario():
        stub = _StubLoop()
        tc = _StubToolCall()
        task = asyncio.create_task(v2.AgentLoopV2._request_approval(stub, tc))
        for _ in range(200):
            if v2._approval_registry:
                break
            await asyncio.sleep(0.005)
        approval_id = next(iter(v2._approval_registry))
        outcome = v2.resolve_approval_for_requester(
            approval_id, decision, "user-1", scope=scope, reason=reason
        )
        assert outcome is v2.ApprovalOutcome.APPLIED
        result = await task
        key = v2._tool_approval_cache_key(tc.name, tc.args)
        return result, key, stub

    return asyncio.run(scenario())


# ==================== 纯函数:scope → 落盘档位 ====================


def test_scope_mapping_once_grants_nothing(persist):
    from app.services.agent_loop_v2 import grant_scope_for_approval

    assert grant_scope_for_approval("once") is None


def test_scope_mapping_session_and_always(persist):
    from app.services.agent_loop_v2 import grant_scope_for_approval

    assert grant_scope_for_approval("session") == "session"
    assert grant_scope_for_approval("always") == "always"


def test_scope_mapping_none_keeps_legacy_session(persist):
    """旧客户端未携带 scope → 保持批 52 兼容行为(授 session)。"""
    from app.services.agent_loop_v2 import grant_scope_for_approval

    assert grant_scope_for_approval(None) == "session"


def test_scope_mapping_illegal_value_never_escalates(persist):
    """非法值防御性兜底为不落盘 —— 绝不放大授权。"""
    from app.services.agent_loop_v2 import grant_scope_for_approval

    assert grant_scope_for_approval("global") is None
    assert grant_scope_for_approval("yolo") is None


# ==================== 端到端:_request_approval × 持久层 ====================


def test_once_approval_leaves_no_grant_row(persist):
    v2 = _clean_registry()
    result, key, _ = _drive_approve(v2, scope="once")
    assert result is None  # 批准,工具继续
    assert persist.check(key, "mcp_tool") is None  # 但不落任何授权


def test_session_approval_grants_session_row(persist):
    v2 = _clean_registry()
    result, key, _ = _drive_approve(v2, scope="session")
    assert result is None
    assert persist.check(key, "mcp_tool") == "session"


def test_always_approval_grants_persistent_row(persist):
    v2 = _clean_registry()
    result, key, _ = _drive_approve(v2, scope="always")
    assert result is None
    assert persist.check(key, "mcp_tool") == "always"


def test_missing_scope_keeps_legacy_session_grant(persist):
    """scope=None(旧客户端)→ 与批 52 行为一致:批准即授 session。"""
    v2 = _clean_registry()
    result, key, _ = _drive_approve(v2, scope=None)
    assert result is None
    assert persist.check(key, "mcp_tool") == "session"


def test_always_grant_never_leaks_to_other_tools(persist):
    """持久化作用域不回退成全局:always 授权只命中同键,其他工具/参数一律不命中。"""
    v2 = _clean_registry()
    _, key, _ = _drive_approve(v2, scope="always")
    assert persist.check(key, "mcp_tool") == "always"
    # 不同工具
    other_tool_key = v2._tool_approval_cache_key("run_command", {"cmd": "ls"})
    assert persist.check(other_tool_key, "mcp_tool") is None
    # 同工具不同参数
    other_args_key = v2._tool_approval_cache_key("write_file", {"path": "/tmp/other.txt"})
    assert persist.check(other_args_key, "mcp_tool") is None


def test_persist_hit_skips_dialog(persist):
    """授权命中后,同键下一次审批免弹窗直接放行(不产生新审批请求)。"""
    v2 = _clean_registry()
    _, key, _ = _drive_approve(v2, scope="always")
    stub = _StubLoop()
    result = asyncio.run(v2.AgentLoopV2._request_approval(stub, _StubToolCall()))
    assert result is None
    assert stub.emitted == []  # 未发 tool_approval 事件 = 用户无感


def test_reject_with_reason_records_hint(persist):
    """拒绝 + 原因:工具不执行,原因进 _decision_hints(供审计/timeline 消费)。"""
    v2 = _clean_registry()
    result, key, stub = _drive_approve(
        v2, scope="once", decision="reject", reason="不要动这个文件"
    )
    assert result == "user_rejected"
    assert persist.check(key, "mcp_tool") is None  # 拒绝不落任何授权
    assert stub._decision_hints.get("tc_1") == ("rejected_by_user", "不要动这个文件")


def test_reject_without_reason_writes_no_hint(persist):
    """拒绝无原因:不写 hint key(空值不写 key 语义)。"""
    v2 = _clean_registry()
    result, _, stub = _drive_approve(v2, scope="once", decision="reject", reason=None)
    assert result == "user_rejected"
    assert "tc_1" not in stub._decision_hints
