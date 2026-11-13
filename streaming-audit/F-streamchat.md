<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# F 段审计 · streamChat 权威解析层

> 目标：`packages/api-client/src/client.ts` 的 `export async function streamChat`（L4223–约 L6506）及其直接依赖 helper。
> 方法：grep 定位 + `read_file` 带 offset/limit 读片段（每次 ≤120 行），只读 L4223–6528 与 helper 关键段，未全文件通读、未读 `dist/`。
> 本轮实际读到的证据段（行号为本文件行号）：`parseStreamLine` L2509–2609、`attachErrorMeta` L2611–2629、`extractAgentId` L2636–2655、`runResumableSSEStream` 调用点与终态 L6393–6506、onAttemptStart L6433–6448、error 分类 L6467–6504；grep 定位到的 emitDelta / frameWatermarkRef / frameSeqTracker / streamAuthority / frameBarrier 各锚点行（未逐段通读其完整实现）。**未覆盖**：`emitDelta` L4573–4596 逐字、`frameSeqTracker.observeLine`/`observeGap`/`observeReconnect` 完整实现、`stream-authority.ts` 内部、`SSE_FRAME_SCHEMAS`、`runResumableSSEStream` L4082–4221 内部（重连/退避/读超时/游标收敛）、`processLine` L6320–6391 之外的各 tryParse* 分支。以下凡未直接读到实现者均标注「未读实现，仅据锚点/调用点推断」。

---

## 一、确凿缺陷

### F1（Q3，重点复核）emitDelta dedupe 前缀 `return` 路径 —— 结论：**不丢内容，原判断不成立**

- 位置：`client.ts` emitDelta L4573–4596（grep 锚点确认存在 `receivedContentRef.current += delta` / `+= dedupeBuffer` / `+= tail` 三条累加路径，L4576/4584/4592/4595）。
- 复核：所谓「L4581–4587 当 `dedupeBuffer.length < received.length && received.startsWith(dedupeBuffer)` 直接 return，尾会永久丢」——**该 return 不丢内容**。`received`（= `receivedContentRef.current`）本身已经包含那段已接收内容（它就是历史累计串），`return` 只是「这段已在 received 里，无需重复 append」，不是丢弃。中断发生在其后的帧上，received 里仍有前缀，续传时 dedupe 再跑一遍即可收敛。
- 但存在一个**真实的边界重叠风险（推断，未读 emitDelta 全文）**：dedupe 只在前缀方向判断「received 是否以 dedupeBuffer 开头」。若服务端重发不是「从头重发」而是「从断点续发增量」，则新的增量与 received 尾部存在**部分重叠而非前缀包含**，L4592/4595 的 `+= tail` / `+= dedupeBuffer` 可能把重叠段再拼一次 ⇒ 正文出现重复片段。复现条件：服务端重连后从「上次已发的中间某帧」续发（非从 0 重放），且帧边界与 received 长度不对齐。影响：用户看到重复文字。**P1（条件性）**。注：dedupeActive 仅在 `isRetry && receivedContentRef.current.length > 0`（L6435）时开启，正常首发不触发。

### F2（Q4）正常结束 / 业务错误终态未 `reader.cancel()`

- 位置：终态段 L6461–6466（`emitFrameWatermarkFacts('stream-end')` → `opts.onDone?.()` → `return`）与业务错误段 L6492–6503（`opts.onError(...)` → `return`）。这两条 return 路径**未出现 `reader.cancel()`**。
- 复现条件：流以 `[DONE]`/done 帧正常收尾，或收到 error 帧走 onError 终态，而底层 fetch body reader 仍持有未读完的流。
- 影响：reader / 底层连接未主动释放，依赖 GC 或连接自然关闭；在 keep-alive 连接上可能占用连接槽。**P2**（正常收尾时服务端通常已关流，实际泄漏窗口小；但 error 终态若上游仍在推帧，则连接确实未显式取消）。注：读超时路径的 cancel 行为**未读实现**（在 runResumableSSEStream L4082–4221 内），不下结论。

### F3（Q8）流内 error 帧被当「网络错误」重连，已发内容保留但语义混淆

- 位置：`parseStreamLine` L2539–2556 把 `type==='error'` / `error===true` / `code+message` 三类帧统一 `throw attachErrorMeta(...)`（抛 `SSEError`）；该 throw 会沿 onLine → runner 抛出，runner（runResumableSSEStream）按「可重试错误」尝试重连，attempt 未耗尽则重开。
- 复现条件：服务端发业务错误帧（如 `errorCode: LLM_ERROR` 402 配额耗尽），此时 attempt 计数未用尽。
- 影响：业务错误被当网络抖动重连，多打一轮上游请求（费 token / 延迟）；重连后再收同一 error 帧，直到 attempt 耗尽才落到 L6476 `getSSEErrorInfo` 分类。已发内容**不清空**（receivedContentRef 跨 attempt 累计，无 reset），所以前端不会丢已渲染文本，但 `recoverable: !isBusinessError`（L6499）在最终上报里会把这条标记为可重试。**P1**：把确定性业务失败（配额/鉴权语义）当瞬时故障重试，放大成本且错误语义被推迟一轮才上报。

### F4（Q1）无 SSE 多行 data 拼接状态机 —— 多行 data 帧会丢内容

- 位置：`parseStreamLine` L2509–2516（逐行处理，`data:` 剥前缀后立即解析，`event:`/`id:`/`retry:` 直接 return null，注释行 `:` return null）。
- 复现条件：服务端按 SSE 规范把一条消息拆成多行 `data:`（如 `data: {"a":\ndata: 1}`）后以空行分帧。
- 影响：本实现把每行 `data:` 当独立消息，多行拼接的帧解析失败（JSON.parse 抛 SyntaxError → L2606 `return data`，把原始片段当纯文本增量吐出）⇒ 正文被污染或内容丢失。同时 `event:` 行被完全忽略 ⇒ 依赖 event 名分流的协议（非 Vercel `N:` 前缀、非裸 JSON 的命名事件）无法路由。CRLF：`line` 若含尾 `\r`，`data:` 剥前缀后不影响 JSON 解析（`\r` 在 JSON 尾部合法），但**纯文本增量会带 `\r`**（未 strip）。`retry:` 被忽略 ⇒ 服务端建议的重连间隔不被采纳（runner 自持退避）。**P2**（当前服务端用 Vercel `N:` 前缀 + 裸 JSON 单行帧，未踩多行路径；属协议健壮性缺口）。

### F5（Q2）JSON.parse 失败处理跨 handler 不一致

- 位置：`parseStreamLine` L2531–2532 JSON.parse 包在 try/catch，L2605–2607 `if (e instanceof SyntaxError) return data` —— 非法 JSON **降级为纯文本增量**（不是抛错中断、不是静默吞）。
- 对比：`extractAgentId` L2648–2653 catch 静默 return undefined；`0:` 前缀分支 L2522–2527 catch fallthrough return null（静默吞）。三类 handler 对「非法 JSON」给出三种行为：降级成正文 / 静默忽略 / 静默吞。
- 影响：`parseStreamLine` 的「降级成正文」最危险 —— 一个被截断的 JSON 帧（网络分片边界）会被当纯文本喷进正文气泡，污染回答且无任何告警。**P1**。注：`processLine`（L6320–6391）如何调用 parseStreamLine 并区分「返回的纯文本」与「真增量」**未读实现**，若上游已先按帧边界重组则截断概率降低，但降级语义本身仍是隐患。

---

## 二、不完整实现

- **Q5 era/代际切换防护**：锚点显示 attempt 重启用 `streamAuthority.observeReconnect()`（L6447）、`frameBarrier.reset()`（L6443）、`openAiAccumulator.reset()`（L6445）、`frameWatermarkRef` 经 `held: frameWatermarkRef.current`（L4287）交接。但 grep 注释自陈（L2318）「`readFrameWatermark` 在真机上恒 `undetermined`、丢帧恒 0」——**载荷级水位腿恒不下发** ⇒ era 切换时若 seq 腿（`frameSeqTracker`，从 `id:` 派生）也判不出 discontinuity，两纪元状态会被拼接而无人察觉。`frameSeqTracker` / `stream-authority.ts` 的 observeGap/observeReconnect 完整实现**未读**，不下最终结论，但「水位恒 undetermined」这一自陈事实使 era 防护的实际有效性存疑。**不完整**。
- **Q7 超时**：grep 确认仅一处读超时 `readTimeoutMs: STREAM_READ_TIMEOUT_MS`（L6428，注释称 = 2 拍心跳间隔、原为 30s）。**未见**首 token 超时、整体流超时、连接建立超时的独立设置。未设后果：上游挂住不发帧但连接未断时，只能靠读超时兜底；若上游保持心跳但永不结束，流可无限挂起（无整体超时）。**不完整**。
- **Q6 abort 传播**：L6424 `signal: opts.signal` 透传给底层 fetch；L6468 `isAbortError` → 走 `opts.onDone?.()`（非 onError）。即调用方 abort 后**回调语义是「完成」而非「取消」**，且 abort 时是否 `reader.cancel()` **未读实现**（在 runner 内）。上游 LLM 是否被取消取决于 fetch abort 是否真正断开连接（浏览器 fetch abort 通常会断，从而通知服务端停推）——但无显式 `reader.cancel()` 证据。**存疑偏不完整**。

## 三、存疑

- **Q3 O(N²)**：`received.startsWith(dedupeBuffer)` 每帧对累计串做前缀比较，长回答下 received 可达数十 KB，逐帧 startsWith 累计 O(N²)。长流（>100KB 正文）是否有可测卡顿**未实测**，存疑。
- **Q1 `id:` 游标**：grep 见 `processLine` L6330 有 `if (!line.startsWith('data:')) frameSeqTracker.observeLine(line)`，推断 `id:` 行被 seqTracker 消费做游标；但游标如何注入续传头（`appendResumeEventIdHeader`）**未读**，重连续传是否真的带上了正确 `Last-Event-ID` 未验证。
- **Q8 已发内容保留/清空**：receivedContentRef 跨 attempt 不 reset（onAttemptStart 只 reset dedupeBuffer/agentDedupeBuffer/seenTraceId/accumulator/barrier，L6436–6445 无 receivedContentRef 清零）⇒ 已发内容保留。是否符合产品预期（部分回答 + error 上报并存）**未读调用方约定**，存疑。

## 四、未覆盖

- `emitDelta` L4573–4596 逐字实现（F1 基于三条累加锚点 + 语义推理，未逐行读）。
- `runResumableSSEStream` L4082–4221 完整实现（重连判定 / 指数退避 / Retry-After 消费 / 读超时 cancel / 续传游标收敛 / attempt 耗尽判据）。
- `frame-ownership-barrier.ts`、`stream-authority.ts`、`frame-watermark.ts`（含 `readFrameWatermark`/`isFrameGap`/`frameWatermarkGapAction`）内部实现。
- `SSE_FRAME_SCHEMAS` 定义与校验逻辑。
- `processLine` L6320–6391 全文、各 `tryParse*`（usage/toolDelegate/partialDone/sendAdmission/steer/budget 等）分支的 JSON.parse catch 一致性。
- 现有测试对 streamChat 本体的覆盖：`packages/api-client/src` 下测试文件为 `openai-tool-stream.test.ts` / `stream-frame-log.test.ts` / `open-timing.test.ts` 等，**未读**其是否覆盖 streamChat 主流程（glob 命中但未读内容）。
- L4823–5733 之间的各 event handler 主体（本轮未逐段读，F5 的 handler 一致性结论仅覆盖 parseStreamLine / extractAgentId / `0:` 前缀三处直接读到的）。

---

## 结论汇总

| 编号 | 问题域         | 级别         | 一句话                                                         |
| ---- | -------------- | ------------ | -------------------------------------------------------------- |
| F1   | Q3 dedupe 边界 | P1（条件性） | 「尾永久丢」不成立；但「服务端只发增量」时边界重叠可致正文重复 |
| F2   | Q4 资源清理    | P2           | 正常结束/业务错误终态未显式 reader.cancel                      |
| F3   | Q8 错误帧      | P1           | 业务 error 帧被当网络错误重连，放大成本且推迟上报              |
| F4   | Q1 SSE 解析    | P2           | 无多行 data 状态机、event:/retry: 忽略、纯文本尾 \r 不 strip   |
| F5   | Q2 JSON.parse  | P1           | 非法 JSON 降级成正文增量（污染回答），跨 handler 行为不一致    |

**确凿缺陷：5 条（P1×3，P2×2）。** 核心 P1：F3（业务错误重连，成本+语义）、F5（非法 JSON 降级污染正文）、F1（dedupe 增量场景重复）。Q4/Q7 的 reader 超时 cancel 与 abort 时 cancel 行为、Q5 era 防护有效性、Q6 abort 时上游是否真取消 —— 均因 runResumableSSEStream L4082–4221 内部未读而**未下最终结论**，已标未覆盖。

---

## 六、主 agent 亲自复核（读代码验证，补齐 sub-agent 未覆盖段）

复核范围：`runResumableSSEStream` 主体 L4082-4221、终态处理 L6461-6500、attachErrorMeta L2611-2629、emitDelta L4573-4599。

### F3 确认成立（流内业务 error 帧被当网络错误重连）

attachErrorMeta（L2611-2629）只在 `json.code/statusCode/status` 是 number 时才设 `err.code`。流内业务 error 帧（如 402 配额耗尽）**通常不带这些字段** ⇒ `getSSEErrorInfo(err).code === undefined` ⇒ runner catch（L4207-4208）判 `isBusinessError=false` ⇒ 走重试路径（L4212-4218 指数退避）。确定性业务失败被反复重投直到 attempt 耗尽，多打上游、白烧 token+延迟。**证据确凿**。

### F1 修正 sub-agent 的"丢尾"表述（不丢内容，但重复风险确认）

emitDelta L4581-4587：`dedupeBuffer.length < received.length` 且 `received.startsWith(dedupeBuffer)` 时 return —— 因为 received **已含**那段内容，return 只是避免重复 append，**不丢内容**。sub-agent 此判断正确。但 L4589-4595 的 `+= tail` / `+= dedupeBuffer` 在"服务端重连后从中间续发增量（非从头重放）"时，会把与 received 尾部部分重叠的段再拼一次 ⇒ 正文重复。条件性触发，真实但低频。

### F2 修正：终态确未显式 reader.cancel()，但影响有限

正常结束（L6461-6466）与 error 终态（L6492+）两条 return 只调 onDone/onError，**未显式 reader.cancel()**。缓解因素：读超时（readWithTimeout L4163）会 reader.cancel()；流自然 done 则连接已闭。真实残留：error 终态时若上游仍在推帧，连接靠服务端/GC 收尾，前端不主动断。P2 成立但非紧急。

### F4 部分修正：consumeLine 确实 strip 了 \r

L4175 `const line = raw.replace(/\r$/, '')` —— **CRLF 尾部 \r 已被 strip**，sub-agent 称"纯文本增量尾 \r 不 strip"不成立（那是对 parseStreamLine 而非 consumeLine 的误判）。但"无 SSE 多行 data 状态机、event:/retry: 被忽略"这两点确认成立。

### 新增确凿：F6 读超时已实现（修正 Q7"无超时"的存疑）

readWithTimeout（L4155-4172）实现了**读空闲超时**（STREAM_READ_TIMEOUT_MS），超时 reader.cancel() 并抛错触发重连判定；行缓冲熔断（L4188，1MB 上限）防"持续发数据永无换行"的畸形流打满内存。这两个防护到位。**仍缺**：首 token 专用超时、整体流超时（read idle 不覆盖"慢速持续吐字"）。

### 资源清理（Q4/Q6）确认

- 读超时：reader.cancel() ✓（L4163）
- abort：isAbortError 直接 throw（L4202），上层 abortController 负责关闭连接 ✓
- 正常/业务错误终态：未显式 cancel（F2，靠服务端/GC）⚠️

### 最终定级

- **P1**：F3（业务 error 重连白烧 token，证据确凿）、F5（非法 JSON 当正文增量污染回答，L2606 证据确凿）、F1（dedupe 中间续发重复，条件性）
- **P2**：F2（终态未 cancel）、F4（无多行 data 状态机；\r 已修正为非缺陷）
- **新增 F6**：读超时+行缓冲熔断已实现（澄清 Q7 存疑）；缺首 token/整体超时

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
