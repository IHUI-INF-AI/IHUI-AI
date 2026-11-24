# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""round 9「生产接线」席 F —— 判据聚合唯一入口(AGENTS.md §0.9 / §0.6)。

立因(§0.9 判据必须在真跑它的那一刻才成立,造好没装车 = 没有)
--------------------------------------------------------------
round8 / round9 落了一族可复用判据(各有表驱动测试与水印),但逐个现读
``app/`` 后确认:除 ``agent_checkpoint.py`` 已 opt-in 接入 ``revert_check``
外,本轮这族判据在生产代码里**零 importer、零调用方**。本模块把它们收成
一个聚合入口 ``evaluate_gate_suite``,供调用方在「真跑它的那一刻」显式
opt-in 调用;不改任何既有函数的默认行为(round8 无条件闸造成 9 例回归,
绝不重演)。

§0.6 不重复实现任何判据
-----------------------
本模块**只** ``from app.core.<模块> import <真实函数>`` 转发:不复制任何
词表、重写任何一条规则、兜底任何一张默认策略。每项 kind 的放行(green)
集合来自逐个 Read 真实函数确认的三态/四态 verdict 词表,仅做机械转发与
fail-closed 收口,绝不重判业务语义。

输入契约(取不到即未判定,绝不编造输入)
--------------------------------------
``request``(显式 opt-in,缺省 None ⇒ 不介入)三选一:
  1. 单条 ``{"kind": <kind>, "inputs": {<arg_key>: value, ...}}``
  2. 批量 ``{"checks": [<单条>, ...]}``(整组 fail-closed 收口)
  3. 批量 ``list[<单条>]``
``policy`` = ``{"gates": {<kind>: <子判据 policy>, ...}}``;末尾追加到
真实函数的最后一个参数。

输出(可审计)``{verdict, allowed, enabled, reason, checks}``:
  * ``allowed``  —— 所有 check 全绿且至少 1 条;
  * ``unjudged`` —— 任一 check 是聚合层自己没判成(kind 未登记 / policy 缺键
                    / 分派结果缺 verdict / 空 request / 未判定项 / opt-in 未启用);
  * ``blocked``  —— 全判过但任一子判据 denied/unjudged/非绿 ⇒ 整组阻断;
  * ``allowed`` 布尔仅在 verdict==allowed 时为真(§0.3 没判绝不写成判过);
  * ``checks``   —— 每项含 kind/verdict/reason(+ blocking/origin/source),逐项可审计。
失效方向恒为「多要一次定向说明」(§0.10):任何不确定一律阻断,绝不静默放行,
绝不做「多数绿即放行」。

未判定项(§0.3 签名对不上不硬接)
--------------------------------
``security_scan_tiers`` / ``computer_use_ledger`` 现读确认返回结构缺
``verdict`` 键(前者返回 str / Finding(tier,...) NamedTuple,后者判定键叫
``status``),与聚合契约对不上 ⇒ 列入 ``UNJUDGED_GATES``,不硬接;一旦被
请求仍按 fail-closed 落 unjudged 并点名,绝不静默放行。
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

# §0.6:只 import 真实判据函数,不重写任何一条判据、不复制任何词表。
from app.core.ckg_relation import retrieve_relation
from app.core.code_exec_sandbox import decide_code_execution
from app.core.context_fs import resolve_context_uri
from app.core.edit_intent import evaluate_edit_intent
from app.core.im_orchestration import transition as im_transition
from app.core.realtime_voice_session import evaluate_frame

# 聚合层三态 verdict(与子判据词表刻意独立,避免并桶成第二份真相)。
VERDICT_ALLOWED = "allowed"
VERDICT_BLOCKED = "blocked"
VERDICT_UNJUDGED = "unjudged"

# 子判据 verdict 里恒阻断的两档(§0.10 没判 / 拒 绝不写成放行)。
_BLOCKING_VERDICTS = frozenset({VERDICT_UNJUDGED, "denied"})

# kind -> 真实函数 + request.inputs 入参键 + 放行(绿)集合 + 审计来源。
# pass_verdicts 来自逐个 Read 真实模块确认的 verdict 词表;任何不在集合内的
# verdict(含 diverged/rejected/not_found 之外的值)一律 fail-closed 阻断。
# arg_keys 按位置传给子判据,末尾追加 policy.gates[kind] 作为 policy 实参。
GATE_SUITE: dict[str, dict[str, Any]] = {
    "code_execution": {
        "fn": decide_code_execution,
        "arg_keys": ("sub_request",),
        "pass_verdicts": frozenset({"allowed"}),
        "source": "app.core.code_exec_sandbox.decide_code_execution",
    },
    "edit_intent": {
        "fn": evaluate_edit_intent,
        "arg_keys": ("intent",),
        "pass_verdicts": frozenset({"consistent"}),
        "source": "app.core.edit_intent.evaluate_edit_intent",
    },
    "context_uri": {
        "fn": resolve_context_uri,
        "arg_keys": ("uri", "roots"),
        "pass_verdicts": frozenset({"allowed"}),
        "source": "app.core.context_fs.resolve_context_uri",
    },
    "ckg_query": {
        "fn": retrieve_relation,
        "arg_keys": ("graph", "query"),
        "pass_verdicts": frozenset({"found", "not_found"}),
        "source": "app.core.ckg_relation.retrieve_relation",
    },
    "im_event": {
        "fn": im_transition,
        "arg_keys": ("state", "event"),
        "pass_verdicts": frozenset({"applied"}),
        "source": "app.core.im_orchestration.transition",
    },
    "voice_frame": {
        "fn": evaluate_frame,
        "arg_keys": ("frame", "session"),
        "pass_verdicts": frozenset({"accepted", "barged_in"}),
        "source": "app.core.realtime_voice_session.evaluate_frame",
    },
}

# 现读确认「签名/返回结构对不上聚合层 verdict 契约」的模块 → 未判定项(不硬接)。
UNJUDGED_GATES: dict[str, str] = {
    "scan_tier": (
        "security_scan_tiers.decide_scan_tier 返回裸 str / build_finding 返回 "
        "Finding(tier,rule,evidence) NamedTuple,均无 verdict 键"
    ),
    "computer_step": (
        "computer_use_ledger.evaluate_step 返回 dict 但判定键为 "
        "status(accepted/rejected/unjudged)而非 verdict"
    ),
}


def _check(
    *,
    kind: str,
    verdict: str,
    reason: str,
    blocking: bool,
    origin: str,
    source: str = "",
) -> dict[str, Any]:
    """单条可审计 check:kind/verdict/reason + 阻断位 + 判定来源(聚合层/子判据)。"""
    return {
        "kind": kind,
        "verdict": verdict,
        "reason": reason,
        "blocking": blocking,
        "origin": origin,
        "source": source,
    }


def _unjudged(kind: str, reason: str, *, source: str = "") -> dict[str, Any]:
    """聚合层自己没判成 ⇒ origin=aggregation 的 unjudged check(绝不静默放行)。"""
    return _check(
        kind=kind,
        verdict=VERDICT_UNJUDGED,
        reason=reason,
        blocking=True,
        origin="aggregation",
        source=source,
    )


def _reason_of(raw: Mapping[str, Any], kind: str) -> str:
    """机械提取子判据可读 reason 文本;各模块词表不同,只转发不重判。"""
    for key in ("reason", "detail"):
        value = raw.get(key)
        if isinstance(value, str) and value:
            return value
    reasons = raw.get("reasons")
    if isinstance(reasons, (list, tuple)) and reasons:
        return "; ".join(str(item) for item in reasons)
    code = raw.get("reason_code")
    if isinstance(code, str) and code:
        return f"reason_code={code}"
    return (
        f"子判据 {kind!r} verdict={raw.get('verdict')!r} 未提供可读 reason 文本"
        "(结论已判,逐维证据见原始结果)"
    )


def _evaluate_one(gate_request: Any, policy: Any) -> dict[str, Any]:
    """把一条 gate-request 判成一条 check;取不到/不认一律落 unjudged。"""
    if not isinstance(gate_request, Mapping):
        return _unjudged("<non-mapping>", "gate-request 形状不认:非映射,无法读取 kind/inputs")

    kind = gate_request.get("kind")
    if not isinstance(kind, str) or not kind:
        return _unjudged("<missing-kind>", "gate-request 缺 kind 或 kind 非字符串 ⇒ 无法分派")

    if kind in UNJUDGED_GATES:
        return _unjudged(
            kind,
            f"kind={kind!r} 列入未判定项(签名/返回结构不认,不硬接):{UNJUDGED_GATES[kind]}",
        )

    spec = GATE_SUITE.get(kind)
    if spec is None:
        return _unjudged(
            kind,
            f"kind={kind!r} 未登记:GATE_SUITE 无此分派项,既不猜测也不放行(§0.3)",
        )
    source = spec["source"]

    # policy 缺键三连(§0.3/§0.10 取不到输入即未判定,绝不编造)。
    if not isinstance(policy, Mapping):
        return _unjudged(kind, "policy 形状不认/缺失:非映射,取不到 gates 子策略", source=source)
    gates = policy.get("gates")
    if not isinstance(gates, Mapping):
        return _unjudged(
            kind, "policy 缺 'gates' 键或形状坏:取不到子策略,不编造输入(§0.3)", source=source
        )
    if kind not in gates:
        return _unjudged(
            kind, f"policy.gates 缺 {kind!r} 子策略:取不到判据输入,不编造(§0.3)", source=source
        )
    gate_policy = gates[kind]

    inputs = gate_request.get("inputs")
    if not isinstance(inputs, Mapping):
        return _unjudged(
            kind, "gate-request 缺 'inputs' 或形状坏:子判据入参取不到,不编造", source=source
        )
    try:
        argv = [inputs[key] for key in spec["arg_keys"]]
    except KeyError as exc:
        return _unjudged(
            kind, f"gate-request.inputs 缺键 {exc!s}:子判据入参取不到,不编造", source=source
        )

    # 调用真实判据函数(§0.6 只转发);异常一律 fail-closed 未判定,绝不冒绿。
    try:
        raw = spec["fn"](*argv, gate_policy)
    except Exception as exc:  # 失效方向恒为阻断,绝不静默放行
        return _unjudged(
            kind,
            f"子判据调用异常 {type(exc).__name__}: {exc} ⇒ 未判定阻断(§0.3)",
            source=source,
        )

    # 分派结果缺 verdict ⇒ 一律 unjudged(§0.3/§0.10)。
    if not isinstance(raw, Mapping) or not isinstance(raw.get("verdict"), str):
        return _unjudged(
            kind,
            f"分派结果缺 verdict 字段(实得 {type(raw).__name__})⇒ 形状不认,未判定阻断",
            source=source,
        )

    sub_verdict = raw["verdict"]
    # 【fail-closed 单点】命中恒阻断两档 / 不在放行集合 ⇒ 该 check 阻断;
    # 绝不做「多数绿即放行」。反向变异:把下一行 blocking 恒置 False 后,
    # 「子判据 denied/unjudged 传导为阻断」「多数绿不放行」用例必须从绿转红。
    blocking = sub_verdict in _BLOCKING_VERDICTS or sub_verdict not in spec["pass_verdicts"]
    return _check(
        kind=kind,
        verdict=sub_verdict,
        reason=_reason_of(raw, kind),
        blocking=blocking,
        origin="gate",
        source=source,
    )


def _normalize(request: Any) -> list[Any] | None:
    """把三种 request 形状归一成 gate-request 列表;不认返回 None(不编造)。"""
    if isinstance(request, Mapping):
        if "checks" in request:
            checks = request["checks"]
            return list(checks) if isinstance(checks, (list, tuple)) else None
        return [request]
    if isinstance(request, (list, tuple)):
        return list(request)
    return None


def _suite(
    verdict: str,
    reason: str,
    checks: list[dict[str, Any]],
    *,
    enabled: bool = True,
) -> dict[str, Any]:
    """聚合结论唯一出口:verdict/allowed/enabled/reason/checks 同帧留痕。"""
    return {
        "verdict": verdict,
        "allowed": verdict == VERDICT_ALLOWED,
        "enabled": enabled,
        "reason": reason,
        "checks": checks,
    }


def evaluate_gate_suite(request: Any = None, policy: Any = None) -> dict[str, Any]:
    """判据聚合唯一入口(显式 opt-in,§0.9 装车 / §0.3 绝不静默放行)。

    opt-in:只有调用方显式传入 request 才启用;request=None 时返回 enabled=False、
    verdict=unjudged、checks=[] —— 不介入、不改任何既有函数的默认行为
    (round8 无条件闸造成 9 例回归,绝不重演)。
    """
    if request is None:
        return _suite(
            VERDICT_UNJUDGED,
            "opt-in 未启用:调用方未显式传入 request,聚合层不介入,既有函数默认行为不变",
            [],
            enabled=False,
        )

    gate_requests = _normalize(request)
    if gate_requests is None:
        return _suite(
            VERDICT_UNJUDGED,
            "request 形状不认:需为带 kind/inputs 的映射、带 checks 的映射,或映射列表",
            [_unjudged("<request>", "request 形状不认 ⇒ 无法分派,未判定阻断")],
        )
    if not gate_requests:
        return _suite(
            VERDICT_UNJUDGED,
            "request 枚举到 0 条 gate-request:无可判项,绝不记绿(§0.3)",
            [_unjudged("<empty>", "枚举到 0 个 check 不记绿(§0.3 没判绝不写成判过)")],
        )

    checks = [_evaluate_one(gr, policy) for gr in gate_requests]

    # 【反向变异验证锚点 / fail-closed 收口】把下一行 all_green 临时改恒 True 后,
    # 「子判据 denied/unjudged 传导为阻断」「多数绿不放行」用例必须转红;恢复即复绿。
    all_green = not any(check["blocking"] for check in checks)
    if all_green:
        verdict = VERDICT_ALLOWED
        reason = f"{len(checks)} 条子判据全绿 ⇒ 整组放行"
    elif any(check["origin"] == "aggregation" for check in checks):
        verdict = VERDICT_UNJUDGED
        reason = (
            "存在聚合层自己没判成的 check(未登记 kind / policy 缺键 / 分派结果缺 verdict / "
            "未判定项)⇒ 整组未判定,绝不静默放行(§0.3)"
        )
    else:
        verdict = VERDICT_BLOCKED
        blocked = [c["kind"] for c in checks if c["blocking"]]
        reason = f"子判据 {blocked} 判为阻断档 ⇒ 整组结论为阻断(fail-closed,不允许多数绿即放行)"

    return _suite(verdict, reason, checks)


__all__ = [
    "GATE_SUITE",
    "UNJUDGED_GATES",
    "VERDICT_ALLOWED",
    "VERDICT_BLOCKED",
    "VERDICT_UNJUDGED",
    "evaluate_gate_suite",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
