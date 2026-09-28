<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 逐条对账导出：14 会话管理

生成：`node docs/benchmark-evidence/2026-09/reconcile.mjs qoder/chat-stream-inventory.md --section "14 会话管理" --out <本文件>`

四态口径：**L1 逐字 / L2 近义(Jaccard≥0.5) 不算差距**；L3=需人工核（键同名或子串同形，形似不等于等同）；MISS=候选缺失，须逐条定性后才可写进台账。控制测量在运行前已通过，故 MISS 不是匹配器空转的产物。

> 族级归属：480 行全部归到某个族，族级计数可用于归因。

> 不计 MISS 的 skip 明细（逐档报名）：非中文原文(不计 MISS，只报数) 2 条 / 枚举/样式值非文案(值层主筛) 2 条

| 节 | 族 | 竞品键 | 竞品原文 | 判定 | 我方对应 |
| --- | --- | --- | --- | --- | --- |
| 14 会话管理·分享·导 | applicationMenu.* | `applicationMenu.label` | 应用菜单 | MISS |  |
| 14 会话管理·分享·导 | applicationMenu.* | `applicationMenu.file` | 文件 | L1 | admin.resources.colFile |
| 14 会话管理·分享·导 | applicationMenu.* | `applicationMenu.edit` | 编辑 | L1 | knowledgeCard.edit |
| 14 会话管理·分享·导 | applicationMenu.* | `applicationMenu.view` | 视图 | L1 | commandPalette.groups.view |
| 14 会话管理·分享·导 | applicationMenu.* | `applicationMenu.help` | 帮助 | L1 | nav.help |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.pictureInPicture.sectionLabel` | 电脑使用画中画 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.pictureInPicture.computerUse` | 电脑使用 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.pictureInPicture.title` | 画中画 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.pictureInPicture.hide` | 隐藏 | L1 | admin.commentLogs.hidden |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.pictureInPicture.show` | 显示 | L1 | admin.menu.colVisible |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.pictureInPicture.hideInSession` | 在此会话中隐藏画中画 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.pictureInPicture.hideInAllSessions` | 在所有会话中隐藏画中画 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.pictureInPicture.updateFailed` | 无法更新画中画显示状态，请重试。 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.title` | 侧边任务 | L1 | ai.pane.sideTask.title |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.temporary` | 临时侧边任务 | L2 | ai.pane.sideTask.title (J=0.60) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.temporaryDescription` | 这是临时任务，关闭 Qoder 后将消失。 | L3 | 子串同形:cliImport.sourceQoder |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.inheritedContext` | 侧边任务在同一环境中与主任务并行运行 | L3 | 子串同形:ai.pane.sideTask.title |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.moreActions` | 侧边任务更多操作 | L3 | 子串同形:ai.pane.sideTask.title |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.groupMoreActions` | 侧边任务分组更多操作 | L3 | 子串同形:admin.scheduleLogs.colJobGroup |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.start` | 开始侧边任务 | L2 | ai.pane.sideTask.title (J=0.60) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.startFailed` | 无法开始侧边任务，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.close` | 关闭侧边任务 | L2 | ai.pane.sideTask.title (J=0.60) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.closeConfirmTitle` | 关闭侧边任务？ | L2 | ai.pane.sideTask.title (J=0.60) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.closeConfirmDescription` | 这个侧边任务将被删除，且无法恢复。你确定吗？ | L3 | 子串同形:ai.pane.worktree.state.restoreFailed |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.closeConfirmAction` | 关闭侧边任务 | L2 | ai.pane.sideTask.title (J=0.60) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.cleanup` | 清理侧边任务 | L2 | ai.pane.sideTask.title (J=0.60) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.cleanupExpired` | 清理全部已过期侧边任务 | L3 | 子串同形:admin.developer.statusExpired |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.fileChanges` | 文件变更（{{count}}） | L2 | ide.sourceControl.changes (J=0.67) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.from` | 来自 {{title}} | L3 | 键末段同名+词头同形:我方 messageDetail.from=「来自」 |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.fromCleaned` | 来自已清理的 {{title}} | L2 | ai.pane.sideTask.cleanedFrom (J=0.86) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.cleanupFailed` | 侧边任务清理失败，请重试。 | L3 | 子串同形:ai.pane.sideTask.title |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.cleanupConfirmTitle` | 清理侧边任务？ | L2 | ai.pane.sideTask.title (J=0.60) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.cleanupConfirmDescription` | 任务内容将永久删除，并从右侧工作区和任务监控移除。已经写入工作区的更改不会撤销；文件修改回执 | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.expiredTitle` | 侧边任务已过期 | L1 | ai.pane.sideTask.aria.expired |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.expiredDescription` | 这个临时侧边任务已不可用。请开始新的侧边任务以继续。 | L3 | 子串同形:ai.pane.sideTask.title |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.startNew` | 开始新的侧边任务 | L2 | chat.empty (J=0.50) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.unavailableTitle` | 侧边任务不可用 | L2 | ai.pane.sideTask.title (J=0.50) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.unavailableDescription` | 无法安全恢复这个侧边任务。你可以清理它并开始新的侧边任务。 | L3 | 子串同形:ai.pane.sideTask.title |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.status.running` | 执行中 | L1 | ai.pane.executing |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.status.waitingUser` | 等待处理 | L2 | admin.edu.finance.invoices.status.pending (J=0.67) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.status.ready` | 可继续 | L2 | agentRuntimePanel.resume (J=0.50) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.status.cold` | 可继续 | L2 | agentRuntimePanel.resume (J=0.50) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.status.expired` | 已过期 | L1 | admin.developer.statusExpired |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.status.unavailable` | 不可用 | L1 | eduScheduling.timeEntryDialog.unavailable |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.status.cleaning` | 清理中 | L1 | mediaTasksPage.clearing |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.sideChat.status.cleanupFailed` | 清理失败 | L3 | 子串同形:settings.cacheCleanFailed |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.openWith` | 用 {{name}} 打开工作区 | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.selectOpenWith` | 选择打开应用 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.openWithFailed` | 无法用 {{name}} 打开 | L3 | 子串同形:cloudChat.header.target |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.openWithFailedDescription` | 请确认应用已安装并稍后重试。 | L3 | 子串同形:admin.skillBatch.installed |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.openWithNotInstalled` | 没有找到 {{name}} 的安装位置，请重新安装后重试。 | L3 | 子串同形:cloudChat.header.target |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.openWithDetectionFailed` | 暂时无法确认 {{name}} 的安装位置，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.openWithLaunchFailed` | {{name}} 无法启动，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.openWithTargetInvalid` | 要打开的目标已不可用，请重新打开会话后重试。 | L3 | 子串同形:mediaTasksPage.jumpToChat |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.openWithRemoteUnsupported` | 远程工作区中的文件和目录无法用本机应用打开。 | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.systemApplications.finder` | 访达 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.systemApplications.fileExplorer` | 文件资源管理器 | L2 | admin.resources.title (J=0.50) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.systemApplications.files` | 文件 | L1 | admin.resources.colFile |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.systemApplications.terminal` | 终端 | L1 | ai.pane.overview.terminals |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.systemApplications.windowsTerminal` | Windows 终端 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.openWorkspace` | 打开侧边栏 | L2 | settings.sidebar (J=0.50) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.closeWorkspace` | 隐藏侧边栏 | L2 | settings.sidebar (J=0.50) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.panelGroupButtons` | 面板组按钮 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.workspaceUnavailable` | 开始任务后可打开审阅工作面 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.enterWorkspaceFullscreen` | 全屏显示工作面 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.exitWorkspaceFullscreen` | 退出工作面全屏 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.openTerminal` | 打开终端面板 | L2 | aiChat.openTerminal (J=0.60) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.closeTerminal` | 关闭终端面板 | L2 | ide.terminalSessionList.closeTerminalAria (J=0.60) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.terminalUnavailable` | 开始任务后可打开终端面板 | L3 | 子串同形:aiChat.openTerminal |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.createPullRequest` | Create PR | skip | 非中文原文(不计 MISS，只报数) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.createDraftPullRequest` | 创建 Draft PR | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.headerActions.createPullRequestManually` | 手动创建 PR | L2 | dispatchDialog.manualCreate (J=0.50) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.label` | 任务工作面 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.typeLabel` | 工作面与文件标签页 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.instancesLabel` | 当前类型标签页 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.add` | 添加标签页 | L3 | 键末段同名+词头同形:我方 admin.eduClassMembers.add=「添加」 |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.close` | 关闭 {{label}} 标签页 | L3 | 键末段同名+词头同形:我方 a11y.close=「关闭」 |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.closeMenu.close` | 关闭标签页 | L1 | workPanel.closeTab |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.closeMenu.closeOthers` | 关闭其他标签页 | L2 | ide.editorTabBar.closeOthers (J=0.50) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.closeMenu.closeRight` | 关闭右侧标签页 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.closeMenu.closeAll` | 关闭全部标签页 | L2 | common.closeAll (J=0.50) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.emptyTitle` | 暂无打开的工作面 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.emptyDescription` | 工作区文件、浏览器、审阅与其他任务工作面会以标签页保留在这里。 | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.memberUnavailableTitle` | 选择成员任务 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.memberUnavailableDescription` | 成员任务暂时不可用，请从团队活动中重新打开。 | L3 | 子串同形:eduScheduling.timeEntryDialog.unavailable |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.launcherLabel` | 打开工作面 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.newCode` | 打开工作区文件 | L2 | ide.searchPanel.openWorkspaceHint (J=0.50) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.newCodeDescription` | 浏览和编辑项目文件 | L3 | 子串同形:admin.projects.editTitle |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.newSideChat` | 打开侧边任务 | L2 | ai.pane.sideTask.title (J=0.60) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.newBrowser` | 打开内置浏览器 | L2 | commandPalette.commands.browser.label (J=0.67) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.newBrowserDescription` | 打开内置浏览器 | L2 | commandPalette.commands.browser.label (J=0.67) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.newFiles` | 打开文件工作面 | L2 | ide.editorEmpty.scOpenFile (J=0.50) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.newFilesDescription` | 查看 Agent 生成的文件 | L3 | 子串同形:agentCanvas.typeAgent |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.newSpec` | 打开计划 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.newEvidence` | 新建证据 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.showReview` | 打开审阅 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.openReview` | 打开审阅 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.openReviewDescription` | 检查本次文件变更 | L3 | 子串同形:ai.pane.changes.title |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.openTerminal` | 打开终端 | L1 | aiChat.openTerminal |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.openTerminalDescription` | 在当前目录运行命令 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.opened` | 已打开 | L2 | floatingChat.openclaw.browserNavigateSuccess (J=0.50) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.single` | 单例 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.newBrowserTitle` | 新标签页 | L1 | workPanel.untitledTab |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.codeOrdinal` | 工作区文件 {{ordinal}} | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.browserOrdinal` | 新标签页 | L1 | workPanel.untitledTab |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.filesOrdinal` | 文件 {{ordinal}} | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.specOrdinal` | 计划 {{ordinal}} | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.terminalOrdinal` | 终端 {{ordinal}} | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.evidenceOrdinal` | 证据 {{ordinal}} | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.code` | 工作区文件 | L2 | agent.fieldWorkspace (J=0.50) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.files` | 文件资源管理器 | L2 | admin.resources.title (J=0.50) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.browser` | 浏览器 | L1 | commandPalette.commands.browser.keywords.0 |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.changes` | 审阅 | L2 | ide.diffReview.markedAsViewed (J=0.50) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.spec` | 计划 | L1 | agent.tabPlan |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.terminal` | 终端 | L1 | ai.pane.overview.terminals |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.evidence` | 证据 | L1 | 源码字面量 |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.agent` | 成员任务 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.sidechat` | 侧边任务 | L1 | ai.pane.sideTask.title |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.sideChatOrdinal` | 新侧边任务 | L2 | ai.pane.sideTask.title (J=0.75) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.plugin` | 插件视图 | L3 | 键末段同名+词头同形:我方 ai.pane.hookSummary.source.plugin=「插件」 |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginLoading` | 正在加载插件视图 | L2 | viewFailure.reloadView (J=0.56) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginUnavailableTitle` | 插件视图不可用 | L3 | 子串同形:eduScheduling.timeEntryDialog.unavailable |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginUnavailableDescription` | 未找到插件视图资源。请检查插件是否已启用或重新安装插件。 | L3 | 子串同形:admin.integrations.enabled |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginViewLoadFailedDescription` | 插件视图资源加载失败。重新加载插件视图后再试。 | L3 | 子串同形:admin.edu.finance.statistics.loadFailed |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginViewRuntimeFailedDescription` | 插件视图运行时发生异常。重新加载插件视图后再试。 | L3 | 子串同形:aiToolsPanel.tabs.runtime |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginViewInitializationMissingDescription` | 插件没有注册视图启动入口，无法完成初始化。更新或重新安装插件后再试。 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginViewInitializationInvalidDescription` | 插件注册的视图启动入口无效，无法完成初始化。更新或重新安装插件后再试。 | L3 | 子串同形:viewFailure.entrypointInvalid.title |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginViewModuleUnavailableDescription` | 插件依赖的前端模块未由当前 Qoder 提供，无法启动视图。更新插件或 Qoder 后再试。 | L3 | 子串同形:cliImport.sourceQoder |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginViewResourceTooLargeDescription` | 插件视图资源超过允许大小，无法加载。更新或重新安装插件后再试。 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginViewEnvironmentUnavailableDescription` | 插件视图运行环境初始化失败。重新加载插件视图；若问题持续存在，更新 Qoder 后再试。 | L3 | 子串同形:ai.pane.worktree.state.initFailed |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginViewPluginUnavailableDescription` | 插件或对应视图资源不存在或已停用。检查插件是否已启用，或重新安装插件后再试。 | L3 | 子串同形:admin.integrations.disabled |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginViewFileResourceUnavailableDescription` | 当前文件资源缺失或无效，插件视图无法打开。重新打开文件或重新加载插件视图后再试。 | L3 | 子串同形:ide.editorEmpty.scOpenFile |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginViewBackendTimeoutDescription` | 插件后端响应超时，视图初始化未完成。重新加载插件视图后再试。 | L3 | 子串同形:points.tasks.notCompleted |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginViewBackendUnavailableDescription` | 插件后端启动失败或已退出，视图初始化未完成。重新加载插件视图；若问题持续存在，更新或重新安装 | L3 | 子串同形:ide.terminalSessionList.statusExited |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginViewNodeServiceMissingDescription` | 插件没有提供此视图所需的后端能力。更新或重新安装插件后再试。 | MISS |  |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginViewSimulatedCrashDescription` | 插件视图触发了崩溃测试。重新加载插件视图后再试。 | L3 | 子串同形:viewFailure.reloadView |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginViewErrorCode` | 错误码：{{errorCode}} | L2 | viewFailure.errorCodeLabel (J=0.87) |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.pluginReload` | 重新加载插件视图 | L1 | viewFailure.reloadView |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.waiting` | 待处理 | L1 | admin.edu.finance.invoices.status.pending |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.running` | 执行中 | L1 | ai.pane.executing |
| 14 会话管理·分享·导 | chatSession.* | `chatSession.workspaceTabs.idle` | 可查看 | L2 | knowledgeCard.view (J=0.50) |
| 14 会话管理·分享·导 | chats.* | `chats.title` | 任务 | L1 | ai.swarmMonitor.task |
| 14 会话管理·分享·导 | chats.* | `chats.objectCount` | {{count}} 个对象 | L2 | admin.permissions.count (J=0.64) |
| 14 会话管理·分享·导 | chats.* | `chats.search` | 搜索任务对象 | L2 | schedule.searchTask (J=0.60) |
| 14 会话管理·分享·导 | chats.* | `chats.searchPlaceholder` | 搜索 Agent 或 Runtime | L2 | admin.agentRule.searchAgentId (J=0.50) |
| 14 会话管理·分享·导 | chats.* | `chats.unknownRuntime` | 未知 Runtime | MISS |  |
| 14 会话管理·分享·导 | chats.* | `chats.noMatchesTitle` | 没有匹配的任务对象 | MISS |  |
| 14 会话管理·分享·导 | chats.* | `chats.noMatchesDescription` | 换个关键词，或到设置里启用更多 Agent。 | L3 | 子串同形:admin.circlesDynamics.keywordLabel |
| 14 会话管理·分享·导 | chats.* | `chats.emptyTitle` | 还没有可发起任务的 Agent | L3 | 子串同形:agentCanvas.typeAgent |
| 14 会话管理·分享·导 | chats.* | `chats.emptyDescription` | 从 Runtime 创建或启用 Agent 后，就可以在这里直接发起任务。 | L3 | 子串同形:agentCanvas.typeAgent |
| 14 会话管理·分享·导 | chats.* | `chats.noMessages` | 还没有消息 | MISS |  |
| 14 会话管理·分享·导 | chats.* | `chats.newObject` | 新 | MISS |  |
| 14 会话管理·分享·导 | chats.* | `chats.startAgentTitle` | 开始 {{name}} 的任务 | L3 | 子串同形:cloudChat.header.target |
| 14 会话管理·分享·导 | chats.* | `chats.startAgentDescription` | 发送第一条消息后，会创建一个独立任务并保留上下文。 | L3 | 子串同形:ai.pane.overview.context |
| 14 会话管理·分享·导 | chats.* | `chats.sendMessageAria` | 给 {{name}} 发送消息 | L3 | 子串同形:cloudChat.header.target |
| 14 会话管理·分享·导 | chats.* | `chats.composerPlaceholder` | 给 {{name}} 发送消息... | L3 | 子串同形:cloudChat.header.target |
| 14 会话管理·分享·导 | conversationSearch.* | `conversationSearch.inputLabel` | 搜索任务 | L1 | schedule.searchTask |
| 14 会话管理·分享·导 | conversationSearch.* | `conversationSearch.placeholder` | 搜索任务 | L1 | schedule.searchTask |
| 14 会话管理·分享·导 | conversationSearch.* | `conversationSearch.searching` | 搜索中… | MISS |  |
| 14 会话管理·分享·导 | conversationSearch.* | `conversationSearch.failed` | 搜索失败 | L2 | chat.mentionEngine.loadFailed (J=0.50) |
| 14 会话管理·分享·导 | conversationSearch.* | `conversationSearch.empty` | 无结果 | L2 | aiGeneration.noResult (J=0.67) |
| 14 会话管理·分享·导 | conversationSearch.* | `conversationSearch.previous` | 上一个匹配 | L1 | ide.terminalPanel.prevMatchAria |
| 14 会话管理·分享·导 | conversationSearch.* | `conversationSearch.previousLabel` | 上一个搜索结果 | L2 | knowledgeCard.searchResults (J=0.50) |
| 14 会话管理·分享·导 | conversationSearch.* | `conversationSearch.next` | 下一个匹配 | L1 | ide.terminalPanel.nextMatchAria |
| 14 会话管理·分享·导 | conversationSearch.* | `conversationSearch.nextLabel` | 下一个搜索结果 | L2 | knowledgeCard.searchResults (J=0.50) |
| 14 会话管理·分享·导 | conversationSearch.* | `conversationSearch.close` | 关闭搜索 | L1 | chat.searchClose |
| 14 会话管理·分享·导 | conversationSearch.* | `conversationSearch.closeLabel` | 关闭搜索 | L1 | chat.searchClose |
| 14 会话管理·分享·导 | feedback.* | `feedback.open` | 问题反馈 | L1 | member.feedback.typeBug |
| 14 会话管理·分享·导 | feedback.* | `feedback.title` | 有什么想反馈的 | MISS |  |
| 14 会话管理·分享·导 | feedback.* | `feedback.description` | 告诉我们你遇到的问题或建议，这些信息将用于改进 Qoder。 | L3 | 子串同形:cliImport.sourceQoder |
| 14 会话管理·分享·导 | feedback.* | `feedback.contentLabel` | 问题或建议（必填） | MISS |  |
| 14 会话管理·分享·导 | feedback.* | `feedback.contentPlaceholder` | 描述你看到了什么、期望发生什么，以及可以稳定复现的操作步骤 | L3 | 子串同形:llmSettings.v2.byok.stepsTitle |
| 14 会话管理·分享·导 | feedback.* | `feedback.diagnosticsNotice` | 发送时会附带当前运行日志和你选择的截图，以帮助定位问题。 | L3 | 子串同形:agentCanvas.logsTitle |
| 14 会话管理·分享·导 | feedback.* | `feedback.characterCount` | {{current}} / {{max}} | skip | 非中文原文(不计 MISS，只报数) |
| 14 会话管理·分享·导 | feedback.* | `feedback.screenshotLabel` | 屏幕截图 | MISS |  |
| 14 会话管理·分享·导 | feedback.* | `feedback.screenshotDescription` | 可添加、拖入或粘贴 PNG、JPG、GIF 或 WebP，最多 3 张，单张不超过 10 M | MISS |  |
| 14 会话管理·分享·导 | feedback.* | `feedback.screenshotAlt` | 反馈截图 {{index}} | MISS |  |
| 14 会话管理·分享·导 | feedback.* | `feedback.screenshotName` | 反馈图片 {{index}} | L2 | answerArea.image.alt (J=0.67) |
| 14 会话管理·分享·导 | feedback.* | `feedback.previewScreenshot` | 预览反馈图片 {{index}} | L2 | answerArea.image.previewAlt (J=0.60) |
| 14 会话管理·分享·导 | feedback.* | `feedback.removeScreenshot` | 移除第 {{index}} 张截图 | MISS |  |
| 14 会话管理·分享·导 | feedback.* | `feedback.addImages` | 添加或粘贴截图 | MISS |  |
| 14 会话管理·分享·导 | feedback.* | `feedback.dropImages` | 将图片放到这里 | MISS |  |
| 14 会话管理·分享·导 | feedback.* | `feedback.screenshotLimit` | 最多只能添加 3 张截图。 | MISS |  |
| 14 会话管理·分享·导 | feedback.* | `feedback.screenshotTooLarge` | 截图超过 10 MB，未添加。 | MISS |  |
| 14 会话管理·分享·导 | feedback.* | `feedback.unsupportedImage` | 仅支持 PNG、JPG、GIF 和 WebP 图片。 | MISS |  |
| 14 会话管理·分享·导 | feedback.* | `feedback.imageReadFailed` | 图片未能读取，请重新选择。 | L3 | 子串同形:eduProcurement.ai.reselect |
| 14 会话管理·分享·导 | feedback.* | `feedback.emailLabel` | 联系邮箱（可选） | L2 | about.contactEmail (J=0.60) |
| 14 会话管理·分享·导 | feedback.* | `feedback.emailPlaceholder` | 便于我们联系你进一步了解问题 | MISS |  |
| 14 会话管理·分享·导 | feedback.* | `feedback.emailInvalid` | 请输入有效的邮箱地址。 | L2 | admin.ipReputation.invalidIp (J=0.50) |
| 14 会话管理·分享·导 | feedback.* | `feedback.send` | 发送反馈 | L3 | 键末段同名+词头同形:我方 a11y.send=「发送」 |
| 14 会话管理·分享·导 | feedback.* | `feedback.sending` | 正在发送反馈… | MISS |  |
| 14 会话管理·分享·导 | feedback.* | `feedback.sent` | 反馈已发送，编号：{{requestId}} | L3 | 子串同形:admin.notificationLogs.sent |
| 14 会话管理·分享·导 | feedback.* | `feedback.sentAndCopied` | 反馈已发送，编号：{{requestId}}，已自动复制到剪切板。 | L3 | 子串同形:admin.notificationLogs.sent |
| 14 会话管理·分享·导 | feedback.* | `feedback.requestIdSuffix` | 反馈编号：{{requestId}}。 | MISS |  |
| 14 会话管理·分享·导 | feedback.* | `feedback.errors.validation` | 反馈内容或附件不符合要求，请修改后重试。 | L3 | 子串同形:admin.edu.course.audit.dialog.after |
| 14 会话管理·分享·导 | feedback.* | `feedback.errors.network` | 反馈未能发送，请检查网络后重试。 | L3 | 子串同形:ai.pane.errorCatalog.DOWNLOAD_FAILED.action |
| 14 会话管理·分享·导 | feedback.* | `feedback.errors.server` | 反馈服务暂时无法处理请求，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 14 会话管理·分享·导 | feedback.* | `feedback.errors.unsupported` | 当前宿主尚不支持发送问题反馈。 | L3 | 子串同形:ecosystem.capUnsupported |
| 14 会话管理·分享·导 | feedback.* | `feedback.errors.unknown` | 反馈未能发送，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 14 会话管理·分享·导 | myWork.* | `myWork.title` | Attention | skip | 枚举/样式值非文案(值层主筛) |
| 14 会话管理·分享·导 | myWork.* | `myWork.description` | 集中处理只有你能作出的判断；执行过程、普通更新和可自动恢复的问题不会出现在这里。 | MISS |  |
| 14 会话管理·分享·导 | myWork.* | `myWork.decisions` | 需要我判断 | MISS |  |
| 14 会话管理·分享·导 | myWork.* | `myWork.assigned` | 分配给我 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.newChat` | 新的任务 | L2 | chat.empty (J=0.60) |
| 14 会话管理·分享·导 | nav.* | `nav.chats` | 任务 | L1 | ai.swarmMonitor.task |
| 14 会话管理·分享·导 | nav.* | `nav.myWork` | 需要我 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.assigned` | 分配给我 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.needs` | 由我决定 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.updates` | 动态 | L1 | bookmark.type.post |
| 14 会话管理·分享·导 | nav.* | `nav.members` | 成员 | L1 | search.quickSuggestions.4 |
| 14 会话管理·分享·导 | nav.* | `nav.projects` | 项目 | L1 | ai.pane.hookSummary.source.project |
| 14 会话管理·分享·导 | nav.* | `nav.discussion` | 讨论 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.betaTag` | Beta | skip | 枚举/样式值非文案(值层主筛) |
| 14 会话管理·分享·导 | nav.* | `nav.search` | 搜索 | L1 | knowledgeCard.searchLabel |
| 14 会话管理·分享·导 | nav.* | `nav.automation` | 自动化 | L1 | floatingChat.openclaw.tabAutomation |
| 14 会话管理·分享·导 | nav.* | `nav.extensions` | 扩展 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.settings` | 设置 | L1 | commandPalette.groups.settings |
| 14 会话管理·分享·导 | nav.* | `nav.modeSwitcher` | 工作模式切换 | L2 | chat.permission.shortcutsSectionSwitch (J=0.60) |
| 14 会话管理·分享·导 | nav.* | `nav.modeCoding` | 编程 | L1 | aiSkillsPage.categoryCode |
| 14 会话管理·分享·导 | nav.* | `nav.modeGeneral` | 通用 | L1 | ai.subAgentFeed.lane.general |
| 14 会话管理·分享·导 | nav.* | `nav.primary` | 主导航 | L1 | nav.mainNav |
| 14 会话管理·分享·导 | nav.* | `nav.secondary` | 辅助导航 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.collapseSidebar` | 收起左侧栏 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.expandSidebar` | 展开左侧栏 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.goBack` | 后退 | L1 | workPanel.back |
| 14 会话管理·分享·导 | nav.* | `nav.goForward` | 前进 | L1 | workPanel.forward |
| 14 会话管理·分享·导 | nav.* | `nav.workDirectories` | 工作目录 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.workspaces` | 工作区 | L1 | agent.fieldWorkspace |
| 14 会话管理·分享·导 | nav.* | `nav.workspacesDescription` | 工作区就是 Agent 动手的地方：它会在这里看文件、改文件、跑命令，也会读取这里的 Git | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | nav.* | `nav.pinnedChats` | 置顶 | L1 | admin.announcements.colPinned |
| 14 会话管理·分享·导 | nav.* | `nav.recentChats` | 最近任务 | L1 | swarmTopology.recentTasks |
| 14 会话管理·分享·导 | nav.* | `nav.noWorkspaceChats` | 最近任务 | L1 | swarmTopology.recentTasks |
| 14 会话管理·分享·导 | nav.* | `nav.unknownAgent` | 未知 Agent | L2 | agentCanvas.typeAgent (J=0.67) |
| 14 会话管理·分享·导 | nav.* | `nav.chatFromAgent` | 任务“{{title}}”，Agent：{{agent}} | L3 | 子串同形:agentCanvas.typeAgent |
| 14 会话管理·分享·导 | nav.* | `nav.voiceChat` | 语音任务 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.voiceChatFromAgent` | 语音任务“{{title}}”，Agent：{{agent}} | L3 | 子串同形:agentCanvas.typeAgent |
| 14 会话管理·分享·导 | nav.* | `nav.worktreeChat` | Worktree 任务 | L2 | ai.pane.worktree.title (J=0.78) |
| 14 会话管理·分享·导 | nav.* | `nav.newChatInWorkDirectory` | 在 {{name}} 中新建任务 | L3 | 子串同形:agent.kanban.newTask |
| 14 会话管理·分享·导 | nav.* | `nav.collapseWorkDirectory` | 折叠工作目录 {{name}} | L3 | 子串同形:cloudChat.header.target |
| 14 会话管理·分享·导 | nav.* | `nav.expandWorkDirectory` | 展开工作目录 {{name}} | L3 | 子串同形:cloudChat.header.target |
| 14 会话管理·分享·导 | nav.* | `nav.pinWorkDirectory` | 置顶工作目录 {{name}} | L3 | 子串同形:cloudChat.header.target |
| 14 会话管理·分享·导 | nav.* | `nav.unpinWorkDirectory` | 取消置顶工作目录 {{name}} | L3 | 子串同形:ai.pane.unpin |
| 14 会话管理·分享·导 | nav.* | `nav.workDirectoryActions` | {{name}} 更多工作目录操作 | L3 | 子串同形:cloudChat.header.target |
| 14 会话管理·分享·导 | nav.* | `nav.pinWorkDirectoryAction` | 置顶 | L1 | admin.announcements.colPinned |
| 14 会话管理·分享·导 | nav.* | `nav.unpinWorkDirectoryAction` | 取消置顶 | L1 | ai.pane.unpin |
| 14 会话管理·分享·导 | nav.* | `nav.editWorkDirectoryAction` | 编辑 | L1 | knowledgeCard.edit |
| 14 会话管理·分享·导 | nav.* | `nav.chatActions` | 任务 {{title}} 操作 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.copyChatId` | 复制任务 ID | L2 | aiGeneration.taskId (J=0.60) |
| 14 会话管理·分享·导 | nav.* | `nav.copyChatIdSuccess` | 已复制任务 ID | L2 | aiGeneration.taskId (J=0.50) |
| 14 会话管理·分享·导 | nav.* | `nav.copyChatIdError` | 任务 ID 未复制，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 14 会话管理·分享·导 | nav.* | `nav.sessionWaiting` | 等待你处理 | L1 | chatHistory.attentionWaiting |
| 14 会话管理·分享·导 | nav.* | `nav.sessionRunning` | 任务正在进行 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.sessionUnread` | 有未读更新 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.sessionError` | 任务执行失败 | L2 | ai.pane.errorCatalog.DELEGATE_ERROR.title (J=0.83) |
| 14 会话管理·分享·导 | nav.* | `nav.renameChat` | 重命名 | L1 | aiChat.actions.rename |
| 14 会话管理·分享·导 | nav.* | `nav.exportChat` | 导出记录 | L2 | settings.exportNoHistory (J=0.60) |
| 14 会话管理·分享·导 | nav.* | `nav.pinChat` | 全局置顶 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.pinChatInWorkspace` | 在工作区内置顶 | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | nav.* | `nav.unpinChatInWorkspace` | 取消工作区内置顶 | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | nav.* | `nav.workspacePinError` | 未能更新会话置顶，请重试 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.unpinChat` | 取消全局置顶 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.markUnread` | 标记为未读 | L2 | ide.diffReview.markAsUnviewed (J=0.50) |
| 14 会话管理·分享·导 | nav.* | `nav.markUnreadSuccess` | 已标记为未读 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.markUnreadError` | 暂时无法标记为未读，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 14 会话管理·分享·导 | nav.* | `nav.renameChatTitle` | 重命名任务 | L1 | aiChat.renameDialog.title |
| 14 会话管理·分享·导 | nav.* | `nav.renameChatDescription` | 保持简短且易于识别 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.renameChatError` | 这段协作的名称还没有更新，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 14 会话管理·分享·导 | nav.* | `nav.archiveChat` | 归档 | L1 | teamKnowledge.archiveBtn |
| 14 会话管理·分享·导 | nav.* | `nav.archivingChat` | 正在归档... | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.archiveChatTitle` | 归档“{{title}}”？ | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.archiveChatDoNotAskAgain` | 不再提示 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.archiveChatDescription` | 它会离开当前任务列表，保留在设置里的已归档任务中；之后你可以在那里永久删除。 | L3 | 子串同形:teamKnowledge.status.archived |
| 14 会话管理·分享·导 | nav.* | `nav.archiveChatError` | 这段协作还没有归档，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 14 会话管理·分享·导 | nav.* | `nav.selectChat` | 选择任务“{{title}}” | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.selectedChatCount` | 已选 {{count}} 个 | L2 | aiNews.compare.selected (J=0.82) |
| 14 会话管理·分享·导 | nav.* | `nav.cancelChatSelectionAction` | 取消多选 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.archiveSelectedChatsAction` | 归档所选任务 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.archiveSelectedChatsTitle` | 归档 {{count}} 个任务？ | L2 | publish.calendar.taskCount (J=0.69) |
| 14 会话管理·分享·导 | nav.* | `nav.archiveSelectedChatsDescription` | 这些任务会离开当前任务列表，并保留在设置里的已归档任务中；之后你可以在那里恢复或永久删除。 | L3 | 子串同形:teamKnowledge.status.archived |
| 14 会话管理·分享·导 | nav.* | `nav.archiveSelectedChatsConfirm` | 归档所选任务 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.archivingChats` | 正在归档任务... | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.archiveSelectedChatsError` | 所选任务还没有归档，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 14 会话管理·分享·导 | nav.* | `nav.archiveSelectedChatsPartialError` | 已归档 {{archived}} 个任务，另有 {{failed}} 个未能归档，请稍后重试 | L3 | 子串同形:teamKnowledge.status.archived |
| 14 会话管理·分享·导 | nav.* | `nav.exportChatSuccess` | 已导出为 {{filename}} | L2 | design.export.exportSuccess (J=0.69) |
| 14 会话管理·分享·导 | nav.* | `nav.exportChatError` | 这段协作还没有导出，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 14 会话管理·分享·导 | nav.* | `nav.reorderChatError` | 任务位置还没有更新，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 14 会话管理·分享·导 | nav.* | `nav.reorderWorkspaceError` | 工作区位置还没有更新，请稍后重试。 | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | nav.* | `nav.deleteChat` | 删除 | L1 | knowledgeCard.delete |
| 14 会话管理·分享·导 | nav.* | `nav.removeChat` | 移除任务 | L2 | aiChat.deleteConversation (J=0.50) |
| 14 会话管理·分享·导 | nav.* | `nav.deleteChatTitle` | 移除“{{title}}”？ | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.deleteChatDescription` | 它会离开当前列表；本地历史、决定和交付证据会暂时保留，方便需要时继续追溯。 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.deleteChatError` | 这段协作还没有移除，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 14 会话管理·分享·导 | nav.* | `nav.chatName` | 协作名称 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.environmentNotice` | 内测开发版本，不代表最终品质，注意保密 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.closeEnvironmentNotice` | 关闭内测开发版本提示 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.futureDatabaseCompatibilityNotice` | 本地数据由更高版本创建，部分功能可能不兼容，建议更新后使用 | MISS |  |
| 14 会话管理·分享·导 | nav.* | `nav.closeFutureDatabaseCompatibilityNotice` | 关闭本地数据兼容性提示 | MISS |  |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.notificationClose` | 关闭更新公告 | MISS |  |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.notificationActionFailed` | 操作失败，请重试。 | L2 | plugins.mutationError (J=0.63) |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.installReady` | 安装 Qoder 更新 {{version}} | L3 | 子串同形:cliImport.sourceQoder |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.debugIndicatorReady` | 调试显示 Qoder 更新下载提示 | L3 | 子串同形:cliImport.sourceQoder |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.updateAction` | 更新 | L1 | knowledgeCard.update |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.checkInProgress` | 正在检查 Qoder 更新 | L3 | 子串同形:ai.toolCall.pendingAutoChecking |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.downloadInProgress` | 正在下载 Qoder 更新 {{version}} | L3 | 子串同形:cliImport.sourceQoder |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.verifyInProgress` | 正在验证 Qoder 更新 {{version}} | L3 | 子串同形:cliImport.sourceQoder |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.restartInProgress` | 正在安装更新，Qoder 即将重启 | L3 | 子串同形:cliImport.sourceQoder |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.confirmTitle` | 安装 Qoder {{version}} | L3 | 子串同形:cliImport.sourceQoder |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.confirmDescription` | 更新已经下载并验证。安装会退出并重新打开 Qoder。 | L3 | 子串同形:cliImport.sourceQoder |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.installAndRestart` | 安装并重启应用 | L2 | common.update.restart (J=0.50) |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.preparingInstall` | 正在准备安装... | MISS |  |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.updateLater` | 稍后更新 | MISS |  |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.stopAndUpdate` | 停止并更新 | MISS |  |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.blockedTitle` | Agent 正在执行 | L2 | agent.tabRuntime (J=0.56) |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.blockedDescription` | 正在执行 {{running}} 项、后台任务 {{background}} 个、排队 {{ | L3 | 子串同形:cliImport.sourceQoder |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.newerVersionDownloading` | 发现更新的版本，正在后台下载。 | MISS |  |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.downloadFailed` | 新版下载失败，稍后会自动重试。 | L3 | 子串同形:certificate.detail.downloadError |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.revoked` | 这个版本已不再提供。 | MISS |  |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.networkUnavailable` | 暂时无法确认更新版本，请检查网络后重试。 | L3 | 子串同形:admin.skillBatch.confirmUpdate |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.notReady` | 更新尚未准备好，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.checkFailed` | 无法确认更新版本，请稍后重试。 | L3 | 子串同形:admin.skillBatch.confirmUpdate |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.downloadPageOpened` | 已打开 Qoder 官网，请下载并安装最新 Linux 版本。当前版本 {{version} | L3 | 子串同形:cliImport.sourceQoder |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.downloadPageOpenFailed` | 无法打开 Qoder 官网，请在浏览器中访问 qoder.com 下载最新 Linux 版本 | L3 | 子串同形:cliImport.sourceQoder |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.installFailed` | 无法启动更新安装，当前应用将继续运行。 | MISS |  |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.installFailedReadOnly` | 安装失败：应用位于只读卷，无法就地更新。请用访达将 Qoder.app 移动到「应用程序」文 | L3 | 子串同形:aiChat.org.folderLabel |
| 14 会话管理·分享·导 | productUpdate.* | `productUpdate.translocationWarning` | 当前应用正从 macOS 只读快照（App Translocation）运行，无法自动更新。 | L3 | 子串同形:aiChat.org.folderLabel |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.title` | 自定义分组 | L2 | admin.roles.builtinNo (J=0.50) |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.pinError` | 无法更改分组置顶状态 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.newChat` | 在“{{name}}”中新建对话 | L3 | 子串同形:shortcutHelp.desc.ctrlShiftN |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.createAction` | 新建分组 | L1 | adminTools.apiGroups.create |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.createAndMoveAction` | 新建分组并移动 | L2 | adminTools.apiGroups.create (J=0.50) |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.createAndMoveSelectedAction` | 新建分组并移动所选任务 | L3 | 子串同形:adminTools.apiGroups.create |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.moveSessionAction` | 移动到分组 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.moveSelectedAction` | 移动所选任务到分组 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.none` | 未分组对话 | L2 | llmSettings.v2.sidebar.ungrouped (J=0.50) |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.openActions` | 打开分组“{{name}}”的操作 | L3 | 子串同形:cloudChat.header.target |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.editAction` | 编辑分组 | L1 | adminTools.apiGroups.editTitle |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.archiveSessionsAction` | 归档分组内任务 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.clearAction` | 解散分组 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.sessionCount` | {{count}} 个任务 | L2 | publish.calendar.taskCount (J=0.82) |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.moveError` | 无法移动任务到分组 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.archiveSessionsError` | 无法归档分组内任务 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.clearError` | 无法解散分组 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.archiveSessionsTitle` | 归档“{{name}}”中的任务？ | L3 | 子串同形:cloudChat.header.target |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.archiveSessionsDescription` | 分组内的任务将进入归档，分组会保留供之后继续使用。 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.archiveSessionsConfirm` | 归档任务 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.clearTitle` | 解散“{{name}}”？ | L2 | cloudChat.header.target (J=0.56) |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.clearDescription` | 分组将被删除，其中的任务会移到“未分组对话”。任务内容不会被删除。 | L3 | 子串同形:llmSettings.v2.sidebar.ungrouped |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.clearConfirm` | 解散分组 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.confirming` | 正在处理… | L2 | waiting.agent.followup.3 (J=0.50) |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.createTitle` | 新建任务分组 | L2 | admin.scheduleLogs.colJobGroup (J=0.60) |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.editTitle` | 编辑任务分组 | L2 | admin.scheduleLogs.colJobGroup (J=0.60) |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.description` | 分组只整理侧栏中的任务，不会改变工作区或执行位置。 | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.nameLabel` | 分组名称 | L1 | publish.groups.name |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.namePlaceholder` | 例如：本周重点 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.colorLabel` | 颜色 | L1 | admin.tags.color |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.colorPicker.hue` | 色相 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.colorPicker.saturation` | 饱和度 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.colorPicker.brightness` | 亮度 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.colorPicker.hex` | HEX 色值 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.colorPicker.invalid` | 请输入 # 开头的六位 HEX 色值 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.color.red` | 红色 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.color.orange` | 橙色 | L1 | eduSchedule.colors.orange |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.color.yellow` | 黄色 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.color.green` | 绿色 | L1 | eduSchedule.colors.green |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.color.blue` | 蓝色 | L1 | eduSchedule.colors.blue |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.color.purple` | 紫色 | L1 | eduSchedule.colors.purple |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.color.custom` | 自定义颜色 | L2 | admin.roles.builtinNo (J=0.50) |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.shapeLabel` | 标记形状 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.shape.circle` | 圆形 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.shape.diamond` | 菱形 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.shape.square` | 方形 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.shape.triangle` | 三角形 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.shape.hexagon` | 六边形 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.shape.star` | 星形 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.saveError` | 无法保存分组 | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.saving` | 正在保存… | MISS |  |
| 14 会话管理·分享·导 | sidebarGroup.* | `sidebarGroup.saveAction` | 保存 | L1 | teamMemory.saveBtn |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.activityTitle` | 最近对话 | L1 | aiGroup.detailRecent |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.showMore` | 展示更多 | L2 | taskStatus.showMore (J=0.50) |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.collapse` | 收起 | L1 | a11y.collapse |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.showMoreSessions` | 展示 {{name}} 的更多任务 | L3 | 子串同形:cloudChat.header.target |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.collapseSessions` | 收起 {{name}} 的任务 | L3 | 子串同形:cloudChat.header.target |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.sessions` | 任务 | L1 | ai.swarmMonitor.task |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.openMenu` | 自定义任务视图 | L3 | 子串同形:admin.roles.builtinNo |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.grouping.label` | 分组方式 | MISS |  |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.grouping.workspace` | 按工作区 | L2 | agent.fieldWorkspace (J=0.67) |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.grouping.activity` | 按活动日期 | MISS |  |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.grouping.custom` | 按自定义分组 | L3 | 子串同形:admin.roles.builtinNo |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.grouping.none` | 不分组 | L2 | admin.eduSettings.colGroup (J=0.50) |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.sorting.label` | 排序方式 | MISS |  |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.sorting.manual` | 手动 | L1 | admin.edu.certificate.sourceLabel.manual |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.sorting.updated` | 最近更新 | L1 | settings.modelRecordUpdatedAt |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.sorting.name` | 名称 | L1 | adminModelPricing.name |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.sorting.created` | 创建时间 | L1 | admin.advertise.colCreatedAt |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.workspace.label` | 工作区 | L1 | agent.fieldWorkspace |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.workspace.all` | 全部 | L1 | teamMemory.kindAll |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.workspace.none` | 无工作区 | L2 | agent.fieldWorkspace (J=0.67) |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.workspace.unknown` | 不可用 | L1 | eduScheduling.timeEntryDialog.unavailable |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.activity.label` | 最近活动 | L2 | memberSettingsPage.privacy.showActivity (J=0.60) |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.activity.all` | 全部 | L1 | teamMemory.kindAll |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.activity.today` | 今天 | L1 | aiChat.today |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.activity.7d` | 最近 7 天 | L1 | aiCost.range7d |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.activity.30d` | 最近 30 天 | L1 | aiCost.range30d |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.reset` | 恢复默认 | L2 | settings.sampling.resetAll (J=0.60) |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.empty` | 暂无任务数据 :) | L2 | admin.system.tasks.noTasks (J=0.50) |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.workspaceEmpty` | 暂无任务 :) | L2 | admin.system.tasks.noTasks (J=0.75) |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.clearFilters` | 清除筛选 | L3 | 子串同形:plugins.emptyDesc |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.loadingMore` | 正在加载… | MISS |  |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.loadMoreError` | 加载更多任务失败，请重试 | L3 | 子串同形:market.loadMore |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.retryLoadMore` | 重试加载 | MISS |  |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.group.today` | 今天 | L1 | aiChat.today |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.group.yesterday` | 昨天 | L1 | aiNews.feed.yesterday |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.group.7d` | 最近 7 天 | L1 | aiCost.range7d |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.group.older` | 更早 | MISS |  |
| 14 会话管理·分享·导 | sidebarView.* | `sidebarView.group.all` | 全部任务 | L1 | agent.kanban.allTeams |
| 14 会话管理·分享·导 | updates.* | `updates.title` | 动态 | L1 | bookmark.type.post |
| 14 会话管理·分享·导 | updates.* | `updates.open` | 打开动态 | L3 | 键末段同名+词头同形:我方 ide.fileTreeNode.open=「打开」 |
| 14 会话管理·分享·导 | updates.* | `updates.important` | 需要了解 | MISS |  |
| 14 会话管理·分享·导 | updates.* | `updates.recent` | 最近更新 | L1 | settings.modelRecordUpdatedAt |
| 14 会话管理·分享·导 | updates.* | `updates.viewAll` | 查看全部动态 | L2 | aiNews.live.viewMore (J=0.60) |
| 14 会话管理·分享·导 | updates.* | `updates.hiddenTitle` | 已隐藏动态 | L2 | admin.asks.statusHidden (J=0.50) |
| 14 会话管理·分享·导 | updates.* | `updates.viewHidden` | 查看已隐藏动态 | L3 | 子串同形:admin.asks.statusHidden |
| 14 会话管理·分享·导 | updates.* | `updates.viewActive` | 返回动态 | MISS |  |
| 14 会话管理·分享·导 | updates.* | `updates.more` | 更多动态操作 | L3 | 键末段同名+词头同形:我方 a11y.more=「更多」 |
| 14 会话管理·分享·导 | updates.* | `updates.markAllRead` | 全部标为已读 | MISS |  |
| 14 会话管理·分享·导 | updates.* | `updates.markAllReadFailed` | 未能把动态标为已读，请重试。 | MISS |  |
| 14 会话管理·分享·导 | updates.* | `updates.hide` | 隐藏动态 | L3 | 键末段同名+词头同形:我方 common.hide=「隐藏」 |
| 14 会话管理·分享·导 | updates.* | `updates.hiding` | 正在隐藏… | MISS |  |
| 14 会话管理·分享·导 | updates.* | `updates.hideFailed` | 这条动态未隐藏，请重试。 | MISS |  |
| 14 会话管理·分享·导 | updates.* | `updates.restore` | 恢复动态 | L3 | 键末段同名+词头同形:我方 admin.edu.course.trash.restore=「恢复」 |
| 14 会话管理·分享·导 | updates.* | `updates.restoring` | 正在恢复… | MISS |  |
| 14 会话管理·分享·导 | updates.* | `updates.restoreFailed` | 这条动态未恢复，请重试。 | MISS |  |
| 14 会话管理·分享·导 | updates.* | `updates.read` | 已读 | L1 | admin.edu.learn.remind.colRead |
| 14 会话管理·分享·导 | updates.* | `updates.unread` | 未读 | L1 | admin.edu.learn.remind.unread |
| 14 会话管理·分享·导 | updates.* | `updates.empty` | 没有新的动态 | MISS |  |
| 14 会话管理·分享·导 | updates.* | `updates.emptyDescription` | 评论、提及和订阅 Issue 的变化会出现在这里。 | MISS |  |
| 14 会话管理·分享·导 | updates.* | `updates.emptyArchived` | 没有已隐藏动态 | L3 | 子串同形:admin.asks.statusHidden |
| 14 会话管理·分享·导 | updates.* | `updates.emptyArchivedDescription` | 你隐藏的动态会保留在这里，随时可以恢复。 | MISS |  |
| 14 会话管理·分享·导 | updates.* | `updates.unavailable` | 无法读取动态 | MISS |  |
| 14 会话管理·分享·导 | updates.* | `updates.unavailableDescription` | 本地协作数据暂时不可用，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 14 会话管理·分享·导 | updates.* | `updates.select` | 选择一条动态 | L3 | 键末段同名+词头同形:我方 chatHistory.select=「选择」 |
| 14 会话管理·分享·导 | updates.* | `updates.selectDescription` | 选择左侧动态后，可在原 Issue 上下文中查看变化。 | L3 | 子串同形:ai.pane.overview.context |
| 14 会话管理·分享·导 | windowControls.* | `windowControls.minimize` | 最小化 | L1 | a11y.minimize |
| 14 会话管理·分享·导 | windowControls.* | `windowControls.maximize` | 最大化 | L1 | nav.maximize |
| 14 会话管理·分享·导 | windowControls.* | `windowControls.restore` | 还原 | L1 | nav.restore |
| 14 会话管理·分享·导 | windowControls.* | `windowControls.close` | 关闭 | L1 | a11y.close |
| 14 会话管理·分享·导 | workspace.* | `workspace.create` | 新建工作区 | L2 | admin.workflows.create (J=0.60) |
| 14 会话管理·分享·导 | workspace.* | `workspace.createMenu` | 选择新建工作区类型 | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | workspace.* | `workspace.createLocal` | 新建本地工作区 | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | workspace.* | `workspace.createRemote` | 新建远程工作区 | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | workspace.* | `workspace.createTitle` | 新建工作区 | L2 | admin.workflows.create (J=0.60) |
| 14 会话管理·分享·导 | workspace.* | `workspace.createType` | 运行位置 | L1 | ai.pane.sideTask.location.label |
| 14 会话管理·分享·导 | workspace.* | `workspace.localType` | 本地 | L1 | aiChat.envInfo.local |
| 14 会话管理·分享·导 | workspace.* | `workspace.createAction` | 创建工作区 | L2 | agent.fieldWorkspace (J=0.50) |
| 14 会话管理·分享·导 | workspace.* | `workspace.expandAll` | 展开全部工作区 | L2 | ai.pane.expandAll (J=0.50) |
| 14 会话管理·分享·导 | workspace.* | `workspace.collapseAll` | 折叠全部工作区 | L2 | ai.pane.collapseAll (J=0.50) |
| 14 会话管理·分享·导 | workspace.* | `workspace.edit` | 编辑工作区 {{name}} | L3 | 键末段同名+词头同形:我方 knowledgeCard.edit=「编辑」 |
| 14 会话管理·分享·导 | workspace.* | `workspace.pin` | 置顶工作区 {{name}} | L3 | 键末段同名+词头同形:我方 ai.pane.pin=「置顶」 |
| 14 会话管理·分享·导 | workspace.* | `workspace.unpin` | 取消置顶工作区 {{name}} | L3 | 键末段同名+词头同形:我方 ai.pane.unpin=「取消置顶」 |
| 14 会话管理·分享·导 | workspace.* | `workspace.editWorkspaceAction` | 编辑工作区 | L2 | commandPalette.commands.document.description (J=0.67) |
| 14 会话管理·分享·导 | workspace.* | `workspace.editActiveSessionDisabled` | 当前会话已锁定工作区，无法切换。如需使用其他工作区，请新建会话。 | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | workspace.* | `workspace.contextWorkspaceCount` | {{count}} 个工作区 | L2 | mcpStore.toolCount (J=0.62) |
| 14 会话管理·分享·导 | workspace.* | `workspace.editorDescription` | 一个工作区可以包含多个项目文件夹；主文件夹用于 Open Workspace 和 Open  | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | workspace.* | `workspace.name` | 工作区名称 | L2 | agent.fieldWorkspace (J=0.50) |
| 14 会话管理·分享·导 | workspace.* | `workspace.folder` | 主文件夹 | L2 | aiChat.org.folderLabel (J=0.67) |
| 14 会话管理·分享·导 | workspace.* | `workspace.sourceFolders` | 源文件夹 | L2 | aiChat.org.folderLabel (J=0.67) |
| 14 会话管理·分享·导 | workspace.* | `workspace.dropFolderError` | 无法读取拖入的文件夹，请点击添加文件夹重试。 | L3 | 子串同形:aiChat.org.folderLabel |
| 14 会话管理·分享·导 | workspace.* | `workspace.icon` | 工作区图标 | L2 | agent.fieldWorkspace (J=0.50) |
| 14 会话管理·分享·导 | workspace.* | `workspace.color` | 工作区颜色 | L2 | agent.fieldWorkspace (J=0.50) |
| 14 会话管理·分享·导 | workspace.* | `workspace.projects` | 项目文件夹 | L2 | aiChat.org.folderLabel (J=0.50) |
| 14 会话管理·分享·导 | workspace.* | `workspace.primary` | 主要 | MISS |  |
| 14 会话管理·分享·导 | workspace.* | `workspace.setPrimary` | 设为主要 | MISS |  |
| 14 会话管理·分享·导 | workspace.* | `workspace.removeProject` | 移除项目 {{name}} | L2 | chat.removeTool (J=0.50) |
| 14 会话管理·分享·导 | workspace.* | `workspace.projectsRequired` | 至少添加一个项目，并设置一个主项目。 | MISS |  |
| 14 会话管理·分享·导 | workspace.* | `workspace.noWorkspace` | 不指定工作区 | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | workspace.* | `workspace.search` | 搜索工作区 | L2 | agent.fieldWorkspace (J=0.50) |
| 14 会话管理·分享·导 | workspace.* | `workspace.saving` | 正在保存... | MISS |  |
| 14 会话管理·分享·导 | workspace.* | `workspace.created` | 工作区已创建 | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | workspace.* | `workspace.updated` | 工作区已更新 | L3 | 子串同形:agent.fieldWorkspace |
| 14 会话管理·分享·导 | workspace.* | `workspace.saveError` | 工作区尚未保存，请稍后重试。 | L3 | 子串同形:agent.fieldWorkspace |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
