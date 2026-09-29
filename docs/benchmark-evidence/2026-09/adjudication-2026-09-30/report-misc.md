<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D167-2 · slice-misc 66 行只读裁定报告

- 审计面：HEAD `c503705f7d`（2026-09-29）。语料 = `git show HEAD:packages/i18n/messages/web/zh-CN.json`、`git show HEAD:packages/i18n/messages/shared/zh-CN.json` + `git grep … HEAD -- apps/web/src packages/shared/src`（补充证据：packages/ui-react、apps/desktop/src-tauri，均 HEAD 只读）。
- 判定口径：TRUE-GAP（零覆盖+探针证据）/ FALSE（我方键+值同槽位）/ UNDETERMINED（缺什么；平台独占疑似注明）/ TICKETED(票号)。
- 本轮未新立票号；已立票引用 D166。

## ① 66 行逐行裁定表

| key 末段 | 判定 | 证据指针 |
|---|---|---|
| bindIssue | TRUE-GAP | git grep 零命中：`bindIssue`/`绑定 Issue`/`unbindIssue`/`独立任务`；相邻不背书：@提及文件（`HEAD:apps/web/src/components/chat/message-input.tsx:412` useMentionFiles）、D25 @任务消息；我方无 Issue 实体 |
| searchIssues | TRUE-GAP | 同上一组；语言包仅 GitHub/Linear MCP "创建议题" activity 串（shared taskStatus.toolMcp*），无绑 Issue 搜索流 |
| unbindIssue | TRUE-GAP | 同上一组；"独立任务" 零命中 |
| noIssues | TRUE-GAP | 同上一组；web 包 "noIssues"=无问题（publishMonitor 族，相邻不背书） |
| noMatchingIssues | TRUE-GAP | 同上一组；零命中 |
| label（applicationMenu） | FALSE | 自绘应用菜单在位：`HEAD:apps/web/src/lib/menu-actions.ts`（dispatcher）+ a11y.menu="菜单"、common.openNavMenu="打开导航菜单"（CategoryShell.tsx:169 移动端菜单钮）；字面"应用菜单"零命中，同槽位自有文案 |
| title（feedback） | FALSE | web#15037 feedback.title=意见反馈；组件 `HEAD:apps/web/app/(main)/feedback/page.tsx` t('title')；member.feedback.title=意见反馈 |
| contentLabel | FALSE | web feedback.field_content=内容 + contentPlaceholder + contentRequired=请填写反馈内容（FeedbackForm.tsx content 域） |
| screenshotLabel | FALSE | web#15024 feedback.field_images=截图（FeedbackForm.tsx images 域 Label） |
| screenshotDescription | FALSE | 槽位在位值不同：feedback.imagesPlaceholder=粘贴或拖拽图片到此处（FeedbackForm.tsx:126）+ Upload sizeLimitHint=单文件不超过 {size}；我方 maxCount=5、默认 10MB（packages/ui-react Upload.tsx），无格式枚举文案 |
| screenshotAlt | TRUE-GAP | 无逐图 alt "反馈截图 {{index}}"；Upload 仅通用 removeItemAriaLabel=移除上传项（packages/ui-react/src/components/Upload.tsx DEFAULT_UPLOAD_LABELS） |
| removeScreenshot | FALSE | Upload removeItemAriaLabel=移除上传项 / removeUploadedAriaLabel=删除已上传文件（同上） |
| addImages | FALSE | feedback.imagesPlaceholder=粘贴或拖拽图片到此处（FeedbackForm.tsx:126 实测接线） |
| dropImages | FALSE | Upload placeholder 默认=点击或拖拽文件到此处上传 + 上行 imagesPlaceholder 兼拖拽语义 |
| screenshotLimit | FALSE | Upload maxCountReached=已达上限 {max} 个文件（maxCount=5）；语言包零覆盖、能力槽位在位（组件内默认文案） |
| screenshotTooLarge | FALSE | Upload sizeLimitHint=单文件不超过 {size} + oversizeFiles=以下文件超过 {size}: {files}，DEFAULT_MAX_SIZE=10MB |
| unsupportedImage | TRUE-GAP | Upload 默认文案无"不支持类型"串；accept='image/*'（ImageUpload.tsx）浏览器侧静默过滤，无提示文案 |
| emailPlaceholder | FALSE | web feedback.contactPlaceholder=选填，方便我们联系您；member.feedback.contactPlaceholder=便于我们与你联系 |
| sending | FALSE | feedback.submitting=提交中…（FeedbackForm.tsx isPending 分支） |
| requestIdSuffix | TRUE-GAP | page.tsx onSuccess 仅切回列表、无反馈编号回执；`requestId` 全语料零命中 |
| description（myWork） | TRUE-GAP | "集中处理只有你能作出的判断"式收件箱描述零覆盖；git grep 零命中 |
| decisions | UNDETERMINED | 相邻不背书：chatHistory.attentionWaiting=等待你处理（conversation-list.tsx:118，任务列表徽标非专属收件箱）；缺"需要我判断"专属视图与文案，需产品裁定 |
| assigned | TRUE-GAP | "分配给我"零命中；assignAgent=指派智能体（13660）属相邻机制 |
| notificationClose | FALSE | common.update.dismiss=关闭（QuitUpdateOverlay/UpdatePrompt 接线 useTranslations('common.update')） |
| preparingInstall | FALSE | common.update.preparing=正在准备更新... |
| updateLater | FALSE | common.update.restartLater=稍后重启 |
| stopAndUpdate | FALSE | common.update.updateNow=立即更新 / restartNow=立即重启 / autoRestartIn=即将自动重启... |
| newerVersionDownloading | FALSE | common.update.available=发现新版本 + downloading=下载中 / quitDownloading=正在下载更新... |
| revoked | TRUE-GAP | "这个版本已不再提供"撤回版本态零覆盖：不再提供/已撤回/下架 更新语境零命中 |
| installFailed | FALSE | common.update.error=更新失败 + errorDesc + autoRetrying=更新失败，自动重试中...（失败槽位自有文案） |
| important | TRUE-GAP | 无"需要了解"重要度分区；user.notifications.tab 仅 全部/评论/关注/订单/项目/系统 |
| viewActive | TRUE-GAP | 无归档视图与"返回动态"；零命中 |
| markAllRead | FALSE | web user.notifications.markAllRead=全部标记已读 / allRead=全部已读；shared user.notifications.markAllRead=全部已读 |
| markAllReadFailed | TRUE-GAP | 通知族无失败 toast 串；零命中 |
| hiding | TRUE-GAP | 无动态隐藏机制；零命中 |
| hideFailed | TRUE-GAP | 同上 |
| restoring | TRUE-GAP | 零命中（restoreFailed 命中均为 checkpoint/worktree 族：ai-side-panel-tools.tsx:441、worktree-card.tsx，相邻不背书） |
| restoreFailed | TRUE-GAP | 同上 |
| empty | FALSE | web user.notifications.noData=暂无消息；shared noData=暂无通知 |
| emptyDescription | TRUE-GAP | 无"评论、提及和订阅的变化会出现在这里"式空态说明串 |
| emptyArchivedDescription | TRUE-GAP | 无已隐藏/归档分区 |
| unavailable | TRUE-GAP | user.notifications 仅 loading/noData，无加载失败串 |
| renderingDiagram | FALSE | a11y.diagramRendering=渲染中…（MermaidDiagram.tsx t('diagramRendering')）+ mermaidRenderFailed/mermaidSkip* 降级串在位 |
| resetZoom | TRUE-GAP | MermaidDiagram 无缩放控件（SVG 横向滚动 overflow-x-auto）；重置缩放/zoom 零命中 |
| zoomPresets | TRUE-GAP | 同上 |
| zoomToFit | TRUE-GAP | 同上 |
| wrapOn | TRUE-GAP | 代码块工具栏仅 applyToFile/insertAtCursor/copy 三钮（markdown-stream.tsx）；无换行开关；"代码换行"语言包零命中 |
| wrapOff | TRUE-GAP | 同上 |
| copyImage | TRUE-GAP | html2canvas/toPng/dom-to-image/copyAsPng 零命中；shared imagePreview.copy=复制图片属图片预览控件（相邻不背书）；share-card-svg 属会话分享卡（相邻） |
| previewLoading | TICKETED(D166) | 与 D166 链接预览加载态同能力 |
| previewUnavailable | TICKETED(D166) | 与 D166 链接预览失败态同能力 |
| viewFileInSidebar | UNDETERMINED | 平台独占疑似：桌面壳文件动作；"在右侧栏查看"零命中（web/shared/desktop 均无） |
| viewFileInNewWindow | UNDETERMINED | 平台独占疑似；web 侧"新窗口"均为浏览器外链/媒体预览语义（tool-call-card、pdf-file-preview），非文件壳动作 |
| openFile | UNDETERMINED | 平台独占疑似；"默认应用打开"零命中 |
| openWithLoading | UNDETERMINED | 平台独占疑似；零命中 |
| openWithNoApps | UNDETERMINED | 平台独占疑似；零命中 |
| copyFileContent | UNDETERMINED | 平台独占疑似；"复制文件内容"零命中 |
| revealFile | UNDETERMINED | 平台独占疑似；"在文件管理器中显示"零命中（apps/desktop/src-tauri 无 opener/reveal 文件动作，auto_refresh.rs reveal 仅窗口点亮） |
| panel | FALSE | 终端面板机制在位：ide.topBar.terminal=终端 / aiChat.terminalDock.title=PowerShell 终端 / ai.pane.terminal.title=终端任务；字面"终端面板"缺 |
| tabs | FALSE | ide.terminalSessionList.title=终端会话 + ide.terminalTabBar 族（录制/分屏/SSH 全套） |
| emptyTitle | FALSE | ide.terminalSessionList.empty=暂无终端会话 |
| errorTitle | FALSE | ide.terminalPanel.loadFailed=终端加载失败: {message} + creatingTerminal/err* 校验族（失败槽位自有文案） |
| switchToDark | TRUE-GAP | 无终端深浅色切换；暗色终端/切换为暗色 零命中 |
| switchToLight | TRUE-GAP | 同上 |
| collapseSidebar | FALSE | 侧栏整栏折叠在位：GlobalShell "sidebar-collapsed 状态…下沉到 Sidebar 内部"、effectiveCollapsed 平板折叠态；SidebarHeader.tsx:210 展开钮 aria-label=t('expand')；a11y.collapse=收起/expand=展开 |
| expandSidebar | FALSE | 同上（SidebarHeader.tsx:210） |

计数：TRUE-GAP 29 · FALSE 27 · UNDETERMINED 8 · TICKETED 2 = 66 ✓

## ② TRUE-GAP 按能力分组（建议票面）

### G1 · 新对话 Issue/任务绑定流（5 行：bindIssue/searchIssues/unbindIssue/noIssues/noMatchingIssues）
- 竞品串：「绑定 Issue」「搜索 Issue 标识、标题或项目」「改为独立任务」「还没有可以绑定的 Issue」「没有匹配的 Issue」
- 零命中探针：`git grep -n -e "bindIssue" -e "绑定 Issue" -e "独立任务" HEAD -- apps/web/src packages/shared/src` → 0；语言包 Issue 仅 GitHub/Linear MCP activity 串。
- 票面一句话：新建对话支持绑定/搜索/解绑任务（Issue）并在空/无匹配时给文案——若产品裁定以既有 @任务消息（D25）/@提及文件替代，则改判部分 FALSE，需产品确认。

### G2 · 反馈表单收尾缺口（3 行：screenshotAlt/unsupportedImage/requestIdSuffix）
- 竞品串：「反馈截图 {{index}}」「仅支持 PNG、JPG、GIF 和 WebP 图片。」「反馈编号：{{requestId}}。」
- 零命中探针：`requestId` 全语料 0；Upload DEFAULT_UPLOAD_LABELS（packages/ui-react/src/components/Upload.tsx:90-105）无逐图 alt 与不支持类型串；feedback page.tsx onSuccess 无编号回执。
- 票面一句话：web 反馈表单补逐图 alt、不支持类型提示与提交成功反馈编号回执。

### G3 · 任务决策收件箱（2 行：myWork.description/myWork.assigned）
- 竞品串：「集中处理只有你能作出的判断；…不会出现在这里。」「分配给我」
- 零命中探针：git grep `myWork`/`分配给我` → 0；相邻 attentionWaiting（列表徽标）与 assignAgent（指派智能体）不背书。
- 票面一句话：评估"需要我判断/分配给我"任务收件箱视图（含描述文案）是否引入。

### G4 · 桌面更新撤回态（1 行：productUpdate.revoked）
- 竞品串：「这个版本已不再提供。」
- 零命中探针：common.update 全族在位（发现新版本/准备/下载/稍后重启/立即更新/失败重试），独缺"版本已撤回"态；"不再提供/已撤回"更新语境 0。
- 票面一句话：桌面更新流补"该版本已撤回/不再提供"状态与文案。

### G5 · 动态 feed 隐藏/恢复与分区（8 行：important/viewActive/markAllReadFailed/hiding/hideFailed/restoring/restoreFailed/emptyDescription/emptyArchivedDescription/unavailable 中除 FALSE 外 10 行里 8 行归此组——emptyDescription/unavailable 亦在此） 
- 竞品串：「需要了解」「返回动态」「未能把动态标为已读，请重试。」「正在隐藏…」「这条动态未隐藏，请重试。」「正在恢复…」「这条动态未恢复，请重试。」「你隐藏的动态会保留在这里，随时可以恢复。」
- 零命中探针：user.notifications 族（web#22648 / shared#949）仅 全部已读/标记已读/时间/空态；hide/restore 零命中（命中均为 checkpoint/worktree 族）。
- 票面一句话：通知/动态中心补 隐藏→已归档→恢复 流、重要度分区、失败 toast、空态说明与加载失败文案。

### G6 · Mermaid 缩放控件（3 行：resetZoom/zoomPresets/zoomToFit）
- 竞品串：「重置缩放」「缩放比例」「适应屏幕」
- 零命中探针：MermaidDiagram.tsx 渲染成功仅 overflow-x-auto 横向滚动，无 zoom；组件/语言包 zoom 零命中。
- 票面一句话：Mermaid 图补缩放（重置/档位/适应画布）控件及文案。

### G7 · 代码块换行开关（2 行：wrapOn/wrapOff）
- 竞品串：「开启代码换行」「关闭代码换行」
- 零命中探针：markdown-stream 代码块工具栏仅 应用到文件/插入光标处/复制；语言包"代码换行"0。
- 票面一句话：代码块工具栏补"自动换行"开关（含 aria 文案）。

### G8 · Markdown 图/表复制为图片（1 行：copyImage）
- 竞品串：「复制为图片」
- 零命中探针：html2canvas/toPng/dom-to-image/copyAsPng 零命中（share-card-svg 为会话分享卡，相邻）。
- 票面一句话：表格/图片块支持"复制为图片"。

### G9 · 终端深浅色切换（2 行：switchToDark/switchToLight）
- 竞品串：「切换为暗色终端」「切换为亮色终端」
- 零命中探针：ide.terminalPanel/terminalSessionList/terminalTabBar 三族键齐但无主题切换串；"暗色终端"0。
- 票面一句话：终端面板补深/浅色切换入口及文案。

### 平台独占疑似（UNDETERMINED，单独列，勿与 TRUE-GAP 并票）
- linkFileActions 7 条：viewFileInSidebar「在右侧栏查看」/viewFileInNewWindow「新窗口查看」/openFile「默认应用打开」/openWithLoading「正在加载应用...」/openWithNoApps「没有可用应用」/copyFileContent「复制文件内容」/revealFile「在文件管理器中显示」——零命中于 web/shared/桌面 Rust；属竞品桌面壳的本地文件动作。我方壳为 Tauri 包 web，未实现本地文件打开/显示/复制内容链路。票面（如立）：评估桌面壳本地文件动作菜单（打开方式/文件管理器中显示/复制文件内容）。
- myWork.decisions「需要我判断」：相邻 attentionWaiting 徽标在位但非专属收件箱，需产品裁定（见 G3）。
- 另：applicationMenu.label 判 FALSE 依据为自绘菜单自有文案（菜单/打开导航菜单），若要求字面级一致可降级为文案对齐项。

## 附：临时产物
- head-web-zh.json / head-shared-zh.json（HEAD 语言包 dump）、flat.js / flat-head-web-zh.txt / flat-head-shared-zh.txt（键路径平铺过滤）均在本目录，仅临时使用。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
