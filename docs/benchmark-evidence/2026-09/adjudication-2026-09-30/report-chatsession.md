<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# chatSession.* 剩余族 89 行逐条裁定（d167-2 / 只读 HEAD 面）

生成：2026-09-29（裁定子代理）。**证据基线**：`git show HEAD:packages/i18n/messages/web/zh-CN.json`（23348 键，下称 web-zh）+ `git show HEAD:packages/i18n/messages/shared/zh-CN.json`（1995 键，下称 shared-zh）+ `git grep -n <串> HEAD -- apps/web/src packages/shared/src`。禁止工作树语言包判定——本报告全部指针均为 HEAD 面行号或 HEAD blob 代码行。

**方法**：① 同义词先行（全量值层精确/归一化双向子串匹配，脚本 `.ihui-agent/tmp/d167-2/probe.mjs`，输出 `probe-values.json`）；② 代码级探针（`grep-probe.mjs/2/3.mjs`，共 40+ 串）；③ 相邻机制不背书；④ 三态：TRUE-GAP（零覆盖+探针证据）/ FALSE（我方键+值，含同义改名）/ UNDETERMINED（缺什么需拍板）。

**裁定汇总**：89 行 = TRUE-GAP **62** / FALSE **15** / UNDETERMINED **12**；TICKETED 0 行（D162–D165/D158-161/D151-155/D132 各票的键均不在本切片；本切片与前轮已裁 3 键——workspaceTabs.add/close、selectionAnnotations.edit——无交集，见文末边界注）。

> **高优先勘误**：任务书称本切片"其余零散 43（不含 highlights…已归票）"，实测 `slice-chatsession.json` 前 43 行**就是** `chatSession.highlights.*`（与同目录 `slice-highlights.json` 43 键完全相同，Node 实测 `in both: 43`）。现台账（root PROJECT_PLAN.md，最大票号 D174；D163=undo/回退、D164=速记板、D165=侧栏分组、D166=链接预览卡、D162=排队拒因、D158-161=错误码、D151-155=协议通道、D132=SSE 契约）中**查不到 highlights 族对应票号**。本报告按三态如实裁定；若 highlights 已由并行线另立票，以该票为准替换下表 43 行判定即可。

---

## 一、逐行裁定表（89 行）

判定列：G=TRUE-GAP / F=FALSE / U=UNDETERMINED。证据指针格式：`web-zh:行号`＝`git show HEAD:packages/i18n/messages/web/zh-CN.json` 该行；`shared-zh:行号`同；`HEAD:文件:行`＝代码探针；`0hit`＝`git grep -F "<串>" HEAD -- apps/web/src packages/shared/src` 零命中。

### chatSession.highlights（43 行）

| key 末段 | 判定 | 证据指针 |
| --- | --- | --- |
| highlights.open（打开任务监控） | G | 0hit「任务监控」面板串；D52 仅工具 Tab 分组层（HEAD:apps/web/src/components/ai/task-monitor-sections.tsx:13-47），邻位不背书 |
| highlights.title（任务监控） | G | web-zh 0hit；`taskMonitor.sections.*`=进度与上下文/执行活动/结果与来源/辅助入口（web-zh:27577-27585），非「任务监控」面板 |
| highlights.linkedIssue（关联 Issue） | G | 0hit「关联 Issue/linkedIssue」；包内 issue* 全为证书颁发/开具域（web-zh:1737-1743） |
| highlights.empty（还没有有价值的内容） | G | 0hit |
| highlights.emptyDescription（整个任务中产生的文件、网页和来源会持续汇总…） | G | 0hit |
| highlights.loadFailed（任务监控暂时无法读取。） | G | 0hit |
| highlights.switchToFloating（切换为 Floating 模式） | G | 0hit；`aiChat.floatMode`=浮窗模式（web-zh:9042）为 AI 面板页内浮窗（ai-side-panel.tsx:1414-1426），邻位不背书 |
| highlights.showFixed（显示任务监控） | G | 0hit |
| highlights.hideFixed（隐藏任务监控） | G | 0hit |
| highlights.openSettings（前往设置） | G | 0hit；面板结构件随面板本体缺；同功能串 `aiChat.settings`=任务设置（web-zh:9061）可复用，不构成覆盖 |
| highlights.loadingMore（正在加载…） | F | `aiChat.loading`=加载中...（web-zh:9045，flat TSV 实证） |
| highlights.addSource（添加来源） | G | 0hit「添加来源」 |
| highlights.addLink（添加链接） | G | 0hit；D166=发送前链接预览卡（linkFileActions），本键=来源登记对话框，相邻不同槽位 |
| highlights.openMemorySettings（打开记忆设置） | G | 0hit「记忆设置」；`aiToolsPanel.tabs.memory`=记忆在位（web-zh:9834），入口串缺 |
| highlights.actionFailed（无法添加来源，请检查内容后重试。） | G | 0hit |
| highlights.recap.title（任务回顾） | G | 0hit「任务回顾」 |
| highlights.recap.handoff.menuItem（移交到新任务） | G | 0hit「移交到新任务/交接文档」 |
| highlights.recap.handoff.title（移交到新任务） | G | 0hit |
| highlights.recap.handoff.previewDescription | G | 0hit |
| highlights.recap.handoff.purposeLabel（交接目的） | G | 0hit |
| highlights.recap.handoff.purposePlaceholder | G | 0hit |
| highlights.recap.handoff.waitingPreview | G | 0hit |
| highlights.recap.handoff.phase.generating | G | 0hit |
| highlights.recap.handoff.phase.finalizing | G | 0hit |
| highlights.recap.handoff.phase.done（交接文档已生成。） | G | 0hit |
| highlights.recap.handoff.revealFile（显示文件） | G | 0hit（Reveal in 系桌面壳动作，浏览器内无对应） |
| highlights.recap.handoff.createSession（创建新任务） | G | 0hit；`aiChat.newConversation`=新建任务（web-zh:9048）为侧栏动作，非交接流出口 |
| highlights.recap.handoff.creating（正在创建…） | G | 0hit |
| highlights.recap.handoff.createFailed | G | 0hit |
| highlights.environment.preserveChangesAction（保存改动并检出） | G | 0hit「保存改动」；邻位 `ai.pane.moveToWorktree`=将对话移交至工作树/检出分支（web-zh:7529-7531）无保存改动语义 |
| highlights.environment.localServers（本地服务） | G | 0hit「本地服务/localServer」；`aiChat.envInfo` 有本地/分支/提交推送（L1），无服务清单 |
| highlights.environment.refreshLocalServers | G | 0hit |
| highlights.environment.noLocalServers | G | 0hit |
| highlights.group.artifact（产出） | F | `deliveryReview.tabDelivery`=交付清单（web-zh:12441）+ `ai.pane.runtimeSessionDeliverables`=交付清单（web-zh:8037），同义改名 |
| highlights.group.browser（网页查阅） | G | 0hit「网页查阅」 |
| highlights.emptyGroup.artifact（暂无产出数据 :)） | F | `deliveryReview.empty`=暂无交付数据（web-zh:12444） |
| highlights.emptyGroup.browser | G | 0hit |
| highlights.emptyGroup.source（暂无来源数据 :)） | G | 0hit |
| highlights.emptyGroup.memory（暂无记忆数据 :)） | F | `teamMemory.empty`=当前 scope 暂无记忆（flat TSV 实证；web-zh:297） |
| highlights.status.waiting-user（等待回应） | F | `chatHistory.attentionWaiting`=等待你处理（flat TSV 实证；web-zh:11637），conversation-attention 流在位 |
| highlights.linkDialog.title（添加链接） | G | 0hit |
| highlights.linkDialog.description | G | 0hit |
| highlights.linkDialog.invalid | G | 0hit |

小计：**G 38 / F 5**。

### chatSession.workspaceTabs（21 行）

| key 末段 | 判定 | 证据指针 |
| --- | --- | --- |
| workspaceTabs.label（任务工作面） | U | 0hit「任务工作面」；我方=工作展示区（`aiChat.openWorkPanel`=打开工作展示区，web-zh:9092）+TagsView 文件页签+终端停靠，无统一「任务工作面」标签页体系——平台形态差异，需拍板 |
| workspaceTabs.typeLabel（工作面与文件标签页） | U | 同上（设置页描述串，0hit） |
| workspaceTabs.instancesLabel（当前类型标签页） | U | 同上（0hit） |
| workspaceTabs.closeMenu.closeRight（关闭右侧标签页） | G(注) | 0hit；**曾有**：TagsView.tsx:291「2026-07-31 第十三轮做减法:删除 closeOther / closeRight(与 closeAll 语义重叠)」——有意删除，建议按已拍板不做处理；如立票须注明"恢复已删能力" |
| workspaceTabs.emptyTitle（暂无打开的工作面） | F | `tagsview.empty`=暂无打开的页面（flat TSV 实证；TagsView.tsx:471/515 同槽位） |
| workspaceTabs.memberUnavailableTitle（选择成员任务） | U | 0hit；代理任务面在位（`aiToolsPanel.tabs.agents`=代理，web-zh:9838），工作面形态成员任务选择器缺——形态差异需拍板 |
| workspaceTabs.launcherLabel（打开工作面） | F | `ai.toolCall.openInWorkPanel`=在工作展示区打开（flat TSV 实证；tool-call-card.test.tsx:18 夹具同名键） |
| workspaceTabs.newSpec（打开计划） | F | `aiToolsPanel.tabs.plan`=计划（web-zh:9835；task-monitor-sections.tsx:70-134 消费）+规划模式（web-zh:11297） |
| workspaceTabs.newEvidence（新建证据） | G | 0hit「新建证据」；包内"证据"全为内部审计串（agent-recorder-api.ts:40-56、diffEvidence），非用户可建工作面对象 |
| workspaceTabs.showReview（打开审阅） | F | diffReview.* 审阅视图在位（web-zh:15973-15987 标记为已审阅/已审阅 {viewed}/{total}）+ D98 单卡审阅态（inline-diff-card.tsx:44-48）；非工作面标签页形态，注明 |
| workspaceTabs.openReview（打开审阅） | F | 同上 |
| workspaceTabs.openTerminalDescription（在当前目录运行命令） | F | `aiChat.openTerminal`=打开终端（web-zh:9052；ai-side-panel.tsx:1441-1448）+ terminalDock 新建终端（web-zh:9068）；描述语差异，功能在位 |
| workspaceTabs.single（单例） | U | 0hit；标签页类型注册表描述串，随「任务工作面」体系——形态差异需拍板 |
| workspaceTabs.filesOrdinal（文件 {{ordinal}}） | U | 0hit；我方文件页签直显文件名，无类型序号命名——形态差异需拍板 |
| workspaceTabs.specOrdinal（计划 {{ordinal}}） | U | 0hit，同上 |
| workspaceTabs.terminalOrdinal（终端 {{ordinal}}） | U | 0hit；terminalDock 多会话在位（web-zh:9066-9070），序号命名未证——形态差异需拍板 |
| workspaceTabs.evidenceOrdinal（证据 {{ordinal}}） | G | 0hit；随 newEvidence，证据对象零命中 |
| workspaceTabs.agent（成员任务） | U | 0hit；代理任务以侧栏 Tab 呈现（agents/agenttasks/progress），工作面标签页形态缺——需拍板 |
| workspaceTabs.pluginViewInitializationMissingDescription | F | `shared viewFailure.entrypointNotRegistered`=未注册启动入口/「该插件视图没有注册可用的启动入口…」（shared-zh:2298-2301）；mcp-view-failure.tsx:49 消费（D92） |
| workspaceTabs.pluginViewResourceTooLargeDescription | F | `shared viewFailure.resourceLimitExceeded`=资源超出限制（shared-zh:2310-2313） |
| workspaceTabs.pluginViewNodeServiceMissingDescription | F | `shared viewFailure.capabilityNotOffered`=未提供所需能力/「该服务在能力声明中未提供此功能」（shared-zh:2330-2333） |

小计：**G 3 / F 9 / U 9**。

### chatSession.selectionAnnotations（8 行）

| key 末段 | 判定 | 证据指针 |
| --- | --- | --- |
| selectionAnnotations.hoverHint（悬停查看批注） | G | 0hit「划词/悬停查看批注」；我方批注为回复级 `ai.pane.annotation`（对这段回复提批注，web-zh:8017-8028）+D91 文档锚点（annotation-anchor.tsx:7-19 XLSX/DOCX 选区），无选段悬停提示——邻位不背书 |
| selectionAnnotations.selectedText（{{index}}. 选中文字） | G | 0hit「选中文字」；无带序号选段清单 |
| selectionAnnotations.noComment（未添加评论） | G | 0hit |
| selectionAnnotations.commentPlaceholder（添加可选评论…） | G | 0hit；`ai.pane.annotation.placeholder`=对这段回复提批注…（web-zh:8018）对象是整条回复，不背书 |
| selectionAnnotations.commentAriaLabel（划词批注评论） | G | 0hit |
| selectionAnnotations.addComment（添加评论） | G | 0hit；包内"评论"全为社交/代码行评论域（web-zh:1334-1408、8012），无划词评论 |
| selectionAnnotations.removeOne（移除批注 {{index}}） | G | 0hit「移除批注」；`ai.pane.annotation.delete`=删除注释（web-zh:8021）为回复级单条，无序号批注清单 |
| selectionAnnotations.removeAll（移除全部划词批注） | G | 0hit |

小计：**G 8**。（边界注：selectionAnnotations.edit 前轮已裁假阳，不在本切片。）

### chatSession.headerActions（8 行）

| key 末段 | 判定 | 证据指针 |
| --- | --- | --- |
| headerActions.selectOpenWith（选择打开应用） | U | 0hit；桌面壳 OS「打开方式」选择器，浏览器内 web 无从拉起访达/终端——疑似平台形态差异，需拍板 |
| headerActions.systemApplications.finder（访达） | U | 0hit；同上（macOS 专属项） |
| headerActions.systemApplications.windowsTerminal | U | 0hit；同上（Windows 专属项；我方终端为内嵌 PowerShell 停靠面板，web-zh:9070） |
| headerActions.panelGroupButtons（面板组按钮） | G | 0hit；ai-side-panel 头部按钮各自带 aria（ai-side-panel.tsx:1402/1408/1422/1435/1444/1453），无 role=group 组名（`role="group"` 探针 0hit）——a11y 缺口 |
| headerActions.workspaceUnavailable（开始任务后可打开审阅工作面） | G | 0hit；我方审阅视图无"开始任务后"门槛态 |
| headerActions.enterWorkspaceFullscreen（全屏显示工作面） | G | 0hit「全屏显示」；邻位 floatMode 浮窗展开全屏覆盖是 AI 面板（ai-side-panel.tsx:251 注释），非工作面全屏 |
| headerActions.exitWorkspaceFullscreen（退出工作面全屏） | G | 0hit，同上 |
| headerActions.createDraftPullRequest（创建 Draft PR） | G | 0hit「Draft PR/createPullRequest/draftPR」；我方仅展示 PR 状态（`aiChat.envInfo.pullRequest`=拉取请求，L1），无创建动作 |

小计：**G 5 / U 3**。

### chatSession.pictureInPicture（6 行）

| key 末段 | 判定 | 证据指针 |
| --- | --- | --- |
| pictureInPicture.sectionLabel（电脑使用画中画） | G | 0hit「画中画/电脑使用」；`aiChat.floatMode`=浮窗模式（PictureInPicture2 图标，ai-side-panel.tsx:1424）是 AI 面板页内浮窗，邻位不背书 |
| pictureInPicture.computerUse（电脑使用） | F | 同域改名：nav `computerUse`→「浏览器控制」（web-zh:18812；nav-data.ts:402 /computer-use 页在位） |
| pictureInPicture.title（画中画） | G | 0hit |
| pictureInPicture.hideInSession（在此会话中隐藏画中画） | G | 0hit |
| pictureInPicture.hideInAllSessions | G | 0hit |
| pictureInPicture.updateFailed | G | 0hit |

小计：**G 5 / F 1**。平台形态注明：竞品为桌面壳浮动小窗承载 computer-use 会话；浏览器内可用 popout/Document Picture-in-Picture API 对标，实现形态需拍板。

### chatSession.selectionActions（3 行）

| key 末段 | 判定 | 证据指针 |
| --- | --- | --- |
| selectionActions.ariaLabel（选中文本操作） | G | 0hit；我方 D22 仅有「引用选中」单按钮（`chat.quoteSelection`=引用选中，flat TSV；MessageItem.tsx:727-755），无选区操作工具栏组名 |
| selectionActions.attachmentName（选中的文本） | G | 0hit；D22 走引用 chips（useMessageReferences），非附件通道 |
| selectionActions.attachmentLimitReached（附件已达 20 个…） | G | 0hit；我方通用附件上限为 30（G-833：attachment-limits.test.tsx:5-8「31 个附件 ⇒ 收到前 30 个」），值与场景均不同——邻位不背书 |

小计：**G 3**。D164（速记板）只覆盖 addToQuickNotes/addedToQuickNotes 两键，不含本 3 键。

---

## 二、TRUE-GAP 按能力分组（62 行 → 8 组）

### 组 T1 · 任务监控面板（highlights 本体+分区，15 行）
- **竞品键+原文**：`highlights.open`「打开任务监控」/`title`「任务监控」/`empty`「还没有有价值的内容」/`emptyDescription`「整个任务中产生的文件、网页和来源会持续汇总在这里，帮助跟踪任务进展。」/`loadFailed`「任务监控暂时无法读取。」/`switchToFloating`「切换为 Floating 模式」/`showFixed`「显示任务监控」/`hideFixed`「隐藏任务监控」/`openSettings`「前往设置」/`actionFailed`「无法添加来源，请检查内容后重试。」/`group.browser`「网页查阅」/`emptyGroup.browser`「暂无网页查阅数据 :)」/`emptyGroup.source`「暂无来源数据 :)」/`linkedIssue`「关联 Issue」/`openMemorySettings`「打开记忆设置」
- **零命中摘录**：`git grep -F "任务监控" HEAD -- apps/web/src` ⇒ 仅 6 hit 且全为 D52 注释/测试标题（task-monitor-sections.tsx:13「对标 Qoder『任务监控』分区原文」）；「网页查阅/暂无来源数据/关联 Issue/记忆设置」⇒ 全 0hit；web-zh 值层全量匹配 0 命中。
- **邻位否证**：D52 `taskMonitor`（web-zh:27576-27586）是 26 个工具 Tab 的**分区分组层**，不是"任务产出(文件/网页/来源)聚合+监控"面板——同名词不同能力，不背书。
- **建议票面**：任务监控面板缺失——任务过程中产出的文件/网页/来源/记忆聚合视图，含打开/显示/隐藏/浮动切换、分区空态与失败态、关联 Issue 与记忆设置入口；竞品 chatSession.highlights.* 38 键我方零覆盖（D52 为工具 Tab 分组层，邻位不背书）。

### 组 T2 · 来源登记与添加链接（5 行）
- **竞品键+原文**：`addSource`「添加来源」/`addLink`「添加链接」/`linkDialog.title`「添加链接」/`linkDialog.description`「将一个 HTTP 或 HTTPS 链接加入输入框，发送后会记录为来源。」/`linkDialog.invalid`「请输入以 http:// 或 https:// 开头的有效链接。」
- **零命中摘录**：「添加来源/添加链接」0hit。
- **相邻票**：D166=发送前链接**预览卡**（linkFileActions.previewLoading），本组是来源**登记对话框**——相邻不同槽位，立票须与 D166 互相引用防重。
- **建议票面**：会话内「添加来源/添加链接」登记流（HTTP/HTTPS 校验+失败提示，发送后记为任务来源）；与 D166 相邻不同槽位。

### 组 T3 · 任务回顾与移交交接（14 行）
- **竞品键+原文**：`recap.title`「任务回顾」/`handoff.menuItem`「移交到新任务」/`handoff.title` 同/`handoff.description`(L3)/`previewDescription`「检查交接内容后，可以在文件位置查看，或直接创建一个新任务继续工作。」/`purposeLabel`「交接目的」/`purposePlaceholder`/`waitingPreview`「正在准备交接内容…」/`phase.generating`「模型正在生成交接内容…」/`phase.finalizing`「正在整理并写入临时交接文档…」/`phase.done`「交接文档已生成。」/`revealFile`「显示文件」/`createSession`「创建新任务」/`creating`/`createFailed`
- **零命中摘录**：「任务回顾/交接文档/移交到新任务」0hit。
- **相邻票**：D163=文件检查点**回退**（undo 族），handoff 是**向前移交**——方向相反，不背书。
- **建议票面**：任务回顾（recap）与「移交到新任务」：生成脱敏临时交接文档→预览→显示文件→一键创建新任务续作；与 D163 回退族互斥引用。

### 组 T4 · 环境面板补格（4 行）
- **竞品键+原文**：`environment.preserveChangesAction`「保存改动并检出」/`localServers`「本地服务」/`refreshLocalServers`「刷新本地服务」/`noLocalServers`「没有正在运行的本地服务」
- **零命中摘录**：「本地服务/localServer/保存改动」0hit；aiChat.envInfo 已有 本地/分支/提交推送/PR（L1 群）。
- **建议票面**：环境信息扩展——本地服务清单+刷新+空态、切分支「保存改动并检出」确认动作；基座 aiChat.envInfo 在位，属增量补格。

### 组 T5 · 划词批注（8 行）
- **竞品键+原文**：`hoverHint`「悬停查看批注」/`selectedText`「{{index}}. 选中文字」/`noComment`「未添加评论」/`commentPlaceholder`「添加可选评论…」/`commentAriaLabel`「划词批注评论」/`addComment`「添加评论」/`removeOne`「移除批注 {{index}}」/`removeAll`「移除全部划词批注」
- **零命中摘录**：「划词/选中文字/悬停查看批注/移除批注」0hit。
- **邻位否证**：`ai.pane.annotation`=回复级整条批注（web-zh:8017-8028）；D91 annotation-anchor=预览器内 XLSX/DOCX 选区锚（annotation-anchor.tsx:7-19）；D22=引用选中入 chips——三者对象与交互均不同，不背书。
- **建议票面**：会话内划词批注：选段生成带序号批注清单+可选评论+悬停查看+单条/全部移除；与既有回复级批注/D91 文档锚点/D22 引用选中三机制并存不混同。

### 组 T6 · 工作面「证据」标签页（2 行）
- **竞品键+原文**：`workspaceTabs.newEvidence`「新建证据」/`evidenceOrdinal`「证据 {{ordinal}}」
- **零命中摘录**：「新建证据」0hit；包内"证据"全为 agent-recorder 内部审计字段（agent-recorder-api.ts:40-56）。
- **建议票面**：任务工作面新增「证据」标签页类型（用户可新建+类型序号命名）；依附"任务工作面标签页体系"拍板（见 U 组）。

### 组 T7 · 头部动作补格（4 行）
- **竞品键+原文**：`panelGroupButtons`「面板组按钮」/`workspaceUnavailable`「开始任务后可打开审阅工作面」/`enterWorkspaceFullscreen`「全屏显示工作面」/`exitWorkspaceFullscreen`「退出工作面全屏」
- **零命中摘录**：「面板组按钮/全屏显示/role="group"(ai-side-panel)」0hit。
- **建议票面**：AI 面板头部 a11y 组名 + 工作面全屏进出 + 任务未开始时工作面门槛提示；基座三按钮组（envInfo/终端/工作展示区）在位。

### 组 T8 · 创建 Draft PR（1 行）
- **竞品键+原文**：`headerActions.createDraftPullRequest`「创建 Draft PR」
- **零命中摘录**：「Draft PR/createPullRequest/draftPR」0hit；envInfo 仅**读** PR 状态（aiChat.envInfo.pullRequest/commitPush L1）。
- **建议票面**：从会话头部一键创建 Draft PR（写动作）；与 envInfo 只读展示互补。

### 组 T9 · 选中文本作为附件（3 行）
- **竞品键+原文**：`selectionActions.ariaLabel`「选中文本操作」/`attachmentName`「选中的文本」/`attachmentLimitReached`「附件已达 20 个，请先移除一个再添加选中文本。」
- **零命中摘录**：「选中的文本/附件已达」0hit；我方附件上限 30（G-833），D22 仅引用 chips。
- **相邻票**：D164 只覆盖速记板两键，本组是其兄弟槽位（同一选区工具栏的"附件化"出口）。
- **建议票面**：选区工具栏补「作为附件添加」通道（附件名「选中的文本」+上限提示）；与 D164 速记板、D22 引用选中并列三出口。

> 另有 **5 行 FALSE**（loadingMore/group.artifact/emptyGroup.artifact/emptyGroup.memory/status.waiting-user）与 **9 行 workspaceTabs FALSE**（emptyTitle/launcherLabel/newSpec/showReview/openReview/openTerminalDescription/pluginView×3）已在表内给足我方键+值指针，不进 TRUE-GAP 分组。

---

## 三、UNDETERMINED（12 行）——缺什么、等谁拍板

| 键 | 缺什么 | 拍板点 |
| --- | --- | --- |
| workspaceTabs.label / typeLabel / instancesLabel / single / filesOrdinal / specOrdinal / terminalOrdinal（7 行） | 「任务工作面」多类型标签页**体系**（类型注册、序号命名、单例约束、设置页描述）整体 | 我方 web 是浏览器内 IDE：workPanel=浏览器嵌入页签+TagsView 文件页签+终端停靠，无桌面壳工作面概念。**疑似平台形态差异，需拍板**是否以页内多类型 Tab 对标或登记不做 |
| workspaceTabs.memberUnavailableTitle / agent（2 行） | 成员任务以工作面标签页打开+未选态选择器 | 我方代理任务面在位（aiToolsPanel tabs.agents/agenttasks/progress），仅呈现形态不同——需拍板 |
| headerActions.selectOpenWith / finder / windowsTerminal（3 行） | OS 级「打开方式」（访达/Windows 终端） | 浏览器内无法拉起 OS 应用；**疑似平台形态差异，需拍板**（或以"在外部浏览器打开/下载"替代） |

## 四、边界与勘误注

1. **前轮已裁、不在本切片**：`workspaceTabs.add/close`（FALSE：workPanel.newTab=新建标签页/closeTab=关闭标签页，web-zh:442/451 在位）；`selectionAnnotations.edit`（前轮裁假阳）。本表 89 行与其零交集。
2. **highlights 43 行与 slice-highlights.json 同键重复**；现台账查无 highlights 票号（D163=undo/D164=速记板/D165=分组/D166=链接预览卡）。若该族已由并行线立票，以其票号替换本报告 G 判定。
3. 本轮**零仓库文件改动**；临时脚本与中间产物均在 `.ihui-agent/tmp/d167-2/`（probe.mjs、grep-probe*.mjs、probe-values.json）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
