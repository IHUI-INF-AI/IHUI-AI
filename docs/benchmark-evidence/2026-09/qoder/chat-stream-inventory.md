<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Qoder CN 对话流可见元素清单（竞品取证）

- 取证对象：**Qoder CN 桌面版 `qoder-cn` v0.4.3**（`G:/Qoder CN/resources/app.asar` → `/package.json` 的 `"version": "0.4.3"`，当次实测）。
- 取证物（本机只读导出，均在 `G:\IHUI-AI\.ihui-agent\tmp\v5-evidence\qoder\`）：
  - `renderer.js` 20,777,438 B / 4,330 行（压缩单文件，含对话流全部 UI 逻辑与中英文案）
  - `main.js` 12,235,046 B
  - `dynamic-text.json` 9,923 B（zh/en 双语模型目录，可服务端下发）
- 取证方式：不做通读，按模式穷举。可复跑的工具在 `qoder/_work/`：
  - `extract_res.mjs` — 解析 18 个 `XResources={zh:{…},en:{…}}` 语言包（无 eval，纯字面量扫描）
  - `combine.mjs` → `all-zh.tsv`（**8,193 条 zh 文案，逐条带键路径**）
  - `extract_jsonblobs.mjs` → `json-error.tsv`（`JSON.parse` 内嵌错误码目录，87 条）+ `extract_err.mjs` → `error-table.jsonl`（72 条）
  - `extract_all.mjs` → `cjk-literals.txt`（10,713 个含 CJK 的字符串字面量 + 偏移）、`classnames.txt`（4,040 个 className）、`icon-candidates.txt`、`data-testid.txt`
  - `gen2.mjs` — 把 `all-zh.tsv` 按 16 类前缀路由，产出本文件正文（**路由规则逐条写在每节的"路由前缀"行，可复核可复现**）
- 覆盖数：**16 类正文 3376 条 / 附录 A（对话流命名空间内未落进 16 类）396 条 / 附录 B（非对话流命名空间，仅计数）4421 条**。
- 复核方法：正文每行的"元素/状态"是**语言包内的完整键路径**；"出处"列给出该键在 `renderer.js` 里的字面量形态（压缩后键名不带包前缀）。例：
  `grep -F 'subagentRunning:"子 Agent 正在执行"' renderer.js` → 1 命中。
- 纪律：全程只读竞品目录；未改动 `G:/Qoder CN/**` 与 `C:\Users\Administrator\.qoder-cn`；所有临时物落在 `.ihui-agent/tmp/v5-evidence/qoder/_work/`。
- 本清单**只列条目不下结论**。凡"未取证到"均为字面搜索零命中，不代表该功能不存在（可能走后端下发或无 UI 文案）。

## 0 逐类「未取证到」核对（先声明缺口，再给清单）

> 每条都是**字面搜索零命中**的证据，搜索面：`_work/all-zh.tsv`（8,193 条 zh 语言包文案）+ `_work/cjk-literals.txt`（10,713 条含 CJK 字面量）。零命中 ≠ 功能不存在，只说明它**没有对话流内的可见文案**（可能后端下发、可能是图标/数字无文字、也可能确实没做）。

| 类 | 问题 | 结果 |
| --- | --- | --- |
| 1 | 用户消息的时间戳文案 | **未取证到**（`chatTimeline.turnFallback` 只给"第 {{count}} 轮"，无逐条时间） |
| 1 | LaTeX/公式块的控件文案 | **未取证到**："公式" 0 命中、"LaTeX"/"katex" 在 zh 包 0 命中；bundle 内确有 `katex`+`mathml` 实现 ⇒ 能渲染、无文案 |
| 1 | 图表（Mermaid 之外的 chart） | **未取证到**：`echarts`/`Chart.js` 0 命中；"图表"5 处全在 Mermaid 默认标签 |
| 1 | 附件类型图标 | 有（`QoderFile*Fill` 一套，见附录 G），无逐类型文字标签 |
| 2 | 思考块 token 数 | **未取证到**："Token 数" 0 命中；思考块只给时长 `agentWorkDuration:"耗时 {{seconds}}秒"` |
| 2 | 思考能否整体关闭 | 只在模型参数里：`composer.model.settings.efforts.none:"关闭思考"`（按模型档设，不是会话开关） |
| 3 | 工具卡内全文搜索 | **未取证到**。有的是事件流**分类筛选**（`executionTrace.filter:"筛选执行事件"` + 10 个类别）与侧栏任务搜索（`conversationSearch.*`） |
| 3 | 工具结果截断提示 | 只有 `tools.progressTruncated:"过程（较早内容已截断）"` 与 `chatSession.backgroundProcesses.outputTruncated` |
| 4 | 命令退出码显示 | **未取证到**。命令卡只有三态 `终端命令 运行中 / 已运行 / 运行失败`（`chatActivity.command.status.*`）；"退出码"字样只出现在 MCP 进程（`extensions.mcp.processExitCode:"进程退出码 {{code}}"`） |
| 4 | 命令卡上的复制按钮 | **未取证到**（`newChat.terminalCopy:"复制"` 是终端面板内的选区复制，不是命令卡） |
| 4 | 前台命令自动转后台 | **未取证到**"转后台"文案；后台化在发起侧（`agentRunStage.background:"后台执行中"` + `chatSession.backgroundProcesses.*`） |
| 5 | 逐条/逐文件 accept/reject | **未取证到**："接受全部"/"逐条接受"/"接受此文件" 全 0 命中。Qoder 的对应机制是**轮次级撤销**（`chatActivity.fileChanges.undo*` 一整套）+ 编辑器级"放弃更改并重新加载"（`workspace.review.discardFileChanges`） |
| 5 | Stacked / Split / whitespace / word-wrap | **全部取证到**，见 `workspace.review.stackedView / splitDiffView / showWhitespaceOnlyChanges / enableWordWrap` |
| 5 | 多文件导航 | 取证到 `上一个文件 / 下一个文件 / 右侧变更 / 右侧文件树`，另有 `changeList:"右侧变更"` |
| 6 | To-do 完成后的自动折叠规则 | **未取证到**折叠规则文案；只有 `chatStep.openDetails` 的计数与 `chatStep.details:"步骤详情"` |
| 7 | 折叠成 +N 的形态 | 取证到的是**文件卡与标签**上的 +N：`chatActivity.fileChanges.activeMore:"另有 {{count}} 个文件"`、`chatActivity.outputFiles.showMore`、组件默认 `"还有 ${n} 个标签"`（附录 C）；**子代理并行没有 +N 折叠文案** |
| 8 | 被拒后的出口 | 取证到：`deny:"拒绝"` 之后有 `suggestion.rules.*`（把这次决定沉淀成本任务规则）、`repeatedTool.stopTask:"终止任务"` / `allowOnce:"继续本次调用"`、`lark.reject:"拒绝授权"` + `lark.cancelTask:"终止任务"`。**没有**"换个做法/换个方案"这一档（最近的是 `exitPlan.requestChanges:"告诉 Qoder 计划需要如何调整"` 与 `clarification.adjust:"调整边界"`） |
| 8 | 审批历史与审计 | **未取证到**独立的审批历史面板；权限规则的落点在 `settings.agentToolRules*`（按 Agent 配置，不是按会话流水） |
| 9 | New Chat 的出现阈值 | **未取证到**阈值化逻辑；`nav.newChat:"新的任务"` 常在。压缩侧有明确禁用条件（`contextCompression.disabled.lowUsage/running/compacting`）与 `autoCompactThreshold:"自动压缩阈值 {{percent}}%"` |
| 9 | 压缩后提示 | 取证到：`contextCompression.completed:"已压缩上下文"` / `noop:"当前上下文无需压缩"` / `failed+failedDescription`，且会话流里画一条分隔线（`ariaLabel:"上下文压缩分隔线"`） |
| 13 | 倍率原文 | **未取证到**："倍率" 0 命中。计费可见的是 `composer.model.costTitle:"消耗"`、`composer.model.promotion.active:"低峰折扣进行中"`、Credits 一套（`usage.*`）与算力豆（`composer.model.computeBeans.*`） |
| 13 | 代码改动行数 | 取证到两处：`chatActivity.fileChanges.activeAriaLabel`（新增/删除行，aria）与 `workspace.review.diffSummary:"新增 {{additions}} 行，删除 {{deletions}} 行"` |
| 14 | 分享会话 | **未取证到**"分享对话/分享任务"。会话只有**导出记录**（`nav.exportChat:"导出记录"` → `已导出为 {{filename}}`）与**复制任务 ID**（`nav.copyChatId`）。"分享"文案都在讨论（`discussion.share.*`）与个人资料（`settings.profileShare*`），不是对话流 |
| 14 | 旁支任务/分支 | 取证到三条：`chatSession.messageActions.createBranchSessionHere/FromReply`（从回复建分支任务）、`chatActivity.toolNames.forkChatSession:"创建任务分支"`、`chatSession.sideChat.*`（侧边任务，含过期/清理整套状态） |
| 15 | Specific Model 列表 | 取证到两套：档位目录（`composer.model.catalog.*`：Auto/旗舰/性能/高效/轻量）+ 具体模型名（`dynamic-text.json` 附录 F，18 个 label，服务端可下发）；分类页签 `composer.model.category.*`（默认/中国移动/企业专属/自定义） |
| 15 | 参数变更影响倍率的提示 | **未取证到**。参数改动提示只讲"何时生效"：`composer.model.settings.description:"…运行中的回复保持当前设置，下一轮开始使用新设置。"` |
| 16 | Repo Wiki 的中文文案 | **未取证到**："Wiki" 在 zh 包 0 命中；只有组件默认英文 `DEFAULT_HIGHLIGHT="Repo Wiki"`、`"Free Wiki Generation Available"`、`"Model Overloaded"`、`"Awareness Updated"`、`"Content Safety Notice"`、`"Credits Exhausted"`（`renderer.js` @2846544 附近 `SuggestionBanner`，6 种 type，见附录 C/G）⇒ **这条横幅的默认文案没走语言包** |
| 16 | 知识库（Knowledge Base）开关 | **未取证到**zh 文案："知识库" 0 命中；可见的是 `chatActivity.toolNames.searchKnowledge:"检索知识"`、`extensions.channelHero.secondary.connector:"知识研究"`、`empty.extensionsDescription` 里的 "Knowledge" 字样（英文原词夹在中文句中） |
| 16 | Rules 引用形态 | **未取证到**"规则文件/AGENTS.md"字样。可见的规则面是 Agent 配置里的工具规则（`settings.agentToolRules*`、`settings.agentPermissionsRule:"规则"`）与审批时建议生成的本任务规则（`suggestion.rules.*`）；记忆的落点是 `settings.memory.*`（全局/项目两把开关 + 记忆文件计数） |

---

## 1 消息气泡与内容块类型

_条目数：274_

### `chatActivity.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatActivity.recordingNote.title` | 录音纪要 | renderer.js 内 `title:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.minimize` | 最小化录音纪要 | renderer.js 内 `minimize:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.delete` | 删除录音纪要 | renderer.js 内 `delete:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.deleteFailed` | 录音纪要删除失败，请重试。 | renderer.js 内 `deleteFailed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.collapsed` | 录音纪要 · {{duration}} | renderer.js 内 `collapsed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.leaveConfirmation.title` | 结束录音并切换任务？ | renderer.js 内 `title:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.leaveConfirmation.description` | 切换任务会结束当前录音，并保存已录制的内容。 | renderer.js 内 `description:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.leaveConfirmation.cancel` | 继续录音 | renderer.js 内 `cancel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.leaveConfirmation.confirm` | 结束并切换 | renderer.js 内 `confirm:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.leaveConfirmation.saving` | 正在保存… | renderer.js 内 `saving:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.leaveConfirmation.saveFailed` | 录音纪要保存失败，请重试后再切换任务。 | renderer.js 内 `saveFailed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.invalid` | 录音纪要卡片数据无效。 | renderer.js 内 `invalid:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.stop` | 停止录制 | renderer.js 内 `stop:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.retry` | 重试 | renderer.js 内 `retry:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.permissionSettings` | 打开麦克风权限 | renderer.js 内 `permissionSettings:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.revealAudio` | 显示音频文件 | renderer.js 内 `revealAudio:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.revealTranscript` | 显示原文文件 | renderer.js 内 `revealTranscript:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.waitingTranscript` | 正在等待语音内容… | renderer.js 内 `waitingTranscript:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.emptyTranscript` | 没有识别到语音内容。 | renderer.js 内 `emptyTranscript:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.completedMeta` | 已保存 · {{duration}} | renderer.js 内 `completedMeta:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.errors.unavailable` | 当前版本无法保存录音纪要。 | renderer.js 内 `unavailable:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.errors.permission` | 无法使用麦克风，请在系统设置中允许 Qoder 访问麦克风。 | renderer.js 内 `permission:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.errors.noMicrophone` | 未找到可用的麦克风，请连接设备后重试。 | renderer.js 内 `noMicrophone:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.errors.unreadable` | 麦克风无法读取，可能正被其他应用占用，请关闭占用后重试。 | renderer.js 内 `unreadable:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.errors.startFailed` | 录音纪要未能开始，请重试。 | renderer.js 内 `startFailed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.errors.recognitionFailed` | 语音识别中断，请重试。 | renderer.js 内 `recognitionFailed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.errors.saveFailed` | 录音纪要未能保存，请重试。 | renderer.js 内 `saveFailed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.errors.interrupted` | 页面刷新或任务重开导致录制中断。你可以重新录制。 | renderer.js 内 `interrupted:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.errors.voiceConflict` | 其他语音功能正在使用麦克风，结束后再开始录音纪要。 | renderer.js 内 `voiceConflict:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.phase.ready` | 准备开始录制 | renderer.js 内 `ready:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.phase.starting` | 正在开始录制… | renderer.js 内 `starting:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.phase.requestingPermission` | 正在请求麦克风权限… | renderer.js 内 `requestingPermission:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.phase.connecting` | 正在连接语音识别… | renderer.js 内 `connecting:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.phase.recording` | 正在录制 | renderer.js 内 `recording:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.phase.finalizing` | 正在保存录音纪要… | renderer.js 内 `finalizing:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.phase.completed` | 已保存 | renderer.js 内 `completed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.phase.cancelled` | 已取消 | renderer.js 内 `cancelled:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.phase.interrupted` | 录制已中断 | renderer.js 内 `interrupted:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.phase.failed` | 录音纪要失败 | renderer.js 内 `failed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.recordingNote.phase.error` | 录音纪要出错 | renderer.js 内 `error:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.generating` | 正在生成图片… | renderer.js 内 `generating:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.loading` | 正在加载图片… | renderer.js 内 `loading:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.failed` | 图片生成失败 | renderer.js 内 `failed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.interrupted` | 图片生成已中断 | renderer.js 内 `interrupted:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.unavailable` | 图片文件已不可用 | renderer.js 内 `unavailable:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.defaultName` | 生成的图片 | renderer.js 内 `defaultName:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.imageAlt` | 生成的图片：{{name}} | renderer.js 内 `imageAlt:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.moreActions` | {{name}} 的更多操作 | renderer.js 内 `moreActions:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.previewImage` | 预览图片 {{name}} | renderer.js 内 `previewImage:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.previewTitle` | 图片预览：{{name}} | renderer.js 内 `previewTitle:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.closePreview` | 关闭图片预览 | renderer.js 内 `closePreview:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.copy` | 复制图片 | renderer.js 内 `copy:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.copied` | 已复制 {{name}} | renderer.js 内 `copied:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.copyFailed` | 无法复制图片，请稍后重试。 | renderer.js 内 `copyFailed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.download` | 下载图片 | renderer.js 内 `download:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.downloadFailed` | 无法下载图片，请稍后重试。 | renderer.js 内 `downloadFailed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.addToContext` | 添加为上下文 | renderer.js 内 `addToContext:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.addedToContext` | 已将 {{name}} 添加为上下文 | renderer.js 内 `addedToContext:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.alreadyInContext` | {{name}} 已在输入上下文中 | renderer.js 内 `alreadyInContext:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.addToContextFailed` | 无法将图片添加为上下文。 | renderer.js 内 `addToContextFailed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.contextLimitReached` | 输入上下文已达到 20 个附件，请先移除一个附件。 | renderer.js 内 `contextLimitReached:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.zoomOut` | 缩小图片 | renderer.js 内 `zoomOut:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.zoomIn` | 放大图片 | renderer.js 内 `zoomIn:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.zoomLevel` | 当前缩放比例 {{zoom}}% | renderer.js 内 `zoomLevel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.fitToWindow` | 适合窗口 | renderer.js 内 `fitToWindow:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.imageGeneration.viewportInstructions` | 图片查看区域。滚动缩放，放大后拖动图片，双击切换实际大小与适合窗口。 | renderer.js 内 `viewportInstructions:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.ariaLabel` | 本轮产物 | renderer.js 内 `ariaLabel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.showMore` | 显示其余 {{count}} 个文件 | renderer.js 内 `showMore:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.showLess` | 收起文件 | renderer.js 内 `showLess:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.openModeAriaLabel` | 选择打开方式 | renderer.js 内 `openModeAriaLabel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.openModeDragAriaLabel` | 拖动调整打开方式顺序；聚焦后可使用上下方向键 | renderer.js 内 `openModeDragAriaLabel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.openInNewWindow` | 新窗口查看 | renderer.js 内 `openInNewWindow:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.openInBuiltInBrowser` | 内置浏览器 | renderer.js 内 `openInBuiltInBrowser:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.openInSystemBrowser` | 系统浏览器 | renderer.js 内 `openInSystemBrowser:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.openInWorkspace` | 在右侧栏查看 | renderer.js 内 `openInWorkspace:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.openInSystemApplication` | 默认应用 | renderer.js 内 `openInSystemApplication:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.planTypeLabel` | 计划文件 | renderer.js 内 `planTypeLabel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.moreFileActions` | 更多文件操作 | renderer.js 内 `moreFileActions:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.copyAbsolutePathSucceeded` | 已复制绝对路径 | renderer.js 内 `copyAbsolutePathSucceeded:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.copyRelativePathSucceeded` | 已复制相对路径 | renderer.js 内 `copyRelativePathSucceeded:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.copyPathFailed` | 复制路径失败 | renderer.js 内 `copyPathFailed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.previewLoading` | 正在加载文件预览… | renderer.js 内 `previewLoading:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.previewInvalid` | 暂时无法读取文件预览。 | renderer.js 内 `previewInvalid:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.thumbnailAlt` | 文件内容预览 | renderer.js 内 `thumbnailAlt:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.sheetName` | 工作表：{{name}} | renderer.js 内 `sheetName:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.previewTruncated` | 仅展示部分内容 | renderer.js 内 `previewTruncated:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.previewUnavailable.empty` | 文件没有可预览内容。 | renderer.js 内 `empty:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.previewUnavailable.invalid` | 文件已损坏或暂时无法读取。 | renderer.js 内 `invalid:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.previewUnavailable.missing` | 文件已被删除或移动。 | renderer.js 内 `missing:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.previewUnavailable.tooLarge` | 文件过大，暂不支持内容预览。 | renderer.js 内 `tooLarge:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.outputFiles.previewUnavailable.unsupported` | 当前系统暂不支持该文件的缩略预览。 | renderer.js 内 `unsupported:"…"`（chatTimelineResources 的 zh 段） |

### `chatImagePreview.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatImagePreview.title` | 图片预览：{{name}} | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `chatImagePreview.imageAlt` | 图片附件：{{name}} | renderer.js 内 `imageAlt:"…"`（chatSessionResources 的 zh 段） |
| `chatImagePreview.imageLoadFailed` | 图片无法加载 | renderer.js 内 `imageLoadFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatImagePreview.close` | 关闭图片预览 | renderer.js 内 `close:"…"`（chatSessionResources 的 zh 段） |
| `chatImagePreview.copy` | 复制图片 | renderer.js 内 `copy:"…"`（chatSessionResources 的 zh 段） |
| `chatImagePreview.copied` | 已复制图片 {{name}} | renderer.js 内 `copied:"…"`（chatSessionResources 的 zh 段） |
| `chatImagePreview.copyFailed` | 复制图片失败 | renderer.js 内 `copyFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatImagePreview.zoomIn` | 放大图片 | renderer.js 内 `zoomIn:"…"`（chatSessionResources 的 zh 段） |
| `chatImagePreview.zoomOut` | 缩小图片 | renderer.js 内 `zoomOut:"…"`（chatSessionResources 的 zh 段） |
| `chatImagePreview.zoomLevel` | 当前缩放比例 {{zoom}}% | renderer.js 内 `zoomLevel:"…"`（chatSessionResources 的 zh 段） |
| `chatImagePreview.fitToWindow` | 适合窗口 | renderer.js 内 `fitToWindow:"…"`（chatSessionResources 的 zh 段） |
| `chatImagePreview.viewportInstructions` | 图片查看区域。滚动缩放，放大后拖动图片，双击切换实际大小与适合窗口。 | renderer.js 内 `viewportInstructions:"…"`（chatSessionResources 的 zh 段） |
| `chatImagePreview.previousImage` | 上一张 | renderer.js 内 `previousImage:"…"`（chatSessionResources 的 zh 段） |
| `chatImagePreview.nextImage` | 下一张 | renderer.js 内 `nextImage:"…"`（chatSessionResources 的 zh 段） |
| `chatImagePreview.counter` | 第 {{index}} / {{total}} 张 | renderer.js 内 `counter:"…"`（chatSessionResources 的 zh 段） |

### `chatMessage.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatMessage.issueAddedToContext` | 已加入上下文 | renderer.js 内 `issueAddedToContext:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.lockedIssueContext` | 当前任务绑定的 Issue | renderer.js 内 `lockedIssueContext:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.referencedIssueContext` | 当前任务引用的 Issue | renderer.js 内 `referencedIssueContext:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.openLockedIssue` | 打开 Issue {{identifier}} | renderer.js 内 `openLockedIssue:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.sentAttachments` | 已发送附件 | renderer.js 内 `sentAttachments:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.copy` | 复制 | renderer.js 内 `copy:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.copied` | 已复制 | renderer.js 内 `copied:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.fullMessage` | 完整消息 | renderer.js 内 `fullMessage:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editLatest` | 编辑并重新发送 | renderer.js 内 `editLatest:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editForm` | 编辑最新一条消息 | renderer.js 内 `editForm:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editInput` | 消息内容 | renderer.js 内 `editInput:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editCancel` | 取消 | renderer.js 内 `editCancel:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editSend` | 发送 | renderer.js 内 `editSend:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editSending` | 发送中... | renderer.js 内 `editSending:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editRewindConfirmTitle` | 回退文件修改并重新发送？ | renderer.js 内 `editRewindConfirmTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editRewindConfirmDescription` | 重新发送会先回退这轮产生的文件修改，并删除原消息与后续回复。 | renderer.js 内 `editRewindConfirmDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editRewindPartialWarning` | 部分修改未被 CLI 文件检查点完整记录，回退结果可能不完整。 | renderer.js 内 `editRewindPartialWarning:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editRewindCancel` | 继续编辑 | renderer.js 内 `editRewindCancel:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editRewindConfirm` | 回退并重新发送 | renderer.js 内 `editRewindConfirm:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editFailedTitle` | 无法重新发送这条消息 | renderer.js 内 `editFailedTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editFailedDescription` | 消息还没有重新发送，请稍后重试。 | renderer.js 内 `editFailedDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editPartialTitle` | 任务已回退，文件未完全恢复 | renderer.js 内 `editPartialTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editPartialDescription` | 编辑内容已保留到输入框。请先检查未恢复的文件，再重新发送。{{details}} | renderer.js 内 `editPartialDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editLocalSyncFailedTitle` | 任务已回退，但本地历史未同步 | renderer.js 内 `editLocalSyncFailedTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editLocalSyncFailedDescription` | 编辑内容已保留到输入框。请重新打开此任务刷新历史，检查文件后再发送。{{details}} | renderer.js 内 `editLocalSyncFailedDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editReplacementFailedTitle` | 任务已回退，但消息未发送 | renderer.js 内 `editReplacementFailedTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatMessage.editReplacementFailedDescription` | 任务与文件已回退，编辑内容已保留到输入框。请检查后重新发送。{{details}} | renderer.js 内 `editReplacementFailedDescription:"…"`（chatSessionResources 的 zh 段） |

### `chatSession.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatSession.filePreview.openDefaultApplication` | 使用默认应用打开 | renderer.js 内 `openDefaultApplication:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.filePreview.revealInFileManager` | 在文件管理器中显示 | renderer.js 内 `revealInFileManager:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.generatedFiles.emptyTitle` | 还没有 AI 生成的文件 | renderer.js 内 `emptyTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.generatedFiles.emptyDescription` | Agent 在这个任务里写入或编辑文件后，会出现在这里用于快速预览。 | renderer.js 内 `emptyDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.generatedFiles.count` | {{count}} 个文件 | renderer.js 内 `count:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.generatedFiles.previewTitle` | 文件预览 | renderer.js 内 `previewTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.generatedFiles.currentVersion` | 当前工作区版本 | renderer.js 内 `currentVersion:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.generatedFiles.toolEvidence` | 工具记录内容 | renderer.js 内 `toolEvidence:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.generatedFiles.readFailed` | 无法读取当前文件，已展示工具记录中的内容。 | renderer.js 内 `readFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.generatedFiles.noContentEvidence` | 这次文件变更没有记录完整内容。 | renderer.js 内 `noContentEvidence:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.generatedFiles.emptyPreview` | 没有可预览内容。 | renderer.js 内 `emptyPreview:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.windowTitle` | {{name}} — 产物预览 | renderer.js 内 `windowTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.documentLabel` | 文件预览 | renderer.js 内 `documentLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.viewModeAriaLabel` | 原文与预览 | renderer.js 内 `viewModeAriaLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.sourceMode` | 查看原文 | renderer.js 内 `sourceMode:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.previewMode` | 查看预览 | renderer.js 内 `previewMode:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.loading` | 正在准备文件预览 | renderer.js 内 `loading:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.loadFailedTitle` | 无法加载文件预览 | renderer.js 内 `loadFailedTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.loadFailedDescription` | 文件可能已移动、仍在写入或超过预览限制。重试，或使用其他应用打开。 | renderer.js 内 `loadFailedDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.retry` | 重新加载 | renderer.js 内 `retry:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.refreshAvailableMessage` | 文件已更新 | renderer.js 内 `refreshAvailableMessage:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.refreshAvailable` | 刷新 | renderer.js 内 `refreshAvailable:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.dismissRefresh` | 关闭刷新提示 | renderer.js 内 `dismissRefresh:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.runtimeUnavailableTitle` | 暂时无法预览此文件 | renderer.js 内 `runtimeUnavailableTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.runtimeUnavailableDescription` | 文件已准备好，但当前版本尚未提供对应的页面渲染。你仍可使用其他应用打开。 | renderer.js 内 `runtimeUnavailableDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.openExternally` | 使用其他应用打开 | renderer.js 内 `openExternally:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.openExternallyFailedTitle` | 无法打开文件 | renderer.js 内 `openExternallyFailedTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.openExternallyFailedDescription` | 系统没有可用的应用，或文件已移动。重新选择文件后再试。 | renderer.js 内 `openExternallyFailedDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.linkOpenFailedTitle` | 无法打开链接 | renderer.js 内 `linkOpenFailedTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.linkOpenFailedDescription` | 链接无效，或系统浏览器暂时不可用。 | renderer.js 内 `linkOpenFailedDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.html.frameLabel` | HTML 产物预览 | renderer.js 内 `frameLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.image.alt` | {{name}} 的预览 | renderer.js 内 `alt:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.annotation.contextFull` | 当前消息的附件数量已达上限，请先移除部分附件。 | renderer.js 内 `contextFull:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pdf.loading` | 正在解析 PDF | renderer.js 内 `loading:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pdf.loadFailedTitle` | 无法解析 PDF | renderer.js 内 `loadFailedTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pdf.loadFailedDescription` | PDF 可能已损坏、受密码保护，或包含当前版本不支持的内容。 | renderer.js 内 `loadFailedDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pdf.previousPage` | 上一页 | renderer.js 内 `previousPage:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pdf.nextPage` | 下一页 | renderer.js 内 `nextPage:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pdf.zoomOut` | 缩小 | renderer.js 内 `zoomOut:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pdf.zoomIn` | 放大 | renderer.js 内 `zoomIn:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pdf.pageStatus` | 第 {{page}} / {{count}} 页 | renderer.js 内 `pageStatus:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pdf.pageRenderFailed` | 此页无法渲染 | renderer.js 内 `pageRenderFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pdf.annotationMode` | 批注 | renderer.js 内 `annotationMode:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pdf.annotationPlaceholder` | 描述希望 Agent 修改或检查的内容 | renderer.js 内 `annotationPlaceholder:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pdf.annotationSubmit` | 添加到任务 | renderer.js 内 `annotationSubmit:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pdf.annotationLabel` | PDF 第 {{page}} 页 | renderer.js 内 `annotationLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.loading` | 正在解析演示文稿 | renderer.js 内 `loading:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.loadFailedTitle` | 无法解析演示文稿 | renderer.js 内 `loadFailedTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.loadFailedDescription` | 演示文稿可能已损坏、仍在写入，或包含当前版本暂不支持的内容。 | renderer.js 内 `loadFailedDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.previousSlide` | 上一张幻灯片 | renderer.js 内 `previousSlide:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.nextSlide` | 下一张幻灯片 | renderer.js 内 `nextSlide:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.zoomOut` | 缩小 | renderer.js 内 `zoomOut:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.zoomIn` | 放大 | renderer.js 内 `zoomIn:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.slideStatus` | 第 {{page}} / {{count}} 张 | renderer.js 内 `slideStatus:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.slideRenderFailed` | 此张幻灯片无法渲染 | renderer.js 内 `slideRenderFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.annotationMode` | 批注 | renderer.js 内 `annotationMode:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.annotationTarget` | 批注 {{element}} | renderer.js 内 `annotationTarget:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.annotationPlaceholder` | 描述希望 Agent 修改或检查的内容 | renderer.js 内 `annotationPlaceholder:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.annotationSubmit` | 添加到任务 | renderer.js 内 `annotationSubmit:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.annotationCancel` | 取消 | renderer.js 内 `annotationCancel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.annotationDelete` | 删除 | renderer.js 内 `annotationDelete:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.annotationLabel` | 第 {{slide}} 张 · {{element}} | renderer.js 内 `annotationLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.pptx.speakerNotes` | 讲者备注 | renderer.js 内 `speakerNotes:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.docx.loading` | 正在排版文档 | renderer.js 内 `loading:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.docx.loadFailedTitle` | 无法解析文档 | renderer.js 内 `loadFailedTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.docx.loadFailedDescription` | 文档可能已损坏、仍在写入，或包含当前版本暂不支持的内容。 | renderer.js 内 `loadFailedDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.docx.zoomOut` | 缩小 | renderer.js 内 `zoomOut:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.docx.zoomIn` | 放大 | renderer.js 内 `zoomIn:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.docx.annotationMode` | 批注 | renderer.js 内 `annotationMode:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.docx.annotationPlaceholder` | 描述希望 Agent 修改或检查的内容 | renderer.js 内 `annotationPlaceholder:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.docx.annotationSubmit` | 添加到任务 | renderer.js 内 `annotationSubmit:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.docx.annotationCancel` | 取消 | renderer.js 内 `annotationCancel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.docx.annotationDelete` | 删除 | renderer.js 内 `annotationDelete:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.docx.annotationLabel` | 文档第 {{page}} 页 | renderer.js 内 `annotationLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.xlsx.loading` | 正在解析工作簿 | renderer.js 内 `loading:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.xlsx.loadFailedTitle` | 无法解析工作簿 | renderer.js 内 `loadFailedTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.xlsx.loadFailedDescription` | 工作簿可能已损坏、仍在写入，或包含当前版本暂不支持的内容。 | renderer.js 内 `loadFailedDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.xlsx.sheetLoading` | 正在加载工作表 | renderer.js 内 `sheetLoading:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.xlsx.annotationMode` | 批注 | renderer.js 内 `annotationMode:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.xlsx.annotationPlaceholder` | 描述希望 Agent 修改或检查的内容 | renderer.js 内 `annotationPlaceholder:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.xlsx.annotationSubmit` | 添加到任务 | renderer.js 内 `annotationSubmit:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.xlsx.annotationCancel` | 取消 | renderer.js 内 `annotationCancel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.xlsx.annotationDelete` | 删除 | renderer.js 内 `annotationDelete:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.xlsx.annotationLabel` | {{sheet}} · {{range}} | renderer.js 内 `annotationLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.artifactPreview.xlsx.selectedRange` | 已选择 {{range}} | renderer.js 内 `selectedRange:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.openInBrowser` | 在浏览器中打开 | renderer.js 内 `openInBrowser:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.openInExternalBrowser` | 在外部浏览器中打开 | renderer.js 内 `openInExternalBrowser:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.copyLink` | 复制链接 | renderer.js 内 `copyLink:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.copied` | 已复制 | renderer.js 内 `copied:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.previewLoading` | 正在加载链接预览… | renderer.js 内 `previewLoading:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.previewUnavailable` | 无法读取链接预览 | renderer.js 内 `previewUnavailable:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.viewFileInSidebar` | 在右侧栏查看 | renderer.js 内 `viewFileInSidebar:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.viewFileInNewWindow` | 新窗口查看 | renderer.js 内 `viewFileInNewWindow:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.openFile` | 默认应用打开 | renderer.js 内 `openFile:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.openWith` | 打开方式 | renderer.js 内 `openWith:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.openWithLoading` | 正在加载应用… | renderer.js 内 `openWithLoading:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.openWithNoApps` | 没有可用应用 | renderer.js 内 `openWithNoApps:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.openWithDefault` | 默认 | renderer.js 内 `openWithDefault:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.openFileFailed` | 无法打开 {{name}} | renderer.js 内 `openFileFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.openFileFailedDescription` | 文件可能已被删除、移动或无法访问。检查文件后重试。 | renderer.js 内 `openFileFailedDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.openFolderFailed` | 无法打开 {{name}} | renderer.js 内 `openFolderFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.openFolderFailedDescription` | 文件夹可能已被删除、移动或无法访问。检查文件夹后重试。 | renderer.js 内 `openFolderFailedDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.openRemoteFileOutsideWorkspaceDescription` | 该文件不属于当前远程工作区。将它所在的文件夹添加到工作区后重试。 | renderer.js 内 `openRemoteFileOutsideWorkspaceDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.openRemoteFolderOutsideWorkspaceDescription` | 该文件夹不属于当前远程工作区。将该文件夹添加到工作区后重试。 | renderer.js 内 `openRemoteFolderOutsideWorkspaceDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.copyPath` | 复制路径 | renderer.js 内 `copyPath:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.copyFileContent` | 复制文件内容 | renderer.js 内 `copyFileContent:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.revealFile` | 在文件管理器中显示 | renderer.js 内 `revealFile:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.revealFileMacos` | 在 Finder 中显示 | renderer.js 内 `revealFileMacos:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.revealFileWindows` | 在文件资源管理器中显示 | renderer.js 内 `revealFileWindows:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.revealFileFailed` | 无法在文件管理器中显示文件 | renderer.js 内 `revealFileFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.revealFileFailedDescription` | 文件可能已被删除、移动或无法访问。检查文件后重试。 | renderer.js 内 `revealFileFailedDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.openInWorkspace` | 在 Qoder 中打开 | renderer.js 内 `openInWorkspace:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.imageLoading` | 正在加载图片… | renderer.js 内 `imageLoading:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.links.imageUnavailableOpenFile` | 图片无法显示，打开文件 | renderer.js 内 `imageUnavailableOpenFile:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.markdownTable.copyImage` | 复制为图片 | renderer.js 内 `copyImage:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.markdownTable.copyMarkdown` | 复制 Markdown | renderer.js 内 `copyMarkdown:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.markdownTable.imageCopied` | 表格图片已复制 | renderer.js 内 `imageCopied:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.markdownTable.markdownCopied` | Markdown 表格已复制 | renderer.js 内 `markdownCopied:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.markdownTable.imageCopyFailed` | 表格图片复制失败 | renderer.js 内 `imageCopyFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.markdownTable.markdownCopyFailed` | Markdown 表格复制失败 | renderer.js 内 `markdownCopyFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.markdownTable.imageCopyFailedRetry` | 表格图片复制失败，重试 | renderer.js 内 `imageCopyFailedRetry:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.markdownTable.markdownCopyFailedRetry` | Markdown 表格复制失败，重试 | renderer.js 内 `markdownCopyFailedRetry:"…"`（chatSessionResources 的 zh 段） |

### `chatTimeline.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatTimeline.anchorNav` | 消息锚点 | renderer.js 内 `anchorNav:"…"`（chatTimelineResources 的 zh 段） |
| `chatTimeline.conversationContent` | 任务内容 | renderer.js 内 `conversationContent:"…"`（chatTimelineResources 的 zh 段） |
| `chatTimeline.messagesRegion` | 消息列表 | renderer.js 内 `messagesRegion:"…"`（chatTimelineResources 的 zh 段） |
| `chatTimeline.turnFallback` | 第 {{count}} 轮 | renderer.js 内 `turnFallback:"…"`（chatTimelineResources 的 zh 段） |
| `chatTimeline.emptyTitle` | 开始这个任务 | renderer.js 内 `emptyTitle:"…"`（chatTimelineResources 的 zh 段） |
| `chatTimeline.agentEmptyTitle` | 开始 {{name}} 的任务 | renderer.js 内 `agentEmptyTitle:"…"`（chatTimelineResources 的 zh 段） |
| `chatTimeline.emptyDescription` | 描述你想完成的工作，默认 Agent 会在当前工作目录中持续推进。 | renderer.js 内 `emptyDescription:"…"`（chatTimelineResources 的 zh 段） |
| `chatTimeline.voiceEmptyTitle` | 可以直接开口说了 | renderer.js 内 `voiceEmptyTitle:"…"`（chatTimelineResources 的 zh 段） |
| `chatTimeline.voiceEmptyDescription` | 说出你想一起推进的事，我会边听边整理上下文。 | renderer.js 内 `voiceEmptyDescription:"…"`（chatTimelineResources 的 zh 段） |
| `chatTimeline.loadingEarlier` | 正在加载… | renderer.js 内 `loadingEarlier:"…"`（chatTimelineResources 的 zh 段） |
| `chatTimeline.retryLoadingEarlier` | 重试加载更早消息 | renderer.js 内 `retryLoadingEarlier:"…"`（chatTimelineResources 的 zh 段） |
| `chatTimeline.scrollToLatest` | 滚动到最新消息 | renderer.js 内 `scrollToLatest:"…"`（chatTimelineResources 的 zh 段） |

### `presentationEditor.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `presentationEditor.document` | 演示文稿 | renderer.js 内 `document:"…"`（workspaceResources 的 zh 段） |
| `presentationEditor.mode` | 打开模式 | renderer.js 内 `mode:"…"`（workspaceResources 的 zh 段） |
| `presentationEditor.preview` | 切换到预览 | renderer.js 内 `preview:"…"`（workspaceResources 的 zh 段） |
| `presentationEditor.edit` | 编辑 | renderer.js 内 `edit:"…"`（workspaceResources 的 zh 段） |
| `presentationEditor.loading` | 正在打开编辑器… | renderer.js 内 `loading:"…"`（workspaceResources 的 zh 段） |

### `tools.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `tools.resultImage` | 工具结果图片 {{index}} | renderer.js 内 `resultImage:"…"`（chatTimelineResources 的 zh 段） |
| `tools.previewResultImage` | 预览{{name}} | renderer.js 内 `previewResultImage:"…"`（chatTimelineResources 的 zh 段） |

## 2 思考/推理过程展示

_条目数：136_

### `agentRunStage.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `agentRunStage.queued` | 排队中 | renderer.js 内 `queued:"…"`（chatSessionResources 的 zh 段） |
| `agentRunStage.preparing` | 准备中 | renderer.js 内 `preparing:"…"`（chatSessionResources 的 zh 段） |
| `agentRunStage.thinking` | 思考中 | renderer.js 内 `thinking:"…"`（chatSessionResources 的 zh 段） |
| `agentRunStage.usingTool` | 使用工具 | renderer.js 内 `usingTool:"…"`（chatSessionResources 的 zh 段） |
| `agentRunStage.waitingConfirmation` | 等待确认 | renderer.js 内 `waitingConfirmation:"…"`（chatSessionResources 的 zh 段） |
| `agentRunStage.background` | 后台执行中 | renderer.js 内 `background:"…"`（chatSessionResources 的 zh 段） |
| `agentRunStage.stopping` | 正在停止 | renderer.js 内 `stopping:"…"`（chatSessionResources 的 zh 段） |
| `agentRunStage.completed` | 已完成 | renderer.js 内 `completed:"…"`（chatSessionResources 的 zh 段） |
| `agentRunStage.failed` | 失败 | renderer.js 内 `failed:"…"`（chatSessionResources 的 zh 段） |
| `agentRunStage.stopped` | 已停止 | renderer.js 内 `stopped:"…"`（chatSessionResources 的 zh 段） |

### `chatActivity.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatActivity.assistantResponse` | Agent 回复 | renderer.js 内 `assistantResponse:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.agentThinking` | 正在思考 | renderer.js 内 `agentThinking:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.agentThought` | 已思考 | renderer.js 内 `agentThought:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.agentWorkDuration` | 耗时 {{seconds}}秒 | renderer.js 内 `agentWorkDuration:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.turnLabel` | 一轮任务 | renderer.js 内 `turnLabel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.thinking` | 思考中 | renderer.js 内 `thinking:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.thought` | 已思考 | renderer.js 内 `thought:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.expandThinking` | 展开思考内容 | renderer.js 内 `expandThinking:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.collapseThinking` | 收起思考内容 | renderer.js 内 `collapseThinking:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.structuredInput` | 结构化参数 | renderer.js 内 `structuredInput:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.almost` | 快好了... | renderer.js 内 `almost:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.baking` | 准备一下... | renderer.js 内 `baking:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.bearWithMe` | 等我一下... | renderer.js 内 `bearWithMe:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.brewing` | 整理一下... | renderer.js 内 `brewing:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.busyBusy` | 处理一下... | renderer.js 内 `busyBusy:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.buzzing` | 同步一下... | renderer.js 内 `buzzing:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.chugging` | 往前推一下... | renderer.js 内 `chugging:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.churning` | 汇总一下... | renderer.js 内 `churning:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.clicking` | 检查一下... | renderer.js 内 `clicking:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.cogitating` | 想一想... | renderer.js 内 `cogitating:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.computing` | 算一下... | renderer.js 内 `computing:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.connectingDots` | 串一下线索... | renderer.js 内 `connectingDots:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.considering` | 看一下方案... | renderer.js 内 `considering:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.contemplating` | 再想一下... | renderer.js 内 `contemplating:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.cooking` | 准备回复... | renderer.js 内 `cooking:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.crunching` | 处理数据... | renderer.js 内 `crunching:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.deepInThought` | 多想一下... | renderer.js 内 `deepInThought:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.deliberating` | 斟酌一下... | renderer.js 内 `deliberating:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.gettingThere` | 差不多了... | renderer.js 内 `gettingThere:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.hangTight` | 再等一下... | renderer.js 内 `hangTight:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.hmm` | 嗯，我看看... | renderer.js 内 `hmm:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.holdOn` | 稍等一下... | renderer.js 内 `holdOn:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.humming` | 继续推理... | renderer.js 内 `humming:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.justASec` | 马上好... | renderer.js 内 `justASec:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.letMeSee` | 我看一下... | renderer.js 内 `letMeSee:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.mullingItOver` | 理一下思路... | renderer.js 内 `mullingItOver:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.musing` | 顺一下... | renderer.js 内 `musing:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.onIt` | 在处理... | renderer.js 内 `onIt:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.oneMoment` | 稍等... | renderer.js 内 `oneMoment:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.percolating` | 提炼一下... | renderer.js 内 `percolating:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.pondering` | 思考一下... | renderer.js 内 `pondering:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.processing` | 处理中... | renderer.js 内 `processing:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.reasoning` | 推理中... | renderer.js 内 `reasoning:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.reflecting` | 回看一下... | renderer.js 内 `reflecting:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.revving` | 加快一点... | renderer.js 内 `revving:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.rolling` | 继续看... | renderer.js 内 `rolling:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.ruminating` | 再确认下... | renderer.js 内 `ruminating:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.simmering` | 慢慢来... | renderer.js 内 `simmering:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.spinningUp` | 启动一下... | renderer.js 内 `spinningUp:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.stirring` | 整合一下... | renderer.js 内 `stirring:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.thinking` | 思考中... | renderer.js 内 `thinking:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.ticking` | 记一下进展... | renderer.js 内 `ticking:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.trucking` | 继续推进... | renderer.js 内 `trucking:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.warmingUp` | 先准备下... | renderer.js 内 `warmingUp:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.whirring` | 后台处理下... | renderer.js 内 `whirring:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.whizzing` | 快一点处理... | renderer.js 内 `whizzing:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.working` | 处理中... | renderer.js 内 `working:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.workingOnIt` | 正在处理... | renderer.js 内 `workingOnIt:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.zipping` | 快进一下... | renderer.js 内 `zipping:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processing.zooming` | 加速一下... | renderer.js 内 `zooming:"…"`（chatTimelineResources 的 zh 段） |

### `chatSession.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatSession.voiceDiscussion.addMenu` | 语音讨论 | renderer.js 内 `addMenu:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.newSessionTitle` | 新任务 | renderer.js 内 `newSessionTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.title` | 语音讨论 | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.ariaLabel` | 当前语音讨论 | renderer.js 内 `ariaLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.viewLabel` | 切换语音讨论视图 | renderer.js 内 `viewLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.latest` | 返回讨论 | renderer.js 内 `latest:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.transcript` | 任务流 | renderer.js 内 `transcript:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.end` | 结束讨论 | renderer.js 内 `end:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.ending` | 正在整理 | renderer.js 内 `ending:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.close` | 关闭 | renderer.js 内 `close:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.errorTitle` | 语音讨论未能继续 | renderer.js 内 `errorTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.errorDescription` | 请关闭后重新开始语音讨论。 | renderer.js 内 `errorDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.waitingForUser` | 可以直接说出想一起讨论的问题。 | renderer.js 内 `waitingForUser:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.userSpeaking` | 我正在说话 | renderer.js 内 `userSpeaking:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.assistantThinking` | 助手思考 | renderer.js 内 `assistantThinking:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.assistantAnswer` | 助手回答 | renderer.js 内 `assistantAnswer:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.you` | 我 | renderer.js 内 `you:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.assistant` | 助手 | renderer.js 内 `assistant:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.emptyTranscript` | 讨论开始后，会在这里显示完整任务流。 | renderer.js 内 `emptyTranscript:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.minutesTitle` | 语音讨论纪要 | renderer.js 内 `minutesTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.minutesViewLabel` | 切换纪要视图 | renderer.js 内 `minutesViewLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.summary` | 纪要 | renderer.js 内 `summary:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.emptySummary` | 本次讨论没有生成可展示的纪要。 | renderer.js 内 `emptySummary:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.duration_one` | 讨论 {{count}} 分钟 | renderer.js 内 `duration_one:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.duration_other` | 讨论 {{count}} 分钟 | renderer.js 内 `duration_other:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.phase.connecting` | 正在连接 | renderer.js 内 `connecting:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.phase.listening` | 正在聆听 | renderer.js 内 `listening:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.phase.thinking` | 助手正在思考 | renderer.js 内 `thinking:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.phase.speaking` | 助手正在回答 | renderer.js 内 `speaking:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.voiceDiscussion.phase.ending` | 正在结束并整理纪要 | renderer.js 内 `ending:"…"`（chatSessionResources 的 zh 段） |

### `executionTrace.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `executionTrace.timeline` | 执行事件概览 | renderer.js 内 `timeline:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.jump` | 定位到第 {{index}} 条事件 | renderer.js 内 `jump:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.expandAll` | 全部展开 | renderer.js 内 `expandAll:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.collapseAll` | 全部收起 | renderer.js 内 `collapseAll:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.view` | 执行过程视图 | renderer.js 内 `view:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.conversation` | 对话 | renderer.js 内 `conversation:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.trace` | 执行轨迹 | renderer.js 内 `trace:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.filter` | 筛选执行事件 | renderer.js 内 `filter:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.all` | 全部 | renderer.js 内 `all:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.tool` | 工具 | renderer.js 内 `tool:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.text` | 文本 | renderer.js 内 `text:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.thinking` | 思考 | renderer.js 内 `thinking:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.error` | 错误 | renderer.js 内 `error:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.hook` | Hook | renderer.js 内 `hook:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.contextCompression` | 上下文压缩 | renderer.js 内 `contextCompression:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.user` | 用户指令 | renderer.js 内 `user:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.assistant` | 回复 | renderer.js 内 `assistant:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.system` | 系统记录 | renderer.js 内 `system:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.following` | 正在跟随 | renderer.js 内 `following:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.follow` | 跟随最新 | renderer.js 内 `follow:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.recordedOnly` | 仅展示当前会话已加载的记录；未上报的时间与耗时不显示。 | renderer.js 内 `recordedOnly:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.count` | {{count}} 条事件 | renderer.js 内 `count:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.empty` | 暂无执行事件 | renderer.js 内 `empty:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.emptyDescription` | 当前筛选下没有已记录的事件，执行更新后会在这里显示。 | renderer.js 内 `emptyDescription:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.noOutput` | 尚无记录的输出 | renderer.js 内 `noOutput:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.duration` | {{seconds}} 秒 | renderer.js 内 `duration:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.expand` | 展开 {{title}} | renderer.js 内 `expand:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.collapse` | 收起 {{title}} | renderer.js 内 `collapse:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.status.running` | 执行中 | renderer.js 内 `running:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.status.streaming` | 生成中 | renderer.js 内 `streaming:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.status.completed` | 已完成 | renderer.js 内 `completed:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.status.failed` | 失败 | renderer.js 内 `failed:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.status.succeeded` | 成功 | renderer.js 内 `succeeded:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.status.cancelled` | 已取消 | renderer.js 内 `cancelled:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.status.interrupted` | 已中断 | renderer.js 内 `interrupted:"…"`（chatTimelineResources 的 zh 段） |
| `executionTrace.status.incomplete` | 未完成 | renderer.js 内 `incomplete:"…"`（chatTimelineResources 的 zh 段） |

## 3 工具调用卡（含 Hook / MCP / 浏览器）

_条目数：213_

### `browserAnnotation.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `browserAnnotation.previewTitle` | 浏览器标注面板 | renderer.js 内 `previewTitle:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.previewSample` | 选中这段文字，调整颜色、字号和间距。 | renderer.js 内 `previewSample:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.previewComment` | 评论 | renderer.js 内 `previewComment:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.previewMultiple` | 多选 | renderer.js 内 `previewMultiple:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.previewNarrow` | 窄屏 | renderer.js 内 `previewNarrow:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.previewReset` | 重置预览 | renderer.js 内 `previewReset:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.previewHint` | 复用客户端主题。切换主题或状态会重置示例；语音仅模拟展示，不录音。 | renderer.js 内 `previewHint:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.label` | 网页注释 | renderer.js 内 `label:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.groupLabel` | 网页注释 {{count}} | renderer.js 内 `groupLabel:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.canvasGroupLabel` | Canvas 标注 {{count}} | renderer.js 内 `canvasGroupLabel:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.officeGroupLabel` | 注释 {{count}} | renderer.js 内 `officeGroupLabel:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.attachmentsLabel` | 消息附件 | renderer.js 内 `attachmentsLabel:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.element` | 元素注释 | renderer.js 内 `element:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.region` | 区域注释 | renderer.js 内 `region:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.screenshotUnavailable` | 截图不可用 | renderer.js 内 `screenshotUnavailable:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.commentPlaceholder` | 添加评论… | renderer.js 内 `commentPlaceholder:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.commentAriaLabel` | 网页注释评论 | renderer.js 内 `commentAriaLabel:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.add` | 添加注释 | renderer.js 内 `add:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.save` | 保存 | renderer.js 内 `save:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.cancel` | 取消 | renderer.js 内 `cancel:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.delete` | 删除 | renderer.js 内 `delete:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.commentRequired` | 输入评论后才能添加。 | renderer.js 内 `commentRequired:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.elementMarker` | 网页元素注释 | renderer.js 内 `elementMarker:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.regionMarker` | 网页区域注释 | renderer.js 内 `regionMarker:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.cardLabel` | 网页注释：{{comment}} | renderer.js 内 `cardLabel:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.remove` | 移除网页注释 | renderer.js 内 `remove:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.removeAll` | 移除全部网页注释 | renderer.js 内 `removeAll:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.openAnnotation` | 定位网页注释 | renderer.js 内 `openAnnotation:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.annotationStale` | 页面已变化，无法定位此注释 | renderer.js 内 `annotationStale:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.canvasAnnotationStale` | Canvas 内容已变化，无法定位此标注 | renderer.js 内 `canvasAnnotationStale:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.adjust` | 调整 | renderer.js 内 `adjust:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.text` | 文本 | renderer.js 内 `text:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.styles` | 样式 | renderer.js 内 `styles:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.reset` | 重置 | renderer.js 内 `reset:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.resetAll` | 重置全部 | renderer.js 内 `resetAll:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.selectedElements` | 已选择 {{count}} 个元素 | renderer.js 内 `selectedElements:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.mixed` | 混合值 | renderer.js 内 `mixed:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.textUnavailable` | 当前选择不支持安全文本编辑 | renderer.js 内 `textUnavailable:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.textColor` | 文字颜色 | renderer.js 内 `textColor:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.backgroundColor` | 背景颜色 | renderer.js 内 `backgroundColor:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.opacity` | 透明度 | renderer.js 内 `opacity:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.font` | 字体 | renderer.js 内 `font:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.fontSize` | 字号 | renderer.js 内 `fontSize:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.fontWeight` | 字重 | renderer.js 内 `fontWeight:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.borderColor` | 边框颜色 | renderer.js 内 `borderColor:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.borderWidth` | 边框宽度 | renderer.js 内 `borderWidth:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.borderRadius` | 圆角 | renderer.js 内 `borderRadius:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.width` | 宽度 | renderer.js 内 `width:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.height` | 高度 | renderer.js 内 `height:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.padding` | 内边距 | renderer.js 内 `padding:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.margin` | 外边距 | renderer.js 内 `margin:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.top` | 上 | renderer.js 内 `top:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.right` | 右 | renderer.js 内 `right:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.bottom` | 下 | renderer.js 内 `bottom:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.left` | 左 | renderer.js 内 `left:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.lockAspectRatio` | 锁定宽高比例 | renderer.js 内 `lockAspectRatio:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.independentCorners` | 分别调整四个圆角 | renderer.js 内 `independentCorners:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.display` | 布局 | renderer.js 内 `display:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.gap` | 间距 | renderer.js 内 `gap:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.voiceInput` | 语音输入 | renderer.js 内 `voiceInput:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.voiceStop` | 停止语音输入 | renderer.js 内 `voiceStop:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.voiceRecording` | 正在听… | renderer.js 内 `voiceRecording:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.voiceFinalizing` | 正在整理语音… | renderer.js 内 `voiceFinalizing:"…"`（workspaceResources 的 zh 段） |
| `browserAnnotation.voiceUnavailable` | 语音输入不可用 | renderer.js 内 `voiceUnavailable:"…"`（workspaceResources 的 zh 段） |

### `browserSurface.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `browserSurface.label` | 内置浏览器 | renderer.js 内 `label:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.back` | 后退 | renderer.js 内 `back:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.forward` | 前进 | renderer.js 内 `forward:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.addressPlaceholder` | 输入网址，例如 localhost:3000 | renderer.js 内 `addressPlaceholder:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.addressLabel` | 网页地址 | renderer.js 内 `addressLabel:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.annotate` | 注释 | renderer.js 内 `annotate:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.annotating` | 正在注释 | renderer.js 内 `annotating:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.annotationInstructions` | 点击元素，或按住鼠标自由圈选区域 | renderer.js 内 `annotationInstructions:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.stopAnnotating` | 结束注释 | renderer.js 内 `stopAnnotating:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.annotationStatus` | 正在批注 · {{host}} | renderer.js 内 `annotationStatus:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.clearAnnotations` | 清空当前页面批注 | renderer.js 内 `clearAnnotations:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.sendAnnotations` | 发送 | renderer.js 内 `sendAnnotations:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.sendAnnotationsFailed` | 未能发送标注，草稿已保留。请从对话输入框重试发送。 | renderer.js 内 `sendAnnotationsFailed:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.stopLoading` | 停止加载 | renderer.js 内 `stopLoading:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.reload` | 重新加载 | renderer.js 内 `reload:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.copyScreenshot` | 复制截图 | renderer.js 内 `copyScreenshot:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.copyScreenshotFailed` | 无法复制浏览器截图。 | renderer.js 内 `copyScreenshotFailed:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.copyLink` | 复制链接 | renderer.js 内 `copyLink:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.copyLinkFailed` | 无法复制链接。 | renderer.js 内 `copyLinkFailed:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.moreActions` | 更多浏览器操作 | renderer.js 内 `moreActions:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.newTab` | 新标签页 | renderer.js 内 `newTab:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.openExternally` | 在外部浏览器中打开 | renderer.js 内 `openExternally:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.closeBrowserPanel` | 关闭浏览器面板 | renderer.js 内 `closeBrowserPanel:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.contextFull` | 上下文已达到 20 项，请移除一项后重试。 | renderer.js 内 `contextFull:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.annotateFailed` | 无法添加网页注释，请重试。 | renderer.js 内 `annotateFailed:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.unsupportedTitle` | 当前宿主不支持内置浏览器 | renderer.js 内 `unsupportedTitle:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.unsupportedDescription` | 请在 Qoder 桌面端中打开这个任务。 | renderer.js 内 `unsupportedDescription:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.unsupportedPreviewDescription` | 请在 Qoder 桌面端中预览此网页。 | renderer.js 内 `unsupportedPreviewDescription:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.emptyTitle` | 在任务中浏览网页 | renderer.js 内 `emptyTitle:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.emptyDescription` | 输入 HTTP 或 HTTPS 地址；登录状态会保存在独立的浏览器资料中。 | renderer.js 内 `emptyDescription:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.localServersTitle` | Local | renderer.js 内 `localServersTitle:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.localServersRefresh` | 刷新本地服务 | renderer.js 内 `localServersRefresh:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.localServersScanningTitle` | 正在扫描本地服务 | renderer.js 内 `localServersScanningTitle:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.localServersScanningDescription` | 正在检查 localhost 端口 | renderer.js 内 `localServersScanningDescription:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.localServersEmptyTitle` | 没有本地服务 | renderer.js 内 `localServersEmptyTitle:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.localServersEmptyDescription` | 试试输入另一个浏览器地址 | renderer.js 内 `localServersEmptyDescription:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.localServersUnsupportedDescription` | 当前系统暂不支持扫描本地服务。 | renderer.js 内 `localServersUnsupportedDescription:"…"`（workspaceResources 的 zh 段） |
| `browserSurface.localServersError` | 无法扫描本地服务。 | renderer.js 内 `localServersError:"…"`（workspaceResources 的 zh 段） |

### `chatActivity.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatActivity.running` | 正在执行 | renderer.js 内 `running:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.searchWorkspaceFailed` | 工作区检索未完成。请重试，或继续直接读取和搜索文件。 | renderer.js 内 `searchWorkspaceFailed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hook.status.running` | 执行中 | renderer.js 内 `running:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hook.status.succeeded` | 成功 | renderer.js 内 `succeeded:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hook.status.failed` | 失败 | renderer.js 内 `failed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hook.status.cancelled` | 已取消 | renderer.js 内 `cancelled:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hook.status.interrupted` | 已中断 | renderer.js 内 `interrupted:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hook.status.incomplete` | 未记录最终结果 | renderer.js 内 `incomplete:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.command` | 终端命令 | renderer.js 内 `command:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.readFile` | 读取文件 | renderer.js 内 `readFile:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.writeFile` | 写入文件 | renderer.js 内 `writeFile:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.editFile` | 编辑文件 | renderer.js 内 `editFile:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.findFiles` | 查找文件 | renderer.js 内 `findFiles:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.searchContent` | 搜索内容 | renderer.js 内 `searchContent:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.searchWorkspace` | 检索工作区 | renderer.js 内 `searchWorkspace:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.searchKnowledge` | 检索知识 | renderer.js 内 `searchKnowledge:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.listDirectory` | 列出目录 | renderer.js 内 `listDirectory:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.openWebpage` | 打开网页 | renderer.js 内 `openWebpage:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.searchWeb` | 搜索网页 | renderer.js 内 `searchWeb:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.searchTools` | 搜索工具 | renderer.js 内 `searchTools:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.loadTool` | 加载工具 | renderer.js 内 `loadTool:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.callTool` | 调用工具 | renderer.js 内 `callTool:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.createGoal` | 创建目标 | renderer.js 内 `createGoal:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.getGoal` | 获取目标 | renderer.js 内 `getGoal:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.updateGoal` | 更新目标 | renderer.js 内 `updateGoal:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.createChatSession` | 创建任务 | renderer.js 内 `createChatSession:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.listChatSessions` | 查询任务 | renderer.js 内 `listChatSessions:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.readChatSession` | 读取任务 | renderer.js 内 `readChatSession:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.waitChatSessions` | 等待任务 | renderer.js 内 `waitChatSessions:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.sendMessageToChatSession` | 发送任务消息 | renderer.js 内 `sendMessageToChatSession:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.forkChatSession` | 创建任务分支 | renderer.js 内 `forkChatSession:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.createRecordingNote` | 创建录音纪要 | renderer.js 内 `createRecordingNote:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.manageAutomations` | 管理自动化 | renderer.js 内 `manageAutomations:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.searchExtensions` | 搜索扩展 | renderer.js 内 `searchExtensions:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.installExtension` | 安装扩展 | renderer.js 内 `installExtension:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.nodeRepl.run` | 运行 JavaScript | renderer.js 内 `run:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.nodeRepl.wait` | 等待 JavaScript 执行 | renderer.js 内 `wait:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.nodeRepl.cancel` | 取消 JavaScript 执行 | renderer.js 内 `cancel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.nodeRepl.reset` | 重置 JavaScript 会话 | renderer.js 内 `reset:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.nodeRepl.addModuleDirectory` | 添加代码模块目录 | renderer.js 内 `addModuleDirectory:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.browser.listPages` | 列出浏览器页面 | renderer.js 内 `listPages:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.browser.selectPage` | 选择浏览器页面 | renderer.js 内 `selectPage:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.browser.navigatePage` | 打开网页 | renderer.js 内 `navigatePage:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.browser.click` | 点击网页元素 | renderer.js 内 `click:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.browser.hover` | 悬停网页元素 | renderer.js 内 `hover:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.browser.fill` | 填写网页内容 | renderer.js 内 `fill:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.browser.drag` | 拖动网页元素 | renderer.js 内 `drag:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.browser.uploadFile` | 上传文件 | renderer.js 内 `uploadFile:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.browser.pressKey` | 按下按键 | renderer.js 内 `pressKey:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.browser.handleDialog` | 处理网页对话框 | renderer.js 内 `handleDialog:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.browser.takeSnapshot` | 读取网页内容 | renderer.js 内 `takeSnapshot:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.browser.waitFor` | 等待网页内容 | renderer.js 内 `waitFor:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.browser.takeScreenshot` | 截取网页 | renderer.js 内 `takeScreenshot:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.browser.evaluateScript` | 执行网页脚本 | renderer.js 内 `evaluateScript:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.browser.listNetworkRequests` | 查看网络请求 | renderer.js 内 `listNetworkRequests:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.browser.listConsoleMessages` | 查看控制台消息 | renderer.js 内 `listConsoleMessages:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.generatePlan` | 生成计划 | renderer.js 内 `generatePlan:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.generatePlanFailed` | 计划生成失败 | renderer.js 内 `generatePlanFailed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.toolNames.planImplementationNotStarted` | 未进入执行阶段 | renderer.js 内 `planImplementationNotStarted:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChange.openFile` | 打开 {{fileName}} | renderer.js 内 `openFile:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChange.expandDiff` | 查看 {{fileName}} 的本次修改 | renderer.js 内 `expandDiff:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChange.diffUnavailable` | 无法生成本次修改的文本 Diff。 | renderer.js 内 `diffUnavailable:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChange.diffBeforeUnavailable` | 无法读取写入前的文件内容，请在工作区查看文件。 | renderer.js 内 `diffBeforeUnavailable:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChange.diffTooLarge` | 本次修改内容过大，请在工作区查看文件。 | renderer.js 内 `diffTooLarge:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.readFile.openFile` | 打开 {{fileName}} | renderer.js 内 `openFile:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.readFile.expandDetails` | 查看 {{fileName}} 的读取详情 | renderer.js 内 `expandDetails:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.creatingChatSession` | 正在创建任务 | renderer.js 内 `creatingChatSession:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.chatSessionCreated` | 任务已创建 | renderer.js 内 `chatSessionCreated:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.createChatSessionFailed` | 无法创建任务 | renderer.js 内 `createChatSessionFailed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.openChatSession` | 打开任务 | renderer.js 内 `openChatSession:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.listChatSessions.running` | 正在查询任务 | renderer.js 内 `running:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.listChatSessions.completed` | 已查询任务 | renderer.js 内 `completed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.listChatSessions.failed` | 无法查询任务 | renderer.js 内 `failed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.readChatSession.running` | 正在读取任务 | renderer.js 内 `running:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.readChatSession.completed` | 已读取任务 | renderer.js 内 `completed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.readChatSession.failed` | 无法读取任务 | renderer.js 内 `failed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.waitChatSessions.running` | 正在等待任务 | renderer.js 内 `running:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.waitChatSessions.completed` | 任务等待已结束 | renderer.js 内 `completed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.waitChatSessions.failed` | 无法等待任务 | renderer.js 内 `failed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.waitChatSessions.outcomes.turn_completed` | 任务当前 Turn 已结束 | renderer.js 内 `turn_completed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.waitChatSessions.outcomes.idle` | 任务当前空闲 | renderer.js 内 `idle:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.waitChatSessions.outcomes.needs_attention` | 任务需要你处理 | renderer.js 内 `needs_attention:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.waitChatSessions.outcomes.failed` | 任务运行失败 | renderer.js 内 `failed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.waitChatSessions.outcomes.interrupted` | 任务运行已中断 | renderer.js 内 `interrupted:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.waitChatSessions.outcomes.timeout` | 等待任务超时 | renderer.js 内 `timeout:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.sendMessageToChatSession.running` | 正在发送任务消息 | renderer.js 内 `running:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.sendMessageToChatSession.completed` | 任务消息已发送 | renderer.js 内 `completed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.sendMessageToChatSession.failed` | 无法发送任务消息 | renderer.js 内 `failed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.forkChatSession.running` | 正在创建任务分支 | renderer.js 内 `running:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.forkChatSession.completed` | 任务分支已创建 | renderer.js 内 `completed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.hostTools.forkChatSession.failed` | 无法创建任务分支 | renderer.js 内 `failed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.completed` | 执行完成 | renderer.js 内 `completed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.processed` | 已处理 | renderer.js 内 `processed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.questionUnanswered` | 问题未回答，当前回复已中断。 | renderer.js 内 `questionUnanswered:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.summary.files` | 读取 {{count}} 个文件 | renderer.js 内 `files:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.summary.directories` | 查看 {{count}} 个目录 | renderer.js 内 `directories:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.summary.searches` | 完成 {{count}} 次搜索 | renderer.js 内 `searches:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.summary.edits` | 修改 {{count}} 个文件 | renderer.js 内 `edits:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.summary.commands` | 执行 {{count}} 条命令 | renderer.js 内 `commands:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.summary.web` | 访问 {{count}} 次网页 | renderer.js 内 `web:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.summary.tools` | 调用 {{count}} 个工具 | renderer.js 内 `tools:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.summary.separator` | 、 | renderer.js 内 `separator:"…"`（chatTimelineResources 的 zh 段） |

### `tools.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `tools.input` | 输入 | renderer.js 内 `input:"…"`（chatTimelineResources 的 zh 段） |
| `tools.progress` | 过程 | renderer.js 内 `progress:"…"`（chatTimelineResources 的 zh 段） |
| `tools.progressTruncated` | 过程（较早内容已截断） | renderer.js 内 `progressTruncated:"…"`（chatTimelineResources 的 zh 段） |
| `tools.response` | 响应 | renderer.js 内 `response:"…"`（chatTimelineResources 的 zh 段） |
| `tools.resultImageAlt` | {{name}} | renderer.js 内 `resultImageAlt:"…"`（chatTimelineResources 的 zh 段） |
| `tools.resultImageUnavailable` | 图片已失效或无法加载 | renderer.js 内 `resultImageUnavailable:"…"`（chatTimelineResources 的 zh 段） |
| `tools.status.running` | 正在执行 | renderer.js 内 `running:"…"`（chatTimelineResources 的 zh 段） |
| `tools.status.ran` | 已执行 | renderer.js 内 `ran:"…"`（chatTimelineResources 的 zh 段） |
| `tools.status.failed` | 执行失败 | renderer.js 内 `failed:"…"`（chatTimelineResources 的 zh 段） |

## 4 终端与命令执行

_条目数：75_

### `chatActivity.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatActivity.command.description` | 命令说明 | renderer.js 内 `description:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.command.status.running` | 终端命令 运行中 | renderer.js 内 `running:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.command.status.success` | 终端命令 已运行 | renderer.js 内 `success:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.command.status.error` | 终端命令 运行失败 | renderer.js 内 `error:"…"`（chatTimelineResources 的 zh 段） |

### `chatSession.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatSession.backgroundProcesses.title` | 后台进程 | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.stop` | 停止进程 | renderer.js 内 `stop:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.stopping` | 正在停止 | renderer.js 内 `stopping:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.stopUnavailable` | 无法停止 | renderer.js 内 `stopUnavailable:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.stopFailed` | 未能停止这个后台进程，请稍后重试。 | renderer.js 内 `stopFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.expandCommand` | 展开命令 | renderer.js 内 `expandCommand:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.collapseCommand` | 收起命令 | renderer.js 内 `collapseCommand:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.workspaceLabel` | 后台进程 {{name}} | renderer.js 内 `workspaceLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.unavailableTitle` | 后台进程不可用 | renderer.js 内 `unavailableTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.unavailableDescription` | 这个进程已经从当前运行时移除。 | renderer.js 内 `unavailableDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.outputWaitingTitle` | 后台进程正在运行 | renderer.js 内 `outputWaitingTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.outputWaitingDescription` | 命令输出会在这里持续更新。 | renderer.js 内 `outputWaitingDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.outputEmptyTitle` | 没有命令输出 | renderer.js 内 `outputEmptyTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.outputEmptyDescription` | 这个后台进程已结束，但没有产生可展示的输出。 | renderer.js 内 `outputEmptyDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.outputUnavailableTitle` | 无法读取命令输出 | renderer.js 内 `outputUnavailableTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.outputUnavailableDescription` | 当前执行位置不支持实时读取这个后台进程的输出。 | renderer.js 内 `outputUnavailableDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.outputTruncated` | 输出过长，当前仅保留最新内容。 | renderer.js 内 `outputTruncated:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.status.pending` | 等待中 | renderer.js 内 `pending:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.status.running` | 运行中 | renderer.js 内 `running:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.status.paused` | 已暂停 | renderer.js 内 `paused:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.status.completed` | 已完成 | renderer.js 内 `completed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.status.failed` | 失败 | renderer.js 内 `failed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundProcesses.status.stopped` | 已停止 | renderer.js 内 `stopped:"…"`（chatSessionResources 的 zh 段） |

### `newChat.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `newChat.currentWorkingTree` | 当前文件状态 | renderer.js 内 `currentWorkingTree:"…"`（newChatResources 的 zh 段） |
| `newChat.localFileState` | 本地文件状态 | renderer.js 内 `localFileState:"…"`（newChatResources 的 zh 段） |
| `newChat.containsLocalChanges` | 含本地代码更改 | renderer.js 内 `containsLocalChanges:"…"`（newChatResources 的 zh 段） |
| `newChat.localChangesStatusUnavailable` | 本地更改状态暂不可用 | renderer.js 内 `localChangesStatusUnavailable:"…"`（newChatResources 的 zh 段） |

### `workspaceActions.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `workspaceActions.addAction` | 添加 Action | renderer.js 内 `addAction:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.addActionIcon` | 添加 Workspace Action | renderer.js 内 `addActionIcon:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.addActionTooltip` | 为当前工作区配置可一键运行的 Action。 | renderer.js 内 `addActionTooltip:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.addTitle` | 添加 Action | renderer.js 内 `addTitle:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.editTitle` | 编辑 Action | renderer.js 内 `editTitle:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.description` | 把常用命令保存为快捷 Action，点击后在当前工作区终端执行。 | renderer.js 内 `description:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.closeDialog` | 关闭 Action 编辑弹窗 | renderer.js 内 `closeDialog:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.name` | 名称 | renderer.js 内 `name:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.namePlaceholder` | 测试 | renderer.js 内 `namePlaceholder:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.icon` | 图标 | renderer.js 内 `icon:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.command` | 命令 | renderer.js 内 `command:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.commandPlaceholder` | npm test | renderer.js 内 `commandPlaceholder:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.nameRequired` | 请输入 Action 名称。 | renderer.js 内 `nameRequired:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.commandRequired` | 请输入要执行的命令。 | renderer.js 内 `commandRequired:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.saveAction` | 保存 Action | renderer.js 内 `saveAction:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.saveChanges` | 保存修改 | renderer.js 内 `saveChanges:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.deleteAction` | 删除 Action | renderer.js 内 `deleteAction:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.deleteTitle` | 删除“{{name}}”？ | renderer.js 内 `deleteTitle:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.deleteDescription` | 此 Action 只会从当前工作区命令列表中移除，已运行过的终端输出不会被删除。 | renderer.js 内 `deleteDescription:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.group` | Workspace Actions | renderer.js 内 `group:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.menu` | Workspace Actions 菜单 | renderer.js 内 `menu:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.manageActions` | 管理 Action | renderer.js 内 `manageActions:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.runAction` | 运行 {{name}} | renderer.js 内 `runAction:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.editAction` | 编辑 {{name}} | renderer.js 内 `editAction:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.limitReached` | 最多可添加 {{count}} 个 Action | renderer.js 内 `limitReached:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.actionUnavailable` | 这个 Action 已不存在，请关闭后重试。 | renderer.js 内 `actionUnavailable:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.invalidAction` | Action 的名称和命令不能为空。 | renderer.js 内 `invalidAction:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.saveFailed` | Action 保存失败，请检查本机存储后重试。 | renderer.js 内 `saveFailed:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.deleteFailed` | Action 删除失败，请重试。 | renderer.js 内 `deleteFailed:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.runFailed` | Action 未运行 | renderer.js 内 `runFailed:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.terminalUnavailable` | 当前任务终端不可用，请确认任务仍有可执行的工作目录。 | renderer.js 内 `terminalUnavailable:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.icons.play` | 运行图标 | renderer.js 内 `play:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.icons.test` | 测试图标 | renderer.js 内 `test:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.icons.debug` | 调试图标 | renderer.js 内 `debug:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.icons.code` | 编码图标 | renderer.js 内 `code:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.icons.terminal` | 终端图标 | renderer.js 内 `terminal:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.icons.branch` | 分支图标 | renderer.js 内 `branch:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.icons.commit` | 提交图标 | renderer.js 内 `commit:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.icons.pullRequest` | Pull Request 图标 | renderer.js 内 `pullRequest:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.icons.deploy` | 发布图标 | renderer.js 内 `deploy:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.icons.package` | 依赖包图标 | renderer.js 内 `package:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.icons.security` | 安全图标 | renderer.js 内 `security:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.icons.database` | 数据库图标 | renderer.js 内 `database:"…"`（workspaceResources 的 zh 段） |
| `workspaceActions.icons.docs` | 文档图标 | renderer.js 内 `docs:"…"`（workspaceResources 的 zh 段） |

## 5 文件与 diff / 审阅面

_条目数：407_

### `chatActivity.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatActivity.fileChanges.ariaLabel` | 本轮文件修改摘要 | renderer.js 内 `ariaLabel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.activeTitle` | {{count}} 个文件已修改 | renderer.js 内 `activeTitle:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.activeAriaLabel` | 本轮已修改 {{count}} 个文件，新增 {{additions}} 行，删除 {{deletions}} 行；打开实时审阅 | renderer.js 内 `activeAriaLabel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.activeAriaLabelPartial` | 本轮已修改 {{count}} 个文件，部分行数尚不可用；打开实时审阅 | renderer.js 内 `activeAriaLabelPartial:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.activeMore` | 另有 {{count}} 个文件 | renderer.js 内 `activeMore:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.singleTitle` | 已编辑 {{fileName}} | renderer.js 内 `singleTitle:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.title` | 已编辑 {{count}} 个文件 | renderer.js 内 `title:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.rewoundTitle` | 已撤销 {{count}} 个文件的修改 | renderer.js 内 `rewoundTitle:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.undo` | 撤销 | renderer.js 内 `undo:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.undoPreparing` | 检查中… | renderer.js 内 `undoPreparing:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.undoPreparingDescription` | 正在检查将恢复的文件和受影响轮次… | renderer.js 内 `undoPreparingDescription:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.review` | 审阅 | renderer.js 内 `review:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.diffPreviewAriaLabel` | {{path}} 的 Diff 预览 | renderer.js 内 `diffPreviewAriaLabel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.diffPreviewLoading` | 正在加载 Diff… | renderer.js 内 `diffPreviewLoading:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.diffPreviewLoadFailed` | Diff 加载失败。移开后重新悬停可重试。 | renderer.js 内 `diffPreviewLoadFailed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.diffPreviewExpired` | 这份 Diff 记录已过期，无法快捷预览。 | renderer.js 内 `diffPreviewExpired:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.diffPreviewTooLarge` | Diff 过大，无法在快捷预览中显示。 | renderer.js 内 `diffPreviewTooLarge:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.diffPreviewUnavailable` | 当前没有可供预览的文本 Diff。 | renderer.js 内 `diffPreviewUnavailable:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.showMore` | 再显示 {{count}} 个文件 | renderer.js 内 `showMore:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.showLess` | 收起文件 | renderer.js 内 `showLess:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.undoUnavailableTitle` | 当前无法撤销 | renderer.js 内 `undoUnavailableTitle:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.undoUnavailableDescription` | 文件检查点不可用，工作区未发生变化。 | renderer.js 内 `undoUnavailableDescription:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.undoSucceededTitle` | 已撤销文件修改 | renderer.js 内 `undoSucceededTitle:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.undoSucceededDescription` | 已恢复 {{count}} 个文件；任务记录仍然保留。 | renderer.js 内 `undoSucceededDescription:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.reviewFailedTitle` | 无法打开审阅 | renderer.js 内 `reviewFailedTitle:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.reviewFailedDescription` | 本轮文件变更暂时无法读取。 | renderer.js 内 `reviewFailedDescription:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.undoConfirmTitle` | 撤销这轮之后的文件修改？ | renderer.js 内 `undoConfirmTitle:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.undoConfirmDescription` | 将恢复 {{fileCount}} 个文件，并同时撤销从这轮开始受影响的 {{turnCount}} 轮修改。任务记录不会删除。 | renderer.js 内 `undoConfirmDescription:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.undoPartialWarning` | 部分修改不在 CLI 文件检查点中，撤销结果可能不完整。 | renderer.js 内 `undoPartialWarning:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.undoCancel` | 取消 | renderer.js 内 `undoCancel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.undoConfirm` | 撤销文件修改 | renderer.js 内 `undoConfirm:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.undoSubmitting` | 正在撤销… | renderer.js 内 `undoSubmitting:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.undoFailedTitle` | 无法撤销本轮修改 | renderer.js 内 `undoFailedTitle:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.fileChanges.undoFailedDescription` | CLI 文件检查点暂时不可用，工作区未发生变化。 | renderer.js 内 `undoFailedDescription:"…"`（chatTimelineResources 的 zh 段） |

### `workspace.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `workspace.openRootPathInFileManager` | 在文件管理器中打开 {{path}} | renderer.js 内 `openRootPathInFileManager:"…"`（workspaceResources 的 zh 段） |
| `workspace.workDirectory` | 工作目录 | renderer.js 内 `workDirectory:"…"`（workspaceResources 的 zh 段） |
| `workspace.changes` | 变更 | renderer.js 内 `changes:"…"`（workspaceResources 的 zh 段） |
| `workspace.emptyChanges` | 还没有代码变更 | renderer.js 内 `emptyChanges:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.panel` | 审阅 | renderer.js 内 `panel:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.editor` | 工作区编辑器 | renderer.js 内 `editor:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.backToChanges` | 返回变更列表 | renderer.js 内 `backToChanges:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.backToFiles` | 返回文件列表 | renderer.js 内 `backToFiles:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.loadingChanges` | 正在加载变更... | renderer.js 内 `loadingChanges:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.chooseChange` | 选择一个变更 | renderer.js 内 `chooseChange:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.chooseFile` | 选择一个文件 | renderer.js 内 `chooseFile:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.closeSidebar` | 关闭审阅侧栏 | renderer.js 内 `closeSidebar:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownViewMode` | Markdown 查看模式 | renderer.js 内 `markdownViewMode:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.preview` | 预览 | renderer.js 内 `preview:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.source` | 原文 | renderer.js 内 `source:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSourceMode` | 查看原文 | renderer.js 内 `markdownSourceMode:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownPreviewMode` | 查看预览 | renderer.js 内 `markdownPreviewMode:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownPreviewEditable` | 预览态可编辑 | renderer.js 内 `markdownPreviewEditable:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownPreviewEditableLimitedTooltip` | 预览态可编辑：{{reason}} | renderer.js 内 `markdownPreviewEditableLimitedTooltip:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.inputLabel` | 在文件中查找 | renderer.js 内 `inputLabel:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.placeholder` | 查找 | renderer.js 内 `placeholder:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.searching` | 正在查找… | renderer.js 内 `searching:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.failed` | 查找失败 | renderer.js 内 `failed:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.invalid` | 正则无效 | renderer.js 内 `invalid:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.empty` | 无结果 | renderer.js 内 `empty:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.previous` | 上一个匹配 | renderer.js 内 `previous:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.previousLabel` | 转到上一个匹配 | renderer.js 内 `previousLabel:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.next` | 下一个匹配 | renderer.js 内 `next:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.nextLabel` | 转到下一个匹配 | renderer.js 内 `nextLabel:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.close` | 关闭查找 | renderer.js 内 `close:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.closeLabel` | 关闭查找 | renderer.js 内 `closeLabel:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.matchCase` | 区分大小写 | renderer.js 内 `matchCase:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.wholeWord` | 全字匹配 | renderer.js 内 `wholeWord:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.regularExpression` | 使用正则表达式 | renderer.js 内 `regularExpression:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.expandReplace` | 展开替换 | renderer.js 内 `expandReplace:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.collapseReplace` | 收起替换 | renderer.js 内 `collapseReplace:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.replacementInputLabel` | 替换为 | renderer.js 内 `replacementInputLabel:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.replacementPlaceholder` | 替换 | renderer.js 内 `replacementPlaceholder:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.replaceNext` | 替换当前匹配 | renderer.js 内 `replaceNext:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.replaceNextLabel` | 替换当前匹配 | renderer.js 内 `replaceNextLabel:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.replaceAll` | 全部替换 | renderer.js 内 `replaceAll:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.findReplace.replaceAllLabel` | 全部替换 | renderer.js 内 `replaceAllLabel:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.saveFile` | 保存文件 | renderer.js 内 `saveFile:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.resolveFileConflict` | 解决冲突 | renderer.js 内 `resolveFileConflict:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSaveState.dirty` | 已修改 | renderer.js 内 `dirty:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSaveState.saving` | 正在保存 | renderer.js 内 `saving:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSaveState.conflict` | 磁盘内容已变化 | renderer.js 内 `conflict:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSaveState.error` | 保存失败 | renderer.js 内 `error:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.discardFileChanges` | 放弃更改并重新加载 | renderer.js 内 `discardFileChanges:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.discardFileTitle` | 放弃“{{name}}”的更改？ | renderer.js 内 `discardFileTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.discardFileDescription` | 未保存的编辑会被丢弃，并重新读取磁盘上的文件内容。 | renderer.js 内 `discardFileDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.discardAndReload` | 放弃更改并重新加载 | renderer.js 内 `discardAndReload:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileConflictTitle` | 解决“{{name}}”的文件冲突 | renderer.js 内 `fileConflictTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileConflictDescription` | 当前编辑内容和磁盘内容不同。读取磁盘版本会丢弃当前编辑；用当前内容覆盖磁盘会替换外部修改。 | renderer.js 内 `fileConflictDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.useDiskVersion` | 读取磁盘版本 | renderer.js 内 `useDiskVersion:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.overwriteDisk` | 用当前内容覆盖磁盘 | renderer.js 内 `overwriteDisk:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.reloadingFile` | 正在读取... | renderer.js 内 `reloadingFile:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.overwritingDisk` | 正在覆盖... | renderer.js 内 `overwritingDisk:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.unsavedCloseTitle` | 保存文件更改？ | renderer.js 内 `unsavedCloseTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.unsavedCloseDescription` | 关闭前还有 {{count}} 个文件未保存。 | renderer.js 内 `unsavedCloseDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.unsavedCloseSaveAll` | 全部保存 | renderer.js 内 `unsavedCloseSaveAll:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.unsavedCloseSaving` | 正在保存... | renderer.js 内 `unsavedCloseSaving:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.unsavedCloseDiscard` | 全部放弃 | renderer.js 内 `unsavedCloseDiscard:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.unsavedCloseSaveFailed` | 部分文件未能保存。请处理冲突或写入错误后重试。 | renderer.js 内 `unsavedCloseSaveFailed:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileActions` | 更多文件操作 | renderer.js 内 `fileActions:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileContextMenu.addToChat` | 添加到任务 | renderer.js 内 `addToChat:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileContextMenu.addToChatFailed` | 无法添加文件 | renderer.js 内 `addToChatFailed:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileContextMenu.contextLimitReached` | 当前消息的附件数量已达上限，请先移除部分附件。 | renderer.js 内 `contextLimitReached:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileContextMenu.copyRelative` | 复制相对路径 | renderer.js 内 `copyRelative:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.copyPath` | 复制路径 | renderer.js 内 `copyPath:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.copyPathSucceeded` | 路径已复制 | renderer.js 内 `copyPathSucceeded:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.copyPathFailedTitle` | 无法复制路径 | renderer.js 内 `copyPathFailedTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.copyPathFailedDescription` | 当前环境无法写入剪贴板。 | renderer.js 内 `copyPathFailedDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.copyContent` | 复制文件内容 | renderer.js 内 `copyContent:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.copyImage` | 复制图片 | renderer.js 内 `copyImage:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.copiedImage` | 已复制 {{name}} | renderer.js 内 `copiedImage:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.copyImageFailed` | 无法复制图片，请稍后重试。 | renderer.js 内 `copyImageFailed:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.enableWordWrap` | 启用自动换行 | renderer.js 内 `enableWordWrap:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.disableWordWrap` | 关闭自动换行 | renderer.js 内 `disableWordWrap:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.open` | 打开 | renderer.js 内 `open:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.openFileTree` | 打开文件树 | renderer.js 内 `openFileTree:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.showFileTree` | 显示文件树 | renderer.js 内 `showFileTree:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.hideFileTree` | 收起文件树 | renderer.js 内 `hideFileTree:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileOpenFailed` | 无法打开这个文件 | renderer.js 内 `fileOpenFailed:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileOpenFailedDescription` | 文件暂时无法读取。请稍后重试，或从文件列表选择其他文件。 | renderer.js 内 `fileOpenFailedDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileNotFoundTitle` | 文件已不存在 | renderer.js 内 `fileNotFoundTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileNotFoundDescription` | 这个文件可能已被删除、移动或撤销。请从文件列表选择其他文件。 | renderer.js 内 `fileNotFoundDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.filePreviewTooLargeTitle` | 文件过大，无法预览 | renderer.js 内 `filePreviewTooLargeTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.filePreviewTooLargeDescription` | 这个文件超过预览大小限制。请使用其他应用打开。 | renderer.js 内 `filePreviewTooLargeDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.filePreviewTooLargeIdeDescription` | 这个文件超过预览大小限制。 | renderer.js 内 `filePreviewTooLargeIdeDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.filePreviewTooLargeOpenInIde` | 在 {{name}} 中打开 | renderer.js 内 `filePreviewTooLargeOpenInIde:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.filePreviewUnsupportedTitle` | 无法预览这种文件 | renderer.js 内 `filePreviewUnsupportedTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.filePreviewUnsupportedDescription` | 暂不支持这种文件的格式、编码或大小。请使用其他应用打开。 | renderer.js 内 `filePreviewUnsupportedDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileEncodingRequiredTitle` | 无法按当前编码预览 | renderer.js 内 `fileEncodingRequiredTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileEncodingRequiredDescription` | 文件可能使用其他文本编码。选择编码重新打开；非 UTF-8 文件将以只读方式显示。 | renderer.js 内 `fileEncodingRequiredDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.switchFileEncoding` | 切换文件编码，当前为 {{encoding}} | renderer.js 内 `switchFileEncoding:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.legacyEncodingReadOnly` | {{encoding}} · 只读 | renderer.js 内 `legacyEncodingReadOnly:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileEncodings.utf8` | UTF-8 | renderer.js 内 `utf8:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileEncodings.gbk` | 简体中文（GB 2312 / GBK） | renderer.js 内 `gbk:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileEncodings.gb18030` | 简体中文（GB 18030） | renderer.js 内 `gb18030:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileEncodings.big5` | 繁体中文（Big5） | renderer.js 内 `big5:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileEncodings.shiftJis` | 日文（Shift JIS） | renderer.js 内 `shiftJis:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileEncodings.eucKr` | 韩文（EUC-KR） | renderer.js 内 `eucKr:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileEncodings.windows1252` | 西欧（Windows 1252） | renderer.js 内 `windows1252:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.unsavedChanges` | 有未保存的修改 | renderer.js 内 `unsavedChanges:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileSaved` | 已保存 {{name}} | renderer.js 内 `fileSaved:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileReloaded` | 已读取磁盘上的 {{name}} | renderer.js 内 `fileReloaded:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileSaveFailedTitle` | 无法保存文件 | renderer.js 内 `fileSaveFailedTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileSaveFailedDescription` | 修改仍保留在编辑器中，请稍后重试。 | renderer.js 内 `fileSaveFailedDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileReloadFailedTitle` | 无法重新加载文件 | renderer.js 内 `fileReloadFailedTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileReloadFailedDescription` | 当前编辑仍保留在编辑器中，请稍后重试。 | renderer.js 内 `fileReloadFailedDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileConflictResolutionFailedTitle` | 尚未解决文件冲突 | renderer.js 内 `fileConflictResolutionFailedTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.openImagePreview` | 预览图片 {{name}} | renderer.js 内 `openImagePreview:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.imagePreviewAlt` | 图片预览：{{name}} | renderer.js 内 `imagePreviewAlt:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.diffUnavailable` | 没有可展示的 Diff | renderer.js 内 `diffUnavailable:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.diffUnavailableDescription` | 文件状态已经变化，刷新变更列表后再试。 | renderer.js 内 `diffUnavailableDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.largeDiffSingleFile` | 变更规模较大，当前每次仅显示一个文件。 | renderer.js 内 `largeDiffSingleFile:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.previousFile` | 上一个文件 | renderer.js 内 `previousFile:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.nextFile` | 下一个文件 | renderer.js 内 `nextFile:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.add` | 在这一行添加评论 | renderer.js 内 `add:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.editorTitle` | 评论第 {{side}}{{line}} 行 | renderer.js 内 `editorTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.placeholder` | 说明希望如何修改… | renderer.js 内 `placeholder:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.cancel` | 取消 | renderer.js 内 `cancel:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.submit` | 添加评论 | renderer.js 内 `submit:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.localLabel` | 本地评论 | renderer.js 内 `localLabel:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.edit` | 编辑评论 | renderer.js 内 `edit:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.editTitle` | 编辑评论 · {{side}} {{line}} | renderer.js 内 `editTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.save` | 保存修改 | renderer.js 内 `save:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.delete` | 删除评论 | renderer.js 内 `delete:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.limitReached` | 当前消息的上下文数量已达上限，请先移除部分附件或评论。 | renderer.js 内 `limitReached:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.summary` | {{count}} 条审阅评论 | renderer.js 内 `summary:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.hoverHint` | 悬停查看全部评论 | renderer.js 内 `hoverHint:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.summaryAriaLabel` | {{count}} 条审阅评论，悬停查看详情 | renderer.js 内 `summaryAriaLabel:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.removeAll` | 移除全部审阅评论 | renderer.js 内 `removeAll:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.removeOne` | 移除 {{file}} 第 {{line}} 行的评论 | renderer.js 内 `removeOne:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comments.openFile` | 在代码视图中打开 {{file}} | renderer.js 内 `openFile:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.turnFilePatchExpiredTitle` | 变更详情已清理 | renderer.js 内 `turnFilePatchExpiredTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.turnFilePatchExpiredDescription` | 为控制磁盘占用，这个文件的历史 Diff 已被清理，变更摘要仍会保留。 | renderer.js 内 `turnFilePatchExpiredDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.turnFilePatchUnavailableTitle` | 变更详情不可用 | renderer.js 内 `turnFilePatchUnavailableTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.turnFilePatchUnavailableDescription` | 未能生成这个文件的完整 Diff，已保留可确认的变更摘要。 | renderer.js 内 `turnFilePatchUnavailableDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.workspaceFallback` | 工作区 | renderer.js 内 `workspaceFallback:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.changeEmptyDescription` | 从{{source}}列表选择文件，在这里查看 Diff。 | renderer.js 内 `changeEmptyDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileEmptyDescription` | 从{{source}}列表选择文件，在这里预览。 | renderer.js 内 `fileEmptyDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.reviewList` | 审阅 | renderer.js 内 `reviewList:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.changeList` | 右侧变更 | renderer.js 内 `changeList:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.locationList` | 位置 | renderer.js 内 `locationList:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileTree` | 右侧文件树 | renderer.js 内 `fileTree:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileBreadcrumbs` | 文件路径 | renderer.js 内 `fileBreadcrumbs:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.browseDirectory` | 浏览目录 {{path}} | renderer.js 内 `browseDirectory:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.directoryContents` | 目录内容 | renderer.js 内 `directoryContents:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.emptyDirectory` | 这个目录为空。 | renderer.js 内 `emptyDirectory:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.diffSummary` | 新增 {{additions}} 行，删除 {{deletions}} 行 | renderer.js 内 `diffSummary:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.staged` | 已暂存 | renderer.js 内 `staged:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.uncommitted` | 未提交 | renderer.js 内 `uncommitted:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.committed` | 已提交 | renderer.js 内 `committed:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.unstaged` | 未暂存 | renderer.js 内 `unstaged:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.untracked` | 未跟踪 | renderer.js 内 `untracked:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.conflict` | 冲突 | renderer.js 内 `conflict:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.comparison` | 变更 | renderer.js 内 `comparison:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.filterFiles` | 筛选文件 | renderer.js 内 `filterFiles:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.filterChangedFiles` | 筛选变更文件 | renderer.js 内 `filterChangedFiles:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.filterPlaceholder` | 筛选文件… | renderer.js 内 `filterPlaceholder:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileSearchResults` | 文件搜索结果 | renderer.js 内 `fileSearchResults:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileSearchIncompleteTitle` | 部分文件尚未搜索 | renderer.js 内 `fileSearchIncompleteTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileSearchIncompleteDescription` | 搜索未覆盖全部文件。可清除筛选后重试，或展开文件夹查找。 | renderer.js 内 `fileSearchIncompleteDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.noMatchingFilesTitle` | 没有匹配的文件 | renderer.js 内 `noMatchingFilesTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.noMatchingFilesDescription` | 调整筛选词后再试。 | renderer.js 内 `noMatchingFilesDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileSearchUnavailableTitle` | 暂时无法搜索文件 | renderer.js 内 `fileSearchUnavailableTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileSearchUnavailableDescription` | 请稍后重试，或清除筛选词继续浏览文件树。 | renderer.js 内 `fileSearchUnavailableDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileSearchLimited` | 仅显示前 {{count}} 个结果，请缩小筛选范围。 | renderer.js 内 `fileSearchLimited:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.selectWorkspace` | 选择工作区，当前为{{workspace}} | renderer.js 内 `selectWorkspace:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.allProjects` | 所有项目 | renderer.js 内 `allProjects:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.selectProject` | 选择项目，当前为 {{project}} | renderer.js 内 `selectProject:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.noGitTitle` | 当前工作区没有 Git 仓库 | renderer.js 内 `noGitTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.noGitDescription` | 文件浏览和任务仍然可以使用。 | renderer.js 内 `noGitDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.remoteGitUnavailableDescription` | 远程主机未安装 Git。文件浏览、终端和任务仍然可以使用；安装 Git 后重新连接即可启用变更与分支功能。 | renderer.js 内 `remoteGitUnavailableDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.statusUnavailable` | Git 状态暂时无法读取，请稍后重试。 | renderer.js 内 `statusUnavailable:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.reviewUnavailableTitle` | 暂时无法比较变更 | renderer.js 内 `reviewUnavailableTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.reviewUnavailableDescription` | 无法读取所选内容的变更。请选择其他比较目标或稍后重试。 | renderer.js 内 `reviewUnavailableDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.noCommonAncestorDescription` | 所选分支与当前分支没有共同提交。请选择其他分支后重试。 | renderer.js 内 `noCommonAncestorDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.noMatchingChangesTitle` | 没有匹配的变更 | renderer.js 内 `noMatchingChangesTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.noMatchingChangesDescription` | 调整筛选词后再试。 | renderer.js 内 `noMatchingChangesDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.changeTree` | 变更文件树 | renderer.js 内 `changeTree:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.viewDiff` | 查看 {{path}} 的 Diff | renderer.js 内 `viewDiff:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileTreeToggleDirectory` | {{action}}目录 {{path}} | renderer.js 内 `fileTreeToggleDirectory:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.symbolicLink` | Symbolic Link | renderer.js 内 `symbolicLink:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.symbolicLinkUnavailable` | Symbolic Link：目标不存在、无法访问、类型不受支持或链接循环，修复后可重新展开目录。 | renderer.js 内 `symbolicLinkUnavailable:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.symbolicLinkOpenFailed` | 无法打开“{{path}}” | renderer.js 内 `symbolicLinkOpenFailed:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.symbolicLinkOpenFailedDescription` | 软链接目标不存在、无法访问、类型不受支持或存在循环。修复链接后，重新展开所在文件夹。 | renderer.js 内 `symbolicLinkOpenFailedDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.toggleDirectory` | {{action}}目录 {{path}}，{{count}} 个变更 | renderer.js 内 `toggleDirectory:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.collapseDirectory` | 收起 | renderer.js 内 `collapseDirectory:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.expandDirectory` | 展开 | renderer.js 内 `expandDirectory:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.emptyStagedTitle` | 没有已暂存变更 | renderer.js 内 `emptyStagedTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.emptyStagedDescription` | 通过 Git 暂存的文件会显示在这里。 | renderer.js 内 `emptyStagedDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.emptyUncommittedTitle` | 没有未提交变更 | renderer.js 内 `emptyUncommittedTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.emptyUncommittedDescription` | 工作区中的已暂存、未暂存、未跟踪和冲突文件会显示在这里。 | renderer.js 内 `emptyUncommittedDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.emptyCommitTitle` | 这个提交没有文件变更 | renderer.js 内 `emptyCommitTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.emptyCommitDescription` | 请选择另一个提交继续审阅。 | renderer.js 内 `emptyCommitDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.emptyBranchTitle` | 当前工作区与该分支没有差异 | renderer.js 内 `emptyBranchTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.emptyBranchDescription` | 检出其他分支或继续修改文件后再查看。 | renderer.js 内 `emptyBranchDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.emptyTurnTitle` | 本轮没有文件变更 | renderer.js 内 `emptyTurnTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.emptyTurnDescription` | 继续任务并修改文件后，可在这里审阅变更。 | renderer.js 内 `emptyTurnDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.emptySessionTitle` | 当前任务没有文件变更 | renderer.js 内 `emptySessionTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.emptySessionDescription` | 继续任务并修改文件后，可在这里审阅变更。 | renderer.js 内 `emptySessionDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.emptyUnstagedTitle` | 没有未暂存变更 | renderer.js 内 `emptyUnstagedTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.emptyUnstagedDescription` | 工作区中的未暂存、未跟踪和冲突文件会显示在这里。 | renderer.js 内 `emptyUnstagedDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileCount` | {{count}} 个文件 | renderer.js 内 `fileCount:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileCountLoading` | 正在读取文件数量 | renderer.js 内 `fileCountLoading:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.currentBranch` | 当前分支 | renderer.js 内 `currentBranch:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.upstreamBranch` | 上游分支 | renderer.js 内 `upstreamBranch:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commit` | 提交 | renderer.js 内 `commit:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.currentTurn` | 本轮变更 | renderer.js 内 `currentTurn:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.allTurns` | 全部轮次 | renderer.js 内 `allTurns:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.lastTurn` | 最后一轮 | renderer.js 内 `lastTurn:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.rewoundStatus` | 已撤销 | renderer.js 内 `rewoundStatus:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.rewoundStatusDescription` | 这轮文件修改已撤销；当前展示的是原始变更记录。 | renderer.js 内 `rewoundStatusDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.currentSession` | 当前任务 | renderer.js 内 `currentSession:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.beforeChanges` | 变更前 | renderer.js 内 `beforeChanges:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.selectBase` | 选择基线 | renderer.js 内 `selectBase:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.selectBaseLabel` | 选择对比分支，当前为 {{branch}} | renderer.js 内 `selectBaseLabel:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.selectCommit` | 选择提交 | renderer.js 内 `selectCommit:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.selectCommitLabel` | 选择提交，当前为 {{commit}} | renderer.js 内 `selectCommitLabel:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.selectSource` | 选择变更来源，当前为{{source}} | renderer.js 内 `selectSource:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.branch` | 分支 | renderer.js 内 `branch:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.searchBranches` | 搜索分支 | renderer.js 内 `searchBranches:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.noMatchingBranches` | 没有匹配的分支 | renderer.js 内 `noMatchingBranches:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.noCommits` | 没有可用提交 | renderer.js 内 `noCommits:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.noBranches` | 没有可用分支 | renderer.js 内 `noBranches:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileTruncated` | 文件较长，只展示前 {{count}} 行。 | renderer.js 内 `fileTruncated:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileContentTruncated` | 文件内容已截断，部分内容无法显示或搜索。 | renderer.js 内 `fileContentTruncated:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.longLineTruncated` | 文件中存在过长行，已截断显示。 | renderer.js 内 `longLineTruncated:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownVisualEditingLimited` | 此文件超过 10 MiB，可在原文中继续编辑。已有的预览编辑会保留到保存或退出预览。 | renderer.js 内 `markdownVisualEditingLimited:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownTaskCheckbox` | 切换任务完成状态 | renderer.js 内 `markdownTaskCheckbox:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSelectionToolbar.ariaLabel` | Markdown 格式 | renderer.js 内 `ariaLabel:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSelectionToolbar.bold` | 加粗 | renderer.js 内 `bold:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSelectionToolbar.italic` | 斜体 | renderer.js 内 `italic:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSelectionToolbar.strikethrough` | 删除线 | renderer.js 内 `strikethrough:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSelectionToolbar.inlineCode` | 行内代码 | renderer.js 内 `inlineCode:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSelectionToolbar.link` | 链接 | renderer.js 内 `link:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSelectionToolbar.linkAddress` | 链接地址 | renderer.js 内 `linkAddress:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSelectionToolbar.linkPlaceholder` | 粘贴或输入链接 | renderer.js 内 `linkPlaceholder:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSelectionToolbar.applyLink` | 应用链接 | renderer.js 内 `applyLink:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSelectionToolbar.removeLink` | 移除链接 | renderer.js 内 `removeLink:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSelectionToolbar.cancelLink` | 取消 | renderer.js 内 `cancelLink:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSelectionToolbar.quote` | 引用 | renderer.js 内 `quote:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSelectionToolbar.unorderedList` | 无序列表 | renderer.js 内 `unorderedList:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.markdownSelectionToolbar.orderedList` | 有序列表 | renderer.js 内 `orderedList:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.diffTruncated` | Diff 较长，当前只展示有限内容。 | renderer.js 内 `diffTruncated:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.unchangedLines` | {{count}} 行未修改 | renderer.js 内 `unchangedLines:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.changeChunk` | 变更片段 | renderer.js 内 `changeChunk:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.binaryDiff` | 二进制文件已发生变化，无法显示文本 Diff。 | renderer.js 内 `binaryDiff:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.renamedDiff` | 文件路径已变化，没有文本内容变更。 | renderer.js 内 `renamedDiff:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.emptyTextDiff` | 这个变更没有可展示的文本内容。 | renderer.js 内 `emptyTextDiff:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.mergeConflict` | 文件存在合并冲突 | renderer.js 内 `mergeConflict:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.moreActions` | 更多审阅操作 | renderer.js 内 `moreActions:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.view` | 视图 | renderer.js 内 `view:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.stackedView` | 堆叠 | renderer.js 内 `stackedView:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.splitDiffView` | 拆分 | renderer.js 内 `splitDiffView:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.showWhitespaceOnlyChanges` | 显示仅空白变更 | renderer.js 内 `showWhitespaceOnlyChanges:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.hideWhitespaceOnlyChanges` | 隐藏仅空白变更 | renderer.js 内 `hideWhitespaceOnlyChanges:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.refreshChanges` | 刷新变更 | renderer.js 内 `refreshChanges:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.collapseAll` | 收起全部文件变更 | renderer.js 内 `collapseAll:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.expandAll` | 展开全部文件变更 | renderer.js 内 `expandAll:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.jumpToFile` | 跳转到文件 | renderer.js 内 `jumpToFile:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.jumpToFilePlaceholder` | 跳转到文件… | renderer.js 内 `jumpToFilePlaceholder:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.jumpToFileList` | 可跳转的变更文件 | renderer.js 内 `jumpToFileList:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.jumpToFileEmpty` | 没有匹配的变更文件 | renderer.js 内 `jumpToFileEmpty:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.collapseFileDiff` | 收起 {{path}} 的变更 | renderer.js 内 `collapseFileDiff:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.expandFileDiff` | 展开 {{path}} 的变更 | renderer.js 内 `expandFileDiff:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.openFileInWorkspace` | 在工作区打开 {{path}} | renderer.js 内 `openFileInWorkspace:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.openInCode` | 在“代码”中打开 | renderer.js 内 `openInCode:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.deletedFileUnavailable` | 文件已删除，无法在工作区打开 | renderer.js 内 `deletedFileUnavailable:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.splitView` | 切换到拆分差异视图 | renderer.js 内 `splitView:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.unifiedView` | 切换到统一差异视图 | renderer.js 内 `unifiedView:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.showFiles` | 显示文件 | renderer.js 内 `showFiles:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.hideFiles` | 隐藏文件 | renderer.js 内 `hideFiles:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.resizeWorkspace` | 调整任务与工作区宽度 | renderer.js 内 `resizeWorkspace:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.resizeReviewSidebar` | 调整审阅内容与变更文件树宽度 | renderer.js 内 `resizeReviewSidebar:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.resizeFileSidebar` | 调整编辑器与文件树宽度 | renderer.js 内 `resizeFileSidebar:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitOrPush` | 提交或推送 | renderer.js 内 `commitOrPush:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.createPullRequest` | 创建拉取请求 | renderer.js 内 `createPullRequest:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.unavailable` | 暂不可用 | renderer.js 内 `unavailable:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.stageFile` | 暂存文件 | renderer.js 内 `stageFile:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.unstageFile` | 取消暂存文件 | renderer.js 内 `unstageFile:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.revertFile` | 撤销文件变更 | renderer.js 内 `revertFile:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.stageAll` | 全部暂存 | renderer.js 内 `stageAll:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.unstageAll` | 全部取消暂存 | renderer.js 内 `unstageAll:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.revertAll` | 全部撤销 | renderer.js 内 `revertAll:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileStaged` | 文件已暂存 | renderer.js 内 `fileStaged:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileUnstaged` | 文件已取消暂存 | renderer.js 内 `fileUnstaged:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.fileReverted` | 文件变更已撤销 | renderer.js 内 `fileReverted:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.allFilesStaged` | 所有文件已暂存 | renderer.js 内 `allFilesStaged:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.allFilesUnstaged` | 所有文件已取消暂存 | renderer.js 内 `allFilesUnstaged:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.allFilesReverted` | 所有文件变更已撤销 | renderer.js 内 `allFilesReverted:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.revertTitle` | 撤销 {{count}} 个文件的变更？ | renderer.js 内 `revertTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.revertDescription` | 已跟踪文件会恢复到当前提交；未跟踪的新文件会被删除。此操作无法撤销。 | renderer.js 内 `revertDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.revertAction` | 撤销变更 | renderer.js 内 `revertAction:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitOperationFailed` | Git 操作失败 | renderer.js 内 `gitOperationFailed:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorNotFound` | 系统中未找到 Git。 | renderer.js 内 `gitErrorNotFound:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorNotRepository` | 所选目录不是 Git 仓库。 | renderer.js 内 `gitErrorNotRepository:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorStaleRepository` | 仓库状态已变化，请刷新后重试。 | renderer.js 内 `gitErrorStaleRepository:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorDirtyWorktree` | 当前改动会阻止此操作，请先提交或暂存改动。 | renderer.js 内 `gitErrorDirtyWorktree:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorConflict` | Git 操作产生了冲突，请解决冲突后重试。 | renderer.js 内 `gitErrorConflict:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorOutputLimit` | Git 生成的内容过多，请缩小操作范围后重试。 | renderer.js 内 `gitErrorOutputLimit:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorRepositoryLocked` | 仓库正被另一个 Git 进程占用，请稍后重试。 | renderer.js 内 `gitErrorRepositoryLocked:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorInvalidArgument` | Git 操作参数无效。 | renderer.js 内 `gitErrorInvalidArgument:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorInvalidRef` | 所选分支或引用已失效，请刷新后重试。 | renderer.js 内 `gitErrorInvalidRef:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorBranchExists` | 该分支已存在。 | renderer.js 内 `gitErrorBranchExists:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorBranchInUse` | 该分支已被另一个 Worktree 使用。 | renderer.js 内 `gitErrorBranchInUse:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorNothingToCommit` | 没有可提交的变更。 | renderer.js 内 `gitErrorNothingToCommit:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorIdentityMissing` | 尚未配置 Git 用户名或邮箱。 | renderer.js 内 `gitErrorIdentityMissing:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorNoRemote` | 仓库没有可用的远端。 | renderer.js 内 `gitErrorNoRemote:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorNoUpstream` | 当前分支没有上游分支。 | renderer.js 内 `gitErrorNoUpstream:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorAuthRequired` | Git 远端认证失败，请检查凭证。 | renderer.js 内 `gitErrorAuthRequired:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorRemoteUnreachable` | 无法连接 Git 远端，请检查网络后重试。 | renderer.js 内 `gitErrorRemoteUnreachable:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorNonFastForward` | 远端包含本地尚未同步的提交，请先同步后重试。 | renderer.js 内 `gitErrorNonFastForward:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorWorktreeExists` | 目标 Worktree 已存在。 | renderer.js 内 `gitErrorWorktreeExists:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorWorktreeDirty` | Worktree 中仍有未提交改动。 | renderer.js 内 `gitErrorWorktreeDirty:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorOwnerMismatch` | 当前执行位置不是该仓库的操作方。 | renderer.js 内 `gitErrorOwnerMismatch:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorCancelled` | Git 操作已取消。 | renderer.js 内 `gitErrorCancelled:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorTimeout` | Git 操作超时，请检查仓库或网络状态后重试。 | renderer.js 内 `gitErrorTimeout:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorUnsupported` | 当前执行位置暂不支持此 Git 操作。 | renderer.js 内 `gitErrorUnsupported:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.gitErrorUnknown` | Git 操作未完成，请刷新后重试。 | renderer.js 内 `gitErrorUnknown:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.tryAgain` | 请稍后重试。 | renderer.js 内 `tryAgain:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.projectRequired` | 请先选择一个项目。 | renderer.js 内 `projectRequired:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.sessionUnavailable` | 当前任务不可用。 | renderer.js 内 `sessionUnavailable:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitMessageRequired` | 请输入提交说明。 | renderer.js 内 `commitMessageRequired:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitRepositoryDescription` | 提交 {{repository}} 中的变更。 | renderer.js 内 `commitRepositoryDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.selectProjectBeforeCommit` | 请先在审阅工具栏中选择一个项目，再提交或推送。 | renderer.js 内 `selectProjectBeforeCommit:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.detachedHead` | 分离的 HEAD | renderer.js 内 `detachedHead:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.newBranch` | 新建分支 | renderer.js 内 `newBranch:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.newBranchName` | 新分支名称 | renderer.js 内 `newBranchName:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.newBranchPlaceholder` | 例如 feat/review-panel | renderer.js 内 `newBranchPlaceholder:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitMessage` | 提交说明 | renderer.js 内 `commitMessage:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitMessagePlaceholder` | 输入提交说明（留空则由 AI 生成）… | renderer.js 内 `commitMessagePlaceholder:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.generatingCommitMessage` | 正在生成提交说明，可能需要一些时间… | renderer.js 内 `generatingCommitMessage:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitMessageGenerationFailed` | 无法生成提交说明 | renderer.js 内 `commitMessageGenerationFailed:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitMessageBusy` | 已有提交说明正在生成，请稍后重试。 | renderer.js 内 `commitMessageBusy:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitMessageContextTimeout` | 读取变更超时，请缩小变更范围后重试。 | renderer.js 内 `commitMessageContextTimeout:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitMessageContextTooLarge` | 变更范围过大，无法安全生成提交说明。请缩小范围或手动输入。 | renderer.js 内 `commitMessageContextTooLarge:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitMessageContextUnavailable` | 无法读取当前变更，请刷新后重试。 | renderer.js 内 `commitMessageContextUnavailable:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitMessageEmptyResponse` | 模型未返回可用的提交说明，请重试或手动输入。 | renderer.js 内 `commitMessageEmptyResponse:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitMessageModelTimeout` | 生成提交说明超时，请重试或手动输入。 | renderer.js 内 `commitMessageModelTimeout:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitMessageModelUnavailable` | 暂时无法生成提交说明，请重试或手动输入。 | renderer.js 内 `commitMessageModelUnavailable:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.includeUnstaged` | 包含未暂存变更 | renderer.js 内 `includeUnstaged:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitAction` | 提交 | renderer.js 内 `commitAction:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitAndPush` | 提交并推送 | renderer.js 内 `commitAndPush:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.pushAction` | 推送 | renderer.js 内 `pushAction:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.working` | 正在执行… | renderer.js 内 `working:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitSucceeded` | 提交成功 | renderer.js 内 `commitSucceeded:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitPushSucceeded` | 提交并推送成功 | renderer.js 内 `commitPushSucceeded:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.commitSucceededPushFailed` | 提交成功，但推送失败 | renderer.js 内 `commitSucceededPushFailed:"…"`（workspaceResources 的 zh 段） |
| `workspace.review.pushSucceeded` | 推送成功 | renderer.js 内 `pushSucceeded:"…"`（workspaceResources 的 zh 段） |

### `workspaceSearch.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `workspaceSearch.title` | 搜索 Workspace 任务 | renderer.js 内 `title:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.description` | 搜索任务标题、会话 ID 以及你和 Qoder 的消息内容。 | renderer.js 内 `description:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.inputLabel` | 搜索所有任务 | renderer.js 内 `inputLabel:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.placeholder` | 搜索任务标题、内容或会话 ID… | renderer.js 内 `placeholder:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.clear` | 清除搜索 | renderer.js 内 `clear:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.allSessions` | 所有任务 | renderer.js 内 `allSessions:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.recent` | 最近任务 | renderer.js 内 `recent:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.results` | 搜索结果 | renderer.js 内 `results:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.count` | {{count}} 个 | renderer.js 内 `count:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.selectHint` | 选择 | renderer.js 内 `selectHint:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.openHint` | 打开 | renderer.js 内 `openHint:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.searching` | 正在搜索… | renderer.js 内 `searching:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.empty` | 没有找到匹配的任务 | renderer.js 内 `empty:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.emptyDescription` | 请尝试其他标题、内容关键词或会话 ID。 | renderer.js 内 `emptyDescription:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.failed` | 搜索暂时不可用，请重试。 | renderer.js 内 `failed:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.retry` | 重试 | renderer.js 内 `retry:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.close` | 关闭搜索 | renderer.js 内 `close:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.noWorkspace` | 无 Workspace | renderer.js 内 `noWorkspace:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.role.user` | 你 | renderer.js 内 `user:"…"`（workspaceResources 的 zh 段） |
| `workspaceSearch.role.assistant` | Qoder | renderer.js 内 `assistant:"…"`（workspaceResources 的 zh 段） |

## 6 计划与待办（To-do / Spec / Goal）

_条目数：68_

### `chatSession.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatSession.panes.emptyTitle` | 空窗格 | renderer.js 内 `emptyTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.panes.emptyDescription` | 从侧栏拖入一个任务，在此打开。 | renderer.js 内 `emptyDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.panes.moreActions` | 窗格操作 | renderer.js 内 `moreActions:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.panes.splitRight` | 向右拆分 | renderer.js 内 `splitRight:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.panes.splitDown` | 向下拆分 | renderer.js 内 `splitDown:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.panes.maximize` | 最大化窗格 | renderer.js 内 `maximize:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.panes.restore` | 还原窗格 | renderer.js 内 `restore:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.panes.close` | 关闭窗格 | renderer.js 内 `close:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.panes.resizeWidth` | 调整窗格宽度 | renderer.js 内 `resizeWidth:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.panes.resizeHeight` | 调整窗格高度 | renderer.js 内 `resizeHeight:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.panes.resizeJunction` | 联动调整相邻窗格 | renderer.js 内 `resizeJunction:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.active` | 目标 | renderer.js 内 `active:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.completed` | 已完成的目标 | renderer.js 内 `completed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.paused` | 已暂停的目标 | renderer.js 内 `paused:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.blocked` | 已阻塞的目标 | renderer.js 内 `blocked:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.usageLimited` | 用量受限的目标 | renderer.js 内 `usageLimited:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.budgetLimited` | 预算受限的目标 | renderer.js 内 `budgetLimited:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.edit` | 编辑目标 | renderer.js 内 `edit:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.pause` | 暂停目标 | renderer.js 内 `pause:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.resume` | 恢复目标 | renderer.js 内 `resume:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.delete` | 删除目标 | renderer.js 内 `delete:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.editTitle` | 编辑目标 | renderer.js 内 `editTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.editTextarea` | 目标内容 | renderer.js 内 `editTextarea:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.elapsed` | 已持续 {{duration}} | renderer.js 内 `elapsed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.durationSeconds` | {{seconds}}秒 | renderer.js 内 `durationSeconds:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.durationMinutesSeconds` | {{minutes}}分{{seconds}}秒 | renderer.js 内 `durationMinutesSeconds:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.durationHoursMinutesSeconds` | {{hours}}小时{{minutes}}分{{seconds}}秒 | renderer.js 内 `durationHoursMinutesSeconds:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.goal.commandFailed` | 目标操作失败 | renderer.js 内 `commandFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.specArtifact.title` | 计划 | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.specArtifact.documentTitle` | 计划 | renderer.js 内 `documentTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.specArtifact.planTabsLabel` | 计划版本 | renderer.js 内 `planTabsLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.specArtifact.emptyTitle` | 还没有计划产物 | renderer.js 内 `emptyTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.specArtifact.emptyDescription` | 完成规划后，生成的计划会显示在这里。 | renderer.js 内 `emptyDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.specArtifact.unavailableTitle` | 计划内容不可用 | renderer.js 内 `unavailableTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.specArtifact.unavailableDescription` | Qoder 已收到计划确认请求，但无法读取计划文件内容。 | renderer.js 内 `unavailableDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.specArtifact.openFile` | 打开文件 | renderer.js 内 `openFile:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.specArtifact.status` | 状态：{{status}} | renderer.js 内 `status:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.specArtifact.statuses.pending` | 待确认 | renderer.js 内 `pending:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.specArtifact.statuses.approved` | 已批准 | renderer.js 内 `approved:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.specArtifact.statuses.accepted` | 已接受 | renderer.js 内 `accepted:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.specArtifact.feedback` | 反馈 | renderer.js 内 `feedback:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.specArtifact.edited` | 已编辑 | renderer.js 内 `edited:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.specArtifact.notEdited` | 未编辑 | renderer.js 内 `notEdited:"…"`（chatSessionResources 的 zh 段） |

### `chatStep.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatStep.progress` | 步骤 {{completed}} / {{total}} | renderer.js 内 `progress:"…"`（chatSessionResources 的 zh 段） |
| `chatStep.openDetails` | 查看步骤详情，已完成 {{completed}} 个，共 {{total}} 个；当前第 {{current}} 个 | renderer.js 内 `openDetails:"…"`（chatSessionResources 的 zh 段） |
| `chatStep.details` | 步骤详情 | renderer.js 内 `details:"…"`（chatSessionResources 的 zh 段） |
| `chatStep.itemLabel` | {{subject}}，{{status}} | renderer.js 内 `itemLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatStep.status.pending` | 待处理 | renderer.js 内 `pending:"…"`（chatSessionResources 的 zh 段） |
| `chatStep.status.in_progress` | 处理中 | renderer.js 内 `in_progress:"…"`（chatSessionResources 的 zh 段） |
| `chatStep.status.completed` | 已完成 | renderer.js 内 `completed:"…"`（chatSessionResources 的 zh 段） |
| `chatStep.status.blocked` | 已阻塞 | renderer.js 内 `blocked:"…"`（chatSessionResources 的 zh 段） |

### `composer.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `composer.actions.goal` | 目标 | renderer.js 内 `goal:"…"`（newChatResources 的 zh 段） |
| `composer.actions.plan` | 计划 | renderer.js 内 `plan:"…"`（newChatResources 的 zh 段） |
| `composer.execution.goal.active` | 目标 | renderer.js 内 `active:"…"`（newChatResources 的 zh 段） |
| `composer.execution.goal.completed` | 已完成的目标 | renderer.js 内 `completed:"…"`（newChatResources 的 zh 段） |
| `composer.execution.goal.close` | 关闭目标模式 | renderer.js 内 `close:"…"`（newChatResources 的 zh 段） |
| `composer.execution.goal.unavailable` | 实时语音任务不支持目标模式。 | renderer.js 内 `unavailable:"…"`（newChatResources 的 zh 段） |
| `composer.execution.spec.active` | 计划 | renderer.js 内 `active:"…"`（newChatResources 的 zh 段） |
| `composer.execution.spec.close` | 关闭计划模式 | renderer.js 内 `close:"…"`（newChatResources 的 zh 段） |

### `newChat.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `newChat.description` | 选择工作目录后向 Default Agent 发起任务；同一任务会持续保留上下文。 | renderer.js 内 `description:"…"`（newChatResources 的 zh 段） |
| `newChat.placeholder` | 一切从这里开始.... | renderer.js 内 `placeholder:"…"`（newChatResources 的 zh 段） |
| `newChat.emptyPromptError` | 请输入消息后再开始任务。 | renderer.js 内 `emptyPromptError:"…"`（newChatResources 的 zh 段） |
| `newChat.noWorkDirectory` | 未选择工作目录 | renderer.js 内 `noWorkDirectory:"…"`（newChatResources 的 zh 段） |
| `newChat.start` | 开始工作 | renderer.js 内 `start:"…"`（newChatResources 的 zh 段） |
| `newChat.success` | 成功标准 | renderer.js 内 `success:"…"`（newChatResources 的 zh 段） |
| `newChat.constraints` | 约束 | renderer.js 内 `constraints:"…"`（newChatResources 的 zh 段） |
| `newChat.selectWorkDirectory` | 选择工作目录 | renderer.js 内 `selectWorkDirectory:"…"`（newChatResources 的 zh 段） |
| `newChat.addFolder` | 添加文件夹 | renderer.js 内 `addFolder:"…"`（newChatResources 的 zh 段） |

## 7 子代理 / 专家并行 / 团队

_条目数：154_

### `agentTeam.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `agentTeam.qoderAgentName` | Qoder | renderer.js 内 `qoderAgentName:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.openRoster` | 查看团队 {{name}} | renderer.js 内 `openRoster:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.memberCount` | {{count}} 名成员 | renderer.js 内 `memberCount:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.leader` | 队长 | renderer.js 内 `leader:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.member` | 队员 | renderer.js 内 `member:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.currentSession` | 当前会话 | renderer.js 内 `currentSession:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.currentMember` | {{name}}，当前会话 | renderer.js 内 `currentMember:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.openSession` | 打开 {{name}} 的会话 | renderer.js 内 `openSession:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.unavailable` | 会话暂不可用 | renderer.js 内 `unavailable:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.loadFailed` | 团队状态暂时无法加载，运行中的会话不受影响。 | renderer.js 内 `loadFailed:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.cancel` | 停止整个团队 | renderer.js 内 `cancel:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.retryCancel` | 重试停止未确认成员 | renderer.js 内 `retryCancel:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.cancelling` | 正在停止团队 | renderer.js 内 `cancelling:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.cancelTitle` | 停止整个团队？ | renderer.js 内 `cancelTitle:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.cancelDescription` | 这会停止团队所有成员当前和排队中的工作。已有会话和记录会保留。 | renderer.js 内 `cancelDescription:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.cancelConfirm` | 停止整个团队 | renderer.js 内 `cancelConfirm:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.cancelCompleted` | 已停止团队 {{name}} | renderer.js 内 `cancelCompleted:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.cancelPartial` | 团队已标记为停止，但有 {{count}} 个成员尚未确认停止。可稍后重试。 | renderer.js 内 `cancelPartial:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.cancelPending` | 仍有 {{count}} 个成员尚未确认停止，应用会自动重试。 | renderer.js 内 `cancelPending:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.cancelFailed` | 团队未能停止，运行状态已刷新。可重试此操作。 | renderer.js 内 `cancelFailed:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.status.not_started` | 未启动 | renderer.js 内 `not_started:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.status.queued` | 排队中 | renderer.js 内 `queued:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.status.running` | 工作中 | renderer.js 内 `running:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.status.waiting` | 等待响应 | renderer.js 内 `waiting:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.status.terminal` | 已结束 | renderer.js 内 `terminal:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.executionStatus.active` | 运行中 | renderer.js 内 `active:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.executionStatus.cancelled` | 已停止 | renderer.js 内 `cancelled:"…"`（chatSessionResources 的 zh 段） |
| `agentTeam.executionStatus.failed` | 运行失败 | renderer.js 内 `failed:"…"`（chatSessionResources 的 zh 段） |

### `agentWorkspaces.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `agentWorkspaces.executionStatus.queued` | 排队中 | renderer.js 内 `queued:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.executionStatus.running` | 执行中 | renderer.js 内 `running:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.executionStatus.completed` | 已完成 | renderer.js 内 `completed:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.executionStatus.failed` | 失败 | renderer.js 内 `failed:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.executionStatus.cancelled` | 已取消 | renderer.js 内 `cancelled:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.projectHint` | 仅用于当前项目中的此 Agent 或 Team 成员。 | renderer.js 内 `projectHint:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.activeExecution` | 存在未完成任务，暂时无法移除或关闭。请等待任务结束后重试。 | renderer.js 内 `activeExecution:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.chooseExecutor` | 选择执行者 | renderer.js 内 `chooseExecutor:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.execute` | 指派执行 | renderer.js 内 `execute:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.noExecutors` | 暂无可调用的本人 Agent。请先在 Project 中加入 Agent 或 Team。 | renderer.js 内 `noExecutors:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.executionFailed` | 无法执行。请检查权限、在线状态或未完成任务后重试。 | renderer.js 内 `executionFailed:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.title` | 工作区 | renderer.js 内 `title:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.defaultFolders` | 默认文件夹 | renderer.js 内 `defaultFolders:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.manage` | 管理文件夹 | renderer.js 内 `manage:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.profileHint` | Agent 默认文件夹，群内配置优先。 | renderer.js 内 `profileHint:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.discussionHint` | 仅用于当前群，留空则使用 Agent 默认文件夹。 | renderer.js 内 `discussionHint:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.sessionHint` | 后续执行生效，不撤销当前会话已有访问权限。 | renderer.js 内 `sessionHint:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.deviceHint` | 最多 16 个文件夹，路径须在执行设备上可用。 | renderer.js 内 `deviceHint:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.createFirst` | 保存 Agent 后可配置默认文件夹。 | renderer.js 内 `createFirst:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.readOnly` | 此群已归档，工作区配置仅可查看。 | renderer.js 内 `readOnly:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.loading` | 正在读取工作区配置… | renderer.js 内 `loading:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.empty` | 尚未配置文件夹。 | renderer.js 内 `empty:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.folder` | 文件夹 {{index}} | renderer.js 内 `folder:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.placeholder` | 输入执行设备上的文件夹路径 | renderer.js 内 `placeholder:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.manualPath` | 手动输入路径 | renderer.js 内 `manualPath:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.manualPlaceholder` | 输入文件夹路径，按 Enter 添加 | renderer.js 内 `manualPlaceholder:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.add` | 手工添加 | renderer.js 内 `add:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.pick` | 选择本机文件夹 | renderer.js 内 `pick:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.up` | 上移 | renderer.js 内 `up:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.down` | 下移 | renderer.js 内 `down:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.remove` | 移除 | renderer.js 内 `remove:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.upLabel` | 上移文件夹 {{index}} | renderer.js 内 `upLabel:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.downLabel` | 下移文件夹 {{index}} | renderer.js 内 `downLabel:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.removeLabel` | 移除文件夹 {{index}} | renderer.js 内 `removeLabel:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.loadFailed` | 暂时无法读取配置。请确认仍拥有此 Agent 及群访问权限后重试。 | renderer.js 内 `loadFailed:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.saveFailed` | 未能确认配置已保存，草稿已保留。请重新读取配置后再保存。 | renderer.js 内 `saveFailed:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.conflict` | 配置已在其他位置修改。已读取最新版本并保留你的草稿；请核对后再保存，或使用最新配置。 | renderer.js 内 `conflict:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.invalid` | 每条路径须为 1–4096 个字符，不能包含空字符；最多 16 条，请求总大小不超过 128 KiB。 | renderer.js 内 `invalid:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.unregistered` | 此 Agent 尚未完成云端登记。请先启用 Agent，待登记完成后重试。 | renderer.js 内 `unregistered:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.pickFailed` | 未能选择文件夹，请重试或手工输入。 | renderer.js 内 `pickFailed:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.reload` | 重新读取 | renderer.js 内 `reload:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.useLatest` | 使用最新配置 | renderer.js 内 `useLatest:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.discardHint` | 有未保存的修改。是否放弃草稿？ | renderer.js 内 `discardHint:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.keepEditing` | 继续编辑 | renderer.js 内 `keepEditing:"…"`（agentWorkspacesResources 的 zh 段） |
| `agentWorkspaces.discard` | 放弃修改 | renderer.js 内 `discard:"…"`（agentWorkspacesResources 的 zh 段） |

### `chatSession.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatSession.backgroundAgents.open` | 查看后台子智能体，{{count}} 个运行中 | renderer.js 内 `open:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.title` | 子智能体 | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.description` | 后台子智能体可在主回复结束后继续工作。 | renderer.js 内 `description:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.result` | 后台任务结果 | renderer.js 内 `result:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.resultFrom` | 后台任务结果 · {{name}} | renderer.js 内 `resultFrom:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.intermediateResponse` | 阶段性回复 | renderer.js 内 `intermediateResponse:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.quotedIntermediate` | 引用阶段性回复 | renderer.js 内 `quotedIntermediate:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.jumpToIntermediateResponse` | 跳转到这条阶段性回复 | renderer.js 内 `jumpToIntermediateResponse:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.active` | 运行中 · {{count}} | renderer.js 内 `active:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.done` | 已结束 · {{count}} | renderer.js 内 `done:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.usingTool` | 正在使用 {{tool}} | renderer.js 内 `usingTool:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.pause` | 暂停 | renderer.js 内 `pause:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.pausing` | 正在暂停 | renderer.js 内 `pausing:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.pauseUnavailable` | 无法暂停 | renderer.js 内 `pauseUnavailable:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.pauseFailed` | 未能暂停这个后台子智能体，请稍后重试。 | renderer.js 内 `pauseFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.stop` | 停止 | renderer.js 内 `stop:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.stopping` | 正在停止 | renderer.js 内 `stopping:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.stopUnavailable` | 无法停止 | renderer.js 内 `stopUnavailable:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.stopFailed` | 未能停止这个后台子智能体，请稍后重试。 | renderer.js 内 `stopFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.workspaceLabel` | 子智能体 {{name}} | renderer.js 内 `workspaceLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.openWorkspace` | 打开子智能体 | renderer.js 内 `openWorkspace:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.contentLoadingTitle` | 子智能体正在工作 | renderer.js 内 `contentLoadingTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.contentLoadingDescription` | 执行过程会在这里持续更新。 | renderer.js 内 `contentLoadingDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.contentUnavailableTitle` | 子智能体内容不可用 | renderer.js 内 `contentUnavailableTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.contentUnavailableDescription` | 这个子智能体已结束，且没有可展示的执行内容。 | renderer.js 内 `contentUnavailableDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.status.pending` | 等待中 | renderer.js 内 `pending:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.status.running` | 运行中 | renderer.js 内 `running:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.status.paused` | 已暂停 | renderer.js 内 `paused:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.status.completed` | 已完成 | renderer.js 内 `completed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.status.failed` | 失败 | renderer.js 内 `failed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.backgroundAgents.status.stopped` | 已停止 | renderer.js 内 `stopped:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.openTeamMemberSession` | 打开 {{name}} 的会话 | renderer.js 内 `openTeamMemberSession:"…"`（chatSessionResources 的 zh 段） |

### `linkedSessions.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `linkedSessions.agentActivity` | Agent 执行活动 | renderer.js 内 `agentActivity:"…"`（chatSessionResources 的 zh 段） |
| `linkedSessions.agentActivityDescription` | 查看此 Issue 下主任务与成员任务的执行状态。 | renderer.js 内 `agentActivityDescription:"…"`（chatSessionResources 的 zh 段） |
| `linkedSessions.leader` | Leader | renderer.js 内 `leader:"…"`（chatSessionResources 的 zh 段） |
| `linkedSessions.member` | 成员 | renderer.js 内 `member:"…"`（chatSessionResources 的 zh 段） |
| `linkedSessions.viewExecution` | 查看执行 | renderer.js 内 `viewExecution:"…"`（chatSessionResources 的 zh 段） |
| `linkedSessions.needsAction` | 需要处理 | renderer.js 内 `needsAction:"…"`（chatSessionResources 的 zh 段） |
| `linkedSessions.running` | 执行中 | renderer.js 内 `running:"…"`（chatSessionResources 的 zh 段） |
| `linkedSessions.interrupted` | 已中断 | renderer.js 内 `interrupted:"…"`（chatSessionResources 的 zh 段） |
| `linkedSessions.ready` | 就绪 | renderer.js 内 `ready:"…"`（chatSessionResources 的 zh 段） |
| `linkedSessions.updated` | 有更新 | renderer.js 内 `updated:"…"`（chatSessionResources 的 zh 段） |
| `linkedSessions.backToMain` | 返回主任务 | renderer.js 内 `backToMain:"…"`（chatSessionResources 的 zh 段） |
| `linkedSessions.linkedExecution` | 关联执行 | renderer.js 内 `linkedExecution:"…"`（chatSessionResources 的 zh 段） |
| `linkedSessions.participants` | 成员任务 | renderer.js 内 `participants:"…"`（chatSessionResources 的 zh 段） |
| `linkedSessions.openFailedTitle` | 无法打开成员任务 | renderer.js 内 `openFailedTitle:"…"`（chatSessionResources 的 zh 段） |
| `linkedSessions.openFailedDescription` | 成员任务历史暂时不可用，请稍后重试。 | renderer.js 内 `openFailedDescription:"…"`（chatSessionResources 的 zh 段） |

### `settings.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `settings.subagents.title` | 智能体 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.description` | 查看本机已安装的智能体，包括用户级配置和已启用插件提供的能力。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.refresh` | 刷新 | renderer.js 内 `refresh:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.installedSection` | 已安装的智能体 | renderer.js 内 `installedSection:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.localSection` | 本地智能体 | renderer.js 内 `localSection:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.pluginSection` | 由 Plugin 提供 | renderer.js 内 `pluginSection:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.loading` | 正在读取智能体 | renderer.js 内 `loading:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.loadingDescription` | 正在读取用户级配置和已启用插件提供的智能体。 | renderer.js 内 `loadingDescription:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.loadErrorTitle` | 无法读取已安装的智能体 | renderer.js 内 `loadErrorTitle:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.loadErrorDescription` | 当前安装状态无法确认。请检查 ~/{{configDirectory}}/agents 目录权限后重试。 | renderer.js 内 `loadErrorDescription:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.pluginLoadWarning` | 暂时无法读取插件提供的智能体；本地智能体仍可使用。 | renderer.js 内 `pluginLoadWarning:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.emptyTitle` | 暂无已安装的智能体 | renderer.js 内 `emptyTitle:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.emptyDescription` | 用户级配置和已启用插件提供的智能体会显示在这里。 | renderer.js 内 `emptyDescription:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.noDescription` | 这个智能体暂时没有说明。 | renderer.js 内 `noDescription:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.providedByPlugin` | 由 {{name}} 提供 | renderer.js 内 `providedByPlugin:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.openDetail` | 查看 {{name}} 详情 | renderer.js 内 `openDetail:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.back` | 返回 | renderer.js 内 `back:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.localSource` | 本地智能体 | renderer.js 内 `localSource:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.retry` | 重试 | renderer.js 内 `retry:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.refreshDetail` | 刷新“{{name}}” | renderer.js 内 `refreshDetail:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.refreshFailed` | 无法刷新“{{name}}”，已保留当前内容。 | renderer.js 内 `refreshFailed:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.detailLoadErrorTitle` | 无法读取智能体详情 | renderer.js 内 `detailLoadErrorTitle:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.detailLoadErrorDescription` | 该智能体的本地文件暂时无法读取，请重试。 | renderer.js 内 `detailLoadErrorDescription:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.previewTruncated` | 指令内容较大，这里只展示前 512KB。本地文件没有被修改。 | renderer.js 内 `previewTruncated:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.properties` | 属性 | renderer.js 内 `properties:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.instructions` | 智能体指令 | renderer.js 内 `instructions:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.instructionsEmpty` | 这个智能体暂时没有指令正文。 | renderer.js 内 `instructionsEmpty:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.delete` | 删除智能体 | renderer.js 内 `delete:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.deleting` | 正在删除… | renderer.js 内 `deleting:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.deleteTitle` | 删除“{{name}}”？ | renderer.js 内 `deleteTitle:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.deleteDescription` | 该智能体将从 ~/{{configDirectory}}/agents 中移除。此操作无法撤销。 | renderer.js 内 `deleteDescription:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.deleteSuccess` | 已删除智能体“{{name}}”。 | renderer.js 内 `deleteSuccess:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.deleteFailed` | 智能体“{{name}}”没有删除，请稍后重试。 | renderer.js 内 `deleteFailed:"…"`（settingsResources 的 zh 段） |
| `settings.subagents.cancel` | 取消 | renderer.js 内 `cancel:"…"`（settingsResources 的 zh 段） |

## 8 审批与权限（含高危操作 / 规则建议 / ExitPlanMode）

_条目数：224_

### `acceptEdits.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `acceptEdits` | 询问审批 | renderer.js 内 `acceptEdits:"…"`（permissionModeLabels 的 zh 段） |

### `allow.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `allow` | 允许 | renderer.js 内 `allow:"…"`（permissionResources 的 zh 段） |

### `allowOnce.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `allowOnce` | 允许一次 | renderer.js 内 `allowOnce:"…"`（permissionResources 的 zh 段） |

### `analyzingIntent.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `analyzingIntent` | 正在分析操作意图... | renderer.js 内 `analyzingIntent:"…"`（permissionResources 的 zh 段） |

### `attention.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `attention.title` | Attention | renderer.js 内 `title:"…"`（collaborationResources 的 zh 段） |
| `attention.description` | 只有无法继续推进的判断、请求和最终验收会出现在这里。 | renderer.js 内 `description:"…"`（collaborationResources 的 zh 段） |
| `attention.all` | 全部 | renderer.js 内 `all:"…"`（collaborationResources 的 zh 段） |
| `attention.clarification` | 判断与请求 | renderer.js 内 `clarification:"…"`（collaborationResources 的 zh 段） |
| `attention.review` | 结果验收 | renderer.js 内 `review:"…"`（collaborationResources 的 zh 段） |
| `attention.collaboration` | 协作 | renderer.js 内 `collaboration:"…"`（collaborationResources 的 zh 段） |
| `attention.overdue` | 已过期 | renderer.js 内 `overdue:"…"`（collaborationResources 的 zh 段） |
| `attention.emptyTitle` | 目前没有需要你处理的事项 | renderer.js 内 `emptyTitle:"…"`（collaborationResources 的 zh 段） |
| `attention.emptyDescription` | Agent 可以继续工作，没有任务正在等待你的判断。 | renderer.js 内 `emptyDescription:"…"`（collaborationResources 的 zh 段） |
| `attention.blocking` | 阻塞中 | renderer.js 内 `blocking:"…"`（collaborationResources 的 zh 段） |
| `attention.requested` | 等待处理 | renderer.js 内 `requested:"…"`（collaborationResources 的 zh 段） |
| `attention.waitingForMe` | 等我判断 | renderer.js 内 `waitingForMe:"…"`（collaborationResources 的 zh 段） |
| `attention.whyNow` | 为什么现在 | renderer.js 内 `whyNow:"…"`（collaborationResources 的 zh 段） |
| `attention.whyYou` | 为什么找我 | renderer.js 内 `whyYou:"…"`（collaborationResources 的 zh 段） |
| `attention.recommendation` | Agent 建议 | renderer.js 内 `recommendation:"…"`（collaborationResources 的 zh 段） |
| `attention.reversibility` | 可逆性 | renderer.js 内 `reversibility:"…"`（collaborationResources 的 zh 段） |
| `attention.afterDecision` | 决定后 | renderer.js 内 `afterDecision:"…"`（collaborationResources 的 zh 段） |
| `attention.itemCount_one` | {{count}} 项 | renderer.js 内 `itemCount_one:"…"`（collaborationResources 的 zh 段） |
| `attention.itemCount_other` | {{count}} 项 | renderer.js 内 `itemCount_other:"…"`（collaborationResources 的 zh 段） |
| `attention.openContext` | 在上下文中处理 | renderer.js 内 `openContext:"…"`（collaborationResources 的 zh 段） |
| `attention.contextReady` | 原始任务、执行轮次和相关证据保持在同一上下文中 | renderer.js 内 `contextReady:"…"`（collaborationResources 的 zh 段） |

### `auto.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `auto` | 自动审批 | renderer.js 内 `auto:"…"`（permissionModeLabels 的 zh 段） |

### `bypassPermissions.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `bypassPermissions` | 完全访问 | renderer.js 内 `bypassPermissions:"…"`（permissionModeLabels 的 zh 段） |

### `cancelTaskPending.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `cancelTaskPending` | 正在终止任务… | renderer.js 内 `cancelTaskPending:"…"`（permissionResources 的 zh 段） |

### `chatActivity.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatActivity.question.answerRegion` | 回答 Agent 的问题 | renderer.js 内 `answerRegion:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.toolConfirmRegion` | 工具执行确认 | renderer.js 内 `toolConfirmRegion:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.sendFailed` | 答案发送失败，请重试。 | renderer.js 内 `sendFailed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.multiSelect` | 可多选 | renderer.js 内 `multiSelect:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.singleSelect` | 单选 | renderer.js 内 `singleSelect:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.questionHeader` | Agent 想确认 | renderer.js 内 `questionHeader:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.skipAll` | 无偏好 | renderer.js 内 `skipAll:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.autoSkipCountdown` | {{count}} 秒后自动跳过 | renderer.js 内 `autoSkipCountdown:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.continue` | 下一题 | renderer.js 内 `continue:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.submit` | 发送答案 | renderer.js 内 `submit:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.sending` | 正在发送… | renderer.js 内 `sending:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.customInputPlaceholder` | 输入其他答案 | renderer.js 内 `customInputPlaceholder:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.customInputSelectionHint` | 输入内容后自动选中 | renderer.js 内 `customInputSelectionHint:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.recommend` | 推荐 | renderer.js 内 `recommend:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.previousQuestion` | 上一题 | renderer.js 内 `previousQuestion:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.nextQuestion` | 下一题 | renderer.js 内 `nextQuestion:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.collapse` | 收起问题 | renderer.js 内 `collapse:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.expand` | 展开问题 | renderer.js 内 `expand:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.moreActions` | 更多操作 | renderer.js 内 `moreActions:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.stop` | 停止生成 | renderer.js 内 `stop:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.stopping` | 正在停止… | renderer.js 内 `stopping:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.stopFailed` | 无法停止执行，请重试。 | renderer.js 内 `stopFailed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.collapsedTitle_one` | 有 {{count}} 个问题待你回应 | renderer.js 内 `collapsedTitle_one:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.collapsedTitle_other` | 有 {{count}} 个问题待你回应 | renderer.js 内 `collapsedTitle_other:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.question.structuredInput` | 结构化参数 | renderer.js 内 `structuredInput:"…"`（chatTimelineResources 的 zh 段） |

### `clarification.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `clarification.title` | 确认执行边界 | renderer.js 内 `title:"…"`（collaborationResources 的 zh 段） |
| `clarification.description` | 只回答会影响当前轮次的边界，其余目标和上下文保持不变。 | renderer.js 内 `description:"…"`（collaborationResources 的 zh 段） |
| `clarification.keep` | 保留当前边界 | renderer.js 内 `keep:"…"`（collaborationResources 的 zh 段） |
| `clarification.adjust` | 调整边界 | renderer.js 内 `adjust:"…"`（collaborationResources 的 zh 段） |
| `clarification.guidance` | 补充执行说明 | renderer.js 内 `guidance:"…"`（collaborationResources 的 zh 段） |
| `clarification.guidancePlaceholder` | 说明要调整的范围、约束或验收边界... | renderer.js 内 `guidancePlaceholder:"…"`（collaborationResources 的 zh 段） |
| `clarification.submit` | 回答并继续执行 | renderer.js 内 `submit:"…"`（collaborationResources 的 zh 段） |
| `clarification.resolved` | 这个澄清已经处理 | renderer.js 内 `resolved:"…"`（collaborationResources 的 zh 段） |
| `clarification.unavailableTitle` | 无法打开这个澄清请求 | renderer.js 内 `unavailableTitle:"…"`（collaborationResources 的 zh 段） |
| `clarification.unavailableDescription` | 它可能已经失效或本地数据暂时不可用。 | renderer.js 内 `unavailableDescription:"…"`（collaborationResources 的 zh 段） |
| `clarification.backToRun` | 返回原任务 | renderer.js 内 `backToRun:"…"`（collaborationResources 的 zh 段） |
| `clarification.impact` | 操作后果 | renderer.js 内 `impact:"…"`（collaborationResources 的 zh 段） |
| `clarification.originContext` | 原始上下文 | renderer.js 内 `originContext:"…"`（collaborationResources 的 zh 段） |
| `clarification.requestSnapshot` | 请求发生时的工作状态 | renderer.js 内 `requestSnapshot:"…"`（collaborationResources 的 zh 段） |
| `clarification.attached` | 已附加 | renderer.js 内 `attached:"…"`（collaborationResources 的 zh 段） |
| `clarification.liveContext` | 上下文快照 | renderer.js 内 `liveContext:"…"`（collaborationResources 的 zh 段） |
| `clarification.boundary` | 当前执行边界 | renderer.js 内 `boundary:"…"`（collaborationResources 的 zh 段） |
| `clarification.defaultBoundary` | 保持现有目标和验收条件，只处理这次澄清涉及的边界。 | renderer.js 内 `defaultBoundary:"…"`（collaborationResources 的 zh 段） |
| `clarification.annotation` | 这个边界需要你的判断 | renderer.js 内 `annotation:"…"`（collaborationResources 的 zh 段） |
| `clarification.decisionNeeded` | 需要决定 | renderer.js 内 `decisionNeeded:"…"`（collaborationResources 的 zh 段） |
| `clarification.answerHint` | 直接回答适合有边界的判断；需要编码、探索或独立验证时，再创建关联任务。 | renderer.js 内 `answerHint:"…"`（collaborationResources 的 zh 段） |

### `collaboration.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `collaboration.title` | 允许 Agent 访问这个 Project？ | renderer.js 内 `title:"…"`（permissionResources 的 zh 段） |
| `collaboration.description` | 授权后，Agent 将以自己的协作身份访问该 Project 中允许使用的资源。 | renderer.js 内 `description:"…"`（permissionResources 的 zh 段） |
| `collaboration.agent` | Agent | renderer.js 内 `agent:"…"`（permissionResources 的 zh 段） |
| `collaboration.project` | Project | renderer.js 内 `project:"…"`（permissionResources 的 zh 段） |
| `collaboration.target` | 目标资源 | renderer.js 内 `target:"…"`（permissionResources 的 zh 段） |
| `collaboration.issueTarget` | Issue · {{issue}} | renderer.js 内 `issueTarget:"…"`（permissionResources 的 zh 段） |
| `collaboration.enable` | 为该 Agent 开启协作 | renderer.js 内 `enable:"…"`（permissionResources 的 zh 段） |
| `collaboration.connect` | 建立 Agent Runtime 连接 | renderer.js 内 `connect:"…"`（permissionResources 的 zh 段） |
| `collaboration.join` | 将该 Agent 加入 Project | renderer.js 内 `join:"…"`（permissionResources 的 zh 段） |
| `collaboration.scope` | 此授权会保留到你从 Project 中移除该 Agent，不会绑定当前对话与 Issue，也不会授权其他 Project。 | renderer.js 内 `scope:"…"`（permissionResources 的 zh 段） |
| `collaboration.allowAndContinue` | 允许并继续 | renderer.js 内 `allowAndContinue:"…"`（permissionResources 的 zh 段） |
| `collaboration.cancel` | 取消 | renderer.js 内 `cancel:"…"`（permissionResources 的 zh 段） |
| `collaboration.preparing` | 正在为 Agent 开启协作… | renderer.js 内 `preparing:"…"`（permissionResources 的 zh 段） |
| `collaboration.joining` | 正在将 Agent 加入 Project… | renderer.js 内 `joining:"…"`（permissionResources 的 zh 段） |
| `collaboration.verifying` | 正在确认协作访问权限… | renderer.js 内 `verifying:"…"`（permissionResources 的 zh 段） |
| `collaboration.failed` | 授权未完成，请重试。 | renderer.js 内 `failed:"…"`（permissionResources 的 zh 段） |

### `collapse.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `collapse` | 收起 | renderer.js 内 `collapse:"…"`（permissionResources 的 zh 段） |

### `composer.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `composer.permission.ariaLabel` | 访问权限 | renderer.js 内 `ariaLabel:"…"`（newChatResources 的 zh 段） |
| `composer.permission.acceptEdits.description` | 执行命令、修改 Workspace 外文件或访问网络前，始终询问 | renderer.js 内 `description:"…"`（newChatResources 的 zh 段） |
| `composer.permission.auto.description` | 仅在检测到潜在风险时询问 | renderer.js 内 `description:"…"`（newChatResources 的 zh 段） |
| `composer.permission.bypassPermissions.description` | 不再询问，可自由访问你的文件、终端和网络 | renderer.js 内 `description:"…"`（newChatResources 的 zh 段） |
| `composer.permission.bypassPermissions.confirmation.title` | 允许 Qoder 使用完全访问？ | renderer.js 内 `title:"…"`（newChatResources 的 zh 段） |
| `composer.permission.bypassPermissions.confirmation.description` | 开启后，Qoder 可以在当前设备上直接执行高权限操作，包括文件处理、命令执行和联网访问。主要范围包括： | renderer.js 内 `description:"…"`（newChatResources 的 zh 段） |
| `composer.permission.bypassPermissions.confirmation.capabilities.files.title` | 文件和文件夹 | renderer.js 内 `title:"…"`（newChatResources 的 zh 段） |
| `composer.permission.bypassPermissions.confirmation.capabilities.files.description` | 查看、新建、更新、上传或移除设备上的文件与文件夹 | renderer.js 内 `description:"…"`（newChatResources 的 zh 段） |
| `composer.permission.bypassPermissions.confirmation.capabilities.terminal.title` | 终端命令 | renderer.js 内 `title:"…"`（newChatResources 的 zh 段） |
| `composer.permission.bypassPermissions.confirmation.capabilities.terminal.description` | 执行终端命令、安装依赖，并调整必要的系统配置 | renderer.js 内 `description:"…"`（newChatResources 的 zh 段） |
| `composer.permission.bypassPermissions.confirmation.capabilities.network.title` | 互联网和已连接的应用 | renderer.js 内 `title:"…"`（newChatResources 的 zh 段） |
| `composer.permission.bypassPermissions.confirmation.capabilities.network.description` | 打开网页、传输数据，并调用你已启用的插件或连接应用 | renderer.js 内 `description:"…"`（newChatResources 的 zh 段） |
| `composer.permission.bypassPermissions.confirmation.riskNote` | 请只在信任当前任务和上下文时开启；该权限可能增加敏感数据暴露、误操作或提示注入风险，可随时关闭。 | renderer.js 内 `riskNote:"…"`（newChatResources 的 zh 段） |
| `composer.permission.bypassPermissions.confirmation.cancel` | 取消 | renderer.js 内 `cancel:"…"`（newChatResources 的 zh 段） |
| `composer.permission.bypassPermissions.confirmation.confirm` | 确认 | renderer.js 内 `confirm:"…"`（newChatResources 的 zh 段） |

### `decisionFailed.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `decisionFailed` | 选择未发送，请重试。 | renderer.js 内 `decisionFailed:"…"`（permissionResources 的 zh 段） |

### `decisionPending.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `decisionPending` | 正在发送选择… | renderer.js 内 `decisionPending:"…"`（permissionResources 的 zh 段） |

### `deny.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `deny` | 拒绝 | renderer.js 内 `deny:"…"`（permissionResources 的 zh 段） |

### `directory.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `directory.title` | 允许连接目录？ | renderer.js 内 `title:"…"`（permissionResources 的 zh 段） |
| `directory.description` | Agent 请求把该目录加入当前任务上下文。 | renderer.js 内 `description:"…"`（permissionResources 的 zh 段） |

### `evidence.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `evidence.title` | 结果验收 | renderer.js 内 `title:"…"`（workspaceResources 的 zh 段） |
| `evidence.proven` | 项证据成立 | renderer.js 内 `proven:"…"`（workspaceResources 的 zh 段） |
| `evidence.provenLabel` | 已证明 | renderer.js 内 `provenLabel:"…"`（workspaceResources 的 zh 段） |
| `evidence.pendingLabel` | 待验证 | renderer.js 内 `pendingLabel:"…"`（workspaceResources 的 zh 段） |
| `evidence.claim` | Agent Claim | renderer.js 内 `claim:"…"`（workspaceResources 的 zh 段） |
| `evidence.sources` | Evidence | renderer.js 内 `sources:"…"`（workspaceResources 的 zh 段） |
| `evidence.openQuestions` | Open Questions | renderer.js 内 `openQuestions:"…"`（workspaceResources 的 zh 段） |
| `evidence.noOpenQuestions` | 当前没有未解决问题，所有声明均有可追溯证据。 | renderer.js 内 `noOpenQuestions:"…"`（workspaceResources 的 zh 段） |
| `evidence.hasOpenQuestions` | 仍有验证项未成立，请要求 Agent 继续执行或由 Human Owner 接管。 | renderer.js 内 `hasOpenQuestions:"…"`（workspaceResources 的 zh 段） |
| `evidence.noEvidence` | 还没有可验收的证据 | renderer.js 内 `noEvidence:"…"`（workspaceResources 的 zh 段） |
| `evidence.noEvidenceDescription` | Turn 提交结果后，变更、验证和运行时证据会汇聚到这里。 | renderer.js 内 `noEvidenceDescription:"…"`（workspaceResources 的 zh 段） |
| `evidence.humanDecision` | Human Decision | renderer.js 内 `humanDecision:"…"`（workspaceResources 的 zh 段） |
| `evidence.decisionDescription` | Agent 可以声明结果；只有 Human Owner 决定接下来发生什么。 | renderer.js 内 `decisionDescription:"…"`（workspaceResources 的 zh 段） |
| `evidence.accept` | 接受 | renderer.js 内 `accept:"…"`（workspaceResources 的 zh 段） |
| `evidence.continue` | 继续 | renderer.js 内 `continue:"…"`（workspaceResources 的 zh 段） |
| `evidence.takeOver` | 接管 | renderer.js 内 `takeOver:"…"`（workspaceResources 的 zh 段） |
| `evidence.abandon` | 放弃 | renderer.js 内 `abandon:"…"`（workspaceResources 的 zh 段） |
| `evidence.accepted` | 已接受本轮结果 | renderer.js 内 `accepted:"…"`（workspaceResources 的 zh 段） |
| `evidence.continued` | 已要求继续执行 | renderer.js 内 `continued:"…"`（workspaceResources 的 zh 段） |
| `evidence.takenOver` | 已由 Human Owner 接管 | renderer.js 内 `takenOver:"…"`（workspaceResources 的 zh 段） |
| `evidence.abandoned` | 已放弃本轮执行 | renderer.js 内 `abandoned:"…"`（workspaceResources 的 zh 段） |
| `evidence.abandonTitle` | 放弃本轮执行？ | renderer.js 内 `abandonTitle:"…"`（workspaceResources 的 zh 段） |
| `evidence.abandonDescription` | 当前 Turn 和已有 Evidence 会保留，但本轮不会继续推进。 | renderer.js 内 `abandonDescription:"…"`（workspaceResources 的 zh 段） |
| `evidence.cancel` | 取消 | renderer.js 内 `cancel:"…"`（workspaceResources 的 zh 段） |
| `evidence.confirmAbandon` | 确认放弃 | renderer.js 内 `confirmAbandon:"…"`（workspaceResources 的 zh 段） |

### `exitPlan.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `exitPlan.title` | 实施此计划？ | renderer.js 内 `title:"…"`（permissionResources 的 zh 段） |
| `exitPlan.specLabel` | Spec | renderer.js 内 `specLabel:"…"`（permissionResources 的 zh 段） |
| `exitPlan.planPreviewTitle` | 计划 | renderer.js 内 `planPreviewTitle:"…"`（permissionResources 的 zh 段） |
| `exitPlan.viewPlan` | 查看详情 | renderer.js 内 `viewPlan:"…"`（permissionResources 的 zh 段） |
| `exitPlan.planUnavailable` | 暂时无法读取计划详情，可打开 Spec 面板查看或让 Qoder 调整计划。 | renderer.js 内 `planUnavailable:"…"`（permissionResources 的 zh 段） |
| `exitPlan.copyPlan` | 复制计划 | renderer.js 内 `copyPlan:"…"`（permissionResources 的 zh 段） |
| `exitPlan.planCopied` | 已复制计划 | renderer.js 内 `planCopied:"…"`（permissionResources 的 zh 段） |
| `exitPlan.downloadPlan` | 下载计划 | renderer.js 内 `downloadPlan:"…"`（permissionResources 的 zh 段） |
| `exitPlan.expandPlan` | 展开计划 | renderer.js 内 `expandPlan:"…"`（permissionResources 的 zh 段） |
| `exitPlan.collapsePlan` | 收起计划 | renderer.js 内 `collapsePlan:"…"`（permissionResources 的 zh 段） |
| `exitPlan.defaultPlanFilename` | qoder-plan.md | renderer.js 内 `defaultPlanFilename:"…"`（permissionResources 的 zh 段） |
| `exitPlan.approve` | 开始实现 | renderer.js 内 `approve:"…"`（permissionResources 的 zh 段） |
| `exitPlan.approveChoice` | 是，实施此计划 | renderer.js 内 `approveChoice:"…"`（permissionResources 的 zh 段） |
| `exitPlan.build` | Build | renderer.js 内 `build:"…"`（permissionResources 的 zh 段） |
| `exitPlan.requestChanges` | 告诉 Qoder 计划需要如何调整 | renderer.js 内 `requestChanges:"…"`（permissionResources 的 zh 段） |
| `exitPlan.feedbackPlaceholder` | 告诉 Qoder 计划需要如何调整... | renderer.js 内 `feedbackPlaceholder:"…"`（permissionResources 的 zh 段） |
| `exitPlan.next` | 发送 | renderer.js 内 `next:"…"`（permissionResources 的 zh 段） |
| `exitPlan.submitting` | 正在发送… | renderer.js 内 `submitting:"…"`（permissionResources 的 zh 段） |
| `exitPlan.sendFeedback` | 发送 | renderer.js 内 `sendFeedback:"…"`（permissionResources 的 zh 段） |
| `exitPlan.cancelFeedback` | 取消 | renderer.js 内 `cancelFeedback:"…"`（permissionResources 的 zh 段） |
| `exitPlan.skip` | 暂不实施 | renderer.js 内 `skip:"…"`（permissionResources 的 zh 段） |
| `exitPlan.respondFailed` | 计划选择未发送，请重试。 | renderer.js 内 `respondFailed:"…"`（permissionResources 的 zh 段） |

### `expand.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `expand` | 展开完整内容 | renderer.js 内 `expand:"…"`（permissionResources 的 zh 段） |

### `explain.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `explain` | 解释 | renderer.js 内 `explain:"…"`（permissionResources 的 zh 段） |

### `explainFailed.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `explainFailed` | 暂时无法解释此操作。你仍可直接允许或拒绝，也可以重试解释。 | renderer.js 内 `explainFailed:"…"`（permissionResources 的 zh 段） |

### `lark.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `lark.title` | Agent 需要以下权限完成任务 | renderer.js 内 `title:"…"`（permissionResources 的 zh 段） |
| `lark.description` | 飞书 CLI 命令需要以下权限，请在浏览器中完成授权。 | renderer.js 内 `description:"…"`（permissionResources 的 zh 段） |
| `lark.productDefault` | 飞书工作台 | renderer.js 内 `productDefault:"…"`（permissionResources 的 zh 段） |
| `lark.product` | 产品 | renderer.js 内 `product:"…"`（permissionResources 的 zh 段） |
| `lark.scope` | 授权范围 | renderer.js 内 `scope:"…"`（permissionResources 的 zh 段） |
| `lark.status` | 状态 | renderer.js 内 `status:"…"`（permissionResources 的 zh 段） |
| `lark.statusWaiting` | 等待用户在浏览器中授权 | renderer.js 内 `statusWaiting:"…"`（permissionResources 的 zh 段） |
| `lark.openHint` | 已自动打开授权页面。如未弹出浏览器，可复制下方链接并手动打开。 | renderer.js 内 `openHint:"…"`（permissionResources 的 zh 段） |
| `lark.copyLink` | 复制授权链接 | renderer.js 内 `copyLink:"…"`（permissionResources 的 zh 段） |
| `lark.copied` | 已复制 | renderer.js 内 `copied:"…"`（permissionResources 的 zh 段） |
| `lark.reject` | 拒绝授权 | renderer.js 内 `reject:"…"`（permissionResources 的 zh 段） |
| `lark.cancelTask` | 终止任务 | renderer.js 内 `cancelTask:"…"`（permissionResources 的 zh 段） |

### `mcpRequestTitle.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `mcpRequestTitle` | 允许 MCP 工具 {{toolName}}？ | renderer.js 内 `mcpRequestTitle:"…"`（permissionResources 的 zh 段） |

### `pat.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `pat.title` | Agent 需要以下权限完成任务 | renderer.js 内 `title:"…"`（permissionResources 的 zh 段） |
| `pat.description` | 即将访问需要授权的数据 | renderer.js 内 `description:"…"`（permissionResources 的 zh 段） |
| `pat.product` | 产品 | renderer.js 内 `product:"…"`（permissionResources 的 zh 段） |
| `pat.operation` | 操作 | renderer.js 内 `operation:"…"`（permissionResources 的 zh 段） |
| `pat.scope` | 作用域 | renderer.js 内 `scope:"…"`（permissionResources 的 zh 段） |
| `pat.riskLevel` | 风险等级 | renderer.js 内 `riskLevel:"…"`（permissionResources 的 zh 段） |
| `pat.riskLow` | 低风险 | renderer.js 内 `riskLow:"…"`（permissionResources 的 zh 段） |
| `pat.riskMedium` | 中风险 | renderer.js 内 `riskMedium:"…"`（permissionResources 的 zh 段） |
| `pat.riskHigh` | 高风险 | renderer.js 内 `riskHigh:"…"`（permissionResources 的 zh 段） |
| `pat.allowOnce` | 允许本次 | renderer.js 内 `allowOnce:"…"`（permissionResources 的 zh 段） |
| `pat.allowSession` | 本次任务允许 | renderer.js 内 `allowSession:"…"`（permissionResources 的 zh 段） |
| `pat.allowAlways` | 始终允许 | renderer.js 内 `allowAlways:"…"`（permissionResources 的 zh 段） |
| `pat.configLink` | 查看更多权限配置 | renderer.js 内 `configLink:"…"`（permissionResources 的 zh 段） |

### `pendingCount.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `pendingCount` | 还有 {{count}} 个权限请求待处理 | renderer.js 内 `pendingCount:"…"`（permissionResources 的 zh 段） |

### `repeatedTool.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `repeatedTool.title` | 重复工具调用 | renderer.js 内 `title:"…"`（permissionResources 的 zh 段） |
| `repeatedTool.description` | {{toolName}} 工具已使用相同参数连续调用多次，可能陷入循环。继续会再次执行并消耗资源。 | renderer.js 内 `description:"…"`（permissionResources 的 zh 段） |
| `repeatedTool.descriptionWithCount` | {{toolName}} 工具已使用相同参数连续调用 {{count}} 次，可能陷入循环。继续会再次执行并消耗资源。 | renderer.js 内 `descriptionWithCount:"…"`（permissionResources 的 zh 段） |
| `repeatedTool.stopTask` | 终止任务 | renderer.js 内 `stopTask:"…"`（permissionResources 的 zh 段） |
| `repeatedTool.allowOnce` | 继续本次调用 | renderer.js 内 `allowOnce:"…"`（permissionResources 的 zh 段） |

### `requestTitle.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `requestTitle` | 允许“{{toolName}}”？ | renderer.js 内 `requestTitle:"…"`（permissionResources 的 zh 段） |

### `settings.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `settings.modeConfiguration.title` | 模式配置 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.modeConfiguration.description` | 分别配置编程和通用的界面展示方式。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.modeConfiguration.codingSection` | 编程 | renderer.js 内 `codingSection:"…"`（settingsResources 的 zh 段） |
| `settings.modeConfiguration.generalSection` | 通用 | renderer.js 内 `generalSection:"…"`（settingsResources 的 zh 段） |
| `settings.modeConfiguration.theme` | 绑定主题 | renderer.js 内 `theme:"…"`（settingsResources 的 zh 段） |
| `settings.modeConfiguration.themeDescription` | 切换到这个模式时使用的主题配色，亮暗模式沿用外观设置。 | renderer.js 内 `themeDescription:"…"`（settingsResources 的 zh 段） |
| `settings.modeConfiguration.executionTargetControls` | 运行位置入口 | renderer.js 内 `executionTargetControls:"…"`（settingsResources 的 zh 段） |
| `settings.modeConfiguration.executionTargetControlsDescription` | 控制 Local、Worktree、SSH 和分支选择是否展示。编程默认展示，通用默认收起。 | renderer.js 内 `executionTargetControlsDescription:"…"`（settingsResources 的 zh 段） |
| `settings.modeConfiguration.composerEnvironmentChips` | 输入区运行环境标签 | renderer.js 内 `composerEnvironmentChips:"…"`（settingsResources 的 zh 段） |
| `settings.modeConfiguration.composerEnvironmentChipsDescription` | 控制任务输入框下方的本地、Worktree、SSH 和 Git 分支标签是否展示，不影响任务监控卡片。 | renderer.js 内 `composerEnvironmentChipsDescription:"…"`（settingsResources 的 zh 段） |
| `settings.modeConfiguration.taskMonitorEnvironment` | 任务监控卡片环境信息 | renderer.js 内 `taskMonitorEnvironment:"…"`（settingsResources 的 zh 段） |
| `settings.modeConfiguration.taskMonitorEnvironmentDescription` | 控制任务监控卡片中的分支、运行位置和本地服务等工程信息是否展示，不影响输入区标签。 | renderer.js 内 `taskMonitorEnvironmentDescription:"…"`（settingsResources 的 zh 段） |
| `settings.modeConfiguration.browserLocalServers` | 浏览器本地服务入口 | renderer.js 内 `browserLocalServers:"…"`（settingsResources 的 zh 段） |
| `settings.modeConfiguration.browserLocalServersDescription` | 控制浏览器空白页是否展示本地服务列表。 | renderer.js 内 `browserLocalServersDescription:"…"`（settingsResources 的 zh 段） |
| `settings.modeConfiguration.conversationFileChanges` | 任务文件变更卡片 | renderer.js 内 `conversationFileChanges:"…"`（settingsResources 的 zh 段） |
| `settings.modeConfiguration.conversationFileChangesDescription` | 控制 Agent 完成一轮后，是否在任务流末尾展示文件变更和 Diff 审阅入口。 | renderer.js 内 `conversationFileChangesDescription:"…"`（settingsResources 的 zh 段） |
| `settings.modeConfiguration.itemAriaLabel` | {{mode}}：{{item}} | renderer.js 内 `itemAriaLabel:"…"`（settingsResources 的 zh 段） |

### `suggestion.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `suggestion.behavior.allow` | 允许 | renderer.js 内 `allow:"…"`（permissionResources 的 zh 段） |
| `suggestion.behavior.deny` | 拒绝 | renderer.js 内 `deny:"…"`（permissionResources 的 zh 段） |
| `suggestion.behavior.ask` | 询问 | renderer.js 内 `ask:"…"`（permissionResources 的 zh 段） |
| `suggestion.rules.add.allow` | 本次任务允许 | renderer.js 内 `allow:"…"`（permissionResources 的 zh 段） |
| `suggestion.rules.add.deny` | 本次任务拒绝 | renderer.js 内 `deny:"…"`（permissionResources 的 zh 段） |
| `suggestion.rules.add.ask` | 本次任务仍询问 | renderer.js 内 `ask:"…"`（permissionResources 的 zh 段） |
| `suggestion.rules.replace` | 替换本次任务的{{behavior}}规则 | renderer.js 内 `replace:"…"`（permissionResources 的 zh 段） |
| `suggestion.rules.remove` | 移除本次任务的{{behavior}}规则 | renderer.js 内 `remove:"…"`（permissionResources 的 zh 段） |
| `suggestion.directories.add` | 本次任务始终允许访问“{{scope}}” | renderer.js 内 `add:"…"`（permissionResources 的 zh 段） |
| `suggestion.directories.remove` | 移除本次任务的目录访问：“{{scope}}” | renderer.js 内 `remove:"…"`（permissionResources 的 zh 段） |
| `suggestion.mode` | 本次任务使用“{{mode}}”模式 | renderer.js 内 `mode:"…"`（permissionResources 的 zh 段） |

### `title.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `title` | 高危操作 | renderer.js 内 `title:"…"`（permissionResources 的 zh 段） |

### `toolArguments.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `toolArguments` | 工具参数 | renderer.js 内 `toolArguments:"…"`（permissionResources 的 zh 段） |

## 9 上下文与压缩

_条目数：27_

### `chatActivity.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatActivity.contextCompression.detailsPending` | 分类明细待更新 | renderer.js 内 `detailsPending:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.running` | 正在压缩… | renderer.js 内 `running:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.completed` | 已压缩上下文 | renderer.js 内 `completed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.noop` | 当前上下文无需压缩 | renderer.js 内 `noop:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.ariaLabel` | 上下文压缩分隔线 | renderer.js 内 `ariaLabel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.usageLabel` | 完整模型请求占用 {{percent}}% | renderer.js 内 `usageLabel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.title` | 上下文窗口 | renderer.js 内 `title:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.description` | 展示当前任务的上下文占用情况；压缩会摘要早期内容，需等待片刻并消耗少量积分。 | renderer.js 内 `description:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.action` | 压缩上下文 | renderer.js 内 `action:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.compacting` | 正在压缩… | renderer.js 内 `compacting:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.progressLabel` | 完整模型请求占用率 | renderer.js 内 `progressLabel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.breakdownLabel` | 上下文估算构成 | renderer.js 内 `breakdownLabel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.categories.system_prompt` | 系统提示词 | renderer.js 内 `system_prompt:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.categories.system_tools` | 系统工具 | renderer.js 内 `system_tools:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.categories.skills` | Skill | renderer.js 内 `skills:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.categories.messages` | 消息 | renderer.js 内 `messages:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.categories.other` | 其他 | renderer.js 内 `other:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.categories.free_space` | 剩余空间 | renderer.js 内 `free_space:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.categories.auto_compact` | 自动压缩预留 | renderer.js 内 `auto_compact:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.autoCompactThreshold` | 自动压缩阈值 {{percent}}% | renderer.js 内 `autoCompactThreshold:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.skillsCategory` | Skill（{{count}}个） | renderer.js 内 `skillsCategory:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.disabled.lowUsage` | 当前上下文较短，无需压缩。 | renderer.js 内 `lowUsage:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.disabled.running` | 任务进行中，暂时无法压缩。 | renderer.js 内 `running:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.disabled.compacting` | 正在压缩中，请稍候。 | renderer.js 内 `compacting:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.disabledActionLabel` | {{action}}：{{reason}} | renderer.js 内 `disabledActionLabel:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.failed` | 无法压缩上下文 | renderer.js 内 `failed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.contextCompression.failedDescription` | 上下文没有压缩，请稍后重试。 | renderer.js 内 `failedDescription:"…"`（chatTimelineResources 的 zh 段） |

## 10 引用与来源（@ / 附件 / 来源 / 速记 / 批注）

_条目数：430_

### `chatSession.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatSession.addedFolderCount` | {{name}} +{{count}} | renderer.js 内 `addedFolderCount:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionActions.ariaLabel` | 选中文本操作 | renderer.js 内 `ariaLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionActions.copyText` | 复制文本 | renderer.js 内 `copyText:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionActions.addToChat` | 添加到任务 | renderer.js 内 `addToChat:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionActions.askInSideChat` | 在侧边任务中提问 | renderer.js 内 `askInSideChat:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionActions.sideChatFailed` | 侧边任务没有打开，请重试。 | renderer.js 内 `sideChatFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionActions.addToQuickNotes` | 添加到速记板 | renderer.js 内 `addToQuickNotes:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionActions.copied` | 已复制选中文本 | renderer.js 内 `copied:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionActions.copyFailed` | 复制选中文本失败 | renderer.js 内 `copyFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionActions.addedToQuickNotes` | 已添加到速记板 | renderer.js 内 `addedToQuickNotes:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionActions.addToQuickNotesFailed` | 速记板保存失败 | renderer.js 内 `addToQuickNotesFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionActions.attachmentName` | 选中的文本 | renderer.js 内 `attachmentName:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionActions.attachmentLimitReached` | 附件已达 20 个，请先移除一个再添加选中文本。 | renderer.js 内 `attachmentLimitReached:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.summary` | {{count}} 条批注 | renderer.js 内 `summary:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.summaryAriaLabel` | {{count}} 条划词批注。悬停查看详情。 | renderer.js 内 `summaryAriaLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.hoverHint` | 悬停查看批注 | renderer.js 内 `hoverHint:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.selectedText` | {{index}}. 选中文字 | renderer.js 内 `selectedText:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.userComment` | 用户评论 | renderer.js 内 `userComment:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.noComment` | 未添加评论 | renderer.js 内 `noComment:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.commentPlaceholder` | 添加可选评论… | renderer.js 内 `commentPlaceholder:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.commentAriaLabel` | 划词批注评论 | renderer.js 内 `commentAriaLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.addComment` | 添加评论 | renderer.js 内 `addComment:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.skipComment` | 暂不评论 | renderer.js 内 `skipComment:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.save` | 保存 | renderer.js 内 `save:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.cancel` | 取消 | renderer.js 内 `cancel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.edit` | 编辑批注 {{index}} | renderer.js 内 `edit:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.removeOne` | 移除批注 {{index}} | renderer.js 内 `removeOne:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.removeAll` | 移除全部划词批注 | renderer.js 内 `removeAll:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.marker` | 批注 {{index}} | renderer.js 内 `marker:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.selectionAnnotations.directiveLabel` | 批注 {{index}} | renderer.js 内 `directiveLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.open` | 打开速记板 | renderer.js 内 `open:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.close` | 关闭速记板 | renderer.js 内 `close:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.title` | Quick Notes | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.description` | 保存从 Agent 回复中摘出的片段。 | renderer.js 内 `description:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.search` | 搜索速记板 | renderer.js 内 `search:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.searchPlaceholder` | 搜索笔记… | renderer.js 内 `searchPlaceholder:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.closeSearch` | 退出搜索 | renderer.js 内 `closeSearch:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.addPlaceholder` | 记下点什么… | renderer.js 内 `addPlaceholder:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.addImage` | 添加图片 | renderer.js 内 `addImage:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.dropImages` | 拖放图片到这里 | renderer.js 内 `dropImages:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAlt` | 速记板图片：{{name}} | renderer.js 内 `imageAlt:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.removeImage` | 移除图片 {{name}} | renderer.js 内 `removeImage:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.previewImage` | 查看图片 {{name}} | renderer.js 内 `previewImage:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageLoadFailed` | 图片无法加载 | renderer.js 内 `imageLoadFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imagePreviewTitle` | 图片预览：{{name}} | renderer.js 内 `imagePreviewTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imagePreviewCopy` | 复制图片 | renderer.js 内 `imagePreviewCopy:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imagePreviewSave` | 保存图片 | renderer.js 内 `imagePreviewSave:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imagePreviewClose` | 关闭图片预览 | renderer.js 内 `imagePreviewClose:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imagePreviewPrevious` | 上一张 | renderer.js 内 `imagePreviewPrevious:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imagePreviewNext` | 下一张 | renderer.js 内 `imagePreviewNext:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imagePreviewInstructions` | 图片查看区域。滚动缩放，放大后拖动图片，双击切换实际大小与适合窗口。 | renderer.js 内 `imagePreviewInstructions:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imagePreviewCounter` | 第 {{index}} / {{total}} 张 | renderer.js 内 `imagePreviewCounter:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imagePreviewZoomOut` | 缩小图片 | renderer.js 内 `imagePreviewZoomOut:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imagePreviewZoomIn` | 放大图片 | renderer.js 内 `imagePreviewZoomIn:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imagePreviewFit` | 适合窗口 | renderer.js 内 `imagePreviewFit:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imagePreviewZoomLevel` | 当前缩放比例 {{zoom}}% | renderer.js 内 `imagePreviewZoomLevel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imagePreviewCopied` | 已复制图片 | renderer.js 内 `imagePreviewCopied:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imagePreviewCopyFailed` | 复制图片失败 | renderer.js 内 `imagePreviewCopyFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imagePreviewSaved` | 图片已保存 | renderer.js 内 `imagePreviewSaved:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imagePreviewSaveFailed` | 保存图片失败 | renderer.js 内 `imagePreviewSaveFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotationConfirmFailed` | 无法应用图片批注 | renderer.js 内 `imageAnnotationConfirmFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.toolbar` | 图片批注工具 | renderer.js 内 `toolbar:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.properties` | 工具属性 | renderer.js 内 `properties:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.shapeMenu` | 选择形状 | renderer.js 内 `shapeMenu:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.drawingMenu` | 选择绘制工具 | renderer.js 内 `drawingMenu:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.rectangle` | 矩形 | renderer.js 内 `rectangle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.ellipse` | 椭圆 | renderer.js 内 `ellipse:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.line` | 直线 | renderer.js 内 `line:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.pen` | 画笔 | renderer.js 内 `pen:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.text` | 文字 | renderer.js 内 `text:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.mosaic` | 马赛克 | renderer.js 内 `mosaic:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.undo` | 撤销 | renderer.js 内 `undo:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.redo` | 重做 | renderer.js 内 `redo:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.deleteSelection` | 删除所选批注 | renderer.js 内 `deleteSelection:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.color` | 颜色 | renderer.js 内 `color:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.width` | 粗细 | renderer.js 内 `width:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.widthThin` | 细 | renderer.js 内 `widthThin:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.widthMedium` | 中 | renderer.js 内 `widthMedium:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.widthThick` | 粗 | renderer.js 内 `widthThick:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.arrow` | 箭头 | renderer.js 内 `arrow:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.arrowNone` | 无线头 | renderer.js 内 `arrowNone:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.arrowEnd` | 末端箭头 | renderer.js 内 `arrowEnd:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.arrowBoth` | 双向箭头 | renderer.js 内 `arrowBoth:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.textSize` | 字号 | renderer.js 内 `textSize:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.textSmall` | 小 | renderer.js 内 `textSmall:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.textMedium` | 中 | renderer.js 内 `textMedium:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.textLarge` | 大 | renderer.js 内 `textLarge:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.textStyle` | 文字样式 | renderer.js 内 `textStyle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.textPlain` | 纯文字 | renderer.js 内 `textPlain:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.textFilled` | 背景填充 | renderer.js 内 `textFilled:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.textPlaceholder` | 输入批注文字 | renderer.js 内 `textPlaceholder:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.canvasInstructions` | 图片批注区域。拖动绘制；选择批注后可移动、缩放、修改属性或删除。 | renderer.js 内 `canvasInstructions:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.edit` | 编辑图片 | renderer.js 内 `edit:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.confirm` | 应用批注 | renderer.js 内 `confirm:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.cancel` | 放弃批注 | renderer.js 内 `cancel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageAnnotation.gifDisabled` | GIF 动图暂不支持批注 | renderer.js 内 `gifDisabled:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.addImageFailed` | 图片没有添加到速记板 | renderer.js 内 `addImageFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.pasteImagesFailed` | 无法粘贴这条速记的图片 | renderer.js 内 `pasteImagesFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageErrors.empty` | 没有可添加的图片。 | renderer.js 内 `empty:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageErrors.count` | 每条速记最多添加 5 张图片。 | renderer.js 内 `count:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageErrors.format` | 仅支持 PNG、JPEG、WebP 和 GIF 图片。 | renderer.js 内 `format:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageErrors.emptyFile` | 图片内容为空，无法添加。 | renderer.js 内 `emptyFile:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageErrors.itemSize` | 单张图片不能超过 10 MB。 | renderer.js 内 `itemSize:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageErrors.totalSize` | 每条速记的图片总大小不能超过 20 MB。 | renderer.js 内 `totalSize:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageErrors.invalidPayload` | 复制的速记板图片数据无效，请改用普通文本粘贴。 | renderer.js 内 `invalidPayload:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.imageErrors.readFailed` | 图片读取失败，请重试。 | renderer.js 内 `readFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.errors.recordNotFound` | 这条速记已不存在。刷新速记板后重试。 | renderer.js 内 `recordNotFound:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.errors.clipboardUnavailable` | 系统剪贴板不可用。检查系统权限后重试。 | renderer.js 内 `clipboardUnavailable:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.errors.invalidData` | 这条速记无法处理。重新打开速记板后重试。 | renderer.js 内 `invalidData:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.errors.windowUnavailable` | 速记板窗口暂不可用。重新打开后重试。 | renderer.js 内 `windowUnavailable:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.errors.tryAgain` | 检查磁盘与系统权限后重试。 | renderer.js 内 `tryAgain:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.loading` | 正在读取速记板记录… | renderer.js 内 `loading:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.emptyTitle` | 还没有速记 | renderer.js 内 `emptyTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.emptyDescription` | 在 Agent 回复里划选内容，然后添加到速记板。 | renderer.js 内 `emptyDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.sourceChat` | 来自“{{title}}” | renderer.js 内 `sourceChat:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.sourceUnknownChat` | 来自任务 | renderer.js 内 `sourceUnknownChat:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.copy` | 复制速记 | renderer.js 内 `copy:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.copied` | 已复制速记 | renderer.js 内 `copied:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.copyFailed` | 复制速记失败 | renderer.js 内 `copyFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.copyRecord` | 复制 | renderer.js 内 `copyRecord:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.copyText` | 复制文本 | renderer.js 内 `copyText:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.copyImage` | 复制图片 | renderer.js 内 `copyImage:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.moreActions` | 打开速记操作菜单 | renderer.js 内 `moreActions:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.organize` | 整理速记板 | renderer.js 内 `organize:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.filterLabel` | 显示范围 | renderer.js 内 `filterLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.filterCurrent` | 当前 | renderer.js 内 `filterCurrent:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.filterArchived` | 已归档 | renderer.js 内 `filterArchived:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.filterAll` | 全部 | renderer.js 内 `filterAll:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.clearFilter` | 清除“{{filter}}”筛选 | renderer.js 内 `clearFilter:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.groupByLabel` | 分组方式 | renderer.js 内 `groupByLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.groupBySource` | 任务来源 | renderer.js 内 `groupBySource:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.groupByTime` | 时间 | renderer.js 内 `groupByTime:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.onboardingNote` | 这是你的第一条速记 🌲。 | renderer.js 内 `onboardingNote:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.onboardingTitle` | 这是你的第一条速记 🌲。 | renderer.js 内 `onboardingTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.onboardingUnderline` | 还没准备发送的 | renderer.js 内 `onboardingUnderline:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.onboardingTagline` | Catch it before it slips. | renderer.js 内 `onboardingTagline:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.noSourceGroup` | No Source | renderer.js 内 `noSourceGroup:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.archiveRecord` | 归档速记 | renderer.js 内 `archiveRecord:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.restoreRecord` | 恢复速记 | renderer.js 内 `restoreRecord:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.archived` | 已归档 | renderer.js 内 `archived:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.restored` | 速记已恢复 | renderer.js 内 `restored:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.undoArchive` | 撤销 | renderer.js 内 `undoArchive:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.archiveFailed` | 速记还没有归档，请稍后重试。 | renderer.js 内 `archiveFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.restoreFailed` | 速记还没有恢复，请稍后重试。 | renderer.js 内 `restoreFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.today` | 今天 | renderer.js 内 `today:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.yesterday` | 昨天 | renderer.js 内 `yesterday:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.unknownTime` | 时间未知 | renderer.js 内 `unknownTime:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.delete` | 删除速记 | renderer.js 内 `delete:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.deleteRecord` | 删除 | renderer.js 内 `deleteRecord:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.deleteConfirmTitle` | 删除这条速记？ | renderer.js 内 `deleteConfirmTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.deleteConfirmDescription` | 正文和图片附件将永久删除，此操作无法撤销。 | renderer.js 内 `deleteConfirmDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.deleteCancel` | 保留记录 | renderer.js 内 `deleteCancel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.deleteConfirm` | 删除记录 | renderer.js 内 `deleteConfirm:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.deleted` | 已删除 | renderer.js 内 `deleted:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.undoDelete` | 撤销 | renderer.js 内 `undoDelete:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.deleteFailed` | 速记还没有删除，请稍后重试。 | renderer.js 内 `deleteFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.loadFailed` | 速记板暂时无法读取。 | renderer.js 内 `loadFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.viewStateLoadFailed` | 速记板已使用默认视图打开。 | renderer.js 内 `viewStateLoadFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.viewStateSaveFailed` | 这次视图选择尚未记住。 | renderer.js 内 `viewStateSaveFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.onboardingLoadFailed` | 首次引导暂时无法加载，关闭速记板后重新打开即可重试。 | renderer.js 内 `onboardingLoadFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.editRecord` | 编辑 | renderer.js 内 `editRecord:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.createNote` | 添加速记 | renderer.js 内 `createNote:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.editorCreateTitle` | 新建速记 | renderer.js 内 `editorCreateTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.editorEditTitle` | 编辑速记 | renderer.js 内 `editorEditTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.editorAriaLabel` | 速记编辑器 | renderer.js 内 `editorAriaLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.editorCancel` | 取消 | renderer.js 内 `editorCancel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.editorSave` | 保存 | renderer.js 内 `editorSave:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.editorSaving` | 正在保存… | renderer.js 内 `editorSaving:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.updateFailed` | 速记还没有更新，请稍后重试。 | renderer.js 内 `updateFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.updateMissing` | 这条速记已不存在。 | renderer.js 内 `updateMissing:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.textTooLong` | 速记正文不能超过 3000 个字符。 | renderer.js 内 `textTooLong:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.discardTitle` | 保存这次修改？ | renderer.js 内 `discardTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.discardDescription` | 你可以保存后关闭、放弃修改，或继续编辑。 | renderer.js 内 `discardDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.discardChanges` | 放弃修改 | renderer.js 内 `discardChanges:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.continueEditing` | 继续编辑 | renderer.js 内 `continueEditing:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.bold` | 加粗 | renderer.js 内 `bold:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.italic` | 斜体 | renderer.js 内 `italic:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.clearFormatting` | 清除所有样式 | renderer.js 内 `clearFormatting:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.serif` | 衬线字体 | renderer.js 内 `serif:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.sansSerif` | 无衬线字体 | renderer.js 内 `sansSerif:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.underline` | 下划线 | renderer.js 内 `underline:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.highlight` | 标记 | renderer.js 内 `highlight:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.decorationColor` | 装饰颜色 | renderer.js 内 `decorationColor:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.backToFormatting` | 返回格式操作 | renderer.js 内 `backToFormatting:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.openLink` | 打开链接 | renderer.js 内 `openLink:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.openLinkFailed` | 无法打开链接。 | renderer.js 内 `openLinkFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.colors.neutral` | 中性 | renderer.js 内 `neutral:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.colors.yellow` | 黄色 | renderer.js 内 `yellow:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.colors.orange` | 橙色 | renderer.js 内 `orange:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.colors.pink` | 粉色 | renderer.js 内 `pink:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.colors.purple` | 紫色 | renderer.js 内 `purple:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.colors.blue` | 蓝色 | renderer.js 内 `blue:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.colors.teal` | 青色 | renderer.js 内 `teal:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.quickNotes.colors.green` | 绿色 | renderer.js 内 `green:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.open` | 打开任务监控 | renderer.js 内 `open:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.title` | 任务监控 | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.linkedIssue` | 关联 Issue | renderer.js 内 `linkedIssue:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.empty` | 还没有有价值的内容 | renderer.js 内 `empty:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.emptyDescription` | 整个任务中产生的文件、网页和来源会持续汇总在这里，帮助跟踪任务进展。 | renderer.js 内 `emptyDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.loadFailed` | 任务监控暂时无法读取。 | renderer.js 内 `loadFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.pin` | 固定任务监控 | renderer.js 内 `pin:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.unpin` | 取消固定任务监控 | renderer.js 内 `unpin:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.switchToFloating` | 切换为 Floating 模式 | renderer.js 内 `switchToFloating:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.showFixed` | 显示任务监控 | renderer.js 内 `showFixed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.hideFixed` | 隐藏任务监控 | renderer.js 内 `hideFixed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.openSettings` | 前往设置 | renderer.js 内 `openSettings:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.retry` | 重试 | renderer.js 内 `retry:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.loadMore` | 加载更多 | renderer.js 内 `loadMore:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.loadingMore` | 正在加载… | renderer.js 内 `loadingMore:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.showMore` | 查看更多（{{count}}） | renderer.js 内 `showMore:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.showLess` | 收起 | renderer.js 内 `showLess:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.addSource` | 添加来源 | renderer.js 内 `addSource:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.addFile` | 添加文件 | renderer.js 内 `addFile:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.addLink` | 添加链接 | renderer.js 内 `addLink:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.removeSource` | 移除来源 {{name}} | renderer.js 内 `removeSource:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.memoryUpdated` | 记忆已更新 | renderer.js 内 `memoryUpdated:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.openMemorySettings` | 打开记忆设置 | renderer.js 内 `openMemorySettings:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.actionFailed` | 无法添加来源，请检查内容后重试。 | renderer.js 内 `actionFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.openSourceFileFailed` | 无法在 Qoder 中预览来源文件。 | renderer.js 内 `openSourceFileFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.title` | 任务回顾 | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.updatedAt` | 更新于 {{time}} | renderer.js 内 `updatedAt:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.expand` | 展开任务回顾 | renderer.js 内 `expand:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.moreActions` | 任务回顾更多操作 | renderer.js 内 `moreActions:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.menuItem` | 移交到新任务 | renderer.js 内 `menuItem:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.title` | 移交到新任务 | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.description` | 可以补充新任务要完成的工作，Qoder 会生成一份脱敏的临时交接文档。 | renderer.js 内 `description:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.previewDescription` | 检查交接内容后，可以在文件位置查看，或直接创建一个新任务继续工作。 | renderer.js 内 `previewDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.purposeLabel` | 交接目的 | renderer.js 内 `purposeLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.purposePlaceholder` | 例如：验证新的任务回顾生成逻辑，并补齐相关测试。 | renderer.js 内 `purposePlaceholder:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.generate` | 生成交接文档 | renderer.js 内 `generate:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.generating` | 正在生成… | renderer.js 内 `generating:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.waitingPreview` | 正在准备交接内容… | renderer.js 内 `waitingPreview:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.phase.collecting` | 正在整理任务回顾、相关文件和任务上下文… | renderer.js 内 `collecting:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.phase.generating` | 模型正在生成交接内容… | renderer.js 内 `generating:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.phase.finalizing` | 正在整理并写入临时交接文档… | renderer.js 内 `finalizing:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.phase.done` | 交接文档已生成。 | renderer.js 内 `done:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.generateFailed` | 无法生成交接文档，请稍后重试。 | renderer.js 内 `generateFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.revealFile` | 显示文件 | renderer.js 内 `revealFile:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.revealFailed` | 临时交接文件可能已被删除、移动或无法访问。检查文件后重试。 | renderer.js 内 `revealFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.createSession` | 创建新任务 | renderer.js 内 `createSession:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.creating` | 正在创建… | renderer.js 内 `creating:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.recap.handoff.createFailed` | 无法从交接文档创建新任务，请重试。 | renderer.js 内 `createFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.title` | 环境信息 | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.changes` | 变更 | renderer.js 内 `changes:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.noChanges` | 无变更 | renderer.js 内 `noChanges:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.local` | 本地 | renderer.js 内 `local:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.worktree` | Worktree | renderer.js 内 `worktree:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.executionModeSwitchUnavailable` | 已创建的任务暂不支持切换本地或 Worktree 模式 | renderer.js 内 `executionModeSwitchUnavailable:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.branch` | 分支 | renderer.js 内 `branch:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.switchBranch` | 检出分支 | renderer.js 内 `switchBranch:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.preserveChangesTitle` | 保存改动后检出分支？ | renderer.js 内 `preserveChangesTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.preserveChangesDescription` | Qoder 会临时存储当前改动，检出 {{branch}}，再恢复这些改动。如果分支内容冲突，需要手动解决。 | renderer.js 内 `preserveChangesDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.preserveChangesAction` | 保存改动并检出 | renderer.js 内 `preserveChangesAction:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.localServers` | 本地服务 | renderer.js 内 `localServers:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.localServersCount` | {{count}} 个 | renderer.js 内 `localServersCount:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.localServersUnavailable` | 不可用 | renderer.js 内 `localServersUnavailable:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.refreshLocalServers` | 刷新本地服务 | renderer.js 内 `refreshLocalServers:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.noLocalServers` | 没有正在运行的本地服务 | renderer.js 内 `noLocalServers:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.stopLocalServer` | 停止 {{name}} | renderer.js 内 `stopLocalServer:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.localServerOutsideWorkspace` | 非当前工作区服务，无法停止 | renderer.js 内 `localServerOutsideWorkspace:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.commitOrPush` | 提交或推送 | renderer.js 内 `commitOrPush:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.pullRequest` | 拉取请求 | renderer.js 内 `pullRequest:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.environment.pullRequestUnavailable` | 无法获取拉取请求状态 | renderer.js 内 `pullRequestUnavailable:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.group.artifact` | 产出 | renderer.js 内 `artifact:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.group.browser` | 网页查阅 | renderer.js 内 `browser:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.group.runtime` | 技能与 MCP | renderer.js 内 `runtime:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.group.source` | 来源 | renderer.js 内 `source:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.group.memory` | 记忆 | renderer.js 内 `memory:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.emptyGroup.artifact` | 暂无产出数据 :) | renderer.js 内 `artifact:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.emptyGroup.browser` | 暂无网页查阅数据 :) | renderer.js 内 `browser:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.emptyGroup.runtime` | 暂无技能与 MCP 数据 :) | renderer.js 内 `runtime:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.emptyGroup.source` | 暂无来源数据 :) | renderer.js 内 `source:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.emptyGroup.memory` | 暂无记忆数据 :) | renderer.js 内 `memory:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.status.running` | 执行中 | renderer.js 内 `running:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.status.waiting-user` | 等待回应 | renderer.js 内 `waiting-user:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.status.completed` | 已完成 | renderer.js 内 `completed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.status.failed` | 失败 | renderer.js 内 `failed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.status.interrupted` | 已中断 | renderer.js 内 `interrupted:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.linkDialog.title` | 添加链接 | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.linkDialog.description` | 将一个 HTTP 或 HTTPS 链接加入输入框，发送后会记录为来源。 | renderer.js 内 `description:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.linkDialog.label` | 链接地址 | renderer.js 内 `label:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.linkDialog.placeholder` | https://example.com | renderer.js 内 `placeholder:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.linkDialog.invalid` | 请输入以 http:// 或 https:// 开头的有效链接。 | renderer.js 内 `invalid:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.linkDialog.cancel` | 取消 | renderer.js 内 `cancel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.highlights.linkDialog.add` | 添加 | renderer.js 内 `add:"…"`（chatSessionResources 的 zh 段） |

### `composer.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `composer.referencePreview.description` | 复制已发送消息或划选完整标签，粘贴后再编辑、发送，检查引用是否保持一致。 | renderer.js 内 `description:"…"`（newChatResources 的 zh 段） |
| `composer.referencePreview.available` | 模拟能力可用 | renderer.js 内 `available:"…"`（newChatResources 的 zh 段） |
| `composer.referencePreview.message` | 已发送消息 | renderer.js 内 `message:"…"`（newChatResources 的 zh 段） |
| `composer.referencePreview.edit` | 编辑此消息 | renderer.js 内 `edit:"…"`（newChatResources 的 zh 段） |
| `composer.referencePreview.editor` | 能力引用输入框 | renderer.js 内 `editor:"…"`（newChatResources 的 zh 段） |
| `composer.referencePreview.placeholder` | 粘贴完整引用或输入 @名称… | renderer.js 内 `placeholder:"…"`（newChatResources 的 zh 段） |
| `composer.referencePreview.send` | 发送预览 | renderer.js 内 `send:"…"`（newChatResources 的 zh 段） |
| `composer.referencePreview.select` | 选择示例能力 | renderer.js 内 `select:"…"`（newChatResources 的 zh 段） |
| `composer.referencePreview.clear` | 新建输入 | renderer.js 内 `clear:"…"`（newChatResources 的 zh 段） |
| `composer.referencePreview.authorization` | 此预览不请求模型。标签展示不会新增执行授权。 | renderer.js 内 `authorization:"…"`（newChatResources 的 zh 段） |
| `composer.referencePreview.source` | 原始输入正文 | renderer.js 内 `source:"…"`（newChatResources 的 zh 段） |
| `composer.actions.addContext` | 添加上下文 | renderer.js 内 `addContext:"…"`（newChatResources 的 zh 段） |
| `composer.actions.add` | 添加 | renderer.js 内 `add:"…"`（newChatResources 的 zh 段） |
| `composer.actions.addAttachment` | 添加附件 | renderer.js 内 `addAttachment:"…"`（newChatResources 的 zh 段） |
| `composer.actions.addAttachmentTooltip` | 添加图片、文件和文件夹 | renderer.js 内 `addAttachmentTooltip:"…"`（newChatResources 的 zh 段） |
| `composer.actions.addFile` | 添加文件 | renderer.js 内 `addFile:"…"`（newChatResources 的 zh 段） |
| `composer.actions.addFolder` | 添加文件夹 | renderer.js 内 `addFolder:"…"`（newChatResources 的 zh 段） |
| `composer.actions.workspaceFiles` | 工作区文件 | renderer.js 内 `workspaceFiles:"…"`（newChatResources 的 zh 段） |
| `composer.actions.workspaceFileSearchLabel` | 搜索当前项目文件 | renderer.js 内 `workspaceFileSearchLabel:"…"`（newChatResources 的 zh 段） |
| `composer.actions.workspaceFileSearchPlaceholder` | 搜索当前项目文件 | renderer.js 内 `workspaceFileSearchPlaceholder:"…"`（newChatResources 的 zh 段） |
| `composer.actions.workspaceFilesLoading` | 正在加载文件… | renderer.js 内 `workspaceFilesLoading:"…"`（newChatResources 的 zh 段） |
| `composer.actions.workspaceFilesSearching` | 正在搜索文件… | renderer.js 内 `workspaceFilesSearching:"…"`（newChatResources 的 zh 段） |
| `composer.actions.workspaceFilesLoadFailed` | 项目文件暂时无法加载 | renderer.js 内 `workspaceFilesLoadFailed:"…"`（newChatResources 的 zh 段） |
| `composer.actions.workspaceFilesUnavailable` | 当前任务没有可浏览的工作区 | renderer.js 内 `workspaceFilesUnavailable:"…"`（newChatResources 的 zh 段） |
| `composer.actions.workspaceFilesEmpty` | 当前目录没有文件 | renderer.js 内 `workspaceFilesEmpty:"…"`（newChatResources 的 zh 段） |
| `composer.actions.workspaceFilesSearchEmpty` | 未找到匹配的项目文件 | renderer.js 内 `workspaceFilesSearchEmpty:"…"`（newChatResources 的 zh 段） |
| `composer.actions.workspaceFilesParent` | 返回上级目录 | renderer.js 内 `workspaceFilesParent:"…"`（newChatResources 的 zh 段） |
| `composer.actions.workspaceFilesRoots` | 返回工作区列表 | renderer.js 内 `workspaceFilesRoots:"…"`（newChatResources 的 zh 段） |
| `composer.actions.workspaceFileTreeLabel` | 工作区文件列表 | renderer.js 内 `workspaceFileTreeLabel:"…"`（newChatResources 的 zh 段） |
| `composer.actions.expandFolder` | 展开 {{name}} | renderer.js 内 `expandFolder:"…"`（newChatResources 的 zh 段） |
| `composer.actions.collapseFolder` | 收起 {{name}} | renderer.js 内 `collapseFolder:"…"`（newChatResources 的 zh 段） |
| `composer.actions.enterFolder` | 进入 {{name}} | renderer.js 内 `enterFolder:"…"`（newChatResources 的 zh 段） |
| `composer.actions.plugin` | 插件 | renderer.js 内 `plugin:"…"`（newChatResources 的 zh 段） |
| `composer.actions.pluginLoading` | 正在加载插件… | renderer.js 内 `pluginLoading:"…"`（newChatResources 的 zh 段） |
| `composer.actions.pluginLoadFailed` | 插件暂时无法加载 | renderer.js 内 `pluginLoadFailed:"…"`（newChatResources 的 zh 段） |
| `composer.actions.pluginUnavailable` | 当前上下文暂不支持插件 | renderer.js 内 `pluginUnavailable:"…"`（newChatResources 的 zh 段） |
| `composer.actions.pluginEmpty` | 暂无可用插件 | renderer.js 内 `pluginEmpty:"…"`（newChatResources 的 zh 段） |
| `composer.actions.pluginSearchLabel` | 搜索插件 | renderer.js 内 `pluginSearchLabel:"…"`（newChatResources 的 zh 段） |
| `composer.actions.pluginSearchPlaceholder` | 搜索插件 | renderer.js 内 `pluginSearchPlaceholder:"…"`（newChatResources 的 zh 段） |
| `composer.actions.pluginSearchEmpty` | 未找到匹配的插件 | renderer.js 内 `pluginSearchEmpty:"…"`（newChatResources 的 zh 段） |
| `composer.actions.managePlugins` | 管理插件 | renderer.js 内 `managePlugins:"…"`（newChatResources 的 zh 段） |
| `composer.actions.exploreMorePlugins` | 探索更多插件 | renderer.js 内 `exploreMorePlugins:"…"`（newChatResources 的 zh 段） |
| `composer.actions.pluginEnabled` | 当前任务已启用 | renderer.js 内 `pluginEnabled:"…"`（newChatResources 的 zh 段） |
| `composer.actions.pluginSelected` | 插件 {{plugin}} 已选择 | renderer.js 内 `pluginSelected:"…"`（newChatResources 的 zh 段） |
| `composer.actions.summonWaker` | 唤起 Waker | renderer.js 内 `summonWaker:"…"`（newChatResources 的 zh 段） |
| `composer.actions.skill` | 技能 | renderer.js 内 `skill:"…"`（newChatResources 的 zh 段） |
| `composer.actions.browser` | 浏览器 | renderer.js 内 `browser:"…"`（newChatResources 的 zh 段） |
| `composer.actions.recordingNote` | 录音纪要 | renderer.js 内 `recordingNote:"…"`（newChatResources 的 zh 段） |
| `composer.actions.recordingNoteLiveVoiceUnavailable` | Live Voice 任务中不可使用录音纪要 | renderer.js 内 `recordingNoteLiveVoiceUnavailable:"…"`（newChatResources 的 zh 段） |
| `composer.actions.recordingNoteCreateFailed` | 无法创建录音纪要，请重试。 | renderer.js 内 `recordingNoteCreateFailed:"…"`（newChatResources 的 zh 段） |
| `composer.actions.betaTag` | Beta | renderer.js 内 `betaTag:"…"`（newChatResources 的 zh 段） |
| `composer.actions.polishPrompt` | 润色提示词 | renderer.js 内 `polishPrompt:"…"`（newChatResources 的 zh 段） |
| `composer.actions.polishPromptFailed` | 暂时无法润色提示词，草稿已保留。 | renderer.js 内 `polishPromptFailed:"…"`（newChatResources 的 zh 段） |
| `composer.actions.polishPromptRestartRequired` | 提示词润色需要重启 Qoder 后生效，草稿已保留。 | renderer.js 内 `polishPromptRestartRequired:"…"`（newChatResources 的 zh 段） |
| `composer.actions.unavailable` | 稍后接入 | renderer.js 内 `unavailable:"…"`（newChatResources 的 zh 段） |
| `composer.actions.attachmentLimitReached` | 附件已达 20 个，请先移除一个附件。 | renderer.js 内 `attachmentLimitReached:"…"`（newChatResources 的 zh 段） |
| `composer.actions.quickNotePasteInvalidPayload` | 复制的速记板数据无法识别。 | renderer.js 内 `quickNotePasteInvalidPayload:"…"`（newChatResources 的 zh 段） |
| `composer.actions.quickNotePasteUnsupportedFormat` | 复制的速记板包含不支持的图片格式。 | renderer.js 内 `quickNotePasteUnsupportedFormat:"…"`（newChatResources 的 zh 段） |
| `composer.actions.quickNotePasteInvalidImage` | 复制的速记板图片数据不完整。 | renderer.js 内 `quickNotePasteInvalidImage:"…"`（newChatResources 的 zh 段） |
| `composer.actions.quickNotePasteTooManyImages` | 每条速记最多包含 5 张图片。 | renderer.js 内 `quickNotePasteTooManyImages:"…"`（newChatResources 的 zh 段） |
| `composer.actions.quickNotePasteInvalidSize` | 复制的速记板包含大小无效的图片。 | renderer.js 内 `quickNotePasteInvalidSize:"…"`（newChatResources 的 zh 段） |
| `composer.actions.quickNotePasteTotalSize` | 复制的速记板图片总大小超过 20 MB。 | renderer.js 内 `quickNotePasteTotalSize:"…"`（newChatResources 的 zh 段） |
| `composer.actions.quickNotePasteIncomplete` | 无法完整粘贴这条速记，请先移除部分附件后重试。 | renderer.js 内 `quickNotePasteIncomplete:"…"`（newChatResources 的 zh 段） |
| `composer.actions.skillLoading` | 正在加载 Skill… | renderer.js 内 `skillLoading:"…"`（newChatResources 的 zh 段） |
| `composer.actions.skillLoadFailed` | Skill 暂时无法加载 | renderer.js 内 `skillLoadFailed:"…"`（newChatResources 的 zh 段） |
| `composer.actions.skillUnavailable` | 当前上下文暂不支持选择 Skill | renderer.js 内 `skillUnavailable:"…"`（newChatResources 的 zh 段） |
| `composer.actions.skillEmpty` | 暂无可用 Skill | renderer.js 内 `skillEmpty:"…"`（newChatResources 的 zh 段） |
| `composer.actions.skillSearchLabel` | 搜索 Skill | renderer.js 内 `skillSearchLabel:"…"`（newChatResources 的 zh 段） |
| `composer.actions.skillSearchPlaceholder` | 搜索技能 | renderer.js 内 `skillSearchPlaceholder:"…"`（newChatResources 的 zh 段） |
| `composer.actions.skillSearchEmpty` | 未找到匹配的 Skill | renderer.js 内 `skillSearchEmpty:"…"`（newChatResources 的 zh 段） |
| `composer.actions.manageSkills` | 管理技能 | renderer.js 内 `manageSkills:"…"`（newChatResources 的 zh 段） |
| `composer.actions.exploreMoreSkills` | 探索更多技能 | renderer.js 内 `exploreMoreSkills:"…"`（newChatResources 的 zh 段） |
| `composer.actions.skillSelected` | Skill {{skill}} 已选择 | renderer.js 内 `skillSelected:"…"`（newChatResources 的 zh 段） |
| `composer.attachments.dropFiles` | 松开以添加文件或文件夹 | renderer.js 内 `dropFiles:"…"`（newChatResources 的 zh 段） |
| `composer.attachments.pastedText` | 粘贴的文本 | renderer.js 内 `pastedText:"…"`（newChatResources 的 zh 段） |
| `composer.attachments.selectedText` | 选中的文本 | renderer.js 内 `selectedText:"…"`（newChatResources 的 zh 段） |
| `composer.attachments.convertToText` | 转为文字 | renderer.js 内 `convertToText:"…"`（newChatResources 的 zh 段） |
| `composer.attachments.previewImage` | 预览图片 {{name}} | renderer.js 内 `previewImage:"…"`（newChatResources 的 zh 段） |
| `composer.attachments.imageAlt` | 图片附件：{{name}} | renderer.js 内 `imageAlt:"…"`（newChatResources 的 zh 段） |
| `composer.attachments.removeAttachment` | 移除附件 {{name}} | renderer.js 内 `removeAttachment:"…"`（newChatResources 的 zh 段） |
| `composer.attachments.addError` | 无法添加附件。 | renderer.js 内 `addError:"…"`（newChatResources 的 zh 段） |
| `composer.attachments.unsupportedFolder` | 当前会话不支持文件夹附件，请选择文件。 | renderer.js 内 `unsupportedFolder:"…"`（newChatResources 的 zh 段） |
| `composer.attachments.unsupportedImage` | 不支持该图片格式，仅支持 PNG、JPG、GIF 和 WebP 图片。 | renderer.js 内 `unsupportedImage:"…"`（newChatResources 的 zh 段） |
| `composer.attachments.removeInvalid` | 请先移除不可用的附件。 | renderer.js 内 `removeInvalid:"…"`（newChatResources 的 zh 段） |
| `composer.attachments.requiresSession` | 请先创建任务，再在任务中添加附件。 | renderer.js 内 `requiresSession:"…"`（newChatResources 的 zh 段） |
| `composer.attachments.dropError` | 无法读取拖入的文件或文件夹。 | renderer.js 内 `dropError:"…"`（newChatResources 的 zh 段） |
| `composer.chatSessionDrop.prompt` | 松开以引用会话 | renderer.js 内 `prompt:"…"`（newChatResources 的 zh 段） |
| `composer.chatSessionDrop.disabled` | 输入框当前不可编辑，暂时无法引用会话。 | renderer.js 内 `disabled:"…"`（newChatResources 的 zh 段） |
| `composer.chatSessionDrop.loading` | 正在确认会话引用能力，请稍后重试。 | renderer.js 内 `loading:"…"`（newChatResources 的 zh 段） |
| `composer.chatSessionDrop.unsupported` | 当前会话不支持引用其他会话。 | renderer.js 内 `unsupported:"…"`（newChatResources 的 zh 段） |
| `composer.chatSessionDrop.self` | 不能引入当前会话自身 | renderer.js 内 `self:"…"`（newChatResources 的 zh 段） |
| `composer.chatSessionDrop.unavailable` | 该会话不可引用，请选择未归档的独立会话。 | renderer.js 内 `unavailable:"…"`（newChatResources 的 zh 段） |
| `composer.chatSessionDrop.duplicate` | 已引用该会话，无需重复添加。 | renderer.js 内 `duplicate:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.ariaLabel` | {{trigger}} 任务、Skill、插件、连接器、Agent 和文件建议 | renderer.js 内 `ariaLabel:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.loading` | 正在加载任务、Skill、插件、连接器、Agent 和文件… | renderer.js 内 `loading:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.empty` | 未找到匹配的任务、Skill、插件、连接器、Agent 或文件 | renderer.js 内 `empty:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.pickFile` | 选择文件 | renderer.js 内 `pickFile:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.pickFolder` | 选择文件夹 | renderer.js 内 `pickFolder:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.automationPluginDescription` | 创建在自动化任务中运行的定时任务 | renderer.js 内 `automationPluginDescription:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.goalMode` | 目标 | renderer.js 内 `goalMode:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.planMode` | 计划 | renderer.js 内 `planMode:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.selectedMode` | {{label}}，已启用 | renderer.js 内 `selectedMode:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.skillNoDescription` | 暂无描述 | renderer.js 内 `skillNoDescription:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.skillSource` | 来源：{{source}} | renderer.js 内 `skillSource:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.pluginNoDescription` | 暂无描述 | renderer.js 内 `pluginNoDescription:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.pluginId` | 插件 ID：{{id}} | renderer.js 内 `pluginId:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.connectorNoDescription` | 暂无描述 | renderer.js 内 `connectorNoDescription:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.connectorDescription.pluginWithProvider` | 由 {{provider}} 插件提供的 MCP Server | renderer.js 内 `pluginWithProvider:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.connectorDescription.plugin` | 由插件提供的 MCP Server | renderer.js 内 `plugin:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.connectorDescription.marketWithProvider` | 由 {{provider}} 提供的 MCP Server | renderer.js 内 `marketWithProvider:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.connectorDescription.market` | 来自扩展市场的 MCP Server | renderer.js 内 `market:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.connectorDescription.userLocal` | 用户配置的本地 MCP Server | renderer.js 内 `userLocal:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.connectorDescription.userRemote` | 用户配置的远程 MCP Server | renderer.js 内 `userRemote:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.connectorDescription.user` | 用户配置的 MCP Server | renderer.js 内 `user:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.connectorDescription.projectLocal` | 当前项目配置的本地 MCP Server | renderer.js 内 `projectLocal:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.connectorDescription.projectRemote` | 当前项目配置的远程 MCP Server | renderer.js 内 `projectRemote:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.connectorDescription.project` | 当前项目配置的 MCP Server | renderer.js 内 `project:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.connectorDescription.builtin` | Qoder 内置 MCP Server | renderer.js 内 `builtin:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.connectorDescription.generic` | MCP Server | renderer.js 内 `generic:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.connectorSource` | 连接器来源：{{source}} | renderer.js 内 `connectorSource:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.agentNoDescription` | 暂无描述 | renderer.js 内 `agentNoDescription:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.agentSource` | Agent 来源：{{source}} | renderer.js 内 `agentSource:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.chatSessionNoDescription` | Qoder 任务 | renderer.js 内 `chatSessionNoDescription:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.chatSessionError` | 任务搜索暂时不可用，仍可继续选择其他上下文。 | renderer.js 内 `chatSessionError:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.chatSessionLimit` | 一条消息最多引用 {{count}} 个任务。 | renderer.js 内 `chatSessionLimit:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.skillError` | 扩展能力暂时无法加载，仍可继续使用文件建议。 | renderer.js 内 `skillError:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.fileError` | Workspace 文件暂时无法加载，仍可继续选择扩展能力。 | renderer.js 内 `fileError:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.partialErrorAll` | 扩展能力和 Workspace 文件暂时无法加载。 | renderer.js 内 `partialErrorAll:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.removeSkill` | 移除 Skill {{skill}} | renderer.js 内 `removeSkill:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.unavailableReference` | {{name}}（不可用） | renderer.js 内 `unavailableReference:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.skillTag` | Skill {{skill}} | renderer.js 内 `skillTag:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.pluginTag` | 插件 {{plugin}} | renderer.js 内 `pluginTag:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.connectorTag` | 连接器 {{name}} | renderer.js 内 `connectorTag:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.agentTag` | Agent {{name}} | renderer.js 内 `agentTag:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.chatSessionTag` | 任务 {{title}} | renderer.js 内 `chatSessionTag:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.issueReferenceTag` | Issue {{identifier}} | renderer.js 内 `issueReferenceTag:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.fileTag` | 项目文件 {{file}} | renderer.js 内 `fileTag:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.removedUnavailableSkills` | 已移除当前上下文中不可用的 Skill：{{skills}} | renderer.js 内 `removedUnavailableSkills:"…"`（newChatResources 的 zh 段） |
| `composer.suggestion.hint` | ↑↓ 选择 · Enter/Tab 添加 · Esc 关闭 | renderer.js 内 `hint:"…"`（newChatResources 的 zh 段） |

### `newChat.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `newChat.bindIssue` | 绑定 Issue | renderer.js 内 `bindIssue:"…"`（newChatResources 的 zh 段） |
| `newChat.changeIssue` | 更换已绑定的 Issue {{identifier}} | renderer.js 内 `changeIssue:"…"`（newChatResources 的 zh 段） |
| `newChat.searchIssues` | 搜索 Issue 标识、标题或项目 | renderer.js 内 `searchIssues:"…"`（newChatResources 的 zh 段） |
| `newChat.unbindIssue` | 改为独立任务 | renderer.js 内 `unbindIssue:"…"`（newChatResources 的 zh 段） |
| `newChat.noIssues` | 还没有可以绑定的 Issue | renderer.js 内 `noIssues:"…"`（newChatResources 的 zh 段） |
| `newChat.noMatchingIssues` | 没有匹配的 Issue | renderer.js 内 `noMatchingIssues:"…"`（newChatResources 的 zh 段） |

## 11 队列·转向·中断 / 输入区状态

_条目数：225_

### `chatActivity.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatActivity.turnInterrupted` | Qoder 的回复已被你终止。 | renderer.js 内 `turnInterrupted:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.turnFailed` | 这轮回复失败。查看错误详情后重试。 | renderer.js 内 `turnFailed:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.retryTurn` | 重试 | renderer.js 内 `retryTurn:"…"`（chatTimelineResources 的 zh 段） |
| `chatActivity.retryingTurn` | 正在重试... | renderer.js 内 `retryingTurn:"…"`（chatTimelineResources 的 zh 段） |

### `chatQueue.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatQueue.title` | {{count}} 条消息排队中 | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.attachmentOnly` | 附件消息 | renderer.js 内 `attachmentOnly:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.message` | 排队消息 | renderer.js 内 `message:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.voiceRequest` | 语音请求 | renderer.js 内 `voiceRequest:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.sendNowLabel` | 插队 | renderer.js 内 `sendNowLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.sendNowTip` | 移到队首，成为下一条执行的消息 | renderer.js 内 `sendNowTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.steerLabel` | 插话 | renderer.js 内 `steerLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.steerTip` | 在下一个安全执行边界交给 Agent，不停止当前执行；运行中可在输入框按 {{shortcut}} 直接插话 | renderer.js 内 `steerTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.steerUnsupportedTip` | 当前 Runtime 不支持插话，消息将继续排队 | renderer.js 内 `steerUnsupportedTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.steerWaitingTip` | 先处理 Agent 正在等待的请求，再发送插话 | renderer.js 内 `steerWaitingTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.steerInactiveTip` | 当前没有运行中的 Turn，消息将继续排队 | renderer.js 内 `steerInactiveTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.steerControlCommandTip` | 压缩上下文会在当前 Turn 完成后执行，不能插入正在运行的 Turn | renderer.js 内 `steerControlCommandTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.steerQueueChangedTip` | 排队消息已发生变化，请确认当前队列 | renderer.js 内 `steerQueueChangedTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.steeringLabel` | 正在发送插话 | renderer.js 内 `steeringLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.steerDeferred` | 未发送插话 | renderer.js 内 `steerDeferred:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.steerFailed` | 无法发送插话 | renderer.js 内 `steerFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.interruptAndRunLabel` | 打断并执行 | renderer.js 内 `interruptAndRunLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.interruptAndRunTip` | 停止当前任务，并将这条排队任务作为新的 Turn 立即执行 | renderer.js 内 `interruptAndRunTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.interruptAndRunInactiveTip` | 当前没有可打断的任务，这条任务会按队列顺序执行 | renderer.js 内 `interruptAndRunInactiveTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.interruptAndRunUnsupportedTip` | 当前 Runtime 不支持打断并执行，任务将继续排队 | renderer.js 内 `interruptAndRunUnsupportedTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.interruptAndRunControlCommandTip` | 压缩上下文不能打断当前任务执行 | renderer.js 内 `interruptAndRunControlCommandTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.interruptAndRunSourceMismatchTip` | 这不是语音 Agent 委派的任务，将继续按普通任务处理 | renderer.js 内 `interruptAndRunSourceMismatchTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.interruptAndRunQueueChangedTip` | 排队任务已发生变化，请确认当前队列 | renderer.js 内 `interruptAndRunQueueChangedTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.interruptingAndRunningLabel` | 正在打断当前任务 | renderer.js 内 `interruptingAndRunningLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.interruptAndRunDeferred` | 任务仍在排队 | renderer.js 内 `interruptAndRunDeferred:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.interruptAndRunFailed` | 无法打断并执行 | renderer.js 内 `interruptAndRunFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.editTip` | 撤回到输入框编辑 | renderer.js 内 `editTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.removeTip` | 移除消息 | renderer.js 内 `removeTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.moreTip` | 更多操作 | renderer.js 内 `moreTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.dragTip` | 拖动调整排队顺序；聚焦后可使用上下方向键 | renderer.js 内 `dragTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.removeFailed` | 无法移除排队消息 | renderer.js 内 `removeFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.withdrawUnavailable` | 未撤回排队消息 | renderer.js 内 `withdrawUnavailable:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.withdrawQueueChangedTip` | 这条消息已经离开队列，输入框保持不变 | renderer.js 内 `withdrawQueueChangedTip:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.withdrawFailed` | 无法撤回排队消息 | renderer.js 内 `withdrawFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.reorderFailed` | 无法调整排队顺序 | renderer.js 内 `reorderFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.file` | 个附件 | renderer.js 内 `file:"…"`（chatSessionResources 的 zh 段） |
| `chatQueue.files` | 个附件 | renderer.js 内 `files:"…"`（chatSessionResources 的 zh 段） |

### `chatSession.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatSession.composer.referencePreview.description` | Copy the message or select a complete tag, paste it, then edit and send to verify reference consistency. | renderer.js 内 `description:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.referencePreview.available` | Simulate available capabilities | renderer.js 内 `available:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.referencePreview.message` | Sent message | renderer.js 内 `message:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.referencePreview.edit` | Edit this message | renderer.js 内 `edit:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.referencePreview.editor` | Capability reference input | renderer.js 内 `editor:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.referencePreview.placeholder` | Paste a complete reference or type @name… | renderer.js 内 `placeholder:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.referencePreview.send` | Send preview | renderer.js 内 `send:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.referencePreview.select` | Select sample capabilities | renderer.js 内 `select:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.referencePreview.clear` | New input | renderer.js 内 `clear:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.referencePreview.authorization` | This preview does not call a model. Displaying a tag does not grant execution permission. | renderer.js 内 `authorization:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.referencePreview.source` | Original input text | renderer.js 内 `source:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.modelSwitchFailed` | 模型切换失败，请重试。 | renderer.js 内 `modelSwitchFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.permissionSwitchFailed` | 访问权限切换失败，请重试。 | renderer.js 内 `permissionSwitchFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.stopFailed` | 停止当前生成失败，请稍后重试。 | renderer.js 内 `stopFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.issueUpdateFailed` | Issue 引用更新失败 | renderer.js 内 `issueUpdateFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.referenceIssue` | 引用 Issue | renderer.js 内 `referenceIssue:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.referenceIssueTitle` | 引用一个 Issue | renderer.js 内 `referenceIssueTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.referenceIssueDescription` | 将 Issue 作为这段私人任务的上下文，不会修改执行目标或自动写回 Issue。 | renderer.js 内 `referenceIssueDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.changeIssueReference` | 更换引用的 Issue {{identifier}} | renderer.js 内 `changeIssueReference:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.removeIssueReference` | 移除 Issue 引用 | renderer.js 内 `removeIssueReference:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.noIssuesAvailable` | 还没有可以引用的 Issue | renderer.js 内 `noIssuesAvailable:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.tryLater` | 请稍后重试。 | renderer.js 内 `tryLater:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.followupSuggestions` | 后续建议 | renderer.js 内 `followupSuggestions:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.sendMessage` | 发送任务消息 | renderer.js 内 `sendMessage:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.placeholder` | 继续这个任务… | renderer.js 内 `placeholder:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.workDirectoryUpdateFailed` | 工作目录更新失败 | renderer.js 内 `workDirectoryUpdateFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.currentContext` | 当前任务上下文 | renderer.js 内 `currentContext:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.noWorkDirectory` | 未选择工作目录 | renderer.js 内 `noWorkDirectory:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.composer.workDirectoryFallback` | 工作目录 | renderer.js 内 `workDirectoryFallback:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.actions` | 回复操作 | renderer.js 内 `actions:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.copyText` | 复制文本 | renderer.js 内 `copyText:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.copied` | 已复制 | renderer.js 内 `copied:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.copiedText` | 已复制文本 | renderer.js 内 `copiedText:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.copyMarkdown` | 复制 Markdown | renderer.js 内 `copyMarkdown:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.copiedMarkdown` | 已复制 Markdown | renderer.js 内 `copiedMarkdown:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.addToChat` | 添加回复到任务 | renderer.js 内 `addToChat:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.attachmentName` | Agent 回复.md | renderer.js 内 `attachmentName:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.attachmentLimitReached` | 附件已达 20 个，请先移除一个再添加这条回复。 | renderer.js 内 `attachmentLimitReached:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.createBranchSessionHere` | 从此处创建新的分支任务 | renderer.js 内 `createBranchSessionHere:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.createBranchSessionFromReply` | 从这条回复创建新的分支任务 | renderer.js 内 `createBranchSessionFromReply:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.creatingBranchSession` | 正在创建分支任务… | renderer.js 内 `creatingBranchSession:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.creatingBranchSessionLabel` | 正在创建分支任务 | renderer.js 内 `creatingBranchSessionLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.createBranchSessionAfterRun` | 任务运行结束后可创建分支任务 | renderer.js 内 `createBranchSessionAfterRun:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.moreActions` | 更多回复操作 | renderer.js 内 `moreActions:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.helpful` | 有帮助 | renderer.js 内 `helpful:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.notHelpful` | 没帮助 | renderer.js 内 `notHelpful:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.hookSummaryTitle` | 钩子 · {{count}} | renderer.js 内 `hookSummaryTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.hookSummaryRepeated` | {{event}} × {{count}} | renderer.js 内 `hookSummaryRepeated:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.hookSummaryLabel` | {{count}} 个钩子：{{summary}} | renderer.js 内 `hookSummaryLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.resultStatus` | 状态： | renderer.js 内 `resultStatus:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.resultDuration` | 耗时： | renderer.js 内 `resultDuration:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.resultTurns` | 模型迭代： | renderer.js 内 `resultTurns:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.resultSuccess` | 成功 | renderer.js 内 `resultSuccess:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.resultFailed` | 失败 | renderer.js 内 `resultFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.resultInterrupted` | 已中断 | renderer.js 内 `resultInterrupted:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.resultRunning` | 执行中 | renderer.js 内 `resultRunning:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.resultSummaryLabel` | 状态：{{status}}，耗时：{{duration}}，模型迭代：{{count}} | renderer.js 内 `resultSummaryLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.messageActions.aiGeneratedDisclosure` | 由 AI 生成 | renderer.js 内 `aiGeneratedDisclosure:"…"`（chatSessionResources 的 zh 段） |

### `composer.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `composer.resizeHeight` | 调整输入框高度 | renderer.js 内 `resizeHeight:"…"`（newChatResources 的 zh 段） |
| `composer.defaultPlaceholder` | 描述你希望 Agent 完成的任务 | renderer.js 内 `defaultPlaceholder:"…"`（newChatResources 的 zh 段） |
| `composer.expandedPlaceholder` | My dear Qoder... | renderer.js 内 `expandedPlaceholder:"…"`（newChatResources 的 zh 段） |
| `composer.liveVoice.errors.permission` | 无法使用麦克风，请在系统设置中允许 Qoder 访问麦克风。 | renderer.js 内 `permission:"…"`（newChatResources 的 zh 段） |
| `composer.liveVoice.errors.noMicrophone` | 未找到可用的麦克风，请连接设备后重试。 | renderer.js 内 `noMicrophone:"…"`（newChatResources 的 zh 段） |
| `composer.liveVoice.errors.unreadable` | 麦克风无法读取，可能正被其他应用占用，请关闭占用后重试。 | renderer.js 内 `unreadable:"…"`（newChatResources 的 zh 段） |
| `composer.liveVoice.errors.startFailed` | 无法开始实时语音，请重试。 | renderer.js 内 `startFailed:"…"`（newChatResources 的 zh 段） |
| `composer.liveVoice.errors.historyRestoreFailed` | 无法恢复语音会话历史，请重试。 | renderer.js 内 `historyRestoreFailed:"…"`（newChatResources 的 zh 段） |
| `composer.liveVoice.errors.noResponseTimeout` | 语音会话长时间空闲，已自动结束。如需继续，可点击语音按钮重新发起。 | renderer.js 内 `noResponseTimeout:"…"`（newChatResources 的 zh 段） |
| `composer.liveVoice.errors.userIdleTimeout` | 长时间未收到语音输入，会话已自动结束。重新开始即可继续。 | renderer.js 内 `userIdleTimeout:"…"`（newChatResources 的 zh 段） |
| `composer.liveVoice.errors.contentUnavailable` | 本次内容无法处理，语音会话已结束。可以重新开始，换个话题继续。 | renderer.js 内 `contentUnavailable:"…"`（newChatResources 的 zh 段） |
| `composer.liveVoice.errors.serviceUnavailable` | 语音服务暂时不可用，会话已结束。稍后重新开始。 | renderer.js 内 `serviceUnavailable:"…"`（newChatResources 的 zh 段） |
| `composer.liveVoice.errors.requestFailed` | 语音请求处理失败，会话已结束。重新开始后重试。 | renderer.js 内 `requestFailed:"…"`（newChatResources 的 zh 段） |
| `composer.liveVoice.errors.resumeFailed` | 无法重新打开麦克风。 | renderer.js 内 `resumeFailed:"…"`（newChatResources 的 zh 段） |
| `composer.liveVoice.errors.recordingNoteConflict` | 录音纪要进行中，结束后才能开始实时语音。 | renderer.js 内 `recordingNoteConflict:"…"`（newChatResources 的 zh 段） |
| `composer.liveVoice.errors.voiceConflict` | 其他语音功能正在使用麦克风，结束后才能开始实时语音。 | renderer.js 内 `voiceConflict:"…"`（newChatResources 的 zh 段） |
| `composer.recordingNoteInputBlocked` | 录音纪要进行中，结束后才能输入或发起其他语音功能。 | renderer.js 内 `recordingNoteInputBlocked:"…"`（newChatResources 的 zh 段） |
| `composer.contextMenu.undo` | 撤销 | renderer.js 内 `undo:"…"`（newChatResources 的 zh 段） |
| `composer.contextMenu.redo` | 重做 | renderer.js 内 `redo:"…"`（newChatResources 的 zh 段） |
| `composer.contextMenu.cut` | 剪切 | renderer.js 内 `cut:"…"`（newChatResources 的 zh 段） |
| `composer.contextMenu.copy` | 复制 | renderer.js 内 `copy:"…"`（newChatResources 的 zh 段） |
| `composer.contextMenu.paste` | 粘贴 | renderer.js 内 `paste:"…"`（newChatResources 的 zh 段） |
| `composer.contextMenu.selectAll` | 全选 | renderer.js 内 `selectAll:"…"`（newChatResources 的 zh 段） |
| `composer.contextMenu.clipboardUnavailable` | 当前环境无法访问剪贴板。 | renderer.js 内 `clipboardUnavailable:"…"`（newChatResources 的 zh 段） |
| `composer.contextMenu.failed` | 操作失败，请重试。 | renderer.js 内 `failed:"…"`（newChatResources 的 zh 段） |
| `composer.voice.openSystemSettings` | 打开系统设置 | renderer.js 内 `openSystemSettings:"…"`（newChatResources 的 zh 段） |
| `composer.voice.polishing` | 正在润色语音输入 | renderer.js 内 `polishing:"…"`（newChatResources 的 zh 段） |
| `composer.voice.start` | 开始语音输入 | renderer.js 内 `start:"…"`（newChatResources 的 zh 段） |
| `composer.voice.holdPlaceholder` | 长按鼠标语音输入文字 | renderer.js 内 `holdPlaceholder:"…"`（newChatResources 的 zh 段） |
| `composer.voice.stop` | 停止语音输入 | renderer.js 内 `stop:"…"`（newChatResources 的 zh 段） |
| `composer.voice.liveStart` | 开始实时语音 | renderer.js 内 `liveStart:"…"`（newChatResources 的 zh 段） |
| `composer.voice.liveStop` | 结束实时语音 | renderer.js 内 `liveStop:"…"`（newChatResources 的 zh 段） |
| `composer.voice.recordingNoteConflict` | 录音纪要进行中，结束后才能使用语音输入。 | renderer.js 内 `recordingNoteConflict:"…"`（newChatResources 的 zh 段） |
| `composer.voice.voiceConflict` | 其他语音功能正在使用麦克风，结束后才能使用语音输入。 | renderer.js 内 `voiceConflict:"…"`（newChatResources 的 zh 段） |
| `composer.voice.errors.permission` | 无法使用麦克风，请在系统设置中允许 Qoder 访问麦克风。 | renderer.js 内 `permission:"…"`（newChatResources 的 zh 段） |
| `composer.voice.errors.noMicrophone` | 未找到可用的麦克风，请连接设备后重试。 | renderer.js 内 `noMicrophone:"…"`（newChatResources 的 zh 段） |
| `composer.voice.errors.unreadable` | 麦克风无法读取，可能正被其他应用占用，请关闭占用后重试。 | renderer.js 内 `unreadable:"…"`（newChatResources 的 zh 段） |
| `composer.voice.errors.startFailed` | 无法开始语音输入，请重试。 | renderer.js 内 `startFailed:"…"`（newChatResources 的 zh 段） |
| `composer.voice.overlay.ariaLabel` | 实时语音浮窗 | renderer.js 内 `ariaLabel:"…"`（newChatResources 的 zh 段） |
| `composer.voice.overlay.connecting` | 正在连接 | renderer.js 内 `connecting:"…"`（newChatResources 的 zh 段） |
| `composer.voice.overlay.listening` | 正在聆听 | renderer.js 内 `listening:"…"`（newChatResources 的 zh 段） |
| `composer.voice.overlay.thinking` | 思考中 | renderer.js 内 `thinking:"…"`（newChatResources 的 zh 段） |
| `composer.voice.overlay.working` | 执行中 | renderer.js 内 `working:"…"`（newChatResources 的 zh 段） |
| `composer.voice.overlay.speaking` | 正在回答 | renderer.js 内 `speaking:"…"`（newChatResources 的 zh 段） |
| `composer.voice.overlay.error` | 连接异常 | renderer.js 内 `error:"…"`（newChatResources 的 zh 段） |
| `composer.voice.overlay.microphoneOff` | 麦克风已关闭 | renderer.js 内 `microphoneOff:"…"`（newChatResources 的 zh 段） |
| `composer.voice.overlay.openChat` | 返回当前任务 | renderer.js 内 `openChat:"…"`（newChatResources 的 zh 段） |
| `composer.voice.overlay.enableMicrophone` | 打开麦克风 | renderer.js 内 `enableMicrophone:"…"`（newChatResources 的 zh 段） |
| `composer.voice.overlay.disableMicrophone` | 关闭麦克风 | renderer.js 内 `disableMicrophone:"…"`（newChatResources 的 zh 段） |
| `composer.voice.overlay.mute` | 静音并显示字幕 | renderer.js 内 `mute:"…"`（newChatResources 的 zh 段） |
| `composer.voice.overlay.unmute` | 取消静音 | renderer.js 内 `unmute:"…"`（newChatResources 的 zh 段） |
| `composer.voice.overlay.close` | 结束实时语音 | renderer.js 内 `close:"…"`（newChatResources 的 zh 段） |
| `composer.send.send` | 发送消息 | renderer.js 内 `send:"…"`（newChatResources 的 zh 段） |
| `composer.send.stop` | 停止生成 | renderer.js 内 `stop:"…"`（newChatResources 的 zh 段） |
| `composer.send.stopping` | 正在停止生成 | renderer.js 内 `stopping:"…"`（newChatResources 的 zh 段） |
| `composer.send.failed` | 发送失败，草稿已保留。 | renderer.js 内 `failed:"…"`（newChatResources 的 zh 段） |

### `turn.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `turn.title` | 当前执行 | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `turn.emptyTitle` | 还没有执行记录 | renderer.js 内 `emptyTitle:"…"`（chatSessionResources 的 zh 段） |
| `turn.emptyDescription` | 启动一次受限的本地执行，检查目标边界并形成可验收证据。 | renderer.js 内 `emptyDescription:"…"`（chatSessionResources 的 zh 段） |
| `turn.start` | 启动本地执行 | renderer.js 内 `start:"…"`（chatSessionResources 的 zh 段） |
| `turn.localMock` | 本地 Mock | renderer.js 内 `localMock:"…"`（chatSessionResources 的 zh 段） |
| `turn.delegate` | Delegate · Personal Agent | renderer.js 内 `delegate:"…"`（chatSessionResources 的 zh 段） |
| `turn.started` | 启动于 | renderer.js 内 `started:"…"`（chatSessionResources 的 zh 段） |
| `turn.needsClarification` | 等待澄清 | renderer.js 内 `needsClarification:"…"`（chatSessionResources 的 zh 段） |
| `turn.queued` | 排队中 | renderer.js 内 `queued:"…"`（chatSessionResources 的 zh 段） |
| `turn.starting` | 正在启动 | renderer.js 内 `starting:"…"`（chatSessionResources 的 zh 段） |
| `turn.running` | 运行中 | renderer.js 内 `running:"…"`（chatSessionResources 的 zh 段） |
| `turn.waiting-user` | 等待你回应 | renderer.js 内 `waiting-user:"…"`（chatSessionResources 的 zh 段） |
| `turn.completed` | 已完成 | renderer.js 内 `completed:"…"`（chatSessionResources 的 zh 段） |
| `turn.failed` | 失败 | renderer.js 内 `failed:"…"`（chatSessionResources 的 zh 段） |
| `turn.canceled` | 已取消 | renderer.js 内 `canceled:"…"`（chatSessionResources 的 zh 段） |
| `turn.interrupted` | 已中断 | renderer.js 内 `interrupted:"…"`（chatSessionResources 的 zh 段） |
| `turn.cancel` | 取消本轮执行 | renderer.js 内 `cancel:"…"`（chatSessionResources 的 zh 段） |
| `turn.stop` | 停止执行 | renderer.js 内 `stop:"…"`（chatSessionResources 的 zh 段） |
| `turn.viewDetails` | 查看详情 | renderer.js 内 `viewDetails:"…"`（chatSessionResources 的 zh 段） |
| `turn.incomplete` | 本次执行没有完成。 | renderer.js 内 `incomplete:"…"`（chatSessionResources 的 zh 段） |
| `turn.retry` | 重新执行 | renderer.js 内 `retry:"…"`（chatSessionResources 的 zh 段） |
| `turn.complete` | 提交 Mock 结果 | renderer.js 内 `complete:"…"`（chatSessionResources 的 zh 段） |
| `turn.completeHint` | 提交后会生成 Evidence，但不会自动推进 Issue 状态。 | renderer.js 内 `completeHint:"…"`（chatSessionResources 的 zh 段） |
| `turn.history` | 恢复记录 | renderer.js 内 `history:"…"`（chatSessionResources 的 zh 段） |
| `turn.pastRuns` | 过去执行 · {{count}} | renderer.js 内 `pastRuns:"…"`（chatSessionResources 的 zh 段） |
| `turn.sessionDialogTitle` | {{name}} 的任务记录 | renderer.js 内 `sessionDialogTitle:"…"`（chatSessionResources 的 zh 段） |
| `turn.sessionDialogFallbackTitle` | 任务记录 | renderer.js 内 `sessionDialogFallbackTitle:"…"`（chatSessionResources 的 zh 段） |
| `turn.executionSummaryFallback` | 完整会话暂不可用，以下为本次执行保存的摘要。 | renderer.js 内 `executionSummaryFallback:"…"`（chatSessionResources 的 zh 段） |
| `turn.sessionDialogDescription` | 开始于 {{time}} | renderer.js 内 `sessionDialogDescription:"…"`（chatSessionResources 的 zh 段） |
| `turn.sessionUnavailable` | 暂时无法打开任务记录 | renderer.js 内 `sessionUnavailable:"…"`（chatSessionResources 的 zh 段） |
| `turn.sessionUnavailableDescription` | 这个执行对应的 ChatSession 可能已被移除，请打开完整任务或稍后重试。 | renderer.js 内 `sessionUnavailableDescription:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptQuestion` | 触发输入 | renderer.js 内 `runTranscriptQuestion:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptQuestionShort` | Q | renderer.js 内 `runTranscriptQuestionShort:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptAnswer` | Agent 回复 | renderer.js 内 `runTranscriptAnswer:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptAnswerShort` | A | renderer.js 内 `runTranscriptAnswerShort:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptProcess` | 执行过程 | renderer.js 内 `runTranscriptProcess:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptProcessShort` | P | renderer.js 内 `runTranscriptProcessShort:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptPromptEmpty` | 这轮执行没有记录触发输入。 | renderer.js 内 `runTranscriptPromptEmpty:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptQueuedAnswer` | Runtime 尚未领取这轮执行，开始后会在这里显示 Agent 回复。 | renderer.js 内 `runTranscriptQueuedAnswer:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptPendingAnswer` | Agent 正在处理这轮执行，完成后会在这里显示回复。 | renderer.js 内 `runTranscriptPendingAnswer:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptResultEmpty` | 这轮执行没有返回可展示的回复。 | renderer.js 内 `runTranscriptResultEmpty:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptQueuedProcess` | 正在等待绑定的 Runtime 领取这轮执行。 | renderer.js 内 `runTranscriptQueuedProcess:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptPendingProcess` | Runtime 已开始处理，新的状态和工具事件会显示在这里。 | renderer.js 内 `runTranscriptPendingProcess:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptProcessEmpty` | 这轮执行没有记录思考、工具或状态事件。 | renderer.js 内 `runTranscriptProcessEmpty:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptEventDetailEmpty` | 没有详情。 | renderer.js 内 `runTranscriptEventDetailEmpty:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptThinking` | 思考 | renderer.js 内 `runTranscriptThinking:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptToolUse` | 工具调用 | renderer.js 内 `runTranscriptToolUse:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptToolResult` | 工具结果 | renderer.js 内 `runTranscriptToolResult:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptStatus` | 状态 | renderer.js 内 `runTranscriptStatus:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptError` | 错误 | renderer.js 内 `runTranscriptError:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptAssistant` | 回复片段 | renderer.js 内 `runTranscriptAssistant:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptUnknownEvent` | 事件 | renderer.js 内 `runTranscriptUnknownEvent:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptErrorTitle` | 执行失败 | renderer.js 内 `runTranscriptErrorTitle:"…"`（chatSessionResources 的 zh 段） |
| `turn.runTranscriptMeta` | {{status}} · {{duration}} | renderer.js 内 `runTranscriptMeta:"…"`（chatSessionResources 的 zh 段） |
| `turn.inspect` | 检查本轮执行 | renderer.js 内 `inspect:"…"`（chatSessionResources 的 zh 段） |
| `turn.repository` | 仓库 | renderer.js 内 `repository:"…"`（chatSessionResources 的 zh 段） |
| `turn.queueReasonLabel` | 排队原因 | renderer.js 内 `queueReasonLabel:"…"`（chatSessionResources 的 zh 段） |
| `turn.lineage` | 重试链路 | renderer.js 内 `lineage:"…"`（chatSessionResources 的 zh 段） |
| `turn.retryAttempt` | 第 {{attempt}} 次尝试 | renderer.js 内 `retryAttempt:"…"`（chatSessionResources 的 zh 段） |
| `turn.evidence` | Evidence | renderer.js 内 `evidence:"…"`（chatSessionResources 的 zh 段） |
| `turn.pendingEvidence` | 等待 Evidence | renderer.js 内 `pendingEvidence:"…"`（chatSessionResources 的 zh 段） |
| `turn.events` | 运行事件 | renderer.js 内 `events:"…"`（chatSessionResources 的 zh 段） |
| `turn.cancelTitle` | 取消这轮执行？ | renderer.js 内 `cancelTitle:"…"`（chatSessionResources 的 zh 段） |
| `turn.cancelDescription` | 本地 Runtime 会停止当前执行，已产生的记录会保留在 Issue 和任务中。 | renderer.js 内 `cancelDescription:"…"`（chatSessionResources 的 zh 段） |
| `turn.cancelConfirm` | 确认取消 | renderer.js 内 `cancelConfirm:"…"`（chatSessionResources 的 zh 段） |
| `turn.changeSummary` | Git 变更摘要 | renderer.js 内 `changeSummary:"…"`（chatSessionResources 的 zh 段） |
| `turn.resultError` | 失败原因 | renderer.js 内 `resultError:"…"`（chatSessionResources 的 zh 段） |
| `turn.queueReason.work-directory-busy` | 同一工作目录已有执行，当前轮次正在等待。 | renderer.js 内 `work-directory-busy:"…"`（chatSessionResources 的 zh 段） |
| `turn.queueReason.work-directory-unavailable` | 工作目录不可用，请重新选择。 | renderer.js 内 `work-directory-unavailable:"…"`（chatSessionResources 的 zh 段） |
| `turn.queueReason.runtime-unavailable` | Runtime 未就绪，就绪后会继续调度。 | renderer.js 内 `runtime-unavailable:"…"`（chatSessionResources 的 zh 段） |

## 12 错误·降级·重试

_条目数：130_

### `applicationExit.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `applicationExit.runningTitle` | 停止任务并退出 Qoder？ | renderer.js 内 `runningTitle:"…"`（shellResources 的 zh 段） |
| `applicationExit.runningDescription` | 正在执行 {{running}} 项、后台任务 {{background}} 个、排队 {{queued}} 项、等待交互 {{interactions}} 项。退出会停止这些工作；历史记录与文件变更会保留。 | renderer.js 内 `runningDescription:"…"`（shellResources 的 zh 段） |
| `applicationExit.stopAndQuit` | 停止任务并退出 | renderer.js 内 `stopAndQuit:"…"`（shellResources 的 zh 段） |
| `applicationExit.unsavedQuitTitle` | 保存文件并退出 Qoder？ | renderer.js 内 `unsavedQuitTitle:"…"`（shellResources 的 zh 段） |
| `applicationExit.unsavedUpdateTitle` | 保存文件并更新 Qoder？ | renderer.js 内 `unsavedUpdateTitle:"…"`（shellResources 的 zh 段） |
| `applicationExit.discardAllAndQuit` | 全部放弃并退出 | renderer.js 内 `discardAllAndQuit:"…"`（shellResources 的 zh 段） |
| `applicationExit.saveAllAndQuit` | 全部保存并退出 | renderer.js 内 `saveAllAndQuit:"…"`（shellResources 的 zh 段） |
| `applicationExit.discardAllAndUpdate` | 全部放弃并更新 | renderer.js 内 `discardAllAndUpdate:"…"`（shellResources 的 zh 段） |
| `applicationExit.saveAllAndUpdate` | 全部保存并更新 | renderer.js 内 `saveAllAndUpdate:"…"`（shellResources 的 zh 段） |

### `architectureMismatch.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `architectureMismatch.title` | 当前版本未针对这台 Mac 优化 | renderer.js 内 `title:"…"`（shellResources 的 zh 段） |
| `architectureMismatch.description` | 这台 Mac 使用 Apple 芯片，但当前安装的是 Intel (x64) 版本。通过 Rosetta 2 运行可能降低性能。请前往下载页安装 Apple 芯片 (arm64) 版本。 | renderer.js 内 `description:"…"`（shellResources 的 zh 段） |
| `architectureMismatch.openDownload` | 前往下载页 | renderer.js 内 `openDownload:"…"`（shellResources 的 zh 段） |
| `architectureMismatch.later` | 稍后处理 | renderer.js 内 `later:"…"`（shellResources 的 zh 段） |
| `architectureMismatch.closeLabel` | 关闭架构提示 | renderer.js 内 `closeLabel:"…"`（shellResources 的 zh 段） |
| `architectureMismatch.downloadError` | 无法打开下载页，请检查默认浏览器设置后重试。 | renderer.js 内 `downloadError:"…"`（shellResources 的 zh 段） |

### `chatSession.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatSession.inputIdConflict` | 这次请求与原输入不一致。请作为新消息发送。 | renderer.js 内 `inputIdConflict:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.registrationClosed` | 这个任务已归档或删除，无法继续发送。 | renderer.js 内 `registrationClosed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sendCancelled` | 消息已取消，尚未发送。 | renderer.js 内 `sendCancelled:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.executionIntentConflict` | 这个任务的执行位置已确定。请选择原位置继续，或新建任务。 | renderer.js 内 `executionIntentConflict:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.processRuntimeRemoved` | 这个任务使用的 Codex/Pi Runtime 已下线。历史仍可查看；请新建 Qoder 任务继续。 | renderer.js 内 `processRuntimeRemoved:"…"`（chatSessionResources 的 zh 段） |

### `common.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `common.chooseWorkDirectory` | 选择工作目录 | renderer.js 内 `chooseWorkDirectory:"…"`（shellResources 的 zh 段） |
| `common.breadcrumb` | 面包屑 | renderer.js 内 `breadcrumb:"…"`（shellResources 的 zh 段） |
| `common.chooseDirectory` | 选择目录 | renderer.js 内 `chooseDirectory:"…"`（shellResources 的 zh 段） |
| `common.addFolder` | 添加文件夹 | renderer.js 内 `addFolder:"…"`（shellResources 的 zh 段） |
| `common.recentFolders` | 最近添加的文件夹 | renderer.js 内 `recentFolders:"…"`（shellResources 的 zh 段） |
| `common.noRecentFolders` | 暂无最近文件夹 | renderer.js 内 `noRecentFolders:"…"`（shellResources 的 zh 段） |
| `common.recentWorkDirectories` | 最近使用的目录 | renderer.js 内 `recentWorkDirectories:"…"`（shellResources 的 zh 段） |
| `common.noRecentWorkDirectories` | 暂无最近目录 | renderer.js 内 `noRecentWorkDirectories:"…"`（shellResources 的 zh 段） |
| `common.selectingWorkDirectory` | 正在选择... | renderer.js 内 `selectingWorkDirectory:"…"`（shellResources 的 zh 段） |
| `common.clearWorkDirectory` | 清空目录 | renderer.js 内 `clearWorkDirectory:"…"`（shellResources 的 zh 段） |
| `common.clearAdditionalFolder` | 移除待添加文件夹 {{name}} | renderer.js 内 `clearAdditionalFolder:"…"`（shellResources 的 zh 段） |
| `common.language` | English | renderer.js 内 `language:"…"`（shellResources 的 zh 段） |
| `common.local` | 本地 | renderer.js 内 `local:"…"`（shellResources 的 zh 段） |
| `common.create` | 创建 | renderer.js 内 `create:"…"`（shellResources 的 zh 段） |
| `common.save` | 保存 | renderer.js 内 `save:"…"`（shellResources 的 zh 段） |
| `common.done` | 完成 | renderer.js 内 `done:"…"`（shellResources 的 zh 段） |
| `common.cancel` | 取消 | renderer.js 内 `cancel:"…"`（shellResources 的 zh 段） |
| `common.close` | 关闭 | renderer.js 内 `close:"…"`（shellResources 的 zh 段） |
| `common.retry` | 重试 | renderer.js 内 `retry:"…"`（shellResources 的 zh 段） |
| `common.next` | 下一步 | renderer.js 内 `next:"…"`（shellResources 的 zh 段） |
| `common.loading` | 正在加载... | renderer.js 内 `loading:"…"`（shellResources 的 zh 段） |
| `common.add` | 添加 | renderer.js 内 `add:"…"`（shellResources 的 zh 段） |
| `common.delete` | 删除 | renderer.js 内 `delete:"…"`（shellResources 的 zh 段） |
| `common.copy` | 复制 | renderer.js 内 `copy:"…"`（shellResources 的 zh 段） |
| `common.showUsername` | 显示用户名 | renderer.js 内 `showUsername:"…"`（shellResources 的 zh 段） |
| `common.hideUsername` | 隐藏用户名 | renderer.js 内 `hideUsername:"…"`（shellResources 的 zh 段） |
| `common.expand` | 展开 | renderer.js 内 `expand:"…"`（shellResources 的 zh 段） |
| `common.collapse` | 收起 | renderer.js 内 `collapse:"…"`（shellResources 的 zh 段） |

### `empty.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `empty.assigned` | 目前没有分配给你的工作 | renderer.js 内 `assigned:"…"`（collaborationResources 的 zh 段） |
| `empty.assignedDescription` | 由团队分配给你的 Issue 和待推进事项会出现在这里。 | renderer.js 内 `assignedDescription:"…"`（collaborationResources 的 zh 段） |
| `empty.needs` | 目前没有等待你判断的事项 | renderer.js 内 `needs:"…"`（collaborationResources 的 zh 段） |
| `empty.needsDescription` | 阻塞中的澄清、判断和验收请求会出现在这里。 | renderer.js 内 `needsDescription:"…"`（collaborationResources 的 zh 段） |
| `empty.projects` | 还没有项目 | renderer.js 内 `projects:"…"`（collaborationResources 的 zh 段） |
| `empty.projectsDescription` | 项目会汇总共享目标、Issue、责任人与交付周期。 | renderer.js 内 `projectsDescription:"…"`（collaborationResources 的 zh 段） |
| `empty.discussion` | 暂无讨论 | renderer.js 内 `discussion:"…"`（collaborationResources 的 zh 段） |
| `empty.discussionDescription` | 围绕 Issue 的公开讨论和结论会显示在这里。 | renderer.js 内 `discussionDescription:"…"`（collaborationResources 的 zh 段） |
| `empty.search` | 输入关键词开始搜索 | renderer.js 内 `search:"…"`（collaborationResources 的 zh 段） |
| `empty.searchDescription` | 搜索 Issue、项目、Discussion、Agent、团队和任务。 | renderer.js 内 `searchDescription:"…"`（collaborationResources 的 zh 段） |
| `empty.automation` | 还没有自动化 | renderer.js 内 `automation:"…"`（collaborationResources 的 zh 段） |
| `empty.automationDescription` | 按计划自动触发的工作将在这里管理运行时间与状态。 | renderer.js 内 `automationDescription:"…"`（collaborationResources 的 zh 段） |
| `empty.extensions` | 还没有启用扩展 | renderer.js 内 `extensions:"…"`（collaborationResources 的 zh 段） |
| `empty.extensionsDescription` | Skills、Knowledge、Connector 和 Plugin 将从这里接入。 | renderer.js 内 `extensionsDescription:"…"`（collaborationResources 的 zh 段） |
| `empty.developing` | 开发中 | renderer.js 内 `developing:"…"`（collaborationResources 的 zh 段） |
| `empty.comingSoon` | 敬请期待 | renderer.js 内 `comingSoon:"…"`（collaborationResources 的 zh 段） |

### `externalApplication.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `externalApplication.systemDefault` | 系统默认应用 | renderer.js 内 `systemDefault:"…"`（shellResources 的 zh 段） |
| `externalApplication.openFileWith` | 用 {{name}} 打开文件 | renderer.js 内 `openFileWith:"…"`（shellResources 的 zh 段） |
| `externalApplication.openInEditor` | 在编辑器中打开 | renderer.js 内 `openInEditor:"…"`（shellResources 的 zh 段） |
| `externalApplication.revealFile` | 在 {{name}} 中显示 | renderer.js 内 `revealFile:"…"`（shellResources 的 zh 段） |
| `externalApplication.openDirectoryInTerminal` | 在 {{name}} 中打开目录 | renderer.js 内 `openDirectoryInTerminal:"…"`（shellResources 的 zh 段） |
| `externalApplication.openSavedVersion` | 用 {{name}} 打开磁盘上已保存的版本 | renderer.js 内 `openSavedVersion:"…"`（shellResources 的 zh 段） |
| `externalApplication.loading` | 正在查找可用应用… | renderer.js 内 `loading:"…"`（shellResources 的 zh 段） |
| `externalApplication.discoveryFailed` | 应用列表未能更新，重新打开菜单可重试。 | renderer.js 内 `discoveryFailed:"…"`（shellResources 的 zh 段） |

### `modelQueue.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `modelQueue.retrying` | 正在重试（{{attempt}}/{{maxRetries}}） | renderer.js 内 `retrying:"…"`（newChatResources 的 zh 段） |
| `modelQueue.retryingCompact` | 重试中 {{attempt}}/{{maxRetries}} | renderer.js 内 `retryingCompact:"…"`（newChatResources 的 zh 段） |
| `modelQueue.retryInterval` | 重试间隔 {{seconds}} 秒 | renderer.js 内 `retryInterval:"…"`（newChatResources 的 zh 段） |
| `modelQueue.queued` | 模型请求正在排队 | renderer.js 内 `queued:"…"`（newChatResources 的 zh 段） |
| `modelQueue.ready` | 模型可用，正在继续请求 | renderer.js 内 `ready:"…"`（newChatResources 的 zh 段） |
| `modelQueue.estimatedWait.lessThanMinute` | 预计等待不足 1 分钟 | renderer.js 内 `lessThanMinute:"…"`（newChatResources 的 zh 段） |
| `modelQueue.estimatedWait.oneMinute` | 预计等待约 1 分钟 | renderer.js 内 `oneMinute:"…"`（newChatResources 的 zh 段） |
| `modelQueue.estimatedWait.minutes` | 预计等待约 {{minutes}} 分钟 | renderer.js 内 `minutes:"…"`（newChatResources 的 zh 段） |
| `modelQueue.estimatedWait.overTenMinutes` | 预计等待超过 10 分钟 | renderer.js 内 `overTenMinutes:"…"`（newChatResources 的 zh 段） |

### `notifications.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `notifications.defaultTitle` | Qoder | renderer.js 内 `defaultTitle:"…"`（shellResources 的 zh 段） |
| `notifications.registrationTitle` | Qoder 通知已开启 | renderer.js 内 `registrationTitle:"…"`（shellResources 的 zh 段） |
| `notifications.registrationBody` | 系统通知已就绪。之后你会收到已启用类型的通知。 | renderer.js 内 `registrationBody:"…"`（shellResources 的 zh 段） |
| `notifications.turnCompletedBody` | Agent 已完成这一轮回复。 | renderer.js 内 `turnCompletedBody:"…"`（shellResources 的 zh 段） |
| `notifications.turnFailedBody` | 这一轮执行失败，请打开任务查看详情。 | renderer.js 内 `turnFailedBody:"…"`（shellResources 的 zh 段） |
| `notifications.permissionRequestBody` | Agent 需要你的授权才能继续。 | renderer.js 内 `permissionRequestBody:"…"`（shellResources 的 zh 段） |
| `notifications.questionBody` | Agent 正在等待你的回答。 | renderer.js 内 `questionBody:"…"`（shellResources 的 zh 段） |

### `renderError.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `renderError.retry` | 重试显示 | renderer.js 内 `retry:"…"`（shellResources 的 zh 段） |
| `renderError.application.title` | Qoder 刚刚走神了 | renderer.js 内 `title:"…"`（shellResources 的 zh 段） |
| `renderError.application.description` | 当前界面没有正常显示，你的任务还在。可以先重试，仍未恢复时再重新加载应用。 | renderer.js 内 `description:"…"`（shellResources 的 zh 段） |
| `renderError.application.reload` | 重新加载应用 | renderer.js 内 `reload:"…"`（shellResources 的 zh 段） |
| `renderError.surface.title` | 这个页面刚刚没能显示出来 | renderer.js 内 `title:"…"`（shellResources 的 zh 段） |
| `renderError.surface.description` | 只有当前页面受到影响，侧边栏和其他任务仍可使用。可以重试显示，或先打开新任务。 | renderer.js 内 `description:"…"`（shellResources 的 zh 段） |
| `renderError.surface.exit` | 打开新任务 | renderer.js 内 `exit:"…"`（shellResources 的 zh 段） |
| `renderError.preview.title` | 文件预览没有正常打开 | renderer.js 内 `title:"…"`（shellResources 的 zh 段） |
| `renderError.preview.description` | 任务和其他区域仍可使用。可以重试显示，或稍后再回到这个文件。 | renderer.js 内 `description:"…"`（shellResources 的 zh 段） |
| `renderError.turn.title` | 这段内容没有正常显示 | renderer.js 内 `title:"…"`（shellResources 的 zh 段） |
| `renderError.turn.description` | 其他消息和输入区仍可使用。可以重试显示这段内容。 | renderer.js 内 `description:"…"`（shellResources 的 zh 段） |
| `renderError.tool.title` | 这个工具详情没有正常显示 | renderer.js 内 `title:"…"`（shellResources 的 zh 段） |

### `startup.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `startup.title` | 无法启动 Qoder | renderer.js 内 `title:"…"`（shellResources 的 zh 段） |
| `startup.userDataDescription` | 应用无法创建或写入本地数据目录。请检查目录权限后重新启动。 | renderer.js 内 `userDataDescription:"…"`（shellResources 的 zh 段） |
| `startup.databaseDescription` | 本地数据库无法打开或初始化。现有数据没有被自动覆盖，请检查目录后重新启动。 | renderer.js 内 `databaseDescription:"…"`（shellResources 的 zh 段） |
| `startup.applicationDescription` | 应用服务无法完成初始化。本地数据没有被自动覆盖，请退出后重试；若问题持续，可发送反馈或安装新版本。 | renderer.js 内 `applicationDescription:"…"`（shellResources 的 zh 段） |
| `startup.updateRecovery` | 你可以检查并安装新版本，或退出 Qoder。 | renderer.js 内 `updateRecovery:"…"`（shellResources 的 zh 段） |
| `startup.updateDownloading` | 正在下载并验证 Qoder {{version}}。 | renderer.js 内 `updateDownloading:"…"`（shellResources 的 zh 段） |
| `startup.updateReady` | Qoder {{version}} 已准备好，可以安装并重启。 | renderer.js 内 `updateReady:"…"`（shellResources 的 zh 段） |
| `startup.updateInstalling` | 正在准备安装，Qoder 即将重启。 | renderer.js 内 `updateInstalling:"…"`（shellResources 的 zh 段） |
| `startup.updateFailed` | 暂时无法检查或下载更新，请检查网络后重试。 | renderer.js 内 `updateFailed:"…"`（shellResources 的 zh 段） |
| `startup.updateCurrent` | 当前已经是最新版本。 | renderer.js 内 `updateCurrent:"…"`（shellResources 的 zh 段） |
| `startup.checkForUpdates` | 检查更新 | renderer.js 内 `checkForUpdates:"…"`（shellResources 的 zh 段） |
| `startup.checkingForUpdates` | 正在检查更新... | renderer.js 内 `checkingForUpdates:"…"`（shellResources 的 zh 段） |
| `startup.retryUpdateCheck` | 重试检查更新 | renderer.js 内 `retryUpdateCheck:"…"`（shellResources 的 zh 段） |
| `startup.downloadingUpdate` | 正在下载更新... | renderer.js 内 `downloadingUpdate:"…"`（shellResources 的 zh 段） |
| `startup.installAndRestart` | 安装并重启 | renderer.js 内 `installAndRestart:"…"`（shellResources 的 zh 段） |
| `startup.preparingInstall` | 正在准备安装... | renderer.js 内 `preparingInstall:"…"`（shellResources 的 zh 段） |
| `startup.quit` | 退出 Qoder | renderer.js 内 `quit:"…"`（shellResources 的 zh 段） |

### `tray.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `tray.closePromptTitle` | 关闭 Qoder 窗口？ | renderer.js 内 `closePromptTitle:"…"`（shellResources 的 zh 段） |
| `tray.closePromptDescription` | 最小化到托盘后，Agent 和后台任务会继续运行；退出应用会停止正在进行的工作。 | renderer.js 内 `closePromptDescription:"…"`（shellResources 的 zh 段） |
| `tray.closePromptRemember` | 不再询问 | renderer.js 内 `closePromptRemember:"…"`（shellResources 的 zh 段） |
| `tray.closePromptMinimize` | 最小化到托盘 | renderer.js 内 `closePromptMinimize:"…"`（shellResources 的 zh 段） |
| `tray.closePromptQuit` | 退出应用 | renderer.js 内 `closePromptQuit:"…"`（shellResources 的 zh 段） |

### `workbenchNotification.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `workbenchNotification.actionFailed` | 卡片操作未完成，请重试。 | renderer.js 内 `actionFailed:"…"`（shellResources 的 zh 段） |
| `workbenchNotification.chinaMobile.brandLogo` | 中国移动联名 | renderer.js 内 `brandLogo:"…"`（shellResources 的 zh 段） |
| `workbenchNotification.chinaMobile.title` | 移动联名版已就绪 | renderer.js 内 `title:"…"`（shellResources 的 zh 段） |
| `workbenchNotification.chinaMobile.description` | 启用后即可使用中国移动提供的模型服务，消耗你的移动算力豆套餐额度。也可稍后在「设置 — 个人资料」中开启。 | renderer.js 内 `description:"…"`（shellResources 的 zh 段） |
| `workbenchNotification.chinaMobile.enable` | 立即启用 | renderer.js 内 `enable:"…"`（shellResources 的 zh 段） |
| `workbenchNotification.chinaMobile.later` | 稍后 | renderer.js 内 `later:"…"`（shellResources 的 zh 段） |
| `workbenchNotification.chinaMobile.close` | 关闭移动联名提醒 | renderer.js 内 `close:"…"`（shellResources 的 zh 段） |
| `workbenchNotification.chinaMobile.failed` | 移动联名模式未能启用，本地设置未改变。请重试。 | renderer.js 内 `failed:"…"`（shellResources 的 zh 段） |

## 13 计量与成本

_条目数：55_

### `newChat.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `newChat.eyebrow` | 个人交付 | renderer.js 内 `eyebrow:"…"`（newChatResources 的 zh 段） |
| `newChat.title` | 开始一个新任务 | renderer.js 内 `title:"…"`（newChatResources 的 zh 段） |
| `newChat.voiceTitle` | 新语音任务 | renderer.js 内 `voiceTitle:"…"`（newChatResources 的 zh 段） |
| `newChat.welcome` | 不止于编程 | renderer.js 内 `welcome:"…"`（newChatResources 的 zh 段） |
| `newChat.mobileAppDownload` | 下载移动端 App | renderer.js 内 `mobileAppDownload:"…"`（newChatResources 的 zh 段） |
| `newChat.dismissMobileAppPromo` | 不再显示移动端下载引导 | renderer.js 内 `dismissMobileAppPromo:"…"`（newChatResources 的 zh 段） |
| `newChat.prompt` | 用 Qoder 创造了不起的事物 | renderer.js 内 `prompt:"…"`（newChatResources 的 zh 段） |
| `newChat.overview` | 欢迎页概览 | renderer.js 内 `overview:"…"`（newChatResources 的 zh 段） |
| `newChat.sessionHeatmap` | 会话 | renderer.js 内 `sessionHeatmap:"…"`（newChatResources 的 zh 段） |
| `newChat.attention` | Attention | renderer.js 内 `attention:"…"`（newChatResources 的 zh 段） |
| `newChat.openAttention` | 打开 Attention，共 {{count}} 项 | renderer.js 内 `openAttention:"…"`（newChatResources 的 zh 段） |

### `settings.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `settings.durationFormat` | 耗时显示格式 | renderer.js 内 `durationFormat:"…"`（settingsResources 的 zh 段） |
| `settings.profileShareCompactMetrics` | 显示精简统计 | renderer.js 内 `profileShareCompactMetrics:"…"`（settingsResources 的 zh 段） |
| `settings.profileYearCreditsUsed` | 近一年 Credits 消耗 | renderer.js 内 `profileYearCreditsUsed:"…"`（settingsResources 的 zh 段） |
| `settings.profileYearPeakCredits` | Credits 日峰值 | renderer.js 内 `profileYearPeakCredits:"…"`（settingsResources 的 zh 段） |
| `settings.profileServerCreditsSummaryError` | Credits 汇总接口暂不可用。 | renderer.js 内 `profileServerCreditsSummaryError:"…"`（settingsResources 的 zh 段） |

### `usage.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `usage.ariaLabel` | 查看我的用量 | renderer.js 内 `ariaLabel:"…"`（accountResources 的 zh 段） |
| `usage.ariaLabelCampaignClaimable` | 查看我的用量，有权益活动待领取 | renderer.js 内 `ariaLabelCampaignClaimable:"…"`（accountResources 的 zh 段） |
| `usage.title` | 我的用量 | renderer.js 内 `title:"…"`（accountResources 的 zh 段） |
| `usage.openFailed` | 无法打开企业用量页面，请确认浏览器或对应应用可用后重试。 | renderer.js 内 `openFailed:"…"`（accountResources 的 zh 段） |
| `usage.planCredits` | 套餐内 Credits | renderer.js 内 `planCredits:"…"`（accountResources 的 zh 段） |
| `usage.resourcePackage` | 资源包 | renderer.js 内 `resourcePackage:"…"`（accountResources 的 zh 段） |
| `usage.dedicatedResourcePackage` | 个人专属资源包 | renderer.js 内 `dedicatedResourcePackage:"…"`（accountResources 的 zh 段） |
| `usage.dedicatedResourcePackageInfo` | 了解 {{name}} | renderer.js 内 `dedicatedResourcePackageInfo:"…"`（accountResources 的 zh 段） |
| `usage.resourcePackageExhausted` | 已用尽 | renderer.js 内 `resourcePackageExhausted:"…"`（accountResources 的 zh 段） |
| `usage.resourcePackageExpired` | 已过期 | renderer.js 内 `resourcePackageExpired:"…"`（accountResources 的 zh 段） |
| `usage.resourcePackageSuspended` | 已暂停 | renderer.js 内 `resourcePackageSuspended:"…"`（accountResources 的 zh 段） |
| `usage.resourcePackageUnavailable` | 暂不可用 | renderer.js 内 `resourcePackageUnavailable:"…"`（accountResources 的 zh 段） |
| `usage.sharedResourcePackage` | 共享资源包 | renderer.js 内 `sharedResourcePackage:"…"`（accountResources 的 zh 段） |
| `usage.resourcePackageTooltip` | 资源包是管理员从组织共享资源包中分配给你的当前周期可用额度。 | renderer.js 内 `resourcePackageTooltip:"…"`（accountResources 的 zh 段） |
| `usage.resourcePackageInfo` | 了解资源包额度 | renderer.js 内 `resourcePackageInfo:"…"`（accountResources 的 zh 段） |
| `usage.learnMore` | 了解更多 | renderer.js 内 `learnMore:"…"`（accountResources 的 zh 段） |
| `usage.teams` | Teams | renderer.js 内 `teams:"…"`（accountResources 的 zh 段） |
| `usage.renewsOn` | 将于 {{date}} 刷新 | renderer.js 内 `renewsOn:"…"`（accountResources 的 zh 段） |
| `usage.expiresOn` | 有效期至 {{date}} | renderer.js 内 `expiresOn:"…"`（accountResources 的 zh 段） |
| `usage.used` | 已使用 | renderer.js 内 `used:"…"`（accountResources 的 zh 段） |
| `usage.remaining` | 剩余 | renderer.js 内 `remaining:"…"`（accountResources 的 zh 段） |
| `usage.close` | 关闭用量面板 | renderer.js 内 `close:"…"`（accountResources 的 zh 段） |
| `usage.refresh` | 刷新用量 | renderer.js 内 `refresh:"…"`（accountResources 的 zh 段） |
| `usage.viewDetails` | 查看详情 | renderer.js 内 `viewDetails:"…"`（accountResources 的 zh 段） |
| `usage.loading` | 正在读取用量... | renderer.js 内 `loading:"…"`（accountResources 的 zh 段） |
| `usage.empty` | 当前账户暂无可展示的用量。 | renderer.js 内 `empty:"…"`（accountResources 的 zh 段） |
| `usage.error` | 暂时无法读取用量，请稍后重试。 | renderer.js 内 `error:"…"`（accountResources 的 zh 段） |
| `usage.retry` | 重试 | renderer.js 内 `retry:"…"`（accountResources 的 zh 段） |
| `usage.rewards` | Rewards | renderer.js 内 `rewards:"…"`（accountResources 的 zh 段） |
| `usage.openRewards` | 打开 Rewards | renderer.js 内 `openRewards:"…"`（accountResources 的 zh 段） |
| `usage.moreResourcePackages` | 还有 {{count}} 个资源包 | renderer.js 内 `moreResourcePackages:"…"`（accountResources 的 zh 段） |
| `usage.collapseResourcePackages` | 收起资源包 | renderer.js 内 `collapseResourcePackages:"…"`（accountResources 的 zh 段） |
| `usage.campaign` | 权益活动 | renderer.js 内 `campaign:"…"`（accountResources 的 zh 段） |
| `usage.openCampaign` | 打开权益活动 | renderer.js 内 `openCampaign:"…"`（accountResources 的 zh 段） |
| `usage.campaignSurfaceLabel` | 权益活动内容 | renderer.js 内 `campaignSurfaceLabel:"…"`（accountResources 的 zh 段） |
| `usage.campaignLoading` | 正在加载活动... | renderer.js 内 `campaignLoading:"…"`（accountResources 的 zh 段） |
| `usage.campaignLoadFailed` | 活动加载失败 | renderer.js 内 `campaignLoadFailed:"…"`（accountResources 的 zh 段） |
| `usage.campaignLoadFailedDescription` | 请检查网络后重新加载。 | renderer.js 内 `campaignLoadFailedDescription:"…"`（accountResources 的 zh 段） |
| `usage.campaignRetry` | 重新加载 | renderer.js 内 `campaignRetry:"…"`（accountResources 的 zh 段） |

## 14 会话管理·分享·导出·侧栏

_条目数：480_

### `applicationMenu.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `applicationMenu.label` | 应用菜单 | renderer.js 内 `label:"…"`（shellResources 的 zh 段） |
| `applicationMenu.file` | 文件 | renderer.js 内 `file:"…"`（shellResources 的 zh 段） |
| `applicationMenu.edit` | 编辑 | renderer.js 内 `edit:"…"`（shellResources 的 zh 段） |
| `applicationMenu.view` | 视图 | renderer.js 内 `view:"…"`（shellResources 的 zh 段） |
| `applicationMenu.help` | 帮助 | renderer.js 内 `help:"…"`（shellResources 的 zh 段） |

### `chatSession.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatSession.pictureInPicture.sectionLabel` | 电脑使用画中画 | renderer.js 内 `sectionLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.pictureInPicture.computerUse` | 电脑使用 | renderer.js 内 `computerUse:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.pictureInPicture.title` | 画中画 | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.pictureInPicture.hide` | 隐藏 | renderer.js 内 `hide:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.pictureInPicture.show` | 显示 | renderer.js 内 `show:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.pictureInPicture.hideInSession` | 在此会话中隐藏画中画 | renderer.js 内 `hideInSession:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.pictureInPicture.hideInAllSessions` | 在所有会话中隐藏画中画 | renderer.js 内 `hideInAllSessions:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.pictureInPicture.updateFailed` | 无法更新画中画显示状态，请重试。 | renderer.js 内 `updateFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.title` | 侧边任务 | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.temporary` | 临时侧边任务 | renderer.js 内 `temporary:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.temporaryDescription` | 这是临时任务，关闭 Qoder 后将消失。 | renderer.js 内 `temporaryDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.inheritedContext` | 侧边任务在同一环境中与主任务并行运行 | renderer.js 内 `inheritedContext:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.moreActions` | 侧边任务更多操作 | renderer.js 内 `moreActions:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.groupMoreActions` | 侧边任务分组更多操作 | renderer.js 内 `groupMoreActions:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.start` | 开始侧边任务 | renderer.js 内 `start:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.startFailed` | 无法开始侧边任务，请稍后重试。 | renderer.js 内 `startFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.close` | 关闭侧边任务 | renderer.js 内 `close:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.closeConfirmTitle` | 关闭侧边任务？ | renderer.js 内 `closeConfirmTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.closeConfirmDescription` | 这个侧边任务将被删除，且无法恢复。你确定吗？ | renderer.js 内 `closeConfirmDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.closeConfirmAction` | 关闭侧边任务 | renderer.js 内 `closeConfirmAction:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.cleanup` | 清理侧边任务 | renderer.js 内 `cleanup:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.cleanupExpired` | 清理全部已过期侧边任务 | renderer.js 内 `cleanupExpired:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.fileChanges` | 文件变更（{{count}}） | renderer.js 内 `fileChanges:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.from` | 来自 {{title}} | renderer.js 内 `from:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.fromCleaned` | 来自已清理的 {{title}} | renderer.js 内 `fromCleaned:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.cleanupFailed` | 侧边任务清理失败，请重试。 | renderer.js 内 `cleanupFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.cleanupConfirmTitle` | 清理侧边任务？ | renderer.js 内 `cleanupConfirmTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.cleanupConfirmDescription` | 任务内容将永久删除，并从右侧工作区和任务监控移除。已经写入工作区的更改不会撤销；文件修改回执和其他稳定结果仍会保留。 | renderer.js 内 `cleanupConfirmDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.expiredTitle` | 侧边任务已过期 | renderer.js 内 `expiredTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.expiredDescription` | 这个临时侧边任务已不可用。请开始新的侧边任务以继续。 | renderer.js 内 `expiredDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.startNew` | 开始新的侧边任务 | renderer.js 内 `startNew:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.unavailableTitle` | 侧边任务不可用 | renderer.js 内 `unavailableTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.unavailableDescription` | 无法安全恢复这个侧边任务。你可以清理它并开始新的侧边任务。 | renderer.js 内 `unavailableDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.status.running` | 执行中 | renderer.js 内 `running:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.status.waitingUser` | 等待处理 | renderer.js 内 `waitingUser:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.status.ready` | 可继续 | renderer.js 内 `ready:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.status.cold` | 可继续 | renderer.js 内 `cold:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.status.expired` | 已过期 | renderer.js 内 `expired:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.status.unavailable` | 不可用 | renderer.js 内 `unavailable:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.status.cleaning` | 清理中 | renderer.js 内 `cleaning:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.sideChat.status.cleanupFailed` | 清理失败 | renderer.js 内 `cleanupFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.openWith` | 用 {{name}} 打开工作区 | renderer.js 内 `openWith:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.selectOpenWith` | 选择打开应用 | renderer.js 内 `selectOpenWith:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.openWithFailed` | 无法用 {{name}} 打开 | renderer.js 内 `openWithFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.openWithFailedDescription` | 请确认应用已安装并稍后重试。 | renderer.js 内 `openWithFailedDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.openWithNotInstalled` | 没有找到 {{name}} 的安装位置，请重新安装后重试。 | renderer.js 内 `openWithNotInstalled:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.openWithDetectionFailed` | 暂时无法确认 {{name}} 的安装位置，请稍后重试。 | renderer.js 内 `openWithDetectionFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.openWithLaunchFailed` | {{name}} 无法启动，请稍后重试。 | renderer.js 内 `openWithLaunchFailed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.openWithTargetInvalid` | 要打开的目标已不可用，请重新打开会话后重试。 | renderer.js 内 `openWithTargetInvalid:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.openWithRemoteUnsupported` | 远程工作区中的文件和目录无法用本机应用打开。 | renderer.js 内 `openWithRemoteUnsupported:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.systemApplications.finder` | 访达 | renderer.js 内 `finder:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.systemApplications.fileExplorer` | 文件资源管理器 | renderer.js 内 `fileExplorer:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.systemApplications.files` | 文件 | renderer.js 内 `files:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.systemApplications.terminal` | 终端 | renderer.js 内 `terminal:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.systemApplications.windowsTerminal` | Windows 终端 | renderer.js 内 `windowsTerminal:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.openWorkspace` | 打开侧边栏 | renderer.js 内 `openWorkspace:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.closeWorkspace` | 隐藏侧边栏 | renderer.js 内 `closeWorkspace:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.panelGroupButtons` | 面板组按钮 | renderer.js 内 `panelGroupButtons:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.workspaceUnavailable` | 开始任务后可打开审阅工作面 | renderer.js 内 `workspaceUnavailable:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.enterWorkspaceFullscreen` | 全屏显示工作面 | renderer.js 内 `enterWorkspaceFullscreen:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.exitWorkspaceFullscreen` | 退出工作面全屏 | renderer.js 内 `exitWorkspaceFullscreen:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.openTerminal` | 打开终端面板 | renderer.js 内 `openTerminal:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.closeTerminal` | 关闭终端面板 | renderer.js 内 `closeTerminal:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.terminalUnavailable` | 开始任务后可打开终端面板 | renderer.js 内 `terminalUnavailable:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.createPullRequest` | Create PR | renderer.js 内 `createPullRequest:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.createDraftPullRequest` | 创建 Draft PR | renderer.js 内 `createDraftPullRequest:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.headerActions.createPullRequestManually` | 手动创建 PR | renderer.js 内 `createPullRequestManually:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.label` | 任务工作面 | renderer.js 内 `label:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.typeLabel` | 工作面与文件标签页 | renderer.js 内 `typeLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.instancesLabel` | 当前类型标签页 | renderer.js 内 `instancesLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.add` | 添加标签页 | renderer.js 内 `add:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.close` | 关闭 {{label}} 标签页 | renderer.js 内 `close:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.closeMenu.close` | 关闭标签页 | renderer.js 内 `close:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.closeMenu.closeOthers` | 关闭其他标签页 | renderer.js 内 `closeOthers:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.closeMenu.closeRight` | 关闭右侧标签页 | renderer.js 内 `closeRight:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.closeMenu.closeAll` | 关闭全部标签页 | renderer.js 内 `closeAll:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.emptyTitle` | 暂无打开的工作面 | renderer.js 内 `emptyTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.emptyDescription` | 工作区文件、浏览器、审阅与其他任务工作面会以标签页保留在这里。 | renderer.js 内 `emptyDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.memberUnavailableTitle` | 选择成员任务 | renderer.js 内 `memberUnavailableTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.memberUnavailableDescription` | 成员任务暂时不可用，请从团队活动中重新打开。 | renderer.js 内 `memberUnavailableDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.launcherLabel` | 打开工作面 | renderer.js 内 `launcherLabel:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.newCode` | 打开工作区文件 | renderer.js 内 `newCode:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.newCodeDescription` | 浏览和编辑项目文件 | renderer.js 内 `newCodeDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.newSideChat` | 打开侧边任务 | renderer.js 内 `newSideChat:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.newBrowser` | 打开内置浏览器 | renderer.js 内 `newBrowser:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.newBrowserDescription` | 打开内置浏览器 | renderer.js 内 `newBrowserDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.newFiles` | 打开文件工作面 | renderer.js 内 `newFiles:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.newFilesDescription` | 查看 Agent 生成的文件 | renderer.js 内 `newFilesDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.newSpec` | 打开计划 | renderer.js 内 `newSpec:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.newEvidence` | 新建证据 | renderer.js 内 `newEvidence:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.showReview` | 打开审阅 | renderer.js 内 `showReview:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.openReview` | 打开审阅 | renderer.js 内 `openReview:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.openReviewDescription` | 检查本次文件变更 | renderer.js 内 `openReviewDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.openTerminal` | 打开终端 | renderer.js 内 `openTerminal:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.openTerminalDescription` | 在当前目录运行命令 | renderer.js 内 `openTerminalDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.opened` | 已打开 | renderer.js 内 `opened:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.single` | 单例 | renderer.js 内 `single:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.newBrowserTitle` | 新标签页 | renderer.js 内 `newBrowserTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.codeOrdinal` | 工作区文件 {{ordinal}} | renderer.js 内 `codeOrdinal:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.browserOrdinal` | 新标签页 | renderer.js 内 `browserOrdinal:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.filesOrdinal` | 文件 {{ordinal}} | renderer.js 内 `filesOrdinal:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.specOrdinal` | 计划 {{ordinal}} | renderer.js 内 `specOrdinal:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.terminalOrdinal` | 终端 {{ordinal}} | renderer.js 内 `terminalOrdinal:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.evidenceOrdinal` | 证据 {{ordinal}} | renderer.js 内 `evidenceOrdinal:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.code` | 工作区文件 | renderer.js 内 `code:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.files` | 文件资源管理器 | renderer.js 内 `files:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.browser` | 浏览器 | renderer.js 内 `browser:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.changes` | 审阅 | renderer.js 内 `changes:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.spec` | 计划 | renderer.js 内 `spec:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.terminal` | 终端 | renderer.js 内 `terminal:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.evidence` | 证据 | renderer.js 内 `evidence:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.agent` | 成员任务 | renderer.js 内 `agent:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.sidechat` | 侧边任务 | renderer.js 内 `sidechat:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.sideChatOrdinal` | 新侧边任务 | renderer.js 内 `sideChatOrdinal:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.plugin` | 插件视图 | renderer.js 内 `plugin:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginLoading` | 正在加载插件视图 | renderer.js 内 `pluginLoading:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginUnavailableTitle` | 插件视图不可用 | renderer.js 内 `pluginUnavailableTitle:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginUnavailableDescription` | 未找到插件视图资源。请检查插件是否已启用或重新安装插件。 | renderer.js 内 `pluginUnavailableDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginViewLoadFailedDescription` | 插件视图资源加载失败。重新加载插件视图后再试。 | renderer.js 内 `pluginViewLoadFailedDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginViewRuntimeFailedDescription` | 插件视图运行时发生异常。重新加载插件视图后再试。 | renderer.js 内 `pluginViewRuntimeFailedDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginViewInitializationMissingDescription` | 插件没有注册视图启动入口，无法完成初始化。更新或重新安装插件后再试。 | renderer.js 内 `pluginViewInitializationMissingDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginViewInitializationInvalidDescription` | 插件注册的视图启动入口无效，无法完成初始化。更新或重新安装插件后再试。 | renderer.js 内 `pluginViewInitializationInvalidDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginViewModuleUnavailableDescription` | 插件依赖的前端模块未由当前 Qoder 提供，无法启动视图。更新插件或 Qoder 后再试。 | renderer.js 内 `pluginViewModuleUnavailableDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginViewResourceTooLargeDescription` | 插件视图资源超过允许大小，无法加载。更新或重新安装插件后再试。 | renderer.js 内 `pluginViewResourceTooLargeDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginViewEnvironmentUnavailableDescription` | 插件视图运行环境初始化失败。重新加载插件视图；若问题持续存在，更新 Qoder 后再试。 | renderer.js 内 `pluginViewEnvironmentUnavailableDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginViewPluginUnavailableDescription` | 插件或对应视图资源不存在或已停用。检查插件是否已启用，或重新安装插件后再试。 | renderer.js 内 `pluginViewPluginUnavailableDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginViewFileResourceUnavailableDescription` | 当前文件资源缺失或无效，插件视图无法打开。重新打开文件或重新加载插件视图后再试。 | renderer.js 内 `pluginViewFileResourceUnavailableDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginViewBackendTimeoutDescription` | 插件后端响应超时，视图初始化未完成。重新加载插件视图后再试。 | renderer.js 内 `pluginViewBackendTimeoutDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginViewBackendUnavailableDescription` | 插件后端启动失败或已退出，视图初始化未完成。重新加载插件视图；若问题持续存在，更新或重新安装插件。 | renderer.js 内 `pluginViewBackendUnavailableDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginViewNodeServiceMissingDescription` | 插件没有提供此视图所需的后端能力。更新或重新安装插件后再试。 | renderer.js 内 `pluginViewNodeServiceMissingDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginViewSimulatedCrashDescription` | 插件视图触发了崩溃测试。重新加载插件视图后再试。 | renderer.js 内 `pluginViewSimulatedCrashDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginViewErrorCode` | 错误码：{{errorCode}} | renderer.js 内 `pluginViewErrorCode:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.pluginReload` | 重新加载插件视图 | renderer.js 内 `pluginReload:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.waiting` | 待处理 | renderer.js 内 `waiting:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.running` | 执行中 | renderer.js 内 `running:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.workspaceTabs.idle` | 可查看 | renderer.js 内 `idle:"…"`（chatSessionResources 的 zh 段） |

### `chats.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chats.title` | 任务 | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `chats.objectCount` | {{count}} 个对象 | renderer.js 内 `objectCount:"…"`（chatSessionResources 的 zh 段） |
| `chats.search` | 搜索任务对象 | renderer.js 内 `search:"…"`（chatSessionResources 的 zh 段） |
| `chats.searchPlaceholder` | 搜索 Agent 或 Runtime | renderer.js 内 `searchPlaceholder:"…"`（chatSessionResources 的 zh 段） |
| `chats.unknownRuntime` | 未知 Runtime | renderer.js 内 `unknownRuntime:"…"`（chatSessionResources 的 zh 段） |
| `chats.noMatchesTitle` | 没有匹配的任务对象 | renderer.js 内 `noMatchesTitle:"…"`（chatSessionResources 的 zh 段） |
| `chats.noMatchesDescription` | 换个关键词，或到设置里启用更多 Agent。 | renderer.js 内 `noMatchesDescription:"…"`（chatSessionResources 的 zh 段） |
| `chats.emptyTitle` | 还没有可发起任务的 Agent | renderer.js 内 `emptyTitle:"…"`（chatSessionResources 的 zh 段） |
| `chats.emptyDescription` | 从 Runtime 创建或启用 Agent 后，就可以在这里直接发起任务。 | renderer.js 内 `emptyDescription:"…"`（chatSessionResources 的 zh 段） |
| `chats.noMessages` | 还没有消息 | renderer.js 内 `noMessages:"…"`（chatSessionResources 的 zh 段） |
| `chats.newObject` | 新 | renderer.js 内 `newObject:"…"`（chatSessionResources 的 zh 段） |
| `chats.startAgentTitle` | 开始 {{name}} 的任务 | renderer.js 内 `startAgentTitle:"…"`（chatSessionResources 的 zh 段） |
| `chats.startAgentDescription` | 发送第一条消息后，会创建一个独立任务并保留上下文。 | renderer.js 内 `startAgentDescription:"…"`（chatSessionResources 的 zh 段） |
| `chats.sendMessageAria` | 给 {{name}} 发送消息 | renderer.js 内 `sendMessageAria:"…"`（chatSessionResources 的 zh 段） |
| `chats.composerPlaceholder` | 给 {{name}} 发送消息... | renderer.js 内 `composerPlaceholder:"…"`（chatSessionResources 的 zh 段） |

### `conversationSearch.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `conversationSearch.inputLabel` | 搜索任务 | renderer.js 内 `inputLabel:"…"`（sidebarResources 的 zh 段） |
| `conversationSearch.placeholder` | 搜索任务 | renderer.js 内 `placeholder:"…"`（sidebarResources 的 zh 段） |
| `conversationSearch.searching` | 搜索中… | renderer.js 内 `searching:"…"`（sidebarResources 的 zh 段） |
| `conversationSearch.failed` | 搜索失败 | renderer.js 内 `failed:"…"`（sidebarResources 的 zh 段） |
| `conversationSearch.empty` | 无结果 | renderer.js 内 `empty:"…"`（sidebarResources 的 zh 段） |
| `conversationSearch.previous` | 上一个匹配 | renderer.js 内 `previous:"…"`（sidebarResources 的 zh 段） |
| `conversationSearch.previousLabel` | 上一个搜索结果 | renderer.js 内 `previousLabel:"…"`（sidebarResources 的 zh 段） |
| `conversationSearch.next` | 下一个匹配 | renderer.js 内 `next:"…"`（sidebarResources 的 zh 段） |
| `conversationSearch.nextLabel` | 下一个搜索结果 | renderer.js 内 `nextLabel:"…"`（sidebarResources 的 zh 段） |
| `conversationSearch.close` | 关闭搜索 | renderer.js 内 `close:"…"`（sidebarResources 的 zh 段） |
| `conversationSearch.closeLabel` | 关闭搜索 | renderer.js 内 `closeLabel:"…"`（sidebarResources 的 zh 段） |

### `feedback.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `feedback.open` | 问题反馈 | renderer.js 内 `open:"…"`（feedbackResources 的 zh 段） |
| `feedback.title` | 有什么想反馈的 | renderer.js 内 `title:"…"`（feedbackResources 的 zh 段） |
| `feedback.description` | 告诉我们你遇到的问题或建议，这些信息将用于改进 Qoder。 | renderer.js 内 `description:"…"`（feedbackResources 的 zh 段） |
| `feedback.contentLabel` | 问题或建议（必填） | renderer.js 内 `contentLabel:"…"`（feedbackResources 的 zh 段） |
| `feedback.contentPlaceholder` | 描述你看到了什么、期望发生什么，以及可以稳定复现的操作步骤 | renderer.js 内 `contentPlaceholder:"…"`（feedbackResources 的 zh 段） |
| `feedback.diagnosticsNotice` | 发送时会附带当前运行日志和你选择的截图，以帮助定位问题。 | renderer.js 内 `diagnosticsNotice:"…"`（feedbackResources 的 zh 段） |
| `feedback.characterCount` | {{current}} / {{max}} | renderer.js 内 `characterCount:"…"`（feedbackResources 的 zh 段） |
| `feedback.screenshotLabel` | 屏幕截图 | renderer.js 内 `screenshotLabel:"…"`（feedbackResources 的 zh 段） |
| `feedback.screenshotDescription` | 可添加、拖入或粘贴 PNG、JPG、GIF 或 WebP，最多 3 张，单张不超过 10 MB。 | renderer.js 内 `screenshotDescription:"…"`（feedbackResources 的 zh 段） |
| `feedback.screenshotAlt` | 反馈截图 {{index}} | renderer.js 内 `screenshotAlt:"…"`（feedbackResources 的 zh 段） |
| `feedback.screenshotName` | 反馈图片 {{index}} | renderer.js 内 `screenshotName:"…"`（feedbackResources 的 zh 段） |
| `feedback.previewScreenshot` | 预览反馈图片 {{index}} | renderer.js 内 `previewScreenshot:"…"`（feedbackResources 的 zh 段） |
| `feedback.removeScreenshot` | 移除第 {{index}} 张截图 | renderer.js 内 `removeScreenshot:"…"`（feedbackResources 的 zh 段） |
| `feedback.addImages` | 添加或粘贴截图 | renderer.js 内 `addImages:"…"`（feedbackResources 的 zh 段） |
| `feedback.dropImages` | 将图片放到这里 | renderer.js 内 `dropImages:"…"`（feedbackResources 的 zh 段） |
| `feedback.screenshotLimit` | 最多只能添加 3 张截图。 | renderer.js 内 `screenshotLimit:"…"`（feedbackResources 的 zh 段） |
| `feedback.screenshotTooLarge` | 截图超过 10 MB，未添加。 | renderer.js 内 `screenshotTooLarge:"…"`（feedbackResources 的 zh 段） |
| `feedback.unsupportedImage` | 仅支持 PNG、JPG、GIF 和 WebP 图片。 | renderer.js 内 `unsupportedImage:"…"`（feedbackResources 的 zh 段） |
| `feedback.imageReadFailed` | 图片未能读取，请重新选择。 | renderer.js 内 `imageReadFailed:"…"`（feedbackResources 的 zh 段） |
| `feedback.emailLabel` | 联系邮箱（可选） | renderer.js 内 `emailLabel:"…"`（feedbackResources 的 zh 段） |
| `feedback.emailPlaceholder` | 便于我们联系你进一步了解问题 | renderer.js 内 `emailPlaceholder:"…"`（feedbackResources 的 zh 段） |
| `feedback.emailInvalid` | 请输入有效的邮箱地址。 | renderer.js 内 `emailInvalid:"…"`（feedbackResources 的 zh 段） |
| `feedback.send` | 发送反馈 | renderer.js 内 `send:"…"`（feedbackResources 的 zh 段） |
| `feedback.sending` | 正在发送反馈… | renderer.js 内 `sending:"…"`（feedbackResources 的 zh 段） |
| `feedback.sent` | 反馈已发送，编号：{{requestId}} | renderer.js 内 `sent:"…"`（feedbackResources 的 zh 段） |
| `feedback.sentAndCopied` | 反馈已发送，编号：{{requestId}}，已自动复制到剪切板。 | renderer.js 内 `sentAndCopied:"…"`（feedbackResources 的 zh 段） |
| `feedback.requestIdSuffix` |  反馈编号：{{requestId}}。 | renderer.js 内 `requestIdSuffix:"…"`（feedbackResources 的 zh 段） |
| `feedback.errors.validation` | 反馈内容或附件不符合要求，请修改后重试。 | renderer.js 内 `validation:"…"`（feedbackResources 的 zh 段） |
| `feedback.errors.network` | 反馈未能发送，请检查网络后重试。 | renderer.js 内 `network:"…"`（feedbackResources 的 zh 段） |
| `feedback.errors.server` | 反馈服务暂时无法处理请求，请稍后重试。 | renderer.js 内 `server:"…"`（feedbackResources 的 zh 段） |
| `feedback.errors.unsupported` | 当前宿主尚不支持发送问题反馈。 | renderer.js 内 `unsupported:"…"`（feedbackResources 的 zh 段） |
| `feedback.errors.unknown` | 反馈未能发送，请稍后重试。 | renderer.js 内 `unknown:"…"`（feedbackResources 的 zh 段） |

### `myWork.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `myWork.title` | Attention | renderer.js 内 `title:"…"`（collaborationResources 的 zh 段） |
| `myWork.description` | 集中处理只有你能作出的判断；执行过程、普通更新和可自动恢复的问题不会出现在这里。 | renderer.js 内 `description:"…"`（collaborationResources 的 zh 段） |
| `myWork.decisions` | 需要我判断 | renderer.js 内 `decisions:"…"`（collaborationResources 的 zh 段） |
| `myWork.assigned` | 分配给我 | renderer.js 内 `assigned:"…"`（collaborationResources 的 zh 段） |

### `nav.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `nav.newChat` | 新的任务 | renderer.js 内 `newChat:"…"`（shellResources 的 zh 段） |
| `nav.chats` | 任务 | renderer.js 内 `chats:"…"`（shellResources 的 zh 段） |
| `nav.myWork` | 需要我 | renderer.js 内 `myWork:"…"`（shellResources 的 zh 段） |
| `nav.assigned` | 分配给我 | renderer.js 内 `assigned:"…"`（shellResources 的 zh 段） |
| `nav.needs` | 由我决定 | renderer.js 内 `needs:"…"`（shellResources 的 zh 段） |
| `nav.updates` | 动态 | renderer.js 内 `updates:"…"`（shellResources 的 zh 段） |
| `nav.members` | 成员 | renderer.js 内 `members:"…"`（shellResources 的 zh 段） |
| `nav.projects` | 项目 | renderer.js 内 `projects:"…"`（shellResources 的 zh 段） |
| `nav.discussion` | 讨论 | renderer.js 内 `discussion:"…"`（shellResources 的 zh 段） |
| `nav.betaTag` | Beta | renderer.js 内 `betaTag:"…"`（shellResources 的 zh 段） |
| `nav.search` | 搜索 | renderer.js 内 `search:"…"`（shellResources 的 zh 段） |
| `nav.automation` | 自动化 | renderer.js 内 `automation:"…"`（shellResources 的 zh 段） |
| `nav.extensions` | 扩展 | renderer.js 内 `extensions:"…"`（shellResources 的 zh 段） |
| `nav.settings` | 设置 | renderer.js 内 `settings:"…"`（shellResources 的 zh 段） |
| `nav.modeSwitcher` | 工作模式切换 | renderer.js 内 `modeSwitcher:"…"`（shellResources 的 zh 段） |
| `nav.modeCoding` | 编程 | renderer.js 内 `modeCoding:"…"`（shellResources 的 zh 段） |
| `nav.modeGeneral` | 通用 | renderer.js 内 `modeGeneral:"…"`（shellResources 的 zh 段） |
| `nav.primary` | 主导航 | renderer.js 内 `primary:"…"`（shellResources 的 zh 段） |
| `nav.secondary` | 辅助导航 | renderer.js 内 `secondary:"…"`（shellResources 的 zh 段） |
| `nav.collapseSidebar` | 收起左侧栏 | renderer.js 内 `collapseSidebar:"…"`（shellResources 的 zh 段） |
| `nav.expandSidebar` | 展开左侧栏 | renderer.js 内 `expandSidebar:"…"`（shellResources 的 zh 段） |
| `nav.goBack` | 后退 | renderer.js 内 `goBack:"…"`（shellResources 的 zh 段） |
| `nav.goForward` | 前进 | renderer.js 内 `goForward:"…"`（shellResources 的 zh 段） |
| `nav.workDirectories` | 工作目录 | renderer.js 内 `workDirectories:"…"`（shellResources 的 zh 段） |
| `nav.workspaces` | 工作区 | renderer.js 内 `workspaces:"…"`（shellResources 的 zh 段） |
| `nav.workspacesDescription` | 工作区就是 Agent 动手的地方：它会在这里看文件、改文件、跑命令，也会读取这里的 Git 状态。 | renderer.js 内 `workspacesDescription:"…"`（shellResources 的 zh 段） |
| `nav.pinnedChats` | 置顶 | renderer.js 内 `pinnedChats:"…"`（shellResources 的 zh 段） |
| `nav.recentChats` | 最近任务 | renderer.js 内 `recentChats:"…"`（shellResources 的 zh 段） |
| `nav.noWorkspaceChats` | 最近任务 | renderer.js 内 `noWorkspaceChats:"…"`（shellResources 的 zh 段） |
| `nav.unknownAgent` | 未知 Agent | renderer.js 内 `unknownAgent:"…"`（shellResources 的 zh 段） |
| `nav.chatFromAgent` | 任务“{{title}}”，Agent：{{agent}} | renderer.js 内 `chatFromAgent:"…"`（shellResources 的 zh 段） |
| `nav.voiceChat` | 语音任务 | renderer.js 内 `voiceChat:"…"`（shellResources 的 zh 段） |
| `nav.voiceChatFromAgent` | 语音任务“{{title}}”，Agent：{{agent}} | renderer.js 内 `voiceChatFromAgent:"…"`（shellResources 的 zh 段） |
| `nav.worktreeChat` | Worktree 任务 | renderer.js 内 `worktreeChat:"…"`（shellResources 的 zh 段） |
| `nav.newChatInWorkDirectory` | 在 {{name}} 中新建任务 | renderer.js 内 `newChatInWorkDirectory:"…"`（shellResources 的 zh 段） |
| `nav.collapseWorkDirectory` | 折叠工作目录 {{name}} | renderer.js 内 `collapseWorkDirectory:"…"`（shellResources 的 zh 段） |
| `nav.expandWorkDirectory` | 展开工作目录 {{name}} | renderer.js 内 `expandWorkDirectory:"…"`（shellResources 的 zh 段） |
| `nav.pinWorkDirectory` | 置顶工作目录 {{name}} | renderer.js 内 `pinWorkDirectory:"…"`（shellResources 的 zh 段） |
| `nav.unpinWorkDirectory` | 取消置顶工作目录 {{name}} | renderer.js 内 `unpinWorkDirectory:"…"`（shellResources 的 zh 段） |
| `nav.workDirectoryActions` | {{name}} 更多工作目录操作 | renderer.js 内 `workDirectoryActions:"…"`（shellResources 的 zh 段） |
| `nav.pinWorkDirectoryAction` | 置顶 | renderer.js 内 `pinWorkDirectoryAction:"…"`（shellResources 的 zh 段） |
| `nav.unpinWorkDirectoryAction` | 取消置顶 | renderer.js 内 `unpinWorkDirectoryAction:"…"`（shellResources 的 zh 段） |
| `nav.editWorkDirectoryAction` | 编辑 | renderer.js 内 `editWorkDirectoryAction:"…"`（shellResources 的 zh 段） |
| `nav.chatActions` | 任务 {{title}} 操作 | renderer.js 内 `chatActions:"…"`（shellResources 的 zh 段） |
| `nav.copyChatId` | 复制任务 ID | renderer.js 内 `copyChatId:"…"`（shellResources 的 zh 段） |
| `nav.copyChatIdSuccess` | 已复制任务 ID | renderer.js 内 `copyChatIdSuccess:"…"`（shellResources 的 zh 段） |
| `nav.copyChatIdError` | 任务 ID 未复制，请稍后重试。 | renderer.js 内 `copyChatIdError:"…"`（shellResources 的 zh 段） |
| `nav.sessionWaiting` | 等待你处理 | renderer.js 内 `sessionWaiting:"…"`（shellResources 的 zh 段） |
| `nav.sessionRunning` | 任务正在进行 | renderer.js 内 `sessionRunning:"…"`（shellResources 的 zh 段） |
| `nav.sessionUnread` | 有未读更新 | renderer.js 内 `sessionUnread:"…"`（shellResources 的 zh 段） |
| `nav.sessionError` | 任务执行失败 | renderer.js 内 `sessionError:"…"`（shellResources 的 zh 段） |
| `nav.renameChat` | 重命名 | renderer.js 内 `renameChat:"…"`（shellResources 的 zh 段） |
| `nav.exportChat` | 导出记录 | renderer.js 内 `exportChat:"…"`（shellResources 的 zh 段） |
| `nav.pinChat` | 全局置顶 | renderer.js 内 `pinChat:"…"`（shellResources 的 zh 段） |
| `nav.pinChatInWorkspace` | 在工作区内置顶 | renderer.js 内 `pinChatInWorkspace:"…"`（shellResources 的 zh 段） |
| `nav.unpinChatInWorkspace` | 取消工作区内置顶 | renderer.js 内 `unpinChatInWorkspace:"…"`（shellResources 的 zh 段） |
| `nav.workspacePinError` | 未能更新会话置顶，请重试 | renderer.js 内 `workspacePinError:"…"`（shellResources 的 zh 段） |
| `nav.unpinChat` | 取消全局置顶 | renderer.js 内 `unpinChat:"…"`（shellResources 的 zh 段） |
| `nav.markUnread` | 标记为未读 | renderer.js 内 `markUnread:"…"`（shellResources 的 zh 段） |
| `nav.markUnreadSuccess` | 已标记为未读 | renderer.js 内 `markUnreadSuccess:"…"`（shellResources 的 zh 段） |
| `nav.markUnreadError` | 暂时无法标记为未读，请稍后重试。 | renderer.js 内 `markUnreadError:"…"`（shellResources 的 zh 段） |
| `nav.renameChatTitle` | 重命名任务 | renderer.js 内 `renameChatTitle:"…"`（shellResources 的 zh 段） |
| `nav.renameChatDescription` | 保持简短且易于识别 | renderer.js 内 `renameChatDescription:"…"`（shellResources 的 zh 段） |
| `nav.renameChatError` | 这段协作的名称还没有更新，请稍后重试。 | renderer.js 内 `renameChatError:"…"`（shellResources 的 zh 段） |
| `nav.archiveChat` | 归档 | renderer.js 内 `archiveChat:"…"`（shellResources 的 zh 段） |
| `nav.archivingChat` | 正在归档... | renderer.js 内 `archivingChat:"…"`（shellResources 的 zh 段） |
| `nav.archiveChatTitle` | 归档“{{title}}”？ | renderer.js 内 `archiveChatTitle:"…"`（shellResources 的 zh 段） |
| `nav.archiveChatDoNotAskAgain` | 不再提示 | renderer.js 内 `archiveChatDoNotAskAgain:"…"`（shellResources 的 zh 段） |
| `nav.archiveChatDescription` | 它会离开当前任务列表，保留在设置里的已归档任务中；之后你可以在那里永久删除。 | renderer.js 内 `archiveChatDescription:"…"`（shellResources 的 zh 段） |
| `nav.archiveChatError` | 这段协作还没有归档，请稍后重试。 | renderer.js 内 `archiveChatError:"…"`（shellResources 的 zh 段） |
| `nav.selectChat` | 选择任务“{{title}}” | renderer.js 内 `selectChat:"…"`（shellResources 的 zh 段） |
| `nav.selectedChatCount` | 已选 {{count}} 个 | renderer.js 内 `selectedChatCount:"…"`（shellResources 的 zh 段） |
| `nav.cancelChatSelectionAction` | 取消多选 | renderer.js 内 `cancelChatSelectionAction:"…"`（shellResources 的 zh 段） |
| `nav.archiveSelectedChatsAction` | 归档所选任务 | renderer.js 内 `archiveSelectedChatsAction:"…"`（shellResources 的 zh 段） |
| `nav.archiveSelectedChatsTitle` | 归档 {{count}} 个任务？ | renderer.js 内 `archiveSelectedChatsTitle:"…"`（shellResources 的 zh 段） |
| `nav.archiveSelectedChatsDescription` | 这些任务会离开当前任务列表，并保留在设置里的已归档任务中；之后你可以在那里恢复或永久删除。 | renderer.js 内 `archiveSelectedChatsDescription:"…"`（shellResources 的 zh 段） |
| `nav.archiveSelectedChatsConfirm` | 归档所选任务 | renderer.js 内 `archiveSelectedChatsConfirm:"…"`（shellResources 的 zh 段） |
| `nav.archivingChats` | 正在归档任务... | renderer.js 内 `archivingChats:"…"`（shellResources 的 zh 段） |
| `nav.archiveSelectedChatsError` | 所选任务还没有归档，请稍后重试。 | renderer.js 内 `archiveSelectedChatsError:"…"`（shellResources 的 zh 段） |
| `nav.archiveSelectedChatsPartialError` | 已归档 {{archived}} 个任务，另有 {{failed}} 个未能归档，请稍后重试。 | renderer.js 内 `archiveSelectedChatsPartialError:"…"`（shellResources 的 zh 段） |
| `nav.exportChatSuccess` | 已导出为 {{filename}} | renderer.js 内 `exportChatSuccess:"…"`（shellResources 的 zh 段） |
| `nav.exportChatError` | 这段协作还没有导出，请稍后重试。 | renderer.js 内 `exportChatError:"…"`（shellResources 的 zh 段） |
| `nav.reorderChatError` | 任务位置还没有更新，请稍后重试。 | renderer.js 内 `reorderChatError:"…"`（shellResources 的 zh 段） |
| `nav.reorderWorkspaceError` | 工作区位置还没有更新，请稍后重试。 | renderer.js 内 `reorderWorkspaceError:"…"`（shellResources 的 zh 段） |
| `nav.deleteChat` | 删除 | renderer.js 内 `deleteChat:"…"`（shellResources 的 zh 段） |
| `nav.removeChat` | 移除任务 | renderer.js 内 `removeChat:"…"`（shellResources 的 zh 段） |
| `nav.deleteChatTitle` | 移除“{{title}}”？ | renderer.js 内 `deleteChatTitle:"…"`（shellResources 的 zh 段） |
| `nav.deleteChatDescription` | 它会离开当前列表；本地历史、决定和交付证据会暂时保留，方便需要时继续追溯。 | renderer.js 内 `deleteChatDescription:"…"`（shellResources 的 zh 段） |
| `nav.deleteChatError` | 这段协作还没有移除，请稍后重试。 | renderer.js 内 `deleteChatError:"…"`（shellResources 的 zh 段） |
| `nav.chatName` | 协作名称 | renderer.js 内 `chatName:"…"`（shellResources 的 zh 段） |
| `nav.environmentNotice` | 内测开发版本，不代表最终品质，注意保密 | renderer.js 内 `environmentNotice:"…"`（shellResources 的 zh 段） |
| `nav.closeEnvironmentNotice` | 关闭内测开发版本提示 | renderer.js 内 `closeEnvironmentNotice:"…"`（shellResources 的 zh 段） |
| `nav.futureDatabaseCompatibilityNotice` | 本地数据由更高版本创建，部分功能可能不兼容，建议更新后使用 | renderer.js 内 `futureDatabaseCompatibilityNotice:"…"`（shellResources 的 zh 段） |
| `nav.closeFutureDatabaseCompatibilityNotice` | 关闭本地数据兼容性提示 | renderer.js 内 `closeFutureDatabaseCompatibilityNotice:"…"`（shellResources 的 zh 段） |

### `productUpdate.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `productUpdate.notificationClose` | 关闭更新公告 | renderer.js 内 `notificationClose:"…"`（shellResources 的 zh 段） |
| `productUpdate.notificationActionFailed` | 操作失败，请重试。 | renderer.js 内 `notificationActionFailed:"…"`（shellResources 的 zh 段） |
| `productUpdate.installReady` | 安装 Qoder 更新 {{version}} | renderer.js 内 `installReady:"…"`（shellResources 的 zh 段） |
| `productUpdate.debugIndicatorReady` | 调试显示 Qoder 更新下载提示 | renderer.js 内 `debugIndicatorReady:"…"`（shellResources 的 zh 段） |
| `productUpdate.updateAction` | 更新 | renderer.js 内 `updateAction:"…"`（shellResources 的 zh 段） |
| `productUpdate.checkInProgress` | 正在检查 Qoder 更新 | renderer.js 内 `checkInProgress:"…"`（shellResources 的 zh 段） |
| `productUpdate.downloadInProgress` | 正在下载 Qoder 更新 {{version}} | renderer.js 内 `downloadInProgress:"…"`（shellResources 的 zh 段） |
| `productUpdate.verifyInProgress` | 正在验证 Qoder 更新 {{version}} | renderer.js 内 `verifyInProgress:"…"`（shellResources 的 zh 段） |
| `productUpdate.restartInProgress` | 正在安装更新，Qoder 即将重启 | renderer.js 内 `restartInProgress:"…"`（shellResources 的 zh 段） |
| `productUpdate.confirmTitle` | 安装 Qoder {{version}} | renderer.js 内 `confirmTitle:"…"`（shellResources 的 zh 段） |
| `productUpdate.confirmDescription` | 更新已经下载并验证。安装会退出并重新打开 Qoder。 | renderer.js 内 `confirmDescription:"…"`（shellResources 的 zh 段） |
| `productUpdate.installAndRestart` | 安装并重启应用 | renderer.js 内 `installAndRestart:"…"`（shellResources 的 zh 段） |
| `productUpdate.preparingInstall` | 正在准备安装... | renderer.js 内 `preparingInstall:"…"`（shellResources 的 zh 段） |
| `productUpdate.updateLater` | 稍后更新 | renderer.js 内 `updateLater:"…"`（shellResources 的 zh 段） |
| `productUpdate.stopAndUpdate` | 停止并更新 | renderer.js 内 `stopAndUpdate:"…"`（shellResources 的 zh 段） |
| `productUpdate.blockedTitle` | Agent 正在执行 | renderer.js 内 `blockedTitle:"…"`（shellResources 的 zh 段） |
| `productUpdate.blockedDescription` | 正在执行 {{running}} 项、后台任务 {{background}} 个、排队 {{queued}} 项、等待交互 {{interactions}} 项。继续更新会停止这些工作并重启 Qoder。 | renderer.js 内 `blockedDescription:"…"`（shellResources 的 zh 段） |
| `productUpdate.newerVersionDownloading` | 发现更新的版本，正在后台下载。 | renderer.js 内 `newerVersionDownloading:"…"`（shellResources 的 zh 段） |
| `productUpdate.downloadFailed` | 新版下载失败，稍后会自动重试。 | renderer.js 内 `downloadFailed:"…"`（shellResources 的 zh 段） |
| `productUpdate.revoked` | 这个版本已不再提供。 | renderer.js 内 `revoked:"…"`（shellResources 的 zh 段） |
| `productUpdate.networkUnavailable` | 暂时无法确认更新版本，请检查网络后重试。 | renderer.js 内 `networkUnavailable:"…"`（shellResources 的 zh 段） |
| `productUpdate.notReady` | 更新尚未准备好，请稍后重试。 | renderer.js 内 `notReady:"…"`（shellResources 的 zh 段） |
| `productUpdate.checkFailed` | 无法确认更新版本，请稍后重试。 | renderer.js 内 `checkFailed:"…"`（shellResources 的 zh 段） |
| `productUpdate.downloadPageOpened` | 已打开 Qoder 官网，请下载并安装最新 Linux 版本。当前版本 {{version}}。 | renderer.js 内 `downloadPageOpened:"…"`（shellResources 的 zh 段） |
| `productUpdate.downloadPageOpenFailed` | 无法打开 Qoder 官网，请在浏览器中访问 qoder.com 下载最新 Linux 版本。 | renderer.js 内 `downloadPageOpenFailed:"…"`（shellResources 的 zh 段） |
| `productUpdate.installFailed` | 无法启动更新安装，当前应用将继续运行。 | renderer.js 内 `installFailed:"…"`（shellResources 的 zh 段） |
| `productUpdate.installFailedReadOnly` | 安装失败：应用位于只读卷，无法就地更新。请用访达将 Qoder.app 移动到「应用程序」文件夹后重试。 | renderer.js 内 `installFailedReadOnly:"…"`（shellResources 的 zh 段） |
| `productUpdate.translocationWarning` | 当前应用正从 macOS 只读快照（App Translocation）运行，无法自动更新。请用访达将 Qoder.app 移动到「应用程序」文件夹后重新打开。 | renderer.js 内 `translocationWarning:"…"`（shellResources 的 zh 段） |

### `sidebarGroup.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `sidebarGroup.title` | 自定义分组 | renderer.js 内 `title:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.pinError` | 无法更改分组置顶状态 | renderer.js 内 `pinError:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.newChat` | 在“{{name}}”中新建对话 | renderer.js 内 `newChat:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.createAction` | 新建分组 | renderer.js 内 `createAction:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.createAndMoveAction` | 新建分组并移动 | renderer.js 内 `createAndMoveAction:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.createAndMoveSelectedAction` | 新建分组并移动所选任务 | renderer.js 内 `createAndMoveSelectedAction:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.moveSessionAction` | 移动到分组 | renderer.js 内 `moveSessionAction:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.moveSelectedAction` | 移动所选任务到分组 | renderer.js 内 `moveSelectedAction:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.none` | 未分组对话 | renderer.js 内 `none:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.openActions` | 打开分组“{{name}}”的操作 | renderer.js 内 `openActions:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.editAction` | 编辑分组 | renderer.js 内 `editAction:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.archiveSessionsAction` | 归档分组内任务 | renderer.js 内 `archiveSessionsAction:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.clearAction` | 解散分组 | renderer.js 内 `clearAction:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.sessionCount` | {{count}} 个任务 | renderer.js 内 `sessionCount:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.moveError` | 无法移动任务到分组 | renderer.js 内 `moveError:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.archiveSessionsError` | 无法归档分组内任务 | renderer.js 内 `archiveSessionsError:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.clearError` | 无法解散分组 | renderer.js 内 `clearError:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.archiveSessionsTitle` | 归档“{{name}}”中的任务？ | renderer.js 内 `archiveSessionsTitle:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.archiveSessionsDescription` | 分组内的任务将进入归档，分组会保留供之后继续使用。 | renderer.js 内 `archiveSessionsDescription:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.archiveSessionsConfirm` | 归档任务 | renderer.js 内 `archiveSessionsConfirm:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.clearTitle` | 解散“{{name}}”？ | renderer.js 内 `clearTitle:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.clearDescription` | 分组将被删除，其中的任务会移到“未分组对话”。任务内容不会被删除。 | renderer.js 内 `clearDescription:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.clearConfirm` | 解散分组 | renderer.js 内 `clearConfirm:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.confirming` | 正在处理… | renderer.js 内 `confirming:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.createTitle` | 新建任务分组 | renderer.js 内 `createTitle:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.editTitle` | 编辑任务分组 | renderer.js 内 `editTitle:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.description` | 分组只整理侧栏中的任务，不会改变工作区或执行位置。 | renderer.js 内 `description:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.nameLabel` | 分组名称 | renderer.js 内 `nameLabel:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.namePlaceholder` | 例如：本周重点 | renderer.js 内 `namePlaceholder:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.colorLabel` | 颜色 | renderer.js 内 `colorLabel:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.colorPicker.hue` | 色相 | renderer.js 内 `hue:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.colorPicker.saturation` | 饱和度 | renderer.js 内 `saturation:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.colorPicker.brightness` | 亮度 | renderer.js 内 `brightness:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.colorPicker.hex` | HEX 色值 | renderer.js 内 `hex:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.colorPicker.invalid` | 请输入 # 开头的六位 HEX 色值 | renderer.js 内 `invalid:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.color.red` | 红色 | renderer.js 内 `red:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.color.orange` | 橙色 | renderer.js 内 `orange:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.color.yellow` | 黄色 | renderer.js 内 `yellow:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.color.green` | 绿色 | renderer.js 内 `green:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.color.blue` | 蓝色 | renderer.js 内 `blue:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.color.purple` | 紫色 | renderer.js 内 `purple:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.color.custom` | 自定义颜色 | renderer.js 内 `custom:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.shapeLabel` | 标记形状 | renderer.js 内 `shapeLabel:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.shape.circle` | 圆形 | renderer.js 内 `circle:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.shape.diamond` | 菱形 | renderer.js 内 `diamond:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.shape.square` | 方形 | renderer.js 内 `square:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.shape.triangle` | 三角形 | renderer.js 内 `triangle:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.shape.hexagon` | 六边形 | renderer.js 内 `hexagon:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.shape.star` | 星形 | renderer.js 内 `star:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.saveError` | 无法保存分组 | renderer.js 内 `saveError:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.saving` | 正在保存… | renderer.js 内 `saving:"…"`（sidebarResources 的 zh 段） |
| `sidebarGroup.saveAction` | 保存 | renderer.js 内 `saveAction:"…"`（sidebarResources 的 zh 段） |

### `sidebarView.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `sidebarView.activityTitle` | 最近对话 | renderer.js 内 `activityTitle:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.showMore` | 展示更多 | renderer.js 内 `showMore:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.collapse` | 收起 | renderer.js 内 `collapse:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.showMoreSessions` | 展示 {{name}} 的更多任务 | renderer.js 内 `showMoreSessions:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.collapseSessions` | 收起 {{name}} 的任务 | renderer.js 内 `collapseSessions:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.sessions` | 任务 | renderer.js 内 `sessions:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.openMenu` | 自定义任务视图 | renderer.js 内 `openMenu:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.grouping.label` | 分组方式 | renderer.js 内 `label:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.grouping.workspace` | 按工作区 | renderer.js 内 `workspace:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.grouping.activity` | 按活动日期 | renderer.js 内 `activity:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.grouping.custom` | 按自定义分组 | renderer.js 内 `custom:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.grouping.none` | 不分组 | renderer.js 内 `none:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.sorting.label` | 排序方式 | renderer.js 内 `label:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.sorting.manual` | 手动 | renderer.js 内 `manual:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.sorting.updated` | 最近更新 | renderer.js 内 `updated:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.sorting.name` | 名称 | renderer.js 内 `name:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.sorting.created` | 创建时间 | renderer.js 内 `created:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.workspace.label` | 工作区 | renderer.js 内 `label:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.workspace.all` | 全部 | renderer.js 内 `all:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.workspace.none` | 无工作区 | renderer.js 内 `none:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.workspace.unknown` | 不可用 | renderer.js 内 `unknown:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.activity.label` | 最近活动 | renderer.js 内 `label:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.activity.all` | 全部 | renderer.js 内 `all:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.activity.today` | 今天 | renderer.js 内 `today:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.activity.7d` | 最近 7 天 | renderer.js 内 `7d:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.activity.30d` | 最近 30 天 | renderer.js 内 `30d:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.reset` | 恢复默认 | renderer.js 内 `reset:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.empty` | 暂无任务数据 :) | renderer.js 内 `empty:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.workspaceEmpty` | 暂无任务 :) | renderer.js 内 `workspaceEmpty:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.clearFilters` | 清除筛选 | renderer.js 内 `clearFilters:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.loadingMore` | 正在加载… | renderer.js 内 `loadingMore:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.loadMoreError` | 加载更多任务失败，请重试 | renderer.js 内 `loadMoreError:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.retryLoadMore` | 重试加载 | renderer.js 内 `retryLoadMore:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.group.today` | 今天 | renderer.js 内 `today:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.group.yesterday` | 昨天 | renderer.js 内 `yesterday:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.group.7d` | 最近 7 天 | renderer.js 内 `7d:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.group.older` | 更早 | renderer.js 内 `older:"…"`（sidebarResources 的 zh 段） |
| `sidebarView.group.all` | 全部任务 | renderer.js 内 `all:"…"`（sidebarResources 的 zh 段） |

### `updates.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `updates.title` | 动态 | renderer.js 内 `title:"…"`（shellResources 的 zh 段） |
| `updates.open` | 打开动态 | renderer.js 内 `open:"…"`（shellResources 的 zh 段） |
| `updates.important` | 需要了解 | renderer.js 内 `important:"…"`（shellResources 的 zh 段） |
| `updates.recent` | 最近更新 | renderer.js 内 `recent:"…"`（shellResources 的 zh 段） |
| `updates.viewAll` | 查看全部动态 | renderer.js 内 `viewAll:"…"`（shellResources 的 zh 段） |
| `updates.hiddenTitle` | 已隐藏动态 | renderer.js 内 `hiddenTitle:"…"`（shellResources 的 zh 段） |
| `updates.viewHidden` | 查看已隐藏动态 | renderer.js 内 `viewHidden:"…"`（shellResources 的 zh 段） |
| `updates.viewActive` | 返回动态 | renderer.js 内 `viewActive:"…"`（shellResources 的 zh 段） |
| `updates.more` | 更多动态操作 | renderer.js 内 `more:"…"`（shellResources 的 zh 段） |
| `updates.markAllRead` | 全部标为已读 | renderer.js 内 `markAllRead:"…"`（shellResources 的 zh 段） |
| `updates.markAllReadFailed` | 未能把动态标为已读，请重试。 | renderer.js 内 `markAllReadFailed:"…"`（shellResources 的 zh 段） |
| `updates.hide` | 隐藏动态 | renderer.js 内 `hide:"…"`（shellResources 的 zh 段） |
| `updates.hiding` | 正在隐藏… | renderer.js 内 `hiding:"…"`（shellResources 的 zh 段） |
| `updates.hideFailed` | 这条动态未隐藏，请重试。 | renderer.js 内 `hideFailed:"…"`（shellResources 的 zh 段） |
| `updates.restore` | 恢复动态 | renderer.js 内 `restore:"…"`（shellResources 的 zh 段） |
| `updates.restoring` | 正在恢复… | renderer.js 内 `restoring:"…"`（shellResources 的 zh 段） |
| `updates.restoreFailed` | 这条动态未恢复，请重试。 | renderer.js 内 `restoreFailed:"…"`（shellResources 的 zh 段） |
| `updates.read` | 已读 | renderer.js 内 `read:"…"`（shellResources 的 zh 段） |
| `updates.unread` | 未读 | renderer.js 内 `unread:"…"`（shellResources 的 zh 段） |
| `updates.empty` | 没有新的动态 | renderer.js 内 `empty:"…"`（shellResources 的 zh 段） |
| `updates.emptyDescription` | 评论、提及和订阅 Issue 的变化会出现在这里。 | renderer.js 内 `emptyDescription:"…"`（shellResources 的 zh 段） |
| `updates.emptyArchived` | 没有已隐藏动态 | renderer.js 内 `emptyArchived:"…"`（shellResources 的 zh 段） |
| `updates.emptyArchivedDescription` | 你隐藏的动态会保留在这里，随时可以恢复。 | renderer.js 内 `emptyArchivedDescription:"…"`（shellResources 的 zh 段） |
| `updates.unavailable` | 无法读取动态 | renderer.js 内 `unavailable:"…"`（shellResources 的 zh 段） |
| `updates.unavailableDescription` | 本地协作数据暂时不可用，请稍后重试。 | renderer.js 内 `unavailableDescription:"…"`（shellResources 的 zh 段） |
| `updates.select` | 选择一条动态 | renderer.js 内 `select:"…"`（shellResources 的 zh 段） |
| `updates.selectDescription` | 选择左侧动态后，可在原 Issue 上下文中查看变化。 | renderer.js 内 `selectDescription:"…"`（shellResources 的 zh 段） |

### `windowControls.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `windowControls.minimize` | 最小化 | renderer.js 内 `minimize:"…"`（shellResources 的 zh 段） |
| `windowControls.maximize` | 最大化 | renderer.js 内 `maximize:"…"`（shellResources 的 zh 段） |
| `windowControls.restore` | 还原 | renderer.js 内 `restore:"…"`（shellResources 的 zh 段） |
| `windowControls.close` | 关闭 | renderer.js 内 `close:"…"`（shellResources 的 zh 段） |

### `workspace.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `workspace.create` | 新建工作区 | renderer.js 内 `create:"…"`（workspaceResources 的 zh 段） |
| `workspace.createMenu` | 选择新建工作区类型 | renderer.js 内 `createMenu:"…"`（workspaceResources 的 zh 段） |
| `workspace.createLocal` | 新建本地工作区 | renderer.js 内 `createLocal:"…"`（workspaceResources 的 zh 段） |
| `workspace.createRemote` | 新建远程工作区 | renderer.js 内 `createRemote:"…"`（workspaceResources 的 zh 段） |
| `workspace.createTitle` | 新建工作区 | renderer.js 内 `createTitle:"…"`（workspaceResources 的 zh 段） |
| `workspace.createType` | 运行位置 | renderer.js 内 `createType:"…"`（workspaceResources 的 zh 段） |
| `workspace.localType` | 本地 | renderer.js 内 `localType:"…"`（workspaceResources 的 zh 段） |
| `workspace.createAction` | 创建工作区 | renderer.js 内 `createAction:"…"`（workspaceResources 的 zh 段） |
| `workspace.expandAll` | 展开全部工作区 | renderer.js 内 `expandAll:"…"`（workspaceResources 的 zh 段） |
| `workspace.collapseAll` | 折叠全部工作区 | renderer.js 内 `collapseAll:"…"`（workspaceResources 的 zh 段） |
| `workspace.edit` | 编辑工作区 {{name}} | renderer.js 内 `edit:"…"`（workspaceResources 的 zh 段） |
| `workspace.pin` | 置顶工作区 {{name}} | renderer.js 内 `pin:"…"`（workspaceResources 的 zh 段） |
| `workspace.unpin` | 取消置顶工作区 {{name}} | renderer.js 内 `unpin:"…"`（workspaceResources 的 zh 段） |
| `workspace.editWorkspaceAction` | 编辑工作区 | renderer.js 内 `editWorkspaceAction:"…"`（workspaceResources 的 zh 段） |
| `workspace.editActiveSessionDisabled` | 当前会话已锁定工作区，无法切换。如需使用其他工作区，请新建会话。 | renderer.js 内 `editActiveSessionDisabled:"…"`（workspaceResources 的 zh 段） |
| `workspace.contextWorkspaceCount` | {{count}} 个工作区 | renderer.js 内 `contextWorkspaceCount:"…"`（workspaceResources 的 zh 段） |
| `workspace.editorDescription` | 一个工作区可以包含多个项目文件夹；主文件夹用于 Open Workspace 和 Open in。 | renderer.js 内 `editorDescription:"…"`（workspaceResources 的 zh 段） |
| `workspace.name` | 工作区名称 | renderer.js 内 `name:"…"`（workspaceResources 的 zh 段） |
| `workspace.folder` | 主文件夹 | renderer.js 内 `folder:"…"`（workspaceResources 的 zh 段） |
| `workspace.sourceFolders` | 源文件夹 | renderer.js 内 `sourceFolders:"…"`（workspaceResources 的 zh 段） |
| `workspace.dropFolderError` | 无法读取拖入的文件夹，请点击添加文件夹重试。 | renderer.js 内 `dropFolderError:"…"`（workspaceResources 的 zh 段） |
| `workspace.icon` | 工作区图标 | renderer.js 内 `icon:"…"`（workspaceResources 的 zh 段） |
| `workspace.color` | 工作区颜色 | renderer.js 内 `color:"…"`（workspaceResources 的 zh 段） |
| `workspace.projects` | 项目文件夹 | renderer.js 内 `projects:"…"`（workspaceResources 的 zh 段） |
| `workspace.primary` | 主要 | renderer.js 内 `primary:"…"`（workspaceResources 的 zh 段） |
| `workspace.setPrimary` | 设为主要 | renderer.js 内 `setPrimary:"…"`（workspaceResources 的 zh 段） |
| `workspace.removeProject` | 移除项目 {{name}} | renderer.js 内 `removeProject:"…"`（workspaceResources 的 zh 段） |
| `workspace.projectsRequired` | 至少添加一个项目，并设置一个主项目。 | renderer.js 内 `projectsRequired:"…"`（workspaceResources 的 zh 段） |
| `workspace.noWorkspace` | 不指定工作区 | renderer.js 内 `noWorkspace:"…"`（workspaceResources 的 zh 段） |
| `workspace.search` | 搜索工作区 | renderer.js 内 `search:"…"`（workspaceResources 的 zh 段） |
| `workspace.saving` | 正在保存... | renderer.js 内 `saving:"…"`（workspaceResources 的 zh 段） |
| `workspace.created` | 工作区已创建 | renderer.js 内 `created:"…"`（workspaceResources 的 zh 段） |
| `workspace.updated` | 工作区已更新 | renderer.js 内 `updated:"…"`（workspaceResources 的 zh 段） |
| `workspace.saveError` | 工作区尚未保存，请稍后重试。 | renderer.js 内 `saveError:"…"`（workspaceResources 的 zh 段） |

## 15 模型与档位选择

_条目数：320_

### `composer.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `composer.model.ariaLabel` | 模型 | renderer.js 内 `ariaLabel:"…"`（newChatResources 的 zh 段） |
| `composer.model.autoSelect` | 自动选择 | renderer.js 内 `autoSelect:"…"`（newChatResources 的 zh 段） |
| `composer.model.liveVoiceSwitchDisabled` | 语音会话过程中，暂不支持模型切换 | renderer.js 内 `liveVoiceSwitchDisabled:"…"`（newChatResources 的 zh 段） |
| `composer.model.providerTabsAriaLabel` | 模型分类 | renderer.js 内 `providerTabsAriaLabel:"…"`（newChatResources 的 zh 段） |
| `composer.model.computeBeans.billing` | 消耗算力豆套餐额度 | renderer.js 内 `billing:"…"`（newChatResources 的 zh 段） |
| `composer.model.computeBeans.usage` | 查看算力豆用量 | renderer.js 内 `usage:"…"`（newChatResources 的 zh 段） |
| `composer.model.computeBeans.purchase` | 购买算力豆 | renderer.js 内 `purchase:"…"`（newChatResources 的 zh 段） |
| `composer.model.computeBeans.failed` | 无法打开链接，请重试。 | renderer.js 内 `failed:"…"`（newChatResources 的 zh 段） |
| `composer.model.category.default` | 默认 | renderer.js 内 `default:"…"`（newChatResources 的 zh 段） |
| `composer.model.category.cmcc` | 中国移动 | renderer.js 内 `cmcc:"…"`（newChatResources 的 zh 段） |
| `composer.model.category.enterprise` | 企业专属 | renderer.js 内 `enterprise:"…"`（newChatResources 的 zh 段） |
| `composer.model.category.custom` | 自定义 | renderer.js 内 `custom:"…"`（newChatResources 的 zh 段） |
| `composer.model.organizationProvided` | 当前模型由您的组织提供 | renderer.js 内 `organizationProvided:"…"`（newChatResources 的 zh 段） |
| `composer.model.emptyLabel` | 暂无可用模型 | renderer.js 内 `emptyLabel:"…"`（newChatResources 的 zh 段） |
| `composer.model.missingLabel` | 模型已失效 | renderer.js 内 `missingLabel:"…"`（newChatResources 的 zh 段） |
| `composer.model.missingDescription` | 当前模型已失效，请重新选择（模型可能已下线或不在当前账号中） | renderer.js 内 `missingDescription:"…"`（newChatResources 的 zh 段） |
| `composer.model.unavailable` | 不可用 | renderer.js 内 `unavailable:"…"`（newChatResources 的 zh 段） |
| `composer.model.costTitle` | 消耗 | renderer.js 内 `costTitle:"…"`（newChatResources 的 zh 段） |
| `composer.model.upgradeAction` | 升级或购买更多额度 | renderer.js 内 `upgradeAction:"…"`（newChatResources 的 zh 段） |
| `composer.model.openLinkFailed` | 无法打开链接，请重试。 | renderer.js 内 `openLinkFailed:"…"`（newChatResources 的 zh 段） |
| `composer.model.defaultDescription` | 系统默认模型。 | renderer.js 内 `defaultDescription:"…"`（newChatResources 的 zh 段） |
| `composer.model.noDescription` | 暂无描述 | renderer.js 内 `noDescription:"…"`（newChatResources 的 zh 段） |
| `composer.model.tags.limitedTimeFree` | 免费畅用 | renderer.js 内 `limitedTimeFree:"…"`（newChatResources 的 zh 段） |
| `composer.model.personalUnavailableDescription` | 这个 {{provider}} 个人模型当前不可用，请先在模型设置中处理。 | renderer.js 内 `personalUnavailableDescription:"…"`（newChatResources 的 zh 段） |
| `composer.model.personalExecutionUnsupportedDescription` | 个人模型只能在本机内置 Qoder Runtime 中执行。 | renderer.js 内 `personalExecutionUnsupportedDescription:"…"`（newChatResources 的 zh 段） |
| `composer.model.noAccessDescription` | 当前账号没有这个模型的访问权限。 | renderer.js 内 `noAccessDescription:"…"`（newChatResources 的 zh 段） |
| `composer.model.workspaceRestricted` | Workspace 限制 | renderer.js 内 `workspaceRestricted:"…"`（newChatResources 的 zh 段） |
| `composer.model.securityPolicyRestricted` | 代码库安全策略限制 | renderer.js 内 `securityPolicyRestricted:"…"`（newChatResources 的 zh 段） |
| `composer.model.workspaceRestrictedDescription` | 该 Workspace 包含受安全策略保护的代码库，因此不能使用此模型。请切换到可用模型。 | renderer.js 内 `workspaceRestrictedDescription:"…"`（newChatResources 的 zh 段） |
| `composer.model.noAccess` | 无权限 | renderer.js 内 `noAccess:"…"`（newChatResources 的 zh 段） |
| `composer.model.statusTitle` | 模型状态 | renderer.js 内 `statusTitle:"…"`（newChatResources 的 zh 段） |
| `composer.model.dismissStatus` | 关闭模型状态提示 | renderer.js 内 `dismissStatus:"…"`（newChatResources 的 zh 段） |
| `composer.model.sessionUnavailable` | 当前账号无法使用这个任务的模型，请先切换模型。 | renderer.js 内 `sessionUnavailable:"…"`（newChatResources 的 zh 段） |
| `composer.model.sessionWorkspaceRestricted` | 当前 Workspace 不支持这个任务的模型，请先切换模型。 | renderer.js 内 `sessionWorkspaceRestricted:"…"`（newChatResources 的 zh 段） |
| `composer.model.selectionUnavailable` | 当前执行位置无法使用已选择的模型，请先切换模型。 | renderer.js 内 `selectionUnavailable:"…"`（newChatResources 的 zh 段） |
| `composer.model.loadFailedLabel` | 加载失败 | renderer.js 内 `loadFailedLabel:"…"`（newChatResources 的 zh 段） |
| `composer.model.loadFailed` | 模型列表加载失败，请重新打开模型菜单重试，或选择可用模型。 | renderer.js 内 `loadFailed:"…"`（newChatResources 的 zh 段） |
| `composer.model.promotion.active` | 低峰折扣进行中 | renderer.js 内 `active:"…"`（newChatResources 的 zh 段） |
| `composer.model.promotion.countdown` | {{time}}后进入低峰折扣 | renderer.js 内 `countdown:"…"`（newChatResources 的 zh 段） |
| `composer.model.catalog.auto.label` | Auto | renderer.js 内 `label:"…"`（newChatResources 的 zh 段） |
| `composer.model.catalog.auto.description` | 自动选择适合当前任务的模型 | renderer.js 内 `description:"…"`（newChatResources 的 zh 段） |
| `composer.model.catalog.ultimate.label` | 旗舰 | renderer.js 内 `label:"…"`（newChatResources 的 zh 段） |
| `composer.model.catalog.ultimate.description` | 专业旗舰，从容应对复杂任务 | renderer.js 内 `description:"…"`（newChatResources 的 zh 段） |
| `composer.model.catalog.performance.label` | 性能 | renderer.js 内 `label:"…"`（newChatResources 的 zh 段） |
| `composer.model.catalog.performance.description` | 兼顾效果与响应速度 | renderer.js 内 `description:"…"`（newChatResources 的 zh 段） |
| `composer.model.catalog.efficient.label` | 高效 | renderer.js 内 `label:"…"`（newChatResources 的 zh 段） |
| `composer.model.catalog.efficient.description` | 智能高效，适合日常任务 | renderer.js 内 `description:"…"`（newChatResources 的 zh 段） |
| `composer.model.catalog.lite.label` | 轻量 | renderer.js 内 `label:"…"`（newChatResources 的 zh 段） |
| `composer.model.catalog.lite.description` | 快速响应，适合简单任务 | renderer.js 内 `description:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.open` | 模型管理 | renderer.js 内 `open:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.title` | 模型设置 | renderer.js 内 `title:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.description` | 这些偏好对所有任务生效。运行中的回复保持当前设置，下一轮开始使用新设置。 | renderer.js 内 `description:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.tableLabel` | 模型参数与显示设置 | renderer.js 内 `tableLabel:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.noProviderModels` | 暂无可配置的模型 | renderer.js 内 `noProviderModels:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.addModels` | 添加模型 | renderer.js 内 `addModels:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.columns.model` | 模型名称 | renderer.js 内 `model:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.columns.effort` | 思考强度 | renderer.js 内 `effort:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.columns.visible` | 显示状态 | renderer.js 内 `visible:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.columns.contextWindow` | 上下文窗口 | renderer.js 内 `contextWindow:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.loading` | 正在读取模型设置… | renderer.js 内 `loading:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.loadFailed` | 无法读取模型设置 | renderer.js 内 `loadFailed:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.loadFailedDescription` | 模型设置暂时不可用，请重试后再编辑。 | renderer.js 内 `loadFailedDescription:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.saveFailed` | 无法保存模型设置 | renderer.js 内 `saveFailed:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.saveFailedDescription` | 设置没有保存，请检查后重试。 | renderer.js 内 `saveFailedDescription:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.catalogUpdatedDescription` | 模型列表已更新。已保留仍然有效的修改，请确认后再次保存。 | renderer.js 内 `catalogUpdatedDescription:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.catalogResetDescription` | 模型列表已更新，不再支持的修改已恢复为模型默认；无需再次保存，可直接关闭。 | renderer.js 内 `catalogResetDescription:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.save` | 保存设置 | renderer.js 内 `save:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.saving` | 正在保存… | renderer.js 内 `saving:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.defaultBadge` | 默认 | renderer.js 内 `defaultBadge:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.available` | 可用 | renderer.js 内 `available:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.unavailable` | 当前模型不可用 | renderer.js 内 `unavailable:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.unsupported` | 不支持 | renderer.js 内 `unsupported:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.followsDefault` | 跟随模型默认 | renderer.js 内 `followsDefault:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.followDefault` | 跟随模型默认（{{value}}） | renderer.js 内 `followDefault:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.resetDefault` | 跟随默认 | renderer.js 内 `resetDefault:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.contextValueDefault` | {{value}}（默认） | renderer.js 内 `contextValueDefault:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.effortLabel` | 设置 {{model}} 的思考强度 | renderer.js 内 `effortLabel:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.contextLabel` | 设置 {{model}} 的上下文窗口 | renderer.js 内 `contextLabel:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.visibleLabel` | 在模型选择器中显示 {{model}} | renderer.js 内 `visibleLabel:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.discardForAddModel.title` | 放弃当前模型设置并添加模型？ | renderer.js 内 `title:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.discardForAddModel.description` | 尚未保存的模型设置会丢失。之后将前往模型列表添加自定义模型。 | renderer.js 内 `description:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.discardForAddModel.confirm` | 放弃并添加模型 | renderer.js 内 `confirm:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.validation.visibleModelRequired` | 至少保留一个可见且可用的模型。 | renderer.js 内 `visibleModelRequired:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.validation.visibleModelRequiredAction` | 至少保留一个可见且可用的模型，然后再次保存。 | renderer.js 内 `visibleModelRequiredAction:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.validation.noConfigurableModels` | 当前没有可配置的模型。刷新模型列表后重试。 | renderer.js 内 `noConfigurableModels:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.validation.modelUnavailable` | {{model}} 已不在当前可配置的模型列表中。刷新后重新选择模型。 | renderer.js 内 `modelUnavailable:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.validation.modelListChanged` | 模型列表已发生变化。关闭并重新打开模型设置后再保存。 | renderer.js 内 `modelListChanged:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.validation.contextWindowUnsupported` | {{model}} 不支持 {{value}} 上下文窗口。请选择其他档位或跟随模型默认值。 | renderer.js 内 `contextWindowUnsupported:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.validation.reasoningEffortUnsupported` | {{model}} 不支持“{{value}}”。请选择其他思考强度或跟随模型默认值。 | renderer.js 内 `reasoningEffortUnsupported:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.validation.modelMissing` | 模型设置中缺少 {{model}}。关闭并重新打开模型设置后再保存。 | renderer.js 内 `modelMissing:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.validation.modelSetInvalid` | 模型设置包含重复或多余的模型。关闭并重新打开模型设置后再保存。 | renderer.js 内 `modelSetInvalid:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.efforts.none` | 关闭思考 | renderer.js 内 `none:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.efforts.minimal` | 最小 | renderer.js 内 `minimal:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.efforts.low` | 低 | renderer.js 内 `low:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.efforts.medium` | 中 | renderer.js 内 `medium:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.efforts.high` | 高 | renderer.js 内 `high:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.efforts.xhigh` | 极高 | renderer.js 内 `xhigh:"…"`（newChatResources 的 zh 段） |
| `composer.model.settings.efforts.max` | 最大 | renderer.js 内 `max:"…"`（newChatResources 的 zh 段） |

### `newChat.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `newChat.customizeExecutor` | 前往自定义 | renderer.js 内 `customizeExecutor:"…"`（newChatResources 的 zh 段） |
| `newChat.teamTextOnlyError` | Agent Team 任务暂仅支持文本输入。 | renderer.js 内 `teamTextOnlyError:"…"`（newChatResources 的 zh 段） |
| `newChat.teamUnavailableError` | 这个 Agent Team 当前不可用，请刷新后重试。 | renderer.js 内 `teamUnavailableError:"…"`（newChatResources 的 zh 段） |
| `newChat.teamLeaderRuntimeUnavailable` | 队长 Agent 当前不可用。检查其协作设置和本机连接后重试，草稿已保留。 | renderer.js 内 `teamLeaderRuntimeUnavailable:"…"`（newChatResources 的 zh 段） |
| `newChat.teamConfigurationChanged` | Agent Team 配置已更新。等待配置同步后重试，草稿已保留。 | renderer.js 内 `teamConfigurationChanged:"…"`（newChatResources 的 zh 段） |
| `newChat.teamLocalRuntimeOnlyError` | Agent Team 任务当前仅支持本地运行。 | renderer.js 内 `teamLocalRuntimeOnlyError:"…"`（newChatResources 的 zh 段） |
| `newChat.changeExecutor` | 切换新对话的执行者，当前为 {{executor}} | renderer.js 内 `changeExecutor:"…"`（newChatResources 的 zh 段） |
| `newChat.issueChatSessionReferencesUnsupported` | Issue 评论暂不支持引用其他任务，请先移除任务引用。 | renderer.js 内 `issueChatSessionReferencesUnsupported:"…"`（newChatResources 的 zh 段） |
| `newChat.issueTurnCreateError` | 绑定 Issue 后未能创建 Agent Turn。 | renderer.js 内 `issueTurnCreateError:"…"`（newChatResources 的 zh 段） |
| `newChat.connectors` | 连接器 | renderer.js 内 `connectors:"…"`（newChatResources 的 zh 段） |
| `newChat.quickAgents` | 快速调用 | renderer.js 内 `quickAgents:"…"`（newChatResources 的 zh 段） |
| `newChat.agentLockedByIssue` | 此 Issue 已指定执行 Agent | renderer.js 内 `agentLockedByIssue:"…"`（newChatResources 的 zh 段） |
| `newChat.issueNeedsAgentSelection` | 选择执行 Agent 后，此 Issue 会带着明确上下文开始工作。 | renderer.js 内 `issueNeedsAgentSelection:"…"`（newChatResources 的 zh 段） |
| `newChat.terminalPanel` | 终端面板 | renderer.js 内 `terminalPanel:"…"`（newChatResources 的 zh 段） |
| `newChat.searchLocalBranches` | 搜索本地分支 | renderer.js 内 `searchLocalBranches:"…"`（newChatResources 的 zh 段） |
| `newChat.searchBranches` | 搜索分支 | renderer.js 内 `searchBranches:"…"`（newChatResources 的 zh 段） |
| `newChat.localBranches` | 本地分支 | renderer.js 内 `localBranches:"…"`（newChatResources 的 zh 段） |
| `newChat.remoteBranches` | 远端分支 | renderer.js 内 `remoteBranches:"…"`（newChatResources 的 zh 段） |
| `newChat.noMatchingBranches` | 没有匹配的本地或远端分支 | renderer.js 内 `noMatchingBranches:"…"`（newChatResources 的 zh 段） |
| `newChat.noBranches` | 没有可用的本地分支 | renderer.js 内 `noBranches:"…"`（newChatResources 的 zh 段） |
| `newChat.repositoryBranchPickerLabel` | 选择仓库与分支 | renderer.js 内 `repositoryBranchPickerLabel:"…"`（newChatResources 的 zh 段） |
| `newChat.noRepository` | 未选择仓库 | renderer.js 内 `noRepository:"…"`（newChatResources 的 zh 段） |
| `newChat.primaryRepository` | 主要 | renderer.js 内 `primaryRepository:"…"`（newChatResources 的 zh 段） |
| `newChat.noLocalBranches` | 暂无分支 | renderer.js 内 `noLocalBranches:"…"`（newChatResources 的 zh 段） |
| `newChat.nonGitRepositoryBranches` | 该仓库不是 Git 仓库，无分支数据 | renderer.js 内 `nonGitRepositoryBranches:"…"`（newChatResources 的 zh 段） |
| `newChat.searchingBranches` | 正在搜索分支… | renderer.js 内 `searchingBranches:"…"`（newChatResources 的 zh 段） |
| `newChat.branchListFailed` | 无法读取分支列表。 | renderer.js 内 `branchListFailed:"…"`（newChatResources 的 zh 段） |
| `newChat.noGitBranch` | 无 Git 分支 | renderer.js 内 `noGitBranch:"…"`（newChatResources 的 zh 段） |
| `newChat.noGitRepository` | 所选目录不是 Git 仓库。 | renderer.js 内 `noGitRepository:"…"`（newChatResources 的 zh 段） |
| `newChat.branchReadOnly` | 当前执行位置不支持检出分支。 | renderer.js 内 `branchReadOnly:"…"`（newChatResources 的 zh 段） |
| `newChat.currentBranch` | 当前分支：{{branch}} | renderer.js 内 `currentBranch:"…"`（newChatResources 的 zh 段） |
| `newChat.selectBranch` | 检出分支，当前为 {{branch}} | renderer.js 内 `selectBranch:"…"`（newChatResources 的 zh 段） |
| `newChat.newBranch` | 新建分支 | renderer.js 内 `newBranch:"…"`（newChatResources 的 zh 段） |
| `newChat.createBranch` | 创建并检出 | renderer.js 内 `createBranch:"…"`（newChatResources 的 zh 段） |
| `newChat.creatingBranch` | 正在创建… | renderer.js 内 `creatingBranch:"…"`（newChatResources 的 zh 段） |
| `newChat.branchSwitched` | 已检出 {{branch}} | renderer.js 内 `branchSwitched:"…"`（newChatResources 的 zh 段） |
| `newChat.remoteBranchCheckedOut` | 已检出 {{branch}}，并跟踪 {{remote}} | renderer.js 内 `remoteBranchCheckedOut:"…"`（newChatResources 的 zh 段） |
| `newChat.branchSwitchFailed` | 无法检出分支 | renderer.js 内 `branchSwitchFailed:"…"`（newChatResources 的 zh 段） |
| `newChat.branchCreated` | 已创建并检出 {{branch}} | renderer.js 内 `branchCreated:"…"`（newChatResources 的 zh 段） |
| `newChat.branchCreateFailed` | 无法创建分支 | renderer.js 内 `branchCreateFailed:"…"`（newChatResources 的 zh 段） |

### `settings.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `settings.byok.title` | 模型 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.byok.description` | 使用自有 API Key 管理自定义模型。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.byok.viewDocumentation` | 查看文档 | renderer.js 内 `viewDocumentation:"…"`（settingsResources 的 zh 段） |
| `settings.byok.personalModels` | 个人模型 | renderer.js 内 `personalModels:"…"`（settingsResources 的 zh 段） |
| `settings.byok.addModel` | 添加模型 | renderer.js 内 `addModel:"…"`（settingsResources 的 zh 段） |
| `settings.byok.loading` | 正在准备个人模型… | renderer.js 内 `loading:"…"`（settingsResources 的 zh 段） |
| `settings.byok.unavailableTitle` | 暂时无法管理个人模型 | renderer.js 内 `unavailableTitle:"…"`（settingsResources 的 zh 段） |
| `settings.byok.profileLoadError` | 已保存的个人模型暂时无法读取。重新启动 Qoder 后重试。 | renderer.js 内 `profileLoadError:"…"`（settingsResources 的 zh 段） |
| `settings.byok.migrationFailed` | 旧版个人模型尚未迁移完成。原配置和密钥仍保留在本机；请重试，迁移成功前不能添加新模型。 | renderer.js 内 `migrationFailed:"…"`（settingsResources 的 zh 段） |
| `settings.byok.emptyTitle` | 暂无自定义模型，点击添加模型开始使用 | renderer.js 内 `emptyTitle:"…"`（settingsResources 的 zh 段） |
| `settings.byok.emptyDescription` | 添加模型后，它会出现在任务、Agent 和自动化的模型选择器中。 | renderer.js 内 `emptyDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.noSupportedProviders` | 暂无可用供应商或模型，可尝试重新加载。 | renderer.js 内 `noSupportedProviders:"…"`（settingsResources 的 zh 段） |
| `settings.byok.profileDescription` | {{provider}} · {{type}}{{status}} | renderer.js 内 `profileDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.customProfileDescription` | {{provider}}{{status}} | renderer.js 内 `customProfileDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.profileStatus.provider-unavailable` | Provider 已不可用 | renderer.js 内 `provider-unavailable:"…"`（settingsResources 的 zh 段） |
| `settings.byok.profileStatus.credential-unavailable` | API Key 无法读取 | renderer.js 内 `credential-unavailable:"…"`（settingsResources 的 zh 段） |
| `settings.byok.status.loading` | 正在准备可添加的 Provider 和模型；个人模型列表可以继续使用。 | renderer.js 内 `loading:"…"`（settingsResources 的 zh 段） |
| `settings.byok.status.ready` | 个人模型可用。 | renderer.js 内 `ready:"…"`（settingsResources 的 zh 段） |
| `settings.byok.status.signed-out` | 登录 Qoder 后才能查看和管理这个账号的个人模型。 | renderer.js 内 `signed-out:"…"`（settingsResources 的 zh 段） |
| `settings.byok.status.unsupported` | 当前内置 Qoder Runtime 暂不支持个人模型。请升级 Qoder 后重试。 | renderer.js 内 `unsupported:"…"`（settingsResources 的 zh 段） |
| `settings.byok.status.secure-storage-unavailable` | 当前系统无法安全保存 API Key。恢复系统安全存储后再添加模型。 | renderer.js 内 `secure-storage-unavailable:"…"`（settingsResources 的 zh 段） |
| `settings.byok.status.error` | 可添加的 Provider 和模型暂时无法读取。检查网络或重新启动 Qoder 后重试；已有配置不会被覆盖。 | renderer.js 内 `error:"…"`（settingsResources 的 zh 段） |
| `settings.byok.rotateCredential` | 更新 API Key | renderer.js 内 `rotateCredential:"…"`（settingsResources 的 zh 段） |
| `settings.byok.editModel` | 编辑 | renderer.js 内 `editModel:"…"`（settingsResources 的 zh 段） |
| `settings.byok.modelVisibility` | 在模型选择器中显示 {{model}} | renderer.js 内 `modelVisibility:"…"`（settingsResources 的 zh 段） |
| `settings.byok.visibilitySaveFailed` | 未能更新 {{model}} 的显示状态，请重试。 | renderer.js 内 `visibilitySaveFailed:"…"`（settingsResources 的 zh 段） |
| `settings.byok.moreActions` | {{model}}的更多操作 | renderer.js 内 `moreActions:"…"`（settingsResources 的 zh 段） |
| `settings.byok.deleteModel` | 删除 | renderer.js 内 `deleteModel:"…"`（settingsResources 的 zh 段） |
| `settings.byok.addTitle` | 添加模型 | renderer.js 内 `addTitle:"…"`（settingsResources 的 zh 段） |
| `settings.byok.addDescription` | 选择 Qoder CLI 支持的 Provider 和模型；内置 Provider 还需选择类型。调用费用由相应 Provider 结算。 | renderer.js 内 `addDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.rotateTitle` | 更新 API Key | renderer.js 内 `rotateTitle:"…"`（settingsResources 的 zh 段） |
| `settings.byok.rotateDescription` | 为“{{model}}”输入新的 API Key。旧密钥不会显示，校验失败时仍会保留。 | renderer.js 内 `rotateDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.provider` | 供应商 | renderer.js 内 `provider:"…"`（settingsResources 的 zh 段） |
| `settings.byok.selectProvider` | 选择 Provider | renderer.js 内 `selectProvider:"…"`（settingsResources 的 zh 段） |
| `settings.byok.noProviders` | 暂无可用供应商 | renderer.js 内 `noProviders:"…"`（settingsResources 的 zh 段） |
| `settings.byok.providersLoading` | 正在加载供应商… | renderer.js 内 `providersLoading:"…"`（settingsResources 的 zh 段） |
| `settings.byok.reloadProviders` | 重新加载 | renderer.js 内 `reloadProviders:"…"`（settingsResources 的 zh 段） |
| `settings.byok.builtinProviders` | 内置提供商 | renderer.js 内 `builtinProviders:"…"`（settingsResources 的 zh 段） |
| `settings.byok.enterpriseProviders` | 企业提供商 | renderer.js 内 `enterpriseProviders:"…"`（settingsResources 的 zh 段） |
| `settings.byok.providerModelCount_one` | {{count}} 个模型 | renderer.js 内 `providerModelCount_one:"…"`（settingsResources 的 zh 段） |
| `settings.byok.providerModelCount_other` | {{count}} 个模型 | renderer.js 内 `providerModelCount_other:"…"`（settingsResources 的 zh 段） |
| `settings.byok.type` | 类型 | renderer.js 内 `type:"…"`（settingsResources 的 zh 段） |
| `settings.byok.selectType` | 选择类型 | renderer.js 内 `selectType:"…"`（settingsResources 的 zh 段） |
| `settings.byok.model` | 模型 | renderer.js 内 `model:"…"`（settingsResources 的 zh 段） |
| `settings.byok.selectModel` | 选择模型 | renderer.js 内 `selectModel:"…"`（settingsResources 的 zh 段） |
| `settings.byok.selectModels` | 选择模型 | renderer.js 内 `selectModels:"…"`（settingsResources 的 zh 段） |
| `settings.byok.searchModels` | 搜索模型 | renderer.js 内 `searchModels:"…"`（settingsResources 的 zh 段） |
| `settings.byok.noModels` | 没有可选择的模型。 | renderer.js 内 `noModels:"…"`（settingsResources 的 zh 段） |
| `settings.byok.removeSelectedModel` | 移除模型 {{model}} | renderer.js 内 `removeSelectedModel:"…"`（settingsResources 的 zh 段） |
| `settings.byok.apiKey` | API Key | renderer.js 内 `apiKey:"…"`（settingsResources 的 zh 段） |
| `settings.byok.apiKeyPlaceholder` | 输入 API Key | renderer.js 内 `apiKeyPlaceholder:"…"`（settingsResources 的 zh 段） |
| `settings.byok.showApiKey` | 显示 API Key | renderer.js 内 `showApiKey:"…"`（settingsResources 的 zh 段） |
| `settings.byok.hideApiKey` | 隐藏 API Key | renderer.js 内 `hideApiKey:"…"`（settingsResources 的 zh 段） |
| `settings.byok.getApiKey` | 获取 API Key | renderer.js 内 `getApiKey:"…"`（settingsResources 的 zh 段） |
| `settings.byok.validationFailed` | API Key 未通过校验。检查密钥、Provider 账号和网络后重试；输入内容已保留。 | renderer.js 内 `validationFailed:"…"`（settingsResources 的 zh 段） |
| `settings.byok.saveFailed` | 个人模型没有保存。请稍后重试；输入内容已保留。 | renderer.js 内 `saveFailed:"…"`（settingsResources 的 zh 段） |
| `settings.byok.partialSave` | 部分模型已由 CLI 保存，但回滚未全部完成。列表已按 CLI 当前配置刷新，请核对后重试。 | renderer.js 内 `partialSave:"…"`（settingsResources 的 zh 段） |
| `settings.byok.duplicateModel` | 这个个人模型已经存在。请关闭窗口后使用“更新 API Key”。 | renderer.js 内 `duplicateModel:"…"`（settingsResources 的 zh 段） |
| `settings.byok.validating` | 正在校验… | renderer.js 内 `validating:"…"`（settingsResources 的 zh 段） |
| `settings.byok.addAction` | 添加模型 | renderer.js 内 `addAction:"…"`（settingsResources 的 zh 段） |
| `settings.byok.rotateAction` | 更新 API Key | renderer.js 内 `rotateAction:"…"`（settingsResources 的 zh 段） |
| `settings.byok.closeDialog` | 关闭模型窗口 | renderer.js 内 `closeDialog:"…"`（settingsResources 的 zh 段） |
| `settings.byok.deleteTitle` | 删除“{{model}}”？ | renderer.js 内 `deleteTitle:"…"`（settingsResources 的 zh 段） |
| `settings.byok.deleteDescription` | 该模型将从所有模型选择器中移除。正在使用它的任务、Agent 和自动化任务等需重新指定模型后才能运行。 | renderer.js 内 `deleteDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.deleteAction` | 删除模型 | renderer.js 内 `deleteAction:"…"`（settingsResources 的 zh 段） |
| `settings.byok.deleting` | 正在删除… | renderer.js 内 `deleting:"…"`（settingsResources 的 zh 段） |
| `settings.byok.deleteFailed` | 个人模型还没有删除。请重试；列表会保持 CLI 当前配置。 | renderer.js 内 `deleteFailed:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.addTitle` | 添加模型 | renderer.js 内 `addTitle:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.editTitle` | 编辑模型 | renderer.js 内 `editTitle:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.configureTitle` | 配置模型能力 | renderer.js 内 `configureTitle:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.provider` | 供应商 | renderer.js 内 `provider:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.selectProvider` | 选择 Provider | renderer.js 内 `selectProvider:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.recommendedProviders` | 推荐 | renderer.js 内 `recommendedProviders:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.otherProviders` | 更多 | renderer.js 内 `otherProviders:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.customProviders` | 自定义 | renderer.js 内 `customProviders:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.openaiCompatible` | OpenAI Compatible | renderer.js 内 `openaiCompatible:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.anthropicCompatible` | Anthropic Compatible | renderer.js 内 `anthropicCompatible:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.type` | 类型 | renderer.js 内 `type:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.purchaseTokenPlan` | 购买 Token Plan | renderer.js 内 `purchaseTokenPlan:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.models` | 模型 | renderer.js 内 `models:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.selectModels` | 选择模型 | renderer.js 内 `selectModels:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.selectedModels` | 已选择 {{count}} 个模型 | renderer.js 内 `selectedModels:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.selectAllModels` | 全选 | renderer.js 内 `selectAllModels:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.noModels` | 没有可选择的模型。 | renderer.js 内 `noModels:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.selectAtLeastOneModel` | 至少选择一个模型。 | renderer.js 内 `selectAtLeastOneModel:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.modelNameSeparator` | 、 | renderer.js 内 `modelNameSeparator:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.modelsAlreadyAdded` | 以下模型已添加：{{models}}。取消选择后再继续。 | renderer.js 内 `modelsAlreadyAdded:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.apiUrl` | 接口地址（Base URL） | renderer.js 内 `apiUrl:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.apiType` | API 类型 | renderer.js 内 `apiType:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.protocol` | 协议 | renderer.js 内 `protocol:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.httpWarning` | 可使用 HTTP 地址，但数据以明文传输，存在 API Key 和对话内容泄露风险。建议使用 HTTPS 以保障数据安全。 | renderer.js 内 `httpWarning:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.chatCompletionsApi` | Chat Completions API | renderer.js 内 `chatCompletionsApi:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.responsesApi` | Responses API | renderer.js 内 `responsesApi:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.endpointError.required` | 输入 API URL。 | renderer.js 内 `required:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.endpointError.invalid` | 输入完整的 HTTP 或 HTTPS 地址。 | renderer.js 内 `invalid:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.endpointError.credentials` | API URL 不能包含用户名或密码，请移除后重试。 | renderer.js 内 `credentials:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.endpointError.query` | API URL 不能包含查询参数，请移除问号及其后内容。 | renderer.js 内 `query:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.endpointError.fragment` | API URL 不能包含片段标识，请移除 # 及其后内容。 | renderer.js 内 `fragment:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.modelIds` | Model ID | renderer.js 内 `modelIds:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.addModelId` | 添加 Model ID | renderer.js 内 `addModelId:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.removeModelId` | 移除 Model ID | renderer.js 内 `removeModelId:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.modelIdPlaceholder` | 例如 qwen3.8-max | renderer.js 内 `modelIdPlaceholder:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.modelIdRequired` | Model ID 不能为空。 | renderer.js 内 `modelIdRequired:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.duplicateModelId` | Model ID 重复，请使用不同的 ID。 | renderer.js 内 `duplicateModelId:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.customModelsAlreadyAdded` | 相同的 API 类型和接口地址下，以下 Model ID 已存在：{{models}}。修改 Model ID、API 类型或接口地址后再继续。 | renderer.js 内 `customModelsAlreadyAdded:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.apiKey` | API Key | renderer.js 内 `apiKey:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.getApiKey` | 获取 API Key | renderer.js 内 `getApiKey:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.apiKeyPlaceholder` | 请输入 API Key | renderer.js 内 `apiKeyPlaceholder:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.credentialOnlyDescription` | 仅更新此模型的 API Key，供应商和模型配置保持不变。 | renderer.js 内 `credentialOnlyDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.keepExistingKey` | 留空以沿用当前 API Key | renderer.js 内 `keepExistingKey:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.optionalApiKeyPlaceholder` | 请输入 API Key | renderer.js 内 `optionalApiKeyPlaceholder:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.optionalKeyForConnectionChange` | 连接信息不变时，留空会沿用当前 API Key；修改 API URL 或协议后，留空将使用空 API Key 校验并保存。 | renderer.js 内 `optionalKeyForConnectionChange:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.displayName` | 显示名称 | renderer.js 内 `displayName:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.displayNameRequired` | 请输入显示名称。 | renderer.js 内 `displayNameRequired:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.modelId` | Model ID | renderer.js 内 `modelId:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.supportedContextWindows` | 支持的上下文窗口 | renderer.js 内 `supportedContextWindows:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.selectContextWindows` | 选择上下文窗口 | renderer.js 内 `selectContextWindows:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.selectedContextWindows` | 已选择 {{count}} 个 | renderer.js 内 `selectedContextWindows:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.selectAllContextWindows` | 全选上下文窗口 | renderer.js 内 `selectAllContextWindows:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.noContextWindows` | 没有可选择的上下文窗口。 | renderer.js 内 `noContextWindows:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.contextWindowRequired` | 至少选择一个上下文窗口。 | renderer.js 内 `contextWindowRequired:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.contextWindow` | 上下文窗口 | renderer.js 内 `contextWindow:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.contextWindowDescription` | 该模型使用一个上下文窗口值，并随配置保存到 CLI。 | renderer.js 内 `contextWindowDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.contextWindowValueRequired` | 请输入大于 0 的整数上下文窗口。 | renderer.js 内 `contextWindowValueRequired:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.defaultContextWindow` | 默认上下文窗口 | renderer.js 内 `defaultContextWindow:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.maxOutputTokens` | 最大输出 Token | renderer.js 内 `maxOutputTokens:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.maxOutputTokensDescription` | 该值随自定义模型配置保存到 CLI。 | renderer.js 内 `maxOutputTokensDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.maxOutputTokensRequired` | 请输入大于 0 的最大输出 Token。 | renderer.js 内 `maxOutputTokensRequired:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.capabilities` | 能力 | renderer.js 内 `capabilities:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.capabilitiesManagedByCli` | Vision、Think 和 reasoning effort 由 CLI 校验后返回，此处不支持手动覆盖。 | renderer.js 内 `capabilitiesManagedByCli:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.reportedCapabilities` | CLI 返回：{{capabilities}} | renderer.js 内 `reportedCapabilities:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.noReportedCapabilities` | CLI 尚未返回 Vision 或 Think 能力。 | renderer.js 内 `noReportedCapabilities:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.reportedReasoningEfforts` | Reasoning efforts：{{efforts}} | renderer.js 内 `reportedReasoningEfforts:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.vision` | 视觉 | renderer.js 内 `vision:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.thinking` | 思考模式 | renderer.js 内 `thinking:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.reasoningEffort` | 思考强度 | renderer.js 内 `reasoningEffort:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.thinkingEffort` | 思考强度 | renderer.js 内 `thinkingEffort:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.selectReasoningEfforts` | 选择 effort | renderer.js 内 `selectReasoningEfforts:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.selectedReasoningEfforts` | 已选择 {{count}} 个 | renderer.js 内 `selectedReasoningEfforts:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.selectAllReasoningEfforts` | 全选 effort | renderer.js 内 `selectAllReasoningEfforts:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.noReasoningEfforts` | 没有可选择的 effort。 | renderer.js 内 `noReasoningEfforts:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.reasoningEffortRequired` | Think 模型至少选择一个 effort。 | renderer.js 内 `reasoningEffortRequired:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.stableIdentityNotice` | Provider、类型和模型在添加后不可更改；如需切换，请添加新模型。 | renderer.js 内 `stableIdentityNotice:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.expandCapabilities` | 展开 {{model}} 的能力配置 | renderer.js 内 `expandCapabilities:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.collapseCapabilities` | 收起 {{model}} 的能力配置 | renderer.js 内 `collapseCapabilities:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.back` | 返回 | renderer.js 内 `back:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.backToEdit` | 返回编辑 | renderer.js 内 `backToEdit:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.validateAndAdd` | 校验并添加模型 | renderer.js 内 `validateAndAdd:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.validateAndSave` | 校验并保存 | renderer.js 内 `validateAndSave:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.validating` | 正在校验模型 | renderer.js 内 `validating:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.validatingTitle` | 正在校验模型 | renderer.js 内 `validatingTitle:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.validatingDescription` | 正在检查模型配置。检查期间会保留你输入的内容。 | renderer.js 内 `validatingDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.validatingModel` | 正在校验 {{model}} | renderer.js 内 `validatingModel:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.validatingModelDescription` | 正在检查 Model ID 与模型能力配置。 | renderer.js 内 `validatingModelDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.validationFailedTitle` | 模型校验失败 | renderer.js 内 `validationFailedTitle:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.validationFailedDescription` | 模型校验失败。你输入的内容已保留。 | renderer.js 内 `validationFailedDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.configurationValidationFailedDescription` | Provider 配置校验失败。你输入的内容已保留。 | renderer.js 内 `configurationValidationFailedDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.validationUnavailableTitle` | 暂时无法校验 | renderer.js 内 `validationUnavailableTitle:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.validationUnavailableDescription` | 模型校验暂时不可用。你输入的内容已保留。 | renderer.js 内 `validationUnavailableDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.apiKeyRequiredDescription` | 连接信息已变化，请重新输入 API Key 后再校验。你输入的其他内容已保留。 | renderer.js 内 `apiKeyRequiredDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.partialSaveDescription` | 部分模型已由 CLI 保存，但回滚未全部完成。返回列表核对当前配置后再重试。 | renderer.js 内 `partialSaveDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.validationUnavailableModelDescription` | 配置校验服务暂时不可用，请稍后重试。 | renderer.js 内 `validationUnavailableModelDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.revalidate` | 重新校验 | renderer.js 内 `revalidate:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.retryValidation` | 重试校验 | renderer.js 内 `retryValidation:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.removeFailedModel` | 移除 {{model}} | renderer.js 内 `removeFailedModel:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.status.validating` | 校验中 | renderer.js 内 `validating:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.status.unavailable` | 不可用 | renderer.js 内 `unavailable:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.status.pending` | 待重新校验 | renderer.js 内 `pending:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.status.validated` | 校验通过 | renderer.js 内 `validated:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.status.added` | 已添加 | renderer.js 内 `added:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.status.failed` | 校验失败 | renderer.js 内 `failed:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.validationErrorMissing` | 校验失败，未返回错误详情。 | renderer.js 内 `validationErrorMissing:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.validatedModelDescription` | 校验已通过，修正其他模型后一起保存。 | renderer.js 内 `validatedModelDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.pendingModelDescription` | 修正错误后重新校验此模型。 | renderer.js 内 `pendingModelDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.successTitle` | 模型已保存 | renderer.js 内 `successTitle:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.successDescription` | 模型配置检查通过。已将 {{count}} 个模型添加到个人模型。 | renderer.js 内 `successDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.successModelDescription` | 模型配置已保存。 | renderer.js 内 `successModelDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.modelAdded` | {{model}} 已添加 | renderer.js 内 `modelAdded:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.discardTitle` | 放弃未保存的模型配置？ | renderer.js 内 `discardTitle:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.discardDescription` | 关闭后，本次输入的 Endpoint、模型能力和 API Key 都会被清空。 | renderer.js 内 `discardDescription:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.keepEditing` | 继续编辑 | renderer.js 内 `keepEditing:"…"`（settingsResources 的 zh 段） |
| `settings.byok.flow.discardAction` | 放弃更改 | renderer.js 内 `discardAction:"…"`（settingsResources 的 zh 段） |

## 16 记忆·规则·知识可见性

_条目数：158_

### `chatSession.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `chatSession.skillEvolution.processing` | 处理中… | renderer.js 内 `processing:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.errors.not_pending` | 这条建议已处理，请查看最新建议。 | renderer.js 内 `not_pending:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.errors.expired` | 建议已过期，请等待新的推荐。 | renderer.js 内 `expired:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.errors.hash_invalidated` | Skill 文件已变化或无法读取，已停止采纳。请使用新的建议。 | renderer.js 内 `hash_invalidated:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.errors.unavailable` | 暂时无法处理建议，请检查来源会话和连接后重试。 | renderer.js 内 `unavailable:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.errors.start_failed` | 新会话未能启动，可以重试。 | renderer.js 内 `start_failed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.errors.disabled` | Skill 自进化已关闭，请先开启。 | renderer.js 内 `disabled:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.errors.save_failed` | 设置未能保存，已保留原设置。请重试。 | renderer.js 内 `save_failed:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.suggestionCount` | {{count}}条建议 | renderer.js 内 `suggestionCount:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.openSuggestions` | 查看 {{count}} 条技能自进化建议 | renderer.js 内 `openSuggestions:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.title` | 自进化建议 | renderer.js 内 `title:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.create` | 创建 | renderer.js 内 `create:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.update` | 更新 | renderer.js 内 `update:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.ignore` | 忽略 | renderer.js 内 `ignore:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.createSuggestion` | 创建技能 {{name}} | renderer.js 内 `createSuggestion:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.updateSuggestion` | 更新技能 {{name}} | renderer.js 内 `updateSuggestion:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.ignoreSuggestion` | 忽略技能 {{name}} | renderer.js 内 `ignoreSuggestion:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.productDesignDescription` | 把界面层级、设计系统复用和视觉验收规则沉淀为可复用的产品设计 Skill。 | renderer.js 内 `productDesignDescription:"…"`（chatSessionResources 的 zh 段） |
| `chatSession.skillEvolution.bugfixConfirmationDescription` | 把问题复现、修复范围、验证结果和未覆盖风险整理为统一的确认 Brief。 | renderer.js 内 `bugfixConfirmationDescription:"…"`（chatSessionResources 的 zh 段） |

### `extensions.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `extensions.mcp.failureDescriptions.enterprisePolicyDenied` | 此 MCP Server 已被企业策略禁用。请联系管理员。 | renderer.js 内 `enterprisePolicyDenied:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.executableNotFound` | 找不到 MCP 命令。请检查命令名称，以及应用启动环境中的 PATH。 | renderer.js 内 `executableNotFound:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.npxExecutableNotFound` | 未找到命令 npx，请安装 Node.js 后重启 Qoder。 | renderer.js 内 `npxExecutableNotFound:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.spawnDenied` | MCP 命令没有执行权限。请检查文件权限或系统安全策略。 | renderer.js 内 `spawnDenied:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.processExitedBeforeReady` | MCP 进程在连接建立前退出。请检查命令、参数顺序和运行环境。 | renderer.js 内 `processExitedBeforeReady:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.processExitedWhileRunning` | MCP 进程在运行期间退出。请检查该进程的运行环境和自身日志。 | renderer.js 内 `processExitedWhileRunning:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.initializationTimeout` | MCP 进程启动后未能及时完成连接。请检查命令是否会等待交互输入。 | renderer.js 内 `initializationTimeout:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.outputLimitExceeded` | MCP 进程输出超过安全上限，连接已停止。请检查进程是否持续输出非协议内容。 | renderer.js 内 `outputLimitExceeded:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.connectionFailed` | 无法连接 MCP 服务。请检查服务是否已启动，以及网络地址是否可访问。 | renderer.js 内 `connectionFailed:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.requestTimeout` | MCP 服务未在规定时间内响应。请检查服务状态或网络连接。 | renderer.js 内 `requestTimeout:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.authorizationFailed` | MCP 授权缺失或已失效。请重新授权后再试。 | renderer.js 内 `authorizationFailed:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.authorizationMissing` | 此 Connector 尚未完成授权。授权后将自动连接。 | renderer.js 内 `authorizationMissing:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.authorizationInvalid` | 此 Connector 的已有授权已失效，可能已过期、被撤销或账号权限发生变化。重新授权后将自动连接。 | renderer.js 内 `authorizationInvalid:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.authorizationRejected` | 上游服务未接受当前授权。重新授权后将自动连接。 | renderer.js 内 `authorizationRejected:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.authorizationRequired` | 上游服务要求授权，但没有提供更具体的安全原因。授权后将自动连接。 | renderer.js 内 `authorizationRequired:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.accessDenied` | MCP 服务拒绝了当前访问。请检查账号权限或服务端访问策略。 | renderer.js 内 `accessDenied:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.rateLimited` | MCP 服务请求过于频繁。请稍后再试。 | renderer.js 内 `rateLimited:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.serverError` | MCP 服务端发生错误。请稍后重试或检查服务端状态。 | renderer.js 内 `serverError:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.protocolVersionUnsupported` | MCP 服务使用了当前不支持的协议版本。请升级服务或更换兼容版本。 | renderer.js 内 `protocolVersionUnsupported:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.protocolInvalid` | MCP 服务返回了无效的协议响应。请检查服务是否以 MCP 模式运行。 | renderer.js 内 `protocolInvalid:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.connectionClosed` | MCP 连接已意外断开。请检查服务进程或网络连接。 | renderer.js 内 `connectionClosed:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.credentialStorageFailed` | 无法读取本机保存的 MCP 凭据。请重新授权；若仍失败，请检查本机凭据存储。 | renderer.js 内 `credentialStorageFailed:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.pluginConfigurationInvalid` | 提供该 MCP 的插件配置无效。请检查或重新安装插件。 | renderer.js 内 `pluginConfigurationInvalid:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.pluginUnavailable` | 提供该 MCP 的插件当前不可用。请重新启用或重新安装插件。 | renderer.js 内 `pluginUnavailable:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.pluginToolInvalid` | 插件提供的 MCP 工具定义无效。请更新插件后再试。 | renderer.js 内 `pluginToolInvalid:"…"`（extensionsResources 的 zh 段） |
| `extensions.mcp.failureDescriptions.unknown` | MCP 连接失败，但当前没有更具体的安全诊断。请重试并查看应用日志。 | renderer.js 内 `unknown:"…"`（extensionsResources 的 zh 段） |

### `settings.*`

| 元素/状态（键） | 原文文案 | 出处 |
| --- | --- | --- |
| `settings.taskMonitor.title` | 任务监控 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.description` | 选择任务监控的展示方式，以及需要启用的内容。修改会立即应用到所有任务。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.displaySection` | 展示方式 | renderer.js 内 `displaySection:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.progressSection` | 进度与上下文 | renderer.js 内 `progressSection:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.activitySection` | 执行活动 | renderer.js 内 `activitySection:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.resultsSection` | 结果与来源 | renderer.js 内 `resultsSection:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.utilitiesSection` | 辅助入口 | renderer.js 内 `utilitiesSection:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.recap.title` | 任务回顾 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.recap.description` | 显示当前任务的摘要和最后更新时间。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.goal.title` | 任务目标 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.goal.description` | 显示当前任务正在追踪的目标。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.spec.title` | 计划 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.spec.description` | 显示当前任务的计划入口。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.backgroundAgents.title` | 子智能体 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.backgroundAgents.description` | 显示后台子智能体的运行状态和入口。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.backgroundProcesses.title` | 后台进程 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.backgroundProcesses.description` | 显示后台命令和长时间运行进程。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.sideChats.title` | 侧边聊天 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.sideChats.description` | 显示从当前任务分出的侧边聊天。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.runtime.title` | Skill 与 MCP | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.runtime.description` | 显示任务使用的 Skill、MCP 和其他运行时能力。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.artifact.title` | 产出 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.artifact.description` | 显示任务产生的文件和其他结果。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.browser.title` | 网页查阅 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.browser.description` | 显示任务过程中打开的网页。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.source.title` | 来源 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.source.description` | 显示任务引用的文件和链接，以及添加来源的入口。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.quickNotes.title` | Quick Notes | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.quickNotes.description` | 显示 Quick Notes 入口；仅在试验功能已启用时生效。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.memory.title` | 记忆更新 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.memory.description` | 记忆发生更新时，显示前往记忆设置的入口。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.presentation.title` | 演示画面 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.taskMonitor.items.presentation.description` | 在固定模式中显示演示画面的显隐控制。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.memory.title` | 记忆 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.memory.description` | 查看和管理 Qoder 在本机保存的长期记忆。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.memory.refresh` | 刷新 | renderer.js 内 `refresh:"…"`（settingsResources 的 zh 段） |
| `settings.memory.retry` | 重试 | renderer.js 内 `retry:"…"`（settingsResources 的 zh 段） |
| `settings.memory.storageSection` | 记忆存储 | renderer.js 内 `storageSection:"…"`（settingsResources 的 zh 段） |
| `settings.memory.behaviorSection` | 记忆行为 | renderer.js 内 `behaviorSection:"…"`（settingsResources 的 zh 段） |
| `settings.memory.globalSection` | 全局记忆 | renderer.js 内 `globalSection:"…"`（settingsResources 的 zh 段） |
| `settings.memory.projectSection` | 项目记忆 | renderer.js 内 `projectSection:"…"`（settingsResources 的 zh 段） |
| `settings.memory.globalToggleTitle` | 全局记忆 | renderer.js 内 `globalToggleTitle:"…"`（settingsResources 的 zh 段） |
| `settings.memory.globalToggleDescription` | 开启后，Qoder 会在所有项目中读取和更新你的个人偏好、习惯和长期上下文；关闭后不会使用或更新全局记忆。 | renderer.js 内 `globalToggleDescription:"…"`（settingsResources 的 zh 段） |
| `settings.memory.projectToggleTitle` | 项目记忆 | renderer.js 内 `projectToggleTitle:"…"`（settingsResources 的 zh 段） |
| `settings.memory.projectToggleDescription` | 开启后，Qoder 会按项目读取和更新代码库规则、经验和长期上下文；关闭后不会使用或更新任何项目记忆。 | renderer.js 内 `projectToggleDescription:"…"`（settingsResources 的 zh 段） |
| `settings.memory.globalTitle` | 全局记忆 | renderer.js 内 `globalTitle:"…"`（settingsResources 的 zh 段） |
| `settings.memory.projectTitle` | 项目记忆 | renderer.js 内 `projectTitle:"…"`（settingsResources 的 zh 段） |
| `settings.memory.projectDescription` | 影响 Qoder 针对各个项目保留的代码库规则、经验和上下文。 | renderer.js 内 `projectDescription:"…"`（settingsResources 的 zh 段） |
| `settings.memory.projectEmpty` | 尚无项目记忆。 | renderer.js 内 `projectEmpty:"…"`（settingsResources 的 zh 段） |
| `settings.memory.projectEmptyDescription` | 打开项目并开始对话后，Qoder 会在这里列出对应的项目记忆目录。 | renderer.js 内 `projectEmptyDescription:"…"`（settingsResources 的 zh 段） |
| `settings.memory.sourceLoading` | 正在解析记忆路径… | renderer.js 内 `sourceLoading:"…"`（settingsResources 的 zh 段） |
| `settings.memory.summary` | {{files}} 个记忆文件 | renderer.js 内 `summary:"…"`（settingsResources 的 zh 段） |
| `settings.memory.updatedAt` | 更新于 {{time}} | renderer.js 内 `updatedAt:"…"`（settingsResources 的 zh 段） |
| `settings.memory.openFile` | 打开记忆目录 | renderer.js 内 `openFile:"…"`（settingsResources 的 zh 段） |
| `settings.memory.clear` | 清空记忆 | renderer.js 内 `clear:"…"`（settingsResources 的 zh 段） |
| `settings.memory.settingFailed` | 无法保存记忆设置，请稍后重试。 | renderer.js 内 `settingFailed:"…"`（settingsResources 的 zh 段） |
| `settings.memory.loadFailed` | 无法读取记忆 | renderer.js 内 `loadFailed:"…"`（settingsResources 的 zh 段） |
| `settings.memory.loadFailedDescription` | 请检查本机记忆目录权限，然后重试。 | renderer.js 内 `loadFailedDescription:"…"`（settingsResources 的 zh 段） |
| `settings.memory.openFailed` | 无法打开记忆文件，请检查路径是否存在且可访问。 | renderer.js 内 `openFailed:"…"`（settingsResources 的 zh 段） |
| `settings.memory.clearFailed` | 无法清空记忆，请检查目录权限后重试。 | renderer.js 内 `clearFailed:"…"`（settingsResources 的 zh 段） |
| `settings.memory.clearSucceeded` | 已清空{{name}} | renderer.js 内 `clearSucceeded:"…"`（settingsResources 的 zh 段） |
| `settings.memory.clearDialogTitle` | 清空{{name}}？ | renderer.js 内 `clearDialogTitle:"…"`（settingsResources 的 zh 段） |
| `settings.memory.clearDialogDescription` | 这会删除{{name}}中的 {{count}} 个记忆文件。后续 Agent 将不再使用这些长期上下文，此操作无法撤销。 | renderer.js 内 `clearDialogDescription:"…"`（settingsResources 的 zh 段） |
| `settings.memory.confirmClear` | 清空记忆 | renderer.js 内 `confirmClear:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.title` | 钩子 | renderer.js 内 `title:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.description` | 查看本机用户级 settings.json 中声明的 Hooks。这里只反映磁盘配置，不代表 CLI 已加载或执行。 | renderer.js 内 `description:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.refresh` | 刷新 | renderer.js 内 `refresh:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.sourceSection` | 配置来源 | renderer.js 内 `sourceSection:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.userSource` | 用户级 settings.json | renderer.js 内 `userSource:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.sourceLoading` | 正在解析配置路径… | renderer.js 内 `sourceLoading:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.count` | Hook · {{count}} | renderer.js 内 `count:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.safetyNotice` | Hooks 会在会话生命周期中自动执行，并可能访问本机文件或外部服务。请核对最近安装或修改的配置。 | renderer.js 内 `safetyNotice:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.configuredSection` | 已配置的 Hooks | renderer.js 内 `configuredSection:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.loading` | 正在读取 Hooks | renderer.js 内 `loading:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.loadingDescription` | 正在从本机用户级配置文件读取 Hooks。 | renderer.js 内 `loadingDescription:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.missing` | 尚未找到用户级 settings.json | renderer.js 内 `missing:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.missingDescription` | 在上方路径创建或更新配置文件后，返回 Qoder 或刷新此页面。 | renderer.js 内 `missingDescription:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.invalid` | 无法解析 Hooks 配置 | renderer.js 内 `invalid:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.invalidDescription` | 当前文件不是可识别的标准 JSON 或 Hooks 结构。修复文件后再刷新。 | renderer.js 内 `invalidDescription:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.unreadable` | 无法读取 Hooks 配置 | renderer.js 内 `unreadable:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.unreadableDescription` | 请检查上方文件路径和读取权限，然后重试。 | renderer.js 内 `unreadableDescription:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.empty` | 尚未配置用户级 Hooks | renderer.js 内 `empty:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.emptyDescription` | settings.json 可读取，但其中没有用户级 Hooks。 | renderer.js 内 `emptyDescription:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.hookTitle` | {{type}} Hook | renderer.js 内 `hookTitle:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.expandEvent` | 展开 {{event}} 下的 Hook | renderer.js 内 `expandEvent:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.collapseEvent` | 收起 {{event}} 下的 Hook | renderer.js 内 `collapseEvent:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.expandHook` | 展开第 {{number}} 个 {{title}} 的详情 | renderer.js 内 `expandHook:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.collapseHook` | 收起第 {{number}} 个 {{title}} 的详情 | renderer.js 内 `collapseHook:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.openConfigFile` | 打开第 {{number}} 个 {{title}} 的配置文件 | renderer.js 内 `openConfigFile:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.openConfigFailed` | 无法打开 Hook 配置文件，请检查文件是否存在且可访问。 | renderer.js 内 `openConfigFailed:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.typeLabel` | 处理程序 | renderer.js 内 `typeLabel:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.summaryLabel` | 目标摘要 | renderer.js 内 `summaryLabel:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.matcherLabel` | 匹配器 | renderer.js 内 `matcherLabel:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.conditionLabel` | 条件 | renderer.js 内 `conditionLabel:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.executionLabel` | 执行方式 | renderer.js 内 `executionLabel:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.notProvided` | 未提供 | renderer.js 内 `notProvided:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.allMatches` | 匹配该事件的全部调用 | renderer.js 内 `allMatches:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.noCondition` | 无条目条件 | renderer.js 内 `noCondition:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.synchronous` | 同步 | renderer.js 内 `synchronous:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.async` | 异步 | renderer.js 内 `async:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.diagnosticsTitle` | 部分配置需要检查 | renderer.js 内 `diagnosticsTitle:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.diagnosticsItemDescription` | 该条目无法识别；其他可读取的 Hooks 不受影响。 | renderer.js 内 `diagnosticsItemDescription:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.events.preToolUse` | 工具执行前 | renderer.js 内 `preToolUse:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.events.postToolUse` | 工具执行成功后 | renderer.js 内 `postToolUse:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.events.postToolUseFailure` | 工具执行失败后 | renderer.js 内 `postToolUseFailure:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.events.permissionRequest` | 请求权限时 | renderer.js 内 `permissionRequest:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.events.sessionStart` | 新任务开始时 | renderer.js 内 `sessionStart:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.events.sessionEnd` | 任务结束时 | renderer.js 内 `sessionEnd:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.events.userPromptSubmit` | 用户提交提示时 | renderer.js 内 `userPromptSubmit:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.events.stop` | Agent 结束本轮响应前 | renderer.js 内 `stop:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.events.subagentStop` | 子 Agent 结束响应前 | renderer.js 内 `subagentStop:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.events.notification` | 产生通知时 | renderer.js 内 `notification:"…"`（settingsResources 的 zh 段） |
| `settings.hooks.events.other` | 在该生命周期事件发生时 | renderer.js 内 `other:"…"`（settingsResources 的 zh 段） |

## 附录 A：仍在对话流命名空间内、但未落进 16 类的条目

_这些键属于对话流包（chatActivity/chatSession/composer/…），但按前缀规则没被 16 类接住；列出以保证「穷举」不自欺。_

### `attention.*`（137）

| 键 | 原文文案 | 出处 |
| --- | --- | --- |
| `attention.demo.resolved` | 已处理 | renderer.js 内 `resolved:"…"`（collaborationResources） |
| `attention.demo.allDone` | 全部处理完了，休息一下吧。 | renderer.js 内 `allDone:"…"`（collaborationResources） |
| `attention.demo.sendReply` | 发送回复 | renderer.js 内 `sendReply:"…"`（collaborationResources） |
| `attention.demo.reply.free` | 或者自由回复 | renderer.js 内 `free:"…"`（collaborationResources） |
| `attention.demo.reply.comment` | 留下评论 | renderer.js 内 `comment:"…"`（collaborationResources） |
| `attention.demo.reply.direct` | 直接回复 Wang | renderer.js 内 `direct:"…"`（collaborationResources） |
| `attention.demo.reply.directQa` | 直接回复 QA | renderer.js 内 `directQa:"…"`（collaborationResources） |
| `attention.demo.reply.orReply` | 或者回复 | renderer.js 内 `orReply:"…"`（collaborationResources） |
| `attention.demo.items.datatable.title` | DataTable 首版是否基于现有 Table 组件扩展？ | renderer.js 内 `title:"…"`（collaborationResources） |
| `attention.demo.items.datatable.meta` | Qoder · QODER-142 · 组件基础设施 | renderer.js 内 `meta:"…"`（collaborationResources） |
| `attention.demo.items.datatable.type` | Agent 请求决策 | renderer.js 内 `type:"…"`（collaborationResources） |
| `attention.demo.items.datatable.status` | Agent 等待中 | renderer.js 内 `status:"…"`（collaborationResources） |
| `attention.demo.items.datatable.detail[0]` | Agent 在实现 DataTable 时需要确认首版边界。 | renderer.js 内 `detail[0]:"…"`（collaborationResources） |
| `attention.demo.items.datatable.detail[1]` | 方案 A：基于现有 Table 与设计系统 Button、Tag、Tabs 组合扩展，先覆盖排序、空状态和批量选择。 | renderer.js 内 `detail[1]:"…"`（collaborationResources） |
| `attention.demo.items.datatable.detail[2]` | 方案 B：新建完整 DataGrid 抽象，同时处理列冻结、虚拟滚动和列配置。 | renderer.js 内 `detail[2]:"…"`（collaborationResources） |
| `attention.demo.items.datatable.detail[3]` | 建议选择方案 A。它能保留现有组件约束，避免在首版里引入新的表格基础设施。 | renderer.js 内 `detail[3]:"…"`（collaborationResources） |
| `attention.demo.items.datatable.replyPlaceholder` | 补充边界，例如“首版不做列冻结，但保留列配置入口”... | renderer.js 内 `replyPlaceholder:"…"`（collaborationResources） |
| `attention.demo.items.datatable.resolveNote` | 已确认基于现有 Table 扩展，Agent 将按首版边界继续。 | renderer.js 内 `resolveNote:"…"`（collaborationResources） |
| `attention.demo.items.datatable.actions.shadcn` | 基于现有 Table 扩展 | renderer.js 内 `shadcn:"…"`（collaborationResources） |
| `attention.demo.items.datatable.actions.custom` | 新建 DataGrid 抽象 | renderer.js 内 `custom:"…"`（collaborationResources） |
| `attention.demo.items.prReview.title` | Table 虚拟滚动改造已提交 Review | renderer.js 内 `title:"…"`（collaborationResources） |
| `attention.demo.items.prReview.meta` | Qoder · PR #138 · +86 / -34 行 | renderer.js 内 `meta:"…"`（collaborationResources） |
| `attention.demo.items.prReview.type` | PR 待审 | renderer.js 内 `type:"…"`（collaborationResources） |
| `attention.demo.items.prReview.status` | 待你 Review | renderer.js 内 `status:"…"`（collaborationResources） |
| `attention.demo.items.prReview.detail[0]` | Cloud Agent 完成了 QODER-131 的 Table 虚拟滚动改造，并生成 Review packet。 | renderer.js 内 `detail[0]:"…"`（collaborationResources） |
| `attention.demo.items.prReview.detail[1]` | 变更包含虚拟列表渲染、固定列宽、横向滚动同步，以及 12 个覆盖空数据、大数据量和窄屏的组件用例。 | renderer.js 内 `detail[1]:"…"`（collaborationResources） |
| `attention.demo.items.prReview.detail[2]` | CI 已通过，但验收仍需要你确认滚动行为是否符合设计系统的密度和可访问性要求。 | renderer.js 内 `detail[2]:"…"`（collaborationResources） |
| `attention.demo.items.prReview.replyPlaceholder` | 留下 Review 意见，例如“补一个键盘滚动焦点用例”... | renderer.js 内 `replyPlaceholder:"…"`（collaborationResources） |
| `attention.demo.items.prReview.resolveNote` | 已批准合入，QODER-131 状态更新为待测试。 | renderer.js 内 `resolveNote:"…"`（collaborationResources） |
| `attention.demo.items.prReview.actions.merge` | 批准合入 PR #138 | renderer.js 内 `merge:"…"`（collaborationResources） |
| `attention.demo.items.prReview.actions.requestChanges` | 要求补充验证 | renderer.js 内 `requestChanges:"…"`（collaborationResources） |
| `attention.demo.items.emptyState.title` | 空状态规范是否先阻塞当前页面改造？ | renderer.js 内 `title:"…"`（collaborationResources） |
| `attention.demo.items.emptyState.meta` | Qoder · QODER-149 · 来自 @Wang | renderer.js 内 `meta:"…"`（collaborationResources） |
| `attention.demo.items.emptyState.type` | 协作请求 | renderer.js 内 `type:"…"`（collaborationResources） |
| `attention.demo.items.emptyState.status` | 可以稍后处理 | renderer.js 内 `status:"…"`（collaborationResources） |
| `attention.demo.items.emptyState.detail[0]` | Wang 在改造 Settings 空状态时发现各页面使用的空状态结构不一致。 | renderer.js 内 `detail[0]:"…"`（collaborationResources） |
| `attention.demo.items.emptyState.detail[1]` | 差异包括图标容器、标题层级、说明文案长度，以及是否重复 Header 主操作。 | renderer.js 内 `detail[1]:"…"`（collaborationResources） |
| `attention.demo.items.emptyState.detail[2]` | 需要你决定当前页面是否等待统一规范，还是先按 design.md 里的空状态基础规则交付。 | renderer.js 内 `detail[2]:"…"`（collaborationResources） |
| `attention.demo.items.emptyState.replyPlaceholder` | 回复 Wang，例如“先按 design.md 规则交付，规范我另开决策记录”... | renderer.js 内 `replyPlaceholder:"…"`（collaborationResources） |
| `attention.demo.items.emptyState.resolveNote` | 已回复 Wang，当前页面按既有空状态规则推进。 | renderer.js 内 `resolveNote:"…"`（collaborationResources） |
| `attention.demo.items.emptyState.actions.shipThenSpec` | 先按现有规则交付 | renderer.js 内 `shipThenSpec:"…"`（collaborationResources） |
| `attention.demo.items.buttonConflict.title` | Button loading 与 icon API 改造发生冲突 | renderer.js 内 `title:"…"`（collaborationResources） |
| `attention.demo.items.buttonConflict.meta` | Qoder · QODER-145 / QODER-146 | renderer.js 内 `meta:"…"`（collaborationResources） |
| `attention.demo.items.buttonConflict.type` | Agent 报告冲突 | renderer.js 内 `type:"…"`（collaborationResources） |
| `attention.demo.items.buttonConflict.status` | 阻塞中 | renderer.js 内 `status:"…"`（collaborationResources） |
| `attention.demo.items.buttonConflict.detail[0]` | 两个并行 Turn 都修改了设计系统 Button 的 props 区域。 | renderer.js 内 `detail[0]:"…"`（collaborationResources） |
| `attention.demo.items.buttonConflict.detail[1]` | QODER-145 新增 loading 状态和点击禁用逻辑；QODER-146 调整 prefixIcon / suffixIcon 的类型约束。 | renderer.js 内 `detail[1]:"…"`（collaborationResources） |
| `attention.demo.items.buttonConflict.detail[2]` | 两项能力可以共存，但需要先确定 Button API 的公开形态，避免发布后再破坏调用方。 | renderer.js 内 `detail[2]:"…"`（collaborationResources） |
| `attention.demo.items.buttonConflict.detail[3]` | 建议合并两项能力，并保留当前 prefixIcon / suffixIcon API，不引入新的 icon 对象格式。 | renderer.js 内 `detail[3]:"…"`（collaborationResources） |
| `attention.demo.items.buttonConflict.resolveNote` | 已选择合并两项能力，并保持现有 icon API。 | renderer.js 内 `resolveNote:"…"`（collaborationResources） |
| `attention.demo.items.buttonConflict.actions.mergeBoth` | 合并两项能力 | renderer.js 内 `mergeBoth:"…"`（collaborationResources） |
| `attention.demo.items.buttonConflict.actions.keepA` | 只保留 loading 改造 | renderer.js 内 `keepA:"…"`（collaborationResources） |
| `attention.demo.items.buttonConflict.actions.keepB` | 只保留 icon API 改造 | renderer.js 内 `keepB:"…"`（collaborationResources） |
| `attention.demo.items.token.title` | Design Token 迁移证据是否足够验收？ | renderer.js 内 `title:"…"`（collaborationResources） |
| `attention.demo.items.token.meta` | Qoder · QODER-127 · 视觉回归已通过 | renderer.js 内 `meta:"…"`（collaborationResources） |
| `attention.demo.items.token.type` | 状态确认 | renderer.js 内 `type:"…"`（collaborationResources） |
| `attention.demo.items.token.status` | 待你确认 | renderer.js 内 `status:"…"`（collaborationResources） |
| `attention.demo.items.token.detail[0]` | Cloud Agent 已提交 QODER-127 的 Design Token 迁移证据。 | renderer.js 内 `detail[0]:"…"`（collaborationResources） |
| `attention.demo.items.token.detail[1]` | 变更包括语义 token 映射、主题切换用例，以及受影响组件的视觉回归截图。 | renderer.js 内 `detail[1]:"…"`（collaborationResources） |
| `attention.demo.items.token.detail[2]` | 当前缺口是 Electron 暗色主题下的 ContentDialog 截图尚未人工复核。你需要决定是否先接受本轮交付，还是要求补齐该证据。 | renderer.js 内 `detail[2]:"…"`（collaborationResources） |
| `attention.demo.items.token.resolveNote` | 已接受本轮迁移，并记录暗色主题弹窗复核为后续验证项。 | renderer.js 内 `resolveNote:"…"`（collaborationResources） |
| `attention.demo.items.token.actions.confirm` | 接受本轮迁移 | renderer.js 内 `confirm:"…"`（collaborationResources） |
| `attention.demo.items.token.actions.revise` | 要求补齐截图 | renderer.js 内 `revise:"…"`（collaborationResources） |
| `attention.demo.items.formBuilder.title` | Issue 创建表单重构已完成，是否进入验收？ | renderer.js 内 `title:"…"`（collaborationResources） |
| `attention.demo.items.formBuilder.meta` | Qoder · QODER-088 · 你创建的 | renderer.js 内 `meta:"…"`（collaborationResources） |
| `attention.demo.items.formBuilder.type` | Agent 任务完成 | renderer.js 内 `type:"…"`（collaborationResources） |
| `attention.demo.items.formBuilder.status` | 3h 前 | renderer.js 内 `status:"…"`（collaborationResources） |
| `attention.demo.items.formBuilder.detail[0]` | 你派发的 QODER-088 已完成，目标是重构 Issue 创建表单的字段组织和校验反馈。 | renderer.js 内 `detail[0]:"…"`（collaborationResources） |
| `attention.demo.items.formBuilder.detail[1]` | 交付包含项目选择、标题校验、执行目标预览，以及从文件生成初始 Issue 的错误状态。 | renderer.js 内 `detail[1]:"…"`（collaborationResources） |
| `attention.demo.items.formBuilder.detail[2]` | Agent 已附上 typecheck、相关单测和两张关键路径截图。需要你决定是否进入验收，还是继续补覆盖。 | renderer.js 内 `detail[2]:"…"`（collaborationResources） |
| `attention.demo.items.formBuilder.resolveNote` | 已进入验收，QODER-088 等待人工复核。 | renderer.js 内 `resolveNote:"…"`（collaborationResources） |
| `attention.demo.items.formBuilder.actions.accept` | 进入验收 | renderer.js 内 `accept:"…"`（collaborationResources） |
| `attention.demo.items.formBuilder.actions.reject` | 要求补覆盖 | renderer.js 内 `reject:"…"`（collaborationResources） |
| `attention.demo.items.releaseGate.title` | 登录刷新回归是否阻塞本次发布？ | renderer.js 内 `title:"…"`（collaborationResources） |
| `attention.demo.items.releaseGate.meta` | Qoder · QODER-156 · 来自 QA | renderer.js 内 `meta:"…"`（collaborationResources） |
| `attention.demo.items.releaseGate.type` | 发布风险判断 | renderer.js 内 `type:"…"`（collaborationResources） |
| `attention.demo.items.releaseGate.status` | 需要定夺 | renderer.js 内 `status:"…"`（collaborationResources） |
| `attention.demo.items.releaseGate.detail[0]` | QA 在发布前回归中发现一次登录 token 刷新失败。 | renderer.js 内 `detail[0]:"…"`（collaborationResources） |
| `attention.demo.items.releaseGate.detail[1]` | 失败只在本地网络切换后出现一次，Agent 没有在自动化复现中再次命中，但相关代码刚经历过 AuthMainService 调整。 | renderer.js 内 `detail[1]:"…"`（collaborationResources） |
| `attention.demo.items.releaseGate.detail[2]` | 需要你决定本次发布是否等待补充复现，或者带监控继续发布并创建后续跟踪 Issue。 | renderer.js 内 `detail[2]:"…"`（collaborationResources） |
| `attention.demo.items.releaseGate.replyPlaceholder` | 回复 QA，例如“先补网络切换复现，发布窗口顺延 30 分钟”... | renderer.js 内 `replyPlaceholder:"…"`（collaborationResources） |
| `attention.demo.items.releaseGate.resolveNote` | 已记录发布判断，QA 与 Agent 将按该路径继续。 | renderer.js 内 `resolveNote:"…"`（collaborationResources） |
| `attention.demo.items.releaseGate.actions.holdRelease` | 阻塞发布并补复现 | renderer.js 内 `holdRelease:"…"`（collaborationResources） |
| `attention.demo.items.releaseGate.actions.shipWithGuard` | 带监控继续发布 | renderer.js 内 `shipWithGuard:"…"`（collaborationResources） |
| `attention.demo.items.releaseGate.actions.splitFollowup` | 拆后续跟踪 Issue | renderer.js 内 `splitFollowup:"…"`（collaborationResources） |
| `attention.demo.items.tooltip.title` | Tooltip 无障碍绑定等待确认 48 小时 | renderer.js 内 `title:"…"`（collaborationResources） |
| `attention.demo.items.tooltip.meta` | Qoder · QODER-097 · 2 天未处理 | renderer.js 内 `meta:"…"`（collaborationResources） |
| `attention.demo.items.tooltip.type` | 已过期 | renderer.js 内 `type:"…"`（collaborationResources） |
| `attention.demo.items.tooltip.status` | 已超时 48h | renderer.js 内 `status:"…"`（collaborationResources） |
| `attention.demo.items.tooltip.detail[0]` | Agent 在实现 Tooltip 时需要确认 aria-describedby 和 role="tooltip" 的绑定方式。 | renderer.js 内 `detail[0]:"…"`（collaborationResources） |
| `attention.demo.items.tooltip.detail[1]` | 该请求已等待 48 小时，当前阻塞 Tooltip 发布和后续 DropdownMenu 的无障碍复用。 | renderer.js 内 `detail[1]:"…"`（collaborationResources） |
| `attention.demo.items.tooltip.detail[2]` | 建议按 WAI-ARIA tooltip pattern 绑定描述关系，并把交互限制写入设计系统示例。 | renderer.js 内 `detail[2]:"…"`（collaborationResources） |
| `attention.demo.items.tooltip.replyPlaceholder` | 补充说明，例如“hover/focus 共用同一个 describedby id”... | renderer.js 内 `replyPlaceholder:"…"`（collaborationResources） |
| `attention.demo.items.tooltip.resolveNote` | 已确认无障碍绑定方式，QODER-097 解除阻塞。 | renderer.js 内 `resolveNote:"…"`（collaborationResources） |
| `attention.demo.items.tooltip.actions.handleNow` | 采用 WAI-ARIA 绑定 | renderer.js 内 `handleNow:"…"`（collaborationResources） |
| `attention.demo.items.tooltip.actions.delegate` | 转给设计系统负责人 | renderer.js 内 `delegate:"…"`（collaborationResources） |
| `attention.exploration.title` | 这里可以收纳哪些判断 | renderer.js 内 `title:"…"`（collaborationResources） |
| `attention.exploration.mock` | 探索数据 | renderer.js 内 `mock:"…"`（collaborationResources） |
| `attention.exploration.queueLabel` | 需要判断的事项 | renderer.js 内 `queueLabel:"…"`（collaborationResources） |
| `attention.exploration.description` | 这组样例不会创建真实待办，用来比较不同来源、风险和判断成本。 | renderer.js 内 `description:"…"`（collaborationResources） |
| `attention.exploration.count_one` | {{count}} 个样例 | renderer.js 内 `count_one:"…"`（collaborationResources） |
| `attention.exploration.count_other` | {{count}} 个样例 | renderer.js 内 `count_other:"…"`（collaborationResources） |
| `attention.exploration.direction.title` | 选择 Attention 首版的信息结构 | renderer.js 内 `title:"…"`（collaborationResources） |
| `attention.exploration.direction.question` | 首版应该优先按“等待我的原因”组织，还是按项目和 Issue 来源组织？ | renderer.js 内 `question:"…"`（collaborationResources） |
| `attention.exploration.direction.context` | Qoder · QODER-1851 · Personal Agent · 12 分钟前 | renderer.js 内 `context:"…"`（collaborationResources） |
| `attention.exploration.direction.whyYou` | 这会定义所有成员看到的协作入口，Agent 无法替你决定产品心智。 | renderer.js 内 `whyYou:"…"`（collaborationResources） |
| `attention.exploration.direction.recommendation` | 先按判断原因组织，并始终保留项目与 Issue 来源。 | renderer.js 内 `recommendation:"…"`（collaborationResources） |
| `attention.exploration.direction.consequence` | 确认后，2 个界面探索会按同一结构继续；另一方向暂不实现。 | renderer.js 内 `consequence:"…"`（collaborationResources） |
| `attention.exploration.direction.footer` | 已附两种结构的窄屏与宽屏对比 | renderer.js 内 `footer:"…"`（collaborationResources） |
| `attention.exploration.split.title` | 是否拆出一个 Sub-issue | renderer.js 内 `title:"…"`（collaborationResources） |
| `attention.exploration.split.question` | “恢复待确认权限请求”已经可以独立负责和验收，要从 QODER-1842 拆出来吗？ | renderer.js 内 `question:"…"`（collaborationResources） |
| `attention.exploration.split.context` | Qoder · QODER-1842 · Personal Agent · 34 分钟前 | renderer.js 内 `context:"…"`（collaborationResources） |
| `attention.exploration.split.whyYou` | 你是 Owner；拆分会改变公开责任与验收边界。 | renderer.js 内 `whyYou:"…"`（collaborationResources） |
| `attention.exploration.split.recommendation` | 拆分，并让父 Issue 继续负责整体恢复闭环。 | renderer.js 内 `recommendation:"…"`（collaborationResources） |
| `attention.exploration.split.consequence` | 会创建一个关联 Sub-issue，现有任务和调查证据仍留在父 Issue。 | renderer.js 内 `consequence:"…"`（collaborationResources） |
| `attention.exploration.split.footer` | 建议边界、负责人和验收条件已整理，可在原 Issue 中修改 | renderer.js 内 `footer:"…"`（collaborationResources） |
| `attention.exploration.conflict.title` | 协调两位成员的重叠改动 | renderer.js 内 `title:"…"`（collaborationResources） |
| `attention.exploration.conflict.question` | 林然的登录反馈整理与 Agent 的问题归纳将同时修改分类规则，先采用哪一份作为基线？ | renderer.js 内 `question:"…"`（collaborationResources） |
| `attention.exploration.conflict.context` | Acme Launch Rehearsal · DEMO-102 · 林然与 Agent · 48 分钟前 | renderer.js 内 `context:"…"`（collaborationResources） |
| `attention.exploration.conflict.whyYou` | 两项工作都由你承诺交付，继续并行可能产生互相覆盖的公共事实。 | renderer.js 内 `whyYou:"…"`（collaborationResources） |
| `attention.exploration.conflict.recommendation` | 先确认林然的分类，再让 Agent 基于已确认版本归纳。 | renderer.js 内 `recommendation:"…"`（collaborationResources） |
| `attention.exploration.conflict.consequence` | Agent 暂停写入但继续整理证据；林然的工作不受影响。 | renderer.js 内 `consequence:"…"`（collaborationResources） |
| `attention.exploration.conflict.footer` | 重叠字段、双方最新进展与预计等待时间已附加 | renderer.js 内 `footer:"…"`（collaborationResources） |
| `attention.exploration.permission.title` | 授权读取测试环境日志 | renderer.js 内 `title:"…"`（collaborationResources） |
| `attention.exploration.permission.question` | 允许 Agent 在本轮读取最近 24 小时的测试环境登录日志吗？日志可能包含用户标识符。 | renderer.js 内 `question:"…"`（collaborationResources） |
| `attention.exploration.permission.context` | Acme Launch Rehearsal · DEMO-103 · Personal Agent · 1 小时前 | renderer.js 内 `context:"…"`（collaborationResources） |
| `attention.exploration.permission.whyYou` | 请求超出当前数据权限，且涉及可能识别用户的信息。 | renderer.js 内 `whyYou:"…"`（collaborationResources） |
| `attention.exploration.permission.recommendation` | 只授权脱敏字段，并限制到 DEMO-103 当前 Run。 | renderer.js 内 `recommendation:"…"`（collaborationResources） |
| `attention.exploration.permission.consequence` | 授权后继续定位高频失败原因；拒绝后改用现有反馈样本，结论可信度会降低。 | renderer.js 内 `consequence:"…"`（collaborationResources） |
| `attention.exploration.permission.footer` | 请求字段、用途、保留时间和替代路径已列出 | renderer.js 内 `footer:"…"`（collaborationResources） |
| `attention.exploration.review.title` | 验收可恢复的个人交付闭环 | renderer.js 内 `title:"…"`（collaborationResources） |
| `attention.exploration.review.question` | Agent 声明重启恢复已经完成；现有证据是否足以接受本轮结果？ | renderer.js 内 `question:"…"`（collaborationResources） |
| `attention.exploration.review.context` | Qoder · QODER-1842 · Personal Agent · 2 小时前 | renderer.js 内 `context:"…"`（collaborationResources） |
| `attention.exploration.review.whyYou` | 你是最终验收人；Agent 不能审批自己的工作。 | renderer.js 内 `whyYou:"…"`（collaborationResources） |
| `attention.exploration.review.recommendation` | 先接受恢复路径，另行记录 Windows 文件锁仍未验证的风险。 | renderer.js 内 `recommendation:"…"`（collaborationResources） |
| `attention.exploration.review.consequence` | 接受后本轮执行结束，但 Issue 仍需满足完整 Done Contract 才能完成。 | renderer.js 内 `consequence:"…"`（collaborationResources） |
| `attention.exploration.review.footer` | 7 项验证通过 · 1 项环境证据缺失 · Diff 与重启录像已附加 | renderer.js 内 `footer:"…"`（collaborationResources） |

### `chatActivity.*`（48）

| 键 | 原文文案 | 出处 |
| --- | --- | --- |
| `chatActivity.runningExpanded` | 正在执行中 | renderer.js 内 `runningExpanded:"…"`（chatTimelineResources） |
| `chatActivity.runningDetail` | {{detail}} | renderer.js 内 `runningDetail:"…"`（chatTimelineResources） |
| `chatActivity.runningToolAction` | 正在{{action}} | renderer.js 内 `runningToolAction:"…"`（chatTimelineResources） |
| `chatActivity.runningToolCall` | 正在调用 {{tool}} | renderer.js 内 `runningToolCall:"…"`（chatTimelineResources） |
| `chatActivity.runningToolDetail` | {{summary}} · {{detail}} | renderer.js 内 `runningToolDetail:"…"`（chatTimelineResources） |
| `chatActivity.completedTools_one` | 执行工具 {{count}} 次 | renderer.js 内 `completedTools_one:"…"`（chatTimelineResources） |
| `chatActivity.completedTools_other` | 执行工具 {{count}} 次 | renderer.js 内 `completedTools_other:"…"`（chatTimelineResources） |
| `chatActivity.completedToolsWithFailures_one` | 执行工具 {{count}} 次，其中 {{failedCount}} 次失败 | renderer.js 内 `completedToolsWithFailures_one:"…"`（chatTimelineResources） |
| `chatActivity.completedToolsWithFailures_other` | 执行工具 {{count}} 次，其中 {{failedCount}} 次失败 | renderer.js 内 `completedToolsWithFailures_other:"…"`（chatTimelineResources） |
| `chatActivity.subagentRunning` | 子 Agent 正在执行 | renderer.js 内 `subagentRunning:"…"`（chatTimelineResources） |
| `chatActivity.subagentRunningDuration` | 子 Agent 正在执行 {{duration}} | renderer.js 内 `subagentRunningDuration:"…"`（chatTimelineResources） |
| `chatActivity.subagentRunningDurationDetail` | 子 Agent 正在执行 {{duration}} · {{detail}} | renderer.js 内 `subagentRunningDurationDetail:"…"`（chatTimelineResources） |
| `chatActivity.subagentRoleWithName` | {{role}} {{name}} | renderer.js 内 `subagentRoleWithName:"…"`（chatTimelineResources） |
| `chatActivity.subagentRole.frontendDeveloper` | 前端工程师 | renderer.js 内 `frontendDeveloper:"…"`（chatTimelineResources） |
| `chatActivity.subagentRole.backendDeveloper` | 后端工程师 | renderer.js 内 `backendDeveloper:"…"`（chatTimelineResources） |
| `chatActivity.subagentRole.qa` | 测试工程师 | renderer.js 内 `qa:"…"`（chatTimelineResources） |
| `chatActivity.subagentRole.codeReviewer` | 代码评审员 | renderer.js 内 `codeReviewer:"…"`（chatTimelineResources） |
| `chatActivity.subagentRole.researcher` | 调研员 | renderer.js 内 `researcher:"…"`（chatTimelineResources） |
| `chatActivity.subagentRole.uxDesigner` | UX 设计师 | renderer.js 内 `uxDesigner:"…"`（chatTimelineResources） |
| `chatActivity.subagentRole.operations` | 运维工程师 | renderer.js 内 `operations:"…"`（chatTimelineResources） |
| `chatActivity.subagentRole.debugger` | 故障诊断工程师 | renderer.js 内 `debugger:"…"`（chatTimelineResources） |
| `chatActivity.subagentRole.generalEngineer` | 通用工程师 | renderer.js 内 `generalEngineer:"…"`（chatTimelineResources） |
| `chatActivity.subagentRole.fullStackEngineer` | 全栈工程师 | renderer.js 内 `fullStackEngineer:"…"`（chatTimelineResources） |
| `chatActivity.subagentRole.uiOperator` | UI 操作者 | renderer.js 内 `uiOperator:"…"`（chatTimelineResources） |
| `chatActivity.subagentRole.customEngineer` | 自定义工程师 | renderer.js 内 `customEngineer:"…"`（chatTimelineResources） |
| `chatActivity.subagentTitle` | {{name}} · {{task}} | renderer.js 内 `subagentTitle:"…"`（chatTimelineResources） |
| `chatActivity.subagentStatusWithTitle` | {{title}} · {{status}} | renderer.js 内 `subagentStatusWithTitle:"…"`（chatTimelineResources） |
| `chatActivity.subagentCompleted` | 子 Agent 已完成 | renderer.js 内 `subagentCompleted:"…"`（chatTimelineResources） |
| `chatActivity.subagentCompletedDuration` | 子 Agent 已完成 {{duration}} | renderer.js 内 `subagentCompletedDuration:"…"`（chatTimelineResources） |
| `chatActivity.subagentTranscriptLoading` | 正在加载执行记录… | renderer.js 内 `subagentTranscriptLoading:"…"`（chatTimelineResources） |
| `chatActivity.subagentTranscriptLoadMore` | 加载更多记录 | renderer.js 内 `subagentTranscriptLoadMore:"…"`（chatTimelineResources） |
| `chatActivity.subagentTranscriptRetry` | 重试加载 | renderer.js 内 `subagentTranscriptRetry:"…"`（chatTimelineResources） |
| `chatActivity.subagentFailed` | 子 Agent 执行失败 | renderer.js 内 `subagentFailed:"…"`（chatTimelineResources） |
| `chatActivity.subagentFailedDuration` | 子 Agent 执行失败 {{duration}} | renderer.js 内 `subagentFailedDuration:"…"`（chatTimelineResources） |
| `chatActivity.subagentInterrupted` | 子 Agent 已中断 | renderer.js 内 `subagentInterrupted:"…"`（chatTimelineResources） |
| `chatActivity.turnInterruptedWithUnansweredQuestion` | Qoder 的回复已被你终止，未回答的问题已取消。 | renderer.js 内 `turnInterruptedWithUnansweredQuestion:"…"`（chatTimelineResources） |
| `chatActivity.turnFailureCard.dismiss` | 关闭错误提示 | renderer.js 内 `dismiss:"…"`（chatTimelineResources） |
| `chatActivity.agentResultError.dismiss` | 关闭错误提示 | renderer.js 内 `dismiss:"…"`（chatTimelineResources） |
| `chatActivity.agentResultError.teamQuotaExhausted.title` | 团队额度已用尽 | renderer.js 内 `title:"…"`（chatTimelineResources） |
| `chatActivity.agentResultError.teamQuotaExhausted.message` | 团队当前已无可用额度，请联系管理员增购更多资源后重试。 | renderer.js 内 `message:"…"`（chatTimelineResources） |
| `chatActivity.agentResultError.actionFailed` | 操作未完成，请稍后重试。 | renderer.js 内 `actionFailed:"…"`（chatTimelineResources） |
| `chatActivity.agentResultError.rechargeFailed` | 暂时无法打开充值页面，请稍后重试。 | renderer.js 内 `rechargeFailed:"…"`（chatTimelineResources） |
| `chatActivity.mcpAppLoading` | 正在安全加载交互界面… | renderer.js 内 `mcpAppLoading:"…"`（chatTimelineResources） |
| `chatActivity.mcpAppUnavailable` | 交互界面暂时无法打开 | renderer.js 内 `mcpAppUnavailable:"…"`（chatTimelineResources） |
| `chatActivity.mcpAppFallback` | 工具结果仍然保留在下方，你也可以重试加载界面。 | renderer.js 内 `mcpAppFallback:"…"`（chatTimelineResources） |
| `chatActivity.mcpAppRetry` | 重试 | renderer.js 内 `mcpAppRetry:"…"`（chatTimelineResources） |
| `chatActivity.mcpAppTitle` | {{server}} 提供的交互界面 | renderer.js 内 `mcpAppTitle:"…"`（chatTimelineResources） |
| `chatActivity.mcpAppCancelled` | 工具执行已停止 | renderer.js 内 `mcpAppCancelled:"…"`（chatTimelineResources） |

### `chatSession.*`（32）

| 键 | 原文文案 | 出处 |
| --- | --- | --- |
| `chatSession.openFailedTitle` | 无法打开这个任务 | renderer.js 内 `openFailedTitle:"…"`（chatSessionResources） |
| `chatSession.agentTeam.awaitingAgentInbox` | 任务已提交，正在等待本机 Agent 接收 | renderer.js 内 `awaitingAgentInbox:"…"`（chatSessionResources） |
| `chatSession.openFailedDescription` | 任务历史暂时不可用，请稍后重试。 | renderer.js 内 `openFailedDescription:"…"`（chatSessionResources） |
| `chatSession.worktreeInitialization.creatingTitle` | 正在创建 Worktree | renderer.js 内 `creatingTitle:"…"`（chatSessionResources） |
| `chatSession.worktreeInitialization.completedTitle` | 已创建 Worktree | renderer.js 内 `completedTitle:"…"`（chatSessionResources） |
| `chatSession.worktreeInitialization.failedTitle` | Worktree 初始化失败 | renderer.js 内 `failedTitle:"…"`（chatSessionResources） |
| `chatSession.worktreeInitialization.failedFallback` | 无法创建 Worktree，请重试。 | renderer.js 内 `failedFallback:"…"`（chatSessionResources） |
| `chatSession.worktreeInitialization.timeoutFailure` | 创建 Worktree 超时，请检查仓库状态后重试。 | renderer.js 内 `timeoutFailure:"…"`（chatSessionResources） |
| `chatSession.worktreeInitialization.expandLabel` | 展开{{title}} | renderer.js 内 `expandLabel:"…"`（chatSessionResources） |
| `chatSession.worktreeInitialization.collapseLabel` | 收起{{title}} | renderer.js 内 `collapseLabel:"…"`（chatSessionResources） |
| `chatSession.forkFailedTitle` | 无法 Fork 任务 | renderer.js 内 `forkFailedTitle:"…"`（chatSessionResources） |
| `chatSession.forkFailedDescription` | 任务分支创建失败，请稍后重试。 | renderer.js 内 `forkFailedDescription:"…"`（chatSessionResources） |
| `chatSession.worktreeRestore.title` | Worktree 已清理 | renderer.js 内 `title:"…"`（chatSessionResources） |
| `chatSession.worktreeRestore.description` | 此任务的 Worktree 已被清理以释放磁盘空间。 | renderer.js 内 `description:"…"`（chatSessionResources） |
| `chatSession.worktreeRestore.unavailableDescription` | 此任务的 Worktree 已不存在，且没有可用的 Git 备份，无法继续执行。 | renderer.js 内 `unavailableDescription:"…"`（chatSessionResources） |
| `chatSession.worktreeRestore.action` | 恢复 Worktree | renderer.js 内 `action:"…"`（chatSessionResources） |
| `chatSession.worktreeRestore.restoring` | 正在恢复… | renderer.js 内 `restoring:"…"`（chatSessionResources） |
| `chatSession.worktreeRestore.successTitle` | Worktree 已恢复 | renderer.js 内 `successTitle:"…"`（chatSessionResources） |
| `chatSession.worktreeRestore.successDescription` | 现在可以继续此任务。Git 忽略的文件不在备份范围内。 | renderer.js 内 `successDescription:"…"`（chatSessionResources） |
| `chatSession.worktreeRestore.failureTitle` | 无法恢复 Worktree | renderer.js 内 `failureTitle:"…"`（chatSessionResources） |
| `chatSession.worktreeRestore.failure.validation` | Worktree 路径或来源仓库已发生变化，无法安全恢复。 | renderer.js 内 `validation:"…"`（chatSessionResources） |
| `chatSession.worktreeRestore.failure.snapshot` | Git 备份不存在或已损坏，无法恢复这个 Worktree。 | renderer.js 内 `snapshot:"…"`（chatSessionResources） |
| `chatSession.worktreeRestore.failure.restore` | Worktree 恢复未完成，请确认磁盘与 Git 状态后重试。 | renderer.js 内 `restore:"…"`（chatSessionResources） |
| `chatSession.worktreeRestore.failure.metadata` | Worktree 已回滚，因为 Qoder 无法写入恢复元数据。请重试。 | renderer.js 内 `metadata:"…"`（chatSessionResources） |
| `chatSession.addFolderFailed` | 文件夹添加失败 | renderer.js 内 `addFolderFailed:"…"`（chatSessionResources） |
| `chatSession.addFolderRetry` | 请稍后重试。 | renderer.js 内 `addFolderRetry:"…"`（chatSessionResources） |
| `chatSession.header.openIssue` | 打开 Issue {{identifier}} | renderer.js 内 `openIssue:"…"`（chatSessionResources） |
| `chatSession.teamMembersTitle` | 团队成员 | renderer.js 内 `teamMembersTitle:"…"`（chatSessionResources） |
| `chatSession.teamSettings` | 团队设置 | renderer.js 内 `teamSettings:"…"`（chatSessionResources） |
| `chatSession.teamMembers` | 团队成员（{{count}} 人） | renderer.js 内 `teamMembers:"…"`（chatSessionResources） |
| `chatSession.teamLeader` | 队长 | renderer.js 内 `teamLeader:"…"`（chatSessionResources） |
| `chatSession.teamMember` | 队员 | renderer.js 内 `teamMember:"…"`（chatSessionResources） |

### `composer.*`（27）

| 键 | 原文文案 | 出处 |
| --- | --- | --- |
| `composer.site.loading` | 正在加载模板… | renderer.js 内 `loading:"…"`（newChatResources） |
| `composer.site.applying` | 正在应用… | renderer.js 内 `applying:"…"`（newChatResources） |
| `composer.site.empty` | 暂无可用模板 | renderer.js 内 `empty:"…"`（newChatResources） |
| `composer.site.loadError` | 模板加载失败，请重试 | renderer.js 内 `loadError:"…"`（newChatResources） |
| `composer.site.retry` | 重试 | renderer.js 内 `retry:"…"`（newChatResources） |
| `composer.site.unavailable` | 此模板已不可用，请选择其他模板 | renderer.js 内 `unavailable:"…"`（newChatResources） |
| `composer.site.authentication` | 请登录后重试 | renderer.js 内 `authentication:"…"`（newChatResources） |
| `composer.site.selectionError` | 无法应用此模板，请重试 | renderer.js 内 `selectionError:"…"`（newChatResources） |
| `composer.site.open` | 站点 | renderer.js 内 `open:"…"`（newChatResources） |
| `composer.site.panelLabel` | 站点起步模板 | renderer.js 内 `panelLabel:"…"`（newChatResources） |
| `composer.site.templatesLabel` | 起步模板 | renderer.js 内 `templatesLabel:"…"`（newChatResources） |
| `composer.site.preview` | 预览 | renderer.js 内 `preview:"…"`（newChatResources） |
| `composer.site.previewTemplate` | 预览 {{name}} | renderer.js 内 `previewTemplate:"…"`（newChatResources） |
| `composer.site.previewDescription` | 模板封面预览 | renderer.js 内 `previewDescription:"…"`（newChatResources） |
| `composer.site.previewLoading` | 正在加载预览… | renderer.js 内 `previewLoading:"…"`（newChatResources） |
| `composer.site.previewError` | 预览加载失败，可重试或关闭后继续选用模板 | renderer.js 内 `previewError:"…"`（newChatResources） |
| `composer.site.closePreview` | 关闭模板预览 | renderer.js 内 `closePreview:"…"`（newChatResources） |
| `composer.site.placeholder` | 描述你想创建的网站… | renderer.js 内 `placeholder:"…"`（newChatResources） |
| `composer.site.categoriesLabel` | 网站类型 | renderer.js 内 `categoriesLabel:"…"`（newChatResources） |
| `composer.site.options` | 模板面板选项 | renderer.js 内 `options:"…"`（newChatResources） |
| `composer.site.hide` | 收起模板面板 | renderer.js 内 `hide:"…"`（newChatResources） |
| `composer.site.exit` | 退出建站 | renderer.js 内 `exit:"…"`（newChatResources） |
| `composer.site.previous` | 上一组模板 | renderer.js 内 `previous:"…"`（newChatResources） |
| `composer.site.next` | 下一组模板 | renderer.js 内 `next:"…"`（newChatResources） |
| `composer.site.usePrompt` | 使用 {{name}} 提示词 | renderer.js 内 `usePrompt:"…"`（newChatResources） |
| `composer.contextTags.ariaLabel` | 输入上下文 | renderer.js 内 `ariaLabel:"…"`（newChatResources） |
| `composer.appshot.capture` | 添加应用快照 | renderer.js 内 `capture:"…"`（newChatResources） |

### `desktopPet.*`（28）

| 键 | 原文文案 | 出处 |
| --- | --- | --- |
| `desktopPet.ariaLabel` | Qoder 桌面宠物 | renderer.js 内 `ariaLabel:"…"`（desktopPetResources） |
| `desktopPet.idle` | 空闲 | renderer.js 内 `idle:"…"`（desktopPetResources） |
| `desktopPet.running` | 正在工作 | renderer.js 内 `running:"…"`（desktopPetResources） |
| `desktopPet.waiting` | 需要你的操作 | renderer.js 内 `waiting:"…"`（desktopPetResources） |
| `desktopPet.review` | 结果可查看 | renderer.js 内 `review:"…"`（desktopPetResources） |
| `desktopPet.failed` | 执行受阻 | renderer.js 内 `failed:"…"`（desktopPetResources） |
| `desktopPet.waving` | 正在问候 | renderer.js 内 `waving:"…"`（desktopPetResources） |
| `desktopPet.openWorkbench` | 双击打开 Qoder | renderer.js 内 `openWorkbench:"…"`（desktopPetResources） |
| `desktopPet.controls` | 桌面宠物操作 | renderer.js 内 `controls:"…"`（desktopPetResources） |
| `desktopPet.startVoice` | 切换到语音入口 | renderer.js 内 `startVoice:"…"`（desktopPetResources） |
| `desktopPet.collapseActivity` | 收起任务横幅 | renderer.js 内 `collapseActivity:"…"`（desktopPetResources） |
| `desktopPet.expandActivity` | 展开任务横幅 | renderer.js 内 `expandActivity:"…"`（desktopPetResources） |
| `desktopPet.expandPendingActivity` | 展开任务横幅，有消息待处理 | renderer.js 内 `expandPendingActivity:"…"`（desktopPetResources） |
| `desktopPet.expandErrorActivity` | 展开任务横幅，有执行错误 | renderer.js 内 `expandErrorActivity:"…"`（desktopPetResources） |
| `desktopPet.activity.open` | 打开任务“{{title}}” | renderer.js 内 `open:"…"`（desktopPetResources） |
| `desktopPet.activity.reply` | 回复任务“{{title}}” | renderer.js 内 `reply:"…"`（desktopPetResources） |
| `desktopPet.activity.replyInput` | 回复任务“{{title}}” | renderer.js 内 `replyInput:"…"`（desktopPetResources） |
| `desktopPet.activity.replyPlaceholder` | 回复当前任务 | renderer.js 内 `replyPlaceholder:"…"`（desktopPetResources） |
| `desktopPet.activity.sendReply` | 发送对“{{title}}”的回复 | renderer.js 内 `sendReply:"…"`（desktopPetResources） |
| `desktopPet.activity.stop` | 停止任务“{{title}}” | renderer.js 内 `stop:"…"`（desktopPetResources） |
| `desktopPet.activity.stopping` | 正在停止任务 | renderer.js 内 `stopping:"…"`（desktopPetResources） |
| `desktopPet.activity.replyFailed` | 回复未发送，请重试。 | renderer.js 内 `replyFailed:"…"`（desktopPetResources） |
| `desktopPet.activity.stopFailed` | 无法停止执行，请重试。 | renderer.js 内 `stopFailed:"…"`（desktopPetResources） |
| `desktopPet.activity.status.running` | 正在执行 | renderer.js 内 `running:"…"`（desktopPetResources） |
| `desktopPet.activity.status.waiting` | 等待你的处理 | renderer.js 内 `waiting:"…"`（desktopPetResources） |
| `desktopPet.activity.status.completed` | 本轮已完成 | renderer.js 内 `completed:"…"`（desktopPetResources） |
| `desktopPet.activity.status.failed` | 本轮执行失败 | renderer.js 内 `failed:"…"`（desktopPetResources） |
| `desktopPet.activity.status.interrupted` | 本轮已中断 | renderer.js 内 `interrupted:"…"`（desktopPetResources） |

### `newChat.*`（121）

| 键 | 原文文案 | 出处 |
| --- | --- | --- |
| `newChat.dismissMobileAppPromoFailed` | 无法保存隐藏状态，请重试 | renderer.js 内 `dismissMobileAppPromoFailed:"…"`（newChatResources） |
| `newChat.promptRich` | 用 <executor/> 创造了不起的事物 | renderer.js 内 `promptRich:"…"`（newChatResources） |
| `newChat.promptInWorkspaceRich` | 在 <workspace/> 用 <executor/> 创造了不起的事物 | renderer.js 内 `promptInWorkspaceRich:"…"`（newChatResources） |
| `newChat.executorDefault` | Qoder | renderer.js 内 `executorDefault:"…"`（newChatResources） |
| `newChat.executorAgents` | 自定义智能体 | renderer.js 内 `executorAgents:"…"`（newChatResources） |
| `newChat.executorTeams` | Agent Team | renderer.js 内 `executorTeams:"…"`（newChatResources） |
| `newChat.forestDoodleTitle` | 苹果树下的灵感 | renderer.js 内 `forestDoodleTitle:"…"`（newChatResources） |
| `newChat.forestDoodleDescription` | 1666 年，牛顿从一颗苹果想到万有引力。也许今天，Qoder 能帮你创造点什么... | renderer.js 内 `forestDoodleDescription:"…"`（newChatResources） |
| `newChat.forestDoodleEveDescription` | 很久以前，夏娃摘下一颗苹果，故事从好奇开始。今天，你想把什么想法变成现实？ | renderer.js 内 `forestDoodleEveDescription:"…"`（newChatResources） |
| `newChat.beeDoodleTitle` | Bee | renderer.js 内 `beeDoodleTitle:"…"`（newChatResources） |
| `newChat.beeDoodleDescription` | 带着轻快的嗡鸣出发，让 Qoder 陪你采集今天的灵感。 | renderer.js 内 `beeDoodleDescription:"…"`（newChatResources） |
| `newChat.mintDoodleTitle` | Mint | renderer.js 内 `mintDoodleTitle:"…"`（newChatResources） |
| `newChat.mintDoodleDescription` | 清凉一口，给今天的任务留一点轻松的开始。 | renderer.js 内 `mintDoodleDescription:"…"`（newChatResources） |
| `newChat.parchmentDoodleTitle` | Built For Builders | renderer.js 内 `parchmentDoodleTitle:"…"`（newChatResources） |
| `newChat.parchmentDoodleDescription` | 为创造者而生。 | renderer.js 内 `parchmentDoodleDescription:"…"`（newChatResources） |
| `newChat.promptInWorkspacePrefix` | 在 | renderer.js 内 `promptInWorkspacePrefix:"…"`（newChatResources） |
| `newChat.promptInWorkspacePunctuation` |  | renderer.js 内 `promptInWorkspacePunctuation:"…"`（newChatResources） |
| `newChat.promptInWorkspaceSuffix` | 用 Qoder 创造了不起的事物 | renderer.js 内 `promptInWorkspaceSuffix:"…"`（newChatResources） |
| `newChat.changeWorkspacePrompt` | 切换或清空当前工作区，当前为 {{workspace}} | renderer.js 内 `changeWorkspacePrompt:"…"`（newChatResources） |
| `newChat.clearWorkspace` | 清空当前工作目录 | renderer.js 内 `clearWorkspace:"…"`（newChatResources） |
| `newChat.conversationActivity` | 活跃任务数 | renderer.js 内 `conversationActivity:"…"`（newChatResources） |
| `newChat.creditsHeatmap` | Credits | renderer.js 内 `creditsHeatmap:"…"`（newChatResources） |
| `newChat.creditsHeatmapToggleLabel` | 切换会话与 Credits 热力图 | renderer.js 内 `creditsHeatmapToggleLabel:"…"`（newChatResources） |
| `newChat.creditsProductScopeLabel` | Credits 产品范围 | renderer.js 内 `creditsProductScopeLabel:"…"`（newChatResources） |
| `newChat.creditsProductScopeApp` | Qoder | renderer.js 内 `creditsProductScopeApp:"…"`（newChatResources） |
| `newChat.creditsProductScopeAll` | 所有 Qoder 家族产品 | renderer.js 内 `creditsProductScopeAll:"…"`（newChatResources） |
| `newChat.creditsHeatmapUnavailable` | 数据暂不可用 | renderer.js 内 `creditsHeatmapUnavailable:"…"`（newChatResources） |
| `newChat.conversationDayLabel_one` | {{date}} 活跃 {{count}} 个任务 | renderer.js 内 `conversationDayLabel_one:"…"`（newChatResources） |
| `newChat.conversationDayLabel_other` | {{date}} 活跃 {{count}} 个任务 | renderer.js 内 `conversationDayLabel_other:"…"`（newChatResources） |
| `newChat.conversationDaySummary` | 单日活跃任务 | renderer.js 内 `conversationDaySummary:"…"`（newChatResources） |
| `newChat.conversationAmount_one` | {{count}} 个任务 | renderer.js 内 `conversationAmount_one:"…"`（newChatResources） |
| `newChat.conversationAmount_other` | {{count}} 个任务 | renderer.js 内 `conversationAmount_other:"…"`（newChatResources） |
| `newChat.creditsDayLabel` | {{date}} 消耗 {{value}} Credits | renderer.js 内 `creditsDayLabel:"…"`（newChatResources） |
| `newChat.creditsDaySummary` | 单日 Credits 消耗 | renderer.js 内 `creditsDaySummary:"…"`（newChatResources） |
| `newChat.creditsAmount` | {{value}} Credits | renderer.js 内 `creditsAmount:"…"`（newChatResources） |
| `newChat.attentionItems` | 项 | renderer.js 内 `attentionItems:"…"`（newChatResources） |
| `newChat.activityPlayground.loading` | 正在加载游戏… | renderer.js 内 `loading:"…"`（newChatResources） |
| `newChat.activityPlayground.loadFailed` | 游戏暂不可用，请返回热力图。 | renderer.js 内 `loadFailed:"…"`（newChatResources） |
| `newChat.activityPlayground.blocksTitle` | 横向俄罗斯方块 | renderer.js 内 `blocksTitle:"…"`（newChatResources） |
| `newChat.activityPlayground.blocksAriaLabel` | 横向俄罗斯方块游戏 | renderer.js 内 `blocksAriaLabel:"…"`（newChatResources） |
| `newChat.activityPlayground.blocksInstruction` | ↑ ↓ 移动 · → 加速 · ← 旋转 · 空格暂停/继续 · 满列消除 | renderer.js 内 `blocksInstruction:"…"`（newChatResources） |
| `newChat.activityPlayground.duckBonus` | 消除小鸭子额外加 {{points}} 分 | renderer.js 内 `duckBonus:"…"`（newChatResources） |
| `newChat.activityPlayground.blocksPrompt` | 点击或按 Enter ↵ 开始横向俄罗斯方块 | renderer.js 内 `blocksPrompt:"…"`（newChatResources） |
| `newChat.activityPlayground.blocksEnded` | 游戏结束 | renderer.js 内 `blocksEnded:"…"`（newChatResources） |
| `newChat.activityPlayground.title` | 像素贪吃蛇 | renderer.js 内 `title:"…"`（newChatResources） |
| `newChat.activityPlayground.appleAriaLabel` | 打开像素贪吃蛇游戏 | renderer.js 内 `appleAriaLabel:"…"`（newChatResources） |
| `newChat.activityPlayground.gamePromptTitle` | Juuuuuuust Relax | renderer.js 内 `gamePromptTitle:"…"`（newChatResources） |
| `newChat.activityPlayground.gamePromptInstruction` | 点击或按 Enter ↵ 开始 | renderer.js 内 `gamePromptInstruction:"…"`（newChatResources） |
| `newChat.activityPlayground.ariaLabel` | 像素贪吃蛇游戏 | renderer.js 内 `ariaLabel:"…"`（newChatResources） |
| `newChat.activityPlayground.instruction` | 使用方向键或 W / A / S / D 控制方向 | renderer.js 内 `instruction:"…"`（newChatResources） |
| `newChat.activityPlayground.paused` | 游戏已暂停 | renderer.js 内 `paused:"…"`（newChatResources） |
| `newChat.activityPlayground.resume` | 继续游戏 | renderer.js 内 `resume:"…"`（newChatResources） |
| `newChat.activityPlayground.insufficientSpaceTooltip` | 当前界面空间不足，请增大窗口宽度后继续游戏。 | renderer.js 内 `insufficientSpaceTooltip:"…"`（newChatResources） |
| `newChat.activityPlayground.muteSound` | 关闭游戏声音 | renderer.js 内 `muteSound:"…"`（newChatResources） |
| `newChat.activityPlayground.unmuteSound` | 打开游戏声音 | renderer.js 内 `unmuteSound:"…"`（newChatResources） |
| `newChat.activityPlayground.scoreLabel` | 得分 | renderer.js 内 `scoreLabel:"…"`（newChatResources） |
| `newChat.activityPlayground.bestScoreLabel` | 最高 | renderer.js 内 `bestScoreLabel:"…"`（newChatResources） |
| `newChat.activityPlayground.score` | 得分 {{score}} | renderer.js 内 `score:"…"`（newChatResources） |
| `newChat.activityPlayground.bestScore` | 最高 {{score}} | renderer.js 内 `bestScore:"…"`（newChatResources） |
| `newChat.activityPlayground.replay` | 再来一局 | renderer.js 内 `replay:"…"`（newChatResources） |
| `newChat.activityPlayground.exit` | 返回热力图 | renderer.js 内 `exit:"…"`（newChatResources） |
| `newChat.bindIssueTitle` | 绑定一个 Issue | renderer.js 内 `bindIssueTitle:"…"`（newChatResources） |
| `newChat.bindIssueDescription` | 任务将复用该 Issue 的 Agent 上下文，结果会写回 Issue 动态。 | renderer.js 内 `bindIssueDescription:"…"`（newChatResources） |
| `newChat.connectorCount` | 4 Connectors | renderer.js 内 `connectorCount:"…"`（newChatResources） |
| `newChat.connectorCountCompact` | 4 | renderer.js 内 `connectorCountCompact:"…"`（newChatResources） |
| `newChat.reviewWorkspace` | 审阅工作面 | renderer.js 内 `reviewWorkspace:"…"`（newChatResources） |
| `newChat.reviewNeedsDirectoryTitle` | 选择工作区以开始审阅 | renderer.js 内 `reviewNeedsDirectoryTitle:"…"`（newChatResources） |
| `newChat.reviewNeedsDirectoryDescription` | 选择包含 Git 仓库的工作区后，会优先在这里查看主文件夹的变更。 | renderer.js 内 `reviewNeedsDirectoryDescription:"…"`（newChatResources） |
| `newChat.reviewEmptyTitle` | 尚未开始审阅 | renderer.js 内 `reviewEmptyTitle:"…"`（newChatResources） |
| `newChat.reviewEmptyDescription` | 发送消息后，会在这里显示工作区主文件夹的代码变更。 | renderer.js 内 `reviewEmptyDescription:"…"`（newChatResources） |
| `newChat.reviewNeedsSessionTitle` | 发送消息后开始审阅 | renderer.js 内 `reviewNeedsSessionTitle:"…"`（newChatResources） |
| `newChat.reviewNeedsSessionDescription` | 任务创建后，这里会显示主项目目录中的文件和代码变更。 | renderer.js 内 `reviewNeedsSessionDescription:"…"`（newChatResources） |
| `newChat.terminalTabs` | 终端列表 | renderer.js 内 `terminalTabs:"…"`（newChatResources） |
| `newChat.terminalSplitRight` | 左右分屏 | renderer.js 内 `terminalSplitRight:"…"`（newChatResources） |
| `newChat.terminalSplitDown` | 上下分屏 | renderer.js 内 `terminalSplitDown:"…"`（newChatResources） |
| `newChat.terminalSplitLimit` | 每个终端面板最多显示 {{count}} 个终端 | renderer.js 内 `terminalSplitLimit:"…"`（newChatResources） |
| `newChat.terminalCreate` | 新建终端 | renderer.js 内 `terminalCreate:"…"`（newChatResources） |
| `newChat.terminalClose` | 关闭终端面板 | renderer.js 内 `terminalClose:"…"`（newChatResources） |
| `newChat.terminalRemove` | 关闭终端 {{title}} | renderer.js 内 `terminalRemove:"…"`（newChatResources） |
| `newChat.terminalExited` | 已退出 | renderer.js 内 `terminalExited:"…"`（newChatResources） |
| `newChat.terminalEmptyTitle` | 还没有终端 | renderer.js 内 `terminalEmptyTitle:"…"`（newChatResources） |
| `newChat.terminalEmptyDescription` | 在当前任务的工作目录中打开一个终端。 | renderer.js 内 `terminalEmptyDescription:"…"`（newChatResources） |
| `newChat.terminalErrorTitle` | 无法创建终端 | renderer.js 内 `terminalErrorTitle:"…"`（newChatResources） |
| `newChat.terminalSwitchToDark` | 切换为暗色终端 | renderer.js 内 `terminalSwitchToDark:"…"`（newChatResources） |
| `newChat.terminalSwitchToLight` | 切换为亮色终端 | renderer.js 内 `terminalSwitchToLight:"…"`（newChatResources） |
| `newChat.terminalSelectionAttachment` | {{title}} 选中文本.txt | renderer.js 内 `terminalSelectionAttachment:"…"`（newChatResources） |
| `newChat.terminalPane` | 终端 {{title}} | renderer.js 内 `terminalPane:"…"`（newChatResources） |
| `newChat.terminalResizePanel` | 调整终端面板高度 | renderer.js 内 `terminalResizePanel:"…"`（newChatResources） |
| `newChat.terminalResizeSplit` | 调整终端分屏尺寸 | renderer.js 内 `terminalResizeSplit:"…"`（newChatResources） |
| `newChat.terminalCopy` | 复制 | renderer.js 内 `terminalCopy:"…"`（newChatResources） |
| `newChat.terminalPaste` | 粘贴 | renderer.js 内 `terminalPaste:"…"`（newChatResources） |
| `newChat.terminalLinkOpenFailed` | 无法打开终端链接，请检查 URL 是否有效。 | renderer.js 内 `terminalLinkOpenFailed:"…"`（newChatResources） |
| `newChat.terminalNeedsDirectoryTitle` | 选择工作区以打开终端 | renderer.js 内 `terminalNeedsDirectoryTitle:"…"`（newChatResources） |
| `newChat.terminalNeedsDirectoryDescription` | 选择工作区后，终端会在主文件夹中运行。 | renderer.js 内 `terminalNeedsDirectoryDescription:"…"`（newChatResources） |
| `newChat.executionModeLocal` | 本地模式 | renderer.js 内 `executionModeLocal:"…"`（newChatResources） |
| `newChat.executionModeWorktree` | Worktree 模式 | renderer.js 内 `executionModeWorktree:"…"`（newChatResources） |
| `newChat.executionModeWorktreePrimary` | Worktree 模式 · {{name}} | renderer.js 内 `executionModeWorktreePrimary:"…"`（newChatResources） |
| `newChat.executionModeWorktreeAdditionalRoots_one` | 在 {{count}} 个其他文件夹中本地工作 | renderer.js 内 `executionModeWorktreeAdditionalRoots_one:"…"`（newChatResources） |
| `newChat.executionModeWorktreeAdditionalRoots_other` | 在 {{count}} 个其他文件夹中本地工作 | renderer.js 内 `executionModeWorktreeAdditionalRoots_other:"…"`（newChatResources） |
| `newChat.executionModeWorktreeDescription` | 创建 {{name}} 的副本，以便并行工作。 | renderer.js 内 `executionModeWorktreeDescription:"…"`（newChatResources） |
| `newChat.executionModeWorktreeMultipleRootsDescription` | 创建 {{name}} 的副本以并行处理。其他 Workspace 文件夹会被直接访问。 | renderer.js 内 `executionModeWorktreeMultipleRootsDescription:"…"`（newChatResources） |
| `newChat.executionModeWorktreeUnavailable` | Worktree 模式暂不可用 | renderer.js 内 `executionModeWorktreeUnavailable:"…"`（newChatResources） |
| `newChat.executionModeWorktreeGitRequired` | 请选择已有提交且支持 Worktree 的本机 Git Workspace | renderer.js 内 `executionModeWorktreeGitRequired:"…"`（newChatResources） |
| `newChat.executionModeWorktreeRuntimeRequired` | Worktree 模式仅支持本机 Qoder CLI Runtime | renderer.js 内 `executionModeWorktreeRuntimeRequired:"…"`（newChatResources） |
| `newChat.executionModeWorktreeIssueUnavailable` | Issue 任务暂不支持 Worktree 模式 | renderer.js 内 `executionModeWorktreeIssueUnavailable:"…"`（newChatResources） |
| `newChat.executionModeWorktreeTeamUnavailable` | 团队任务暂不支持自动创建 Worktree | renderer.js 内 `executionModeWorktreeTeamUnavailable:"…"`（newChatResources） |
| `newChat.selectWorktreeStartingPoint` | 选择 Worktree 创建起点，当前为 {{branch}} | renderer.js 内 `selectWorktreeStartingPoint:"…"`（newChatResources） |
| `newChat.selectExecutionMode` | 选择执行模式，当前为 {{mode}} | renderer.js 内 `selectExecutionMode:"…"`（newChatResources） |
| `newChat.gitLoading` | 正在读取分支… | renderer.js 内 `gitLoading:"…"`（newChatResources） |
| `newChat.newBranchTitle` | 新建并检出分支 | renderer.js 内 `newBranchTitle:"…"`（newChatResources） |
| `newChat.newBranchDescription` | 从 {{branch}} 创建新分支。工作区中的现有变更会保留。 | renderer.js 内 `newBranchDescription:"…"`（newChatResources） |
| `newChat.newBranchName` | 新分支名称 | renderer.js 内 `newBranchName:"…"`（newChatResources） |
| `newChat.newBranchPlaceholder` | 例如 feat/review-panel | renderer.js 内 `newBranchPlaceholder:"…"`（newChatResources） |
| `newChat.gitTargetUnavailable` | 工作目录不可用。 | renderer.js 内 `gitTargetUnavailable:"…"`（newChatResources） |
| `newChat.gitBranchRequired` | 请输入或选择一个分支。 | renderer.js 内 `gitBranchRequired:"…"`（newChatResources） |
| `newChat.agentTeams.solo` | 个人 Agent | renderer.js 内 `solo:"…"`（newChatResources） |
| `newChat.agentTeams.soloMembers` | 1 位成员 | renderer.js 内 `soloMembers:"…"`（newChatResources） |
| `newChat.agentTeams.delivery` | 交付团队 | renderer.js 内 `delivery:"…"`（newChatResources） |
| `newChat.agentTeams.deliveryMembers` | 3 位成员 | renderer.js 内 `deliveryMembers:"…"`（newChatResources） |
| `newChat.agentTeams.review` | Review 团队 | renderer.js 内 `review:"…"`（newChatResources） |
| `newChat.agentTeams.reviewMembers` | 2 位成员 | renderer.js 内 `reviewMembers:"…"`（newChatResources） |

### `workbenchWindow.*`（3）

| 键 | 原文文案 | 出处 |
| --- | --- | --- |
| `workbenchWindow.openInNewWindow` | 在新窗口中打开 | renderer.js 内 `openInNewWindow:"…"`（shellResources） |
| `workbenchWindow.openInNewTab` | 在新标签页中打开 | renderer.js 内 `openInNewTab:"…"`（shellResources） |
| `workbenchWindow.openBlocked` | 浏览器阻止了新标签页，请允许此站点打开弹出式窗口后重试。 | renderer.js 内 `openBlocked:"…"`（shellResources） |

## 附录 B：未逐条列入的命名空间（非 AI 对话流主面）

| 命名空间 | zh 条目数 | 说明 |
| --- | --- | --- |
| `settings.*` | 2091 | 未逐条取证 |
| `discussion.*` | 532 | 未逐条取证 |
| `extensions.*` | 515 | 未逐条取证 |
| `issue.*` | 299 | 未逐条取证 |
| `automationTasks.*` | 232 | 未逐条取证 |
| `project.*` | 186 | 未逐条取证 |
| `playground.*` | 122 | 未逐条取证 |
| `collaborationUi.*` | 117 | 未逐条取证 |
| `remoteSsh.*` | 66 | 未逐条取证 |
| `members.*` | 59 | 未逐条取证 |
| `deepLink.*` | 54 | 未逐条取证 |
| `workspace.*` | 49 | 未逐条取证 |
| `auth.*` | 44 | 未逐条取证 |
| `webInvite.*` | 16 | 未逐条取证 |
| `about.*` | 14 | 未逐条取证 |
| `profile.*` | 12 | 未逐条取证 |
| `automationSidebar.*` | 12 | 未逐条取证 |
| `description.*` | 1 | 未逐条取证 |

合计 4421 条（已枚举计数，未逐条列入正文）。

## 附录 C：组件内置默认文案（**不走 i18n 语言包**，写死在 renderer.js 的字面量对象）

这一族最容易被漏：它们是"语言包查不到但屏幕上确有字"的那一类，出处给的是字节偏移。

### defaultMermaidDiagramLabels — renderer.js @3804800

```
copy:"复制代码"
copied:"代码已复制"
downloadJpg:"下载 Mermaid JPG"
viewDiagram:"查看 Mermaid 图表"
viewSource:"查看 Mermaid 源码"
renderingDiagram:"正在渲染图表..."
renderFailed:"无法渲染 Mermaid 图表"
openMermaidFullscreen:"全屏查看 Mermaid 图表"
closeMermaidFullscreen:"关闭 Mermaid 全屏"
zoomIn:"放大"
zoomOut:"缩小"
resetZoom:"重置缩放"
zoomPresets:"缩放比例"
zoomToFit:"适应屏幕"
mermaidFullscreenTitle:"Mermaid 图表"
```

### codeBlockLabels(匿名) — renderer.js @3828600

```
wrapOn:"开启代码换行"
wrapOff:"关闭代码换行"
expand:"展开代码"
collapse:"收起代码"
streaming:"生成中"
className:""
V1:`code.${F1}`
tone:"inherit"
style:"material"
```

### markdownImage/Table copy(匿名) — renderer.js @3835000

```
copyImage:"复制为图片"
copyMarkdown:"复制 Markdown"
copiedImage:"图片已复制"
copiedMarkdown:"Markdown 已复制"
copyImageFailed:"图片复制失败，重试"
copyMarkdownFailed:"Markdown 复制失败，重试"
phase:"idle"
phase:"copying"
phase:"copied"
phase:"failed"
className:"size-3.5"
className:"size-3.5"
className:"size-3.5"
"mr-2 w-[calc(100%-0.5rem)]":"w-full"
"mb-3 mt-5":"my-3"
className:"w-full min-w-0 max-w-full overflow-x-auto rounded-xl border border-border-quaternary bg-fill-secondary"
```

### linkFileActions(匿名) — renderer.js @3847100

```
backgroundColor:"var(--q4add82)"
color:"inherit"
textDecorationLine:"underline"
textDecorationColor:"var(--q48da17)"
textDecorationThickness:"2px"
openInBrowser:"在浏览器中打开"
openInExternalBrowser:"在外部浏览器中打开"
copyLink:"复制链接"
copied:"已复制"
previewLoading:"正在加载链接预览..."
previewUnavailable:"无法读取链接预览"
viewFileInSidebar:"在右侧栏查看"
viewFileInNewWindow:"新窗口查看"
openFile:"默认应用打开"
openWith:"打开方式"
openWithLoading:"正在加载应用..."
openWithNoApps:"没有可用应用"
openWithDefault:"默认"
copyPath:"复制路径"
copyFileContent:"复制文件内容"
revealFile:"在文件管理器中显示"
animation:"blurIn"
easing:"ease-out"
sep:"word"
http:"&&t1.protocol!=="
https:")return e1;const n1=t1.hostname?.replace(/^www\./,"
http:"&&r1.protocol!=="
https:"?null:r1.href}catch{return null}}function decodeUriComponentSafe$1(e1){try{return decodeURIComponent(e1)}catch{return e1}}function stripLocalLinkSuffix$1(e1){const t1=e1.indexOf("
```

### defaultLabels$2 (TerminalPanel) — renderer.js @2857000

```
panel:"终端面板"
tabs:"终端列表"
create:"新建终端"
close:"关闭终端面板"
exited:"已退出"
emptyTitle:"还没有终端"
emptyDescription:"在当前会话的工作目录中打开一个终端。"
errorTitle:"无法创建终端"
retry:"重试"
switchToDark:"切换为暗色终端"
switchToLight:"切换为亮色终端"
className:"text-[var(--qdd6e93)]"
className:"text-[var(--q716791)]"
role:"tablist"
className:"scroll-fade-x scroll-fade-[20px] flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
className:"flex shrink-0 items-center gap-1"
placement:"top"
variant:"ghost"
size:"sm"
placement:"top"
variant:"ghost"
size:"sm"
```

### DEFAULT_LABELS$3 (Layout) — renderer.js @2904000

```
collapseSidebar:"收起侧导航"
expandSidebar:"展开侧导航"
goBack:"后退"
goForward:"前进"
type:"button"
variant:"ghost"
size:"md"
className:"[-webkit-app-region:no-drag]"
position:"left"
className:"flex shrink-0 items-center [-webkit-app-region:no-drag]"
className:"flex w-[72px] shrink-0 items-center gap-2"
className:"size-3 rounded-full bg-error"
className:"size-3 rounded-full bg-warning"
className:"size-3 rounded-full bg-success"
className:"flex items-center gap-0.5 [-webkit-app-region:no-drag]"
placement:"bottom"
placement:"bottom"
type:"button"
variant:"ghost"
size:"md"
className:"[-webkit-app-region:no-drag]"
```

### defaultFileTreeLabels — renderer.js @2817400

```
"focus-visible:text-inherit":"focus-visible:text-text"
density:"default"
folderActivation:"toggle"
"text-[12px] leading-4":"text-[13px] leading-5"
role:"tree"
"p-2":"min-h-0 flex-1 p-0"
name:""
path:""
name:""
path:""
role:"group"
className:"qoder-file-tree-material-icon"
"size-3.5":"size-4"
tone:"inherit"
style:"material"
```

### SuggestionBanner defaults — renderer.js @2846300

```
d:"M12.667 8 10 12h4l-2.667 4"
initial:"normal"
"Content Safety Notice":"Free Wiki Generation Available"
"The input may contain sensitive content. Please revise it and try again.":`Generate ${r1} for this repository to boost AI agent with structured context.`
"text-error":"text-primary"
className:"size-4"
className:"text-primary"
type:"button"
```

### tagPill / collapse aria — renderer.js @1654300

```
"aria-label":`还有 ${a1} 个标签`
className:"relative size-10 shrink-0 overflow-hidden rounded-md bg-bg-container outline outline-1 -outline-offset-1 outline-black/8 dark:outline-white/8"
alt:""
className:"size-full object-cover"
className:"flex min-w-0 flex-1 flex-col gap-1"
className:"flex min-w-0 items-center gap-2"
className:"min-w-0 flex-1"
className:"min-w-0 flex-1"
"data-hover-card-list-label":""
className:"block min-w-0 max-w-full truncate text-[13px] leading-5 text-text"
className:"flex min-w-0 flex-1 flex-col gap-1"
className:"flex min-w-0 items-center gap-2"
className:"flex min-w-0 flex-1 items-center gap-1"
"data-hover-card-list-file-icon":""
className:"flex size-3 shrink-0 items-center justify-center"
"data-hover-card-list-file-path":""
className:"block min-w-0 flex-1 overflow-hidden text-left text-[11px] leading-4 text-ellipsis whitespace-nowrap text-text-secondary [direction:rtl]"
dir:"ltr"
"data-hover-card-list-label":""
className:"block min-w-0 max-w-full truncate text-[13px] leading-5 text-text"
```

## 附录 D：数值/字符串错误码目录（对话流内的服务端错误卡）

来源：`renderer.js` 内 `const error=JSON.parse(`{"101":…})`` @偏移 5056695（共 87 条）。
复核：`node scripts/../asar` 不必；直接 `grep -F '"101":{"title"' renderer.js`。

| 错误码 | 标题（zh） | 正文（zh） | 动作 | 出处 |
| --- | --- | --- | --- | --- |
| `101` | 请求验证失败 | 本次请求的签名校验未通过。请重试；如持续出现，请更新客户端或提交反馈。 | retry/primary:重试 |
| `102` | 请求时间校验失败 | 本次请求的时间校验未通过。请检查设备时间是否准确，更新客户端后重试。 | retry/primary:重试 |
| `103` | 请求重复 | 本次请求已被接收，请勿重复发送。若仍未获得回复，可稍后重试。 | retry/primary:重试 |
| `104` | 账户暂不可用 | 当前账户未获得试用额度或访问资格。请检查账户状态，或联系支持人员处理。 | retry/primary:重试 |
| `105` | 登录已过期 | 您的登录状态已过期，请重新登录以继续使用。 | relogin/primary:重新登录 |
| `107` | 当前网络无访问权限 | 当前网络 IP 不在组织允许的范围内。请切换到允许的网络，或联系管理员处理。 | retry/primary:重试 |
| `108` | 暂无可用许可证 | 当前账户未获得可用许可证。请联系管理员分配许可证后重试。 | retry/primary:重试 |
| `109` | 应用已被禁用 | 组织已禁用此应用。请联系管理员启用后重试。 | retry/primary:重试 |
| `110` | 今日额度已用尽 | 您今天的请求次数已达到上限，请明天再试。 | retry/primary:重试 |
| `111` | 可用额度已用尽 | 当前账户的可用额度已用尽。请检查额度状态，补充额度或等待额度恢复后重试。 | retry/primary:重试 |
| `112` | 配额已用尽 | 当前账户的可用 Credits 不足。请查看用量，补充额度或调整订阅计划后重试。 | openPricing/primary:升级订阅计划 |
| `113` | 当前请求受到使用限制 | 当前请求受到模型用量或访问频率限制。请稍后重试，或切换其他模型。 | retry/primary:重试 |
| `114` | 试用账户使用受限 | 当前设备的试用账户使用受到限制。请检查账户限制说明，或联系支持人员处理。 | retry/primary:重试 |
| `115` | 轻量模型月度额度已用尽 | 您已达到轻量模型的每月使用上限。升级订阅计划后可继续使用，也可以查看 FAQ 文档了解详情。 | openPricing/primary:升级订阅计划 |
| `116` | 配额已用尽 | 您已达到配额上限，将在下个订阅周期自动重置。可访问官网增购更多资源。 | openPricing/primary:增购更多资源 |
| `117` | 配额已用尽 | 您已达到配额上限，将在下个订阅周期自动重置。可联系管理员增购更多资源，或访问官网查看用量详情。 | openUsage/primary:查看用量详情 |
| `118` | 配额已用尽 | 当前账户的可用 Credits 不足。请查看用量，补充额度或调整订阅计划后重试。 | openPricing/primary:升级订阅计划 |
| `119` | 今日免费额度已用尽 | 您今天在当前免费模型上的可用额度已用尽，请明天再试。 | retry/primary:重试 |
| `120` | 账户数据已迁移 | 当前账户的数据已迁移，暂时无法通过当前入口继续使用。请联系支持人员确认新的访问方式。 | retry/primary:重试 |
| `121` | 组织数据已迁移 | 当前组织的数据已迁移，暂时无法通过当前入口继续使用。请联系管理员确认新的访问方式。 | retry/primary:重试 |
| `122` | 计费组额度已用尽 | 当前计费组的 Credits 已达到本账期限额。请联系管理员调整额度，或在下个账期重置后重试。 | retry/primary:重试 |
| `123` | 组织额度暂不可用 | 组织套餐升级期间暂时无法使用套餐额度，且资源包额度不足。请联系管理员确认升级状态或补充资源包额度后重试。 | retry/primary:重试 |
| `400` | 服务暂时出现异常 | 本次请求遇到系统或模型异常。请稍后重试；如持续出现，请提交反馈。 | retry/primary:重试 |
| `406` | 这个话题我暂时聊不了 | 新建任务换个话题继续吧~ | retry/primary:重试 |
| `409` | 需要更新客户端 | 当前版本已不支持此能力。请更新客户端后重试。 | retry/primary:重试 |
| `413` | 请求内容过大 | 本次请求的内容过大。请减少输入或附件大小，必要时分批处理后重试。 | retry/primary:重试 |
| `416` | 当前模型拒绝了本次请求 | 请尝试切换模型，或新建任务后重试。 | retry/primary:重试 |
| `422` | 回复传输异常 | 本次回复未能完整接收。请重试；如持续出现，请检查网络或提交反馈。 | retry/primary:重试 |
| `429` | 请求过于频繁 | 当前请求量较大，服务暂时限流。请稍后重试。 | retry/primary:重试 |
| `430` | 版本过低 | 当前版本暂不支持此能力，请升级到最新版本后重试。 | retry/primary:重试 |
| `500` | 系统发生异常 | 请重试。如问题持续存在，可点击右下角反馈按钮向我们报告。 | retry/primary:重试 |
| `10408` | 请求超时 | 本次请求超时，可能是网络波动或服务响应过慢导致。请稍后重试。 | retry/primary:重试 |
| `10500` | 服务内部处理错误 | 请稍后重试。如问题持续存在，可点击右下角反馈按钮向我们报告。 | retry/primary:重试 |
| `10605` | 模型负载较高 | 当前模型负载较高，请稍等片刻后重试，或切换到其他模型使用。 | switchModel/secondary:切换模型分级 · retry/primary:重试 |
| `47902` | 轮次已达上限 | 当前任务的轮次已达到上限。请新建任务，或缩小问题范围后重试。 | retry/primary:重试 |
| `47903` | 输出过长 | 本次回答因长度限制被中止，请缩小问题范围后重试。 | retry/primary:重试 |
| `47904` | 工具调用次数过多 | 本次任务的工具调用次数已达到上限。请缩小工作范围后重试。 | retry/primary:重试 |
| `48203` | 代理连接失败 | 当前网络代理配置无法建立连接，请检查本地代理设置后重试。 | retry/primary:重试 |
| `48712` | 当前模型不支持此能力 | 当前模型不支持执行该请求，请切换到其他模型后重试。 | retry/primary:重试 |
| `48713` | 暂无可用额度 | 您的免费账户暂无可用额度。如是新用户，请耐心等待试用 Credits 发放，预计耗时 3-5 分钟；如需立即使用或获得更多额度，可升级订阅计划。 | openPricing/primary:升级订阅计划 |
| `48715` | 当前仓库受策略限制 | 当前仓库触发了安全策略，暂不支持使用该模型。请切换到其他模型，或联系管理员确认策略。 | retry/primary:重试 |
| `48716` | 调用被 Hook 阻止 | 如需解除阻止，请检查并调整对应的 Hook 文件后重试。 | retry/primary:重试 |
| `80411` | 上下文过长 | 当前任务内容已超过模型可处理范围。请新建任务，或缩小问题范围后重试。 | retry/primary:重试 |
| `80412` | 媒体文件数量超出限制 | 单次请求中的媒体文件过多。请减少图片或文档数量，分批处理后重试。 | retry/primary:重试 |
| `90000` | 当前模型不支持图片 | 当前模型不支持图片输入，请切换到其他模型重试。 | retry/primary:重试 |
| `100400` | 自定义模型服务异常 | 自定义模型服务暂时不可用，请稍后重试，或切换到其他模型继续。 | retry/primary:重试 |
| `100401` | 自定义模型认证失败 | 自定义模型认证失败，请检查 API Key 或相关配置是否正确。 | retry/primary:重试 |
| `100403` | 当前套餐不支持自定义模型 | 当前套餐暂不支持使用自定义模型。请切换其他模型，或检查套餐权限后重试。 | retry/primary:重试 |
| `file_not_ready` | 文件尚未就绪，请稍后下载 | 文件尚未就绪，请稍后下载 |  |
| `file_not_uploaded` | 文件上传尚未完成 | 文件上传尚未完成 |  |
| `file_scan_failed` | 无法完成文件安全检查，暂时无法下载 | 无法完成文件安全检查，暂时无法下载 |  |
| `file_content_rejected` | 文件安全检查阻止下载 | 文件安全检查阻止下载 |  |
| `USER_PHONE_EMPTY` | 无法获取关联手机号 | 暂时无法获取使用外部模型所需的手机号。检查账号绑定信息后重试，或选择其他模型。 | retry/primary:重试 |
| `USER_PHONE_NOT_FOUND` | 无法获取关联手机号 | 暂时无法获取使用外部模型所需的手机号。检查账号绑定信息后重试，或选择其他模型。 | retry/primary:重试 |
| `EXTERNAL_TOKEN_TIMEOUT` | 外部模型服务暂不可用 | 暂时无法连接或使用该渠道的模型服务。稍后重试，或选择其他模型。 | retry/primary:重试 |
| `USER_PHONE_QUERY_FAILED` | 无法获取关联手机号 | 暂时无法获取使用外部模型所需的手机号。检查账号绑定信息后重试，或选择其他模型。 | retry/primary:重试 |
| `EXTERNAL_TOKEN_AUTH_FAILED` | 外部模型服务暂不可用 | 暂时无法连接或使用该渠道的模型服务。稍后重试，或选择其他模型。 | retry/primary:重试 |
| `EXTERNAL_TOKEN_UNAVAILABLE` | 外部模型服务暂不可用 | 暂时无法连接或使用该渠道的模型服务。稍后重试，或选择其他模型。 | retry/primary:重试 |
| `EXTERNAL_TOKEN_RATE_LIMITED` | 外部模型服务暂不可用 | 暂时无法连接或使用该渠道的模型服务。稍后重试，或选择其他模型。 | retry/primary:重试 |
| `EXTERNAL_MODEL_QUOTA_EXCEEDED` | 外部模型额度不足 | 外部模型可用额度不足，请购买或补充额度 | rechargeProvider/primary:前往充值 |
| `EXTERNAL_MODEL_PREPARATION_FAILED` | 当前外部模型不可用 | 检查对应渠道的启用与订阅状态后重试，或选择其他模型。 | retry/primary:重试 |
| `EXTERNAL_MODEL_USER_NOT_AVAILABLE` | 当前外部模型不可用 | 检查对应渠道的启用与订阅状态后重试，或选择其他模型。 | retry/primary:重试 |
| `speaking_banned` | 暂时无法发言 | 当前发言受到限制，内容已保留。限制解除后可重试。 |  |
| `content_rejected` | 消息未通过文本审核 | 文本未通过审核，消息未发布。内容已保留，可复制并修改后重新发送。 |  |
| `issue_execution_active` | 任务正在执行 | 当前有任务正在执行，请等待执行完成后重试。 |  |
| `project_archived` | 项目已归档 | 项目已归档，无法创建 Issue。请恢复项目后重试。 |  |
| `discussion_archived` | 讨论已归档 | 此讨论已归档，暂时仅可查看历史内容。 |  |
| `moderation_unavailable` | 文本审核暂不可用 | 文本审核暂不可用，消息未发布。内容已保留，可稍后重试。 | retry/primary:重试 |
| `invalid_request` | 请求不符合要求 | 请求不符合要求，请检查输入后重试。 |  |
| `invalid_query` | 上传请求无效 | 请更新客户端后重试。 |  |
| `member_capacity_exceeded` | 成员已达上限 | 当前协作空间的成员数量已达上限，请联系管理员后重试。 |  |
| `forbidden` | 没有操作权限 | 你没有执行此操作的权限，请确认项目或讨论的成员身份。 |  |
| `unauthorized` | 登录已失效 | 请重新登录后重试。 |  |
| `origin_not_allowed` | 当前环境无法上传 | 请检查服务环境配置或联系管理员。 |  |
| `body_too_large` | 上传内容过大 | 上传内容超过服务限制，请检查文件大小后重试。 |  |
| `unsupported_media_type` | 不支持该图片格式 | 请选择静态 PNG、JPEG、WebP 或 GIF 图片；不支持 APNG 和动画 WebP。 |  |
| `rate_limited` | 请求过于频繁 | 请稍后重试。 |  |
| `storage_unavailable` | 头像上传暂不可用 | 请稍后重试，原头像未更改。 |  |
| `not_ready` | 服务暂未就绪 | 请稍后重试。 |  |
| `internal_error` | 服务暂时出错 | 请稍后重试。 |  |
| `version_conflict` | 资料已被更新 | 请重新打开编辑页，核对最新资料后再修改。 |  |
| `organization_mismatch` | 组织不一致 | 当前账号或所选成员与资源所有者不属于同一组织，无法完成操作。 |  |
| `project_member_removed` | 无法通过链接重新加入项目 | 你此前已被移出此项目，请联系项目管理员重新邀请。 |  |
| `client_upgrade_required` | 请升级 Qoder 后加入 | 此邀请需要使用 Qoder 0.4.0 或更高版本。请升级后重新打开邀请链接。 |  |
| `organization_unavailable` | 暂时无法确认组织信息 | 暂时无法确认成员的组织信息，请稍后重试。 |  |
| `not_found` | 资料不存在或不可访问 | 请刷新资料并检查当前账号。 |  |
| `file_type_not_supported` | 不支持此文件类型 | 不支持此文件类型。请选择其他类型的文件。 |  |

## 附录 E：协作/文件/执行错误目录（第二本）

来源：`renderer.js` 内 `const error$1=JSON.parse(`{"TEAM_PROFILE_BUSY":…})`` @偏移 5031042（共 72 条）。

| 错误码 | 标题（zh） | 正文（zh） | 动作 |
| --- | --- | --- | --- |
| `TEAM_PROFILE_BUSY` | 团队正在更新 | 请稍后重试。 |  |
| `TEAM_ARCHIVED` | 团队已归档 | 请先在团队设置的“已归档”列表中恢复此团队。 |  |
| `AGENT_CONFIGURATION_ARCHIVED` | Agent 已归档 | 请先在 Agent 设置的“已归档”列表中恢复此 Agent。 |  |
| `BUILTIN_AGENT_ARCHIVE_FORBIDDEN` | 无法归档默认 Qoder | 默认 Qoder 始终保留，不能归档。 |  |
| `FILE_UPLOAD_INCOMPLETE` | 文件上传尚未完成 | 文件上传尚未完成 |  |
| `FILE_SCAN_PENDING` | 文件等待安全检查，请稍后下载 | 文件等待安全检查，请稍后下载 |  |
| `FILE_SCAN_PROCESSING` | 文件安全检查中，请稍后下载 | 文件安全检查中，请稍后下载 |  |
| `FILE_CONTENT_REJECTED` | 文件未通过安全检查，无法下载 | 文件未通过安全检查，无法下载 |  |
| `FILE_SCAN_FAILED` | 文件安全检查失败，暂时无法下载 | 文件安全检查失败，暂时无法下载 |  |
| `FILE_SCAN_TIMEOUT` | 文件安全检查超时，暂时无法下载 | 文件安全检查超时，暂时无法下载 |  |
| `FILE_SCAN_UNSUPPORTED` | 暂不支持对此类文件进行安全检查，无法下载 | 暂不支持对此类文件进行安全检查，无法下载 |  |
| `FILE_SCAN_UNSCANNABLE` | 无法完成文件安全检查，无法下载 | 无法完成文件安全检查，无法下载 |  |
| `FILE_GET_FAILED` | 无法获取文件 | 未取得可读取的文件，原因尚未确认。请如实说明未读到附件，不推断权限或网络故障。 |  |
| `FILE_AUTH_REQUIRED` | 协作身份已失效 | 等待宿主恢复有效的 Agent 身份后重新获取文件，不尝试其他身份或索取凭据。 |  |
| `FILE_UNAVAILABLE` | 文件不存在或无法访问 | 请用户确认文件仍在已发布消息或项目内容中，以及当前 Agent 的访问权限。不要尝试其他身份。 |  |
| `FILE_NOT_READY` | 文件尚未就绪 | 文件仍在上传或检查中，目前无法读取。稍后按需重试，不要连续轮询。 |  |
| `FILE_SCAN_BLOCKED` | 文件检查阻止下载 | 请用户提供可用文件，不绕过文件检查。 |  |
| `FILE_RATE_LIMITED` | 文件请求过于频繁 | 稍后再获取文件，避免立即重复调用。 |  |
| `FILE_DOWNLOAD_FAILED` | 文件暂时下载失败 | 本次未取得可读取的文件。稍后有限重试，不将网络或服务故障解释为没有权限。 |  |
| `FILE_INTEGRITY_FAILED` | 文件完整性校验失败 | 不要使用本次不完整文件。可有限重试下载，持续失败时如实告知用户。 |  |
| `FILE_DISK_SPACE` | 本地缓存空间不足 | 请用户释放本机磁盘空间后重新获取文件。 |  |
| `FILE_STORAGE_INVALID` | 无法写入或访问文件缓存 | 请用户检查本机文件访问权限；修复前不要重复下载。 |  |
| `FILE_SIZE_LIMIT` | 文件超过支持的大小 | 支持 1 至 50,000,000 字节的文件。请用户提供符合大小限制的文件，不截断原文件。 |  |
| `FILE_LOCAL_EXECUTION_REQUIRED` | 当前执行环境不支持获取附件 | 首期仅支持本机执行。告知用户当前限制，不使用本机路径冒充远端文件路径。 |  |
| `FILE_BACKEND_UNAVAILABLE` | 当前环境未提供文件获取能力 | 告知用户当前环境暂不支持获取协作附件，不切换认证主体绕过限制。 |  |
| `FILE_INVALID_ID` | 文件标识无效 | 从消息或资源查询结果获取真实 fileId，不猜测标识。 |  |
| `FILE_IDENTITY_CHANGED` | 文件获取期间身份已切换 | 当前获取已停止。等待宿主确认新身份后重新获取。 |  |
| `WORKSPACE_ADDITIONAL_DIRECTORY_UNAVAILABLE` | 无法添加文件夹 | 无法读取或进入所选文件夹。检查文件夹权限后重试，或选择其他文件夹。 |  |
| `AGENT_TOOL_RULE_CONFLICT` | 工具规则冲突 | 同一工具规则不能同时在允许和禁止列表中。请从其中一侧移除重复规则。 |  |
| `AUTH_NETWORK` | 无法连接登录服务 | 无法连接登录服务，请检查网络后重试。 |  |
| `LOGIN_TIMEOUT` | 登录超时 | 登录等待已超时，请重新发起登录。 |  |
| `BROWSER_OPEN_FAILED` | 无法打开浏览器 | 无法打开系统默认浏览器。请检查默认浏览器设置，或复制登录链接继续。 |  |
| `AUTH_SERVER_ERROR` | 服务暂不可用 | 服务暂时无法完成请求，请稍后重试。 |  |
| `AUTH_UNAUTHORIZED` | 登录已失效 | 登录凭证已失效，请重新登录。 |  |
| `AUTH_LOGIN_FAILED` | 登录未完成 | 登录未完成，请重试。 |  |
| `CHAT_ATTACHMENT_LIMIT_EXCEEDED` | 附件数量超限 | 最多只支持 20 个附件。 |  |
| `CHAT_SESSION_WORKSPACE_UNAVAILABLE` | 工作区不可用 | 当前任务绑定的工作区已移动、删除或无法访问，无法继续执行。请在有效工作区中新建任务。 | startNewTask/primary:新建任务 |
| `CHAT_SESSION_HISTORY_MISSING` | 会话历史缺失 | 此会话的执行历史文件不存在，暂时无法继续。已有消息会保留；请恢复历史文件后重试，或新建任务。新任务不会自动继承旧上下文。 | startNewTask/primary:新建任务 |
| `CHAT_SESSION_OPERATION_FAILED` | 这轮回复失败 | 发生了意外错误，请重试。如问题持续存在，可尝试新建任务。 | retry/primary:重试 |
| `QODER_EXECUTION_CONTROL_FAILED` | 这轮回复失败 | 执行服务暂时无法完成本轮操作，请重试。如问题持续存在，请点击右下角的反馈按钮向我们报告。 | retry/primary:重试 |
| `QODER_EXECUTION_CONTROL_PREPARATION_FAILED` | 这轮回复失败 | 执行服务暂时无法完成本轮操作，请重试。如问题持续存在，请点击右下角的反馈按钮向我们报告。 | retry/primary:重试 |
| `QODER_EXECUTION_SEND_FAILED` | 这轮回复失败 | 本轮请求未能完成发送。重试后将继续使用原输入。 | retry/primary:重试 |
| `QODER_EXECUTION_STREAM_ENDED` | 这轮回复失败 | 回复尚未完成，执行连接已结束。已有内容会保留，可重试本轮请求。 | retry/primary:重试 |
| `QODER_EXECUTION_STREAM_FAILED` | 这轮回复失败 | 执行连接发生异常，本轮回复未能完成。已有内容会保留，可重试本轮请求。 | retry/primary:重试 |
| `QODER_EXECUTION_NO_RESPONSE` | 这轮回复失败 | 由于 180 秒内未生成任何回复，会话已关闭。 | retry/primary:重试 |
| `MCP_CAPABILITY_REVOKED` | 这轮回复失败 | 本轮使用的 MCP 能力已被停用或撤销。检查连接状态后重试。 | retry/primary:重试 |
| `BYOK_EXECUTION_UNSUPPORTED` | 这轮回复失败 | 个人模型仅支持本机内置 Qoder Runtime。请选择其他 Runtime 或模型后重试。 | retry/primary:重试 |
| `BYOK_SERVICE_UNAVAILABLE` | 这轮回复失败 | 个人模型服务暂时不可用。请重启 Qoder 后重试。 | retry/primary:重试 |
| `BYOK_PROFILE_NOT_FOUND` | 这轮回复失败 | 这个个人模型已被删除或不再属于当前账号。请选择其他模型后重试。 | retry/primary:重试 |
| `BYOK_SELECTION_KEY_INVALID` | 这轮回复失败 | 这个个人模型已被删除或不再属于当前账号。请选择其他模型后重试。 | retry/primary:重试 |
| `BYOK_SIGNED_OUT` | 这轮回复失败 | 登录 Qoder 后才能使用个人模型。 | retry/primary:重试 |
| `BYOK_ACCOUNT_CHANGED` | 这轮回复失败 | 账号已切换。请重新选择当前账号下的个人模型。 | retry/primary:重试 |
| `BYOK_SECURE_STORAGE_UNAVAILABLE` | 这轮回复失败 | 系统安全存储不可用，无法读取个人模型的 API Key。 | retry/primary:重试 |
| `BYOK_CREDENTIAL_UNAVAILABLE` | 这轮回复失败 | 这个个人模型的 API Key 无法读取。请在设置中重新配置 Key。 | retry/primary:重试 |
| `BYOK_PROVIDER_UNSUPPORTED` | 这轮回复失败 | 这个 Provider 或模型已不在当前 Qoder CLI 目录中。请选择其他模型。 | retry/primary:重试 |
| `BYOK_CATALOG_LOAD_FAILED` | 这轮回复失败 | 暂时无法校验个人模型目录。请检查网络后重试。 | retry/primary:重试 |
| `BYOK_CATALOG_UNSUPPORTED` | 这轮回复失败 | 暂时无法校验个人模型目录。请检查网络后重试。 | retry/primary:重试 |
| `BYOK_PROVIDER_REQUEST_FAILED` | 这轮回复失败 | Provider 请求失败。API Key 和原始错误详情已被隐藏，请检查个人模型配置后重试。 | retry/primary:重试 |
| `BYOK_UNAVAILABLE` | 这轮回复失败 | 个人模型暂时不可用。请在设置中检查配置后重试。 | retry/primary:重试 |
| `BYOK_AUTHENTICATION_FAILED` | 这轮回复失败 | 个人模型认证失败。检查模型设置中的 API Key 后重试。 | retry/primary:重试 |
| `CHAT_SESSION_INPUT_NOT_DELIVERED` | 消息尚未发送 | 这条消息未能发送，原输入已保留。请重新发送。 | retry/primary:重新发送 |
| `CHAT_SESSION_AGENT_RUNTIME_UNAVAILABLE` | Agent 暂不可用 | 当前 Agent 的本机配置或 Runtime 不可用。请检查 Agent 设置后重新发送。 | retry/primary:重新发送 |
| `CHAT_SESSION_RUNTIME_RECONCILE_TIMEOUT` | 消息尚未发送 | 发送准备超时，这条消息尚未发送。原输入已保留，请稍后重新发送。 | retry/primary:重新发送 |
| `CHAT_SESSION_RUNTIME_RELEASE_PENDING` | 消息尚未发送 | 执行连接仍在关闭，这条消息尚未发送。请稍后重新发送。 | retry/primary:重新发送 |
| `CHAT_SESSION_RUNTIME_RELEASE_FAILED` | 消息尚未发送 | 执行连接未能正常关闭，这条消息尚未发送。请重新启动应用后再发送。 |  |
| `CHAT_SESSION_INPUT_RESULT_UNKNOWN` | 消息发送状态待确认 | 暂时无法确认这条消息是否已发送。请先查看会话中的运行状态和回复，确认未发送后再重试。 |  |
| `QODER_EXECUTION_NETWORK_UNAVAILABLE` | 无法连接执行服务 | 无法建立网络连接。请检查网络；如使用代理，也请确认代理配置及服务正常，然后重试。 | retry/primary:重试 |
| `AVATAR_UNAVAILABLE` | 头像更新失败 | 头像更新失败，请检查网络后重试。 |  |
| `AVATAR_LOGIN_REQUIRED` | 头像更新失败 | 请登录后再更新头像。 |  |
| `AVATAR_IDENTITY_CHANGED` | 头像更新失败 | 账号或服务环境已变化，请重新打开编辑页。 |  |
| `AVATAR_BUSY` | 头像更新失败 | 头像正在更新，请稍后重试。 |  |
| `AVATAR_INVALID_INPUT` | 头像更新失败 | 请选择有效的图片，最大 256 KiB。 |  |

## 附录 F：`dynamic-text.json`（服务端可下发的模型名与说明，中英对照）

来源：asar 内 `/out/.../dynamic-text.json`，本地副本 `qoder/dynamic-text.json`（zh 段 51 键 / en 段 51 键）。

| 档位/模型名（zh label） | 说明（zh detail/description） | 出处 |
| --- | --- | --- |
| Auto | 智能选择最适合的模型，平衡性能与成本 | `model.auto.label` @ dynamic-text.json |
| 轻量 | 基础推理能力，免费使用（高峰期可能响应较慢） | `model.lite.label` @ dynamic-text.json |
| Cantus | 尝鲜体验全球顶级模型，擅长超长自主任务执行 | `model.cmodel.label` @ dynamic-text.json |
| DeepSeek-V4-Pro | 深度求索正式版模型（DeepSeek-V4-Pro-0813），Agent 能力、世界知识与推理性能全面领先。 | `model.dmodel.label` @ dynamic-text.json |
| GLM-5.3 | 智谱旗舰模型，擅长复杂系统工程与长程任务 | `model.gmodel.label` @ dynamic-text.json |
| Kimi-K2.7-Code | 专为长上下文编程打造：精准遵循指令，可靠执行长链路任务 | `model.kmodel.label` @ dynamic-text.json |
| MiniMax-M3 | 原生多模态感知、前沿编码能力与 1M 上下文，驾驭高复杂度工作流 | `model.mmodel.label` @ dynamic-text.json |
| Qwen3.7-Plus | 千问旗舰模型，增强推理和智能体能力，擅长编程与复杂问题解决 | `model.qmodel.label` @ dynamic-text.json |
| DeepSeek-V4-Flash | 深度求索正式版模型（DeepSeek-V4-Flash-0731），Agent 能力、世界知识与推理性能全面领先。 | `model.dfmodel.label` @ dynamic-text.json |
| GLM-5.3-Flash | 智谱全新原生多模态模型，深度理解图像与视频，自主完成研究分析、文档制作等复杂任务 | `model.gfmodel.label` @ dynamic-text.json |
| Qwen3.8-Flash | 千问开源权重的多模态 MoE 模型，在能力、延迟与成本间取得出色平衡 | `model.qfmodel.label` @ dynamic-text.json |
| 极致 | 专家级深度推理与思考能力，极致输出质量。 | `model.ultimate.label` @ dynamic-text.json |
| 经济 | 标准推理能力，高性价比 | `model.efficient.label` @ dynamic-text.json |
| 性能 | 高级推理能力，高质量输出 | `model.performance.label` @ dynamic-text.json |
| Qwen3.8-Max | 千问最新一代基座模型，2.4 万亿参数，在代码工程、专业办公、深度推理等核心场景全面领先 | `model.qmodel_38max.label` @ dynamic-text.json |
| Kimi-K3 | Kimi 迄今最强模型：2.8 万亿参数，面向软件工程、知识工作与深度推理而生 | `model.kmodel_latest.label` @ dynamic-text.json |
| Qwen3.7-Max | 千问旗舰模型，具备顶尖智能体执行能力，可自主完成长达 35 小时的复杂任务 | `model.qmodel_latest.label` @ dynamic-text.json |

## 附录 G：结构性证据（非文案）

- **数据域（`useDataSnapshot("…")` 实参）**：`work` / `execution` / `attention` / `agent` / `runtime` / `collaboration` / `updates` —— 对话流的状态就是这 7 个域。
- **事件/类型字面量出现次数**（`grep -oE '"…"' renderer.js | uniq -c`）：`"thinking"` 25 / `"tool_use"` 1 / `"tool_result"` 1 / `"thinking_block"` 1 / `"subagent_tool"` 1 / `"permission_decision"` 3 / `"permission_denied"` 1 / `"turn_created"` 1 / `"session_menu"` 3 / `"session_migration"` 1 / `"reasoning"` 1。
- **`data-slot` 组件名**（共 78 个，摘对话流相关）：`discussion-own-bubble` / `discussion-other-bubble` / `discussion-bubble-markers` / `discussion-key-message-mark` / `message-reaction-summary` / `image-generation` / `chat-input-suggestion-menu-icon` / `chat-input-action-menu-trigger`(data-testid) / `artifact-preview-*`（8 个）/ `user-question-*`（6 个：collapsed-title / expanded-title / disclosure-content / option-leading / footer-action / transition-page）/ `settings-item*` / `input-group*`。
- **语义 className（对话流骨架）**：`chat-workspace`（5）/ `chat-composer-home-surface` / `chat-prompt-workspace` / `context-card`（3）/ `context-card-shell` / `thinking-dot-matrix`（2）/ `file-card`（2）/ `file-tree-virtual-row` / `file-tree-material-icon` / `attachment-thumbnail` / `diff-insert` / `permission-alert-breathe` / `scroll-fa…`。
- **状态图标（`@ali/qoder-icon` v0.1.33，Remix 风格 Line/Fill 命名，从 icon-candidates.txt 量出）**：运行态 `QoderLoaderLine` / `QoderLoader2Line` / `QoderLoader3Line` / `QoderLoader4Line` / `QoderLogoLoader` / `thinking-dot-matrix`；成功 `QoderCheckLine` / `QoderCheckFill` / `QoderCheckDoubleLine` / `QoderCheckboxCircleFill` / `QoderCheckboxCircleLine` / `QoderFileCheckLine` / `QoderChatCheckFill`；失败/告警 `QoderErrorWarningLine` / `QoderErrorWarningFill` / `QoderCloseCircleLine` / `QoderCloseCircleFill`；取消/停止 `QoderStopLine` / `QoderStopFill` / `QoderStopCircleLine` / `QoderStopCircleFill` / `QoderPauseLine` / `QoderPauseCircleLine`；空圈 `QoderCircleLine` / `QoderCheckboxBlankCircleLine` / `QoderSquareLine`；进度 `QoderProgress4Line`；Git `QoderGitBranchLine` / `QoderGitBranchChangesLine` / `QoderGitBranchStagedChangesLine` / `QoderGitCommitLine` / `QoderGitForkLine` / `QoderGitPullRequestLine`；记忆/思考 `QoderBrainLine` / `QoderBrainFill` / `QoderBrain2Fill` / `QoderBrain3Fill` / `QoderBrain4Fill` / `QoderBrainAi3Line`；待办 `QoderListCheck3`；时间 `QoderMapPinTimeFill`；计费 `QoderMoneyCnyCircleFill` / `QoderMoneyDollarCircleFill` / `QoderMoneyEuroCircleFill` / `QoderMoneyPoundCircleFill`；安全 `QoderShieldCheckLine` / `QoderShieldCheckFill`；录制 `QoderRecordCircleLine`。
- **LaTeX**：bundle 内含 `katex`（27 处标识）与 `mathml`（179 处），**但没有任何面向用户的公式块文案**（`grep -inE "latex|katex|公式"` 在 zh 语言包 0 命中）⇒ 判定"能渲染、无控件文案"。
- **图表**：除 Mermaid 外**无独立图表 UI**（`grep -cE "echarts|Chart\.js"` → 0）；表格走 `chatSession.markdownTable.*` 一套（复制为图片 / 复制 Markdown）。
- **@ 触发正则**（`renderer.js` @16426984 附近 `readComposerSuggestionQuery`）：`/(?:^|\s)([@/、])([^\s]*)$/` —— 触发符是 `@`、`/`、`、` 三个，`/`与`、`归为 slash 通道（`composerSlashTriggerAliases = new Set(["/","、"])`）。
- **附件上限常量**：20（`composer.actions.attachmentLimitReached` / `chatSession.messageActions.attachmentLimitReached` / `browserSurface.contextFull` / `chatActivity.imageGeneration.contextLimitReached` 四处同值，措辞不同）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
