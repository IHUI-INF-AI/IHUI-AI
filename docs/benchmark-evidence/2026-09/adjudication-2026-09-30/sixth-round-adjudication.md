<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 第六轮裁定总表 · 对话流清单 451 条现读 MISS 的家族级三态裁定（D167-2）

- 日期：2026-09-29 ~ 2026-09-30 · 执行：主会话 + 6 个裁定子代理
- **裁定面：只读 HEAD**（`git show HEAD:packages/i18n/messages/web/zh-CN.json` 23,348 叶 + `shared/zh-CN.json` 1,995 叶 + `git grep … HEAD -- apps/web/src packages/shared/src`），全程禁用工作树语言包（有其他 agent 在飞改动）。
- 输入：`docs/benchmark-evidence/2026-09/miss-delta-2026-09-29.md` 导出的五节现读 MISS 全集 451 条，经 `miss-slices.mjs` 切六族（highlights 43 / composer 41 / chatsession 89 / nav 48 / misc 66 / errcodes 87，切片间有 43 行 highlights 重复，合并时去重）。
- 纪律：同义词先行 / 相邻机制不背书 / 三态不并桶（TRUE-GAP / FALSE / UNDETERMINED，TICKETED 另计）/ 逐行证据指针见本目录 `report-*.md` 六份。
- **勘误**：`slice-chatsession.json` 前 43 行与 `slice-highlights.json` 同键（切片 predicate 未排除 highlights）。两代理对 highlights 判定有分歧：chatsession 报按表面 0hit 判 G（38G/5F），highlights 专报深挖代码机制后判 26G/17F（`ai-side-panel.tsx:926` FAB 入口、`context-selector-popover.tsx` 引用网页、`task-monitor-sections.tsx` 注释自证对标等）。**合并口径：以 highlights 专报为准**。

## 一、六族裁定统计（合并后）

| 族 | 行数 | TRUE-GAP | FALSE | UNDETERMINED | TICKETED | 备注 |
|---|---|---|---|---|---|---|
| chatSession.highlights（专报口径） | 43 | **26** | 17 | 0 | 0 | 5 组 A~E |
| composer | 41 | **7** | 27 | 1 | 6(D164) | 1 组：引用预览编辑器 |
| chatSession 本体（去重后） | 46 | **24** | 10 | 12 | 0 | 划词批注/画中画/头部动作/Draft PR/选区附件 |
| nav / chats / sidebarView / workspace | 48 | **10** | 18 | 13 | 7(D161/D165) | 6 组 |
| misc 散族 | 66 | **29** | 27 | 8 | 2(D166) | 9 组 |
| errcodes 家族（附录 D 41 + 附录 E 46） | 87 | **19** | 60 | 8 | 0 | 机制在位（A/B/C 三层+门禁），19 缺口四域立 D200；见 report-errcodes.md |
| **合计** | **331** | **115** | 159 | 42 | 15 | |

翻案（FALSE 化）重点：web 反馈表单（`apps/web/app/(main)/feedback` 含截图上传全槽位）、common.update 更新流全族、语音族（输入/字幕/快捷键/委派）、置顶/批量动作、来源登记链接对话框（contextSelector 承接）、任务监控面板开关骨架（ai-panel.ts FAB/浮窗）、更新通知/终端面板/侧栏折叠——前轮表面 MISS 的多数为假阳。

## 二、TRUE-GAP 立票（D175~D200，26 票）

每票三件套：竞品键+显示串（一手证据）/ 零命中探针 / 等待项。**全部票面统一注明：文案落地等 G-816102 解阻**（判据：`git status --porcelain -- packages/i18n/messages/web/` 输出为空）。逐行证据指针见本目录 report-*.md。

### 来自 chatSession.highlights 专报（D175~D179）

**D175 · 任务监控「任务内容聚合」分组视图（7 行）** 【等 G-816102】
- 键+串：`highlights.empty`"还没有有价值的内容"、`emptyDescription`"整个任务中产生的文件、网页和来源会持续汇总在这里，帮助跟踪任务进展。"、`group.artifact`"产出"、`group.browser`"网页查阅"、`emptyGroup.artifact/browser/source`"暂无…数据 :)"
- 探针：`git grep -n "网页查阅" HEAD -- apps/web/src packages/shared/src` → 零命中；两包 25,044 叶展平值匹配零 EXACT；`task-monitor-sections.tsx:24-26` results 区为择优/世界线/回滚/用量/规格/知识库，非任务级文件/网页/来源汇总聚合
- 邻位不背书：canvas 内联渲染、D81 单工具卡来源展开

**D176 · 任务回顾与「移交到新任务」全流程（14 行）** 【等 G-816102；处置 D167② recap.expand】
- 键+串：`recap.title`"任务回顾"、`handoff.menuItem/title`"移交到新任务"、`previewDescription`"检查交接内容后，可以在文件位置查看，或直接创建一个新任务继续工作。"、`purposeLabel`"交接目的"、`waitingPreview`/`phase.generating`"模型正在生成交接内容…"/`phase.finalizing`/`phase.done`、`revealFile`"显示文件"、`createSession`"创建新任务"、`creating`/`createFailed`
- 探针：`git grep -n "任务回顾|回顾|交接" HEAD -- apps/web/src packages/shared/src` → 实现层零命中（仅 fold-policy.ts:9 注释对标 Codex auto recap、D94 脱敏交接单为错误诊断物非会话交接）
- 邻位不背书：D102 moveToWorktree=同会话换检出分支；D163=回退（方向相反）；worlds=同问题 fork

**D177 · 任务环境「本地服务」探测（3 行）** 【等 G-816102】
- 键+串：`environment.localServers`"本地服务"、`refreshLocalServers`"刷新本地服务"、`noLocalServers`"没有正在运行的本地服务"
- 探针：`git grep -n "本地服务" HEAD -- apps/web/src packages/shared/src` → 零命中；`aiChat.envInfo.*` 仅 Git/PR 信息条

**D178 · 分支/工作区切换的未提交改动保护（1 行）** 【等 G-816102】
- 键+串：`environment.preserveChangesAction`"保存改动并检出"
- 探针：`git grep -n "保存改动|未提交|stash" HEAD -- packages/shared/src/chat apps/web/src/components/ai` → 零命中；move-to-worktree-dialog.tsx 无脏工作区分支
- 邻位不背书：moveToWorktree=新目录检出，无当前工作区脏改动保护语义

**D179 · 会话/新对话 Issue 绑定流（6 行，合并 highlights E + misc G1）** 【等 G-816102；若产品裁定以 @任务消息(D25) 替代则部分改判 FALSE，需拍板】
- 键+串：`highlights.linkedIssue`"关联 Issue"（监控内展示+跳转）；misc `bindIssue`"绑定 Issue"、`searchIssues`"搜索 Issue 标识、标题或项目"、`unbindIssue`"改为独立任务"、`noIssues`"还没有可以绑定的 Issue"、`noMatchingIssues`"没有匹配的 Issue"
- 探针：`git grep -in "linkedIssue|绑定 Issue|独立任务" HEAD -- apps/web/src packages/shared/src` → 零命中；语言包 Issue 仅 GitHub/Linear MCP activity 串
- 邻位不背书：MCP 创建议题=工具动作；envInfo 拉取请求=PR 非 Issue

### 来自 chatSession 本体（D180~D184）

**D180 · 会话划词批注（8 行）** 【等 G-816102】
- 键+串：`selectionAnnotations.hoverHint`"悬停查看批注"、`selectedText`"{{index}}. 选中文字"、`noComment`、`commentPlaceholder`"添加可选评论…"、`commentAriaLabel`、`addComment`、`removeOne`"移除批注 {{index}}"、`removeAll`
- 探针：`git grep -n "划词|选中文字|移除批注" HEAD -- apps/web/src packages/shared/src` → 零命中
- 邻位不背书：`ai.pane.annotation`=回复级整条批注；D91=文档预览器内选区锚；D22=引用选中入 chips——三者对象与交互均不同

**D181 · 电脑使用画中画（5 行；实现形态需拍板）** 【等 G-816102 + 拍板】
- 键+串：`pictureInPicture.sectionLabel`"电脑使用画中画"、`title`"画中画"、`hideInSession`"在此会话中隐藏画中画"、`hideInAllSessions`、`updateFailed`
- 探针：「画中画」零命中；`aiChat.floatMode`=AI 面板页内浮窗，非 computer-use 会话小窗，邻位不背书
- 拍板点：竞品为桌面壳浮动小窗承载 computer-use 会话；我方浏览器内可用 popout / Document Picture-in-Picture API 对标——形态需拍板

**D182 · AI 面板头部 a11y 组名 + 工作面全屏 + 门槛态（4 行）** 【等 G-816102】
- 键+串：`headerActions.panelGroupButtons`"面板组按钮"、`workspaceUnavailable`"开始任务后可打开审阅工作面"、`enterWorkspaceFullscreen`"全屏显示工作面"、`exitWorkspaceFullscreen`"退出工作面全屏"
- 探针：ai-side-panel 头部按钮各自带 aria 但无 `role="group"` 组名（探针零命中）；「全屏显示」零命中

**D183 · 会话头部一键创建 Draft PR（1 行）** 【等 G-816102】
- 键+串：`headerActions.createDraftPullRequest`"创建 Draft PR"
- 探针：`git grep -in "Draft PR|createPullRequest|draftPR" HEAD -- apps/web/src packages/shared/src` → 零命中；envInfo 仅只读展示 PR 状态
- 互补关系：与 envInfo 只读展示互补，属写动作

**D184 · 选中文本作为附件（3 行）** 【等 G-816102】
- 键+串：`selectionActions.ariaLabel`"选中文本操作"、`attachmentName`"选中的文本"、`attachmentLimitReached`"附件已达 20 个，请先移除一个再添加选中文本。"
- 探针：零命中；我方附件上限 30（G-833），D22 仅引用 chips 通道
- 与 D164 速记板、D22 引用选中并列三出口（同选区工具栏）

### 来自 composer（D185）

**D185 · 能力引用模拟预览编辑器（7 行）** 【等 G-816102；处置 D167② referencePreview.send/select】
- 键+串：`composer.referencePreview.available/editor/placeholder/send/select/clear/source`——发送前对 @/引用对象生成模拟预览并可直接编辑正文、一键发送/清空、"原始输入正文"分区
- 探针：`git grep`「模拟预览|预览编辑」零命中；我方 UnifiedPasteReferencePreview 为被动有效性预览条，无编辑器（相邻不背书）
- 例外行：`authorization` 判 FALSE（unifiedSuggestion.authorizationNotice"引用标签不新增执行授权"在位，D68）

### 来自 nav 族（D186~D191）

**D186 · 会话归档二次确认与进行中态（4 行）** 【等 G-816102】
- 键+串：`nav.archiveChatTitle`"归档"{{title}}"？"、`archiveChatDoNotAskAgain`"不再提示"、`archivingChat`"正在归档..."、`archivingChats`"正在归档任务..."
- 探针：`git grep -nE "正在归档|不再提示|askAgain|doNotAsk" HEAD -- apps/web/src packages/shared/src` → 零命中；handleArchive 直 mutate 无确认（sidebar-chat-history.tsx:522-529，对照删除有 ConfirmDialog :1117-1127），批量 busy 无文案
- 附带口径差：删除确认串我方"不可恢复" vs 竞品"暂时保留可追溯"，在 D158-161 审批面复核

**D187 · 侧栏「标记为未读」（1 行）** 【等 G-816102】
- 键+串：`nav.markUnreadSuccess`"已标记为未读"
- 探针：`git grep -nE "标记为未读|markUnread|markAsUnread" HEAD -- apps/web/src packages/shared/src` → 零命中；未读徽标展示在位，仅缺手动标记入口

**D188 · 侧栏列表「运行中」状态徽标（1 行，低）** 【等 G-816102】
- 键+串：`nav.sessionRunning`"任务正在进行"
- 探针：conversation-attention 四态（idle/waiting/unread/waiting-unread）无 running（conversation-attention.test.tsx:51-94）；列表部件「进行中」探针零命中
- 落点：复用 shared `taskStatus.activityRunning`="执行中" 既有词汇

**D189 · 侧栏排序切换器（1 行，低）** 【等 G-816102】
- 键+串：`sidebarView.sorting.label`"排序方式"
- 探针：侧栏固定 sortPinnedFirst（sidebar-chat-history.tsx:56,387），排序 UI 零命中

**D190 · 侧栏无限滚动加载/重试文案（2 行，低）** 【等 G-816102】
- 键+串：`sidebarView.loadingMore`"正在加载…"、`retryLoadMore`"重试加载"
- 探针：翻页仅 Loader 图标（:1101-1105），下一页失败无重试入口（:1055-1056 仅首屏 loadFailed）

**D191 · 重命名对话框 helper 描述（1 行，低）** 【等 G-816102】
- 键+串：`nav.renameChatDescription`"保持简短且易于识别"
- 探针：「保持简短」全库零命中；renameDialog 仅 label/placeholder/title（web-zh:9053-9059）

### 来自 misc 散族（D192~D199）

**D192 · web 反馈表单收尾缺口（3 行）** 【等 G-816102】
- 键+串：`feedback.screenshotAlt`"反馈截图 {{index}}"、`unsupportedImage`"仅支持 PNG、JPG、GIF 和 WebP 图片。"、`requestIdSuffix`"反馈编号：{{requestId}}。"
- 探针：`requestId` 全语料零命中；Upload DEFAULT_UPLOAD_LABELS（packages/ui-react/src/components/Upload.tsx:90-105）无逐图 alt 与不支持类型串；feedback page.tsx onSuccess 无编号回执
- 基座在位：feedback 表单全槽位（标题/内容/截图 5 张/联系方式/提交态）FALSE 已证

**D193 · 任务决策收件箱（2 行；需产品拍板）** 【等 G-816102 + 拍板】
- 键+串：`myWork.description`"集中处理只有你能作出的判断；…不会出现在这里。"、`myWork.assigned`"分配给我"
- 探针：`git grep "myWork|分配给我" HEAD` → 零命中；相邻 attentionWaiting（列表徽标）与 assignAgent（指派智能体）不背书
- 关联：`myWork.decisions`"需要我判断"（UNDETERMINED）随本票一并拍板

**D194 · 桌面更新「版本撤回」态（1 行）** 【等 G-816102】
- 键+串：`productUpdate.revoked`"这个版本已不再提供。"
- 探针：common.update 全族在位（发现新版本/准备/下载/稍后重启/立即更新/失败自动重试），独缺撤回态；「不再提供/已撤回」更新语境零命中

**D195 · 通知/动态中心隐藏→归档→恢复流与分区（10 行）** 【等 G-816102】
- 键+串：`important`"需要了解"、`viewActive`"返回动态"、`markAllReadFailed`"未能把动态标为已读，请重试。"、`hiding`"正在隐藏…"、`hideFailed`"这条动态未隐藏，请重试。"、`restoring`"正在恢复…"、`restoreFailed`"这条动态未恢复，请重试。"、`emptyDescription`"评论、提及和订阅的变化会出现在这里。"、`emptyArchivedDescription`"你隐藏的动态会保留在这里，随时可以恢复。"、`unavailable`（加载失败）
- 探针：user.notifications 族（web#22648/shared#949）仅 全部已读/标记已读/时间/空态；hide/restore 零命中（命中均为 checkpoint/worktree 族，相邻不背书）
- 基座在位：markAllRead=全部标记已读、noData=暂无消息 判 FALSE

**D196 · Mermaid 图缩放控件（3 行）** 【等 G-816102】
- 键+串：`resetZoom`"重置缩放"、`zoomPresets`"缩放比例"、`zoomToFit`"适应屏幕"
- 探针：MermaidDiagram.tsx 渲染成功仅 overflow-x-auto 横向滚动；组件/语言包 zoom 零命中
- 基座在位：渲染中/渲染失败/降级串判 FALSE

**D197 · 代码块自动换行开关（2 行）** 【等 G-816102】
- 键+串：`wrapOn`"开启代码换行"、`wrapOff`"关闭代码换行"
- 探针：markdown-stream 代码块工具栏仅 应用到文件/插入光标处/复制 三钮；「代码换行」零命中

**D198 · Markdown 图/表「复制为图片」（1 行）** 【等 G-816102】
- 键+串：`copyImage`"复制为图片"
- 探针：html2canvas/toPng/dom-to-image/copyAsPng 零命中；shared imagePreview.copy=图片预览控件、share-card-svg=会话分享卡，相邻不背书

**D199 · 终端面板深浅色切换（2 行）** 【等 G-816102】
- 键+串：`switchToDark`"切换为暗色终端"、`switchToLight`"切换为亮色终端"
- 探针：ide.terminalPanel/terminalSessionList/terminalTabBar 三族键齐但无主题切换串；「暗色终端」零命中

## 三、UNDETERMINED 待拍板索引（不立票，34 行）

### 平台独占疑似（21 行，若拍板"不做"则闭案）
| 组 | 行 | 键 | 理由 |
|---|---|---|---|
| 桌面壳本地文件动作（misc） | 7 | `linkFileActions.viewFileInSidebar/viewFileInNewWindow/openFile/openWithLoading/openWithNoApps/copyFileContent/revealFile` | 竞品桌面壳本地文件菜单；我方 Tauri 壳无 opener/reveal 文件动作链路 |
| 桌面工作目录（nav） | 1 | `nav.workDirectories`"工作目录" | 桌面工作目录管理页；我方=会话绑定工作区（addWorkspace） |
| 本地数据库版本通告（nav） | 2 | `futureDatabaseCompatibilityNotice(+close)`"本地数据由更高版本创建…" | 依赖桌面本地 DB；我方 web 云端数据 |
| 多项目+主项目工作区（nav） | 3 | `workspace.primary/setPrimary/projectsRequired`"至少添加一个项目，并设置一个主项目。" | 多项目工作区模型，我方无对应物 |
| OS「打开方式」（chatsession） | 3 | `headerActions.selectOpenWith/systemApplications.finder/windowsTerminal` | 浏览器内无法拉起访达/Windows 终端；或以"外部打开/下载"替代 |
| 多 Runtime 概念（nav） | 1 | `chats.unknownRuntime`"未知 Runtime" | 竞品多运行时架构专属 |

### 形态/产品决策待拍板（13 行）
| 组 | 行 | 键 | 拍板点 |
|---|---|---|---|
| 「任务工作面」标签页体系（chatsession） | 7 | `workspaceTabs.label/typeLabel/instancesLabel/single/filesOrdinal/specOrdinal/terminalOrdinal` | 我方 web=workPanel 页签+TagsView+终端停靠，无统一工作面标签页体系——以页内多类型 Tab 对标或登记不做；另 `newEvidence/evidenceOrdinal` 2 行（T6 证据页）依附本体系，拍板"做"时一并立票 |
| 成员任务工作面（chatsession） | 2 | `workspaceTabs.memberUnavailableTitle/agent` | 代理任务面在位，仅呈现形态不同 |
| 内测保密通告条（nav） | 2 | `nav.environmentNotice(+close)` | 产品阶段决策 |
| 画中画实现形态 | 5 | D181 已立票注明 | popout / Document PiP API |
| 决策收件箱 | 3 | D193 已立票（description/assigned/decisions） | 是否引入专属收件箱视图 |
| 搜索中态（nav） | 1 | `conversationSearch.searching` | 我方侧栏本地即时过滤，无异步搜索；远端化时才需 |
| "新"角标语义（nav） | 1 | `chats.newObject` | 新对象 vs 未读 |
| 「讨论」入口（nav） | 1 | `nav.discussion` | 场景不明 |
| 批量归档确认（nav） | 1 | `archiveSelectedChatsConfirm` | 可逆批量归档是否需二次确认 |
| composer.convertToText | 1 | `composer.convertToText` | 语义未明 |

### 登记不做（1 行）
- `workspaceTabs.closeMenu.closeRight`"关闭右侧标签页"——2026-07-31 第十三轮减法有意删除（TagsView.tsx:291 注释：与 closeAll 语义重叠），恢复属翻案需用户拍板，默认维持删除。

## 四、TICKETED 归票映射（15 行）
- D164（速记板）：composer `quickNotePasteInvalidPayload/InvalidImage/TooManyImages/InvalidSize/Incomplete` 5 行 + chatsession `selectionActions.addToQuickNotes/addedToQuickNotes` 2 行 = 7 行
- D165（侧栏分组）：nav `grouping.label/activity` + `group.older` = 3 行（注意：D165 现口径=sidebarGroup 移动/置顶；若不含"分组方式切换器+更早桶"，本三行转 TRUE-GAP 补票——已在 D189 排序票面相邻注明，待 D165 实施时复核）
- D161（导航落点）：nav `myWork/assigned/needs/secondary` 4 行
- D166（链接预览卡）：misc `previewLoading/previewUnavailable` 2 行（与 D185 相邻不同槽位，互相引用防重）

## 五、D167② 七条误删处置登记（不翻勾 D167 本票）
L3 keyonly 误删的 7 条真差距处置去向：
1. `quickNotes.addToQuickNotes` → D164 已覆盖（票面含速记板选区动作）
2. `quickNotes.addedToQuickNotes` → D164 已覆盖
3. `quickNotes.addToQuickNotesWithComment` → D164 已覆盖（速记板评论子态）
4. `quickNotes.quickNoteAdded` → D164 已覆盖
5. `recap.expand` → **D176**（任务回顾族展开态，随 D176 文案面一并落）
6. `referencePreview.send` → **D185**（引用预览编辑器 send 键）
7. `referencePreview.select` → **D185**（引用预览编辑器 select 键）

## 六、errcodes 家族（87 条=附录 D 41 + 附录 E 46，实际构成与任务口径 25/62 有出入，按实裁定）

**机制级结论（HEAD 面）：「错误码→用户可读文案」机制在我方对话链路【在位】**——A 层 `packages/shared/src/utils/error-messages.ts`（14 码 i18n 键映射 + 中文映射 + STATUS_TO_ZH 十档 + 英文正则兜底）；B 层 `packages/shared/src/chat/error-catalog.ts` ERROR_CODE_CATALOG **110 业务码闭集** + web zh 包 `ai.pane.errorCatalog` 110 组 title+action 全有中文值 + 五语言 parity 门禁；C 层 `apps/api/src/server.ts:143-196` 统一 `{code,message,errorCode}` + 中文兜底；守门 `check-error-code-coverage.mjs` / `check-error-code-not-text-matching.mjs`。87 个 Qoder 码逐字 grep（HEAD 四端 src）零命中——闭集设计下逐条看**语义槽位**是否已有中文文案位，而非只看码名。

**裁定：TRUE-GAP 19 / FALSE 60 / UNDETERMINED 8**（6 条抽样 5 FALSE 1 分档注记，附录逐行 87 条全列）。逐行证据：本目录 `report-errcodes.md`。

**D200 · 错误码缺口清单票（19 条四域，与 D158-161 相邻补充不混同）** 【等 G-816102】
- 域 1 文件安全扫描（7）：`FILE_SCAN_PENDING/FAILED/TIMEOUT/UNSCANNABLE/BLOCKED` + `file_scan_failed`/`file_content_rejected`——探针 `安全检查|安全扫描|病毒` HEAD 四端 src=0
- 域 2 文件下载就绪/完整性/本地缓存（6）：`FILE_NOT_READY`+`file_not_ready`（探针「就绪」无下载态文案位）、`FILE_INTEGRITY_FAILED`（`完整性|校验失败`=0）、`FILE_DISK_SPACE`（「空间不足」仅管理面）、`FILE_STORAGE_INVALID`（桌面缓存域 0）、`CHAT_SESSION_HISTORY_MISSING`（会话历史缺失错误位 0）
- 域 3 配额与容量业务码（4）：`47902` 轮次已达上限（`轮次|回合+上限`=0，B 层 BUDGET_EXHAUSTED 是预算非轮次）、`121` 组织数据迁移（「已迁移」=0）、`speaking_banned`（「禁言」仅 admin 敏感词标签，无用户侧错误位）、`member_capacity_exceeded`（A 层仅 MEMBER_EXISTS 已存在≠容量满）
- 域 4 HTTP 413/422 专门档（2）：STATUS_TO_ZH 缺 413/422 档，C 层 bodyLimit 超限落「操作失败,请稍后重试」通用兜底失"过大"语义；413→context_limit、422→invalid_arguments 映射仅在未入库 `packages/types/src/failure-code.ts`（`??`，他人正在飞，不作 HEAD 覆盖证据）
- 落点：19 码同步登记 `ai.pane.errorCatalog` 闭集 + 五语言 + 守门脚本覆盖；60 条 FALSE 不入（语义槽位已在位，码名差异非文案差距）；8 条 UNDETERMINED（102/issue_execution_active/origin_not_allowed/organization_mismatch/project_member_removed/organization_unavailable/FILE_IDENTITY_CHANGED/AGENT_TOOL_RULE_CONFLICT）挂起待探。等 G-816102。

## 七、证据件清单（本目录）
- `sixth-round-adjudication.md`（本表）
- `report-highlights.md` / `report-composer.md` / `report-chatsession.md` / `report-nav.md` / `report-misc.md` / `report-errcodes.md`（六份逐行裁定）
- `out.head.10_引用.md` / `out.head.14_会话管理.md` / `out.head.附录_C.md` / `out.head.附录_D.md` / `out.head.附录_E.md`（五节现读对账导出，MISS 原始清单）
- `slice-*.json`（六族切片输入）、`miss-pending.json`（331 行待裁映射）、`miss-ticketed.json`（120 行已归票映射）
- 原始工作区：`.ihui-agent/tmp/d167-2/`（gitignore 内，HEAD dump 等大件可由 `git show` 重现，不入库）
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
