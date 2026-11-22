# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent Runtime LangGraph 状态机 — admit → plan → execute → summarize。

没有 work_trigger 时 admit 直接放行,原 plan → execute → summarize 行为不变。
有宿主准入视图时,不该派工的触发不会进入规划与执行。
"""

from typing import Any, Literal, TypedDict

from langgraph.graph import END, StateGraph

from app.core.default_model import default_chat_model
from app.core.llm_gateway import llm_gateway
from app.services.work_admission import evaluate_host_view, note_worker_finished

# 2026-10-26:原写死 "stepfun/step-3.7-flash"(stepfun 已永久退役,chat 恒定 400),
# 改走统一解析入口,随运行期配置自动跟随上游换档。
_DEFAULT_MODEL = default_chat_model()


class AgentState(TypedDict, total=False):
    messages: list[dict[str, Any]]
    mode: str
    session_id: str
    plan: str
    execution_result: str
    summary: str
    error: str | None
    work_trigger: dict[str, Any]
    admission: dict[str, Any]


async def admit_node(state: AgentState) -> dict[str, Any]:
    """准入节点:没有宿主视图就放行。视图被拒绝时不派工。"""
    raw = state.get("work_trigger")
    if not isinstance(raw, dict) or not raw:
        return {}
    return {"admission": evaluate_host_view(raw)}


def after_admit(state: AgentState) -> Literal["plan", "summarize"]:
    """不该派工时跳过规划和执行,避免空耗模型。"""
    admission = state.get("admission")
    if isinstance(admission, dict) and admission.get("runs_worker") is True:
        return "plan"
    if isinstance(admission, dict):
        return "summarize"
    return "plan"


async def plan_node(state: AgentState) -> dict[str, Any]:
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


async def execute_node(state: AgentState) -> dict[str, Any]:
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


async def summarize_node(state: AgentState) -> dict[str, Any]:
    """总结节点:做减法 — 直接返回执行结果,不再调用 LLM(避免延迟)。

    没派工时,只把准入层准备说给人的那一句送出去;该沉默的仍然是空摘要。
    """
    result = state.get("execution_result", "")
    admission = state.get("admission")
    ticket_id = ""
    runs_worker = False
    speak = ""
    if isinstance(admission, dict):
        runs_worker = admission.get("runs_worker") is True
        raw_id = admission.get("ticket_id")
        ticket_id = raw_id if isinstance(raw_id, str) else ""
        raw_speak = admission.get("speak")
        speak = raw_speak if isinstance(raw_speak, str) else ""
    if runs_worker and ticket_id:
        note_worker_finished(ticket_id, ok=bool(result))
    if result:
        return {"summary": result}
    if speak:
        return {"summary": speak}
    return {"summary": ""}


def should_continue(state: AgentState) -> Literal["execute", "summarize"]:
    """条件路由:plan 失败则直接进 summarize,否则进 execute。"""
    if state.get("error") and "plan failed" in (state.get("error") or ""):
        return "summarize"
    return "execute"


def build_agent_graph() -> Any:
    """构建 LangGraph StateGraph(admit → plan → execute → summarize)。"""
    graph = StateGraph(AgentState)
    graph.add_node("admit", admit_node)
    graph.add_node("plan", plan_node)
    graph.add_node("execute", execute_node)
    graph.add_node("summarize", summarize_node)

    graph.set_entry_point("admit")
    graph.add_conditional_edges("admit", after_admit)
    graph.add_conditional_edges("plan", should_continue)
    graph.add_edge("execute", "summarize")
    graph.add_edge("summarize", END)

    return graph.compile()


_agent_graph: Any = None


def get_agent_graph() -> Any:
    """模块级单例,避免每次请求重新编译 graph。"""
    global _agent_graph
    if _agent_graph is None:
        _agent_graph = build_agent_graph()
    return _agent_graph


def reset_agent_graph_for_test() -> None:
    """测试辅助:重置单例(便于 mock 后重建)。"""
    global _agent_graph
    _agent_graph = None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
