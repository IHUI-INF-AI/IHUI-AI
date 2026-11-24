# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""命令策略**档位形状层**:把策略文档拆成「仓库档 / 企业档」两档规则并逐条匹配。

本模块只管两件事:**形状**(JSON 文档 → 带来源档位的规则列表)与**匹配**(命令 → 命中事实)。
**裁决不在这里**(哪条规则胜出、企业档优先怎么排)—— 那是
`app/core/command_policy_merge.py` 的唯一实现(§0.6 单一真相源:合并与裁决逻辑只有一份)。

形状(权威源 `app/data/command_policy.json`):

    { red_list, black_list, immutable_paths, allow, ask }                 ← 仓库档(顶层键)
    { "enterprise": { red_list, black_list, immutable_paths, allow, ask } } ← 企业档

既有 `dangerous_patterns` / `allowed_prefixes` / `sensitive_file_markers` 三段语义一字未动。

企业档**可由外部下发**(env `IHUI_ENTERPRISE_COMMAND_POLICY` 指向一份快照 JSON),
`load_enterprise_snapshot()` 是那份快照的唯一读入口。
"""

from __future__ import annotations

import json
import os
import re
import shlex
from collections.abc import Mapping, Sequence
from enum import StrEnum
from pathlib import Path
from typing import Any, NamedTuple

from ..services.exec_policy import Decision

__all__ = [
    "ENTERPRISE_SNAPSHOT_ENV",
    "KIND_DECISION",
    "PolicyHit",
    "PolicyTier",
    "RuleKind",
    "load_enterprise_snapshot",
    "match_tier_rules",
    "parse_tier_rules",
]


class PolicyTier(StrEnum):
    """策略档位来源(仓库档 = 本仓自带;企业档 = 下发给领域侧的那一份)。"""

    REPO = "repo"
    ENTERPRISE = "enterprise"


class RuleKind(StrEnum):
    """档内规则种类(与权威源 JSON 的键同名)。"""

    BLACK_LIST = "black_list"
    IMMUTABLE_PATHS = "immutable_paths"
    RED_LIST = "red_list"
    ASK = "ask"
    ALLOW = "allow"


#: 每种规则对应的裁决档(严重度取 Decision.severity:deny=2 > prompt=1 > allow=0)。
KIND_DECISION: dict[RuleKind, Decision] = {
    RuleKind.BLACK_LIST: Decision.DENY,
    RuleKind.IMMUTABLE_PATHS: Decision.DENY,
    RuleKind.RED_LIST: Decision.PROMPT,
    RuleKind.ASK: Decision.PROMPT,
    RuleKind.ALLOW: Decision.ALLOW,
}

#: 仓库档顶层与企业档子对象共用的规则键。
RULE_KEYS: tuple[str, ...] = ("black_list", "red_list", "immutable_paths", "allow", "ask")

#: 企业档子对象允许带的元数据键(其余键判「未判定」,不静默忽略未知规则)。
ENTERPRISE_META_KEYS: tuple[str, ...] = ("source",)

#: 企业策略快照落地路径的环境变量(可下发到领域侧的那一份)。
ENTERPRISE_SNAPSHOT_ENV = "IHUI_ENTERPRISE_COMMAND_POLICY"


def load_enterprise_snapshot() -> tuple[Mapping[str, Any] | None, str | None]:
    """读企业策略快照(下发到领域侧的那一份)。

    返回 `(快照, 未判定原因)`:未配置 ⇒ `(None, None)`;配置了却读不到 / 形状不对 ⇒
    `(None, 原因)` —— **不静默忽略**:把读不到的企业策略当它不存在 = 静默放宽(违 §0.10)。
    """
    raw = os.environ.get(ENTERPRISE_SNAPSHOT_ENV, "").strip()
    if not raw:
        return None, None
    path = Path(raw)
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return None, f"企业策略快照不可读({path}): {exc}"
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        return None, f"企业策略快照不是合法 JSON({path}): {exc}"
    if not isinstance(data, Mapping):
        return None, f"企业策略快照根不是对象({path})"
    return data, None


class PolicyHit(NamedTuple):
    """一次命中的事实:哪条规则、哪个档位、命中了什么、对应哪个裁决档。"""

    tier: PolicyTier
    kind: RuleKind
    pattern: str
    matched: str
    decision: Decision

    @property
    def label(self) -> str:
        """出声用的短标签(档位/种类)。"""
        return f"{self.tier.value}/{self.kind.value}"


def parse_tier_rules(
    section: Mapping[str, Any], tier: PolicyTier
) -> tuple[list[tuple[PolicyTier, RuleKind, str]], str | None]:
    """取一段档位里的全部规则(带来源档位);任一键形状不对 ⇒ `([], 未判定原因)`。

    「缺键」= 该档没有这条规则(合法空档);「键在但形状不对」= **未判定**,不折成
    「该档没这条规则」—— 那会把一次策略写错读成一次策略放行(§0.3)。
    """
    rules: list[tuple[PolicyTier, RuleKind, str]] = []
    for key in RULE_KEYS:
        raw = section.get(key)
        if raw is None:
            continue
        if not isinstance(raw, list) or not all(isinstance(item, str) for item in raw):
            return [], f"{tier.value} 档 {key} 形状非法(应为字符串数组)"
        rules.extend((tier, RuleKind(key), item) for item in raw if item.strip())
    return rules, None


def _normalize_path(token: str) -> str:
    """归一路径字面量(去引号 + 分隔符统一为 `/`)。"""
    return token.strip("\"'").replace("\\", "/")


def match_immutable_path(command: str, literal: str) -> str:
    """命令是否引用了不可变路径;返回命中的 token(未命中返回空串)。

    判据 = **路径组件边界**:命中片段必须以组件边界起止(前为路径分隔符或串首,后为路径
    分隔符或串尾)。故 `cat .git/config` 命中,而提交信息里的 `fix .git/config`(同一 token
    内含空格)不命中。切词用 `posix=False`,反斜杠不被吃掉(Windows 路径仍成立)。
    """
    norm_literal = _normalize_path(literal).rstrip("/")
    if not norm_literal:
        return ""
    try:
        tokens = shlex.split(command, posix=False)
    except ValueError:
        tokens = command.split()
    for token in tokens:
        norm_token = _normalize_path(token)
        index = norm_token.find(norm_literal)
        while index != -1:
            end = index + len(norm_literal)
            before_ok = index == 0 or norm_token[index - 1] == "/"
            after_ok = end == len(norm_token) or norm_token[end] == "/"
            if before_ok and after_ok:
                return token
            index = norm_token.find(norm_literal, index + 1)
    return ""


def match_tier_rules(
    command: str, rules: Sequence[tuple[PolicyTier, RuleKind, str]]
) -> tuple[list[PolicyHit], str | None]:
    """逐条匹配;正则非法 ⇒ `([], 未判定原因)`(不静默跳过这条规则)。"""
    hits: list[PolicyHit] = []
    for tier, kind, pattern in rules:
        if kind is RuleKind.IMMUTABLE_PATHS:
            matched = match_immutable_path(command, pattern)
        else:
            try:
                regex = re.compile(pattern)
            except re.error as exc:
                return [], f"{tier.value} 档 {kind.value} 规则 {pattern!r} 正则非法: {exc}"
            found = regex.search(command)
            matched = found.group(0) if found else ""
        if matched:
            hits.append(
                PolicyHit(
                    tier=tier,
                    kind=kind,
                    pattern=pattern,
                    matched=matched,
                    decision=KIND_DECISION[kind],
                )
            )
    return hits, None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
