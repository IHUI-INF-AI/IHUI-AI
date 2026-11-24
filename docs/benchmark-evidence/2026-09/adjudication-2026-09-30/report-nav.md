<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D167-2 · 对话流清单 nav/chats/sidebarView/workspace 48 行只读裁定报告

- 裁定基线：HEAD = `c503705f7d292ff04309e322249c2cdfeca41768`（2026-09-29）
- 我方语料面（只读 HEAD）：`git show HEAD:packages/i18n/messages/web/zh-CN.json`（23,348 叶）、`git show HEAD:packages/i18n/messages/shared/zh-CN.json`（1,995 叶）、`git grep … HEAD -- apps/web/src packages/shared/src`（必要时加探 `apps/desktop/src-tauri/src`）
- 方法：同义词先行（值扫描全库 + 键路径扫描）→ 机制核对（apps/web/src/components/sidebar*）→ 三态裁定；探针零命中以 `exit 1` 记录
- 证据快照（临时）：`tmp/d167-2/web-zh.json`、`tmp/d167-2/shared-zh.json`（HEAD dump，行号经 11602/11638/9088 三点校验与 HEAD 一致）、`tmp/d167-2/all-hits.txt`（全库值扫描）

判定口径：TRUE-GAP＝零覆盖+探针证据；FALSE＝我方已有对应键+值（同义）；UNDETERMINED＝缺决策/缺上下文（平台独占疑似在此注明）；TICKETED(票号)＝已立票。

## ① 48 行逐行裁定表

| key 末段 | 判定 | 证据指针 |
|---|---|---|
| grouping.label（分组方式） | TICKETED(D165) | 我方侧栏分组为硬编码日期分组：sidebar-chat-history.tsx:134-151（today/thisWeek/thisMonth）、:1092-1099；无"分组方式"切换器。若 D165 口径未含侧栏分组切换器，需补 TRUE-GAP(低) |
| grouping.activity（按活动日期） | TICKETED(D165) | 同上；我方现行为即按 lastMessageAt（活动日期）分组（:136-151），仅缺切换器内选项 |
| chats.unknownRuntime（未知 Runtime） | UNDETERMINED | 缺：我方任务模型无多 Runtime 概念，"未知 Runtime"徽标无落点。全库值扫描零命中（all-hits.txt）；疑似竞品多运行时架构专属，需拍板 |
| chats.noMatchesTitle（没有匹配的任务对象） | FALSE | chatHistory.noResults="未找到匹配的任务"（web-zh:11627；sidebar-chat-history.tsx:1057-1064 搜索空态，含 D20/V3 #62 判据注释） |
| chats.noMessages（还没有消息） | FALSE（同义） | aiChat.noContent="暂无对话内容"（web-zh:9049）；chatHistory.empty="暂无任务记录"（11617） |
| chats.newObject（新） | UNDETERMINED | 缺：竞品"新"角标语义不明（新对象 vs 未读）。全库无值为"新"的串（all-hits.txt 219 叶扫描零命中）；我方未读/待处理徽标已覆盖部分语义（ConversationAttentionBadges 四态） |
| conversationSearch.searching（搜索中…） | UNDETERMINED | 缺：异步会话搜索场景。我方侧栏搜索为本地即时过滤（sidebar-chat-history.tsx:460-461、1089），无搜索中态；仅在我方搜索远端化时才需此文案。库内"搜索中..."均属他域（ide/searchPanel/knowledgeBase） |
| nav.myWork（需要我） | TICKETED(D161) | 前轮已判为 D161 导航级落点 |
| nav.assigned（分配给我） | TICKETED(D161) | 同上 |
| nav.needs（由我决定） | TICKETED(D161) | 同上 |
| nav.discussion（讨论） | UNDETERMINED | 缺：竞品"讨论"入口场景不明。探针 `git grep 讨论 HEAD -- apps/web/src/components packages/shared/src` 仅命中测试夹具与语音字幕"讨论纪要"视图（voice-subtitle-bar.tsx:27,63），无导航入口 |
| nav.extensions（扩展） | FALSE（同义） | 侧栏快捷区"插件市场"按钮（SidebarQuickActions.tsx:84；nav.pluginMarket="插件市场" web-zh:19015）；另有 nav.downloadExtension="浏览器插件"（Chrome/Edge/Firefox） |
| nav.secondary（辅助导航） | TICKETED(D161) | 辅助导航区容器 a11y 标签，随 D161 导航落点一并落。探针：`辅助导航` 于 apps/web/src+shared+i18n 全零（exit 1）；我方 <nav> 仅 mainNav（Sidebar.tsx:377,456,532）。若 D161 不含侧栏结构则转 TRUE-GAP(低) |
| nav.collapseSidebar（收起左侧栏） | FALSE | nav.collapse="收起"（web-zh:18808；SidebarHeader.tsx:301 aria-label）；a11y.collapse 同值（:495） |
| nav.expandSidebar（展开左侧栏） | FALSE | nav.expand="展开"（web-zh:18940；SidebarHeader.tsx:210 aria-label） |
| nav.workDirectories（工作目录） | UNDETERMINED | **疑似平台独占，需拍板**：Qoder 桌面工作目录管理页。我方 web 以"会话绑定工作区"部分等价（aiChat.addWorkspace="添加工作区" web-zh:8950、nav.workspace="工作空间"、workspacePanel.title="工作区" 10048 段）；`workDir/working_dir/工作目录` 于 apps/web/src+shared+desktop/src-tauri/src 探针零命中（仅测试注释） |
| nav.voiceChat（语音任务） | FALSE（同义，形态差异注明） | 语音能力在位：chat.voiceInputStart/Stop="语音输入/停止语音输入"（web-zh:96-98 行区 all-hits）、语音三快捷键（shortcutHelp.desc.ctrlAltV/B/H="开始停止录音/自动朗读/连续对话"）、语音字幕（ai.pane.voiceSubtitles）、语音委派任务（ai.pane.inputNotices.queue.blocked.sourceMismatch）、浮窗语音对话（floatingChat.openclaw.voiceDesc）。注：竞品为侧栏导航入口+语音任务列表；我方为会话内能力+媒体任务入口（mediaTasksPage） |
| nav.chatActions（任务 {{title}} 操作） | FALSE | aiChat.actions.menu="更多操作"（web-zh:8927；aria-label sidebar-chat-history.tsx:746）。可选增强：菜单 a11y 名带 {{title}} 上下文 |
| nav.sessionRunning（任务正在进行） | TRUE-GAP(低) | 侧栏列表状态徽标四态无 running：idle/waiting/unread/waiting-unread（conversation-attention.test.tsx:51-94；conversation-list 部件 `running/executing/进行中` 探针 exit 1）；shared taskStatus.activityRunning="执行中" 仅用于任务详情（shared-zh:57） |
| nav.sessionUnread（有未读更新） | FALSE | chatHistory.attentionUnread="有 {count} 条未读更新"（web-zh:11638；unread 徽标 sidebar-chat-history.tsx:646-656,737） |
| nav.pinChat（全局置顶） | FALSE | aiChat.actions.pin="置顶"（web-zh:8930；D20 pinMutation sidebar-chat-history.tsx:329-335、conversation-pin-action :783-791）。措辞差异：竞品"全局置顶" |
| nav.workspacePinError（未能更新会话置顶，请重试） | FALSE（同义） | aiChat.toast.pinFailed="置顶操作失败"（web-zh:9088；:335 onError） |
| nav.unpinChat（取消全局置顶） | FALSE | aiChat.actions.unpin="取消置顶"（web-zh:8931；:786） |
| nav.markUnreadSuccess（已标记为未读） | TRUE-GAP | "标记为未读"动作零覆盖：探针 `标记为未读\|标为未读\|markUnread\|markAsUnread` 于 apps/web/src+shared exit 1；两语言包零命中。我方仅展示未读徽标，无手动标未读 |
| nav.renameChatDescription（保持简短且易于识别） | TRUE-GAP(低) | 重命名对话框无描述行：aiChat.renameDialog 仅 label/placeholder/title（web-zh:9053-9059；Dialog :1129-1162）；`保持简短` 全库零命中 |
| nav.archivingChat（正在归档...） | TRUE-GAP(低) | 归档为直操作无 pending 文案：handleArchive 直 mutate（sidebar-chat-history.tsx:522-529）；busy 仅 Loader 图标（:757）；`正在归档` 两语言包零命中 |
| nav.archiveChatTitle（归档"{{title}}"？） | TRUE-GAP | 归档无二次确认弹窗：上同（:522-529）；对照删除有 ConfirmDialog（:1117-1127） |
| nav.archiveChatDoNotAskAgain（不再提示） | TRUE-GAP | 随上；探针 `不再提示\|不再询问\|askAgain\|doNotAsk` 于 apps/web/src+shared exit 1 |
| nav.selectChat（选择任务"{{title}}"） | FALSE | 行内复选 aria-label=`${t('select')} ${item.title}`="选择 {title}"（sidebar-chat-history.tsx:666；chatHistory.select="选择" web-zh:11629） |
| nav.cancelChatSelectionAction（取消多选） | FALSE（同义） | chatHistory.cancelSelection="取消选择"（web-zh:11614；ConversationBatchBar onCancel=selection.clear :1046） |
| nav.archiveSelectedChatsAction（归档所选任务） | FALSE（同义） | chatHistory.batchArchive="批量归档"（web-zh:11604；batchMutation 五动作 :404-430，含 archive） |
| nav.archiveSelectedChatsConfirm（归档所选任务） | UNDETERMINED | 缺：可逆的批量归档是否需二次确认的产品决策。我方仅批量删除有确认（confirmBatchDelete web-zh:11615）；确认串零命中 |
| nav.archivingChats（正在归档任务...） | TRUE-GAP(低) | 批量进行中仅 batchBusy 禁用，无文案（sidebar-chat-history.tsx:400,1042）；`正在归档` 零命中 |
| nav.deleteChatTitle（移除"{{title}}"？） | FALSE | ConfirmDialog title=deleteConversation="删除任务"（sidebar-chat-history.tsx:1117-1127；web-zh:8958） |
| nav.deleteChatDescription（它会离开当前列表…） | FALSE | confirmDeleteConversation="确认删除该任务？删除后无法恢复。"（web-zh:8954）；批量版 confirmBatchDelete（11615）。语义差异注明：竞品称"暂时保留可追溯"，我方称不可恢复——口径需在 D158-161 审批面复核 |
| nav.chatName（协作名称） | FALSE（同义） | aiChat.renameDialog.label="任务名称"（web-zh:9055） |
| nav.environmentNotice（内测开发版本…注意保密） | UNDETERMINED | 缺：产品阶段决策（我方是否需要内测保密通告条）。探针 `内测\|内部测试` 于 apps/web/src+shared+desktop/src-tauri/src exit 1 |
| nav.closeEnvironmentNotice | UNDETERMINED（随上） | 同上，随 environmentNotice 一并拍板 |
| nav.futureDatabaseCompatibilityNotice（本地数据由更高版本创建…） | UNDETERMINED | **疑似平台独占**：依赖桌面本地数据库版本概念。我方 web 数据在云端；Tauri 壳无本地 DB 探针命中（`更高版本\|数据库版本\|schema_version` exit 1） |
| nav.closeFutureDatabaseCompatibilityNotice | UNDETERMINED（随上） | 同上 |
| sorting.label（排序方式） | TRUE-GAP | 排序切换器零覆盖：侧栏固定 sortPinnedFirst（sidebar-chat-history.tsx:56,387）；sidebar 目录 `sortBy/sortOrder/排序` UI 探针零命中；`排序方式` 两语言包零命中 |
| loadingMore（正在加载…） | TRUE-GAP(低) | 侧栏翻页仅 Loader 图标无文案（sidebar-chat-history.tsx:1101-1105）；`正在加载…` 于侧栏语境零命中（库内命中均属 admin/models 等他域） |
| retryLoadMore（重试加载） | TRUE-GAP(低) | 下一页失败无重试入口（:1055-1056 仅首屏 queryError→loadFailed）；`重试加载` 零命中 |
| group.older（更早） | TICKETED(D165) | 我方三桶 today/thisWeek/thisMonth，早于本周全部并入"本月"（:134-151，else→thisMonth），"更早"桶缺失且致误标。若 D165 口径不含侧栏桶，需补 TRUE-GAP |
| workspace.primary（主要） | UNDETERMINED | **疑似平台独占**：竞品多项目+主项目工作区模型。我方为会话绑定单一工作区（aiChat addWorkspace/emptyWorkspace web-zh:8950,8963）；`设为主要\|主项目\|primary_workspace` 探针零命中 |
| workspace.setPrimary（设为主要） | UNDETERMINED（随上） | 同上 |
| workspace.projectsRequired（至少添加一个项目，并设置一个主项目。） | UNDETERMINED（随上） | 同上 |
| workspace.saving（正在保存...） | FALSE（同义） | 保存态文案在库多处："保存中..."（chatSettingsPage.saving web-zh:11650 等 9 处，git grep 保存中 命中 shared:977） |

## ② TRUE-GAP 能力分组（竞品键+原文 / 零命中探针 / 建议票面）

### G1 归档确认与进行中态（4 键，中危）
- 竞品键：`nav.archiveChatTitle`="归档"{{title}}"？"、`nav.archiveChatDoNotAskAgain`="不再提示"、`nav.archivingChat`="正在归档..."、`nav.archivingChats`="正在归档任务..."
- 零命中探针：`git grep -nE "正在归档|archiving|不再提示|不再询问|askAgain|doNotAsk|dontAsk" HEAD -- apps/web/src packages/shared/src` → exit 1；我方归档直 mutate 无确认（sidebar-chat-history.tsx:522-529），批量 busy 无文案（:400,1042）
- 建议票面：会话归档补二次确认弹窗（含"不再提示"记忆偏好）与单条/批量"正在归档…"进行中态文案。

### G2 标记为未读（1 键，中危）
- 竞品键：`nav.markUnreadSuccess`="已标记为未读"
- 零命中探针：`git grep -nE "标记为未读|标为未读|markUnread|markAsUnread|mark-as-unread" HEAD -- apps/web/src packages/shared/src` → exit 1；两语言包零命中
- 建议票面：侧栏会话菜单补"标记为未读"动作（未读态展示已在位，仅缺手动标记入口+成功 toast）。

### G3 侧栏列表"运行中"状态（1 键，低危）
- 竞品键：`nav.sessionRunning`="任务正在进行"
- 零命中探针：conversation-list/sidebar 列表 `running|executing|进行中` → exit 1；ConversationAttentionBadges 四态（idle/waiting/unread/waiting-unread）无 running（conversation-attention.test.tsx:51-94）
- 建议票面：侧栏会话项补"任务正在进行"运行中徽标（复用 taskStatus.activityRunning="执行中" 既有词汇）。

### G4 侧栏排序切换器（1 键，低危）
- 竞品键：`sidebarView.sorting.label`="排序方式"
- 零命中探针：sidebar 组件目录排序 UI 零命中（仅 sortPinnedFirst 硬编码：sidebar-chat-history.tsx:56,387）；`排序方式` 两语言包零命中
- 建议票面：侧栏任务列表补"排序方式"切换（置顶优先/按时间等），替换固定置顶优先。

### G5 翻页加载/重试文案（2 键，低危）
- 竞品键：`sidebarView.loadingMore`="正在加载…"、`sidebarView.retryLoadMore`="重试加载"
- 零命中探针：翻页仅 Loader（sidebar-chat-history.tsx:1101-1105），下一页失败无重试（:1055-1056 仅首屏 loadFailed）；两串零命中
- 建议票面：侧栏无限滚动补"正在加载…"文案与失败"重试加载"入口。

### G6 重命名 helper 描述（1 键，低危）
- 竞品键：`nav.renameChatDescription`="保持简短且易于识别"
- 零命中探针：`保持简短` 全库零命中；renameDialog 无 description（web-zh:9053-9059）
- 建议票面：重命名对话框补 helper 描述行（纯文案，随任一对话框改动顺带）。

### 平台独占疑似（单独列，均 UNDETERMINED 需拍板）
| 竞品键 | 原文 | 疑独占理由 |
|---|---|---|
| nav.workDirectories | 工作目录 | 桌面工作目录管理；我方 web=会话绑定工作区（addWorkspace/nav.workspace），Tauri 壳无 workdir 探针命中 |
| nav.futureDatabaseCompatibilityNotice（+close） | 本地数据由更高版本创建… | 依赖桌面本地数据库版本；我方 web 云端数据 |
| workspace.primary / setPrimary / projectsRequired | 主要 / 设为主要 / 至少添加一个项目，并设置一个主项目。 | 多项目+主项目工作区模型，我方无对应物 |

### 其余 UNDETERMINED（缺上下文/缺决策，非平台独占）
- chats.unknownRuntime（缺 Runtime 概念对应物）、chats.newObject（"新"角标语义）、nav.discussion（讨论入口场景）、conversationSearch.searching（我方为本地即时过滤）、nav.environmentNotice（+close，内测通告是否适用）、nav.archiveSelectedChatsConfirm（可逆操作是否需确认）。

## 复核口径备注
1. FALSE 中 nav.pinChat/unpinChat 竞品措辞为"全局置顶"，我方为"置顶"（会话级 pinned 字段+置顶优先排序），能力同位。
2. nav.deleteChatDescription 语义相反（竞品"暂时保留可追溯" vs 我方"删除后无法恢复"），建议在审批口径（D158-161）复核一次，不改本判。
3. TICKETED(D165) 三行（分组方式/按活动日期/更早）与 TICKETED(D161) 三行（需要我/分配给我/由我决定）+ nav.secondary 依赖票面口径，若口径不含侧栏落点则按备注转 TRUE-GAP。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
