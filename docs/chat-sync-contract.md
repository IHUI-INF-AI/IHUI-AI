<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# chat 多端/多标签实时同步 —— 「同一消息 patch 幂等」契约

> 状态:**通道已接线,余面按 §7 逐项标注**(2026-10-25 现读:WS 房间广播 + rev 持久化 + 快照端点已在 HEAD)。
> 本文件是台账票 B02(V2 #23;票71 那行是同题历史副本,不得再登记第二行)的契约正本;
> 判据内核与类型在 `packages/types/src/chat-sync-contract.ts`,判据回归在
> `packages/types/tests/chat-sync-contract-*.test.ts`。三处同源的规则/表格若要改,必须一次改齐。

## 0. 这份契约管什么、不管什么

管:同一条会话的消息面,同时被**两条投递通道**喂时,接收端如何把"同一逻辑变更到达两次"裁成零变化、
把"迟到/乱序/断链"裁成确定行为。SSE(生成端单播流,含重连重放)与 WS(多端房间广播,未来)都适用。

不管:传输本身(帧编码、连接生命周期、房间成员协议)、发送端乐观本(未到服务端的本地改动)、
消息落库与历史拉取。这些属通道接线票与后续票。

## 1. 通道与投递语义

| 通道 | 角色 | 语义 |
| --- | --- | --- |
| SSE | 生成端单播流(delta/重连重放) | at-least-once |
| WS | conversation 房间广播(`message:created` / `message:patched`) | at-least-once |

两条通道都**不承诺 exactly-once、不承诺有序**。同一逻辑变更大概率到达两次、且可能乱序——
幂等不是通道的恩赐,是接收端的义务。

## 2. 幂等主键与修订号(三条不许漂,与内核头注逐字同源)

1. **幂等主键 = `(messageId, rev)`。** 同一逻辑变更无论走哪条通道,这对键必须逐字相同;
   `message:created` 以 messageId 本身判重(创建天然唯一,无修订号)。
2. **rev 由服务端分配**:每消息从 1 起、严格递增、不重号、不回退。端侧乐观本不在本契约内,
   不得自造 rev 混入同一条链。
3. **`snapshot` 自包含判据**:rev=N 的 snapshot 必须已包含 ≤N 的全部内容变更。
   这一条成立,才有"低 rev 迟到一律丢弃(stale)永远安全"——它防的是
   "WS 快照落地后,SSE 迟到的 delta 把内容回退到半截"。

载荷形态只此两种:`delta`(追加增量,rev 必须恰好 = 已应用 rev + 1)与
`snapshot`(全量替换,自包含、可跨 gap 应用,恢复路径靠它)。新增形态(meta/结构位、
与票64 pin/书签 sibling 存储共面)必须升 `protocolVersion`。

## 3. 事件形状与类型落点

- 事件封套:`{ protocolVersion, channel: 'sse'|'ws', room: {kind:'conversation', conversationId}, messageId, … }`;
  `channel`/`room`/`emittedAt` 是投递元数据,**不参与幂等判定**(时钟不可信)。
- 两个事件:`message:created`(完整初面)、`message:patched`(rev + delta/snapshot 载荷)。
- 类型与判据内核:`packages/types/src/chat-sync-contract.ts`(`@ihui/types` 内,主入口与
  `@ihui/types/chat-sync-contract` 子路径双出口均已登记)。
- 帧名常量:**唯一真相源 = `packages/types/src/chat-sync-contract.ts` 的 `CHAT_SYNC_EVENT_NAMES`**
  (`message:created` / `message:patched`)。送信契约 `packages/shared/src/sse/contract.ts` 的
  `SSE_CHAT_SYNC_EVENT_NAMES` 直接引用同一对象(不重写值),且**刻意不并进** `SSE_EVENTS`:
  后者与 ai-service `sse_contract.py` 由 `check-agent-event-parity.mjs` 逐名等值对账(并进去 = 恒红),
  且 `isSSEEventName` 不得把消息面帧路由进生成流处理。两侧引用锁:
  `packages/types/tests/chat-sync-contract-frame-names.test.ts` 与
  `packages/shared/src/sse/__tests__/chat-sync-frame-names.test.ts`。

## 4. 接收端裁定表(与内核 JSDoc 逐字同源;唯一入口 `applyChatSyncEvent`)

| 输入 | 裁定 | 状态 |
| --- | --- | --- |
| created,messages 已有该 id | duplicate | 不变(不得覆盖已收 patch 的面——重放不能把流式增量打回初稿) |
| patched,消息不存在(含 created 未达) | gap | 不变 |
| patched,rev === lastAppliedRev | duplicate | 不变 |
| patched,rev < lastAppliedRev | stale | 不变 |
| delta,rev > lastAppliedRev + 1 | gap | 不变 |
| snapshot,rev > lastAppliedRev | 应用 | 自包含,可跨 gap |
| delta,rev === lastAppliedRev + 1 | 应用 | 追加 textDelta |

被拒(duplicate/stale/gap)时 `applyChatSyncEvent` 返回**原 state 引用**——接收端据此保证
拒绝不触发状态发布/重渲染。判 gap 的接收端应发起 resync(拉服务端权威快照),缺 rev 的帧
**可以原样缓存重投**:补齐缺失 rev 后重投即收敛(用例⑤),不需要重组载荷。

## 5. 幂等判据 ↔ 测试用例映射

| 判据 | 用例(tests/chat-sync-contract-idempotency.test.ts) |
| --- | --- |
| created 双投递判重,且不得覆盖已收 patch 的面 | ① |
| delta 拼接判据(逐 rev 追加) | ② |
| **主判据 apply∘apply = apply**(同 envelope 二次应用零变化、引用不变) | ③ |
| stale:低 rev 迟到一律丢弃;跨通道竞速下快照不被 delta 回退 | ④ |
| gap:delta 断链拒绝、不丢帧位、补齐后收敛 | ⑤ |
| snapshot 自包含跨 gap 落地 | ⑥ |
| 双通道同源:同一逻辑变更 sse/ws 双投恰好生效一次,幂等键相等 | ⑦ |
| created 缺失 → patch 判 gap;created 补达后链恢复 | ⑧ |
| 收敛判据:任一序列逐帧双投递(+乱序迟到),终态与单投递逐字一致 | ⑨ |
| 幂等键字符串形状逐字锁定 | ⑩ |

## 6. 生产端义务

- 同一逻辑变更在两条通道上必须携带**逐字相同**的 `(messageId, rev, kind, 载荷)`;
  `channel`/`room`/`emittedAt` 允许不同。
- 允许 at-least-once(重复投递、乱序发送都合法);不允许跳过 rev 发明新键。
- rev 分配点是服务端唯一写入方;接收端发现 rev 回退 = 生产端违约,按 stale 处理并另行告警。

## 7. 余面清单(2026-10-25 逐项状态)

1. ✅ **帧名收敛**(2026-10-25 收口):见 §3 —— `CHAT_SYNC_EVENT_NAMES` 单源,sse 侧只引用不重写值。
2. ⬜ **WS 房间协议**:订阅/退订、房间成员与在线态、连接生命周期。已落地的是房间键
   (`conv:<conversationId>`)与按成员 userId 集合的投递面;订阅协议与协作者扩员仍未定。
3. ✅ **resync 传输**(2026-10-25 收口):`ChatSyncMessageSnapshot` +
   `GET /conversations/:id/messages/:messageId/sync-snapshot`(rev=N 全量;rev=0 = 链上无 patch)。
4. ⬜ **terminal/done 帧 —— 本轮不做**(2026-10-25 判定,不留在类型层当空壳):终态必须由
   生产端(流收尾写库 + 广播)与消费端(web store 投影)同批落地;只在 `message:patched` 上加
   `status?` 属"类型层加可选项、实现照旧"的假支持。前置 = 路由/ai-service 与 web store
   两侧同批排期(本切片两处均在他席在飞),新增形态须升 `protocolVersion`。
5. ⬜ **meta 结构性 patch —— 本轮不做**:pin/书签等结构位与票64 的 sibling 存储共面,须一次升
   `chat-sync.v2`(或子版本);同样受"生产 + 消费同批"约束,单侧加字段不得合入。
6. ⬜ **各端 store 接线**:web 已接(`apps/web/src/stores/chat.ts` 的 `applyChatSync` /
   `applyChatSyncSnapshot`)。**taro/RN/cli/extension 本轮不做**:现读 taro/RN 的 `src/stores/`
   没有 chat store(消息持在各聊天页的局部 state),且这两端的运行期验证(微信开发者工具 /
   Android 模拟器)本机不具备(AGENTS §17)。前置 = 各自把消息面抽成 store +
   `src/lib/user-broadcast.ts` 追加 `message:*` handler,且两端同批(§9)。
7. ⬜ 跨消息排序与房间的会话级事件(标题改名等)是否入契约。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
