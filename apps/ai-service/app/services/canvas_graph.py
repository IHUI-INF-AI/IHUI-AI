# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent Canvas 整图 DAG 动态构图服务(P0 编排端点)。

职责:
- 校验画布 DAG(节点 id 唯一 / 边引用有效 / 无环,拓扑排序检测)。
- 按节点定义动态构建 LangGraph StateGraph:
  - 节点名严格使用 dag.nodes[].id,保证 SSE node_start/node_end/state_update
    事件的 nodeId 与前端画布节点对齐(见 canvas-api.ts 契约注释)。
  - agent 节点调用 llm_gateway.complete;tool 节点模拟执行输出;
    human-review 节点在有 checkpointer 时通过 interrupt() 暂停(HITL),
    无 checkpointer 时自动放行(保证整图可跑通)。
  - 任一节点失败 → 写入 error 状态,下游节点检测到后标记 skipped 跳过。
- 模块级注册表:threadId → 已编译 canvas 图,供 /stream 端点按 threadId 取图执行。
"""

from __future__ import annotations

import logging
from collections import OrderedDict
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from app.core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "stepfun/step-3.7-flash"

# 允许的画布节点类型(对齐前端 CanvasNodeType)
_CANVAS_NODE_TYPES = {"agent", "tool", "human-review"}


class CanvasState(TypedDict, total=False):
    """canvas 图共享状态(每节点执行后覆写对应字段)。"""

    input: str
    stdout: str
    stderr: str
    exitCode: int | None
    status: str
    error: str | None


# ----------------------------------------------------------------------
# DAG 校验 + 拓扑排序
# ----------------------------------------------------------------------


def validate_canvas_dag(dag: dict[str, Any]) -> list[str]:
    """校验画布 DAG,返回错误列表(空列表 = 通过)。"""
    errors: list[str] = []
    if not isinstance(dag, dict):
        return ["dag 必须是 JSON 对象"]

    nodes = dag.get("nodes")
    if not isinstance(nodes, list) or not nodes:
        return ["dag.nodes 必须是非空数组"]

    node_ids: set[str] = set()
    for i, node in enumerate(nodes):
        if not isinstance(node, dict):
            errors.append(f"nodes[{i}] 必须是对象")
            continue
        node_id = node.get("id")
        if not isinstance(node_id, str) or not node_id.strip():
            errors.append(f"nodes[{i}].id 必须是非空字符串")
        elif node_id in node_ids:
            errors.append(f"节点 id 重复: {node_id}")
        else:
            node_ids.add(node_id)
        if node.get("type") not in _CANVAS_NODE_TYPES:
            errors.append(f"nodes[{i}].type 非法: {node.get('type')!r}")

    edges = dag.get("edges", [])
    if not isinstance(edges, list):
        errors.append("dag.edges 必须是数组")
        return errors
    for i, edge in enumerate(edges):
        if not isinstance(edge, dict):
            errors.append(f"edges[{i}] 必须是对象")
            continue
        if edge.get("source") not in node_ids:
            errors.append(f"edges[{i}].source 引用了不存在的节点: {edge.get('source')!r}")
        if edge.get("target") not in node_ids:
            errors.append(f"edges[{i}].target 引用了不存在的节点: {edge.get('target')!r}")

    if not errors and _topological_order(nodes, edges) is None:
        errors.append("DAG 存在环,无法拓扑排序")
    return errors


def _topological_order(
    nodes: list[dict[str, Any]], edges: list[dict[str, Any]]
) -> list[str] | None:
    """Kahn 拓扑排序;存在环返回 None。"""
    ids = [n["id"] for n in nodes if isinstance(n, dict) and isinstance(n.get("id"), str)]
    indegree: dict[str, int] = dict.fromkeys(ids, 0)
    adjacency: dict[str, list[str]] = {i: [] for i in ids}
    for edge in edges:
        src, dst = edge.get("source"), edge.get("target")
        if src in adjacency and dst in indegree:
            adjacency[src].append(dst)
            indegree[dst] += 1
    queue = sorted(i for i, d in indegree.items() if d == 0)
    order: list[str] = []
    while queue:
        current = queue.pop(0)
        order.append(current)
        for nxt in adjacency[current]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)
    if len(order) != len(ids):
        return None
    return order


# ----------------------------------------------------------------------
# 节点执行函数(agent / tool / human-review)
# ----------------------------------------------------------------------


async def _run_agent_node(
    node_id: str,
    name: str,
    params: dict[str, Any],
    state: CanvasState,
) -> dict[str, Any]:
    """agent 节点:基于技能与输入(含上游 stdout)调用 LLM。"""
    skill = str(params.get("skill") or "").strip()
    node_input = str(params.get("input") or "").strip()
    upstream = str(state.get("stdout") or "").strip()
    user_input = node_input or upstream or str(state.get("input") or "")

    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": (
                f"你是画布任务「{name}」的执行智能体"
                + (f",使用技能 {skill}" if skill else "")
                + "。请基于给定输入完成子任务,只输出结果本身。"
            ),
        },
        {"role": "user", "content": user_input or "请基于画布上下文完成任务。"},
    ]
    try:
        result = await llm_gateway.complete(messages, model=_DEFAULT_MODEL)
        content = result.get("content", "") if isinstance(result, dict) else str(result)
        return {"stdout": str(content).strip(), "exitCode": 0, "status": "success"}
    except Exception as e:
        logger.warning("canvas agent 节点 %s 执行失败: %s", node_id, e)
        return {
            "stderr": str(e),
            "exitCode": 1,
            "status": "failed",
            "error": f"{node_id}: {e}",
        }


def _run_tool_node(
    node_id: str,
    name: str,
    params: dict[str, Any],
    state: CanvasState,
) -> dict[str, Any]:
    """tool 节点:模拟工具执行输出(真实 MCP 工具调用为后续迭代范围)。"""
    tool = str(params.get("tool") or "shell")
    node_input = str(params.get("input") or "").strip()
    upstream = str(state.get("stdout") or "").strip()
    payload = node_input or upstream
    stdout = f"[tool:{tool}] {name} 执行完成" + (f"\n输入: {payload}" if payload else "")
    return {"stdout": stdout, "exitCode": 0, "status": "success"}


async def _run_review_node(
    node_id: str,
    name: str,
    params: dict[str, Any],
    *,
    can_interrupt: bool,
) -> dict[str, Any]:
    """human-review 节点:有 checkpointer 时 interrupt() 暂停等待人工审核。

    无 checkpointer 时 interrupt 不可恢复,自动放行保证整图跑通。
    """
    prompt = str(params.get("prompt") or "").strip()
    if can_interrupt:
        # resume 后 interrupt() 返回恢复值(审核结论)
        decision = interrupt({"nodeId": node_id, "name": name, "prompt": prompt})
        return {
            "stdout": f"人工审核通过: {decision if decision is not None else 'approved'}",
            "exitCode": 0,
            "status": "success",
        }
    return {
        "stdout": f"自动放行(无 checkpointer,无法暂停): {prompt}",
        "exitCode": 0,
        "status": "success",
    }


def _make_node_fn(
    node: dict[str, Any],
    *,
    can_interrupt: bool,
) -> Any:
    """为单个画布节点生成 LangGraph 节点函数(闭包烘焙节点参数)。"""
    node_id = node["id"]
    node_type = node.get("type", "agent")
    name = str(node.get("name") or node_id)
    raw_params = node.get("params")
    params: dict[str, Any] = raw_params if isinstance(raw_params, dict) else {}

    async def node_fn(state: CanvasState) -> dict[str, Any]:
        # 上游有节点失败 → 本节点(及后续全部)跳过
        if state.get("error"):
            return {"status": "skipped", "stdout": "", "exitCode": None}
        if node_type == "agent":
            return await _run_agent_node(node_id, name, params, state)
        if node_type == "tool":
            return _run_tool_node(node_id, name, params, state)
        return await _run_review_node(node_id, name, params, can_interrupt=can_interrupt)

    return node_fn


# ----------------------------------------------------------------------
# 动态构图
# ----------------------------------------------------------------------


def build_canvas_graph(dag: dict[str, Any], *, checkpointer: Any = None) -> Any:
    """按画布 DAG 动态构建并编译 LangGraph。

    - 节点名 = dag.nodes[].id(SSE nodeId 对齐契约)。
    - 入口 = 无入边节点(START → node);出口 = 无出边节点(node → END)。
    - 孤立节点同时接 START 与 END。
    """
    nodes: list[dict[str, Any]] = dag["nodes"]
    edges: list[dict[str, Any]] = dag.get("edges", []) or []
    can_interrupt = checkpointer is not None

    graph = StateGraph(CanvasState)
    for node in nodes:
        graph.add_node(node["id"], _make_node_fn(node, can_interrupt=can_interrupt))

    targets = {e["target"] for e in edges}
    sources = {e["source"] for e in edges}
    for node in nodes:
        node_id = node["id"]
        if node_id not in targets:
            graph.add_edge(START, node_id)
        if node_id not in sources:
            graph.add_edge(node_id, END)
    for edge in edges:
        graph.add_edge(edge["source"], edge["target"])

    if checkpointer is not None:
        return graph.compile(checkpointer=checkpointer)
    return graph.compile()


# ----------------------------------------------------------------------
# threadId → canvas 图注册表(容量受限,LRU 淘汰)
# ----------------------------------------------------------------------

_MAX_REGISTRY_SIZE = 64

_canvas_graph_registry: OrderedDict[str, dict[str, Any]] = OrderedDict()


def register_canvas_graph(thread_id: str, graph: Any, *, input_: str | None = None) -> None:
    """注册已编译 canvas 图(threadId → {graph, input}),超出容量淘汰最旧。"""
    _canvas_graph_registry[thread_id] = {"graph": graph, "input": input_}
    _canvas_graph_registry.move_to_end(thread_id)
    while len(_canvas_graph_registry) > _MAX_REGISTRY_SIZE:
        evicted, _ = _canvas_graph_registry.popitem(last=False)
        logger.info("canvas 图注册表容量淘汰 thread=%s", evicted)


def get_canvas_graph_entry(thread_id: str) -> dict[str, Any] | None:
    """获取 canvas 图注册项({graph, input});未注册返回 None(调用方降级默认图)。"""
    entry = _canvas_graph_registry.get(thread_id)
    if entry is not None:
        _canvas_graph_registry.move_to_end(thread_id)
    return entry


def remove_canvas_graph(thread_id: str) -> None:
    """移除 canvas 图注册项(不存在时静默)。"""
    _canvas_graph_registry.pop(thread_id, None)


__all__ = [
    "build_canvas_graph",
    "get_canvas_graph_entry",
    "register_canvas_graph",
    "remove_canvas_graph",
    "validate_canvas_dag",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
