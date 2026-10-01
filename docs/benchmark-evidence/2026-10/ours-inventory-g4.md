<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 我方侧 AI 对话流清单·组4(web 端;第 13-16 类;D206/D160 拆票 4/4)

> 口径:端=web(apps/web/src),覆盖共享分类法第 13-16 类。每条 = 一个用户可见元素(组件渲染位 file:line + i18n 键 + 中文原文 + 能力一句话);同一键在同一组件的多个渲染位只取首个稳态渲染位一行,不嵌套列表。
> 数据源一(收编):`docs/benchmark-evidence/2026-09/web-bind2.tsv`(2026-09 快照),保留快照原行号,条目尾注「(收编自 web-bind2.tsv)」。
> 数据源二(源码补查):`git grep -n "<模式>" HEAD -- <路径>`(HEAD=53ba9ea80d;sidebar-chat-history.tsx 与 zh-CN.json 工作树有未提交修改,一律取 HEAD 面行号与原文,不用工作树行号);组件内置兜底文案标注「(组件字面量)」。
> 数据源三(竞品边界):qoder L2895(usage/credits)/L2969(侧栏会话管理)/L3518(模型选择)/L3857(规则·技能·记忆),trae L503/L522/L548/L568,codex L456/L479/L500/L536 同名节仅用于对齐四类边界,不抄条目。
> 两态纪律:未取证到 ≠ 不存在 ≠ 不必做;本清单只记「已取证到」与「未取证到」两态,不下「没有」结论。条目内中文原文一律按 HEAD 词表逐字转写(含半角/全角标点原样)。

## 0 逐类「未取证到」核对

| 类 | 问题 | 结果 |
| --- | --- | --- |
| 13 计量与成本 | 额度动作族 quotaAction(QuotaActionFamily.tsx 组件引用 8 处)在词表是否有键? | `git grep -n quotaAction HEAD -- packages/i18n` → 0 命中:词表缺键,不列条目,见 §13 未取证到 |
| 14 会话管理·分享·导出·侧栏 | 「从此处分支」/分享二维码/actions.archive 值是否可取证? | branchFromHere 词表在(9016)但组件 0 命中;「二维码」`git grep -c "二维码" HEAD -- apps/web/src/components/chat apps/web/src/components/ai` → 0;actions.archive 值未逐字核实,见 §14 未取证到 |
| 15 模型与档位选择 | modelAutoDescription/模型分类 chips/「思考预算」是否可取证? | modelAutoDescription@11031 词表在但组件调用 0 命中;分类 chips 键名在 @ihui/shared 未逐字核实;`git grep -c "思考预算" HEAD -- apps/web/src` → 0,见 §15 未取证到 |
| 16 记忆·规则·知识可见性 | 「记忆门控」与 skill 库组件引用键的词表值是否可逐字核实? | `git grep -c "记忆门控" HEAD -- apps/web/src` → 0;skill 库 invokeClose/create/searchPlaceholder/empty/disabled/save 等 7 键值未逐字核实,见 §16 未取证到 |

## 13 计量与成本

判据锚:对话链路中一切「Token/费用/额度/配额」计量与计费口径可见元素——发送前费用预估与预算阈值协商(cost-estimate-bar)、会话累计用量与价目折算、D56 速通/计费模式/企业四分账(session-usage-badge)、今日额度条(context-budget-bar)、消息级用量标注(message-item-parts)、任务总览计量行(收编)。

- `apps/web/src/components/ai/cost-estimate-bar.tsx:38` `costGuard.negotiationLine` 「本次预计 ≈{tokens} tokens（约 ${cost}）,超过预算阈值」—— 预估超预算阈值时的协商提示行
- `apps/web/src/components/ai/cost-estimate-bar.tsx:42` `costGuard.negotiationFallback` 「本次消耗估算超过预算阈值」—— 协商提示的降级文案
- `apps/web/src/components/ai/cost-estimate-bar.tsx:53` `costGuard.confirmSend` 「仍然发送」—— 超预算确认发送按钮
- `apps/web/src/components/ai/cost-estimate-bar.tsx:64` `costGuard.confirmCancel` 「取消」—— 超预算确认取消按钮
- `apps/web/src/components/ai/cost-estimate-bar.tsx:80` `costGuard.estimateLine` 「本次预计 ≈{tokens} tokens（约 ${cost}）」—— 发送前本地费用预估行
- `apps/web/src/components/ai/cost-estimate-bar.tsx:84` `costGuard.fallbackPrice` 「兜底价仅供参考」—— 无价目模型兜底价免责说明
- `apps/web/src/components/ai/cost-estimate-bar.tsx:88` `costGuard.actualLine` 「实际 {actual} tokens（预估 {estimate}）」—— 回合后实际用量与预估对比行
- `apps/web/src/components/chat/session-usage-badge.tsx:239` `chat.sessionUsage.promptTokens` 「输入」—— 会话累计用量:输入 Token 行
- `apps/web/src/components/chat/session-usage-badge.tsx:242` `chat.sessionUsage.completionTokens` 「输出」—— 会话累计用量:输出 Token 行
- `apps/web/src/components/chat/session-usage-badge.tsx:245` `chat.sessionUsage.requests` 「请求数」—— 会话累计请求数行
- `apps/web/src/components/chat/session-usage-badge.tsx:251` `chat.sessionUsage.balance` 「Token 余额」—— 额度余额展示行
- `apps/web/src/components/chat/session-usage-badge.tsx:268` `chat.sessionUsage.quotaUsedPercent` 「月配额已用 {percent}%」—— 月配额进度提示
- `apps/web/src/components/chat/session-usage-badge.tsx:275` `chat.sessionUsage.vipDiscount` 「VIP{level} · {rate}% 计费」—— VIP 折扣计费口径
- `apps/web/src/components/chat/session-usage-badge.tsx:281` `chat.sessionUsage.promotionHint` 「促销期额外 8 折」—— 促销折扣说明
- `apps/web/src/components/chat/session-usage-badge.tsx:290` `chat.sessionUsage.inputCost` 「输入费用」—— 输入费用折算行
- `apps/web/src/components/chat/session-usage-badge.tsx:293` `chat.sessionUsage.outputCost` 「输出费用」—— 输出费用折算行
- `apps/web/src/components/chat/session-usage-badge.tsx:295` `chat.sessionUsage.pricingHint` 「按当前模型价目表折算(元/千 token),非最终账单」—— 价目折算免责说明
- `apps/web/src/components/chat/session-usage-badge.tsx:298` `chat.sessionUsage.noPriceHint` 「该模型暂无价目数据,仅显示 Token 数」—— 无价目模型降级说明
- `apps/web/src/components/chat/session-usage-badge.tsx:300` `chat.sessionUsage.estimateHint` 「用量为本地估算,以账单为准」—— 估算口径免责说明
- `apps/web/src/components/chat/session-usage-badge.tsx:371` `chat.sessionUsage.ariaLabel` 「会话累计 Token 用量」—— 用量徽章无障碍名
- `apps/web/src/components/chat/session-usage-badge.tsx:201` (组件字面量) 「Express」—— D56 速通通道徽章(词表未释放,英文过渡兜底)
- `apps/web/src/components/chat/session-usage-badge.tsx:203` (组件字面量) 「Per token」—— D56 按 Token 计费标签(英文过渡兜底)
- `apps/web/src/components/chat/session-usage-badge.tsx:204` (组件字面量) 「Per request」—— D56 按次计费标签(英文过渡兜底)
- `apps/web/src/components/chat/session-usage-badge.tsx:205` (组件字面量) 「Billed per token, usage estimated, bill is authoritative」—— D56 按 Token 计费口径说明(英文过渡兜底)
- `apps/web/src/components/chat/session-usage-badge.tsx:211` (组件字面量) 「Billed per request ¥{price}/request, usage estimated, bill is authoritative」—— D56 按次计价口径说明(英文过渡兜底)
- `apps/web/src/components/chat/session-usage-badge.tsx:222` (组件字面量) 「Enterprise usage」—— D56 企业四分账区标题(英文过渡兜底)
- `apps/web/src/components/chat/session-usage-badge.tsx:223` (组件字面量) 「Free quota remains available」—— D56 免费额度可用心智提示(英文过渡兜底)
- `apps/web/src/components/chat/session-usage-badge.tsx:225` (组件字面量) 「Personal」—— D56 四分账:个人片标签(英文过渡兜底)
- `apps/web/src/components/chat/session-usage-badge.tsx:226` (组件字面量) 「Team」—— D56 四分账:团队片标签(英文过渡兜底)
- `apps/web/src/components/chat/session-usage-badge.tsx:227` (组件字面量) 「Free models」—— D56 四分账:免费模型片标签(英文过渡兜底)
- `apps/web/src/components/chat/session-usage-badge.tsx:228` (组件字面量) 「Billing group」—— D56 四分账:计费组片标签(英文过渡兜底)
- `apps/web/src/components/chat/context-budget-bar.tsx:79` `chat.budgetBar.title` 「今日 AI 额度」—— 今日额度条标题
- `apps/web/src/components/chat/context-budget-bar.tsx:80` `chat.budgetBar.critical` 「即将用尽」—— 额度临界警示标
- `apps/web/src/components/chat/context-budget-bar.tsx:83` `chat.budgetBar.tokens` 「已用 {used} / {limit}」—— 额度用量分数展示
- `apps/web/src/components/chat/context-budget-bar.tsx:90` `chat.budgetBar.resetAt` 「{time} 重置」—— 额度重置时间提示
- `apps/web/src/components/chat/message-list/message-item-parts.tsx:197` `chat.usageEstimated` 「用量估算」—— 消息用量为估算值的标注
- `apps/web/src/components/chat/message-list/message-item-parts.tsx:203` `chat.messageUsage.total` 「总用量」—— 消息级总用量行
- `apps/web/src/components/chat/message-list/message-item-parts.tsx:255` `chat.messageUsage.ariaLabel` 「消息用量详情」—— 消息用量详情无障碍名
- `apps/web/src/components/ai/progress-sections/overview-section.tsx:143` `ai.pane.overview.duration` 「耗时」—— 任务总览:本次耗时计量 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/overview-section.tsx:148` `ai.pane.overview.token` 「Token」—— 任务总览:Token 用量计量 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/overview-section.tsx:153` `ai.pane.overview.rate` 「速率」—— 任务总览:Token 速率计量 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/overview-section.tsx:156` `ai.pane.overview.eta` 「预计」—— 任务总览:预计完成计量 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/overview-section.tsx:160` `ai.pane.overview.context` 「上下文」—— 任务总览:上下文占用计量 (收编自 web-bind2.tsv)

### 未取证到(第 13 类)

| 问题 | 证据 |
| --- | --- |
| 额度动作族 quotaAction 是否有词表? | QuotaActionFamily.tsx(组件行 74/79/92/100/113/124/134/142)引用 quotaAction.title/retry/addPoints/upgradePlan/switchTier/viewUsage/relogin/freeHint;`git grep -n quotaAction HEAD -- packages/i18n` 0 命中 —— 词表缺键,前端引用无值,不列条目 |
| sessionUsage 存在同名单键旧块(8889 处「输入 Token」等 6 键)与 11338 处 13 键块,组件实际命中块? | 组件调用的 requests/balance/vipDiscount 等键仅存在于 11338 块,按 11338 块收录;运行时命中面未做逐帧验证 |

## 14 会话管理·分享·导出·侧栏

判据锚:侧栏与会话全生命周期可见元素——列表/搜索/排序/多选、置顶/归档/重命名/删除、文件夹与标签组织、导出与分享(exportMenu;conversation-export.ts 六通道 Markdown/JSON/PNG 快照/分享卡/分享链接/打印 PDF 的入口文案)、会话内消息搜索(收编)、登录门槛提示。

- `apps/web/src/components/sidebar-chat-history.tsx:478` `chatHistory.title` 「任务列表」—— 侧栏标题/入口按钮唯一文案面(aria)
- `apps/web/src/components/sidebar-chat-history.tsx:486` `chatHistory.loginRequired` 「请先登录」—— 未登录侧栏门槛提示
- `apps/web/src/components/sidebar-chat-history.tsx:1102` `chatHistory.selectModeAriaLabel` 「切换任务多选模式」—— 多选模式开关唯一文案面
- `apps/web/src/components/sidebar-chat-history.tsx:1152` `chatHistory.sorting.label` 「排序方式」—— 排序控件名
- `apps/web/src/components/sidebar-chat-history.tsx:1167` `chatHistory.sorting.pinnedFirst` 「置顶优先」—— 排序选项:置顶优先
- `apps/web/src/components/sidebar-chat-history.tsx:1173` `chatHistory.sorting.byTime` 「按时间」—— 排序选项:按时间
- `apps/web/src/components/sidebar-chat-history.tsx:1191` `chatHistory.searchPlaceholder` 「搜索任务...」—— 会话搜索输入占位
- `apps/web/src/components/sidebar-chat-history.tsx:1229` `chatHistory.noResults` 「未找到匹配的任务」—— 搜索无命中空态
- `apps/web/src/components/sidebar-chat-history.tsx:1282` `chatHistory.retryLoadMore` 「重试加载」—— 分页加载失败重试
- `apps/web/src/components/sidebar-chat-history.tsx:1291` `chatHistory.viewAll` 「查看全部」—— 查看全部任务入口
- `apps/web/src/components/sidebar-chat-history.tsx:1313` `chatHistory.archiveChatTitle` 「归档“{title}”?」—— 归档确认对话框标题
- `apps/web/src/components/sidebar-chat-history.tsx:1324` `chatHistory.archiveChatDoNotAskAgain` 「不再提示」—— 归档确认不再提示勾选
- `apps/web/src/components/sidebar-chat-history.tsx:1330` `chatHistory.archivingChat` 「正在归档...」—— 归档进行中状态
- `apps/web/src/components/sidebar-chat-history.tsx:482` `aiChat.history` 「任务列表」—— 侧栏分区标题
- `apps/web/src/components/sidebar-chat-history.tsx:1235` `aiChat.noHistory` 「暂无任务」—— 空列表空态
- `apps/web/src/components/sidebar-chat-history.tsx:925` `aiChat.org.title` 「整理会话」—— 整理会话(文件夹/标签)对话框标题
- `apps/web/src/components/sidebar-chat-history.tsx:1119` `aiChat.org.filterLabel` 「按文件夹筛选」—— 文件夹筛选控件名
- `apps/web/src/components/sidebar-chat-history.tsx:937` `aiChat.bindIssue` 「绑定 Issue」—— 菜单项:绑定 Issue
- `apps/web/src/components/sidebar-chat-history.tsx:854` `aiChat.actions.menu` 「更多操作」—— 会话条目更多操作菜单唯一文案面
- `apps/web/src/components/sidebar-chat-history.tsx:880` `aiChat.actions.rename` 「重命名」—— 菜单项:重命名
- `apps/web/src/components/sidebar-chat-history.tsx:899` `aiChat.actions.pin` 「置顶」—— 菜单项:置顶
- `apps/web/src/components/sidebar-chat-history.tsx:894` `aiChat.actions.unpin` 「取消置顶」—— 菜单项:取消置顶
- `apps/web/src/components/sidebar-chat-history.tsx:950` `aiChat.actions.unarchive` 「取消归档」—— 菜单项:取消归档
- `apps/web/src/components/sidebar-chat-history.tsx:967` `aiChat.actions.exportMd` 「导出为 Markdown」—— 菜单项:导出 Markdown
- `apps/web/src/components/sidebar-chat-history.tsx:977` `aiChat.actions.exportTxt` 「导出为 TXT」—— 菜单项:导出 TXT
- `apps/web/src/components/sidebar-chat-history.tsx:1039` `aiChat.actions.compressTo200k` 「压缩到 20 万字符」—— 菜单项:压缩到 20 万字符
- `apps/web/src/components/sidebar-chat-history.tsx:1049` `aiChat.actions.compressTo1m` 「压缩到 100 万字符」—— 菜单项:压缩到 100 万字符
- `apps/web/src/components/sidebar-chat-history.tsx:1061` `aiChat.actions.delete` 「删除」—— 菜单项:删除
- `apps/web/src/components/sidebar-chat-history.tsx:1300` `aiChat.deleteConversation` 「删除任务」—— 删除确认对话框标题
- `apps/web/src/components/sidebar-chat-history.tsx:1301` `aiChat.confirmDeleteConversation` 「确认删除该任务？删除后无法恢复。」—— 删除确认正文
- `apps/web/src/components/sidebar-chat-history.tsx:1343` `aiChat.renameDialog.title` 「重命名任务」—— 重命名对话框标题
- `apps/web/src/components/sidebar-chat-history.tsx:1345` `aiChat.renameDialog.description` 「保持简短且易于识别」—— 重命名对话框说明
- `apps/web/src/components/sidebar-chat-history.tsx:1349` `aiChat.renameDialog.label` 「任务名称」—— 重命名输入标签
- `apps/web/src/components/sidebar-chat-history.tsx:1355` `aiChat.renameDialog.placeholder` 「请输入新的任务名称」—— 重命名输入占位
- `apps/web/src/components/sidebar-chat-history.tsx:989` `chat.exportMenu.exportPdf` 「导出 PDF」—— 导出菜单:打印/导出 PDF
- `apps/web/src/components/sidebar-chat-history.tsx:999` `chat.exportMenu.exportJson` 「导出 JSON」—— 导出菜单:导出 JSON
- `apps/web/src/components/sidebar-chat-history.tsx:1009` `chat.exportMenu.snapshot` 「导出快照图 (PNG)」—— 导出菜单:PNG 快照图
- `apps/web/src/components/sidebar-chat-history.tsx:1019` `chat.exportMenu.exportCard` 「分享图片卡」—— 导出菜单:分享图片卡
- `apps/web/src/components/sidebar-chat-history.tsx:1029` `chat.exportMenu.share` 「复制分享链接」—— 导出菜单:复制分享链接
- `apps/web/src/components/sidebar-chat-history.tsx:664` `chat.exportMenu.roleUser` 「用户」—— 导出文本角色标注:用户
- `apps/web/src/components/sidebar-chat-history.tsx:665` `chat.exportMenu.roleAssistant` 「助手」—— 导出文本角色标注:助手
- `apps/web/src/components/sidebar-chat-history.tsx:695` `chat.exportMenu.shareCardUser` 「用户」—— 分享卡角色标注:用户
- `apps/web/src/components/chat/conversation-org-dialog.tsx:86` `aiChat.org.title` 「整理会话」—— 组织对话框标题
- `apps/web/src/components/chat/conversation-org-dialog.tsx:97` `aiChat.org.folderLabel` 「文件夹」—— 文件夹字段标签
- `apps/web/src/components/chat/conversation-org-dialog.tsx:102` `aiChat.org.folderPlaceholder` 「输入或选择文件夹」—— 文件夹输入占位
- `apps/web/src/components/chat/conversation-org-dialog.tsx:127` `aiChat.org.tagsLabel` 「标签」—— 标签字段标签
- `apps/web/src/components/chat/conversation-org-dialog.tsx:134` `aiChat.org.tagPlaceholder` 「添加标签后回车」—— 标签输入占位
- `apps/web/src/components/ai/progress-sections/message-context-menu.tsx:328` `chat.searchResult` 「{current}/{total}」—— 会话内消息搜索命中序号 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/message-context-menu.tsx:329` `chat.searchNoResult` 「无匹配结果」—— 消息搜索无命中提示 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/message-context-menu.tsx:338` `chat.search` 「搜索消息」—— 消息搜索入口菜单项 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/message-context-menu.tsx:345` `chat.searchPlaceholder` 「输入关键词搜索...」—— 消息搜索输入占位 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/message-context-menu.tsx:358` `chat.searchPrev` 「上一个」—— 搜索结果上一跳 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/message-context-menu.tsx:372` `chat.searchNext` 「下一个」—— 搜索结果下一跳 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/message-context-menu.tsx:386` `chat.searchClose` 「关闭搜索」—— 关闭消息搜索 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/timeline-tab.tsx:429` `ai.pane.timelineExport` 「导出为 Markdown」—— 时间线视图导出入口 (收编自 web-bind2.tsv)

### 未取证到(第 14 类)

| 问题 | 证据 |
| --- | --- |
| 词表 aiChat.actions.branchFromHere「从此处分支」(9016)是否有组件入口? | `git grep -c branchFromHere HEAD -- apps/web/src` → 0 命中:词表在、入口无,不列条目 |
| aiChat.actions.archive(组件 955/1327 两处引用)词表值? | aiChat.actions 块(约 9005-9017)仅逐字核实 menu/rename/pin/unpin/unarchive/exportMd/exportTxt/branchFromHere 等,archive 值未逐字取证,不列条目 |
| 分享环节是否存在二维码可见元素? | `git grep -c "二维码" HEAD -- apps/web/src/components/chat apps/web/src/components/ai` → 0 命中 |
| conversation-list.tsx attention/batch 族是否入列? | attentionWaiting「等待你处理」/attentionUnread「有 {count} 条未读更新」/batchAttentionSummary 词表值已核实(11814-11816),但该组件引用面未逐行取证,本票不列,留待补查 |

## 15 模型与档位选择

判据锚:模型与参数选择可见元素——模型选择器(自动/历史模型/能力徽章/会员折扣/官方·省钱·补贴标签/免费标记/锁定提示/配置状态/厂商健康)及其弹层、D130 推理强度档位轴、采样参数面板(数值参数+system prompt+触发器)、D59 模型负载与排队条。

- `apps/web/src/components/chat/model-selector.tsx:209` `chat.providerHealthTip` 「延迟 {latency}ms · {count} 个模型可用」—— 厂商健康提示(延迟与可用模型数)
- `apps/web/src/components/chat/model-selector.tsx:278` `chat.modelOfficialBadge` 「官方」—— 模型官方徽章
- `apps/web/src/components/chat/model-selector.tsx:284` `chat.modelSmartSaveBadge` 「智能省钱」—— 智能省钱徽章
- `apps/web/src/components/chat/model-selector.tsx:291` `chat.modelNotConfigured` 「当前模型 API Key 未配置,前往模型广场页一键配置」—— 未配置状态提示(唯一文案面)
- `apps/web/src/components/chat/model-selector.tsx:348` `chat.modelCapVision` 「视觉」—— 能力徽章:视觉(能力筛选位同键)
- `apps/web/src/components/chat/model-selector.tsx:348` `chat.modelCapFim` 「补全」—— 能力徽章:补全(能力筛选位同键)
- `apps/web/src/components/chat/model-selector.tsx:1004` `chat.modelCapReasoning` 「推理」—— 能力筛选项:推理
- `apps/web/src/components/chat/model-selector.tsx:1004` `chat.modelCapTools` 「工具」—— 能力筛选项:工具
- `apps/web/src/components/chat/model-selector.tsx:399` `chat.modelTagMemberDiscount` 「会员2.5折」—— 会员折扣标签
- `apps/web/src/components/chat/model-selector.tsx:411` `chat.modelTagOfficial` 「正式版」—— 正式版标签
- `apps/web/src/components/chat/model-selector.tsx:423` `chat.modelTagSubsidy` 「专属补贴」—— 专属补贴标签
- `apps/web/src/components/chat/model-selector.tsx:430` `chat.modelLockedHint` 「需升级会员才能使用」—— 会员锁定提示
- `apps/web/src/components/chat/model-selector.tsx:441` `chat.modelFree` 「免费」—— 免费模型标记(0 积分位)
- `apps/web/src/components/chat/model-selector.tsx:536` `chat.modelPopoverMemberDesc` 「升级付费会员,享受额外 2.5 折,积分消耗速度 {from}x 降至 {to}x」—— 会员折扣弹层说明
- `apps/web/src/components/chat/model-selector.tsx:558` `chat.modelPopoverUpgradeButton` 「升级权益」—— 会员弹层升级按钮
- `apps/web/src/components/chat/model-selector.tsx:844` `chat.modelAuto` 「自动」—— 自动选择最优模型选项
- `apps/web/src/components/chat/model-selector.tsx:878` `chat.manageModels` 「自定义配置模型」—— 自定义配置模型入口
- `apps/web/src/components/chat/model-selector.tsx:956` `chat.modelHistoryToggle` 「历史模型」—— 历史模型分组开关
- `apps/web/src/components/chat/model-selector.tsx:977` `chat.modelHistorySearch` 「搜索历史模型」—— 历史模型搜索占位
- `apps/web/src/components/chat/model-selector.tsx:1011` `chat.modelHistoryEmpty` 「没有匹配的模型」—— 历史模型空态
- `apps/web/src/components/chat/reasoning-effort-axis.tsx:81` `chat.reasoningEffortLabel` 「推理强度」—— D130 档位轴标签
- `apps/web/src/components/chat/reasoning-effort-axis.tsx:104` `chat.reasoningEffortMinimal` 「极简」—— 档位:极简
- `apps/web/src/components/chat/reasoning-effort-axis.tsx:104` `chat.reasoningEffortLow` 「快速」—— 档位:快速
- `apps/web/src/components/chat/reasoning-effort-axis.tsx:104` `chat.reasoningEffortMedium` 「均衡」—— 档位:均衡
- `apps/web/src/components/chat/reasoning-effort-axis.tsx:104` `chat.reasoningEffortHigh` 「深思」—— 档位:深思
- `apps/web/src/components/chat/reasoning-effort-axis.tsx:124` `chat.reasoningEffortUnsupported` 「该模型不支持选择推理强度」—— 模型不支持时轴上可见说明
- `apps/web/src/components/chat/reasoning-effort-axis.tsx:117` `chat.reasoningEffortFallback` 「推理强度已由后端调整为 {requested} → {effective}」—— 后端钉档回落显式可见
- `apps/web/src/components/chat/sampling-params-panel.tsx:132` `chat.sampling.useModelDefault` 「使用模型默认值」—— 参数输入占位:使用模型默认值
- `apps/web/src/components/chat/sampling-params-panel.tsx:200` `chat.sampling.title` 「采样参数」—— 采样参数面板标题
- `apps/web/src/components/chat/sampling-params-panel.tsx:208` `chat.sampling.scopeSession` 「会话级」—— 生效范围:会话级覆盖
- `apps/web/src/components/chat/sampling-params-panel.tsx:217` `chat.sampling.promoteToDefaults` 「保存为默认」—— 会话参数提升为全局默认
- `apps/web/src/components/chat/sampling-params-panel.tsx:225` `chat.sampling.temperature` 「Temperature」—— 参数:Temperature
- `apps/web/src/components/chat/sampling-params-panel.tsx:235` `chat.sampling.topP` 「Top P」—— 参数:Top P
- `apps/web/src/components/chat/sampling-params-panel.tsx:245` `chat.sampling.topK` 「Top K」—— 参数:Top K
- `apps/web/src/components/chat/sampling-params-panel.tsx:255` `chat.sampling.maxTokens` 「最大输出 Token 数」—— 参数:最大输出 Token 数
- `apps/web/src/components/chat/sampling-params-panel.tsx:286` `chat.sampling.systemPrompt` 「系统提示词」—— 自定义系统提示词区标题
- `apps/web/src/components/chat/sampling-params-panel.tsx:299` `chat.sampling.personalityCustom` 「自定义」—— 预设下拉:自定义选项
- `apps/web/src/components/chat/sampling-params-panel.tsx:311` `chat.sampling.systemPromptPlaceholder` 「输入本轮对话的系统提示词…」—— 系统提示词输入占位
- `apps/web/src/components/chat/sampling-params-panel.tsx:336` `chat.sampling.resetAll` 「全部重置」—— 全部重置按钮
- `apps/web/src/components/chat/sampling-params-panel.tsx:340` `chat.sampling.done` 「完成」—— 面板完成按钮
- `apps/web/src/components/chat/sampling-params-panel.tsx:364` `chat.sampling.triggerActive` 「采样参数 · {{count}} 项已覆盖」—— 触发器:已覆盖计数态
- `apps/web/src/components/chat/sampling-params-panel.tsx:364` `chat.sampling.trigger` 「采样参数」—— 触发器:默认态
- `apps/web/src/components/ai/model-load-bar.tsx:77` `ai.pane.modelLoad.ariaLabel` 「模型负载与排队状态」—— 负载条无障碍名
- `apps/web/src/components/ai/model-load-bar.tsx:69` `ai.pane.modelLoad.slowLane` 「已进入慢速队列·当前排位 {position}」—— D59 慢速队列态(带排位)
- `apps/web/src/components/ai/model-load-bar.tsx:71` `ai.pane.modelLoad.wait.aboutNmin` 「预计等待 约{minutes}分钟」—— D59 等待预估态(约 N 分钟)
- `apps/web/src/components/ai/model-load-bar.tsx:72` `ai.pane.modelLoad.load.low` 「低负载可能排队」—— D59 低负载态
- `apps/web/src/components/ai/model-load-bar.tsx:72` `ai.pane.modelLoad.load.medium` 「中负载可能排队」—— D59 中负载态
- `apps/web/src/components/ai/model-load-bar.tsx:72` `ai.pane.modelLoad.load.high` 「高负载可能排队」—— D59 高负载态
- `apps/web/src/components/ai/model-load-bar.tsx:72` `ai.pane.modelLoad.fastPass` 「已开启速通免排」—— D59 速通免排队态

### 未取证到(第 15 类)

| 问题 | 证据 |
| --- | --- |
| 词表 chat.modelAutoDescription「自动选择最优模型」(11031)是否有组件调用? | model-selector 组件内 0 命中(仅 50 行注释提及):词表在、调用无,不列条目 |
| 模型分类 chips(MODEL_CATEGORY_META 渲染位 321/1023)键名与词表值? | MODEL_CATEGORY_META 自 @ihui/shared 导入(model-selector.tsx:28),labelKey 清单未逐字核实,不列条目 |
| 是否存在「思考预算」类可见元素? | `git grep -c "思考预算" HEAD -- apps/web/src` → 0 命中 |
| modelLoad 其余排队键(wait.under1min/about1min/over10min、recovering)是否入列? | 词表值已核实(7668-7673),渲染分支在 shared model-load.ts(229-236),本票预算未单列,留待补查 |

## 16 记忆·规则·知识可见性

判据锚:「AI 对我知道什么/按什么行事」的可见性——记忆写入提示条与记忆管理入口(收编)、Typed Memory 记忆库(memory-cards)、记忆子图查询(memory-graph-panel)、知识库增强注入开关(sampling-params-panel)、技能库(skill-library)、规则管理器(rules-manager/RuleItem)。

- `apps/web/src/components/ai/progress-sections/memory-notice-bar.tsx:45` `ai.pane.memoryNoticeBar.title` 「已记住 {count} 条」—— 回合结束记忆写入提示条 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/memory-notice-bar.tsx:56` `ai.pane.memoryNoticeBar.manage` 「管理」—— 跳转记忆管理入口 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/progress-sections/memory-notice-bar.tsx:69` `ai.pane.memoryNoticeBar.moreItems` 「等 {count} 条」—— 提示条折叠计数 (收编自 web-bind2.tsv)
- `apps/web/src/components/ai/memory-cards.tsx:83` `memoryCards.rule` 「规则」—— 记忆类目页签:规则
- `apps/web/src/components/ai/memory-cards.tsx:83` `memoryCards.fact` 「事实」—— 记忆类目页签:事实
- `apps/web/src/components/ai/memory-cards.tsx:83` `memoryCards.preference` 「偏好」—— 记忆类目页签:偏好
- `apps/web/src/components/ai/memory-cards.tsx:83` `memoryCards.project` 「项目」—— 记忆类目页签:项目
- `apps/web/src/components/ai/memory-cards.tsx:101` `memoryCards.empty` 「该类目暂无记忆条目」—— 类目空态
- `apps/web/src/components/ai/memory-cards.tsx:137` `memoryCards.placeholder` 「输入要记住的内容…」—— 记忆条目输入占位
- `apps/web/src/components/ai/memory-cards.tsx:147` `memoryCards.add` 「添加」—— 添加记忆按钮
- `apps/web/src/components/ai/memory-cards.tsx:160` `memoryCards.copyYaml` 「复制该类目 YAML(#Rule 展开同源)」—— 复制类目 YAML(Rule 同源导出)
- `apps/web/src/components/ai/memory-graph-panel.tsx:201` `memoryGraph.searchPlaceholder` 「搜索记忆关键词…」—— 记忆子图搜索占位
- `apps/web/src/components/ai/memory-graph-panel.tsx:213` `memoryGraph.searchBtn` 「查询」—— 记忆子图查询按钮
- `apps/web/src/components/ai/memory-graph-panel.tsx:244` `memoryGraph.noHits` 「无匹配记忆」—— 子图查询无命中
- `apps/web/src/components/ai/memory-graph-panel.tsx:326` `memoryGraph.legend` 「命中 {hits} 条 · 全图 {total} 节点(点击节点查看全文)」—— 子图命中图例
- `apps/web/src/components/ai/memory-graph-panel.tsx:233` `memoryGraph.layoutForce` 「力导向」—— 子图布局切换:力导向
- `apps/web/src/components/ai/memory-graph-panel.tsx:233` `memoryGraph.layoutRing` 「环形」—— 子图布局切换:环形
- `apps/web/src/components/chat/sampling-params-panel.tsx:269` `chat.sampling.knowledgeContext` 「知识库增强」—— 知识库注入开关(P1 #26 默认开)
- `apps/web/src/components/chat/sampling-params-panel.tsx:272` `chat.sampling.knowledgeContextHint` 「发送时自动检索你的知识库,把相关内容注入回答。」—— 知识库注入开关说明
- `apps/web/src/components/chat/skill-library.tsx:146` `chat.skillLibrary.tabTemplate` 「模板」—— 技能库页签:模板
- `apps/web/src/components/chat/skill-library.tsx:148` `chat.skillLibrary.tabSlash` 「命令」—— 技能库页签:命令
- `apps/web/src/components/chat/skill-library.tsx:150` `chat.skillLibrary.tabSelfMedia` 「自媒体」—— 技能库页签:自媒体
- `apps/web/src/components/chat/skill-library.tsx:152` `chat.skillLibrary.tabOpenclaw` 「OpenClaw」—— 技能库页签:OpenClaw
- `apps/web/src/components/chat/skill-library.tsx:154` `chat.skillLibrary.tabMcp` 「MCP」—— 技能库页签:MCP
- `apps/web/src/components/chat/skill-library.tsx:157` `chat.skillLibrary.tabCustom` 「自定义」—— 技能库页签:自定义
- `apps/web/src/components/chat/skill-library.tsx:371` `chat.skillLibrary.title` 「Skill 库」—— 技能库面板标题
- `apps/web/src/components/chat/skill-library.tsx:376` `chat.skillLibrary.viewAll` 「查看全部」—— 技能库查看全部入口
- `apps/web/src/components/chat/skill-library.tsx:444` `chat.skillLibrary.sectionCustom` 「我的自定义」—— 分区:我的自定义
- `apps/web/src/components/chat/skill-library.tsx:449` `chat.skillLibrary.loginRequired` 「请先登录后管理自定义 Skill」—— 自定义 Skill 登录门槛
- `apps/web/src/components/chat/skill-library.tsx:454` `chat.skillLibrary.emptyCustom` 「还没有自定义 Skill，点击右上角新建」—— 自定义分区空态
- `apps/web/src/components/chat/skill-library.tsx:522` `chat.skillLibrary.sectionAiSkills` 「AI 精选合集」—— 分区:AI 精选合集
- `apps/web/src/components/chat/skill-library.tsx:658` `chat.skillLibrary.noContent` 「（无内容）」—— Skill 无内容占位
- `apps/web/src/components/chat/skill-library.tsx:850` `chat.skillLibrary.statusAvailable` 「已上线」—— Skill 状态:已上线
- `apps/web/src/components/chat/skill-library.tsx:905` `chat.skillLibrary.statusComingSoon` 「即将上线」—— Skill 状态:即将上线
- `apps/web/src/components/chat/skill-library.tsx:1081` `chat.skillLibrary.invokeButton` 「调用」—— Skill 调用执行按钮
- `apps/web/src/components/chat/skill-library.tsx:1160` `chat.skillLibrary.invokeSendToChat` 「发送到对话」—— 调用结果发送到对话
- `apps/web/src/components/chat/skill-library.tsx:1168` `chat.skillLibrary.invokeFillInput` 「填入输入框」—— 调用结果填入输入框
- `apps/web/src/components/rules/rules-manager.tsx:63` `rules.totalRulesSorted` 「共 {n} 条规则,按优先级降序排列」—— 规则计数与排序说明
- `apps/web/src/components/rules/rules-manager.tsx:68` `rules.autoGenerate` 「自动生成」—— 工具栏:自动生成
- `apps/web/src/components/rules/rules-manager.tsx:72` `rules.detectConflicts` 「检测冲突」—— 工具栏:检测冲突
- `apps/web/src/components/rules/rules-manager.tsx:76` `rules.knowledgeGraph` 「知识图谱」—— 工具栏:知识图谱
- `apps/web/src/components/rules/rules-manager.tsx:80` `rules.abTest` 「A/B 测试」—— 工具栏:A/B 测试
- `apps/web/src/components/rules/rules-manager.tsx:95` `rules.newRule` 「新建规则」—— 新建规则按钮
- `apps/web/src/components/rules/rules-manager.tsx:112` `rules.emptyHint` 「暂无规则,点击「新建规则」创建」—— 规则空态引导
- `apps/web/src/components/rules/RuleItem.tsx:47` `rules.disabled` 「禁用」—— 规则禁用态标
- `apps/web/src/components/rules/RuleItem.tsx:90` `rules.enabled` 「启用」—— 规则启停切换文案
- `apps/web/src/components/rules/RuleItem.tsx:52` `rules.hitCount` 「命中 {n} 次」—— 规则命中计数
- `apps/web/src/components/rules/RuleItem.tsx:93` `rules.detail` 「详情」—— 规则详情按钮唯一文案面
- `apps/web/src/components/rules/RuleItem.tsx:96` `rules.test` 「测试」—— 规则测试按钮唯一文案面
- `apps/web/src/components/rules/RuleItem.tsx:99` `rules.edit` 「编辑」—— 规则编辑按钮唯一文案面

### 未取证到(第 16 类)

| 问题 | 证据 |
| --- | --- |
| 是否存在「记忆门控」可见元素? | `git grep -c "记忆门控" HEAD -- apps/web/src` → 0 命中 |
| skill-library 组件引用但词表值未逐字核实的键? | invokeClose(908/977/1119)、create(390)、searchPlaceholder(418)、empty(484/533)、disabled(653)、save/saving(801)、editTitle/createTitle(726):组件有引用,chat.skillLibrary 块内对应值未逐字取证,不列条目 |
| skillLibrary.builtin.* 内置技能内容是否入列? | 词表块 11355 起含 6 组内置模板(name/desc/template),属技能内容库而非控件文案,超出本类口径,未逐条收编 |
| personalityPresets 预设文案是否入列? | 词表 11682 起(default 等 label/description/prompt),组件经 tPresets 动态渲染,属预设内容库,超出本类口径 |

## 计数与自检

| 类 | 条目数 | 未取证到行数 | 收编条数 | 补查条数 |
| --- | --- | --- | --- | --- |
| 13 计量与成本 | 43 | 2 | 5 | 38 |
| 14 会话管理·分享·导出·侧栏 | 55 | 4 | 8 | 47 |
| 15 模型与档位选择 | 49 | 4 | 0 | 49 |
| 16 记忆·规则·知识可见性 | 50 | 4 | 3 | 47 |
| 合计 | 197 | 14 | 16 | 181 |

| 自检项 | 结果 |
| --- | --- |
| 是否 ≤200 条 | 是(197/200;预算裁剪口径:瞬态回执(toast.*/copied/exportStarted 等)、说明性 hint、纯 aria 重复面、同对话框通用按钮与变体态不单列,已在各类未取证到中登记留痕) |
| 每类 ≥1 条真实条目 | 是(43/55/49/50) |
| 收编行保留 tsv 快照行号并尾注 | 是(16 条,尾注「(收编自 web-bind2.tsv)」) |
| 补查行号面 | HEAD=53ba9ea80d;sidebar-chat-history.tsx 与 zh-CN.json 取 HEAD 面,其余组件工作树=HEAD |
| git grep 模式清单 | t(' ; [ce](' ; quotaAction ; branchFromHere ; "二维码" ; "思考预算" ; "记忆门控" ; '"chatHistory"'/-A70 ; '"sampling"'/-A34 ; '"(sessionUsage\|exportMenu\|modelLoad\|renameDialog)"'/-A26 ; '"(memoryCards\|memoryGraph\|budgetBar\|messageUsage\|org)"'/-A24 ; '"rules"'/-A22 ; '"unarchive"'/-B4 ; '"viewAll"'/-B2 ; '"history"' ; 特征键 -E 批量(约 70 键) |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
