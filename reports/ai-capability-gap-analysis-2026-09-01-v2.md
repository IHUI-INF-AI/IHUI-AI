# IHUI-AI AI 对话 / 工具调用能力 — 竞品对标 v2（P0 收官后增量审视）

> 生成日期：2026-09-01（21:xx）· v1 于同日早间生成，v1 中 P0 硬伤已全部落地执行
> 口径：代码实证（含文件/行号）+ 2025-2026 竞品公开能力（Claude/GPT/Gemini/Qoder/Dify/Coze/MCP 生态）
> 范围：AI 对话、工具调用/MCP、记忆/RAG/知识图谱、语音、多 Agent 编排、安全、前端体验

---

## 〇、v1 → v2 变化总览（先说判断）

**v1 判定的三类硬伤，本日已基本收官：**

| v1 硬伤                                | v1 证据                                                          | v2 现状                                                | 落地证据                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| ① 架构名不副实（LangGraph 默认不挂载） | `langgraph.py:55` 需手动 register                                | ✅ 已修：懒加载自动编译                                | `_ensure_graph()` 首调自动 `build_agent_graph()`，幂等，失败降级                                            |
| ② 孤岛能力（图谱/画像/记忆不进主链路） | `knowledge_lookup` 自承 PoC；v1 loop 不注入                      | ✅ 已通：三源注入 + 图谱第四源 + 自动建图              | `agent_loop.py` 注入 profile/memory snippet；`knowledge_lookup` graph 源 BFS 2-3 跳 + citations             |
| ③ 空壳/半成品（图表/PDF/路由/kling）   | 无图表工具；file_search 排除 pdf；model_router 硬编码；kling 503 | ✅ 已填：图表+文档解析工具、router 接生产、kling 消除  | `chart_tools.py`（ECharts 四类）/`document_tools.py`（pdfplumber+docx+xlsx）；`from_catalog()` 实测 23 模型 |
| ④ MCP 零官方协议兼容                   | 自研 JSON-RPC，无 SDK                                            | ✅ 已建：官方 Streamable HTTP 风格 JSON-RPC 2.0 兼容层 | `mcp_official.py` 单入口 `POST /api/mcp`，48 工具全部暴露给任意 MCP 客户端                                  |
| ⑤ 无免费语音方案                       | TTS 强依赖 DashScope key                                         | ✅ 已解：edge-tts 零 key 零成本                        | `voice_tts.py` 12 声音白名单；`ws-ai.ts` synthesizeTTS 免费优先                                             |

**v2 核心判断：P0 的"补实/通孤岛"目标达成，底盘从"名不副实"转为"真材实料"。**

但距"在广度、深度、细腻度上远超竞品"仍差三口气——本报告给出精确差距清单 + 深度开发路线 + 优先级。

---

## 一、能力清点表 v2（代码实证更新）

### 1.1 已确认真实可用（✅）

| 能力域                 | 现状                                                      | 证据                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 官方 MCP 协议兼容层    | Streamable HTTP 风格 JSON-RPC 2.0，单入口                 | `mcp_official.py` 6 handler（initialize/tools_list/tools_call/resources_list/prompts_list/prompts_get），错误码 -32700/-32600/-32601/-32602/-32603，匿名高危工具权限矩阵兜底 |
| 内置工具集             | 48 工具                                                   | `mcp_server.py:3366` `_TOOLS`；`_ADMIN_ONLY_TOOLS`（computer_* 系列 11 项 + 管理项）                                                                                         |
| 图表生成               | ECharts 单文件 HTML，line/bar/pie/scatter 四类 + 中文标题 | `chart_tools.py`，零新依赖                                                                                                                                                   |
| 文档解析               | txt/md/csv/json/pdf/pdfplumber/docx+xlsx                  | `document_tools.py`，路径白名单 + 敏感文件黑名单 + 截断                                                                                                                      |
| GraphRAG               | 知识图谱第四源 + BFS 2-3 跳邻域 + citations 溯源          | `knowledge_lookup.py` graph 源，`graph_bfs_depth=2` 打分递减，`KnowledgeHit.citations`                                                                                       |
| 自动建图闭环           | 对话后自动抽取实体建图                                    | `agent_loop.py` auto_graph_extract，stub 模式零成本默认开                                                                                                                    |
| 用户画像/记忆注入      | v1 主链路注入 profile + memory snippet                    | `agent_loop.py`（user_id 三级解析，失败降级）                                                                                                                                |
| 免费 TTS               | edge-tts 零 key，12 声音白名单，≤2000 字                  | `voice_tts.py`；api 侧 `ws-ai.ts:26` FREE_TTS_VOICE_MAP 免费优先                                                                                                             |
| MCP 商店种子           | 8 个官方/社区 server 预置目录                             | `mcp_directory.py`；`GET /api/mcp/directory` + `POST /{key}/register`                                                                                                        |
| LangGraph              | 懒加载自动编译，未注册自动注册                            | `langgraph.py` `_ensure_graph()`                                                                                                                                             |
| 统一安全               | 命令策略单一权威源                                        | `command_policy.json`（28 dangerous + 31 allowed + 6 sensitive）；`generate-command-policy-ts.mjs` 生成前端 TS 常量                                                          |
| /execute 越权          | fail-closed + timingSafeEqual 内部密钥                    | `agent-control.ts` isInternalSecret()                                                                                                                                        |
| 前端 tool 流式可视化   | 工具执行秒表 + 进行中状态                                 | `stream-handlers.ts` startTimes Map → durationMs；MessageItem 250ms 秒表                                                                                                     |
| 前端引用溯源           | citations 徽章（顶部级 + hits[] 嵌套兼容）                | `tool-call-card.tsx` extractCitations + CitationsBlock（去重 cap 8）                                                                                                         |
| 前端 Artifact 图表卡片 | 图表路径卡片 + 复制                                       | `tool-call-card.tsx` ChartArtifactBlock                                                                                                                                      |

### 1.2 仍存在的不足/缺口（❌/⚠️ — v2 真正要打的地方）

| #   | 缺口                                     | 现状                                                                                                            | 竞品基准                                                | 差距等级                                      |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------- |
| G1  | **Artifact 富渲染（iframe 预览缺失）**   | 图表仅展示路径卡片，代码块不可运行预览；`tool-call-card.tsx:190` 明示"本地 .html 无法在网页内直接 iframe 预览"  | Claude Artifacts 可渲染/可编辑/可运行；ChatGPT Canvas   | **大**（细腻度核心）                          |
| G2  | **实时语音闭环（流式对话 UX）**          | TTS 免费已通、STT 本地已通，但无"边说边识别→打断→流式回复→流式合成"的实时通话级 UX                              | GPT-5 Voice / Gemini Live 原生实时语音                  | 中-大（体验代差）                             |
| G3  | **官方 MCP SDK 迁移（非兼容层）**        | 自研 JSON-RPC + 官方协议兼容层（HTTP 单入口），未引入官方 `mcp` Python SDK；stdio/Streamable HTTP 双传输未全    | Claude 官方 SDK + 社区海量 server 即插即用              | 中（当前兼容层已能接客户端，缺 SDK 生态便利） |
| G4  | **Computer Use 桌面真通**                | browser__/computer__ 22 工具存在且 admin 权限矩阵，但依赖端进程未真跑通（extension 已构建未加载；desktop 空壳） | Claude Computer Use 真能控电脑                          | 大（广度招牌）                                |
| G5  | **MCP 应用商店完整工作流**               | 有目录种子 + 一键注册，但缺安装/卸载/启停/状态/权限审批 UI 闭环                                                 | Claude MCP 商店 / Dify 插件市场                         | 中                                            |
| G6  | **中文生态 Connectors**                  | 无飞书/钉钉/企业微信/语雀等国产数据源连接器                                                                     | ChatGPT Connectors（GDrive/Notion/Slack）               | 中（主场未占）                                |
| G7  | **长期记忆自进化（默认关）**             | `auto_graph_extract_enabled` 默认 false（LLM NER 有 token 成本）；记忆有存储但"自整理/自提炼"进化闭环未全       | ChatGPT Projects / Claude CLAUDE.md 跨会话人格          | 中                                            |
| G8  | **MCP prompts 薄**                       | 仅 3 个 prompts（resources 3 个）                                                                               | Claude 官方 server 每个都带丰富 prompt 模板             | 小-中                                         |
| G9  | **工具调用规划/并行批处理**              | 工具循环是串行"call→execute→replay"，无规划器（planner）先行分解并行                                            | Claude/GPT 已支持并行工具调用；OpenAI AgentKit 有规划器 | 中（深度）                                    |
| G10 | **Agent 可观测性/追踪**                  | 无 trace/span/耗时分布面板（有前端秒表但无后端链路追踪）                                                        | LangSmith / OpenAI tracing / Dify 日志                  | 中                                            |
| G11 | **可视化拖拽编排**                       | orchestration 支柱联动是真，但无拖拽工作流编辑器                                                                | Dify / Coze 可视化编排                                  | 大（P2）                                      |
| G12 | **8 端统一 Agent 内核一致性**            | desktop 空壳、extension 已构建未部署、mobile-rn 能力子集                                                        | 竞品单端无此问题，但我们有 8 端却未全量同权             | 中（广度独有优势未兑现）                      |
| G13 | **多模态补全（图像/视频/文件上传对话）** | 视觉理解有（vision content block）、图像生成 stepfun/agnes 有，但对话中多模态上传/上下文引用 UX 一般            | GPT-5 原生多模态输入                                    | 小-中                                         |
| G14 | **长上下文工程**                         | 窗口截断 + token 压缩，无长上下文缓存/上下文压缩摘要链                                                          | 1M 上下文（Gemini）+ Anthropic prompt caching           | 中（受限于上游模型）                          |

---

## 二、逐维对标差距（v2 更新）

| 维度         | 本项目（v2）                                   | 竞品标杆                         | 差距                              | 方向           |
| ------------ | ---------------------------------------------- | -------------------------------- | --------------------------------- | -------------- |
| MCP 生态     | 官方协议兼容层 + 48 工具 + 8 server 目录种子   | Claude 原生 MCP + SDK + 社区海量 | 中（兼容层已通，缺 SDK/商店闭环） | 深度开发 G3/G5 |
| 工具调用     | 48 工具真执行 + 权限矩阵 + 流式可视化          | Claude/GPT 并行调用 + 规划器     | 中（串行 vs 并行规划）            | 深度开发 G9    |
| 记忆/RAG     | 四层记忆 + 图谱 BFS + 画像注入，**已通主链路** | ChatGPT Projects / CLAUDE.md     | **小（已追平）**                  | 深耕 G7 自进化 |
| 语音         | STT 本地 + TTS 免费，无实时闭环                | GPT-5 Voice / Gemini Live        | 中-大                             | 深度开发 G2    |
| Computer Use | 22 工具 + admin 矩阵，未真通                   | Claude Computer Use              | 大                                | 深度开发 G4    |
| Artifact     | 图表卡片 + 引用徽章                            | Claude Artifacts 全渲染          | 大                                | 深度开发 G1    |
| 编排         | LangGraph 懒加载 + 多 Agent 10+5               | LangGraph 1.0 / Dify             | 小-中                             | G10/G11        |
| 安全         | 统一策略单一权威源 + fail-closed               | 各竞品自有                       | **领先**                          | 保持           |
| 成本/私有化  | 本地可部署 + 多 provider + 免费 TTS            | 闭源高价                         | **领先（优势）**                  | 保持           |
| 端覆盖       | 8 端（含 miniapp-taro/desktop/extension）      | 单端                             | **领先（优势）**                  | 兑现 G12       |
| 中文生态     | 中文 UI 全量 + 中文模型接入                    | 弱                               | **领先（优势）**                  | 兑现 G6        |

---

## 三、深度开发路线（v2：把"已追平"变成"远超"）

### 主轴：广度（把 8 端 × 中文 × 私有化的独有底盘兑现）+ 深度（把孤岛真打通、把能力做透）+ 细腻度（把体验颗粒度拉到 Claude Artifacts 级）

### P1 深度开发（做透，本阶段可落地）

**P1-1 【G1】Artifact 富渲染引擎（细腻度核心，直接对标 Claude Artifacts）**

- 后端：图表工具落盘目录已固定（chart_tools.py），新增**静态文件服务路由** `/api/artifacts/{token}/{file}`（JWT 鉴权 + 目录白名单 + 防路径逃逸），让 `.html` 图表可通过 iframe 安全预览。
- 前端：`ChartArtifactBlock` 升级为**内嵌 iframe 预览**（sandbox="allow-scripts" 无 allow-same-origin），下方保留路径/复制/下载；代码块结果（python/js 生成的文本/html）同样可预览。
- 加：artifact 生命周期（会话内临时 token、过期清理）、可放大模态、深色模式注入。
- 验收：对话中生成图表 → 卡片内直接可交互预览，0 新依赖（浏览器原生 iframe）。

**P1-2 【G9】工具调用规划器 + 并行批处理（深度）**

- 新增 `tool_planner`：模型先输出工具调用计划（依赖图 DAG），无依赖的工具**并行执行**（asyncio.gather），有依赖的按拓扑序执行；失败单工具重试 1 次 + 依赖降级。
- 后端 `agent_loop.py`/`conversation.py` 工具循环从"串行 replay"升级为"plan→parallel→merge"。
- 前端：工具调用可视化从"逐个串行秒表"升级为"并行分组的时序图"。
- 验收：3 个独立工具（web_search + chart + doc_parse）并行耗时≈单工具耗时。

**P1-3 【G7】长期记忆自进化（默认开启，成本可控）**

- `auto_graph_extract_enabled` 默认改为 true，但用**分级 NER**：stub 模式关键词 NER（零成本）保持；真实 LLM 模式改为"批量异步 + 只在会话 ≥8 条时触发 + 单条 8000 字符截断"（已有逻辑），并加**去重/衰减**避免图谱膨胀。
- 新增 `memory consolidation`：每日一次把 episodic → semantic 提炼（LLM 摘要），长期记忆从"存储"升级为"越聊越懂"。
- 前端：设置页暴露记忆开关 + 记忆可见性（用户可查/可删，隐私）。

**P1-4 【G3】官方 MCP SDK 双传输接入（地基）**

- 引入官方 `mcp` Python SDK，`mcp_official.py` 兼容层保持，**新增 stdio 子进程传输**：允许本机 CLI 工具（如官方 filesystem/git server）以 stdio 方式作为内部工具接入；Streamable HTTP 出站客户端连接外部 MCP server（mcp_client.py 已有 SSE，补 HTTP）。
- 验收：用官方 filesystem MCP server stdio 接入 → 对话中直接调用其 read_file 等工具。
- 注：此为地基工程，与自研引擎并存（双轨），不破坏现有 48 工具。

### P2 深度开发（做广，兑现独有底盘）

**P2-1 【G5】MCP 应用商店完整工作流**

- mcp-store 页从"目录 + 一键注册"升级为：安装/卸载/启停/状态徽章/权限审批（高危工具需确认）/配置编辑；注册的 server 实时注入 `mcp_server` 工具列表。
- 后端：`mcp_directory.py` 加 enabled/installed 状态持久化 + 运行时热挂载。
- 验收：商店安装官方 filesystem → 立即出现在工具列表 → 对话可调用。

**P2-2 【G6】中文生态 Connectors**

- 首批 3 个：飞书文档（按 docx 解析工具复用）、企业微信/钉钉（消息推送 + 素材读取）、语雀（公开知识库拉取）；全部走"token 配置 + 拉取转 RAG 切片"模式，复用 document_tools 解析链。
- 验收：配置飞书 token → 对话中"读取飞书文档 X" → 返回结构化内容。

**P2-3 【G4】中文 Computer Use 真通**

- 基于已构建的 WXT MV3 extension（browser 工具）加载真通：extension 侧截图/点击/输入经 8802 `/execute` 控制（安全已修 fail-closed）。
- desktop（Tauri）侧补 GUI 自动化（windows-rs 或第三方 crate），优先国产软件窗口（微信/钉钉）。
- 验收：extension 加载后，对话指令"打开 example.com 点登录" → 浏览器真执行。

**P2-4 【G12】8 端统一 Agent 能力矩阵**

- 明确各端能力档位：web（全量）/api（全量）/extension（browser 工具 + 聊天）/desktop（聊天 + 本地文件）/mobile-rn（聊天 + 常用工具）/miniapp-taro（聊天）/cli（聊天 + 工具）/ 服务端。
- 补 mobile-rn 工具调用面板（WebView 复用 web 或原生轻量版）。

### P3 做细 + 长期

**P3-1 【G10】Agent 可观测性**：后端 trace 中间件（span：llm/tool/memory/rag 各段耗时）+ 前端"思考过程"面板（已做秒表，升级为结构化 trace 视图）。
**P3-2 【G11】可视化拖拽编排**：Dify 级工作流编辑器（node: LLM/工具/条件/循环），导出 playbook 复用。
**P3-3 【G2】实时语音闭环**：WebSocket 双工（现有 ws 通道已通）→ 流式 STT（faster-whisper 本地，需流式推理优化）+ 流式 TTS（edge-tts 支持流式 chunk）+ VAD 打断；移动端优先（语音对话场景）。
**P3-4 【G8】prompts 模板扩充**：从 3 个扩到 15+（总结/翻译/代码审查/图表/文档解析/记忆检索等），全部中文优先。
**P3-5 【G13】多模态对话 UX**：聊天附件区支持图片/文件 → 自动进上下文（vision/文档解析已有底层，补前端）。

---

## 四、优先级矩阵（决策就绪）

| 优先     | 项                      | 价值                                 | 成本                               | 建议                            |
| -------- | ----------------------- | ------------------------------------ | ---------------------------------- | ------------------------------- |
| **P1-1** | Artifact iframe 渲染    | 细腻度直接对标 Claude，用户感知最强  | 低（后端 1 路由 + 前端 1 组件）    | **立即做**                      |
| **P1-2** | 工具规划器并行          | 深度标志性能力，耗时 3→1 倍感知      | 中（agent_loop 改造 + 前端时序图） | **立即做**                      |
| **P1-3** | 记忆自进化默认开        | "越聊越懂你"卖点，成本可控           | 低-中                              | **立即做**（默认开 + 分级 NER） |
| **P1-4** | 官方 MCP SDK stdio      | 生态地基，社区 server 即插即用       | 中（地基工程，双轨并存）           | **排期做**                      |
| **P2-1** | MCP 商店闭环            | 生态入口，商店即护城河               | 中                                 | 排期做                          |
| **P2-2** | 中文 Connectors         | 独有主场，竞品进不来                 | 中（每连接器 2-3 天）              | 排期做                          |
| **P2-3** | Computer Use 真通       | 广度招牌，但依赖 extension 加载/真机 | 高（真机联调）                     | 需用户配合加载 extension        |
| **P2-4** | 8 端 Agent 矩阵         | 兑现独有广度                         | 中                                 | 排期做                          |
| P3-1~5   | 可观测/编排/语音/多模态 | 锦上添花                             | 中-高                              | 长期                            |

---

## 五、关键风险与提醒（v2）

1. **不宣传未兑现**：Computer Use（G4）与实时语音闭环（G2）**不要对外宣称已支持**，直到真机实测通过——v1 的教训（先宣传后实现=口碑反噬）。
2. **双轨并存谨慎**：官方 MCP SDK（P1-4）与自研引擎并存期间，48 工具注册表（`_TOOLS`）是唯一权威，两轨都须走它，避免"两个工具宇宙"。
3. **记忆默认开需隐私兜底**：auto_graph_extract 默认开后，必须同步"用户可见/可删/可关"三件套（P1-3 已含），否则隐私投诉风险。
4. **并行工具执行的安全面**：并行调用放大了单次工具的权限面，`_ADMIN_ONLY_TOOLS`/命令白名单必须保持 fail-closed 且不可被并行绕过（新增并行路径测试）。
5. **上游模型限制诚实标注**：长上下文（G14）取决于接入的模型本身，不夸大"我们支持 1M 上下文"。

---

## 六、一句话结论

> **v1 的"补实/通孤岛"已收官，底盘真实。v2 的战场是：P1-1 Artifact 渲染 + P1-2 工具并行规划 + P1-3 记忆自进化（细腻度×深度×独有体验），P2 把 8 端×中文×私有化底盘兑现成 MCP 商店 + 中文 Connectors + Computer Use。竞品有的我们追平，竞品没有的（8 端 + 中文 + 免费 TTS + 私有化）我们做满——这就是"远超"。**

_注：v1 报告见同目录 `ai-capability-gap-analysis-2026-09-01.md`。v2 所有"✅/❌"判定基于当日代码实证（含文件/行号），竞品基准来自 2025-2026 官方发布与社区公开资料。_
