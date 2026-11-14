# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/ckg_relation.py
"""CKG 代码知识图谱**关系检索判据层**(round 9 能力复现,对位 Qoder/Trae 的
CKG relationship retrieval;本仓现读 `ckg_relation` / `retrieve_relation` 零命中)。

立因
----
对照程序只做「图检索」:给一个符号与关系种类,沿边找可达节点,命中即返回。
本仓此前无此判据层。按 §0.12 用本仓栈复现其行为与设计,写自己的代码,测试钉住。

判据(单一真相源;判定顺序 = 阻断优先于放行)
------------------------------------------
1. 形状不认(graph / query / policy)⇒ ``unjudged``(阻断,点名 reason);
2. 边端点未在 ``graph.nodes`` 声明 ⇒ ``unjudged``(节点缺失,拒绝隐式补全);
3. 边缺 ``evidence`` ⇒ ``unjudged``:缺证据的边既不参与推断,也不静默忽略;
4. 越权(``relation_kind`` 不在 policy 白名单)/ 超限(``max_depth`` 超策略上限)⇒ ``denied``;
5. 起点不在图中 ⇒ ``not_found``(显式,不推断);
6. 成环:检索命中的回边必须显式裁决 —— 未裁决 ⇒ ``unjudged``、``reject`` ⇒ ``denied``、
   ``truncate`` ⇒ 记入可审计证据链后继续;绝不静默截断当「没找到」(§0.3);
7. 找到 ≥1 条带证据路径 ⇒ ``found``(证据链 + 置信度);否则 ``not_found``。

刻意不做什么
------------
- 不抛异常:一律返回结构化 verdict,「没判」显式成 ``unjudged``,不记绿也不冒红;
- 不隐式补全:缺键 / 缺节点 / 缺证据 / 形状不认一律阻断,不猜默认值;
- 不复制判据:常量与纯函数集中在 ``__test__`` 单一出口,测试 import 真源(§0.6);
- 零第三方依赖(纯 Python 标准库);入参只读,不修改调用方对象。

超越轴
------
对照只有「图检索结果」;本仓额外输出可审计证据链(逐边 evidence + 深度 +
判定来源 admitted_by/source + 置信度衰减依据 + 环裁决审计 + 重复边折叠计数),
把「缺证据 / 成环 / 形状不认」从静默放行或静默截断升级为显式阻断,拒绝任何
隐式补全,失效方向恒为「多要一次定向说明」(§0.10)。
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

__all__ = [
    "retrieve_relation",
]

# ---- verdict 与 reason_code 常量(单一真相源;测试经 __test__ import,不复制) ----
VERDICT_FOUND = "found"
VERDICT_NOT_FOUND = "not_found"
VERDICT_UNJUDGED = "unjudged"
VERDICT_DENIED = "denied"

REASON_FOUND = "found"
REASON_NO_EVIDENCE_PATH = "no_evidence_path"
REASON_SYMBOL_NOT_IN_GRAPH = "symbol_not_in_graph"
REASON_SHAPE_UNRECOGNIZED = "shape_unrecognized"
REASON_POLICY_KEY_MISSING = "policy_key_missing"
REASON_NODE_MISSING = "node_missing"
REASON_EDGE_EVIDENCE_MISSING = "edge_evidence_missing"
REASON_CYCLE_UNADJUDICATED = "cycle_unadjudicated"
REASON_CYCLE_REJECTED = "cycle_rejected"
REASON_RELATION_KIND_DENIED = "relation_kind_denied"
REASON_MAX_DEPTH_EXCEEDED = "max_depth_exceeded"

#: policy 必需键:缺任一即 unjudged(不猜默认值)。
POLICY_REQUIRED_KEYS = ("max_allowed_depth", "allowed_relation_kinds")
#: 成环的合法显式裁决档;其余值(含缺失)一律视作「环未裁决」。
CYCLE_RULINGS = {"reject", "truncate"}

_SEQUENCE_TYPES = (list, tuple)
_KINDS_CONTAINERS = (list, tuple, set, frozenset)

_DEPTH_DECAY = 0.9
_SOURCE = "ckg_relation.retrieve_relation"


def _is_seq(value: Any) -> bool:
    """序列判定(list / tuple);字符串不当序列用。"""
    return isinstance(value, _SEQUENCE_TYPES)


def _is_blank(value: Any) -> bool:
    """证据空判定:None 或空白字符串视为缺证据;其余非空值视为有证据。"""
    return value is None or (isinstance(value, str) and not value.strip())


def _is_positive_int(value: Any) -> bool:
    """正整数判定(排除 bool —— bool 是 int 子类,不可当深度)。"""
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def _confidence_for_depth(depth: int) -> float:
    """逐跳衰减置信度:depth=1 → 1.0, depth=2 → 0.9 ... 保留 4 位,确定性纯函数。"""
    return round(_DEPTH_DECAY ** (depth - 1), 4)


def _check_graph_shape(graph: Any) -> tuple[str, str] | None:
    """graph 形状校验;返回 (reason, reason_code) 或 None(通过)。"""
    if not isinstance(graph, Mapping):
        return ("graph 不是对象(应为 dict)", REASON_SHAPE_UNRECOGNIZED)
    for key in ("nodes", "edges"):
        if key not in graph:
            return (f"graph 缺必需键 {key!r}(形状不认)", REASON_SHAPE_UNRECOGNIZED)
    nodes, edges = graph["nodes"], graph["edges"]
    if not _is_seq(nodes) or not _is_seq(edges):
        return ("graph.nodes / graph.edges 形状不认(应为序列)", REASON_SHAPE_UNRECOGNIZED)
    if not all(isinstance(node, str) for node in nodes):
        return ("graph.nodes 含非字符串节点(节点以字符串标识)", REASON_SHAPE_UNRECOGNIZED)
    for index, edge in enumerate(edges):
        if not isinstance(edge, Mapping):
            return (f"graph.edges[{index}] 不是对象(形状不认)", REASON_SHAPE_UNRECOGNIZED)
        for key in ("src", "dst", "kind"):
            if not isinstance(edge.get(key), str):
                return (
                    f"graph.edges[{index}] 的 {key!r} 缺失或非字符串(形状不认)",
                    REASON_SHAPE_UNRECOGNIZED,
                )
    return None


def _check_query_shape(query: Any) -> tuple[str, str] | None:
    """query 形状校验。"""
    if not isinstance(query, Mapping):
        return ("query 不是对象(应为 dict)", REASON_SHAPE_UNRECOGNIZED)
    for key in ("symbol", "relation_kind", "max_depth"):
        if key not in query:
            return (f"query 缺必需键 {key!r}(形状不认)", REASON_SHAPE_UNRECOGNIZED)
    if not isinstance(query["symbol"], str) or not query["symbol"].strip():
        return ("query.symbol 形状不认(应为非空字符串)", REASON_SHAPE_UNRECOGNIZED)
    if not isinstance(query["relation_kind"], str) or not query["relation_kind"].strip():
        return ("query.relation_kind 形状不认(应为非空字符串)", REASON_SHAPE_UNRECOGNIZED)
    if not _is_positive_int(query["max_depth"]):
        return ("query.max_depth 形状不认(应为 ≥1 的整数)", REASON_SHAPE_UNRECOGNIZED)
    return None


def _check_policy_shape(policy: Any) -> tuple[str, str] | None:
    """policy 形状校验;缺必需键单列 reason_code(策略缺键),其余形状问题不猜默认值。"""
    if not isinstance(policy, Mapping):
        return ("policy 不是对象(应为 dict)", REASON_SHAPE_UNRECOGNIZED)
    missing = [key for key in POLICY_REQUIRED_KEYS if key not in policy]
    if missing:
        return (f"policy 缺必需键 {missing}(不猜默认值 / 不隐式补全,§0.3)", REASON_POLICY_KEY_MISSING)
    if not _is_positive_int(policy["max_allowed_depth"]):
        return ("policy.max_allowed_depth 形状不认(应为正整数)", REASON_SHAPE_UNRECOGNIZED)
    kinds = policy["allowed_relation_kinds"]
    if not isinstance(kinds, _KINDS_CONTAINERS) or not all(isinstance(k, str) for k in kinds):
        return ("policy.allowed_relation_kinds 形状不认(应为字符串集合/序列)", REASON_SHAPE_UNRECOGNIZED)
    return None


def _verdict(
    state: str,
    reason: str,
    reason_code: str,
    context: Mapping[str, Any],
    **extra: Any,
) -> dict[str, Any]:
    """统一 verdict 构造:基础字段恒定,专有字段经 extra 注入,绝不抛异常文本。"""
    result: dict[str, Any] = {
        "verdict": state,
        "reason": reason,
        "reason_code": reason_code,
        "symbol": context.get("symbol"),
        "relation_kind": context.get("relation_kind"),
        "max_depth": context.get("max_depth"),
        "source": _SOURCE,
    }
    result.update(extra)
    return result


def _edge_record(edge: Mapping[str, Any], depth: int) -> dict[str, Any]:
    """单条边的证据链记录:逐边 evidence + 深度 + 判定来源(超越轴)。"""
    return {
        "src": edge["src"],
        "dst": edge["dst"],
        "kind": edge["kind"],
        "evidence": edge.get("evidence"),
        "depth": depth,
        "source": "graph.edge",
        "admitted_by": "evidence_gate+kind_match+depth_bound",
    }


def _build_outgoing(
    edges: Any, relation_kind: str
) -> tuple[dict[str, list[Mapping[str, Any]]], int]:
    """按 (src,dst,kind) 折叠重复声明;只把匹配 relation_kind 的边挂到出边表。"""
    seen: set[tuple[str, str, str]] = set()
    outgoing: dict[str, list[Mapping[str, Any]]] = {}
    duplicates = 0
    for edge in edges:
        key = (edge["src"], edge["dst"], edge["kind"])
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        if edge["kind"] == relation_kind:
            outgoing.setdefault(edge["src"], []).append(edge)
    return outgoing, duplicates


def _enumerate(
    symbol: str, max_depth: int, outgoing: dict[str, list[Mapping[str, Any]]]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """枚举从 symbol 出发的所有非空简单路径(边已按 kind 过滤)。

    回边(dst 已在当前路径)只**记录成 cycle_hits**,绝不沿走、绝不静默丢弃:
    主函数必须对每一条命中作显式裁决(§0.3 不静默截断当没找到)。
    """
    paths: list[dict[str, Any]] = []
    cycle_hits: list[dict[str, Any]] = []
    stack = [(symbol, (symbol,), ())]
    while stack:
        node, node_path, edge_path = stack.pop()
        for edge in outgoing.get(node, ()):
            if _is_blank(edge.get("evidence")):
                continue  # 缺证据的边不参与推断(第二道;形状校验已先行阻断)
            dst = edge["dst"]
            if dst in node_path:
                cycle_hits.append(
                    {
                        "src": edge["src"],
                        "dst": dst,
                        "kind": edge["kind"],
                        "at_path": node_path,
                        "at_depth": len(edge_path) + 1,
                    }
                )
                continue
            new_edges = edge_path + (_edge_record(edge, len(edge_path) + 1),)
            paths.append(
                {"nodes": node_path + (dst,), "edges": new_edges, "depth": len(new_edges)}
            )
            if len(new_edges) < max_depth:
                stack.append((dst, node_path + (dst,), new_edges))
    return paths, cycle_hits


def _audit_cycles(cycle_hits: list[dict[str, Any]], ruling: Any) -> list[dict[str, Any]]:
    """把回边命中转成可审计裁决条目(逐条点名路径/深度/裁决来源)。"""
    return [
        {
            "via_edge": {"src": hit["src"], "dst": hit["dst"], "kind": hit["kind"]},
            "at_path": list(hit["at_path"]),
            "at_depth": hit["at_depth"],
            "ruling": ruling,
            "ruling_source": "policy.cycle_ruling",
            "reason": "回边命中当前路径节点 ⇒ 成环,按策略显式裁决(不静默截断)",
        }
        for hit in cycle_hits
    ]


def retrieve_relation(graph: Any, query: Any, policy: Any) -> dict[str, Any]:
    """CKG 关系检索主入口(纯函数):形状 → 完整性 → 越权/超限 → 检索裁决。

    ``graph`` = ``{nodes: [str...], edges: [{src,dst,kind,evidence}...]}``;
    ``query`` = ``{symbol, relation_kind, max_depth}``;
    ``policy`` 至少含 ``max_allowed_depth`` 与 ``allowed_relation_kinds``,
    可选 ``cycle_ruling``(``reject`` / ``truncate``)对成环作显式裁决。
    返回结构化 verdict:found / not_found / unjudged / denied,绝不抛异常。
    """
    problem = _check_graph_shape(graph)
    if problem:
        return _verdict(VERDICT_UNJUDGED, problem[0], problem[1], {})
    problem = _check_query_shape(query)
    if problem:
        return _verdict(VERDICT_UNJUDGED, problem[0], problem[1], {})
    problem = _check_policy_shape(policy)
    if problem:
        return _verdict(VERDICT_UNJUDGED, problem[0], problem[1], {})

    symbol = query["symbol"]
    relation_kind = query["relation_kind"]
    max_depth = query["max_depth"]
    base = {"symbol": symbol, "relation_kind": relation_kind, "max_depth": max_depth}

    nodes = graph["nodes"]
    edges = graph["edges"]
    node_set = frozenset(nodes)

    # 逐边完整性:缺证据 / 端点未声明 —— 都不隐式补全,整次阻断(§0.3/§0.10)。
    for index, edge in enumerate(edges):
        src, dst = edge["src"], edge["dst"]
        if _is_blank(edge.get("evidence")):
            reason = (
                f"graph.edges[{index}] 缺 evidence(src={src!r} dst={dst!r}):"
                "缺证据的边不参与推断,也不静默忽略 ⇒ 整次阻断,拒绝隐式补全"
            )
            return _verdict(
                VERDICT_UNJUDGED, reason, REASON_EDGE_EVIDENCE_MISSING, base
            )
        if src not in node_set or dst not in node_set:
            reason = (
                f"graph.edges[{index}] 端点未声明(src={src!r} dst={dst!r}):"
                "节点缺失,不把未声明节点隐式补进 graph.nodes ⇒ 阻断"
            )
            return _verdict(VERDICT_UNJUDGED, reason, REASON_NODE_MISSING, base)

    allowlist = frozenset(policy["allowed_relation_kinds"])
    depth_limit = policy["max_allowed_depth"]
    if relation_kind not in allowlist:
        reason = f"关系种类 {relation_kind!r} 不在 policy.allowed_relation_kinds 白名单(越权)"
        return _verdict(VERDICT_DENIED, reason, REASON_RELATION_KIND_DENIED, base)
    if max_depth > depth_limit:
        reason = f"query.max_depth={max_depth} 超过 policy.max_allowed_depth={depth_limit}(超限)"
        return _verdict(VERDICT_DENIED, reason, REASON_MAX_DEPTH_EXCEEDED, base)

    # 起点不在图中:显式 not_found,不推断、不隐式补节点。
    if symbol not in node_set:
        reason = f"起点符号 {symbol!r} 不在 graph.nodes(显式未命中,不推断)"
        return _verdict(VERDICT_NOT_FOUND, reason, REASON_SYMBOL_NOT_IN_GRAPH, base)

    outgoing, duplicates = _build_outgoing(edges, relation_kind)
    paths, cycle_hits = _enumerate(symbol, max_depth, outgoing)

    cycle_ruling = policy.get("cycle_ruling")
    ruling_valid = isinstance(cycle_ruling, str) and cycle_ruling in CYCLE_RULINGS
    # 成环必须显式裁决:命中回边却无合法裁决 ⇒ 阻断(不得静默截断当没找到)。
    if cycle_hits and not ruling_valid:
        reason = (
            f"检索遇到 {len(cycle_hits)} 条回边(成环),但 policy.cycle_ruling 未显式裁决"
            f"(值={cycle_ruling!r})⇒ 阻断,不得静默截断当没找到"
        )
        return _verdict(
            VERDICT_UNJUDGED,
            reason,
            REASON_CYCLE_UNADJUDICATED,
            base,
            cycles_adjudicated=_audit_cycles(cycle_hits, cycle_ruling),
        )
    if cycle_hits and cycle_ruling == "reject":
        reason = f"检索遇到 {len(cycle_hits)} 条回边(成环),policy.cycle_ruling='reject' 显式拒绝"
        return _verdict(
            VERDICT_DENIED,
            reason,
            REASON_CYCLE_REJECTED,
            base,
            cycles_adjudicated=_audit_cycles(cycle_hits, cycle_ruling),
        )

    # 裁决为 truncate(或无环):显式记录每一条环裁决进证据链,绝不静默。
    cycles_adjudicated = _audit_cycles(cycle_hits, cycle_ruling) if cycle_hits else []
    enriched = []
    for path in paths:
        depth = path["depth"]
        enriched.append(
            {
                "nodes": path["nodes"],
                "edges": path["edges"],
                "depth": depth,
                "confidence": _confidence_for_depth(depth),
                "confidence_basis": "depth_decay",
                "source": _SOURCE,
            }
        )
    enriched.sort(key=lambda item: (item["depth"], item["nodes"]))

    audit = {
        "cycles_adjudicated": cycles_adjudicated,
        "cycle_ruling_applied": cycle_ruling if cycle_hits else None,
        "duplicate_edges_collapsed": duplicates,
    }
    if not enriched:
        reason = (
            f"从 {symbol!r} 沿 {relation_kind!r} 在深度 ≤ {max_depth} 内未找到带证据路径"
            "(显式未命中,不推断边界外)"
        )
        if cycles_adjudicated:
            reason += (
                f";成环已按 'truncate' 显式裁决并记入审计({len(cycles_adjudicated)} 条),非静默截断"
            )
        return _verdict(
            VERDICT_NOT_FOUND,
            reason,
            REASON_NO_EVIDENCE_PATH,
            base,
            paths=[],
            path_count=0,
            confidence=0.0,
            **audit,
        )

    confidence = max(item["confidence"] for item in enriched)
    reason = (
        f"从 {symbol!r} 沿 {relation_kind!r} 在深度 ≤ {max_depth} 内找到 {len(enriched)} 条"
        "带证据路径(逐边 evidence+深度+判定来源可审计)"
    )
    if cycles_adjudicated:
        reason += f";成环已按 'truncate' 显式裁决({len(cycles_adjudicated)} 条)"
    return _verdict(
        VERDICT_FOUND,
        reason,
        REASON_FOUND,
        base,
        paths=enriched,
        path_count=len(enriched),
        confidence=confidence,
        **audit,
    )


#: 单一真相源出口:测试 import 真源(常量 / 纯函数),禁止复制判据(§0.6)。
__test__ = {
    "VERDICT_FOUND": VERDICT_FOUND,
    "VERDICT_NOT_FOUND": VERDICT_NOT_FOUND,
    "VERDICT_UNJUDGED": VERDICT_UNJUDGED,
    "VERDICT_DENIED": VERDICT_DENIED,
    "REASON_FOUND": REASON_FOUND,
    "REASON_NO_EVIDENCE_PATH": REASON_NO_EVIDENCE_PATH,
    "REASON_SYMBOL_NOT_IN_GRAPH": REASON_SYMBOL_NOT_IN_GRAPH,
    "REASON_SHAPE_UNRECOGNIZED": REASON_SHAPE_UNRECOGNIZED,
    "REASON_POLICY_KEY_MISSING": REASON_POLICY_KEY_MISSING,
    "REASON_NODE_MISSING": REASON_NODE_MISSING,
    "REASON_EDGE_EVIDENCE_MISSING": REASON_EDGE_EVIDENCE_MISSING,
    "REASON_CYCLE_UNADJUDICATED": REASON_CYCLE_UNADJUDICATED,
    "REASON_CYCLE_REJECTED": REASON_CYCLE_REJECTED,
    "REASON_RELATION_KIND_DENIED": REASON_RELATION_KIND_DENIED,
    "REASON_MAX_DEPTH_EXCEEDED": REASON_MAX_DEPTH_EXCEEDED,
    "POLICY_REQUIRED_KEYS": POLICY_REQUIRED_KEYS,
    "CYCLE_RULINGS": CYCLE_RULINGS,
    "DEPTH_DECAY": _DEPTH_DECAY,
    "confidence_for_depth": _confidence_for_depth,
    "is_blank": _is_blank,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
