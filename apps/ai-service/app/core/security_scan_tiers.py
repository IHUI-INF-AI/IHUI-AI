# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""分层安全扫描档位(L1/L2/L3)与事件绑定 —— round 8「能力复现」实现席 C。

立因
----
对照 Qoder CodeSec 插件把安全扫描拆成三档、并由 hook 事件绑定档位;本仓
``apps/cli/src/hooks/index.ts`` 只有单门(编辑类 L1 pattern warning + stop 聚合),
缺一个「事件 → 扫描档」的纯路由判据。本模块用本仓 Python 栈**写自己的代码**
复现「分层 + 事件绑定」的行为与设计,并用测试钉住(§0.12 四步之 ③④)。

对照取证(本机只读,只观察行为与设计;不粘对方专有源码原文/反编译伪代码/凭据)
--------------------------------------------------------------------------
- 观察 ``.qoder-cn/.../security-scan/.qoder-plugin/qoder-hooks.json``:
  ``PostToolUse`` + ``matcher: Edit|Write|MultiEdit|NotebookEdit`` → ``--layer=l1``;
  ``PostToolUse`` + ``matcher: Bash`` + ``if: "Bash(git push *)"`` → ``--layer=l3``;
  ``Stop`` 为空,``SessionStart`` 仅 ensure-deps。即档位由事件 matcher/if 绑定。
- 观察 ``.qoder-cn/security-resources/security-scan/config.yaml.example``:
  L1 = 编辑后实时只读 pattern 告警;L2 = 手动单遍 diff 审查;L3 = 手动 commit-range
  审计(强制);且 ``patterns.enabled=false`` / ``custom.enabled=false`` 会「跳过整层 /
  不读规则文件」—— 取不到规则集/关掉开关 = 静默不扫。
- 观察 ``.../security-patterns.yaml.example``:规则集是带 ruleName/severity 的数组,
  且 ``.example`` 需复制到生效路径才生效。
- 推断:对照 hook 仅 ``command`` 拉起二进制,产物是注入 prompt 的提醒文本,
  未见结构化 ``(tier, rule, evidence)`` 审计三元组。
- 未判定(§0.3):REA 6.4.0 MCP 与 craft-anything deep 在本实现席工具面不可直连;
  qodersec 原生二进制内部实现未反编译(本席不碰 Ghidra),其细节列未知,不猜。
  另:派单口径「对照三档默认全 false」与本机 first-run seed 里 L1 段 ``enabled:true``
  的字面观察不完全一致(``.example`` 需复制才生效);本模块以派单口径为设计基线,
  这一格差异如实标注,**不静默当成一致**。

判据
----
纯函数 ``decide_scan_tier(event, subject, config) -> "l1"/"l2"/"l3"/"unjudged"``:
  - 档位由「事件绑定」决定,不由「工具是否写文件」决定(复现对照 matcher/if)。
    ``l1 低风险只读`` 指**扫描动作**只读(只匹配告警、不改文件、不阻断),不是
    「被扫事件只读」;编辑类事件触发的正是这种只读实时扫描,故 Edit/Write → l1。
  - ``l1``:编辑/只读类事件 → 默认开(且不可静默关)、不需规则集;
  - ``l2``:执行/写类事件 → 必须取到 ``l2`` 规则集才判,取不到 ⇒ unjudged;
  - ``l3``:subject 命中 push/删除/凭据 ⇒ 强制升档,无视绑定、开关、规则集;
  - 未知工具 / 配置缺键 / 规则集取不到 / 输入类型错 / 执行类空 subject ⇒ unjudged
    并**点名原因**(落在 ``Finding.evidence``),绝不静默放行(§0.3)。
  - 判据唯一实现住 ``build_finding(...)``;``decide_scan_tier`` 只是它的 ``.tier``
    投影(§0.6 单一真相源,测试不复制判据)。

刻意不做什么
------------
- 不粘对方源码/配置原文/反编译伪代码/凭据(§0.12 红线);只复现行为与设计。
- 不复用 ``app/core/command_policy_tiers.py`` 的「命令 → 规则命中」判据:那是
  **来源档形状层(repo/enterprise)**,与「事件 → 扫描档」是两把尺子,互相 import
  即成第二份真相源(§0.6)。两模块互不依赖。
- 不改 ``apps/cli/src/hooks/index.ts`` 等任何现有文件:本模块是独立纯判据层,
  接线由主会话单点收口。
- 不做 IO / 不读配置文件 / 不拉起子进程:规则集与开关由调用方以 ``config`` 传入。
- 失效方向恒为「多要一次定向说明」:缺输入一律 unjudged,绝不折成某档放行(§0.3/§0.10)。
- 不给 l1 设「关闭」开关:默认开即不可静默关,关掉唯一默认防线 = 多放一次跳门(§0.10)。

一轴超越(至少一轴,此处三轴)
----------------------------
1) 对照三档默认全 false(靠开关/手动 skill 才跑);我方 **l1 默认开且不可静默关**。
2) 对照「取不到规则集 / 关开关」是静默跳过整层;我方判 **unjudged 并点名原因**。
3) 对照 hook 无结构化审计产物;我方 ``build_finding`` 产出 ``(tier, rule, evidence)``
   **三元组可追溯**。
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any, NamedTuple

# ---- 结果值域(封闭集合) ---------------------------------------------------
TIER_L1 = "l1"
TIER_L2 = "l2"
TIER_L3 = "l3"
UNJUDGED = "unjudged"
#: decide_scan_tier 允许返回的全部取值。
ALL_OUTCOMES = frozenset({TIER_L1, TIER_L2, TIER_L3, UNJUDGED})

# ---- 事件绑定(单一真相源) -------------------------------------------------
# 立因:复现对照 qoder-hooks.json 的 ``matcher: Edit|Write|MultiEdit|NotebookEdit → l1``,
# 并补齐本仓「低风险只读」类(Read/Grep/Glob)进同一只读扫描档;执行类 Bash 进 l2 基础档
# (其高危形态由 subject 强制升 l3)。刻意不按「工具写不写文件」分档 —— 那样会把对照的
# 事件绑定读丢:对照恰恰把 Edit/Write(写文件)绑在 l1 实时只读告警上。
EVENT_BASE_TIER: dict[str, str] = {
    "Edit": TIER_L1,
    "Write": TIER_L1,
    "MultiEdit": TIER_L1,
    "NotebookEdit": TIER_L1,
    "Read": TIER_L1,
    "Grep": TIER_L1,
    "Glob": TIER_L1,
    "Bash": TIER_L2,
}

# ---- 高危动作规则(单一真相源;按序命中即返回规则名) ------------------------
# 立因:对照用 ``if: "Bash(git push *)"`` 把 push 绑到 l3;我方把「高危」抽象成
# push / 删除 / 凭据三类,并让它在**任意已知事件**上强制升 l3(比对照只认 Bash 更保守)。
# 刻意不用宽泛词(如单独 ``token`` / ``key``)以免把普通命令误升档。
HIGH_RISK_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "high_risk.push",
        re.compile(r"\bgit\s+push\b", re.IGNORECASE),
    ),
    (
        "high_risk.delete",
        re.compile(
            r"\b(?:rm\s+-|rmdir\b|Remove-Item\b|del\s+/|unlink\b|"
            r"git\s+(?:branch\s+-D|clean\s+-f))",
            re.IGNORECASE,
        ),
    ),
    (
        "high_risk.credential",
        re.compile(
            r"(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|"
            r"\b(?:api[_-]?key|secret[_-]?key|access[_-]?token|password|passwd|credentials?)\b|"
            r"\.env(?:\b|\.))",
            re.IGNORECASE,
        ),
    ),
)

#: config 必需键(缺任一 ⇒ 取不到完整判据输入 ⇒ unjudged)。
#: ``tiers`` = 档位开关声明面(我方只验存在/形状、不读布尔值去关档,见「刻意不做什么」);
#: ``rulesets`` = 各档规则集(l2 必须取到 l2 规则集)。
REQUIRED_CONFIG_KEYS = frozenset({"tiers", "rulesets"})


class Finding(NamedTuple):
    """结构化 verdict:一次判定的 ``tier + rule + evidence`` 三元组,供调用方审计。

    - ``tier``:l1/l2/l3/unjudged;
    - ``rule``:命中的判据规则名(单一真相源里的键),如 ``event.l1_default_on``;
    - ``evidence``:可追溯证据;**unjudged 时承载点名的未判定原因**(§0.3)。
    """

    tier: str
    rule: str
    evidence: str


def _config_gate(config: Mapping[str, Any]) -> str | None:
    """配置门:所有档共用的前置完整性校验;返回未判定原因,或 None 表示通过。

    立因:§0.3 取不到输入 ⇒ unjudged 点名原因,绝不静默放行;§0.10 失效方向必须
    是「多要一次定向说明」而非「多放一次跳门」。
    判据:缺必需键 / 键在但形状坏 ⇒ 返回原因。
    刻意不做什么:形状校验只对**存在的键**做(``key in config`` 守卫),使缺键分支
    成为一条独立可测、可单独变异的判据 —— 把下面那支的 return 注释掉(放行)后,
    缺键 config 应干净地落到 l1 而令测试转红,不会因 KeyError/形状校验假红。
    """
    missing = REQUIRED_CONFIG_KEYS - set(config.keys())
    # 【反向变异验证锚点】把下一支的 return 注释/放行即应令「配置缺键 ⇒ unjudged」转红。
    if missing:
        return f"config 缺必需键 {sorted(missing)} ⇒ 取不到完整判据输入(§0.3 未判定, 不放行)"
    for key in ("tiers", "rulesets"):
        if key in config and not isinstance(config[key], Mapping):
            return f"config.{key} 形状非法(应为映射) ⇒ 未判定(§0.3)"
    return None


def _high_risk_rule(subject: str) -> str | None:
    """subject 是否命中高危动作;返回命中的规则名,未命中返回 None。"""
    for rule_name, pattern in HIGH_RISK_RULES:
        if pattern.search(subject):
            return rule_name
    return None


def build_finding(event: Any, subject: Any, config: Any) -> Finding:
    """判据唯一实现:把 ``(event, subject, config)`` 判成结构化 verdict。

    立因:把「分层 + 事件绑定」复现成纯函数,并用 ``decide_scan_tier`` / 测试钉住(§0.12)。
    判据(顺序即失效方向,任一不满足即 unjudged 并点名原因):
      ① 输入类型面(event/subject/config) → 类型错 unjudged;
      ② 事件绑定面(空/未知 event) → unjudged,不猜档;
      ③ 配置门(缺键/形状) → unjudged,不静默放行;
      ④ 高危覆盖(subject 命中 push/删除/凭据) → l3 强制;
      ⑤ l1 基础档 → 默认开、只读、不阻断;
      ⑥ l2 基础档 → 规则集取不到 unjudged,取到才 l2;执行类空 subject 在 ④ 之前
         因「高危这一维没量到」判 unjudged。
    刻意不做什么:不在本函数里读磁盘/发进程/重试;不复制 ``command_policy_tiers`` 的
    命令匹配;不把 unjudged 折成任何档放行。判据只此一份,``decide_scan_tier`` 是投影。
    """
    if not isinstance(event, str):
        return Finding(
            UNJUDGED,
            "input.type",
            f"event 类型错(应为 str, 实得 {type(event).__name__}) ⇒ 取不到事件名(§0.3)",
        )
    if not isinstance(subject, str):
        return Finding(
            UNJUDGED,
            "input.type",
            f"subject 类型错(应为 str, 实得 {type(subject).__name__}) ⇒ 取不到操作对象(§0.3)",
        )
    if not isinstance(config, Mapping):
        return Finding(
            UNJUDGED,
            "config.type",
            f"config 类型错(应为映射, 实得 {type(config).__name__}) ⇒ 取不到配置(§0.3)",
        )

    name = event.strip()
    if not name:
        return Finding(UNJUDGED, "event.empty", "event 为空串 ⇒ 取不到事件名(§0.3)")
    base = EVENT_BASE_TIER.get(name)
    if base is None:
        return Finding(
            UNJUDGED,
            "event.unknown",
            f"未知工具 {name!r}: 无事件绑定, 既不猜档也不放行(§0.3)",
        )

    # 配置门(所有档共用前置):缺键/形状坏 ⇒ 未判定, 绝不静默放行。
    gate_reason = _config_gate(config)
    if gate_reason is not None:
        return Finding(UNJUDGED, "config.gate", gate_reason)

    # 高危覆盖(l3 强制):subject 命中 push/删除/凭据 ⇒ 无视基础档强制升 l3。
    text = subject.strip()
    if not text:
        # 执行类(l2 基础)的高危判定取不到 subject ⇒ 未判定;l1 只读扫描不依赖 subject。
        if base != TIER_L1:
            return Finding(
                UNJUDGED,
                "subject.empty_for_highrisk",
                f"事件 {name!r} 属执行类, subject 为空 ⇒ 高危这一维没量到, 未判定不放行(§0.3/§0.10)",
            )
    else:
        high = _high_risk_rule(text)
        if high is not None:
            return Finding(
                TIER_L3,
                high,
                f"subject={text!r} 命中高危动作 ⇒ L3 强制扫描(不依赖规则集/开关)",
            )

    if base == TIER_L1:
        return Finding(
            TIER_L1,
            "event.l1_default_on",
            f"事件 {name!r} → L1 只读实时扫描; 默认开且不可静默关(§0.10), 不阻断",
        )

    # base == TIER_L2:写/执行类深审, 必须取到规则集。
    # 刻意用 .get 而非索引:配置门已保证键在正常路径存在,用 .get 令「缺键分支被放行」的
    # 变异形态也不会抛 KeyError,从而干净地把缺键 config 判成 l1(测试得以确定性转红)。
    rulesets = config.get("rulesets")
    rules = rulesets.get(TIER_L2) if isinstance(rulesets, Mapping) else None
    if not isinstance(rules, (list, tuple)) or not rules:
        return Finding(
            UNJUDGED,
            "ruleset.l2_unavailable",
            "l2 规则集取不到(缺/空/形状坏) ⇒ 未判定不放行(§0.3/§0.10); "
            "对照按开关静默跳过整层",
        )
    return Finding(
        TIER_L2,
        "event.l2_ruleset",
        f"事件 {name!r} 命中 l2 规则集 {len(rules)} 条 ⇒ L2 深审(需规则集)",
    )


def decide_scan_tier(event: Any, subject: Any, config: Any) -> str:
    """判定扫描档位;返回 ``l1`` / ``l2`` / ``l3`` / ``unjudged``。

    立因:给 hooks/编排层一个纯函数入口,把对照的「事件→layer」复现成可测判据(§0.12)。
    判据:全部委托 ``build_finding``(单一真相源),本函数只投影 ``.tier``。
    刻意不做什么:不重写任何分档规则、不做兜底放行;取不到输入即由下游点名 unjudged。
    """
    return build_finding(event, subject, config).tier


__all__ = [
    "ALL_OUTCOMES",
    "EVENT_BASE_TIER",
    "Finding",
    "HIGH_RISK_RULES",
    "REQUIRED_CONFIG_KEYS",
    "TIER_L1",
    "TIER_L2",
    "TIER_L3",
    "UNJUDGED",
    "build_finding",
    "decide_scan_tier",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
