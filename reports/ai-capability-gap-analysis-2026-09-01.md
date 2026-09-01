# IHUI-AI AI 对话 / 工具调用能力 — 竞品对标与超越路线图

> 生成日期：2026-09-01 · 口径：基于代码实证（非文档自述）+ 2025-2026 竞品公开能力
> 范围：AI 对话、工具调用/MCP、记忆/RAG/知识图谱、多模态、模型治理、多 Agent 编排

---

## 一、总体结论（先说判断）

**真实底盘已有，但"名实不符"与"孤岛/空壳"并存。** 核心对话链路是实打实可用的——多模型网关 + 流式 + 手写工具循环 + 多 Agent 编排 + 人格 + 联网/代码执行 + 四层记忆 + API 侧真 RAG + 本地 STT。但存在三类硬伤：

1. **架构名不副实**：对外标榜 LangGraph，主聊天链路实为手写 tool loop，LangGraph 需手动 `register` 才生效（`app/routers/langgraph.py:55`），默认不挂载。
2. **孤岛能力**：知识图谱、用户画像、四层记忆系统各自实现却**不接入主检索链路**（`knowledge_lookup` 自承 PoC 门面；`agent_loop.py` v1 不注入画像/记忆）。
3. **空壳/半成品**：图表生成、PDF/Office 解析、kling 图像（硬编码 503）、`model_router`（硬编码示例）是真的没有或只是壳。

**竞品基准（Claude/ChatGPT/Gemini）领先点在**：1M 上下文、MCP 原生（Claude 标杆）、Computer Use、跨会话长期记忆（Projects/CLAUDE.md）、企业 Connectors、实时语音、多 Agent SDK。

**本项目唯一且竞品没有的"广度基座"**：**8 端一体**（web / api / ai-service / miniapp-taro / desktop / extension / mobile-rn / cli）+ 全模型中立 + 可本地私有化 + 中文生态。这是弯道超车的根本筹码——单一 Web 的 ChatGPT 没有，闭源的 Claude 没有，纯后端的 Dify 也没有。

> **定位一句话**：做"开源界的 Claude + Dify + Ollama 三位一体"，且唯一覆盖 8 端 + 中文生态 + 私有化。对标不是 Copy，而是用开源 × 多端 × 私有化把闭源竞品的盲区填满。

---

## 二、能力清点表（真实 vs 壳 — 代码实证）

| 能力域 | 现状 | 真实度 | 关键证据 |
|---|---|---|---|
| 多模型网关 | LiteLLM 18+ provider + 流式 + Combo/Fallback/MoA | ✅ 真 | `llm_gateway.py:1454/2054/2354` |
| 多轮上下文 | trim/repair + 可选 token 压缩 | ✅ 真 | `llm_gateway.py:1373` |
| 手写工具循环 | tool_calls→执行→回灌 | ✅ 真 | `llm.py:1069-1123` / `conversation.py:183-265` |
| LangGraph 编排 | 有 StateGraph + 检查点 | ⚠️ 真但默认不挂载 | `langgraph.py:55` 需显式 register |
| 多 Agent 编排 | 10 agent + 5 subagent，pipeline/parallel/debate/vote/critique | ✅ 真 | `agent_orchestrator.py:326-978` |
| Persona 人格 | 固定 5 个，仅 GET 不可自定义 | ⚠️ 半 | `persona_registry.py:26`，无写接口 |
| 工具集(MCP 仿) | ~46 工具，自研 JSON-RPC，stdio/SSE | ✅ 真 | `mcp_server.py:4286` / `mcp_client.py:64` |
| 官方 MCP 协议 | **零兼容**，无 SDK 依赖 | ❌ 缺 | `requirements.txt:38` 已删 mcp 库 |
| 联网搜索 | DuckDuckGo 解析 | ✅ 真（易碎） | `mcp_server.py:952` |
| 代码执行 | 白名单 + sandbox(docker/ssh/modal) | ✅ 真 | `mcp_server.py:756` / `sandbox.py:278` |
| 图表生成 | **无** | ❌ 空壳 | 全仓无 echarts/matplotlib 工具 |
| 文件解析(PDF/Office) | 有依赖无工具 | ❌ 空壳 | `file_search` 排除 .pdf/.zip |
| 对话记忆 | Redis + 四层 PG（working/episodic/semantic/procedural） | ✅ 真 | `memory_service.py:205` / `memory.py:31` |
| 跨会话长期记忆 | HTTP 调 `/api/memory` | ✅ 真 | `memory_service.py:771` |
| API 侧 RAG | 切分→embed→pgvector→检索 | ✅ 真 | `knowledge-rag-service.ts:103-323` |
| 知识图谱 | NER + PG 表，但不进检索 | ⚠️ 孤岛 | `knowledge_graph.py:87`，未被引用 |
| 用户画像 | 5 维聚合，但不注入对话 | ⚠️ 半 | `user_profile.py:74`，v1 loop 未调用 |
| 语音 STT | 本地 faster-whisper CPU int8 | ✅ 真 | `voice_stt.py:107` |
| 语音 TTS | 在 api 侧，依赖 DashScope | ✅ 真（强依赖） | `ws-ai.ts:22` |
| 视觉理解 | vision content block | ✅ 真 | `vision_helper.py:125` |
| 图像生成 | stepfun/agnes，kling 硬编码 503 | ⚠️ 半 | `mcp_server.py:2545` / kling 503 |
| 模型目录 catalog | 11 类 / tier / family 精细标注 | ✅ 真 | `model_catalog.py:556` |
| 可用性 health | 5min ping 过滤不可用/限流 | ✅ 真 | `model_availability.py:320` |
| 智能路由 | 硬编码示例，疑似未接生产 | ❌ 壳 | `model_router.py:70` |
| a2a 协议 | 本地异步任务队列，非 Google A2A | ⚠️ 半 | `a2a_service.py:5-18` |
| Orchestration | 支柱联动编排，前端真对接 | ✅ 真 | `orchestration_hub.py` |

---

## 三、逐维对标差距

| 维度 | 本项目现状 | 竞品标杆 | 差距 |
|---|---|---|---|
| 上下文长度 | 窗口截断 + token 压缩 | 128K–1M（GPT-4.1/Gemini/Claude） | 大 |
| MCP 生态 | 自研协议，零社区兼容 | Claude 原生 MCP + 社区 server 海量 | **致命** |
| Computer Use | browser/computer 22 工具转发，依赖端进程 | Claude Computer Use / Mariner | 大（未真通） |
| 长期记忆 | 有存储但默认不注入 | ChatGPT Projects / Claude CLAUDE.md | 中 |
| 知识接入 | 自有 KB RAG，无外部 Connector | ChatGPT Connectors（GDrive/Notion…） | 大 |
| 多模态 | STT+Vison+图像，TTS 强依赖云 | GPT-5 Voice / Gemini 原生音视频 | 中 |
| 多 Agent 编排 | 真实现但 LangGraph 不挂载 | Claude Agent SDK / LangGraph 1.0 / Dify | 中 |
| 推理模型 | 接第三方推理模型，无自研路由 | o 系列 / DeepSeek-R1 原生 | 小（靠中立接入） |
| 可视化编排 | orchestration 真，但无拖拽流 | Dify / Coze 可视化 | 中 |
| 成本/私有化 | 可本地 + 多 provider | 闭源高价 API | **领先（优势）** |
| 端覆盖广度 | 8 端 | 单端 | **领先（优势）** |

---

## 四、深度开发路线图（广度 × 深度 × 细腻度）

### A. 广度（Breadth）— 把"覆盖别人没有的面"做满

**A1. 落地官方 MCP 协议，做"MCP 应用商店"**
- 替换自研 JSON-RPC 为官方 `mcp` SDK（stdio / Streamable HTTP / SSE 三传输），让社区任意 MCP server 即插即用。
- 在 8 端中提供统一 MCP 目录 + 一键安装 + 权限审批。这是 Claude 的护城河，我们用**开源 + 多端 + 中文预置 server**（飞书/钉钉/企业微信/语雀/国产云）反超。

**A2. 中文生态 Connectors**
- 对标 ChatGPT Connectors，但接**国内**数据源：飞书文档、企业微信、钉钉、语雀、国产网盘、微信公众号素材、本地 NAS。闭源竞品在国内数据合规上先天受限，这是我们的主场。

**A3. 多模态补全（填两个空壳）**
- 图表生成工具：调用 ECharts/matplotlib 生成可交互图，写入对话 Artifact。
- 文件解析：PDF/Word/Excel/PPT 上传 → 文本/表格抽取 → 进 RAG 与对话上下文（`file_search` 当前排除了它们）。

**A4. 8 端统一 Agent 能力**
- 让 desktop / extension / mobile-rn / cli 共享同一 Agent 内核，mobile 端也能调工具、跑编排。竞品没有"一个 Agent 跑在 8 端"的形态。

### B. 深度（Depth）— 把"别人没做透的"做深

**B1. GraphRAG + 混合检索（打通孤岛）**
- 把**知识图谱（已有但孤岛）**接入 `knowledge_lookup` 三源，做成 GraphRAG：实体→关系→社区摘要增强检索。这是 2025-2026 的前沿，竞品通用产品尚未普及，我们已有 PG 图底座可直接升。

**B2. 长期记忆自进化（默认开启）**
- `meta_learner` / `user_profile` 默认注入主链路；把四套冗余记忆系统收敛为统一 `MemoryService` 接入点（v1 loop 也要接）。做成"越聊越懂你"的跨会话人格。

**B3. 智能路由接生产（填 model_router 壳）**
- `model_router` 硬编码示例 → 改为实时读 `model_catalog` + `model_availability`，按复杂度/成本/可用性做动态路由 + 自动 Fallback 链。这是"全模型中立"承诺的落地。

**B4. LangGraph 默认挂载 + 可视化编排**
- 主聊天默认挂载LangGraph（plan→execute→summarize + 检查点/人工介入），前端做 Dify/Coze 级**拖拽工作流编辑器**，导出为可复用 playbook。

**B5. 自主计算机操作（中文 Computer Use）**
- 基于已实现的 browser/computer 22 工具 + desktop/extension 端进程，做成**中文 UI、国产软件（微信/钉钉/飞书/国产办公）GUI 自动化**，对标 Claude Computer Use 但本土化——竞品 macOS/英文环境难覆盖。

### C. 细腻度（Refinement）— 把"体验颗粒度"拉满

**C1. 工具调用过程可视化**
- 流式中逐步展示"思考中 → 调用工具 X → 返回结果 → 综合"，而非一次性吐答案。前端已有 task 列表骨架，补 AI 流式 tool 状态精细化。

**C2. 答案引用溯源（Citation）**
- RAG 答案带来源文档链接/片段高亮（竞品 ChatGPT/Claude 已有），提升可信度与可核查性。

**C3. Artifact 富渲染**
- 对标 Claude Artifacts / ChatGPT Canvas：代码块可运行预览、文档可编辑、图表可交互、表格可排序。对话不止是文本。

**C4. 统一安全与优雅降级**
- 前端 `dangerous-command-detector` 与后端 `run_command` 黑名单**合并为单一权威源**；无 key / 模型 down 时优雅降级 + 明确提示，而非静默 stub。

**C5. 流式与错误体验**
- token 级流式、中断续写、工具失败自动重试的用户可见反馈。

---

## 五、分阶段实施优先级

| 阶段 | 目标 | 关键动作 | 对标意义 |
|---|---|---|---|
| **P0 补实** | 消除空壳+通孤岛 | 图表/PDF 工具、记忆系统统一接入、画像默认注入、model_router 接生产、官方 MCP 协议替换 | 达到"所说即所得"底线 |
| **P1 做深** | 前沿能力落地 | GraphRAG、长期记忆自进化、LangGraph 默认挂载、中文 Computer Use 真通、实时语音闭环 | 在记忆/检索/自主操作上超竞品 |
| **P2 做广** | 生态扩张 | MCP 商店、中文 Connectors、可视化编排、8 端统一 Agent | 用开源×多端×私有化填闭源盲区 |
| **P3 做细** | 体验颗粒度 | Artifact 渲染、引用溯源、tool 流式可视化、统一安全 | 对标 Artifacts/Canvas 级体验 |

---

## 六、关键风险与提醒

1. **不要先宣传后实现**：LangGraph / MCP / 知识图谱 当前"名不副实"，对外表述需与代码对齐，避免重复"壳"口碑。
2. **避免能力堆叠而打通不足**：已有 4 套记忆 + 图谱 + 画像，优先"打通进主链路"而非再加新模块。
3. **MCP 替换是地基工程**：自研 JSON-RPC 改为官方协议，影响 mcp_server / mcp_client / CLI runtime 三处，需兼容性迁移方案。
4. **依赖外部 key 的能力（TTS/DashScope、图像/stepfun、STT 本地可离线）需区分"零成本自托管"与"强云依赖"两条线**，向用户明示。

---

*注：本报告所有"真实/空壳"判定均来自对 `apps/ai-service`、`apps/api`、`packages/` 的代码探查（含行号证据），竞品基准来自 2025-2026 年 OpenAI/Anthropic/Google/Microsoft 官方发布与 Dify/Coze/LangGraph/Ollama/vLLM 社区公开资料。*
