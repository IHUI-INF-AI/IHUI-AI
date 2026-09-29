<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D167-2 裁定报告：Qoder CN v0.4.3 对话流清单 composer.* 族 41 行对账

- 日期：2026-09-29 · 裁定面：只读 HEAD（`git show HEAD:…` / `git grep … HEAD`），禁用工作树语言包
- 输入：`slice-composer.json`（41 行，tag=10_引用，sec=10 引用与来源（@ /）
- 我方语料：`packages/i18n/messages/web/zh-CN.json`@HEAD、`packages/i18n/messages/shared/zh-CN.json`@HEAD、`apps/web/src`+`packages/shared/src`@HEAD
- 纪律：同义词先行 / 相邻机制不背书 / 三态不并桶 / 已立票标 TICKETED

## 0. 结论统计

| 判定 | 条数 |
|---|---|
| FALSE（我方键+值覆盖） | 27 |
| TRUE-GAP（零覆盖+探针证据） | 7（同一能力组：能力引用模拟预览编辑器） |
| TICKETED(D164)（速记板/选中摘存） | 6 |
| UNDETERMINED | 1（convertToText） |

我方两包 HEAD 均**零 `composer.*` 键**——全部裁定基于能力面同义词与代码机制证据。

## 1. 41 行逐行裁定表

证据指针格式：web 包= `packages/i18n/messages/web/zh-CN.json`@HEAD 行号；代码= HEAD 路径:行。

### composer.actions（21）

| key 末段 | 判定 | 证据指针 |
|---|---|---|
| workspaceFileSearchLabel | FALSE | chat.mentionEngine.tabFile「文件」(10491)+tabFolder/tabSymbol/tabDatabase/tabWeb；chat.inputPlaceholder「@ 提及文件」(11460) |
| workspaceFileSearchPlaceholder | FALSE | fileMention.fileSearchPlaceholder「搜索文件…」(15124)+fileMention.groupDir/groupSemantic(15119-15123) |
| workspaceFilesLoading | FALSE | chat.mentionEngine.searching「正在检索…」(10496) |
| workspaceFilesEmpty | FALSE | chat.mentionEngine.noMatch「无匹配结果」(10498)（"目录全空"为我方未分的子态） |
| workspaceFilesSearchEmpty | FALSE | fileMention.noMatch「无匹配文件」(15125) |
| pluginLoading | FALSE | unifiedSuggestion.loadingLabel「加载中」(27714)+sourceFailedTag/degradeSingle/Partial/All(27715-27719) |
| pluginEmpty | FALSE | unifiedSuggestion.noMatch「无匹配建议」(27701)+sourcePlugin「插件」(27704)（插件源零条目子态） |
| managePlugins | FALSE | selected-tools-panel.tsx:60 ToolChip(onRemove)+message-input.tsx:937-939 SelectedToolsPanel；pluginMarket(19713) |
| exploreMorePlugins | FALSE | chat.slashCmd.slashMcp「MCP 市场」(11814)+capabilityMarket「能力市场」(11875)+pluginMarket.subtitle「探索…」(19712) |
| pluginSelected | FALSE | message-input.tsx:594-605 selectedToolItems(id→name+integration)+pluginMarket.invokeToast「正在调用 {name} 插件」(19692) |
| summonWaker | FALSE* | unifiedSuggestion.sourceAgent「Agent」(27706)+slashCmd.agent「AI 智能体·管理并调度」(11849-11857)。*若 Waker 为竞品专属"主动唤醒"机制（非泛 Agent 唤起），需竞品语义证据另议（FALSE/UNDETERMINED 边缘） |
| recordingNoteLiveVoiceUnavailable | FALSE | chat.voiceNote 全态(10510-10538)+语音面 conflict「录音纪要进行中…录音与播报不能同时进行」(7478)——互斥约束声明同族 |
| recordingNoteCreateFailed | FALSE | chat.voiceNote.errors.startFailed/saveFailed「录音启动失败,请重试」(10525-10526) |
| unavailable | FALSE | Skill 库 statusComingSoon「即将上线」(11247)+comingSoonHint(11203)+chat.editComingSoon「即将上线,敬请期待」(11504) |
| attachmentLimitReached | FALSE | chat.attachRejectCount「附件最多 {max} 个,本次被拒 {count} 个」(10569) |
| quickNotePasteInvalidPayload | TICKETED(D164) | 速记板粘贴流错误态；D164 速记板已立票 |
| quickNotePasteInvalidImage | TICKETED(D164) | 同上 |
| quickNotePasteTooManyImages | TICKETED(D164) | 同上（每条 5 图上限为竞品内子规则） |
| quickNotePasteInvalidSize | TICKETED(D164) | 同上 |
| quickNotePasteIncomplete | TICKETED(D164) | 同上 |
| exploreMoreSkills | FALSE | chat.slashCmd「Skill 市场」(12060)+Skill 库 viewAll「查看全部」(11255)+skillMarket(25874) |

### composer.referencePreview（8）

| key 末段 | 判定 | 证据指针 |
|---|---|---|
| available | TRUE-GAP | 零命中探针 P1（见 §2）；同组前轮已裁 send/select 真差距候选，本轮坐实并扩及面板骨架键 |
| editor | TRUE-GAP | 探针 P1 零命中 |
| placeholder | TRUE-GAP | 探针 P1 零命中；我方 UnifiedPasteReferencePreview 为被动有效性预览条，无编辑器（相邻不背书） |
| send | TRUE-GAP | 前轮已裁真差距候选+探针 P1 零命中 |
| select | TRUE-GAP | 前轮已裁真差距候选+探针 P1 零命中 |
| clear | TRUE-GAP | 探针 P1 零命中 |
| authorization | FALSE | unifiedSuggestion.authorizationNotice「引用标签不新增执行授权」(27726，D68 安全澄清，可见文本渲染，unified-suggestion-panel.tsx:8-9) |
| source | TRUE-GAP | 探针 P1 零命中（预览"原始输入正文"分区） |

### composer.suggestion（5）

| key 末段 | 判定 | 证据指针 |
|---|---|---|
| skillSource | FALSE | unifiedSuggestion.prov* 来源标注(27708-27713：内置/用户配置本地/用户配置远程/项目配置/市场/插件提供)+resolveProvenance(unified-suggestion-panel.tsx:73-80) |
| pluginId | FALSE | sourcePlugin「插件」(27704)+provPluginProvided(27713)+SelectedToolItem integration 标记(selected-tools-panel.tsx:14-22)（ID 级元信息为我方未展示子态） |
| chatSessionTag | FALSE | message-input.tsx:545-583 handleDropWithConversation(CONVERSATION_DRAG_TYPE→addTextReference)+conversationDragReferenced「已引用会话内容」(11139)+contextSelector.kindPastChats「引用过往会话内容」(15150-15151) |
| fileTag | FALSE | unifiedSuggestion.sourceFile「文件」(27707)+contextSelector.kindFile/descFile(15136-15137)+fileMention(15118-15131) |
| hint | FALSE | unifiedSuggestion.hintSelect/hintConfirm/hintClose(27727-27729)+fileMention.hintSelect/hintConfirm/hintClose(15127-15129) |

### composer.attachments（4）

| key 末段 | 判定 | 证据指针 |
|---|---|---|
| pastedText | FALSE | chat.pasteLongToChip「粘贴内容过长,已自动转为附件引用」(10895)+message-input.tsx:1274 handlePasteWithReferencePreview+use-message-send.ts:349-358 粘贴→File 附件 |
| selectedText | TICKETED(D164) | D164 已立票覆盖「选中摘存」；机制侧 addTextReference 已在位(use-message-references.ts，背景①) |
| convertToText | UNDETERMINED | 零覆盖（探针 P2 仅命中 语音转文字）；缺：竞品该动作作用对象（图片 OCR？速记图转字？）无清单上下文。我方仅 modelCategoryOcr「文字识别」模型类目(10871)+AI 语音转写(14176)，无 composer 附件转文字动作；若属速记板图片流则并入 D164 票面 |
| addError | FALSE | chat.attachRejectType「类型不支持…」(10571)+attachUploadFailed「附件上传失败…」(10572) |

### composer.chatSessionDrop（3）

| key 末段 | 判定 | 证据指针 |
|---|---|---|
| prompt | FALSE | message-input.tsx:545-583 handleDropWithConversation+11139 conversationDragReferenced（拖拽悬停语「松开以引用」为我方未含的悬停子态） |
| disabled | FALSE | message-input.tsx:547-551：流式期回落普通文件拖放（我方为静默回落，无禁用提示子态） |
| duplicate | FALSE | 会话引用能力已覆盖（同 prompt 行）；addTextReference 追加式、无去重提示键（子态差异） |

## 2. 零命中探针记录（HEAD 面）

- **P1（referencePreview 组）**：`git grep -n -e "发送预览" -e "示例能力" -e "引用预览" -e "模拟能力" -e "原始输入正文" -e "能力引用" HEAD -- apps/web/src packages/shared/src` → **无输出（EXIT 1）**；两包 HEAD 同串零命中、零 `composer.*` 键。
- **P2（速记/文本附件组）**：`git grep -n -e "速记" -e "摘存" -e "选中的文本" -e "粘贴的文本" -e "转为文字" -e "转文字" HEAD -- apps/web/src packages/shared/src` → 仅 2 行且均为"语音转文字"（message-input.tsx:1372、nav-data.ts:534），速记/摘存/转文字零命中。
- **P3（唤起/会话拖放/Live Voice）**：`git grep -n -e "唤起" -e "Waker" -e "waker" -e "松开以" -e "引用会话" -e "过往会话" -e "Live Voice" -e "liveVoice" HEAD -- apps/web/src packages/shared/src` → 15 行均为模态/窗口/系统浏览器"唤起"或注释"引用会话标题"（message-input.tsx:573，恰为会话拖拽引用实现）；**Waker/Live Voice/松开以 零命中**。

## 3. TRUE-GAP 能力组（仅 1 组，7 键）

### G1：composer 能力引用模拟预览编辑器

**竞品键+显示串原文**（Qoder CN v0.4.3）：
| 键 | 原文 |
|---|---|
| composer.referencePreview.available | 模拟能力可用 |
| composer.referencePreview.editor | 能力引用输入框 |
| composer.referencePreview.placeholder | 粘贴完整引用或输入 @名称… |
| composer.referencePreview.send | 发送预览 |
| composer.referencePreview.select | 选择示例能力 |
| composer.referencePreview.clear | 新建输入 |
| composer.referencePreview.source | 原始输入正文 |

（同族第 8 键 authorization「此预览不请求模型。标签展示不会新增执行授权。」判 FALSE——我方 authorizationNotice(27726) 同语义已覆盖。）

**零命中探针摘录**：P1 六串在 `apps/web/src`+`packages/shared/src`@HEAD 与两包 HEAD 均零命中（EXIT 1）。我方最相邻机制为 D68「粘贴引用有效性预览条」（message-input.tsx:292/1274 + unified-suggestion-panel.tsx:380-417：仅展示粘贴内容中 @token/`path` 的有效/未识别态），**无**输入编辑器、无模拟能力、无示例选择、无发送预览——按相邻机制不背书，不冲抵本组。

**建议票面（一句话）**：composer 增设"能力引用模拟预览"——可粘贴完整引用或 @名称、选择示例能力，预览引用标签展示（明示不请求模型、不新增执行授权），支持发送预览与新建输入。

## 4. 非票级子态备注（不立票，供后续票面增强参考）

1. 会话拖拽缺悬停提示「松开以引用会话」与重复引用去重提示（chatSessionDrop.prompt/duplicate 子态）。
2. 流式期间会话拖放静默回落文件拖放，无「不可编辑」解释（chatSessionDrop.disabled 子态）。
3. 文件/建议列表「目录全空」与「无匹配」未分态（workspaceFilesEmpty 子态）。
4. 建议项展示 ID 级元信息（pluginId）与逐条「来源：{{source}}」格式未完全对齐竞品，prov* 标注已覆盖语义。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
