<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AI 对话全链路四竞品深度对标分析 V3(Codex / Trae / Qoder / WorkBuddy)

> 2026-09-26 立。V1(2026-09-12,编号 1–14)、V2(2026-09-15,编号 15–36)、P3 先行梯队(2026-09-15 拍板,编号 38–46)见 `PROJECT_PLAN.md` 各批次与 `docs/AI_CHAT_BENCHMARK_ANALYSIS_V2.md`。**本轮编号自 47 起**。
>
> **本轮的定位差异(必读)**:前两轮解决的是「对话流里**看得见**的元素」——标题、行号、文件 chip、usage、记忆提示、diff 评论……这些已于 2026-09-17 前后基本交付(§二有实测核验)。本轮下沉到前两轮**没有触及的一层**:**能力是否真实存在、是否真的接进了主链路、是否默认在跑**。调查对象是内核一致性、工具真实性、env 默认态、端落差,而不是又一个 UI 组件。
>
> 本轮三份亲眼证据来源(均为本仓实测,E1):① `apps/web` 对话前端全链路;② `apps/ai-service` 编排内核(552 个 py 文件 / 65,724 行 + 505 个测试文件 / 59,308 行);③ 其余 7 端与 18 个 packages。另有 4 路竞品调研,等级标注见各节。
>
> 证据等级沿用 D57 口径:**E1** 本仓代码/命令实测;**E2** 竞品本机一手取证;**E3** 竞品官方文档/公告;**E4** 联网二手(社区/媒体);**E5** 推测/不可核证。凡标 E5 不得支撑「有/无」判定。
>
> **WorkBuddy 条目仍为 E5·二手·不可核证**(承 V2 §一.4 声明:本机无本体、无安装包、无运行时取证物;本仓 `.workbuddy/` 系我方自建状态目录,与该竞品无关)。本轮 WorkBuddy 相关条目继续只作方向参考,不参与差距「有/无」判定。

---

## 一、结论先行

**一句话病根(第三轮,新的)**:本<｜hy_place▁holder▁no▁813｜>过 V1/V2/P3 三轮补齐后,**已经把「对话流表面」做到了竞品水准**,但整条链存在一个更深的结构性问题——

> **「三套内核并存 + 一批能力只有空壳 + 一批移植件默认关着」**,导致同一句「我们有 XX 能力」在不同子系统里答案不同。

三层具体表现,按严重程度排序:

| 层 | 事实(E1) | 后果 |
|---|---|---|
| **① 内核分裂** | `ai-service` 里有**三套并行执行内核**:A 内联 tool loop(`routers/llm.py`)、B `AgentLoopV2`、C `AgentEngine`(Codex JSON-RPC 移植)。C 的 **15 个内置工具在 A/B 里一个都调不到**;A 的 `_FS_DEPENDENT_TOOLS` 里写着 `apply_patch`/`create_file`/`delete_file`/`move_file` 4 个**从未注册**的工具名 | 前端同一套 UI,后端行为随入口而变;`/api/llm/complete/stream`(主聊天)与 `/api/agents/execute/stream` 能力不对等 |
| **② 空壳/回显** | 至少 **8 处**是桩或回显:`generate_test`(模板桩)、`analyze_code`(只数行数)、`run_in_background`(只有 `sleep`/`echo` 两个演示任务)、`/dag/execute` 与 `WorkerPool._default_executor`(回显 context keys)、`rag._rerank`(只按已有 score 排序)、`edu_*`×14(HTTP 转发薄壳)、`browser_*`×12 / `computer_*`×10(外部 agent-control 代理,未配 URL 即失效) | 对外能力目录 86 个工具,实际可用远少于此;模型调用到桩工具会拿到"假装成功"的结果 |
| **③ 默认关闭** | 至少 **9 项**移植已完成却 `env` 默认 off:`AGENT_COMPACTION_ENABLED=false`、`AGENT_COMPACTION_CONTEXT_LIMIT=0`、`AGENT_COMPACTION_LLM_ENABLED=false`、`AGENT_COMPACTION_RETENTION_BUDGET_ENABLED=false`、`AGENT_SELF_HEALING_ENABLED=false`、`AGENT_BUDGET_ENABLED=off`、`AGENT_TEAM_RELAY_ENABLED=off`,以及 file_watcher / elicitation pause 两个 env 门控 | 线上用户从未体验到这些能力。对标时必须按「未启用」计,不是「已有」 |

**与 V1/V2 病根的关系**:V1 病根「能力库存 > 实际生效」在 V1/V2 里被当成一个**连接问题**(组件写了没接线),V3 实测发现它其实有三种形态——**分裂**(多套实现不互通)、**空壳**(实现本身是占位)、**关着**(实现完整但开关为 off)。V2 病根「智能在后台发生但对话流看不见」则已基本被 V2/P3 修复(§二)。所以本轮不再重复 V2 的 UI 元素清单,除非是 V2 遗留未交付项(#23 多端同步、#32 富预览,已在 §二标 NO 并在本轮重列为 70/71)。

**排名建议**:如果只做一件事,做 **47(三内核归一)**;如果只做两件,加 **55(AgentLoopV2 压缩默认开)**;如果做三件,加 **58(主链路工具审批门)**。这三项分别是三层病根的最大单点。

---

## 二、前两轮交付实测核验(本轮公信力基线)【E1:2026-09-26 现场核验】

核验方法:对 V2 编号 15–36 与 P3 编号 38–46 各自的关键交付物做**文件级/符号级存在性检查**(不是看台账勾选态,也不是看文档自述)。

| # | 项目 | 核验证据 | 结果 |
|---|---|---|---|
| 15 | 会话标题自动生成 | `apps/api/src/routes/chat.ts` 有 `auto-title` 路由 + `send-message.ts` 有 `autoTitleAfterFirstTurn` | ✅ |
| 16 | 流式平滑渲染 | `hooks/use-chat/smooth-delta-batcher.ts`(逐帧 `max(2, ceil(remaining/8))` 字符) | ✅ |
| 17 | 代码块行号 | `markdown-stream.tsx:455` `showLineNumbers={!!lineNumberStyle}` | ✅ |
| 18 | `#` 语义源选择器 | `hooks/use-context-selector.ts`(9 类:`#File`/`#Folder`/`#Code`/`#Problems`/`#Terminal`/`#Web`/`#Doc`/`#PastChats`/`#Rule`) | ✅ |
| 19 | 消息内文件引用 chip | `message-list/file-chips.tsx` | ✅ |
| 20 | 轮次变更汇总 | `message-list/turn-changes-card.tsx` | ✅ |
| 21 | usage 流内事件 | `client.ts` 命名帧路由含 `usage` | ✅ |
| 22 | Last-Event-ID 重放 | `client.ts:1996-2000` 自动重连 + `Last-Event-ID` + 内容 dedupe | ✅ |
| **23** | **chat 多端/多标签实时同步** | **全仓无 conversation 级 WS 房间;chat 仍走 `fetch+ReadableStream`,不走 WS** | ❌ **未交付** |
| 24 | 消息游标分页 | `nextCursor` 已存在于 api/`hooks` | ✅ |
| 25 | SSE 契约单一事实源 | `ai-service/app/core/sse_contract.py` + `packages/shared/src/sse/contract.ts` 双端对账 | ✅(但内容有漂移,见 48) |
| 26 | RAG 默认注入 | `send-message.ts:598` `knowledgeContext`(后端 top-3 注入,可关闭) | ✅ |
| 27 | 记忆更新可视化 | `progress-sections/memory-notice-bar.tsx` | ✅ |
| 28 | 代码块一键运行 | `components/ai/code-block-run.ts`(沙箱白名单 node/python3/npx) | ✅ |
| 29 | AI 个性预设 | persona 相关 `sampling-params-panel` 人格档 | ✅ |
| 30 | diff 评论驱动返工 | `chat/diff-comments-bar.tsx` | ✅ |
| 31 | 全局任务看板 | `ai-side-panel-tools.tsx` 的 `kanban` tab | ✅ |
| **32** | **PDF/CSV 富预览** | **全仓无 `pdfPreview`/`PdfPreview` 组件** | ❌ **未交付** |
| 33 | 思考分节标题 | `lib/reasoning-sections.ts` `splitReasoningSections` | ✅ |
| 34 | SR 全流程 | `chat/sr-stream-announcer.tsx`(`aria-live=polite`) | ✅ |
| 35 | 增量 markdown 缓存 | `lib/markdown-stable-split.ts` `splitMarkdownStable` | ✅ |
| 36 | 多模型并排对比 | `ai/best-of-compare.tsx` | ✅ |
| 38 | 并行世界线 | `stores/worlds.ts` + `ai/worlds-compare.tsx` + 单测 | ✅ |
| 39 | 分享带执行轨迹 | `ai/trace-replay.tsx` 消费 toolCalls(注:分享快照写入侧是否全链路带 toolCalls 仍待复核) | ⚠️ **部分** |
| 40 | 主动巡逻 Agent | `packages/database/src/schema/patrol.ts` + `apps/api/src/routes/patrol.ts` + `index.ts` 注册 | ✅ |
| 41 | 记忆图谱注入 | `llm.py` 有 `_inject_memory_graph` | ✅ |
| 42 | 全栈原子回滚 | `ai-side-panel-tools.tsx` 的 `atomicrollback` tab(落地形态演化为「文件制原子快照」) | ✅ |
| 43 | 成本协商代理 | `ai/cost-estimate-bar.tsx`(发送前预检 + 流后对比) | ✅ |
| 44 | 团队作战室 | `swarm`/`orchestration` tab | ✅ |
| 45 | 自愈工作区 | api/web 有 self-heal 链路(注:`AGENT_SELF_HEALING_ENABLED` 仍默认 off,见 56) | ⚠️ **接了但默认关** |
| 46 | 实时语音协作 | `chat/voice-stream-speaker.tsx` 流式 TTS | ✅ |

**结论**:V2 22 项交付 20 项,P3 9 项交付 8 项。**唯一两处真未交付是 23(多端同步)、32(富预览)**;另有 39(分享轨迹写入侧)、45(自愈默认关)两处「部分」。本轮把 23/32 重列进 V3(编号 70/71),不再另起新项;45 的情况并入 56。

> 这个结果同时说明一件事:V3 若还停留在「再加几个 UI 组件」的水位,就是在重复劳动。因此本轮全部切口在 UI 之下。

---

## 三、本项目现状量化盘点【E1】

### 3.1 ai-service(编排内核)

| 指标 | 实测值 | 出处 |
|---|---|---|
| Python 文件 / 行数(app/) | 552 / 65,724 | 目录遍历 |
| 测试文件 / 行数(tests/) | 505 / 59,308(测试:代码 ≈ 0.9:1) | 目录遍历 |
| HTTP 端点 | 541(`@router.*` 计数) | 全仓 grep |
| 服务/路由模块 | services 194 个 / routers 76 个 | 目录计数 |
| 内置工具 | 86(`_TOOLS` 与 `_TOOL_HANDLERS` 严格 1:1) | `mcp_server.py` |
| Provider 适配器 | 20 | `llm_gateway.py` |
| 计价表条目 | 117(≈39 模型 × in/out) | `model_pricing.py` |
| SSE 契约声明事件 | 26 | `core/sse_contract.py` |
| 主 agent loop 最大迭代 | A=8(`config.py:64`)/ B=10(构造默认,请求传 8)/ C=8 | 各内核 |

### 3.2 apps/web(对话前端)

| 指标 | 实测值 |
|---|---|
| 对话主容器 | `ai-side-panel.tsx`( ~83 KB / 1200+ 行),**全站 docked**,`/chat` 路由只是快捷深链 |
| 单条消息组件 | `message-item/MessageItem.tsx` 1591 行 |
| 输入框 | `message-input.tsx` 1429 行 |
| 会话列表 | `sidebar-chat-history.tsx` 973 行(置顶/重命名/归档/文件夹/标签/导出/分享) |
| 工具面板 tab | 26 个(goal/memory/plan/tasks/progress/agents/background/swarm/…/workspace) |
| SSE 传输 | `fetch + ReadableStream` 手工解帧(为 Bearer + abort + 绕过 Next dev proxy),**非 EventSource** |
| 零消费者孤儿件 | `ChatSearchBar` / `useChatSearch` / `useContextMention`(多维 @ 检索)/ `stores/context-mention.addMention` / `mode-indicator.tsx`(CLI 侧 ink 孤儿) |

### 3.3 其他端

| 端 | AI 能力实况 |
|---|---|
| `apps/cli` | **真·终端 coding agent**:约 44k 行 + 168 测试;约 40 顶层命令 + 37 slash 命令 + 约 90 工具 + 5 档权限 + MCP(stdio/http/sse + OAuth)+ ACP + undo/redo + 检查点。**UI 是 chalk+ora+inquirer+readline 手搓,无 ink 全屏 TUI** |
| `apps/desktop` | **Tauri 2 薄壳**,`tauri.conf.json` 的 `app.windows[0].url = https://aizhs.top/agents`;36 个 command 全是非 AI(窗口/剪贴板/键鼠/截图/文件);**零本地索引、零 agent 面板、无 `src/` 前端** |
| `apps/api` | Fastify 5 + Drizzle;会话/消息/SSE(`/api/ai/chat/stream`)/断点续传/工具审批(13 端点)/计费/配额/JWT+API Key+Secret/多租户 RLS fail-closed |
| `apps/extension` | 双身份:侧边栏 Chat/Agent 页面 + agent 的浏览器被控端(12 动作 + ext_ui 7 动作) |
| `apps/mobile-rn` | 有 AI,走 `@ihui/rn-app` 共享 feature |
| `apps/miniapp-taro` | **几乎无 AI**,仅 `ask` 问答社区;pages 下无 chat/agent |
| `packages/database` | 222 schema 文件 / 472 张表;AI 相关含 `codebase_chunks`(pgvector 1536 维 + HNSW)、4 张记忆表、`agent_checkpoints` 等 |

---

## 四、竞品基线(2026-09 实况)【本节标注各自的证据等级】

### 4.1 OpenAI Codex【E3:官方公告/文档 + 社区二手 E4 交叉】

| 维度 | 做法 |
|---|---|
| 权限模型 | **双轴**:`sandbox_mode`(`read-only` / `workspace-write` / `danger-full-access`)× `approval_policy`(`untrusted` / `on-request` / `never`),用 `--profile <name>` 整套切换(config.toml `[profiles]`) |
| 安全增强 | 2026-04 起新增 **guardian subagent**:对挂起动作做复核,而非直接盖章放行 |
| 工具发现 | MCP **tool search 默认开启**,大 MCP server 不再淹没上下文 |
| 并行 | subagent + **git worktree 隔离**,每个子 agent 独立容器,结果经 worktree merge 回主线 |
| 配置 | `~/.codex/config.toml` + 仓库级 `.codex/config.toml` + `AGENTS.md` 层级 |
| 执行 | `codex exec` headless,可进 CI;sandbox 用 Apple Seatbelt(macOS)/ Docker(Linux)/ WSL2(Windows) |
| 对话显示 | 分节化 reasoning(`agent_reasoning_section_break`)+ `exec_command_begin/end` + `patch_apply_begin/end` 分类事件卡 + `turn_diff` 轮次 diff(可直接在 diff 上评论返工) |

**对标缺口提炼**:本项目 **权限形态不同**(是 permission_mode 单轴 + 工具名白名单双通道,无独立的 sandbox_mode 轴)、**无 guardian 复核子 agent**(有审批但没有「复核者」)、**tool deferral 已有**(等价 tool search,`TOOL_DEFERRAL` 默认 on)、**worktree 隔离 subagent 已有**(CLI 侧 `worktree.ts` + `subagent/`,但 web 主链路未用,见 #78)。
→ 对应 V3 编号:**79(权限双轴化)**、**80(guardian 复核代理)**。

### 4.2 Trae(ByteDance)【E3:官网 + E4:评测/社区】

| 维度 | 做法 |
|---|---|
| 产品形态 | TRAE IDE(IDE 模式 / SOLO 模式)+ **TRAE Work**(全新 AI 办公平台,桌面/网页/移动全量)+ Cloud IDE |
| SOLO | 2026-03-31 起为**独立 app**(不再依赖 IDE 插件),两模式:**Code**(聊天驱动编码循环)与 **MTC(More Than Coding)**——面向 PM/数据/市场/运营,做文档、报表、PPT、竞品调研 |
| 补全能力 | **CUE**:多行补全 + multi-line edit + **predictive edit**(独立预测模型) |
| 上下文 | `@文件/@文件夹/@代码块`;`#Codebase/#Docs/#Terminal` 语义源;文档集上传 + 联网 |
| 变更管理 | 回复附「修改文件列表」+ 绿红 diff 视图 + 接受/拒绝/**整体 revert** |
| 执行可视化 | 思考实时可视化;命令在内部终端跑、输出回显对话;**预览 tab 里 agent 直接操作浏览器元素并读 console** |
| 生态 | 自定义 Agent(工具+技能+任务逻辑)→ 可**分享到 Agent 市场**;MCP 装配;多任务并行 + 上下文压缩 + 代码变更追踪 |

**对标缺口提炼**:本项目 **无 wiring-level 的 MTC/办公态分流**(有 mode build/plan/review/spec,但无"非编码工作流"一类的工作面)、**无 predictive edit**、无 Agent 市场分享闭环(有 `ai-skills` 与 `packages/shared/src/skills/market.ts`,但是否可比待确认)。
→ 对应 V3 编号:**81(MTC 态工作面)**、**82(predictive edit)**。

### 4.3 Qoder(阿里)【E3:官网 + docs.qoder.com Quest 文档 + E4:阿里技术公众号】

| 维度 | 做法 |
|---|---|
| Quest | 2026-05 Qoder 1.0 起为**独立视窗**(与 Editor 双窗并行):**三栏**(左=任务管理/扩展,中=会话,右=功能区) |
| 子模式 | **Agent**(单 agent 端到端)/ **Experts**(多 agent 并行协作,可自定义专家团队角色/流程/能力边界) |
| 驱动方式 | **Goal-driven**:只描述终态,`/goal` 后 Quest 自拆路径、每轮自评估是否达成,未达成自动下一轮(默认 10 turns,可调);支持运行中**编辑 goal / 暂停保留全部上下文 / 恢复** |
| Spec-driven | 自动生成**技术设计文档 Spec** 再按条目实施 |
| 知识层 | **Repo Wiki**(10 万文件级,已生成 40 万+)+ **Knowledge Engine**(从代码与对话自动蒸馏 Knowledge Cards)+ Memory |
| 耐久 | **单次 agent 执行最长 26 小时**;跨 project 多任务并行 |
| 任务治理 | Quest 状态四值 Running / Action Required / Ready / Error;**My Quests 全局看板**:跨 workspace 三列看板 + 搜索框 + workspace tab 过滤(带任务数);卡片支持 Pin / Fork / 重命名 / 删除;完成自动出 Summary 交付清单 |
| 会话区 | `@文件/文件夹/符号` + 模型选择 + 麦克风 + **输入框底部常驻上下文压缩条**;右侧功能区 Summary / Review(**side-by-side diff** + review & reject)/ 参考来源;右侧查找 rail 快速定位会话位置 |

**对标缺口提炼**:本项目 `#上下文选择器` 已对标;`Proactive Summary`(`autoTitleAfterFirstTurn` 有,Summary 交付清单待确认);`Goal 模式有(`/goal`)**但缺 "每轮自评估 + 未达成自动续跑" 的闭环强度**;`Spec` 有(/spec 模式)但产物形态待对标;**26h 超长执行**受 `run_in_background` 只有 sleep/echo 的限制而不成立;`My Quests` 式跨 workspace 全局看板未确认成形;`side-by-side diff` 未见;能否真正吞吐 10 万文件未实测。
→ 对应 V3 编号:**77**(Goal 自评估闭环 + My Quests 全局看板)、**84**(26h 超长执行底座)、**75**(10 万文件级检索 + ripgrep)、**66**(side-by-side diff)。

### 4.4 WorkBuddy【E5·二手·不可核证】

> ⚠️ 本节为 E5。本机无本体、无安装包、无运行时取证物,以下仅作方向参考,不支撑任何「有/无」判定。

二手材料提及:计划/执行/提问三模式;任务清单 UI 状态流转;`run_in_background` + 完成通知;内联可视化 widget(SVG 图表/交互组件随对话流出);项目布局快照 + 身份文件注入 + 三层记忆(云端画像/用户级/工作区日志);多 agent 团队与共享任务看板;Skills 触发词路由;定时自动化;结果文件卡片;检查点回退。

方向性启发(不计入判定):**三层记忆的分层 + governance 模型**、**内联可视化随对话流出**(对应本项目已有 `ArtifactCanvas` / `CanvasOverlay` / work-panel 三套 produce 面)。
→ **不入 V3 编号**(F 组 79–86 已满)。仅登记方向,待后续轮次若取得一手取证(E2)再升级为正式条目;不因 E5 而立项为 P0。

---

## 五、V3 差距总表与开发计划

图例:🔴 **P0**=结构性/正确性缺陷,不修会持续误导;🟡 **P1**=体验与对等性;⚪ **P2**=长尾;🔵 **P3**=五年领先梯队。
编号 47 起;表内「现况证据」均为 E1 本仓实测。

### A 组 · 内核真实性(47–54)——「能力是不是真的」

---

**#47 · 🔴 P0 · 三套执行内核工具集归一**

- **现况**:`ai-service` 有三条并列主链路(E1):
  - **A** 内联 tool loop — `routers/llm.py:2508`,工具源 `mcp_server._TOOLS`(86),max_iter 8。这是**主聊天流 `/api/llm/complete/stream`**(前端 `/chat` 走的就是它)。
  - **B** `AgentLoopV2` — `services/agent_loop_v2.py:3310`,同工具源,max_iter 10(请求默认 8),文档自称「D6 归一后唯一执行事实源」。
  - **C** `AgentEngine`(Codex JSON-RPC 移植)— `routers/engine.py:241`,工具源是 `agent_engine.BUILTIN_ENGINE_TOOLS`,**15 个,与 A/B 零重叠**:`update_plan` `spawn_subagent` `view_image` `request_permissions` `unified_exec` `request_user_input` `apply_patch` `run_code` `web_search` `new_context` `clock_sleep` `clock_curr_time` `send_message_to_user_async` `request_user_input_async`。
- **差距**:每对外行文说「支持 XX」时,答案取决于调用的是哪个入口。Codex/Trae/Qoder 都是**单一执行面**(E3)。这是本轮最严重的单点。
- **方案**:
  1. 定 A(+B)的 86 工具注册为**唯一工具事实源**(`mcp_server._TOOLS`)。
  2. 把 C 的 15 个按语义**映射或移植**进同一个注册表:`apply_patch`→`patch_diff.apply`(已有 `core/apply_patch.py`)/ `run_code`→`code-block-run` 沙箱通道 / `view_image`→`vision_analyze` / `request_user_input(_async)`→已有 SSE `question` 通道 / `clock_sleep`|`clock_curr_time`→`model_tools_57` 已有 spec+handler / `new_context`→已有 compaction 入口 / `update_plan`→`plan_mode.py` / `spawn_subagent`→`_tool_dispatch_subagent` / `request_permissions`→已有审批面 / `web_search`→同名工具 / `unified_exec`→`run_command` / `send_message_to_user_async`→SSE `question` 的异步变体。
  3. 删掉 C 路径里重复实现,只保留 JSON-RPC **协议适配层**,行为委托回统一注册表。
  4. 新增守门:CI 断言 `BUILTIN_ENGINE_TOOLS` ⊆ `_TOOLS` 的映射表完整性(参照既有 `check-agent-engine-parity.mjs` 扩)。
- **验收**:同一句 prompt 走 `/api/llm/complete/stream`、`/api/agents/execute/stream`、`/api/engine/rpc` 三者,可调用工具集一致(差值空集);parity 守门进 pre-commit。
- **依赖**:无。必须第一个做。

---

**#48 · 🟡 P1 · SSE 契约真相化:删死契约、收漂移、对账常量事实源**

- **⚠️ 初版结论两处已被施工取证推翻(2026-09-26,诚实更正)**:
  1. **`budget` 不是幽灵**。初版说「`llm_gateway.py` 零产出 ⇒ 幽灵」——错在只查了 ai-service。真实生产点在 **apps/api 网关**:`ai-chat-stream.ts:776/1039` 的 `checkTokenBudget` 三态分流(block→429 / warning,critical→`extraFirstEvents` 流首命名帧),消费在 `client.ts:2858-2877`。**契约注释原文就写着「网关发」——字面正确,是探查没查网关层。教训同 #49:跨端事件先查网关。** 处置:保留,契约注释补生产点精确位置。
  2. **「9 个漂移事件」清单需修正**。`message_*`/`content_block_*` 6 个不是对话流事件,是 llm.py 的 **Anthropic Messages API 兼容端点**产物(`agent_events.py:88-93` 常量),混进对话流契约会失真;`form_request` 则是**前端单方面解析了一个后端从不发的帧**(client.ts:3160 + business-form-card 死消费,后端 api/ai-service 全查零生产)——它属于 #63 的范畴(要么实现生产要么删死消费),不是契约漂移。
- **真实成立的部分(E1)**:
  - `token`:全仓(ai-service llm.py/agent_events.py、apps/api ai-chat-stream/agent-runtime/agent-langgraph)**零生产点**,确认死契约;真正在用的是 `chunk`(两者曾双写同一语义)。前端 `use-agent-stream.ts:272` 有消费分支,但其 `SSEEvent` 来自 `@ihui/types` 的 **langgraph 专用词表**,与 shared 契约无关——该词表是否发 token 属 langgraph 链路卫生,不在本枚范围。
  - `terminal_delta`(`agent_events.py:67` 常量 + `mcp_server.py:1414` dict 形态产出)与 `start`(`agents.py:1011`):**生产一直在、契约漏登**。此前 parity 门只扫 `_sse(...)`/`event:` 形态,dict 形态漏网 ⇒「生产 ⊆ 契约」断言假绿。
- **方案(已于同日落地)**:
  1. 契约(双端同步):删 `token`;补 `terminal_delta`/`start`;**新增 `SSE_COMPAT_EVENTS`** 单列 6 个 Anthropic 兼容面事件;`budget` 注释补生产点精确位置。
  2. parity 门(`check-agent-event-parity.mjs`)新增两条对账:**0b-2 兼容面双端一致**、**0b-3 `agent_events.py` 的 `SSE_*` 常量值域 ⊆ 契约 ∪ 兼容面**(dict 形态生产点引用常量,对账常量事实源即可全覆盖,不靠脆弱正则)。
  3. parity 门 1h 扫描器**补注释剥离**——施工中真抓到一次:新加的契约注释里带引号的 `"task_id"` 等字段名被旧正则吸进集合造成假漂移,与 #49 守门的取材铁律同型(注释里有带引号的词,裸正则必炸)。
- **验收**:parity 门 rc=0(错误 0/警告 6 条既有不阻断);兼容面 TS(6)=PY(6) 一致;`agent_events.py` 29 个常量全部落契约(豁免 1 个兜底别名 `SSE_MESSAGE`);`contract.test.ts` 的编译期穷尽映射同步(TOKEN 删/TERMINAL_DELTA、START 补)。

---

**#49 · 🔴 P0 · 幽灵工具名清理 + 工具别名表扩充**

- **现况(E1)**:`routers/llm.py` 的 `_FS_DEPENDENT_TOOLS` 含 `apply_patch` `create_file` `delete_file` `move_file`,这 4 个确实**不在**本地注册表 `mcp_server._TOOL_HANDLERS`。`_TOOL_ALIASES` 原先**只有 2 条**(`execute_command→run_command`、`list_directory→list_files`),且全仓无任何东西校验其值域。
- **⚠️ 初版结论已被推翻(2026-09-26 施工取证,诚实更正)**:本节原写「它们是仓库自身内部的谎言」,**这是错的**。取证发现这 4 个名字在 `apps/web/src/lib/workspace-tool-executor.ts` 有**完整实现**(`toolApplyPatch` / `toolDeleteFile` / `toolMoveFile`,以及 `create_file` case)。真相是:
  > fs 类工具有**两个相交但不对等的可达面**:(a) **本地注册面**(`_TOOL_HANDLERS`,任何部署形态可执行);(b) **浏览器委托面**(前端实现,**仅当请求携带 `workspace_context`** 时才委托过去,`llm.py:3033`)。这 4 个只在 (b)。
  - 于是在**桌面端/本地工作区**(无 `workspace_context`)下调它们,不会走委托分支,会一路到 `_mcp.call_tool` 拿到模糊的「未知工具」——**模型既不知道为什么失败,也不知道该换成哪个工具,只会原地重试到 `max_iterations` 打满**。
  - 所以真缺口不是「删掉谎言」,而是:**两个可达面的关系无处声明、错模式调用没有明确语义、别名表无人守`。
- **差距**:同名的工具在一种部署形态下有效、在另一种下失效,且失效时给的是不可自愈的模糊错误。
- **方案(已于同日落地)**:
  1. 引入 `_DELEGATE_ONLY_TOOLS`(4 项)+ `_DELEGATE_ONLY_HINTS`(每项给出本地等价建议:`apply_patch→file_edit`/`write_file`、`create_file→write_file`、`delete_file|move_file→git_operations 或 run_command`)。
  2. tool loop 加**可用性拦截**:非委托模式下调用委托专有工具 → 返回 `errorCode: TOOL_MODE_UNAVAILABLE` + 一句「请勿重试,改用 XXX」,把这个工具 CALL 变成可自愈的失败。
  3. `_TOOL_ALIASES` 从 2 条扩到 **26 条**(命令/目录/读取/内容搜索/语义检索/网页抓取六类)。**不收写操作别名**——`create_file→write_file` 会把「新建」静默变成「覆盖」,宁可让它走到 hints 的明确报错。
  4. 新增守门 `scripts/check-tool-registry-integrity.mjs`(已接 pre-commit):J1 双落点皆无即真幽灵 / J2 别名值域 ⊆ 本地注册表 / J3 别名键不得抢占真工具名 / J4 别名不得碰委托专有 / J5 委托专有三条定义 / J6 前端实现不可成死代码 / J7 提示表双向同步。**取材由脚本位置推导**,Python 侧剥行注释后取字面量——`_FS_DEPENDENT_TOOLS` 上方那句注释里写着已移出的 `list_files`,不剥就会把已移出的名字读回成员。
- **验收**:`--self-test` ✅ 10/10(含「注释里的名字不得被误吸」的变异验证);真仓库 `--quiet` rc=0(fs 11 / 委托专有 4 / 别名 26 / 本地注册 86 / 前端实现 12);AGENTS.md 与 README.md 已点名(满足 `check-gate-wiring` 的 R4 反向差集)。

---

**#50 · 🔴 P0 · 桩工具转正:`generate_test` / `analyze_code`**

- **现况(E1)**:
  - `_tool_generate_test`(`mcp_server.py:2294`):拼 f-string 模板,`def test_placeholder(): pass`,返回「需结合 LLM 完善用例」。**纯桩**。
  - `_tool_analyze_code`(`:2271`):只数行数/字符数/空行/以 `#` `//` `--` 开头的「注释行」。无 AST、无 lint。
- **差距**:这两个名字对外是「会写测试」「会分析代码」,实际行为是模板和一个 `wc -l`。模型调用后拿到 `ok: True` 会把占位内容当用户能用的产物,**这是 silently wrong 而非 fail loud**。Codex/Trae/Qoder 均把测试生成走真实模型产出 + 真实执行验证(E3/E4)。
- **方案**:
  1. `generate_test`:改为「LLM 生成 + **跑一遍** + 失败按 `self_healing` 回放」三段;最小可用版先接 `self_healing_llm.py`(805 行,已存在)。
  2. `analyze_code`:接 AST(`ast` / tree-sitter)+ lint(ruff/eslint 子进程)+ 圈复杂度/依赖热点;或直接**重命名**为 `analyze_code_stats` 并在 description 里写清只做统计(避免模型误用)。
  3. 兜底:任何工具若返回的不是真实产物,必须 `ok: False` 或带 `stub: true` 字段,前端任务 sub-notice 明示。
- **验收**:给一段含 bug 的源码,工具产出可执行且至少 1 条失败断言;`analyze_code` 能报出未使用 import 或高复杂度函数。
- **依赖**:#56(自愈开关)先开。

---

**#51 · 🔴 P0 · `run_in_background` 真实任务类型 + DAG 真实执行器**

- **现况(E1)**:
  - `run_in_background`(`mcp_server.py:6646`):`_BG_TASK_IMPLS` 白名单**只有 `sleep` 和 `echo`** 两个演示实现。`background_task_manager`(337 行,优先级队列/超时/通知/Redis)是真的,但**没有任何真实任务类型**。
  - `/dag/execute`(`api/dag.py:111`):`_default_node_executor` 是**回显** `{"executed": True, "contextKeys": [...]}`;文档原文自认「真实业务应通过 WorkerPool + executor_factory 注册(未注册)」。`dag_scheduler.py:536` `_default_executor` 同样是回显 `{executed, taskId, echo: payload}`。
  - DAG **调度算法**(拓扑/重试/超时 `dag_scheduler.py` 1056 行)和 **WorkerPool**(优先级队列/并发/依赖重排队/Redis 持久化)都是真的。
- **差距**:有「乐队的指挥和乐谱,但没有乐手」。这是 #84(26h 超长执行)与「多任务并行编排」不成立的根因。Qoder 的 26h 执行正建立在这类底座上(E3)。
- **方案**:注册 6 类真实 executor:① 长跑 shell 命令(带 Heartbeat + 可轮询输出);② 测试套(批量 pytest/vitest + 结果聚合);③ 代码索引/重建;④ 批量 LLM(文档批处理、翻译、摘要);⑤ 网页爬取/抓取批处理;⑥ 定时 patrol 任务(接 #40)。每类实现 `executor_factory` 契约 + 幂等键 + 断点续跑。
- **验收**:后台提交一个 10 分钟任务,服务重启后任务能继续或明确恢复;`/dag/execute` 不再返回回显。

---

**#52 · 🟡 P1 · RAG 真重排**

- **现况(E1)**:`services/rag.py:312` `_rerank()` 只做「按已有点 `score` 排序 + 阈值过滤 + 前 200 字符去重」。**无 cross-encoder、无 LLM rerank、无 ColBERT、无 RRF 融合**。索引侧是好的(`codebase_indexer.py` Merkle 增量 + pgvector HNSW + 懒索引护栏)。
- **差距**:召回质量上限被 retrieval score 焊死;多路召回无法融合。Trae/Qoder 的知识层都把这个当核心(E3/E4)。
- **方案**:① 加 RRF(Reciprocal Rank Fusion)做多源融合(向量 + 关键词 + 图谱);② 可选 cross-encoder(`bge-reranker` 类)或 LLM rerank 二段,失败降级到现排序;③ `_keyword_fallback` 已存在,纳入 RRF 而非只作兜底。
- **验收**:构造 20 条「需要区分近义文档」的查询集,Top-3 命中率对比现基线提升可测。

---

**#53 · 🟡 P1 · 计划模式硬约束下放到主聊天流**

- **现况(E1)**:主聊天流 `llm.py:1178` `_inject_plan_mode_prompt` **只做提示词注入**(`_PLAN_MODE_PROMPT`「只制定计划不调用工具」),无工具硬限制;**AgentLoopV2**(`:1583`)与 `agent_plan.py` 才做 `tools ∩ READONLY_TOOLS` 硬收窄。ChatMode 5 态(`ask` 禁工具/`review` 只读/`plan`)同样全是软注入。前端 `ModeSwitcher` 甚至**漏了 `ask` 态**(`stores/mode.ts` 声明 5 态,`mode-switcher.tsx:38` 只列 4 态)。
- **差距**:用户选了「只读/计划」但模型照样能改文件——这是**权限承诺与实际不符**,属于信任型缺陷,不是体验问题。
- **方案**:① 主聊天流式路径也按 mode ∩ READONLY_TOOLS 收窄(复用 `agent_loop_v2` 的实现);② mode 与 `permission_mode` 的**笛卡尔矩阵**写成单一真源表(`packages/types` 已有 permission-mode 真源,扩它);③ 前端 ModeSwitcher 补 `ask` 态 + 矩阵守门。
- **验收**:plan 模式下调 `write_file` 被工具层拒绝(非仅提示词),前端有明确「本模式禁写」反馈。

---

**#54 · 🟡 P1 · 工具连续失败反思 / 卡死(dom-loop)检测上提到主链路**

- **现况(E1)**:
  - 主链路**无** failure-streak 反思,只有 `llm.py:2943` 的**重复调用去重**(同参数同工具已执行 → 跳过并告知「见之前 tool-result」)。
  - CLI 侧**有** `doom-loop-detector.ts`、`goal-verification.ts`,但它们是 CLI 内的,主链路(web → api → ai-service)没有。
  - `_maybe_self_heal`(`agent_loop_v2.py:2196` + `services/self_healing.py` 551 行)**只认 pytest 失败信号**,且 `AGENT_SELF_HEALING_ENABLED` 默认 off。
- **差距**:竞品普遍能检出「同一失败重试 N 次」并主动换策略(E3/E4)。本项目主链路只依赖「重复调用去重」这一层,不够。
- **方案**:① 主链路加 failure-streak(同 tool+同类错误 ≥3)→ 派生反思 prompt(换参数/换工具/降级目标);② 加 stuck 检测(N 轮无新文件内容变化且无进展);③ CLI 的 `doom-loop-detector` 逻辑提取到共享层供两边使用(CLI 已经是 TS,`packages/shared` 或新增一个 `loop-health` 包,Python 侧做等价实现 + parity 守门)。
- **验收**:构造「必然失败的命令 + 必然缺失的文件」两条实验,主链路在 ≤5 轮内主动换策略或向用户报「建议 X」而不是继续重试。

---

### B 组 · 默认开关与线上实跑(55–57)——「能力存在但没人跑到」

---

**#55 · 🔴 P0 · AgentLoopV2 上下文压缩:补最后一块工程件 + 执行放量**

- **⚠️ 初版方案已被取证推翻(2026-09-26,诚实更正)**:原方案「把 `AGENT_COMPACTION_ENABLED` 默认翻成 true」**不可行且不该做**。取证发现压缩自 2026-09-12 起带有一套完整的**灰度放量体系**(`compaction_canary.py`:`AGENT_COMPACTION_MODE`=off/ratio/full + `AGENT_COMPACTION_CANARY_PERCENT` 按 session_id 稳定哈希 + 指标上报 `compaction_metrics` 含 H7「真实任务成功率下降 ≤2%」的 run outcome 观测),且「默认 off」是被**测试钉住的契约**(`test_compaction_disabled_by_default_zero_diff` 等)—— 翻默认值 = 绕过灰度设计 + 打红测试。**真缺的不是开关,是两件别的事**:
  1. **工程件**:`compaction_context_limit` 只能配全局静态值(默认 0=永不压缩),对 1M 窗口模型过小、对 32K 模型过大 —— 这是「放量基建齐备但线上从未生效」的最后一缺。
  2. **运维动作**:放量从未执行(生产未配 `AGENT_COMPACTION_MODE`)。
- **方案(工程件已于同日落地)**:
  1. 新增 `apps/ai-service/app/core/model_context_window.py`:`resolve_with_env_priority(model)` —— env 显式配置(`AGENT_COMPACTION_CONTEXT_LIMIT`>0)优先,否则按模型动态解析(兜底 128K,与 TS 侧 `model-context-capacity.ts` 的 `DEFAULT_CONTEXT_CAPACITY` 同值同因;22 条 <128K 例外逐字取自 TS 表,精确匹配不做模糊 —— 变体模型兜底,失败方向是上游显式报错而非静默丢上下文)。
  2. `routers/agents.py` 两个构造点(execute/stream + execute/resume)接线 `compaction_context_limit=resolve_with_env_priority(req.model)`。
  3. 单测 `tests/test_model_context_window.py`(含与 TS 表的静态快照防漂移断言)。
- **放量待办(运维,非代码)**:生产 env 配 `AGENT_COMPACTION_MODE=full`(或先 ratio 灰度)+ 观测 `compaction_metrics`;`AGENT_COMPACTION_LLM_ENABLED` 保持 off 合理(确定性压缩零额外成本,语义压缩留灰度)。彻底关压缩的语义正确入口是 `MODE=off`,不再是"不配 limit"。
- **验收**:单测 rc=0;长会话(≥40 轮)在 AgentLoopV2 上触发压缩、`compaction` 帧抵达前端 `CompactionStatusBar`(**依赖放量落地后实测**,本枚只交工程件)。

---

**#56 · 🔴 P0 · 工具自愈默认启用 + 信号源扩展**

- **现况(E1)**:`AGENT_SELF_HEALING_ENABLED` 默认 off;`_maybe_self_heal` + `self_healing.py`(551)+ `self_healing_llm.py`(805)**只认 pytest 失败信号**,但已有"落盘前文件快照 + 修复失败按 version_id 回滚",是真实现。
- **差距**:#45「自愈工作区」已推进到工作区层面,但**工具层自愈默认关**,所以用户侧此刻的体验毫无变化——写了不等于给了。
- **方案**:① 默认开(同 #55 的「默认翻转 + 保留显式 off」口径);② 信号源从 pytest-only 扩到:测试失败 / 类型检查失败(tsc、mypy)/ 构建失败 / lint 失败;③ 与 #50 `generate_test` 联动(生成→跑→失败→自愈)。
- **验收**:故意引一个类型错误,agent 在自愈链路内修好或明确回滚并说明;新 tsc 错误 ⊂ old tsc 错误(不允许自愈引入新错)。

---

**#57 · 🟡 P1 · 「默认关闭能力」线上台账 + 开机自检 + 守门**

- **现况(E1)**:除上述外还有 `AGENT_BUDGET_ENABLED=off`、`AGENT_TEAM_RELAY_ENABLED=off`、`_mcp_elicitation_pause_enabled_from_env`(门控)、`_engine_file_watcher_enabled_from_env`(门控)。这些 env 散落各处,无集中台账;没人能一句话说清「生产上到底哪些能力是关的」。
- **方案**:① 在 ai-service 启动时枚举全部 feature env,输出一份 **capability matrix**(启用/未启用/原因/对应文档),落日志 + `/api/admin/capabilities` 端点;② `scripts/check-capability-matrix.mjs`(或既有同类守门扩展)把「新增默认关的 env」当阻断点;③ web 管理端加一个「能力开关」页面(复用 4-4 已建的管理端模式)。
- **验收**:一条命令能列出生产全部能力开关状态;新增默认关 env 被守门拦下并提示登记。

---

### C 组 · 主链路断裂(58–64)——「前端承诺与后端能力之间的缝」

---

**#58 · 🔴 P0 · 主对话流工具审批门接线**

- **现况(E1)**:`ToolApprovalDialog`(`ai/tool-approval-dialog.tsx:48`)存在且功能完整(approve/deny + once/session/always 三档 + 原因输入 + dangerLevel 徽章 + argsPreview),但它的**事件源只有** `EventSource('/api/agents/tasks/stream')`(agent 任务流)与 window `ihui:tool-approval`。而主聊天走的是 `fetch + ReadableStream`(`client.ts:1952` `streamChat()`),其 `StreamChatOptions` 里**没有 `onToolApproval`**(`send-message.ts` 也无对应回调 —— 实测 grep `onToolApproval` 零命中)。
- **差距**:**用户每天在用的 `/chat` 主对话流,工具调用不受 approve/deny 门控**,只有「工作区权限模式档位」(`plan/default/accept-edits/bypass-permissions`)在管。而审批后端能力是完整存在的(`agents.py:844` `POST /api/agents/approval-response`,scope once/session/always,O19 后带 principal 鉴权)。**这是"能力有、UI 有、两者没连"的最典型一处。**
- **方案**:① `streamChat()` 增 `onToolApproval` 回调,接 `question`/工具审批帧;② `send-message.ts` 接线,复用同一 `ToolApprovalDialog`;③ 后端 `ai-chat-stream.ts` 已有 `POST /agent/approval-response`,对齐通道;④ 守门:禁止出现「存在 ToolApprovalDialog 但主链路无回调」的组合(可用确定性断言:审批 UI 组件的事件源必须覆盖 `streamChat` 链路)。
- **验收**:在 `/chat` 里让 agent 执行一条 prompt 外的写文件,弹出同一审批弹窗,deny 后工具未执行且消息流有明确回执。

---

**#59 · 🟡 P1 · 消息级版本切换(← 1/3 →)**

- **现况(E1)**:有 `regenerateMessage`(`:1195`,后端事务**删除**该消息及之后 → 覆盖式重跑)与 `branchMessage`(`:1351`,**新建会话**)。**同一条消息的多个候选版本无法并列/切换/对比**。`BestOfCompare` 只服务 `/bestof`。
- **差距**:ChatGPT/Claude 式的 `← 1/3 →` 是session内最基础的纠错交互。Qoder 的 Fork 是任务级(E3),这个就是消息级。
- **方案**:① `chat_messages` 增加 sibling 语义(parent_message_id + sibling_index,或 `message_variants` 表);② UI 加版本切换器(复用已有 `CanvasVersionMenu` 的交互形态,它是产物版本而非消息版本——可抽公共 < VersionSwitcher >);③ regenerate 不再物理删除而是新增 sibling。
- **验收**:连续 regenerate 3 次后可用 ←/→ 在 3 个版本间切换;旧版本内容完整保留。

---

**#60 · 🟡 P1 · 真并行多窗格**

- **现况(E1)**:`ai-side-panel.tsx:1102-1108` 注释自陈:`useChatStore.conversationId` 是**全局单例**,只有根窗格渲染真实消息流,其余窗格仅渲染「承载标记」(paneId + conversationId 文本);上限 4 个;无服务端 fork 路由(服务端 fork 在 CLI 侧有 `branch-ops.ts`)。
- **差距**:Qoder 的 Quest 是与 Editor **双窗并行**、多 workspace 多任务同时跑(E3);本项目多窗格是视觉上的。
- **方案**:① store 从 `conversationId` 单例改为 `Map<paneId, ConversationState>`(这是大改,需`分阶段:先隔离 store,再改 UI,再改持久化);`;② 每个窗格独立 SSE 连接 + 独立 abortController;③ 服务端会话 fork 路由下放到 web 可用(复用 `branchConversation`)。
- **验收**:两个窗格各自独立发消息、各自流式渲染、互不串台;刷新后布局与状态恢复。

---

**#61 · 🟡 P1 · `@` 多维提及接线(死复活)**

- **现况(E1)**:`stores/context-mention.ts` 的 `addMention` **全仓零调用**;`hooks/use-context-mention.ts` 的 `useSearchMentions`(file/database/symbol/folder/web 统一检索)**零消费者**;导致 `chat/mention-popover.tsx:30` 的 `MentionChips` **恒返回 null**。实际生效的只有 `FileMentionPopover`(插入反引号包裹的路径文本)。而 `#` 语义源选择器(#18 已交付,9 类)是另一套钩子。
- **差距**:**写了完整的多维提及引擎,UI 上死的**。相对于 Trae `@文件/文件夹/代码块` + `#Codebase/#Docs/#Terminal`(E3/E4)的组合,本项目的 `@` 只做了一半。
- **方案**:① 把 `@` 与 `#` 统一到一个 `useMentionEngine`(内部仍然走两个钩子,但对外单一 contract);② 文件选择器切到 `useSearchMentions`(含符号/数据库/folder/web);③ 删掉确实不需要的那套,不要留两套半死的。
- **验收**:输入 `@` 能列出 file/folder/symbol 三类并插入真 chip;`MentionChips` 不再是恒 null。

---

**#62 · ⚪ P2 · 会话搜索栏挂载 + 侧栏批量选择**

- **现况(E1)**:`ai/chat-search-bar.tsx`(`ChatSearchBar`)与 `hooks/use-chat-search.ts`(`useChatSearch`)**均零消费者**;侧栏会话列表**没有搜索框**(搜索只在独立历史页 `/chat/history`);批量归档/取消归档只在 `ConversationList`(独立页)有,侧栏无。
- **方案**:挂载 `ChatSearchBar` 到侧栏;批量选择态移植到 `SidebarChatHistory`;或直接删除孤儿件并在 AGENTS.md 登记「为何删」——**孤儿件比缺功能更贵**:它让每次摸排都误判「有」。
- **验收**:侧栏可搜索会话;或孤儿件已删且有登记。

---

**#63 · 🟡 P1 · `form_request` SSE 帧与业务表单卡 UI**

- **现况(E1)**:`client.ts:3160` 已解析 `form_request` 帧,但 `send-message.ts` **无 `onFormRequest` 回调**;`ai/business-form-card.tsx` 只派发事件、**不在对话流被消费**。
- **差距**:人机协同从「问一个问题」进化到「收一张结构化表单」是提高准确度的关键一跃。现有 `QuestionDialog`(选项+自定义+跳过)是半成品形态。
- **方案**:① `onFormRequest` 接线到对话流;② `BusinessFormCard` 支持 field 类型(text/select/multi/date/file)+ 校验 + 提交回执;③ AgentEngine 侧 `request_user_input`(#47 归一时会到主链路)复用同一表单协议。
- **验收**:后端推送 form_request → 对话流内渲染可填表单 → 提交结果回灌下一轮 messages。

---

**#64 · ⚪ P2 · AI 消息可编辑 + 消息级固定/书签**

- **现况(E1)**:`Pencil` 编辑按钮只在 `isUser` 时渲染(`MessageItem.tsx:1408`)—— AI 消息不可就地编辑(只能 regenerate,会覆盖);无消息级 pin/书签(只有会话级收藏 `/chat/favorites`)。
- **方案**:AI 消息编辑后标 `edited: true` 并保留原文(sibling,与 #59 共用存储);加消息 pin + 「消息书签」导航条(右侧 rail 已有 `query-thumb-rail.tsx`,可复用)。
- **验收**:编辑 AI 回复后不触发重跑且标记可回溯;pin 的消息在会话内可跳转。

---

### D 组 · 渲染与健壮性深度(65–71)

---

**#65 · 🟡 P1 · 暂停 / 继续生成(不止 Stop)**

- **现况(E1)**:`hooks/use-chat.ts:93` `stop()` 直接 abort + `POST /api/ai/chat/abort`,**无 pause/resume 语义**;AgentLoopV2 侧**有** `_pause_requested`(`:3329`,落 checkpoint 后优雅退出)+ `execute/resume` 端点。也就是说**后端支持、前端没暴露**。
- **方案**:UI Stop 拆成 Pause(服务端停在当前轮 + checkpoint)/ Stop(终止);恢复走既有 resume 通道。注意与 CLI 的 pending-approval / plan-approval 语义统一。
- **验收**:Pause 后 30 分钟内可 Resume 且上下文完整。

**#66 · 🟡 P1 · side-by-side diff 切换 + 冲突解决 UI**

- **现况(E1)**:`inline-diff-card.tsx` 是 **unified 行级 + hunk 勾选**(部分接受/导出 `git apply`/patch 文件),**未见 side-by-side 切换、三方合并、冲突解决 UI**。Qoder Review 面板是 side-by-side(E3)。
- **方案**:diff 卡加 unified/split 双视图开关;有 conflict marker 时进入三方合并视图(左=base 右=incoming 中=可编辑结果)。

**#67 · 🟡 P1 · 终端输出 ANSI 彩色 + xterm 内联**

- **现况(E1)**:`TerminalSection` 用 `StreamCode`(纯文本等宽块),**无 ANSI 着色、无 xterm**;真正的 xterm 只在独立 `AiTerminalDock`,不是消息流内的命令结果。终端输出染 ANSI 转义序列时当前会把 `\x1b[31m` 之类的字符直接显示给用户。
- **方案**:消息流内 TerminalSection 换 `ansi-to-html`(或受控 xterm 只读实例);截断/展开策略保留。

**#68 · ⚪ P2 · 流式中切换模型**

- **现况(E1)**:`ModelSelector` 在 `isStreaming` 时 `disabled`(`message-input.tsx:1292`)。禁用本身合理,但竞品常见做法是「下一轮自动带入新模型」而非让用户记着手动改。
- **方案**:流中不可切但在终止后自动带入新模型;或提供「切换到 X 继续」。

**#69 · 🟡 P1 · 会话窗口额度实时进度条(消费既有 `budget` 帧)**

- **现况(E1)**:有 `ContextUsageRing`(历史上下文占比)与 `SessionUsageBadge`(会话累计 token/费用),**没有**「本次请求/本会话窗口已用 X / 上限 Y」的实时进度条;`live-usage.ts` 只做估算供徽章用。
- **2026-09-26 更正**:`budget` 帧**不是幽灵**(初版误判,见 #48)——网关 `ai-chat-stream.ts` 的 `checkTokenBudget` 三态早已在发(warning/critical 流首帧、block 429),`client.ts:2858-2877` 也已解析。**所以本项工作量骤降:只剩前端把已解析的 budget 帧接到 UI 进度条**,不需要动后端。
- **方案**:前端消费 `onBudget`(client.ts 已有解析回调位)→ 输入框上方一条会话窗口进度条(warning 琥珀/critical 红),与 #43 的 cost-estimate 联动。
- **验收**:构造一个低额度用户,流首出现进度条且档位变色;429 时错误卡显示「额度已用尽」而非裸错误。

**#70 · 🟡 P1 · PDF/CSV/表格富预览**(V2 #32 未交付,本轮重列)

- **现况(E1)**:全仓无 `pdfPreview`/`PdfPreview` 组件。上传 accept 里含 `.pdf`、`.csv`、`.xlsx` 等,但输出/附件无内嵌预览。
- **方案**:消息附件与工具产物按 MIME 派发预览器:PDF(iframe/pdf.js 轻量)、CSV/Excel(表格化前 N 行 + 下载)、Markdown/JSON(语法高亮折叠)。注意 CSP(`connect-src`/`frame-src`)要同步放行,参照 e2e CSP 事故教训。

**#71 · 🟡 P1 · chat 多端/多标签实时同步**(V2 #23 未交付,本轮重列)

- **现况(E1)**:chat 不走 WS(`create-websocket-hook` 仅 question 广播),多端打开不同步;`hooks/use-websocket.ts` 与 `ws-chat.ts` 存在但 chat 主链路未接。
- **差距**:这是 V2 里唯一两处真没交付之一,也是有难度的一处(需要 conversation 房间 + 增量拉取)。
- **方案**:api 侧加 conversation 房间(SSE 已有 `sse-registry.ts` 插件可复用),消息落库后广播 `message:created/patched`,他端增量拉取并 patch store;先做同用户多标签,再扩移动端。注意:SSE 与 WS 双通道并存会产生重复渲染,必须先定「同一消息 patch 幂等」契约。

---

### E 组 · 端间落差与产品形态(72–78)

---

**#72 · 🔴 P0 · `apps/desktop` 从薄壳到本地能力端点**

- **现况(E1)**:Tauri 2 薄壳,`tauri.conf.json` 的 `app.windows[0].url = https://aizhs.top/agents`;36 个 command 全是窗口/托盘/剪贴板/键鼠/截图/文件读写;**无 `apps/desktop/src/` 前端、无本地索引、无本地 agent 面板**;README 明示「要修改对话 UI 请在 apps/web 进行」。
- **差距**:Trae/Qoder 的桌面端是**本地 workspace runtime**(能开本地目录、做本地索引、跑本地命令)(E3);本项目桌面端是一个定向浏览器。断网或线上站点抖动时全部能力归零(虽有 `offline/index.html` 兜底页)。
- **方案**(分阶,不做全面 Electron 化):
  1. **本地 workspace 通道**:暴露目录选择 + 递归只读遍历 + `.gitignore` 感知的增量索引(CLI 侧已有 `codegraph/` AST 索引 + Merkle 增量,`packages/context-compaction` 亦可复用 → 抽共享)。
  2. **本地 diff/git 面板**:桌面端的 git operations 走本地而非远端。
  3. **离线降级**:Web 侧产物 + 本地索引让「查看项目/检索/最近的会话」在无网时仍可用。
  4. 保留薄壳策略(前端单一事实源在 web),**只加本地能力层**,不复制 UI。
- **验收**:断网状态下桌面端可打开本地目录、检索最近会话、查看本地文件 diff。

**#73 · 🟡 P1 · `apps/miniapp-taro` AI 对话页**

- **现况(E1)**:pages 下只有 `ask`(问答社区:list/detail/create),**无 chat/agent/ai 对话页**,`src/api/{index,social}.ts` 无 AI 对话 API。mobile-rn 有完整 AI(走 `@ihui/rn-app`)。
- **方案**:移植 `packages/app/src/features/agent-chat` 到 Taro(注意 Taro 4 对 RN/WebView 的约束);最小闭集 = 会话列表 + 消息流 + SSE(小程序用分块 `wx.request` 而非 stream)+ 停止 + 重新生成。

**#74 · 🟡 P1 · CLI 全屏 TUI(ink)落地**

- **现况(E1)**:UI 是 `chalk + ora + inquirer + node:readline` 手搓(自研 markdown 流式渲染器 + diff 着色 + 工具卡 + spinner + 状态行,已相当完整),但 **`src/tui/mode-indicator.tsx` 是孤儿**:ink React 组件,`package.json` 无 ink/react 依赖,且 `tsconfig.json` 的 `include: ["src/**/*.ts"]` **不含 `.tsx`** ⇒ 永不编译。`ihui config`、`ihui remote` 两条 README 声称的命令顶层未注册(文档漂移)。
- **方案**(三选一,建议 **A**):
  - **A(推荐)·真上 ink**:引入 `ink` + `react` 依赖,`tsconfig.json` 的 `include` 补 `"src/**/*.tsx"`,实现全屏双栏布局(左=会话流、右=计划/工具/ diff),把 `mode-indicator.tsx` 从孤儿变成真实可用件;同时补注册 README 声称的 `ihui config` / `ihui remote`,或修正 README 漂移。
  - **B·彻底删孤儿**:删 `mode-indicator.tsx` 并在 AGENTS.md 登记「CLI 明确不做 React TUI」,杜绝每次摸排误判。
  - **C·维持现状**:保留 readline 手搓(它当前功能已相当完整),但把 README 里 `config`/`remote` 两条未注册命令归档为已知文档漂移。
  - **注**:#62 已定「孤儿件必须要么接要么删」的规矩,本项无论选 A 还是 B 都必须在当次收口,不得继续悬着。

**#75 · 🟡 P1 · `file_search` 换 ripgrep / 并行遍历 + 10 万文件级能力**

- **现况(E1)**:`mcp_server.py:2318` `_tool_file_search` 是**纯 Python 目录遍历**(glob + 内容搜索 + fzf 模糊子序列),无 ripgrep/并行;`codebase_indexer.py` 有 Merkle 增量 + pgvector HNSW + 懒索引护栏(`_LAZY_INDEX_MAX_FILES=2000`,冷却 600s)。Qoder 标称 10 万文件级(E3)。
- **方案**:① 二进制内容检索优先调用本地 `rg`(不存在则降级);目录遍历并行化;② 懒索引护栏按真实 project 规模复评(2000 文件阈值对 monorepo 偏小);③ 给一个大仓基准脚本进 `benchmarks/`(该目录已有 123 个 `.mjs`)。

**#76 · 🟡 P1 · 知识引擎:Knowledge Card 自动蒸馏 + Repo Wiki 持续同步**

- **现况(E1)**:有 `knowledge_graph.py`(722,LLM 抽取 + `InMemoryGraphStore` **默认** + `DrizzleGraphStore`)、`knowledge_lookup.py`(670,三源并发)、`services/knowledge_card_extractor.py`、`memory_sedimenter.py`(跨会话记忆自动沉淀)、`metacognition.py`(722,记忆过期/冲突/合并)。**知识卡/Card 自动蒸馏链路偏薄**,且 `InMemoryGraphStore` **重启即失**。
- **差距**:Qoder 的 Knowledge Engine 是「代码 + 对话 → 自动蒸馏 Knowledge Cards」,Repo Wiki 已产出 40 万+(E3)。本项目组件齐,但**默认图存储重启即失**、**自动蒸馏没有闭环**。
- **方案**:① 图存储默认落 Drizzle(DB 已备 + `asyncpg` 真适配,`_create_graph_store()` 的选择逻辑需复评——现在是 `InMemoryGraphStore` 兜底还在前面);② 会话结束时异步蒸馏「本次回答里用到的、非显然的项目事实」→ cards;③ 给 card 加来源/时效/置信三维 + 过期淘汰(复用 `metacognition.py` 的 forget/keep/merge/demote 判据);④ Repo Wiki 对位加强:随代码变更(Merkle 树)自动标记过期段落并触发重写。

**#77 · 🟡 P1 · Goal-driven 自评估闭环 + My Quests 跨 workspace 全局看板**

- **现况(E1)**:`/goal` 存在(CLI 与 web slash 命令),`mode-manager.ts`、`plan-machine` 有;**但是否具「每轮自评估达成与否、未达成自动续跑、运行中编辑 goal / 暂停 / 恢复」需确认**;`run_in_background` 只有 sleep/echo(#51),所以「26h 超长执行」这类耐久目标不成立。
- **方案**:① GoalCRT:每轮结束用轻量 LLM 判「目标达成 / 未达成且在前进展 / 卡住」三态,决定是否续跑(上限可调)——已有 `goal-verification.ts` 在 CLI,提取共享;② UI:Goal 进度卡支持编辑/暂停/恢复/删除;③ 全局看板:跨 workspace/会话的任务三列 + 搜索 + tab 过滤(带计数)+ Pin/Fork。
- **依赖**:#51(后台任务底座)。

**#78 · ⚪ P2 · Experts 多智能体并行子模式**

- **现况(E1)**:已有 `agent_teams.py`(441,`TeamOrchestrator`)、`a2a.py`(5 端点)、`agent_comm.py`(299,共享黑板)、`dispatch_subagent`(嵌套深度 ≤2、并发 ≤5,`mcp_server.py:359/362`)、`agent-control` 跨端能力目录(extension/desktop/web 三端动作)。UI 已有 `swarm`/`orchestration`/`unified` 三个 tab。**但对标 Qoder Experts「可自定义专家角色/流程/能力边界 + 并行协作」的形态强度待确认**。
- **方案**:对标补「专家模板(role + 工具子集 + 验收标准)」产品化 + 并行运行的冲突治理(同文件写冲突 → 串行化或 worktree 隔离,CLI 侧 `worktree.ts` 已有,web 侧缺)。

---

### F 组 · 五年领先梯队(79–86)【P3】

> 与 V2/P3 的 38–46 同级。每一项均等 15–36 全绿后再逐项立项;本轮只给方向与设计要点,不给排期。

**#79 · 权限双轴化(sandbox_mode × approval_policy)+ config profiles**
对齐 Codex 2026 的双轴模型(E3):把现有「permission_mode 5 档」拆成「沙箱读写边界」与「审批策略」两个独立轴,并允许 `--profile <name>` 整套切换。现有 `packages/types/src/permission-mode.ts` 已是跨语言真源,是天然起点。

**#80 · Guardian 复核代理**
Codex 2026-04 的 guardian subagent(E3):在用户点 approve 之前,先由一个小模型/独立 agent 对挂起动作做「是否有更安全等价路径」复核并给一句理由。本项目已有 `guarded_tool_pipeline.py`(682)+ `tool_budget_governor.py`(313)+ `dispatch_subagent`,底座齐备;差别在于「复核者」而非「执行者」的用法。

**#81 · MTC 工作面(非编码任务的专用面)**
对标 Trae SOLO MTC(E3)。现有 mode 是 build/plan/review/spec 的编码视角;MTC 要求「文档/数据表/报表/演示/竞品调研」的产物流水线(本项目已有 `parse_document`、`generate_chart`、Doc+/PPT/Sheet 类能力与 `work-panel`,缺的是一个把它们串起来、且**产物可交付**的工作面)。

**#82 · Predictive Edit(独立补全/编辑预测模型)**
对标 Trae CUE(E3)。需要一个轻量级 edit-intent 预测器:基于光标上下文 + 近期编辑历史预测「下一处改动」,Tab 应用。本项目.ai-service 已有 FIM 链路记载(V2 §四提「FIM 闭环」),补点是**多光标级的 move of a set**（multi-line edit）与 predictive intent,而非单点补全。

**#83 · Repo Wiki 自同步 + Spec ↔ Code 双向落差检测**
对标 Qoder Spec-driven + Repo Wiki(E3)。**已有底座**:LSP(`api/v1/lsp.py`,`subprocess` 直起语言服务器 + 手写 Content-Length 帧协议,真实现)、codegraph(AST 索引)、`repo_wiki` schema。**唯一短板**:LSP 只支持 TypeScript(硬编码 `LSP_BIN = "typescript-language-server"`),需扩 Python/Go/Rust;以及缺 Spec 与实现之间的**自动落差检测**(Spec 写了但代码没跟上 → 报警)。

**#84 · 26h 级耐久任务底座**
对标 Qoder 26h(E3)。依赖 #51(真实后台 executor)+ checkpoint/resume(已有,DB+Redis 双存储 + `decide_checkpoint_stale_reconcile`)+ `#77` GoalCRT。差的就是 executor 与资金的持久可用性。

**#85 · 离线/边缘优先降级**
四竞品全部依赖云端模型(E3/E4),这是共同的债务。做法:桌面端(#72 的本地层)内置向量索引 + 一个本地小模型(如 Ollama/LM Studio,本项目 Provider 适配器里已有 `ollama`/`lmstudio`/`llama_cpp` 三路),网络不可用或额度耗尽时自动降级为「本地检索 + 本地小模型回答 + 明确的降级标识」,恢复后再同步。这是边际成本不高、但竞品当下做不齐的一格。依赖 #72。

**#86 · 证据级的可追溯执行流水(对话即审计)**
已在 #39 阶段 3 有提案(前端把 toolCalls 序列化为 Markdown/JSON 下载)。深化版:每一次工具调用带 invocation id、输入哈希、输出哈希、权限决策与操作者身份(人类/agent 区分),可导出为签名 ledger,供合规审阅。**这是最能和竞品拉开身位的一层**——所有企业级/合规审计场景都需要它,而四家竞品无一把它做成一等公民(E3/E4)。

---

## 六、排期(Sprint)

排序原则:**先修「会误导的」,再修「不好用的」,最后做「拉开身位的」**。同一 Sprint 内避免同时触碰 Store 单例(#60)与发布相适应的 #84 这类长线项。

| Sprint | 编号 | 交付物形态 | 备注 |
|---|---|---|---|
| **S1 · 内核归一(重)** | 47 → 49 → 48 | 工具集归一 + 幽灵名清理 + SSE 契约对账强化 | **47 是最大单点,独占资源**;49 已落地(2026-09-26);48 已落地(同日,含 budget 翻案更正) |
| **S2 · 默认开关(轻但高杠杆)** | 55 → 56 → 57 | 压缩/自愈默认开 + 能力矩阵端点 + 开机自检 + 默认关 env 守门 | 三条都是「改默认 + 加观察」,体量小收益大 |
| **S3 · 主链路缝合** | 58 → 63 → 53 | 主链路审批门 + 表单卡 + plan 模式硬约束 | 58 是本次最高优先级前端项 |
| **S4 · 桩转正** | 50 → 51 → 76 | generate_test/analyze_code 转正 + 后台 executor 六类 + 知识卡蒸馏 | 依赖 S2 的 56 |
| **S5 · 渲染深度** | 67 → 66 → 65 → 69 → 70 | ANSI/xterm、side-by-side、pause/resume、budget 条、富预览 | 70/69 与 S1 的 budget 决策一起收 |
| **S6 · 会话模型升级** | 59 → 64 → 60 → 61 → 62 | 消息版本/编辑/pin + 真并行多窗格 + @ 多维 + 搜索栏 | 60 store 改造风险最高,放最后且独占 |
| **S7 · 端落差** | 72 → 74 → 73 → 75 | desktop 本地层 + CLI TUI 决策 + 小程序 AI + rg 检索 | 72 的本地索引需先抽 CLI `codegraph` 共享包 |
| **S8 · 形态级** | 77 → 78 → 52 → 54 → 71 | Goal 闭环 + Experts + 真重排 + 失败反思 + 多端同步 | 71 依赖 SSE/WS 双通道幂等契约先定 |
| **P3 后置** | 79–86 | 逐项单独立项(每项 3–10 天专项) | 15–78 全绿后再动 |

**并行冲突提示(踩过的坑)**:① 领地纪律(AGENTS.md §12 并行/污染)——每个 Sprint 开工前先跑 `git status` 与 `node scripts/check-task-claims.mjs`,勿撞他人 in-flight,提交走 pathspec 不卷带在途改动;② 涉及 SSE 契约的改动必须过 `check-agent-event-parity.mjs`(V3 #48 后含兼容面与常量值域两条新对账),涉及 i18n 的过 `check-i18n-keys` + `scan-dead-i18n-keys`,涉及工具注册面的过 `check-tool-registry-integrity`;③ **跨端事件取证先查网关层**(apps/api):本轮 budget 帧两次翻案的共同根因都是只查了 ai-service 没查 apps/api。

---

## 七、验收与防回潮

**通用验收基线**(沿用 V2 并加严):
1. 每项须有 **e2e 或单测**;命戒指 monthly 变异验证(刻意改坏行为,确认测试会红)。
2. 涉及 UI 的须 **5 语言 i18n parity**(`check-i18n-keys`)且 **零死 key**(`scan-dead-i18n-keys`)。
3. 涉及 SSE 的须过 `check-agent-event-parity.mjs`;**本轮新增**:双向等式集合(契约 == 生产者 ∪ 消费者)。
4. 三端 `tsc` / `eslint` / `ruff` / `mypy` 零新增错误。
5. **默认开关类(#55/#56)必须交「上线前后对比实测」**,不允许只改 env 就宣称完成。

**本轮新增的三条防回潮守门**(建议进 `scripts/` 与 pre-commit):

| 守门 | 断言 | 防止什么 |
|---|---|---|
| `check-capability-matrix` | 启动时的能力矩阵不含「默认关且无登记原因」的项;新增默认关 env 即红 | 防止再出现「移植完成但线上从不跑」(#55/#57) |
| `check-tool-registry-integrity` | `_FS_DEPENDENT_TOOLS` ∪ `_TOOL_ALIASES` 值域 ⊆ `_TOOLS`;`BUILTIN_ENGINE_TOOLS` 的每个成员必须有映射目标 | 防止幽灵工具名与内核分裂回潮(#47/#49) |
| `check-stub-declaration` | 返回非真实产物的工具必须在返回体带 `stub: true` 或在 `_STUB_TOOLS` 白名单登记 | 防止再有 `generate_test` 这类「ok:True 但内容是占位」(#50) |

**孤儿件卫生规则**(本轮摸排最痛的一点):**全仓零消费者的组件/hook,要么接要么删,不允许留**。建议在 AGENTS.md 增加一个登记段(§Bootstrap 孤儿件清单),每次摸排先查它。本轮确认的孤儿:`ChatSearchBar`、`useChatSearch`、`useContextMention`(含 `addMention`)、`MentionChips`(恒 null)、CLI `mode-indicator.tsx`、desktop `scripts/ensure-web-out.mjs`(README 明示无人引用)。

---

## 八、与前两轮的关系与遗留

- **V1(1–14)** 解决「主链路有无」:编辑重跑、应用到文件、Canvas、思考/计划流式、resume、参数面板、Repo Wiki、FIM、语音/TTS、部署 AI 诊断。遗留:小程序 AI 增强(原 12)、Skill 市场产品化(原 14)。
- **V2(15–36)** 解决「对话流元素粒度」。实测 22 项交付 **20 项**;**#23 多端同步、#32 富预览未交付**,本轮重列为 **#71 / #70**。**#25(SSE 契约)名义交付但内容有幽灵/漂移**,本轮重列为 **#48**。
- **P3(38–46)** 五年梯队,实测 9 项交付 8 项,**#45 自愈接了但默认关**,本轮并入 **#56**。
- **V3(47–86)** 解决「能力是否真实存在并真的在跑」。这是本次唯一新增的价值层。

**给后续会话的操作建议**:开工前按 AGENTS.md §1 跑 `node scripts/check-task-claims.mjs`;本轮的核验脚本思路(用文件/符号级存在性而非台账勾选态判定交付)建议固化成一个 `scripts/audit-benchmark-delivery.mjs`,每轮对标时直接复用——**台账勾选态会滞后,以代码为准**。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
