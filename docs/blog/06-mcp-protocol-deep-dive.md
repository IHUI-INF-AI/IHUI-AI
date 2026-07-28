---
title: "MCP 协议深度解析:从 Function Call 到通用工具调用标准"
date: "2026-07-27"
tags: ["MCP", "Model Context Protocol", "AI 工具集成", "Anthropic MCP", "MCP server"]
category: "AI 协议"
description: "深度剖析 Model Context Protocol 协议设计理念、JSON-RPC 传输层、与 OpenAI Function Call 的本质差异,以及 IHUI-AI 如何同时实现 MCP 客户端与服务端。"
---

# MCP 协议深度解析:从 Function Call 到通用工具调用标准

> Model Context Protocol(简称 MCP)是 Anthropic 在 2024 年底开源的协议,目标是把「AI 调用外部工具」从各家自定义的接口,统一成一种像 USB-C 一样的标准。本文从协议原理出发,讲清 MCP 与 Function Call 的本质差异,以及 IHUI-AI 项目里 MCP 客户端 + 服务端的双向实现。

---

## 一、MCP 不是 Function Call 的「升级版」,而是「协议层」

很多人把 MCP 类比成「Function Call 的下一代」,这是误解。Function Call 是**模型能力**:LLM 输出一段 JSON,由应用层去执行。MCP 是**协议层**:它规定「工具如何被发现、如何被描述、如何被调用、如何被注销」,与具体模型解耦。

打个比方:Function Call 是「插头形状」,MCP 是「USB-C 协议」。前者每家厂商一个样,后者让任何设备都能插。

### MCP 的三个核心原语

| 原语 | 作用 | 类比 |
| --- | --- | --- |
| `tools` | 可被 LLM 调用的函数 | API endpoint |
| `resources` | 可被读取的数据源(只读) | GET 资源 |
| `prompts` | 可复用的提示词模板 | 函数库 |

三者通过同一个 MCP server 暴露,客户端在连接时通过 `listTools` / `listResources` / `listPrompts` 动态发现,而不是写死在代码里。

---

## 二、协议传输层:JSON-RPC 2.0 + 双向通信

MCP 底层基于 **JSON-RPC 2.0**,支持两种传输:

- **stdio**:子进程模式,client 启动 server,通过标准输入输出交换 JSON-RPC 消息。
- **HTTP+SSE**:远程模式,server 暴露 HTTP 端点,client 通过 SSE 接收推送。

```json
// client → server:list tools
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}

// server → client:返回工具清单
{"jsonrpc":"2.0","id":1,"result":{
  "tools":[{
    "name":"query_order",
    "description":"按订单号查询订单状态",
    "inputSchema":{"type":"object","properties":{"order_id":{"type":"string"}}}
  }]
}}
```

关键设计:**协议是双向的**——server 也可以主动发起 `notifications/progress` 推送进度,client 可以发起 `sampling` 让 server 端的 LLM 帮自己生成内容。这种双向能力让 MCP 比单向的 Function Call 更接近「Agent 间通信协议」。

---

## 三、MCP vs Function Call:四维对比

| 维度 | Function Call | MCP |
| --- | --- | --- |
| 标准化 | 每家厂商自定义 | 协议层标准,与模型解耦 |
| 工具发现 | 启动时硬编码 | 运行时动态 `listTools` |
| 传输方式 | 进程内函数调用 | stdio / HTTP+SSE,跨进程跨机 |
| 复用性 | 一个工具一套代码 | 一个 server 可被任意 client 复用 |

最关键的差异是**复用性**:你写一个「查询 GitHub Issue」的 MCP server,任何支持 MCP 的客户端(Claude Desktop、Cursor、IHUI-AI)都能直接用,不用改一行代码。

---

## 四、IHUI-AI 的双向 MCP 实现

IHUI-AI 在 `apps/ai-service` 里同时实现了 client 与 server 两端:

### 4.1 MCP 客户端:把外部 server 接进 Agent

`apps/ai-service` 基于 LangGraph 编排 Agent,在每次对话开始时:

1. 加载用户已启用的 MCP server 列表(存 PostgreSQL)。
2. 对每个 server 建立 JSON-RPC 连接,调用 `tools/list` 拉取工具清单。
3. 把所有工具的 `inputSchema` 合并喂给 LLM,LLM 决定调用哪个。
4. 收到 `tool_call` 后,转发给对应 server 执行,把结果回填到对话上下文。

### 4.2 MCP 服务端:把 IHUI 的能力暴露出去

IHUI 也把自己封装成 MCP server,暴露给 Claude Desktop / Cursor 等外部客户端使用:

```python
@mcp.tool()
def search_knowledge_base(query: str, top_k: int = 5) -> list[dict]:
    """在 IHUI 知识库里检索相关文档片段"""
    return rag_service.retrieve(query, top_k)

@mcp.resource("ihui://agents/{agent_id}")
def get_agent_definition(agent_id: str) -> dict:
    """读取某个 Agent 的定义(只读资源)"""
    return agent_service.get_definition(agent_id)
```

这样用户在 Claude Desktop 里写「帮我用 IHUI 的 Agent X 总结这个文档」,Claude 会通过 MCP 调用 IHUI server,不需要切换应用。

---

## 五、实战经验:三个最容易踩的坑

1. **工具数量爆炸**:一个 server 暴露 50 个工具,LLM 选择困难。建议按场景拆分多个 server,每次只加载相关的。
2. **`inputSchema` 不严格**:JSON Schema 写漏了 `required`,LLM 就会传空对象。务必用 Zod 在 server 端二次校验。
3. **stdio 模式的进程泄漏**:client 崩溃后 server 子进程没回收。建议给 stdio server 加心跳,30 秒无响应就 kill。

---

## 六、MCP 的未来:从「工具协议」到「Agent 互联网」

MCP 当前主要解决「LLM ↔ 工具」的连接。但它的双向通信设计天然适合「Agent ↔ Agent」:让一个 Agent 把自己暴露成 MCP server,另一个 Agent 就能调用它。

IHUI-AI 正在尝试这条路:把每个用户创建的 Agent 自动注册成 MCP server,通过 `ihui://agents/{id}` 资源 URI 让其他 Agent 发现并调用,形成「Agent 网络」。

如果你也在做 AI Agent 产品,值得现在就把工具层切到 MCP,等协议生态成熟再切就要重写一遍。

---

**相关链接**

- 项目仓库:<https://github.com/IHUI-INF-AI/IHUI-AI>
- 官网:<https://aizhs.top>
- MCP 官方文档:<https://modelcontextprotocol.io>

如果这篇文章对你有启发,欢迎到 GitHub 给 IHUI-AI 点个 Star ⭐,也欢迎来官网体验我们用 MCP 串联起来的 Agent 工作流。

---

**SEO 关键词**:`MCP`、`Model Context Protocol`、`AI 工具集成`、`Anthropic MCP`、`MCP server`、`Function Call 对比`、`JSON-RPC`、`Agent 协议`
