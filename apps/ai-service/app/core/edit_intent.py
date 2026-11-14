# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""跨文件编辑意图一致性 + commandExecution 分级 —— round 9「能力复现」实现席 B。

立因
----
对照 Qoder 的「跨文件编辑意图」与 DSH 的「命令执行分级(commandExecution)」两项能力:
本仓 ``跨文件编辑`` 零命中、``commandExecution`` 仅 3 处引用且无判据层。本模块用本仓
Python 栈**写自己的代码**一次复现两项行为与设计,并用测试钉住(§0.12 四步之 ③④)。
两个纯函数同住本文件:``evaluate_edit_intent``(意图一致性) 与
``classify_command_execution``(命令分级),后者被前者**绑定**进 findings。

对照取证(概念级;本机只读,不粘对方专有源码/凭据)
--------------------------------------------------
- 观察/已知(机主派单口径):对照「跨文件编辑意图」只在概念层要求"一处改动牵动多文件时
  意图自洽",未见"每个待写文件必须带当轮读证据指纹"的可审计判据;对照「commandExecution」
  把命令粗略分成可执行/需确认,未见分级规则集 + 绕过归一化 + 结构化审计三元组。
- 推断:对照更接近"信任调用方声明",缺"取不到输入即未判定"的失效方向。
- 未判定(§0.3):REA 6.4.0 MCP / 对照程序二进制在本实现席工具面不可直连,其内部实现
  细节列未知,不猜;本席不复刻其源码,只复现派单口径描述的行为与设计。

判据(evaluate_edit_intent)
--------------------------
纯函数 ``evaluate_edit_intent(intent, policy) -> dict``,verdict ∈
``consistent / diverged / unjudged / denied``,并产出结构化 ``findings``:
  - 每个待写文件必须有**当轮**读证据指纹:``read_evidence_sha256`` 为空 ⇒ unjudged
    而非放行;与 ``policy.expected_read_evidence[path]`` 不符 ⇒ diverged;基准缺该
    path ⇒ unjudged(§0.3 取不到=没判)。
  - 同一路径被两个不同 intent 写(``policy.write_claims[path]`` 属别的 id) ⇒ denied。
  - ``..`` / 绝对路径 / NUL / Windows 盘符 / UNC 等路径注入 ⇒ denied。
  - 缺字段 / 类型错 / 空 intent ⇒ unjudged 并点名原因。
  - 策略缺 ``write_claims`` / ``expected_read_evidence`` / 规则集 ⇒ unjudged(§0.3/§0.10)。
  - **解析与授权合一**:形状未解析成功 ⇒ 明确 unjudged 且在 findings 点名"授权判据
    未执行",绝不返回「解析成功但授权没跑」的半态;形状合法则一次性跑完全部授权判据。
  - **两判据绑定**:恒调用 ``classify_command_execution`` 并把结果纳入 findings;
    命令 destructive ⇒ 整体 denied(高危未确认不静默放行),命令 unjudged ⇒ 不得 consistent。

判据(classify_command_execution)
--------------------------------
纯函数 ``classify_command_execution(command, policy) -> dict``,tier ∈
``read / write / destructive / unjudged``:
  - 规则集由 ``policy.rulesets`` 传入(read/write/destructive 三档 规则名→正则);
    缺档 / 空 / 形状坏 / 正则编译失败 ⇒ unjudged(§0.3),**不回落到内置默认**。
  - 命令先归一化:大小写 lower、剥离引号(``g"it"``→``git``)、管道/连接符/命令替换
    切分隔(``echo ok | rm -rf /`` 里的高危词仍被全段扫描命中)。
  - 分级按 destructive > write > read 从严;无规则命中 ⇒ unjudged(形状不认,§0.3)。
  - ``destructive`` 必带 ``requires_confirmation=True`` 与 ``evidence``。

刻意不做什么
------------
- 不粘对方源码/配置原文/反编译伪代码/凭据(§0.12 红线);只复现行为与设计。
- 不复用 ``app/core/command_policy_tiers.py`` 等既有命令判据:那些是别的尺子,
  互相 import 即成第二份真相源(§0.6);本模块判据只此一份,测试不复制。
- 不改任何现有文件、不做 IO / 不发子进程 / 不读配置:策略与意图全由调用方传入。
- 不在缺策略规则集时回落到 ``default_rulesets()`` 兜底:那是「多放一次跳门」(§0.10);
  ``default_rulesets()`` 只是给调用方/测试构造策略的**原料**,判据绝不自动取用。
- 不做完整 shell 语法解析 / 变量展开求值 / 反引号执行:归一化只为「让高危词无处可藏」,
  认不出的形状一律 unjudged 不静默放行(§0.3)。
- 失效方向恒为「多要一次定向说明」:缺输入/取不到 ⇒ unjudged,绝不折成某档放行。

一轴超越(对照只有概念)
----------------------
把「读证据溯源(当轮指纹) + 命令分级(规则集/绕过归一化/强制确认) + 解析鉴权合一
+ 半态拒绝」钉成**一把尺子**,并输出可审计的 findings/结构化 verdict;对照既无当轮
读证据校验,也无「取不到输入即未判定」的失效方向,更无两判据绑定防「意图一致但命令高危」
被静默放行。
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

# ---- 结果值域(封闭集合, 判据返回恒落其内) --------------------------------
TIER_READ = "read"
TIER_WRITE = "write"
TIER_DESTRUCTIVE = "destructive"
TIER_UNJUDGED = "unjudged"
ALL_COMMAND_TIERS = frozenset({TIER_READ, TIER_WRITE, TIER_DESTRUCTIVE, TIER_UNJUDGED})

CONSISTENT = "consistent"
DIVERGED = "diverged"
DENIED = "denied"
ALL_EDIT_OUTCOMES = frozenset({CONSISTENT, DIVERGED, TIER_UNJUDGED, DENIED})

REQUIRED_RULESET_TIERS = frozenset({TIER_READ, TIER_WRITE, TIER_DESTRUCTIVE})
REQUIRED_EDIT_POLICY_KEYS = frozenset({"write_claims", "expected_read_evidence"})

# 归一化用常量(单一真相源):引号字符、shell 分隔/命令替换符、空白归一。
_QUOTE_CHARS = "\"'`"
_SPLIT_RE = re.compile(r"[|;&\n\r\t]+|\$\(|\$\{|\$|[(){}<>]")
_WS_RE = re.compile(r"\s+")


def default_rulesets() -> dict[str, dict[str, str]]:
    """三档标准规则集(档 → 规则名→正则)。每次返回全新 dict,纯函数,不与调用方共享可变态。

    立因:把「命令分级」的具体尺子公开成可复用原料,测试据此构造策略(§0.6 不复制正则)。
    判据:三档齐备、每档非空、值是针对**归一化后小写文本**的正则字符串。
    刻意不做什么:判据层绝不自动取用本函数(缺策略即 unjudged,见模块「刻意不做什么」)。
    """
    return {
        TIER_READ: {
            "cmd.git_readonly": r"\bgit\s+(?:status|log|diff|show|branch|remote|rev-parse)\b",
            "cmd.view": r"\b(?:ls|cat|head|tail|grep|find|pwd|echo|wc|stat)\b",
        },
        TIER_WRITE: {
            "cmd.git_write": r"\bgit\s+(?:add|commit|stash|checkout|merge|rebase|tag|restore)\b",
            "cmd.fs_write": r"\b(?:cp|mv|mkdir|touch|tee|printf|install)\b",
        },
        TIER_DESTRUCTIVE: {
            "cmd.git_push": r"\bgit\s+push\b",
            "cmd.rm": r"\brm\b",
            "cmd.del": r"\bdel\b",
            "cmd.force": r"--force",
            "cmd.credential": (
                r"(?:api[_-]?key|secret[_-]?key|access[_-]?token|password|passwd|"
                r"credentials?|\.env\b|-----begin)"
            ),
        },
    }


def _ruleset_gate(
    policy: Any,
) -> tuple[str | None, dict[str, list[tuple[str, re.Pattern[str]]]] | None]:
    """规则集门:返回 ``(未判定原因, 已编译三档规则)``;原因非 None 即未判定。

    立因:§0.3 取不到完整判据输入 ⇒ unjudged 点名原因;§0.10 失效方向=多要定向说明。
    判据:policy 非映射 / 缺 rulesets / 非映射 / 三档缺任一 / 某档空或形状坏 /
         正则编译失败 ⇒ 返回原因;否则编译并返回可用规则(一次编译,不重复取值)。
    刻意不做什么:形状校验只对存在的键做,使「缺规则集」成为一条独立可测的判据;
         用 ``.get`` 而非索引,令策略缺键时返回原因而非抛 KeyError。
    """
    if not isinstance(policy, Mapping):
        return "policy 类型错(应为映射) ⇒ 取不到规则集(§0.3 未判定, 不放行)", None
    rulesets = policy.get("rulesets")
    if rulesets is None:
        return "policy 缺 'rulesets' ⇒ 取不到命令分级规则集(§0.3 未判定, 不放行)", None
    if not isinstance(rulesets, Mapping):
        return "policy.rulesets 形状非法(应为映射) ⇒ 未判定(§0.3)", None
    missing = REQUIRED_RULESET_TIERS - set(rulesets)
    if missing:
        return f"规则集缺档 {sorted(missing)} ⇒ 取不到完整分级判据(§0.3)", None
    compiled: dict[str, list[tuple[str, re.Pattern[str]]]] = {}
    for tier in REQUIRED_RULESET_TIERS:
        rules = rulesets.get(tier)
        if not isinstance(rules, Mapping) or not rules:
            return f"规则集.{tier} 缺失/为空/形状坏 ⇒ 未判定(§0.3)", None
        bucket: list[tuple[str, re.Pattern[str]]] = []
        for name, pattern in rules.items():
            if not isinstance(name, str) or not isinstance(pattern, str):
                return f"规则集.{tier} 条目形状坏(键/值须为串) ⇒ 未判定(§0.3)", None
            try:
                bucket.append((name, re.compile(pattern)))
            except re.error as exc:
                return f"规则集.{tier} 正则编译失败({exc}) ⇒ 未判定(§0.3)", None
        compiled[tier] = bucket
    return None, compiled


def _flatten_command(command: str) -> str:
    """归一化命令为可全段扫描的小写扁平文本。

    立因:对照只对命令做朴素前缀匹配;我方要让高危词在管道/引号/大小写变形下无处可藏。
    判据:① lower 统一大小写;② 删 ' " ` 三种引号字符(引号绕过 ``g"it"``→``git``、
         ``'rm'``→``rm``);③ 把 | ; & 换行 $() ${} 括号等切成分隔空格(管道拼接
         ``echo ok|rm -rf /`` 里的 rm 仍被 ``re.search`` 命中,匹配不锚定开头);④ 空白归一。
    刻意不做什么:不做完整 shell 语法解析/变量展开求值/反引号执行/反斜杠续行求值;
         认不出的形状由「无规则命中 ⇒ unjudged」兜底,绝不静默放行(§0.3)。
    """
    text = command.lower()
    for quote in _QUOTE_CHARS:
        text = text.replace(quote, "")
    text = _SPLIT_RE.sub(" ", text)
    return _WS_RE.sub(" ", text).strip()


def _command_verdict(
    tier: str, rule: str, evidence: str, requires_confirmation: bool
) -> dict[str, Any]:
    """结构化命令 verdict:所有档恒带四字段(便于审计与负例断言)。"""
    return {
        "tier": tier,
        "rule": rule,
        "evidence": evidence,
        "requires_confirmation": requires_confirmation,
    }


def classify_command_execution(command: Any, policy: Any) -> dict[str, Any]:
    """命令执行分级:``read``/``write``/``destructive``/``unjudged`` + 结构化 verdict。

    立因:把对照 commandExecution 的「可执行/需确认」复现成三档 + 未判定,并补齐
          规则集/绕过归一化/强制确认/可审计证据(§0.12)。
    判据(顺序即失效方向):① command 非 str / 空 ⇒ unjudged;② 规则集门 ⇒ unjudged;
          ③ 归一化;④ destructive > write > read 从严命中;⑤ 无命中 ⇒ unjudged。
    刻意不做什么:不在本函数内解析执行 shell、不回落默认规则集、不把 unjudged 折成
          任一档放行;destructive 必带 requires_confirmation=True 与 evidence。
    """
    if not isinstance(command, str):
        return _command_verdict(
            TIER_UNJUDGED,
            "input.type",
            f"command 类型错(应为 str, 实得 {type(command).__name__}) ⇒ 未判定(§0.3)",
            False,
        )
    if not command.strip():
        return _command_verdict(
            TIER_UNJUDGED,
            "command.empty",
            "command 为空 ⇒ 取不到命令(§0.3 未判定, 不放行)",
            False,
        )
    gate_reason, compiled = _ruleset_gate(policy)
    if gate_reason is not None:
        return _command_verdict(TIER_UNJUDGED, "ruleset.gate", gate_reason, False)
    flat = _flatten_command(command)
    # 分档从严:先 destructive 再 write 再 read;命中规则名进 verdict 供追溯。
    for tier in (TIER_DESTRUCTIVE, TIER_WRITE, TIER_READ):
        for name, pattern in compiled[tier]:  # type: ignore[index]
            if pattern.search(flat):
                evidence = f"归一化命令={flat!r} 命中 {tier} 规则 {name!r}"
                if tier == TIER_DESTRUCTIVE:
                    return _command_verdict(
                        TIER_DESTRUCTIVE,
                        name,
                        evidence + " ⇒ destructive(需人工确认, requires_confirmation=True)",
                        True,
                    )
                return _command_verdict(tier, name, evidence, False)
    return _command_verdict(
        TIER_UNJUDGED,
        "command.no_rule_matched",
        f"归一化命令={flat!r} 未命中任何分级规则 ⇒ 形状不认, 未判定不放行(§0.3)",
        False,
    )


def _path_injection_reason(path: str) -> str | None:
    """返回路径注入原因码,合法路径返回 None。

    判据:NUL / Windows 盘符 / UNC / 绝对路径 / ``..`` 独立段。
    刻意不做什么:不做真实文件系统解析(纯判据层),认不出的形态宁可留给「无基准」判。
    """
    if "\x00" in path:
        return "path.nul"
    normalized = path.replace("\\", "/")
    if re.match(r"^[a-zA-Z]:", path):
        return "path.windows_drive"
    if normalized.startswith("//"):
        return "path.unc"
    if normalized.startswith("/"):
        return "path.absolute"
    if ".." in normalized.split("/"):
        return "path.traversal"
    return None


def _finding(check: str, status: str, reason: str, **extra: Any) -> dict[str, Any]:
    """单条结构化 finding;status ∈ ok/unjudged/denied/diverged/skipped。"""
    entry: dict[str, Any] = {"check": check, "status": status, "reason": reason}
    if extra:
        entry.update(extra)
    return entry


def _intent_shape_reason(intent: Any, policy: Any) -> str | None:
    """解析层:返回形状未判定原因;None 表示形状合法(可进入授权层)。

    判据:intent/policy 必须映射;id/files/command 齐备且类型对;files 非空;
         每文件 path/action 为非空串、read_evidence_sha256 键在且为串或 None。
    刻意不做什么:不在此判业务授权(读证据/路径/冲突),使「解析成功」与「授权」分离
         成两条可单独变异的链;但上层保证二者**合一**(不返回半态)。
    """
    if not isinstance(intent, Mapping):
        return "intent 类型错(应为映射) ⇒ 解析失败(§0.3)"
    if not isinstance(policy, Mapping):
        return "policy 类型错(应为映射) ⇒ 解析失败(§0.3)"
    for key in ("id", "files", "command"):
        if key not in intent:
            return f"intent 缺字段 {key!r} ⇒ 解析失败(§0.3 未判定)"
    if not isinstance(intent["id"], str) or not intent["id"].strip():
        return "intent.id 非非空串 ⇒ 解析失败(§0.3)"
    if not isinstance(intent["files"], list):
        return "intent.files 非列表 ⇒ 解析失败(§0.3)"
    if not intent["files"]:
        return "intent.files 为空 ⇒ 无可判编辑意图(§0.3 枚举到 0 个不记绿)"
    if not isinstance(intent["command"], str):
        return "intent.command 非串 ⇒ 解析失败(§0.3)"
    for index, file in enumerate(intent["files"]):
        if not isinstance(file, Mapping):
            return f"files[{index}] 非映射 ⇒ 解析失败(§0.3)"
        for key in ("path", "action"):
            if key not in file or not isinstance(file[key], str) or not file[key].strip():
                return f"files[{index}].{key} 缺失/非非空串 ⇒ 解析失败(§0.3)"
        if "read_evidence_sha256" not in file:
            return f"files[{index}] 缺 read_evidence_sha256 ⇒ 解析失败(§0.3)"
        sha = file["read_evidence_sha256"]
        if not (isinstance(sha, str) or sha is None):
            return f"files[{index}].read_evidence_sha256 类型错 ⇒ 解析失败(§0.3)"
    return None


def _edit_policy_gate(policy: Mapping[str, Any]) -> str | None:
    """编辑策略门:write_claims/expected_read_evidence 两维输入齐备才量得到冲突/当轮指纹。

    立因:§0.3 取不到输入 ⇒ unjudged;§0.10 失效方向=多要一次定向说明。
    判据:缺任一必需键 / 键在但非映射 ⇒ 返回原因。
    刻意不做什么:不校验 rulesets(那是 classify 的门,本层不重复判据,§0.6)。
    """
    missing = REQUIRED_EDIT_POLICY_KEYS - set(policy)
    if missing:
        return (
            f"policy 缺编辑判据必需键 {sorted(missing)} ⇒ "
            "冲突/当轮指纹两维没量到(§0.3 未判定, 不放行)"
        )
    for key in ("write_claims", "expected_read_evidence"):
        if not isinstance(policy[key], Mapping):
            return f"policy.{key} 形状非法(应为映射) ⇒ 未判定(§0.3)"
    return None


def _edit_result(
    verdict: str,
    intent_id: str | None,
    findings: list[dict[str, Any]],
    command_classification: dict[str, Any] | None,
    requires_confirmation: bool,
) -> dict[str, Any]:
    """汇总结构化 verdict;reasons 收全部非 ok 的点名原因(负例据此断言)。"""
    reasons = [f["reason"] for f in findings if f["status"] != "ok"]
    return {
        "verdict": verdict,
        "id": intent_id,
        "findings": findings,
        "reasons": reasons,
        "command_classification": command_classification,
        "requires_confirmation": requires_confirmation,
    }


def evaluate_edit_intent(intent: Any, policy: Any) -> dict[str, Any]:
    """跨文件编辑意图一致性:``consistent``/``diverged``/``unjudged``/``denied`` + findings。

    立因:复现对照「跨文件编辑意图」,并用测试钉住(§0.12);把「读证据溯源 + 命令分级
          + 解析鉴权合一 + 半态拒绝」钉成一把尺子(一轴超越)。
    判据(顺序即失效方向, 任一不满足即点名原因):
      ① 解析层形状 → 失败即 unjudged 且标注「授权判据未执行」(禁半态,§0.3);
      ② 编辑策略门(write_claims/expected_read_evidence) → 缺即 unjudged;
      ③ 逐文件:路径注入 → denied;跨 intent 冲突写 → denied;读证据为空 → unjudged;
         读证据与本轮基准不符 → diverged;基准缺该 path → unjudged;
      ④ 恒调用 classify_command_execution 纳入 findings(两判据绑定):
         destructive → denied(高危未确认不静默放行),unjudged → 不得 consistent;
      ⑤ 合成优先级 denied > unjudged > diverged > consistent。
    刻意不做什么:不在形状坏时跑任何授权判据却报 consistent;不把 unjudged 折成放行;
         不复制 classify 的分档判据(直接调用,§0.6 单一真相源)。
    """
    shape_reason = _intent_shape_reason(intent, policy)
    if shape_reason is not None:
        # 解析与授权合一:形状没解析成功,授权层一次都不跑,并把这个事实喊出来。
        return _edit_result(
            TIER_UNJUDGED,
            intent.get("id") if isinstance(intent, Mapping) else None,
            [
                _finding("input.shape", "unjudged", shape_reason),
                _finding(
                    "authorization",
                    "skipped",
                    "输入未解析成功 ⇒ 路径/冲突/读证据/命令授权判据均未执行"
                    "(解析与授权合一, 拒绝半态)",
                ),
            ],
            None,
            False,
        )

    intent_id: str = intent["id"]
    files: list[Mapping[str, Any]] = intent["files"]
    command: str = intent["command"]
    write_claims = policy.get("write_claims")
    expected = policy.get("expected_read_evidence")
    findings: list[dict[str, Any]] = []

    # 维 ②:编辑策略门(冲突/当轮指纹两维的输入面)。
    policy_reason = _edit_policy_gate(policy)
    if policy_reason is not None:
        findings.append(_finding("edit_policy.gate", "unjudged", policy_reason))

    # 维 ③:逐文件授权判据。
    for index, file in enumerate(files):
        path: str = file["path"]
        sha = file["read_evidence_sha256"]
        label = f"files[{index}]:{path}"
        inject = _path_injection_reason(path)
        if inject is not None:
            findings.append(
                _finding(
                    "path.injection",
                    "denied",
                    f"{label} 命中路径注入 {inject} ⇒ 拒绝, 绝不静默放行(§0.3)",
                )
            )
            continue  # 路径非法:不再用坏路径查冲突/指纹表。
        if (
            isinstance(write_claims, Mapping)
            and path in write_claims
            and write_claims[path] != intent_id
        ):
            findings.append(
                _finding(
                    "write.conflict",
                    "denied",
                    f"{label} 已被 intent {write_claims[path]!r} 声明写 ⇒ "
                    f"与 {intent_id!r} 冲突, 拒绝",
                )
            )
        # 【反向变异验证锚点 A】把下一支的 ``if`` 放行(改成恒 False)后,
        #   空读证据会落到「与本轮基准比对」判成 diverged, 缺读证据用例应从绿转红。
        if sha == "" or sha is None:
            findings.append(
                _finding(
                    "read_evidence.present",
                    "unjudged",
                    f"{label} 缺当轮读证据指纹(空) ⇒ 未判定, 绝不静默放行(§0.3)",
                )
            )
            continue
        if not isinstance(expected, Mapping) or path not in expected:
            findings.append(
                _finding(
                    "read_evidence.current",
                    "unjudged",
                    f"{label} 取不到本轮读证据基准 ⇒ 未判定(§0.3)",
                )
            )
        elif expected[path] != sha:
            findings.append(
                _finding(
                    "read_evidence.current",
                    "diverged",
                    f"{label} 声明指纹与本轮基准不符 ⇒ 跨文件编辑意图漂移",
                )
            )
        else:
            findings.append(
                _finding(
                    "read_evidence.current",
                    "ok",
                    f"{label} 读证据指纹与本轮基准一致",
                )
            )

    # 维 ④:命令分级(两判据绑定) —— 恒执行并把完整结果纳入 findings。
    classification = classify_command_execution(command, policy)
    findings.append(
        _finding(
            "command.classification",
            "ok",
            f"命令分级={classification['tier']} 规则={classification['rule']}: "
            f"{classification['evidence']}",
            classification=classification,
        )
    )
    # 【反向变异验证锚点 B】把下一支的 ``if`` 条件禁用后, 高危命令不再升级 denied,
    #   「意图一致但命令高危 ⇒ denied」联动用例会落回 consistent, 应从绿转红。
    if classification["tier"] == TIER_DESTRUCTIVE:
        findings.append(
            _finding(
                "command.binding",
                "denied",
                "命令判为 destructive 且 requires_confirmation=True ⇒ 高危未确认前拒绝, "
                "禁止意图一致但命令高危被静默放行(§0.10/两判据绑定)",
            )
        )
    elif classification["tier"] == TIER_UNJUDGED:
        findings.append(
            _finding(
                "command.binding",
                "unjudged",
                "命令分级未判定 ⇒ 意图不得判 consistent(两判据绑定, §0.3)",
            )
        )
    else:
        findings.append(
            _finding(
                "command.binding",
                "ok",
                f"命令分级={classification['tier']} 非高危, 不阻断编辑意图",
            )
        )

    # 维 ⑤:合成(优先级即失效从严方向)。
    statuses = {f["status"] for f in findings}
    if "denied" in statuses:
        verdict = DENIED
    elif "unjudged" in statuses:
        verdict = TIER_UNJUDGED
    elif "diverged" in statuses:
        verdict = DIVERGED
    else:
        verdict = CONSISTENT
    return _edit_result(
        verdict,
        intent_id,
        findings,
        classification,
        classification["tier"] == TIER_DESTRUCTIVE,
    )


__all__ = [
    "ALL_COMMAND_TIERS",
    "ALL_EDIT_OUTCOMES",
    "CONSISTENT",
    "DENIED",
    "DIVERGED",
    "REQUIRED_EDIT_POLICY_KEYS",
    "REQUIRED_RULESET_TIERS",
    "TIER_DESTRUCTIVE",
    "TIER_READ",
    "TIER_UNJUDGED",
    "TIER_WRITE",
    "classify_command_execution",
    "default_rulesets",
    "evaluate_edit_intent",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
