# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""Harness 命令策略(2026-09-18 第十六批,对标 Codex execpolicy)单测。

聚焦「审批不再逐次打扰」:
- 前缀放行规则:用户选"这类命令以后都允许" → 前 N 个 token 建规则,同前缀
  命令长期放行(一次性放行只解决一次,前缀规则解决一类)
- 粒度安全:('git','push') 放行所有 git push,但不含 git status/gitpus
- 可撤销、可枚举(可观测),空命令不建规则
"""

import pytest

from app.services import mcp_server
from app.services.mcp_server import (
    _matches_exec_prefix,
    approve_exec_prefix,
    list_exec_prefix_rules,
    revoke_exec_prefix,
)


@pytest.fixture(autouse=True)
def _clean_prefix_rules(tmp_path):
    """用例前后清空全局前缀规则表 + 隔离审批持久层。

    approve_exec_prefix 会双写持久层(always 档):不隔离会把 ('git',) 等
    授权写到当时的 db(可能是上游测试泄漏的 tmp 路径或真实数据文件),
    造成跨文件污染。teardown 恢复默认路径(对齐 test_tool_approval_persist_52)。
    """
    from app.services import approval_persistence as ap

    saved = set(mcp_server._exec_allowed_prefixes)
    mcp_server._exec_allowed_prefixes.clear()
    ap.set_db_path(tmp_path / "approval_grants.db")
    yield
    ap.close()
    ap.set_db_path(ap.DEFAULT_DB_PATH)
    mcp_server._exec_allowed_prefixes.clear()
    mcp_server._exec_allowed_prefixes.update(saved)


def test_prefix_rule_matches_same_prefix_only():
    assert approve_exec_prefix("git push --force origin main") == ("git", "push")
    assert _matches_exec_prefix("git push --force") is True
    assert _matches_exec_prefix("git push origin HEAD~1") is True
    # 不越权:同命令族其它子命令、以及非词边界前缀都不放行
    assert _matches_exec_prefix("git status") is False
    assert _matches_exec_prefix("gitpus x") is False


def test_prefix_rule_token_count_controls_breadth():
    """tokens=1 → 放行整个 git 命令族;默认 2 → 只放行该子命令。"""
    approve_exec_prefix("git status --short", tokens=1)
    assert _matches_exec_prefix("git status") is True
    assert _matches_exec_prefix("git log") is True


def test_prefix_rule_revoke_and_list():
    approve_exec_prefix("pnpm install --frozen-lockfile")
    approve_exec_prefix("pytest tests/ -q")
    rules = list_exec_prefix_rules()
    assert ["pnpm", "install"] in rules and ["pytest", "tests/"] in rules
    assert revoke_exec_prefix(["pnpm", "install"]) is True
    assert _matches_exec_prefix("pnpm install") is False
    assert _matches_exec_prefix("pytest tests/ -q") is True
    assert revoke_exec_prefix(["pnpm", "install"]) is False  # 已不存在


def test_prefix_rule_ignores_empty_command():
    assert approve_exec_prefix("") is None
    assert approve_exec_prefix("   ") is None
    assert _matches_exec_prefix("") is False


def test_prefix_rule_capacity_clears_instead_of_overflowing(monkeypatch):
    """容量上限命中时整体清空(与一次性放行同策略),不做逐条淘汰。"""
    monkeypatch.setattr(mcp_server, "_EXEC_ALLOWED_PREFIXES_MAX", 3)
    for i in range(3):
        approve_exec_prefix(f"tool{i} run")
    assert len(mcp_server._exec_allowed_prefixes) == 3
    approve_exec_prefix("tool3 run")  # 触发清空
    assert list_exec_prefix_rules() == [["tool3", "run"]]


class _FakePromptDecision:
    """构造 exec_policy 的 PROMPT 判定结果(不依赖真实策略文件)。"""

    action = mcp_server.RuleDecision.PROMPT
    matched_rules: list = []
    risk_notes: list = ["测试构造:需人工审批"]


@pytest.mark.asyncio
async def test_prefix_rule_bypasses_prompt_but_not_first_time(monkeypatch):
    """端到端:未登记 → 需审批;登记前缀规则 → 直接放行执行。"""
    monkeypatch.setattr(
        mcp_server, "exec_policy_evaluate", lambda *a, **k: _FakePromptDecision()
    )
    # security_config 是 frozen pydantic 模型,不能直接 setattr → 用代理只覆盖
    # exec_policy_mode,其余属性仍走真实配置(不失真)
    real_cfg = mcp_server.get_security_config()

    class _CfgProxy:
        def __getattr__(self, name: str):
            if name == "exec_policy_mode":
                return "enforce"
            return getattr(real_cfg, name)

    monkeypatch.setattr(mcp_server, "get_security_config", lambda: _CfgProxy())

    first = await mcp_server._tool_run_command({"command": "echo hi"})
    assert first.get("errorCode") == "EXEC_POLICY_NEEDS_APPROVAL"

    approve_exec_prefix("echo hi", tokens=1)
    second = await mcp_server._tool_run_command({"command": "echo hi"})
    assert second.get("errorCode") != "EXEC_POLICY_NEEDS_APPROVAL"
    assert second["ok"] is True
    # 前缀规则长期有效:重复执行仍放行(不消费)
    third = await mcp_server._tool_run_command({"command": "echo hi"})
    assert third["ok"] is True
