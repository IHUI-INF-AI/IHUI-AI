<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D167-2 裁定报告 · chatSession.highlights.*（43 行，只读 HEAD 面）

- 仓库：G:\IHUI-AI；裁定基线：**HEAD = 0925bca43daa9f95d5015f97ecd18581bfa89404**（工作树语言包有他人在飞改动，全程未采用）。
- 我方语料（HEAD 面）：`git show HEAD:packages/i18n/messages/web/zh-CN.json`（展平 23049 条）+ `git show HEAD:packages/i18n/messages/shared/zh-CN.json`（展平 1995 条）；展平产物见本目录 `head-web-zh.flat.tsv` / `head-shared-zh.flat.tsv`，值匹配脚本 `search.js` → `search-out.txt`。
- 我方面板事实源：`git show HEAD:apps/web/src/components/ai/task-monitor-sections.tsx`（`TASK_MONITOR_ZONES` 四区 progress/activity/results/auxiliary，注释自证"G-63 对标 Qoder「任务监控」分区原文"）+ `git show HEAD:apps/web/src/stores/task-monitor.ts`（展示方式 sections/tabs）。四区**不含**"任务回顾(recap)"区。
- 判定统计：**TRUE-GAP 26 行（5 组）/ FALSE 17 行 / UNDETERMINED 0 / TICKETED 0**。
  - TICKETED 核验：已知票 D165 分组经查 `PROJECT_PLAN.md:7551` = 侧栏会话分组「移动到分组/移动所选/分组置顶」（sidebarGroup.*），与本片 `highlights.group.*`（内容聚合分组）无关，故本片无可标 TICKETED 的行。
  - 备注：`git grep "添加链接" HEAD` 另命中 `packages/i18n/messages/mobile-rn/zh-CN.json:566 "urlAddBtn":"添加链接"`——mobile-rn 面不在本次审定范围（web），不改变 web 面裁定，仅备注。

## ① 43 行逐行裁定表

| key 末段 | 判定 | 证据指针 |
|---|---|---|
| open（打开任务监控） | FALSE | 前轮已裁假阳；面板开关在位：`apps/web/src/stores/ai-panel.ts`（docked/floating 面板状态）+ `apps/web/src/components/ai/ai-side-panel.tsx:926`（FAB 入口） |
| title（任务监控） | FALSE | `taskMonitor.sections.progress/activity/results/auxiliary`=进度与上下文/执行活动/结果与来源/辅助入口 + `aiToolsPanel.title=工具面板`；`task-monitor-sections.tsx:12` 注释自证对标 Qoder「任务监控」 |
| linkedIssue（关联 Issue） | TRUE-GAP(E) | `git grep -in "linkedIssue" HEAD -- apps/web/src packages/shared/src` 零命中；`git grep -n "议题" HEAD -- apps/web/src/components/ai` 零命中（仅 shared `taskStatus.toolMcp*CreateIssueActivity` 工具活动键，相邻不背书） |
| empty（还没有有价值的内容） | TRUE-GAP(A) | 两包 25044 条展平值匹配零 EXACT；聚合视图本体缺失（见 A 组探针） |
| emptyDescription（整个任务中产生的文件…汇总在这里） | TRUE-GAP(A) | 同上；描述句即聚合视图空态文案，我方无对应聚合位 |
| loadFailed（任务监控暂时无法读取。） | FALSE | `chat.loadFailed=加载失败`、`agentTimeline.loadFailed=时间线加载失败,请稍后重试`、`aiChat.envInfo.errorTitle=环境信息加载失败`（各数据位错误键在位） |
| switchToFloating（切换为 Floating 模式） | FALSE | `aiChat.floatMode=浮窗模式` + `apps/web/src/stores/ai-panel.ts:75`（docked→floating 浮窗可拖拽） |
| showFixed（显示任务监控） | FALSE | 面板显隐由 FAB/浮窗承接（`ai-side-panel.tsx:926` + `stores/ai-panel.ts`），与 open/pin 前轮假阳同口径 |
| hideFixed（隐藏任务监控） | FALSE | 同上 |
| openSettings（前往设置） | FALSE | 面板头配置在位：`taskMonitor.displayMode=展示方式`/`modeSections=分区`/`modeTabs=平铺`（stores/task-monitor.ts 持久化）；全局 `nav.settings=设置` |
| loadingMore（正在加载…） | FALSE | `chat.loading=加载任务中...`、`aiChat.envInfo.loading=加载中…`、`ai.pane.moveToWorktree.branchesLoading=正在加载分支…` |
| addSource（添加来源） | FALSE | `chat.addMenuLabel=添加` + `chat.addMenuDesc=添加菜单(模板/引用/Skill/附件/插件/压缩)` + `contextSelector.title=上下文选择器 · # 引用`（组件 `apps/web/src/components/ai/context-selector-popover.tsx`） |
| addLink（添加链接） | FALSE | `contextSelector.kindWeb=网页`/`descWeb=引用网页 URL 内容` + `chat.mentionEngine.tabWeb=网页` |
| openMemorySettings（打开记忆设置） | FALSE | `memory.manager=记忆管理`、`memoryManager.title=长期记忆管理`、`nav.memory=记忆系统`、`aiToolsPanel.tabs.memory=记忆`（progress 区） |
| actionFailed（无法添加来源，请检查内容后重试。） | FALSE | `ai.pane.inputSources.snapshot.failedHint=快照创建失败，可重试或改用普通附件发送` + `snapshot.state.failed=智能快照失败`（附加失败态在位） |
| recap.title（任务回顾） | TRUE-GAP(B) | `git grep -n "回顾" HEAD -- apps/web/src packages/shared/src` 实现层零命中（仅 `components/publish/ContentTemplateLibrary.tsx:43` 无关模板串）；recap 仅 `fold-policy.ts:9` 注释 |
| recap.handoff.menuItem（移交到新任务） | TRUE-GAP(B) | 见 B 组探针；"移交"命中全部为 D102 `ai.pane.moveToWorktree.*`（移交至工作树，同会话换检出分支，无总结交接、无新建任务） |
| recap.handoff.title（移交到新任务） | TRUE-GAP(B) | 同上 |
| recap.handoff.previewDescription（检查交接内容后…创建一个新任务） | TRUE-GAP(B) | 同上 |
| recap.handoff.purposeLabel（交接目的） | TRUE-GAP(B) | 两包展平值匹配零 EXACT、零 SUBSTR（search-out.txt:277 no hit） |
| recap.handoff.purposePlaceholder（例如：验证新的任务回顾生成逻辑…） | TRUE-GAP(B) | 同上 |
| recap.handoff.waitingPreview（正在准备交接内容…） | TRUE-GAP(B) | 同上 |
| recap.handoff.phase.generating（模型正在生成交接内容…） | TRUE-GAP(B) | 同上 |
| recap.handoff.phase.finalizing（正在整理并写入临时交接文档…） | TRUE-GAP(B) | 同上 |
| recap.handoff.phase.done（交接文档已生成。） | TRUE-GAP(B) | 同上 |
| recap.handoff.revealFile（显示文件） | TRUE-GAP(B) | 隶属交接流程位；handoff 实现零命中 |
| recap.handoff.createSession（创建新任务） | TRUE-GAP(B) | "从交接文档创建新任务"零命中；既有 `chat.create`/`common.create` 为通用新建，相邻不背书 |
| recap.handoff.creating（正在创建…） | TRUE-GAP(B) | 同上 |
| recap.handoff.createFailed（无法从交接文档创建新任务，请重试。） | TRUE-GAP(B) | 同上 |
| environment.preserveChangesAction（保存改动并检出） | TRUE-GAP(D) | `git grep -n "保存改动\|未提交\|stash" HEAD -- packages/shared/src/chat apps/web/src/components/ai` 零命中（move-to-worktree.ts/worktree-lifecycle.ts/dialog 均无脏区处理） |
| environment.localServers（本地服务） | TRUE-GAP(C) | `git grep -n "本地服务" HEAD -- apps/web/src packages/shared/src` 零命中 |
| environment.refreshLocalServers（刷新本地服务） | TRUE-GAP(C) | 同上；`aiChat.envInfo.refresh=刷新` 仅环境信息条，非服务探测，相邻不背书 |
| environment.noLocalServers（没有正在运行的本地服务） | TRUE-GAP(C) | 同上 |
| group.artifact（产出） | TRUE-GAP(A) | results 区内容=bestof/worlds/atomicrollback/tokens/spec/wiki（`task-monitor-sections.tsx:24-26`），无产出清单聚合；canvas 为内联渲染非聚合 |
| group.browser（网页查阅） | TRUE-GAP(A) | `git grep -n "网页查阅" HEAD -- apps/web/src packages/shared/src` 零命中；`taskStatus.toolBrowser*Activity` 为工具活动行非聚合组 |
| emptyGroup.artifact（暂无产出数据 :)） | TRUE-GAP(A) | 隶属 A 组聚合视图 |
| emptyGroup.browser（暂无网页查阅数据 :)） | TRUE-GAP(A) | 同上 |
| emptyGroup.source（暂无来源数据 :)） | TRUE-GAP(A) | 同上；`taskStatus.sourcesButton=来源`(D81) 为单工具卡来源展开按钮，相邻不背书 |
| emptyGroup.memory（暂无记忆数据 :)） | FALSE | `memoryCards.empty=该类目暂无记忆条目`、`memoryManager.empty=暂无长期记忆…`、`teamMemory.empty`；记忆 Tab 在位（progress 区） |
| status.waiting-user（等待回应） | FALSE | `ai.pane.turnStatus.state.waitingConfirm=等待确认`（轮次等待用户位）；AI 主动提问挂起链路在位（`apps/web/src/stores/chat.ts:274`、`ai-side-panel.tsx:1196`）；D53 会话行等待态 `chatHistory.attentionWaiting=等待你处理` |
| linkDialog.title（添加链接） | FALSE | 同 addLink：`contextSelector.kindWeb`/`chat.addMenuLabel` |
| linkDialog.description（将一个 HTTP 或 HTTPS 链接加入输入框…记录为来源。） | FALSE | `contextSelector.descWeb=引用网页 URL 内容`（同能力说明位） |
| linkDialog.invalid（请输入以 http:// 或 https:// 开头的有效链接。） | FALSE | 能力入口在位（# 引用网页/粘贴直发）；无 1:1 校验文案键，由发送侧 URL 形态识别承接（`packages/shared/src/chat/user-message-parts.ts` 四形态），不构成能力缺口 |

## ② TRUE-GAP 分组（5 组 26 行）

### A 组 · 任务级「产出/网页查阅/来源」内容聚合分组（7 行）
- 行：`empty`、`emptyDescription`、`group.artifact`、`group.browser`、`emptyGroup.artifact`、`emptyGroup.browser`、`emptyGroup.source`
- 竞品原文：产出 / 网页查阅 / "整个任务中产生的文件、网页和来源会持续汇总在这里，帮助跟踪任务进展。" / 还没有有价值的内容 / 暂无产出数据 :) / 暂无网页查阅数据 :) / 暂无来源数据 :)
- 零命中探针：
  - `git grep -n "网页查阅" HEAD -- apps/web/src packages/shared/src` → **零命中**
  - `git grep -n "产出" HEAD -- apps/web/src packages/shared/src` → 仅注释/测试用语（如 `task-monitor-sections.tsx:26` 自述 results 区"产出物、对照与出处"），无聚合分组实现
  - 两包 25044 条展平值匹配："还没有有价值的内容"及空态描述句 **零 EXACT**
- 相邻不背书：canvas/artifact-canvas=对话内联渲染；`taskStatus.sourcesButton`(D81)=单工具卡来源展开；results 四区=择优/世界线/整栈回滚/用量/规格/知识库，均非任务级文件/网页/来源汇总。
- 建议票面：**任务监控增「任务内容聚合」分组视图：产出/网页查阅/来源 三组清单＋各空态与汇总描述文案（对标 chatSession.highlights.group/emptyGroup）**

### B 组 · 任务回顾与移交新任务 recap/handoff 全流程（14 行）
- 行：`recap.title` + `recap.handoff.*` 13 行（menuItem/title/previewDescription/purposeLabel/purposePlaceholder/waitingPreview/phase.generating/phase.finalizing/phase.done/revealFile/createSession/creating/createFailed）
- 竞品原文：任务回顾；移交到新任务；"检查交接内容后，可以在文件位置查看，或直接创建一个新任务继续工作。"；交接目的；生成/写入临时交接文档/完成三相位；显示文件；创建新任务
- 零命中探针：
  - `git grep -n "任务回顾\|回顾" HEAD -- apps/web/src packages/shared/src packages/i18n/messages/web/zh-CN.json packages/i18n/messages/shared/zh-CN.json` → 实现层**零命中**
  - `git grep -in "recap" HEAD -- apps/web/src packages/shared/src` → 仅 `fold-policy.ts:9` 注释（对标 Codex auto recap，无实现）
  - `git grep -n "交接" HEAD -- apps/web/src packages/shared/src` → 仅 D94 handoff-package（失败位**脱敏交接单**，四段 diagnosis/fixSteps/evidence/productSurface，对外提交用，非会话交接）
- 相邻不背书：D94 交接单（错误诊断物）≠ 回顾交接文档；D102 `ai.pane.moveToWorktree.*`（移交至工作树=同会话换检出分支，无总结生成、无新建任务）≠ 移交到新任务；worlds 世界线=同问题 fork 回复，亦不同。
- 建议票面：**会话一键「任务回顾→移交」：生成回顾交接文档（目的/预览/落盘/显示文件）并从交接文档创建新任务继续（对标 chatSession.highlights.recap.handoff 全流程）**

### C 组 · 任务环境「本地服务」探测（3 行）
- 行：`environment.localServers`、`environment.refreshLocalServers`、`environment.noLocalServers`
- 竞品原文：本地服务 / 刷新本地服务 / 没有正在运行的本地服务
- 零命中探针：`git grep -n "本地服务" HEAD -- apps/web/src packages/shared/src` → **零命中**（仅 deploy/scripts 与基准 docs 命中，均非 web 实现）
- 相邻不背书：`aiChat.envInfo.*`=Git/GitHub 环境信息条（分支/变更/PR），无本地端口/服务探测；`scripts/data/chat-element-coverage.json:150` 为竞品要素台账非实现。
- 建议票面：**任务监控环境卡片：本地服务探测列表＋刷新＋空态（对标 chatSession.highlights.environment.localServers）**

### D 组 · 分支/任务切换的未提交改动保护（1 行）
- 行：`environment.preserveChangesAction`（保存改动并检出）
- 零命中探针：`git grep -n "保存改动\|未提交\|stash" HEAD -- packages/shared/src/chat apps/web/src/components/ai` → **零命中**；`move-to-worktree-dialog.tsx` 无脏工作区分支（仅阻止 turn 活跃态）
- 相邻不背书：moveToWorktree=新目录检出，语义不改写当前工作区；竞品该键是切换分支时对未提交改动的显式保护动作。
- 建议票面：**分支/工作区切换提供未提交改动保护动作「保存改动并检出」（含确认弹层，对标 environment.preserveChanges）**

### E 组 · 会话关联 Issue 入口（1 行）
- 行：`linkedIssue`（关联 Issue）
- 零命中探针：`git grep -in "linkedIssue" HEAD -- apps/web/src packages/shared/src` → **零命中**；`git grep -n "议题" HEAD -- apps/web/src/components/ai` → **零命中**（仅 shared `taskStatus.toolMcp*CreateIssueActivity` 活动文案）
- 相邻不背书：MCP GitHub/Linear 创建议题=工具动作；`aiChat.envInfo.*` 拉取请求状态=PR 非 Issue 关联。
- 建议票面：**会话关联 Issue：监控内展示关联议题并支持跳转/挂载（对标 chatSession.highlights.linkedIssue；低优先级）**

## 附：方法与产物
- 展平：`node flatten.js`（head-web-zh.json→23049 条、head-shared-zh.json→1995 条，含 BOM 兼容）。
- 值匹配：`node search.js` → `search-out.txt`（EXACT 0 条；4 行 no hit：linkedIssue/purposeLabel/group.artifact/status.waiting-user——后者经同义词探针判 FALSE）。
- 全部证据命令均走 `git show` / `git grep … HEAD`，未读取工作树语言包；仓库零修改，临时脚本与报告仅落于 `.ihui-agent/tmp/d167-2/`。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
