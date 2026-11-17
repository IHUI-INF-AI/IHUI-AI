# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R74 接线层的装车锁与读数锁。

纪律:判据本体一律 import 源模块(§22c),测试内零复算 —— 本文件不重写任何分派表/通过档位。
"""

from __future__ import annotations

from typing import Any

from app.services import reverse_engineered_gates as agg
from app.services.reverse_engineered_gate_wiring import (
    build_landing_report,
    describe_binding,
    evaluate_gate,
    gate_names,
    wired_gate_names,
)

SUITE = agg.GATE_SUITE


def _pure_request() -> dict[str, Any]:
    """形状合法的纯计算 request —— 契约取 code_exec_sandbox 自己的字段形态,测试不复算判据。"""
    return {"code": "total = sum([1, 2, 3])\nprint(total)\n", "language": "python", "requested_capabilities": []}


def _empty_policy() -> dict[str, Any]:
    return {"capabilities": []}


def _hostile_request() -> dict[str, Any]:
    """高危触碰:能力标签引用生产常量(§22c 不在测试里重写危险名清单)。"""
    from app.core import code_exec_sandbox as sb

    return {"code": "import socket\nsocket.socket()\n", "language": "python", "requested_capabilities": [sb.CAP_NETWORK]}


def test_gate_names_is_live_view_of_suite_not_a_copy() -> None:
    """名字集必须等于聚合层现读值:聚合层加门 ⇒ 本层自动跟随,不靠人改第二份。"""
    assert gate_names() == tuple(SUITE)
    assert "code_execution" in gate_names()


def test_unknown_gate_never_becomes_green() -> None:
    out = evaluate_gate("no_such_gate", {})
    assert out["verdict"] == agg.VERDICT_UNJUDGED
    assert "gate-not-in-suite" in out["reason"]


def test_missing_args_stay_unjudged() -> None:
    """声明键齐但本体还必填 policy ⇒ 两条绑定都不成立 ⇒ 未判定并点名两侧尝试(§0.10:
    失效方向是"多要一次定向说明",不是补个默认值蒙过去)。"""
    out = evaluate_gate("context_uri", {"uri": "context://a", "roots": ["/tmp"]})
    assert out["verdict"] == agg.VERDICT_UNJUDGED
    assert "binding-exhausted" in out["reason"]
    assert "policy" in out["reason"]


def test_non_mapping_inputs_stay_unjudged() -> None:
    out = evaluate_gate("code_execution", None)
    assert out["verdict"] == agg.VERDICT_UNJUDGED
    assert "inputs-not-mapping" in out["reason"]


def test_declared_key_mismatch_falls_back_to_real_signature() -> None:
    """聚合层声明 `("sub_request",)`、本体真实必填是 `(request, policy)`(本轮现读实测)⇒
    声明键那条路必然 TypeError。接线层的失效方向是**回退到本体签名再试一次**,
    而不是把 TypeError 读成"判不出就算过"。"""
    info = describe_binding("code_execution")
    assert info["declared_keys"] == ("sub_request",)
    assert info["required_params"] == ("request", "policy")
    assert info["consistent"] is False

    out = evaluate_gate("code_execution", {"sub_request": _pure_request()}, policy=_empty_policy())
    assert out["verdict"] == agg.VERDICT_UNJUDGED
    assert "binding-exhausted" in out["reason"]
    assert "required-params" in out["reason"] and "missing" in out["reason"]


def test_code_execution_pure_calculus_passes_via_required_params_binding() -> None:
    out = evaluate_gate(
        "code_execution",
        {"request": _pure_request(), "policy": _empty_policy()},
    )
    assert out["verdict"] == "allowed", out
    assert out["gate"] == "code_execution"
    assert out["binding"]["strategy"] == "required-params"
    assert out["binding"]["used"] == ["policy", "request"]
    assert out["source"] == SUITE["code_execution"]["source"]


def test_code_execution_host_capability_is_blocked() -> None:
    out = evaluate_gate(
        "code_execution",
        {"request": _hostile_request(), "policy": {"capabilities": []}},
    )
    assert out["verdict"] == "blocked", out
    assert "native-verdict=denied" in out["reason"], out
    # ★ 本体档位必须逐字可见:接线层是归一化读数,不是裁决者(审计不得把 denied 说成接线层判的)
    assert out["native_verdict"] == "denied", out
    assert out["binding"]["declared_verdict"] == "denied"
    assert out["binding"]["strategy"] == "required-params"
    assert out["detail"]["detected_capabilities"], out


def test_ckg_found_passes_on_declared_key_strategy() -> None:
    """通过档位取聚合层:found 落在 pass 集 ⇒ 归一化为 allowed;本体档位仍是 found。
    本机实测此门**声明键就够用**(declared-keys 一次命中),回退轴留给 code_execution 那种漂移。"""
    from app.core import ckg_relation as ck

    assert SUITE["ckg_query"]["pass_verdicts"] == frozenset({"found", "not_found"})
    graph = {"nodes": ["A", "B"], "edges": [{"src": "A", "dst": "B", "kind": "calls", "evidence": "ast:L1"}]}
    query = {"symbol": "A", "relation_kind": "calls", "max_depth": 2}
    policy = {"max_allowed_depth": 4, "allowed_relation_kinds": ["calls", "inherits", "imports"]}
    out = evaluate_gate("ckg_query", {"graph": graph, "query": query, "policy": policy})
    assert out["verdict"] == "allowed", out
    assert out["native_verdict"] == ck.__test__["VERDICT_FOUND"], out
    assert out["binding"]["strategy"] == "declared-keys"



def test_describe_binding_surfaces_every_gate_declaration_drift() -> None:
    """全门读数:任何一门的声明键≠本体必填键都必须被量到,不许漏(这本身就是超越轴)。"""
    rows = [describe_binding(g) for g in gate_names()]
    assert {r["gate"] for r in rows} == set(gate_names())
    drifted = {r["gate"] for r in rows if not r["consistent"]}
    assert "code_execution" in drifted
    for r in rows:
        assert isinstance(r["declared_keys"], tuple) and isinstance(r["required_params"], tuple)


def test_judge_exception_is_not_silently_allowed(monkeypatch: Any) -> None:
    """本体抛异常 ⇒ 未判定(既不冒绿也不冒红),并保留异常类型可读。
    用 monkeypatch 在聚合层同一对象上造一道会抛的门:接线层必须"当场不记绿",
    而不是把异常吞掉当放行 —— 这条只有靠强制异常才能验到,故注入而非找坏输入。"""
    from app.services import reverse_engineered_gate_wiring as wiring

    def _boom(**_kw: Any) -> dict[str, Any]:
        raise RuntimeError("judge died")

    monkeypatch.setitem(
        wiring.GATE_SUITE,
        "_injected",
        {"fn": _boom, "arg_keys": ("thing",), "pass_verdicts": frozenset({"ok"}), "source": "test:n/a"},
    )
    out = wiring.evaluate_gate("_injected", {"thing": 1})
    assert out["verdict"] == agg.VERDICT_UNJUDGED
    assert "binding-raised" in out["reason"] or "RuntimeError" in out["reason"], out
    assert out["source"] == "test:n/a"


def test_declaration_sites_are_never_counted_as_wired() -> None:
    """本轮实测踩到的读数陷阱:聚合层 GATE_SUITE 与接线层自身都逐字写着六个门名 ⇒ 不排除就会
    把"声明"报成"已接线",把 0 扇报成 6 扇(装而未跑被读成跑过)。这两处一律不计。"""
    suite_text = "GATE_SUITE = {\n" + "".join(f'    "{g}": {{}}\n' for g in gate_names()) + "}\n"
    sources = {
        "app/services/reverse_engineered_gates.py": suite_text,
        "app/services/reverse_engineered_gate_wiring.py": suite_text,
    }
    rep = build_landing_report(sources)
    assert rep["counts"]["wired"] == 0
    assert rep["wired_sites"] == {}
    assert set(rep["declared_not_wired"]) == set(gate_names())

    # 真调用方一旦出现 ⇒ 该门立刻从"未接线"转"已接线"(读数不是常量,是现场量出来的)
    sources["app/services/producer_x.py"] = 'r = evaluate_gate("code_execution", payload)\n'
    rep2 = build_landing_report(sources)
    assert rep2["wired"] == ["code_execution"]
    assert "code_execution" not in rep2["declared_not_wired"]


def test_report_reads_wired_blind_and_declared_not_wired() -> None:
    sources = {
        "app/services/sample_producer.py": 'X = evaluate_gate("code_execution", payload)\n',
        "app/services/reverse_engineered_gate_wiring.py": 'gate = "code_execution"  # 本层说明书不计接线点\n',
    }
    blind = {"scan_tier": "返回裸 str,无 verdict 键"}
    rep = build_landing_report(sources, unjudged_gates=blind)
    assert rep["scan_state"] == "ok"
    assert rep["wired"] == ["code_execution"]
    assert rep["wired_sites"]["code_execution"] == ["app/services/sample_producer.py"]
    assert "reverse_engineered_gate_wiring.py" not in rep["wired_sites"]["code_execution"]
    assert rep["judged_blind_spots"] == ["scan_tier"]
    assert set(rep["declared_not_wired"]) == set(gate_names()) - {"code_execution"}
    assert rep["counts"]["suite"] == len(gate_names())
    assert rep["counts"]["wired"] == 1


def test_report_multi_site_gate_is_not_counted_as_wired() -> None:
    sources = {
        "app/services/a.py": 'evaluate_gate("im_event", x)\n',
        "app/services/b.py": 'evaluate_gate("im_event", y)\n',
    }
    rep = build_landing_report(sources)
    assert rep["multi_site"] == ["im_event"]
    assert "im_event" not in rep["wired"]


def test_undetermined_input_never_reads_as_zero_wiring() -> None:
    """§0.3:取不到输入不得记绿也不得当成"都没接线"。"""
    rep = build_landing_report(None)
    assert rep["scan_state"] == "undetermined"
    assert rep["counts"]["wired"] == 0
    assert rep["undetermined_gates"] == sorted(gate_names())
    assert rep["declared_not_wired"] == []
    empty = build_landing_report({})
    assert empty["scan_state"] == "empty-input"


def test_wired_gate_names_helper_matches_report_semantics() -> None:
    """返回值恒为排序 tuple(与 gate_names() 同形,便于逐档对账不出现 list/tuple 两制)。"""
    assert wired_gate_names({"m.py": 'evaluate_gate("context_uri", z)\n'}) == ("context_uri",)
    assert wired_gate_names({}) == ()
    assert wired_gate_names({"m.py": 'x = "im_event"\ny = "ckg_query"\n'}) == ("ckg_query", "im_event")


def test_reverse_engineered_gates_is_the_single_source_of_dispatch() -> None:
    """接线层不得自带第二份分派表(§0.6):import 的表必须是同一个对象。"""
    import app.services.reverse_engineered_gate_wiring as wiring

    assert wiring.GATE_SUITE is agg.GATE_SUITE
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
