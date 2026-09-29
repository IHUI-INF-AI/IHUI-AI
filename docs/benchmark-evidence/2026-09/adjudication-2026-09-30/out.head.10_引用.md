<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 逐条对账导出：10 引用

生成：`node docs/benchmark-evidence/2026-09/reconcile.mjs qoder/chat-stream-inventory.md --section "10 引用" --out <本文件>`

四态口径：**L1 逐字 / L2 近义(Jaccard≥0.5) 不算差距**；L3=需人工核（键同名或子串同形，形似不等于等同）；MISS=候选缺失，须逐条定性后才可写进台账。控制测量在运行前已通过，故 MISS 不是匹配器空转的产物。

> 族级归属：430 行全部归到某个族，族级计数可用于归因。

> 不计 MISS 的 skip 明细（逐档报名）：非中文原文(不计 MISS，只报数) 8 条 / 枚举/样式值非文案(值层主筛) 3 条

| 节 | 族 | 竞品键 | 竞品原文 | 判定 | 我方对应 |
| --- | --- | --- | --- | --- | --- |
| 10 引用与来源（@ / | chatSession.* | `chatSession.addedFolderCount` | {{name}} +{{count}} | skip | 非中文原文(不计 MISS，只报数) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionActions.ariaLabel` | 选中文本操作 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionActions.copyText` | 复制文本 | L1 | chat.contextMenu.copyText |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionActions.addToChat` | 添加到任务 | L1 | ai.pane.annotationAnchors.addToTask |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionActions.askInSideChat` | 在侧边任务中提问 | L3 | 子串同形:ai.pane.sideTask.title |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionActions.sideChatFailed` | 侧边任务没有打开，请重试。 | L3 | 子串同形:ai.pane.sideTask.title |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionActions.addToQuickNotes` | 添加到速记板 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionActions.copied` | 已复制选中文本 | L2 | ide.terminalPanel.copySelection (J=0.50) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionActions.copyFailed` | 复制选中文本失败 | L3 | 子串同形:ide.terminalPanel.copySelection |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionActions.addedToQuickNotes` | 已添加到速记板 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionActions.addToQuickNotesFailed` | 速记板保存失败 | L2 | teamMemory.saveFailed (J=0.50) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionActions.attachmentName` | 选中的文本 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionActions.attachmentLimitReached` | 附件已达 20 个，请先移除一个再添加选中文本。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.summary` | {{count}} 条批注 | L2 | agentWorkbench.runtimeLog.logCount (J=0.64) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.summaryAriaLabel` | {{count}} 条划词批注。悬停查看详情。 | L3 | 子串同形:activities.viewDetail |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.hoverHint` | 悬停查看批注 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.selectedText` | {{index}}. 选中文字 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.userComment` | 用户评论 | L2 | skillMarket.ratingsTitle (J=0.50) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.noComment` | 未添加评论 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.commentPlaceholder` | 添加可选评论… | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.commentAriaLabel` | 划词批注评论 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.addComment` | 添加评论 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.skipComment` | 暂不评论 | L2 | ai.pane.elementPack.feedbackSurvey.dismiss (J=0.50) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.save` | 保存 | L1 | teamMemory.saveBtn |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.cancel` | 取消 | L1 | teamMemory.cancelBtn |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.edit` | 编辑批注 {{index}} | L3 | 键末段同名+词头同形:我方 knowledgeCard.edit=「编辑」 |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.removeOne` | 移除批注 {{index}} | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.removeAll` | 移除全部划词批注 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.marker` | 批注 {{index}} | L2 | answerArea.audio.alt (J=0.50) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.selectionAnnotations.directiveLabel` | 批注 {{index}} | L2 | answerArea.audio.alt (J=0.50) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.open` | 打开速记板 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.close` | 关闭速记板 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.title` | Quick Notes | skip | 非中文原文(不计 MISS，只报数) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.description` | 保存从 Agent 回复中摘出的片段。 | L3 | 子串同形:agentCanvas.typeAgent |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.search` | 搜索速记板 | L3 | 键末段同名+词头同形:我方 knowledgeCard.search=「搜索」 |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.searchPlaceholder` | 搜索笔记… | L2 | notes.search (J=0.75) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.closeSearch` | 退出搜索 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.addPlaceholder` | 记下点什么… | L2 | note.placeholder (J=0.50) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.addImage` | 添加图片 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.dropImages` | 拖放图片到这里 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAlt` | 速记板图片：{{name}} | L3 | 子串同形:cloudChat.header.target |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.removeImage` | 移除图片 {{name}} | L2 | chat.removeTool (J=0.50) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.previewImage` | 查看图片 {{name}} | L3 | 子串同形:cloudChat.header.target |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageLoadFailed` | 图片无法加载 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imagePreviewTitle` | 图片预览：{{name}} | L3 | 子串同形:cloudChat.header.target |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imagePreviewCopy` | 复制图片 | L1 | ai.pane.elementPack.imagePreview.copy |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imagePreviewSave` | 保存图片 | L1 | ai.pane.elementPack.imagePreview.save |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imagePreviewClose` | 关闭图片预览 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imagePreviewPrevious` | 上一张 | L1 | a11y.previous |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imagePreviewNext` | 下一张 | L1 | a11y.next |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imagePreviewInstructions` | 图片查看区域。滚动缩放，放大后拖动图片，双击切换实际大小与适合窗口。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imagePreviewCounter` | 第 {{index}} / {{total}} 张 | L2 | ai.pane.elementPack.imagePreview.counter (J=0.74) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imagePreviewZoomOut` | 缩小图片 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imagePreviewZoomIn` | 放大图片 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imagePreviewFit` | 适合窗口 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imagePreviewZoomLevel` | 当前缩放比例 {{zoom}}% | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imagePreviewCopied` | 已复制图片 | L2 | ai.pane.elementPack.imagePreview.copy (J=0.75) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imagePreviewCopyFailed` | 复制图片失败 | L2 | ai.pane.elementPack.imagePreview.copy (J=0.60) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imagePreviewSaved` | 图片已保存 | L1 | ai.pane.elementPack.imagePreview.saveSuccess |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imagePreviewSaveFailed` | 保存图片失败 | L2 | ai.pane.elementPack.imagePreview.save (J=0.60) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotationConfirmFailed` | 无法应用图片批注 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.toolbar` | 图片批注工具 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.properties` | 工具属性 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.shapeMenu` | 选择形状 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.drawingMenu` | 选择绘制工具 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.rectangle` | 矩形 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.ellipse` | 椭圆 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.line` | 直线 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.pen` | 画笔 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.text` | 文字 | L2 | computerUse.noTextElement (J=0.50) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.mosaic` | 马赛克 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.undo` | 撤销 | L1 | admin.edu.certificate.statusRevoke |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.redo` | 重做 | L1 | design.redo |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.deleteSelection` | 删除所选批注 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.color` | 颜色 | L1 | admin.tags.color |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.width` | 粗细 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.widthThin` | 细 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.widthMedium` | 中 | L1 | agent.kanban.medium |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.widthThick` | 粗 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.arrow` | 箭头 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.arrowNone` | 无线头 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.arrowEnd` | 末端箭头 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.arrowBoth` | 双向箭头 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.textSize` | 字号 | L1 | visualAnnotation.fontSize |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.textSmall` | 小 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.textMedium` | 中 | L1 | agent.kanban.medium |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.textLarge` | 大 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.textStyle` | 文字样式 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.textPlain` | 纯文字 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.textFilled` | 背景填充 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.textPlaceholder` | 输入批注文字 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.canvasInstructions` | 图片批注区域。拖动绘制；选择批注后可移动、缩放、修改属性或删除。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.edit` | 编辑图片 | L1 | taskStatus.toolImageEdit |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.confirm` | 应用批注 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.cancel` | 放弃批注 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageAnnotation.gifDisabled` | GIF 动图暂不支持批注 | L3 | 子串同形:ecosystem.capUnsupported |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.addImageFailed` | 图片没有添加到速记板 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.pasteImagesFailed` | 无法粘贴这条速记的图片 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageErrors.empty` | 没有可添加的图片。 | L2 | groups.noAvailableAccounts (J=0.56) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageErrors.count` | 每条速记最多添加 5 张图片。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageErrors.format` | 仅支持 PNG、JPEG、WebP 和 GIF 图片。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageErrors.emptyFile` | 图片内容为空，无法添加。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageErrors.itemSize` | 单张图片不能超过 10 MB。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageErrors.totalSize` | 每条速记的图片总大小不能超过 20 MB。 | L3 | 子串同形:admin.saas.stats.totalSize |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageErrors.invalidPayload` | 复制的速记板图片数据无效，请改用普通文本粘贴。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.imageErrors.readFailed` | 图片读取失败，请重试。 | L2 | eduProcurement.ai.errReadFailed (J=0.63) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.errors.recordNotFound` | 这条速记已不存在。刷新速记板后重试。 | L3 | 子串同形:admin.saas.stateNotFound |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.errors.clipboardUnavailable` | 系统剪贴板不可用。检查系统权限后重试。 | L3 | 子串同形:llmSettings.v2.health.down |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.errors.invalidData` | 这条速记无法处理。重新打开速记板后重试。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.errors.windowUnavailable` | 速记板窗口暂不可用。重新打开后重试。 | L3 | 子串同形:llmSettings.v2.health.down |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.errors.tryAgain` | 检查磁盘与系统权限后重试。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.loading` | 正在读取速记板记录… | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.emptyTitle` | 还没有速记 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.emptyDescription` | 在 Agent 回复里划选内容，然后添加到速记板。 | L3 | 子串同形:agentCanvas.typeAgent |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.sourceChat` | 来自“{{title}}” | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.sourceUnknownChat` | 来自任务 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.copy` | 复制速记 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.copied` | 已复制速记 | L2 | workPanel.linkCopied (J=0.50) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.copyFailed` | 复制速记失败 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.copyRecord` | 复制 | L1 | a11y.copy |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.copyText` | 复制文本 | L1 | chat.contextMenu.copyText |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.copyImage` | 复制图片 | L1 | ai.pane.elementPack.imagePreview.copy |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.moreActions` | 打开速记操作菜单 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.organize` | 整理速记板 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.filterLabel` | 显示范围 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.filterCurrent` | 当前 | L1 | developerSubscriptionPage.current |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.filterArchived` | 已归档 | L1 | teamKnowledge.status.archived |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.filterAll` | 全部 | L1 | teamMemory.kindAll |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.clearFilter` | 清除“{{filter}}”筛选 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.groupByLabel` | 分组方式 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.groupBySource` | 任务来源 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.groupByTime` | 时间 | L1 | admin.anomalies.colTime |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.onboardingNote` | 这是你的第一条速记 🌲。 | L3 | 子串同形:user.public.isYou |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.onboardingTitle` | 这是你的第一条速记 🌲。 | L3 | 子串同形:user.public.isYou |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.onboardingUnderline` | 还没准备发送的 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.onboardingTagline` | Catch it before it slips. | skip | 非中文原文(不计 MISS，只报数) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.noSourceGroup` | No Source | skip | 非中文原文(不计 MISS，只报数) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.archiveRecord` | 归档速记 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.restoreRecord` | 恢复速记 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.archived` | 已归档 | L1 | teamKnowledge.status.archived |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.restored` | 速记已恢复 | L2 | admin.edu.course.trash.restoreSuccess (J=0.50) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.undoArchive` | 撤销 | L1 | admin.edu.certificate.statusRevoke |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.archiveFailed` | 速记还没有归档，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.restoreFailed` | 速记还没有恢复，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.today` | 今天 | L1 | aiChat.today |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.yesterday` | 昨天 | L1 | aiNews.feed.yesterday |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.unknownTime` | 时间未知 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.delete` | 删除速记 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.deleteRecord` | 删除 | L1 | knowledgeCard.delete |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.deleteConfirmTitle` | 删除这条速记？ | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.deleteConfirmDescription` | 正文和图片附件将永久删除，此操作无法撤销。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.deleteCancel` | 保留记录 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.deleteConfirm` | 删除记录 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.deleted` | 已删除 | L1 | admin.asks.statusDeleted |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.undoDelete` | 撤销 | L1 | admin.edu.certificate.statusRevoke |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.deleteFailed` | 速记还没有删除，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.loadFailed` | 速记板暂时无法读取。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.viewStateLoadFailed` | 速记板已使用默认视图打开。 | L3 | 子串同形:chat.contextUsage.used |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.viewStateSaveFailed` | 这次视图选择尚未记住。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.onboardingLoadFailed` | 首次引导暂时无法加载，关闭速记板后重新打开即可重试。 | L3 | 子串同形:unifiedSuggestion.sourceFailedTag |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.editRecord` | 编辑 | L1 | knowledgeCard.edit |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.createNote` | 添加速记 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.editorCreateTitle` | 新建速记 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.editorEditTitle` | 编辑速记 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.editorAriaLabel` | 速记编辑器 | L2 | commandPalette.commands.editor.keywords.0 (J=0.50) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.editorCancel` | 取消 | L1 | teamMemory.cancelBtn |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.editorSave` | 保存 | L1 | teamMemory.saveBtn |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.editorSaving` | 正在保存… | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.updateFailed` | 速记还没有更新，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.updateMissing` | 这条速记已不存在。 | L3 | 子串同形:admin.saas.stateNotFound |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.textTooLong` | 速记正文不能超过 3000 个字符。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.discardTitle` | 保存这次修改？ | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.discardDescription` | 你可以保存后关闭、放弃修改，或继续编辑。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.discardChanges` | 放弃修改 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.continueEditing` | 继续编辑 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.bold` | 加粗 | L1 | editor.toolbar.bold |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.italic` | 斜体 | L1 | editor.toolbar.italic |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.clearFormatting` | 清除所有样式 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.serif` | 衬线字体 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.sansSerif` | 无衬线字体 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.underline` | 下划线 | L1 | editor.toolbar.underline |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.highlight` | 标记 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.decorationColor` | 装饰颜色 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.backToFormatting` | 返回格式操作 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.openLink` | 打开链接 | L1 | publish.history.openUrl |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.openLinkFailed` | 无法打开链接。 | L2 | publish.history.openUrl (J=0.60) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.colors.neutral` | 中性 | L1 | rules.recNeutral |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.colors.yellow` | 黄色 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.colors.orange` | 橙色 | L1 | eduSchedule.colors.orange |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.colors.pink` | 粉色 | L1 | eduSchedule.colors.pink |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.colors.purple` | 紫色 | L1 | eduSchedule.colors.purple |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.colors.blue` | 蓝色 | L1 | eduSchedule.colors.blue |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.colors.teal` | 青色 | L1 | eduSchedule.colors.teal |
| 10 引用与来源（@ / | chatSession.* | `chatSession.quickNotes.colors.green` | 绿色 | L1 | eduSchedule.colors.green |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.open` | 打开任务监控 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.title` | 任务监控 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.linkedIssue` | 关联 Issue | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.empty` | 还没有有价值的内容 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.emptyDescription` | 整个任务中产生的文件、网页和来源会持续汇总在这里，帮助跟踪任务进展。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.loadFailed` | 任务监控暂时无法读取。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.pin` | 固定任务监控 | L3 | 键末段同名+词头同形:我方 common.pin=「固定」 |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.unpin` | 取消固定任务监控 | L3 | 键末段同名+词头同形:我方 common.unpin=「取消固定」 |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.switchToFloating` | 切换为 Floating 模式 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.showFixed` | 显示任务监控 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.hideFixed` | 隐藏任务监控 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.openSettings` | 前往设置 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.retry` | 重试 | L1 | admin.relayParamOps.retry |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.loadMore` | 加载更多 | L1 | market.loadMore |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.loadingMore` | 正在加载… | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.showMore` | 查看更多（{{count}}） | L3 | 子串同形:common.viewMore |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.showLess` | 收起 | L1 | a11y.collapse |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.addSource` | 添加来源 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.addFile` | 添加文件 | L1 | aigcPublish.fileAddText |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.addLink` | 添加链接 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.removeSource` | 移除来源 {{name}} | L2 | chat.removeTool (J=0.50) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.memoryUpdated` | 记忆已更新 | L2 | dispatchDialog.roleUpdated (J=0.50) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.openMemorySettings` | 打开记忆设置 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.actionFailed` | 无法添加来源，请检查内容后重试。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.openSourceFileFailed` | 无法在 Qoder 中预览来源文件。 | L3 | 子串同形:cliImport.sourceQoder |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.title` | 任务回顾 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.updatedAt` | 更新于 {{time}} | L2 | deliveryReview.generatedAt (J=0.50) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.expand` | 展开任务回顾 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.moreActions` | 任务回顾更多操作 | L3 | 子串同形:aiChat.actions.menu |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.menuItem` | 移交到新任务 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.title` | 移交到新任务 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.description` | 可以补充新任务要完成的工作，Qoder 会生成一份脱敏的临时交接文档。 | L3 | 子串同形:cliImport.sourceQoder |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.previewDescription` | 检查交接内容后，可以在文件位置查看，或直接创建一个新任务继续工作。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.purposeLabel` | 交接目的 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.purposePlaceholder` | 例如：验证新的任务回顾生成逻辑，并补齐相关测试。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.generate` | 生成交接文档 | L3 | 键末段同名+词头同形:我方 repoWiki.generate=「生成」 |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.generating` | 正在生成… | L1 | aiAssistantN8n.streaming |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.waitingPreview` | 正在准备交接内容… | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.phase.collecting` | 正在整理任务回顾、相关文件和任务上下文… | L3 | 子串同形:ai.pane.overview.context |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.phase.generating` | 模型正在生成交接内容… | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.phase.finalizing` | 正在整理并写入临时交接文档… | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.phase.done` | 交接文档已生成。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.generateFailed` | 无法生成交接文档，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.revealFile` | 显示文件 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.revealFailed` | 临时交接文件可能已被删除、移动或无法访问。检查文件后重试。 | L3 | 子串同形:ai.pane.errorCatalog.ENCODING_ERROR.action |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.createSession` | 创建新任务 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.creating` | 正在创建… | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.recap.handoff.createFailed` | 无法从交接文档创建新任务，请重试。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.title` | 环境信息 | L1 | aiChat.envInfo.ariaLabel |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.changes` | 变更 | L1 | ai.pane.overview.changes |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.noChanges` | 无变更 | L1 | aiChat.envInfo.noChanges |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.local` | 本地 | L1 | aiChat.envInfo.local |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.worktree` | Worktree | skip | 枚举/样式值非文案(值层主筛) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.executionModeSwitchUnavailable` | 已创建的任务暂不支持切换本地或 Worktree 模式 | L3 | 子串同形:ecosystem.capUnsupported |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.branch` | 分支 | L1 | aiChat.envInfo.branchDetails |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.switchBranch` | 检出分支 | L3 | 子串同形:ai.pane.moveToWorktree.subtitle |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.preserveChangesTitle` | 保存改动后检出分支？ | L3 | 子串同形:agentTimeline.diffAfter |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.preserveChangesDescription` | Qoder 会临时存储当前改动，检出 {{branch}}，再恢复这些改动。如果分支内容冲突 | L3 | 子串同形:cliImport.sourceQoder |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.preserveChangesAction` | 保存改动并检出 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.localServers` | 本地服务 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.localServersCount` | {{count}} 个 | L2 | admin.permissions.count (J=0.78) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.localServersUnavailable` | 不可用 | L1 | llmSettings.v2.health.down |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.refreshLocalServers` | 刷新本地服务 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.noLocalServers` | 没有正在运行的本地服务 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.stopLocalServer` | 停止 {{name}} | L2 | cloudChat.header.target (J=0.56) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.localServerOutsideWorkspace` | 非当前工作区服务，无法停止 | L3 | 子串同形:agent.fieldWorkspace |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.commitOrPush` | 提交或推送 | L1 | aiChat.envInfo.commitPush |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.pullRequest` | 拉取请求 | L1 | aiChat.envInfo.pullRequest |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.environment.pullRequestUnavailable` | 无法获取拉取请求状态 | L1 | aiChat.envInfo.prUnavailable |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.group.artifact` | 产出 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.group.browser` | 网页查阅 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.group.runtime` | 技能与 MCP | L3 | 子串同形:chat.skillLibrary.tabMcp |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.group.source` | 来源 | L1 | admin.edu.certificate.colSource |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.group.memory` | 记忆 | L1 | aiToolsPanel.tabs.memory |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.emptyGroup.artifact` | 暂无产出数据 :) | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.emptyGroup.browser` | 暂无网页查阅数据 :) | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.emptyGroup.runtime` | 暂无技能与 MCP 数据 :) | L3 | 子串同形:chat.skillLibrary.tabMcp |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.emptyGroup.source` | 暂无来源数据 :) | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.emptyGroup.memory` | 暂无记忆数据 :) | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.status.running` | 执行中 | L1 | ai.pane.executing |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.status.waiting-user` | 等待回应 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.status.completed` | 已完成 | L1 | admin.edu.learn.plan.statusCompleted |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.status.failed` | 失败 | L1 | admin.members.import.failureCount |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.status.interrupted` | 已中断 | L1 | ai.pane.agentActions.action.interrupt.completed |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.linkDialog.title` | 添加链接 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.linkDialog.description` | 将一个 HTTP 或 HTTPS 链接加入输入框，发送后会记录为来源。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.linkDialog.label` | 链接地址 | L2 | workPanel.copyLink (J=0.60) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.linkDialog.placeholder` | https://example.com | skip | 枚举/样式值非文案(值层主筛) |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.linkDialog.invalid` | 请输入以 http:// 或 https:// 开头的有效链接。 | MISS |  |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.linkDialog.cancel` | 取消 | L1 | teamMemory.cancelBtn |
| 10 引用与来源（@ / | chatSession.* | `chatSession.highlights.linkDialog.add` | 添加 | L1 | admin.eduClassMembers.add |
| 10 引用与来源（@ / | composer.* | `composer.referencePreview.description` | 复制已发送消息或划选完整标签，粘贴后再编辑、发送，检查引用是否保持一致。 | L3 | 子串同形:admin.notificationLogs.sent |
| 10 引用与来源（@ / | composer.* | `composer.referencePreview.available` | 模拟能力可用 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.referencePreview.message` | 已发送消息 | L2 | unifiedDashboard.toastSent (J=0.60) |
| 10 引用与来源（@ / | composer.* | `composer.referencePreview.edit` | 编辑此消息 | L3 | 键末段同名+词头同形:我方 knowledgeCard.edit=「编辑」 |
| 10 引用与来源（@ / | composer.* | `composer.referencePreview.editor` | 能力引用输入框 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.referencePreview.placeholder` | 粘贴完整引用或输入 @名称… | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.referencePreview.send` | 发送预览 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.referencePreview.select` | 选择示例能力 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.referencePreview.clear` | 新建输入 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.referencePreview.authorization` | 此预览不请求模型。标签展示不会新增执行授权。 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.referencePreview.source` | 原始输入正文 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.addContext` | 添加上下文 | L2 | ai.pane.overview.context (J=0.50) |
| 10 引用与来源（@ / | composer.* | `composer.actions.add` | 添加 | L1 | admin.eduClassMembers.add |
| 10 引用与来源（@ / | composer.* | `composer.actions.addAttachment` | 添加附件 | L1 | 源码字面量 |
| 10 引用与来源（@ / | composer.* | `composer.actions.addAttachmentTooltip` | 添加图片、文件和文件夹 | L3 | 子串同形:aiChat.org.folderLabel |
| 10 引用与来源（@ / | composer.* | `composer.actions.addFile` | 添加文件 | L1 | aigcPublish.fileAddText |
| 10 引用与来源（@ / | composer.* | `composer.actions.addFolder` | 添加文件夹 | L2 | aigcPublish.fileAddText (J=0.75) |
| 10 引用与来源（@ / | composer.* | `composer.actions.workspaceFiles` | 工作区文件 | L2 | agent.fieldWorkspace (J=0.50) |
| 10 引用与来源（@ / | composer.* | `composer.actions.workspaceFileSearchLabel` | 搜索当前项目文件 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.workspaceFileSearchPlaceholder` | 搜索当前项目文件 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.workspaceFilesLoading` | 正在加载文件… | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.workspaceFilesSearching` | 正在搜索文件… | L2 | fileMention.fileSearchPlaceholder (J=0.67) |
| 10 引用与来源（@ / | composer.* | `composer.actions.workspaceFilesLoadFailed` | 项目文件暂时无法加载 | L2 | unifiedSuggestion.sourceFailedTag (J=0.56) |
| 10 引用与来源（@ / | composer.* | `composer.actions.workspaceFilesUnavailable` | 当前任务没有可浏览的工作区 | L3 | 子串同形:agent.fieldWorkspace |
| 10 引用与来源（@ / | composer.* | `composer.actions.workspaceFilesEmpty` | 当前目录没有文件 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.workspaceFilesSearchEmpty` | 未找到匹配的项目文件 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.workspaceFilesParent` | 返回上级目录 | L2 | workspace.folderPicker.parent (J=0.60) |
| 10 引用与来源（@ / | composer.* | `composer.actions.workspaceFilesRoots` | 返回工作区列表 | L2 | workspace.permissionsPage.goToWorkspace (J=0.67) |
| 10 引用与来源（@ / | composer.* | `composer.actions.workspaceFileTreeLabel` | 工作区文件列表 | L3 | 子串同形:agent.fieldWorkspace |
| 10 引用与来源（@ / | composer.* | `composer.actions.expandFolder` | 展开 {{name}} | L2 | workspace.folderPicker.openSelected (J=0.60) |
| 10 引用与来源（@ / | composer.* | `composer.actions.collapseFolder` | 收起 {{name}} | L2 | cloudChat.header.target (J=0.56) |
| 10 引用与来源（@ / | composer.* | `composer.actions.enterFolder` | 进入 {{name}} | L2 | cloudChat.header.target (J=0.56) |
| 10 引用与来源（@ / | composer.* | `composer.actions.plugin` | 插件 | L1 | ai.pane.hookSummary.source.plugin |
| 10 引用与来源（@ / | composer.* | `composer.actions.pluginLoading` | 正在加载插件… | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.pluginLoadFailed` | 插件暂时无法加载 | L2 | unifiedSuggestion.sourceFailedTag (J=0.71) |
| 10 引用与来源（@ / | composer.* | `composer.actions.pluginUnavailable` | 当前上下文暂不支持插件 | L3 | 子串同形:ecosystem.capUnsupported |
| 10 引用与来源（@ / | composer.* | `composer.actions.pluginEmpty` | 暂无可用插件 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.pluginSearchLabel` | 搜索插件 | L3 | 子串同形:plugins.searchPlaceholder |
| 10 引用与来源（@ / | composer.* | `composer.actions.pluginSearchPlaceholder` | 搜索插件 | L3 | 子串同形:plugins.searchPlaceholder |
| 10 引用与来源（@ / | composer.* | `composer.actions.pluginSearchEmpty` | 未找到匹配的插件 | L1 | plugins.emptyTitle |
| 10 引用与来源（@ / | composer.* | `composer.actions.managePlugins` | 管理插件 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.exploreMorePlugins` | 探索更多插件 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.pluginEnabled` | 当前任务已启用 | L3 | 子串同形:admin.integrations.enabled |
| 10 引用与来源（@ / | composer.* | `composer.actions.pluginSelected` | 插件 {{plugin}} 已选择 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.summonWaker` | 唤起 Waker | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.skill` | 技能 | L1 | commandPalette.commands.skill.keywords.0 |
| 10 引用与来源（@ / | composer.* | `composer.actions.browser` | 浏览器 | L1 | commandPalette.commands.browser.keywords.0 |
| 10 引用与来源（@ / | composer.* | `composer.actions.recordingNote` | 录音纪要 | L3 | 子串同形:ai.pane.voiceSubtitles.conflict |
| 10 引用与来源（@ / | composer.* | `composer.actions.recordingNoteLiveVoiceUnavailable` | Live Voice 任务中不可使用录音纪要 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.recordingNoteCreateFailed` | 无法创建录音纪要，请重试。 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.betaTag` | Beta | skip | 枚举/样式值非文案(值层主筛) |
| 10 引用与来源（@ / | composer.* | `composer.actions.polishPrompt` | 润色提示词 | L1 | ai.pane.promptPolish.ariaLabel |
| 10 引用与来源（@ / | composer.* | `composer.actions.polishPromptFailed` | 暂时无法润色提示词，草稿已保留。 | L1 | ai.pane.promptPolish.failureDraftKept |
| 10 引用与来源（@ / | composer.* | `composer.actions.polishPromptRestartRequired` | 提示词润色需要重启 Qoder 后生效，草稿已保留。 | L3 | 子串同形:ai.toolCall.prompt |
| 10 引用与来源（@ / | composer.* | `composer.actions.unavailable` | 稍后接入 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.attachmentLimitReached` | 附件已达 20 个，请先移除一个附件。 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.quickNotePasteInvalidPayload` | 复制的速记板数据无法识别。 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.quickNotePasteUnsupportedFormat` | 复制的速记板包含不支持的图片格式。 | L3 | 子串同形:ecosystem.capUnsupported |
| 10 引用与来源（@ / | composer.* | `composer.actions.quickNotePasteInvalidImage` | 复制的速记板图片数据不完整。 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.quickNotePasteTooManyImages` | 每条速记最多包含 5 张图片。 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.quickNotePasteInvalidSize` | 复制的速记板包含大小无效的图片。 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.quickNotePasteTotalSize` | 复制的速记板图片总大小超过 20 MB。 | L3 | 子串同形:admin.saas.stats.totalSize |
| 10 引用与来源（@ / | composer.* | `composer.actions.quickNotePasteIncomplete` | 无法完整粘贴这条速记，请先移除部分附件后重试。 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.skillLoading` | 正在加载 Skill… | L2 | chat.skillLibrary.errorLoad (J=0.55) |
| 10 引用与来源（@ / | composer.* | `composer.actions.skillLoadFailed` | Skill 暂时无法加载 | L2 | unifiedSuggestion.sourceFailedTag (J=0.50) |
| 10 引用与来源（@ / | composer.* | `composer.actions.skillUnavailable` | 当前上下文暂不支持选择 Skill | L3 | 子串同形:ecosystem.capUnsupported |
| 10 引用与来源（@ / | composer.* | `composer.actions.skillEmpty` | 暂无可用 Skill | L2 | chat.skillLibrary.empty (J=0.56) |
| 10 引用与来源（@ / | composer.* | `composer.actions.skillSearchLabel` | 搜索 Skill | L2 | chat.skillLibrary.searchPlaceholder (J=0.86) |
| 10 引用与来源（@ / | composer.* | `composer.actions.skillSearchPlaceholder` | 搜索技能 | L2 | floatingChat.openclaw.searchSkills (J=0.60) |
| 10 引用与来源（@ / | composer.* | `composer.actions.skillSearchEmpty` | 未找到匹配的 Skill | L2 | skillMarket.notFoundTitle (J=0.50) |
| 10 引用与来源（@ / | composer.* | `composer.actions.manageSkills` | 管理技能 | L1 | apiKeyPerms.skillsWrite |
| 10 引用与来源（@ / | composer.* | `composer.actions.exploreMoreSkills` | 探索更多技能 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.actions.skillSelected` | Skill {{skill}} 已选择 | L3 | 子串同形:commandPalette.commands.skill.keywords.1 |
| 10 引用与来源（@ / | composer.* | `composer.attachments.dropFiles` | 松开以添加文件或文件夹 | L3 | 子串同形:aiChat.org.folderLabel |
| 10 引用与来源（@ / | composer.* | `composer.attachments.pastedText` | 粘贴的文本 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.attachments.selectedText` | 选中的文本 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.attachments.convertToText` | 转为文字 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.attachments.previewImage` | 预览图片 {{name}} | L3 | 子串同形:cloudChat.header.target |
| 10 引用与来源（@ / | composer.* | `composer.attachments.imageAlt` | 图片附件：{{name}} | L3 | 子串同形:cloudChat.header.target |
| 10 引用与来源（@ / | composer.* | `composer.attachments.removeAttachment` | 移除附件 {{name}} | L2 | chat.removeTool (J=0.50) |
| 10 引用与来源（@ / | composer.* | `composer.attachments.addError` | 无法添加附件。 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.attachments.unsupportedFolder` | 当前会话不支持文件夹附件，请选择文件。 | L3 | 子串同形:ecosystem.capUnsupported |
| 10 引用与来源（@ / | composer.* | `composer.attachments.unsupportedImage` | 不支持该图片格式，仅支持 PNG、JPG、GIF 和 WebP 图片。 | L3 | 子串同形:ecosystem.capUnsupported |
| 10 引用与来源（@ / | composer.* | `composer.attachments.removeInvalid` | 请先移除不可用的附件。 | L3 | 子串同形:llmSettings.v2.health.down |
| 10 引用与来源（@ / | composer.* | `composer.attachments.requiresSession` | 请先创建任务，再在任务中添加附件。 | L3 | 子串同形:eduAi.outbound.createCampaign |
| 10 引用与来源（@ / | composer.* | `composer.attachments.dropError` | 无法读取拖入的文件或文件夹。 | L3 | 子串同形:aiChat.org.folderLabel |
| 10 引用与来源（@ / | composer.* | `composer.chatSessionDrop.prompt` | 松开以引用会话 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.chatSessionDrop.disabled` | 输入框当前不可编辑，暂时无法引用会话。 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.chatSessionDrop.loading` | 正在确认会话引用能力，请稍后重试。 | L3 | 子串同形:ai.pane.errorCatalog.API_BRIDGE_ERROR.action |
| 10 引用与来源（@ / | composer.* | `composer.chatSessionDrop.unsupported` | 当前会话不支持引用其他会话。 | L3 | 子串同形:ecosystem.capUnsupported |
| 10 引用与来源（@ / | composer.* | `composer.chatSessionDrop.self` | 不能引入当前会话自身 | L3 | 子串同形:settings.sessionCurrent |
| 10 引用与来源（@ / | composer.* | `composer.chatSessionDrop.unavailable` | 该会话不可引用，请选择未归档的独立会话。 | L3 | 子串同形:treeSelect.placeholder |
| 10 引用与来源（@ / | composer.* | `composer.chatSessionDrop.duplicate` | 已引用该会话，无需重复添加。 | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.ariaLabel` | {{trigger}} 任务、Skill、插件、连接器、Agent 和文件建议 | L3 | 子串同形:agentCanvas.typeAgent |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.loading` | 正在加载任务、Skill、插件、连接器、Agent 和文件… | L3 | 子串同形:agentCanvas.typeAgent |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.empty` | 未找到匹配的任务、Skill、插件、连接器、Agent 或文件 | L3 | 子串同形:agentCanvas.typeAgent |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.pickFile` | 选择文件 | L1 | admin.members.import.selectFile |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.pickFolder` | 选择文件夹 | L1 | repoWiki.pickFolder |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.automationPluginDescription` | 创建在自动化任务中运行的定时任务 | L3 | 子串同形:floatingChat.openclaw.cronJobs |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.goalMode` | 目标 | L1 | admin.commentLogs.colTarget |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.planMode` | 计划 | L1 | agent.tabPlan |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.selectedMode` | {{label}}，已启用 | L3 | 子串同形:admin.integrations.enabled |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.skillNoDescription` | 暂无描述 | L1 | agent.noDescription |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.skillSource` | 来源：{{source}} | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.pluginNoDescription` | 暂无描述 | L1 | agent.noDescription |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.pluginId` | 插件 ID：{{id}} | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.connectorNoDescription` | 暂无描述 | L1 | agent.noDescription |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.connectorDescription.pluginWithProvider` | 由 {{provider}} 插件提供的 MCP Server | L3 | 子串同形:chat.skillLibrary.tabMcp |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.connectorDescription.plugin` | 由插件提供的 MCP Server | L2 | mcpStore.registeredTitle (J=0.50) |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.connectorDescription.marketWithProvider` | 由 {{provider}} 提供的 MCP Server | L3 | 子串同形:chat.skillLibrary.tabMcp |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.connectorDescription.market` | 来自扩展市场的 MCP Server | L3 | 子串同形:chat.skillLibrary.tabMcp |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.connectorDescription.userLocal` | 用户配置的本地 MCP Server | L3 | 子串同形:chat.skillLibrary.tabMcp |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.connectorDescription.userRemote` | 用户配置的远程 MCP Server | L3 | 子串同形:chat.skillLibrary.tabMcp |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.connectorDescription.user` | 用户配置的 MCP Server | L2 | mcpStore.registeredTitle (J=0.53) |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.connectorDescription.projectLocal` | 当前项目配置的本地 MCP Server | L3 | 子串同形:chat.skillLibrary.tabMcp |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.connectorDescription.projectRemote` | 当前项目配置的远程 MCP Server | L3 | 子串同形:chat.skillLibrary.tabMcp |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.connectorDescription.project` | 当前项目配置的 MCP Server | L3 | 子串同形:chat.skillLibrary.tabMcp |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.connectorDescription.builtin` | Qoder 内置 MCP Server | L3 | 子串同形:chat.skillLibrary.tabMcp |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.connectorDescription.generic` | MCP Server | skip | 非中文原文(不计 MISS，只报数) |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.connectorSource` | 连接器来源：{{source}} | L3 | 子串同形:commandPalette.commands.connectors.label |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.agentNoDescription` | 暂无描述 | L1 | agent.noDescription |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.agentSource` | Agent 来源：{{source}} | L3 | 子串同形:agentCanvas.typeAgent |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.chatSessionNoDescription` | Qoder 任务 | L2 | cliImport.sourceQoder (J=0.67) |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.chatSessionError` | 任务搜索暂时不可用，仍可继续选择其他上下文。 | L3 | 子串同形:ai.pane.overview.context |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.chatSessionLimit` | 一条消息最多引用 {{count}} 个任务。 | L3 | 子串同形:aiChat.messages |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.skillError` | 扩展能力暂时无法加载，仍可继续使用文件建议。 | L3 | 子串同形:unifiedSuggestion.sourceFailedTag |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.fileError` | Workspace 文件暂时无法加载，仍可继续选择扩展能力。 | L3 | 子串同形:unifiedSuggestion.sourceFailedTag |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.partialErrorAll` | 扩展能力和 Workspace 文件暂时无法加载。 | L3 | 子串同形:unifiedSuggestion.sourceFailedTag |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.removeSkill` | 移除 Skill {{skill}} | L3 | 子串同形:commandPalette.commands.skill.keywords.1 |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.unavailableReference` | {{name}}（不可用） | L2 | chat.sampling.clearParam (J=0.50) |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.skillTag` | Skill {{skill}} | skip | 非中文原文(不计 MISS，只报数) |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.pluginTag` | 插件 {{plugin}} | L2 | taskStatus.activityPlugin (J=0.57) |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.connectorTag` | 连接器 {{name}} | L2 | chat.sampling.clearParam (J=0.50) |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.agentTag` | Agent {{name}} | skip | 非中文原文(不计 MISS，只报数) |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.chatSessionTag` | 任务 {{title}} | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.issueReferenceTag` | Issue {{identifier}} | skip | 非中文原文(不计 MISS，只报数) |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.fileTag` | 项目文件 {{file}} | MISS |  |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.removedUnavailableSkills` | 已移除当前上下文中不可用的 Skill：{{skills}} | L3 | 子串同形:ai.pane.overview.context |
| 10 引用与来源（@ / | composer.* | `composer.suggestion.hint` | ↑↓ 选择 · Enter/Tab 添加 · Esc 关闭 | MISS |  |
| 10 引用与来源（@ / | newChat.* | `newChat.bindIssue` | 绑定 Issue | MISS |  |
| 10 引用与来源（@ / | newChat.* | `newChat.changeIssue` | 更换已绑定的 Issue {{identifier}} | L3 | 子串同形:admin.members.bound |
| 10 引用与来源（@ / | newChat.* | `newChat.searchIssues` | 搜索 Issue 标识、标题或项目 | MISS |  |
| 10 引用与来源（@ / | newChat.* | `newChat.unbindIssue` | 改为独立任务 | MISS |  |
| 10 引用与来源（@ / | newChat.* | `newChat.noIssues` | 还没有可以绑定的 Issue | MISS |  |
| 10 引用与来源（@ / | newChat.* | `newChat.noMatchingIssues` | 没有匹配的 Issue | MISS |  |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
