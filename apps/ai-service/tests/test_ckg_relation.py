# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# tests/test_ckg_relation.py
"""CKG 关系检索判据层的表驱动行为锁(round 9 能力复现)。

立因:对照 Qoder/Trae 的 CKG relationship retrieval 只有「图检索」;本层复现其
行为并以测试钉住,额外把「缺证据 / 成环 / 形状不认」钉成阻断、输出可审计证据链。

判据:每个用例断言结构化 ``verdict`` / ``reason_code`` / ``reason``(负例点名),
found 用例另断言逐边 evidence + 深度 + 判定来源 + 置信度 + 环裁决审计。

刻意不做什么:不复制生产判据常量(一律经 ``__test__`` import 真源,§0.6);
不 mock 生产函数(测的是真实现);不引入第三方依赖(仅 pytest + 标准库)。
"""

from __future__ import annotations

import pytest

from app.core.ckg_relation import __test__, retrieve_relation

T = __test__


def _policy(**overrides):
    """构造合法 policy;overrides 用于制造缺键 / 越权 / 超限 / 环裁决档。"""
    base = {
        "max_allowed_depth": 4,
        "allowed_relation_kinds": ["calls", "inherits", "imports"],
    }
    base.update(overrides)
    return base


def _edge(src, dst, kind="calls", evidence="ast:ref"):
    """构造一条边;evidence 可传 None / 空白串制造缺证据形状。"""
    return {"src": src, "dst": dst, "kind": kind, "evidence": evidence}


def _graph(nodes, edges):
    return {"nodes": nodes, "edges": edges}


def _query(symbol="A", relation_kind="calls", max_depth=2):
    return {"symbol": symbol, "relation_kind": relation_kind, "max_depth": max_depth}


# 表驱动:覆盖单跳/多跳/多路径/缺节点/缺边证据/成环/超深/策略缺键/类型错/
# 空图/未知关系种类/重复边/符号不在图/无匹配边。verdict 与 reason_code 一律取 __test__ 真源。
CASES = [
    {
        "label": "单跳放行",
        "graph": _graph(["A", "B"], [_edge("A", "B", evidence="ast:L1")]),
        "query": _query(max_depth=1),
        "policy": _policy(),
        "verdict": T["VERDICT_FOUND"],
        "reason_code": T["REASON_FOUND"],
        "reason_contains": "带证据路径",
    },
    {
        "label": "多跳放行",
        "graph": _graph(["A", "B", "C"], [_edge("A", "B"), _edge("B", "C")]),
        "query": _query(max_depth=2),
        "policy": _policy(),
        "verdict": T["VERDICT_FOUND"],
        "reason_code": T["REASON_FOUND"],
        "reason_contains": "带证据路径",
    },
    {
        "label": "多路径放行",
        "graph": _graph(
            ["A", "B", "C", "D"],
            [_edge("A", "B"), _edge("A", "C"), _edge("B", "D")],
        ),
        "query": _query(max_depth=2),
        "policy": _policy(),
        "verdict": T["VERDICT_FOUND"],
        "reason_code": T["REASON_FOUND"],
        "reason_contains": "带证据路径",
    },
    {
        "label": "缺节点阻断",
        "graph": _graph(["A"], [_edge("A", "B")]),
        "query": _query(),
        "policy": _policy(),
        "verdict": T["VERDICT_UNJUDGED"],
        "reason_code": T["REASON_NODE_MISSING"],
        "reason_contains": "节点缺失",
    },
    {
        "label": "缺边证据None阻断",
        "graph": _graph(["A", "B"], [_edge("A", "B", evidence=None)]),
        "query": _query(),
        "policy": _policy(),
        "verdict": T["VERDICT_UNJUDGED"],
        "reason_code": T["REASON_EDGE_EVIDENCE_MISSING"],
        "reason_contains": "缺 evidence",
    },
    {
        "label": "缺边证据空串阻断",
        "graph": _graph(["A", "B"], [_edge("A", "B", evidence="  ")]),
        "query": _query(),
        "policy": _policy(),
        "verdict": T["VERDICT_UNJUDGED"],
        "reason_code": T["REASON_EDGE_EVIDENCE_MISSING"],
        "reason_contains": "缺 evidence",
    },
    {
        "label": "成环未裁决阻断",
        "graph": _graph(["A", "B"], [_edge("A", "B"), _edge("B", "A")]),
        "query": _query(max_depth=3),
        "policy": _policy(),
        "verdict": T["VERDICT_UNJUDGED"],
        "reason_code": T["REASON_CYCLE_UNADJUDICATED"],
        "reason_contains": "未显式裁决",
    },
    {
        "label": "成环显式拒绝",
        "graph": _graph(["A", "B"], [_edge("A", "B"), _edge("B", "A")]),
        "query": _query(max_depth=3),
        "policy": _policy(cycle_ruling="reject"),
        "verdict": T["VERDICT_DENIED"],
        "reason_code": T["REASON_CYCLE_REJECTED"],
        "reason_contains": "reject",
    },
    {
        "label": "成环显式截断",
        "graph": _graph(["A", "B"], [_edge("A", "B"), _edge("B", "A")]),
        "query": _query(max_depth=3),
        "policy": _policy(cycle_ruling="truncate"),
        "verdict": T["VERDICT_FOUND"],
        "reason_code": T["REASON_FOUND"],
        "reason_contains": "显式裁决",
    },
    {
        "label": "超深超限拒绝",
        "graph": _graph(["A", "B"], [_edge("A", "B")]),
        "query": _query(max_depth=9),
        "policy": _policy(max_allowed_depth=4),
        "verdict": T["VERDICT_DENIED"],
        "reason_code": T["REASON_MAX_DEPTH_EXCEEDED"],
        "reason_contains": "超限",
    },
    {
        "label": "策略缺max_allowed_depth",
        "graph": _graph(["A", "B"], [_edge("A", "B")]),
        "query": _query(),
        "policy": {"allowed_relation_kinds": ["calls"]},
        "verdict": T["VERDICT_UNJUDGED"],
        "reason_code": T["REASON_POLICY_KEY_MISSING"],
        "reason_contains": "max_allowed_depth",
    },
    {
        "label": "策略缺allowed_relation_kinds",
        "graph": _graph(["A", "B"], [_edge("A", "B")]),
        "query": _query(),
        "policy": {"max_allowed_depth": 4},
        "verdict": T["VERDICT_UNJUDGED"],
        "reason_code": T["REASON_POLICY_KEY_MISSING"],
        "reason_contains": "allowed_relation_kinds",
    },
    {
        "label": "类型错max_depth字符串",
        "graph": _graph(["A", "B"], [_edge("A", "B")]),
        "query": _query(max_depth="3"),
        "policy": _policy(),
        "verdict": T["VERDICT_UNJUDGED"],
        "reason_code": T["REASON_SHAPE_UNRECOGNIZED"],
        "reason_contains": "形状不认",
    },
    {
        "label": "类型错graph非对象",
        "graph": ["A", "B"],
        "query": _query(),
        "policy": _policy(),
        "verdict": T["VERDICT_UNJUDGED"],
        "reason_code": T["REASON_SHAPE_UNRECOGNIZED"],
        "reason_contains": "graph",
    },
    {
        "label": "空图显式未命中",
        "graph": _graph([], []),
        "query": _query(),
        "policy": _policy(),
        "verdict": T["VERDICT_NOT_FOUND"],
        "reason_code": T["REASON_SYMBOL_NOT_IN_GRAPH"],
        "reason_contains": "不在 graph.nodes",
    },
    {
        "label": "未知关系种类越权",
        "graph": _graph(["A", "B"], [_edge("A", "B")]),
        "query": _query(relation_kind="owns"),
        "policy": _policy(),
        "verdict": T["VERDICT_DENIED"],
        "reason_code": T["REASON_RELATION_KIND_DENIED"],
        "reason_contains": "越权",
    },
    {
        "label": "重复边折叠",
        "graph": _graph(
            ["A", "B"],
            [_edge("A", "B", evidence="ast:L1"), _edge("A", "B", evidence="ast:L1")],
        ),
        "query": _query(max_depth=1),
        "policy": _policy(),
        "verdict": T["VERDICT_FOUND"],
        "reason_code": T["REASON_FOUND"],
        "reason_contains": "带证据路径",
    },
    {
        "label": "符号不在图",
        "graph": _graph(["B", "C"], [_edge("B", "C")]),
        "query": _query(symbol="Z"),
        "policy": _policy(),
        "verdict": T["VERDICT_NOT_FOUND"],
        "reason_code": T["REASON_SYMBOL_NOT_IN_GRAPH"],
        "reason_contains": "不在 graph.nodes",
    },
    {
        "label": "无匹配边显式未命中",
        "graph": _graph(["A", "B"], [_edge("A", "B", kind="inherits")]),
        "query": _query(relation_kind="calls"),
        "policy": _policy(),
        "verdict": T["VERDICT_NOT_FOUND"],
        "reason_code": T["REASON_NO_EVIDENCE_PATH"],
        "reason_contains": "未找到带证据路径",
    },
]


@pytest.mark.parametrize("case", CASES, ids=[c["label"] for c in CASES])
def test_table_driven(case):
    """表驱动:每例断言结构化 verdict / reason_code / reason(负例点名),基础键恒定。"""
    result = retrieve_relation(case["graph"], case["query"], case["policy"])
    assert isinstance(result, dict)
    for key in (
        "verdict",
        "reason",
        "reason_code",
        "source",
        "symbol",
        "relation_kind",
        "max_depth",
    ):
        assert key in result
    assert result["verdict"] == case["verdict"]
    assert result["reason_code"] == case["reason_code"]
    assert case["reason_contains"] in result["reason"]


def test_found_evidence_chain():
    """found 的逐边证据链:evidence + depth + source + admitted_by + 置信度。"""
    result = retrieve_relation(
        _graph(["A", "B"], [_edge("A", "B", evidence="ast:L7")]),
        _query(max_depth=1),
        _policy(),
    )
    assert result["verdict"] == T["VERDICT_FOUND"]
    assert result["path_count"] == 1
    path = result["paths"][0]
    assert path["nodes"] == ("A", "B")
    assert path["depth"] == 1
    assert path["confidence"] == T["confidence_for_depth"](1)
    assert path["confidence_basis"] == "depth_decay"
    assert path["source"] == "ckg_relation.retrieve_relation"
    assert len(path["edges"]) == 1
    edge = path["edges"][0]
    assert edge["evidence"] == "ast:L7"
    assert edge["depth"] == 1
    assert edge["source"] == "graph.edge"
    assert edge["admitted_by"] == "evidence_gate+kind_match+depth_bound"
    assert result["confidence"] == path["confidence"]


def test_multi_path_enumerated_and_deterministic():
    """多路径:条数精确、每条带证据链、整体置信度取最高、两次调用结果一致。"""
    graph = _graph(
        ["A", "B", "C", "D"],
        [_edge("A", "B"), _edge("A", "C"), _edge("B", "D")],
    )
    query = _query(max_depth=2)
    policy = _policy()
    first = retrieve_relation(graph, query, policy)
    second = retrieve_relation(graph, query, policy)
    assert first == second  # 纯函数 + 确定性排序
    assert first["path_count"] == 3
    assert first["confidence"] == max(p["confidence"] for p in first["paths"])
    assert [p["depth"] for p in first["paths"]] == [1, 1, 2]
    for path in first["paths"]:
        assert len(path["edges"]) == path["depth"]
        for index, edge in enumerate(path["edges"], start=1):
            assert edge["depth"] == index
            assert edge["admitted_by"]


def test_cycle_truncate_is_audited_not_silent():
    """成环 truncate:found 且裁决逐条入审计,绝不静默截断当没找到。"""
    result = retrieve_relation(
        _graph(["A", "B"], [_edge("A", "B"), _edge("B", "A")]),
        _query(max_depth=3),
        _policy(cycle_ruling="truncate"),
    )
    assert result["verdict"] == T["VERDICT_FOUND"]
    assert result["cycle_ruling_applied"] == "truncate"
    assert len(result["cycles_adjudicated"]) == 1
    audit = result["cycles_adjudicated"][0]
    assert audit["via_edge"] == {"src": "B", "dst": "A", "kind": "calls"}
    assert audit["ruling"] == "truncate"
    assert audit["ruling_source"] == "policy.cycle_ruling"
    assert "显式裁决" in result["reason"]


def test_duplicate_edges_collapsed():
    """重复边折叠出声:计数字段 + 路径唯一。"""
    result = retrieve_relation(
        _graph(["A", "B"], [_edge("A", "B"), _edge("A", "B")]),
        _query(max_depth=1),
        _policy(),
    )
    assert result["verdict"] == T["VERDICT_FOUND"]
    assert result["duplicate_edges_collapsed"] == 1
    assert result["path_count"] == 1


def test_confidence_depth_decay_pure():
    """置信度衰减是确定性纯函数(import 真源,不复制公式,§0.6)。"""
    fn = T["confidence_for_depth"]
    decay = T["DEPTH_DECAY"]
    assert fn(1) == 1.0
    assert fn(2) == round(decay, 4)
    assert fn(3) == round(decay**2, 4)
    assert fn(2) == fn(2)


def test_unjudged_never_green_and_reason_names_cause():
    """未判定绝不读成绿:unjudged 不带 found 放行字段,reason 点名原因。"""
    result = retrieve_relation(
        _graph(["A"], [_edge("A", "B")]),
        _query(),
        _policy(),
    )
    assert result["verdict"] == T["VERDICT_UNJUDGED"]
    assert result["reason_code"] == T["REASON_NODE_MISSING"]
    assert "paths" not in result  # 阻断不带放行证据链
    assert "节点缺失" in result["reason"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
