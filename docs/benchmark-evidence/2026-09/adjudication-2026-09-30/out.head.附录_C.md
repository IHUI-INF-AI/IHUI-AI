<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 逐条对账导出：附录 C

生成：`node docs/benchmark-evidence/2026-09/reconcile.mjs qoder/chat-stream-inventory.md --section "附录 C" --out <本文件>`

四态口径：**L1 逐字 / L2 近义(Jaccard≥0.5) 不算差距**；L3=需人工核（键同名或子串同形，形似不等于等同）；MISS=候选缺失，须逐条定性后才可写进台账。控制测量在运行前已通过，故 MISS 不是匹配器空转的产物。

> 族级归属：128 行全部归到某个族，族级计数可用于归因。

> 不计 MISS 的 skip 明细（逐档报名）：枚举/样式值非文案(值层主筛) 47 条 / 非中文原文(不计 MISS，只报数) 4 条 / 样式键名非文案(第二道) 20 条

| 节 | 族 | 竞品键 | 竞品原文 | 判定 | 我方对应 |
| --- | --- | --- | --- | --- | --- |
| 附录 C | defaultMermaidDiagramLabels | `defaultMermaidDiagramLabels.copy` | 复制代码 | L1 | a11y.copyCode |
| 附录 C | defaultMermaidDiagramLabels | `defaultMermaidDiagramLabels.copied` | 代码已复制 | L1 | a11y.codeCopied |
| 附录 C | defaultMermaidDiagramLabels | `defaultMermaidDiagramLabels.downloadJpg` | 下载 Mermaid JPG | L3 | 子串同形:chat.vendor.mai |
| 附录 C | defaultMermaidDiagramLabels | `defaultMermaidDiagramLabels.viewDiagram` | 查看 Mermaid 图表 | L3 | 子串同形:chat.vendor.mai |
| 附录 C | defaultMermaidDiagramLabels | `defaultMermaidDiagramLabels.viewSource` | 查看 Mermaid 源码 | L3 | 子串同形:chat.vendor.mai |
| 附录 C | defaultMermaidDiagramLabels | `defaultMermaidDiagramLabels.renderingDiagram` | 正在渲染图表... | MISS |  |
| 附录 C | defaultMermaidDiagramLabels | `defaultMermaidDiagramLabels.renderFailed` | 无法渲染 Mermaid 图表 | L3 | 子串同形:chat.vendor.mai |
| 附录 C | defaultMermaidDiagramLabels | `defaultMermaidDiagramLabels.openMermaidFullscreen` | 全屏查看 Mermaid 图表 | L3 | 子串同形:chat.vendor.mai |
| 附录 C | defaultMermaidDiagramLabels | `defaultMermaidDiagramLabels.closeMermaidFullscreen` | 关闭 Mermaid 全屏 | L3 | 子串同形:chat.vendor.mai |
| 附录 C | defaultMermaidDiagramLabels | `defaultMermaidDiagramLabels.zoomIn` | 放大 | L1 | a11y.zoomIn |
| 附录 C | defaultMermaidDiagramLabels | `defaultMermaidDiagramLabels.zoomOut` | 缩小 | L1 | a11y.zoomOut |
| 附录 C | defaultMermaidDiagramLabels | `defaultMermaidDiagramLabels.resetZoom` | 重置缩放 | MISS |  |
| 附录 C | defaultMermaidDiagramLabels | `defaultMermaidDiagramLabels.zoomPresets` | 缩放比例 | MISS |  |
| 附录 C | defaultMermaidDiagramLabels | `defaultMermaidDiagramLabels.zoomToFit` | 适应屏幕 | MISS |  |
| 附录 C | defaultMermaidDiagramLabels | `defaultMermaidDiagramLabels.mermaidFullscreenTitle` | Mermaid 图表 | L2 | a11y.mermaidRenderFailed (J=0.50) |
| 附录 C | codeBlockLabels(匿名) | `codeBlockLabels(匿名).wrapOn` | 开启代码换行 | MISS |  |
| 附录 C | codeBlockLabels(匿名) | `codeBlockLabels(匿名).wrapOff` | 关闭代码换行 | MISS |  |
| 附录 C | codeBlockLabels(匿名) | `codeBlockLabels(匿名).expand` | 展开代码 | L1 | 源码字面量 |
| 附录 C | codeBlockLabels(匿名) | `codeBlockLabels(匿名).collapse` | 收起代码 | L1 | 源码字面量 |
| 附录 C | codeBlockLabels(匿名) | `codeBlockLabels(匿名).streaming` | 生成中 | L1 | aiGeneration.statusGenerating |
| 附录 C | codeBlockLabels(匿名) | `codeBlockLabels(匿名).tone` | inherit | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | codeBlockLabels(匿名) | `codeBlockLabels(匿名).style` | material | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | markdownImage/Table | `markdownImage/Table.copyImage` | 复制为图片 | MISS |  |
| 附录 C | markdownImage/Table | `markdownImage/Table.copyMarkdown` | 复制 Markdown | L1 | chat.permission.contextMenu.copyMarkdown |
| 附录 C | markdownImage/Table | `markdownImage/Table.copiedImage` | 图片已复制 | L1 | ai.pane.elementPack.imagePreview.copySuccess |
| 附录 C | markdownImage/Table | `markdownImage/Table.copiedMarkdown` | Markdown 已复制 | L2 | chat.permission.toast.copiedMarkdown (J=0.82) |
| 附录 C | markdownImage/Table | `markdownImage/Table.copyImageFailed` | 图片复制失败，重试 | L2 | ai.pane.elementPack.imagePreview.copyFailed (J=0.71) |
| 附录 C | markdownImage/Table | `markdownImage/Table.copyMarkdownFailed` | Markdown 复制失败，重试 | L2 | chat.permission.contextMenu.copyMarkdown (J=0.57) |
| 附录 C | markdownImage/Table | `markdownImage/Table.phase` | idle | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | markdownImage/Table | `markdownImage/Table.phase` | copying | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | markdownImage/Table | `markdownImage/Table.phase` | copied | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | markdownImage/Table | `markdownImage/Table.phase` | failed | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | markdownImage/Table | `markdownImage/Table.className` | size-3.5 | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | markdownImage/Table | `markdownImage/Table.className` | size-3.5 | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | markdownImage/Table | `markdownImage/Table.className` | size-3.5 | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).backgroundColor` | var(--q4add82) | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).color` | inherit | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).textDecorationLine` | underline | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).textDecorationColor` | var(--q48da17) | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).textDecorationThickness` | 2px | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).openInBrowser` | 在浏览器中打开 | L2 | auth.loginInBrowser (J=0.50) |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).openInExternalBrowser` | 在外部浏览器中打开 | L2 | workPanel.openExternal (J=0.67) |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).copyLink` | 复制链接 | L1 | aiChat.copyLink |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).copied` | 已复制 | L1 | workPanel.linkCopied |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).previewLoading` | 正在加载链接预览... | MISS |  |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).previewUnavailable` | 无法读取链接预览 | MISS |  |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).viewFileInSidebar` | 在右侧栏查看 | MISS |  |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).viewFileInNewWindow` | 新窗口查看 | MISS |  |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).openFile` | 默认应用打开 | MISS |  |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).openWith` | 打开方式 | L1 | ai.pane.writingBlock.openIn.label |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).openWithLoading` | 正在加载应用... | MISS |  |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).openWithNoApps` | 没有可用应用 | MISS |  |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).openWithDefault` | 默认 | L1 | admin.oss.colDefault |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).copyPath` | 复制路径 | L1 | ai.toolCall.copyPath |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).copyFileContent` | 复制文件内容 | MISS |  |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).revealFile` | 在文件管理器中显示 | MISS |  |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).animation` | blurIn | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).easing` | ease-out | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).sep` | word | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).http` | &&t1.protocol!== | skip | 非中文原文(不计 MISS，只报数) |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).https` | )return e1;const n1=t1.hostname?.replace(/^www | skip | 非中文原文(不计 MISS，只报数) |
| 附录 C | linkFileActions(匿名) | `linkFileActions(匿名).http` | &&r1.protocol!== | skip | 非中文原文(不计 MISS，只报数) |
| 附录 C | defaultLabels$2 | `defaultLabels$2.panel` | 终端面板 | MISS |  |
| 附录 C | defaultLabels$2 | `defaultLabels$2.tabs` | 终端列表 | MISS |  |
| 附录 C | defaultLabels$2 | `defaultLabels$2.create` | 新建终端 | L1 | aiChat.terminalDock.newSession |
| 附录 C | defaultLabels$2 | `defaultLabels$2.close` | 关闭终端面板 | L2 | ide.terminalSessionList.closeTerminalAria (J=0.60) |
| 附录 C | defaultLabels$2 | `defaultLabels$2.exited` | 已退出 | L1 | ide.terminalSessionList.statusExited |
| 附录 C | defaultLabels$2 | `defaultLabels$2.emptyTitle` | 还没有终端 | MISS |  |
| 附录 C | defaultLabels$2 | `defaultLabels$2.emptyDescription` | 在当前会话的工作目录中打开一个终端。 | L3 | 子串同形:settings.sessionCurrent |
| 附录 C | defaultLabels$2 | `defaultLabels$2.errorTitle` | 无法创建终端 | MISS |  |
| 附录 C | defaultLabels$2 | `defaultLabels$2.retry` | 重试 | L1 | admin.relayParamOps.retry |
| 附录 C | defaultLabels$2 | `defaultLabels$2.switchToDark` | 切换为暗色终端 | MISS |  |
| 附录 C | defaultLabels$2 | `defaultLabels$2.switchToLight` | 切换为亮色终端 | MISS |  |
| 附录 C | defaultLabels$2 | `defaultLabels$2.className` | text-[var(--qdd6e93)] | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | defaultLabels$2 | `defaultLabels$2.className` | text-[var(--q716791)] | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | defaultLabels$2 | `defaultLabels$2.role` | tablist | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | defaultLabels$2 | `defaultLabels$2.className` | flex shrink-0 items-center gap-1 | skip | 样式键名非文案(第二道) |
| 附录 C | defaultLabels$2 | `defaultLabels$2.placement` | top | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | defaultLabels$2 | `defaultLabels$2.variant` | ghost | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | defaultLabels$2 | `defaultLabels$2.size` | sm | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | defaultLabels$2 | `defaultLabels$2.placement` | top | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | defaultLabels$2 | `defaultLabels$2.variant` | ghost | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | defaultLabels$2 | `defaultLabels$2.size` | sm | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.collapseSidebar` | 收起侧导航 | MISS |  |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.expandSidebar` | 展开侧导航 | MISS |  |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.goBack` | 后退 | L1 | workPanel.back |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.goForward` | 前进 | L1 | workPanel.forward |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.type` | button | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.variant` | ghost | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.size` | md | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.className` | [-webkit-app-region:no-drag] | skip | 样式键名非文案(第二道) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.position` | left | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.className` | flex shrink-0 items-center [-webkit-app-region | skip | 样式键名非文案(第二道) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.className` | flex w-[72px] shrink-0 items-center gap-2 | skip | 样式键名非文案(第二道) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.className` | size-3 rounded-full bg-error | skip | 样式键名非文案(第二道) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.className` | size-3 rounded-full bg-warning | skip | 样式键名非文案(第二道) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.className` | size-3 rounded-full bg-success | skip | 样式键名非文案(第二道) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.className` | flex items-center gap-0.5 [-webkit-app-region: | skip | 样式键名非文案(第二道) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.placement` | bottom | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.placement` | bottom | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.type` | button | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.variant` | ghost | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.size` | md | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | DEFAULT_LABELS$3 | `DEFAULT_LABELS$3.className` | [-webkit-app-region:no-drag] | skip | 样式键名非文案(第二道) |
| 附录 C | defaultFileTreeLabels | `defaultFileTreeLabels.density` | default | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | defaultFileTreeLabels | `defaultFileTreeLabels.folderActivation` | toggle | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | defaultFileTreeLabels | `defaultFileTreeLabels.role` | tree | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | defaultFileTreeLabels | `defaultFileTreeLabels.role` | group | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | defaultFileTreeLabels | `defaultFileTreeLabels.className` | qoder-file-tree-material-icon | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | defaultFileTreeLabels | `defaultFileTreeLabels.tone` | inherit | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | defaultFileTreeLabels | `defaultFileTreeLabels.style` | material | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | SuggestionBanner | `SuggestionBanner.d` | M12.667 8 10 12h4l-2.667 4 | skip | 非中文原文(不计 MISS，只报数) |
| 附录 C | SuggestionBanner | `SuggestionBanner.initial` | normal | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | SuggestionBanner | `SuggestionBanner.className` | size-4 | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | SuggestionBanner | `SuggestionBanner.className` | text-primary | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | SuggestionBanner | `SuggestionBanner.type` | button | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | tagPill | `tagPill.className` | size-full object-cover | skip | 样式键名非文案(第二道) |
| 附录 C | tagPill | `tagPill.className` | flex min-w-0 flex-1 flex-col gap-1 | skip | 样式键名非文案(第二道) |
| 附录 C | tagPill | `tagPill.className` | flex min-w-0 items-center gap-2 | skip | 样式键名非文案(第二道) |
| 附录 C | tagPill | `tagPill.className` | min-w-0 flex-1 | skip | 样式键名非文案(第二道) |
| 附录 C | tagPill | `tagPill.className` | min-w-0 flex-1 | skip | 样式键名非文案(第二道) |
| 附录 C | tagPill | `tagPill.className` | block min-w-0 max-w-full truncate text-[13px]  | skip | 样式键名非文案(第二道) |
| 附录 C | tagPill | `tagPill.className` | flex min-w-0 flex-1 flex-col gap-1 | skip | 样式键名非文案(第二道) |
| 附录 C | tagPill | `tagPill.className` | flex min-w-0 items-center gap-2 | skip | 样式键名非文案(第二道) |
| 附录 C | tagPill | `tagPill.className` | flex min-w-0 flex-1 items-center gap-1 | skip | 样式键名非文案(第二道) |
| 附录 C | tagPill | `tagPill.className` | flex size-3 shrink-0 items-center justify-cent | skip | 样式键名非文案(第二道) |
| 附录 C | tagPill | `tagPill.dir` | ltr | skip | 枚举/样式值非文案(值层主筛) |
| 附录 C | tagPill | `tagPill.className` | block min-w-0 max-w-full truncate text-[13px]  | skip | 样式键名非文案(第二道) |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
