<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Trae CN / TRAE SOLO CN — AI 对话流程「用户可见面」穷举清单

> 全部条目来自本机已安装程序文件的**只读取证**，不做推断。缺证据的条目明写「未取证到」。
> 格式：`<元素/状态> — 原文 — 出处(文件:字面量)`

## 0. 取证物与版本（报告必写版本）

| 产品 | 版本 | 出处 |
|---|---|---|
| Trae CN | `appVersion 3.3.104` / `tronBuildVersion 2.3.87416` / quality stable / win32-x64 | `G:\Trae CN\Trae CN\resources\app\product.json:"appVersion": "3.3.104"` |
| TRAE SOLO CN | `appVersion 0.1.69` / `tronBuildVersion 2.3.87413` / win32-x64，`win32ShellNameShort "TRAE Work"` | `G:\TRAE SOLO CN\resources\app\product.json:"appVersion": "0.1.69"` |
| 两者共用 `dataFolderName` | `.trae-cn` | `product.json:"dataFolderName"` |

**关键结构事实（决定了后面所有取证的落点）**：

- 目录形态是解包的 `resources/app/`，`node_modules.asar` 仅 **28 字节**（占位，非真 asar）— 出处 `G:\Trae CN\Trae CN\resources\app\node_modules.asar` 文件尺寸。未动用 `asar-read.mjs`。
- **对话流 UI 不在 VS Code 的 workbench bundle 里**：`out/vs/workbench/workbench.desktop.main.js` 对 `深度思考 / 自动运行 / shellSandbox / Fork Chat` 四串**全部 0 命中**（实测 grep 计数）。真正的对话流实现是 npm 包 `@byted-icube/ai-modules-chat`。
- **两个安装的产品包是同一份字节**：`ai-modules-chat/dist/index.mjs` 两侧 md5 **相同** = `2a57dccf422a0165507cc4b8f9598452`（实测 md5sum），`dist` 均为 43 个 `.mjs`。⇒ 下面所有对话流条目**同时适用于 Trae CN 与 TRAE SOLO CN**，除非明写 solo 前缀键。
- 中文文案不是散落在组件里，而是**两份内嵌 JSON 语言包**：
  - `ai-modules-chat/dist/273.ed2ca7ce.mjs` = **简体中文 map**（`JSON.parse('{"key":"中文",…}')`）
  - `ai-modules-chat/dist/index.mjs` = 英文/默认 map（14.6 MB 主包）
  - 抽取后去重得 **11,065 个唯一键**，其中 **10,861 条值为中文**（实测计数）。
- 另一条独立文案面（VS Code 底座，非 Trae 对话流）：`out/nls.zh-cn.messages.json`（数组 18,202 条，与 `nls.keys.json` 逐位对齐）。

| 缩写 | 实际路径 |
|---|---|
| CHAT | `…\resources\app\node_modules\@byted-icube\ai-modules-chat\dist\index.mjs` |
| L10N | `…\dist\273.ed2ca7ce.mjs` |
| WB | `…\resources\app\out\vs\workbench\workbench.desktop.main.js` |
| NLS | `…\resources\app\out\nls.zh-cn.messages.json` |
| DLL | `…\resources\app\modules\ai-agent\ai_agent.dll` |
| SBX | `…\resources\app\modules\sandbox\` |

---

## 1. 消息气泡与内容块

| 元素/状态 | 原文 | 出处 |
|---|---|---|
| 助手轮底部免责声明 | `由 AI 生成` | L10N:`trae-chat-core.latest-assistant-bar.ai-disclaimer` |
| 轮次状态·完成 | `任务完成` | L10N:`trae-chat-core.latest-assistant-bar.status.completed` |
| 轮次状态·取消 | `手动终止输出` | `…latest-assistant-bar.status.canceled` |
| 轮次状态·异常 | `异常打断` | `…latest-assistant-bar.status.error` |
| 轮次状态·被新请求顶替 | `已切换到新请求` | `…latest-assistant-bar.status.interjected` |
| 轮次状态·被外部停止 | `Stopped by`（**未翻译，英文原样**） | `…latest-assistant-bar.status.stopped-by` |
| 轮次耗时条 | `任务耗时 ` （尾带空格） | `…latest-assistant-bar.worked-for` |
| 轮次内动作标签·代码变更 | `代码变更` | `…latest-assistant-bar.query-diff` |
| 轮次内动作标签·设置 | `设置` | `…latest-assistant-bar.hooks.settings` |
| 工具调用折叠组总标题 | `调用工具` / 进行时 `正在调用工具…` | `trae-chat-core.exploreGroup.title` / `.titleExploring` |
| 思考折叠组标题 | `思考中` / `正在思考…` / 完成态 `思考过程` | `exploreGroup.titleThinking` / `.thinking.running` / `.thinking.completed` |
| 等待用户 | `等待你的回复…` | `exploreGroup.waitingResponse` |
| 动态 UI（内容块类型名） | `动态 UI` | L10N:`ai.model.dynamic_ui` |
| 动态 UI 开关（设置项） | `动态 UI` | `icube.dynamic_ui.settings.title` / `.enable` |
| Widget 生成中 | `生成中` | `ai.widget.generatingStyles` |
| Widget 复制为图片 | `复制为图片` / `复制中...` / `图片已复制到剪贴板` / `复制图片失败` | `ai.widget.copyAsImage` / `.copying` / `.imageCopied` / `.copyFailed` |
| Widget 导出失败 | `导出失败` | `ai.widget.exportFailed` |
| Widget 在面板打开 | `在面板打开` | `ai.widget.openInPanel` |
| Mermaid | **未取证到**（`dist/*.mjs` 与 L10N 中未检索到 Mermaid 文案键；仅存在扩展 `extensions/mermaid-chat-features` 目录名，属 VS Code 上游插件而非 Trae 对话流文案） | — |
| 图表模板白名单（具体清单） | **未取证到**（只拿到"动态 UI"这一档名与 widget 操作项，未拿到被允许渲染的模板名枚举） | — |
| 产物（Artifacts）内容块 | 面板条目：`生成物一覧` / `本轮文件变更` / `在面板打开` / `在浏览器中打开` | `trae-chat-core.tool-card.artifacts` / `.artifacts-round` / `.open-in-panel` / `.open-in-browser` |
| 产物空间操作 | `打开详情` `打开任务` `置顶` `取消置顶` `删除产物` | L10N:`artifacts.action.*`、`artifacts.delete.confirmTitle` |
| 产物删除风险原文 | `此操作会将该产物从产物空间中移除，且不可恢复；但不会删除任务工作目录中的真实工作文件。` | `artifacts.delete.confirmContent` |
| 产物预览状态族 | `正在转换预览...` `预览转换失败` `预览不可用` `预览服务加载失败` `此文件过大，暂不支持在线预览。` `无效文件` | `artifacts.detail.state.*` |
| HTML/网页预览块 | `预览 Web 页面` | `trae-chat-core.tool-card.preview-web-page` |
| 框选区域评论（网页元素级内容块） | `框选区域评论` / `选择页面元素，添加评论让 AI 帮你修改，或手动调整字体、样式和布局。` | `trae-chat-core.htmlEditOnboarding.frameSelection.title` / `.htmlEditing.description` |
| 评论卡加入对话 | `添加到对话` / `已添加到对话！` | `previewCommentCard.addToChat` / `.addedToChat` |
| Figma 选区内容块 | `选择 Figma 图并添加到对话` | `select_frame_intro` |
| 飞书/Lark 文档块降级标题 | `飞书文档` / `Lark 文档` | `trae-chat-core.tool-card.feishu-doc-fallback-title` / `.lark-doc-fallback-title` |

---

## 2. 深度思考展示

| 元素/状态 | 原文 | 出处 |
|---|---|---|
| 折叠态标题（进行中） | `正在思考…` | L10N:`trae-chat-core.exploreGroup.thinking.running` |
| 折叠态标题（完成） | `思考过程` | `…exploreGroup.thinking.completed` |
| 思考组标签 | `思考中` | `…exploreGroup.titleThinking`；另 `ai_thinking`/`AI thinking`/`Thinking` 均 = `思考中`，`Thinking...` = `思考中...` |
| 思考过程标题（概览面板） | `思考过程` | `overview_thinking_title`；`ai_ref.ai_thinking_process` = `思考过程` |
| 推理过程标签 | `推理过程` | `Reasoning Process` |
| 推理中（短态） | `推理中` | `ai_reasoning` |
| 思考强度档位标题 | `思考强度` | `ai.model.reasoning_effort.title` / `trae-chat-core.model.reasoning_effort.title` / `ai.configModel.reasoning.tooltip.0`=`推理` |
| 思考强度档位值 | `轻` `高` `极高` `最高` `軽` | `…reasoning_effort.light/high/extra_high/xhigh`；`external.*` 同族；`low`=`轻`（一处为日文字形 `軽`） |
| 思考模式开关说明（全文） | `控制模型回答前是否进行推理。开启可提升复杂问题的回答质量，但会增加耗时与 token 消耗。「跟随模型默认配置」则沿用模型厂商默认设置。` | `ai.settings.model.thinking_mode.tooltip`（标题 `ai.settings.model.thinking_mode`=`思考模式`） |
| 「使用了 N 个引用」形态 | 实际原文是 **`参考了 {0} 个上下文`**（单复数同串） | L10N:`usedReferencesSingular` / `usedReferencesPlural` |
| 「使用了 N 次某工具」折叠计数形态 | `使用了 {count} 次电脑控制` | `exploreGroup.computerUse.completed` |
| 引用语义（另一处） | `相关引用` | `chat_suggest.tips.reference` / `solo.chat_suggest.tips.reference`；`Quote` = `引用` |
| 参考信息面板 | `参考信息` / `任务执行过程中调用的技能和参考的网页将展示在这里` / `暂无参考信息` | `solo-web.statusPanel.references*` |
| 反馈理由（思考相关） | `思考过程太长` | `chat_feedback_reason_overly_long_reasoning` / `trae-chat-core.feedback.reason.long-reasoning` |

---

## 3. 工具 / 命令卡片

### 3a. 卡片通用字段与状态

| 元素/状态 | 原文 | 出处 |
|---|---|---|
| 字段标签·工具 | `工具：` | L10N:`trae-chat-core.tool-card.tool-label` |
| 字段标签·参数 | `参数：` | `…tool-card.params-label` |
| 字段标签·结果 | `结果（{status}）：` | `…tool-card.result-label` |
| 未知工具 | `未知工具` | `…tool-card.unknown-tool` |
| 状态·失败 | `失败` | `…tool-card.failed` |
| 状态·已取消 | `已取消` | `…tool-card.canceled` |
| 状态·已执行 | `已执行` | `…tool-card.executed` |
| 状态·已跳过 | `已跳过` / `跳过` | `…tool-card.skipped` / `.skip` |
| 状态·加载中 | `加载中...` | `…tool-card.loading` |
| 状态·生成中 | `生成中...` / `生成失败` | `…tool-card.generating` / `.generation-failed` |
| 状态·搜索中 | `搜索中...` / `搜索失败` | `…tool-card.searching` / `.search-failed` |
| 状态·自动审批中 | `自动审批中` | `…tool-card.auto-reviewing` |
| 状态·冲突 | `冲突` / `（{count} 个有冲突）` | `…tool-card.conflict` / `.with-conflict` / `.with-conflicts` |
| 按钮 | `运行` `执行` `确认` `取消` `提交` `查看` `拒绝执行` `跳过` | `…tool-card.run/execute/confirm/cancel/submit/view/deny/skip` |
| 结果计数形态 | `{count} 个结果` / `找到 {count} 个 {keywords} 的结果` / `找到 {match_files} 个文件` / `找到 {match_lines} 行` / `在 {match_files} 个文件中找到 {match_occurrences} 处匹配` / `无结果` / `未找到结果` / `未找到 {keywords} 的结果` | `…tool-card.result-count*`、`.found-*`、`.no-results*` |
| 工作区搜索 | `搜索工作区` / `在工作区中搜索 {keywords}` / `工作区搜索失败` | `…tool-card.search-codebase*` |
| 读取文件 | `正在读取文件...` / `读取失败` | `…tool-card.reading-files` / `.read-failed` |
| 调用技能 | `调用技能：` | `…tool-card.launched-skill` / `.launching-skill` |
| 技能推荐 | `正在为您推荐技能...` / `正在搜索技能…` / `技能搜索完成` / `找到 {count} 个推荐技能。` / `未找到匹配的技能。` | `…tool-card.skill-recommend.*` |
| 控制台日志检查 | `正在检查控制台日志: {url}` | `…tool-card.checking-console-log` |

### 3b. 「自动运行」下拉三档原文（同一控件）

| 档 | 原文 | 出处 |
|---|---|---|
| 档 1 | `自动运行` | L10N:`trae-chat-core.tool-card.auto-run`（另 `Auto-run` 同值） |
| 档 2 | `手动运行` | `…tool-card.manual-run` |
| 档 3 | `白名单运行` | `…tool-card.allowlist` |
| 审批粒度（另一组三档） | `仅本次运行` / `本次会话允许` / `始终允许` | `…tool-card.runOnce` / `.runSession` / `.runAlways` |
| 白名单追加形态 | `添加 {commands} 到白名单` / `添加 +{count} 到白名单` | `…tool-card.add-to-allowlist` / `.add-count-to-allowlist` |
| 风险命令加白确认 | 标题 `添加风险命令到白名单`；正文 `以下命令风险较高，添加到白名单后会自动运行，使用风险需自行承担。是否仍要添加？`；按钮 `确认添加` / `取消` | `…tool-card.allowlist-confirm.*` |
| 高风险命令提示 | `检测到高风险命令 {commands}，执行可能导致严重后果，请仔细确认。` | `…tool-card.dangerousCommand` |
| 自定义规则命中 | `命令匹配自定义规则 {commands}，请确认后继续` | `…tool-card.commandRuleAsk` |
| 规则回落提示 | `请检查您的规则或确认手动执行。` | `…tool-card.review-rules` |
| 命令授权询问 | `是否允许运行这个命令？` | `…tool-card.allowRunCommand` |
| 执行确认 | `确认执行` | `…tool-card.confirm-execution` |

### 3c. 审批卡片文案（工具执行前）

| 元素 | 原文 | 出处 |
|---|---|---|
| 沙箱位置标记 | `在沙箱中` / `在沙箱外` | `…tool-card.in-sandbox` / `.outsize` 实为 `.outside-sandbox`；另 `solo-lite.terminal.inSandbox`=`在沙箱中` |
| 沙箱逃逸授权（命令前缀） | `是否允许以下前缀的命令在沙箱外运行？` / `AI 请求在沙箱外运行以下前缀的命令：` | `…tool-card.sandboxEscapeCommandPrefixesLabel` / `.sandboxModelEscapeCommandPrefixesLabel`；设置侧 `icd.ai.runCommandCard.warning_tips.sandbox_escape_command_prefixes`=`是否允许以 { hitRedList } 开头的命令在沙箱外运行？`，`.sandbox_model_escape_command_prefixes`=`AI 请求以 { hitRedList } 开头的命令在沙箱外运行，是否授权？` |
| 网络受限授权 | `受限网络目标：` / `被拦截的网络目标:` | `…tool-card.permissionRequestNetwork`；`icd.ai.permission.blocked_networks` |
| 路径授权 | `授予路径只读权限：` / `授予路径读写权限：` | `…tool-card.permissionRequestRo` / `.Rw`；另一族 `trae-chat-core.permission.grant_paths_ro/ro/grant_paths_rw`=`Grant read-only access to paths:`（**该键中文未落地**） |
| 删除确认卡 | 标题 `确认删除`；`确定要删除 "{filePath}" 吗？` / `确定要删除 {count} 个文件吗？`；`删除: {filePath}` / `删除 {count} 个文件` | `…tool-card.confirm-delete-title` / `.confirm-delete-single` / `.confirm-delete-multiple` / `.delete-single` / `.delete-multiple` |
| 计划执行卡 | 提示 `执行计划后，将退出计划状态。` | `…tool-card.execute-plan-tip`；另 `edit-plan-mode-card-execute-btn-tips`=`执行Plan后会退出Plan状态。你可以自行编辑Plan结果或者输入要求指导模型优化Plan。` |
| 通知用户卡 | `文档已经生成，请问是否要基于文档继续执行？`；选项 `是的，执行此方案` / `修改方案` / `暂不执行，先看看计划`；副标题 `如果不符合预期，可以在输入框中输入指导要求（暂不支持在线编辑）。` | `…tool-card.notify-user.*` |
| 飞书/Lark 授权卡 | 标题 `Lark CLI 需要身份验证`；`请连接您的{brand}帐户以授权 lark-cli` / `连接您的 Lark 或飞书账号以授权 lark-cli`；按钮 `连接` / `已连接` / `lark-cli 已授权，请继续。` | `…tool-card.lark-cli-auth.*`；`…tool-card.feishu-auth.desp`=`识别到你没有飞书相关权限，前往连接` |
| 生图合规失败 | `该请求可能违反平台合规政策，请删除可能涉及版权或敏感内容的表述后重试` | `…tool-card.generate-image.violate-policy` |
| 生图权限受限 | `文件存储在临时目录中，无法预览` | `…tool-card.generate-image.no-permission` |
| 生视频耗时提示 | `调用 Seedance 生成视频中，可能需要3-4分钟` | `…toolcard.generate-video.running.hint` |

### 3d. 按工具分组的卡片标题 × 四态（`running/completed/failed/canceled`）

工具组清单（`trae-chat-core.toolcard.<组>.title.<态>` 实测枚举）：
`ask-user`、`delete-file`、`document`、`edit-file`（另有 `.title-create` 一套）、`environment-setup`、`generate-image`、`image-ocr`、`init-env`、`manage-memory`、`mcp-call`、`memory-file`（再按 `read|update|delete` × `projectMemory|sessionMemory|topicMemory|userProfile` 细分）、`notify-user`、`request-authorization`（另 `.plugin` / `.plugin-connector`）、`run-command-inline`、`search`、`show-diff`、`tasks-list`、`view-file`、`view-files`、`view-folder`、`web-search`。
出处：L10N `trae-chat-core.toolcard.*`。样例原文：

- `ask-user`：`正在向用户提问` / `已向用户提问` / `向用户提问`(取消)
- `delete-file`：`正在删除` / `已删除` / `删除失败` / `删除文件`
- `edit-file`：`正在编辑` / `已编辑` / `编辑失败` / `编辑文件`；create 族 `正在创建`/`已创建`/`创建失败`/`创建文件`；文件计数形态 `1个文件`（`edit-file.file-count`、`show-diff.file-count`）
- `document`：`正在生成` / `已生成` / `生成失败` / `生成文档`
- `environment-setup`：`正在准备环境` / `環境準備完了`(**该键中文未落地，为日文字形**) / `环境准备失败` / `环境配置`
- `init-env`：同族 + 动作词 `安装` / `管理` / `路径`
- `mcp-call`：三态**同串** `调用 {displayName}`
- `generate-image`：`生成中` / `已生成` / `生成失败`
- `image-ocr`：仅单态 `图像分析`
- `manage-memory`：仅单态 `管理记忆`
- `web-search`：`正在搜索网页` + `.no-results`=`没有结果`；`search.searched`=`已搜索`、`search.searched-files`=`搜索了 {count} 个文件`
- `memory-file.*`（24 条）：`读取项目记忆`/`正在读取项目记忆`/`已读取项目记忆`/`读取项目记忆失败` 四态 × {项目记忆,会话记忆,话题记忆,用户画像}；`update.*`/`delete.*` 同形（`正在删除用户画像` 等）
- 卡片侧另有 `trae-chat-core.tool-card.environment-setup.title`=`环境准备`、`.title-loading`=`环境准备中`

### 3e. 工具名标识符（代码面，非文案）

在 CHAT 主包中以字符串字面量出现并被使用的工具名（实测出现次数）：
`Edit`:25、`Task`:14、`Read`:11、`Write`:9、`Skill`:7、`Grep`:5、`Glob`:5、`NotebookEdit`:5、`Bash`:3、`WebFetch`:3、`WebSearch`:6、`Agent`:9。
**未取证到**：`TodoWrite` 之外的 `KillShell`（0）、`BashOutput`（0）、`LSP`（0）、`CheckMcp`（0）、`mcp__<server>__<tool>` 拼接形态（0 命中于 CHAT 主包）。
出处：`ai-modules-chat/dist/index.mjs` 字面量计数。

---

### 3f. 图标名（对话流 bundle 中作为 `icon*:` 字面量出现的枚举，实测 41 个去重值，取前 30）

`icube-Plus`(5) `icube-Retry`(2) `icube-Plus2`(2) `icube-Settings`(2) `icube-Refresh`(2) `icube-Edit` `icube-Share` `icube-Delete` `icube-More` `icube-Compact` `icube-Terminal` `icube-Insert` `icube-CreateFile` `icube-AddToTerminal` `icube-TerminalRun` `icube-ArrowStepBack` `icube-ArrowUpRight` `settings` `helpful` `unhelpful` `layout-sidebar-right` `stop-circle` `directory` `external-link` `lark-document` `lark-doc` `lark-contact` `group` `file` `my-space` `command` `skill` `down`
出处：`ai-modules-chat/dist/index.mjs`，模式 `\b(icon|Icon|iconName|icon_name)\s*[:=]\s"<name>"` 穷举去重（计数=出现次数）。
注意：括号外的 `index-module__icon___*` / `icon-<hash>` 是 CSS Module 类名而非图标名，已剔除。⚠️ 该枚举只覆盖"`icon:` 字面量赋值"这一形态，通过变量/映射表传入的图标名不在其中 ⇒ **不完整**（见 §20 第 20 条修订）。

---

## 4. 终端

| 元素/状态 | 原文 | 出处 |
|---|---|---|
| 输出·无输出 | `该命令执行无输出` | L10N:`icd.ai.terminalMirror.output.noOutput` |
| 输出·暂无 | `暂无输出` | `…output.noOutputYet` |
| 输出·等待 | `等待命令输出` | `…output.waiting` |
| 输出·截断 | `已截断 {linesDropped} 行` | `…output.truncated` |
| 选区「添加到对话」 | `添加到对话` / `Add console error to Chat`=`添加到对话` / `chat_suggest.tips.add_to_chat`=`添加到对话` / `click_tip_text`=`添加到对话` | L10N 同名键 |
| 新手引导文案 | `终端有报错？"添加到对话"，AI 帮你解决` | `ai_agent_onboarding_tips_terminal`；欢迎页版 `ai_welcome_chat_tips_terminal`=`终端有报错？<em>"添加到对话"</em>，AI 帮你解决` |
| 面板标题 | `终端` / `新建终端` / `环境准备中` / `沙盒` / `选择文件夹或仓库以打开终端` | `solo-lite.terminalPanel.title` / `.preparing` / `.sandbox`(=`沙盒`) / `.noRepository`；`solo-lite.terminal.newTerminal` |
| 执行时自动打开终端 | 标题 `执行命令时自动打开终端`；说明 `智能体执行终端命令时，是否自动显示终端面板`；三选项 `始终打开` / `仅在后台执行时打开` / `不打开` | `icd.ai.shellOpenPreference.*` |
| 终端环境选择 | `终端环境`；`极速终端` / `系统终端`；说明 `启动速度更快，无需用户介入，执行更稳定` / `适合用户需在终端内直接交互的场景` | `icd.ai.shellExecMode.env.title` / `.option.agent.title` / `.option.user.title` / 各 `.description` |
| 只读终端开关 | 标题 `在只读终端执行终端工具`；说明 `使用只读环境执行终端命令，提升稳定性。如果需要在用户终端执行命令，可关闭开关。`；不可用态 `只读终端执行模式不可用` / `未检测到所需的终端环境` | `icd.ai.shellExecMode.title/description/unavailable.title/unavailable.desc` |
| 旧版终端工具 | `旧版终端工具` / `智能体使用旧版工具执行终端命令，适用于默认模式无法正常执行命令的场景` | `icd.ai.shellExecMode.legacy.title/description` |
| 分区标题 | `终端工具偏好` | `icd.ai.shellExecMode.sectionTitle` |
| 卡片内运行态 | `执行命令中` | `trae-chat-core.taskTail.commandRunning` |
| 折叠计数 | `执行 {count} 条命令` / `正在执行命令` | `exploreGroup.runCommand.completed/running` |
| 后台任务配置提示 | `配置与主程序并行运行的后台任务（如数据库、测试监听、日志监控）。` | `environment.form.defaultTerminalsTooltip` |

---

## 5. 代码变更窗口

| 元素/状态 | 原文 | 出处 |
|---|---|---|
| 入口按钮 | `查看变更` / `代码变更` | L10N:`OpenDiff` / `QueryDiff`；亦 `trae-chat-core.tool-card.code-changes`=`代码变更`、`…latest-assistant-bar.query-diff` |
| 文件变更计数 | `{count} 个文件已更改`（另有 `.file-changes`=`文件变更`） | `trae-chat-core.tool-card.file-changed` / `.files-changed` |
| 变更列表标题 | `文件变更` | `changeFile`；`trae-chat-core.tool-card.file-changes` |
| 统一"撤销"文案 | `撤销` / `全部撤销` | L10N:`Undo` / `Undo All`；`ai.tasksHub.undoAll`=`全部撤销` |
| 统一"保留"文案 | `保留` / `全部保留` | L10N:`Keep` / `Keep All`；`ai.tasksHub.keepAll`=`全部保留` |
| 旧/并存文案族（同屏可见） | `确认并接受变更` / `确认并保持变更` / `放弃变更` / `确定放弃变更吗？` / `变更已保存` / `变更已合并` / `有未提交的代码变更` | `Confirm & Accept all` / `Confirm & Keep all` / `Discard Changes` / `Are you sure to discard the changes?` / `Changes Saved` / `Changes merged` / `Uncommitted changes` |
| 审查文案 | `审查所有变更` / `仅审查最近一轮变更` | `Review all changes` / `Review latest changes` |
| 审查窗口 tooltip（全文） | `智能体生成的代码会自动写入磁盘。审查代码时，你可以决定是否保留或撤销这些改动。` | `code_review_settings_tooltip_text` |
| 逐文件 diff 跳转设置 | `审查后跳转到下一处变更` / `保留或撤销变更后，自动跳转到文件内的下一处变更` | `code_review_settings_auto_jump_to_next_change*` |
| 编辑后自动弹 Diff（自动接受族） | `自动接受变更` / `自动接受文件变更` / `自动接受文件变更无需手动确认` / `开启后，会在发送下一轮会话时自动接受变更` / `无法撤销变更；所有 AI 产生的代码改动直接保留` / `可撤销或保留所有 AI 产生的代码改动` | `Auto Accept` / `Automatically accept changes` / `…without the need for manual clicks.` / `Once enabled, changes will be automatically accepted when the next message is sent.` / `Automatically keep all AI-generated code changes.` / `Manually keep or undo all AI-generated code changes.` |
| 自动保留已启用提示 | `自动保留已启用。` | `ai.tasksHub.enableAutoKeepTipPrefix` |
| 冲突标记 | `冲突` / `（{count} 个有冲突）` | `trae-chat-core.tool-card.conflict` / `.with-conflicts` |
| 工作区外编辑不可回退 | `编辑工作区外的文件内容无法回退。` / `编辑工作区外的文件内容无法回退。你可以在{btn}中管理工作区外文件编辑的运行方式。` | `icd.ai.fileOp.settings.title.tooltip` / `icd.ai.fileOp.tipCard.message` |
| 未打开项目 | `请先打开文件夹，再应用代码变更` | `chat_file_context_empty_text_desc` |
| 有未处理变更时的开关拦截 | `当前有文件存在未处理的代码变更，是否确认打开` | `There are unprocessed code changes in the current file. Please confirm whether to turn it on.` |
| applyMode 帮助 | `开启后，chat模式下生成的代码变更会自动应用于项目中的相应代码文件` | `applyMode.help` |
| 轮末审查语义（全文） | `仅可撤销或保留最近一轮对话 AI 产生的代码改动；发送新消息后将不再可撤销` | `Review AI-generated code changes from the latest message in each task. …` |

---

## 6. 任务清单与 Plan / Spec / Goal 三工作流

### 6a. 待办 / 任务清单

| 元素 | 原文 | 出处 |
|---|---|---|
| 任务详情入口 | `任务详情` / `查看详情` | L10N:`trae-chat-core.todo-progress.task-details` / `.todo_progress.view_progress` |
| 清单态·手动终止 | `任务已手动终止` | `trae-chat-core.todo_group.status_canceled` |
| 清单态·被打断 | `任务暂停，正在处理新请求` | `trae-chat-core.todo_group.status_interjected` |
| 折叠组·更新待办 | `正在更新待办…` / `更新待办` | `exploreGroup.taskManagement.running/completed` |
| 工具卡·任务列表 | `tasks-list` 组（四态标题族） | `trae-chat-core.toolcard.tasks-list.title.*` |

### 6b. Plan

| 元素 | 原文 | 出处 |
|---|---|---|
| 斜杠命令描述 | `优先规划任务的执行方向，用户确认后再执行` | L10N:`icube.commands.builtin.plan` |
| 输入框占位 | `输入你的任务，AI 会优先规划任务的执行方向后再开发。` | `chat-input.slash.builtin.plan.placeholder` |
| 开关描述 | `开启后模型会优先规划，用户确认后再执行任务` | `Turn it on, the agent will plan first, and then it acts after confirmation.` |
| 生成态 | `生成规划中` | `Generating Plan` |
| 优化提示 | `请在输入框中输入进一步指示，优化Plan结果。` | `Please enter further instructions in the input box to refine the Plan results.` |
| Plan 卡首提示 | `你可以自行编辑Plan结果或者输入要求指导模型优化Plan。` | `edit-plan-mode-card-first-tips` |
| 产物落盘目录 | `.trae/documents` | WB:`var qet=".trae/documents"` — 实测字面量 |

### 6c. Spec

| 元素 | 原文 | 出处 |
|---|---|---|
| 斜杠命令描述 | `根据需求细化完整的规范、任务、验收文档，用户确认后再严格执行，适合复杂的长线任务` | `icube.commands.builtin.spec` |
| 输入框占位 | `输入你的任务，AI 会细化完整的规范、任务、验收文档后再开发。` | `chat-input.slash.builtin.spec.placeholder` |
| 与 Plan 互斥 | `Spec 与 Plan 模式不可同时启用，已切换至 [{mode}] 模式。` | `chat-input.slash.mutuallyExclusive.switched` |
| 产物落盘目录 | `.trae/specs` | WB:`wfi=".trae/specs"` — 实测字面量 |
| spec / tasks / checklist 三文档**文件名** | **未取证到**（CHAT 主包中 `spec.md` 0 命中；`checklist` 4 命中但属其它语境；三文档名未在可读文案里枚举） | — |
| 随进度刷状态 | **未取证到**（仅取得 `tasks-list` 卡片四态与 `todo_group` 两态，未见"文档内状态回写"的文案） | — |

### 6d. Goal（含操作岛台）

| 元素 | 原文 | 出处 |
|---|---|---|
| 斜杠命令描述 | `启动一个以目标为导向的任务，并持续运行直到完成` | `icube.commands.builtin.goal`；`solo-web.slashCommand.builtin.goal.description` |
| 状态·进行中 | `进行中的目标` | `trae-chat-core.goal.status.active`；`ai_goal_status_active` 同值 |
| 状态·受阻 | `目标受阻` | `…goal.status.blocked` |
| 状态·完成 | `目标已完成` / `目标完成` | `…goal.status.complete`；`ai_goal_status_complete`、`ai_goal_completed_tip` |
| 状态·暂停 | `目标暂停`；另有 `ai_goal_status_paused` = **`目標一時停止`**（日文字形，中文未落地） | `…goal.status.paused` |
| 岛台四个动作 | `编辑目标` / `暂停目标` / `恢复目标` / `删除目标` | `trae-chat-core.goal.tooltip.edit/pause/resume/delete`；`ai_goal_tooltip_*` 同族 |
| 编辑弹层 | 标题 `修改目标`（另一入口标题 `编辑目标`）；占位 `请输入你想继续执行的目标`（另一处 `输入你希望 Trae 持续跟进的目标`）；按钮 `确认` / `取消` / `保存` / `关闭` | `…goal.edit.title/placeholder/save/cancel/close`；`ai_goal_edit_*` |
| 删除二次确认 | 标题 `是否确认删除目标？`；正文 `删除后将不再追踪目标，不可恢复` | `…goal.deleteConfirm.*`；`ai_goal_delete_confirm_*` |
| 每轮自评 footer | 未完成续跑：`目标暂未达成，继续执行`；完成：`目标耗时{duration}` | `trae-chat-core.goal-loop-round-footer.continue/completed`；`ai_goal_continue_tip` |
| 用量汇总 | `目标耗时 {duration}，消耗 token {tokens}` | `ai_goal_usage_summary` |
| 与 Ralph Loop 互斥 | `Goal 和 Ralph Loop 不能同时使用，请选择其中之一完成任务。` | `trae-chat-core.error.remoteAgent.goalRalphLoopConflict` |
| 不可用 | `暂不支持 Goal 功能。` | `goal_loop.disabled` |
| 修改成功 | `目标已修改` | `ai_goal_update_success` |

### 6e. Ralph Loop（第四个工作流，实测存在）

| 元素 | 原文 | 出处 |
|---|---|---|
| 命令描述 | `AI 会通过反复对话尝试解决问题，直到任务完成或达到对话循环次数上限。（默认 {defaultRounds} 次，最多 {maxRounds} 次）`（v1 只有默认次） | `icube.commands.builtin.ralph-loop.v2` / `.ralph-loop` |
| 退出命令 | `退出 Ralph Loop，返回普通对话模式。` | `icube.commands.builtin.cancel-ralph` |
| 占位 | `开始描述你的需求（点击标签可修改最大循环次数）` | `chat-input.slash.builtin.ralph-loop.placeholder` |
| 档位标签 | `最大循环次数（最多 {max} 次）` | `chat-input.ralph-loop-popover.label` |
| 风险警告 | `该模式将持续自动运行，直到任务完成或达到最大循环次数。` | `chat-input.ralph-loop-popover.warning`（`ralphLoopPopoverWarning` 同义异字："或者"） |

---

## 7. Subagent 与 Agent 团队

| 元素 | 原文 | 出处 |
|---|---|---|
| 子任务面板标题 | `子任务`；空态 `暂无子任务` / `你的办公助理发起的子任务将显示在这里` | L10N:`solo-lite.imBridge.subAgentProgress.title/empty.*` |
| 子任务状态族 | `执行中` / `等待确认` / `执行完成` / `执行失败` / `执行取消` | `…subAgentProgress.running/waitingForResponse/done/failed/canceled` |
| 子智能体输出态 | `输出中...` | `trae-chat-core.subAgentGroup.outputting` |
| 并行计数标签 | `{count}个 subagent 正在运行`（两处同串） | `trae-chat-core.task-hub.sub-agents.running-label` / `.tab-tooltip` |
| 定义目录开关 | 标题 `Subagents`；`启用 Subagents 目录`；说明 `开启后，智能体将自动加载 .trae/agents 目录下的 Subagents 定义文件。` | `icube.file_subagents.settings.title/enable_title/enable_desc` |
| 团队开关 | `开启 SOLO 团队` | `icube.solo_team.settings.enable_title` |
| 团队版档位名 | `团队版` | `saas_team_group` / `saas_team_group_i18n` / `solo-web.enterprise.planBadge.team` |
| 子代理语义描述 | `可以由其他智能体自主调用来完成模块化任务，拥有独立上下文` | `Autonomously callable by other agents for modular tasks, with isolated context.` |
| 智能体创建引导文案 | `请输入智能体的角色、语气、工作流程、工具偏好及规则规范等。支持Markdown格式。（选填）` | `Enter the agent's role, tone, workflow, tool preferences, and any rules or guidelines. Markdown format is supported. (Optional)` |
| 多智能体并行宣传 | `多个智能体后台并行工作，无需阻塞等待完成` / `自主编排智能体，AI 专家团队协同开发` / `智能任务分配，各司其职并行推进` | `ai.welcomeScreen.assistant.feature2`、`…soloAgents.soloCoder.list.l3`、`…soloTeam.list.l2` |
| 删除智能体确认 | `您确定要删除自定义智能体  {name} 吗？此操作无法撤销。` | `Are you sure to delete the custom agent {name} ? This action CANNOT be undone` |
| 企业专属智能体状态族（**补录**，治理侧可见状态，非子任务态） | `未启用`（`仅你本人可用`） / `未提交`（`该企业智能体存在变更，使用时将以本地配置为准`） / `提交成功，清前往控制台进行启用`（原文含错字"清"） / `提交成功，该智能体可被成员使用` | L10N:`enterprise.agent.status_disabled_title/_desc`、`.status_pending_title/_desc`、`.submit_review_enable_title`、`.submit_review_success_title` |
| 企业智能体操作 | `去启用` / `去调用` / `保存并发布` / `在本地对话中@智能体进行调试,如需企业成员使用,请「提交审核」` / `无法删除已启用的智能体，请先禁用它` / `保存成功后，类型不可修改` / `可供企业内成员使用` / `暂无企业专属智能体，创建后所有企业成员均可使用` | `enterprise.agent.go_to_enable_button/use_now_button/save_and_submit/debug_and_submit_review/delete_error_cannot_delete_enabled/type_cannot_change/category_description/no_agents_created_yet` |
| `+N` 折叠形态（成员超量收纳） | **未取证到**；同形已取到的只有插件面 `查看更多 {count} 个插件`（`market.plugin.seeMorePlugins`）与 subagent 计数标签 `{count}个 subagent 正在运行`（见上） | — |
| frontmatter 字段 `name/description/model/tools/disallowedTools/mcpServers` | **部分未取证到**：`mcpServers` 在 CHAT 主包出现 13 次（字面量）；`disallowedTools` / `allowedTools` / `tools` 作为 agent frontmatter 字段名 **在 CHAT 主包 0 命中**；`LSP` 0 命中。⇒ 该组字段清单本轮**读不到**（见 §未取证面） | — |
| 项目级覆盖用户级 | **未取证到**（文案面未出现覆盖优先级表述） | — |

---

## 8. 权限与沙箱

### 8a. 模式四档（两套并存措辞，均可见）

| 档 | 短标签 | 长说明 | 出处 |
|---|---|---|---|
| 手动审批 | `手动审批` | `Runs in an isolated environment. High-risk actions are blocked, and important actions require your approval.`=`沙箱已启用…需要你确认`（中文：`沙箱已启用，命令在隔离环境中运行…需要由你确认。` 类；实测 `permission.profile.manual.desc` 中文串见下） | `permission.profile.manual.label` / `ai.permission.manual_approval.title` |
| 自动审批 | `自动审批` | `permission.profile.auto.desc`=`Sandbox enabled…` 中文：`沙箱已启用。命令在隔离环境中运行；危险命令检测与文件保护处于启用状态。需要审批的操作会由 LLM Guardian 自动审核。`（英文原文含 `Operations requiring approval are automatically reviewed by LLM Guardian.`） | `permission.profile.auto.label/.desc`、`ai.permission.auto_approval.title` |
| 完全访问 | `完全访问` | `permission.profile.full.desc`=`Sandbox disabled…`；中文实测：`权限设置里"完全访问"= 直接在电脑上运行、无隔离、可读写任何文件、跳过安全检查、不再询问` | `permission.profile.full.label/.desc`、`permission.settings.full.desc`、`ai.permission.full_access.title` |
| 自定义配置 | `自定义配置`（设置页标题 `高级自定义配置`） | `通过 JSON 配置自定义文件系统权限、网络策略、沙箱开关、审核人与命令规则。`（英文原文 `Customize filesystem permissions, network policies, sandbox toggle, reviewer and command rules via JSON configuration.`） | `permission.profile.custom.label/.desc`、`permission.settings.custom.label/.desc` |

其余同族键（值多为中英混排，逐条已在 L10N）：
`permission.mode.select.header`=`Select permission mode`、`permission.settings.title`=`Permission Approval`、`permission.settings.profile.label`=`Approval Mode`、`permission.settings.builtin.title`=`Permission Mode`、`permission.settings.section.title`=`Permission Configuration`、`permission.settings.automated.title`=`Automated Tasks`、`permission.settings.regular.title`=`Regular Tasks`、`permission.settings.docs.label`=`Documentation`、`permission.settings.custom.button`=`Open Configuration`、`ai.permission.settings.title`=`Permission & Approval`。

### 8b. 完全访问二次确认（安全提醒）

| 元素 | 原文 | 出处 |
|---|---|---|
| 弹窗标题 | `安全提醒` | L10N:`permission.confirm.full_access.title` / `icube.auto_review.settings.confirm_title` |
| 确认按钮 | `确认切换到"完全访问"` / `确认选择 "完全访问"` | `permission.confirm.full_access.confirm_button` / `icube.auto_review.settings.confirm_full_access_button` |
| 倒计时按钮 | `确认选择 "完全访问" （{seconds}s）` / `确认选择 "替我审批" （{seconds}s）` | `…confirm_full_access_wait` / `…confirm_auto_wait` |
| 风险正文 | `完全访问模式将关闭沙箱保护和所有审批检查，Agent 将直接在宿主机上执行任意操作。请确保你了解相关风险。` | `permission.confirm.full_access.desc` |
| 完全访问（自动审查侧描述） | `本选项会完全禁用安全审核策略，自动批准支持的工具调用，可能包括修改文件、执行命令或访问外部资源的操作。请注意来自外部来源的提示词注入风险和非预期操作风险，使用时请自行承担风险。` | `icube.auto_review.settings.confirm_full_access_desc` |

### 8c. 自动审批（LLM Guardian / Auto Review）

| 元素 | 原文 | 出处 |
|---|---|---|
| 开关 | `开启自动审查（Auto Review）` / `自动审查（Auto Review）` | `icube.auto_review.settings.enable_title` / `.title` |
| 开关说明 | `由 Agent 自动审查工具调用的风险。开启后，所有需要人工确认的工具调用会首先由模型评估风险，如果模型拒绝执行会回退到人工确认。` | `…enable_desc` |
| 审批方式标题 | `配置当 Agent 尝试执行有风险的工具时，使用的审批方式` | `…guardian_policy_desc` |
| 三选项 | `请求审批` / `替我审批` / `完全访问` | `…option.default/auto/full_access` |
| 三选项说明 | `所有需要确认的工具调用都会请求用户审批` / `Agent 会评估工具调用安全性。安全操作自动批准，高风险操作仍需要手动确认` / `支持的工具调用会被自动批准。用户交互类工具仍需要手动确认` | `…option.*_desc` |
| 自动降级回人工 | `自动批准已停止，因为自动审查多次拒绝此操作。请手动审查并决定。` | `ai_auto_review_fallback_to_manual_reason` |

### 8d. 沙箱执行方式（设置页三档）

| 元素 | 原文 | 出处 |
|---|---|---|
| 分区 | `Command Execution`（`icd.ai.settings.autoRun.title`）；提示 `Choose how the agent executes commands. It is recommended to use the safer "Sandbox with Allowlist" way.`；中文提示 `自动化任务在后台持续运行，选择命令的运行方式。建议选择更安全的「沙箱运行（支持白名单）」方式。` | `icd.ai.settings.autoRun.title/tips.v2`、`solo-web.automation.setting.commands_tip` |
| 档 1 | `沙箱运行（支持白名单）`（键值 `Sandbox with Allowlist`）；说明 `Commands auto-run in a sandbox; allowlisted commands can bypass it.` | `icd.ai.settings.autoRun.mode.sandbox(.description)` |
| 档 2 | `手动运行`（键值 `Manual Run`）；说明 `Commands always run manually outside the sandbox.` | `…mode.always_ask(.description)` |
| 档 3 | `自动运行`（键值 `Auto Run`）；说明 `Commands always run automatically outside the sandbox.` | `…mode.always_run(.description)` |
| 企业覆盖态 | 三档各带 `.description.enterprise` 后缀变体："…The enterprise has enabled a unified sandbox policy; this option is not recommended." | `…mode.*.description.enterprise` |
| 白名单说明 | `If the command is in the Allowlist, it will be executed automatically outside the sandbox.` | `icd.ai.settings.autoRun.whitelist.tips` |
| 沙箱不可用族 | 标题 `沙箱不可用`（值 `Sandbox Unavailable`）/ `沙箱可恢复`（`Sandbox Recoverable`）/ `需要配置沙箱`（`The sandbox needs to be configured`）；正文含 `…allowlisted commands run automatically, while others require manual execution…` 三段（内核可恢复 / 需提权 / 无提权） | `icd.ai.settings.autoRun.sandbox_unavailable.*` |
| 企业沙箱变更通知 | `企业沙箱配置已更新，当前开发环境已启用企业统一沙箱保护。详情可前往「设置 > 对话流 > 自动运行」查看。` | NLS:`vs/workbench/contrib/gitAI/common/enterpriseReposService :: enterpriseSandbox.updated`；L10N:`enterpriseSandbox.updated` |
| 沙箱分配中/类型 | `沙箱正在分配中，请稍候...` / `不支持此沙箱类型。` / `沙箱分配进行中` / `未找到沙箱分配` | `business.error.sandboxAllocationInProgress` / `unsupportedSandboxType`、`error.sandboxAllocation*` |

### 8e. 运行时权限配置结构（代码字面量，对应 `permission/global.json`）

| 元素 | 原文 | 出处 |
|---|---|---|
| 配置键 | `ai.permission.profileId` | CHAT:`let n="ai.permission.profileId"` |
| 默认 profile（逐字） | `{displayName:"", shellSandbox:{enable:!0, onRestrict:"request_permission_retry_sandbox"}, approval:{reviewer:"user", sceneRules:{commandAstDangerChecker:!0, shellFileProtection:!1, deleteToolApproval:!1, mcpToolApproval:!1}}, filesystem:{default:"read_only"}, network:{default:"allow"}}` | CHAT: 模块 `20827` 内 `i={…}` |
| 顶层配置对象 | `{customProfiles:{defaultCustomProfile:i}, resourceAuthorization:{filesystem:{readWrite:[],readOnly:[]}, network:{allow:[],deny:[]}}, rules:{commandRules:{}, mcpRules:{}}}` | 同模块 `o={…}` |
| 落盘路径 | `<productDataPath>/permission/global.json`；SoloLite 模式下为 `<productDataPath>/permission/work/global.json`；按任务：`<productDataPath>/permission/tasks/<taskId>.json` | CHAT:`_permissionDir/_globalConfigPath/_taskConfigPath` 逐字：`` `${e}/permission` ``、`` `${t}/work` ``、`` `${this._permissionDir(e)}/global.json` ``、`` `/tasks/${t}.json` `` |
| 旧配置迁移映射 | 读 `AI.toolcall.v2.solo.mcp.autoRun`，`"alwaysAsk"===t` ⇒ `approval.sceneRules.mcpToolApproval = true` | CHAT:`_migrateMcpApproval` |
| MCP 兜底落 host | 未命中规则时写入 `{approval:"allow", execEnv:"host"}` | CHAT:`t in r||(r[t]={approval:"allow",execEnv:"host"})` |
| 实测配置键全集（`AI.toolcall*`） | `AI.toolcall.autoRun.command.denyList`、`AI.toolcall.confirmMode`、`AI.toolcall.review`、`AI.toolcall.reviewMode.ide`、`AI.toolcall.reviewMode.solo`、`AI.toolcall.v2.command.allowList`、`AI.toolcall.v2.command.mode`、`AI.toolcall.v2.fileOp.allowPaths`、`AI.toolcall.v2.fileOp.mode`、`AI.toolcall.v2.ide.command.mode`、`AI.toolcall.v2.ide.mcp.autoRun`、`AI.toolcall.v2.scheduledTask.command.allowList`、`.denyList`、`.mode`、`AI.toolcall.v2.scheduledTask.mcp.autoRun`、`AI.toolcall.v2.solo.command.mode`、`AI.toolcall.v2.solo.mcp.autoRun` | CHAT 字面量穷举（`grep -o` 去重） |

### 8f. 平台沙箱实现载体

| 元素 | 证据 | 出处 |
|---|---|---|
| Windows 自研沙箱 | 存在 `sbox_sdk.dll`、`trae-sandbox.exe`；`sandbox/unified/` 下有 `vm_sdk.dll`、`x64/x86` 的 `aiep_ipc.dll`、`aiep_vm.dll`、`run_helper.exe` | `resources/app/modules/sandbox/`（目录列举，实测） |
| Linux bwrap / seccomp | `ai_agent.dll` 中 `bwrap` 字面量 **3 次**、`seccomp` **2 次**、`ptrace` 3 次 | `grep -a -o` 实测计数 |
| Linux `--unshare-user` / `unshare` / `user_namespace` 字面量 | **未取证到**（同一次 grep 中 0 命中） | — |
| macOS `sandbox-exec` | **未取证到**（`ai_agent.dll` 与 CHAT 主包均 0 命中；本机为 win32 安装包，mac 侧实现不在此产物内） | — |
| 默认文件系统范围表 | **只取到单值**：`filesystem:{default:"read_only"}`、`network:{default:"allow"}`（见 8e）。逐类目录的默认允许/禁止表**未取证到** | — |
| 删除进回收站 + 批量阈值默认 500 确认 | **未取证到**：CHAT 主包 `回收站` 0 命中、`recycle` 0 命中；`Trash` 8 命中但未落到"删除文件进回收站"语境；`500` 116 命中但均为其它数字（超时/尺寸）。文案面只有直接确认框（见 §3c 删除确认卡），无"批量阈值"表述 | — |

---

## 9. 上下文（窗口 / 使用率 / 压缩）

| 元素 | 原文 | 出处 |
|---|---|---|
| 触发压缩按钮提示 | `点击后触发 /compact，进行上下文压缩` | L10N:`Click to trigger '/compact' and compact the context.` |
| 压缩动作名 | `压缩` | `Compact` |
| 上下文添加提示 | `输入 "#" 添加上下文` | `Enter '#' for AI Contexts` |
| 输入区占位（合并形态） | `@ 用于上下文，/ 用于命令` | `chat-input.placeholder` |
| 输入区 tooltip | `添加上下文` / `添加文件及更多` / `使用 @ 引用文件或文件夹` / `使用 / 调用命令和技能` / `调用插件` | `chat-input.messageInput.contextTooltip.mention/addFilesAndMore`、`.tooltip.mention/command/callPlugins`；另 `side_chat_input.context_tooltip`=`输入 "#" 引用上下文` |
| 压缩开始/完成（模型侧话术） | `我将开始压缩历史对话记录。` / `历史对话记录压缩已完成。` / `历史对话已被压缩` | `I will start compacting…` / `The compaction … is complete.` / `History Chats Compacted` |
| 清空并保留摘要 | `清空上下文并保留对话总结` | `Clear the context and keep the conversation summary` |
| 召回态 | `召回上下文中` | `Context retrieving` |
| 未打开项目 | `未打开项目，无法识别代码上下文` | `Empty repository`；`chat-input.mention.empty.repository` |
| 上下文窗口档位描述（模型卡） | `上下文窗口：{size}` / `上下文窗口：{ dev_context}；工具调用轮次：{ dev_turns }` / `上下文窗口：{ max_context}；工具调用轮次：{ max_turns }` | `ai.model.max_context_size`、`ai.configModel.context_windows.tooltip.1`、`.max.tooltip.1`（`.tooltip.0`=`模型能力`） |
| Max 模式 | 标题 `更大上下文（ Max ）`；`开启后上下文窗口扩展至 {maxContext}，适用于复杂长任务；更多积分消耗`；`适用于复杂任务，支持最长 {maxContext} 上下文`；CN 外部版 `开启后上下文扩展至 1M，适用于复杂长任务，同时会消耗更多积分` | `ai.model.max.switch.ide.toc.title/description`、`.ide.internal/.toc/.global_toc.description`、`ai.model.max.switch.description.cn_external` |
| Max 工具轮次 | `工具调用最多 { turns } 轮，上下文窗口扩展至 { context }` / `工具调用上限 { turns } 轮；上下文窗口支持至 { context }，最高可扩展至 { maxContext }。` / `工具调用最多 { turns } 轮；上下文窗口支持最高 { context }，可扩展至 { maxContext }。` | `ai.model.max.tooltip_text` / `.tooltip_text.select` / `ai.configModel.max.select.tooltip.1` |
| Max 超额成本警告 | `当实际输入超过 { context } Token 时，费用将显著增加。` | `ai.configModel.max.select.tooltip.2` |
| Max 计费 | `Max 模式专为复杂任务设计，支持扩展上下文和灵活的工具调用，按 Token 用量计费。` / `…按实际 Token 使用计费` | `ai.configModel.max.tooltip.1` / `ai.model.max.tooltip_text.default` |
| Auto 模式公告（全文） | `TRAE 正在为你启用 Auto 模式。我们会根据任务复杂度、响应速度与模型可用性，自动为你选择最合适的模型，帮助你在大多数场景下获得最快速、最稳定的体验。当前默认启用 Auto 模式，你可随时在底部手动切换其他模型。` | L10N:`auto_mode_notice` |
| Auto 上下文扩展 | `TRAE 基于效果与速度帮助您选择最优模型；上下文窗口拓展至184k` | `ai.model.cn_solo_auto_mode_tooltip` |
| AGENTS.md / CLAUDE.md 注入 | `智能体将读取根目录中的 AGENTS.md 文件并将其添加到上下文中。` / `智能体将读取 CLAUDE.md 和 CLAUDE.local.md 从根目录并注入内容。` / 键 `Include AGENTS.md in the context.` / `Include CLAUDE.md in context` | 逐字见 `The agent will read the AGENTS.md file…`、`The agent will read CLAUDE.md and CLAUDE.local.md…` |
| 每轮底部"本轮使用率"具体数值形态 | **未取证到**（取得到窗口容量、Max 描述、/compact 入口，未取得"本轮已用 X%"这类读数文案键） | — |

### 9b. 文档集抓取规则

| 元素 | 原文/数值 | 出处 |
|---|---|---|
| URL 三级 | `填写文档集名称和入口页面 URL，系统将从入口页面开始，自动查询同级路径或子路径下、最多三次跳转内的页面内容。` | L10N:`add_doc_from_url_description` |
| 本地文件尺寸/数量（模板参数化，数值由后端下发） | `支持.md / .txt 两种格式，单个文件最大 {a} MB，最多支持添加 {b} 个文件，上限 {c} MB`；另一键 `…单个文件最大 {a} MB，文档集最大 {b} MB，最多添加 {c} 个文件` | `add_from_local_files_description` / `doc_files_limit_description` |
| 10MB / 50MB / 1000 文件 / 向量化后服务端删除 | 具体常量 **未取证到**；只有上述占位参数。⚠️ 附件链路侧可见 `以下文件超过 50 MB，未被添加：{fileNames}`（`chat-input.fileUpload.externalFileTooLarge`）与 `一次最多添加 10 个文件…`（`.externalFileCountExceeded`），**属消息附件限制，不是文档集限制**，不得混用 | L10N |
| 内置文档集 | `TRAE 为您预置了一些常用文档集合，搜索添加后即可使用。` / `从内置文档集中添加` / `企业内专属文档集，由企业管理员提供` / `暂无可用文档集，请先添加` | `add_built_in_doc_description` / `add_built_in_doc` / `builtin_docs_description` / `No_doc_recommendation_found` |
| 删除文档集 | `删除后该文档集将无法用于问答。` | `delete_description` |

---

## 10. 引用与输入

| 元素 | 原文 | 出处 |
|---|---|---|
| `#`/`@` 九类引用清单 | **按可读文案面，实际出现的类别**：文件(`chat-input.mention.empty.noFiles`=`未找到文件`)、文件夹(`.noFolders`=`未找到文件夹`)、符号(`.noSymbols`=`未找到符号`)、规则(`.noRules`=`未找到规则`)、文档(`.noDocs`=`未找到文档`)、资源(`.noAssets`=`未找到资源`)、推荐项(`.noRecommendation`=`未找到推荐项`)、产物(`mention.search.artifact`)、仓库(`.noRepoSelected`=`请先选择一个仓库再搜索文件`)。 | L10N `chat-input.mention.*` |
| 历史文案中的显式 `#` 类型 | `[#Code]引用代码片段`（`[#code]_reference_a_specific_code_snippet`）；`<em>#Workspace</em>，可以对代码仓库中的内容进行提问`（`ai_welcome_chat_tips_workspace`） | L10N |
| `#File`/`#Folder`/`#Doc`/`#Problems`/`#Web`/`#Rule`/`#Past Chats` 作为字面量 | **未在同一文案表内成组取证到**；仅 `#Past Chats` 出现在设置说明：`启用后，您可以使用 #Past Chats 引用之前的对话记录，并将对话历史导出为文件。`（`icube.past_chats.settings.enable_desc`） | L10N |
| 全局索引 | `对工作区中的代码进行全局索引构建，发起 #Workspace 问答时将自动全局检索与问题相关的跨文件上下文，给出与项目更相关的回复。` | `build_a_global_index_on_the_code_in_the_workspace…` |
| AI 优化输入 | `优化您的输入` / `正在优化您的输入…` / `撤销优化` / `请先输入文字` / `输入过长，最大长度为 2000 个字符` | `chat-input.promptOptimize.tooltip.optimize/loading/revert/disabled/tooLong` |
| 语音输入 | `语音输入` / `录音中...` | `chat-input.record` / `.recording` |
| 发送 | `发送` / `发送中...` / `请等待处理上一条消息` | `chat-input.send`、`trae-chat-core.message-input.sending`、`.wait-for-previous-message` |
| 附件上限族 | `单次消息上传附件数量超过上限（最多{maxCount}个）` / `图片数量超出限制（最多 {maxCount} 张）` / `文件大小超出限制：{fileName}（最大 {maxSize}）` / `总大小超出限制（最大 {maxSize}）` / `不支持文件夹上传` / `不支持的文件类型：{fileName}` / `不是图片文件` / `拖放或点击上传和解析` / `上传中，请稍候` | `chat-input.fileUpload.*` |
| Code/Work 模式附件差异 | `Code 模式仅支持粘贴图片。切换到 Work 模式即可粘贴任意文件作为附件。` | `chat-input.fileUpload.codeModePasteFileHint` |
| 斜杠面板项 | `最近使用` / `输入搜索...` / `暂未添加命令` / `暂未添加技能` / `未找到匹配项` / `创建` / `已启用` / `当前指令已选中` | `chat-input.slash.*` |
| 斜杠参数面板 | `参数` / `配置 {command} 参数` / `ESC 关闭` / `↑↓ 切换` / `关闭` | `chat-input.slashCommand.tooltip.parametersTitle`、`chat-input.slashParameter.*` |
| 普通/网络/文档引用态 | `正在搜索网页…` / `搜索 {count} 个网页` | `exploreGroup.webSearch.running/completed` |

---

## 11. 中断与排队

| 元素 | 原文 | 出处 |
|---|---|---|
| 停止按钮 | `停止` | L10N:`Stop` |
| 停止中 / 停止失败 | `停止中` / `停止失败` | `trae-chat-core.message-input.stopping` / `.stop-failed` |
| 中断态 | `任务中断` | `Interrupted` |
| 排队态 | `排队中...` | `Queued` |
| 排队标题 | `排队提醒` | `ai.notification.cn2.queue.title`、`ai.notification.commercial_queue.title` |
| 免费用户排队全文 | `当前模型请求量较高，你目前排在 {position} 位。升级会员，可在高峰期优先响应，或尝试其他模型、切换 Auto 模式继续任务。` | `ai.notification.cn2.queue.free.content` |
| 付费用户排队全文 | `尊贵的 {identity} 用户，当前模型请求量较高，您已进入优先队列，目前排在第 {position} 位。可以尝试其他模型或者切换到 Auto 模式，获得更流畅体验` | `…queue.paid.content` |
| 慢速队列 | `你已进入慢速队列（当前排位 { position }）。` | `ai.notification.commercial_queue.content.l1` |
| 速通（高峰权益） | 按钮 `启用速通权益`；`当前模型请求量较高，您目前排在第 {position} 位。可以启用速通权益，告别排队，立即生成答案。` | `ai.notification.fast_request.use_button` / `.has_quota(.ide).content` |
| 速通不足/负载过高不扣次 | `当前模型资源负载过高，暂时无法保证速通体验。本次对话不会消耗您的速通次数。您目前排在第 {position} 位。` / `当前模型负载过高，本次对话不消耗您的速通次数。已为您进入优先队列，您目前排在第{position}位` | `ai.notification.fast_request.refund_hint` / `.already_using_refund` |
| 速通档位 | `速通 Pro` / `速通 Pro+` / `速通 Ultra` / `优速通 Express`；会员侧 `会员 Pro/Pro+/Ultra/Express/Lite/Free/Trial` | `ai.configModel.access.cn_identity_1/2/3/100`、`.cn2_identity_*` |
| 速通消耗 | `每轮对话将消耗 10 次超级模型的快速队列请求。` / `每次对话将消耗 {cost_num} 次超级模型快速队列请求` | `Each conversation consumes 10 Premium Model Fast Requests.` / `agent_input_ui_builder_cost_placeholder` |
| 模型负载 | `高度负载，可能排队` / `模型高度负载，可能排队较多，获取速通免排队` / `模型高度负载排队较多，已开启速通免排` / `可能出现排队等待` / `可能需要较长的排队等待时间` | `ai.model.load.high`、`.cn_external.free/off/enabled/express`、`ai.model.beta_description`、`ai.configModel.beta.tooltip.1` |
| 云端并行上限 | 文案模板：`您已达到 {count} 个云端并行任务上限。请等待某个任务完成，或升级您的订阅方案。`（另有 `_cn` / `_ultra` 两变体）；`并发任务数达到上限（{limit} 个）。`；`云端任务数已达上限（{limit} 个）…`；`为保证效果，同时运行的任务建议不超过10个` | `trae-chat-core.fission.limit_info_bar.description(_cn/_ultra)`、`automation.toast.parallelLimitReached`、`automation.history.fail_reason.parallel_limited*`、`icube_ai_chat_exceed_concurrent_limit` |
| 具体上限数值 2/10/10/20 | **未取证到**：文案侧全部是 `{count}`/`{limit}` 占位，唯一硬数值只有"建议不超过10个"。⇒ 分档上限表本轮读不到（见 §未取证面） | — |
| 执行中禁止回退 | `当前任务正在进行中，回退将停止任务并恢复到上一轮的状态。` / 标题 `确定要停止当前任务并回退吗？` | `ai_revert_confirm_dec_executing` / `ai_revert_confirm_title_executing` |
| 会话运行态 | `已达到 Solo Agent 并行限制` / `并行已达上限。` | `error.soloAgentParallelLimit`、`business.error.soloAgentParallelLimit` |

---

## 12. 错误与降级

| 元素 | 原文 | 出处 |
|---|---|---|
| 会话不可回退 | `会话状态不允许回退` / `消息不可回退` / `此会话无法回退。` | `error.chatSessionNotRevertable`、`error.messageNotRevertable`、`business.error.chatSessionNotRevertable` |
| 会话/项目/环境/技能/命令/MCP 错误码文案族 | `未找到会话` `禁止访问会话` `会话不在创建状态` `会话状态不允许删除` `会话未在运行中` `未找到追加消息任务` `未找到消息` `请求无效` `禁止访问` `未授权` `内部服务器错误` `服务不可用` `请求超时` `已超出资源限制` `无效的参数` `无效的来源` `数据库错误` `Kubernetes 错误` `TCC 服务错误` `外部服务错误` `CloudIDE 服务错误` `未找到项目` `禁止访问项目` `未找到环境` `环境名称已存在` `禁止访问环境` `未找到用户配置` `无效的密钥类型` `SSH 密钥已存在` `未找到 SSH 密钥` `Git 令牌无效` `未找到 Git 令牌` `未找到 Git 分支` `未找到 Git 仓库` `不支持的 Git 主机` `未找到技能` `技能名称已存在` `禁止访问技能` `未找到命令` `命令名称已存在` `禁止访问命令` `MCP 配置验证失败` `MCP 配置名称已存在` `禁止访问 MCP 配置` `操作失败，密钥可能已损坏，建议删除后重新创建` | L10N `error.*` 全族（逐条实测） |
| 文件转换族 | `文件转换失败` `文件转换超时` `未找到文件转换` `拒绝访问文件转换` `文件内容为空` `无效的目标类型` | `error.fileConvert*` |
| 网络错误码解释族 | `目标端口未监听；目标地址或端口配置错误；ACL 或防火墙主动拒绝连接`（N102）/ `只能确认连接尝试失败；需结合 connection_attemps、目标 IP 和更底层 socket 错误定位`（N104）/ `IP 地址不可达，通常表示没有到目标主机或网络的路由。`（N109）/ `代理 CONNECT 隧道没有建立成功；应检查代理响应和隧道阶段，不等同于目标站 TCP 失败`（N111） | `network_error_code_n102/n104/n109/n111_*` |
| 安全拒答 | `抱歉，当前问题存在安全风险，我暂时无法回答你，请尝试提问其他编程相关问题，我将努力为你解答。` | `DANGEROUS_INTENT_ERROR_MESSAGE` |
| 无法理解 | `抱歉，我没有理解你的问题，你可以补充更多信息，或者选中代码片段后再次向我提问，我将努力为你解答。` | `INVALID_INTENT_ERROR_MESSAGE` |
| 未选中代码 | `抱歉，我没有识别到代码，请先光标选中代码片段后再次发起任务。` / `未识别到函数，请先光标选中期望生成单测的代码片段后再次发起任务` | `NO_DOC_SELECTION_ERROR_MESSAGE` / `NO_UNITTEST_FUNCTION_ERROR_MESSAGE` |
| AI 功能受限 | `当前工作区的AI功能受限，如需使用请联系管理员。` / `当前窗口内仓库已被限制使用 AI 功能，如需使用请联系管理员` | `trae-chat-core.error.aiFeatureRestricted`、`ai.setting.code_index_management.button_git_disable_tooltip` |
| 工作区不受信任 | `当前工作区未被信任，部分功能已被受限`（原文 `当前工作区未被信任，部分功能已被限制`） | `This workspace is not trusted. Some features are restricted.` |
| 积分不足中断 | `你的积分不足，增购积分可继续任务。` / `…升级权益获得更多积分，继续进行任务。` / `是否继续刚才中断的任务？` / 标题 `积分不足` / `积分已更新` | `ai.notification.cn2.commercial_exhaust.*` |
| 视频任务预扣积分冲突 | `你有其他视频任务正在进行，已预扣部分积分，请等待视频任务完成后继续对话，或升级权益获得更多积分。`；动作 `增购积分` / `升级权益` | `ai.error.creditReservation.*` |
| 回退失败 | `回退失败，请重试` / `回退中...` | `ai_revert_failed_tips` / `ai_revert_doing_tips` |
| 重连态 | `再接続中`（中文未落地，为日文字形） | `trae-chat-core.taskTail.reconnecting` |
| 兜底态与 planning 复用 | `somethingWentWrong` 的值是 `正在规划下一步`（**文案错配，原文如此**） | `trae-chat-core.taskTail.somethingWentWrong` |
| 「模型报错/死循环可退积分」判定文案 | **未取证到**（只取得速通不扣次与排队补偿，未取得"退积分"的判定条件文案） | — |

---

## 13. 计量与成本（积分体系）

| 元素 | 原文 | 出处 |
|---|---|---|
| 余额标签 | `积分` / 提示 `点击查看积分用量明细` | `cn_credits_remaining_label` / `.cn_credits_remaining_tooltip` |
| 消耗速度 | `积分消耗速度` / `{rate} 倍` | `ai.configModel.consumption_rate.tooltip.title/description` |
| 补贴/折扣标签 | `会员{discountFold}折`；tooltip `付费会员享额外{discountFold}折\n积分消耗速度：{originalConsumptionRate}x {consumptionRate}x`；`{modelDisplayName} 专属补贴\n积分消耗速度：{consumptionRate}`；`限时折扣`；`即日起至{endDate}，TraeWork 内置模型套餐内用量限时半价，超出套餐用量范围按原价计算。` | `ai.configModel.discount.*`、`ai.model.seat_discount.*` |
| 费用档 | `费用` / `免费` / `按 Token 计费` / `该模型 API 成本更低，质量稳定，适合 Lite 套餐使用` / `Lite-friendly` | `ai.configModel.cost.*` |
| 每日签到 / 邀请 | `奖励更丰富：每日签到、邀请好友赚积分` / `积分更充足：升级送 {grantCredits}，每月持续送 500；签到、邀请赚积分` / `邀请得积分` / `增购积分` / `好友登录 TraeWork 桌面端，双方各得 500 积分，最高得 3500 积分 + 2 杯咖啡。快去分享吧！` | `commercial.cn2.billingSwitch.free.rewards` / `.grant`、`ai.notification.cn2.commercial_exhaust.invite_earn_credits`、`.purchase_credit`、`commercial_banner.credits.invite_friend.description` |
| 速通次数兑换为积分 | `权益全保留：原有速通次数已兑换为积分` | `commercial.cn2.billingSwitch.fastRequestConversion`（另有 `.ide.` 前缀同族） |
| 积分体系开启 | `积分体系开启 你的积分已到账` / `TRAE 积分体系已开启，升级当前客户端版本，马上得积分；升级权益获得更多积分。` / 标题 `积分已用尽` | `commercial.cn2.billingSwitch.title`、`ai.notification.commercial_exhaust.cn.*` |
| 仅内置模型耗积分 | **未取证到**明确表述；实测可见的是 `按 Token 计费` / `免费` 分档与 `TraeWork 专属积分` 区分：`你在当前客户端积分不足，升级权益获得更多积分。你还有 TraeWork 专属积分，可前往使用。` | `ai.notification.cn2.commercial_exhaust.work_credits_available.content` |
| 优先消耗最早过期 | **未取证到**（文案面未出现过期顺序表述） | — |
| Seed 2.5 折 | **未取证到**具体"Seed 2.5 折"串；实测折扣都是 `{discountFold}` 参数化下发 | — |
| 用量提醒 | `余量提醒` / `您的用量即将使用完毕，为保证后续使用体验，建议及时获取更多可用额度。` | `ai.commercial_remind.title/content` |
| 生图生视频预消耗展示 | `正在调用生图工具，本次图片生成预计消耗 {estimatedBudget} 积分，耗时 {estimatedDurationMin}-{estimatedDurationMax} 分钟。`（生视频同形） | `trae-chat-core.exploreGroup.generateImage.running` / `.generateVideo.running` |
| 会员计费模式 | `Agent Plan` / `Coding Plan` / `BytePlus Plan` | `ai.settings.model.billing_mode.agent-plan/quota`、`byteplus-plan` |

---

## 14. 会话管理（Fork / 回退 / 分享）

| 元素 | 原文 | 出处 |
|---|---|---|
| Fork Chat 按钮 | `分叉` | L10N:`icube.fork_chat.button` |
| Fork 悬浮说明 | `创建会话副本` | `icube.fork_chat.message_tooltip` |
| 会话菜单项 | `复制会话` | `icube.fork_chat.session_menu_item` |
| Fork 开关 | 标题 `对话分叉`；`启用对话分叉`；说明 `启用后，你可以从任意消息处分叉对话，创建包含部分上下文的新对话` | `icube.fork_chat.settings.title/enable/enable_desc` |
| 回退（消息+文件一起退） | 标题 `确定要回退至此次问答重新发起吗？`；正文 `此行为除了回退前序问答，还将恢复以下 AI 操作过的文件`；带计数版 `…还将恢复以下 AI 操作过的 {count} 个文件`；入口 `回退到本轮对话发起前`；成功 `问答及影响的代码文件已回退` | `ai_revert_confirm_title/dec/file_dec/ai_revert_tips/ai_revert_success_tips` |
| 快照清理 | 标题（`confirm_clean_snapshot_desc`）`此操作将移除该会话全部轮次快照，会话无法回退至历史轮状态，历史问答内容仍会保留。确定要删除吗？` | `confirm_clean_snapshot_desc` |
| 删除会话风险 | `删除后，本次对话内容及相关代码变更将被永久清除，无法恢复。` / `删除后，这个会话及其所有内容将从本地或云端移除，包括聊天记录和代码，且无法恢复。` | `Once deleted, this conversation and all related code changes will be permanently removed…` / `project_task.dialog.deletion_warning` |
| 分享选择面板 | 标题 `选择对话`；`全选`；`已选择 1 轮对话` / `已选择 {count} 轮对话`；上限 `最多可选择 {count} 轮对话`；自动截断 `最多分享{count} 条消息，已自动选择最近 {count} 条` | `trae-chat-core.message-selection.title/select-all/selected-turn(s)/turn-limit/turn-limit-latest` |
| 分享对话框 | `对话分享` / `分享图片预览` / `分享图片` / `分享链接：` / `分享链接` | `.share-dialog-title` / `.share-image-dialog-title` / `.share-image` / `.share-link` / `.share-link-qr-code` |
| 二维码 + 长图 | `下载二维码` / `扫码查看，或点击` / `使用手机扫码预览` / `生成图片` / `下载图片` / `复制图片`；失败态 `分享内容过长，无法导出为图片` | `.save-qr-code` / `.scan-or-click-preview-prefix` / `.scan-to-preview` / `.generate-long-image` / `.generate-image` / `.copy-image` / `.image-too-long` |
| 链接生成态 | `正在生成分享链接` / `链接已复制` / `链接已复制到剪切板` / `链接生成失败` / `预览链接` / `重试` | `.generating-link` / `.link-copied-short` / `.link-copied` / `.link-generation-failed` / `.preview-link` / `.retry` |
| 分享审核 | `分享内容未通过审核，请调整分享内容重试。` / `内容未通过审核，建议修改后分享` | `.share-content-audit-failed`（首键带 `\'` 伪影，实测原样） / `Content issue detected. Please revise before sharing.` |
| 分享内文件缺失 | `无法读取文件"{fileName}"，文件可能已被删除或移动，请恢复文件后重新分享` / `以下文件不存在，未包含在本次分享中：` / `本次分享包含的文件数量超出最大上限（{count}个），请删减文件后重新分享` | `.share-file-unavailable` / `.unavailable-files-not-shared` / `.share-file-count-exceeded` |
| 分享品牌尾巴 | `复杂工作，交给 TraeWork` | `.share-image-brand-tagline` |
| 分享失败 | `分享失败` / `分享失败，请重试。` | `.share-failed` / `Share failed. Please try again.` |
| 导出对话 | `导出对话` / `导出对话记录` / 禁用提示 `当前正在进行中，无法导出`；历史对话设置 `启用后，您可以使用 #Past Chats 引用之前的对话记录，并将对话历史导出为文件。` | `icube.past_chats.export.*` / `.settings.enable_desc` |
| 接力（IDE↔云） | 命令描述 `将 TraeWork Web 智能体接力到当前 IDE` | `icube.commands.builtin.teleport` |
| 派遣/召唤（Handoff） | 一套完整 Git 前置弹窗文案（标题/状态/影响/选项/描述/警告 共 5 组、约 150 条），代表串：`派遣至远端前，先处理本地改动`、`召唤回本地前，先处理当前改动`、`发送给 TraeWork 处理`、`🗑 强制推送`、`远端较新的代码会丢失，此操作不可撤销。` | L10N:`project_task.handoff.git_dialog_bundle`（整块 JSON 内嵌）、`project_task.handoff.*` |
| 接回准备面板 | 标题 `接回本地准备`；`本地: {{localBranch}} → 远程: {{remoteBranch}}`；动作 `提交为 WIP` / `暂存更改` / `切换到 {{branch}}` / `跳过 — 不做处理，直接接回` / `取消 — 我自己处理` / `继续` | `project_task.handoff.prep.*` |

---

## 15. 模型选择

| 元素 | 原文 | 出处 |
|---|---|---|
| 模型能力标签 | `模型能力` / `服务商` / `{ provider_name }` / `图片输入` / `推理` / `记忆` / `Beta 模型` | `ai.configModel.context_windows.tooltip.0`、`.provider.tooltip.0/1`、`.multimodal.tooltip.0`、`.reasoning.tooltip.0`、`.memory.tooltip.0`、`.beta.tooltip.0` |
| Auto 开关公告 | 见 §11 `auto_mode_notice` 全文 | `auto_mode_notice` |
| Max 开关 | 标题 `更大上下文（ Max ）` / `Max 模式`；描述见 §9 | `ai.model.max.switch.ide.toc.title`、`ai.configModel.max.tooltip.0` |
| 折扣/限时标签 | `限时折扣` `会员{discountFold}折` `Limited Access` `抢先体验` `Early access` `Free` | `ai.model.seat_discount.badge`、`ai.configModel.discount.member_discount.tag`、`.access.tag`、`.access.identity.tag`、`.early_access.identity.tag`、`.free.tag` |
| 解锁门槛 | `仅 Lite、Pro、Pro+、Ultra 用户可用。` / `因资源有限，暂时仅限 {identity_names} 用户使用，升级后即可解锁。` / `仅 Ultra 用户可用。` / `仅 Pro+ 用户可使用此模型，可能产生较高费用。` / `当前仅优速通用户可使用该模型，更多模型资源正加急申请中` | `ai.configModel.access.tooltip.0`、`.access.tooltip.cn_desc`、`.early_access.tooltip.0`、`.extra.tooltip.0`、`ai.model.cost.super_model.upgrade` |
| 动作按钮 | `升级方案` / `升级权益` / `升级 Pro+` | `.access.tooltip.1`、`.access.tooltip.cn_button`、`.extra.tooltip.1` |
| 跨端引流 | `该模型即将开放，前往 TRAE Work 客户端可立即体验` / `前往 TRAE Work 客户端使用，速度更快、排队更少` / `下载 TRAE Work` | `ai.configModel.access.download_work.tooltip.1`、`.identity.tooltip.1`、`.tooltip.2` |
| 自定义模型配置面 | `自定义模型`相关键：`上下文窗口（Token）`、`上下文窗口`（输入/输出两栏，标签均为 `输入`）、`模型系列（优化的 Prompt 和超参）、展示名称、上下文窗口等配置`、`请输入新的 API Key（留空则保留当前值）`、`请输入数字，最多保留 2 位小数。`、`思考模式` | `ai.settings.model.context_window`、`.custom_model.context_window(.input_label/.output_label)`、`.custom_config.advanced.collapsed_hint`、`.input_new_api_key`、`.sampling_invalid_number`、`.thinking_mode` |
| Temperature / Top-P / Top-K 字段名 | **未取证到**中文标签原文；仅取得采样参数校验文案 `请输入数字，最多保留 2 位小数。`（`sampling_invalid_number`）⇒ 采样参数存在，但三项字面名本轮未落到文案表 | — |
| 是否支持图片 | `图片输入`（`ai.configModel.multimodal.tooltip.0`） | — |
| 服务商下线 | `该服务商已停止服务，当前模型无法使用及编辑，请切换其他可用模型继续操作。` | `ai.settings.model.provider_offline.hard.edit_tip` |
| 场景模型路由 lite/reasoning | **未取证到** "scene routing / lite vs reasoning 自动分发"的表述；仅取得档位词 `Lite-friendly` 与 `推理模型`（`ai.model.Reasoning`）、`Reasoning`=`推理模型` | — |
| 内置模型具体名单（模型名清单） | **未取证到**（文案表内模型名均由服务端下发，主包无硬编码品牌模型枚举；实测可见的产品侧串只有 `Seedance`（生视频）与 `TRAE/TraeWork` 品牌名） | — |

---

## 16. 规则与记忆

### 16a. 规则

| 元素 | 原文 | 出处 |
|---|---|---|
| 设置分区 | `规则` / `全局规则` / `项目规则` | `ai.settings.rules.title` / `.title.global` / `.title.project` |
| 规则语义 | `创建及管理用户自定义规则，TRAE 会在聊天过程中遵循这些规则，切换项目时这些规则仍保持…`（键 `Create and manage custom user rules. …`）；`创建专用于此项目的规则` | `ai.settings.rules.description(_global/_project)`、`Create Project Rules` |
| 指南 | `在全局偏好规则中，你可以定义开发习惯并要求 AI 遵循。`；项目侧 `Define development standards for the AI to follow in this project (via the project rules file).`；示例 `1. Always chat in Chinese/English.\n2. Add function-level comments when generating code.\n3. My system is Mac/Windows.`；`1. 项目框架版本与依赖\n2. 测试框架细节\n3. 禁用的 API`（示例以英文原文存储） | `ai.settings.rules.guide.*` |
| 规则触发方式 | `手动触发生效` | `rule.mode.manual` |
| 规则名约束 | `规则名称仅支持小写字母、数字和连字符` | `Rule name only allows lowercase letters, numbers, and hyphens` |
| 规则文件热更 | `规则文件已修改，请保存以应用更改。` | `Rules file modified. Save to apply changes.` |
| Glob 无匹配 | `此 Glob 匹配模式未匹配到工作区中的任何文件` | `This glob pattern doesn't match any files in the workspace` |
| 引用目录（**已取证，补录**） | `在项目中创建 .trae/rules/project_rules.md 文件定义 TRAE 在当前项目中对话时需要遵循的规则。` | L10N:`custom-project-rules-settings-description` — 目录与文件名**逐字出现在文案里** |
| 项目规则文件初始化 | `初始化 project_rules.md 文件基于代码库分析`（英文键体 `Initialize the project_rules.md file with codebase analysis`） | L10N:`Initialize the project_rules.md file with codebase analysis`、`init` |
| Subagent 定义目录 | `.trae/agents`（见 §7 的 `icube.file_subagents.settings.enable_desc`） | L10N |
| 项目级规则/智能体覆盖用户级的**优先级表述** | **未取证到**（目录名已取到，但"谁覆盖谁"的文案 0 命中） | — |

### 16b. 记忆

| 元素 | 原文 | 出处 |
|---|---|---|
| 开关与语义 | `记忆`；`当前已启用：智能体正在智能生成、更新并使用记忆。` / `禁用时：智能体将停止生成、更新和使用记忆。` / `记忆由 TRAE 自动生成，以保持对话间的上下文。` / `记忆的开启、关闭及删除操作，将在后续新开的对话中生效。` | `ai.settings.memories.*` |
| 数量上限与淘汰 | `为确保有效性，记忆数量最多限制为 {maxCount}。超出部分将智能替换为最早或访问概率最低的记忆。` | `ai.settings.memories.alert` |
| 视图分页签 | `全局` / `项目`；`项目记忆` / `用户画像` | `.tabs.global/project`、`memory.cloud.tabs.projectMemory/userProfile` |
| 空态 | `暂无记忆` / `使用智能体后，记忆将自动显示` / `暂无记忆。` | `.empty.text/.empty.tips`、`memory.cloud.empty` |
| 云端记忆 | `在智能体对话中使用同一份云端记忆。` / `记忆已暂停，现有云端记忆会保留。` / 暂停弹窗 `暂停记忆？` `智能体将停止使用记忆，现有云端记忆会保留。` | `memory.cloud.description/disabled/turnOff.*` |
| 让 Agent 改记忆 | 标题 `让 Agent 修改`；占位 `例如：记住我偏好简洁的回答。`；`描述需要修改的内容，Trae 会在新的 Agent 对话中处理。`；状态 `运行中` / `已完成` / `修改未完成，请重试。` / `查看对话` | `memory.cloud.edit.*` |
| 记忆加载错误 | `无法加载记忆设置。` / `暂时无法获取记忆设置。` / `正在检查记忆设置…` / `无法加载云端记忆。` / `正在加载记忆…` / `刷新` | `memory.cloud.*Error/policyLoading/readError/loading/refresh` |
| 新手引导 | `TraeWork 会记住你的偏好和项目上下文` / `对话之间不再从零开始` / `随时可在设置中查看或关闭` / `去设置` / `好的` / `功能升级` | `memory.onboarding.*` |
| 记忆落盘 URI（代码字面量） | `context://memory/user_profile.md`；`context://memory/projects/${r}/project_memory.md` | CHAT:`BM(e,t,r)` 函数体逐字：`` t===`context://memory/projects/${r}/project_memory.md` ``；另有任务键 `icube.cloudMemory.editTask.v1` |
| 记忆虚拟路径语义 | `Read and update only the Cloud Memory file at context://memory/user_profile.md. Treat the canonical context:// URI as a ContextFS virtual path. … Do not ask follow-up questions. …` | CHAT:`BT/…` 内联 prompt 逐字 |
| 记忆修改的固定 prompt 约束 | `Apply only the requested change and preserve all unrelated information.` / `If information is insufficient, make only the smallest certain change and explain what was not …` | 同上 |
| 记忆文件工具卡 | 四态 × 四类，见 §3d `memory-file.*` | L10N |
| 全局记忆文件路径 `~/.trae-cn/memory/user_profile.md` | **未取证到**具体磁盘路径字面量；实测取得的是 `context://memory/…` 虚拟 URI 与产品数据目录解析命令 `icube.common.commands.getProductDataFolderPath`（用于 §8e 的 permission 路径），memory 是否同根未取证 | CHAT:`_getProductDataPath` |
| "一次性指令/模糊偏好/敏感信息不入记忆" | **未取证到**（文案面未出现该三条判据表述） | — |

---

## 17. 智能体审查（PR / 变更审查）

| 元素 | 原文 | 出处 |
|---|---|---|
| 主按钮态 | `AI 创建 PR` / `AI 检查 PR` / `手动创建 PR` / `查看 PR` / `解决冲突` / `中止 PR 准备` | L10N:`ai.review.button.idle/update_branch/create_pr/view_pr/conflict/abort_pr_preparation` |
| 运行态 | `AI 正在检查变更` / `AI 正在处理冲突` | `trae-chat-core.task-hub.review.status.reviewing/conflict` |
| 失败原因 | `PR 创建失败: 相对目标分支没有文件更改` / `PR 创建失败，请稍后重试` / `删除远程分支失败，请稍后重试` / `此分支已被删除。您未来的更改将不会被保存。` | `…task-hub.review.error.*` / `.branch_deleted` |
| 自动推分支引导 | `您的代码更改会自动推送到 {platform} 以确保文件安全。您可以在下方删除新增的分支。` / 标题 `更改已自动同步到 {platform}` | `…review.guide.content_v2/title_v2` |
| 移除分支 | `从 {platform} 移除分支`；正文 `删除分支后，当前对话中的所有文件更改将丢失。确定要删除远程分支吗？` | `…review.menu.remove_branch_v2` / `.remove_branch.content` |
| Worktree 合并 | `手动合并` | `trae-chat-core.task-hub.worktree.menu.manual_merge` |
| **范围三选（未提交/单次提交/分支差异）** | **未取证到**：文案面只出现"仅审查最近一轮变更 / 审查所有变更"（`Review latest changes` / `Review all changes`）与 worktree diff 合并控件；未出现三档范围选择器 | — |
| **模式三选（总结+审查 / 仅审查 / 仅总结）** | **未取证到**（L10N 与 CHAT 主包均无该三分组文案） | — |
| 业务流程变更图 | **未取证到** | — |
| 点"修复"自动唤起对话并预填 | **未取证到**（仅取得 `修复选中代码的问题`（`Fix the problems in the selected code`）这一命令描述，未见"修复→预填对话"链路文案） | — |

---

## 18. MCP

| 元素 | 原文 | 出处 |
|---|---|---|
| 概念说明（全文） | `Model Context Protocol (MCP) 允许大语言模型访问自定义工具和服务。MCP Servers 是支持该协议的服务，提供工具和功能来扩展智能体的能力。添加后，智能体会自动调用合适的工具完成任务。` | L10N:`mcp_settings_empty_desc`；标题 `什么是 MCP Servers？` |
| 添加路径 | `添加 MCP Servers` / `从市场添加` / `手动配置` / `追加` / `由 TRAE 提供信息` / `来自火山引擎` | `mcp_settings_empty_add_button/add_from_market/add_manually/add_button/from_trae/from_volc` |
| 手动配置 | 标题 `手動設定`(中文未落地)；说明 `请从 MCP 服务的介绍页面复制配置 JSON（最好使用 NPX 或 UVX 配置）并粘贴到输入框中。`；警告 `配置前请确认来源并识别风险。`；错误 `无法从 JSON 中提取服务名称` / `保存配置失败` / `名称必填` | `mcp_settings_manual_*` |
| 市场 | `MCP 市场` / `云端` / `此市场中的服务从远程源获取。` / `加载市场失败` / `未找到结果` | `mcp_settings_marketplace_*` |
| Gallery | `添加 MCP 服务` / `JSON 预览` / `当前版本：{version}` / `升级到最新版本 {version}` / `已是最新版本` / `无需填写信息。请确认来源...` / `未找到 Gallery 项目: {id}` | `mcp_settings_gallery_*` |
| 删除 | 标题 `删除 MCP 服务？`；`确定要删除 "{name}" 吗？此操作无法撤销。`；`正在删除 {server_name}，该 MCP Server 正在被 {nums} 个智能体使用；卸载后将影响智能体功能。此操作无法恢复。` | `mcp_settings_delete_title/delete_confirm`、`Deleting {server_name} This MCP Server is being used by {nums} agent(s). …` |
| 无工具 | `暂无工具` | `mcp_settings_no_tools` |
| 卡片态 | `调用 {displayName}`（三态同串）；折叠 `调用 {count} 次 MCP` / `正在调用 MCP…` | `trae-chat-core.toolcard.mcp-call.title.*`、`exploreGroup.mcpCall.*` |
| 自动运行 MCP | `自动运行MCP` / `自动运行所有MCP工具。请注意来自外部来源的潜在提示词注入风险，使用时请自行承担风险。` / `从下次开始自动运行MCP工具` / `使用智能体时，自动运行MCP工具` / `计划任务自动运行 MCP` | `Automatically Run MCP`、`Automatically run all MCP tools. …`、`Auto run MCP tools starting from next time.`、`When using the agent, automatically run the MCP tools.`、`Scheduled Task Automatically Run MCP` |
| 企业白名单 | `企业已启用 MCP 白名单，此模式不支持手动添加 MCP` | `enterprise.mcp_whitelist_manual_add_disabled` |
| 自动化任务侧 | `自动运行：自动化任务在后台持续运行，默认自动执行 MCP 工具以减少阻塞。` / 标题 `自动化任务 - 自动运行 MCP` | `solo-web.automation.setting.mcp_tip/mcp_title` |
| **查看 MCP Server 日志** | **未取证到**（文案面未出现"日志"与 MCP 组合项；`mcp_settings_*` 无 log 键） | — |

---

## 19. 其余对话流可见态（taskTail / 输入区杂项，补录）

| 元素 | 原文 | 出处 |
|---|---|---|
| 底部活动态族 | `等待中` / `正在规划下一步` / `即将生成完毕` / `正在生成中` / `执行命令中` / `请求处理中` / `环境准备中...` / `正在创建工作树…` / `Hooks 执行中` / `正在等待你的操作` / `请在运行前检查` / `思考中` | L10N `trae-chat-core.taskTail.*`（`waiting/planningNextStep/codeAlmostReady/generatingCode/commandRunning/mcpRunning/containerInitializing/creatingWorktree/hooksExecuting/waitingForAction/checkBeforeContinuing/aiThinking`） |
| 输入区按钮/提示 | `添加环境` / `正在检查环境…` / `活动尚未开始，请持续关注后续更新。` / `您暂未开通 TraeWork 使用权限，请关注后续产品动态` / `网络连接不稳定，请重启客户端。`（lite）/ `网络连接不稳定，请刷新页面。`（web） | `trae-chat-core.message-input.*` |
| 上下文相关设置 | `设置`（`ai.task.memory.reference.settings`）/ `记忆`（`.title`）/ `查看`（`.view`） | `ai.task.memory.reference.*` |

---

## 20. 读不到的面（明确未取证到，不得当结论引用）

1. **Mermaid 与图表模板白名单**：对话流文案表内无 Mermaid 键；仅存在上游扩展目录 `extensions/mermaid-chat-features`。被允许的图表/模板枚举名**读不到**。
2. **`~/.trae-cn/permission/global.json` 的完整字段表**：只读到默认 profile 的 JS 对象字面量与路径拼装函数（§8e），未读到 schema 声明文件；`work/` 子路径只在 SoloLite 模式生效。
3. **macOS `sandbox-exec` / Linux `UserNamespace`(`unshare`) 字面量**：0 命中（本机是 win32 安装包，mac/linux 侧实现不在产物内）。Linux 只取到 `bwrap`(3) / `seccomp`(2) / `ptrace`(3)。
4. **默认文件系统范围表**（哪些目录默认可读/可写）：只取到 `filesystem:{default:"read_only"}` 与 `resourceAuthorization.filesystem.{readWrite,readOnly}:[]` 两个空数组，未取到逐项预置清单。
5. **删除进回收站 + 批量阈值默认 500 确认**：文案与字面量面均 0 命中（`回收站`/`recycle` 无；`500` 的 116 次命中均为其它语境）。只看到直接二次确认框。
6. **云端并行上限的具体数值 2/10/10/20**：全部是 `{count}`/`{limit}` 占位；唯一硬数字是"同时运行的任务建议不超过10个"。分档表**读不到**。
7. **Plan/Spec 产物文档的文件名与状态刷写文案**：只取到目录字面量 `.trae/documents`、`.trae/specs`；三文档（spec/tasks/checklist）文件名与其进度态文案**未在同一证据面出现**。
8. **Subagent frontmatter 字段清单**（`name/description/model/tools/disallowedTools/mcpServers`）：`mcpServers` 字面量存在（13 次），`disallowedTools`/`allowedTools` 作为 agent 定义字段**在对话流 bundle 中 0 命中**；字段表可能在 `ai_agent.dll` 的 Rust 侧或后端 schema，本轮未取。
9. **项目级规则/智能体覆盖用户级的优先级文案**：0 命中。
10. **`~/.trae-cn/memory/user_profile.md` 等磁盘绝对路径字面量**：只取到 `context://memory/…` 虚拟 URI；真实落盘根路径靠命令 `icube.common.commands.getProductDataFolderPath` 运行时解析，静态产物中不含盘符。
11. **"一次性指令/模糊偏好/敏感信息不入记忆"三条判据**：文案面 0 命中。
12. **每轮底部"本轮使用率"读数文案**：只取到窗口容量与 `/compact` 入口，未取到"已用 X%"形态。
13. **Temperature / Top-P / Top-K 三项字段中文名**、**内置模型名单**、**场景模型路由（lite/reasoning）分发文案**：均未取到。
14. **智能体审查的「范围三选 × 模式三选」「业务流程变更图」「点修复预填对话」**：4 项均 0 命中，本轮读不到。
15. **查看 MCP Server 日志**：文案面 0 命中。
16. **模型报错/死循环可退积分的判定文案**：只取到速通"不扣次"与排队补偿，未取到退积分判据。
17. **"仅内置模型耗积分"与"优先消耗最早过期"、"Seed 2.5 折"**：折扣一律 `{discountFold}` 参数化，未取到具体折数与过期顺序表述。
18. **TRAE SOLO CN 独有文案差异**：两装的 `ai-modules-chat/dist/index.mjs` md5 **相同**，因此对话流文案无差异可报；SOLO 侧独有面（`byted-solo.builtin-mcp`、`solo-lite` 扩展、`solo-web.*` 键）已并入上表但未单独穷举。
19. **日文/中文混排残迹（属竞品自身本地化缺陷，如实登记）**：`ai_goal_status_paused`=`目標一時停止`、`trae-chat-core.taskTail.reconnecting`=`再接続中`、`toolcard.environment-setup.title.completed`=`環境準備完了`、`cn_credits_remaining_unlimited`=`無制限`、`mcp_settings_config_name_label`=`名前`、`mcp_settings_delete`=`削除`、`mcp_settings_gallery_confirm`=`確認`、`chat-input.slash.*` 若干 —— 这些键在**中文 map** 里的值是日文字形。
20. **图标名枚举**：**已部分取证**（见 §3f，`icon:` 字面量形态实测 41 个去重值）。仍**未取证到**的是：经变量/映射表传入的图标名、完整 iconfont symbol 清单（`dist` 内另有 `index-module__icon___*`、`icon-<hash>` 类 CSS Module 类名，已剔除不计为图标名），以及每个图标绑到哪个具体 UI 元素的对应关系。
21. **图标→元素映射**：上表只给出图标名与其出现次数，未给出"哪个按钮用哪个图标"的成对证据（需逐渲染点解析，本轮未做）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
