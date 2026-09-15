<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AI 对话全链路四竞品深度对标分析 V2(CodeX / Trae / Qoder / WorkBuddy)

> 2026-09-15 立。第一轮对标见 `PROJECT_PLAN.md`「2026-09-12 批次(14 项,12 完成)」。本轮按用户要求将比对粒度下沉到「AI 对话流程里显示的每一个元素」,逐项给出竞品做法 / 本项目现状(含文件证据)/ 差距 / 建议方案 / 优先级。开发任务已登记至 `PROJECT_PLAN.md` 第二轮批次(编号 15–36 续接)。
> 证据基线:2 路代码全链路摸排(前端消息渲染 10 维 + 后端传输/编排/存储 10 维,均为 2026-09-15 现场核对)+ 4 路竞品联网调研(OpenAI Codex app 官方公告 2026-03、Trae 官网与中文社区知识库、Qoder 官网与 docs.qoder.com Quest 文档、WorkBuddy 产品能力)。

---

## 一、四竞品对话界面元素基线(2026-09 实况)

### 1. OpenAI Codex(app / CLI / IDE 扩展,GPT-5.2/5.3-Codex)

| 对话流元素 | 做法 |
|---|---|
| 思考过程 | reasoning 流式分节(`agent_reasoning_delta` / `agent_reasoning_section_break`),带标题的分节化展示 |
| 工具调用 | `exec_command_begin/end`(命令+输出)、`patch_apply_begin/end`(文件补丁)、每类独立事件与卡片 |
| 轮次变更汇总 | `turn_diff` 事件 → 每轮 turn 级 diff 汇总,可直接在 diff 上评论让 agent 返工 |
| 审批 | MCP elicitation 协议先审后执行;三档权限(default/read-only/yolo)映射审批策略+沙箱档位 |
| 上下文 | `/compact` 手动压缩 + 模型级 context compaction;AGENTS.md 项目规则;Skills 库(对话内显式调用或自动匹配) |
| 会话管理 | 多 agent 独立线程按项目组织、内置 worktree 隔离并行、session JSONL 可 resume、`/personality` 个性预设 |
| 自动化 | 对话外定时自动化(排程+技能,产物进审查队列) |

### 2. Trae(Chat / Builder / SOLO)

| 对话流元素 | 做法 |
|---|---|
| 模式 | Chat(顾问)/ Builder / SOLO(Coder 迭代存量 + Builder 从零建)三轨,SOLO 可先出计划再执行 |
| 上下文引用 | `@文件` / `@文件夹` / `@代码块`;`#` 全局语义源(Codebase / Docs / Terminal) |
| 执行可视化 | 思考过程实时可视化;命令在内部终端执行、输出回显对话;预览 tab 里 agent 直接操作浏览器元素、读 console 调试 |
| 变更管理 | 回复附「修改文件列表」表格,绿色/红色 diff 视图,接受/拒绝/整体回滚(revert) |
| 其他 | CUE Tab 补全(独立预测模型)、多 agent 团队(自定义 agent 可作 sub-agent)、10 万文件级代码库检索 |

### 3. Qoder(Desktop / CLI / JetBrains)

| 对话流元素 | 做法 |
|---|---|
| Quest 模式 | 独立任务窗口三栏布局(任务管理 / 会话区 / 功能区);Agent(单 agent)与 Experts(多 agent 协作)子模式;任务状态徽章 Running / Action Required / Ready / Error |
| 执行步骤 | 会话流内嵌逐步执行步骤:代码块、命令日志、**可点击的文件引用**;轮次结束出现 Changes 审查入口(逐文件 diff + reject) |
| 上下文 | `@文件/文件夹/符号`;上下文压缩条常驻输入框底部;Knowledge Engine 从代码与对话自动蒸馏 Knowledge Cards |
| 知识层 | Repo Wiki 持续同步项目结构;Specs(Quest 先产规格文档再实施);Memory 沉淀 |
| 任务面板 | My Quests 全局看板:跨 workspace 按状态三列分栏(Running/Waiting/Completed),卡片可 Pin/Fork/重命名 |
| 其他 | 语音输入、26h 超长 agent 执行、多任务并行编排 |

### 4. WorkBuddy(桌面 Agent 工作台)

| 对话流元素 | 做法 |
|---|---|
| 模式 | Agent / Plan / Ask 三模式 |
| 执行可视化 | 任务清单 UI(TaskCreate/List,状态流转呈现);后台任务(run_in_background + 完成通知);内联可视化 widget(SVG 图表/交互组件随对话流出) |
| 上下文 | 项目布局快照、身份文件注入、三层记忆(云端画像 / 用户级 / 工作区日志);MCP 连接器生态 |
| 团队 | 多 agent 团队(TeamCreate / 消息协作 / 共享任务看板) |
| 其他 | Skills 体系(SKILL.md 触发词路由)、定时自动化、浏览器实时预览、结果文件卡片(present_files)、检查点回退 |

---

## 二、本项目对话全链路现状速写(文件证据)

**前端**:`MessageItem.tsx` / `message-item-parts.tsx` / `markdown-stream.tsx`(GFM+Mermaid+KaTeX+代码块折叠/复制/应用)/ `tool-call-card.tsx` / `inline-diff-card.tsx`(Accept/Reject 批量)/ `thinking-section.tsx` / `PlanStepsCard` / `TerminalSection` / `CitationBar` / `SubAgentActivityFeed` / `artifact-canvas.tsx`(可编辑画布+版本历史)/ `checkpoint/CheckpointRewindPanel` / `mode-switcher`(build/plan/review/spec)/ `permission-*` 审批三件套 / `context-usage-ring` / `conversation-list`(672 行:置顶/收藏/归档/导出/压缩)/ `slash-command-palette` / `file-mention-popover` / `sampling-params-panel` / `voice-input` + `use-tts` / 流式 delta 帧级批处理(`createDeltaBatcher`)+ 虚拟滚动。
**后端**:SSE 事件 chunk/reasoning/tool-call-start/tool-result/tool-delegate/tool-summary/citations/question/subagent_*/done/error/compaction(`llm.py` 3534 行,事件定义散落);agent_loop_v2(3190 行,max_iter 10 + token 预算 governor + 错误自愈);plan_mode 只读白名单三态;工具 30+(代码库/文件/命令/搜索/DB/git/browser×12/computer×10);MCP 全形态客户端+网关;六后端沙箱+审批代理;上下文压缩 88%/70% 双阈+归档表;LTM 五表记忆;resume 前缀续写;限流/取消/计费埋点齐备。

---

## 三、逐项差距矩阵(本轮核心产出)

图例:🔴P0=用户每次对话都感知;🟡P1=一周内应跟上;⚪P2=拉开身位/长尾。`无`/`部分`/`有` 为与竞品基线对照结论。

### A. 对话流显示层

| # | 项目 | 竞品做法 | 本项目现状(证据) | 结论 | 建议方案 |
|---|---|---|---|---|---|
| 15 | 会话标题自动生成 | 四家全员:首条消息自动起标题 | `chat.ts` schema 无标题生成链路,仅前端手填/默认 | 🔴 无 | 首轮回复 done 后异步 LLM 生成(截断首条 user 消息+摘要),失败静默回退现有命名;i18n 5 语言 |
| 16 | 流式平滑渲染 | 逐词/逐字平滑动画+滚动跟随 | `createDeltaBatcher` 帧级 flush 直接蹦字,无平滑过渡;滚动跟随行为未审计 | 🔴 部分 | delta 渲染加 CSS/JS 平滑 reveal(非字符级定时器,保持性能);审计并统一「流式中自动滚动到底/用户上翻即暂停跟随」交互 |
| 17 | 代码块行号 | Codex diff 带行号、各家代码块普遍行号 | `markdown-stream.tsx` 代码块无行号(高亮/复制/折叠/应用齐备) | 🔴 无 | react-syntax-highlighter gutter 行号 + `showLineNumbers` 开关;diff 卡行号已有则对齐样式 |
| 18 | @目录级与 # 语义源引用 | Trae `@文件夹`、Qoder `@符号`;Trae `#Codebase/#Docs/#Terminal` | `file-mention-popover` 仅文件级 | 🔴 部分 | ① 目录级引用(注入目录树摘要);② `#Codebase` 全库检索源、`#Terminal`(最近终端输出)、`#Docs` 三个语义源 chip,复用五维索引 |
| 19 | 回复内文件引用 chip | Qoder 执行步骤内文件引用可点击跳转 | 消息体内无文件 chip,文件引用仅在输入区 | 🔴 无 | 工具调用 read_file/write_file/apply-diff 涉及的路径在消息尾聚合为 FileChip 条(点击 openFile+setActiveTopTab,复用 apply-code-block 的打开链路) |
| 20 | turn 级变更汇总+整体回滚 | Codex `turn_diff`;Trae Changes 表格;Qoder Changes 审查 | 有单文件 InlineDiffCard + ToolCallSummaryCard,无轮次聚合文件树视图与一键整体回滚 | 🔴 部分 | 每轮 done 生成 turn changes 汇总(文件树+增删行数),支持逐文件查看与「整体恢复到轮前 checkpoint」(checkpoint API 已具备) |
| 21 | 流内实时 token/成本显示 | Codex 流中显示用量 | usage 仅在 done 事件;前端 UsageBreakdown 等完成才可见 | 🔴 部分 | SSE 增独立 `usage` 节流事件(每 N token),输入框 context-usage-ring 实时联动 |

### B. 传输与会话健壮性

| # | 项目 | 竞品做法 | 本项目现状(证据) | 结论 | 建议方案 |
|---|---|---|---|---|---|
| 22 | SSE 事件 id + Last-Event-ID 重放 | 标准做法 | `sse_buffer.py` 存在未接线;resume 为前缀续写非重放 | 🟡 部分 | SSE 每事件加 `id:`(seq),api 侧 ring buffer 保留当前流全量事件,断连携 Last-Event-ID 重放缺失段;resume 保留为降级路径 |
| 23 | chat 多端/多标签实时同步 | Codex app 多线程并行可见;各家账号级同步 | chat 不走 WS(`create-websocket-hook` 仅 question 广播),多端打开不同步 | 🟡 无 | chat-server 增加 conversation 房间:消息落库后广播 `message:created/patched`,他端增量拉取;先做多标签同端,再扩移动端 |
| 24 | 消息游标分页 | 大会话性能标配 | `chat-queries.ts` offset 分页(L347) | 🟡 部分 | keyset 分页(cursor=createdAt+id),响应带 nextCursor;旧 offset 兼容一个版本 |
| 25 | SSE 事件 schema 集中类型化 | 工程标配 | 事件定义散落 `llm.py` 3534 行,无集中 schema | 🟡 无 | 定义 SSE 事件契约单一事实源(Python TypedDict + TS 联合类型双端生成/对齐),`check-agent-event-parity.mjs` 扩展为全事件强制对账 |

### C. 智能层(上下文与记忆的「可见性」)

| # | 项目 | 竞品做法 | 本项目现状(证据) | 结论 | 建议方案 |
|---|---|---|---|---|---|
| 26 | RAG 默认接入主聊天 | Qoder Knowledge Engine 自动蒸馏注入 | knowledge_lookup 仅作为工具被动调用;独立 RAG 未默认注入 | 🟡 部分 | 会话绑定工作区时默认检索 top-k 知识注入 prompt(轻量,阈值触发),citations 已有渲染端;可设置关闭 |
| 27 | 记忆更新可视化 | WorkBuddy 三层记忆可感;Qoder Memory 沉淀可见 | LTM/画像后台静默写,对话流无任何提示 | 🟡 部分 | 记忆写入时插入轻提示条「已记住:…(管理)」跳设置页;避免喧宾夺主,每轮限 1 条 |
| 28 | 代码块一键运行 | Codex/Trae 对话内运行回显 | 代码块无运行入口;终端在独立 ai-terminal-dock 未打通 | 🟡 无 | 代码块头部「运行」→ 判定语言可执行性 → 沙箱执行 → 输出以 TerminalSection 内联回显;默认审批链路复用 |
| 29 | AI 个性预设 | Codex `/personality`;Qoder Rules | sampling-params-panel 可改 system prompt,无预设档 | ⚪ 无 | 2–3 个内置个性(精简务实/深度解释/循循善诱)+ `/personality` 斜杠命令,存会话偏好 |
| 30 | diff 评论驱动返工 | Codex diff 上评论→agent 修改 | InlineDiffCard 仅 Accept/Reject | ⚪ 无 | diff 卡加「评论」入口,评论文本作为定向 feedback 注入下一轮 agent 上下文 |
| 31 | 全局任务看板 | Qoder My Quests 三列看板 | background-agents-panel 列表式,无跨会话状态看板 | ⚪ 部分 | 任务卡片化(运行中/待操作/完成三列),聚合所有会话后台任务,点击跳转对话 |

### D. 长尾与质量

| # | 项目 | 竞品 | 现状 | 结论 | 建议方案 |
|---|---|---|---|---|---|
| 32 | PDF 等文件消息内富预览 | 各家有不同程度支持 | 输出文件无内嵌预览 | ⚪ 无 | 常见格式(PDF/CSV)iframe/表格化预览条 |
| 33 | 思考分节标题化 | Codex reasoning sections | thinking-section 整段展示无分节 | ⚪ 部分 | reasoning 按段落/分隔符切节,加小标题(推断或模型输出 section 标记) |
| 34 | 屏幕阅读器对话全流程 e2e | 无障碍标配 | 有 accessibility.spec 但无对话全流程 SR 用例 | ⚪ 部分 | 补 aria-live 流式播报 + SR 全流程 spec |
| 35 | 流式 markdown 增量解析缓存 | 性能标配 | 每帧全量重渲染 markdown | ⚪ 部分 | 按块缓存已稳定的 AST 片段,仅解析尾部活跃块 |
| 36 | 多模型并排对比 | 少数产品有 | best_of_n 后端有未接对话 UI | ⚪ 无 | 会话内对同一消息选 2–3 模型并排生成对比卡片 |

---

## 四、已达标、无需立项项(审计确认,避免误伤)

- 流式中断 Stop、中断后追加指令继续(AbortController + interruptedMessageId)
- 思考流式逐字 + 计划步骤实时打勾(2026-09-12 批次第 5 项)
- 工具卡片全量展示(参数/结果/时长/迭代轮次)+ 审批弹窗 + 三档权限
- checkpoint 回退面板、消息编辑重跑(分叉)、重新生成、会话分支
- 上下文压缩双阈 + 归档表 + compaction-status-bar;context-usage-ring + Token 饼图/历史图
- 断线 resume(前缀续写)、限流、取消、错误自愈
- 多模态输入(粘贴截图/拖拽/附件)、TTS 朗读、语音输入
- 应用到文件/插入光标、Canvas 版本历史、Repo Wiki 对应物、FIM 闭环
- 会话管理(置顶/收藏/归档/导出/压缩/搜索)、斜杠命令、输入历史、草稿持久化
- 5 语言 i18n + 暗色主题 + aria 广覆盖

## 五、与第一轮批次的关系

- 第一轮(2026-09-12,14 项)已解决「主链路补齐」:编辑重跑、应用到文件、安全默认开启、Canvas、思考/计划流式、resume、参数面板、Repo Wiki、FIM、通知感知、截图+TTS、部署 AI 诊断。
- 本轮(V2)下沉到「对话流元素颗粒度」:显示平滑度(15–21)、传输健壮性(22–25)、智能可见性(26–31)、长尾(32–36)。
- 第一轮遗留未完成项保持原状:小程序 AI 增强(原 12)、Skill 市场产品化(原 14),并入总排期尾部。
- **最大病根沿用第一轮判断并新增**:第一轮病根是「能力库存 > 实际生效」;本轮新增病根是「**智能在后台发生,但对话流里看不见**」——RAG/记忆/turn 变更/usage 都真实存在,只是没有以用户可感知的形式呈现,恰是 Codex/Trae/Qoder 对话体验的主观差距来源。

## 六、排期建议

1. **第一周(P0)**:15 标题生成 → 17 行号 → 16 平滑渲染 → 19 文件 chip → 21 usage 流内 → 18 @目录/# 源 → 20 turn 变更汇总(依赖 checkpoint,最重放最后)。
2. **第二周(P1)**:25 SSE 契约类型化先行(为 22 铺路)→ 22 Last-Event-ID → 24 游标分页 → 28 代码块运行 → 26 RAG 默认注入 → 27 记忆提示 → 23 多端同步。
3. **第三周起(P2)**:按 29→30→31→33→35→36→32→34 顺序,穿插第一轮遗留(小程序 AI、Skill 市场)。

验收基线:每项完成须有 e2e 或单测 + 5 语言 i18n parity + 三端 tsc/eslint 零新增错误;SSE 相关改动须过 `check-agent-event-parity.mjs`。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
