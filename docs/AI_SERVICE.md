# AI 服务深度文档(apps/ai-service)

> IHUI-AI 的 AI 推理网关 —— Python FastAPI + LangGraph + LiteLLM + MCP + A2A + Socket.IO,提供 LLM 调用、Agent 执行、MCP 工具、A2A 协议、向量记忆等 AI 能力。本文档聚焦模块内部实现细节,系统级架构见 [architecture.md](./architecture.md) §5,LLM 厂商接入见 [LLM_SETUP.md](./LLM_SETUP.md)。

---

## 1. 总览

| 维度 | 说明 |
|------|------|
| 技术栈 | FastAPI 0.115 + Uvicorn + LangGraph 0.2 + LiteLLM + MCP SDK + Socket.IO 5 + Pydantic Settings |
| 端点数 | ~55(6 核心 Router + 业务扩展 Router) |
| 默认端口 | `3003`(`core/config.py` 默认),Docker Compose 生产编排映射 `8000` |
| ASGI 拓扑 | 根 app = `socketio.ASGIApp(sio, other_asgi_app=fastapi_app)`,`/socket.io/*` → Socket.IO,其余 → FastAPI |
| 启动入口 | `app/main.py:create_app()` 创建 FastAPI 实例 + 注册 6 核心 Router + 中间件栈 |
| 存储依赖 | PostgreSQL(`DATABASE_URL`)+ Redis(`REDIS_URL`,可选,失败降级内存) |
| Stub 模式 | 无任何 LLM API key 时自动启用,返回确定性 mock 响应,适合本地调试 UI |

> ⚠️ 审计 AI 能力迁移时**必须同时看 `apps/ai-service` + `apps/api`**,不可仅看单一 app(详见 [architecture.md](./architecture.md) §0)。

---

## 2. 模块结构

```
apps/ai-service/
├── app/
│   ├── main.py                    # FastAPI 入口,注册 Router + 中间件 + Socket.IO ASGI 拼接
│   ├── __init__.py                # __version__ 版本号
│   ├── telemetry.py               # OpenTelemetry 追踪初始化(未配置端点时降级 no-op)
│   ├── routers/                   # 路由层(见 §3)
│   ├── services/                  # 业务服务层(见 §4-§12)
│   ├── core/                      # 核心基础设施(见 §13)
│   ├── api/                       # v1 业务流路由(对话/智能体/RAG)
│   │   ├── v1/                    # v1 版本路由(chat/agent/debug/lsp/rag/knowledge_graph)
│   │   ├── dag.py                 # DAG 调度 API
│   │   ├── memory.py              # 四层记忆系统 API
│   │   └── message_bus.py         # 多通道消息总线 API
│   ├── middleware/                # 中间件层
│   │   ├── audit.py               # 审计日志(POST/PATCH/PUT/DELETE 全记录)
│   │   ├── input_sanitizer.py     # XSS + Prompt Injection 检测 + 限流
│   │   ├── response_sanitizer.py  # 敏感字段脱敏(替换 ***)
│   │   └── trace_context.py       # W3C traceparent 上下文解析
│   ├── providers/                 # LLM 厂商适配器(17 provider)
│   ├── sio/                       # Socket.IO 处理器(connect/disconnect/chat_message)
│   ├── skills/                    # Skill 资源目录(content_engine/koubo_workflow/auto)
│   ├── data/                      # 静态数据(default_models.json 模型清单)
│   └── types/                     # 类型定义(api_client.py)
├── tests/                         # pytest 测试(35 文件,400+ 用例)
├── pyproject.toml                 # Python 包配置
├── Dockerfile                     # 多阶段构建
├── .env.example                   # 环境变量模板
└── requirements.txt               # 依赖锁定
```

### routers/ 文件用途

| 文件 | 前缀 | 端点数 | 用途 |
|------|------|--------|------|
| `a2a.py` | `/api/a2a` | 5 | Agent-to-Agent 协议 HTTP 入口 |
| `agents.py` | `/api/agents` | 11 | Agent 执行 + 会话记忆 + 多 Agent 协商 |
| `health.py` | (无) | 4 | 健康检查 + Readiness 探针 |
| `llm.py` | `/api/llm` | 8 | LLM 调用 + 流式 + MoA + Vision + Embeddings |
| `mcp.py` | `/api/mcp` | 13 | MCP 工具/资源/提示词/Skill/Slash/Sampling |
| `tools.py` | `/api/tools` | 3 | 工具直接调用入口(绕过 MCP 协议) |
| `agent_runtime.py` | `/api/agent-runtime` | - | Agent 运行时控制 |
| `personas.py` | `/api/personas` | - | Persona 人格管理 |
| `voice_stt.py` | `/api/voice` | - | 语音 STT(火山引擎) |
| `self_media.py` | `/api/self-media` | - | 自媒体内容生成(公众号 + 口播稿) |
| `publish.py` | `/api/publish` | - | 多平台一键发布(14 平台) |
| `opencompass.py` | `/api/opencompass` | - | OpenCompass 排行榜抓取(Playwright) |
| `screenshot.py` | `/api/screenshot` | - | 截图服务(Playwright headless) |
| `legacy.py` | - | - | 兼容历史 coze_zhs_py 客户端 |

### services/ 文件用途

| 文件 | 用途 |
|------|------|
| `langgraph_service.py` | LangGraph 工作流(plan → execute → summarize,见 §4) |
| `agent_loop.py` | Agent 执行器,带任务跟踪(见 §13) |
| `mcp_server.py` | MCP 协议服务端,11 工具 + 3 资源 + 3 提示词(见 §6) |
| `a2a_service.py` | A2A 协议,Redis 持久化 + 内存降级(见 §7) |
| `vector_memory.py` | 向量记忆,嵌入 + 余弦相似度语义搜索(见 §8) |
| `memory.py` | 内存服务,Redis + 内存降级(见 §9) |
| `skills.py` | Skills 系统,6 预置 skill + 自进化(见 §10) |
| `slash_commands.py` | Slash 命令,12 命令(见 §11) |
| `dag_scheduler.py` | DAG 调度器,asyncio.gather 同层真并行(见 §14) |
| `agent_orchestrator.py` | 多 Agent 协商(debate/vote/critique) |
| `agent_comm.py` | Agent 通信 |
| `agent_graph.py` | Agent 图结构 |
| `agent_checkpoint.py` | Agent 检查点持久化 |
| `agent_loop_v2.py` | Agent 执行器 v2 |
| `conversation.py` | 对话管理 |
| `codebase_indexer.py` | 代码库索引(pgvector ANN) |
| `debugger.py` | 调试器 |
| `dream_service.py` | Dream 梦境系统 |
| `knowledge_graph.py` | 知识图谱 |
| `koubo_workflow.py` | 口播稿工作流 |
| `lmarena_scrape.py` | LM Arena 排行榜抓取 |
| `memory_decay.py` | 记忆衰减 |
| `memory_extractor.py` | 记忆提取器 |
| `memory_service.py` | 四层记忆服务 |
| `message_bus.py` | 多通道消息总线 |
| `model_router.py` | 模型路由(MoA) |
| `opencompass_scrape.py` | OpenCompass 抓取 |
| `persona_registry.py` | Persona 注册表 |
| `project_memory.py` | 项目记忆(CLAUDE.md/AGENTS.md 注入) |
| `rag.py` | RAG 检索增强 |
| `sandbox.py` | 沙箱执行 |
| `scheduler.py` | 任务调度 |
| `screenshot_service.py` | 截图服务(Playwright) |
| `self_media_scheduler.py` | 自媒体定时调度 |
| `skill_feedback.py` | Skill 反馈追踪 |
| `skill_iterator.py` | Skill 迭代优化 |
| `skill_tester.py` | Skill 自动测试 |
| `task_decomposer.py` | 任务分解器 |
| `user_profile.py` | 用户画像 |
| `audit_service.py` | 审计服务 |
| `publish/` | 多平台发布(14 平台 adapter + AES-256-GCM 凭证加密 + 调度器) |

### core/ 文件用途

| 文件 | 用途 |
|------|------|
| `config.py` | Pydantic Settings,小写字段名,从 .env 加载(见 §13) |
| `llm_gateway.py` | LiteLLM 网关,多模型统一接口 + stub 模式 + astream 流式(见 §5) |
| `logging.py` | Python logging 配置 |
| `sse_buffer.py` | SSE 事件缓冲,断线重连重放(见 §12) |
| `context_compaction.py` | 上下文压缩(88% 阈值自动触发) |
| `compaction.py` | 压缩算法 |
| `jwt_auth.py` | JWT 认证中间件(与 apps/api 共享 JWT_SECRET,SSO 跨服务) |
| `question_parser.py` | 提问标记解析器(检测 `[[ASK_USER:JSON]]` 标记) |
| `schema_check.py` | ai_model_config 字段对照校验(防 TS schema 漂移) |

---

## 3. 6 个核心 Router 详解

> 所有 Router 在 `app/main.py` 中以 `prefix="/api"` 注册,完整路径形如 `/api/llm/complete`、`/api/mcp/tools`。

### 3.1 a2a Router(`routers/a2a.py`,5 端点)

Agent-to-Agent 协议 HTTP 入口。`send_task` 创建 pending 任务并异步执行,客户端轮询 `status` 直到 `completed`。

| 方法 | 路径 | 用途 | 鉴权 | 响应类型 |
|------|------|------|------|----------|
| POST | `/api/a2a/agents/register` | 注册 agent | JWT | `{id, name, capabilities, endpoint}` |
| GET | `/api/a2a/agents` | 列出所有已注册 agent | JWT | `{agents: [], count}` |
| POST | `/api/a2a/tasks` | 发送任务(创建 pending,异步执行) | JWT | `{task_id, name, status: "pending"}` |
| GET | `/api/a2a/tasks/{task_id}/status` | 查询任务状态 | JWT | `{task_id, status, ...}` |
| GET | `/api/a2a/tasks/{task_id}/result` | 获取任务结果 | JWT | `{task_id, result}` |

请求模型:

```python
class RegisterAgentRequest(BaseModel):
    id: str                    # agent 唯一 ID
    name: str                  # agent 名称
    description: str = ""
    capabilities: list[str] = []
    endpoint: str = ""

class SendTaskRequest(BaseModel):
    name: str                  # 任务名称
    description: str = ""
    input: dict[str, Any] = {} # 任务输入
    assigned_agent_id: str = ""
```

### 3.2 agents Router(`routers/agents.py`,11 端点)

提供 agent 执行(同步 + SSE 流式)、状态查询、取消、会话记忆管理、多 Agent 协商。

| 方法 | 路径 | 用途 | 鉴权 | 响应类型 |
|------|------|------|------|----------|
| POST | `/api/agents/execute` | 同步执行 agent | JWT | `{result, task_id}` |
| POST | `/api/agents/execute/stream` | SSE 流式执行(支持断线重连) | JWT | `text/event-stream` |
| GET | `/api/agents/running` | 列出运行中/已完成任务 | JWT | `{tasks: []}` |
| GET | `/api/agents/sessions` | 列出所有会话 ID | JWT | `{sessions: [], count}` |
| GET | `/api/agents/sessions/{session_id}/messages` | 获取会话消息列表 | JWT | `{session_id, messages: [], count}` |
| DELETE | `/api/agents/sessions/{session_id}` | 清除会话全部消息 | JWT | `{session_id, cleared: true}` |
| POST | `/api/agents/memory/search` | 语义搜索记忆(向量检索) | JWT | `{query, results: [], count}` |
| GET | `/api/agents/{task_id}/status` | 查询任务状态 | JWT | `{task_id, status}` |
| POST | `/api/agents/{task_id}/cancel` | 取消任务 | JWT | `{task_id, canceled, status}` |
| POST | `/api/agents/skill-evolution` | 手动触发 Skill 自进化评估 | JWT | `{code, message, data}` |
| POST | `/api/agents/debate` | 多 Agent 协商(debate/vote/critique) | JWT | `{code, message, data}` |

SSE 流式执行(`execute/stream`)优先使用 LangGraph 工作流(plan → execute → summarize),异常时降级为 `agent_executor.run_stream`。断线重连机制见 §12。

```python
class AgentExecuteRequest(BaseModel):
    goal: str                              # agent 目标/用户输入
    session_id: str | None = None          # 会话 ID,为空则新建
    model: str | None = None               # 指定模型,为空使用默认
    max_iterations: int | None = None      # 最大迭代次数
    tools: list[str] | None = None         # 允许调用的工具名列表
```

### 3.3 health Router(`routers/health.py`,4 端点)

无内置前缀,直接挂载在根路径。

| 方法 | 路径 | 用途 | 鉴权 | 响应类型 |
|------|------|------|------|----------|
| GET | `/` | 服务根端点,返回基本信息 | 公开 | `{service, version, docs, health}` |
| GET | `/health` | 综合健康(liveness,不检查依赖) | 公开 | `{status: "ok", service}` |
| GET | `/health/live` | Liveness 探针 | 公开 | `{status: "alive"}` |
| GET | `/health/ready` | Readiness 探针(检查 LLM 配置 + litellm 可用性) | 公开 | `{status: "ready"/"not_ready", checks}` |

Readiness 检查项:

- `llm_configured`:至少配置一个 provider API key(非 stub 模式)
- `stub_mode`:stub 模式也算 ready
- `litellm_available`:真实模式下检查 litellm 是否可导入

### 3.4 llm Router(`routers/llm.py`,8 端点)

提供 LLM 直接调用、SSE 流式、MoA 多模型聚合、Vision 视觉分析、Embeddings 向量生成。

| 方法 | 路径 | 用途 | 鉴权 | 响应类型 |
|------|------|------|------|----------|
| POST | `/api/llm/complete` | 直接调用 LLM(支持 function calling) | JWT | `{content, model, usage, stub}` |
| GET | `/api/llm/models` | 返回可用模型列表(从 `data/default_models.json` 热加载) | JWT | `{models: [], default, stub_mode}` |
| POST | `/api/llm/complete/stream` | 流式 LLM 调用(token 级 SSE + 心跳保活) | JWT | `text/event-stream` |
| GET | `/api/llm/moa-presets` | 列出所有 MoA 预设 | JWT | `{code, message, data}` |
| POST | `/api/llm/moa-presets` | 注册 MoA 预设(proposer/aggregator/critic 角色) | JWT | `{code, message}` |
| POST | `/api/llm/moa-complete` | MoA 推理(多模型出方案 + 聚合) | JWT | `{code, message, data}` |
| POST | `/api/llm/vision` | 视觉分析(图像 URL/base64 + 任务描述) | JWT | `{code, message, data}` |
| POST | `/api/llm/embeddings` | 生成文本嵌入向量(OpenAI 兼容格式) | JWT | `{object: "list", data: [], model, usage}` |

**错误标准化**(P1,2026-07-22 立):错误统一返回 HTTP 4xx/5xx + 结构化 JSON,而非 HTTP 200 + `result.error: True`:

| errorCode | HTTP 状态码 | 含义 |
|-----------|------------|------|
| `MODEL_NOT_CONFIGURED` | 422 | API key 未配置 |
| `PROVIDER_NOT_IMPLEMENTED` | 501 | provider 未实现 |
| `LLM_ERROR` | 502 | LLM 调用失败 |

**SSE 事件类型**(`complete/stream`):

| event | data 结构 | 说明 |
|-------|----------|------|
| `chunk` | `{"content": "..."}` | 逐 token 内容 |
| `reasoning` | `{"content": "..."}` | 推理过程(支持 reasoning 的模型) |
| `done` | `{"model", "usage", "stub", "metadata"}` | 完成 |
| `error` | `{"message", "errorCode"}` | 错误 |
| `question` | `{"question": {...}}` | 结构化提问(检测 `[[ASK_USER:JSON]]` 标记) |
| `tool-call-start` | `{"toolCallId", "toolName", "args", "iteration"}` | 工具调用开始(Agent tool loop) |
| `tool-result` | `{"toolCallId", "toolName", "result", "isError", "iteration"}` | 工具执行结果 |
| `compaction` | `{"triggered", "tokensBefore", "tokensAfter"}` | 上下文压缩通知 |

**Agent tool loop**(2026-07-22 立):请求携带 `agent_tools`(工具名列表)时,走多轮 tool loop:`complete(tools)` → 执行 `tool_calls` → 回灌结果 → 继续 astream 生成最终回复,支持 AI 浏览器/电脑控制连续操作。

**工作区上下文注入**:请求携带 `workspace_path` 时,自动加载 `CLAUDE.md`/`AGENTS.md`/`.ihui/memory.md` 项目记忆,用 `<workspace_memory>` XML 隔离标签包裹注入 system message(防 prompt injection)。

**异步回调**:推理完成后异步 POST 结果到 `callback_url`(默认 `{api_service_url}/api/ai/callback`),携带 `X-Internal-Secret` 头,5xx 重试 2 次(指数退避)。

```python
class LLMCompleteRequest(BaseModel):
    messages: list[dict[str, Any]]            # OpenAI 格式消息列表
    model: str | None = None                  # 模型名称
    tools: list[dict[str, Any]] | None = None # function calling 工具定义
    tool_choice: str | dict | None = None     # 工具选择策略
    temperature: float | None = None
    max_tokens: int | None = None
    metadata: dict[str, Any] | None = None    # 调用方元数据(透传到 done 事件)
    callback_url: str | None = None            # 推理完成后回调 URL
    workspace_path: str | None = None         # 工作区路径(注入项目记忆)
    context_limit: int | None = None          # 上下文窗口大小(达 88% 自动压缩)
    agent_tools: list[str] | None = None       # Agent 工具名列表(走 tool loop)
```

### 3.5 mcp Router(`routers/mcp.py`,13 端点)

提供工具、资源、提示词、Skill、Slash 命令的查询与调用。

| 方法 | 路径 | 用途 | 鉴权 | 响应类型 |
|------|------|------|------|----------|
| GET | `/api/mcp/tools` | 列出全部 MCP 工具 | JWT | `{tools: [], count}` |
| POST | `/api/mcp/tools/call` | 调用指定 MCP 工具(带权限矩阵校验) | JWT + 角色矩阵 | 工具返回值 |
| GET | `/api/mcp/resources` | 列出全部 MCP 资源 | JWT | `{resources: [], count}` |
| GET | `/api/mcp/resources/{uri:path}` | 读取指定 URI 的 MCP 资源 | JWT | 资源内容 |
| GET | `/api/mcp/prompts` | 列出全部 MCP 提示词 | JWT | `{prompts: [], count}` |
| POST | `/api/mcp/prompts/invoke` | 调用指定 MCP 提示词 | JWT | 提示词渲染结果 |
| GET | `/api/mcp/skills` | 列出全部预置 skill | JWT | `{skills: [], count}` |
| GET | `/api/mcp/skills/{name}` | 获取指定 skill 详情 | JWT | `{name, description, prompt_template}` |
| GET | `/api/mcp/slash-commands` | 列出全部 slash 命令 | JWT | `{commands: [], count}` |
| POST | `/api/mcp/slash-commands` | 执行 slash 命令 | JWT | `{command, output}` |
| POST | `/api/mcp/sampling` | MCP Sampling 反向调用 LLM(5 层护栏) | JWT | `{code, message, data}` |
| GET | `/api/mcp/sampling/stats` | Sampling 审计统计 | JWT | `{code, message, data}` |
| GET | `/api/mcp/sampling/audit-logs` | Sampling 审计日志列表 | JWT | `{code, message, data}` |

**工具权限矩阵**:admin 专属工具(`write_file`/`run_command`/`db_query`/`git_operations`/`computer_*` 系列)需 `role_id >= 1`,其他工具所有用户可用。

```python
class ToolCallRequest(BaseModel):
    name: str                              # 工具名称
    arguments: dict[str, Any] = {}         # 工具参数

class PromptInvokeRequest(BaseModel):
    name: str                              # 提示词名称
    arguments: dict[str, Any] = {}

class SlashCommandRequest(BaseModel):
    command: str                           # 命令名(不含 /)
    args: list[str] = []                  # 命令参数
    ctx: dict[str, Any] = {}              # 上下文
```

### 3.6 tools Router(`routers/tools.py`,3 端点)

工具直接调用入口,绕过 MCP 协议,适合无需权限校验的查询场景。

| 方法 | 路径 | 用途 | 鉴权 | 响应类型 |
|------|------|------|------|----------|
| POST | `/api/tools/search-codebase` | 搜索代码库(语义 + regex fallback) | JWT | `{tool, query, matches: [], total}` |
| POST | `/api/tools/search-web` | 网页搜索(DuckDuckGo Lite) | JWT | `{tool, query, results: []}` |
| POST | `/api/tools/analyze-code` | 代码静态分析 | JWT | `{tool, analysis}` |

```python
class SearchCodebaseRequest(BaseModel):
    query: str          # 搜索关键词或语义查询
    path: str = "."     # 搜索路径

class SearchWebRequest(BaseModel):
    query: str          # 搜索关键词
    max_results: int = 5

class AnalyzeCodeRequest(BaseModel):
    code: str           # 待分析代码
    language: str = "text"
```

---

## 4. LangGraph 工作流(services/langgraph_service.py)

> 系统级 AI 架构见 [architecture.md](./architecture.md) §5。本节聚焦工作流内部实现。

`LangGraphService` 使用 `langgraph.graph.StateGraph` 构建 plan → execute → summarize 三阶段工作流,LangGraph 不可用时降级为手动状态机(`WorkflowState`)。

### 状态定义(GraphState)

```python
class GraphState(TypedDict, total=False):
    goal: str                           # 用户目标
    session_id: str                     # 会话 ID
    model: str | None                   # 指定模型
    plan: list[str]                     # 规划步骤列表
    results: list[dict[str, Any]]       # 每步执行结果
    summary: str                        # 最终总结
    error: str | None                   # 错误信息
    step_index: int                     # 当前步骤索引
    iterations: int                     # 迭代次数
    status: str                         # planning/executing/summarizing/done/error
    trace: list[dict[str, Any]]         # 节点执行 trace(可观测性)
```

### 三阶段流程

| 阶段 | 节点 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| 规划 | `plan` | `goal` | `plan: list[str]` | LLM 分解目标为可执行步骤列表 |
| 执行 | `execute` | `plan[i]` | `results[i]` | 逐步执行,条件边判断是否完成 |
| 总结 | `summarize` | `results` | `summary: str` | LLM 汇总所有步骤结果 |

### 条件边

- `plan` 后:若 `plan` 非空 → `execute`;否则 → `error`
- `execute` 后:若 `step_index < len(plan)` → 继续执行下一步;否则 → `summarize`
- 任何节点失败 → `error` 节点

### Stub 模式

无 API key 时,`plan` 返回固定步骤、`execute` 返回 mock 结果、`summarize` 返回占位文本,工作流仍完整跑通,适合本地调试 UI。

### 可观测性

每个节点执行记录 trace 条目:`{node, start, end, duration_ms, status, error?, step?, plan_length?, iterations?}`,通过 `run_graph_stream` SSE 事件返回给客户端。

---

## 5. LiteLLM 网关(core/llm_gateway.py)

> LLM 厂商清单、API key 申请、成本估算见 [LLM_SETUP.md](./LLM_SETUP.md)。本节聚焦网关内部实现。

`llm_gateway` 封装 LiteLLM,提供多模型统一接口,支持 stub 模式(无 API key 时返回 mock)和 `astream` 流式输出。

### 核心方法

| 方法 | 用途 | 返回 |
|------|------|------|
| `complete(messages, model, owner_uuid, **kwargs)` | 同步调用 LLM(支持 tools/function calling) | `{content, model, usage, stub, tool_calls?}` |
| `astream(messages, model, owner_uuid)` | 流式调用(逐 token yield) | `AsyncGenerator[event]` |
| `embed(text, model)` | 生成嵌入向量(stub 模式返回确定性哈希向量) | `list[float]` |
| `_resolve(model, owner_uuid)` | 解析模型 → provider API key(支持 DB 动态配置) | `(api_key, base_url, provider)` |
| `_is_stub_mode()` | 判断是否 stub 模式 | `bool` |

### 模型解析

模型名前缀决定 provider(如 `stepfun/step-3.7-flash` → StepFun),`_resolve` 按优先级查找 API key:

1. **DB 动态配置**:`ai_model_config` 表(用户级配置,`api_key_enc` AES-256-GCM 加密,与 `apps/api` 共享 `CREDENTIALS_ENCRYPTION_KEY`)
2. **环境变量**:`STEPFUN_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY` 等(`settings.*_api_key`)
3. **Stub 模式**:全部为空时降级,返回确定性 mock 响应

### 共享 httpx 连接池

全局共享 `httpx.AsyncClient`(连接池复用),所有 provider 共用,关闭时 `close_http_client()` 清理。

### asyncpg 连接池

DB 配置查询用独立 `asyncpg.Pool`(非 Drizzle),关闭时 `_pool.close()`。

---

## 6. MCP 协议(services/mcp_server.py)

定义 11 工具、3 资源、3 提示词,提供统一查询/调用接口。工具实现为真实文件系统/网络操作,无外部依赖时返回降级结果。

### 6.1 工具清单(11 个)

| 工具名 | 用途 | 输入 schema | 输出 | 权限 |
|--------|------|-------------|------|------|
| `search_codebase` | 代码符号搜索(语义 pgvector ANN + regex fallback) | `{query, path, pattern, max_results, symbol_type, use_semantic}` | `{matches: [{path, line, symbol_type, code, preview, score?}]}` | 所有用户 |
| `read_file` | 读取文件(白名单校验,防 symlink 穿越) | `{path}` | `{content, size}` | admin |
| `write_file` | 写入文件(白名单校验) | `{path, content}` | `{ok, bytes_written}` | admin |
| `run_command` | 执行 shell 命令(120s 超时) | `{command, cwd, timeout}` | `{stdout, stderr, exit_code}` | admin |
| `search_web` | 网页搜索(DuckDuckGo Lite) | `{query, max_results}` | `{results: [{title, url, snippet}]}` | 所有用户 |
| `file_search` | 文件名搜索 | `{pattern, path}` | `{matches: [path]}` | 所有用户 |
| `git_operations` | Git 操作(status/diff/log/branch) | `{action, args}` | `{output}` | admin |
| `db_query` | 数据库查询(SELECT only) | `{sql, params}` | `{rows, columns}` | admin |
| `analyze_code` | 代码静态分析 | `{code, language}` | `{analysis, issues}` | 所有用户 |
| `generate_test` | 自动生成测试 | `{code, language, framework}` | `{test_code}` | 所有用户 |
| `refactor_code` | 代码重构建议 | `{code, language, goal}` | `{refactored_code, changes}` | 所有用户 |

**安全约束**:

- 工作区根目录白名单:`MCP_WORKSPACE_ROOTS` 环境变量(分隔符 `os.pathsep`),默认当前工作目录
- `_validate_path_in_workspace`:resolve(strict=False) 解析 symlink + `..`,防穿越
- 全局超时:`MCP_GLOBAL_TIMEOUT = 120` 秒,防 handler 无限挂起

### 6.2 资源清单(3 个)

| 资源 URI | 名称 | 说明 | MIME |
|----------|------|------|------|
| `memory://session/{session_id}` | 会话记忆 | 会话历史消息 | `application/json` |
| `memory://skills` | Skills | 预置 skill 列表 | `application/json` |
| `config://settings` | 配置 | 当前服务配置(脱敏) | `application/json` |

### 6.3 提示词清单(3 个)

| 提示词名 | 用途 | 参数 |
|----------|------|------|
| `code_review` | 代码审查 | `{code, language}` |
| `bug_fix` | Bug 修复 | `{code, error, language}` |
| `feature_plan` | 功能规划 | `{feature, context}` |

### 6.4 Sampling 反向调用

MCP 工具可反向请求 LLM 推理(`sampling_handler.handle_sampling`),5 层护栏:

1. 速率限制(防 LLM 调用风暴)
2. 白名单(仅允许已注册工具调用)
3. 轮数限制(单工具最大调用次数)
4. 超时(防无限等待)
5. 审计(记录所有 sampling 调用)

---

## 7. A2A 协议(services/a2a_service.py)

Agent-to-Agent 通信协议,支持 agent 注册、任务派发、状态查询。Redis 持久化 + 内存降级(Redis 不可用时降级为内存字典,进程重启丢失)。

### 数据模型

```python
@dataclass
class A2AAgent:
    agent_id: str
    name: str
    capabilities: list[str]
    endpoint: str
    description: str

@dataclass
class A2ATask:
    task_id: str
    name: str
    agent_id: str
    input_data: dict
    status: str          # pending/running/completed/failed
    result: dict | None
    created_at: datetime
    updated_at: datetime
```

### 5 端点流程

| 端点 | 流程 |
|------|------|
| `POST /a2a/agents/register` | 注册 agent 到 Redis/内存,返回 agent 信息 |
| `GET /a2a/agents` | 列出所有已注册 agent |
| `POST /a2a/tasks` | 创建 pending 任务,异步执行,返回 task_id |
| `GET /a2a/tasks/{id}/status` | 轮询任务状态直到 completed |
| `GET /a2a/tasks/{id}/result` | 获取 completed 任务的最终结果 |

---

## 8. 向量记忆(services/vector_memory.py)

嵌入 + 余弦相似度语义搜索,支持跨会话或限定会话内搜索。数据持久化到 PostgreSQL pgvector(迁移 `0123_pgvector_embedding.sql`)。

### 核心方法

| 方法 | 用途 |
|------|------|
| `add(session_id, content, metadata)` | 嵌入文本并存入向量库 |
| `search(query, top_k, session_id)` | 语义搜索(余弦相似度),返回最相关 N 条 |
| `clear(session_id)` | 清除指定会话的所有向量 |
| `hydrate()` | 启动时从 Redis 加载历史向量记忆(进程重启不丢) |

### 嵌入策略

- **真实模式**:调用 `llm_gateway.embed(text, model)` 获取真实嵌入向量
- **Stub 模式**:返回确定性哈希向量(基于文本内容 hash 到固定维度),保持语义搜索 API 可用

### 迁移

`packages/database/drizzle/0123_pgvector_embedding.sql` 启用 pgvector 扩展 + 创建向量索引。

---

## 9. 内存服务(services/memory.py)

会话消息存储,Redis 持久化 + 内存降级(Redis 不可用时降级为内存字典)。

| 方法 | 用途 |
|------|------|
| `set(session_id, messages)` | 写入会话消息 |
| `get(session_id, limit)` | 读取会话消息(默认最近 100 条) |
| `list_sessions()` | 列出所有会话 ID |
| `clear(session_id)` | 清除指定会话消息 |

**Sliding window**:系统消息始终保留 + 最近 N 轮 user/assistant(`chat_history_window`,默认 6 轮,总消息数 ≤ 13)。

---

## 10. Skills 系统(services/skills.py)

6 预置 skill + SkillEvolutionService(任务后 LLM 自评 → 自动生成 SKILL.md)+ SkillRegistry 自动加载 `auto/` 目录。

### 6 预置 Skill

| Skill 名 | 用途 | prompt_template 变量 |
|----------|------|----------------------|
| `code-review` | 代码审查:检查代码质量、潜在 bug、最佳实践 | `{language, code}` |
| `debug-fix` | 调试修复:根据错误信息定位并修复 bug | `{language, error, code}` |
| `test-generator` | 测试生成:为代码自动生成单元测试 | `{language, framework, code}` |
| `doc-writer` | 文档撰写:为代码生成文档与注释 | `{language, code}` |
| `refactor-helper` | 重构辅助:优化代码结构而不改变行为 | `{language, code}` |
| `api-designer` | API 设计:设计 RESTful API 接口与 schema | `{requirement}` |

### Skill 自进化闭环(P3-2)

1. **生成**:任务完成后 LLM 自评,提取可复用模式生成 SKILL.md
2. **测试**:`SkillTester` 自动运行测试用例,通过率 < 0.6 拒绝落盘
3. **落盘**:通过质量门的 skill 写入 `skills/auto/` 目录
4. **反馈追踪**:`SkillFeedback` 跟踪 skill 使用效果
5. **迭代优化**:`SkillIterator` 基于反馈持续优化

---

## 11. Slash 命令(services/slash_commands.py)

12 slash 命令,每个有 `name`/`description`/`handler`。

| 命令 | 用途 | 参数 |
|------|------|------|
| `/goal` | 设定当前会话目标 | `<目标描述>` |
| `/loop` | 设置 agent 循环执行模式 | `on`/`off`/`<迭代次数>` |
| `/skill` | 列出或选择预置 skill | `[skill_name]` |
| `/plan` | 生成任务计划 | `<任务描述>` |
| `/memory` | 查看或管理会话记忆 | `[clear]` |
| `/persona` | 切换 Persona 人格 | `<persona_name>` |
| `/help` | 显示帮助 | - |
| `/clear` | 清空当前会话 | - |
| `/bug` | 报告 bug | `<描述>` |
| `/improve` | 提交改进建议 | `<描述>` |
| `/status` | 查看系统状态 | - |
| `/version` | 查看版本信息 | - |

```python
@dataclass
class SlashCommand:
    name: str
    description: str
    handler: Callable[[list[str], dict[str, Any]], Awaitable[str]]
```

---

## 12. SSE 缓冲(core/sse_buffer.py)

SSE 事件缓冲,支持断线重连重放。每个事件携带 `id` 字段,客户端重连时发送 `Last-Event-ID` header,服务端重放该 ID 之后的所有缺失事件。

| 方法 | 用途 |
|------|------|
| `append(task_id, event)` | 追加事件,返回 event_id |
| `replay_after(task_id, last_event_id)` | 重放 task_id 下 last_event_id 之后的事件 |
| `clear(task_id)` | 清理 task_id 的所有缓冲事件 |
| `get(task_id)` | 获取 task_id 的所有事件 |

**TTL**:5 分钟,过期自动清理。**客户端断连**(`request.is_disconnected()`)时立即停止 LLM 生成,避免 token + buffer 浪费。

---

## 13. 配置(core/config.py)

Pydantic Settings,字段名统一小写(与 services/routers 既有代码一致),从 `.env` 加载。

### 关键环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NODE_ENV` | `development` | 运行环境 |
| `PORT` | `3003` | 服务端口(docker-compose 映射 8000) |
| `HOST` | `0.0.0.0` | 监听地址 |
| `LOG_LEVEL` | `info` | 日志级别 |
| `CORS_ORIGIN` | `http://localhost:3001` | CORS 允许源(逗号分隔) |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/ihui_ai` | PostgreSQL 连接串 |
| `REDIS_URL` | `redis://localhost:6379` | Redis 连接串 |
| `LITELLM_MODEL` | `stepfun/step-3.7-flash` | 默认 LLM 模型 |
| `MAX_AGENT_ITERATIONS` | `10` | Agent 最大迭代次数 |
| `CHAT_HISTORY_WINDOW` | `6` | 会话历史 sliding window(轮) |
| `API_SERVICE_URL` | `http://localhost:8080` | 后端 API 地址(回调用) |
| `AI_CALLBACK_SECRET` | (空) | 回调共享密钥(与 apps/api 一致) |
| `CREDENTIALS_ENCRYPTION_KEY` | (空) | 凭据加密密钥(与 apps/api 共享,≥32 字符) |
| `JWT_SECRET` | (空) | JWT 密钥(与 apps/api 共享,SSO 跨服务) |
| `JWT_ISSUER` | `ihui-ai` | JWT 签发者 |
| `JWT_PUBLIC_PATHS` | `/api/health,/api/legacy,/health,/metrics` | JWT 不验签白名单 |
| `AGENT_CONTROL_INTERNAL_SECRET` | (空) | agent_control 内部调用密钥 |
| `MCP_WORKSPACE_ROOTS` | `os.getcwd()` | MCP 文件操作白名单根目录(`os.pathsep` 分隔) |
| `SELF_MEDIA_CRON_ENABLED` | `false` | 自媒体定时任务开关 |
| `OTEL_ENABLED` | `false` | OpenTelemetry 开关 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP 端点 |
| `OTEL_SERVICE_NAME` | `@ihui/ai-service` | 服务名 |
| `OTEL_TRACES_SAMPLER` | `traceidratio` | 采样器 |
| `OTEL_TRACES_SAMPLER_ARG` | `0.1` | 采样率(10%) |

### LLM Provider Key(任选一个激活真实调用,全部为空降级 stub)

| 变量 | Provider |
|------|----------|
| `STEPFUN_API_KEY` + `STEPFUN_API_BASE` | StepFun 阶跃星辰 |
| `AGNES_API_KEY` + `AGNES_API_BASE` | Agnes AI |
| `GROQ_API_KEY` | Groq(免费) |
| `GEMINI_API_KEY` | Gemini(免费) |
| `OPENROUTER_API_KEY` | OpenRouter(有 free tier) |
| `OPENAI_API_KEY` | OpenAI(付费) |
| `ANTHROPIC_API_KEY` | Anthropic(付费) |
| `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Workers AI(免费) |
| `NVIDIA_API_KEY` | NVIDIA NIM(免费) |
| `GITHUB_TOKEN` | GitHub Models(免费) |
| `VERCEL_AI_GATEWAY_KEY` | Vercel AI Gateway |
| `OPENCODE_ZEN_KEY` | OpenCode Zen(完全免费) |
| `MODAL_API_KEY` | Modal |
| `INFERENCE_NET_API_KEY` | Inference.net |
| `NLP_CLOUD_API_KEY` | NLP Cloud |
| `SCALEWAY_API_KEY` | Scaleway |
| `ALIBABA_INTL_API_KEY` | Alibaba Cloud International |

> 详细申请地址与连通性测试见 [LLM_SETUP.md](./LLM_SETUP.md)。

---

## 14. DAG 调度器(services/dag_scheduler.py)

任务依赖图调度器,支持同层真并行(`asyncio.gather`)+ worker pool 限流。

### 调度模型

- **节点**:任务单元,含 `id`/`dependencies`/`executor`
- **边**:依赖关系(A 依赖 B,则 B 完成后 A 才执行)
- **同层并行**:无依赖关系的节点用 `asyncio.gather` 并发执行
- **worker pool**:限制最大并发数,防止资源耗尽
- **失败处理**:节点失败标记,下游节点不执行(避免级联失败)

---

## 15. 调用示例

### 15.1 调用 /api/llm/complete

```bash
curl -X POST http://localhost:3003/api/llm/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "messages": [
      {"role": "system", "content": "你是 IHUI-AI 助手"},
      {"role": "user", "content": "你好,介绍一下自己"}
    ],
    "model": "stepfun/step-3.7-flash",
    "temperature": 0.7,
    "max_tokens": 1000
  }'
```

响应(stub 模式):

```json
{
  "content": "[stub] 你好!我是 IHUI-AI 助手...",
  "model": "stepfun/step-3.7-flash",
  "usage": {"prompt_tokens": 20, "completion_tokens": 50, "total_tokens": 70},
  "stub": true
}
```

### 15.2 调用 /api/agents/execute

```bash
curl -X POST http://localhost:3003/api/agents/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "goal": "搜索 apps/api 下的所有路由文件并列出端点数",
    "session_id": "demo-session-001",
    "max_iterations": 5,
    "tools": ["search_codebase", "read_file"]
  }'
```

### 15.3 调用 /api/mcp/tools(列出工具)

```bash
curl http://localhost:3003/api/mcp/tools \
  -H "Authorization: Bearer <JWT_TOKEN>"

# 响应
{
  "tools": [
    {"name": "search_codebase", "description": "代码符号搜索", "input_schema": {...}},
    {"name": "read_file", "description": "读取文件", "input_schema": {...}},
    ...
  ],
  "count": 11
}
```

### 15.4 调用 MCP 工具

```bash
curl -X POST http://localhost:3003/api/mcp/tools/call \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "name": "search_codebase",
    "arguments": {
      "query": "registerRoutes",
      "path": "apps/api/src",
      "max_results": 10
    }
  }'
```

### 15.5 流式 LLM 调用

```bash
curl -N -X POST http://localhost:3003/api/llm/complete/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "messages": [{"role": "user", "content": "写一首关于秋天的诗"}],
    "model": "stepfun/step-3.7-flash"
  }'
```

响应(SSE 流):

```
event: chunk
data: {"content": "秋风"}

event: chunk
data: {"content": "萧瑟"}

event: done
data: {"model": "stepfun/step-3.7-flash", "usage": {...}, "stub": false}
```

---

## 16. 与 apps/api 协作

> WebSocket 端点全清单见 [architecture.md](./architecture.md) §3。

### WS 代理 SSE

`apps/api` 的 `/v1/ai/capabilities/ws/stream` 端点(`ws-ai.ts` 插件)代理到 ai-service SSE,实现 WebSocket 客户端接入 SSE 流式 AI 能力。

```
浏览器(WS) → apps/api(/v1/ai/capabilities/ws/stream) → ai-service(/api/llm/complete/stream SSE)
```

### JWT SSO 跨服务

两服务共享 `JWT_SECRET`,`@ihui/auth` 共享包统一签发/验证。ai-service 的 `JWTAuthMiddleware` 校验 JWT(token 从 `Authorization: Bearer` 头读取),白名单路径(`jwt_public_paths`)免鉴权。

### 回调机制

ai-service 推理完成后异步 POST 结果到 `apps/api` 的 `/api/ai/callback` 端点:

- 携带 `X-Internal-Secret` 头(与 `AI_CALLBACK_SECRET` 共享密钥校验)
- 5xx 重试 2 次(指数退避 0.5s → 1s)
- 4xx 不重试(请求本身有问题)

### traceparent 透传

`apps/api` 在 `onRequest` 钩子生成/透传 W3C `traceparent` 头,ai-service 的 `trace_context` 中间件解析入 `request.state.trace_id`,实现 Jaeger 端到端调用链。

---

## 17. 测试

> 测试架构总览见 [architecture.md](./architecture.md) §7。

`apps/ai-service/tests/` 35 文件,400+ 用例,覆盖全部 services/routers/core 模块:

| 测试文件 | 覆盖模块 |
|----------|----------|
| `test_a2a_service.py` | A2A 协议 |
| `test_agent_loop.py` / `test_agent_loop_v2.py` | Agent 执行器 |
| `test_agent_orchestrator.py` | 多 Agent 协商 |
| `test_dag_scheduler.py` / `test_dag_worker_pool.py` | DAG 调度 |
| `test_health.py` | 健康检查 |
| `test_langgraph_service.py` | LangGraph 工作流 |
| `test_llm_gateway.py` | LLM 网关 |
| `test_mcp_server.py` | MCP 协议 |
| `test_memory.py` | 内存服务 |
| `test_vector_memory.py` | 向量记忆 |
| `test_skills.py` | Skills 系统 |
| `test_slash_commands.py` | Slash 命令 |
| `test_sse_buffer.py` | SSE 缓冲 |
| `test_routers.py` | 路由集成 |
| ... | (共 35 文件) |

```bash
cd apps/ai-service
pytest tests/ -v          # 运行全部测试
pytest tests/test_mcp_server.py -v   # 运行单个模块测试
```
