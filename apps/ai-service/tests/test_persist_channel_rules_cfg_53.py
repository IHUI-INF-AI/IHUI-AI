# © 2026 IHUI AI (智汇AI) · 版权所有者:李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批 53 审批 persist 传参通道 + exec_policy 规则目录配置化 单元测试(2026-09-20 立)。

覆盖:
审批 persist 通道(对齐 codex PERSIST_SESSION / PERSIST_ALWAYS):
- ① engine handler params 带 persist="always" + 有效 approval_id → 响应 persisted="always"
    且持久层有 always 记录;
- ② persist="session" 同理 → persisted="session" 且持久层有 session 记录;
- ③ persist 非法值 → INVALID_PARAMS;
- ④ 未知 approval_id → grant_tool_approval_persist 返回 False;
- ⑤ 不传 persist → persisted=None 且引擎不落盘(行为与批 52 一致,session 由 loop 写)。

exec_policy 规则目录配置化:
- ⑥ rules_dir_from_env 未设置/为空 → 返回 None;
- ⑦ 设置后返回去空白后的路径;
- ⑧ get_or_create_manager 单例(两次调用同一对象);
- ⑨ 设 env 后 get_or_create_manager 首次创建读取 rules 目录(自定义规则生效命中)。

参考同仓 tests/test_tool_approval_persist_52.py 与 test_engine_harness_*.py 的隔离模式。
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from app.services import approval_persistence
from app.services import exec_policy as ep
from app.services.agent_engine import (
    INVALID_PARAMS,
    AgentEngine,
    JsonRpcError,
)
from app.services.agent_loop_v2 import (
    _approval_persist_keys,
    _approval_registry,
    _tool_approval_cache_key,
    grant_tool_approval_persist,
)
from app.services.exec_policy import Decision

# =============================================================================
# 夹具:隔离持久层 db + 重置审批注册表旁路键 + 关掉引擎持久化
# =============================================================================


@pytest.fixture(autouse=True)
def _persist_channel_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """隔离审批持久层到 tmp_path,重置审批注册表/旁路键,关闭引擎持久化。

    注意:必须原地 clear 而非 monkeypatch.setattr 替换——测试文件顶部
    `from ... import _approval_registry` 捕获的是原 dict 引用,替换模块属性
    会让 _register_approval 写原 dict、engine 读新 dict,永远 miss。
    """
    approval_persistence.set_db_path(tmp_path / "approval_grants.db")
    monkeypatch.setenv("AGENT_ENGINE_PERSIST", "off")
    _approval_registry.clear()
    _approval_persist_keys.clear()
    yield
    approval_persistence.close()
    approval_persistence.set_db_path(approval_persistence.DEFAULT_DB_PATH)


def _make_engine() -> AgentEngine:
    """构造最小引擎(approval.respond handler 不依赖 loop_factory 产出,但仍需合法工厂)。"""

    async def _factory(_spec, _host_tools):
        return object()

    return AgentEngine(loop_factory=_factory)


async def _noop_emit(_payload: dict) -> None:
    return None


def _register_approval(approval_id: str, key: str) -> None:
    """手工登记一个待决审批(事件 + persist 旁路键),模拟 _request_approval 已发弹窗。"""
    _approval_registry[approval_id] = (asyncio.Event(), None)
    _approval_persist_keys[approval_id] = key


# =============================================================================
# ① persist="always":响应 persisted="always" 且持久层有 always 记录
# =============================================================================


@pytest.mark.asyncio
async def test_persist_always_grants_always() -> None:
    engine = _make_engine()
    approval_id = "appr_53_always"
    key = _tool_approval_cache_key("write_file", {"path": "/tmp/x"})
    _register_approval(approval_id, key)

    resp = await engine._handle_approval_respond(
        {"approvalId": approval_id, "decision": "approve", "persist": "always"},
        _noop_emit,
    )
    assert resp["decision"] == "approve"
    assert resp["applied"] is True
    assert resp["persisted"] == "always"
    # 持久层确有 always 级记录
    assert approval_persistence.check(key, "mcp_tool") == "always"


# =============================================================================
# ② persist="session":响应 persisted="session" 且持久层有 session 记录
# =============================================================================


@pytest.mark.asyncio
async def test_persist_session_grants_session() -> None:
    engine = _make_engine()
    approval_id = "appr_53_session"
    key = _tool_approval_cache_key("write_file", {"path": "/tmp/y"})
    _register_approval(approval_id, key)

    resp = await engine._handle_approval_respond(
        {"approvalId": approval_id, "decision": "approve", "persist": "session"},
        _noop_emit,
    )
    assert resp["persisted"] == "session"
    assert approval_persistence.check(key, "mcp_tool") == "session"


# =============================================================================
# ③ persist 非法值 → INVALID_PARAMS
# =============================================================================


@pytest.mark.asyncio
async def test_persist_invalid_value_rejected() -> None:
    engine = _make_engine()
    with pytest.raises(JsonRpcError) as exc:
        await engine._handle_approval_respond(
            {"approvalId": "appr_x", "decision": "approve", "persist": "forever"},
            _noop_emit,
        )
    assert exc.value.code == INVALID_PARAMS


# =============================================================================
# ④ 未知 approval_id → grant_tool_approval_persist 返回 False
# =============================================================================


def test_grant_persist_unknown_id_returns_false() -> None:
    # 未登记的 id 取不回 key → 返回 False(不落盘)
    assert grant_tool_approval_persist("appr_never_existed", "always") is False
    assert grant_tool_approval_persist("appr_never_existed", "session") is False


# =============================================================================
# ⑤ 不传 persist → persisted=None 且引擎不落盘(批 52 行为不变)
# =============================================================================


@pytest.mark.asyncio
async def test_no_persist_keeps_batch52_behavior() -> None:
    engine = _make_engine()
    approval_id = "appr_53_none"
    key = _tool_approval_cache_key("write_file", {"path": "/tmp/z"})
    _register_approval(approval_id, key)

    resp = await engine._handle_approval_respond(
        {"approvalId": approval_id, "decision": "approve"},  # 无 persist
        _noop_emit,
    )
    assert resp["applied"] is True
    assert resp["persisted"] is None
    # 引擎侧未触发任何落盘(always/session 均由 loop 在批 52 写 session)
    assert approval_persistence.check(key, "mcp_tool") is None


# =============================================================================
# ⑥ rules_dir_from_env 未设置/为空 → None
# =============================================================================


def test_rules_dir_from_env_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("IHUI_EXEC_POLICY_RULES_DIR", raising=False)
    assert ep.rules_dir_from_env() is None

    monkeypatch.setenv("IHUI_EXEC_POLICY_RULES_DIR", "   ")
    assert ep.rules_dir_from_env() is None


# =============================================================================
# ⑦ 设置后返回去空白后的路径
# =============================================================================


def test_rules_dir_from_env_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("IHUI_EXEC_POLICY_RULES_DIR", "  /data/policy/rules  ")
    assert ep.rules_dir_from_env() == "/data/policy/rules"


# =============================================================================
# ⑧ get_or_create_manager 单例(两次调用同一对象)
# =============================================================================


def test_get_or_create_manager_singleton(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("IHUI_EXEC_POLICY_RULES_DIR", raising=False)
    ep.reset_manager()
    m1 = ep.get_or_create_manager()
    m2 = ep.get_or_create_manager()
    assert m1 is m2
    # 纯内存模式也应有一个合法快照(内建规则)
    assert m1.current() is not None


# =============================================================================
# ⑨ 设 env 后 get_or_create_manager 首次创建读取 rules 目录(自定义规则命中)
# =============================================================================


def test_get_or_create_manager_reads_rules_dir(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    rules_dir = tmp_path / "policy_rules"
    rules_dir.mkdir()
    # 自定义规则:customcmd foo → 需人工确认(内建规则不含此命令,默认会 ALLOW)
    (rules_dir / "custom.rules").write_text("PROMPT|customcmd foo\n", encoding="utf-8")

    monkeypatch.setenv("IHUI_EXEC_POLICY_RULES_DIR", str(rules_dir))
    ep.reset_manager()
    mgr = ep.get_or_create_manager()
    policy = mgr.current()
    decision = policy.evaluate("customcmd foo", shell="posix")
    # 自定义规则已加载并命中 → PROMPT(若无目录加载,默认应为 ALLOW)
    assert decision.decision is Decision.PROMPT
    # 内建危险规则仍生效(向后兼容)
    assert policy.evaluate("rm -rf /", shell="posix").decision is Decision.DENY
