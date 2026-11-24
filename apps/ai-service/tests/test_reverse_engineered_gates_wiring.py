# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""round 9「生产接线」席 F —— 聚合入口接线测试(反向变异 A/B 已实跑)。

只 import 真实判据函数与聚合入口,不复制任何判据(§0.6)。每个 green 输入
都按逐个 Read 真实函数签名/返回结构构造,取不到的输入一律不编造。
"""

from __future__ import annotations

import copy

import pytest

from app.core.code_exec_sandbox import decide_code_execution
from app.core.edit_intent import default_rulesets
from app.services import reverse_engineered_gates as reg
from app.services.reverse_engineered_gates import (
    GATE_SUITE,
    UNJUDGED_GATES,
    evaluate_gate_suite,
)

# ---- 逐个现读确认签名后构造的 green 输入(取不到的字段一律不编造) ----
_SHA = "a" * 64

GREEN_CASES = [
    (
        "code_execution",
        {
            "sub_request": {
                "code": "result = 1 + 2\n",
                "language": "python",
                "requested_capabilities": [],
            }
        },
        {"capabilities": []},
        "allowed",
    ),
    (
        "edit_intent",
        {
            "intent": {
                "id": "i1",
                "files": [
                    {"path": "src/a.py", "action": "edit", "read_evidence_sha256": "abc123"}
                ],
                "command": "git status",
            }
        },
        {
            "write_claims": {},
            "expected_read_evidence": {"src/a.py": "abc123"},
            "rulesets": default_rulesets(),
        },
        "consistent",
    ),
    (
        "context_uri",
        {"uri": "context://workspace/src/a.py", "roots": {"workspace": "wsroot"}},
        {"allowed_namespaces": ["workspace"]},
        "allowed",
    ),
    (
        "ckg_query",
        {
            "graph": {
                "nodes": ["A", "B"],
                "edges": [{"src": "A", "dst": "B", "kind": "calls", "evidence": "e1"}],
            },
            "query": {"symbol": "A", "relation_kind": "calls", "max_depth": 1},
        },
        {"max_allowed_depth": 3, "allowed_relation_kinds": ["calls"]},
        "found",
    ),
    (
        "im_event",
        {
            "state": "pending",
            "event": {"seq": 1, "idempotency_key": "k1", "kind": "deliver", "at_seq": 1},
        },
        {"ttl": 10, "now_seq": 2},
        "applied",
    ),
    (
        "voice_frame",
        {
            "frame": {"seq": 1, "kind": "audio", "frame_sha256": _SHA},
            "session": {"state": "open", "current_frame_sha256": _SHA, "ttl": 10},
        },
        {
            "registered_kinds": ["audio", "barge_in"],
            "output_kinds": ["barge_in"],
            "transitions": {"open": ["audio", "barge_in"]},
        },
        "accepted",
    ),
]


def _req(kind, inputs):
    return {"kind": kind, "inputs": inputs}


def _pol(kind, gate_policy):
    return {"gates": {kind: gate_policy}}


# 1) 各 kind 正常分派(6 例)
@pytest.mark.parametrize(("kind", "inputs", "gate_policy", "sub_verdict"), GREEN_CASES)
def test_each_kind_dispatches_normally(kind, inputs, gate_policy, sub_verdict):
    result = evaluate_gate_suite(_req(kind, inputs), _pol(kind, gate_policy))
    assert result["verdict"] == "allowed"
    assert result["allowed"] is True
    assert result["enabled"] is True
    assert len(result["checks"]) == 1
    check = result["checks"][0]
    assert check["kind"] == kind
    assert check["verdict"] == sub_verdict
    assert check["blocking"] is False
    assert check["origin"] == "gate"
    assert check["source"]


# 2) 未登记 kind ⇒ unjudged,点名 reason,绝不静默放行
def test_unregistered_kind_is_unjudged():
    result = evaluate_gate_suite(_req("bogus_kind", {}), _pol("bogus_kind", {}))
    assert result["verdict"] == "unjudged"
    assert result["allowed"] is False
    assert "未登记" in result["reason"]
    assert result["checks"][0]["origin"] == "aggregation"
    assert "未登记" in result["checks"][0]["reason"]


# 3) policy 缺键 ⇒ unjudged(取不到输入不编造)
@pytest.mark.parametrize(
    "policy",
    [
        None,
        {},
        {"gates": {}},
        {"gates": {"other_kind": {}}},
    ],
)
def test_policy_missing_key_is_unjudged(policy):
    kind, inputs, gate_policy, _ = GREEN_CASES[0]
    result = evaluate_gate_suite(_req(kind, inputs), policy)
    assert result["verdict"] == "unjudged"
    assert result["allowed"] is False
    assert "policy" in result["checks"][0]["reason"]
    assert result["checks"][0]["origin"] == "aggregation"


# 4) 子判据 unjudged 传导为阻断(整组结论 = blocked,不是 allowed)
def test_subgate_unjudged_propagates_to_block():
    # language 未登记 ⇒ code_exec_sandbox 判 unjudged
    bad = {"code": "x = 1", "language": "ruby", "requested_capabilities": []}
    result = evaluate_gate_suite(
        _req("code_execution", {"sub_request": bad}),
        _pol("code_execution", {"capabilities": []}),
    )
    assert result["verdict"] == "blocked"
    assert result["allowed"] is False
    check = result["checks"][0]
    assert check["verdict"] == "unjudged"
    assert check["blocking"] is True
    assert check["origin"] == "gate"


# 4b) 子判据 unjudged 另一路(context_fs 缺白名单)
def test_subgate_unjudged_context_uri_propagates_to_block():
    result = evaluate_gate_suite(
        _req("context_uri", {"uri": "context://workspace/a.py", "roots": {"workspace": "r"}}),
        _pol("context_uri", {}),
    )
    assert result["verdict"] == "blocked"
    assert result["allowed"] is False
    assert result["checks"][0]["verdict"] == "unjudged"


# 5) 子判据 denied 传导(整组结论 = blocked)
@pytest.mark.parametrize(
    ("kind", "inputs", "gate_policy"),
    [
        (
            "code_execution",
            {
                "sub_request": {
                    "code": "import os\n",
                    "language": "python",
                    "requested_capabilities": [],
                }
            },
            {"capabilities": []},
        ),
        (
            "context_uri",
            {"uri": "context://workspace/../etc", "roots": {"workspace": "r"}},
            {"allowed_namespaces": ["workspace"]},
        ),
    ],
)
def test_subgate_denied_propagates_to_block(kind, inputs, gate_policy):
    result = evaluate_gate_suite(_req(kind, inputs), _pol(kind, gate_policy))
    assert result["verdict"] == "blocked"
    assert result["allowed"] is False
    check = result["checks"][0]
    assert check["verdict"] == "denied"
    assert check["blocking"] is True
    assert check["origin"] == "gate"


# 6) checks 明细可审计(每项 kind/verdict/reason + 阻断位/来源)
def test_checks_are_auditable():
    kind, inputs, gate_policy, _ = GREEN_CASES[0]
    result = evaluate_gate_suite(
        {"checks": [_req(kind, inputs), _req("ckg_query", GREEN_CASES[3][1])]},
        {"gates": {kind: gate_policy, "ckg_query": GREEN_CASES[3][2]}},
    )
    assert result["verdict"] == "allowed"
    assert isinstance(result["checks"], list) and len(result["checks"]) == 2
    for check in result["checks"]:
        assert {"kind", "verdict", "reason", "blocking", "origin", "source"} <= set(check)
        assert check["reason"]
        assert check["source"]


# 7) 多数绿不放行(fail-closed:1 绿 + 1 denied ⇒ 整组 blocked)
def test_majority_green_does_not_allow():
    green_kind, green_inputs, green_policy, _ = GREEN_CASES[0]
    denied = {
        "sub_request": {
            "code": "import os\n",
            "language": "python",
            "requested_capabilities": [],
        }
    }
    request = {
        "checks": [
            _req(green_kind, green_inputs),
            _req("code_execution", denied),
        ]
    }
    policy = {"gates": {green_kind: green_policy, "code_execution": {"capabilities": []}}}
    result = evaluate_gate_suite(request, policy)
    assert result["verdict"] == "blocked"
    assert result["allowed"] is False
    assert "fail-closed" in result["reason"]


# 8) opt-in 缺省不改变既有行为(request=None ⇒ 不介入、不跑任何闸、不改真实函数)
def test_opt_in_default_does_not_change_existing_behavior():
    kind, inputs, gate_policy, _ = GREEN_CASES[0]
    policy = _pol(kind, gate_policy)
    result = evaluate_gate_suite(None, policy)
    assert result["enabled"] is False
    assert result["verdict"] == "unjudged"
    assert result["allowed"] is False
    assert result["checks"] == []
    # 真实判据函数未被包装/替换:仍住在原模块,直调仍给自己的三态 verdict。
    assert decide_code_execution.__module__ == "app.core.code_exec_sandbox"
    direct = decide_code_execution(inputs["sub_request"], gate_policy)
    assert direct["verdict"] == "allowed"


# 9) 签名不认记 unjudged:未判定项两例 + 分派结果缺 verdict
@pytest.mark.parametrize("kind", ["scan_tier", "computer_step"])
def test_unjudged_gates_signature_mismatch(kind):
    result = evaluate_gate_suite(_req(kind, {}), _pol(kind, {}))
    assert result["verdict"] == "unjudged"
    assert result["allowed"] is False
    assert "未判定项" in result["checks"][0]["reason"]
    assert kind in UNJUDGED_GATES


def test_dispatch_result_missing_verdict_is_unjudged(monkeypatch):
    monkeypatch.setitem(
        reg.GATE_SUITE["code_execution"],
        "fn",
        lambda *args, **kwargs: {"status": "accepted"},
    )
    kind, inputs, gate_policy, _ = GREEN_CASES[0]
    result = evaluate_gate_suite(_req(kind, inputs), _pol(kind, gate_policy))
    assert result["verdict"] == "unjudged"
    assert result["allowed"] is False
    assert "缺 verdict" in result["checks"][0]["reason"]


# 10) 批量全绿 ⇒ allowed(checks 逐项留痕)
def test_batch_all_green_is_allowed():
    (k1, i1, p1, _), (k2, i2, p2, _) = GREEN_CASES[2], GREEN_CASES[4]
    result = evaluate_gate_suite(
        [_req(k1, i1), _req(k2, i2)],
        {"gates": {k1: p1, k2: p2}},
    )
    assert result["verdict"] == "allowed"
    assert result["allowed"] is True
    assert len(result["checks"]) == 2


# 11) 空 request / 缺 inputs / 缺子策略 ⇒ unjudged(不编造、不记绿)
def test_empty_checks_is_unjudged():
    result = evaluate_gate_suite({"checks": []}, {"gates": {}})
    assert result["verdict"] == "unjudged"
    assert result["allowed"] is False


def test_missing_inputs_is_unjudged():
    result = evaluate_gate_suite({"kind": "code_execution"}, _pol("code_execution", {"capabilities": []}))
    assert result["verdict"] == "unjudged"
    assert "inputs" in result["checks"][0]["reason"]


def test_missing_gate_policy_for_kind_is_unjudged():
    result = evaluate_gate_suite(_req("code_execution", GREEN_CASES[0][1]), {"gates": {}})
    assert result["verdict"] == "unjudged"
    assert "子策略" in result["checks"][0]["reason"]


# 12) 聚合层至少覆盖 5 项真实判据 + 纯函数不改动入参
def test_suite_covers_at_least_five_gates_and_does_not_mutate_inputs():
    assert len(GATE_SUITE) >= 5
    kind, inputs, gate_policy, _ = GREEN_CASES[0]
    request, policy = _req(kind, inputs), _pol(kind, gate_policy)
    before_req, before_pol = copy.deepcopy(request), copy.deepcopy(policy)
    evaluate_gate_suite(request, policy)
    assert request == before_req
    assert policy == before_pol
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
