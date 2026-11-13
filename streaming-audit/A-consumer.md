<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Web 流式对话 · 前端消费主链路审计（A-consumer）

审计对象：`apps/web/src/hooks/use-chat/` 消费侧
日期：2026-11-13
审计人：子代理（流式消费链路）

## 覆盖情况

| 文件               | 覆盖                                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| stream-runtime.ts  | **全读（60行）**                                                                                                                              |
| stream-handlers.ts | **全读（361行）**                                                                                                                             |
| send-message.ts    | **片段**（285-344 入口防重、690-779 controller/代际/超时；onDone/onDelta/onToolCall/onError/finally 仅 grep 定位行号，**未逐行读 900-1960**） |
| send-answer.ts     | **仅 grep 行号**（115/147/163/486/512/645/678/718-750），**未读正文**                                                                         |

**重要边界澄清**：SSE/WS 帧解析（`data:` 行切分、`JSON.parse`、event→handler 分发、WS 重连）**不在本仓消费侧**，全部封装在 `packages/api-client` 的 `streamChat()`（`client.ts`）。本侧（send-message/send-answer）只是 `streamChat` 的回调接线方。因此问题 1/2/6 的解析完整性、帧边界、reader 关闭**主体在 api-client，本次未审**，见"未覆盖"。

---

## 一、确凿缺陷

### C1 · P1 · tool-delta 早到帧被静默丢弃（stream-handlers.ts:193-207）

```ts
// createToolDeltaHandler
const tc = message?.toolCalls?.find((t) => t.id === event.toolCallId)
if (!tc) return // ← tool-call-start 尚未建卡时，partialDiff 直接丢
```

**复现**：`tool-delta`（D113 文件写工具 diff 预览帧）先于 `tool-call-start` 到达，或 resume/回放场景下 delta 与 start 非严格有序。
**影响**：该 toolCallId 的流中 diff 预览首片丢失；若 start 永不补发（服务端只发 delta 帧的工具路径），整段 partialDiff 预览全丢，用户看不到"改文件中"的实时 diff，直到 tool-result 才一次性出结果。
**对比**：同文件 `createOpenAiToolCallHandler`(221) 在 `!existing` 时**会建卡**，两个 handler 对"卡不存在"的处理策略不一致——openai 路径自建，D113 路径丢弃。D113 头注只写了"仅 running 态渲染"，未覆盖"卡未建"这一态。

### C2 · P2 · OpenAI toolCallId 合成键可跨工具碰撞（stream-handlers.ts:229-231）

```ts
const toolCallId = delta.id || idByIndex.get(delta.index) || `openai-${delta.index}`
idByIndex.set(delta.index, toolCallId)
```

`delta.index` 来自 OpenAI 首片的数组下标；若上游某片 `id` 为空且 `index` 也 undefined，多张卡都合成 `openai-undefined`，`idByIndex` 用 `undefined` 作键互相覆盖，后续 delta 全部归到同一张卡。低概率（依赖上游畸形帧）但一旦命中，参数预览串台。`idByIndex` 也无本轮结束清空（跨轮残留，靠 id 存在性兜底，影响有限）。

---

## 二、不完整实现

### I1 · tool-delta 与 openai-toolcall 对"卡不存在"语义分叉

见 C1。建议 D113 路径对齐 openai 路径：`!tc` 时按 toolCallId 建占位 running 卡（toolName 未知可空），或至少记录丢弃计数便于排查。

### I2 · 超时定时器命名与实际值不一致（send-message.ts:747-760）

变量名 `timeout15sId`/`abortedByTimeout15s`，实际 `setTimeout(..., 30000)`（30s，2026-07-27 由 15s 调到 30s）。仅命名债，不影响行为，但会误导后续维护者以为有两档 15/60，实为 30/60。**非 bug**。

---

## 三、针对 6 个问题的回答

**Q1 事件解析完整性**：本侧不解析帧，只接 `streamChat` 的 `onDelta/onDone/onError/onToolCall/onUsage/onToolSummary/onReviewFinding/onOpenAiToolCall` 等回调。stream-handlers.ts 提供了 tool-call-start/tool-result、tool-delta、openai-toolcall、tool-summary、usage、review-finding 的消费工厂，覆盖面完整。**帧解析与未知 event 类型的兜底在 api-client，本次未审 → 未覆盖。**

**Q2 delta 拼接/JSON 解析失败**：正文 delta 走 `createSmoothDeltaBatcher`（纯字符串 append，无 JSON，无帧边界问题）。工具参数流式由 `createOpenAiToolCallHandler` 处理，但它吃的是**已解析**的 `OpenAiToolCallDelta`（args 已是对象），JSON 解析失败在 api-client 内。`partialArgs` 缺片时保留上次值不清空（stream-handlers.ts:255-259），处理得当。**原始帧边界/JSON.parse 失败处理未覆盖（api-client）。**

**Q3 状态机闭合性**：send-message.ts 有明确代际机制——`streamGenerationRef`(720)、`streamConversationRef`(721)、`turnHadReceipt/turnHasEvidence/serverClosedWithError/failureAnnounced`(737-746) 一组标志 + `finally` 代际守卫(1806 注释、1813 `setStreaming(false)`)。超时 30s/60s(749-760) + 用户 stop 都 `controller.abort()`，abort 路径 api-client 补 onDone 后静默收束(1914)。**本侧未发现卡死态**；但 send-answer.ts 的 finally(718-750) 未逐行读，其状态回收是否与 send-message 同谱**未确认**（750 行注释提及 isStreaming/streamingAssistantId/aiStreamSessionId 三键回收，方向正确）。

**Q4 竞态**：重复发送有双保险——`sendInFlightRef`(294 在途锁，覆盖 await 间隙) + `store.isStreaming`(315)。快速切会话：`streamConversationRef` + 切会话 effect abort 旧流，旧流 finally 靠代际守卫跳过全局清理，避免污染新流(717-720、1806)。**设计正确**；但 sendInFlightRef 在各提前 return 处手工解锁(326/336/344...)，存在漏解锁风险面（若某分支新增未解锁），且 send-answer.ts 是否同样有在途锁**未读正文未确认**。

**Q5 工具调用流**：累积完整——openai 路径按 index 归位、partial→complete 两态写 args/清预览；D113 路径按 seq 幂等追加 partialDiff(202-205)；tool-result 统一清 partialDiff/partialSeq/partialArgs/argsStreaming(171-176)。工具结果回流：tool-result 写 result/status/durationMs/serverSource/媒体 url/retryCount 到 tc。**除 C1 的早到帧丢失外无缺**。参数 JSON 流式解析本体在 api-client（未覆盖）。

**Q6 资源清理**：本侧只持有 `AbortController`（abortRef.current = controller，715-716），无 EventSource/reader（封装在 api-client）。超时/stop/切会话都经 controller.abort() → api-client 内部关 reader。监听器：本侧无 addEventListener 泄漏面（CustomEvent 注册面在 stream-runtime 的 sendInstance/actionCtx，按 store 实例隔离）。**api-client 的 reader/EventSource 关闭时机未审 → 未覆盖。**

---

## 四、存疑（需后续核）

- **S1**：send-message.ts 900-1960（onDone/onDelta/onToolCall/onError 回调体 + finally 全量）本次仅 grep 定位，**未逐行读**。onError 的 BUDGET_EXHAUSTED/429 分支(1429、1625)、finish-reason 截断处理、settle 结算逻辑是否存在竞态或漏清，需二轮。
- **S2**：send-answer.ts 全文未读，与 send-message 的对称性（在途锁、代际守卫、三键回收）仅由注释行号推断。
- **S3**：`streamChat`（api-client/client.ts）的 SSE 帧切分、WS 重连、未知 event 兜底、reader 关闭、JSON.parse 失败路径——**本次核心解析链路未覆盖**，问题 1/2/6 的权威结论取决于此。

## 结论

确凿缺陷 **2 条**：C1(P1) 早到 tool-delta 丢预览、C2(P2) 合成 id 碰撞。
P0：**0 条**。消费侧状态机/竞态/资源清理设计有代际守卫 + abortController 双保险，无 P0。
**最大缺口**：真正的问题 1/2/6（帧解析、JSON 失败、reader 关闭）全在 `packages/api-client` 的 `streamChat`，本次时间预算内未审，建议下一轮定向审计 `client.ts streamChat`。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
