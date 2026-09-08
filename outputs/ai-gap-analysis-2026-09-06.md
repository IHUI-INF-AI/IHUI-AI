# IHUI-AI AI 能力 vs Codex / Cursor / Trae / Qoder / WorkBuddy — 真实差距深度分析

日期:2026-09-06 · 依据:本仓库实际代码盘点(apps/ai-service 130+ 服务、apps/web 全组件树、GAP-PLAN.md 执行日志)+ 2026-09 各竞品公开最新状态(联网核实)。

---

## 一、一句话结论(真实判定)

**"远超他们几年"不成立。** 真实定位是:

- **广度(功能清单)上,部分维度确实领先或独有**——单会话同时具备压缩/检查点/双向 MCP/Deep Research/Teams/计划门控/成本账本/长期记忆/PR 评审/自愈引擎,目前没有任何一家竞品把这些装进同一个会话;8 端矩阵(web/桌面/小程序/RN/CLI/extension)也超过任何一家竞品的端数。
- **深度与细度上,落后主流竞品 1~2 个产品代际**——无自研模型、补全用通用大模型无专用小模型、无云沙箱车队、索引无增量更新、大量服务"写了但没接线",用户在界面上根本感知不到。
- 最伤的不是缺功能,而是**半成品断点**:后端服务存在、前端无入口、或执行器未装配,形成"代码里有、产品里无"的虚胖。

---

## 二、对标基线(2026-09 各竞品真实状态,联网核实)

| 竞品 | 2026 年关键能力 |
|---|---|
| **Cursor 3.x** | Agents Window(本地/worktree/SSH/云 VM 并行 agent,平铺分屏监控)、自研 Composer 2.5 模型($0.5/$2.5 每百万 token,内置 Tab 专用引擎来自 Supermaven 收购)、Design Mode(浏览器内点选 UI 元素直接进 chat)、BugBot 自动代码评审(Graphite 收购)、全仓库语义索引、Cloud Agents 合盖继续跑、Slack/Linear/GitHub 触发 |
| **OpenAI Codex** | 云沙箱并行任务(每任务独立容器跑测试再交 diff)、多 agent + git worktree、Skills、Automations(无人值守做 issue 分诊/CI 监控)、Sites(6 月上线一键建站)、GitHub 全量 PR 自动评审(@codex / AGENTS.md 约定)、VS Code/JetBrains/Xcode/桌面 kanban/移动端全表面、开源 Rust CLI |
| **Trae(SOLO)** | SOLO 模式端到端(主 Agent + 架构师/开发/测试/运维四子 agent,需求→部署全自动)、Builder 2.0(Figma/手绘草图→像素级前端,宣称成功率 92%)、CUE 意图预测 Tab 应用、免费前沿模型(豆包/DeepSeek)、1200 万国内用户 |
| **Qoder 1.0** | Quest 独立视窗(任务管理/状态/产物审查/知识调用一体化)、Repo Wiki(后台索引自动同步架构文档,40 万+ 生成)、跨项目多任务并行统一面板、自动模型路由(按任务复杂度选 Claude/GPT/Gemini)、Knowledge Engine 自进化记忆 |
| **WorkBuddy(腾讯)** | 340 内置专家 + SkillHub 7 万+技能市场、连接器生态(10+ 腾讯系 + 飞书/钉钉/Notion/GitHub)、Ask/Plan/Craft 三模式门控、工作区沙箱 + 高危操作二次确认、多格式本地交付(docx/xlsx/pptx/pdf/html)、联名硬件 + 移动端、月活 1115 万 |

---

## 三、IHUI-AI 真实能力盘点(代码实证)

### 后端(apps/ai-service,130+ 服务文件)——广度真实存在

- **Agent 执行**:`agent_loop.py` / `agent_loop_v2.py`(循环步进/步记录 `agent_step_recorder`/回滚 `agent_checkpoint`)、`agent_teams.py`(1 主 N 从 socket 广播)、`plan_mode.py`(计划门控)、`agent_orchestrator.py`、`dag_scheduler.py`、`a2a_service.py`(A2A 协议)。
- **上下文工程**:`token_compaction` + `compact_with_llm` + `compaction_quality.py`(保留率评估 + EMA 连续低质自动降级,竞品无公开对应物)、`codebase_indexer.py`(tree-sitter AST → 符号切片 → 1536 维 embedding → pgvector)、`context_engine` / `context_recall`、`session_summarizer`。
- **安全纵深**:`prompt_guard` / `tool_input_scanner` / `network_guard` / `exec_policy` / `os_sandbox` / `guarded_tool_pipeline` / `differential_privacy` / `audit_log`。
- **工程化**:`cost_ledger`(估算)、`tool_budget_governor`、`model_router` / `combo_router` / `key_pool_selector`(LiteLLM 网关,模型目录 70+ 条目)、`pr_reviewer`、`self_healing`、`session_handoff`(跨会话接力)、`worktree.py`、`deep_research.py`(证据分层 + 溯源 + 阶段快照)、`knowledge_graph` / `rag` / `vector_memory` / `multimodal_memory`。
- **可观测**:`telemetry_service` + OpenTelemetry + Prometheus + `shadow_runner` / `eval_service` / `failure_clusterer`。

### 前端(apps/web)——交互面比外界想象的完整

- **内嵌 IDE 壳**(`src/components/ide/`):文件树、Monaco 编辑器、diff 查看器(diff-file-list / diff-stats-bar / diff-viewer-pane)、终端面板、source control 面板、MCP 面板、agent 面板。
- **AI 补全**:`CodeEditor.tsx` 注册 Monaco InlineCompletionsProvider(debounce 300ms,Tab 接受,失败静默降级)。
- **Spec 面板**(`src/components/ai/spec-panel/`,2026-07-22 立,明确对标 Trae Spec/Copilot Workspace):AST 反向生成规格、历史版本 diff、代码生成 patch、评审 approve/reject 状态机、任务拆分、影响分析。
- **会话级杀手锏 UI**:检查点回滚面板(`checkpoint/CheckpointRewindPanel`)、压缩状态条(`compaction-status-bar`)、高风险命令横幅、全量确认桥、权限模式 popover、agent 任务进度窗格、Deep Research 前端、长期记忆管理、PR 评审前端、A2A 面板、orchestration hub。
- **聊天输入**:@mention、slash 命令、文件上传、模型选择器 + 降级链、技能库面板、语音输入(`chat/voice-input.tsx` / `voice-record.tsx`)。
- **过程可视化**:工具调用卡片(`ai/tool-call-card.tsx`,名称/参数/状态/时长/重试/轮次)、AgentTraceViewer、子 agent 活动流(`sub-agent-activity-feed.tsx`)、swarm 拓扑视图(`swarm-topology-view.tsx`)、上下文占用环 + Token 饼图/历史图。
- **全局快捷键体系**:`use-global-shortcuts.ts`(Ctrl+K 命令面板、Ctrl+Shift+P 视图切换、Ctrl+1~4 切模式、Ctrl+/ 帮助)。
- **通知体系**:web `NotificationCenter` + 桌面原生推送 + 移动端系统推送(`use-push.ts`)。

---

## 四、差距逐项判定(深度 / 细度 / 广度)

### 4.1 深度差距(核心能力天花板)——真实落后 1~2 代

| # | 维度 | 竞品水平 | IHUI-AI 现状 | 判定 |
|---|---|---|---|---|
| 1 | **模型层** | Cursor 自研 Composer 2.5;Codex 绑定 GPT-5.5;Trae 免费前沿模型 | 无自研模型,纯第三方 LiteLLM 网关转发 | **最大结构性差距**,补齐需训练资源,非工程手段可解 |
| 2 | **Tab 补全** | Cursor 专用补全引擎(收购 Supermaven),毫秒级、多行、无限量 | 通用大模型走 InlineCompletionsProvider,300ms debounce,延迟/质量/成本三输 | 落后明显;需专用小模型(FIM 微调)才有竞争力 |
| 3 | **并行 agent 隔离** | Cursor/Codex:每 agent 独立 git worktree + 云 VM,合盖继续跑 | 有 `worktree.py` 但前端无 /worktree 入口、无 per-agent 隔离 UI;无云沙箱车队(容器仅本机 `container_runtime`) | 服务存在、产品形态缺失 |
| 4 | **代码库索引** | Cursor:全仓语义索引 + 增量更新;Qoder:Repo Wiki 自动同步 | `codebase_indexer` 有 AST+向量检索,但**无增量索引/Merkle 失效追踪**,每次全量,大仓不可用;无自动同步的 Repo Wiki 界面 | 后端 70 分,前端 0 分 |
| 5 | **PR 自动评审闭环** | Codex:GitHub 全量 PR 自动评审 + AGENTS.md 约定注入 + CI Action | `pr_reviewer.py` 服务在,但**无 GitHub App/Action、无 @机器人触发**,只能手动 | 有引擎无管道 |
| 6 | **无人值守自动化** | Codex Automations(issue 分诊/CI 监控)、WorkBuddy 定时任务 | 有 `scheduler_service` / `automation_executor`,但偏内容调度,无 CI/仓库事件驱动 | 方向不同,工程深度不及 |

### 4.2 细度差距(交互/显示/使用细节)——这是最密的一层

1. **Deep Research 无前端专用入口**:`deep_research.py` 证据分层/溯源/阶段快照完整,但 UI 上无独立入口/进度视图/报告页——竞品(Codex/WorkBuddy)均有专用交互面。能力在,用户够不着。
2. **并行监控 UI 半残**:无 Cursor 式平铺/网格多 agent 监控分屏;Teams 有活动流与拓扑视图,但**无独立 Teams 管理页**(创建/成员/任务编排全流程),也无 Qoder 式跨任务统一面板(每任务状态标签:运行中/待确认/完成)。
3. **成本不可见**:聊天页无实时 token/费用计数,用量面板在 admin 区;Cursor/Qoder 用户随时看到 credit 消耗。且 `cost_ledger` 是估算价表,非真网计价(GAP-PLAN 已知缺口)。
4. **无 Design Mode / 设计稿转代码**:Trae Builder 2.0(Figma/草图→像素级)与 Cursor Design Mode(浏览器点选元素进 chat)均无;web-input 支持贴图但无"点选即上下文"。
5. **移动端体验割裂**:Codex/Trae 可手机发起任务、桌面/云执行、PR 回审;本项目 mobile-cap 刚打通推送,但无浏览器工作区、无成本/记忆设置、无文件级 diff——移动端目前"能收通知,不能干活"。
6. **检查点/回滚有 UI 但披露不足**:回滚面板存在,但无"全活动时间线回放"(压缩/回滚/成本/注入事件统一回放),GAP-PLAN P1-4 本身就承认未完成。
7. **MCP 管理是配置面板不是市场**:有 mcp-pane 双向 MCP,但无 per-agent MCP 作用域(Cursor 3 支持按 agent 裁剪)、无服务端能力市场(GAP-PLAN P2-8 未启动);WorkBuddy SkillHub 7 万+技能对比,本项目技能市场是自产自销。
8. **终端与桌面体验**:web IDE 有终端面板,但 apps/cli 无 Codex CLI 式全屏 TUI(approval 三档/`exec --json` 用量输出),桌面端无 Codex 式 kanban 任务板。
9. **异步感知边界**:通知三端链路已通,但无"合盖继续跑"的云 agent,通知的上游能力本身受限于本机进程存活。
10. **生态集成数**:竞品 Slack/Linear/GitHub/JetBrains/Xcode 60+ 集成;本项目连接器以 IM/内容平台为主,无 SCM 深度集成(git 面板仅本地)。

### 4.3 广度:IHUI-AI 真实领先/独有项(不吹不黑)

1. **单会话能力聚合度全行业最高**:压缩(带质量自证)+ 检查点回滚 + 双向 MCP + Deep Research(证据分层溯源)+ Teams 多 agent + 计划门控 + 成本账本 + 长期记忆 + PR 评审 + A2A——五家竞品没有任何一家同时具备;Cursor/Codex 各强一边。
2. **压缩质量自证**(`compaction_quality.py`:保留率评估 + 高低价值分类 + EMA 连续低质自动降级 fallback)——检索无任何竞品有公开对应机制,属真创新。
3. **安全纵深独厚**:prompt_guard / tool_input_scanner / network_guard / exec_policy / guarded_tool_pipeline / differential_privacy 六层,竞品公开材料中未见同密度注入防护栈。
4. **Spec 面板完整度**:AST 反向生成 + 版本 diff + patch 生成 + 评审状态机 + 任务拆分 + 影响分析,与 Qoder Quest Spec / Trae Spec 同类,且增加了"反向生成"(从代码生成规格)方向。
5. **8 端同构矩阵**:web/桌面(Tauri)/小程序/RN/CLI/extension,竞品最多 4~5 端;但见 4.2 细度——端多不等于每端深。
6. **验证自愈引擎、跨会话接力(session_handoff)、MCP 超级工具聚合(去重+仲裁+schema 归一)**——设计上均无对照物,但见下节:都没接线。

### 4.4 半成品断点清单(最伤的部分,"有代码≠有能力")

| 半成品 | 现状 | 断点 |
|---|---|---|
| `mcp_tool_aggregator.py` | 去重+三仲裁+schema 归一化已完成,30 测绿 | **未接入执行器装配**,agent 感知不到超大工具集 |
| `self_healing.py` | generate/run_diagnose/heal 骨架完成,29 测绿 | LLM gen/patch 未接、pytest 子进程 runner 未接 |
| `compaction_quality.py` | 评估+降级完成,31 测绿 | 提交通道未接入 agent_loop_v2 |
| `pr_reviewer.py` | 服务在 | 无 GitHub App/Action/触发器,用户不可达 |
| `worktree.py` | 后端在 | 前端无入口,并行 agent 无隔离收益 |
| `codebase_indexer.py` | 全量索引可用 | 无增量更新 → 大仓实际不可用;前端无索引状态 UI |
| `session_handoff.py` | 实现+部分测试(自评 40%) | 未进产品主流程 |
| `prompt_guard.py` | 实现 | **0 测试** |
| `deep_research.py` | 证据分层/溯源/阶段快照完整 | **前端无专用入口**,能力不可达 |
| `cost_ledger` | 估算价表 | 真网计价需厂商价表(GAP-PLAN 已知外部依赖) |
| `cloud_run_store` | 云端运行记录存在 | 无真正云沙箱集群,本机容器支撑不了合盖运行 |

---

## 五、总结判定

| 维度 | 结论 |
|---|---|
| 广度 | **接近或局部超过**竞品:会话级聚合能力、端矩阵、安全栈真实领先;"几年"谈不上,竞品也在高速迭代 |
| 深度 | **落后 1~2 个代际**:无自研/专用模型、无云沙箱并行、索引无增量、补全无专用引擎——这些是资源型差距,不是代码写不出来 |
| 细度 | **差距最大**:10+ 项交互细节缺失(Cmd+K、成本可见、多 agent 分屏、per-agent MCP 裁剪、时间线回放、移动派单闭环等);且半成品断点让大量后端能力用户零感知 |
| "远超几年"? | **不成立。** 更准确的说法:架构蓝图与功能清单已对标 2026 主流竞品且局部独有,但产品完成度约为竞品的 60~70%,深度细度按 GAP-PLAN 自己的口径是 95% vs 99%——而竞品的 99% 是千万人级使用打磨出来的 |

## 六、优先级行动建议(只列工程可做项)

1. **P0 接线清零**(纯工程,无外部依赖):mcp_tool_aggregator 接执行器 → self_healing 接 LLM → compaction_quality 接提交通道 → pr_reviewer 挂 GitHub Action。这四项做完,"有代码没能力"的虚胖直接消失,广度优势才真正兑现。
2. **P0 交互补齐**:聊天页实时成本显示 + Teams 独立管理页 + Deep Research 前端入口 + 多 agent 状态统一面板(均为纯前端,一周量级)。
3. **P1**:codebase_indexer 增量更新(changed-file hash 对比即可起步)+ 前端索引状态;worktree 前端入口(/worktree 命令 + per-agent 隔离)。
4. **P1**:Tab 补全专用化——接一个开源 FIM 小模型(如 DeepSeek-Coder 级)走本地/自托管,摆脱通用大模型延迟。
5. **P2(需资源,如实告知)**:云沙箱车队、自研/微调补全模型、GitHub App、移动派单闭环——这些是竞品用重资源堆出来的,单靠工程迭代追不平,需明确投入决策。
