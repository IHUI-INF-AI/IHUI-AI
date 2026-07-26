---
title: "MCP 协议集成实战:让 AI Agent 调用任意工具"
date: "2026-07-26"
tags: ["AI", "MCP", "Agent", "LangGraph", "开源"]
category: "AI 工程"
description: "用 Model Context Protocol 标准化 AI Agent 工具调用,IHUI AI 实战分享 MCP server 架构、工具注册、权限控制与沙箱执行。"
---

# MCP 协议集成实战:让 AI Agent 调用任意工具

> 你让 AI 帮你订张机票。AI 说:"我是语言模型,无法访问外部系统。"你换个 Agent 产品,它说自己能订,但要你把密码给它,还得给它管理员权限。你犹豫了。

LLM 的下一个十年战争不是模型本身,而是**工具调用**。Anthropic 在 2024 年底开源了 [Model Context Protocol (MCP)](https://modelcontextprotocol.io),把「AI 调用外部工具」标准化了。本文讲 IHUI AI 如何在 8 端全栈 AI 操作系统里集成 MCP,让 Agent 真正能干活。

---

## 一、痛点:AI 只会聊天,不会干活

LLM 应用最尴尬的现状:**模型很聪明,但被关在玻璃箱子里**。

### 痛点 1:每家 Agent 框架各搞一套工具协议

- OpenAI Function Calling:`tools` + `tool_calls`
- Anthropic Tool Use:`tool_use` block
- LangChain Tools:`BaseTool` 类
- AutoGen Tools:`@tool` 装饰器
- Coze / Dify:可视化插件

你写了一个"查询订单"工具,要适配 5 个框架,写 5 份代码。

### 痛点 2:工具复用率几乎为 0

A 公司写了个"查询天气"工具,只能在自己的 Agent 里用。B 公司想复用,要从头实现。整个行业在重复造轮子。

### 痛点 3:权限失控

Agent 要查数据库,你给它 DB 账号;它要发邮件,你给它 SMTP 密码;它要操作 GitHub,你给它 PAT。一个 prompt injection 攻击,你的生产数据库就裸奔了。

### 痛点 4:无沙箱

Agent 跑你写的代码片段,直接在你服务器上 `eval()`?生产环境分分钟被搞挂。

---

## 二、方案:MCP 协议 + 沙箱执行

### 2.1 MCP 是什么

**Model Context Protocol** 是 Anthropic 主导、开源的 AI 工具调用协议。它的核心思想:**把工具/资源/Prompt 暴露成标准 server,任何 MCP-compatible client 都能调用**。

类比:MCP 之于 AI Agent = LSP 之于编辑器。LSP 让一个语言服务器同时给 VSCode/Vim/Emacs 用,MCP 让一个工具同时给 Claude Desktop/Cursor/任何 Agent 用。

### 2.2 MCP 的三要素

1. **Tools(工具)**:可执行函数,如 `query_order(orderId)`、`send_email(to, subject, body)`
2. **Resources(资源)**:可读数据,如 `file:///path/to/doc.md`、`db://users/123`
3. **Prompts(提示词模板)**:可复用 prompt,如 `summarize_meeting(transcript)`

### 2.3 IHUI AI 的 MCP 架构

```
┌──────────────────────────────────────────┐
│  AI Agent (LangGraph 编排)               │
│  ↓ 工具调用决策                            │
│  MCP Client (统一调用层)                  │
└──────────────┬───────────────────────────┘
               │ JSON-RPC over stdio/SSE
               ↓
┌──────────────────────────────────────────┐
│  MCP Server Registry(工具注册中心)       │
│  ↓ 权限校验 + 路由                         │
└──────────────┬───────────────────────────┘
               │
        ┌──────┼──────┬──────┬──────┐
        ↓      ↓      ↓      ↓      ↓
   内置工具  企业DB  GitHub Slack 沙箱代码执行
   (本地)   MCP    MCP    MCP   MCP
```

每个 MCP server 是独立进程,Agent 只通过标准协议跟它通信,**工具实现与 Agent 解耦**。

---

## 三、技术细节

### 3.1 自定义 MCP Server

IHUI AI 用官方 `@modelcontextprotocol/sdk` 写 MCP server。下面是一个"订单查询"server 示例:

```typescript
// mcp-servers/order-query/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { db } from './db.js';

const server = new Server(
  { name: 'order-query', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

// 注册工具
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'query_order',
      description: '查询订单详情,需要用户自己的订单 ID',
      inputSchema: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: '订单 ID' },
        },
        required: ['orderId'],
      },
    },
    {
      name: 'list_recent_orders',
      description: '列出当前用户最近 10 笔订单',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '用户 ID(从鉴权上下文获取)' },
        },
        required: ['userId'],
      },
    },
  ],
}));

// 工具实现
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'query_order': {
      const order = await db.orders.findById(args.orderId);
      if (!order) {
        return { content: [{ type: 'text', text: '订单不存在' }] };
      }
      // 权限校验:只能查自己的订单
      if (order.userId !== args.userId) {
        return { content: [{ type: 'text', text: '无权访问他人订单' }] };
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(order, null, 2),
        }],
      };
    }
    case 'list_recent_orders': {
      const orders = await db.orders.findRecentByUser(args.userId, 10);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(orders, null, 2),
        }],
      };
    }
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

**关键设计**:
- 工具用 JSON Schema 描述入参,LLM 自动知道怎么调用。
- 权限校验在工具内部,Agent 无法绕过。
- 返回结构化 JSON,LLM 可以进一步处理。

### 3.2 MCP Client 集成

`apps/ai-service/src/mcp/client.py`:

```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from contextlib import asynccontextmanager
import json

class MCPRegistry:
    """MCP Server 注册中心"""

    def __init__(self):
        self.servers: dict[str, ClientSession] = {}
        self.tools_cache: dict[str, list] = {}

    @asynccontextmanager
    async def connect(self, server_name: str, command: str, args: list[str]):
        params = StdioServerParameters(command=command, args=args)
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                self.servers[server_name] = session
                # 缓存工具列表
                tools_resp = await session.list_tools()
                self.tools_cache[server_name] = tools_resp.tools
                yield session

    async def call_tool(
        self,
        server_name: str,
        tool_name: str,
        arguments: dict,
        user_context: dict,  # 鉴权上下文
    ):
        if server_name not in self.servers:
            raise ValueError(f"未注册的 MCP server: {server_name}")
        # 把用户上下文注入参数(权限校验用)
        enriched_args = {**arguments, **user_context}
        session = self.servers[server_name]
        result = await session.call_tool(tool_name, enriched_args)
        return json.loads(result.content[0].text)

    def all_tools_as_openai_format(self) -> list[dict]:
        """把所有 MCP 工具转成 OpenAI tools 格式,供 LLM 调用"""
        all_tools = []
        for server_name, tools in self.tools_cache.items():
            for tool in tools:
                all_tools.append({
                    "type": "function",
                    "function": {
                        "name": f"{server_name}__{tool.name}",
                        "description": tool.description,
                        "parameters": tool.inputSchema,
                    },
                })
        return all_tools
```

### 3.3 LangGraph 工具调用循环

把 MCP 工具暴露给 LangGraph Agent:

```python
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from litellm import acompletion

class AgentState(TypedDict):
    messages: list[dict]
    user_context: dict

async def call_llm(state: AgentState):
    tools = registry.all_tools_as_openai_format()
    response = await acompletion(
        model="gpt-4o",
        messages=state["messages"],
        tools=tools,
    )
    msg = response.choices[0].message
    return {"messages": state["messages"] + [msg.to_dict()]}

async def call_mcp_tool(state: AgentState):
    last_msg = state["messages"][-1]
    results = []
    for tool_call in last_msg.get("tool_calls", []):
        # 工具名格式:server_name__tool_name
        server_name, tool_name = tool_call["function"]["name"].split("__", 1)
        args = json.loads(tool_call["function"]["arguments"])
        result = await registry.call_tool(
            server_name, tool_name, args, state["user_context"],
        )
        results.append({
            "role": "tool",
            "tool_call_id": tool_call["id"],
            "content": json.dumps(result),
        })
    return {"messages": state["messages"] + results}

def should_continue(state: AgentState) -> str:
    last_msg = state["messages"][-1]
    if last_msg.get("tool_calls"):
        return "call_tool"
    return END

graph = StateGraph(AgentState)
graph.add_node("llm", call_llm)
graph.add_node("call_tool", call_mcp_tool)
graph.add_conditional_edges("llm", should_continue)
graph.add_edge("call_tool", "llm")  # 工具结果回到 LLM
graph.set_entry_point("llm")
agent = graph.compile()
```

**整个调用循环**:LLM 决策 → 调 MCP 工具 → 结果回 LLM → 决策下一步 → 直到完成。

### 3.4 权限控制:三层模型

IHUI AI 的 MCP 权限分三层:

1. **用户级**:用户只能调用自己有权访问的工具(如查自己的订单)。在工具实现里校验 `userId`。
2. **套餐级**:Free 用户只能用 5 个内置工具,Pro 用户能用 50 个,Enterprise 解锁全部。在 MCP Client 层过滤工具列表。
3. **会话级**:用户在 UI 上要明确"允许 Agent 调用 X 工具",类似 OAuth 授权。Agent 临时拿到 token,会话结束失效。

```python
def filter_tools_by_permission(
    user_id: str,
    plan: str,
    session_grants: list[str],
    all_tools: list[dict],
) -> list[dict]:
    allowed = []
    for tool in all_tools:
        tool_id = tool["function"]["name"]
        # 套餐级
        if tool_id in PLAN_TOOL_WHITELIST[plan]:
            allowed.append(tool)
        # 会话级
        elif tool_id in session_grants:
            allowed.append(tool)
    return allowed
```

### 3.5 沙箱执行:代码解释器 MCP

最危险的工具是"代码执行"。IHUI AI 写了一个独立的沙箱 MCP server,基于 Docker + 资源限制:

```typescript
// mcp-servers/code-sandbox/index.ts
import Docker from 'dockerode';
const docker = new Docker();

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== 'execute_code') {
    throw new Error(`未知工具: ${req.params.name}`);
  }
  const { code, language = 'python' } = req.params.arguments;

  // 启动一次性容器
  const container = await docker.createContainer({
    Image: 'ihui/sandbox-python:3.11-slim',
    Cmd: ['python', '-c', code],
    HostConfig: {
      Memory: 256 * 1024 * 1024,    // 256MB
      NanoCpus: 1e9,                // 1 CPU
      NetworkMode: 'none',          // 禁网
      AutoRemove: true,
    },
  });

  await container.start();
  const output = await container.attach({
    stream: true, stdout: true, stderr: true,
  });
  // ... 收集输出,5 秒超时 kill
  return {
    content: [{ type: 'text', text: output.toString() }],
  };
});
```

**安全措施**:禁网 + 内存/CPU 限制 + 5 秒超时 + 一次性容器 + 非 root 用户。Agent 跑任何代码都炸不到宿主机。

### 3.6 A2A 协议:MCP 之上的 Agent 互调

MCP 解决「Agent 调工具」,但 Agent 之间互调怎么办?IHUI AI 还集成了 A2A(Agent-to-Agent)协议:

- Agent A(规划)→ Agent B(检索)→ Agent C(生成)
- 每个 Agent 暴露 MCP server,其他 Agent 当工具调用
- 形成 Agent 网络,而不是单体 Agent

这就是 IHUI AI 的 **P3 深度层**:用户拖拽配置 Agent 拓扑,平台负责调度。

---

## 四、IHUI AI 实战数据

| 指标 | 数值 |
| --- | --- |
| 内置 MCP server 数量 | 28 个(订单/支付/邮件/搜索/数据库/代码沙箱...) |
| 第三方 MCP 兼容 | 100%(任何 MCP server 即插即用) |
| 平均工具调用延迟 | 120ms(本地)/ 800ms(远程) |
| 沙箱最大执行时长 | 30 秒(超时自动 kill) |
| 权限层级 | 3 层(用户/套餐/会话) |
| 协议支持 | MCP + A2A 双协议 |

**真实案例**:某企业用户把内部 ERP 系统封装成 MCP server,IHUI AI 的 Agent 一键接入,员工用自然语言查库存、下订单、生成报表。原来要写 3 周的集成,2 天搞定,且权限隔离清晰。

---

## 五、踩坑总结

### 坑 1:工具描述写不好,LLM 乱调

LLM 调工具靠 `description` 字段。如果描述模糊("查订单"),LLM 会乱调。我们的规范:描述必须包含 ① 何时用 ② 何时不用 ③ 入参语义 ④ 返回结构。如:`"查询订单详情,仅在用户明确询问订单状态时使用,不要在闲聊中调用。返回订单 JSON,包含 id/items/total/status 字段。"`

### 坑 2:工具数量爆炸,LLM 选择困难

工具一多(50+),LLM 选错率飙升。解法:按场景分组,LangGraph 路由节点先选「工具子集」,再传给 LLM。

### 坑 3:stdio vs SSE

MCP 支持两种 transport:stdio(本地子进程)和 SSE(远程 HTTP)。stdio 性能好但只能本地,SSE 跨网络但延迟高。IHUI AI 内置工具用 stdio,第三方工具用 SSE,Client 层透明切换。

### 坑 4:工具结果 token 爆炸

某个工具返回 10 万行 SQL 结果,塞进 context 直接超限。我们在 MCP Client 层做了截断:`tool_result_truncator(result, max_tokens=2000)`,超长就摘要 + 提示"完整结果已存档,可调用 query_detail 工具查看"。

---

## 六、什么时候不要上 MCP

1. **只跟一家 LLM 厂商绑定**:用厂商原生 Function Calling 更轻量。
2. **工具数量 < 5 个且不对外共享**:自己封装更简单。
3. **不需要跨 Agent 复用工具**:MCP 的核心收益是「写一次,所有 Agent 都能用」,如果只在自己一个 Agent 里用,收益有限。

MCP 真正的价值在**生态**:工具一次写成,所有 MCP-compatible 客户端(Claude Desktop/Cursor/Cline/IHUI AI)都能用。这是 LSP 当年统一编辑器生态的重演。

---

## 七、结语

MCP 集成的核心是:

- **协议标准化**:MCP 让工具一次写成,所有 Agent 都能调,告别 5 框架 5 份代码。
- **server 解耦**:每个工具是独立进程,LangGraph Agent 只通过 JSON-RPC 通信。
- **三层权限**:用户级 / 套餐级 / 会话级,prompt injection 也炸不动生产数据库。
- **沙箱执行**:代码执行类工具走 Docker 隔离,禁网 + 资源限制 + 超时 kill。
- **A2A 扩展**:MCP 之上做 Agent 互调,形成 Agent 网络(P3 深度层)。

IHUI AI 已经用 MCP 把 28 个内置工具 + 任意第三方 MCP server 串起来,Agent 市场里的工具一次写成、全平台通用。如果你也在做 Agent 应用,强烈建议从第一天就用 MCP——晚了再迁移,工具协议适配会要命。

---

## 关于 IHUI AI

IHUI AI 是一站式 8 端全栈 AI 操作系统,Apache 2.0 开源。

- 🌐 官网:https://ihui.ai
- 💻 GitHub:https://github.com/IHUI-INF-AI/IHUI-AI(Star 支持一下 ⭐)
- 📦 8 端同源:Web / API / CLI / Desktop / Extension / Mobile / Miniapp
- 🤖 176 模型:OpenAI / Claude / Gemini / 通义 / DeepSeek / 智谱 / 文心 / 豆包 / Kimi / Ollama
- 💰 定价:Free / Pro ¥49/月 / Team ¥199/人/月 / Enterprise ¥2999/月起

**5 分钟 Fork 到上线,替代 ChatGPT Team + Claude Code + Notion AI,月省 $60+。**
