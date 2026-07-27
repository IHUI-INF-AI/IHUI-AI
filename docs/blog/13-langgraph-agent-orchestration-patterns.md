---
title: "LangGraph Agent 编排模式:6 种生产级 Multi-Agent 架构"
date: "2026-07-27"
tags: ["LangGraph", "LangChain", "Multi-Agent", "Orchestration", "State Machine", "Python"]
category: "AI 工程"
description: "用 LangGraph 实现 6 种生产级 multi-agent 编排模式:序列 / 并行 / 路由 / 协作 / 监督 / 层级,含完整代码示例。"
---

# LangGraph Agent 编排模式:6 种生产级 Multi-Agent 架构

> 单个 LLM agent 能力有限:它会被长任务搞晕、会在多步推理中失忆、会把所有职责搅成一团。生产级的 AI 系统需要多个 agent 分工协作——但「多个 agent 怎么协作」本身就是个难题。LangGraph 把 agent 编排建模成「状态图」,让复杂协作变得可调试、可持久化、可观测。本文是 IHUI-AI 在 `apps/ai-service/app/graphs/` 落地 6 种编排模式的工程总结。

---

## 一、LangGraph 与 LangChain 的关系

很多人分不清 LangChain 和 LangGraph。

### 1.1 LangChain 是「链」

LangChain 的核心抽象是 `Chain`——线性的步骤序列:

```
[输入] → [Prompt 模板] → [LLM] → [输出解析] → [输出]
```

适合简单任务,但遇到「根据结果决定下一步走哪」「循环直到满足条件」就力不从心。

### 1.2 LangGraph 是「图」

LangGraph 把执行流建模成**有向图**:

- **节点(Node)**:一个函数,接收 state,返回 state 更新
- **边(Edge)**:节点间的转移,可以是固定的或带条件的
- **状态(State)**:在节点间流转的共享数据,用 TypedDict 定义

```
       ┌─────────┐
       │  start  │
       └────┬────┘
            ▼
       ┌─────────┐    条件    ┌─────────┐
       │ router  │ ─────────▶ │ agent_a │
       └────┬────┘            └─────────┘
            │ 条件
            ▼
       ┌─────────┐
       │ agent_b │
       └─────────┘
```

图天然支持:**分支、循环、并行、汇聚**——这正是 multi-agent 协作需要的。

### 1.3 为什么选 LangGraph

| 需求             | LangChain Chain | LangGraph |
| ---------------- | --------------- | --------- |
| 线性流程         | ✅              | ✅        |
| 条件分支         | ❌              | ✅        |
| 循环(ReAct)    | 需 hack         | ✅ 原生   |
| 并行 fan-out     | ❌              | ✅        |
| 状态持久化       | ❌              | ✅        |
| 人机协同(HITL) | ❌              | ✅        |
| 流式事件         | 部分            | ✅ 完善   |

---

## 二、State 设计:编排的基础

所有 LangGraph 编排都从 State 定义开始。

### 2.1 TypedDict + Annotated

```python
# apps/ai-service/app/graphs/state.py
from typing import TypedDict, Annotated, Literal
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage

class AgentState(TypedDict):
    # add_messages reducer:列表追加而非覆盖
    messages: Annotated[list[BaseMessage], add_messages]
    # 普通字段:直接覆盖
    tenant_id: str
    user_id: str
    # 业务字段
    task: str
    research_notes: str
    draft: str
    # 路由控制
    next: str
    iteration: int
    status: Literal["running", "done", "error"]
```

关键点:

- `Annotated[list, add_messages]` 用 reducer,新消息追加而不是覆盖
- 普通字段默认是「覆盖」语义
- `next` 字段用于条件边路由

### 2.2 Channel(高级)

复杂场景下可以用 `Channel` 做更细粒度的状态管理,比如「每个 agent 自己的私有状态」。本文聚焦基础 TypedDict,Channel 留给进阶读者。

---

## 三、6 种编排模式

### 3.1 模式一:序列(Sequential)

最简单的模式:agent 依次执行,前者输出是后者输入。

```python
from langgraph.graph import StateGraph, END

def researcher(state: AgentState) -> dict:
    """调研 agent:收集资料。"""
    notes = call_llm(f"研究这个主题: {state['task']}")
    return {"research_notes": notes}

def writer(state: AgentState) -> dict:
    """写作 agent:基于资料写初稿。"""
    draft = call_llm(f"基于以下资料写文章:\n{state['research_notes']}")
    return {"draft": draft}

def reviewer(state: AgentState) -> dict:
    """审阅 agent:检查并定稿。"""
    final = call_llm(f"审阅并润色:\n{state['draft']}")
    return {"draft": final, "status": "done"}

graph = StateGraph(AgentState)
graph.add_node("researcher", researcher)
graph.add_node("writer", writer)
graph.add_node("reviewer", reviewer)

graph.set_entry_point("researcher")
graph.add_edge("researcher", "writer")
graph.add_edge("writer", "reviewer")
graph.add_edge("reviewer", END)

app = graph.compile()
```

适合:**流水线任务**(调研→写作→审阅)。不适合:需要分支判断的场景。

### 3.2 模式二:并行(Parallel fan-out / fan-in)

多个 agent 同时工作,结果汇聚。

```python
from langgraph.graph import StateGraph, END
import asyncio

def fan_out_research(state: AgentState) -> dict:
    """并行调研多个子主题。"""
    async def research_topic(topic: str) -> str:
        return await async_call_llm(f"研究: {topic}")

    topics = extract_subtopics(state["task"])
    results = asyncio.run(asyncio.gather(*[research_topic(t) for t in topics]))
    return {"research_notes": "\n---\n".join(results)}

def synthesize(state: AgentState) -> dict:
    """综合所有调研结果。"""
    draft = call_llm(f"综合以下调研写综述:\n{state['research_notes']}")
    return {"draft": draft, "status": "done"}

graph = StateGraph(AgentState)
graph.add_node("fan_out_research", fan_out_research)
graph.add_node("synthesize", synthesize)
graph.set_entry_point("fan_out_research")
graph.add_edge("fan_out_research", "synthesize")
graph.add_edge("synthesize", END)
app = graph.compile()
```

LangGraph 也支持用 `add_node` 注册多个节点 + `add_edge` 从同一源点指向多个目标,框架自动并行执行。

适合:**信息聚合**(多源检索、多视角分析)。

### 3.3 模式三:路由(Conditional routing)

根据输入特征走不同分支。

```python
def router(state: AgentState) -> str:
    """根据任务类型路由到不同 agent。"""
    task = state["task"].lower()
    if "代码" in task or "code" in task:
        return "code_agent"
    elif "翻译" in task or "translate" in task:
        return "translate_agent"
    else:
        return "chat_agent"

def code_agent(state: AgentState) -> dict:
    return {"messages": [ai_msg("代码 agent 处理中...")]}

def translate_agent(state: AgentState) -> dict:
    return {"messages": [ai_msg("翻译 agent 处理中...")]}

def chat_agent(state: AgentState) -> dict:
    return {"messages": [ai_msg("通用 chat agent...")]}

graph = StateGraph(AgentState)
graph.add_node("code_agent", code_agent)
graph.add_node("translate_agent", translate_agent)
graph.add_node("chat_agent", chat_agent)

graph.set_conditional_entry_point(
    router,
    {"code_agent": "code_agent", "translate_agent": "translate_agent", "chat_agent": "chat_agent"},
)
graph.add_edge("code_agent", END)
graph.add_edge("translate_agent", END)
graph.add_edge("chat_agent", END)
app = graph.compile()
```

适合:**任务分发**(客服路由、工单分类)。

### 3.4 模式四:协作(Collaborative)

多个 agent 共享 state,互相补充。

```python
def coder(state: AgentState) -> dict:
    """写代码。"""
    code = call_llm(f"写代码: {state['task']}")
    return {"draft": code, "next": "critic"}

def critic(state: AgentState) -> dict:
    """挑刺。"""
    feedback = call_llm(f"审查这段代码的问题:\n{state['draft']}")
    if "没问题" in feedback:
        return {"status": "done", "next": END}
    return {"research_notes": feedback, "next": "coder"}  # 回去重写

def should_continue(state: AgentState) -> str:
    return state.get("next", END)

graph = StateGraph(AgentState)
graph.add_node("coder", coder)
graph.add_node("critic", critic)
graph.set_entry_point("coder")
graph.add_conditional_edges("coder", should_continue, {"coder": "coder", "critic": "critic"})
graph.add_conditional_edges("critic", should_continue, {"coder": "coder", END: END})
app = graph.compile()
```

特点:**带循环**,coder 和 critic 反复迭代直到 critic 满意。LangGraph 原生支持循环,这是 LangChain Chain 做不到的。

### 3.5 模式五:监督(Supervisor)

一个 supervisor agent 决定下一步调用哪个 worker。

```python
def supervisor(state: AgentState) -> dict:
    """监督者:决定下一步交给谁。"""
    prompt = f"""你是任务协调者。当前任务: {state['task']}
    已完成步骤: {state.get('research_notes', '无')}
    可选 worker: [researcher, coder, tester, FINISH]
    返回 worker 名或 FINISH。"""
    decision = call_llm(prompt).strip()
    return {"next": decision}

def researcher(state: AgentState) -> dict:
    return {"research_notes": call_llm(f"研究: {state['task']}")}

def coder(state: AgentState) -> dict:
    return {"draft": call_llm(f"写代码: {state['task']}")}

def tester(state: AgentState) -> dict:
    return {"research_notes": call_llm(f"测试: {state['draft']}")}

def route(state: AgentState) -> str:
    nxt = state["next"]
    return nxt if nxt != "FINISH" else END

graph = StateGraph(AgentState)
graph.add_node("supervisor", supervisor)
graph.add_node("researcher", researcher)
graph.add_node("coder", coder)
graph.add_node("tester", tester)

graph.set_entry_point("supervisor")
graph.add_conditional_edges("supervisor", route, {
    "researcher": "researcher", "coder": "coder", "tester": "tester", END: END
})
# 每个 worker 完成后回到 supervisor
for w in ["researcher", "coder", "tester"]:
    graph.add_edge(w, "supervisor")
app = graph.compile()
```

这是 LangGraph 官方推荐的 multi-agent 模式。supervisor 像「项目经理」,worker 像「专家」,适合**复杂多步任务**。

### 3.6 模式六:层级(Hierarchical)

supervisor 之上还有 supervisor,形成树状结构。

```
              [Top Supervisor]
              /       |       \
        [Sub-Sup1] [Sub-Sup2] [Sub-Sup3]
         /    \      |          |    \
      [R]   [C]    [T]        [W]  [D]
```

```python
# 顶层 supervisor 决定交给哪个子团队
def top_supervisor(state: AgentState) -> dict:
    phase = state.get("iteration", 0)
    if phase == 0:
        return {"next": "research_team", "iteration": 1}
    elif phase == 1:
        return {"next": "dev_team", "iteration": 2}
    else:
        return {"next": "FINISH"}

# 子团队的 supervisor 各自管理自己的 worker
def research_team_sup(state: AgentState) -> dict:
    # 内部可以用子图(subgraph)
    return {"research_notes": "团队调研结果", "next": "top"}

graph = StateGraph(AgentState)
graph.add_node("top_supervisor", top_supervisor)
graph.add_node("research_team", research_team_sup)
graph.add_node("dev_team", lambda s: {"draft": "代码", "next": "top"})
graph.set_entry_point("top_supervisor")
graph.add_conditional_edges("top_supervisor", lambda s: s["next"], {
    "research_team": "research_team", "dev_team": "dev_team", "FINISH": END
})
graph.add_edge("research_team", "top_supervisor")
graph.add_edge("dev_team", "top_supervisor")
app = graph.compile()
```

适合:**大型项目**(研究团队→开发团队→测试团队,各司其职)。

---

## 四、持久化:Checkpointer + Memory

生产环境的 agent 必须能「断点续跑」。

### 4.1 Checkpointer

LangGraph 的 `Checkpointer` 在每个节点执行后保存 state 快照:

```python
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.checkpoint.memory import MemorySaver

# 生产用 Postgres,开发用 Memory
checkpointer = PostgresSaver.from_conn_string(DATABASE_URL)
# checkpointer = MemorySaver()

app = graph.compile(
    checkpointer=checkpointer,
    interrupt_before=["critic"],  # 在 critic 前暂停(人机协同)
)

# 用 thread_id 关联会话
config = {"configurable": {"thread_id": "session-abc123"}}
result = await app.ainvoke(initial_state, config=config)

# 之后可以恢复
resumed = await app.ainvoke(None, config=config)  # 从断点继续
```

### 4.2 实战:长任务断点续跑

IHUI-AI 的「深度研究」任务可能跑 10 分钟,用户中途关浏览器,后台继续跑,重开页面能看到进度:

```python
# 前端轮询接口
@app.get("/api/tasks/{task_id}/state")
async def get_task_state(task_id: str):
    state = await app.aget_state({"configurable": {"thread_id": task_id}})
    return {
        "current_node": state.next,
        "values": state.values,
        "done": state.next == END,
    }
```

---

## 五、人机协同(Human-in-the-loop)

某些决策必须人类介入(如「这个操作要花 100 美元,确认?」)。

### 5.1 interrupt_before

```python
app = graph.compile(
    checkpointer=checkpointer,
    interrupt_before=["execute_expensive_op"],
)

# 跑到 execute_expensive_op 前会暂停
await app.ainvoke(state, config={"configurable": {"thread_id": tid}})

# 等人类确认
@app.post("/api/tasks/{tid}/approve")
async def approve(tid: str):
    # 人类点了「确认」,继续执行
    await app.ainvoke(None, config={"configurable": {"thread_id": tid}})
```

### 5.2 动态 interrupt

```python
from langgraph.types import interrupt

def risky_action(state: AgentState) -> dict:
    cost = estimate_cost(state["task"])
    if cost > 10:
        # 运行时动态暂停,问人类
        approved = interrupt({"question": f"此操作花费 ${cost},确认?", "cost": cost})
        if not approved:
            return {"status": "error", "next": END}
    # 执行
    return {"status": "done"}
```

---

## 六、流式输出(Streaming events)

LLM 响应要流式给前端,否则用户等 30 秒看不到任何东西会以为崩了。

```python
async def stream_response(task_id: str):
    config = {"configurable": {"thread_id": task_id}}
    async for event in app.astream_events(initial_state, config=config, version="v2"):
        kind = event["event"]
        if kind == "on_chat_model_stream":
            # LLM token 流
            chunk = event["data"]["chunk"].content
            yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
        elif kind == "on_chain_start":
            yield f"data: {json.dumps({'type': 'node_start', 'node': event['name']})}\n\n"
        elif kind == "on_chain_end":
            yield f"data: {json.dumps({'type': 'node_end', 'node': event['name']})}\n\n"
```

前端用 EventSource(SSE)接收,既显示 token 流又显示当前在哪个节点。

---

## 七、错误处理与重试

agent 调用 LLM 会失败(限流、超时、JSON 解析错)。每个节点要包重试:

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def robust_node(state: AgentState) -> dict:
    try:
        result = call_llm(state["task"])
        return {"draft": result}
    except json.JSONDecodeError:
        # LLM 返回的 JSON 畸形,加修复提示重试
        return {"draft": "", "error": "JSON parse failed"}
    except Exception as e:
        logger.error("node_failed", error=str(e), state=state)
        raise

# 全局 fallback:图级别的错误兜底
app = graph.compile(checkpointer=checkpointer)
try:
    result = await app.ainvoke(state, config=config)
except Exception as e:
    # 标记任务失败,记录到 DB
    await mark_task_failed(task_id, str(e))
```

---

## 八、IHUI-AI 实战:apps/ai-service/app/graphs/

```
apps/ai-service/app/graphs/
├── __init__.py
├── state.py              # AgentState 定义
├── chat_graph.py         # 聊天(supervisor 模式)
├── research_graph.py     # 深度研究(层级模式)
├── task_graph.py         # 任务执行(协作模式)
└── tools/                # 各 agent 用的工具
    ├── search.py
    ├── code.py
    └── write.py
```

### 8.1 聊天 graph(supervisor)

聊天场景下,supervisor 决定:这次对话是直接回 / 查知识库 / 调工具 / 转 agent:

```python
async def build_chat_graph(tenant_id: str, user_role: str):
    tools = await load_tools_for_role(user_role)  # MCP 工具
    model = init_model("gpt-4o")

    def supervisor(state: AgentState) -> dict:
        last_msg = state["messages"][-1].content
        if need_search(last_msg):
            return {"next": "search_agent"}
        elif need_tool(last_msg):
            return {"next": "tool_agent"}
        else:
            return {"next": "direct_reply"}

    # ... 构建图,绑定 MCP 工具到 tool_agent
    return graph.compile(checkpointer=postgres_checkpointer)
```

### 8.2 深度研究 graph(层级)

「帮我研究 XX 主题,写一份报告」这种长任务用层级模式:

- Top supervisor:规划阶段(调研→写作→审阅)
- Research team:fan-out 多个 sub-topic 并行检索
- Writer team:综合调研写报告
- Reviewer:审阅打回或定稿

实测一个 10 分钟的研究任务,token 消耗约 50k,成本约 $0.3。

---

## 九、性能调优

### 9.1 并发控制

并行 fan-out 时,限制并发数避免打爆 LLM API:

```python
import asyncio

async def fan_out_limited(tasks: list, max_concurrent: int = 5):
    sem = asyncio.Semaphore(max_concurrent)
    async def bounded(t):
        async with sem:
            return await t
    return await asyncio.gather(*[bounded(t) for t in tasks])
```

### 9.2 token 估算

```python
import tiktoken
enc = tiktoken.encoding_for_model("gpt-4o")

def estimate_tokens(text: str) -> int:
    return len(enc.encode(text))

# 在 supervisor 里预估下一步成本
def supervisor(state: AgentState) -> dict:
    input_tokens = sum(estimate_tokens(m.content) for m in state["messages"])
    if input_tokens > 100_000:
        return {"next": "summarize"}  # 压缩历史
    return {"next": "continue"}
```

### 9.3 缓存

相同子任务的结果缓存到 Redis:

```python
import hashlib, json

async def cached_call(prompt: str, ttl=3600):
    key = f"llm:{hashlib.sha256(prompt.encode()).hexdigest()}"
    if cached := await redis.get(key):
        return json.loads(cached)
    result = await call_llm(prompt)
    await redis.setex(key, ttl, json.dumps(result))
    return result
```

---

## 十、参考资料

- [LangGraph 官方文档](https://langchain-ai.github.io/langgraph/)
- [LangGraph Multi-Agent Tutorial](https://langchain-ai.github.io/langgraph/tutorials/multi_agent/multi-agent-collaboration/)
- [LangChain Python](https://python.langchain.com/)
- IHUI-AI 源码:`apps/ai-service/app/graphs/`

---

## 总结

LangGraph 把 multi-agent 编排从「if-else 意大利面」变成「可可视化、可持久化、可断点续跑的状态图」。6 种模式覆盖了绝大多数场景:

- **序列**:流水线(调研→写作→审阅)
- **并行**:多源聚合(多主题检索)
- **路由**:任务分发(按类型走不同 agent)
- **协作**:带循环的迭代(coder↔critic)
- **监督**:项目经理模式(supervisor 调度 worker)
- **层级**:大型项目(团队树)

IHUI-AI 的实践表明,supervisor 模式是性价比最高的起点:一个 LLM 当调度器,几个专精 agent 当 worker,加上 Postgres checkpointer 做断点续跑,就能撑住生产负载。等业务复杂了再演进到层级模式。

下一篇讲 [LiteLLM 适配 176 个大模型](./14-litellm-adapter-176-llms-unified.md),看 agent 背后的 LLM 调用如何统一。
