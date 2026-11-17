# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""逆向复现判据的**显式接线层 + 装车读数**(R74 · 2026-11-18)。

立因(为什么需要这一层)
----------------------
`app/services/reverse_engineered_gates.py` 已把 6 门逆向复现判据聚成 `GATE_SUITE`,但当次实测
`git grep` 现读:除聚合层自身与测试的 import 外,**生产侧零消费者** —— 这正是全局铁律 9
"判据必须在真跑它的那一刻才成立:造好没装车 = 没有"要治的形状。而最近的接线候选位
(`agent_engine.py` 的 run_code / `crew-tools.ts`)按多席纪律属别席在飞件,不能借它抢接。

本层因此只做两件不改任何既有默认行为的事:
1. **单一接线出口** `evaluate_gate(gate, gate_inputs, policy=None)`:调用方在自己的调用点显式
   import 调用即完成装车;判据本体一行不复算,分派表逐字复用 `GATE_SUITE`(§0.6 单一真相源:
   第二份分派表必然与聚合层漂开)。
2. **装车读数** `build_landing_report(...)`:把"已接线 / 声明未接线 / 未判定盲区 / 接线点不唯一"
   四档机械量出来。此前这份账只能靠人逐轮重grep,写完就没人再核。

失效方向(§0.10 硬约束)
------------------------
所有输入取不到 / 形状不认 / 键不齐 ⇒ 返回 `unjudged` 并点名原因,**绝不因解析不了就放行**,
也绝不把"没判"记成"判过"(§0.3)。扫描器读不到源码 ⇒ 相应档位如实报"未判定",不用空集冒充 0。
"""

from __future__ import annotations

import inspect
from collections.abc import Mapping, Sequence
from typing import Any

# 判据本体只经聚合层取,本层零复算 —— 名字集、分派表、通过档位全部随聚合层漂移即自动跟随。
from app.services.reverse_engineered_gates import (
    GATE_SUITE,
    VERDICT_UNJUDGED,
)

__all__ = [
    "evaluate_gate",
    "build_landing_report",
    "wired_gate_names",
    "gate_names",
    "describe_binding",
]


def gate_names() -> tuple[str, ...]:
    """现读自 GATE_SUITE 的门名全集(不另立第二份名单)。"""
    return tuple(GATE_SUITE)


def _unjudged(gate: str, reason: str, source: str = "") -> dict[str, Any]:
    return {"verdict": VERDICT_UNJUDGED, "gate": gate, "reason": reason, "source": source}


def _required_params(fn: Any) -> tuple[str, ...]:
    sig = inspect.signature(fn)
    return tuple(
        name
        for name, p in sig.parameters.items()
        if p.kind in (p.POSITIONAL_OR_KEYWORD, p.KEYWORD_ONLY) and p.default is inspect._empty
    )


def _declared_keys(spec: Mapping[str, Any]) -> tuple[str, ...]:
    return tuple(spec.get("arg_keys") or ())


def describe_binding(gate: str) -> dict[str, Any]:
    """把"聚合层声明的键"与"判据本体真实必填键"的差值量出来。

    立因:当次实测现读 6 门签名,`code_execution` 声明 `("sub_request",)` 而本体是
    ``(request, policy)`` —— 声明与实物不符 ⇒ 只按声明绑必然 TypeError,而 TypeError 若被读成
    "判不出就放行"就是全局铁律 9 说的"造好没装车"。本函数把这件事变成可机检读数。
    """
    spec = GATE_SUITE.get(gate) or {}
    fn = spec.get("fn")
    declared = _declared_keys(spec)
    required = _required_params(fn) if callable(fn) else ()
    return {
        "gate": gate,
        "source": str(spec.get("source", "")),
        "declared_keys": declared,
        "required_params": required,
        "consistent": bool(required) and set(declared) == set(required),
    }


def _bind_and_call(gate: str, spec: Mapping[str, Any], gate_inputs: Mapping[str, Any]) -> tuple[Any, str, dict[str, Any]]:
    """两条绑定策略依次试,返回 (原始返回, 生效策略, 透传读数)。

    - 策略 A:按聚合层**声明键**关键字绑定(尊重上层契约,零复算)。
    - 策略 B:按判据本体 **inspect 必填参**绑定(治声明与实物不一致;取不到的键名如实入读数)。
    """
    fn: Any = spec["fn"]
    declared = _declared_keys(spec)
    attempts: list[dict[str, Any]] = []

    try:
        args = {k: gate_inputs[k] for k in declared}
        if "policy" not in args and "policy" in gate_inputs:
            args["policy"] = gate_inputs["policy"]
        return fn(**args), "declared-keys", {"used": sorted(args)}
    except (KeyError, TypeError) as exc:
        attempts.append({"strategy": "declared-keys", "error": f"{type(exc).__name__}:{exc}"})

    required = _required_params(fn)
    missing = [k for k in required if k not in gate_inputs]
    if missing:
        # 本体必填键在输入里没有 ⇒ 交回调用方补,一次定向说明(§0.10),不猜值。
        attempts.append({"strategy": "required-params", "missing": missing, "required": list(required)})
        raise _BindingExhausted(attempts)
    try:
        args = {k: gate_inputs[k] for k in required}
        return fn(**args), "required-params", {"used": sorted(args)}
    except TypeError as exc:
        attempts.append({"strategy": "required-params", "error": f"{type(exc).__name__}:{exc}"})
        raise _BindingExhausted(attempts)


class _BindingExhausted(Exception):
    def __init__(self, attempts: list[dict[str, Any]]) -> None:
        super().__init__("binding strategies exhausted")
        self.attempts = attempts


def evaluate_gate(gate: str, gate_inputs: Mapping[str, Any] | None, policy: Any = None) -> dict[str, Any]:
    """按门名显式求值一道判据,返回带 ``gate``/``source``/``binding`` 的 verdict。

    ``gate_inputs`` 的键需能覆盖该门的绑定面(声明键或本体必填键,任一成立即可);两条都不成立
    ⇒ ``unjudged`` 点名两侧尝试,绝不因解析不了就放行(§0.3)。调用点 import 本函数即算装车。
    """
    spec = GATE_SUITE.get(gate)
    if spec is None:
        return _unjudged(gate, f"gate-not-in-suite;known={sorted(GATE_SUITE)}")
    source = str(spec.get("source", ""))
    if not callable(spec.get("fn")):
        return _unjudged(gate, "suite-entry-not-callable", source)
    if not isinstance(gate_inputs, Mapping):
        return _unjudged(gate, f"inputs-not-mapping;declared-keys={list(_declared_keys(spec))}", source)

    inputs: dict[str, Any] = dict(gate_inputs)
    if policy is not None and "policy" not in inputs:
        inputs["policy"] = policy

    try:
        raw, strategy, binding = _bind_and_call(gate, spec, inputs)
    except _BindingExhausted as exc:
        return _unjudged(gate, f"binding-exhausted:{exc.attempts}", source)
    except Exception as exc:  # noqa: BLE001 - 绑定层自身异常不得被读成放行
        return _unjudged(gate, f"binding-raised:{type(exc).__name__}:{exc}", source)

    if not isinstance(raw, Mapping):
        return _unjudged(gate, f"verdict-not-mapping:{type(raw).__name__};binding={strategy}", source)
    verdict = str(raw.get("verdict", ""))
    if not verdict:
        return _unjudged(gate, f"verdict-key-missing;binding={strategy}", source)

    pass_verdicts = frozenset(spec.get("pass_verdicts") or ())
    binding["declared_verdict"] = verdict
    out: dict[str, Any] = {
        # 接线层的有效档位 = 本体档位是否落在聚合层的通过集里(拦截语义由调用方按此档位决定)
        "verdict": "allowed" if verdict in pass_verdicts else ("unjudged" if verdict == VERDICT_UNJUDGED else "blocked"),
        "gate": gate,
        "source": source,
        "binding": {"strategy": strategy, **binding},
        "detail": dict(raw),
        # ★ 本体档位单独留存:审计时不得把"denied"(本体的词表)误记成接线层的归一化档,
        #   也不得让接线层看起来像是判据的裁决者(裁决权恒在判据本体)。
        "native_verdict": verdict,
    }
    if out["verdict"] == "allowed":
        return out
    if verdict == VERDICT_UNJUDGED:
        # 判据本体自己判未判定:保留其理由,不升级为 blocked(§0.3 不冒红)
        out["reason"] = str(raw.get("reason", "judge-reported-unjudged"))
        return out
    binding["effective_verdict"] = "blocked"
    out["reason"] = f"native-verdict={verdict} not-in-pass-set={sorted(pass_verdicts)}"
    return out


def wired_gate_names(module_sources: Mapping[str, str]) -> tuple[str, ...]:
    """从注入的模块源码字典里量出被**具名接线**的门(供纯函数测试直驱)。"""
    found: set[str] = set()
    for text in module_sources.values():
        for gate in gate_names():
            if f'"{gate}"' in text or f"'{gate}'" in text:
                found.add(gate)
    return tuple(sorted(found))


def build_landing_report(
    module_sources: Mapping[str, str] | None,
    *,
    unjudged_gates: Mapping[str, str] | None = None,
    exclude_substrings: Sequence[str] = (
        "reverse_engineered_gate_wiring",
        "reverse_engineered_gates",
    ),
) -> dict[str, Any]:
    """把 6 门判据的装车状态量成读数(不判红、不改任何行为,纯观测)。

    ``module_sources`` 为 path → 源码文本(由调用方读盘注入,便于在无 IO 情况下被测试直驱);
    取不到 ⇒ ``scan_state='undetermined'``,**不得把空集读成"都没接线"**。

    ``exclude_substrings`` 缺省同时排除聚合层与本层自身 —— 本轮实测踩到:聚合层 ``GATE_SUITE``
    里逐字写着六个门名,若不排除,扫描器会把"声明"当成"已接线",把 0 扇报成 6 扇(装而未跑
    被读成跑过)。接线点必须是**除声明处之外的调用方**。
    """
    suite = gate_names()
    if module_sources is None:
        scan_state = "undetermined"
        hits: dict[str, list[str]] = {g: [] for g in suite}
        unresolvable = list(suite)
    elif not module_sources:
        scan_state = "empty-input"
        hits = {g: [] for g in suite}
        unresolvable = list(suite)
    else:
        scan_state = "ok"
        hits = {g: [] for g in suite}
        for path, text in module_sources.items():
            if any(s in path for s in exclude_substrings):
                continue
            for gate in suite:
                if f'"{gate}"' in text or f"'{gate}'" in text:
                    hits[gate].append(path)
        unresolvable = []

    wired = sorted(g for g, hs in hits.items() if len(hs) == 1)
    ambiguous = sorted(g for g, hs in hits.items() if len(hs) > 1)
    unwired = sorted(g for g in suite if not hits[g] and g not in unresolvable)

    return {
        "scan_state": scan_state,
        "suite_gates": suite,
        "wired": wired,
        "wired_sites": {g: sorted(hits[g]) for g in wired},
        "declared_not_wired": unwired,
        "multi_site": ambiguous,
        "undetermined_gates": sorted(unresolvable),
        "judged_blind_spots": sorted((unjudged_gates or {}).keys()),
        "blind_spot_reasons": dict(unjudged_gates or {}),
        "counts": {
            "suite": len(suite),
            "wired": len(wired),
            "declared_not_wired": len(unwired),
            "multi_site": len(ambiguous),
            "undetermined": len(unresolvable),
            "blind_spots": len(unjudged_gates or {}),
        },
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
