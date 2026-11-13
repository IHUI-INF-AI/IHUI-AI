# Web 流式对话中断重连恢复 — 审计报告（B-resume）

审计范围：`apps/web/src/hooks/use-chat/` 下 `resume-stream.ts`(452)、`pending-send.ts`(248)、`turn-answer-fallback.ts`(138)，辅以 `stream-alerts.ts`(92)、`stream-error-report.ts`(155)。
方法：grep 定位 + 只读关键片段（未跑测试、未逐行读大文件）。已知勿重复报：显示层 D1–D6（代理对/末帧/跟底/setData/解码，已修）。

---

## 一、确凿缺陷

### B-1（P1）resume 续传无游标/offset，且逐 delta 无幂等去重 → 重连后内容可能重复或整段重生成
- 位置：`resume-stream.ts:289-292`、`309-312`；辅证 grep 全文。
- 代码摘录：
  ```ts
  const delta = parseStreamLine(line)
  if (delta) { sawAnyDelta = true; batcher.batch(delta) }   // 289-292
  ...
  const delta = parseStreamLine(buffer)
  if (delta) { sawAnyDelta = true; batcher.batch(delta) }    // 309-312
  ```
  batcher 回调直写：`chatStore.getState().appendToMessage(p.messageId, delta)`（204-206）。
- 证据：对 `resume-stream.ts` grep `offset|cursor|index|sequence|seq|since` **唯一命中** `buffer.indexOf('\n')`（283）。即整条 resume 路径**没有任何 seq/cursor/offset 断点**。真正的水位机制（`cursor`/`fromSeq`/`toSeq`/`logEpoch`/`subscriptionId`，见 `stream-error-report.ts:120-138` 的 frame-watermark facts）只接在 **send-message 主链**（`send-message.ts:1622-1634` `onFrameWatermarkFacts → reportFrameWatermarkFacts`），resume 路径**未接**。
- 实际机制：resume 不做断点续传，而是 ① `GET /api/chat/resume/status` 查是否已落库，已落库则用服务端全文 `editMessageContent` 整体替换（185-192）；② 未落库则 `POST /api/chat/resume` 把"已生成前缀"作为末条 assistant 放进上下文（buildResumeMessages, 234），让模型**重新生成尾段**，前端把新 delta **追加到仍含前缀的同一 messageId**（appendToMessage）。
- 复现/影响：
  - 续生成流若与前缀边界重叠（模型复述尾段），重复文本被 append 进同一条气泡，无任何 seq/内容去重拦截 → **重复**。
  - resume 中途再断，因无游标，只能从头再发一次 resume（重新生成整段尾），既**浪费一次 LLM 调用**又再次暴露上述重叠重复风险 → **重复/丢失（尾段被覆盖）**。
- 定级：**P1**（核心正确性，重连场景必经路径）。

### B-2（P1）resume 流中断/解析错误早退，部分答案滞留气泡且无落库补全 → 用户看到残缺回答
- 位置：`resume-stream.ts:294-303`（parse 抛错 `notifyResumeFailed` 后 `return`）、`325-334`（catch 早退）、`267-271`（`!resp.ok` 早退）。
- 代码摘录：
  ```ts
  } catch (err) {
    notifyResumeFailed(p, err instanceof Error ? err.message : String(err), ...)   // 296-302
    return
  }
  ```
- 影响：中断前已通过 `appendToMessage` 写进占位行的**部分 token 原样留在气泡**里；resume 路径**全程没有任何服务端持久化调用**（仅读 `/status`、写不落库），finally 只做 `clearRunScopedState`（345）。配合 B-4（fallback 对"非空但残缺"的轮零写入），残缺尾段既不补齐也不落库 → **用户看到残缺回答**。
- 定级：**P1**。

### B-3（P2）reportStreamError 无频控/合并/去重 → 潜在告警风暴
- 位置：`stream-error-report.ts:82-93`。
- 代码摘录：
  ```ts
  export function reportStreamError(report: StreamErrorReport): void {
    if (typeof window === 'undefined') return
    try {
      void fetchApi('/api/crash-reports', { method: 'POST', ... }).catch(() => {})
    } catch { /* 上报失败静默 */ }
  }
  ```
- 影响：每次 `onError` 都无条件 fire-and-forget POST（调用点 `send-message.ts:1634`、`send-answer.ts:650`）。无令牌桶、无按 errorCode/时间窗去重、无采样。循环重连/每帧报错场景会向 `/api/crash-reports` 打满，构成**告警风暴**。
- 定级：**P2**（正确性无碍，稳定性/后端负载风险）。

### B-4（P2）pending-send 多标签页竞态：跨标签共享 storage 但读-改-写无锁，隐私模式完全失防
- 位置：`pending-send.ts:162-172`（`ledgerSingleton` 整页一份）、`190-221`（`claimPendingSend`）、`57-66`（storage 适配）。
- 代码摘录：
  ```ts
  let ledgerSingleton: PendingCommandLedger | null = null   // 162 整页一份
  ...
  if (hasProjectedAnswer(rows, text)) { book.reconcile([...]) }   // 201-203
  const existing = book.list().find((r) => r.commandId === commandId)  // 206
  if (existing && input.force !== true) return { allowed: false, ... }  // 207-209
  ...
  book.register({ commandId, conversationId, preview: ... })      // 215-219
  ```
- 影响：`commandId = fnv1a(conversationId+text)` 确定性生成，localStorage 跨标签共享，理论上能去重；但 `list()` → 判定 → `register()` 是**无锁读-改-写**，两标签并发 claim 同一指令时 last-writer-wins，可能**双双放行**或**丢条目**（无 BroadcastChannel / storage 事件跨标签广播 / 无 compare-and-swap）。且 localStorage 不可用时退到**每标签独立内存** storage（57-66 注释"只吞不抛"），跨标签去重**完全失效**。
- 定级：**P2**（多标签同会话并发发送去重不可靠）。

---

## 二、不完整实现

1. **turn-answer-fallback 的 `append` 档生产未接线**（`turn-answer-fallback.ts:29-33`，作者自述）：web 终态契约里没有"携带全文的终态帧"（api-client `onDone` 无参、SSE 无全文尾帧），故生产路径真实生效的只有 `empty`/`duplicate` 两档，`append`（补唯一一条权威答案）是"给终态帧带全文那一天留的路径"。**不得声称已端到端生效**。
2. **对"非空但残缺"的轮，兜底判据判 `duplicate` 零写入**（`turn-answer-fallback.ts:21`、`107-109`）：兜底只处理"回合结束没有任何答案落点"的**空轮**；已部分流式落进占位行的内容按内容幂等判 `duplicate`，不做完整性补齐 → 与 B-2 叠加，残缺尾段无人修复。
3. **resume 路径未接 frame-watermark（b76-15）诊断**：`reportFrameWatermarkFacts`/seq-cursor 事实只在 `send-message.ts:1622-1634` 主链接线，resume 续传段既不产 seq 水位、也不上报断档（disposition=drop/replace-segment 仅主链语义），中断重连的丢帧无法观测。

---

## 三、存疑（需进一步取证，本轮未读到实现）

- **跨标签去重是否真靠 localStorage 生效**：取决于共享层 `createPendingCommandLedger` 的 `list/register/reconcile` 是否每次从 storage 重读（而非依赖页内缓存）。共享层实现未读 → B-4 的"双双放行 vs 部分去重"结论待确认。
- **服务端 `/api/chat/resume` 是否保证续生成不重复前缀**：属 ai-service/api 端契约，前端三文件未覆盖 → B-1 的"重叠重复"触发概率取决于服务端，前端无防御是确定的。
- **resume 幂等键**：`metadata.messageId`（247-251）已透传后端，是否被后端用作幂等去重键未读后端 → 无法确认重放是否被服务端挡掉。

---

## 四、五个问题的直接回答

1. **游标/offset 计算**：**没有**。resume 不做断点续传——先 `/status` 查落库（已落库则服务端全文整体替换），未落库则把已生成前缀塞进上下文让模型**重生成尾段**，前端 append 到同一条消息。增量既可能重复（边界重叠/重复 resume）也无断点（再断只能整段重来）。frame-watermark 的 seq/cursor 机制只接主链，resume 未接。**存在重复/丢失风险（B-1）**。
2. **同一条 delta 幂等/去重**：**无**。逐 delta 仅 `parseStreamLine → batcher.batch → appendToMessage`，无 message-id/序列号去重、无内容幂等（B-1）。仅有的保护是 401 重放发生在"读流之前"（262-265，注释明示不会产生重复），属连接级而非 delta 级幂等。
3. **pending-send 重试/多标签**：**无自动重试逻辑**——只有"准入准入（claim）+ 结算（settle/reconcile）"账本：投影到达/服务端明确拒/用户停止时 reconcile；未确认前同一 commandId 拦下发（`force` 为人工放行且重算 TTL）。多标签靠 localStorage 共享 + 确定性 commandId 去重，但**读-改-写无锁**、无跨标签广播、隐私模式退内存则失效（B-4）。
4. **部分答案是否落库/用户看残缺**：resume 路径**不落库**（只读 status、无持久化写）；中断后已 append 的部分 token 滞留气泡，turn-answer-fallback 对非空残缺轮判 `duplicate` 零写入、`append` 档生产未接线 → **用户会看到残缺回答，无补齐**（B-2 + 不完整实现 1/2）。
5. **错误分级/告警风暴抑制**：分类靠 `buildStreamErrorReport` 从 `SSEErrorInfo` 取 `code/errorCode/retryAfter/recoverable/traceId`（有值进、无键缺席），message/route 过 `redactCrashText` 脱敏并截断，fire-and-forget POST `/api/crash-reports`、SSR 不发、失败静默——**但无频控/去重/采样 → 有告警风暴风险（B-3）**。`stream-alerts`（D155）是另一条**显示**通道：三档（configWarning/deprecationNotice/guardianWarning）模块级 snapshot，`setStreamAlert` 同档覆盖（天然抑制重复同档）、`clearStreamAlert`/`clearAllStreamAlerts` 空时零通知避免无谓重渲，severity 二次归一；这是"上屏告警"而非错误上报，本身无频控需求。

---

## 五、未覆盖

- `resume-stream.ts` 头部 1-159（常量 `RESUME_TIMEOUT_MS`、`ensureMessagePresent`、`buildResumeMessages`、`findPendingResume` 实现）与 400-452（`useResumeBranch` 主体）未逐行读。
- `pending-send.ts` 1-159（`createWebPendingStorage` 全貌、共享账本接口注释）及共享层 `createPendingCommandLedger` 实现未读。
- `send-message.ts` / `send-answer.ts` 主链 `onError` / `onFrameWatermarkFacts` 接线段仅 grep 命中，未读上下文。
- `stream-alerts` 消费端 `message-input.tsx`（StreamAlertBar）未读。
- 未跑任何测试（含 `resume-stream.test.ts`）。
