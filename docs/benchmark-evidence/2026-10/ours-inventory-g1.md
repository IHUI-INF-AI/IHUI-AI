<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 我方侧对话流清单·组1(web 端,第 1-4 类:消息气泡与内容块/思考推理展示/工具调用卡/终端与命令执行)(D203,2026-10-01)

> 票:D203(D160 拆票 1/4)。端=web 主战场;类别切分与判据锚 = 三份竞品清单的共享分类法:
> [trae §1-4](../2026-09/trae/chat-stream-inventory.md) / [codex §1-4](../2026-09/codex/chat-stream-inventory.md) / [qoder §1-4](../2026-09/qoder/chat-stream-inventory.md) 同名节。
> 读数日 2026-10-01,基线 HEAD `53ba9ea80d`。行号是当日快照,仅辅助定位,**复核以「文件 + 键路径 + 原文」三元组为准**,行号不作判据。
> 工作树含并行会话在飞改动,未提交新文件一律不收编(如 `turn-status-line.tsx` 等未跟踪面属其它会话,不在本票射程)。
> 形态注记(2026-10-01 返工):正文条目由表格改为顶层 `- ` 行(与 g2/g3/g4 同构,供 `benchmark-diff-matrix.mjs --per-class` 解析);竞品对照锚改 blockquote(不进解析面);内容逐字保真,仅承载形态重构。

## 0 取证物与读数

| 取证物 | 读数 |
| --- | --- |
| `apps/web/src/components/chat/message-list/MessageItem.tsx` | 气泡结构与操作区:L184-192 命名空间装配(`chat`/`aiChat`/`taskStatus`/`ai.toolCall`),L1299-1530 气泡操作区 |
| `apps/web/src/components/chat/message-list/message-item-parts.tsx` | 思考预览行 L142;用量徽章 L188-222;用量明细 L302-350 |
| `apps/web/src/components/ai/markdown-stream.tsx` | L28 rehype-katex 接线;L157-221 代码块 header + HTML/SVG 预览条;L663-736 图片渲染;L891/L1161/L1170 rehype 插件链;mermaid 命中 7 处 |
| `apps/web/src/components/ai/tool-call-card.tsx` | L1268 流中预览标签;L80/1042/1262 diff 预览注释 |
| `apps/web/src/components/ai/tool-approval-dialog.tsx` | L168-195 四态映射;L529-575 弹窗主体;L663-755 执行环境/网络目标区块 |
| `apps/web/src/components/ai/progress-sections/terminal-section.tsx` | L13 裁尾露出;L41-49 状态映射与预览上限;L61-108 ANSI 块;L124-216 输入回传行;L225-238 live 输出与权威输出 |
| `packages/i18n/messages/web/zh-CN.json` | L8871 流中预览;L10892-10901 右键菜单;L10961-10965 超时;L10967-10981 导出;`ai.toolCall.*`/`chat.message.*`/`editor.toolApproval.*` 全族 |
| `packages/i18n/messages/shared/zh-CN.json` | L532 `chat.terminal.*` 与 `taskStatus.toolCallCount`;**web+shared 双文件合并加载,判 MISSING 必须双文件都查** |
| `docs/benchmark-evidence/2026-09/web-bind2.tsv` | progress-sections 套件 271 行四列(组件+行号+i18n键+中文原文),本清单收编 |
| `docs/benchmark-evidence/2026-10/d150-runtime-reconciliation.md` | 运行时侧交叉证据(reasoning 帧已验证/流式契约) |

**方法**:静态现读(组件源码 + 双语言包键值 + tsv 收编),口径=对话流内**用户可见文案/控件**,与竞品清单同型;运行时逐帧证据不重复取证,引 D150。**方法边界**:本清单未做浏览器逐屏截图,凡「未见文案」的判断全部走 §0b 声明的零命中搜索面,并逐类登记「未取证到」。

## 0b 零命中声明的搜索面(逐类「未取证到」共用,照抄竞品清单第 0 节口径)

- 搜索面 A:`packages/i18n/messages/web/zh-CN.json` + `packages/i18n/messages/shared/zh-CN.json`(键路径与中文原文各查一遍);
- 搜索面 B:`apps/web/src/components/{chat,ai}/**` 组件源码字面量;
- 搜索面 C:`docs/benchmark-evidence/2026-09/web-bind2.tsv` 中文原文列(271 行);
- **零命中 ≠ 功能不存在**,只说明它没有对话流内的可见文案(可能后端下发、可能是图标/数字无文字、也可能确实没做)。凡未取证到者均如实列出,不下"做了/没做"的结论。

---

## 1 消息气泡与内容块(条目 26 + 未取证到 6)

> 类别判据锚:消息气泡结构、内容块类型(代码/LaTeX/Mermaid/图片/产物)、气泡操作区、元信息行、用量徽章;对齐 trae §1、codex §1、qoder §1 同名节。

- `MessageItem.tsx:1299-1530` `chat.message.*` + `aiChat.checkpoint.rewindHere` 「隐藏内容/显示内容 · 复制 · 朗读/停止朗读 · 下载图片 · 分享 · 元信息 · 重新生成 · 回退到此处 · 发布到社区」—— AI 气泡操作区(9 控件)(组件 + A 面)
- `chat.message.readAloudTruncated` 「内容过长,只朗读前 {max} 字」—— 朗读截断提示(A 面)
- `MessageItem.tsx:1299-1530` `chat.message.*` 「编辑 · 复制 · 回复 · 删除」—— 用户气泡操作区(4 控件)(组件 + A 面)
- `chat.message.editAndRerun` 「保存并重跑」—— 编辑重跑(A 面)
- `chat.message.editRollbackFiles` 「同时回滚文件改动」—— 编辑回滚文件(A 面)
- `zh-CN web L10892-10901` `chat.contextMenu.*` 「复制为 Markdown / 复制文本 / 删除消息 / 反馈 / 点赞 / 点踩 / 重新生成 / 从此处分支」—— 右键菜单(A 面)
- `zh-CN web L10967-10981` `chat.exportMenu.*` 「导出 / 分享会话 / 导出 Markdown / 导出 JSON / 导出快照图 (PNG) / 复制分享链接 / 分享链接已复制 / 导出 PDF」—— 导出菜单(A 面)
- `MessageItem.tsx:1299-1530` `taskStatus.toolCallCount` 「时间戳 + 耗时 + {n} 次工具调用 + 用量徽章」—— 气泡元信息行(组件 + shared zh-CN L532)
- `message-item-parts.tsx:188-222` `chat.sessionUsage.*`/`messageUsage.*` 「输入 Token / 输出 Token / 输入费用 / 输出费用 / 未配置价格 / 按当前模型价目表折算(元/千 token),非最终账单 / 总计 / 本条消息 Token 用量(aria) / 估算」—— 用量徽章(组件 + A 面)
- `message-item-parts.tsx:302-350` `ai.message.metrics.*` 「用量明细 / 推理 tokens / 首 token / 总耗时 / 模型 / 成本」—— 用量明细弹层(组件 + A 面)
- `message-item-parts.tsx:142` `ai.toolCall.thinking`/`waitingResponse` 「正在思考:{preview} / 正在等待模型响应…」—— 等待/思考行(组件 + A 面)
- `zh-CN web L10961-10965` `chat.errors.timeout15s`/`timeout60s` 「AI 响应超时(15 秒内未收到任何内容),请稍后重试 / AI 思考超时…」—— 超时文案(A 面)
- `chat.fallbackNotice`/`fallbackNoticeQuota` 「已切换到备用模型 {backup}(原模型 {primary} 暂时不可用)」—— 备用模型切换(A 面)
- `retry-notice`(web-bind2.tsv) `chat.retryScheduled` 「上游暂不可用,第 {attempt}/{max} 次重试,{seconds} 秒后继续」—— 重试提示(tsv 收编)
- `markdown-stream.tsx`(全文件) —— 流式 Markdown 渲染器(打字机式增量)(组件)
- `markdown-stream.tsx:157-221` 「语言→示例文件名映射,兜底 `code.<lang>`/`code.txt`;附 HTML/SVG 预览条」—— 代码块 header(组件)
- `markdown-stream.tsx:28+L891/L1161/L1170` 「rehype-katex 接线 ⇒ **能渲染**(与 qoder §0「能渲染、无文案」同型,不列缺口)」—— LaTeX 公式(组件)
- `markdown-stream.tsx`(7 处命中) 「**能渲染**(不列缺口)」—— Mermaid 图(组件)
- `markdown-stream.tsx:663-736` `ai.toolCall.imageAltDefault`/`imageLoadFailed`/`openInNewWindow` 「AI 生成图片(alt) / 图片加载失败 / 在新窗口打开」—— 图片块(组件 + A 面)
- `ai.toolCall.filePathLabel`/`copyPath` 「文件路径 / 复制路径」—— 文件路径块(A 面)
- `chat.artifactPreview`/`chat.canvasOpenInCanvas` 「预览 / 在画布打开」—— 产物预览(A 面)
- `citation-bar`(web-bind2.tsv) `ai.toolCall.citationsTitle` 「引用来源」—— 引用来源条(tsv 收编)
- `compression-divider`(web-bind2.tsv) 「组件在档;键与原文四列见 tsv」—— 压缩分隔线(tsv 收编)
- `taskStatus.toolCallCount` 「{n} 次工具调用」—— 工具卡外层计数(shared zh-CN L532)
- `MessageItem.tsx:184-192` `VIEW_FAILURE_NAMESPACE` 「失败/降级视图独立命名空间装配」—— 失败视图命名空间(组件)
- `ai.toolCall.pendingTask*` 「键族在档(A 面)」—— 待办任务块(A 面)

### 1b 竞品对照锚(每类至少一侧有条目可比;blockquote 承载,不进解析面)

> - **trae §1**(清单 L42-75):轮次状态族(`任务完成`/`手动终止输出`/`异常打断`/`已切换到新请求`/`任务耗时`)+「由 AI 生成」免责条 + 动态 UI(Widget 生成中/复制为图片/在面板打开)+ 产物卡状态族(`正在转换预览...`/`此文件过大,暂不支持在线预览。`)。
> - **codex §1**(L133-156):ThreadItem 类型全集(`userMessage`/`agentMessage`/`plan`/`reasoning`/`imageView`/`imageGeneration`/`webSearch`)+ artifact 卡一族 i18n 键名 + 代码块/LaTeX/Mermaid/图表 chunk 名。
> - **qoder §1**(L64-95,条目数 274):`chatActivity.recordingNote.*` 录音纪要内容块全族(录/停/重试/权限/错误分支 20+ 键)。

### 未取证到(第 1 类,照抄 §0b 口径)

- 「找到 N 个结果」结果计数形态(工具结果面,竞品 trae §3a 有族:`{count} 个结果`/`找到 {count} 个 {keywords} 的结果`/`无结果`):未取证到 —— `个结果|个匹配|找到.{0,6}个` 在 A/B 面零命中(A 面仅 errorCatalog「未找到目标资源」一族,属错误文案非结果计数)
- 每轮 AI 回复底部「由 AI 生成」免责条(trae 每轮恒有):未取证到 —— A/B 面「由 AI 生成」零命中
- 轮次状态四态条(任务完成/手动终止/异常打断/被新请求顶替):未取证到 —— 流内轮级状态条文案未取证到;我方可见的是单条消息级状态与重试/超时文案(上表)
- 消息「复制为图片」(trae `ai.widget.copyAsImage`):未取证到 —— 我方有 复制(文本)/下载图片,无「复制为图片」
- 录音纪要内容块(qoder `chatActivity.recordingNote.*`):未取证到 —— 对话流内无录音纪要块
- Widget「动态 UI」内容块类型(trae `ai.model.dynamic_ui`):未取证到(注:chart-template-card 属并行会话在飞文件,本票不收编,该格留待其入库后复核)

---

## 2 思考推理展示(条目 8 + 未取证到 4)

> 类别判据锚:思考区标题/字数/复制、推理 tokens、reasoning 流式帧;对齐 trae §2、codex §2、qoder §2 同名节。

- `thinking-section.thinkingStreaming`(tsv) 「思考中...」—— 思考区标题(流式中)(web-bind2.tsv)
- `thinking-section.thinkingChars`(tsv) 「字(计数后缀)」—— 思考字数(tsv)
- `thinking-section.copyThinking`(tsv) 「复制思考内容」—— 复制思考内容(tsv)
- `plan-steps-card.stepThinking`/`copyReasoning`(tsv) 「思考 / 复制推理过程」—— 计划卡内思考标签(tsv)
- `ai.toolCall.thinking` 「正在思考:{preview}」—— 折叠态思考预览(A 面)
- `ai.toolCall.waitingResponse` 「正在等待模型响应…」—— 等待行(A 面)
- `ai.message.metrics.reasoningTokens` 「推理 tokens」—— 推理 tokens(用量侧)(A 面, message-item-parts L302-350)
- D150 证据「`reasoning` 事件已验证(CF 轨 246 帧;gemini 轨未触发)」—— reasoning 流式帧(d150-runtime-reconciliation.md §四)

### 2b 竞品对照锚

> - **trae §2**(L79-94):完成态标题 `思考过程`/`推理过程`/`推理中`/思考强度档位(`轻`/`高`/`极高`/`最高`)/思考模式开关说明全文/`参考了 {0} 个上下文`/`使用了 {count} 次电脑控制`/反馈理由 `思考过程太长`。
> - **codex §2**(L162-178):`reasoning{content,id,summary,type}` + 三条流式事件(摘要与全文分道:`summaryTextDelta`/`summaryPartAdded`/`textDelta`)+ `ReasoningSummary` 枚举(auto|concise|detailed|none)+ `ReasoningEffort` 枚举;codex 自记折叠标题原文未取证到。
> - **qoder §2**(L378-406):`agentRunStage` 十态(排队中/准备中/思考中/使用工具/等待确认/后台执行中/正在停止/已完成/失败/已停止)+ `chatActivity.thinking`/`agentThought`/`expandThinking`/`agentWorkDuration`(耗时 {{seconds}}秒)。

### 未取证到(第 2 类,照抄 §0b 口径)

- 思考块 token 数(qoder §0 同缺):未取证到 —— 思考区只给字数(`thinkingChars`);token 数只在用量明细(`reasoningTokens`),不在思考块上
- 思考耗时形态(qoder `agentWorkDuration`=耗时 {{seconds}}秒):未取证到 —— 思考区无耗时文案
- 「参考了 N 个上下文」行内计数(trae):未取证到 —— 行内零命中;我方计数形态在标签页(`引用 ({count})`/`计划 ({count})`)
- 思考强度档位在流内的展示(trae 轻高极高最高):未取证到 —— 流内思考块无档位展示(档位属模型参数面,归组4·类15,此处只记流内缺口)

---

## 3 工具调用卡(条目 23 + 未取证到 7)

> 类别判据锚:工具卡状态、审批弹窗(执行环境/网络目标/放行规则)、diff 预览、汇总卡;对齐 trae §3a-3f、codex §3、qoder §3 同名节。

- `ai.toolCall.statusRunning/statusSuccess/statusFailed/statusRevoked` 「执行中 / 成功 / 失败 / 已撤回(未执行)」—— 卡状态四态(A 面)
- `ai.toolCall.callingTool` 「正在调用工具 {name}」—— 调用行(A 面)
- `ai.toolCall.streamingPreviewLabel`(`tool-call-card L1268`,zh-CN L8871) 「流中预览(执行中,最终以结果为准)」—— 流中预览(D113)(组件 + A 面)
- `tool-calls-section`(tsv):args/result/error/revoked 「参数 / 结果 / 错误 / 已撤回」—— 卡区字段(tsv)
- `tool-calls-section.searchPlaceholder` 「搜索工具...」—— 卡区搜索(tsv)
- `tool-calls-section.title` 「工具调用」—— 卡区标题(tsv)
- `tool-call-summary-card`(tsv) 「工具调用汇总 / 总耗时 / 总调用 / 更多 / 收起 / 统计(工具调用中…/搜索文件/搜索网页/修改文件/新增行数/删除行数)」—— 汇总卡(tsv)
- `ai.toolCall.plan` 「计划 ({count})」—— 计划卡(A 面)
- `ai.toolCall.reference` 「引用 ({count})」—— 引用标签(A 面)
- `ai.toolCall.openInWorkPanel` 「在工作展示区打开」—— 工作展示区(A 面)
- `tool-call-card L80/1042/1262` 「diff 预览(三态降级,D90 已✅)」—— diff 预览(组件)
- `editor.toolApproval.title/description` 「工具审批 / AI 请求执行以下高危操作,请确认是否允许」—— 审批弹窗·标题/描述(A 面)
- `editor.toolApproval.approve/reject` 「批准 / 拒绝」—— 审批·批准/拒绝(A 面)
- `editor.toolApproval.argsPreview` 「参数预览」—— 审批·参数预览(A 面)
- `editor.toolApproval.pendingCount` 「还有 {count} 个待审批」—— 审批·批量待决(A 面)
- `editor.toolApproval.envLabel/envInSandbox/envOutsideSandbox/envBackend` 「执行环境 / 在沙箱中运行 / 在沙箱外运行 / 隔离方式:{backend}」—— 审批·执行环境(A 面, tool-approval-dialog L663-755)
- `editor.toolApproval.envDegraded` 「沙箱能力不可用,已降级为受限直跑」—— 审批·沙箱降级(A 面)
- `editor.toolApproval.envNetworkSection/envNetworkBlocked/envNetworkOpen/envNetworkOff` 「网络 / 被拦截的网络目标 / 本次可访问外网 / 本次不开放网络」—— 审批·网络区块(A 面)
- `editor.toolApproval.envUnknown` 「未上报(不据档位推断,请拒绝并要求重试)」—— 审批·网络未上报(A 面)
- `editor.toolApproval.envAllowTargetOnce/…Session/…Always` 「仅本次允许该目标 / 本次对话允许该目标 / 始终允许该目标(90 天后失效)」—— 审批·网络目标三档(A 面)
- `editor.toolApproval.decisionLabel/decisionWhyNow/…WhyYou/…Reversibility/…AfterDecision(+values)` 「决策信息族(为何现在/为何是你/可逆性/决策之后)」—— 审批·决策说明(A 面)
- `editor.toolApproval.stateBlocking/stateRequested/stateWaitingForMe/stateOverdue` 「阻塞中 / 等待处理 / 等我判断 / 已过期」—— 审批·状态四态(A 面, L168-195 映射)
- `editor.toolApproval.grantRuleToggle/grantRuleDesc/grantRuleConfirmTitle/…Content` 「批准并把这类命令加入放行(90 天后自动过期)+ 确认弹层」—— 审批·放行规则(A 面)

### 3b 竞品对照锚

> - **trae §3a-3f**(L104-190):字段标签(`工具:`/`参数:`/`结果({status}):`)/卡状态八态(失败/已取消/已执行/已跳过/加载中/生成中/搜索中/自动审批中/冲突)/结果计数族/「自动运行」三档 + 审批粒度三档(`仅本次运行`/`本次会话允许`/`始终允许`)/白名单追加与风险命令确认/沙箱逃逸授权(`是否允许以下前缀的命令在沙箱外运行?`)/网络受限授权(`受限网络目标:`/`被拦截的网络目标:`)/删除确认卡/21 工具组 × 四态标题(`正在编辑`/`已编辑`/`编辑失败`/`编辑文件` 等)。
> - **codex §3**(L184-205):`commandExecution{command,commandActions,cwd,durationMs,exitCode,processId,source,status}` 全字段/四态(`inProgress|completed|failed|declined`)/`GuardianRiskLevel`(`low|medium|high|critical`)+`rationale`/审批枚举(`Approved/Denied/Aborted/Timed out`)/`/raw [on|off]` 原始事件流开关。
> - **qoder §3**(L538-564,条目数 213):`browserAnnotation.*` 网页注释族;qoder §0 自记:工具卡内全文搜索未取证到、结果截断仅两处 —— **我方反超**:卡内搜索(`搜索工具...`)与截断露出(§4)都有。
> - **形态差异(可比不下结论)**:审批授权粒度我方是「网络目标三档 + 命令类放行规则(90 天过期)」,trae 是「运行三档 + 白名单追加」,codex 是「risk level + rationale」;我方 `decision*` 决策说明族在三家清单里均无直接同型条目。

### 未取证到(第 3 类,照抄 §0b 口径)

- 结果计数形态(「{count} 个结果」族,trae §3a):未取证到(同第 1 类第 1 条,该形态横跨类1/类3,一侧登记)
- 逐工具四态标题族(trae §3d:21 组 × running/completed/failed/canceled):未取证到 —— 我方是通用 `正在调用工具 {name}` + 状态徽章,无逐工具标题枚举
- 「跳过/已跳过」态(trae §3a):未取证到 —— 我方四态(执行中/成功/失败/已撤回)无跳过
- 「自动审批中」态(trae `auto-reviewing`):未取证到 —— 我方审批流为人工四态,无自动审批文案
- 「冲突/{count} 个有冲突」态(trae §3a):未取证到
- 「自动运行/手动运行/白名单运行」三档下拉(trae §3b):未取证到 —— 流内无三档下拉;我方对应面是 `grantRule*` 放行规则(上表),形态不同
- 沙箱逃逸授权的前缀形态(trae `是否允许以下前缀的命令在沙箱外运行?`):未取证到 —— 我方是目标级(envNetwork*)与前缀级语义未逐字对应,A 面「前缀」零命中

---

## 4 终端与命令执行(条目 19 + 未取证到 5)

> 类别判据锚:终端状态口径、输出预览/裁尾、ANSI 渲染、live 流、键盘输入回传;对齐 trae §4、codex §4、qoder §4 同名节。

- `toStreamStatus`(terminal-section L41-46) 「exit code 非 0 视为失败(注释原文)」—— 状态口径(组件)
- `OUTPUT_PREVIEW_LIMIT`(L49) 「2000 字符,超出折叠由「显示更多」显式展开(禁止渐变遮罩)」—— 输出预览上限(组件)
- `tailWithOmittedCount`(L13) 「裁尾与「少列了多少」原子产出,淘汰条数必须渲染成「N more」,不许静默截断」—— 裁尾露出(b76-13)(组件)
- `parseAnsi`/`AnsiCodeBlock`(L61-108) 「结构化 span 渲染;终端输出按不可信输入处理,禁拼 HTML 字符串」—— ANSI 彩色渲染(组件 + `lib/ansi.ts`)
- `terminal_delta → store.terminalOutputs`(L225-228) 「命令执行期间后端逐块下发(对标 Codex/Trae 实时 stdout 行流)」—— live 输出流(组件)
- `effectiveOutput`(L235-238) 「live 缓冲与 `terminal_end.output` 取更长者(后端截 8000 字符兜底)」—— 权威输出(组件)
- `useLiveElapsed`(L242+) 「运行中实时计时;结束后由后端权威 duration」—— 运行计时(组件)
- `TerminalInputRow`(L124-216) `chat.terminal.waitingInput/promptLabel/submit` 「等待你的输入 / 命令提示:{{prompt}} / 发送」—— 键盘输入行(D151)(组件 + shared L532)
- `chat.terminal.timeoutNoInput` 「{{seconds}} 秒内未收到输入」—— 输入超时(shared zh-CN L532)
- `chat.terminal.mobileUnsupported` 「此命令需要键盘输入,手机端暂不能代答,请在桌面端处理或停止本次执行」—— 移动端降级(shared zh-CN L532)
- `TerminalInputRow L116-123` 「键入不落 store/localStorage/console/日志;无 sessionId 如实失败,不 POST 到猜出来的地址;一帧只送一次」—— 输入安全边界(组件注释)
- `postTerminalInput`(L149-163) 「只走 @ihui/api-client;判据读 `ack.ok`(HTTP 200 + {ok:false} 不算送达)」—— 输入上行(组件)
- `terminal-section.isolation`(tsv) 「命令在隔离沙箱中执行,默认不开放网络」—— 隔离沙箱提示(tsv)
- `terminal-section.exitCode`(tsv) 「退出码 {n}」—— 退出码(tsv)
- `terminal-section`(tsv):output/live/copyOutput/clearLive/truncated 「输出 / 实时输出 / 复制输出 / 清空实时 / …(已截断,共 {total} 字符)」—— 输出区(tsv)
- `terminal-section`(tsv):running/failed 「{n} 运行中 / {n} 失败」—— 计数徽标(tsv)
- `toolRunCommand`(tsv) 「执行命令」—— 执行命令标签(tsv)
- `terminal-section L55 注释` 「消息流内轻量 pre;真 xterm 只在 AiTerminalDock」—— xterm 分工(组件)
- `useStreamStatusLabel`(`chat/stream/stream-ui.tsx`) 「与工具行同一口径的统一状态语义(运行/成功/失败)」—— 流状态标签(组件)

### 4b 竞品对照锚

> - **trae §4**(L198-212):输出三态(`该命令执行无输出`/`暂无输出`/`等待命令输出`)/`已截断 {linesDropped} 行`/选区「添加到对话」/终端环境选择(极速终端/系统终端)/只读终端开关/执行时自动打开终端三选项/折叠计数(`执行 {count} 条命令`)。
> - **codex §4**(L211-228):`item/commandExecution/terminalInteraction` 终端交互回传 + `TerminalInteractionNotification`/`command/exec/resize|write|terminate`/`Waiting for a keypress...`/后台终端清理(`thread/backgroundTerminals/clean`)/复制最后一条消息(`Copied last message to clipboard`)。
> - **qoder §4**(L781-803):终端命令三态(`终端命令 运行中/已运行/运行失败`)+ 后台进程族(`chatSession.backgroundProcesses.*`);qoder §0 自记:**退出码未取证到、命令卡复制按钮未取证到** —— **我方反超**:`退出码 {n}` 与 `copyOutput` 都在档。

### 未取证到(第 4 类,照抄 §0b 口径)

- 无输出三态文案(trae `该命令执行无输出`/`暂无输出`/`等待命令输出`):未取证到 —— A/B/C 面只有 `truncated`(截断)与输出区展开,无显式「无输出」文案
- 终端选区「添加到对话」(trae 全家桶:选区报错一键入对话):未取证到 —— web 消息流内零命中
- 终端环境选择面(trae 极速终端/系统终端):未取证到 —— 流内无终端环境选择文案(隔离方式仅 `isolation` 一句与审批弹窗 `envBackend`)
- 折叠计数「执行 {count} 条命令」形态(trae):未取证到 —— 我方计数形态是 `{n} 运行中/{n} 失败`,无「执行 N 条命令」折叠串
- 输入行的超时自动收口(qoder 无,trae 无;我方 `timeoutNoInput` 键在档):键在档但**触发时序未做运行时取证**(属运行时行为,引 D150 口径不算静态缺口)

---

## 收尾读数

- 本票条目实数(2026-10-01 返工后重数):正文 类1 26 + 类2 8 + 类3 23 + 类4 19 = **76 条**;未取证到 6+4+7+5 = **22 条**;解析面合计 **98 条** ≤ 200,合规(D160 规矩)。
- 每类均满足「我方与竞品两侧都有条目可比,不得一侧空着下结论」:类1/2/3/4 的竞品侧锚分别引 trae/codex/qoder 同名节正文(§1b/§2b/§3b/§4b,blockquote 承载),非仅引用结论。
- 「未取证到」小节口径与竞品清单第 0 节同型(搜索面声明 + 逐条零命中证据 + 零命中≠不存在声明)。
- 后继:D204(组2·类5-8)/D205(组3·类9-12)/D206(组4·类13-16)同口径拆票;D207 逐类目对账矩阵收口。
