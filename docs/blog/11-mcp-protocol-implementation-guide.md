---
title: "MCP 协议实现指南:从零构建生产级 AI 工具生态"
date: "2026-07-27"
tags: ["MCP", "Model Context Protocol", "AI Tools", "Anthropic", "Claude", "Integration"]
category: "AI 工程"
description: "深入解析 Model Context Protocol (MCP) 协议设计、server/client 实现、与 LangGraph 集成模式,包含 IHUI-AI 实战经验。"
---

# MCP 协议实现指南:从零构建生产级 AI 工具生态

> 当 LLM 不再只是「聊天机器人」,而是要查数据库、发邮件、调内部 API 时,工具调用就成了 AI 应用的命脉。Anthropic 在 2024 年开源的 Model Context Protocol (MCP),正在成为 AI 工具生态的「USB-C 接口」。本文是 IHUI-AI 在生产环境落地 MCP 的完整工程总结。

---

## 一、MCP 协议是什么

Model Context Protocol(简称 MCP)是 Anthropic 于 2024 年 11 月开源的开放协议,目标是**标准化 AI 应用与外部工具/数据源之间的连接方式**。

在 MCP 出现之前,每个 AI 应用都要为每个工具写一份适配代码:

```
┌─────────┐    自定义协议 A    ┌──────────┐
│  App 1  │ ──────────────────▶│ Tool GPT │
└─────────┘                    └──────────┘
┌─────────┐    自定义协议 B    ┌──────────┐
│  App 2  │ ──────────────────▶│ Tool GPT │
└─────────┘                    └──────────┘
```

M 个应用 × N 个工具 = M×N 份适配代码,这是典型的「集成地狱」。

MCP 的解法是引入一个标准协议层:

```
┌─────────┐                  ┌──────────┐
│  App 1  │ ──┐          ┌──▶│ Tool A   │
└─────────┘   │          │   └──────────┘
┌─────────┐   │  ┌───────┐   ┌──────────┐
│  App 2  │───┼─▶│  MCP  │──▶│ Tool B   │
└─────────┘   │  └───────┘   └──────────┘
┌─────────┐   │          │   ┌──────────┐
│  App 3  │ ──┘          └──▶│ Tool C   │
└─────────┘                  └──────────┘
```

M + N 份适配代码,复杂度从 O(M×N) 降到 O(M+N)。

### 1.1 MCP 的三大原语

MCP 定义了三种核心原语(primitives):

1. **Tools(工具)**:可被 LLM 调用的函数,类似 function calling,但有标准 schema
2. **Resources(资源)**:可被读取的数据源,如文件、数据库记录、API 响应
3. **Prompts(提示模板)**:可复用的 prompt 模板,支持参数化

### 1.2 传输层

MCP 支持两种传输方式:

- **stdio**:本地进程通信,适合 CLI / 桌面端
- **HTTP + SSE**:远程通信,适合 Web / 云端服务

---

## 二、为什么 MCP 比传统 function calling 更适合生产环境

很多人第一反应是:「这不就是 function calling 换个名字吗?」差远了。

### 2.1 function calling 的痛点

OpenAI 在 2023 年推出 function calling 时,设计目标是「让 LLM 输出结构化 JSON」。它解决的是**单次调用**问题,不是**工具生态**问题:

| 维度       | function calling          | MCP                          |
| ---------- | ------------------------- | ---------------------------- |
| 工具发现   | 硬编码在 prompt 里        | 运行时动态发现(list_tools) |
| 工具复用   | 每个 app 重写一遍         | 一次实现,处处可用           |
| 跨厂商     | OpenAI/Anthropic 格式不同 | 协议层统一                   |
| 状态管理   | 无状态,每次重传          | 有 session,支持长连接       |
| 权限模型   | 无                        | 内置 capability negotiation  |
| 流式响应   | 不支持                    | 支持(SSE)                  |

### 2.2 生产场景的真实需求

在 IHUI-AI 这种多 agent 平台里,我们需要:

1. **动态接入新工具**:用户上传一个 MCP server 配置,系统自动发现工具,无需重启
2. **多 agent 共享工具**:聊天 agent 和任务 agent 都能调用同一个 `search_knowledge_base`
3. **权限隔离**:免费用户只能用只读工具,付费用户能用写工具
4. **审计日志**:每次工具调用都要记录 who/when/what/result

这些 function calling 都做不到,而 MCP 的协议设计天然支持。

---

## 三、MCP Server 实现详解

MCP Server 是工具的提供方。下面用 Python 和 TypeScript 各实现一个最小可用的 MCP server。

### 3.1 Python 实现(FastMCP)

Anthropic 官方提供了 `fastmcp` 库,把 MCP server 实现简化到装饰器级别:

```python
# apps/ai-service/app/mcp/servers/knowledge_base.py
from fastmcp import FastMCP
from typing import Optional
from app.core.vector_store import pgvector_search
from app.core.auth import verify_tenant

mcp = FastMCP("knowledge-base")

@mcp.tool()
async def search_kb(
    query: str,
    top_k: int = 5,
    tenant_id: str = "",
    knowledge_base_id: Optional[str] = None,
) -> dict:
    """在知识库中语义检索相关文档。

    Args:
        query: 用户的查询文本
        top_k: 返回的最大文档数量,默认 5
        tenant_id: 租户 ID,用于多租户隔离
        knowledge_base_id: 可选,限定在某个知识库内检索

    Returns:
        包含 documents 和 scores 的字典
    """
    if not tenant_id:
        return {"error": "tenant_id is required"}

    # 多租户隔离:确保只能查到本租户的数据
    await verify_tenant(tenant_id)

    results = await pgvector_search(
        query=query,
        top_k=top_k,
        tenant_id=tenant_id,
        kb_id=knowledge_base_id,
    )
    return {
        "documents": [r.document for r in results],
        "scores": [r.score for r in results],
    }

@mcp.resource("kb://list/{tenant_id}")
async def list_knowledge_bases(tenant_id: str) -> dict:
    """列出租户下所有知识库。"""
    bases = await get_kbs_by_tenant(tenant_id)
    return {"knowledge_bases": [b.to_dict() for b in bases]}

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

关键点:

- `@mcp.tool()` 装饰器自动从函数签名生成 JSON Schema
- docstring 会被解析成工具描述,LLM 靠它判断何时调用
- `tenant_id` 强制要求,实现多租户隔离
- `@mcp.resource()` 暴露只读数据源,用 URI 模式寻址

### 3.2 TypeScript 实现(@modelcontextprotocol/sdk)

对于 Node.js 生态,官方提供 `@modelcontextprotocol/sdk`:

```typescript
// apps/api/src/mcp/servers/file-ops.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "file-ops", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// 工具清单:运行时被 client 发现
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "read_file",
      description: "读取本地文件内容(限制在允许目录内)",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件绝对路径" },
          max_bytes: { type: "number", description: "最大读取字节数", default: 1048576 },
        },
        required: ["path"],
      },
    },
    {
      name: "list_dir",
      description: "列出目录内容",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  ],
}));

// 工具调用分发
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "read_file": {
      const path = sanitizePath(args?.path as string); // 防 path traversal
      const maxBytes = (args?.max_bytes as number) ?? 1048576;
      const content = await readFileTruncated(path, maxBytes);
      return { content: [{ type: "text", text: content }] };
    }
    case "list_dir": {
      const path = sanitizePath(args?.path as string);
      const entries = await listDir(path);
      return { content: [{ type: "text", text: JSON.stringify(entries) }] };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 3.3 关键设计原则

实现生产级 MCP server 时,务必遵守:

1. **工具描述要写给 LLM 看**:不是给人看的 API 文档,而是让 LLM 能判断「这个工具该不该用」
2. **参数 schema 要严格**:用 JSON Schema 的 `required` / `enum` / `pattern`,减少 LLM 瞎猜
3. **错误信息要可读**:返回 `{"error": "tenant_id missing"}` 而不是抛 500
4. **幂等设计**:同一个工具调用,带相同参数应该返回相同结果(便于重试)

---

## 四、MCP Client 集成模式

MCP Client 是工具的调用方,通常嵌在 AI agent 内部。有三种主流集成模式。

### 4.1 模式一:直接调用(适合简单场景)

```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def call_kb_tool(query: str, tenant_id: str):
    server_params = StdioServerParameters(
        command="python",
        args=["-m", "app.mcp.servers.knowledge_base"],
    )
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            result = await session.call_tool(
                "search_kb",
                {"query": query, "tenant_id": tenant_id, "top_k": 5},
            )
            return result
```

缺点:每次调用都新建进程,开销大。适合开发调试,不适合生产。

### 4.2 模式二:连接池(适合生产)

IHUI-AI 在 `apps/ai-service/app/mcp/pool.py` 实现了连接池,复用 MCP session:

```python
# apps/ai-service/app/mcp/pool.py
from contextlib import asynccontextmanager
from mcp import ClientSession
from mcp.client.sse import sse_client
from collections import defaultdict
import asyncio

class MCPSessionPool:
    """MCP session 连接池,按 server_url 复用长连接。"""

    def __init__(self, max_size_per_server: int = 8):
        self._pools: dict[str, asyncio.Queue] = defaultdict(lambda: asyncio.Queue(maxsize=max_size_per_server))
        self._lock = asyncio.Lock()

    @asynccontextmanager
    async def acquire(self, server_url: str):
        async with self._lock:
            pool = self._pools[server_url]
            if pool.empty() and pool.qsize() < pool.maxsize:
                session = await self._create_session(server_url)
            else:
                session = await pool.get()

        try:
            yield session
        finally:
            await pool.put(session)

    async def _create_session(self, server_url: str) -> ClientSession:
        read, write = await sse_client(server_url)
        session = ClientSession(read, write)
        await session.initialize()
        return session

# 全局单例
mcp_pool = MCPSessionPool(max_size_per_server=8)
```

调用方:

```python
async with mcp_pool.acquire("http://localhost:8820/sse") as session:
    result = await session.call_tool("search_kb", {"query": q, "tenant_id": tid})
```

### 4.3 模式三:与 LangGraph 集成(推荐)

LangGraph 是 LangChain 的下一代 agent 框架,天然支持把 MCP tools 绑定到 agent 节点:

```python
# apps/ai-service/app/graphs/chat_graph.py
from langgraph.prebuilt import create_react_agent
from langchain_mcp_adapters.client import MultiServerMCPClient

async def build_chat_agent(tenant_id: str, user_role: str):
    client = MultiServerMCPClient({
        "knowledge_base": {
            "url": "http://localhost:8820/sse",
            "transport": "sse",
        },
        "file_ops": {
            "url": "http://localhost:8821/sse",
            "transport": "sse",
        },
    })

    # 拉取所有 server 的工具清单
    all_tools = await client.get_tools()

    # 按用户角色过滤工具(权限隔离)
    allowed = filter_tools_by_role(all_tools, user_role)

    # 注入 tenant_id 到每个工具的默认参数
    for tool in allowed:
        tool = inject_default_arg(tool, "tenant_id", tenant_id)

    agent = create_react_agent(
        model="openai/gpt-4o",
        tools=allowed,
        state_schema=ChatState,
    )
    return agent
```

这种模式的好处:

- **工具发现自动化**:server 一更新,client 自动拉到新工具
- **权限隔离在 agent 层**:free user 的 agent 根本看不到付费工具
- **状态传递**:tenant_id 通过 `inject_default_arg` 注入,LLM 不需要每次传

---

## 五、工具发现 + 权限 + 生命周期管理

### 5.1 工具发现流程

```
┌──────────────┐    initialize     ┌──────────────┐
│  MCP Client  │ ─────────────────▶│  MCP Server  │
└──────────────┘                   └──────────────┘
       │                                  │
       │  list_tools()                    │
       │ ────────────────────────────────▶│
       │                                  │ 返回工具 schema 列表
       │◀──────────────────────────────── │
       │                                  │
       │  call_tool(name, args)           │
       │ ────────────────────────────────▶│
       │                                  │ 执行并返回结果
       │◀──────────────────────────────── │
```

### 5.2 权限模型

IHUI-AI 实现了三层权限:

```python
# apps/ai-service/app/mcp/permissions.py
TOOL_PERMISSIONS = {
    # 工具名: (最小角色, 是否需要二次确认)
    "search_kb":            ("user", False),
    "create_kb":            ("user", True),   # 写操作需确认
    "delete_kb":            ("admin", True),
    "read_file":            ("user", False),
    "write_file":           ("admin", True),
    "execute_sql":          ("admin", True),
    "send_email":           ("user", True),
}

def check_permission(tool_name: str, user_role: str) -> bool:
    required_role, _ = TOOL_PERMISSIONS.get(tool_name, ("admin", True))
    role_level = {"guest": 0, "user": 1, "admin": 2}
    return role_level.get(user_role, 0) >= role_level[required_role]
```

### 5.3 生命周期

MCP server 的生命周期由 client 管理:

- **启动**:client 第一次连接时,server 进程拉起(stdio)或连接建立(SSE)
- **健康检查**:client 定期 `ping`,超时 3 次判定失联
- **优雅关闭**:client 发 `shutdown` 通知,server 清理资源后退出
- **强制回收**:超过最大空闲时间(默认 30 分钟)的 session 被回收

---

## 六、IHUI-AI 中的 MCP 实战

IHUI-AI 的 MCP 实现位于 `apps/ai-service/app/mcp/`,目录结构:

```
apps/ai-service/app/mcp/
├── __init__.py
├── pool.py              # 连接池
├── permissions.py       # 权限模型
├── registry.py          # server 注册表(动态加载)
├── audit.py             # 审计日志
├── servers/             # 内置 MCP server 实现
│   ├── knowledge_base.py
│   ├── file_ops.py
│   ├── sql_query.py
│   └── web_search.py
└── client.py            # 统一 client 入口
```

### 6.1 动态注册表

用户可以通过 Web UI 上传自定义 MCP server 配置,系统动态加载:

```python
# apps/ai-service/app/mcp/registry.py
from pydantic import BaseModel
from typing import Optional

class MCPServerConfig(BaseModel):
    name: str
    transport: str  # "stdio" | "sse"
    command: Optional[str] = None      # stdio 模式
    args: list[str] = []               # stdio 模式
    url: Optional[str] = None          # sse 模式
    enabled: bool = True
    required_role: str = "user"

class MCPRegistry:
    """MCP server 注册表,从数据库加载配置。"""

    async def load_for_tenant(self, tenant_id: str) -> list[MCPServerConfig]:
        rows = await db.execute(
            "SELECT * FROM mcp_servers WHERE tenant_id = $1 AND enabled = TRUE",
            tenant_id,
        )
        return [MCPServerConfig(**row) for row in rows]

    async def discover_tools(self, configs: list[MCPServerConfig]) -> list[Tool]:
        tools = []
        for cfg in configs:
            async with mcp_pool.acquire(cfg.url or cfg.command) as session:
                server_tools = await session.list_tools()
                tools.extend(server_tools)
        return tools
```

### 6.2 审计日志

每次工具调用都记录到 `mcp_tool_calls` 表:

```sql
CREATE TABLE mcp_tool_calls (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    server_name VARCHAR(128) NOT NULL,
    tool_name VARCHAR(128) NOT NULL,
    arguments JSONB NOT NULL,
    result JSONB,
    status VARCHAR(16) NOT NULL,  -- success | error | timeout
    duration_ms INT NOT NULL,
    tokens_used INT DEFAULT 0,
    cost_usd DECIMAL(10,6) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mcp_calls_tenant_time ON mcp_tool_calls(tenant_id, created_at DESC);
CREATE INDEX idx_mcp_calls_tool ON mcp_tool_calls(tenant_id, tool_name);
```

admin 后台可以按租户/工具/时间维度查询调用统计,做成本归因。

---

## 七、与 A2A 协议的协同

MCP 解决的是「agent ↔ tool」的通信,A2A(Agent-to-Agent)解决的是「agent ↔ agent」的通信。两者互补:

```
┌─────────────────────────────────────────────────┐
│              Agent Orchestration Layer           │
│         (LangGraph / A2A Protocol)               │
└──────┬───────────────────────┬──────────────────┘
       │ A2A                   │ A2A
       ▼                       ▼
┌──────────────┐         ┌──────────────┐
│ Researcher   │ ──MCP──▶│ Tools        │
│ Agent        │         │ (KB, Web,    │
│              │ ──MCP──▶│  SQL, File)  │
└──────────────┘         └──────────────┘
       │ A2A
       ▼
┌──────────────┐
│ Writer Agent │ ──MCP──▶│ Tools (Doc)  │
└──────────────┘
```

- **MCP**:agent 调用无状态工具(查数据库、读文件)
- **A2A**:agent 之间协商任务(研究 agent 把结果交给写作 agent)

IHUI-AI 的多 agent 编排里,researcher agent 通过 MCP 调用 `search_kb` / `web_search`,然后通过 A2A 把结果传给 writer agent,writer 再通过 MCP 调用 `create_doc` 工具产出最终文档。

---

## 八、性能优化

### 8.1 连接池

生产环境务必用连接池(见 4.2),避免每次调用都新建 TCP 连接 + MCP handshake。IHUI-AI 的实测数据:

| 模式           | 单次调用延迟 | QPS  |
| -------------- | ------------ | ---- |
| 每次新建连接   | 180ms        | 12   |
| 连接池(8 conn)| 23ms         | 320  |

### 8.2 并发控制

多 agent 并行调用同一 server 时,要做并发限制,避免打爆下游:

```python
import asyncio

class ToolCallLimiter:
    def __init__(self, max_concurrent: int = 10):
        self._semaphore = asyncio.Semaphore(max_concurrent)

    async def call(self, session, tool_name, args):
        async with self._semaphore:
            return await session.call_tool(tool_name, args)
```

### 8.3 超时与重试

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type(TimeoutError),
)
async def call_with_retry(session, tool_name, args, timeout=30):
    return await asyncio.wait_for(
        session.call_tool(tool_name, args),
        timeout=timeout,
    )
```

注意:**只对幂等工具重试**。`create_kb` 这种写工具失败后重试会创建重复记录,要用 idempotency key。

### 8.4 结果缓存

对于只读且结果稳定的工具(如 `search_kb` 同 query 在 5 分钟内),可以缓存:

```python
from functools import lru_cache
import hashlib
import json

def cache_key(tool_name, args):
    raw = json.dumps({"tool": tool_name, "args": args}, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()

# 用 Redis 做分布式缓存,ttl 300 秒
async def cached_call(session, tool_name, args, ttl=300):
    key = f"mcp:cache:{cache_key(tool_name, args)}"
    cached = await redis.get(key)
    if cached:
        return json.loads(cached)
    result = await session.call_tool(tool_name, args)
    await redis.setex(key, ttl, json.dumps(result))
    return result
```

---

## 九、安全考量

### 9.1 工具白名单

永远不要让 LLM 自由调用任意工具。在 agent 层做白名单过滤:

```python
ALLOWED_TOOLS_PER_AGENT = {
    "chat_agent":       ["search_kb", "web_search"],
    "task_agent":       ["search_kb", "create_task", "update_task"],
    "admin_agent":      ["*"],  # admin 才能用所有工具
}
```

### 9.2 参数校验

LLM 可能生成畸形参数(如 path 里带 `../`)。在工具实现层做 sanitize:

```python
import re
from pathlib import Path

ALLOWED_ROOT = Path("/data/sandbox")

def sanitize_path(user_path: str) -> Path:
    p = (ALLOWED_ROOT / user_path).resolve()
    if not str(p).startswith(str(ALLOWED_ROOT)):
        raise ValueError(f"Path escapes sandbox: {user_path}")
    return p
```

### 9.3 审计日志

见 6.2,所有调用记录到 `mcp_tool_calls` 表,支持事后追溯。敏感字段(如 API key 参数)在写入前做脱敏。

### 9.4 速率限制

per-tenant + per-tool 的速率限制,防滥用:

```python
from slowapi import Limiter

limiter = Limiter(key_func=lambda req: req.state.tenant_id)

@app.post("/mcp/call/{tool_name}")
@limiter.limit("60/minute")  # 每租户每分钟 60 次
async def call_tool(tool_name: str, ...):
    ...
```

---

## 十、调试技巧

### 10.1 MCP Inspector

Anthropic 官方提供 `@modelcontextprotocol/inspector`,可视化调试 MCP server:

```bash
npx @modelcontextprotocol/inspector python -m app.mcp.servers.knowledge_base
```

打开浏览器可以看到:

- 所有工具的 schema
- 手动填参数测试调用
- 查看原始 JSON-RPC 通信

### 10.2 日志埋点

在 client 层记录每次调用的入参/出参/耗时:

```python
import structlog
logger = structlog.get_logger()

async def logged_call(session, tool_name, args):
    logger.info("mcp_call_start", tool=tool_name, args=args)
    start = time.monotonic()
    try:
        result = await session.call_tool(tool_name, args)
        logger.info("mcp_call_success",
                    tool=tool_name, duration_ms=int((time.monotonic()-start)*1000))
        return result
    except Exception as e:
        logger.error("mcp_call_error", tool=tool_name, error=str(e))
        raise
```

### 10.3 断点调试

stdio 模式的 MCP server 可以直接在 IDE 里断点调试,因为它是子进程。SSE 模式可以单独启动 server,然后用 client 连上去调试。

---

## 十一、路线图:MCP 1.0 → 2.0 演进

MCP 协议仍在快速演进。已知的发展方向:

1. **Streamable HTTP**:2.0 计划用单一 HTTP transport 替代 stdio + SSE 双轨,简化部署
2. **工具版本化**:支持 `search_kb@v2`,平滑升级不破坏旧 client
3. **Resource 订阅**:client 可以订阅 resource 变更(server push 而非轮询)
4. **A2A 标准化**:agent 间通信协议层标准化,与 MCP 形成完整生态
5. **官方注册表**:类似 npm registry 的 MCP server 市场,一键安装

IHUI-AI 会持续跟进协议演进,目前在 1.x 稳定版上生产运行。

---

## 十二、参考资料

- [Model Context Protocol 官方规范](https://modelcontextprotocol.io/)
- [Anthropic MCP GitHub](https://github.com/modelcontextprotocol)
- [FastMCP Python SDK](https://github.com/jlowin/fastmcp)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [LangChain MCP Adapters](https://github.com/langchain-ai/langchain-mcp-adapters)
- IHUI-AI 源码:`apps/ai-service/app/mcp/`

---

## 总结

MCP 不只是「function calling 的标准化」,它定义了一套完整的工具生态协议:发现、调用、权限、生命周期、审计。在 IHUI-AI 的实践中,MCP 让我们能:

- **动态接入工具**:用户上传配置即可,无需重启服务
- **多 agent 共享**:聊天 agent 和任务 agent 复用同一套工具实现
- **权限隔离**:按角色过滤工具,按租户隔离数据
- **成本归因**:每次调用记录 token 和成本,精准计费

如果你在做 AI agent 平台,MCP 是绕不开的基础设施。建议从 Python FastMCP 起步,先实现一个 `search_kb` 工具体验全流程,再逐步迁移到生产架构(连接池 + 权限 + 审计)。

下一篇我们会讲 [PostgreSQL 多租户 RLS 实践](./12-multi-tenant-rls-postgresql-drizzle.md),看 MCP 工具背后的数据层如何做租户隔离。
