<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 我方侧 AI 对话流清单·组3(web 端;第 9-12 类;D205/D160 拆票 3/4)

> 口径:端=web(用户在 web 端看到的对话流可见元素;实现位以 apps/web/src 为主,含 web 消费的 packages/i18n/messages 语言包与 packages/shared 词包命名空间)。数据源三行:①`docs/benchmark-evidence/2026-09/web-bind2.tsv`(2026-09 快照,271 行,收编行保留其原始行号,条目尾注「(收编自 web-bind2.tsv)」);②本仓源码补查,行号一律 `git grep -n "<模式>" HEAD -- <路径>` 取 HEAD 面(工作树有未提交改动,故不取工作树行号;组件内置默认文案标「(组件字面量)」);③竞品同名节(qoder/trae/codex chat-stream-inventory.md 的 ## 9-## 12)只用于对齐类别边界,未抄录。条目格式:`- \`文件:行号\` \`i18n键\` 「中文原文」—— 能力一句话`,全部为顶层 `- ` 行,不得嵌套。两态纪律:未取证到≠不存在≠不必做;§0 先声明缺口再给清单,各类末尾附「未取证到」小节。

## 0 逐类「未取证到」核对(先声明缺口,再给清单)

> 每条=字面搜索零命中证据(git grep 对 HEAD 面,exit 1 即 0 命中)。

| 类 | 问题 | 结果 |
| --- | --- | --- |
| 9 | 竞品式「自动压缩阈值百分比」标签(autoCompactThreshold)我方 web 端是否存在 | `git grep -n "autoCompactThreshold" HEAD -- apps/web/src packages/ui-react packages/shared` → 0 命中 |
| 9 | 竞品式上下文构成「自动压缩预留」分类(auto_compact)是否存在 | `git grep -n "auto_compact\|自动压缩预留" HEAD -- apps/web/src packages/i18n/messages/web/zh-CN.json packages/shared/src` → 0 命中 |
| 10 | 竞品式「速记板」(quickNotes / 速记)我方 web 端是否存在 | `git grep -n "quickNotes\|速记" HEAD -- apps/web/src` → 0 命中 |
| 11 | 竞品式队列「插队」(sendNow / 插队)动作是否存在 | `git grep -n "插队\|sendNow" HEAD -- apps/web/src packages/shared/src` → 0 命中 |
| 12 | QuotaActionFamily 消费的 `quotaAction.*` 键是否已落语言包 | `git grep -n "quotaAction" HEAD -- packages/i18n/messages` → 0 命中(组件经 props 注入 t,词包本体未落,中文原文暂不可证) |

## 9 上下文与压缩

> 类别判据锚:收上下文窗口占用显示(环/条/徽标)、窗口额度条、自动压缩分隔线与状态条、手动压缩入口、截断提示、压缩归档回看、压缩被拦原因;对齐 qoder ## 9「上下文与压缩」(chatActivity.contextCompression.*)与 trae ## 9「上下文(窗口/使用率/压缩)」边界。不含计量成本(第 13 类,他票)。

- `apps/web/src/components/ai/progress-sections/compression-divider.tsx:51` `chat.compaction.ceilingTitle` 「上下文压缩已达上限」—— 压缩达上限的天花板提示(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/compression-divider.tsx:52` `chat.compaction.ceilingHint` 「建议开始新对话,或减少上下文(如禁用不必要的 MCP 工具 / 技能)。」—— 上限达成后的建议话术(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/compression-divider.tsx:64` `chat.compaction.dividerDescription` 「上下文已从 {before} tokens 压缩至 {after} tokens,更早的对话被折叠为摘要」—— 压缩分隔线前后 token 披露(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/compression-divider.tsx:80` `chat.compaction.dividerTitle` 「上方历史已压缩为摘要」—— 历史压缩分隔线标题(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/compression-divider.tsx:83` `chat.compaction.dividerSaved` 「节省 {ratio}%」—— 压缩节省比例徽章(收编自 web-bind2.tsv)
- `apps/web/src/components/chat/compaction-status-bar.tsx:141` (组件字面量) 「正在压缩上下文...」—— 自动压缩进行中状态条标题
- `apps/web/src/components/chat/compaction-status-bar.tsx:141` (组件字面量) 「上下文已自动压缩」—— 自动压缩完成状态条标题
- `apps/web/src/components/chat/compaction-status-bar.tsx:150` (组件字面量) 「压缩 ${omittedCount} 条历史为摘要」—— 完成态省略量披露(模板字面量)
- `apps/web/src/components/chat/compaction-status-bar.tsx:172` `chat.compaction.truncatedNotice` 「最后一条消息过长,已截断内容以保持对话可用(已省略 {count} 条)」—— 截断兜底提示(键文见 packages/i18n/messages/web/zh-CN.json:10843)
- `apps/web/src/components/chat/compaction-status-bar.tsx:173` `chat.compaction.truncatedNoticeNoCount` 「最后一条消息过长,已截断内容以保持对话可用」—— 截断兜底提示无计数版(zh-CN.json:10844)
- `apps/web/src/components/chat/compaction-status-bar.tsx:185` `chat.compaction.viewArchived` 「查看已压缩的 {count} 条原始消息」—— 压缩归档回看入口(zh-CN.json:10845)
- `apps/web/src/components/chat/compaction-status-bar.tsx:277` `chat.compaction.archiveTitle` 「压缩归档 · 原始消息」—— 归档弹层标题(zh-CN.json:10846)
- `apps/web/src/components/chat/compaction-status-bar.tsx:316` `chat.compaction.archiveEmpty` 「暂无压缩归档」—— 归档空态(zh-CN.json:10847)
- `apps/web/src/components/chat/add-menu-popover.tsx:419` `chat.compaction.compactButton` 「压缩上下文」—— 添加菜单内手动压缩入口(zh-CN.json:10849)
- `apps/web/src/components/chat/add-menu-popover.tsx:440` `chat.compaction.compacting` 「正在压缩上下文...」—— 手动压缩进行中态(zh-CN.json:10850)
- `apps/web/src/components/ai/context-usage-ring.tsx:629` `chat.contextUsage.title` 「上下文使用情况」—— 上下文用量环面板标题(zh-CN.json:10901)
- `apps/web/src/components/ai/context-usage-ring.tsx:471` `chat.contextUsage.triggerLabel` 「上下文已使用 {percent}%,{used}/{max},点击查看详情」—— 用量环触发器读屏文案(zh-CN.json:10902)
- `apps/web/src/components/ai/context-usage-ring.tsx:646` `chat.contextUsage.used` 「已使用」—— 已用 token 行(zh-CN.json:10903)
- `apps/web/src/components/ai/context-usage-ring.tsx:647` `chat.contextUsage.max` 「最大容量」—— 窗口容量行(zh-CN.json:10896)
- `apps/web/src/components/ai/context-usage-ring.tsx:648` `chat.contextUsage.messages` 「消息数」—— 消息计数行(zh-CN.json:10898)
- `apps/web/src/components/ai/context-usage-ring.tsx:668` `chat.contextUsage.breakdownTitle` 「Token 分类明细」—— 构成明细标题(zh-CN.json:10879)
- `apps/web/src/components/ai/context-usage-ring.tsx:671` `chat.contextUsage.topContributor` 「占用最高：{name} {share}」—— 最大占比条目标注(zh-CN.json:10922)
- `apps/web/src/components/ai/context-usage-ring.tsx:812` `chat.contextUsage.cacheHit` 「缓存命中 {ratio}（读回 {read}）」—— 前缀缓存命中披露(zh-CN.json:10908)
- `apps/web/src/components/ai/context-usage-ring.tsx:832` `chat.contextUsage.cacheUnavailable` 「本轮用量帧未携带缓存读数，无法判断命中与否」—— 缓存读数缺失降级句(zh-CN.json:10910)
- `apps/web/src/components/ai/context-usage-ring.tsx:842` `chat.contextUsage.compressTitle` 「压缩上下文」—— 面板内手动压缩区标题(zh-CN.json:10888)
- `apps/web/src/components/ai/context-usage-ring.tsx:845` `chat.contextUsage.noConversation` 「新建任务后才能压缩」—— 无会话时压缩禁用原因(zh-CN.json:10899)
- `apps/web/src/components/ai/context-usage-ring.tsx:865` `chat.contextUsage.compressTo200k` 「压缩到 20 万字符」—— 压缩目标档位一(zh-CN.json:10890)
- `apps/web/src/components/ai/context-usage-ring.tsx:883` `chat.contextUsage.compressTo1m` 「压缩到 100 万字符」—— 压缩目标档位二(zh-CN.json:10889)
- `apps/web/src/components/ai/context-usage-ring.tsx:893` `chat.contextUsage.compressSuccess` 「压缩成功」—— 压缩成功反馈(zh-CN.json:10887)
- `apps/web/src/components/ai/context-usage-ring.tsx:438` `chat.contextUsage.compressResultDesc` 「原始 {original} 字符 → 压缩后 {compressed} 字符」—— 压缩结果明细(zh-CN.json:10886)
- `apps/web/src/components/ai/context-usage-ring.tsx:444` `chat.contextUsage.compressFailed` 「压缩失败」—— 压缩失败 toast(zh-CN.json:10885)
- `apps/web/src/components/ai/context-usage-ring.tsx:896` `chat.contextUsage.ratio` 「压缩比」—— 压缩比标注(zh-CN.json:10900)
- `apps/web/src/components/ai/context-usage-ring.tsx:921` `chat.contextUsage.disclaimer` 「Token 数为客户端估算,与服务端精确计数可能存在 ±10% 误差。压缩后内容将作为后续对话的上下文摘要。」—— 估算口径免责句(zh-CN.json:10893)
- `apps/web/src/components/chat/context-budget-bar.tsx:79` `chat.budgetBar.title` 「今日 AI 额度」—— 输入区上方窗口额度条标题(zh-CN.json:10645)
- `apps/web/src/components/chat/context-budget-bar.tsx:80` `chat.budgetBar.critical` 「即将用尽」—— 额度 critical 档标注(zh-CN.json:10646)
- `apps/web/src/components/chat/context-budget-bar.tsx:83` `chat.budgetBar.tokens` 「已用 {used} / {limit}」—— 额度用量读数(zh-CN.json:10647)
- `apps/web/src/components/chat/context-budget-bar.tsx:90` `chat.budgetBar.resetAt` 「{time} 重置」—— 额度重置时间(zh-CN.json:10648)
- `apps/web/src/components/context-compaction/ContextCompactionPanel.tsx:58` `contextCompaction.title` 「上下文压缩」—— 压缩感知面板标题(packages/i18n/messages/web/zh-CN.json:18574)
- `apps/web/src/components/context-compaction/ContextCompactionPanel.tsx:63` `contextCompaction.totalCompactions` 「累计压缩」—— 压缩次数累计(packages/i18n/messages/web/zh-CN.json:18579)
- `apps/web/src/components/context-compaction/ContextCompactionPanel.tsx:114` `contextCompaction.tokenChange` 「Token 变化」—— 压缩前后 token 变化行(packages/i18n/messages/web/zh-CN.json:18582)
- `apps/web/src/components/context-compaction/ContextCompactionPanel.tsx:119` `contextCompaction.summaryPreview` 「摘要预览」—— 压缩摘要预览(packages/i18n/messages/web/zh-CN.json:18584)
- `apps/web/src/components/ai/progress-sections/overview-section.tsx:160` `ai.pane.overview.context` 「上下文」—— 任务总览上下文占位标签(收编自 web-bind2.tsv)
- `packages/i18n/messages/web/zh-CN.json:7433` `ai.pane.inputNotices.compaction.block.cause.runningTurn` 「当前 Turn 正在运行中」—— 压缩被拦原因·Turn 运行中(消费方 apps/web/src/components/chat/input-notice-banner.tsx:69)
- `packages/i18n/messages/web/zh-CN.json:7438` `ai.pane.inputNotices.compaction.block.consequence.runningTurn` 「压缩在当前 Turn 完成后执行，不能插入正在运行的 Turn」—— 压缩被拦后果说明
- `packages/i18n/messages/web/zh-CN.json:7434` `ai.pane.inputNotices.compaction.block.cause.insufficientCredits` 「压缩会消耗少量积分」—— 压缩被拦原因·积分

### 未取证到(第 9 类)
- 竞品式「自动压缩阈值百分比」显示:`git grep -n "autoCompactThreshold" HEAD -- apps/web/src packages/ui-react packages/shared` → 0 命中;可能由后端策略静默执行/可能确实未做阈值可视化,不下「没有」结论
- 竞品式「自动压缩预留」构成分类:`git grep -n "auto_compact\|自动压缩预留" HEAD -- apps/web/src packages/i18n/messages/web/zh-CN.json packages/shared/src` → 0 命中;可能构成分类法不同(我方用 Token 分类明细),不下结论

## 10 引用与来源(@ / 附件 / 来源 / 速记 / 批注)

> 类别判据锚:收 @提及(mention 弹层)、附件(拖放/上传/来源卡)、引用与引用回复、划词批注与文档批注锚点、记忆引用、来源溯源;对齐 qoder ## 10(chatSession.selectionActions/selectionAnnotations/quickNotes 等)与 trae ## 10「引用与输入」边界。速记板经零命中核对我方 web 端未取证到(见 §0)。

- `apps/web/src/components/ai/progress-sections/citation-bar.tsx:69` `ai.pane.citationBar.title` 「引用来源」—— 回复内引用来源条标题(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/cloud-chat-activity-card.tsx:75` `cloudChat.action.attach.label` 「附加云端聊天」—— 附加云端聊天为上下文(收编自 web-bind2.tsv)
- `packages/i18n/messages/web/zh-CN.json:10618` `chat.selectionAnnotations.hoverHint` 「悬停查看批注」—— 划词批注悬停提示
- `packages/i18n/messages/web/zh-CN.json:10619` `chat.selectionAnnotations.selectedText` 「{{index}}. 选中文字」—— 批注选中文字条目
- `packages/i18n/messages/web/zh-CN.json:10620` `chat.selectionAnnotations.noComment` 「未添加评论」—— 批注无评论态
- `packages/i18n/messages/web/zh-CN.json:10621` `chat.selectionAnnotations.commentPlaceholder` 「添加可选评论…」—— 批注评论输入占位
- `packages/i18n/messages/web/zh-CN.json:10622` `chat.selectionAnnotations.commentAriaLabel` 「划词批注评论」—— 批注评论读屏标签
- `packages/i18n/messages/web/zh-CN.json:10623` `chat.selectionAnnotations.addComment` 「添加评论」—— 批注添加评论动作
- `packages/i18n/messages/web/zh-CN.json:10624` `chat.selectionAnnotations.removeOne` 「移除批注 {{index}}」—— 移除单条批注
- `packages/i18n/messages/web/zh-CN.json:10625` `chat.selectionAnnotations.removeAll` 「移除全部划词批注」—— 清空批注
- `packages/i18n/messages/web/zh-CN.json:10626` `chat.selectionAnnotations.add` 「添加批注」—— 添加批注动作
- `packages/i18n/messages/web/zh-CN.json:7501` `ai.pane.annotationAnchors.label.pdf` 「PDF 第 {page} 页」—— 文档批注锚点·PDF 页码
- `packages/i18n/messages/web/zh-CN.json:7503` `ai.pane.annotationAnchors.label.docxText` 「文档第 {paragraph} 段」—— 批注锚点·docx 段落
- `packages/i18n/messages/web/zh-CN.json:7506` `ai.pane.annotationAnchors.label.pptxComment` 「批注 {element}」—— 批注锚点·ppt 批注元素
- `packages/i18n/messages/web/zh-CN.json:7509` `ai.pane.annotationAnchors.label.xlsxSelected` 「已选择 {range}」—— 批注锚点·表格选区
- `packages/i18n/messages/web/zh-CN.json:7511` `ai.pane.annotationAnchors.taskInputPlaceholder` 「描述希望 Agent 修改或检查的内容」—— 批注转任务输入占位
- `packages/i18n/messages/web/zh-CN.json:7512` `ai.pane.annotationAnchors.addToTask` 「添加到任务」—— 批注转任务动作
- `packages/i18n/messages/web/zh-CN.json:7516` `ai.pane.annotationAnchors.ariaLabel` 「文档批注锚点」—— 批注锚点读屏标签
- `packages/i18n/messages/web/zh-CN.json:11315` `chat.selectionActions.ariaLabel` 「选中文本操作」—— 划词操作菜单标签
- `packages/i18n/messages/web/zh-CN.json:11316` `chat.selectionActions.addAsAttachment` 「作为附件添加」—— 选中文本转附件
- `packages/i18n/messages/web/zh-CN.json:11317` `chat.selectionActions.attachmentName` 「选中的文本」—— 选中文本附件名
- `packages/i18n/messages/web/zh-CN.json:11318` `chat.selectionActions.attachmentLimitReached` 「附件已达 {limit} 个,请先移除一个再添加选中文本。」—— 附件上限提示
- `packages/i18n/messages/web/zh-CN.json:11304` `chat.referenceCount` 「{count} 个引用」—— 消息引用计数
- `packages/i18n/messages/web/zh-CN.json:11310` `chat.conversationDragReferenced` 「已引用会话内容」—— 拖拽引用会话反馈
- `packages/i18n/messages/web/zh-CN.json:11312` `chat.quoteSelection` 「引用选中」—— 划词引用动作
- `packages/i18n/messages/web/zh-CN.json:11320` `chat.quotedReplyAssistant` 「引用 AI 回复」—— 引用 AI 回复动作
- `packages/i18n/messages/web/zh-CN.json:11321` `chat.quotedReplyUser` 「引用用户消息」—— 引用用户消息动作
- `packages/i18n/messages/web/zh-CN.json:10729` `chat.addContextReference` 「添加为上下文引用」—— 添加菜单·上下文引用入口
- `packages/i18n/messages/web/zh-CN.json:10731` `chat.addMenuLabel` 「添加」—— 添加菜单按钮(引用/附件入口聚合)
- `packages/i18n/messages/web/zh-CN.json:10631` `chat.mentionEngine.tabFile` 「文件」—— @提及·文件页签
- `packages/i18n/messages/web/zh-CN.json:10632` `chat.mentionEngine.tabFolder` 「文件夹」—— @提及·文件夹页签
- `packages/i18n/messages/web/zh-CN.json:10633` `chat.mentionEngine.tabSymbol` 「符号」—— @提及·符号页签
- `packages/i18n/messages/web/zh-CN.json:10634` `chat.mentionEngine.tabDatabase` 「数据库」—— @提及·数据库页签
- `packages/i18n/messages/web/zh-CN.json:10635` `chat.mentionEngine.tabWeb` 「网页」—— @提及·网页页签
- `packages/i18n/messages/web/zh-CN.json:10636` `chat.mentionEngine.searching` 「正在检索…」—— @提及检索中态
- `packages/i18n/messages/web/zh-CN.json:10637` `chat.mentionEngine.loadFailed` 「检索失败」—— @提及检索失败态
- `packages/i18n/messages/web/zh-CN.json:10638` `chat.mentionEngine.noMatch` 「无匹配结果」—— @提及空态
- `packages/i18n/messages/web/zh-CN.json:10987` `chat.mentionPopover.removeLabel` 「移除 {label}」—— 移除已插引用
- `packages/i18n/messages/web/zh-CN.json:10934` `chat.dropAttachmentHint` 「释放鼠标以添加附件(图片/视频)」—— 拖放附件提示
- `packages/i18n/messages/web/zh-CN.json:10906` `chat.contextUsage.uploading` 「附件上传中」—— 附件上传态标注
- `packages/i18n/messages/web/zh-CN.json:7391` `ai.pane.inputSources.snapshot.attachApp` 「附加 {appName}」—— 输入源卡·附加应用快照
- `packages/i18n/messages/web/zh-CN.json:7397` `ai.pane.inputSources.snapshot.enable` 「启用智能快照」—— 输入源卡·启用动作
- `packages/i18n/messages/web/zh-CN.json:7398` `ai.pane.inputSources.snapshot.firstRunGuideTitle` 「首次使用智能快照」—— 快照首用引导标题
- `packages/i18n/messages/web/zh-CN.json:7399` `ai.pane.inputSources.snapshot.firstRunGuideBody` 「智能快照会为当前应用创建上下文快照，消息将自动附带应用信息」—— 快照首用引导正文
- `packages/i18n/messages/web/zh-CN.json:7403` `ai.pane.inputSources.route.appSnapshot` 「应用快照」—— 输入源路由·应用快照
- `packages/i18n/messages/web/zh-CN.json:7420` `ai.pane.memoryRefs.count` 「{count} 条记忆引用」—— 记忆引用计数
- `packages/i18n/messages/web/zh-CN.json:7421` `ai.pane.memoryRefs.tooltip` 「引用的记忆」—— 记忆引用悬停
- `packages/i18n/messages/web/zh-CN.json:7422` `ai.pane.memoryRefs.empty` 「暂无记忆引用」—— 记忆引用空态
- `packages/i18n/messages/web/zh-CN.json:18587` `deepResearch.sourcesTitle` 「来源溯源」—— 深度研究来源溯源标题
- `packages/i18n/messages/web/zh-CN.json:18588` `deepResearch.confidenceLabel` 「置信度」—— 来源置信度标注
- `packages/i18n/messages/web/zh-CN.json:18589` `deepResearch.verifiedLabel` 「已核验」—— 来源已核验徽章
- `packages/i18n/messages/web/zh-CN.json:18590` `deepResearch.unverifiedLabel` 「待核验」—— 来源待核验徽章
- `packages/i18n/messages/web/zh-CN.json:18593` `deepResearch.sourceTier.authoritative` 「官方」—— 来源层级·官方
- `packages/i18n/messages/web/zh-CN.json:10904` `chat.contextUsage.referenceTitle` 「上下文引用」—— 用量环·上下文引用区标题
- `packages/i18n/messages/web/zh-CN.json:10905` `chat.contextUsage.noReferences` 「暂无引用」—— 上下文引用空态

### 未取证到(第 10 类)
- 竞品式「速记板」(quickNotes / 速记):`git grep -n "quickNotes\|速记" HEAD -- apps/web/src` → 0 命中;可能规划在别的端/可能确实没做,不下「没有」结论
- @提及弹层(mention-popover.tsx)本身零 t() 调用、页签词全部走 `chat.mentionEngine.*` 词包;弹层内若无更多字面量则以上述键即全量,可能仍有运行时注入文案未取证

## 11 队列·转向·中断 / 输入区状态

> 类别判据锚:收消息排队(排队原因/撤回/编辑/重排/打断并执行)、转向插话(steer 模式与引导条)、中断(中断动作与轮次停止)、输入区状态槽(多状态聚合/停止按钮);对齐 qoder ## 11(chatQueue.* / turnInterrupted)与 trae ## 11「中断与排队」边界。

- `apps/web/src/components/ai/progress-sections/steer-notice-bar.tsx:41` `chat.steerNoticeBar.title` 「已引导 {count} 次」—— 转向引导次数条(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/steer-notice-bar.tsx:60` `chat.steerNoticeBar.moreItems` 「等 {count} 条」—— 引导条折叠余量(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:72` `ai.pane.agentActions.action.interrupt.label` 「中断」—— 智能体动作·中断(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:95` `ai.pane.agentActions.action.interrupt.inProgress` 「正在中断」—— 中断进行中(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:96` `ai.pane.agentActions.action.interrupt.completed` 「已中断」—— 中断完成(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:115` `ai.pane.agentActions.state.interrupted` 「已中断」—— 智能体状态·已中断(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/multi-agent-action-card.tsx:61` `multiAgentAction.action.interrupt.label` 「中断」—— 多智能体动作·中断(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/multi-agent-action-card.tsx:125` `multiAgentAction.action.interrupt.inProgress` 「正在中断」—— 多智能体中断进行中(收编自 web-bind2.tsv)
- `apps/web/src/components/chat/queue-interaction-bar.tsx:219` `ai.pane.queueOps.ariaLabel` 「排队消息操作条」—— 队列操作条读屏标签(词包 packages/i18n/messages/shared/zh-CN.json:2370)
- `apps/web/src/components/chat/queue-interaction-bar.tsx:240` `ai.pane.queueOps.reorderAria` 「拖动调整排队顺序；聚焦后可使用上下方向键」—— 拖拽重排读屏(shared/zh-CN.json:2371)
- `apps/web/src/components/chat/queue-interaction-bar.tsx:310` `ai.pane.queueOps.undo` 「撤回」—— 撤回排队消息(shared/zh-CN.json:2372)
- `apps/web/src/components/chat/queue-interaction-bar.tsx:322` `ai.pane.queueOps.edit` 「编辑」—— 行内编辑排队消息(shared/zh-CN.json:2373)
- `apps/web/src/components/chat/queue-interaction-bar.tsx:280` `ai.pane.queueOps.editConfirm` 「保存」—— 编辑确认(shared/zh-CN.json:2374)
- `apps/web/src/components/chat/queue-interaction-bar.tsx:292` `ai.pane.queueOps.editCancel` 「取消」—— 编辑取消(shared/zh-CN.json:2375)
- `apps/web/src/components/chat/queue-interaction-bar.tsx:340` `ai.pane.queueOps.interruptAndRun` 「打断并执行」—— 停流并立即执行队首(shared/zh-CN.json:2376)
- `apps/web/src/components/chat/queue-interaction-bar.tsx:343` `ai.pane.queueOps.mode.label` 「队列模式」—— 模式切换组标签(shared/zh-CN.json:2378)
- `apps/web/src/components/chat/queue-interaction-bar.tsx:358` `ai.pane.queueOps.mode.steer` 「插话优先」—— 转向模式(shared/zh-CN.json:2379)
- `apps/web/src/components/chat/queue-interaction-bar.tsx:358` `ai.pane.queueOps.mode.queue` 「排队优先」—— 排队模式(shared/zh-CN.json:2380)
- `apps/web/src/components/chat/queue-interaction-bar.tsx:369` `ai.pane.queueOps.degraded.runtimeNoInterject` 「当前 Runtime 不支持插话，消息将继续排队」—— steer 降级显式句(shared/zh-CN.json:2383)
- `packages/i18n/messages/web/zh-CN.json:7445` `ai.pane.inputNotices.queue.reasonTitle` 「排队原因」—— 排队原因标题(消费方 input-notice-banner.tsx:109)
- `packages/i18n/messages/web/zh-CN.json:7447` `ai.pane.inputNotices.queue.reason.turnRunning` 「当前回复正在生成，消息将在本轮结束后发送」—— 排队原因·生成中
- `packages/i18n/messages/web/zh-CN.json:7448` `ai.pane.inputNotices.queue.reason.queueAhead` 「前面的消息尚未处理完成，正在按顺序等待」—— 排队原因·前序未完成
- `packages/i18n/messages/web/zh-CN.json:7449` `ai.pane.inputNotices.queue.reason.runtimeNoInterject` 「当前 Runtime 不支持插话，消息将继续排队」—— 排队原因·不支持插话
- `packages/i18n/messages/web/zh-CN.json:7452` `ai.pane.inputNotices.queue.denied.reorder` 「无法调整排队顺序」—— 拒绝提示·重排
- `packages/i18n/messages/web/zh-CN.json:7454` `ai.pane.inputNotices.queue.denied.interject` 「当前 Runtime 不支持插话，消息将继续排队」—— 拒绝提示·插话(消费方 input-notice-banner.tsx:130)
- `packages/i18n/messages/web/zh-CN.json:7456` `ai.pane.inputNotices.queue.denied.cause.streaming` 「本轮回答还在生成，排队顺序暂时锁定」—— 拒因·流式锁定
- `packages/i18n/messages/web/zh-CN.json:7462` `ai.pane.inputNotices.queue.blocked.runtimeNoInterject` 「当前 Runtime 不支持插话，无法注入运行中的 Turn」—— 六格拒因·Runtime 不支持
- `packages/i18n/messages/web/zh-CN.json:7465` `ai.pane.inputNotices.queue.blocked.controlCommandNoInterject` 「控制命令不能插入运行中的 Turn，请在本轮结束后发送」—— 六格拒因·控制命令
- `packages/i18n/messages/web/zh-CN.json:7466` `ai.pane.inputNotices.queue.blocked.queueChanged` 「队列已发生变化，请确认最新状态后再操作」—— 六格拒因·队列已变
- `packages/i18n/messages/web/zh-CN.json:7408` `ai.pane.command.queuePrompt` 「将提示加入队列」—— 斜杠命令·入队
- `packages/i18n/messages/web/zh-CN.json:7409` `ai.pane.command.queuePromptDesc` 「本轮回复结束后自动按顺序发送队列中的提示」—— 入队命令说明
- `packages/i18n/messages/web/zh-CN.json:7410` `ai.pane.command.steerPrompt` 「引导提示」—— 斜杠命令·转向
- `packages/i18n/messages/web/zh-CN.json:7411` `ai.pane.command.steerPromptDesc` 「向正在生成的回复中途插入引导，不打断当前输出」—— 转向命令说明
- `packages/i18n/messages/web/zh-CN.json:7414` `ai.pane.undo.restoring` 「正在恢复队列中的消息」—— 撤回恢复中
- `packages/i18n/messages/web/zh-CN.json:7417` `ai.pane.undo.failed` 「恢复失败，消息仍在队列中」—— 撤回恢复失败
- `packages/i18n/messages/web/zh-CN.json:10651` `chat.statusSlot.moreNotices` 「还有 {count} 条状态」—— 输入区状态槽折叠余量(消费方 apps/web/src/components/chat/input-status-slot.tsx:198)
- `packages/i18n/messages/web/zh-CN.json:10652` `chat.statusSlot.connection` 「连接状态」—— 状态槽·连接态
- `packages/i18n/messages/web/zh-CN.json:10653` `chat.statusSlot.alerts` 「下行告警」—— 状态槽·告警
- `packages/i18n/messages/web/zh-CN.json:10654` `chat.statusSlot.mcp` 「MCP 连接」—— 状态槽·MCP
- `packages/i18n/messages/web/zh-CN.json:10655` `chat.statusSlot.polish` 「润色提示」—— 状态槽·润色
- `packages/i18n/messages/web/zh-CN.json:10657` `chat.statusSlot.budget` 「今日额度」—— 状态槽·额度
- `packages/i18n/messages/web/zh-CN.json:8119` `ai.pane.turnStatus.title` 「轮次状态」—— 轮次状态行标题
- `packages/i18n/messages/web/zh-CN.json:8121` `ai.pane.turnStatus.state.queued` 「排队中」—— 轮次态·排队
- `packages/i18n/messages/web/zh-CN.json:8127` `ai.pane.turnStatus.state.stopping` 「正在停止」—— 轮次态·停止中
- `packages/i18n/messages/web/zh-CN.json:8130` `ai.pane.turnStatus.state.stopped` 「已停止」—— 轮次态·已停止
- `packages/i18n/messages/web/zh-CN.json:8133` `ai.pane.turnStatus.aria.queued` 「本轮正在排队,前面的请求完成后才会开始」—— 排队读屏说明
- `packages/i18n/messages/web/zh-CN.json:8139` `ai.pane.turnStatus.aria.stopping` 「正在停止本轮」—— 停止中读屏
- `packages/i18n/messages/web/zh-CN.json:8145` `ai.pane.turnStatus.hint.queued` 「前面的请求完成后本轮会自动开始」—— 排队位次提示
- `packages/i18n/messages/web/zh-CN.json:8151` `ai.pane.turnStatus.action.stop` 「停止」—— 轮次停止按钮
- `packages/i18n/messages/web/zh-CN.json:8153` `ai.pane.turnStatus.action.resume` 「继续」—— 停止后继续按钮
- `apps/web/src/components/chat/message-input.tsx:1380` `chat.stop` 「停止生成」—— 发送/停止按钮停止态(zh-CN.json:11489)
- `packages/i18n/messages/web/zh-CN.json:10640` `chat.modelSwitchStopped` 「已切换到 {model},本轮回答已终止」—— 切模型中断当前轮
- `packages/i18n/messages/web/zh-CN.json:7389` `ai.pane.inputSources.ariaLabel` 「输入源与队列」—— 输入源与队列聚合标签

### 未取证到(第 11 类)
- 竞品式「插队」(sendNow / 插队按钮):`git grep -n "插队\|sendNow" HEAD -- apps/web/src packages/shared/src` → 0 命中;我方以「打断并执行」「插话优先」承载类似语义,可能无独立插队动作,不下结论
- web-bind2.tsv 之外 message-input 排队区若存在更多排队态字面量,本次未逐行穷尽(git grep 面以 queue/steer/interrupt/stop 模式为准),可能仍有遗漏文案

## 12 错误·降级·重试

> 类别判据锚:收消息错误卡与错误码目录、模型降级(fallback)横幅、上游重试与倒计时、SSE 连接状态、额度型错误与配额动作、附件/工具/终端/子代理失败态、流告警条;对齐 qoder ## 12(turnFailed/retryTurn 等)与 trae ## 12「错误与降级」边界。

- `apps/web/src/components/ai/progress-sections/retry-notice.tsx:29` `ai.pane.retryScheduled` 「上游暂不可用，第 {attempt}/{max} 次重试，{seconds} 秒后继续」—— 上游重试倒计时条(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/retry-notice.tsx:34` `ai.pane.retryScheduledNow` 「上游正在切换通道，第 {attempt}/{max} 次重试（立即继续）」—— 通道切换立即重试条(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/connection-status.tsx:154` `ai.pane.sseStatus.reconnectingShort` 「重连 {n}/{max}」—— SSE 重连短句(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/connection-status.tsx:155` `ai.pane.sseStatus.disconnectedShort` 「已断开」—— SSE 断开短句(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/agent-actions-card.tsx:114` `ai.pane.agentActions.state.errored` 「出错」—— 智能体状态·出错(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/multi-agent-action-card.tsx:72` `multiAgentAction.action.spawn.failed` 「创建失败」—— 多智能体创建失败(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/worktree-card.tsx:61` `ai.pane.worktree.state.initFailed` 「初始化失败」—— Worktree 初始化失败(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/worktree-card.tsx:62` `ai.pane.worktree.state.timeout` 「超时」—— Worktree 超时(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/worktree-card.tsx:66` `ai.pane.worktree.state.restoreFailed` 「无法恢复」—— Worktree 恢复失败(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/worktree-card.tsx:70` `ai.pane.worktree.action.retryRestore` 「重试恢复」—— Worktree 重试恢复动作(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/tool-calls-section.tsx:317` `ai.pane.tools.error` 「错误」—— 工具调用错误标注(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/tool-calls-section.tsx:320` `ai.pane.tools.copyError` 「复制错误信息」—— 复制错误动作(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/plan-steps-card.tsx:113` `chat.plan.summaryErrorCount` 「错误 {count}」—— 计划步骤错误计数(收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/terminal-section.tsx:278` `ai.pane.terminal.failed` 「{n} 失败」—— 终端任务失败计数(收编自 web-bind2.tsv)
- `apps/web/src/components/chat/message-list/MessageErrorCard.tsx:142` `chat.errorCardTitle` 「请求出错」—— 消息错误卡标题回落(zh-CN.json:11311)
- `apps/web/src/components/chat/message-list/MessageErrorCard.tsx:215` `chat.retry` 「重试」—— 错误卡重试按钮(zh-CN.json:11324)
- `apps/web/src/components/chat/message-list/FallbackBanner.tsx:87` `chat.fallbackNotice` 「已切换到备用模型 {backup}(原模型 {primary} 暂时不可用)」—— 模型降级横幅(zh-CN.json:10959)
- `apps/web/src/components/chat/message-list/FallbackBanner.tsx:83` `chat.fallbackNoticeQuota` 「本次由 {backup} 作答({primary} 所属厂商账号额度已用尽,已自动改道同族可用模型)」—— 额度型降级横幅(zh-CN.json:10960)
- `packages/i18n/messages/web/zh-CN.json:11307` `chat.resumeFailed` 「上一轮回复未完成,自动续接失败」—— 断线续接失败
- `packages/i18n/messages/web/zh-CN.json:11308` `chat.resumeNoProgress` 「已尝试续接,但未取得新内容」—— 续接无进展
- `packages/i18n/messages/web/zh-CN.json:11309` `chat.resumeRegenerate` 「重新生成」—— 续接失败后动作
- `packages/i18n/messages/web/zh-CN.json:8158` `ai.pane.errorCatalog.ACCOUNT_RESTRICTED.title` 「账户受限」—— 错误码目录·账户受限
- `packages/i18n/messages/web/zh-CN.json:8159` `ai.pane.errorCatalog.ACCOUNT_RESTRICTED.action` 「联系管理员」—— 错误码·账户受限动作
- `packages/i18n/messages/web/zh-CN.json:8170` `ai.pane.errorCatalog.BUDGET_EXHAUSTED.title` 「额度已用尽」—— 错误码·额度用尽
- `packages/i18n/messages/web/zh-CN.json:8171` `ai.pane.errorCatalog.BUDGET_EXHAUSTED.action` 「稍后再试或换用免费模型」—— 错误码·额度用尽动作
- `packages/i18n/messages/web/zh-CN.json:8190` `ai.pane.errorCatalog.CONCURRENCY_LIMIT_EXCEEDED.title` 「请求过于频繁」—— 错误码·并发限流
- `packages/i18n/messages/web/zh-CN.json:8191` `ai.pane.errorCatalog.CONCURRENCY_LIMIT_EXCEEDED.action` 「稍后重试」—— 错误码·并发限流动作
- `packages/i18n/messages/web/zh-CN.json:8194` `ai.pane.errorCatalog.CONTEXT_TOO_LONG.title` 「上下文过长」—— 错误码·上下文超限
- `packages/i18n/messages/web/zh-CN.json:8195` `ai.pane.errorCatalog.CONTEXT_TOO_LONG.action` 「精简上下文」—— 错误码·上下文超限动作
- `packages/i18n/messages/web/zh-CN.json:8186` `ai.pane.errorCatalog.CHAT_MODE_TOOL_BLOCKED.title` 「当前对话模式已拦截该操作」—— 错误码·模式拦截
- `packages/i18n/messages/web/zh-CN.json:8187` `ai.pane.errorCatalog.CHAT_MODE_TOOL_BLOCKED.action` 「切换到构建模式后重试」—— 错误码·模式拦截动作
- `packages/i18n/messages/web/zh-CN.json:10937` `chat.errorTimeout15s` 「AI 响应超时(15 秒内未收到任何内容),请稍后重试」—— 15 秒无响应超时
- `packages/i18n/messages/web/zh-CN.json:10938` `chat.errorTimeout60s` 「AI 思考超时(60 秒未产出回答内容,可能 reasoning 模型思考过长),请稍后重试或换用普通模型」—— 60 秒思考超时
- `packages/i18n/messages/web/zh-CN.json:7538` `ai.pane.quotaOwnership.degradeHint` 「免费额度仍可使用,可切换免费模型继续,无需充值」—— 额度型降级建议
- `packages/i18n/messages/web/zh-CN.json:7527` `ai.pane.quotaOwnership.action.switchFreeModel` 「切换免费模型」—— 降级切免费模型动作
- `packages/i18n/messages/shared/zh-CN.json:2295` `viewFailure.runtimeException.title` 「运行时异常」—— 插件视图失败分型·运行时异常(消费方 apps/web/src/components/chat/message-list/MessageItem.tsx:192)
- `packages/i18n/messages/shared/zh-CN.json:2323` `viewFailure.backendTimeout.title` 「后端响应超时」—— 视图失败分型·后端超时
- `packages/i18n/messages/web/zh-CN.json:10628` `chat.attachRetry` 「重试上传」—— 附件上传重试
- `packages/i18n/messages/web/zh-CN.json:10629` `chat.attachRetryExhausted` 「重试次数已达上限,请删除后重新添加」—— 附件重试耗尽
- `packages/i18n/messages/web/zh-CN.json:10907` `chat.contextUsage.uploadFailed` 「附件上传失败」—— 附件上传失败标注
- `packages/i18n/messages/web/zh-CN.json:10661` `chat.streamAlert.configWarning.title` 「配置提醒」—— 流告警条·配置提醒
- `packages/i18n/messages/web/zh-CN.json:10664` `chat.streamAlert.deprecationNotice.title` 「能力弃用预告」—— 流告警条·弃用预告
- `packages/i18n/messages/web/zh-CN.json:10667` `chat.streamAlert.guardianWarning.title` 「安全审查提醒」—— 流告警条·安全审查
- `packages/i18n/messages/web/zh-CN.json:7849` `ai.pane.reconnecting` 「SSE 断连,正在重连(第 {n}/5 次)」—— SSE 断连重连全句
- `packages/i18n/messages/web/zh-CN.json:7873` `ai.pane.sseStatus.tooltipError` 「连接错误: {error}」—— 连接错误悬停详情
- `packages/i18n/messages/web/zh-CN.json:8152` `ai.pane.turnStatus.action.retry` 「重试」—— 轮次失败重试按钮

### 未取证到(第 12 类)
- ai.pane.errorCatalog.* 错误码目录共约数十个码,本单只收编 5 个代表码(title+action);完整目录见 packages/i18n/messages/web/zh-CN.json:8156 起,可能仍有对话流外场景(工具/协作)复用同目录,边界未逐码核对
- mcp-status-notice.tsx 消费的 `chat.mcp.state.reconnecting/failed/connecting`、`chat.mcp.action.retry/openSettings` 中文词包本体未在本轮定位到对应 zh-CN.json 行,暂不列条目;可能键已落地但命名空间嵌套路径未取证,不下「缺失」结论
- QuotaActionFamily 的 `quotaAction.*` 键经零命中核对未落语言包(见 §0),组件渲染中文原文暂不可证;可能由调用方注入其他命名空间 t,可能确实缺词包

## 计数与自检

| 类 | 条目数 | 未取证到条数 |
| --- | --- | --- |
| 9 上下文与压缩 | 45 | 2 |
| 10 引用与来源 | 55 | 2 |
| 11 队列·转向·中断 / 输入区状态 | 53 | 2 |
| 12 错误·降级·重试 | 46 | 3 |
| 合计 | 199 | 9 |

| 自检项 | 结果 |
| --- | --- |
| 是否 ≤200 条 | 是(199 条,未取证到行不计入) |
| 四类齐全且每类 ≥1 条真实条目 | 是(45/55/53/46) |
| 收编自 web-bind2.tsv 条数 | 30(第 9 类 6、第 10 类 2、第 11 类 8、第 12 类 14) |
| 源码补查条数 | 169(HEAD 面 git grep 行号;含 3 条组件字面量与语言包锚条目) |
| 检索过的 git grep 模式 | compaction/压缩/上下文;chat.compaction./budgetBar/contextUsage;ContextUsageRing/context-usage;interruptAndRun/reorderAria/mode.steer;queueOps;mention;quotaAction;attachRetry/openSettings;sseStatus;stop/停止/中断;errorCatalog/errorCardTitle/fallbackNotice;viewFailure;quickNotes/速记;插队/sendNow;autoCompactThreshold;auto_compact/自动压缩预留(全部 `git grep -n … HEAD -- <路径>` 形态) |
| 竞品同名节边界对齐 | qoder ##9 L1962 / ##10 L1998 / ##11 L2447 / ##12 L2701;trae ##9 L403 / ##10 L438 / ##11 L457 / ##12 L481;codex ##9 L366 / ##10 L393 / ##11 L413(队列与转向)/ ##12 L430(中断与恢复) |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
