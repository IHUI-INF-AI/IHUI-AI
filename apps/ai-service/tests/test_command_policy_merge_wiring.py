# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""命令策略多档层的**真消费点**接线测试 —— goal-b49(Y2 席)。

判据只有一份实现:``app/core/command_policy_merge.py``(+ 形状层 ``app/core/command_policy_tiers.py``),
本文件 **import 真源**,不复制任何常量表(AGENTS §0.6)。

本文件只钉一件事:``mcp_server._tool_run_command``(run_command 工具的真实执行入口)的命令裁决
**经过**合并器并**读它的读数**(AGENTS §0.9「造好没装车 = 没有」):

- 企业档 deny ⇒ ``COMMAND_POLICY_DENIED`` 且消息点名来源(不静默收窄);
- ask 档 ⇒ 走**既有**审批通道(``EXEC_POLICY_NEEDS_APPROVAL``);
- ask 档不被本地长期前缀放行静默放行,只认本层审批回灌的一次性放行;
- 未判定 ⇒ ``COMMAND_POLICY_UNDETERMINED`` 独立出口闭锁(不谎称已判 deny);
- 默认档(五段留空)⇒ 多档层不插手,既有防线逐字不变。
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.core.command_policy_merge import PolicyOutcome, adjudicate_command
from app.services import mcp_server


@pytest.fixture(autouse=True)
def _no_enterprise_snapshot(monkeypatch: pytest.MonkeyPatch) -> None:
    """默认不挂企业快照(各用例自己显式挂)。"""
    monkeypatch.delenv("IHUI_ENTERPRISE_COMMAND_POLICY", raising=False)


def _doc(**sections: object) -> dict[str, object]:
    """造一份策略文档(顶层键 = 仓库档;enterprise = 企业档)。"""
    doc: dict[str, object] = {"dangerous_patterns": [], "allowed_prefixes": ["echo"]}
    doc.update(sections)
    return doc


def _allow_exec_policy(monkeypatch: pytest.MonkeyPatch) -> None:
    """把 exec_policy 引擎 stub 成放行(本文件只测多档层)。"""

    def _eval(command, cwd=None, shell="auto"):  # noqa: ANN001, ANN202
        return SimpleNamespace(
            action=mcp_server.RuleDecision.ALLOW, matched_rules=(), risk_notes=()
        )

    monkeypatch.setattr(mcp_server, "exec_policy_evaluate", _eval)


async def test_run_command_denied_by_enterprise_black_list(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """真消费点:企业档黑名单命中 ⇒ 拒绝,且消息点名来源(不静默收窄)。"""
    _allow_exec_policy(monkeypatch)
    monkeypatch.setattr(
        mcp_server,
        "_load_command_policy",
        lambda: _doc(enterprise={"black_list": ["\\bnpm\\s+publish\\b"]}),
    )
    result = await mcp_server._tool_run_command({"command": "npm publish"})
    assert result["ok"] is False
    assert result["errorCode"] == "COMMAND_POLICY_DENIED"
    assert result["policy_verdict"]["outcome"] == "deny"
    assert result["policy_verdict"]["command_rule"] == "command_rule_deny"
    assert result["policy_verdict"]["tiers"] == ["enterprise"]
    assert "企业档" in result["message"]


async def test_run_command_ask_tier_goes_to_existing_approval_channel(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """真消费点:ask 档 ⇒ 走既有审批通道(EXEC_POLICY_NEEDS_APPROVAL)。"""
    _allow_exec_policy(monkeypatch)
    monkeypatch.setattr(
        mcp_server,
        "_load_command_policy",
        lambda: _doc(red_list=["\\bnpm\\s+publish\\b"]),
    )
    result = await mcp_server._tool_run_command({"command": "npm publish"})
    assert result["ok"] is False
    assert result["errorCode"] == "EXEC_POLICY_NEEDS_APPROVAL"
    assert result["approval_request"]["command"] == "npm publish"
    assert result["policy_verdict"]["outcome"] == "ask"


async def test_run_command_ask_tier_not_bypassed_by_standing_prefix_rule(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """边界:本地**长期**前缀放行不得静默放行 ask 档(§0.10 失效方向恒为更严)。"""
    _allow_exec_policy(monkeypatch)
    monkeypatch.setattr(
        mcp_server,
        "_load_command_policy",
        lambda: _doc(red_list=["\\bnpm\\s+publish\\b"]),
    )
    mcp_server.approve_exec_prefix("npm publish", tokens=1)
    try:
        result = await mcp_server._tool_run_command({"command": "npm publish"})
        assert result["errorCode"] == "EXEC_POLICY_NEEDS_APPROVAL"
    finally:
        mcp_server.revoke_exec_prefix(["npm"])


async def test_run_command_ask_tier_bypassed_by_one_time_approval(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """边界:走完本层审批通道的一次性放行 ⇒ 不重复要审批。"""
    _allow_exec_policy(monkeypatch)
    monkeypatch.setattr(
        mcp_server,
        "_load_command_policy",
        lambda: _doc(red_list=["\\bnpm\\s+publish\\b"]),
    )
    mcp_server.approve_exec_command("npm publish")
    result = await mcp_server._tool_run_command({"command": "npm publish"})
    assert result.get("errorCode") != "EXEC_POLICY_NEEDS_APPROVAL"


async def test_run_command_undetermined_closes_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    """真消费点:策略未判定 ⇒ 独立出口闭锁(不谎称已判 deny)。"""
    _allow_exec_policy(monkeypatch)
    monkeypatch.setattr(
        mcp_server,
        "_load_command_policy",
        lambda: _doc(black_list="oops"),
    )
    result = await mcp_server._tool_run_command({"command": "echo hello"})
    assert result["ok"] is False
    assert result["errorCode"] == "COMMAND_POLICY_UNDETERMINED"
    assert result["policy_verdict"]["outcome"] == "undetermined"


async def test_run_command_default_policy_adds_no_new_gate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """既有消费方回归:默认权威源(五段留空)不改变既有判定 —— 仍由既有前缀白名单拦下。"""
    _allow_exec_policy(monkeypatch)
    monkeypatch.setattr(
        mcp_server,
        "_load_command_policy",
        lambda: _doc(),
    )
    result = await mcp_server._tool_run_command({"command": "npm publish"})
    assert result["ok"] is False
    assert result.get("errorCode") != "COMMAND_POLICY_DENIED"
    assert "不在白名单中" in result["message"]


def test_default_policy_document_keeps_legacy_semantics() -> None:
    """既有 `command_policy.json` 消费方回归:三段语义与多档默认档形状。"""
    policy = mcp_server._load_command_policy()
    # AIS-081:28 → 31 —— 补单 `&`、`^`、换行三种 cmd 串联/转义元字符(只增不减)。
    # 合并波次把这三条从 JSON 与 _COMMAND_POLICY_DEFAULT 一起丢了,已按 8adaf979c3
    # 原样补回;三方逐条 diff:main=28、本分支=31、合并结果补回后=31(= main ∪ 新增3),
    # 无去重、无丢条目,故断言维持 31/31/6。
    assert len(policy["dangerous_patterns"]) == 31
    assert len(policy["allowed_prefixes"]) == 31
    assert len(policy["sensitive_file_markers"]) == 6
    for key in ("red_list", "black_list", "immutable_paths", "allow", "ask"):
        assert policy[key] == []
    assert set(policy["enterprise"]) == {
        "source",
        "red_list",
        "black_list",
        "immutable_paths",
        "allow",
        "ask",
    }
    verdict = adjudicate_command("echo hello", policy)
    assert verdict.outcome is PolicyOutcome.NONE
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
