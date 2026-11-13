<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 流式对话后端 WS 产出层审计（C-backend）

范围：`apps/api/src/plugins/ws-ai.ts`（1302 行，grep 定位 + 抽样读关键段）、`sse-registry.ts`（51 行，全读）、`http-conn-guard.ts`（161 行，全读）。审计时间 2026-11-13。按委派要求未逐行读 1302 行、未跑测试。

## 一、确凿缺陷

### C1. WS 无服务端存活检测/僵尸连接清理 —— 死客户端永久占槽（P1）

- 证据：`ws-ai.ts:15-21` `send()` 对 `socket.send()` 仅 try/catch 吞错；全仓 grep 无 `ws.ping(`、无 `isAlive`、无 `terminate()`、无基于 pong 的 idle 超时。唯一"心跳"是 `ws-ai.ts:1091-1112`（Coze 端点）每 3s 向客户端**单向推送** `conversation.message.delta` 伪装帧（content 字段 `'的'`），不校验对端是否存活。
- 复现：客户端 TCP 静默断开（移动网切换/NAT 超时，不发 close 帧）。因无 `ws.ping()`+pong 超时，服务端 `socket` 保持 OPEN，`userConnectionLimiter`(16) 槽位与 `aiCallRateLimiter` 窗口不释放，直到底层 TCP keepalive（默认可达数小时）才触发 close。
- 影响：僵尸连接累积占满每用户 16 连接额度 → 该用户后续被 `close(4005)` 拒连；服务端 socket/FD 泄漏。`http-conn-guard.ts:28` 的 100/IP 槽同样被这些死连接长期占用。
- 定级 **P1**。

### C2. `send()` 无背压/缓冲上限、无 readyState 检查 —— 慢消费无界积压（P1）

- 证据：`ws-ai.ts:15-21`。`socket.send(JSON.stringify(obj))` 对 `ws` 库为**异步缓冲**：消费慢时帧在 Node 出站缓冲队列无界堆积。无 `bufferedAmount` 检查、无发送队列上限、无"积压超阈值即断开慢客户端"逻辑，甚至不判 `readyState` 就 send（靠 try/catch 兜关闭态）。
- 复现：agent-stream 每读一段上游 SSE 就 `send()` 一次（`ws-ai.ts:307/310/313/320/328/331`），客户端不读 socket → 缓冲单调增长直至 OOM。
- 影响：服务端内存被单条慢连接拖垮；无丢帧策略即无隔离，单连接可影响整进程。
- 定级 **P1**。

### C3. WS 鉴权 token 走 URL query（`?token=`）—— 凭证进日志/代理链路（P1）

- 证据：`ws-ai.ts:195/369/465/589/743` 等所有端点 `request.query as { token?: string }`，再 `wsAuth(socket, query.token)`。鉴权确在握手后首帧前完成（`wsAuth` 返回空即 `return`，不发 ready）——**鉴权本身存在且在连接早期**，但凭证载体是 query string。
- 影响：URL query 会进反代/CF/访问日志、浏览器历史、`Referer`；token 泄露即可被重放劫持该用户 WS 会话。属传输层凭证暴露，非逻辑越权。
- 定级 **P1**（建议改 Sec-WebSocket-Protocol 子协议或首帧鉴权）。

### C4. cancel 与上游 abort 的收尾帧竞态 —— 客户端先收 cancelled 再收 done（P2）

- 证据：`ws-ai.ts:226-229` `cmd==='cancel'` → `controller?.abort()`（**同步、未 await**）+ `send(cancelled)`。`message` 处理器为 `async`，abort 触发的 `reader.read()` reject 走 `catch(e)`：`ws-ai.ts:342-346` 判 `name!=='AbortError'` 才发 error（逻辑本意正确），但 `finally`（`ws-ai.ts:347-349`）**无条件再发一帧 `done`**。
- 影响：一次 cancel 客户端可能收到 `cancelled` + `done` 两帧收尾；错误路径也恒补 `done`，前端难区分"正常结束/已取消/出错收尾"。
- 定级 **P2**（语义混乱，非崩溃）。

### C5. 上游错误透传弱化 + 连接不收尾（P2）

- 证据：`ws-ai.ts:273-275` `!resp.ok` → `send({event:'error', msg:'AI service '+resp.status})` 后 `return`，**不 close socket**；`ws-ai.ts:330-335` 上游 `error` 事件仅透传 `message` 字段，丢弃上游错误码/类型；错误后连接保持开启等下一条输入。
- 影响：错误可观测性差（只有 HTTP status 或裸 message）；连接长期复用无重置，上游半失败后状态不明。
- 定级 **P2**。

### C6. 每用户连接上限计数口径存疑（P2 / 存疑）

- 证据：`ws-ai.ts:183` 单个 `WsUserConnectionLimiter(16)` 实例；`acquire/release` 散布在约 8 个端点块（`201/374/470/594/748/916/997/1075`）。注释"AI 端点较多，阈值放宽到 16"与单实例组合下，一个用户开满 16 条**不同类型**流即被全局拒，与"每端点 16"的直觉不符。
- 需实读 `ws-helpers.ts` 确认 `acquire` 键是否含端点维度 —— **未覆盖，归入存疑**。

## 二、不完整实现

- **http-conn-guard 阈值为拍定值**：`http-conn-guard.ts:20-21` 自述 `MAX_CONN_PER_IP=100` 与 `resolveMaxConnections` 默认 20000 均"不是从生产流量分布量出来的"，无连接数直方图；20000 全局顶溢出时 Node 直接拒收新 TCP（用户见连接失败而非 429），不可观测。
- **健康检查豁免可被 UA 伪造绕过**：`http-conn-guard.ts:30-37,112` 按 `user-agent` 关键字（`prometheus`/`uptime` 等）豁免限流，攻击者伪造该 UA 即绕过 100/IP 闸。
- **sse-registry 仅装配**：全 51 行只做 decorate + onClose dispose + 远端 abort 订阅；memory backend 下 `abortLocalStreams` 为 no-op（`sse-registry.ts:26`），多副本中断传播在单副本部署等于无——注释自述 ws-ai 的 1:1 连接不依赖该注册表，故 WS 中断不经过它。

## 三、存疑 / 未覆盖

- **wsAuth 实现**（`ws-helpers.ts`）未读：无法确认 JWT 校验强度、会话归属是否绑定 conversationId→userId。ws-ai.ts 内多处用 F-112 `mergeServerMetadata`（`150-155`，"服务端值后覆盖防客户端伪造 userId"）+ `resolveCozeIdentity`（`161-166`，只采连接态）做了**出站身份固化**，说明跨用户伪造已被有意识封堵；但"同一用户访问他人 conversationId"是否在 WS 层校验**未覆盖**。
- **heartbeatTimer 清理**：Coze 端点 `startHeartbeat` 在 `ws-ai.ts:1091`，close 处理在 `1282`——**未读 1282-1302**，无法确认 `stopHeartbeat` 在 close 时被调用；若未调用即**每连接泄漏一个 3s interval**（潜在 P1）。标未覆盖。
- TTS/realtime/capability/provider 各端点（368-1302）发送循环与 abort 细节仅抽样，未逐段读。

## 四、问题对照速答

1. **心跳/僵尸**：仅 Coze 端点 3s 单向伪心跳帧；无 ws.ping/pong、无 idle 超时、无 terminate → **有泄漏（C1，P1）**。
2. **背压**：`send()` 无缓冲上限/无 bufferedAmount/无慢消费踢除 → **无界积压，无丢帧（C2，P1）**。
3. **中断传播**：客户端 cancel/interrupt → `AbortController.abort()` 传入 `aiServiceFetchStream` 的 `signal`（`ws-ai.ts:271`），上游 fetch 被中止；close 时也 `controller?.abort()`（`353-354`）。AbortError 被静默不报错。上游连接关闭依赖 signal 传播，基本正确；收尾帧语义混乱（C4）。
4. **鉴权**：握手后首帧前 `wsAuth(socket, query.token)`，失败即 return；出站身份经 mergeServerMetadata 固化。漏洞在 **token 走 query（C3，P1）**；会话级跨用户隔离未覆盖。
5. **连接数/慢消费踢除**：`http-conn-guard` 100/IP + 全局 20000，preHandler 占槽、reply.raw close/onResponse/onRequestAbort 三通道归还（对 hijack 流式出口闭合，`87-102`）。**无慢消费踢除**；阈值拍定、UA 豁免可绕（不完整实现）。
6. **错误透传**：上游非 ok→`error` 帧（仅 status）；SSE error 事件→透传 message；错误后**不关连接**，且 finally 恒补 `done`（C5，P2）。

## 五、摘要

- 确凿缺陷：6 条（C1–C6）。
- P0：0 条。
- P1：3 条 —— C1 无存活检测/僵尸连接泄漏占槽；C2 `send()` 无背压上限、慢消费无界积压；C3 鉴权 token 走 URL query 泄露风险。
- P2：3 条 —— C4 cancel/abort 收尾帧竞态；C5 上游错误透传弱化且连接不收尾；C6 每用户连接上限计数口径存疑。
- 主要未覆盖：wsAuth 强度与会话归属校验、heartbeatTimer 在 close 的清理、TTS/realtime 等端点发送循环细节。前端 D1–D6 未涉及。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
