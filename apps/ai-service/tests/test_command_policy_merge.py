# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""命令策略多档合并器(仓库档 ⊕ 企业档)单元测试 —— goal-b49(Y2 席)。

判据只有一份实现:``app/core/command_policy_merge.py``(+ 形状层 ``app/core/command_policy_tiers.py``),
本文件 **import 真源**,不复制任何常量表(AGENTS §0.6)。

覆盖:
- 正例:企业档命中 → 企业档裁决胜出且点名来源;
- 反例:企业档不命中 → 回落仓库档;
- 边界例:两侧都命中 → 两条都点名,优先级为什么这样排写进出声文本;
- 「未判定」:形状非法 / 正则非法 / 企业快照读不到 ⇒ 不折成 deny/allow;
- 不可变路径按**路径组件边界**命中(提交信息里提到同名片段不算引用)。

真消费点(`mcp_server._tool_run_command`)的接线用例在
``tests/test_command_policy_merge_wiring.py``。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.core.command_policy_merge import (
    PolicyOutcome,
    PolicyTier,
    adjudicate_command,
    command_rule_name,
)
from app.services.exec_policy import Decision


@pytest.fixture(autouse=True)
def _no_enterprise_snapshot(monkeypatch: pytest.MonkeyPatch) -> None:
    """默认不挂企业快照(各用例自己显式挂)。"""
    monkeypatch.delenv("IHUI_ENTERPRISE_COMMAND_POLICY", raising=False)


def _doc(**sections: object) -> dict[str, object]:
    """造一份策略文档(顶层键 = 仓库档;enterprise = 企业档)。"""
    doc: dict[str, object] = {"dangerous_patterns": [], "allowed_prefixes": ["echo"]}
    doc.update(sections)
    return doc


# =============================================================================
# 合并器:正例 / 反例 / 边界例
# =============================================================================


def test_enterprise_hit_wins_and_names_source() -> None:
    """正例:企业档黑名单命中 → 拒绝档,且胜出规则点名「企业档」。"""
    doc = _doc(enterprise={"black_list": ["\\bnpm\\s+publish\\b"]})
    verdict = adjudicate_command("npm publish", doc)
    assert verdict.outcome is PolicyOutcome.DENY
    assert verdict.winner is not None
    assert verdict.winner.tier is PolicyTier.ENTERPRISE
    assert verdict.command_rule == "command_rule_deny"
    assert "企业档" in verdict.to_explanation()
    assert "enterprise/black_list" in verdict.to_explanation()


def test_enterprise_miss_falls_back_to_repo_tier() -> None:
    """反例:企业档没命中 → 回落仓库档(仓库档 red_list ⇒ 需审批)。"""
    doc = _doc(red_list=["\\bgit\\s+push\\b"], enterprise={"black_list": ["\\bnpm\\s+publish\\b"]})
    verdict = adjudicate_command("git push origin main", doc)
    assert verdict.outcome is PolicyOutcome.ASK
    assert verdict.winner is not None
    assert verdict.winner.tier is PolicyTier.REPO
    assert verdict.command_rule == "command_rule_ask"
    assert "仅仓库档命中" in verdict.to_explanation()


def test_both_tiers_hit_names_both_and_enterprise_wins_tie() -> None:
    """边界例:两侧都命中且同严 → 企业档胜出,两条都点名(不静默改判)。"""
    doc = _doc(
        black_list=["\\bdeploy\\b"],
        enterprise={"black_list": ["\\bdeploy\\b"]},
    )
    verdict = adjudicate_command("deploy prod", doc)
    assert verdict.outcome is PolicyOutcome.DENY
    assert verdict.winner is not None
    assert verdict.winner.tier is PolicyTier.ENTERPRISE
    assert {hit.tier for hit in verdict.hits} == {PolicyTier.ENTERPRISE, PolicyTier.REPO}
    explanation = verdict.to_explanation()
    assert "同严度时企业档优先" in explanation
    assert "另命中=" in explanation
    assert "repo/black_list" in explanation


def test_repo_stricter_than_enterprise_keeps_deny() -> None:
    """边界例:仓库档更严 ⇒ 仓库档红线不被企业档放宽(§0.10)。"""
    doc = _doc(black_list=["\\bdeploy\\b"], enterprise={"red_list": ["\\bdeploy\\b"]})
    verdict = adjudicate_command("deploy prod", doc)
    assert verdict.outcome is PolicyOutcome.DENY
    assert verdict.winner is not None
    assert verdict.winner.tier is PolicyTier.REPO
    assert "企业档不放宽仓库档红线" in verdict.to_explanation()


def test_no_hit_is_none_not_allow() -> None:
    """两档皆未命中 ⇒ NONE(既不是 allow 也不是 deny)。"""
    verdict = adjudicate_command("echo hello", _doc())
    assert verdict.outcome is PolicyOutcome.NONE
    assert verdict.decision is None
    assert verdict.command_rule is None


def test_allow_tier_maps_to_command_rule_allow() -> None:
    """allow 档 ⇒ command_rule_allow(命令级三段决策齐三档)。"""
    verdict = adjudicate_command("echo hello", _doc(allow=["\\becho\\b"]))
    assert verdict.outcome is PolicyOutcome.ALLOW
    assert verdict.command_rule == "command_rule_allow"


def test_command_rule_name_covers_three_segments() -> None:
    """三段决策名与对侧 `command_rule_{deny,ask,allow}` 同形。"""
    assert command_rule_name(Decision.DENY) == "command_rule_deny"
    assert command_rule_name(Decision.PROMPT) == "command_rule_ask"
    assert command_rule_name(Decision.ALLOW) == "command_rule_allow"


# =============================================================================
# 「未判定」不折成 deny/allow
# =============================================================================


def test_malformed_tier_is_undetermined() -> None:
    """档位键形状非法 ⇒ 未判定(不是「该档没这条规则」)。"""
    verdict = adjudicate_command("echo hello", _doc(black_list="oops"))
    assert verdict.outcome is PolicyOutcome.UNDETERMINED
    assert verdict.decision is None
    assert verdict.command_rule is None
    assert "形状非法" in verdict.reason


def test_invalid_regex_is_undetermined() -> None:
    """规则正则非法 ⇒ 未判定(不静默跳过这条规则)。"""
    verdict = adjudicate_command("echo hello", _doc(black_list=["["]))
    assert verdict.outcome is PolicyOutcome.UNDETERMINED
    assert "正则非法" in verdict.reason


def test_unknown_enterprise_key_is_undetermined() -> None:
    """企业段出现本仓不认识的规则键 ⇒ 未判定(不静默忽略)。"""
    doc = _doc(enterprise={"black_list": ["\\bx\\b"], "sandbox_model_escape": ["\\by\\b"]})
    verdict = adjudicate_command("echo hello", doc)
    assert verdict.outcome is PolicyOutcome.UNDETERMINED
    assert "未知规则键" in verdict.reason


def test_unreadable_enterprise_snapshot_is_undetermined(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """企业快照读不到 ⇒ 未判定(不静默把企业策略当它不存在)。"""
    monkeypatch.setenv("IHUI_ENTERPRISE_COMMAND_POLICY", str(tmp_path) + "/nope.json")
    verdict = adjudicate_command("echo hello", _doc())
    assert verdict.outcome is PolicyOutcome.UNDETERMINED
    assert "企业策略快照不可读" in verdict.reason


def test_enterprise_snapshot_replaces_repo_baseline(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """下发的企业快照整档替换仓内企业基线(同权威,不做二次合并)。"""
    snapshot = tmp_path / "enterprise.json"
    snapshot.write_text(
        json.dumps({"source": "pushed", "black_list": ["\\bnpm\\s+publish\\b"]}),
        encoding="utf-8",
    )
    monkeypatch.setenv("IHUI_ENTERPRISE_COMMAND_POLICY", str(snapshot))
    doc = _doc(enterprise={"black_list": ["\\bdeploy\\b"]})
    verdict = adjudicate_command("npm publish", doc)
    assert verdict.outcome is PolicyOutcome.DENY
    assert verdict.winner is not None
    assert verdict.winner.tier is PolicyTier.ENTERPRISE
    # 仓内基线被整档替换 ⇒ deploy 不再命中企业档
    baseline = adjudicate_command("deploy prod", doc)
    assert baseline.outcome is PolicyOutcome.NONE


# =============================================================================
# 不可变路径:组件边界
# =============================================================================


def test_immutable_path_hits_on_component_boundary() -> None:
    """不可变路径按组件边界命中。"""
    verdict = adjudicate_command("cat .git/config", _doc(immutable_paths=[".git/config"]))
    assert verdict.outcome is PolicyOutcome.DENY
    assert verdict.winner is not None
    assert verdict.winner.kind.value == "immutable_paths"


def test_immutable_path_ignores_mention_inside_message() -> None:
    """提交信息里提到同名片段不算引用(同一 token 内含空格 ⇒ 不命中)。"""
    verdict = adjudicate_command(
        'git commit -m "fix .git/config handling"', _doc(immutable_paths=[".git/config"])
    )
    assert verdict.outcome is PolicyOutcome.NONE
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
