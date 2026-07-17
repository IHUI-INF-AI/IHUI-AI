"""Agent Runtime LangGraph 状态机 — plan → execute → summarize 流水线。

最小实现:仅让 graph 跑通产生 plan/delta/done 事件,
不实现完整 tool calling / permission 阻断 / 多轮交互。
"""

from typing import Literal, TypedDict

from langgraph.graph import END, StateGraph

from app.core.llm_gateway import llm_gateway

_DEFAULT_MODEL = "stepfun/step-3.7-flash"


class AgentState(TypedDict, total=False):
    messages: list[dict]
    mode: str
    session_id: str
    plan: str
    execution_result: str
    summary: str
    error: str | None


async def plan_node(state: AgentState) -> dict:
    """规划节点:基于用户消息生成执行计划。"""
    messages = state.get("messages", [])
    mode = state.get("mode", "default")

    if mode in ("bypassPermissions", "manual"):
        return {"plan": "skip-planning"}

    plan_prompt = [
        {
            "role": "system",
            "content": (
                "你是规划助手。基于用户消息,生成简短的执行计划(1-3 步)。"
                "只输出计划本身,不要其他解释。"
            ),
        },
        *messages,
    ]

    try:
        result = await llm_gateway.complete(plan_prompt, model=_DEFAULT_MODEL)
        content = result.get("content", "") if isinstance(result, dict) else str(result)
        return {"plan": content.strip()}
    except Exception as e:
        return {"plan": "", "error": f"plan failed: {e}"}


async def execute_node(state: AgentState) -> dict:
    """执行节点:基于计划执行实际任务。"""
    messages = state.get("messages", [])
    plan = state.get("plan", "")

    if plan == "skip-planning" or not plan:
        execute_messages = list(messages)
    else:
        execute_messages = [
            *messages,
            {
                "role": "system",
                "content": f"参考执行计划:\n{plan}\n\n请基于此计划完成任务。",
            },
        ]

    try:
        result = await llm_gateway.complete(execute_messages, model=_DEFAULT_MODEL)
        content = result.get("content", "") if isinstance(result, dict) else str(result)
        return {"execution_result": content.strip()}
    except Exception as e:
        return {"execution_result": "", "error": f"execute failed: {e}"}


async def summarize_node(state: AgentState) -> dict:
    """总结节点:做减法 — 直接返回执行结果,不再调用 LLM(避免延迟)。"""
    result = state.get("execution_result", "")
    if not result:
        return {"summary": ""}
    return {"summary": result}


def should_continue(state: AgentState) -> Literal["execute", "summarize"]:
    """条件路由:plan 失败则直接进 summarize,否则进 execute。"""
    if state.get("error") and "plan failed" in (state.get("error") or ""):
        return "summarize"
    return "execute"


def build_agent_graph():
    """构建 LangGraph StateGraph(plan → execute → summarize)。"""
    graph = StateGraph(AgentState)
    graph.add_node("plan", plan_node)
    graph.add_node("execute", execute_node)
    graph.add_node("summarize", summarize_node)

    graph.set_entry_point("plan")
    graph.add_conditional_edges("plan", should_continue)
    graph.add_edge("execute", "summarize")
    graph.add_edge("summarize", END)

    return graph.compile()


_agent_graph = None


def get_agent_graph():
    """模块级单例,避免每次请求重新编译 graph。"""
    global _agent_graph
    if _agent_graph is None:
        _agent_graph = build_agent_graph()
    return _agent_graph


def reset_agent_graph_for_test() -> None:
    """测试辅助:重置单例(便于 mock 后重建)。"""
    global _agent_graph
    _agent_graph = None
