# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""命令策略**合并裁决层**:企业档 ⊕ 仓库档 → 命令级三段裁决(goal-b49 对位 Trae)。

对位来源:取证册 `docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/T1-impl.md`
§4 第 2 行 —— 对侧 `ai_agent.dll` 面已带 `enterprise_command_blacklist` 与 `sandbox_model_escape`
两枚枚举块,并配命令级三段决策 `command_rule_{deny,ask,allow}`;本仓此前只有单档
`app/data/command_policy.json`,`grep enterprise.*black|red_list|model_escape` 于应用面 0 命中。

形状层在 `app/core/command_policy_tiers.py`;**合并与裁决逻辑只有本模块这一份实现**(§0.6),
测试 import 真源,禁止复制常量表。合并口径:① 严者胜(`deny > ask > allow`,企业档不得放松
仓库档更严裁决,§0.10);② 同严企业优先(企业档是更高权威,胜出规则点名来源);③ 种类优先
(同档同严取 `black_list > immutable_paths > red_list > ask > allow`);④ 未判定不折(形状不对 /
正则非法 / 企业快照读不到 ⇒ 判未判定并点名原因,§0.3)。

超越轴:逐条可解释 + 不静默收窄 —— 对侧「企业策略下发到领域侧、命中即静默」;本仓每条裁决都
带「命中了哪几条规则 / 来源是谁 / 优先级为什么这样排」,由 `to_explanation()` 出声。
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from enum import StrEnum
from typing import Any

from ..services.exec_policy import Decision
from .command_policy_tiers import (
    ENTERPRISE_META_KEYS,
    ENTERPRISE_SNAPSHOT_ENV,
    RULE_KEYS,
    PolicyHit,
    PolicyTier,
    RuleKind,
    load_enterprise_snapshot,
    match_tier_rules,
    parse_tier_rules,
)

__all__ = [
    "ENTERPRISE_SNAPSHOT_ENV", "MergeVerdict", "PolicyHit", "PolicyOutcome",
    "PolicyTier", "RuleKind", "adjudicate_command", "command_rule_name",
    "load_enterprise_snapshot",
]


class PolicyOutcome(StrEnum):
    """合并裁决结果(含两个**非裁决态**:两档皆未命中 / 未判定)。"""

    NONE = "none"
    ALLOW = "allow"
    ASK = "ask"
    DENY = "deny"
    UNDETERMINED = "undetermined"


#: 同档同严时的种类优先序(大者胜)。
_KIND_RANK: dict[RuleKind, int] = {
    RuleKind.BLACK_LIST: 5,
    RuleKind.IMMUTABLE_PATHS: 4,
    RuleKind.RED_LIST: 3,
    RuleKind.ASK: 2,
    RuleKind.ALLOW: 1,
}

#: 档位优先序(企业档在前 ⇒ 同严时企业胜)。
_TIER_RANK: dict[PolicyTier, int] = {PolicyTier.ENTERPRISE: 0, PolicyTier.REPO: 1}

#: 命令级三段决策名(对标对侧的 `command_rule_{deny,ask,allow}`)。
_COMMAND_RULE_NAMES: dict[Decision, str] = {
    Decision.DENY: "command_rule_deny",
    Decision.PROMPT: "command_rule_ask",
    Decision.ALLOW: "command_rule_allow",
}

#: 裁决结果 → (裁决档, 中文标签);裁决档 None = 未判定 / 未命中,不折成 deny/allow。
_OUTCOME_SPEC: dict[PolicyOutcome, tuple[Decision | None, str]] = {
    PolicyOutcome.DENY: (Decision.DENY, "拒绝"),
    PolicyOutcome.ASK: (Decision.PROMPT, "需审批"),
    PolicyOutcome.ALLOW: (Decision.ALLOW, "允许"),
    PolicyOutcome.NONE: (None, "未命中"),
    PolicyOutcome.UNDETERMINED: (None, "未判定"),
}

#: 企业策略快照落地路径的环境变量由形状层持有(`command_policy_tiers.ENTERPRISE_SNAPSHOT_ENV`)。


def command_rule_name(decision: Decision) -> str:
    """裁决 → 命令级三段决策名(`command_rule_deny` / `_ask` / `_allow`)。"""
    return _COMMAND_RULE_NAMES[decision]


@dataclass(frozen=True)
class MergeVerdict:
    """合并裁决结果(逐条可解释)。"""

    outcome: PolicyOutcome
    reason: str
    hits: tuple[PolicyHit, ...] = ()
    winner: PolicyHit | None = None
    tiers: tuple[PolicyTier, ...] = ()

    @property
    def decision(self) -> Decision | None:
        """裁决档;「未判定」与「两档皆未命中」返回 None(不折成 deny/allow)。"""
        return _OUTCOME_SPEC[self.outcome][0]

    @property
    def command_rule(self) -> str | None:
        """命令级三段决策名;未判定 / 未命中为 None。"""
        decision = self.decision
        return None if decision is None else command_rule_name(decision)

    def to_explanation(self) -> str:
        """逐条出声:命中了哪几条、来源是谁、优先级为什么这样排。"""
        if self.outcome is PolicyOutcome.UNDETERMINED:
            return f"命令策略未判定:{self.reason}"
        if self.winner is None:
            return "命令策略未命中任何档位规则(交回既有防线判定)"
        enterprise_hit = any(hit.tier is PolicyTier.ENTERPRISE for hit in self.hits)
        repo_hit = any(hit.tier is PolicyTier.REPO for hit in self.hits)
        if enterprise_hit and repo_hit:
            priority = (
                "两侧都命中:同严度时企业档优先(企业档是更高权威)"
                if self.winner.tier is PolicyTier.ENTERPRISE
                else "两侧都命中:仓库档裁决更严,按严者胜(企业档不放宽仓库档红线)"
            )
        else:
            priority = "仅企业档命中(仓库档无命中)" if enterprise_hit else "仅仓库档命中(企业档无命中)"
        parts = [
            f"裁决={_OUTCOME_SPEC[self.outcome][1]}({self.command_rule})",
            f"胜出规则={self.winner.label}「{self.winner.pattern}」",
            f"命中片段={self.winner.matched!r}",
            f"优先级依据={priority}",
        ]
        others = [hit for hit in self.hits if hit is not self.winner]
        if others:
            parts.append("另命中=" + "; ".join(f"{hit.label}「{hit.pattern}」" for hit in others))
        return " | ".join(parts)

    def to_dict(self) -> dict[str, Any]:
        """可序列化读数(工具回执 / 日志 / 测试断言共用同一份)。"""
        return {
            "outcome": self.outcome.value,
            "command_rule": self.command_rule,
            "reason": self.reason,
            "tiers": [tier.value for tier in self.tiers],
            "hits": [
                {
                    "tier": hit.tier.value,
                    "kind": hit.kind.value,
                    "pattern": hit.pattern,
                    "matched": hit.matched,
                    "decision": hit.decision.value,
                }
                for hit in self.hits
            ],
            "explanation": self.to_explanation(),
        }


def _collect_rules(
    document: Mapping[str, Any], enterprise_snapshot: Mapping[str, Any] | None
) -> tuple[list[tuple[PolicyTier, RuleKind, str]], str | None]:
    """把「仓库档 + 企业档」摊平成带来源的规则列表。"""
    repo_rules, reason = parse_tier_rules(document, PolicyTier.REPO)
    if reason:
        return [], reason
    enterprise_section = enterprise_snapshot
    if enterprise_section is None:
        enterprise_section = document.get("enterprise")
    if enterprise_section is None:
        return repo_rules, None
    if not isinstance(enterprise_section, Mapping):
        return [], "enterprise 段形状非法(应为对象)"
    unknown = sorted(set(enterprise_section) - set(RULE_KEYS) - set(ENTERPRISE_META_KEYS))
    if unknown:
        return [], f"enterprise 段含未知规则键(不静默忽略): {unknown}"
    enterprise_rules, reason = parse_tier_rules(enterprise_section, PolicyTier.ENTERPRISE)
    if reason:
        return [], reason
    return repo_rules + enterprise_rules, None


def _pick_winner(hits: Sequence[PolicyHit]) -> PolicyHit | None:
    """胜出规则:严者胜 → 同严企业档优先 → 种类更具体者 → 模式更长者。"""
    if not hits:
        return None
    return min(
        hits,
        key=lambda hit: (
            -hit.decision.severity,
            _TIER_RANK[hit.tier],
            -_KIND_RANK[hit.kind],
            -len(hit.pattern),
        ),
    )


def adjudicate_command(command: str, document: Mapping[str, Any]) -> MergeVerdict:
    """命令裁决主入口:读企业快照(若已下发) → 合并两档 → 出裁决。

    `document` = 命令策略权威源(`mcp_server._load_command_policy()` 读的那份 dict)。
    """
    snapshot, reason = load_enterprise_snapshot()
    if reason is not None:
        return _undetermined(reason)
    rules, reason = _collect_rules(document, snapshot)
    if reason is not None:
        return _undetermined(reason)
    hits, reason = match_tier_rules(command, rules)
    if reason is not None:
        return _undetermined(reason)
    winner = _pick_winner(hits)
    if winner is None:
        return MergeVerdict(outcome=PolicyOutcome.NONE, reason="两档均未命中")
    tiers = tuple(
        tier for tier in (PolicyTier.ENTERPRISE, PolicyTier.REPO) if any(h.tier is tier for h in hits)
    )
    outcome = {
        Decision.DENY: PolicyOutcome.DENY,
        Decision.PROMPT: PolicyOutcome.ASK,
        Decision.ALLOW: PolicyOutcome.ALLOW,
    }[winner.decision]
    verdict = MergeVerdict(
        outcome=outcome, reason=winner.label, hits=tuple(hits), winner=winner, tiers=tiers
    )
    # reason 落成逐条可解释的出声文本(同一份读数既进回执也进日志)。
    return replace(verdict, reason=verdict.to_explanation())


def _undetermined(reason: str) -> MergeVerdict:
    """「未判定」出口:独立状态,不折成 deny/allow(§0.3)。"""
    return MergeVerdict(outcome=PolicyOutcome.UNDETERMINED, reason=reason)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
